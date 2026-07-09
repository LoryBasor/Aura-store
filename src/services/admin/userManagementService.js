// src/services/admin/userManagementService.js
const { pool } = require('../../config/database');
const bcrypt = require('bcrypt');
const { AppError } = require('../../middlewares/errorHandler');
const { calculateOffset } = require('../../utils/helpers');
const { ACCOUNT_STATUS, USER_ROLES } = require('../../config/constants');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

/**
 * Service de gestion des vendeurs par le Super Admin
 */
class UserManagementService {
  /**
   * Liste tous les vendeurs avec filtres et pagination
   */
  async listAllVendors({ page = 1, limit = 20, status = null, search = null }) {
    limit = Number(limit) || 20;
    const offset = calculateOffset(page, limit);
    
    let query = `
      SELECT 
        u.id,
        u.email,
        u.business_name,
        u.phone,
        u.whatsapp_number,
        u.store_slug,
        u.account_status,
        u.is_active,
        u.is_verified,
        u.suspended_reason,
        u.suspended_at, 
        u.last_login_at,
        u.created_at,
        s.status as subscription_status,
        sp.name as plan_name,
        sp.slug as plan_slug,
        (SELECT COUNT(*) FROM products p WHERE p.user_id = u.id AND p.deleted_at IS NULL) as products_count,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.deleted_at IS NULL) as orders_count,
        (SELECT SUM(o.total_amount) FROM orders o WHERE o.user_id = u.id AND o.deleted_at IS NULL AND o.status IN ('livree', 'confirmee')) as total_revenue
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status IN ('trial', 'active')
      LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE u.role = ? AND u.deleted_at IS NULL
    `;
    
    const params = [USER_ROLES.USER];

    // Filtrer par statut
    if (status && Object.values(ACCOUNT_STATUS).includes(status)) {
      query += ' AND u.account_status = ?';
      params.push(status);
    }

    // Recherche
    if (search) {
      query += ' AND (u.email LIKE ? OR u.business_name LIKE ? OR u.phone LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    } 

    query += ` ORDER BY u.created_at DESC `;
    // params.push(offset);

    const [vendors] = await pool.execute(query, params);

    // Compter le total
    let countQuery = 'SELECT COUNT(*) as total FROM users u WHERE u.role = ? AND u.deleted_at IS NULL';
    const countParams = [USER_ROLES.USER];

    if (status) {
      countQuery += ' AND u.account_status = ?';
      countParams.push(status);
    }

    if (search) {
      countQuery += ' AND (u.email LIKE ? OR u.business_name LIKE ? OR u.phone LIKE ?)';
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern);
    }

    const [countResult] = await pool.execute(countQuery, countParams);

    return {
      vendors: vendors.map(v => ({
        ...v,
        total_revenue: parseFloat(v.total_revenue || 0)
      })),
      pagination: {
        page,
        limit,
        total: countResult[0].total
      }
    };
  }

