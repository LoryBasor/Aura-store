/**
 * ============================================================
 * AURA STORE — WhatsApp Worker Process
 * ============================================================
 * Processus dédié : WhatsApp + Chromium + BullMQ Workers
 *
 * Ce processus est le SEUL à démarrer :
 *   - WhatsApp Session Manager (toutes les sessions vendeurs)
 *   - BullMQ Worker: NotificationQueue (notifs de nouvelles commandes)
 *   - BullMQ Worker: OutboundWhatsAppQueue (envois sortants + résumés)
 *
 * Lancé en production via :
 *   npm run whatsapp
 *   → NODE_ENV=production node workers/whatsapp.js
 *
 * Lancé en développement via :
 *   npm run dev (via scripts/dev.js + concurrently)
 *
 * Ce processus N'expose PAS d'API HTTP.
 * Il NE démarre PAS de cron (c'est le rôle de workers/scheduler.js).
 * ============================================================
 */
require('dotenv').config();

const path = require('path');

// ─── Configuration centralisée ───────────────────────────────────────────────
const { nodeEnv, isDevelopment, isProduction } = require('../config/env');

const WORKER_TAG = '[WhatsApp Worker]';

console.log('');
console.log('══════════════════════════════════════════════════');
console.log(`${WORKER_TAG} ✨ AURA Store — WhatsApp Worker`);
console.log(`${WORKER_TAG} Environnement : ${nodeEnv}`);
console.log('══════════════════════════════════════════════════');

// ─── Dépendances ─────────────────────────────────────────────────────────────
const { testConnection, closePool } = require('../src/config/database');
const { testRedisConnection, closeRedisClient } = require('../config/redis');
const { createNotificationWorker }     = require('../src/queues/workers/NotificationWorker');
const { createOutboundWhatsAppWorker } = require('../src/queues/workers/OutboundWhatsAppWorker');
const WhatsAppSessionManager           = require('../src/services/whatsapp/WhatsAppSessionManager');

// ─── Gestion des erreurs non capturées ──────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  const ignoredMessages = ['auth timeout', 'Target closed', 'Protocol error', 'Session closed'];
  const msg = reason?.message || String(reason);
  if (ignoredMessages.some(m => msg.includes(m))) {
    console.warn(`${WORKER_TAG} ⚠️ Erreur Puppeteer ignorée (bug connu): ${msg}`);
    return;
  }
  console.error(`${WORKER_TAG} ⚠️ Rejet de promesse non géré:`, reason);
});

process.on('uncaughtException', (err) => {
  console.error(`${WORKER_TAG} ⚠️ Exception non capturée:`, err.message);
  // Ne pas quitter — les sessions WhatsApp doivent rester actives
});

// ─── Workers BullMQ ──────────────────────────────────────────────────────────
let notificationWorker     = null;
let outboundWhatsAppWorker = null;

// ─── Arrêt gracieux ──────────────────────────────────────────────────────────
async function gracefulShutdown(signal) {
  const start = Date.now();
  console.log(`\n${WORKER_TAG} ⏳ Arrêt en cours (signal: ${signal})...`);

  try {
    // 1. Arrêter les workers BullMQ (ils finissent leurs jobs en cours)
    if (notificationWorker) {
      await notificationWorker.close();
      console.log(`${WORKER_TAG} ✅ NotificationWorker arrêté.`);
    }
    if (outboundWhatsAppWorker) {
      await outboundWhatsAppWorker.close();
      console.log(`${WORKER_TAG} ✅ OutboundWhatsAppWorker arrêté.`);
    }

    // 2. Fermer les sessions WhatsApp proprement
    const sessionManager = WhatsAppSessionManager.getInstance();
    await sessionManager.shutdownAllSessions();
    console.log(`${WORKER_TAG} ✅ Sessions WhatsApp fermées.`);

    // 3. Fermer les connexions
    await closePool();
    console.log(`${WORKER_TAG} ✅ MySQL fermé.`);

    await closeRedisClient();
    console.log(`${WORKER_TAG} ✅ Redis fermé.`);

  } catch (err) {
    console.error(`${WORKER_TAG} ❌ Erreur lors de l'arrêt:`, err.message);
  }

  const duration = Date.now() - start;
  console.log(`${WORKER_TAG} ✅ Arrêt complet (${duration}ms).`);
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// ─── Démarrage ───────────────────────────────────────────────────────────────
async function startWhatsAppWorker() {
  try {
    // 1. Vérifier MySQL
    const dbOk = await testConnection();
    if (!dbOk) {
      console.error(`${WORKER_TAG} ❌ MySQL inaccessible — arrêt.`);
      process.exit(1);
    }
    console.log(`${WORKER_TAG} ✅ MySQL connecté.`);

    // 2. Vérifier Redis
    const redisOk = await testRedisConnection();
    if (!redisOk) {
      console.error(`${WORKER_TAG} ❌ Redis inaccessible — arrêt.`);
      process.exit(1);
    }
    console.log(`${WORKER_TAG} ✅ Redis connecté.`);

    // 3. Démarrer les Workers BullMQ
    notificationWorker     = createNotificationWorker();
    outboundWhatsAppWorker = createOutboundWhatsAppWorker();
    console.log(`${WORKER_TAG} ✅ Workers BullMQ démarrés.`);

    // 4. Restaurer les sessions WhatsApp actives (IA H24)
    const sessionManager = WhatsAppSessionManager.getInstance();
    await sessionManager.restoreAllSessions();
    console.log(`${WORKER_TAG} ✅ Sessions WhatsApp restaurées.`);

    console.log('══════════════════════════════════════════════════');
    console.log(`${WORKER_TAG} ✅ Prêt — En attente de messages WhatsApp...`);
    console.log('══════════════════════════════════════════════════');
    console.log('');

  } catch (error) {
    console.error(`${WORKER_TAG} ❌ Erreur au démarrage:`, error.message);
    process.exit(1);
  }
}

startWhatsAppWorker();
