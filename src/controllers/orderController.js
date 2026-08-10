// src/controllers/orderController.js
const orderService = require('../services/orderService');
const { successResponse, createdResponse } = require('../utils/response');
const { pool } = require('../config/database');
const { generateOrderNumber } = require('../utils/helpers');
const { ORDER_STATUS } = require('../config/constants');
const { buildWhatsAppOrderUrl } = require('../utils/helpers');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Contrôleur de gestion des commandes
 */
class OrderController {
  /**
   * Créer une nouvelle commande (PUBLIC - depuis lien produit)
   * POST /api/orders
   */
  async createOrder(req, res, next) {
    try {
      const order = await orderService.createOrder(req.body);
      
      return createdResponse( 
        res, 
        { order }, 
        'Commande créée avec succès. Le vendeur vous contactera bientôt !'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * créer une commande manuelle (VENDEUR)
   * POST /api/orders/manual
   */
  async createManualOrder(req, res, next) {
    try {
      const order = await orderService.createManualOrder(req.user.id, req.body);
      
      return createdResponse(
        res,
        { order },
        'Commande créée avec succès'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
 * ✨ NOUVEAU - Créer une commande depuis le lien public (par token)
 * POST /api/orders/public
 */
  async createOrderFromPublicLink(req, res, next) {
    try {
      const { product_token, customer_name, customer_phone, customer_address, quantity, notes } = req.body;

      // Récupérer le produit via son token de partage
      const [productLinks] = await pool.execute(
        `SELECT pl.product_id, p.id, p.user_id, p.name, p.price, p.currency, p.stock_quantity, p.is_available
        FROM product_links pl
        JOIN products p ON pl.product_id = p.id
        WHERE pl.token = ? AND p.deleted_at IS NULL`,
        [product_token]
      );

      if (productLinks.length === 0) {
        throw new AppError('Produit introuvable ou indisponible', 404);
      }

      const product = productLinks[0];

      // Vérifier disponibilité
      if (!product.is_available) {
        throw new AppError('Produit actuellement indisponible', 400);
      }

      // Vérifier stock
      if (product.stock_quantity > 0 && product.stock_quantity < quantity) {
        throw new AppError(`Stock insuffisant. Disponible : ${product.stock_quantity}`, 400);
      }

      // Vérifier/créer le client
      let customerId = null;
      const [existingCustomers] = await pool.execute(
        'SELECT id FROM customers WHERE user_id = ? AND phone = ? AND deleted_at IS NULL',
        [product.user_id, customer_phone]
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
          product.id,
          order_number,
          customer_name,
          customer_phone,
          customer_address || null,
          product.name,
          product.price,
          quantity,
          total_amount,
          ORDER_STATUS.NOUVELLE,
          notes || null
        ]
      );

      // Mettre à jour les statistiques
      await pool.execute(
        'UPDATE products SET order_count = order_count + 1 WHERE id = ?',
        [product.id]
      );

      await pool.execute(
        'UPDATE customers SET total_orders = total_orders + 1, total_spent = total_spent + ?, last_order_at = NOW() WHERE id = ?',
        [total_amount, customerId]
      );

      if (product.stock_quantity > 0) {
        await pool.execute(
          'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
          [quantity, product.id]
        );
      }

      // Récupérer la commande créée
      const [createdOrder] = await pool.execute(
        'SELECT * FROM orders WHERE id = ?',
        [result.insertId]
      );

      return createdResponse(
        res,
        { order: createdOrder[0]},
        'Commande créée avec succès. Le vendeur vous contactera bientôt !'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * ✨ NOUVEAU - Obtenir le statut d'un envoi WhatsApp automatique
   * GET /api/orders/public/job/:jobId
   */
  async getWhatsAppJobStatus(req, res, next) {
    try {
      const { jobId } = req.params;

      const [jobs] = await pool.execute(
        'SELECT status, error_message, whatsapp_url, vendor_whatsapp_number FROM wa_outbound_jobs WHERE id = ?',
        [jobId]
      );

      if (jobs.length === 0) {
        throw new AppError('Job introuvable', 404);
      }

      return successResponse(res, { job: jobs[0] });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupérer toutes les commandes du vendeur
   * GET /api/orders
   */
  async getOrders(req, res, next) {
    try {
      const { page, limit, status } = req.query;
      
      const result = await orderService.getOrdersByUser(req.user.id, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        status: status || null
      });
      
      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupérer une commande par ID
   * GET /api/orders/:id
   */
  async getOrder(req, res, next) {
    try {
      const order = await orderService.getOrderById(
        req.params.id,
        req.user.id
      );
      
      return successResponse(res, { order });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ✨ NOUVEAU - Mettre à jour complètement une commande
   * PUT /api/orders/:id
   */
  async updateOrder(req, res, next) {
    try {
      const order = await orderService.updateOrder(
        req.params.id,
        req.user.id,
        req.body
      );
      
      return successResponse(res, { order }, 'Commande mise à jour');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour le statut d'une commande
   * PATCH /api/orders/:id/status
   */
  async updateOrderStatus(req, res, next) {
    try {
      const { status } = req.body;
      
      const order = await orderService.updateOrderStatus(
        req.params.id,
        req.user.id,
        status
      );
      
      return successResponse(res, { order }, 'Statut mis à jour');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Supprimer une commande
   * DELETE /api/orders/:id
   */
  async deleteOrder(req, res, next) {
    try {
      await orderService.deleteOrder(req.params.id, req.user.id);
      
      return successResponse(res, null, 'Commande supprimée');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupérer les statistiques des commandes
   * GET /api/orders/stats
   */
  async getOrderStats(req, res, next) {
    try {
      const stats = await orderService.getOrderStats(req.user.id);
      
      return successResponse(res, { stats });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OrderController();
