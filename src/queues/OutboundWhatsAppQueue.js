// src/queues/OutboundWhatsAppQueue.js
const { Queue, Worker } = require('bullmq');
const { connection } = require('./connection');
const { pool } = require('../config/database');
const WhatsAppSessionManager = require('../services/whatsapp/WhatsAppSessionManager');

// Create the Queue
const outboundWhatsAppQueue = new Queue('OutboundWhatsAppQueue', { connection });

// Function to add jobs to the queue
const addOutboundWhatsAppJob = async (data) => {
  await outboundWhatsAppQueue.add('send_order_confirmation', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false
  });
};

// Configuration pour le rate limiting
const MIN_DELAY_MS = 3000;
const MAX_DELAY_MS = 8000;

// Worker to process jobs
const outboundWhatsAppWorker = new Worker('OutboundWhatsAppQueue', async job => {
  const { jobId, userId, customerPhone, messageText, isSummary } = job.data;

  // ─── Jobs de résumé quotidien (envoyés par whatsappSummaryCron) ───────────
  // Ces jobs n'ont pas d'entrée en BDD dans wa_outbound_jobs (pas de jobId).
  if (isSummary) {
    console.log(`[OutboundWhatsAppWorker] [SUMMARY] Envoi résumé pour vendeur ${userId} → ${customerPhone}`);
    try {
      const sessionManager = WhatsAppSessionManager.getInstance();
      if (!sessionManager.isSessionConnected(userId)) {
        throw new Error(`Session WhatsApp du vendeur ${userId} non connectée.`);
      }
      await sessionManager.sendMessage(userId, customerPhone, messageText);
      console.log(`[OutboundWhatsAppWorker] [SUMMARY] ✅ Résumé envoyé pour vendeur ${userId}.`);
    } catch (err) {
      console.error(`[OutboundWhatsAppWorker] [SUMMARY] ❌ Erreur:`, err.message);
      throw err; // Déclenche le retry BullMQ
    }
    return;
  }

  // ─── Jobs de commande classiques ─────────────────────────────────────────
  console.log(`[OutboundWhatsAppWorker] Traitement du job interne ${job.id} pour wa_outbound_job ${jobId} (Vendeur ${userId})`);

  try {
    // 1. Mettre à jour le statut en PROCESSING
    await pool.execute(
      'UPDATE wa_outbound_jobs SET status = ?, attempts = attempts + 1 WHERE id = ?',
      ['PROCESSING', jobId]
    );

    // 2. Vérifier la validité de la commande et du statut du job
    const [jobs] = await pool.execute('SELECT status FROM wa_outbound_jobs WHERE id = ?', [jobId]);
    if (jobs.length === 0) {
      throw new Error(`Job ${jobId} introuvable en base.`);
    }
    // Si la commande a été annulée entre temps
    if (jobs[0].status === 'CANCELLED') {
      console.log(`[OutboundWhatsAppWorker] Job ${jobId} annulé, abandon.`);
      return;
    }

    // 3. Vérifier la session WhatsApp
    const sessionManager = WhatsAppSessionManager.getInstance();
    const isConnected = sessionManager.isSessionConnected(userId);
    
    if (!isConnected) {
      throw new Error(`La session WhatsApp du vendeur ${userId} n'est pas connectée.`);
    }

    // 4. Rate Limiting par Vendeur (Sérialisation et Délai aléatoire)
    // On attend un délai aléatoire entre MIN et MAX pour éviter les rafales
    const randomDelay = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1) + MIN_DELAY_MS);
    console.log(`[OutboundWhatsAppWorker] Attente de ${randomDelay}ms avant l'envoi pour le vendeur ${userId}...`);
    await new Promise(resolve => setTimeout(resolve, randomDelay));

    // 5. Envoi du message via whatsapp-web.js
    console.log(`[OutboundWhatsAppWorker] Envoi du message au ${customerPhone}...`);
    await sessionManager.sendMessage(userId, customerPhone, messageText);

    // 6. Succès : mettre à jour la base
    await pool.execute(
      'UPDATE wa_outbound_jobs SET status = ?, sent_at = NOW() WHERE id = ?',
      ['SENT', jobId]
    );
    console.log(`[OutboundWhatsAppWorker] ✅ Message envoyé avec succès (Job ${jobId}).`);

  } catch (error) {
    console.error(`[OutboundWhatsAppWorker] ❌ Erreur pour le job ${jobId}:`, error.message);
    
    // Mettre à jour le message d'erreur
    await pool.execute(
      'UPDATE wa_outbound_jobs SET error_message = ? WHERE id = ?',
      [error.message, jobId]
    );

    throw error; // Déclenche le retry BullMQ
  }

}, { 
  connection,
  concurrency: 5 // Limite globale de jobs simultanés (tous vendeurs confondus)
});

outboundWhatsAppWorker.on('failed', async (job, err) => {
  console.error(`[OutboundWhatsAppWorker] Job BullMQ ${job.id} a échoué: ${err.message}`);
  // Si c'est la dernière tentative, marquer comme FAILED dans MySQL
  if (job.attemptsMade >= job.opts.attempts) {
    console.error(`[OutboundWhatsAppWorker] Échec définitif pour wa_outbound_job ${job.data.jobId}`);
    try {
      await pool.execute(
        'UPDATE wa_outbound_jobs SET status = ? WHERE id = ?',
        ['FAILED', job.data.jobId]
      );
    } catch (dbErr) {
      console.error('Erreur MAJ DB après échec définitif:', dbErr);
    }
  } else {
    // Repasse en PENDING en attendant le prochain retry
    try {
      await pool.execute(
        'UPDATE wa_outbound_jobs SET status = ? WHERE id = ?',
        ['PENDING', job.data.jobId]
      );
    } catch (dbErr) {
      console.error('Erreur MAJ DB pour retry:', dbErr);
    }
  }
});

module.exports = {
  outboundWhatsAppQueue,
  addOutboundWhatsAppJob,
  outboundWhatsAppWorker
};
