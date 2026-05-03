// src/middlewares/validateRequest.js
const { errorResponse } = require('../utils/response');

/**
 * Middleware de validation des requêtes avec Joi
 * @param {object} schema - Schéma Joi de validation
 * @param {string} property - Propriété à valider (body, query, params)
 * @returns {function} Middleware Express
 */
function validateRequest(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Retourner toutes les erreurs
      stripUnknown: true // Supprimer les champs non définis dans le schéma
    });
    if (error) {
      console.error('❌ Validation Error:', {
        url: req.originalUrl,
        errors: error.details.map(d => d.message)
      });

      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return errorResponse(
        res,
        'Données de requête invalides : ' + error.message,
        400,
        errors
      );
    }

    // Remplacer les données validées et nettoyées
    req[property] = value;
    next();
  };
}

module.exports = validateRequest;