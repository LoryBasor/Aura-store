const cron = require('node-cron');
const { pool } = require('../config/database');
const WhatsAppSessionManager = require('../services/whatsapp/WhatsAppSessionManager');

let summaryCronJob = null;

function startWhatsAppSummaryCron() {
  if (summaryCronJob) {
    console.log('[WhatsAppSummaryCron] Cron déjà démarré.');
    return;
  }

  // Run every minute to check if any vendor needs a summary at the current time
  summaryCronJob = cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      // Format current time as HH:MM
      const currentHHMM = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
      
      // Get start and end of today
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      // Find sessions that match the current time
      const [sessions] = await pool.execute(
        `SELECT user_id, connected_number FROM wa_sessions 
         WHERE status = 'connected' AND ai_enabled = 1 AND summary_time = ?`,
        [currentHHMM]
      );

      if (sessions.length === 0) return;
      console.log(`[WhatsAppSummaryCron] Envoi du résumé quotidien pour ${sessions.length} vendeur(s) à ${currentHHMM}`);

      for (const session of sessions) {
        const userId = session.user_id;
        const vendorNumber = session.connected_number;
        if (!vendorNumber) continue;

        try {
          // 1. Nouvelles commandes
          const [newOrdersRows] = await pool.execute(
            `SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND created_at >= ? AND created_at <= ?`,
            [userId, startOfDay, endOfDay]
          );
          const newOrders = newOrdersRows[0].count;

          // 2. Commandes annulées
          const [cancelledOrdersRows] = await pool.execute(
            `SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND status = 'annulee' AND updated_at >= ? AND updated_at <= ?`,
            [userId, startOfDay, endOfDay]
          );
          const cancelledOrders = cancelledOrdersRows[0].count;

          // 3. Questions traitées automatiquement par l'IA
          const [aiMsgsRows] = await pool.execute(
            `SELECT COUNT(*) as count FROM wa_messages WHERE user_id = ? AND message_type = 'ai_response' AND created_at >= ? AND created_at <= ?`,
            [userId, startOfDay, endOfDay]
          );
          const aiQuestions = aiMsgsRows[0].count;

          // 4. Produit le plus consulté/demandé (basic mock or extract from AI messages)
          // For a real implementation, we could track product view events, but here we can check inbound messages
          const [inboundMsgs] = await pool.execute(
            `SELECT content FROM wa_messages WHERE user_id = ? AND direction = 'inbound' AND created_at >= ? AND created_at <= ? LIMIT 50`,
            [userId, startOfDay, endOfDay]
          );
          
          let requestedProduct = "Aucun spécifié";
          // We can fetch vendor products to match names
          const [products] = await pool.execute(
            `SELECT name, stock_quantity FROM products WHERE user_id = ? AND deleted_at IS NULL`, [userId]
          );
          
          const productCounts = {};
          inboundMsgs.forEach(msg => {
             const text = (msg.content || '').toLowerCase();
             products.forEach(p => {
                if (text.includes(p.name.toLowerCase())) {
                   productCounts[p.name] = (productCounts[p.name] || 0) + 1;
                }
             });
          });
          
          let maxCount = 0;
          for (const [pName, pCount] of Object.entries(productCounts)) {
             if (pCount > maxCount) {
                 maxCount = pCount;
                 requestedProduct = pName;
             }
          }

          // 5. Produit en rupture
          const outOfStockProducts = products.filter(p => p.stock_quantity <= 0);
          const outOfStockStr = outOfStockProducts.length > 0 ? outOfStockProducts[0].name : "Aucun";

          // Générer le message
          const message = `📊 *Résumé du jour (Aura Store)*\n\n` +
                          `📦 ${newOrders} nouvelle(s) commande(s)\n` +
                          `❌ ${cancelledOrders} commande(s) annulée(s)\n` +
                          `🤖 ${aiQuestions} question(s) traitée(s) automatiquement\n\n` +
                          `🔥 Produit le plus demandé : ${requestedProduct}\n` +
                          `🛑 Produit en rupture : ${outOfStockStr}\n\n` +
                          `_Bonne soirée et à demain !_ ✨`;

          // Send message to the vendor's own number
          await WhatsAppSessionManager.getInstance().sendMessage(userId, vendorNumber, message);
          
        } catch (error) {
          console.error(`[WhatsAppSummaryCron] Erreur lors de l'envoi du résumé pour le user_id ${userId}:`, error.message);
        }
      }
    } catch (error) {
      console.error('[WhatsAppSummaryCron] ❌ Erreur globale:', error.message);
    }
  });

  console.log('[WhatsAppSummaryCron] ✅ Cron job démarré (exécution chaque minute pour vérifier l\'heure).');
}

function stopWhatsAppSummaryCron() {
  if (summaryCronJob) {
    summaryCronJob.stop();
    summaryCronJob = null;
    console.log('[WhatsAppSummaryCron] Cron job arrêté.');
  }
}

module.exports = { startWhatsAppSummaryCron, stopWhatsAppSummaryCron };
