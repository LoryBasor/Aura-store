// src/cron/subscriptionCron.js
// Tâche planifiée : vérification quotidienne des abonnements expirés
const cron = require('node-cron');
const subscriptionRenewalService = require('../services/subscriptionRenewalService');
const otpService = require('../services/otpService');

let cronJob = null;

/**
 * Démarre le cron job de gestion des abonnements.
 * Exécuté chaque jour à 1h00 du matin.
 */
function startSubscriptionCron() {
  if (cronJob) {
    console.log('[SubscriptionCron] Cron déjà démarré.');
    return;
  }

  // Exécution : chaque jour à 01:00
  cronJob = cron.schedule('0 1 * * *', async () => {
    console.log(`[SubscriptionCron] ${new Date().toISOString()} — Vérification des abonnements...`);
    try {
      const downgraded = await subscriptionRenewalService.processAllExpiredSubscriptions();
      console.log(`[SubscriptionCron] ✅ ${downgraded} abonnement(s) rétrogradé(s) au plan Gratuit.`);

      // Nettoyage des OTPs expirés
      const cleaned = await otpService.cleanupExpiredOTPs();
      console.log(`[SubscriptionCron] 🗑️ ${cleaned} OTP(s) expirés supprimés.`);

    } catch (error) {
      console.error('[SubscriptionCron] ❌ Erreur:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Africa/Douala'
  });

  console.log('[SubscriptionCron] ✅ Cron job démarré (exécution chaque jour à 1h00).');
}

/**
 * Arrête le cron job (pour arrêt gracieux du serveur)
 */
function stopSubscriptionCron() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('[SubscriptionCron] Cron job arrêté.');
  }
}

module.exports = { startSubscriptionCron, stopSubscriptionCron };
