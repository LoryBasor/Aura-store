// src/services/admin/subscriptionService.js
const { pool } = require('../../config/database');
const { AppError } = require('../../middlewares/errorHandler');
const { SUBSCRIPTION_STATUS } = require('../../config/constants');

/**
 * Service de gestion des abonnements
 */
class SubscriptionService {
  /**
   * Liste tous les plans disponibles
   */
  async listPlans({ includeInactive = false } = {}) {
    let query = 'SELECT * FROM subscription_plans';
    
    if (!includeInactive) {
      query += ' WHERE is_active = TRUE';
    }
    
    query += ' ORDER BY display_order, price ASC';

    const [plans] = await pool.execute(query);
    
    return plans.map(plan => ({
      ...plan,
      price: parseFloat(plan.price)
    }));
  }

  /**
   * Récupère un plan par ID ou slug
   */
  async getPlanById(idOrSlug) {
    const [plans] = await pool.execute(
      'SELECT * FROM subscription_plans WHERE id = ? OR slug = ?',
      [idOrSlug, idOrSlug]
    );

    if (plans.length === 0) {
      throw new AppError('Plan introuvable', 404);
    }

    return {
      ...plans[0],
      price: parseFloat(plans[0].price)
    };
  }

  /**
   * Crée un abonnement pour un vendeur
   */
  async createSubscription(userId, planId, options = {}) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Vérifier que le plan existe
      const [plans] = await connection.execute(
        'SELECT * FROM subscription_plans WHERE id = ? AND is_active = TRUE',
        [planId]
      );

      if (plans.length === 0) {
        throw new AppError('Plan introuvable ou inactif', 404);
      }

      const plan = plans[0];

      // Calculer les dates
      const now = new Date();
      const trialEnds = new Date(now.getTime() + (plan.trial_days * 24 * 60 * 60 * 1000));
      
