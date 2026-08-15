/**
 * ============================================================
 * AURA STORE — Scheduler Process (Cron Jobs)
 * ============================================================
 * Processus dédié : uniquement les tâches planifiées (crons).
 *
 * Ce processus est le SEUL à faire tourner les crons :
 *   - subscriptionCron : vérification des abonnements expirés (1h00/jour)
 *   - whatsappSummaryCron : résumés quotidiens WhatsApp (chaque minute)
 *
 * IMPORTANT : Ce scheduler AJOUTE des jobs dans BullMQ.
 * Il ne traite PAS les jobs lui-même (c'est le rôle de workers/whatsapp.js).
 *
 * Lancé en production via :
 *   npm run scheduler
 *   → NODE_ENV=production node workers/scheduler.js
 *
 * Une seule instance DOIT tourner en production.
 * (Sinon les crons s'exécutent en doublon sur chaque réplique)
 * ============================================================
 */
require('dotenv').config();

// ─── Configuration centralisée ───────────────────────────────────────────────
const { nodeEnv } = require('../config/env');

const SCHEDULER_TAG = '[Scheduler]';

console.log('');
console.log('══════════════════════════════════════════════════');
console.log(`${SCHEDULER_TAG} ✨ AURA Store — Scheduler`);
console.log(`${SCHEDULER_TAG} Environnement : ${nodeEnv}`);
console.log('══════════════════════════════════════════════════');

// ─── Dépendances ─────────────────────────────────────────────────────────────
const { testConnection, closePool } = require('../src/config/database');
const { testRedisConnection, closeRedisClient } = require('../config/redis');
const { startSubscriptionCron, stopSubscriptionCron }       = require('../src/cron/subscriptionCron');
const { startWhatsAppSummaryCron, stopWhatsAppSummaryCron } = require('../src/cron/whatsappSummaryCron');

// ─── Gestion des erreurs non capturées ──────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error(`${SCHEDULER_TAG} ⚠️ Rejet de promesse non géré:`, reason);
  // Ne pas quitter — les crons doivent continuer
});

process.on('uncaughtException', (err) => {
  console.error(`${SCHEDULER_TAG} ⚠️ Exception non capturée:`, err.message, err.stack);
  // Ne pas quitter — PM2/Coolify redémarrera si nécessaire
});

// ─── Arrêt gracieux ──────────────────────────────────────────────────────────
async function gracefulShutdown(signal) {
  const start = Date.now();
  console.log(`\n${SCHEDULER_TAG} ⏳ Arrêt en cours (signal: ${signal})...`);

  try {
    // 1. Arrêter les crons (ils finissent leur exécution en cours)
    stopSubscriptionCron();
    stopWhatsAppSummaryCron();
    console.log(`${SCHEDULER_TAG} ✅ Crons arrêtés.`);

    // 2. Fermer les connexions
    await closePool();
    console.log(`${SCHEDULER_TAG} ✅ MySQL fermé.`);

    await closeRedisClient();
    console.log(`${SCHEDULER_TAG} ✅ Redis fermé.`);

  } catch (err) {
    console.error(`${SCHEDULER_TAG} ❌ Erreur lors de l'arrêt:`, err.message);
  }

  const duration = Date.now() - start;
  console.log(`${SCHEDULER_TAG} ✅ Arrêt complet (${duration}ms).`);
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// ─── Démarrage ───────────────────────────────────────────────────────────────
async function startScheduler() {
  try {
    // 1. Vérifier MySQL (nécessaire pour subscriptionCron)
    const dbOk = await testConnection();
    if (!dbOk) {
      console.error(`${SCHEDULER_TAG} ❌ MySQL inaccessible — arrêt.`);
      process.exit(1);
    }
    console.log(`${SCHEDULER_TAG} ✅ MySQL connecté.`);

    // 2. Vérifier Redis (nécessaire pour whatsappSummaryCron → BullMQ)
    const redisOk = await testRedisConnection();
    if (!redisOk) {
      console.error(`${SCHEDULER_TAG} ❌ Redis inaccessible — arrêt.`);
      process.exit(1);
    }
    console.log(`${SCHEDULER_TAG} ✅ Redis connecté.`);

    // 3. Démarrer les crons
    startSubscriptionCron();
    startWhatsAppSummaryCron();

    console.log('══════════════════════════════════════════════════');
    console.log(`${SCHEDULER_TAG} ✅ Crons démarrés :`);
    console.log(`${SCHEDULER_TAG}   - subscriptionCron   (chaque jour à 01:00, Africa/Douala)`);
    console.log(`${SCHEDULER_TAG}   - whatsappSummaryCron (chaque minute)`);
    console.log('══════════════════════════════════════════════════');
    console.log('');

  } catch (error) {
    console.error(`${SCHEDULER_TAG} ❌ Erreur au démarrage:`, error.message);
    process.exit(1);
  }
}

startScheduler();
