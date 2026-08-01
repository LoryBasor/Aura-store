// src/services/whatsapp/WhatsAppActionHandler.js
const { pool } = require('../../config/database');
const { ORDER_STATUS } = require('../../config/constants');
const WhatsAppSessionManager = require('./WhatsAppSessionManager');

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
   * Traite une action Aura Smart Command
   */
  static async handleAction(userId, from, action, contextInfo) {
    const status = this.getStatusFromAction(action);
    if (!status) return false;

    // Find the original message in the database to get the order ID
    // contextInfo.stanzaId corresponds to the original message ID that was replied to or reacted to
    if (!contextInfo || !contextInfo.stanzaId) return false;

    const [messages] = await pool.execute(
      'SELECT order_id FROM wa_messages WHERE message_id = ? AND user_id = ? AND order_id IS NOT NULL',
      [contextInfo.stanzaId, userId]
    );

    if (messages.length === 0) return false;
    const orderId = messages[0].order_id;

    // Verify order exists and belongs to the user
    const [orders] = await pool.execute(
      'SELECT id, status, order_number FROM orders WHERE id = ? AND user_id = ?',
      [orderId, userId]
    );

    if (orders.length === 0) return false;
    const currentOrder = orders[0];

    // Check valid transitions (Basic check, extend if needed)
    if (currentOrder.status === ORDER_STATUS.LIVREE || currentOrder.status === ORDER_STATUS.ANNULEE) {
        // Can't change terminal states
        await this.notifyVendor(userId, from, `⚠️ Impossible de modifier la commande #${currentOrder.order_number} car elle est déjà ${currentOrder.status}.`);
        return true;
    }

    // Update order status
    await pool.execute(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, orderId]
    );

    await this.notifyVendor(userId, from, `✅ Le statut de la commande #${currentOrder.order_number} a été mis à jour avec succès à : *${status}*.`);
    
    return true; // Action was handled
  }

  static async notifyVendor(userId, to, text) {
      const sessionManager = WhatsAppSessionManager.getInstance();
      await sessionManager.sendMessage(userId, to, text);
  }

  /**
   * Traite une commande directe du vendeur par ID de commande (short code)
   * Format: "1 A47" -> orderId = 47
   */
  static async handleDirectAction(userId, from, action, orderId) {
    const status = this.getStatusFromAction(action);
    if (!status) return false;

    const [orders] = await pool.execute(
      'SELECT id, status, order_number FROM orders WHERE id = ? AND user_id = ?',
      [orderId, userId]
    );

    if (orders.length === 0) {
      await this.notifyVendor(userId, from, `❌ Commande introuvable pour le code *A${orderId}*.`);
      return false;
    }

    const order = orders[0];

    if (order.status === ORDER_STATUS.LIVREE || order.status === ORDER_STATUS.ANNULEE) {
      await this.notifyVendor(userId, from, `⚠️ La commande #${order.order_number} est déjà *${order.status}* et ne peut plus être modifiée.`);
      return true;
    }

    await pool.execute('UPDATE orders SET status = ? WHERE id = ?', [status, order.id]);
    await this.notifyVendor(userId, from, `✅ Commande *#${order.order_number}* → statut mis à jour : *${status}*`);
    return true;
  }
}

module.exports = WhatsAppActionHandler;
