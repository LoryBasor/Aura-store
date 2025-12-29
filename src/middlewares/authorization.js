// src/middlewares/authorization.js
const { forbiddenResponse } = require('../utils/response');
const { USER_ROLES } = require('../config/constants');

/**
 * Middleware de vérification de rôle
 * Vérifie que l'utilisateur a le rôle requis
 * 
 * @param {...string} allowedRoles - Rôles autorisés
 * @returns {function} Middleware Express
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    // L'utilisateur doit être authentifié (via authenticate middleware)
    if (!req.user) {
      return forbiddenResponse(res, 'Authentification requise');
    }

    // Vérifier le rôle
    if (!allowedRoles.includes(req.user.role)) {
      return forbiddenResponse(
        res, 
        'Vous n\'avez pas les permissions nécessaires pour cette action'
      );
    }

    next();
  };
}

/**
 * Middleware spécifique pour Super Admin
 * Raccourci pour requireRole(USER_ROLES.SUPER_ADMIN)
 */
function requireSuperAdmin(req, res, next) {
  return requireRole(USER_ROLES.SUPER_ADMIN)(req, res, next);
}

/**
 * Middleware spécifique pour User (vendeur)
 * Raccourci pour requireRole(USER_ROLES.USER)
 */
function requireUser(req, res, next) {
  return requireRole(USER_ROLES.USER)(req, res, next);
}

/**
 * Middleware pour vérifier que l'utilisateur n'est pas suspendu
 */
function checkAccountStatus(req, res, next) {
  if (!req.user) {
    return next();
  }

  // Récupérer le statut complet depuis la DB
  const { pool } = require('../config/database');
  
  pool.execute(
    'SELECT account_status, suspended_reason FROM users WHERE id = ?',
    [req.user.id]
  )
  .then(([users]) => {
    if (users.length === 0) {
      return forbiddenResponse(res, 'Compte introuvable');
    }

    const user = users[0];

    // Vérifier si le compte est suspendu
    if (user.account_status === 'suspended') {
      return forbiddenResponse(
        res,
        `Compte suspendu. Raison: ${user.suspended_reason || 'Non spécifiée'}`
      );
    }

    // Vérifier si le compte est désactivé
    if (user.account_status === 'deactivated') {
      return forbiddenResponse(res, 'Compte désactivé. Contactez le support.');
    }

    next();
  })
  .catch(error => {
    console.error('Erreur vérification statut compte:', error);
    next(error);
  });
}

module.exports = {
  requireRole,
  requireSuperAdmin,
  requireUser,
  checkAccountStatus
};