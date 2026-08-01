/**
 * Script de génération des clés VAPID
 * 
 * Les clés VAPID (Voluntary Application Server Identification) sont essentielles pour
 * sécuriser les Web Push Notifications. Elles permettent d'authentifier le serveur
 * auprès des services de push (Firebase Cloud Messaging, etc.).
 * 
 * Public Key : Utilisée par le client (navigateur) pour créer la subscription
 * Private Key : Utilisée par le serveur pour signer les notifications
 */

const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

console.log('\x1b[36m%s\x1b[0m', '🛠  GÉNÉRATION DES CLÉS VAPID');
console.log('================================================\n');

// Générer les clés VAPID
const vapidKeys = webpush.generateVAPIDKeys();

console.log('\x1b[32m%s\x1b[0m', '✅ Clés VAPID générées avec succès !\n');
console.log('\x1b[33m%s\x1b[0m', '🔑 PUBLIC KEY (à partager avec les clients):');
console.log(vapidKeys.publicKey);
console.log('\n');
console.log('\x1b[31m%s\x1b[0m', '🔒 PRIVATE KEY (à garder SECRÈTE !):');
console.log(vapidKeys.privateKey);
console.log('\n');

console.log('\x1b[36m%s\x1b[0m', '📝 À AJOUTER DANS LE FICHIER .env :');
console.log('VAPID_PUBLIC_KEY=' + vapidKeys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + vapidKeys.privateKey);
console.log('VAPID_SUBJECT=mailto:votre-email@example.com');

// Option : sauvegarder les clés dans un fichier .env.example
const envExample = `# Configuration du serveur
PORT=3000

# Configuration de la base de données
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=webpush_demo

# Clés VAPID
VAPID_PUBLIC_KEY=${vapidKeys.publicKey}
VAPID_PRIVATE_KEY=${vapidKeys.privateKey}
VAPID_SUBJECT=mailto:votre-email@example.com`;

fs.writeFileSync('.env.example', envExample);
console.log('\n\x1b[32m%s\x1b[0m', '📄 Fichier .env.example créé avec les clés');
console.log('   Copiez le contenu dans votre fichier .env');
console.log('\n');

console.log('\x1b[36m%s\x1b[0m', '🔍 EXPLICATION DES CLÉS VAPID :');
console.log('----------------------------------------');
console.log('1. Public Key : Utilisée par le navigateur pour créer la souscription');
console.log('   - Visible par tous les clients');
console.log('   - Incluse dans la configuration du Service Worker');
console.log('');
console.log('2. Private Key : Utilisée par le serveur pour signer les notifications');
console.log('   - DOIT RESTER SECRÈTE !');
console.log('   - Jamais partagée avec les clients');
console.log('');
console.log('3. Subject : Identifie le propriétaire (email ou URL)');
console.log('   - Obligatoire pour le Web Push API');
console.log('   - Utilisé par les services de push pour notifier en cas d\'abus');