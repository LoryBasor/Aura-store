// src/controllers/authController.js
const { token } = require('morgan');
const authService = require('../services/authService');
const { successResponse, createdResponse } = require('../utils/response');

/**
 * Contrôleur d'authentification
 */
class AuthController {
  /**
   * Inscription d'un nouveau vendeur
   * POST /api/auth/register
   */
  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);
      
      return createdResponse(res, result, 'Inscription réussie');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Connexion
   * POST /api/auth/login
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      res.cookie('aura_token', result.token, {
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 70000000
      });
      return successResponse(res, result, 'Connexion réussie');
    } catch (error) {
      next(error); 
    }
  }

  /**
   * Récupérer le profil de l'utilisateur connecté
   * GET /api/auth/profile
   */
  async getProfile(req, res, next) {
    try {
      const profile = await authService.getUserProfile(req.user.id);
      
      return successResponse(res, { user: profile });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour le profil
   * PUT /api/auth/profile
   */
  async updateProfile(req, res, next) {
    try {
      const updatedProfile = await authService.updateProfile(req.user.id, req.body);
      
      return successResponse(res, { user: updatedProfile }, 'Profil mis à jour');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Changer le mot de passe
   * POST /api/auth/change-password
   */
  async changePassword(req, res, next) {
    try {
      const { old_password, new_password } = req.body;
      
      await authService.changePassword(req.user.id, old_password, new_password);
      
      return successResponse(res, null, 'Mot de passe modifié avec succès');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();