// src/controllers/messagingController.js
const messagingService = require('../services/messagingService');
const { successResponse, createdResponse } = require('../utils/response');

class MessagingController {
  /** POST /api/messages/conversations — Vendeur crée une conversation */
  async createConversation(req, res, next) {
    try {
      const result = await messagingService.createConversation(req.user.id, req.body.subject, req.body.initial_message);
      return createdResponse(res, result, 'Conversation créée');
    } catch (error) { next(error); }
  }

  /** POST /api/contact — Visiteur envoie un message depuis le marketplace */
  async marketplaceContact(req, res, next) {
    try {
      const { name, email, message } = req.body;
      const result = await messagingService.createMarketplaceContact(name, email, message);
      return createdResponse(res, result, 'Message envoyé. Nous vous répondrons rapidement.');
    } catch (error) { next(error); }
  }

  /** GET /api/messages/conversations — Vendeur voit ses conversations */
  async getVendorConversations(req, res, next) {
    try {
      const convs = await messagingService.getVendorConversations(req.user.id);
      return successResponse(res, { conversations: convs });
    } catch (error) { next(error); }
  }

  /** GET /api/admin/messages/conversations — Admin voit toutes les conversations */
  async getAdminConversations(req, res, next) {
    try {
      const result = await messagingService.getAllConversations({
        page: parseInt(req.query.page) || 1,
        search: req.query.search || '',
        status: req.query.status || null
      });
      return successResponse(res, result);
    } catch (error) { next(error); }
  }

  /** GET /api/messages/conversations/:id — Messages d'une conversation (vendeur) */
  async getVendorMessages(req, res, next) {
    try {
      const messages = await messagingService.getMessages(
        req.params.id, req.user.id, false
      );
      return successResponse(res, { messages });
    } catch (error) { next(error); }
  }

  /** GET /api/admin/messages/conversations/:id — Messages d'une conversation (admin) */
  async getAdminMessages(req, res, next) {
    try {
      const messages = await messagingService.getMessages(
        req.params.id, req.user.id, true
      );
      return successResponse(res, { messages });
    } catch (error) { next(error); }
  }

  /** POST /api/messages/conversations/:id/send — Vendeur envoie un message */
  async sendVendorMessage(req, res, next) {
    try {
      const files = req.files || [];
      const result = await messagingService.sendMessage(
        req.params.id, req.user.id, 'vendor', req.body.content, files
      );
      return createdResponse(res, result, 'Message envoyé');
    } catch (error) { next(error); }
  }

  /** POST /api/admin/messages/conversations/:id/send — Admin envoie un message */
  async sendAdminMessage(req, res, next) {
    try {
      const files = req.files || [];
      const result = await messagingService.sendMessage(
        req.params.id, req.user.id, 'admin', req.body.content, files
      );
      return createdResponse(res, result, 'Réponse envoyée');
    } catch (error) { next(error); }
  }

  /** PUT /api/admin/messages/conversations/:id/status */
  async updateConversationStatus(req, res, next) {
    try {
      const result = await messagingService.updateConversationStatus(req.params.id, req.body.status);
      return successResponse(res, result, 'Statut mis à jour');
    } catch (error) { next(error); }
  }
}

module.exports = new MessagingController();
