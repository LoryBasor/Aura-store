/**
 * ============================================================
 * AURA STORE — PROCESSUS WORKER DÉDIÉ (src/worker.js)
 * ============================================================
 * Ce processus est lancé séparément par PM2 (saas-worker).
 * Il est l'UNIQUE responsable des tâches planifiées (cron jobs).
 *
 * Avantage clé : une tâche lourde ici ne bloque JAMAIS le
 * serveur HTTP / API / WhatsApp (app.js / saas-vendor-api).
 * ============================================================
 */
require('dotenv').config();

const { testConnection, closePool } = require('./config/database');
const { startSubscriptionCron, stopSubscriptionCron } = require('./cron/subscriptionCron');
const { startWhatsAppSummaryCron, stopWhatsAppSummaryCron } = require('./cron/whatsappSummaryCron');

// ─── Initialisation de la file d'attente ─────────────────────────────────────
// Le worker doit connaître la queue pour pouvoir y envoyer des jobs
// (ex: résumé WhatsApp → envoyé en queue → traité par le serveur API)
require('./queues/OutboundWhatsAppQueue');

const WORKER_TAG = '[WORKER]';

/**
 * Gestionnaire global des rejets de promesses non capturés.
 * Évite que le processus worker crashe silencieusement.
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error(`${WORKER_TAG} ⚠️ Rejet de promesse non géré:`, reason);
});

process.on('uncaughtException', (err) => {
  console.error(`${WORKER_TAG} ⚠️ Exception non capturée:`, err.message, err.stack);
  // On ne quitte pas le processus sur une exception cron — PM2 le redémarrera si nécessaire
});

/**
 * Arrêt gracieux du worker.
 * Stoppe les crons proprement avant de fermer.
 */
async function gracefulShutdown(signal) {
  const start = Date.now();
  console.log(`\n${WORKER_TAG} ⏳ Arrêt en cours (signal: ${signal})...`);

  try {
    stopSubscriptionCron();
    stopWhatsAppSummaryCron();
    console.log(`${WORKER_TAG} ✅ Crons arrêtés.`);

    await closePool();
    console.log(`${WORKER_TAG} ✅ Connexions BDD fermées.`);
  } catch (err) {
    console.error(`${WORKER_TAG} ❌ Erreur lors de l'arrêt:`, err.message);
  }

  const duration = Date.now() - start;
  console.log(`${WORKER_TAG} ✅ Arrêt complet (${duration}ms).`);
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

/**
 * Démarrage du worker.
 */
async function startWorker() {
  console.log('');
  console.log('==============================================');
  console.log(`${WORKER_TAG} ✨ AURA — Worker de tâches planifiées`);
  console.log('==============================================');

  // 1. Vérifier la connexion à la base de données
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error(`${WORKER_TAG} ❌ Impossible de se connecter à la BDD. Arrêt du worker.`);
    process.exit(1);
  }
  console.log(`${WORKER_TAG} ✅ Connexion BDD établie.`);

  // 2. Démarrer les cron jobs
  startSubscriptionCron();
  startWhatsAppSummaryCron();

  console.log(`${WORKER_TAG} ✅ Cron jobs démarrés:`);
  console.log(`${WORKER_TAG}   - subscriptionCron   (chaque jour à 01:00, Africa/Douala)`);
  console.log(`${WORKER_TAG}   - whatsappSummaryCron (chaque minute, vérifie l'heure des résumés)`);
  console.log('==============================================');
  console.log('');
}

startWorker();
