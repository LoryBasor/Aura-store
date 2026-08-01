/**
 * Service Worker pour les Web Push Notifications
 * 
 * Le Service Worker est un script qui s'exécute en arrière-plan
 * dans le navigateur, même lorsque la page est fermée.
 * 
 * Rôles principaux :
 * 1. Recevoir les push events du serveur
 * 2. Afficher les notifications
 * 3. Gérer les clics sur les notifications
 * 
 * Cycle de vie du Service Worker :
 * 1. Installation (install) - Premier chargement
 * 2. Activation (activate) - Prêt à être utilisé
 * 3. Fonctionnement (push, notificationclick) - Écoute des événements
 */

// Nom du Service Worker pour le cache
const CACHE_NAME = 'web-push-demo-v1';

/**
 * Événement d'installation
 * 
 * Le Service Worker est installé par le navigateur lors du premier chargement
 * ou lorsqu'une nouvelle version est disponible.
 */
self.addEventListener('install', (event) => {
    console.log('\x1b[36m%s\x1b[0m', '📦 Service Worker - Installation en cours...');
    
    // Skip waiting pour que le SW devienne actif immédiatement
    event.waitUntil(self.skipWaiting());
    
    console.log('\x1b[32m%s\x1b[0m', '✅ Service Worker installé avec succès');
});

/**
 * Événement d'activation
 * 
 * Le Service Worker est activé après l'installation.
 * C'est le moment où il prend le contrôle des pages.
 */
self.addEventListener('activate', (event) => {
    console.log('\x1b[36m%s\x1b[0m', '🚀 Service Worker - Activation...');
    
    // Nettoyer les anciens caches
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log(`\x1b[33m%s\x1b[0m`, `🗑️  Suppression du cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    
    // Prendre le contrôle des pages
    event.waitUntil(self.clients.claim());
    
    console.log('\x1b[32m%s\x1b[0m', '✅ Service Worker activé et prêt');
});

/**
 * Événement push - CŒUR DU SERVICE
 * 
 * Cet événement est déclenché par le navigateur lorsque :
 * 1. Le serveur envoie une notification via le service de push
 * 2. Le payload est décrypté et transmis au Service Worker
 * 
 * Le Service Worker peut alors :
 * - Afficher une notification
 * - Mettre à jour le cache
 * - Synchroniser des données
 */
self.addEventListener('push', (event) => {
    console.log('\x1b[36m%s\x1b[0m', '📨 Service Worker - Notification push reçue');
    
    let data = {
        title: '🛍️ Demo Shop',
        body: 'Nouvelle notification',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        image: null,
        url: '/',
        productId: null,
        createdAt: new Date().toISOString()
    };
    
    try {
        // Extraire et parser le payload JSON
        if (event.data) {
            const parsedData = event.data.json();
            console.log('\x1b[36m%s\x1b[0m', '📊 Données reçues:', parsedData);
            data = { ...data, ...parsedData };
        }
    } catch (error) {
        console.warn('\x1b[33m%s\x1b[0m', '⚠️  Erreur de parsing du payload:', error.message);
        // Utiliser le texte brut si le JSON échoue
        if (event.data) {
            const text = event.data.text();
            if (text) {
                data.body = text;
            }
        }
    }
    
    console.log('\x1b[36m%s\x1b[0m', '🖼️  Affichage de la notification...');
    
    // Options de la notification
    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        image: data.image,
        vibrate: [200, 100, 200, 100, 200],
        sound: '/notification.mp3',
        // Actions disponibles dans la notification
        actions: [
            {
                action: 'open',
                title: 'Voir le produit',
                icon: '/open-icon.png'
            },
            {
                action: 'close',
                title: 'Fermer',
                icon: '/close-icon.png'
            }
        ],
        // Données associées à la notification
        data: {
            url: data.url,
            productId: data.productId,
            createdAt: data.createdAt
        },
        // Indicateur de notification silencieuse
        silent: false,
        // Priorité (2 = élevée)
        priority: 2,
        // Renvoi vers une URL spécifique
        // requireInteraction: true  // Pour notifications persistantes
    };
    
    console.log('\x1b[32m%s\x1b[0m', '✅ Notification préparée avec succès');
    console.log(`   Titre: ${data.title}`);
    console.log(`   Message: ${data.body}`);
    if (data.productId) {
        console.log(`   Produit ID: ${data.productId}`);
    }
    
    // Afficher la notification
    event.waitUntil(
        self.registration.showNotification(data.title, options)
            .then(() => {
                console.log('\x1b[32m%s\x1b[0m', '✅ Notification affichée avec succès');
            })
            .catch((error) => {
                console.error('\x1b[31m%s\x1b[0m', '❌ Erreur d\'affichage de la notification:', error.message);
            })
    );
});

/**
 * Événement click sur la notification
 * 
 * Gère l'interaction de l'utilisateur avec la notification
 */
self.addEventListener('notificationclick', (event) => {
    console.log('\x1b[36m%s\x1b[0m', '🖱️  Service Worker - Clic sur la notification');
    
    const notification = event.notification;
    const action = event.action;
    
    console.log(`   Action: ${action || 'default'}`);
    console.log(`   URL cible: ${notification.data?.url || '/products'}`);
    
    // Fermer la notification
    event.notification.close();
    
    // Gérer les actions personnalisées
    if (action === 'close') {
        console.log('\x1b[36m%s\x1b[0m', '🔒 Notification fermée');
        return;
    }
    
    // Ouvrir la page appropriée
    event.waitUntil(
        (async () => {
            // Récupérer toutes les fenêtres ouvertes
            const clients = await self.clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            });
            
            // URL à ouvrir
            let url = notification.data?.url || '/products';
            
            // Si action 'open' ou click simple, ouvrir la page du produit
            if (action === 'open' || action === '') {
                // Si un ID de produit est fourni, ouvrir la page spécifique
                if (notification.data?.productId) {
                    url = `/products/${notification.data.productId}`;
                }
                console.log(`   Ouverture de: ${url}`);
            }
            
            // Vérifier si la page est déjà ouverte
            const existingClient = clients.find(client => 
                client.url.includes(url) && 
                'focus' in client
            );
            
            if (existingClient) {
                // Focus sur la page existante
                await existingClient.focus();
                console.log('   ✅ Page existante focalisée');
            } else {
                // Ouvrir une nouvelle page
                await self.clients.openWindow(url);
                console.log('   ✅ Nouvelle page ouverte');
            }
        })()
    );
});

/**
 * Événement de fermeture de notification
 */
self.addEventListener('notificationclose', (event) => {
    console.log('\x1b[36m%s\x1b[0m', '🚪 Notification fermée par l\'utilisateur');
    // Analytics, nettoyage, etc.
});

/**
 * Événement de synchrone (background sync)
 * Permet de synchroniser des données en arrière-plan
 */
self.addEventListener('sync', (event) => {
    console.log('\x1b[36m%s\x1b[0m', '🔄 Sync event:', event.tag);
    // Implementation possible pour des actions en arrière-plan
});

console.log('\x1b[32m%s\x1b[0m', '✅ Service Worker initialisé');