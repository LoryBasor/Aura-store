// src/controllers/feedbackController.js
const feedbackService = require('../services/feedbackService');
const { successResponse, createdResponse } = require('../utils/response');

class FeedbackController {
  /**
   * POST /api/feedback — Vendeur connecté soumet un avis
   */
  async submitVendorFeedback(req, res, next) {
    try {
      const { rating, category, comment, suggestions } = req.body;
      const result = await feedbackService.createVendorFeedback(req.user.id, {
        rating: parseInt(rating),
        category,
        comment,
        suggestions
      });
      return createdResponse(res, result, 'Merci pour votre avis !');
    } catch (error) { next(error); }
  }

  /**
   * POST /api/feedback/marketplace — Visiteur marketplace soumet un avis
   */
  async submitMarketplaceFeedback(req, res, next) {
    try {
      const { rating, category, comment, suggestions } = req.body;
      const ip = req.ip || req.connection.remoteAddress || '0.0.0.0';
      const result = await feedbackService.createMarketplaceFeedback(ip, {
        rating: parseInt(rating),
        category,
        comment,
        suggestions
      });
      return createdResponse(res, result, 'Merci pour votre avis !');
    } catch (error) { next(error); }
  }

  /**
   * GET /api/admin/feedback — Admin consulte les avis
   */
  async getAdminFeedback(req, res, next) {
    try {
      const { page, rating, source, processed, dateFrom, dateTo } = req.query;
      const result = await feedbackService.getAllFeedback({
        page: parseInt(page) || 1,
        rating,
        source,
        processed,
        dateFrom,
        dateTo
      });
      return successResponse(res, result);
    } catch (error) { next(error); }
  }

  /**
   * PUT /api/admin/feedback/:id/process — Admin marque un avis comme traité
   */
  async markFeedbackProcessed(req, res, next) {
    try {
      const result = await feedbackService.markAsProcessed(req.params.id, req.user.id);
      return successResponse(res, result, 'Avis marqué comme traité');
    } catch (error) { next(error); }
  }
}

module.exports = new FeedbackController();
