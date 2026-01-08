// src/middlewares/subscriptionCheck.js
const { pool } = require('../config/database');
const { forbiddenResponse } = require('../utils/response');
const { SUBSCRIPTION_STATUS, USER_ROLES } = require('../config/constants');

/**
 * Vérifie que l'utilisateur a un abonnement actif
 */
async function requireActiveSubscription(req, res, next) {
  try {
    // Super Admin bypass la vérification
    if (req.user.role === USER_ROLES.SUPER_ADMIN) {
      return next();
    }

    const [subscriptions] = await pool.execute(
      `SELECT s.*, sp.name as plan_name
       FROM subscriptions s
       JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE s.user_id = ? AND s.status IN (?, ?)
       ORDER BY s.id DESC LIMIT 1`,
      [req.user.id, SUBSCRIPTION_STATUS.TRIAL, SUBSCRIPTION_STATUS.ACTIVE]
    );

    if (subscriptions.length === 0) {
      return forbiddenResponse(
        res,
        'Aucun abonnement actif. Veuillez contacter le support pour activer votre compte au +237 671646335.'
      );
    }

    const subscription = subscriptions[0];

    // Vérifier expiration
    if (subscription.expires_at && new Date(subscription.expires_at) < new Date()) {
      return forbiddenResponse(
        res,
        'Votre abonnement a expiré. Veuillez le renouveler pour continuer au +237 671646335.'
      );
    }

    // Ajouter l'abonnement au contexte de la requête
    req.subscription = subscription;
    next();
  } catch (error) {
    console.error('Erreur vérification abonnement:', error);
    next(error);
  }
}

/**
 * Vérifie les limites d'usage du plan
 * @param {string} limitType - Type de limite (products, orders)
 */
function checkPlanLimit(limitType) {
  return async (req, res, next) => {
    try {
      // Super Admin bypass
      if (req.user.role === USER_ROLES.SUPER_ADMIN) {
        return next();
      }

      if (!req.subscription) {
        return forbiddenResponse(res, 'Abonnement non trouvé');
      }

      const [plans] = await pool.execute(
        'SELECT * FROM subscription_plans WHERE id = ?',
        [req.subscription.plan_id]
      );

      if (plans.length === 0) {
        return next();
      }

      const plan = plans[0];

      // Vérifier limite produits
      if (limitType === 'products') {
        if (plan.max_products === -1) {
          return next(); // Illimité
        }

        const [count] = await pool.execute(
          'SELECT COUNT(*) as total FROM products WHERE user_id = ? AND deleted_at IS NULL',
          [req.user.id]
        );

        if (count[0].total >= plan.max_products) {
          return forbiddenResponse(
            res,
            `Limite de produits atteinte (${plan.max_products}). Passez à un plan supérieur.`
          );
        }
      }

      // Vérifier limite commandes mensuelles
      if (limitType === 'orders') {
        if (plan.max_orders_per_month === -1) {
          return next(); // Illimité
        }

        // Utiliser le compteur de l'abonnement
        if (req.subscription.current_month_orders >= plan.max_orders_per_month) {
          return forbiddenResponse(
            res,
            `Limite de commandes mensuelles atteinte (${plan.max_orders_per_month}). Passez à un plan supérieur.`
          );
        }
      }

      next();
    } catch (error) {
      console.error('Erreur vérification limite:', error);
      next(error);
    }
  };
}

/**
 * Vérifie qu'une fonctionnalité est incluse dans le plan
 * @param {string} feature - Nom de la feature (analytics, api_access, etc.)
 */
function requireFeature(feature) {
  return async (req, res, next) => {
    try {
      // Super Admin bypass
      if (req.user.role === USER_ROLES.SUPER_ADMIN) {
        return next();
      }

      if (!req.subscription) {
        return forbiddenResponse(res, 'Abonnement non trouvé');
      }

      const [plans] = await pool.execute(
        'SELECT * FROM subscription_plans WHERE id = ?',
        [req.subscription.plan_id]
      );

      if (plans.length === 0) {
        return forbiddenResponse(res, 'Plan introuvable');
      }

      const plan = plans[0];
      const featureColumn = `has_${feature}`;

      if (!plan[featureColumn]) {
        return forbiddenResponse(
          res,
          `Cette fonctionnalité n'est pas incluse dans votre plan. Passez à un plan supérieur.`
        );
      }

      next();
    } catch (error) {
      console.error('Erreur vérification feature:', error);
      next(error);
    }
  };
}

/**
 * Incrémente le compteur de commandes mensuelles
 */
async function incrementOrderCount(req, res, next) {
  try {
    // Ne pas incrémenter pour super admin
    if (req.user.role === USER_ROLES.SUPER_ADMIN) {
      return next();
    }

    await pool.execute(
      'UPDATE subscriptions SET current_month_orders = current_month_orders + 1 WHERE user_id = ? AND status IN (?, ?)',
      [req.user.id, SUBSCRIPTION_STATUS.TRIAL, SUBSCRIPTION_STATUS.ACTIVE]
    );

    next();
  } catch (error) {
    console.error('Erreur incrémentation compteur:', error);
    next(error);
  }
}
 
module.exports = {
  requireActiveSubscription,
  checkPlanLimit,
  requireFeature,
  incrementOrderCount
};