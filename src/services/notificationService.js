// src/services/notificationService.js
// Gestion des notifications administrateur
const { pool } = require('../config/database');

class NotificationService {
  /**
   * Crée une notification pour l'administrateur
   * @param {string} type - Type de notification
   * @param {string} title - Titre court
   * @param {string} message - Message détaillé
   * @param {number|null} referenceId - ID de l'entité concernée
   * @param {string|null} referenceType - Type de l'entité
   */
  async createNotification(type, title, message, referenceId = null, referenceType = null) {
    try {
      await pool.execute(
        `INSERT INTO admin_notifications (type, title, message, reference_id, reference_type)
         VALUES (?, ?, ?, ?, ?)`,
        [type, title, message, referenceId, referenceType]
      );
    } catch (error) {
      // Ne pas bloquer l'opération principale si la notification échoue
      console.error('[NotificationService] Erreur création notification:', error.message);
    }
  }

  /**
   * Récupère les notifications admin avec filtres
   */
  async getAdminNotifications({ page = 1, limit = 50, unreadOnly = false } = {}) {
    const offset = (page - 1) * limit;
    const whereClause = unreadOnly ? 'WHERE is_read = FALSE' : '';

    const [notifications] = await pool.execute(
      `SELECT * FROM admin_notifications
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`
    );

    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total, SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END) as unread
       FROM admin_notifications`
    );

    return {
      notifications,
      total: countResult[0].total,
      unread: countResult[0].unread || 0
    };
  }

  /**
   * Marque une notification comme lue
   */
  async markAsRead(notificationId) {
    await pool.execute(
      'UPDATE admin_notifications SET is_read = TRUE, read_at = NOW() WHERE id = ?',
      [notificationId]
    );
    return { success: true };
  }

  /**
   * Marque toutes les notifications comme lues
   */
  async markAllAsRead() {
    const [result] = await pool.execute(
      'UPDATE admin_notifications SET is_read = TRUE, read_at = NOW() WHERE is_read = FALSE'
    );
    return { success: true, updated: result.affectedRows };
  }

  /**
   * Récupère le compteur de notifications non lues
   */
  async getUnreadCount() {
    const [result] = await pool.execute(
      'SELECT COUNT(*) as count FROM admin_notifications WHERE is_read = FALSE'
    );
    return result[0].count || 0;
  }
}

module.exports = new NotificationService();
