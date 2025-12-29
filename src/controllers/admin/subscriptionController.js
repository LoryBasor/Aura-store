// src/controllers/admin/subscriptionController.js
const subscriptionService = require('../../services/admin/subscriptionService');
const { successResponse, createdResponse } = require('../../utils/response');

/**
 * Contrôleur de gestion des abonnements (Super Admin)
 */
class AdminSubscriptionController {
  /**
   * Liste tous les plans
   * GET /api/admin/plans
   */
  async listPlans(req, res, next) {
    try {
      const { include_inactive } = req.query;
      
      const plans = await subscriptionService.listPlans({
        includeInactive: include_inactive === 'true'
      });
      
      return successResponse(res, { plans });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupère un plan par ID
   * GET /api/admin/plans/:id
   */
  async getPlan(req, res, next) {
    try {
      const plan = await subscriptionService.getPlanById(req.params.id);
      
      return successResponse(res, { plan });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Crée un abonnement pour un vendeur
   * POST /api/admin/subscriptions
   */
  async createSubscription(req, res, next) {
    try {
      const { user_id, plan_id, notes } = req.body;
      
      const subscription = await subscriptionService.createSubscription(
        user_id,
        plan_id,
        {
          notes,
          adminId: req.user.id
        }
      );
      
      req.auditNotes = `Abonnement créé: ${notes || ''}`;
      
      return createdResponse(
        res,
        { subscription },
        'Abonnement créé avec succès'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change le plan d'un vendeur
   * PUT /api/admin/subscriptions/:userId/plan
   */
  async changePlan(req, res, next) {
    try {
      const { new_plan_id } = req.body;
      
      const result = await subscriptionService.changePlan(
        req.params.userId,
        new_plan_id,
        req.user.id
      );
      
      return successResponse(
        res,
        result,
        `Plan ${result.action === 'upgraded' ? 'amélioré' : 'rétrogradé'} avec succès`
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Prolonge un abonnement
   * POST /api/admin/subscriptions/:userId/extend
   */
  async extendSubscription(req, res, next) {
    try {
      const { days } = req.body;
      
      const result = await subscriptionService.extendSubscription(
        req.params.userId,
        days,
        req.user.id
      );
      
      return successResponse(
        res,
        result,
        `Abonnement prolongé de ${days} jours`
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Annule un abonnement
   * POST /api/admin/subscriptions/:userId/cancel
   */
  async cancelSubscription(req, res, next) {
    try {
      const { reason } = req.body;
      
      await subscriptionService.cancelSubscription(
        req.params.userId,
        reason,
        req.user.id
      );
      
      req.auditNotes = `Annulation: ${reason}`;
      
      return successResponse(res, null, 'Abonnement annulé');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupère l'historique d'abonnement d'un vendeur
   * GET /api/admin/subscriptions/:userId/history
   */
  async getSubscriptionHistory(req, res, next) {
    try {
      const history = await subscriptionService.getSubscriptionHistory(
        req.params.userId
      );
      
      return successResponse(res, { history });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Statistiques globales des abonnements
   * GET /api/admin/subscriptions/stats
   */
  async getSubscriptionStats(req, res, next) {
    try {
      const stats = await subscriptionService.getSubscriptionStats();
      
      return successResponse(res, { stats });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminSubscriptionController();