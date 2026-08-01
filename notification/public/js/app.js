/**
 * Application JavaScript Frontend
 * 
 * Gère :
 * - L'inscription du Service Worker
 * - Les permissions de notification
 * - La création/suppression de souscriptions
 * - Les interactions utilisateur
 * - Les appels API vers le serveur
 */

// ==================== CONFIGURATION ====================

const API_BASE_URL = window.location.origin + '/api';
const VAPID_PUBLIC_KEY = window.VAPID_PUBLIC_KEY || '';

// ==================== ÉTAT DE L'APPLICATION ====================

const state = {
    serviceWorkerRegistered: false,
    notificationPermission: null,
    subscription: null,
    userId: 1 // Utilisateur par défaut (Jean Dupont)
};

// ==================== DOM ELEMENTS ====================

const elements = {
    status: document.getElementById('status'),
    permissionStatus: document.getElementById('permissionStatus'),
    subscriptionStatus: document.getElementById('subscriptionStatus'),
    
    requestPermissionBtn: document.getElementById('requestPermissionBtn'),
    createSubscriptionBtn: document.getElementById('createSubscriptionBtn'),
    deleteSubscriptionBtn: document.getElementById('deleteSubscriptionBtn'),
    testNotificationBtn: document.getElementById('testNotificationBtn'),
    
    subscriptionInfo: document.getElementById('subscriptionInfo'),
    endpointDisplay: document.getElementById('endpointDisplay'),
    p256dhDisplay: document.getElementById('p256dhDisplay'),
    authDisplay: document.getElementById('authDisplay'),
    
    logs: document.getElementById('logs'),
    
    // Produits
    productsGrid: document.getElementById('productsGrid'),
    productModal: document.getElementById('productModal'),
    modalContent: document.getElementById('modalContent'),
    closeModal: document.getElementById('closeModal')
};

// ==================== LOGGING ====================

/**
 * Ajoute un message dans la console et dans l'interface
 */
function addLog(message, type = 'info') {
    const colors = {
        info: '#4A90D9',
        success: '#27AE60',
        warning: '#F39C12',
        error: '#E74C3C'
    };
    
    const emojis = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌'
    };
    
    const time = new Date().toLocaleTimeString();
    const logEntry = `[${time}] ${emojis[type] || '📝'} ${message}`;
    
    console.log(`%c${logEntry}`, `color: ${colors[type] || '#333'}`);
    
    if (elements.logs) {
        const div = document.createElement('div');
        div.className = `log-entry log-${type}`;
        div.textContent = logEntry;
        elements.logs.appendChild(div);
        elements.logs.scrollTop = elements.logs.scrollHeight;
    }
}

// ==================== FONCTIONS UTILITAIRES ====================
// ⬇️⬇️⬇️ C'EST ICI QU'ON MET LA FONCTION ⬇️⬇️⬇️

/**
 * Convertit un ArrayBuffer en base64 URL-safe
 * Cette fonction est nécessaire car btoa() ne gère pas les données binaires
 * 
 * @param {ArrayBuffer|Uint8Array} arrayBuffer - Les données binaires à convertir
 * @returns {string} La chaîne encodée en base64 URL-safe
 * 
 * Exemple d'utilisation :
 * const p256dhArray = new Uint8Array(subscription.getKey('p256dh'));
 * const p256dhBase64 = arrayBufferToBase64Url(p256dhArray);
 */
