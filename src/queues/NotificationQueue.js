// src/queues/NotificationQueue.js
const { Queue, Worker } = require('bullmq');
const { connection } = require('./connection');
const { pool } = require('../config/database');
const WhatsAppSessionManager = require('../services/whatsapp/WhatsAppSessionManager');

// Create the Queue
const notificationQueue = new Queue('NotificationQueue', { connection });

// Function to add jobs to the queue
const addNotificationJob = async (type, data) => {
  await notificationQueue.add(type, data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }
  });
};

// Worker to process jobs
const notificationWorker = new Worker('NotificationQueue', async job => {
  const type = job.name;
  const data = job.data;
  console.log(`Processing notification job ${job.id} of type ${type}`);

  if (type === 'new_order') {
    const { order, vendorWhatsApp, storeSlug } = data;
    
    // Vérifier que le vendeur a le plan Pro ou Business ET une session active (via DB pour le Smart Wake-Up)
    const sessionManager = WhatsAppSessionManager.getInstance();
    const sessionStatus = await sessionManager.getSessionStatus(order.user_id);
    
    if (!sessionStatus || sessionStatus.status !== 'connected') {
      console.log(`Vendor ${order.user_id} does not have an active WhatsApp session in DB. Notification skipped.`);
      return;
    }

    // Vérifier le plan (Pro ou Business autorisés)
    const [planRows] = await pool.execute(
      `SELECT sp.slug FROM subscriptions s
       JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE s.user_id = ? AND s.status IN ('trial', 'active')
       ORDER BY s.id DESC LIMIT 1`,
      [order.user_id]
    );

    const planSlug = planRows[0]?.slug || '';
    if (!['pro', 'business'].includes(planSlug)) {
      console.log(`Vendor ${order.user_id} is on plan "${planSlug}" — WhatsApp notifications require Pro or Business.`);
      return;
    }

    const shortCode = `A${order.id}`;

    // Message de base (Pro et Business)
    let message =
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📦 *Commande*\n` +
      `#${shortCode}\n\n` +
      `*Client* : ${order.customer_name}\n` +
      `*Téléphone* : ${order.customer_phone}\n` +
      `*Produit* : ${order.product_name}\n` +
      `*Quantité* : ${order.quantity}\n` +
      `*Montant* : ${order.total_amount} XAF\n` +
      `━━━━━━━━━━━━━━━━━━━━━━`;

    // Instructions de mise à jour du statut (Business uniquement)
    if (planSlug === 'business') {
      message +=
        `\n\n📋 *Mettre à jour le statut* :\n` +
        `Répondez avec : [Chiffre] [Code]\n` +
        `Exemple: *1 ${shortCode}*\n\n` +
        `  1 ➔ Confirmer\n` +
        `  2 ➔ En Préparation\n` +
        `  3 ➔ En Livraison\n` +
        `  4 ➔ Livrée ✅\n` +
        `  5 ➔ Annuler ❌\n` +
        `━━━━━━━━━━━━━━━━━━━━━━`;
    }

    // Envoyer le message au vendeur
    try {
       await sessionManager.sendMessage(order.user_id, vendorWhatsApp, message, { orderId: order.id, orderNumber: order.order_number });
       console.log(`Order notification sent for order #${order.order_number} (plan: ${planSlug})`);
    } catch (error) {
       console.error('Failed to send WhatsApp notification', error);
       throw error; // triggers a retry
    }
  }

}, { connection });

notificationWorker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed with error ${err.message}`);
});

module.exports = {
  notificationQueue,
  addNotificationJob,
  notificationWorker
};