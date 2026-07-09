// src/controllers/reportController.js
const reportService = require('../services/reportService');
const { successResponse, createdResponse } = require('../utils/response');

class ReportController {
  /** POST /api/reports/product/:productId */
  async reportProduct(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress || '0.0.0.0';
      const result = await reportService.reportProduct(
        req.params.productId,
        ip,
        { reason: req.body.reason, description: req.body.description }
      );
      return createdResponse(res, result, 'Signalement enregistré. Merci pour votre vigilance.');
    } catch (error) { next(error); }
  }

  /** POST /api/reports/store/:vendorId */
  async reportStore(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress || '0.0.0.0';
      const result = await reportService.reportStore(
        req.params.vendorId,
        ip,
        { reason: req.body.reason, description: req.body.description }
      );
      return createdResponse(res, result, 'Signalement enregistré. Merci pour votre vigilance.');
    } catch (error) { next(error); }
  }

  /** GET /api/admin/reports/products */
  async getProductReports(req, res, next) {
    try {
      const result = await reportService.getProductReports({
        page: parseInt(req.query.page) || 1,
        status: req.query.status || null
      });
      return successResponse(res, result);
    } catch (error) { next(error); }
  }

  /** GET /api/admin/reports/stores */
  async getStoreReports(req, res, next) {
    try {
      const result = await reportService.getStoreReports({
        page: parseInt(req.query.page) || 1,
        status: req.query.status || null
      });
      return successResponse(res, result);
    } catch (error) { next(error); }
  }

  /** PUT /api/admin/reports/product/:id/status */
  async updateProductReportStatus(req, res, next) {
    try {
      const result = await reportService.updateReportStatus('product', req.params.id, req.body.status, req.user.id);
      return successResponse(res, result, 'Statut mis à jour');
    } catch (error) { next(error); }
  }

  /** PUT /api/admin/reports/store/:id/status */
  async updateStoreReportStatus(req, res, next) {
    try {
      const result = await reportService.updateReportStatus('store', req.params.id, req.body.status, req.user.id);
      return successResponse(res, result, 'Statut mis à jour');
    } catch (error) { next(error); }
  }
}

module.exports = new ReportController();
