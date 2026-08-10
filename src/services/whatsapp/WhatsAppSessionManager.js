// src/services/whatsapp/WhatsAppSessionManager.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const { pool } = require('../../config/database');

// Empêche le crash du serveur Node.js à cause d'une erreur interne de whatsapp-web.js (timeout sur framenavigated)
process.on('unhandledRejection', (reason, promise) => {
  const isAuthTimeout = reason === 'auth timeout' || (reason && reason.message === 'auth timeout');
  const isTargetClosed = reason && reason.name === 'TargetCloseError' || (reason && reason.message && reason.message.includes('Target closed'));
  const isProtocolError = reason && reason.message && reason.message.includes('Protocol error');
  const isSessionClosed = reason && reason.message && reason.message.includes('Session closed');

  if (isAuthTimeout || isTargetClosed || isProtocolError || isSessionClosed) {
    console.warn(`[WhatsAppSession] AVERTISSEMENT: Rejet intercepté silencieusement (bug connu puppeteer/whatsapp-web.js): ${reason?.message || reason}`);
    return;
  }
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

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

// Simple Mutex for async operations
class Mutex {
  constructor() {
    this.queue = [];
    this.locked = false;
  }
  async lock() {
    return new Promise(resolve => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }
  unlock() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next();
    } else {
      this.locked = false;
    }
  }
}

class WhatsAppSessionManager {
  constructor() {
    this.sessions = new Map(); // Store active clients (Client instance)
    this.sessionStates = new Map(); // Store session states: CREATED, INITIALIZING, WAITING_FOR_QR, READY, DISCONNECTED
    this.userLocks = new Map(); // Store mutex per user
    this.idleTimers = new Map(); // Store inactivity timers
    
    this.sessionsDir = path.join(process.cwd(), 'sessions', 'whatsapp');
    this.pendingDeletionsDir = path.join(this.sessionsDir, '_pending_deletions');
    
    this.pendingOrders = new Map();

    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
    if (!fs.existsSync(this.pendingDeletionsDir)) {
      fs.mkdirSync(this.pendingDeletionsDir, { recursive: true });
    }

    // Lance le garbage collector des dossiers orphelins
    this.cleanupPendingDeletions();
  }

  static getInstance() {
    if (!WhatsAppSessionManager.instance) {
      WhatsAppSessionManager.instance = new WhatsAppSessionManager();
    }
    return WhatsAppSessionManager.instance;
  }

  getLock(userId) {
    if (!this.userLocks.has(userId)) {
      this.userLocks.set(userId, new Mutex());
    }
    return this.userLocks.get(userId);
  }

  setState(userId, state, data = {}) {
    const currentState = this.sessionStates.get(userId) || {};
    this.sessionStates.set(userId, { ...currentState, state, ...data });
    console.log(`[WhatsAppSession][user=${userId}][STATE] -> ${state}`);
  }

  getState(userId) {
    return this.sessionStates.get(userId)?.state || 'DISCONNECTED';
  }

  /**
   * Helper pour attendre qu'une session atteigne un état précis.
   */
  async waitForState(userId, targetState, timeoutMs = 45000) {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        const stateInfo = this.sessionStates.get(userId);
        const currentState = stateInfo?.state;

        if (currentState === targetState) {
          clearInterval(check);
          resolve(stateInfo);
        } else if (currentState === 'DISCONNECTED' || currentState === 'ERROR') {
          clearInterval(check);
          reject(new Error(`Session is in state ${currentState}`));
        } else if (Date.now() - startTime > timeoutMs) {
          clearInterval(check);
          reject(new Error(`Timeout waiting for state ${targetState}`));
        }
      }, 500);
    });
  }

  /**
   * Récupère l'ID de session stocké en DB, ou en génère un nouveau
   */
  async getOrGenerateSessionId(userId, forceNew = false) {
    const [rows] = await pool.query('SELECT session_id FROM wa_sessions WHERE user_id = ?', [userId]);
    let sessionId = rows.length > 0 ? rows[0].session_id : null;

    if (!sessionId || forceNew) {
      sessionId = `user_${userId}_${Date.now()}`;
      if (rows.length === 0) {
        await pool.query(
          'INSERT INTO wa_sessions (user_id, session_id, status, last_sync) VALUES (?, ?, ?, NOW())',
          [userId, sessionId, 'disconnected']
        );
      } else {
        await pool.query(
          'UPDATE wa_sessions SET session_id = ?, status = ?, last_sync = NOW() WHERE user_id = ?',
          [sessionId, 'disconnected', userId]
        );
      }
    }
    return sessionId;
  }

  /**
   * Marque un ancien dossier de session pour suppression
   */
  scheduleDirectoryForDeletion(clientId) {
    const oldDir = path.join(this.sessionsDir, `session-${clientId}`);
    if (fs.existsSync(oldDir)) {
      const newDir = path.join(this.pendingDeletionsDir, `delete-${clientId}-${Date.now()}`);
      try {
        fs.renameSync(oldDir, newDir);
        console.log(`[WhatsAppSession] Renommé ${oldDir} -> ${newDir} pour suppression différée.`);
      } catch (err) {
        console.warn(`[WhatsAppSession] Impossible de renommer le dossier ${oldDir} :`, err.message);
        // Si on ne peut pas renommer (ex: verrou Chromium persistant), ce n'est pas critique car
        // le nouveau clientId sera de toute façon différent, évitant le EPERM sur la nouvelle session.
      }
    }
  }

  /**
   * Garbage Collector des dossiers à supprimer (tourne toutes les 10 minutes)
   */
  cleanupPendingDeletions() {
    setInterval(() => {
      try {
        const folders = fs.readdirSync(this.pendingDeletionsDir);
        for (const folder of folders) {
          const dirPath = path.join(this.pendingDeletionsDir, folder);
          try {
            fs.rmSync(dirPath, { recursive: true, force: true });
            console.log(`[WhatsAppSession] Dossier supprimé avec succès : ${folder}`);
          } catch (e) {
            // Ignorer, on réessayera plus tard
          }
        }
      } catch (e) {}
    }, 10 * 60 * 1000);
  }

  /**
   * Initialiser une session pour un vendeur
   */
  async createSession(userId, forceNew = false) {
    const lock = this.getLock(userId);
    await lock.lock();

    try {
      // Si une session tourne déjà et n'est pas forcée, on ne recrée pas.
      const currentState = this.getState(userId);
      if (!forceNew && (currentState === 'READY' || currentState === 'INITIALIZING' || currentState === 'WAITING_FOR_QR')) {
        return this.sessions.get(userId);
      }

      this.setState(userId, 'INITIALIZING', { qr: null });

      // 1. Obtenir le session_id. Si forceNew, on marque l'ancienne pour suppression et on en génère une nouvelle.
      let currentSessionId = null;
      if (forceNew) {
        // Obtenir l'ancien pour le supprimer
        const [rows] = await pool.query('SELECT session_id FROM wa_sessions WHERE user_id = ?', [userId]);
        if (rows.length > 0 && rows[0].session_id) {
            this.scheduleDirectoryForDeletion(rows[0].session_id);
        }
      }
      
      const clientId = await this.getOrGenerateSessionId(userId, forceNew);

      // Fermer proprement si déjà existant en mémoire
      const existingClient = this.sessions.get(userId);
      if (existingClient) {
        try { await existingClient.destroy(); } catch (e) {}
        this.sessions.delete(userId);
      }

      const client = new Client({
        authTimeoutMs: 60000,
        authStrategy: new LocalAuth({
          clientId: clientId,
          dataPath: this.sessionsDir
        }),
        puppeteer: {
          headless: true,
          args: PUPPETEER_ARGS
        }
      });

      this.sessions.set(userId, client);

      client.on('qr', (qr) => {
        this.setState(userId, 'WAITING_FOR_QR', { qr });
        console.log(`[WhatsAppSession][user=${userId}][QR] QR Code disponible.`);
      });

      client.on('authenticated', () => {
        this.setState(userId, 'AUTHENTICATED');
        console.log(`[WhatsAppSession][user=${userId}][AUTH] Authentifié avec succès.`);
      });

      client.on('ready', async () => {
        this.setState(userId, 'READY');
        const number = client.info.wid.user;
        await this.updateSessionStatus(userId, 'connected', number);
        console.log(`[WhatsAppSession][user=${userId}][READY] Session prête.`);
      });

      client.on('auth_failure', msg => {
        console.error(`[WhatsAppSession][user=${userId}][ERROR] Auth failure:`, msg);
        this.setState(userId, 'ERROR');
        this.scheduleDirectoryForDeletion(clientId); // Session corrompue
      });

      client.on('disconnected', async (reason) => {
        console.log(`[WhatsAppSession][user=${userId}] Déconnecté. Raison:`, reason);
        this.setState(userId, 'DISCONNECTED');
        this.sessions.delete(userId);
        await this.updateSessionStatus(userId, 'disconnected', null);
        // On planifie la suppression du dossier car la session est invalide
        this.scheduleDirectoryForDeletion(clientId);
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

      // Initialiser le client
      client.initialize().catch(err => {
         console.error(`[WhatsAppSession][user=${userId}] Erreur initialisation:`, err);
         this.setState(userId, 'ERROR');
      });

      return client;
    } finally {
      lock.unlock();
    }
  }

  async isAiEnabled(userId) {
    try {
      const [rows] = await pool.query('SELECT ai_enabled FROM wa_sessions WHERE user_id = ?', [userId]);
      return rows.length > 0 ? !!rows[0].ai_enabled : false;
    } catch(e) { return false; }
  }

  async resetIdleTimer(userId) {
    try {
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

      const timer = setTimeout(async () => {
        console.log(`[WhatsAppSession] Inactivité de 30 minutes pour user ${userId}, fermeture de Chromium...`);
        const lock = this.getLock(userId);
        await lock.lock();
        try {
            const client = this.sessions.get(userId);
            if (client) {
              try { await client.destroy(); } catch (e) {}
              this.sessions.delete(userId);
              this.setState(userId, 'DISCONNECTED');
            }
            this.idleTimers.delete(userId);
        } finally {
            lock.unlock();
        }
      }, 30 * 60 * 1000);

      this.idleTimers.set(userId, timer);
    } catch(e) { console.error('Erreur resetIdleTimer:', e); }
  }

  async ensureSessionReady(userId) {
    if (this.sessions.has(userId) && this.getState(userId) === 'READY') {
      this.resetIdleTimer(userId);
      return this.sessions.get(userId);
    }
    
    const [rows] = await pool.query('SELECT status FROM wa_sessions WHERE user_id = ?', [userId]);
    if (rows.length === 0 || rows[0].status !== 'connected') {
      throw new Error('Aucune session WhatsApp liée ou session déconnectée par l\'utilisateur.');
    }

    console.log(`[WhatsAppSession] Smart Wake-Up: Réveil de la session pour user ${userId}...`);
    
    await this.createSession(userId, false); // false = Ne pas forcer la suppression, on réutilise le session_id
    
    // Attendre que la session soit READY avec gestion du timeout
    try {
      await this.waitForState(userId, 'READY', 90000);
    } catch (error) {
      console.error(`[WhatsAppSession] Erreur lors du Smart Wake-Up pour user ${userId}:`, error.message);
      const client = this.sessions.get(userId);
      if (client) {
        try { await client.destroy(); } catch(e) {}
        this.sessions.delete(userId);
      }
      this.setState(userId, 'ERROR');
      throw error;
    }
    
    this.resetIdleTimer(userId);
    return this.sessions.get(userId);
  }

  /**
   * Stocker une commande en attente de confirmation (fallback sans ID de message)
   * @param {number} userId
   * @param {number} orderId    - ID DB interne
   * @param {string} orderNumber - N° commande complet (ORD-...)
   * @param {string} orderCode  - Code WhatsApp à 4 chiffres
   */
  setPendingOrder(userId, orderId, orderNumber, orderCode = null) {
    this.pendingOrders.set(userId, { orderId, orderNumber, orderCode, ts: Date.now() });
  }

  /**
   * Récupérer la dernière commande en attente pour cet utilisateur (max 30 min)
   * Retourne { orderId, orderNumber, orderCode } ou null
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
    return this.getState(userId) === 'READY';
  }

  async sendMessage(userId, to, text, contextInfo = null) {
    const client = await this.ensureSessionReady(userId);
    if (!client || !client.info) throw new Error('WhatsApp n\'est pas connecté');

    this.resetIdleTimer(userId);

    let chatId = to;
    let cleanNumber = to.replace(/[^0-9]/g, '');

    if (!chatId.includes('@')) {
      chatId = cleanNumber + '@c.us';
    }

    if (client.info && client.info.wid && cleanNumber === client.info.wid.user) {
      chatId = client.info.wid._serialized;
    } else if (!chatId.includes('@g.us')) {
      try {
        const numberId = await client.getNumberId(cleanNumber);
        if (numberId) chatId = numberId._serialized;
      } catch (err) {}
    }

    const sentMsg = await client.sendMessage(chatId, text);
    const orderId = contextInfo?.orderId || null;

    try {
      const messageId = sentMsg?.id?.id;
      
      if (!messageId) {
        console.warn('[WhatsApp] AVERTISSEMENT: ID du message envoyé introuvable.');
      } else {
        const typeToSave = contextInfo?.messageType || 'text';
        await pool.execute(
          `INSERT INTO wa_messages (user_id, message_id, remote_jid, direction, content, message_type, order_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [userId, messageId, chatId, 'outbound', text, typeToSave, orderId]
        );
      }
      
      if (orderId && contextInfo?.orderNumber) {
        const orderCode = contextInfo?.orderCode || null;
        this.setPendingOrder(userId, orderId, contextInfo.orderNumber, orderCode);
      }
    } catch (e) {
      console.error('Erreur sauvegarde message sortant:', e.message, e.sqlMessage);
    }

    return sentMsg;
  }

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
      const [rows] = await pool.query('SELECT session_id FROM wa_sessions WHERE user_id = ?', [userId]);
      const sessionId = rows.length > 0 ? rows[0].session_id : `user_${userId}_${Date.now()}`;
      
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
    const lock = this.getLock(userId);
    await lock.lock();
    try {
        const client = this.sessions.get(userId);
        if (client) {
            try { await client.logout(); } catch(e) {}
            try { await client.destroy(); } catch(e) {}
        }
        
        // Marquer le dossier pour suppression et l'enlever de la db
        const [rows] = await pool.query('SELECT session_id FROM wa_sessions WHERE user_id = ?', [userId]);
        if (rows.length > 0 && rows[0].session_id) {
            this.scheduleDirectoryForDeletion(rows[0].session_id);
        }

        this.sessions.delete(userId);
        this.setState(userId, 'DISCONNECTED');
        await this.updateSessionStatus(userId, 'disconnected', null);
    } finally {
        lock.unlock();
    }
  }

  async restoreAllSessions() {
    try {
      const [rows] = await pool.query("SELECT user_id FROM wa_sessions WHERE status = 'connected' AND ai_enabled = 1");
      
      console.log(`[WhatsAppSession] Restauration au démarrage de ${rows.length} session(s) avec IA active (H24)...`);
      for (const row of rows) {
        const userId = row.user_id;
        try {
          await this.createSession(userId, false);
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
    } catch (err) {
      console.error('Erreur getSessionStatus:', err);
      return null;
    }
  }

  /**
   * Vérifie si le vendeur est éligible à l'envoi automatique des commandes (Cas 4).
   * - Plan Business (ou Pro si autorisé, mais l'énoncé dit Business)
   * - Session WhatsApp READY
   */
  async canUseAutomaticWhatsAppOrder(userId) {
    try {
      // 1. Vérifier la session (doit être READY)
      if (!this.isSessionConnected(userId)) {
        return false;
      }
      
      // 2. Vérifier le plan du vendeur
      const [planAccess] = await pool.execute(
        `SELECT plan_name FROM v_user_plan_access 
         WHERE user_id = ? AND plan_name = 'Business' 
         AND (subscription_status = 'active' OR subscription_status = 'trial')`,
        [userId]
      );
      
      return planAccess.length > 0;
    } catch (err) {
      console.error('Erreur canUseAutomaticWhatsAppOrder:', err);
      return false;
    }
  }
}

module.exports = WhatsAppSessionManager;