function arrayBufferToBase64Url(arrayBuffer) {
    // Convertir l'ArrayBuffer en Uint8Array si ce n'est pas déjà fait
    const uint8Array = arrayBuffer instanceof Uint8Array 
        ? arrayBuffer 
        : new Uint8Array(arrayBuffer);
    
    // Convertir en binaire avec fromCharCode.apply
    // fromCharCode.apply(null, uint8Array) transforme chaque byte en caractère
    const binaryString = String.fromCharCode.apply(null, uint8Array);
    
    // Encoder en base64 standard
    const base64 = btoa(binaryString);
    
    // Convertir en base64 URL-safe (remplacer + par -, / par _, enlever =)
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Convertit une clé VAPID base64 en Uint8Array
 * Utilisée pour la création de la souscription
 */
function urlBase64ToUint8Array(base64String) {
    if (!base64String || typeof base64String !== 'string') {
        throw new Error('Clé VAPID publique absente. Vérifiez la configuration du serveur et du fichier .env.');
    }

    const normalized = base64String.trim().replace(/[\r\n]/g, '');

    if (normalized.includes('{{') || normalized.includes('}}')) {
        throw new Error('La clé VAPID n\'a pas été injectée correctement dans la page.');
    }

    const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
    const base64 = (normalized + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Récupère la clé publique VAPID soit depuis la variable globale, soit depuis l'API
 */
async function getVapidPublicKey() {
    if (VAPID_PUBLIC_KEY && typeof VAPID_PUBLIC_KEY === 'string' && VAPID_PUBLIC_KEY.trim() && !VAPID_PUBLIC_KEY.includes('{{')) {
        return VAPID_PUBLIC_KEY;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/push/vapid-public-key`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json && json.publicKey) return json.publicKey;
        throw new Error('Clé publique introuvable');
    } catch (err) {
        addLog(`❌ Erreur récupération VAPID: ${err.message}`, 'error');
        throw err;
    }
}

// ==================== SERVICE WORKER ====================

/**
 * Enregistre le Service Worker
 * Le Service Worker doit être enregistré depuis la même origine
 * et doit être accessible via l'URL spécifiée.
 */
async function registerServiceWorker() {
    try {
        addLog('📦 Enregistrement du Service Worker...', 'info');
        
        if (!('serviceWorker' in navigator)) {
            addLog('❌ Les Service Workers ne sont pas supportés par ce navigateur', 'error');
            return false;
        }
        
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
        });
        
        state.serviceWorkerRegistered = true;
        
        addLog('✅ Service Worker enregistré avec succès', 'success');
        addLog(`📱 Portée: ${registration.scope}`, 'info');
        
        registration.update();
        
        return true;
    } catch (error) {
        addLog(`❌ Erreur d'enregistrement du SW: ${error.message}`, 'error');
        return false;
    }
}

// ==================== PERMISSIONS ====================

/**
 * Demande l'autorisation de notification
 */
async function requestPermission() {
    try {
        addLog('🔔 Demande d\'autorisation de notification...', 'info');
        
        if (!('Notification' in window)) {
            addLog('❌ Les notifications ne sont pas supportées', 'error');
            return false;
        }
        
        const permission = await Notification.requestPermission();
        state.notificationPermission = permission;
        
        updatePermissionUI(permission);
        
        if (permission === 'granted') {
            addLog('✅ Autorisation accordée !', 'success');
            addLog('💡 Vous pouvez maintenant créer une souscription', 'info');
            return true;
        } else if (permission === 'denied') {
            addLog('❌ Autorisation refusée', 'error');
            addLog('💡 Vous devrez modifier les paramètres du navigateur', 'warning');
            return false;
        } else {
            addLog('⏳ Autorisation en attente...', 'warning');
            return false;
        }
    } catch (error) {
        addLog(`❌ Erreur: ${error.message}`, 'error');
        return false;
    }
}

/**
 * Met à jour l'interface utilisateur en fonction de la permission
 */
function updatePermissionUI(permission) {
    const statusMap = {
        'granted': { text: '✅ Accordée', color: '#27AE60' },
        'denied': { text: '❌ Refusée', color: '#E74C3C' },
        'default': { text: '⏳ Non demandée', color: '#F39C12' }
    };
    
    const status = statusMap[permission] || statusMap['default'];
    elements.permissionStatus.textContent = status.text;
    elements.permissionStatus.style.color = status.color;
    
    elements.createSubscriptionBtn.disabled = permission !== 'granted';
}

// ==================== SUBSCRIPTION ====================

/**
 * Crée une souscription push
 */
async function createSubscription() {
    try {
        if (!state.serviceWorkerRegistered) {
            addLog('❌ Service Worker non enregistré', 'error');
            return false;
        }
        
        if (state.notificationPermission !== 'granted') {
            addLog('❌ Autorisation de notification non accordée', 'error');
            return false;
        }
        
        if (!('PushManager' in window)) {
            addLog('❌ PushManager non supporté par ce navigateur', 'error');
            return false;
        }
        
        addLog('🔑 Création de la souscription push...', 'info');
        
        const registration = await navigator.serviceWorker.ready;
        
        const vapidKey = await getVapidPublicKey();
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });
        
        state.subscription = subscription;
        
        displaySubscriptionInfo(subscription);
        
        await sendSubscriptionToServer(subscription);
        
        addLog('✅ Souscription créée avec succès', 'success');
        addLog(`📱 Endpoint: ${subscription.endpoint.substring(0, 60)}...`, 'info');
        
        updateSubscriptionUI(true);
        
        return true;
    } catch (error) {
        addLog(`❌ Erreur de création de souscription: ${error.message}`, 'error');
        console.error('Subscription error:', error);
        return false;
    }
}

/**
 * Envoie la souscription au serveur pour stockage
 * Utilise arrayBufferToBase64Url() pour encoder les clés
 */
async function sendSubscriptionToServer(subscription) {
    try {
        addLog('💾 Enregistrement de la souscription sur le serveur...', 'info');
        
        // Récupérer les clés en tant que Uint8Array
        const p256dhArray = new Uint8Array(subscription.getKey('p256dh'));
        const authArray = new Uint8Array(subscription.getKey('auth'));
        
        // ⬇️⬇️⬇️ ICI ON UTILISE LA FONCTION ⬇️⬇️⬇️
        // Convertir en base64 URL-safe
        const p256dhBase64 = arrayBufferToBase64Url(p256dhArray);
        const authBase64 = arrayBufferToBase64Url(authArray);
        
        const response = await fetch(`${API_BASE_URL}/push/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: state.userId,
                subscription: {
                    endpoint: subscription.endpoint,
                    keys: {
                        p256dh: p256dhBase64,
                        auth: authBase64
                    }
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        addLog('✅ Souscription enregistrée sur le serveur', 'success');
        
        return data;
    } catch (error) {
        addLog(`❌ Erreur d'enregistrement: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Supprime la souscription
 */
async function deleteSubscription() {
    try {
        if (!state.subscription) {
            addLog('⚠️ Aucune souscription à supprimer', 'warning');
            return false;
        }
        
        addLog('🗑️ Suppression de la souscription...', 'info');
        
        const response = await fetch(`${API_BASE_URL}/push/unsubscribe`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                endpoint: state.subscription.endpoint
            })
        });
        
        if (state.subscription) {
            await state.subscription.unsubscribe();
        }
        
        state.subscription = null;
        
        displaySubscriptionInfo(null);
        updateSubscriptionUI(false);
        
        addLog('✅ Souscription supprimée avec succès', 'success');
        
        return true;
    } catch (error) {
        addLog(`❌ Erreur de suppression: ${error.message}`, 'error');
        return false;
    }
}

/**
 * Affiche les informations de la souscription
 */
function displaySubscriptionInfo(subscription) {
    if (!subscription) {
        elements.endpointDisplay.textContent = 'Aucune souscription';
        elements.p256dhDisplay.textContent = 'N/A';
        elements.authDisplay.textContent = 'N/A';
        elements.subscriptionInfo.style.display = 'none';
        return;
    }
    
    elements.subscriptionInfo.style.display = 'block';
    elements.endpointDisplay.textContent = subscription.endpoint;
    
    try {
        const p256dh = subscription.getKey('p256dh');
        const auth = subscription.getKey('auth');
        
        if (p256dh) {
            const p256dhArray = new Uint8Array(p256dh);
            // ⬇️⬇️⬇️ ICI ON UTILISE LA FONCTION ⬇️⬇️⬇️
            elements.p256dhDisplay.textContent = arrayBufferToBase64Url(p256dhArray);
        }
        if (auth) {
            const authArray = new Uint8Array(auth);
            // ⬇️⬇️⬇️ ICI ON UTILISE LA FONCTION ⬇️⬇️⬇️
            elements.authDisplay.textContent = arrayBufferToBase64Url(authArray);
        }
    } catch (error) {
        console.warn('Impossible de récupérer les clés:', error);
        elements.p256dhDisplay.textContent = 'Erreur';
        elements.authDisplay.textContent = 'Erreur';
    }
}

/**
 * Met à jour l'interface de la souscription
 */
function updateSubscriptionUI(hasSubscription) {
    elements.createSubscriptionBtn.disabled = hasSubscription;
    elements.deleteSubscriptionBtn.disabled = !hasSubscription;
    elements.testNotificationBtn.disabled = !hasSubscription;
    
    elements.subscriptionStatus.textContent = hasSubscription ? '✅ Active' : '❌ Inactive';
    elements.subscriptionStatus.style.color = hasSubscription ? '#27AE60' : '#E74C3C';
}

// ==================== NOTIFICATIONS ====================

/**
 * Envoie une notification de test
 */
async function sendTestNotification() {
    try {
        if (!state.subscription) {
            addLog('⚠️ Créez une souscription d\'abord', 'warning');
            return false;
        }
        
        addLog('📨 Envoi d\'une notification de test...', 'info');
        
        const response = await fetch(`${API_BASE_URL}/push/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: state.userId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            addLog(`✅ Notification envoyée à ${data.data.sent} abonnés`, 'success');
            if (data.data.failed > 0) {
                addLog(`⚠️ Échec pour ${data.data.failed} abonnés`, 'warning');
            }
        } else {
            addLog(`❌ Erreur: ${data.message}`, 'error');
        }
        
        return data.success;
    } catch (error) {
        addLog(`❌ Erreur: ${error.message}`, 'error');
        return false;
    }
}

// ==================== PRODUCT MANAGEMENT ====================

/**
 * Charge et affiche les produits
 */
async function loadProducts() {
    try {
        if (!elements.productsGrid) return;
        
        addLog('🔄 Chargement des produits...', 'info');
        
        const response = await fetch(`${API_BASE_URL}/products`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message);
        }
        
        displayProducts(data.data);
        addLog(`✅ ${data.data.length} produits chargés`, 'success');
    } catch (error) {
        addLog(`❌ Erreur de chargement des produits: ${error.message}`, 'error');
        elements.productsGrid.innerHTML = `
            <div class="error-message">
                ❌ Impossible de charger les produits
            </div>
        `;
    }
}

/**
 * Affiche les produits dans la grille
 */
function displayProducts(products) {
    if (!elements.productsGrid) return;
    
    if (products.length === 0) {
        elements.productsGrid.innerHTML = `
            <div class="empty-state">
                <h3>Aucun produit disponible</h3>
                <p>Les produits seront affichés ici.</p>
            </div>
        `;
        return;
    }
    
    elements.productsGrid.innerHTML = products.map(product => `
        <div class="product-card glass" data-id="${product.id}">
            <div class="product-image">
                <img src="${product.image || 'https://via.placeholder.com/300x200/4A90D9/ffffff?text=Produit'}" 
                     alt="${product.name}"
                     loading="lazy">
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <p class="product-description">${product.description}</p>
                <p class="product-seller">👤 ${product.seller_name || 'Vendeur inconnu'}</p>
                <div class="product-actions">
                    <button class="btn btn-primary btn-sm" onclick="publishProduct(${product.id})">
                        📢 Publier
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="viewProduct(${product.id})">
                        👁️ Voir
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Publie un produit (envoie une notification)
 */
async function publishProduct(productId) {
    try {
        addLog(`📢 Publication du produit #${productId}...`, 'info');
        
        const response = await fetch(`${API_BASE_URL}/products/${productId}`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message);
        }
        
        const product = data.data;
        
        const notifyResponse = await fetch(`${API_BASE_URL}/push/notify-product`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                productId: product.id,
                productName: product.name,
                productImage: product.image,
                userId: state.userId
            })
        });
        
        const result = await notifyResponse.json();
        
        if (result.success) {
            addLog(`✅ Notification publiée pour "${product.name}"`, 'success');
            addLog(`📊 Envoyée à ${result.data.sent} abonnés`, 'info');
        } else {
            addLog(`❌ Erreur: ${result.message}`, 'error');
        }
    } catch (error) {
        addLog(`❌ Erreur: ${error.message}`, 'error');
    }
}

