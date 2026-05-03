// src/middlewares/auth.js
const { verifyToken } = require('../config/jwt');
const { unauthorizedResponse } = require('../utils/response');
const { pool } = require('../config/database');

/**
 * Middleware d'authentification JWT - Cookie Only
 * Le token est lu UNIQUEMENT depuis le cookie httpOnly `aura_token`.
 * Plus de support pour le header Authorization Bearer (sécurité renforcée).
 */
async function authenticate(req, res, next) {
  try {
    // Lire le token depuis le cookie httpOnly uniquement
    const token = req.cookies.aura_token;

    if (!token) {
      return unauthorizedResponse(res, 'Non authentifié. Veuillez vous connecter.');
    }

    // Vérifier et décoder le token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return unauthorizedResponse(res, 'Session invalide ou expirée. Veuillez vous reconnecter.');
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

    if (!user.is_active) {
      return unauthorizedResponse(res, 'Compte désactivé');
    }

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
 * Middleware optionnel : charge l'utilisateur si cookie présent
 */
async function optionalAuth(req, res, next) {
  try {
    const token = req.cookies.aura_token;

    if (!token) {
      return next();
    }

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
    // Token invalide dans optionalAuth → continuer sans user
    next();
  }
}

module.exports = {
  authenticate,
  optionalAuth
};