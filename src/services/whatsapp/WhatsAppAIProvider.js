// src/services/whatsapp/WhatsAppAIProvider.js
const axios = require('axios');
const { pool } = require('../../config/database');

class WhatsAppAIProvider {
  /**
   * Obtient une réponse de l'IA (Groq) avec le contexte du magasin et l'historique
   */
  static async getResponse(userId, chatId, messageContent) {
    try {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey || apiKey === 'votre_cle_groq_ici') {
        console.warn('Clé API Groq non configurée.');
        return null; // Fallback to normal behavior if no AI configured
      }

      // 1. Fetch Store Info
      const [users] = await pool.execute('SELECT business_name, store_slug FROM users WHERE id = ?', [userId]);
      const store = users[0] || {};
      const businessName = store.business_name || 'notre boutique';
      const storeUrl = store.store_slug ? `${process.env.APP_URL || 'http://localhost:3000'}/store/${store.store_slug}` : 'Non disponible';

      // 2. Fetch Products with their share tokens
      const [products] = await pool.execute(
        `SELECT p.name, p.price, p.currency, p.stock_quantity, p.is_available, pl.token
         FROM products p
         LEFT JOIN product_links pl ON p.id = pl.product_id
         WHERE p.user_id = ? AND p.deleted_at IS NULL AND p.admin_disabled = 0
         LIMIT 50`,
        [userId]
      );

      let productCatalog = products.map(p => {
        const productUrl = p.token ? `${process.env.APP_URL || 'http://localhost:3000'}/p/${p.token}` : 'Lien non disponible';
        const status = p.is_available ? (p.stock_quantity > 0 ? `En stock (${p.stock_quantity})` : 'Sur commande') : 'Rupture';
        return `- ${p.name} : ${p.price} ${p.currency} | Statut: ${status} | Lien: ${productUrl}`;
      }).join('\n');

      if (!productCatalog) productCatalog = "Aucun produit n'est actuellement disponible.";

      // 3. System Prompt
      const systemPrompt = `Tu es l'assistant virtuel de la boutique "${businessName}" sur WhatsApp.
Ta mission est de renseigner les clients sur nos produits, prix et disponibilités avec professionnalisme et concision.
Lien de la boutique: ${storeUrl}

CATALOGUE DES PRODUITS :
${productCatalog}

CONSIGNES :
- Sois très chaleureux mais bref (c'est WhatsApp, les gens veulent des réponses courtes).
- Propose toujours le lien du produit si le client semble intéressé.
- Si le produit n'est pas dans le catalogue, dis que nous ne l'avons pas.`;

      // 3.5. Fetch Recent Orders for this customer
      const customerPhone = chatId.replace(/[^0-9]/g, '');
      if (customerPhone.length > 5) {
        const [customerOrders] = await pool.execute(
          `SELECT order_number, status, total_amount, created_at 
           FROM orders 
           WHERE user_id = ? AND customer_phone LIKE ? 
           ORDER BY created_at DESC LIMIT 3`,
          [userId, `%${customerPhone}%`]
        );

        if (customerOrders.length > 0) {
          const orderContext = "\n\nINFORMATIONS SUR LES COMMANDES DU CLIENT (utilise ces infos s'il demande où est sa commande) :\n" + customerOrders.map(o => {
            const date = new Date(o.created_at).toLocaleDateString('fr-FR');
            let statusFr = o.status;
            switch(o.status) {
              case 'nouvelle': statusFr = 'Nouvelle / En attente'; break;
              case 'en_preparation': statusFr = 'En préparation'; break;
              case 'en_livraison': statusFr = 'En cours de livraison'; break;
              case 'livree': statusFr = 'Livrée'; break;
              case 'annulee': statusFr = 'Annulée'; break;
            }
            return `- Commande #${o.order_number} du ${date} | Statut : ${statusFr}`;
          }).join('\n');
          
          systemPrompt += orderContext;
        }
      }

      // 4. Fetch Message History (last 10 messages)
      const [history] = await pool.execute(
        `SELECT direction, content FROM wa_messages 
         WHERE user_id = ? AND remote_jid = ? 
         ORDER BY created_at DESC LIMIT 10`,
        [userId, chatId]
      );

      // Inverser pour avoir l'ordre chronologique
      const messages = [{ role: 'system', content: systemPrompt }];
      
      history.reverse().forEach(msg => {
        messages.push({
          role: msg.direction === 'inbound' ? 'user' : 'assistant',
          content: msg.content
        });
      });

      // Add the current message if it's not already the last one (it should be in the DB but just in case)
      if (messages.length === 1 || messages[messages.length - 1].content !== messageContent) {
        messages.push({ role: 'user', content: messageContent });
      }

      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.1-8b-instant',
          messages: messages,
          max_tokens: 250,
          temperature: 0.7,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Erreur WhatsAppAIProvider (Groq):', error?.response?.data || error.message);
      return null;
    }
  }
}

module.exports = WhatsAppAIProvider;
