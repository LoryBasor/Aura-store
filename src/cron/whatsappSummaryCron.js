// src/cron/whatsappSummaryCron.js
// Tâche planifiée : résumé quotidien WhatsApp envoyé aux vendeurs à l'heure choisie.
//
// ARCHITECTURE : Ce cron tourne dans le WORKER (src/worker.js) séparé du serveur HTTP.
// Il communique avec le serveur via la file d'attente BullMQ OutboundWhatsAppQueue
// pour ne JAMAIS appeler directement WhatsAppSessionManager (qui vit dans app.js).
const cron = require('node-cron');
const { pool } = require('../config/database');
const { addOutboundWhatsAppJob } = require('../queues/OutboundWhatsAppQueue');

const CRON_TAG = '[CRON][WhatsAppSummary]';

let summaryCronJob = null;
let isRunning = false; // Verrou anti-chevauchement

function startWhatsAppSummaryCron() {
  if (summaryCronJob) {
    console.log(`${CRON_TAG} Cron déjà démarré.`);
    return;
  }

  // Vérifie chaque minute quel vendeur doit recevoir son résumé à cette heure
  summaryCronJob = cron.schedule('* * * * *', async () => {
    // ── Verrou anti-chevauchement ────────────────────────────────────────────
    if (isRunning) {
      console.warn(`${CRON_TAG} ⏭️ Exécution précédente toujours en cours — ignorée.`);
      return;
    }
    isRunning = true;
    const jobStart = Date.now();

    try {
      const now = new Date();
      const currentHHMM = now.toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit', hour12: false
      });

      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      // Récupère uniquement les sessions qui correspondent à l'heure actuelle
      const [sessions] = await pool.execute(
        `SELECT user_id, connected_number FROM wa_sessions
         WHERE status = 'connected' AND ai_enabled = 1 AND summary_time = ?`,
        [currentHHMM]
      );

      if (sessions.length === 0) return;

      console.log(`${CRON_TAG} ${currentHHMM} — Résumé pour ${sessions.length} vendeur(s)`);

      for (const session of sessions) {
        const userId = session.user_id;
        const vendorNumber = session.connected_number;
        if (!vendorNumber) continue;

        const sessionStart = Date.now();
        try {
          // ── 1. Récupérer les statistiques en une seule requête groupée ──────
          const [[orderStats]] = await pool.execute(
            `SELECT
               COUNT(*)                                              AS newOrders,
               SUM(CASE WHEN status = 'annulee' THEN 1 ELSE 0 END) AS cancelledOrders
             FROM orders
             WHERE user_id = ? AND created_at >= ? AND created_at <= ?`,
            [userId, startOfDay, endOfDay]
          );

          // ── 2. Réponses IA du jour ───────────────────────────────────────────
          const [[aiStats]] = await pool.execute(
            `SELECT COUNT(*) AS aiQuestions FROM wa_messages
             WHERE user_id = ? AND message_type = 'ai_response'
               AND created_at >= ? AND created_at <= ?`,
            [userId, startOfDay, endOfDay]
          );

          // ── 3. Produit le plus demandé (optimisé via Map) ───────────────────
          // Récupère les produits ET les messages en 2 requêtes, puis croise en mémoire
          const [products] = await pool.execute(
            `SELECT name, stock_quantity FROM products WHERE user_id = ? AND deleted_at IS NULL`,
            [userId]
          );

          // Map nom_produit_lowercase → { originalName, count }
          const productMap = new Map();
          products.forEach(p => productMap.set(p.name.toLowerCase(), { name: p.name, count: 0 }));

          if (productMap.size > 0) {
            const [inboundMsgs] = await pool.execute(
              `SELECT content FROM wa_messages
               WHERE user_id = ? AND direction = 'inbound'
                 AND created_at >= ? AND created_at <= ?
               LIMIT 100`,
              [userId, startOfDay, endOfDay]
            );

            // Comptage en O(N) via Map au lieu de O(N×M) avec deux forEach imbriqués
            for (const msg of inboundMsgs) {
              const text = (msg.content || '').toLowerCase();
              for (const [key, val] of productMap) {
                if (text.includes(key)) val.count++;
              }
            }
          }

          let requestedProduct = 'Aucun spécifié';
          let maxCount = 0;
          for (const { name, count } of productMap.values()) {
            if (count > maxCount) { maxCount = count; requestedProduct = name; }
          }

          // ── 4. Produit en rupture ────────────────────────────────────────────
          const outOfStockName = products.find(p => p.stock_quantity <= 0)?.name || 'Aucun';

          // ── 5. Construire le message ─────────────────────────────────────────
          const message =
            `📊 *Résumé du jour (Aura Store)*\n\n` +
            `📦 ${orderStats.newOrders} nouvelle(s) commande(s)\n` +
            `❌ ${orderStats.cancelledOrders} commande(s) annulée(s)\n` +
            `🤖 ${aiStats.aiQuestions} question(s) traitée(s) automatiquement\n\n` +
            `🔥 Produit le plus demandé : ${requestedProduct}\n` +
            `🛑 Produit en rupture : ${outOfStockName}\n\n` +
            `_Bonne soirée et à demain !_ ✨`;

          // ── 6. Envoi via BullMQ (découplé du processus WhatsApp) ────────────
          await addOutboundWhatsAppJob({
            jobId: null,             // Pas de job wa_outbound_jobs pour les résumés auto
            userId,
            customerPhone: vendorNumber,
            messageText: message,
            isSummary: true          // Marqueur pour identifier ces messages si nécessaire
          });

          const duration = Date.now() - sessionStart;
          console.log(`${CRON_TAG} ✅ Résumé mis en file pour user ${userId} (${duration}ms)`);

        } catch (error) {
          console.error(`${CRON_TAG} ❌ Erreur résumé user ${userId}:`, error.message);
        }
      }

    } catch (error) {
      console.error(`${CRON_TAG} ❌ Erreur globale:`, error.message);
    } finally {
      const totalDuration = Date.now() - jobStart;
      console.log(`${CRON_TAG} Job terminé en ${totalDuration}ms`);
      isRunning = false; // Libère le verrou dans tous les cas
    }
  });

  console.log(`${CRON_TAG} ✅ Cron job démarré (vérification chaque minute).`);
}

function stopWhatsAppSummaryCron() {
  if (summaryCronJob) {
    summaryCronJob.stop();
    summaryCronJob = null;
    isRunning = false;
    console.log(`${CRON_TAG} Cron job arrêté.`);
  }
}

module.exports = { startWhatsAppSummaryCron, stopWhatsAppSummaryCron };
