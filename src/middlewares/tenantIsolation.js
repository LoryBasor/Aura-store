// src/middlewares/tenantIsolation.js
const { pool } = require('../config/database');
const { forbiddenResponse, notFoundResponse } = require('../utils/response');

/**
 * Middleware d'isolation multi-tenant
 * Vérifie que l'utilisateur n'accède qu'à ses propres ressources
 * 
 * @param {string} table - Nom de la table (products, orders, customers)
 * @param {string} idParam - Nom du paramètre ID dans la route (ex: 'id', 'productId')
 * @returns {function} Middleware Express
 */
function ensureOwnership(table, idParam = 'id') { 
  return async (req, res, next) => {
    try {
      const resourceId = req.params[idParam];
      const userId = req.user.id;

      if (!resourceId) {
        return notFoundResponse(res, 'ID de ressource manquant');
      }

      // Vérifier que la ressource appartient bien à l'utilisateur
      const [rows] = await pool.execute(
        `SELECT id, user_id FROM ${table} WHERE id = ? AND deleted_at IS NULL`,
        [resourceId]
      );

      if (rows.length === 0) {
        return notFoundResponse(res, 'Ressource introuvable');
      }

      if (rows[0].user_id !== userId) {
        return forbiddenResponse(res, 'Accès non autorisé à cette ressource');
      }

      // Ajouter la ressource validée à la requête
      req.resource = rows[0];
      next();
    } catch (error) {
      console.error('Erreur vérification ownership:', error);
      next(error);
    }
  };
}

/**
 * Middleware qui ajoute automatiquement user_id aux requêtes
 * Utile pour les opérations de lecture/écriture
 */
function injectUserId(req, res, next) {
  if (req.user) {
    req.body.user_id = req.user.id;
    req.query.user_id = req.user.id;
  }
  next();
}

module.exports = {
  ensureOwnership,
  injectUserId
};