// src/middlewares/auth.js
const { verifyToken } = require('../config/jwt');
const { unauthorizedResponse } = require('../utils/response');
const { pool } = require('../config/database');

/**
 * Middleware d'authentification JWT
 * Vérifie le token et charge les infos utilisateur dans req.user
 */
async function authenticate(req, res, next) {
  try {
    // Récupérer le token depuis l'en-tête Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorizedResponse(res, 'Token manquant');
    }

    const token = authHeader.substring(7); // Enlever "Bearer "

    // Vérifier et décoder le token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return unauthorizedResponse(res, "Erreur verification token :"+error.message);
    }

    // Vérifier que l'utilisateur existe toujours en base
    const [users] = await pool.execute(
      'SELECT id, email, business_name, store_slug, is_active, role FROM users WHERE id = ? AND deleted_at IS NULL',
      [decoded.userId]
    );

    if (users.length === 0) {
      return unauthorizedResponse(res, 'Utilisateur introuvable');
    }

    const user = users[0];

    // Vérifier que le compte est actif
    if (!user.is_active) {
      return unauthorizedResponse(res, 'Compte désactivé');
    }

    // Ajouter les infos utilisateur à la requête
    req.user = {
      id: user.id,
      email: user.email,
      business_name: user.business_name,
      store_slug: user.store_slug,
      role: user.role
    };

    next();
  } catch (error) {
    console.error('Erreur middleware auth:', error);
    return unauthorizedResponse(res, 'Erreur d\'authentification');
  }
}

/**
 * Middleware optionnel : charge l'utilisateur si token présent
 * Utile pour les routes publiques qui peuvent bénéficier du contexte user
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Pas de token, on continue sans user
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    const [users] = await pool.execute(
      'SELECT id, email, business_name, store_slug, role FROM users WHERE id = ? AND is_active = 1 AND deleted_at IS NULL',
      [decoded.userId]
    );

    if (users.length > 0) {
      req.user = {
        id: users[0].id,
        email: users[0].email,
        business_name: users[0].business_name,
        store_slug: users[0].store_slug,
        role: users[0].role
      };
    }

    next();
  } catch (error) {
    // En cas d'erreur, on continue quand même (auth optionnelle)
    next();
  }
}

module.exports = {
  authenticate,
  optionalAuth
};