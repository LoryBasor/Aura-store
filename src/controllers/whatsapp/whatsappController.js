// src/controllers/whatsapp/whatsappController.js
const { pool } = require('../../config/database');
const WhatsAppSessionManager = require('../../services/whatsapp/WhatsAppSessionManager');
const { successResponse } = require('../../utils/response');
const { AppError } = require('../../middlewares/errorHandler');

class WhatsAppController {
  
  /**
   * Obtient le statut de la session ou génère un QR code
   */
  async getStatus(req, res, next) {
    try {
      const userId = req.user.id;
      const sessionManager = WhatsAppSessionManager.getInstance();
      const dbStatus = await sessionManager.getSessionStatus(userId);
      
      return successResponse(res, { 
        status: dbStatus?.status || (sessionManager.isSessionConnected(userId) ? 'connecting' : 'disconnected'), 
        number: dbStatus?.connected_number,
        lastSync: dbStatus?.last_sync
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Génère un nouveau QR Code
   */
  async generateQR(req, res, next) {
    try {
      const userId = req.user.id;
      const sessionManager = WhatsAppSessionManager.getInstance();
      
      let qrCode = await new Promise(async (resolve) => {
          let timeout = setTimeout(() => resolve(null), 10000);
          
          try {
              await sessionManager.createSession(userId, 
                  (qr) => { 
                      clearTimeout(timeout);
                      resolve(qr); 
                  },
                  () => console.log('Connecté'),
                  () => console.log('Déconnecté'),
                  true // forceNew = true
              );
          } catch (err) {
              clearTimeout(timeout);
              resolve(null);
          }
      });
      
      return successResponse(res, { status: 'connecting', qr: qrCode });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Génère un code d'appairage (pairing code) par numéro de téléphone
   */
  async generatePairingCode(req, res, next) {
    try {
      const userId = req.user.id;
      const { phone } = req.body;

      if (!phone) throw new AppError('Numéro de téléphone requis', 400);

      // Chiffres uniquement, sans +, sans espaces (ex: 237612345678)
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      if (cleanPhone.length < 8) throw new AppError('Numéro de téléphone invalide', 400);

      const sessionManager = WhatsAppSessionManager.getInstance();

      // createSessionWithPairingCode appelle requestPairingCode() immédiatement
      // après makeWASocket(), avant que WA n'envoie le QR — c'est la clé du succès
      const pairingCode = await sessionManager.createSessionWithPairingCode(userId, cleanPhone);

      return successResponse(res, { pairingCode });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Déconnecte la session WhatsApp
   */
  async disconnect(req, res, next) {
    try {
      const userId = req.user.id;
      const sessionManager = WhatsAppSessionManager.getInstance();
      
      sessionManager.deleteSession(userId);
      await sessionManager.updateSessionStatus(userId, 'disconnected', null);
      
      return successResponse(res, null, 'Session déconnectée avec succès');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupère les réponses automatiques
   */
  async getAutoReplies(req, res, next) {
    try {
      const [rows] = await pool.execute('SELECT * FROM wa_auto_replies WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
      return successResponse(res, { replies: rows });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Crée une nouvelle réponse automatique
   */
  async createAutoReply(req, res, next) {
    try {
      const { keyword, response } = req.body;
      if (!keyword || !response) throw new AppError('Mot-clé et réponse requis', 400);

      await pool.execute(
        'INSERT INTO wa_auto_replies (user_id, keyword, response) VALUES (?, ?, ?)',
        [req.user.id, keyword, response]
      );
      return successResponse(res, null, 'Réponse automatique créée');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Supprime une réponse automatique
   */
  async deleteAutoReply(req, res, next) {
    try {
      const { id } = req.params;
      await pool.execute('DELETE FROM wa_auto_replies WHERE id = ? AND user_id = ?', [id, req.user.id]);
      return successResponse(res, null, 'Réponse automatique supprimée');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Statistiques d'automatisation
   */
  async getStats(req, res, next) {
    try {
      const [msgStats] = await pool.execute(
        'SELECT direction, COUNT(*) as count FROM wa_messages WHERE user_id = ? GROUP BY direction',
        [req.user.id]
      );
      
      let sent = 0;
      let received = 0;
      msgStats.forEach(row => {
        if(row.direction === 'outbound') sent = row.count;
        if(row.direction === 'inbound') received = row.count;
      });

      const [autoReplies] = await pool.execute(
        'SELECT COUNT(*) as count FROM wa_auto_replies WHERE user_id = ? AND is_active = TRUE',
        [req.user.id]
      );

      return successResponse(res, { 
        messagesSent: sent, 
        messagesReceived: received,
        activeAutoReplies: autoReplies[0].count 
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Active ou désactive l'assistant IA pour cet utilisateur
   */
  async toggleAI(req, res, next) {
    try {
      const userId = req.user.id;
      const [rows] = await pool.execute('SELECT ai_enabled FROM wa_sessions WHERE user_id = ?', [userId]);

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Aucune session WhatsApp trouvée.' });
      }

      const newValue = rows[0].ai_enabled ? 0 : 1;
      await pool.execute('UPDATE wa_sessions SET ai_enabled = ? WHERE user_id = ?', [newValue, userId]);

      return successResponse(res, {
        ai_enabled: !!newValue,
        message: newValue ? 'Assistant IA activé.' : 'Assistant IA désactivé.'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Sauvegarde l'heure du résumé quotidien
   */
  async saveSummaryTime(req, res, next) {
    try {
      const { time } = req.body;
      const userId = req.user.id;

      if (!time || !/^\d{2}:\d{2}$/.test(time)) {
        return res.status(400).json({ success: false, error: 'Format d\'heure invalide (HH:MM)' });
      }

      await pool.execute('UPDATE wa_sessions SET summary_time = ? WHERE user_id = ?', [time, userId]);
      
      return successResponse(res, null, 'Heure sauvegardée avec succès');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WhatsAppController();
