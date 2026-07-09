// src/services/subscriptionRenewalService.js
// Service de vérification et retour automatique au plan Gratuit
const { pool } = require('../config/database');
const emailService = require('./emailService');

/**
 * Vérifie et traite les abonnements expirés pour un utilisateur donné.
 * Appelé à chaque connexion pour une vérification en temps réel.
 * @param {number} userId - ID de l'utilisateur
 * @returns {boolean} true si un abonnement a été rétrogradé
 */
async function checkAndDowngradeUser(userId) {
  try {
    // Récupérer les abonnements actifs/trial expirés
    const [expired] = await pool.execute(
      `SELECT s.id, s.plan_id, s.status, sp.name as plan_name,
              u.email, u.business_name
       FROM subscriptions s
       JOIN subscription_plans sp ON s.plan_id = sp.id
       JOIN users u ON s.user_id = u.id
       WHERE s.user_id = ?
         AND s.status IN ('active', 'trial')
         AND s.expires_at IS NOT NULL
         AND s.expires_at < NOW()
         AND sp.slug != 'free'`,
      [userId]
    );

    if (expired.length === 0) return false;

    for (const sub of expired) {
      await downgradeToFree(userId, sub);
    }

    return true;
  } catch (error) {
    console.error('[SubscriptionRenewal] Erreur checkAndDowngradeUser:', error);
    return false;
  }
}

/**
 * Exécute la rétrogradation vers le plan Gratuit
 * @param {number} userId
 * @param {object} sub - Objet abonnement expiré
 */
async function downgradeToFree(userId, sub) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Récupérer le plan Gratuit
    const [freePlans] = await connection.execute(
      "SELECT id FROM subscription_plans WHERE slug = 'free' AND is_active = TRUE LIMIT 1"
    );

    if (freePlans.length === 0) {
      console.error('[SubscriptionRenewal] Plan Gratuit introuvable !');
      await connection.rollback();
      return;
    }

    const freePlanId = freePlans[0].id;
    const now = new Date();
    // Plan Gratuit = pas d'expiration (null)
    const freeExpiry = new Date(now.getTime() + 3650 * 24 * 60 * 60 * 1000); // 10 ans

    // 2. Marquer l'abonnement expiré
    await connection.execute(
      `UPDATE subscriptions
       SET status = 'expired'
       WHERE id = ? AND status IN ('active', 'trial')`,
      [sub.id]
    );

    // 3. Créer un nouvel abonnement Gratuit
    const [insertResult] = await connection.execute(
      `INSERT INTO subscriptions
         (user_id, plan_id, status, started_at, current_period_start, current_period_end, expires_at, notes)
       VALUES (?, ?, 'active', NOW(), NOW(), ?, ?, 'Rétrogradation automatique après expiration')`,
      [userId, freePlanId, freeExpiry, freeExpiry]
    );

    // 4. Logger dans l'historique
    await connection.execute(
      `INSERT INTO subscription_history
         (subscription_id, user_id, plan_id, action, old_status, new_status, notes)
       VALUES (?, ?, ?, 'downgraded', ?, 'active', ?)`,
      [insertResult.insertId, userId, freePlanId, sub.status, `Rétrogradé automatiquement depuis ${sub.plan_name}`]
    );

    await connection.commit();

    console.log(`[SubscriptionRenewal] Utilisateur ${userId} rétrogradé au plan Gratuit (ancien: ${sub.plan_name})`);

    // 5. Envoyer l'email de notification (sans bloquer)
    emailService.sendSubscriptionExpiredEmail(sub.email, sub.business_name, sub.plan_name)
      .catch(err => console.error('[SubscriptionRenewal] Erreur email:', err));

    // 6. Créer une notification admin
    await pool.execute(
      `INSERT INTO admin_notifications (type, title, message, reference_id, reference_type)
       VALUES ('subscription_expired', ?, ?, ?, 'subscription')`,
      [
        `Abonnement expiré : ${sub.business_name}`,
        `Le vendeur "${sub.business_name}" a été automatiquement rétrogradé du plan ${sub.plan_name} vers le plan Gratuit.`,
        userId
      ]
    );

  } catch (error) {
    await connection.rollback();
    console.error('[SubscriptionRenewal] Erreur downgradeToFree:', error);
  } finally {
    connection.release();
  }
}

/**
 * Traite TOUS les abonnements expirés (appelé par le cron job).
 * @returns {number} Nombre d'abonnements rétrogradés
 */
async function processAllExpiredSubscriptions() {
  try {
    // Récupérer tous les abonnements actifs/trial expirés (hors plan Gratuit)
    const [expiredSubs] = await pool.execute(
      `SELECT s.id, s.user_id, s.plan_id, s.status,
              sp.name as plan_name,
              u.email, u.business_name
       FROM subscriptions s
       JOIN subscription_plans sp ON s.plan_id = sp.id
       JOIN users u ON s.user_id = u.id
       WHERE s.status IN ('active', 'trial')
         AND s.expires_at IS NOT NULL
         AND s.expires_at < NOW()
         AND sp.slug != 'free'
         AND u.deleted_at IS NULL`
    );

    console.log(`[SubscriptionCron] ${expiredSubs.length} abonnements expirés trouvés`);

    let count = 0;
    for (const sub of expiredSubs) {
      await downgradeToFree(sub.user_id, sub);
      count++;
    }

    return count;
  } catch (error) {
    console.error('[SubscriptionRenewal] Erreur processAllExpiredSubscriptions:', error);
    return 0;
  }
}

module.exports = {
  checkAndDowngradeUser,
  processAllExpiredSubscriptions
};
