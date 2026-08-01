// src/services/whatsapp/WhatsAppSessionManager.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const { pool } = require('../../config/database');

let WhatsAppMessageHandler; 

const PUPPETEER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-breakpad",
  "--disable-client-side-phishing-detection",
  "--disable-default-apps",
  "--disable-features=Translate",
  "--disable-sync",
  "--mute-audio",
  "--no-first-run",
  "--no-zygote",
  "--disable-accelerated-2d-canvas"
];

class WhatsAppSessionManager {
  constructor() {
    this.sessions = new Map(); // Store active clients
    this.idleTimers = new Map(); // Store inactivity timers
    this.sessionsDir = path.join(process.cwd(), 'sessions', 'whatsapp');
    // Map userId -> { orderId, orderNumber } pour fallback quand l'ID du message n'est pas disponible
    this.pendingOrders = new Map();

    
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  static getInstance() {
    if (!WhatsAppSessionManager.instance) {
      WhatsAppSessionManager.instance = new WhatsAppSessionManager();
    }
    return WhatsAppSessionManager.instance;
  }

  /**
   * Initialiser une session pour un vendeur
   */
  async createSession(userId, onQrCode, onConnected, onDisconnected, forceNew = false) {
    // Si forceNew, on supprime la session existante pour repartir de zéro
    if (forceNew) {
      this.deleteSession(userId);
    }

    // Fermer proprement si déjà existant en mémoire
    const existingClient = this.sessions.get(userId);
    if (existingClient) {
      try { await existingClient.destroy(); } catch (e) {}
      this.sessions.delete(userId);
    }

    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: `user_${userId}`,
        dataPath: this.sessionsDir
      }),
      puppeteer: {
        headless: true,
        args: PUPPETEER_ARGS
      }
    });

    this.sessions.set(userId, client);

    client.on('qr', (qr) => {
      if (onQrCode) onQrCode(qr);
    });

    client.on('ready', async () => {
      const number = client.info.wid.user;
      await this.updateSessionStatus(userId, 'connected', number);
      if (onConnected) onConnected(number);
    });

    client.on('disconnected', async (reason) => {
      console.log(`[WhatsAppSession] Client disconnected for user ${userId}. Reason:`, reason);
      this.deleteSession(userId);
      await this.updateSessionStatus(userId, 'disconnected', null);
      if (onDisconnected) onDisconnected();
    });

    client.on('message', async (message) => {
      this.resetIdleTimer(userId);
      if (!WhatsAppMessageHandler) {
        WhatsAppMessageHandler = require('./WhatsAppMessageHandler');
      }
      // Ignorer les messages qui ne sont pas des discussions (ex: statuts)
      if (message.isStatus) return;
      await WhatsAppMessageHandler.handleMessage(userId, client, message);
    });

    client.on('message_create', async (message) => {
      // Capturer les messages du vendeur depuis son téléphone (réponses ou commandes directes)
      if (message.fromMe) {
        this.resetIdleTimer(userId);
        if (!WhatsAppMessageHandler) {
          WhatsAppMessageHandler = require('./WhatsAppMessageHandler');
        }
        await WhatsAppMessageHandler.handleVendorMessage(userId, client, message);
      }
    });

    // Initialiser le client
    await client.initialize();

    return client;
  }

  async isAiEnabled(userId) {
    try {
      const [rows] = await pool.query('SELECT ai_enabled FROM wa_sessions WHERE user_id = ?', [userId]);
      return rows.length > 0 ? !!rows[0].ai_enabled : false;
    } catch(e) { return false; }
  }

  async resetIdleTimer(userId) {
    try {
      // Si l'IA est activée, on ne déconnecte jamais (H24)
      const aiEnabled = await this.isAiEnabled(userId);
      if (aiEnabled) {
        if (this.idleTimers.has(userId)) {
          clearTimeout(this.idleTimers.get(userId));
          this.idleTimers.delete(userId);
        }
        return;
      }

      if (this.idleTimers.has(userId)) {
        clearTimeout(this.idleTimers.get(userId));
      }

      const timer = setTimeout(() => {
        console.log(`[WhatsAppSession] Inactivité de 30 minutes pour user ${userId}, fermeture de Chromium...`);
        const client = this.sessions.get(userId);
        if (client) {
          try { client.destroy(); } catch (e) {}
          this.sessions.delete(userId);
        }
        this.idleTimers.delete(userId);
      }, 30 * 60 * 1000); // 30 minutes

      this.idleTimers.set(userId, timer);
    } catch(e) { console.error('Erreur resetIdleTimer:', e); }
  }

  async ensureSessionReady(userId) {
    if (this.sessions.has(userId)) {
      this.resetIdleTimer(userId);
      return this.sessions.get(userId);
    }
    
    // Si pas en mémoire, vérifier s'il est "connecté" en DB
    const [rows] = await pool.query('SELECT status FROM wa_sessions WHERE user_id = ?', [userId]);
    if (rows.length === 0 || rows[0].status !== 'connected') {
      throw new Error('Aucune session WhatsApp liée ou session déconnectée par l\'utilisateur.');
    }

    console.log(`[WhatsAppSession] Smart Wake-Up: Réveil de la session pour user ${userId}...`);
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout lors du réveil de la session')), 45000);
      try {
        const client = await this.createSession(userId, null, (num) => {
           clearTimeout(timeout);
           this.resetIdleTimer(userId);
           resolve(client);
        });
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  /**
   * Crée une session et retourne le code d'appairage (pairing code).
   */
  async createSessionWithPairingCode(userId, phoneNumber) {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout: impossible de générer le code. Réessayez.'));
      }, 30000); // 30 secondes car l'ouverture du navigateur peut prendre du temps

      this.deleteSession(userId); // Partir d'une session vierge

      const client = new Client({
        authStrategy: new LocalAuth({
          clientId: `user_${userId}`,
          dataPath: this.sessionsDir
        }),
        puppeteer: {
          headless: true,
          args: PUPPETEER_ARGS
        }
      });

      this.sessions.set(userId, client);

      // S'assurer qu'on ne reste pas bloqué si le QR est généré au lieu du code
      client.on('qr', async () => {
         // Demander le code une fois que WhatsApp web est prêt (quand il affiche le QR)
         try {
            const code = await client.requestPairingCode(phoneNumber);
            clearTimeout(timeout);
            resolve(code);
         } catch(e) {
            clearTimeout(timeout);
            reject(e);
         }
      });

      client.on('ready', async () => {
        const number = client.info.wid.user;
        await this.updateSessionStatus(userId, 'connected', number);
      });

      client.on('disconnected', async (reason) => {
        this.deleteSession(userId);
        await this.updateSessionStatus(userId, 'disconnected', null);
      });

      client.on('message', async (message) => {
        this.resetIdleTimer(userId);
        if (!WhatsAppMessageHandler) {
          WhatsAppMessageHandler = require('./WhatsAppMessageHandler');
        }
        if (message.isStatus) return;
        await WhatsAppMessageHandler.handleMessage(userId, client, message);
      });

      client.on('message_create', async (message) => {
        if (message.fromMe) {
          this.resetIdleTimer(userId);
          if (!WhatsAppMessageHandler) {
            WhatsAppMessageHandler = require('./WhatsAppMessageHandler');
          }
          await WhatsAppMessageHandler.handleVendorMessage(userId, client, message);
        }
      });

      try {
        await client.initialize();
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  /**
   * Stocker une commande en attente de confirmation (fallback sans ID de message)
   */
  setPendingOrder(userId, orderId, orderNumber) {
    this.pendingOrders.set(userId, { orderId, orderNumber, ts: Date.now() });
  }

  /**
   * Récupérer la dernière commande en attente pour cet utilisateur (max 30 min)
   */
  getPendingOrder(userId) {
    const pending = this.pendingOrders.get(userId);
    if (!pending) return null;
    const age = Date.now() - pending.ts;
    if (age > 30 * 60 * 1000) {
      this.pendingOrders.delete(userId);
      return null;
    }
    return pending;
  }

  isSessionConnected(userId) {
    const client = this.sessions.get(userId);
    return client && client.info; // info existe seulement si connecté
  }

  async sendMessage(userId, to, text, contextInfo = null) {
    // S'assurer que le navigateur est allumé (Smart Wake-Up)
    const client = await this.ensureSessionReady(userId);
    if (!client || !client.info) throw new Error('WhatsApp n\'est pas connecté');

    this.resetIdleTimer(userId);

    let chatId = to;
    let cleanNumber = to.replace(/[^0-9]/g, '');

    // Si on n'a pas déjà un suffixe WhatsApp (@c.us ou @g.us), on le formate
    if (!chatId.includes('@')) {
      chatId = cleanNumber + '@c.us';
    }

    // Si on s'envoie un message à soi-même, utiliser notre propre WID
    if (client.info && client.info.wid && cleanNumber === client.info.wid.user) {
      chatId = client.info.wid._serialized;
    } else if (!chatId.includes('@g.us')) {
      // Valider le format via WhatsApp uniquement pour les numéros persos, pas pour les groupes
      try {
        const numberId = await client.getNumberId(cleanNumber);
        if (numberId) chatId = numberId._serialized;
      } catch (err) {}
    }

    const sentMsg = await client.sendMessage(chatId, text);
    const orderId = contextInfo?.orderId || null;

    try {
      // Récupérer l'ID réel du message WhatsApp
      const messageId = sentMsg?.id?.id;
      
      if (!messageId) {
        console.warn('[WhatsApp] AVERTISSEMENT: ID du message envoyé introuvable. sentMsg.id =', JSON.stringify(sentMsg?.id));
        console.warn('[WhatsApp] Les réactions/réponses à ce message NE POURRONT PAS mettre à jour la commande.');
      } else {
        console.log(`[WhatsApp] Message envoyé et sauvegardé avec ID: ${messageId}`);
        // Sauvegarder le message sortant pour matcher les futures réponses/réactions
        const typeToSave = contextInfo?.messageType || 'text';
        await pool.execute(
          `INSERT INTO wa_messages (user_id, message_id, remote_jid, direction, content, message_type, order_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [userId, messageId, chatId, 'outbound', text, typeToSave, orderId]
        );
      }
      
      if (orderId && contextInfo?.orderNumber) {
        this.setPendingOrder(userId, orderId, contextInfo.orderNumber);
      }
    } catch (e) {
      console.error('Erreur sauvegarde message sortant:', e.message, e.sqlMessage);
    }

    return sentMsg;
  }

  deleteSession(userId) {
    const client = this.sessions.get(userId);
    if (client) {
      try { client.destroy(); } catch (e) {}
      this.sessions.delete(userId);
    }
    
    // Supprimer le dossier LocalAuth correspondant (avec retry/catch)
    const dir = path.join(this.sessionsDir, `session-user_${userId}`);
    if (fs.existsSync(dir)) {
      try {
        // Le navigateur peut mettre un peu de temps à libérer les fichiers
        setTimeout(() => {
          if (fs.existsSync(dir)) {
            try {
              fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
            } catch (err) {
              console.warn(`[WhatsAppSession] Impossible de supprimer le dossier ${dir}:`, err.message);
            }
          }
        }, 3000);
      } catch (e) {
        console.warn(`[WhatsAppSession] Erreur planification suppression:`, e.message);
      }
    }
  }

  /**
   * Arrêt propre de tous les clients (pour le redémarrage du serveur)
   * Ferme les navigateurs Puppeteer sans supprimer les dossiers de session.
   */
  async shutdownAllSessions() {
    console.log('\n[WhatsAppSession] Arrêt propre de tous les clients WhatsApp...');
    const destroyPromises = [];
    for (const [userId, client] of this.sessions.entries()) {
      try {
        console.log(`[WhatsAppSession] Fermeture du client user_${userId}...`);
        destroyPromises.push(client.destroy());
      } catch (e) {
        console.error(`Erreur arrêt client user_${userId}:`, e.message);
      }
    }
    
    if (destroyPromises.length > 0) {
      await Promise.allSettled(destroyPromises);
      console.log('[WhatsAppSession] Tous les clients WhatsApp ont été fermés.');
    }
  }

  async updateSessionStatus(userId, status, phone) { 
    try {
      const sessionId = `user_${userId}`;
      // Check if session exists in DB
      const [rows] = await pool.query('SELECT id FROM wa_sessions WHERE user_id = ?', [userId]);
      
      if (rows.length === 0) {
        await pool.query(
          'INSERT INTO wa_sessions (user_id, session_id, status, connected_number, last_sync) VALUES (?, ?, ?, ?, NOW())',
          [userId, sessionId, status, phone]
        );
      } else {
        if (status === 'connected') {
          await pool.query(
            'UPDATE wa_sessions SET status = ?, connected_number = ?, last_sync = NOW() WHERE user_id = ?',
            [status, phone, userId]
          );
        } else {
          await pool.query(
            'UPDATE wa_sessions SET status = ?, connected_number = NULL, last_sync = NULL WHERE user_id = ?',
            [status, userId]
          );
        }
      }
    } catch (error) {
      console.error('Erreur updateSessionStatus:', error);
    }
  }

  async disconnectSession(userId) {
    const client = this.sessions.get(userId);
    if (client) {
      try {
        await client.logout();
      } catch(e) {}
    }
    this.deleteSession(userId);
    await this.updateSessionStatus(userId, 'disconnected', null);
  }

  async restoreAllSessions() {
    try {
      // Rechercher les vendeurs qui ont l'IA ACTIVÉE
      // Les autres vendeurs démarreront "On-Demand" (Smart Wake-Up)
      const [rows] = await pool.query("SELECT user_id FROM wa_sessions WHERE status = 'connected' AND ai_enabled = 1");
      
      console.log(`[WhatsAppSession] Restauration au démarrage de ${rows.length} session(s) avec IA active (H24)...`);
      for (const row of rows) {
        const userId = row.user_id;
        try {
          await this.createSession(userId);
        } catch(e) {
          console.error(`[WhatsAppSession] Erreur au démarrage de la session ${userId}:`, e.message);
        }
      }
    } catch (error) {
      console.error('Erreur restoreAllSessions:', error);
    }
  }
  async getSessionStatus(userId) {
    try {
      const [rows] = await pool.query(
        'SELECT status, connected_number, last_sync FROM wa_sessions WHERE user_id = ?',
        [userId]
      );
      if (rows.length > 0) {
        return rows[0];
      }
      return null;
    } catch (error) {
      console.error('Erreur getSessionStatus:', error);
      return null;
    }
  }
}

module.exports = WhatsAppSessionManager;
