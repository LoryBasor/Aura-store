/**
 * Configuration du package web-push
 * 
 * web-push est la bibliothèque Node.js qui permet d'envoyer des notifications
 * push aux navigateurs via les services de push (Firebase Cloud Messaging, etc.)
 * 
 * Le package gère :
 * - L'authentification avec les clés VAPID
 * - L'encryption des payloads
 * - La gestion des réponses des services de push
 */

const webpush = require('web-push');
require('dotenv').config();

const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || ''
};

// Vérification de la présence des clés VAPID
if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    console.warn('\x1b[33m%s\x1b[0m', '⚠️  Clés VAPID manquantes dans .env');
    console.warn('\x1b[33m%s\x1b[0m', '   Exécutez "npm run generate-vapid" pour les générer');
}

// Configuration de l'instance web-push avec les clés VAPID
webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:demo@example.com', // Subject (URL ou email)
    vapidKeys.publicKey,                                    // Public Key
    vapidKeys.privateKey                                    // Private Key
);

// Configuration des options de notification
const pushOptions = {
    // TTL (Time To Live) en secondes - 24 heures
    TTL: 86400,
    // Urgence : "normal", "high", "low"
    urgency: "normal",
    // Gestion des messages de 2ème plan
    topic: "new-product",
    // Permet de réduire les notifications en double
    contentEncoding: "aesgcm"
};

console.log('\x1b[36m%s\x1b[0m', '🔐 Web Push configuré avec les clés VAPID');
console.log(`   Subject: ${process.env.VAPID_SUBJECT || 'mailto:demo@example.com'}`);
console.log(`   Public Key: ${(process.env.VAPID_PUBLIC_KEY || '').substring(0, 20)}...`);

/**
 * Envoie une notification push à une souscription
 * 
 * @param {Object} subscription - Objet de souscription (endpoint, keys)
 * @param {Object} payload - Contenu de la notification
 * @returns {Promise<Object>} Résultat de l'envoi
 */
async function sendNotification(subscription, payload) {
    try {
        const result = await webpush.sendNotification(
            subscription,
            JSON.stringify(payload),
            pushOptions
        );

        console.log('\x1b[32m%s\x1b[0m', '✅ Notification push envoyée avec succès');
        console.log(`   Status: ${result.statusCode}`);
        
        return result;
    } catch (error) {
        // Gestion des erreurs spécifiques
        if (error.statusCode === 404 || error.statusCode === 410) {
            console.log('\x1b[33m%s\x1b[0m', '⚠️  Souscription expirée ou invalide');
            console.log(`   Code: ${error.statusCode}`);
            console.log('   La souscription doit être supprimée de la base de données');
            throw { status: error.statusCode, message: 'Subscription expired', subscription };
        }
        
        console.error('\x1b[31m%s\x1b[0m', '❌ Erreur d\'envoi de notification push:', error.message);
        throw error;
    }
}

module.exports = {
    webpush,
    sendNotification,
    pushOptions
};