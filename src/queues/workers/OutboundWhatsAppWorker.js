/**
 * ============================================================
 * AURA STORE — OutboundWhatsAppWorker (CONSUMER)
 * ============================================================
 * Worker BullMQ qui traite les jobs de la OutboundWhatsAppQueue.
 * Ce worker est démarré UNIQUEMENT par workers/whatsapp.js.
 *
 * Sécurité multi-tenant :
 *   - Chaque job contient userId (sellerId) pour isoler les sessions
 *   - Vérification de l'état du job en DB avant envoi
 *   - Idempotence via le statut CANCELLED
 *
 * Rate limiting :
 *   - Délai aléatoire entre 3s et 8s par message (anti-spam WhatsApp)
 *   - Concurrency limitée à 5 jobs simultanés (tous vendeurs confondus)
 * ============================================================
 */
const { Worker } = require('bullmq');
const { redisConnection } = require('../../../config/redis');
const { pool } = require('../../config/database');
const WhatsAppSessionManager = require('../../services/whatsapp/WhatsAppSessionManager');

const WORKER_TAG = '[OutboundWhatsAppWorker]';

// Configuration rate limiting
const MIN_DELAY_MS = 3000;
const MAX_DELAY_MS = 8000;

/**
 * Traitement des jobs d'envoi de messages WhatsApp.
 */
async function processOutboundWhatsAppJob(job) {
  const { jobId, userId, customerPhone, messageText, isSummary } = job.data;

  // ── Sécurité : vérification multi-tenant ──────────────────────────────────
  if (!userId) {
    throw new Error(`${WORKER_TAG} Job malformé : userId manquant.`);
  }
  if (!customerPhone) {
    throw new Error(`${WORKER_TAG} Job malformé : customerPhone manquant.`);
  }

  // ─── Jobs de résumé quotidien (envoyés par whatsappSummaryCron) ──────────
  if (isSummary) {
    console.log(`${WORKER_TAG} [SUMMARY] Envoi résumé vendeur ${userId} → ${customerPhone}`);
    try {
      const sessionManager = WhatsAppSessionManager.getInstance();
      if (!sessionManager.isSessionConnected(userId)) {
        throw new Error(`Session WhatsApp du vendeur ${userId} non connectée.`);
      }
      await sessionManager.sendMessage(userId, customerPhone, messageText);
      console.log(`${WORKER_TAG} [SUMMARY] ✅ Résumé envoyé pour vendeur ${userId}.`);
    } catch (err) {
      console.error(`${WORKER_TAG} [SUMMARY] ❌ Erreur:`, err.message);
      throw err; // Déclenche le retry BullMQ
    }
    return;
  }

  // ─── Jobs de commande classiques ─────────────────────────────────────────
  console.log(`${WORKER_TAG} Job BullMQ ${job.id} — wa_outbound_job ${jobId} (Vendeur ${userId})`);

  try {
    // 1. Mettre à jour le statut en PROCESSING
    await pool.execute(
      'UPDATE wa_outbound_jobs SET status = ?, attempts = attempts + 1 WHERE id = ?',
      ['PROCESSING', jobId]
    );

    // 2. Vérifier que le job n'a pas été annulé entre temps (idempotence)
    const [jobs] = await pool.execute(
      'SELECT status FROM wa_outbound_jobs WHERE id = ?',
      [jobId]
    );
    if (jobs.length === 0) {
      throw new Error(`Job ${jobId} introuvable en base.`);
    }
    if (jobs[0].status === 'CANCELLED') {
      console.log(`${WORKER_TAG} Job ${jobId} annulé — abandon.`);
      return; // Pas d'erreur, on abandonne proprement
    }

    // 3. Vérifier la session WhatsApp du vendeur (sécurité multi-tenant)
    const sessionManager = WhatsAppSessionManager.getInstance();
    const isConnected = sessionManager.isSessionConnected(userId);

    if (!isConnected) {
      throw new Error(`La session WhatsApp du vendeur ${userId} n'est pas connectée.`);
    }

    // 4. Rate limiting — délai aléatoire pour éviter les rafales
    const randomDelay = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1) + MIN_DELAY_MS);
    console.log(`${WORKER_TAG} Attente de ${randomDelay}ms (rate limiting vendeur ${userId})...`);
    await new Promise(resolve => setTimeout(resolve, randomDelay));

    // 5. Envoi du message
    await sessionManager.sendMessage(userId, customerPhone, messageText);

    // 6. Succès — mise à jour en BDD
    await pool.execute(
      'UPDATE wa_outbound_jobs SET status = ?, sent_at = NOW() WHERE id = ?',
      ['SENT', jobId]
    );
    console.log(`${WORKER_TAG} ✅ Message envoyé (Job ${jobId}).`);

  } catch (error) {
    console.error(`${WORKER_TAG} ❌ Erreur job ${jobId}:`, error.message);

    // Mise à jour du message d'erreur en BDD
    try {
      await pool.execute(
        'UPDATE wa_outbound_jobs SET error_message = ? WHERE id = ?',
        [error.message, jobId]
      );
    } catch (dbErr) {
      console.error(`${WORKER_TAG} Erreur MAJ DB:`, dbErr.message);
    }

    throw error; // Déclenche le retry BullMQ
  }
}

/**
 * Crée et retourne le Worker BullMQ.
 * Appelé par workers/whatsapp.js au démarrage.
 */
function createOutboundWhatsAppWorker() {
  const worker = new Worker('OutboundWhatsAppQueue', processOutboundWhatsAppJob, {
    connection: redisConnection,
    concurrency: 5, // Max 5 messages simultanés (tous vendeurs)
  });

  worker.on('completed', (job) => {
    console.log(`${WORKER_TAG} ✅ Job ${job.id} complété.`);
  });

  worker.on('failed', async (job, err) => {
    console.error(`${WORKER_TAG} ❌ Job ${job?.id} échoué: ${err.message}`);

    // Si c'est la dernière tentative, marquer comme FAILED en DB
    if (job && job.data.jobId && job.attemptsMade >= (job.opts.attempts || 3)) {
      console.error(`${WORKER_TAG} Échec définitif — wa_outbound_job ${job.data.jobId}`);
      try {
        await pool.execute(
          'UPDATE wa_outbound_jobs SET status = ? WHERE id = ?',
          ['FAILED', job.data.jobId]
        );
      } catch (dbErr) {
        console.error(`${WORKER_TAG} Erreur MAJ FAILED en DB:`, dbErr.message);
      }
    } else if (job && job.data.jobId) {
      // Repasse en PENDING en attendant le prochain retry
      try {
        await pool.execute(
          'UPDATE wa_outbound_jobs SET status = ? WHERE id = ?',
          ['PENDING', job.data.jobId]
        );
      } catch (dbErr) {
        console.error(`${WORKER_TAG} Erreur MAJ PENDING en DB:`, dbErr.message);
      }
    }
  });

  worker.on('error', (err) => {
    console.error(`${WORKER_TAG} ❌ Erreur worker: ${err.message}`);
  });

  console.log(`${WORKER_TAG} ✅ Worker démarré (concurrency=5).`);
  return worker;
}

module.exports = { createOutboundWhatsAppWorker };
