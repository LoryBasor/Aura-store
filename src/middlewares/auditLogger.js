// src/middlewares/auditLogger.js
const { pool } = require('../config/database');

/**
 * Middleware pour logger les actions admin sensibles
 * À utiliser sur les routes admin critiques
 */
function auditLog(action, entityType) {
  return async (req, res, next) => {
    // Sauvegarder la méthode send originale
    const originalSend = res.send;

    // Variables pour capturer les changements
    let responseBody;

    // Surcharger res.send pour capturer la réponse
    res.send = function (data) {
      responseBody = data;
      originalSend.call(this, data);
    };

    // Continuer la requête
    res.on('finish', async () => {
      // Logger seulement les requêtes réussies (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const entityId = req.params.id || req.params.userId || null;
          const oldValue = req.auditOldValue ? JSON.stringify(req.auditOldValue) : null;
          const newValue = req.auditNewValue ? JSON.stringify(req.auditNewValue) : null;

          await pool.execute(
            `INSERT INTO admin_audit_logs 
             (admin_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              req.user.id,
              action,
              entityType,
              entityId,
              oldValue,
              newValue,
              req.ip || req.connection.remoteAddress,
              req.get('user-agent'),
              req.auditNotes || null
            ]
          );
        } catch (error) {
          console.error('Erreur audit log:', error);
          // Ne pas bloquer la requête en cas d'erreur de log
        }
      }
    });

    next();
  };
}

/**
 * Helper pour sauvegarder l'ancien état avant modification
 */
async function captureOldState(req, entityType, entityId) {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM ${entityType} WHERE id = ?`,
      [entityId]
    );
    
    if (rows.length > 0) {
      req.auditOldValue = rows[0];
    }
  } catch (error) {
    console.error('Erreur capture old state:', error);
  }
}

/**
 * Helper pour sauvegarder le nouvel état après modification
 */
function captureNewState(req, newData) {
  req.auditNewValue = newData;
}

module.exports = {
  auditLog,
  captureOldState,
  captureNewState
};