  /**
   * Récupère les détails complets d'un vendeur
   */
  async getVendorDetails(userId) {
    // Informations de base
    const [users] = await pool.execute(
      `SELECT u.*, s.status as subscription_status, s.expires_at, s.current_month_orders,
              sp.name as plan_name, sp.max_products, sp.max_orders_per_month
       FROM users u
       LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status IN ('trial', 'active')
       LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE u.id = ? AND u.role = ? AND u.deleted_at IS NULL`,
      [userId, USER_ROLES.USER]
    );

    if (users.length === 0) {
      throw new AppError('Vendeur introuvable', 404);
    }

    const user = users[0];

    // Statistiques
    const [stats] = await pool.execute(
      `SELECT 
        (SELECT COUNT(*) FROM products WHERE user_id = ? AND deleted_at IS NULL) as total_products,
        (SELECT COUNT(*) FROM orders WHERE user_id = ? AND deleted_at IS NULL) as total_orders,
        (SELECT SUM(total_amount) FROM orders WHERE user_id = ? AND deleted_at IS NULL AND status IN ('livree', 'confirmee')) as total_revenue,
        (SELECT COUNT(*) FROM customers WHERE user_id = ? AND deleted_at IS NULL) as total_customers,
        (SELECT COUNT(*) FROM orders WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND deleted_at IS NULL) as orders_last_30_days`,
      [userId, userId, userId, userId, userId]
    );

    // Commandes récentes
    const [recentOrders] = await pool.execute(
      `SELECT id, order_number, customer_name, product_name, total_amount, status, created_at
       FROM orders WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5`,
      [userId]
    );

    // Produits du vendeur
    const [products] = await pool.execute(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.user_id = ? AND p.deleted_at IS NULL
       ORDER BY p.created_at DESC`,
      [userId]
    );

    return {
      user,
      stats: {
        total_products: stats[0].total_products || 0,
        total_orders: stats[0].total_orders || 0,
        total_revenue: parseFloat(stats[0].total_revenue || 0),
        total_customers: stats[0].total_customers || 0,
        orders_last_30_days: stats[0].orders_last_30_days || 0
      },
      recent_orders: recentOrders,
      products: products
    };
  }

  /**
   * Suspend un vendeur
   */
  async suspendVendor(userId, reason, adminId) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Vérifier que le vendeur existe
      const [users] = await connection.execute(
        'SELECT id, account_status FROM users WHERE id = ? AND role = ? AND deleted_at IS NULL',
        [userId, USER_ROLES.USER]
      );

      if (users.length === 0) {
        throw new AppError('Vendeur introuvable', 404);
      }

      if (users[0].account_status === ACCOUNT_STATUS.SUSPENDED) {
        throw new AppError('Ce vendeur est déjà suspendu', 400);
      }

      // Suspendre le compte
      await connection.execute(
        `UPDATE users 
         SET account_status = ?, suspended_reason = ?, suspended_at = NOW(), is_active = FALSE
         WHERE id = ?`,
        [ACCOUNT_STATUS.SUSPENDED, reason, userId]
      );

      // Suspendre l'abonnement
      await connection.execute(
        `UPDATE subscriptions 
         SET status = 'suspended' 
         WHERE user_id = ? AND status IN ('trial', 'active')`,
        [userId]
      );

      // Logger dans l'historique
      await connection.execute(
        `INSERT INTO subscription_history (subscription_id, user_id, plan_id, action, old_status, new_status, performed_by, notes)
         SELECT id, user_id, plan_id, 'suspended', status, 'suspended', ?, ?
         FROM subscriptions WHERE user_id = ? LIMIT 1`,
        [adminId, reason, userId]
      );

      await connection.commit();

      return { success: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Réactive un vendeur suspendu
   */
  async activateVendor(userId, adminId) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      const [users] = await connection.execute(
        'SELECT id, account_status FROM users WHERE id = ? AND role = ? AND deleted_at IS NULL',
        [userId, USER_ROLES.USER]
      );

      if (users.length === 0) {
        throw new AppError('Vendeur introuvable', 404);
      }

      // Réactiver le compte
      await connection.execute(
        `UPDATE users 
         SET account_status = ?, suspended_reason = NULL, suspended_at = NULL, is_active = TRUE
         WHERE id = ?`,
        [ACCOUNT_STATUS.ACTIVE, userId]
      );

      // Réactiver l'abonnement s'il n'est pas expiré
      await connection.execute(
        `UPDATE subscriptions 
         SET status = CASE 
           WHEN expires_at > NOW() OR expires_at IS NULL THEN 'active'
           ELSE 'expired'
         END
         WHERE user_id = ? AND status = 'suspended'`,
        [userId]
      );

      await connection.commit();

      return { success: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Désactive définitivement un vendeur
   */
  async deactivateVendor(userId, adminId) {
    await pool.execute(
      `UPDATE users 
       SET account_status = ?, is_active = FALSE
       WHERE id = ? AND role = ?`,
      [ACCOUNT_STATUS.DEACTIVATED, userId, USER_ROLES.USER]
    );

    return { success: true };
  }

  /**
   * Réinitialise le mot de passe d'un vendeur
   */
  async resetVendorPassword(userId, newPassword, mustChange = true, adminId) {
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await pool.execute(
      'UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ? AND role = ?',
      [passwordHash, mustChange, userId, USER_ROLES.USER]
    );

    return { success: true, temporary_password: newPassword };
  }

  /**
   * Marque un vendeur comme vérifié
   * POST /api/admin/vendors/:userId/verify
   */
  async verifyVendor(userId, adminId) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Vérifier que le vendeur existe
      const [users] = await connection.execute(
        'SELECT id, is_verified FROM users WHERE id = ? AND role = ? AND deleted_at IS NULL',
        [userId, USER_ROLES.USER]
      );

      if (users.length === 0) {
        throw new AppError('Vendeur introuvable', 404);
      }

      if (users[0].is_verified) {
        throw new AppError('Ce vendeur est déjà vérifié', 400);
      }

      // Marquer comme vérifié
      await connection.execute(
        `UPDATE users 
         SET is_verified = TRUE, verified_at = NOW(), verified_by = ?
         WHERE id = ?`,
        [adminId, userId]
      );

      await connection.commit();
      return { success: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Retire la vérification d'un vendeur
   * POST /api/admin/vendors/:userId/unverify
   */
  async unverifyVendor(userId, adminId) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Vérifier que le vendeur existe
      const [users] = await connection.execute(
        'SELECT id, is_verified FROM users WHERE id = ? AND role = ? AND deleted_at IS NULL',
        [userId, USER_ROLES.USER]
      );

      if (users.length === 0) {
        throw new AppError('Vendeur introuvable', 404);
      }

      if (!users[0].is_verified) {
        throw new AppError('Ce vendeur n\'est pas vérifié', 400);
      }

      // Retirer la vérification
      await connection.execute(
        `UPDATE users 
         SET is_verified = FALSE, verified_at = NULL, verified_by = NULL
         WHERE id = ?`,
        [userId]
      );

      await connection.commit();
      return { success: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Génère un mot de passe temporaire aléatoire
   */
  generateTemporaryPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}

module.exports = new UserManagementService();