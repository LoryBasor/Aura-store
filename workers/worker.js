/**
 * ============================================================
 * AURA STORE — BullMQ Worker générique
 * ============================================================
 * Ce processus est un alias qui lance le scheduler + les workers
 * non-WhatsApp (si à l'avenir des jobs sans WhatsApp sont ajoutés).
 *
 * En production, si vous n'avez qu'un seul conteneur "worker",
 * vous pouvez lancer ce fichier. Il délègue au scheduler.
 *
 * Lancé en production via :
 *   npm run worker
 *   → NODE_ENV=production node workers/worker.js
 *
 * Note : Les workers BullMQ WhatsApp (NotificationQueue,
 * OutboundWhatsAppQueue) doivent être lancés via :
 *   npm run whatsapp
 * car ils nécessitent Chromium/WhatsApp.
 * ============================================================
 */
require('dotenv').config();

const { nodeEnv } = require('../config/env');
const WORKER_TAG = '[Worker]';

console.log('');
console.log('══════════════════════════════════════════════════');
console.log(`${WORKER_TAG} ✨ AURA Store — BullMQ Worker générique`);
console.log(`${WORKER_TAG} Environnement : ${nodeEnv}`);
console.log(`${WORKER_TAG} Délégation vers workers/scheduler.js...`);
console.log('══════════════════════════════════════════════════');
console.log('');

// Ce processus délègue au scheduler
require('./scheduler');
