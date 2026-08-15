/**
 * ============================================================
 * AURA STORE — OutboundWhatsAppQueue (PRODUCER UNIQUEMENT)
 * ============================================================
 * Ce fichier expose uniquement la Queue BullMQ pour AJOUTER des jobs.
 * Le Worker qui TRAITE ces jobs est dans :
 *   src/queues/workers/OutboundWhatsAppWorker.js
 *
 * Ce fichier est importé par :
 *   - Les services qui veulent envoyer des messages WhatsApp
 *   - Le scheduler (whatsappSummaryCron) qui enfile des jobs de résumé
 *
 * Idempotence : utiliser un jobId structuré pour éviter les doublons.
 * Format recommandé : `wa:sellerId:orderId:type`
 * ============================================================
 */
const { Queue } = require('bullmq');
const { redisConnection } = require('../../config/redis');

// Queue BullMQ — producteur de jobs uniquement
const outboundWhatsAppQueue = new Queue('OutboundWhatsAppQueue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail:     { count: 100 },
  },
});

/**
 * Ajoute un job d'envoi de message WhatsApp dans la queue.
 *
 * @param {object} data
 * @param {number|null}  data.jobId         - ID dans wa_outbound_jobs (null pour les résumés)
 * @param {number}       data.userId        - ID du vendeur (sellerId)
 * @param {string}       data.customerPhone - Numéro destinataire
 * @param {string}       data.messageText   - Texte du message
 * @param {boolean}      [data.isSummary]   - true pour les résumés automatiques
 *
 * @param {object} [options]
 * @param {string} [options.jobId]           - jobId BullMQ (pour idempotence)
 */
const addOutboundWhatsAppJob = async (data, options = {}) => {
  const jobOptions = {
    // Si un jobId est fourni, BullMQ ne créera pas de doublon
    ...(options.jobId ? { jobId: options.jobId } : {}),
  };

  const job = await outboundWhatsAppQueue.add('send_whatsapp', data, jobOptions);
  console.log(`[OutboundWhatsAppQueue] Job ajouté pour vendeur ${data.userId} (id=${job.id}, isSummary=${!!data.isSummary})`);
  return job;
};

module.exports = {
  outboundWhatsAppQueue,
  addOutboundWhatsAppJob,
};
