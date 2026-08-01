// src/services/orderService.js
const { pool } = require('../config/database');
const { generateOrderNumber, calculateOffset, buildWhatsAppOrderUrl } = require('../utils/helpers');
const { AppError } = require('../middlewares/errorHandler');
const { ORDER_STATUS } = require('../config/constants');
const { addNotificationJob } = require('../queues/NotificationQueue'); // ✨ NOUVEAU WhatsApp Automation

/**
 * Service de gestion des commandes
 */
class OrderService {
  /**
   * Crée une nouvelle commande depuis un lien produit (PUBLIC)
   */
  async createOrder(orderData) {
    const { product_id, customer_name, customer_phone, customer_address, quantity, notes } = orderData;

    // Récupérer le produit
    const [products] = await pool.execute(
      'SELECT id, user_id, name, price, currency, stock_quantity, is_available FROM products WHERE id = ? AND deleted_at IS NULL',
      [product_id]
    );

    if (products.length === 0) {
      throw new AppError('Produit introuvable', 404);
    }

    const product = products[0];

    // --- VÉRIFICATION LIMITES PLAN GRATUIT ---
    const [planInfo] = await pool.execute(`
      SELECT COALESCE(LOWER(sp.name), 'free') as plan_slug
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id AND (s.status = 'active' OR s.status = 'trial')
      LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE u.id = ?
    `, [product.user_id]);

    const planSlug = planInfo.length > 0 ? planInfo[0].plan_slug : 'free';
    if (planSlug === 'free' || planSlug === 'gratuit') {
      // Compter les commandes de la semaine dernière
      const [orderCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
        [product.user_id]
      );
      if (orderCount[0].count >= 20) {
        throw new AppError('Ce vendeur a atteint sa limite de commandes hebdomadaires (Plan Gratuit).', 403);
      }
    }

    if (!product.is_available) {
      throw new AppError('Produit indisponible', 400);
    }

    if (product.stock_quantity > 0 && product.stock_quantity < quantity) {
      throw new AppError('Stock insuffisant', 400);
    }

    // Vérifier/créer le client
    let customerId = null;
    const [existingCustomers] = await pool.execute(
      'SELECT id FROM customers WHERE user_id = ? AND phone = ? AND deleted_at IS NULL',
      [product.user_id, customer_phone]
    );

    if (existingCustomers.length > 0) {
      customerId = existingCustomers[0].id;
    } else {
      const [customerResult] = await pool.execute(
        'INSERT INTO customers (user_id, name, phone, whatsapp_number) VALUES (?, ?, ?, ?)',
        [product.user_id, customer_name, customer_phone, customer_phone]
      );
      customerId = customerResult.insertId;
    }

    // Calculer le montant total
    const total_amount = product.price * quantity;
    const order_number = generateOrderNumber();

    // Créer la commande
    const [result] = await pool.execute(
      `INSERT INTO orders 
       (user_id, customer_id, product_id, order_number, customer_name, customer_phone, customer_address,
        product_name, product_price, quantity, total_amount, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product.user_id,
        customerId,
        product_id,
        order_number,
        customer_name,
        customer_phone,
        customer_address,
        product.name,
        product.price,
        quantity,
        total_amount,
        ORDER_STATUS.NOUVELLE,
        notes
      ]
    );

    // Mettre à jour les statistiques
    await pool.execute(
      'UPDATE products SET order_count = order_count + 1 WHERE id = ?',
      [product_id]
    );

    await pool.execute(
      'UPDATE customers SET total_orders = total_orders + 1, total_spent = total_spent + ?, last_order_at = NOW() WHERE id = ?',
      [total_amount, customerId]
    );

    if (product.stock_quantity > 0) {
      await pool.execute(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [quantity, product_id]
      );
    }

    // --- LOGIQUE REDIRECTION WHATSAPP ---
    // 1. Récupérer les intégrations du vendeur
    const [integrations] = await pool.execute(
      'SELECT whatsapp_number, whatsapp_enabled, custom_order_message FROM social_integrations WHERE user_id = ?',
      [product.user_id]
    );

    // 2. Vérifier si le vendeur a le plan Business
    const [planAccess] = await pool.execute(
      `SELECT plan_name FROM v_user_plan_access 
       WHERE user_id = ? AND plan_name = 'Business' 
       AND (subscription_status = 'active' OR subscription_status = 'trial')`,
      [product.user_id]
    );

    let whatsappUrl = null;
    let vendorWhatsAppNumber = null;
    if (integrations.length > 0) {
      const config = integrations[0];
      vendorWhatsAppNumber = config.whatsapp_number;
      if (config.whatsapp_enabled && config.whatsapp_number) {
        const isBusiness = planAccess.length > 0;
        const template = isBusiness ? config.custom_order_message : null;

        whatsappUrl = buildWhatsAppOrderUrl(
          product,
          config.whatsapp_number,
          quantity,
          template
        );
      }
    }

    const order = await this.getOrderById(result.insertId, product.user_id);
    
    // ✨ NOUVEAU: Déclencher la notification WhatsApp via BullMQ
    if (vendorWhatsAppNumber) {
        addNotificationJob('new_order', {
            order: order,
            vendorWhatsApp: vendorWhatsAppNumber,
            storeSlug: 'store' // on n'a pas le slug exact ici, mais pas indispensable pour le message
        }).catch(err => console.error('Erreur ajout job notification:', err));
    }

    return { ...order, whatsapp_url: whatsappUrl };
  }

  /**
   * ✨ NOUVEAU - Créer une commande manuellement (VENDEUR)
   */
  async createManualOrder(userId, orderData) {
    const { product_id, customer_name, customer_phone, customer_address, quantity, notes, status } = orderData;

    // Vérifier que le produit appartient au vendeur
    const [products] = await pool.execute(
      'SELECT id, user_id, name, price, currency, stock_quantity, is_available FROM products WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [product_id, userId]
    );

    if (products.length === 0) {
      throw new AppError('Produit introuvable ou non autorisé', 404);
    }

    const product = products[0];

    // Vérifier stock
    if (product.stock_quantity > 0 && product.stock_quantity < quantity) {
      throw new AppError('Stock insuffisant', 400);
    }

    // Vérifier/créer le client
    let customerId = null;
    const [existingCustomers] = await pool.execute(
      'SELECT id FROM customers WHERE user_id = ? AND phone = ? AND deleted_at IS NULL',
      [userId, customer_phone]
    );

    if (existingCustomers.length > 0) {
      customerId = existingCustomers[0].id;

      // Mettre à jour le nom si différent
      await pool.execute(
        'UPDATE customers SET name = ? WHERE id = ?',
        [customer_name, customerId]
      );
    } else {
      const [customerResult] = await pool.execute(
        'INSERT INTO customers (user_id, name, phone, whatsapp_number) VALUES (?, ?, ?, ?)',
        [userId, customer_name, customer_phone, customer_phone]
      );
      customerId = customerResult.insertId;
    }

    const total_amount = product.price * quantity;
    const order_number = generateOrderNumber();
    const orderStatus = status || ORDER_STATUS.NOUVELLE;

    // Créer la commande
    const [result] = await pool.execute(
      `INSERT INTO orders 
       (user_id, customer_id, product_id, order_number, customer_name, customer_phone, customer_address,
        product_name, product_price, quantity, total_amount, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        customerId,
        product_id,
        order_number,
        customer_name,
        customer_phone,
        customer_address || null,
        product.name,
        product.price,
        quantity,
        total_amount,
        orderStatus,
        notes || null
      ]
    );

    // Mettre à jour les stats
    await pool.execute(
      'UPDATE products SET order_count = order_count + 1 WHERE id = ?',
      [product_id]
    );

    await pool.execute(
      'UPDATE customers SET total_orders = total_orders + 1, total_spent = total_spent + ?, last_order_at = NOW() WHERE id = ?',
      [total_amount, customerId]
    );

    if (product.stock_quantity > 0) {
      await pool.execute(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [quantity, product_id]
      );
    }

    return this.getOrderById(result.insertId, userId);
  }