      let currentPeriodEnd;
      switch (plan.billing_cycle) {
        case 'monthly':
          currentPeriodEnd = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
          break;
        case 'quarterly':
          currentPeriodEnd = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
          break;
        case 'yearly':
          currentPeriodEnd = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000));
          break;
        default:
          currentPeriodEnd = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
      }

      const status = plan.trial_days > 0 ? SUBSCRIPTION_STATUS.TRIAL : SUBSCRIPTION_STATUS.ACTIVE;
      const expiresAt = plan.trial_days > 0 ? trialEnds : currentPeriodEnd;

      // Annuler les anciens abonnements actifs
      await connection.execute(
        `UPDATE subscriptions 
         SET status = 'cancelled', cancelled_at = NOW() 
         WHERE user_id = ? AND status IN ('trial', 'active')`,
        [userId]
      );

      // Créer le nouvel abonnement
      const [result] = await connection.execute(
        `INSERT INTO subscriptions 
         (user_id, plan_id, status, started_at, trial_ends_at, current_period_start, current_period_end, expires_at, notes)
         VALUES (?, ?, ?, NOW(), ?, NOW(), ?, ?, ?)`,
        [
          userId,
          planId,
          status,
          plan.trial_days > 0 ? trialEnds : null,
          currentPeriodEnd,
          expiresAt,
          options.notes || null
        ]
      );

      // Logger dans l'historique
      await connection.execute(
        `INSERT INTO subscription_history (subscription_id, user_id, plan_id, action, new_status, performed_by)
         VALUES (?, ?, ?, 'created', ?, ?)`,
        [result.insertId, userId, planId, status, options.adminId || null]
      );

      await connection.commit();

      // Récupérer l'abonnement créé
      const [subscriptions] = await connection.execute(
        'SELECT * FROM subscriptions WHERE id = ?',
        [result.insertId]
      );

      return subscriptions[0];
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Change le plan d'un vendeur
   */
  async changePlan(userId, newPlanId, adminId) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Récupérer l'abonnement actuel
      const [currentSubs] = await connection.execute(
        'SELECT * FROM subscriptions WHERE user_id = ? AND status IN (?, ?) ORDER BY id DESC LIMIT 1',
        [userId, SUBSCRIPTION_STATUS.TRIAL, SUBSCRIPTION_STATUS.ACTIVE]
      );

      if (currentSubs.length === 0) {
        throw new AppError('Aucun abonnement actif trouvé', 404);
      }

      const currentSub = currentSubs[0];

      // Récupérer le nouveau plan
      const [newPlans] = await connection.execute(
        'SELECT * FROM subscription_plans WHERE id = ?',
        [newPlanId]
      );

      if (newPlans.length === 0) {
        throw new AppError('Nouveau plan introuvable', 404);
      }

      const action = newPlans[0].price > currentSub.price ? 'upgraded' : 'downgraded';

      // Mettre à jour l'abonnement
      await connection.execute(
        'UPDATE subscriptions SET plan_id = ? WHERE id = ?',
        [newPlanId, currentSub.id]
      );

      // Logger
      await connection.execute(
        `INSERT INTO subscription_history 
         (subscription_id, user_id, plan_id, action, old_status, new_status, performed_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [currentSub.id, userId, newPlanId, action, currentSub.status, currentSub.status, adminId]
      );

      await connection.commit();

      return { success: true, action };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Prolonge un abonnement
   */
  async extendSubscription(userId, days, adminId) {
    const [subscriptions] = await pool.execute(
      'SELECT * FROM subscriptions WHERE user_id = ? AND status IN (?, ?) ORDER BY id DESC LIMIT 1',
      [userId, SUBSCRIPTION_STATUS.TRIAL, SUBSCRIPTION_STATUS.ACTIVE]
    );

    if (subscriptions.length === 0) {
      throw new AppError('Aucun abonnement trouvé', 404);
    }

    const subscription = subscriptions[0];
    const currentExpiry = new Date(subscription.expires_at);
    const newExpiry = new Date(currentExpiry.getTime() + (days * 24 * 60 * 60 * 1000));

    await pool.execute(
      'UPDATE subscriptions SET expires_at = ?, current_period_end = ? WHERE id = ?',
      [newExpiry, newExpiry, subscription.id]
    );

    // Logger
    await pool.execute(
      `INSERT INTO subscription_history 
       (subscription_id, user_id, plan_id, action, notes, performed_by)
       VALUES (?, ?, ?, 'renewed', ?, ?)`,
      [subscription.id, userId, subscription.plan_id, `Prolongé de ${days} jours`, adminId]
    );

    return { success: true, new_expiry: newExpiry };
  }

  /**
   * Annule un abonnement
   */
  async cancelSubscription(userId, reason, adminId) {
    const [subscriptions] = await pool.execute(
      'SELECT * FROM subscriptions WHERE user_id = ? AND status IN (?, ?) ORDER BY id DESC LIMIT 1',
      [userId, SUBSCRIPTION_STATUS.TRIAL, SUBSCRIPTION_STATUS.ACTIVE]
    );

    if (subscriptions.length === 0) {
      throw new AppError('Aucun abonnement actif trouvé', 404);
    }

    const subscription = subscriptions[0];

    await pool.execute(
      'UPDATE subscriptions SET status = ?, cancelled_at = NOW() WHERE id = ?',
      [SUBSCRIPTION_STATUS.CANCELLED, subscription.id]
    );

    // Logger
    await pool.execute(
      `INSERT INTO subscription_history 
       (subscription_id, user_id, plan_id, action, old_status, new_status, notes, performed_by)
       VALUES (?, ?, ?, 'cancelled', ?, ?, ?, ?)`,
      [subscription.id, userId, subscription.plan_id, subscription.status, SUBSCRIPTION_STATUS.CANCELLED, reason, adminId]
    );

    return { success: true };
  }

  /**
   * Récupère l'historique d'un abonnement
   */
  async getSubscriptionHistory(userId) {
    const [history] = await pool.execute(
      `SELECT sh.*, sp.name as plan_name, u.email as performed_by_email
       FROM subscription_history sh
       JOIN subscription_plans sp ON sh.plan_id = sp.id
       LEFT JOIN users u ON sh.performed_by = u.id
       WHERE sh.user_id = ?
       ORDER BY sh.created_at DESC`,
      [userId]
    );

    return history;
  }

  /**
   * Récupère les statistiques globales des abonnements
   */
  async getSubscriptionStats() {
    const [stats] = await pool.execute(`
      SELECT 
        (SELECT COUNT(*) FROM subscriptions WHERE status = 'trial') as trial_count,
        (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') as active_count,
        (SELECT COUNT(*) FROM subscriptions WHERE status = 'expired') as expired_count,
        (SELECT COUNT(*) FROM subscriptions WHERE status = 'cancelled') as cancelled_count,
        (SELECT COUNT(*) FROM subscriptions WHERE expires_at < NOW() AND status IN ('trial', 'active')) as expiring_soon
    `);

    return stats[0];
  }
}

module.exports = new SubscriptionService();