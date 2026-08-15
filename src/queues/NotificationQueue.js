/**
 * ============================================================
 * AURA STORE — NotificationQueue (PRODUCER UNIQUEMENT)
 * ============================================================
 * Ce fichier expose uniquement la Queue BullMQ pour AJOUTER des jobs.
 * Le Worker qui TRAITE ces jobs est dans :
 *   src/queues/workers/NotificationWorker.js
 *
 * Ce fichier est importé par :
 *   - app.js (l'API ajoute des jobs de notification)
 *   - Les controllers/services qui déclenchent des notifications
 *
 * Ce fichier N'est PAS importé par le worker WhatsApp
 * (il importe directement NotificationWorker.js).
 * ============================================================
 */
const { Queue } = require('bullmq');
const { redisConnection } = require('../../config/redis');

// Queue BullMQ — producteur de jobs uniquement
const notificationQueue = new Queue('NotificationQueue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },  // Garder les 100 derniers jobs réussis
    removeOnFail:     { count: 200 },  // Garder les 200 derniers jobs échoués
  },
});

/**
 * Ajoute un job de notification dans la queue.
 * @param {string} type - Type de notification (ex: 'new_order')
 * @param {object} data - Données du job
 */
const addNotificationJob = async (type, data) => {
  const job = await notificationQueue.add(type, data);
  console.log(`[NotificationQueue] Job ajouté: ${type} (id=${job.id})`);
  return job;
};

module.exports = {
  notificationQueue,
  addNotificationJob,
};