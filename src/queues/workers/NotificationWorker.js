/**
 * ============================================================
 * AURA STORE — NotificationWorker (CONSUMER)
 * ============================================================
 * Worker BullMQ qui traite les jobs de la NotificationQueue.
 * Ce worker est démarré UNIQUEMENT par workers/whatsapp.js.
 *
 * Sécurité multi-tenant :
 *   - Chaque job doit contenir userId pour isoler les sessions
 *   - Le worker vérifie le plan du vendeur avant d'envoyer
 *   - On ne fait jamais confiance uniquement aux données du job
 * ============================================================
 */
const { Worker } = require('bullmq');
const { redisConnection } = require('../../../config/redis');
const { pool } = require('../../config/database');
const WhatsAppSessionManager = require('../../services/whatsapp/WhatsAppSessionManager');

const WORKER_TAG = '[NotificationWorker]';

/**
 * Traitement des jobs de la NotificationQueue.
 */
async function processNotificationJob(job) {
  const type = job.name;
  const data = job.data;
  console.log(`${WORKER_TAG} Traitement job ${job.id} | type=${type}`);

  if (type === 'new_order') {
    const { order, vendorWhatsApp, storeSlug } = data;

    // ── Sécurité : vérification multi-tenant ──────────────────────────────
    if (!order || !order.user_id) {
      throw new Error(`${WORKER_TAG} Job malformé : order.user_id manquant.`);
    }

    const sessionManager = WhatsAppSessionManager.getInstance();

    // 1. Vérifier la session en DB (source de vérité)
    const sessionStatus = await sessionManager.getSessionStatus(order.user_id);
    if (!sessionStatus || sessionStatus.status !== 'connected') {
      console.log(`${WORKER_TAG} Vendeur ${order.user_id} — session non connectée en DB. Notification ignorée.`);
      return;
    }

    // 2. Vérifier le plan du vendeur (Double vérification — ne pas faire confiance au job seul)
    const [planRows] = await pool.execute(
      `SELECT sp.slug FROM subscriptions s
       JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE s.user_id = ? AND s.status IN ('trial', 'active')
       ORDER BY s.id DESC LIMIT 1`,
      [order.user_id]
    );

    const planSlug = planRows[0]?.slug || '';
    if (!['pro', 'business'].includes(planSlug)) {
      console.log(`${WORKER_TAG} Vendeur ${order.user_id} — plan "${planSlug}" insuffisant. Notification ignorée.`);
      return;
    }

    const shortCode = order.order_code || String(order.id);

    // 3. Construction du message selon le plan
    let message =
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📦 *Nouvelle commande*\n` +
      `Code WhatsApp : *#${shortCode}*\n\n` +
      `*Client* : ${order.customer_name}\n` +
      `*Téléphone* : ${order.customer_phone}\n` +
      `*Produit* : ${order.product_name}\n` +
      `*Quantité* : ${order.quantity}\n` +
      `*Montant* : ${order.total_amount} XAF\n` +
      `━━━━━━━━━━━━━━━━━━━━━━`;

    if (planSlug === 'business') {
      message +=
        `\n\n📋 *Mettre à jour le statut* :\n` +
        `Tapez : *[Action] ${shortCode}*\n\n` +
        `  1 ➔ Confirmer\n` +
        `  2 ➔ En Préparation\n` +
        `  3 ➔ En Livraison\n` +
        `  4 ➔ Livrée ✅\n` +
        `  5 ➔ Annuler ❌\n\n` +
        `Exemple: *1 ${shortCode}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━`;
    }

    // 4. Envoi du message
    try {
      await sessionManager.sendMessage(order.user_id, vendorWhatsApp, message, {
        orderId:     order.id,
        orderNumber: order.order_number,
        orderCode:   order.order_code || null
      });
      console.log(`${WORKER_TAG} ✅ Notification envoyée — commande #${shortCode} (plan: ${planSlug})`);
    } catch (error) {
      console.error(`${WORKER_TAG} ❌ Échec envoi notification:`, error.message);
      throw error; // Déclenche le retry BullMQ
    }
  } else {
    console.warn(`${WORKER_TAG} Type de job inconnu: "${type}" — ignoré.`);
  }
}

/**
 * Crée et retourne le Worker BullMQ.
 * Appelé par workers/whatsapp.js au démarrage.
 */
function createNotificationWorker() {
  const worker = new Worker('NotificationQueue', processNotificationJob, {
    connection: redisConnection,
    concurrency: 3,
  });

  worker.on('completed', (job) => {
    console.log(`${WORKER_TAG} ✅ Job ${job.id} complété.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`${WORKER_TAG} ❌ Job ${job?.id} échoué: ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error(`${WORKER_TAG} ❌ Erreur worker: ${err.message}`);
  });

  console.log(`${WORKER_TAG} ✅ Worker démarré.`);
  return worker;
}

module.exports = { createNotificationWorker };
