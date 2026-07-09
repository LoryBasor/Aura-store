// src/services/messagingService.js
// Messagerie vendeur ↔ administrateur + contact marketplace
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');
const notificationService = require('./notificationService');
const emailService = require('./emailService');

const ATTACHMENT_EXPIRY_DAYS = 30;

class MessagingService {
  // ─────────────────────────────────────
  // Conversations
  // ─────────────────────────────────────

  /**
   * Crée une nouvelle conversation (vendeur)
   */
  async createConversation(vendorId, subject, initialMessage = '') {
    if (!subject || subject.trim().length < 3) {
      throw new AppError('Le sujet doit contenir au moins 3 caractères.', 400);
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.execute(
        `INSERT INTO conversations (vendor_id, subject, source, last_message_at)
         VALUES (?, ?, 'vendor', NOW())`,
        [vendorId, subject.trim().substring(0, 255)]
      );

      const conversationId = result.insertId;

      if (initialMessage && initialMessage.trim()) {
        await connection.execute(
          `INSERT INTO messages (conversation_id, sender_id, sender_role, content)
           VALUES (?, ?, 'vendor', ?)`,
          [conversationId, vendorId, initialMessage.trim()]
        );
      }

      await connection.commit();
      
      // Notifier l'admin
      const [users] = await connection.execute('SELECT business_name FROM users WHERE id = ?', [vendorId]);
      const senderName = users[0]?.business_name || 'Un vendeur';
      const notificationService = require('./notificationService');
      const emailService = require('./emailService');
      
      await notificationService.createNotification(
        'new_conversation',
        `Nouveau ticket de ${senderName}`,
        `Sujet : "${subject}"`,
        conversationId,
        'conversation'
      );
      
      emailService.sendMessageNotificationToAdmin(senderName, subject)
        .catch(err => console.error('[MessagingService] Email:', err));

      return { success: true, conversationId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Crée une conversation depuis le marketplace (visiteur)
   */
  async createMarketplaceContact(visitorName, visitorEmail, messageContent) {
    if (!visitorName || !visitorEmail || !messageContent) {
      throw new AppError('Nom, email et message sont obligatoires.', 400);
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Créer la conversation
      const [convResult] = await connection.execute(
        `INSERT INTO conversations (visitor_name, visitor_email, subject, source, last_message_at)
         VALUES (?, ?, 'Contact depuis le marketplace', 'marketplace_contact', NOW())`,
        [visitorName.trim().substring(0, 255), visitorEmail.trim()]
      );

      const conversationId = convResult.insertId;

      // Créer le premier message
      await connection.execute(
        `INSERT INTO messages (conversation_id, sender_role, content)
         VALUES (?, 'visitor', ?)`,
        [conversationId, messageContent.trim()]
      );

      // Mettre à jour la conversation
      await connection.execute(
        'UPDATE conversations SET last_message_at = NOW() WHERE id = ?',
        [conversationId]
      );

      await connection.commit();

      // Notifications admin
      await notificationService.createNotification(
        'new_contact',
        `Contact marketplace : ${visitorName}`,
        `Un visiteur (${visitorEmail}) a envoyé un message depuis le marketplace.`,
        conversationId,
        'conversation'
      );

      emailService.sendMessageNotificationToAdmin(visitorName, 'Contact depuis le marketplace')
        .catch(err => console.error('[MessagingService] Email admin:', err));

      return { success: true, conversationId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Récupère les conversations d'un vendeur
   */
  async getVendorConversations(vendorId) {
    const [conversations] = await pool.execute(
      `SELECT c.*,
         (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.is_read = FALSE AND m.sender_role = 'admin') as unread_count,
         (SELECT m2.content FROM messages m2 WHERE m2.conversation_id = c.id ORDER BY m2.created_at DESC LIMIT 1) as last_message
       FROM conversations c
       WHERE c.vendor_id = ?
       ORDER BY c.last_message_at DESC`,
      [vendorId]
    );
    return conversations;
  }

  /**
   * Récupère toutes les conversations (admin) avec filtres
   */
  async getAllConversations({ page = 1, limit = 20, search = '', status = null } = {}) {
    const offset = (page - 1) * limit;
    let conditions = ['1=1'];
    let params = [];

    if (search) {
      conditions.push('(c.subject LIKE ? OR u.business_name LIKE ? OR c.visitor_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      conditions.push('c.status = ?');
      params.push(status);
    }

    const where = conditions.join(' AND ');

    const [conversations] = await pool.execute(
      `SELECT c.*,
         u.business_name, u.email as vendor_email,
         (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.is_read = FALSE AND m.sender_role IN ('vendor', 'visitor')) as unread_count,
         (SELECT m2.content FROM messages m2 WHERE m2.conversation_id = c.id ORDER BY m2.created_at DESC LIMIT 1) as last_message
       FROM conversations c
       LEFT JOIN users u ON c.vendor_id = u.id
       WHERE ${where}
       ORDER BY c.last_message_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const [count] = await pool.execute(
      `SELECT COUNT(*) as total,
         SUM(CASE WHEN (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.is_read = FALSE AND m.sender_role IN ('vendor', 'visitor')) > 0 THEN 1 ELSE 0 END) as unread_convs
       FROM conversations c LEFT JOIN users u ON c.vendor_id = u.id WHERE ${where}`,
      params
    );

    return {
      conversations,
      pagination: { page, limit, total: count[0].total },
      unreadConversations: count[0].unread_convs || 0
    };
  }

  // ─────────────────────────────────────
  // Messages
  // ─────────────────────────────────────

  /**
   * Récupère les messages d'une conversation
   */
  async getMessages(conversationId, userId = null, isAdmin = false) {
    // Vérifier l'accès
    const [convs] = await pool.execute(
      'SELECT * FROM conversations WHERE id = ?',
      [conversationId]
    );
    if (convs.length === 0) throw new AppError('Conversation introuvable.', 404);

    const conv = convs[0];
    if (!isAdmin && conv.vendor_id !== userId) {
      throw new AppError('Accès non autorisé.', 403);
    }

    // Marquer les messages comme lus
    const readerRole = isAdmin ? ['vendor', 'visitor'] : ['admin'];
    await pool.execute(
      `UPDATE messages SET is_read = TRUE, read_at = NOW()
       WHERE conversation_id = ? AND sender_role IN (${readerRole.map(() => '?').join(',')}) AND is_read = FALSE`,
      [conversationId, ...readerRole]
    );

    // Mettre à jour la date de dernière lecture
    if (isAdmin) {
      await pool.execute(
        'UPDATE conversations SET admin_last_read_at = NOW() WHERE id = ?',
        [conversationId]
      );
    } else {
      await pool.execute(
        'UPDATE conversations SET vendor_last_read_at = NOW() WHERE id = ?',
        [conversationId]
      );
    }

    const [messages] = await pool.execute(
      `SELECT m.*, u.business_name as sender_name,
         GROUP_CONCAT(
           CONCAT(ma.id, '||', ma.filename, '||', ma.file_path)
           SEPARATOR ';;'
         ) as attachments_raw
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       LEFT JOIN message_attachments ma ON m.id = ma.message_id AND ma.expires_at > NOW()
       WHERE m.conversation_id = ?
       GROUP BY m.id
       ORDER BY m.created_at ASC`,
      [conversationId]
    );

    // Parser les attachments
    return messages.map(msg => ({
      ...msg,
      attachments: msg.attachments_raw
        ? msg.attachments_raw.split(';;').filter(Boolean).map(a => {
            const [id, filename, file_path] = a.split('||');
            return { id: parseInt(id), filename, file_path };
          })
        : []
    }));
  }

  /**
   * Envoie un message dans une conversation
   */
  async sendMessage(conversationId, senderId, senderRole, content, files = []) {
    if (!content || !content.trim()) {
      throw new AppError('Le message ne peut pas être vide.', 400);
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [msgResult] = await connection.execute(
        `INSERT INTO messages (conversation_id, sender_id, sender_role, content)
         VALUES (?, ?, ?, ?)`,
        [conversationId, senderId, senderRole, content.trim()]
      );

      const messageId = msgResult.insertId;

      // Pièces jointes
      if (files && files.length > 0) {
        const expiresAt = new Date(Date.now() + ATTACHMENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
        for (const file of files) {
          await connection.execute(
            `INSERT INTO message_attachments (message_id, filename, stored_filename, file_path, file_size, mime_type, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              messageId,
              file.originalname,
              file.filename,
              `/uploads/messages/${file.filename}`,
              file.size,
              file.mimetype,
              expiresAt
            ]
          );
        }
      }

      // Mettre à jour last_message_at
      await connection.execute(
        'UPDATE conversations SET last_message_at = NOW() WHERE id = ?',
        [conversationId]
      );

      await connection.commit();

      // Notifier l'autre partie
      if (senderRole === 'vendor') {
        // Récupérer le nom du vendeur pour la notification
        const [users] = await pool.execute('SELECT business_name FROM users WHERE id = ?', [senderId]);
        const [convs] = await pool.execute('SELECT subject FROM conversations WHERE id = ?', [conversationId]);
        const senderName = users[0]?.business_name || 'Un vendeur';
        const subject = convs[0]?.subject || 'Sans sujet';

        await notificationService.createNotification(
          'new_message',
          `Nouveau message de ${senderName}`,
          `Réponse dans la conversation : "${subject}"`,
          conversationId,
          'conversation'
        );

        emailService.sendMessageNotificationToAdmin(senderName, subject)
          .catch(err => console.error('[MessagingService] Email:', err));
      }

      return { success: true, messageId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Ferme ou archive une conversation (admin)
   */
  async updateConversationStatus(conversationId, status) {
    await pool.execute(
      'UPDATE conversations SET status = ? WHERE id = ?',
      [status, conversationId]
    );
    return { success: true };
  }

  /**
   * Supprime les pièces jointes expirées (appelé par le cron)
   */
  async cleanupExpiredAttachments() {
    const [expired] = await pool.execute(
      'SELECT id, stored_filename, file_path FROM message_attachments WHERE expires_at < NOW()'
    );

    let deleted = 0;
    for (const attachment of expired) {
      try {
        const fullPath = path.join(__dirname, '../../', attachment.file_path);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
        await pool.execute('DELETE FROM message_attachments WHERE id = ?', [attachment.id]);
        deleted++;
      } catch (err) {
        console.error('[MessagingService] Erreur suppression pièce jointe:', err.message);
      }
    }

    return deleted;
  }
}

module.exports = new MessagingService();