  /**
   * Récupère une commande par ID
   */
  async getOrderById(orderId, userId) {
    const [orders] = await pool.execute(
      `SELECT o.*, c.name as customer_name_full, c.phone as customer_phone_full
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ? AND o.user_id = ? AND o.deleted_at IS NULL`,
      [orderId, userId]
    );

    if (orders.length === 0) {
      throw new AppError('Commande introuvable', 404);
    }

    return orders[0];
  }

  /**
   * Liste les commandes d'un vendeur
   */
  async getOrdersByUser(userId, { page = 1, limit = 20, status = null }) {
    const offset = calculateOffset(page, limit);

    let query = `
      SELECT o.*, c.name as customer_name_full
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.user_id = ? AND o.deleted_at IS NULL
    `;
    const params = [userId];

    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }

    query += ' ORDER BY o.created_at DESC';
    // params.push(limit, offset);

    const [orders] = await pool.execute(query, params);

    // Compter le total
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM orders 
       WHERE user_id = ? AND deleted_at IS NULL ${status ? 'AND status = ?' : ''}`,
      status ? [userId, status] : [userId]
    );

    return {
      orders,
      pagination: {
        page,
        limit,
        total: countResult[0].total
      }
    };
  }

  /**
   * ✨ NOUVEAU - Met à jour complètement une commande
   */
  async updateOrder(orderId, userId, updates) {
    // Vérifier que la commande appartient au vendeur
    const currentOrder = await this.getOrderById(orderId, userId);

    const fields = [];
    const values = [];

    // Customer info
    if (updates.customer_name !== undefined) {
      fields.push('customer_name = ?');
      values.push(updates.customer_name);
    }

    if (updates.customer_phone !== undefined) {
      fields.push('customer_phone = ?');
      values.push(updates.customer_phone);
    }

    if (updates.customer_address !== undefined) {
      fields.push('customer_address = ?');
      values.push(updates.customer_address);
    }

    // Quantity (recalculer le total)
    if (updates.quantity !== undefined && updates.quantity !== currentOrder.quantity) {
      const newQuantity = parseInt(updates.quantity);

      if (newQuantity < 1) {
        throw new AppError('Quantité invalide', 400);
      }

      const newTotal = currentOrder.product_price * newQuantity;

      fields.push('quantity = ?');
      values.push(newQuantity);

      fields.push('total_amount = ?');
      values.push(newTotal);

      // Ajuster le stock
      const stockDiff = currentOrder.quantity - newQuantity;
      if (stockDiff !== 0) {
        await pool.execute(
          'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
          [stockDiff, currentOrder.product_id]
        );
      }
    }

    // Notes
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }

    // Status
    if (updates.status !== undefined) {
      if (!Object.values(ORDER_STATUS).includes(updates.status)) {
        throw new AppError('Statut invalide', 400);
      }
      fields.push('status = ?');
      values.push(updates.status);
    }

    if (fields.length === 0) {
      throw new AppError('Aucune donnée à mettre à jour', 400);
    }

    values.push(orderId, userId);

    await pool.execute(
      `UPDATE orders SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );

    return this.getOrderById(orderId, userId);
  }

  /**
   * Met à jour le statut d'une commande
   */
  async updateOrderStatus(orderId, userId, newStatus) {
    if (!Object.values(ORDER_STATUS).includes(newStatus)) {
      throw new AppError('Statut invalide', 400);
    }

    await pool.execute(
      'UPDATE orders SET status = ? WHERE id = ? AND user_id = ?',
      [newStatus, orderId, userId]
    );

    return this.getOrderById(orderId, userId);
  }

  /**
   * Supprime une commande (soft delete)
   */
  async deleteOrder(orderId, userId) {
    const order = await this.getOrderById(orderId, userId);

    // Remettre le stock si pas livrée/annulée
    if (order.status !== ORDER_STATUS.LIVREE && order.status !== ORDER_STATUS.ANNULEE) {
      await pool.execute(
        'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
        [order.quantity, order.product_id]
      );
    }

    await pool.execute(
      'UPDATE orders SET deleted_at = NOW() WHERE id = ? AND user_id = ?',
      [orderId, userId]
    );
  }

  /**
   * Récupère les statistiques des commandes
   */
  async getOrderStats(userId) {
    const [stats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status IN ('nouvelle', 'confirmee', 'en_preparation', 'en_livraison') THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'livree' THEN 1 ELSE 0 END) as delivered_orders,
        SUM(CASE WHEN status = 'annulee' THEN 1 ELSE 0 END) as cancelled_orders,
        COALESCE(SUM(CASE WHEN status IN ('livree', 'confirmee') THEN total_amount ELSE 0 END), 0) as total_revenue
       FROM orders
       WHERE user_id = ? AND deleted_at IS NULL`,
      [userId]
    );

    const s = stats[0];
    return {
      ...s,
      avg_order_value: s.total_orders > 0 ? s.total_revenue / s.total_orders : 0
    };
  }
}

module.exports = new OrderService();