/**
 * Ouvre le modal d'un produit
 */
async function viewProduct(productId) {
    try {
        const response = await fetch(`${API_BASE_URL}/products/${productId}`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message);
        }
        
        const product = data.data;
        
        elements.modalContent.innerHTML = `
            <div class="modal-product">
                <img src="${product.image || 'https://via.placeholder.com/600x300/4A90D9/ffffff?text=Produit'}" 
                     alt="${product.name}">
                <h2>${product.name}</h2>
                <p class="modal-description">${product.description}</p>
                <p class="modal-seller">👤 Vendu par ${product.seller_name || 'Vendeur inconnu'}</p>
                <p class="modal-date">📅 Publié le ${new Date(product.created_at).toLocaleDateString('fr-FR')}</p>
                <button class="btn btn-primary" onclick="publishProduct(${product.id})">
                    📢 Publier ce produit
                </button>
            </div>
        `;
        
        elements.productModal.style.display = 'flex';
    } catch (error) {
        addLog(`❌ Erreur: ${error.message}`, 'error');
    }
}

// ==================== INITIALIZATION ====================

/**
 * Initialise l'application
 */
async function init() {
    addLog('🚀 Initialisation de l\'application...', 'info');
    addLog(`👤 Utilisateur: ${state.userId}`, 'info');
    
    if (!('Notification' in window)) {
        addLog('❌ Les notifications ne sont pas supportées', 'error');
        return;
    }
    
    state.notificationPermission = Notification.permission;
    updatePermissionUI(state.notificationPermission);
    
    await registerServiceWorker();
    
    if (state.serviceWorkerRegistered) {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
                state.subscription = subscription;
                displaySubscriptionInfo(subscription);
                updateSubscriptionUI(true);
                addLog('📱 Souscription existante trouvée', 'success');
            }
        } catch (error) {
            console.warn('Erreur lors de la vérification des souscriptions:', error);
        }
    }
    
    if (window.location.pathname.includes('/products')) {
        await loadProducts();
    }
    
    addLog('✅ Application initialisée avec succès', 'success');
    addLog('💡 N\'oubliez pas de configurer les clés VAPID dans .env', 'info');
}

