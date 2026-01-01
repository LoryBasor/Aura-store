// src/controllers/exportController.js
const exportService = require('../services/exportService');
const { successResponse } = require('../utils/response');

/**
 * Contrôleur d'export des données (PRO et BUSINESS)
 */
class ExportController {
  /**
   * Exporte les commandes en JSON
   * GET /api/export/orders/json
   */
  async exportOrdersJSON(req, res, next) {
    try {
      const data = await exportService.exportOrdersJSON(req.user.id);
      
      // Définir le nom du fichier
      const filename = `commandes_${req.user.business_name.replace(/\s+/g, '_')}_${Date.now()}.json`;
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      return res.status(200).json({
        success: true,
        data,
        exported_at: new Date().toISOString(),
        total: data.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Exporte les produits en JSON
   * GET /api/export/products/json
   */
  async exportProductsJSON(req, res, next) {
    try {
      const data = await exportService.exportProductsJSON(req.user.id);
      
      const filename = `produits_${req.user.business_name.replace(/\s+/g, '_')}_${Date.now()}.json`;
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      return res.status(200).json({
        success: true,
        data,
        exported_at: new Date().toISOString(),
        total: data.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Exporte les statistiques en JSON
   * GET /api/export/stats/json
   */
  async exportStatsJSON(req, res, next) {
    try {
      const data = await exportService.exportStatsJSON(req.user.id);
      
      const filename = `statistiques_${req.user.business_name.replace(/\s+/g, '_')}_${Date.now()}.json`;
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      return res.status(200).json({
        success: true,
        ...data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Exporte les commandes en Excel
   * GET /api/export/orders/excel
   */
  async exportOrdersExcel(req, res, next) {
    try {
      const workbook = await exportService.exportOrdersExcel(req.user.id);
      
      const filename = `commandes_${req.user.business_name.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
      
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Exporte les produits en Excel
   * GET /api/export/products/excel
   */
  async exportProductsExcel(req, res, next) {
    try {
      const workbook = await exportService.exportProductsExcel(req.user.id);
      
      const filename = `produits_${req.user.business_name.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
      
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ExportController();