// src/services/whatsapp/WhatsAppActionHandler.js
const { pool } = require('../../config/database');
const { ORDER_STATUS } = require('../../config/constants');
const WhatsAppSessionManager = require('./WhatsAppSessionManager');
const { ACTIVE_STATUSES } = require('../orderCodeService');

class WhatsAppActionHandler {
  /**
   * Extrait le statut à partir d'un emoji de réaction ou d'un texte de réponse
   */
  static getStatusFromAction(action) {
    const statusMap = {
      '👍': ORDER_STATUS.CONFIRMEE,
      '1': ORDER_STATUS.CONFIRMEE,
      '🚚': ORDER_STATUS.EN_LIVRAISON,
      '3': ORDER_STATUS.EN_LIVRAISON,
      '✅': ORDER_STATUS.LIVREE,
      '4': ORDER_STATUS.LIVREE,
      '❌': ORDER_STATUS.ANNULEE,
      '5': ORDER_STATUS.ANNULEE,
      '2': ORDER_STATUS.EN_PREPARATION
    };

    return statusMap[action.trim()] || null;
  }

  /**
   * Traite une action Aura Smart Command (réponse à un message cité)
   * Le contexte stanzaId est utilisé pour retrouver la commande via wa_messages
   */
  static async handleAction(userId, from, action, contextInfo) {
    const status = this.getStatusFromAction(action);
    if (!status) return false;

    if (!contextInfo || !contextInfo.stanzaId) return false;

    const [messages] = await pool.execute(
      'SELECT order_id FROM wa_messages WHERE message_id = ? AND user_id = ? AND order_id IS NOT NULL',
      [contextInfo.stanzaId, userId]
    );

    if (messages.length === 0) return false;
    const orderId = messages[0].order_id;

    const [orders] = await pool.execute(
      'SELECT id, status, order_code FROM orders WHERE id = ? AND user_id = ?',
      [orderId, userId]
    );

    if (orders.length === 0) return false;
    const currentOrder = orders[0];

    const displayCode = currentOrder.order_code || String(currentOrder.id);

    if (currentOrder.status === ORDER_STATUS.LIVREE || currentOrder.status === ORDER_STATUS.ANNULEE) {
      await this.notifyVendor(userId, from, `⚠️ Impossible de modifier la commande *#${displayCode}* car elle est déjà *${currentOrder.status}*.`);
      return true;
    }

    await pool.execute('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
    await this.notifyVendor(userId, from, `✅ Statut de la commande *#${displayCode}* mis à jour : *${status}*.`);

    return true;
  }

  static async notifyVendor(userId, to, text) {
    const sessionManager = WhatsAppSessionManager.getInstance();
    await sessionManager.sendMessage(userId, to, text);
  }

  /**
   * Traite une commande directe du vendeur par CODE à 4 chiffres
   * Format: "#1 5831" ou "1 5831"
   * Recherche : user_id + order_code + statut actif
   *
   * @param {number} userId   - ID du vendeur
   * @param {string} from     - JID WhatsApp de l'expéditeur
   * @param {string} action   - Chiffre 1-5
   * @param {string} orderCode - Code à 4 chiffres (string)
   */
  static async handleDirectAction(userId, from, action, orderCode) {
    const status = this.getStatusFromAction(action);
    if (!status) return false;

    // Rechercher la commande ACTIVE de cette boutique avec ce code
    const placeholders = ACTIVE_STATUSES.map(() => '?').join(', ');
    const [orders] = await pool.execute(
      `SELECT id, status, order_code FROM orders
       WHERE user_id = ? AND order_code = ? AND status IN (${placeholders}) AND deleted_at IS NULL
       LIMIT 1`,
      [userId, orderCode, ...ACTIVE_STATUSES]
    );

    if (orders.length === 0) {
      await this.notifyVendor(
        userId, from,
        `❌ Aucune commande active trouvée avec le code *#${orderCode}* dans votre boutique.\n\nVérifiez le code ou utilisez *#1 XXXX* avec un code valide.`
      );
      return false;
    }

    const order = orders[0];
    const displayCode = order.order_code;

    if (order.status === ORDER_STATUS.LIVREE || order.status === ORDER_STATUS.ANNULEE) {
      await this.notifyVendor(
        userId, from,
        `⚠️ La commande *#${displayCode}* est déjà *${order.status}* et ne peut plus être modifiée.`
      );
      return true;
    }

    // Mettre à jour le statut (via l'ID DB interne)
    await pool.execute('UPDATE orders SET status = ? WHERE id = ?', [status, order.id]);
    await this.notifyVendor(
      userId, from,
      `✅ Commande *#${displayCode}* → statut mis à jour : *${status}*`
    );

    return true;
  }
}

module.exports = WhatsAppActionHandler;