// ==================== EVENT LISTENERS ====================

if (elements.requestPermissionBtn) {
    elements.requestPermissionBtn.addEventListener('click', requestPermission);
}

if (elements.createSubscriptionBtn) {
    elements.createSubscriptionBtn.addEventListener('click', createSubscription);
}

if (elements.deleteSubscriptionBtn) {
    elements.deleteSubscriptionBtn.addEventListener('click', deleteSubscription);
}

if (elements.testNotificationBtn) {
    elements.testNotificationBtn.addEventListener('click', sendTestNotification);
}

if (elements.closeModal) {
    elements.closeModal.addEventListener('click', () => {
        elements.productModal.style.display = 'none';
    });
}

if (elements.productModal) {
    elements.productModal.addEventListener('click', (e) => {
        if (e.target === elements.productModal) {
            elements.productModal.style.display = 'none';
        }
    });
}

// ==================== EXPOSER LES FONCTIONS GLOBALES ====================

window.publishProduct = publishProduct;
window.viewProduct = viewProduct;
window.createSubscription = createSubscription;
window.deleteSubscription = deleteSubscription;
window.requestPermission = requestPermission;
window.sendTestNotification = sendTestNotification;

// ==================== DÉMARRAGE ====================

document.addEventListener('DOMContentLoaded', init);