// src/utils/response.js

/**
 * Format standardisé pour les réponses API
 * Garantit la cohérence des réponses à travers toute l'application
 */

/**
 * Réponse de succès
 * @param {object} res - Objet response Express
 * @param {object} data - Données à retourner
 * @param {string} message - Message optionnel
 * @param {number} statusCode - Code HTTP (200 par défaut)
 */
function successResponse(res, data = null, message = 'Succès', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
}

/**
 * Réponse d'erreur
 * @param {object} res - Objet response Express
 * @param {string} message - Message d'erreur
 * @param {number} statusCode - Code HTTP (400 par défaut)
 * @param {object} errors - Détails des erreurs (validation, etc.)
 */
function errorResponse(res, message = 'Erreur', statusCode = 400, errors = null) {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
}

/**
 * Réponse paginée
 * @param {object} res - Objet response Express
 * @param {array} data - Données paginées
 * @param {object} pagination - Infos pagination
 */
function paginatedResponse(res, data, pagination) {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit)
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Réponse de création (201)
 * @param {object} res - Objet response Express
 * @param {object} data - Ressource créée
 * @param {string} message - Message optionnel
 */
function createdResponse(res, data, message = 'Créé avec succès') {
  return successResponse(res, data, message, 201);
}

/**
 * Réponse sans contenu (204)
 * @param {object} res - Objet response Express
 */
function noContentResponse(res) {
  return res.status(204).send();
}

/**
 * Réponse non autorisé (401)
 * @param {object} res - Objet response Express
 * @param {string} message - Message d'erreur
 */
function unauthorizedResponse(res, message = 'Non autorisé') {
  return errorResponse(res, message, 401);
}

/**
 * Réponse interdit (403)
 * @param {object} res - Objet response Express
 * @param {string} message - Message d'erreur
 */
function forbiddenResponse(res, message = 'Accès interdit') {
  return errorResponse(res, message, 403);
}

/**
 * Réponse non trouvé (404)
 * @param {object} res - Objet response Express
 * @param {string} message - Message d'erreur
 */
function notFoundResponse(res, message = 'Ressource introuvable') {
  return errorResponse(res, message, 404);
}

/**
 * Réponse erreur serveur (500)
 * @param {object} res - Objet response Express
 * @param {string} message - Message d'erreur
 */
function serverErrorResponse(res, message = 'Erreur serveur') {
  return errorResponse(res, message, 500);
}

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
  createdResponse,
  noContentResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  serverErrorResponse
};