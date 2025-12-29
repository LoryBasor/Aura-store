// src/controllers/orderController.js
const orderService = require('../services/orderService');
const { successResponse, createdResponse } = require('../utils/response');

/**
 * Contrôleur de gestion des commandes
 */
class OrderController {
  /**
   * Créer une nouvelle commande (PUBLIC - depuis lien produit)
   * POST /api/orders
   */
  async createOrder(req, res, next) {
    try {
      const order = await orderService.createOrder(req.body);
      
      return createdResponse(
        res, 
        { order }, 
        'Commande créée avec succès. Le vendeur vous contactera bientôt !'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * ✨ NOUVEAU - Créer une commande manuellement (VENDEUR)
   * POST /api/orders/manual
   */
  async createManualOrder(req, res, next) {
    try {
      const order = await orderService.createManualOrder(req.user.id, req.body);
      
      return createdResponse(
        res,
        { order },
        'Commande créée avec succès'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupérer toutes les commandes du vendeur
   * GET /api/orders
   */
  async getOrders(req, res, next) {
    try {
      const { page, limit, status } = req.query;
      
      const result = await orderService.getOrdersByUser(req.user.id, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        status: status || null
      });
      
      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupérer une commande par ID
   * GET /api/orders/:id
   */
  async getOrder(req, res, next) {
    try {
      const order = await orderService.getOrderById(
        req.params.id,
        req.user.id
      );
      
      return successResponse(res, { order });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ✨ NOUVEAU - Mettre à jour complètement une commande
   * PUT /api/orders/:id
   */
  async updateOrder(req, res, next) {
    try {
      const order = await orderService.updateOrder(
        req.params.id,
        req.user.id,
        req.body
      );
      
      return successResponse(res, { order }, 'Commande mise à jour');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour le statut d'une commande
   * PATCH /api/orders/:id/status
   */
  async updateOrderStatus(req, res, next) {
    try {
      const { status } = req.body;
      
      const order = await orderService.updateOrderStatus(
        req.params.id,
        req.user.id,
        status
      );
      
      return successResponse(res, { order }, 'Statut mis à jour');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Supprimer une commande
   * DELETE /api/orders/:id
   */
  async deleteOrder(req, res, next) {
    try {
      await orderService.deleteOrder(req.params.id, req.user.id);
      
      return successResponse(res, null, 'Commande supprimée');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupérer les statistiques des commandes
   * GET /api/orders/stats
   */
  async getOrderStats(req, res, next) {
    try {
      const stats = await orderService.getOrderStats(req.user.id);
      
      return successResponse(res, { stats });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OrderController();
