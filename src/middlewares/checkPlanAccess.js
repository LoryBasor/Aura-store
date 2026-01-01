// src/middlewares/checkPlanAccess.js
const { pool } = require('../config/database');
const { forbiddenResponse } = require('../utils/response');
const { USER_ROLES } = require('../config/constants');

/**
 * Plans disponibles
 */
const PLANS = {
  FREE: 'free',
  PRO: 'pro',
  BUSINESS: 'business'
};

/**
 * Hiérarchie des plans (pour comparaison)
 */
const PLAN_HIERARCHY = {
  free: 1,
  pro: 2,
  business: 3
};

/**
 * Vérifie que l'utilisateur a accès à une fonctionnalité selon son plan
 * @param {string|array} allowedPlans - Plan(s) requis ('pro', 'business' ou ['pro', 'business'])
 * @returns {function} Middleware Express
 */
function checkPlanAccess(allowedPlans) {
  // Normaliser en tableau
  const plans = Array.isArray(allowedPlans) ? allowedPlans : [allowedPlans];

  return async (req, res, next) => {
    try {
      // Super Admin bypass
      if (req.user.role === USER_ROLES.SUPER_ADMIN) {
        return next();
      }

      // Récupérer le plan actuel du vendeur
      const [subscriptions] = await pool.execute(
        `SELECT sp.slug as plan_slug
         FROM subscriptions s
         JOIN subscription_plans sp ON s.plan_id = sp.id
         WHERE s.user_id = ? AND s.status IN ('trial', 'active')
         ORDER BY s.id DESC LIMIT 1`,
        [req.user.id]
      );

      if (subscriptions.length === 0) {
        return forbiddenResponse(
          res,
          'Aucun abonnement actif. Cette fonctionnalité nécessite un abonnement.'
        );
      }

      const userPlan = subscriptions[0].plan_slug;

      // Vérifier si le plan est autorisé
      if (!plans.includes(userPlan)) {
        const requiredPlanName = plans.length === 1 
          ? plans[0].toUpperCase() 
          : plans.map(p => p.toUpperCase()).join(' ou ');

        return forbiddenResponse(
          res,
          `Cette fonctionnalité nécessite le plan ${requiredPlanName}. Votre plan actuel : ${userPlan.toUpperCase()}.`
        );
      }

      // Ajouter le plan au contexte de la requête
      req.userPlan = userPlan;
      next();
    } catch (error) {
      console.error('Erreur vérification plan:', error);
      next(error);
    }
  };
}

/**
 * Vérifie que l'utilisateur a un plan minimal requis
 * @param {string} minimalPlan - Plan minimal ('pro' ou 'business')
 * @returns {function} Middleware Express
 */
function requireMinimalPlan(minimalPlan) {
  return async (req, res, next) => {
    try {
      // Super Admin bypass
      if (req.user.role === USER_ROLES.SUPER_ADMIN) {
        return next();
      }

      const [subscriptions] = await pool.execute(
        `SELECT sp.slug as plan_slug
         FROM subscriptions s
         JOIN subscription_plans sp ON s.plan_id = sp.id
         WHERE s.user_id = ? AND s.status IN ('trial', 'active')
         ORDER BY s.id DESC LIMIT 1`,
        [req.user.id]
      );

      if (subscriptions.length === 0) {
        return forbiddenResponse(
          res,
          'Aucun abonnement actif.'
        );
      }

      const userPlan = subscriptions[0].plan_slug;
      const userLevel = PLAN_HIERARCHY[userPlan] || 0;
      const requiredLevel = PLAN_HIERARCHY[minimalPlan] || 999;

      if (userLevel < requiredLevel) {
        return forbiddenResponse(
          res,
          `Cette fonctionnalité nécessite au minimum le plan ${minimalPlan.toUpperCase()}.`
        );
      }

      req.userPlan = userPlan;
      next();
    } catch (error) {
      console.error('Erreur vérification plan minimal:', error);
      next(error);
    }
  };
}

/**
 * Ajoute le plan de l'utilisateur au contexte (sans bloquer)
 */
async function attachUserPlan(req, res, next) {
  try {
    if (!req.user) {
      return next();
    }

    const [subscriptions] = await pool.execute(
      `SELECT sp.slug as plan_slug, sp.name as plan_name
       FROM subscriptions s
       JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE s.user_id = ? AND s.status IN ('trial', 'active')
       ORDER BY s.id DESC LIMIT 1`,
      [req.user.id]
    );

    if (subscriptions.length > 0) {
      req.userPlan = subscriptions[0].plan_slug;
      req.userPlanName = subscriptions[0].plan_name;
    } else {
      req.userPlan = null;
      req.userPlanName = null;
    }

    next();
  } catch (error) {
    console.error('Erreur attachement plan:', error);
    next(error);
  }
}

module.exports = {
  PLANS,
  PLAN_HIERARCHY,
  checkPlanAccess,
  requireMinimalPlan,
  attachUserPlan
};