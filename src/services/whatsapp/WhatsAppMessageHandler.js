// src/services/whatsapp/WhatsAppMessageHandler.js
const { pool } = require('../../config/database');
const WhatsAppActionHandler = require('./WhatsAppActionHandler');
const WhatsAppAIProvider = require('./WhatsAppAIProvider');
const WhatsAppSessionManager = require('./WhatsAppSessionManager');

class WhatsAppMessageHandler {

  /**
   * Gère les messages entrants des CLIENTS (reçus depuis l'extérieur)
   */
  static async handleMessage(userId, client, message) {
    try {
      if (message.fromMe) return;

      const from = message.from;
      const contact = await message.getContact();

      // Ignorer les messages de groupes WhatsApp
      if (from.endsWith('@g.us')) return;

      const text = message.body;
      if (!text) return;

      console.log(`[WhatsApp] Entrant (client) User ${userId} de ${from}: "${text}"`);

      // Sauvegarder le message entrant
      try {
        await pool.execute(
          `INSERT IGNORE INTO wa_messages (user_id, message_id, remote_jid, direction, content, message_type)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, message.id.id, from, 'inbound', text, message.type]
        );
      } catch (dbErr) {
        console.error('Erreur sauvegarde message entrant:', dbErr.message);
      }

      // Si c'est une réponse à une notif (client répond à un message du bot)
      if (message.hasQuotedMsg) {
        try {
          const quotedMsg = await message.getQuotedMessage();
          const stanzaId = quotedMsg.id.id;
          console.log(`[WhatsApp] Reply de client à message ID: ${stanzaId}`);
          const handled = await WhatsAppActionHandler.handleAction(userId, from, text, { stanzaId });
          if (handled) return;
        } catch (err) {}
      }

      // Auto-replies par mot-clé
      const textLower = text.toLowerCase().trim();
      const [autoReplies] = await pool.execute(
        'SELECT response FROM wa_auto_replies WHERE user_id = ? AND is_active = TRUE AND LOWER(keyword) = ?',
        [userId, textLower]
      );
      if (autoReplies.length > 0) {
        await WhatsAppSessionManager.getInstance().sendMessage(userId, from, autoReplies[0].response);
        return;
      }

      // Recherche MySQL (Catalogue Produits)
      const stopWords = ['bonjour', 'salut', 'coucou', 'cherche', 'veux', 'voudrais', 'avez', 'vous', 'prix', 'combien', 'coute', 'pour', 'est', 'que', 'je', 'suis', 'le', 'la', 'les', 'un', 'une', 'des', 'ce', 'cet', 'cette', 'quoi'];
      const words = textLower
        .replace(/[^\w\sàâäéèêëîïôöùûüç]/gi, '')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !stopWords.includes(w));

      if (words.length > 0) {
        let sql = `
          SELECT p.name, p.price, p.currency, p.stock_quantity, p.is_available, pl.token 
          FROM products p
          LEFT JOIN product_links pl ON p.id = pl.product_id
          WHERE p.user_id = ? AND p.deleted_at IS NULL AND p.admin_disabled = 0 AND (
        `;
        const params = [userId];
        const conditions = [];
        words.forEach(w => {
           conditions.push('p.name LIKE ?');
           params.push(`%${w}%`);
        });
        sql += conditions.join(' OR ') + ') LIMIT 1';
        
        const [foundProducts] = await pool.execute(sql, params);
        
        if (foundProducts.length > 0) {
           const p = foundProducts[0];
           const status = p.is_available ? (p.stock_quantity > 0 ? `En stock (${p.stock_quantity})` : 'Sur commande') : 'Rupture';
           const productUrl = p.token ? `${process.env.APP_URL || 'http://localhost:3000'}/p/${p.token}` : 'Lien non disponible';
           
           const reply = `🤖 *${p.name}*\n💰 Prix : ${p.price} ${p.currency}\n📦 Statut : ${status}\n\n🛒 Pour commander :\n${productUrl}`;
           
           // Si un produit est trouvé, on répond directement et on arrête (Bypass Groq)
           await WhatsAppSessionManager.getInstance().sendMessage(userId, from, reply, { messageType: 'ai_response' });
           return;
        }
      }

      // Fallback IA (si activée pour ce vendeur)
      const [sessionRows] = await pool.execute(
        'SELECT ai_enabled FROM wa_sessions WHERE user_id = ?', [userId]
      );
      const aiEnabled = sessionRows.length === 0 || !!sessionRows[0].ai_enabled;

      if (aiEnabled) {
        const delay = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000;
        await new Promise(r => setTimeout(r, delay));

        const aiResponse = await WhatsAppAIProvider.getResponse(userId, from, text, contact.id.user);
        if (aiResponse) {
          await WhatsAppSessionManager.getInstance().sendMessage(userId, from, aiResponse, { messageType: 'ai_response' });
        }
      }

    } catch (error) {
      console.error(`[WhatsApp] Erreur handleMessage User ${userId}:`, error.message);
    }
  }

  /**
   * Gère TOUS les messages envoyés PAR LE VENDEUR lui-même depuis son téléphone.
   * Remplace handleVendorReply + message_reaction (qui ne fonctionne pas de façon fiable).
   *
   * Méthodes supportées :
   *   A) Répondre au message de notif avec un chiffre : "1", "2", "3", "4", "5"
   *   B) Envoyer une commande directe sans citer : "#1 ORD-20260728-4819"
   */
  static async handleVendorMessage(userId, client, message) {
    try {
      const text = (message.body || '').trim();
      if (!text) return;

      const from = message.from || message.to;

      console.log(`[WhatsApp] Vendeur ${userId} a envoyé: "${text}" (hasQuoted: ${message.hasQuotedMsg})`);

      // ══════════════════════════════════════════════════════════════
      // MÉTHODE A : Le vendeur répond (cite) le message ou utilise le dernier en mémoire
      // ══════════════════════════════════════════════════════════════
      const isSimpleAction = /^[1-5]$/.test(text) || ['👍', '🚚', '✅', '❌'].includes(text);

      if (isSimpleAction) {
        let stanzaId = null;
        let fallbackOrderId = null;

        if (message.hasQuotedMsg) {
          try {
            const quotedMsg = await message.getQuotedMessage();
            stanzaId = quotedMsg.id.id;
            console.log(`[WhatsApp] Réponse citée — ID message original: ${stanzaId}`);
          } catch (err) {
            console.error('[WhatsApp] Impossible de récupérer le message cité:', err.message);
          }
        }

        // Si stanzaId est toujours nul (soit pas de quote, soit echec) -> Fallback mémoire
        if (!stanzaId) {
          const sessionManager = WhatsAppSessionManager.getInstance();
          const pending = sessionManager.getPendingOrder(userId);
          
          if (pending) {
            fallbackOrderId = pending.orderId;
            console.log(`[WhatsApp] Utilisation de la commande en mémoire (fallback): A${fallbackOrderId}`);
          } else {
            console.log(`[WhatsApp] Commande simple reçue mais aucun contexte (ni citation, ni en mémoire).`);
            return;
          }
        }

        // Traiter l'action avec stanzaId OU fallbackOrderId
        let handled = false;
        if (stanzaId) {
           handled = await WhatsAppActionHandler.handleAction(userId, from, text, { stanzaId });
        } else if (fallbackOrderId) {
           handled = await WhatsAppActionHandler.handleDirectAction(userId, from, text, fallbackOrderId);
        }

        if (handled) {
          console.log(`[WhatsApp] ✅ Commande "${text}" traitée avec succès.`);
          // Clear pending if it was used
          WhatsAppSessionManager.getInstance().pendingOrders.delete(userId);
          return;
        }
      }

      // ══════════════════════════════════════════════════════════════
      // MÉTHODE B : Commande directe format "CHIFFRE A_ID" ou "CHIFFRE ID"
      // Exemple: "3 A47" ou "1 26"
      // ══════════════════════════════════════════════════════════════
      const directCmdMatch = text.match(/^([1-5])\s*A?(\d+)/i);
      if (directCmdMatch) {
        const action = directCmdMatch[1];
        const orderId = parseInt(directCmdMatch[2], 10);
        console.log(`[WhatsApp] Commande directe: action=${action}, orderId=${orderId}`);

        const handled = await WhatsAppActionHandler.handleDirectAction(userId, from, action, orderId);
        if (handled) {
          console.log(`[WhatsApp] ✅ Commande directe "${action} A${orderId}" traitée.`);
        } else {
          console.log(`[WhatsApp] Commande directe introuvable pour ID ${orderId}`);
        }
        return;
      }

    } catch (error) {
      console.error(`[WhatsApp] Erreur handleVendorMessage User ${userId}:`, error.message);
    }
  }
}

module.exports = WhatsAppMessageHandler;
