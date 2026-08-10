// src/cron/subscriptionCron.js
// Tâche planifiée : vérification quotidienne des abonnements expirés
// ARCHITECTURE : Ce cron tourne dans le WORKER (src/worker.js), séparé du serveur HTTP.
const cron = require('node-cron');
const subscriptionRenewalService = require('../services/subscriptionRenewalService');
const otpService = require('../services/otpService');

const CRON_TAG = '[CRON][Subscription]';

let cronJob = null;
let isRunning = false; // Verrou anti-chevauchement

/**
 * Démarre le cron job de gestion des abonnements.
 * Exécuté chaque jour à 1h00 du matin (Africa/Douala).
 */
function startSubscriptionCron() {
  if (cronJob) {
    console.log(`${CRON_TAG} Cron déjà démarré.`);
    return;
  }

  cronJob = cron.schedule('0 1 * * *', async () => {
    // ── Verrou anti-chevauchement ────────────────────────────────────────────
    if (isRunning) {
      console.warn(`${CRON_TAG} ⏭️ Exécution précédente toujours en cours — ignorée.`);
      return;
    }
    isRunning = true;
    const jobStart = Date.now();
    console.log(`${CRON_TAG} ${new Date().toISOString()} — Démarrage...`);

    try {
      const downgraded = await subscriptionRenewalService.processAllExpiredSubscriptions();
      console.log(`${CRON_TAG} ✅ ${downgraded} abonnement(s) rétrogradé(s) au plan Gratuit.`);

      const cleaned = await otpService.cleanupExpiredOTPs();
      console.log(`${CRON_TAG} 🗑️ ${cleaned} OTP(s) expirés supprimés.`);

    } catch (error) {
      console.error(`${CRON_TAG} ❌ Erreur:`, {
        message: error.message,
        stack: error.stack
      });
    } finally {
      const duration = Date.now() - jobStart;
      console.log(`${CRON_TAG} Job terminé en ${duration}ms.`);
      isRunning = false; // Libère le verrou dans tous les cas
    }
  }, {
    scheduled: true,
    timezone: 'Africa/Douala'
  });

  console.log(`${CRON_TAG} ✅ Cron job démarré (exécution chaque jour à 1h00, Africa/Douala).`);
}

/**
 * Arrête le cron job (pour arrêt gracieux du worker)
 */
function stopSubscriptionCron() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    isRunning = false;
    console.log(`${CRON_TAG} Cron job arrêté.`);
  }
}

module.exports = { startSubscriptionCron, stopSubscriptionCron };

