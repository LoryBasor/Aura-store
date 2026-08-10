// src/utils/validators.js
const Joi = require('joi');

/**
 * Schémas de validation Joi pour toutes les entrées utilisateur
 * Prévient les injections SQL et garantit l'intégrité des données
 */

// Validation inscription utilisateur
const registerSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Email invalide',
      'any.required': 'Email requis'
    }),
  password: Joi.string()
    .min(8)
    .required()
    .messages({
      'string.min': 'Mot de passe minimum 8 caractères',
      'any.required': 'Mot de passe requis'
    }),
  business_name: Joi.string()
    .min(2)
    .max(255)
    .required()
    .messages({
      'string.min': 'Nom commercial minimum 2 caractères',
      'any.required': 'Nom commercial requis'
    }),
  phone: Joi.string()
    .pattern(/^\+\d(?:\s?\d){9,14}$/)
    .optional()
    .allow('', null)
    .messages({
      'string.pattern.base': 'Numéro de téléphone invalide'
    }),
  whatsapp_number: Joi.string()
    .pattern(/^\+\d(?:\s?\d){9,14}$/)
    .optional()
    .allow('', null)
});

// Validation connexion
const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required(),
  password: Joi.string()
    .required()
});

// Validation création/modification produit
const productSchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(255)
    .required()
    .messages({
      'string.min': 'Nom produit minimum 3 caractères',
      'any.required': 'Nom produit requis'
    }),
  description: Joi.string()
    .max(2000)
    .optional()
    .allow('', null),
  price: Joi.number()
    .positive()
    .precision(2)
    .required()
    .messages({
      'number.positive': 'Prix doit être positif',
      'any.required': 'Prix requis'
    }),
  currency: Joi.string()
    .valid('XAF', 'XOF', 'USD', 'EUR')
    .default('XAF'),
  category_id: Joi.number()
    .integer()
    .positive()
    .optional()
    .allow('', null),
  marketplace_category_id: Joi.number()
    .integer()
    .positive()
    .optional()
    .allow('', null),
  stock_quantity: Joi.number()
    .integer()
    .min(0)
    .optional()
    .allow('', null)
    .default(0),
  is_available: Joi.alternatives()
    .try(Joi.boolean(), Joi.string().valid('true', 'false'))
    .optional()
    .default(true),
  // Prix promotionnel (optionnel, validé en détail dans le contrôleur)
  promotionPrice: Joi.alternatives()
    .try(Joi.number().min(0), Joi.string().allow(''))
    .optional()
    .allow('', null),
  // Champs multi-médias (ignorés par la validation Joi, gérés par le contrôleur)
  retainedMediaIds: Joi.alternatives()
    .try(Joi.array().items(Joi.string()), Joi.string())
    .optional()
    .allow('', null),
  deleteVideo: Joi.alternatives()
    .try(Joi.boolean(), Joi.string())
    .optional()
    .allow('', null),
  productId: Joi.any().optional()
});

// Validation pagination
const paginationSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
});

const orderSchema = Joi.object({
  product_id: Joi.number()
    .integer()
    .positive()
    .required(),
  customer_name: Joi.string()
    .min(2)
    .max(255)
    .required()
    .messages({
      'any.required': 'Nom client requis'
    }),
  customer_phone: Joi.string()
    .pattern(/^\+\d(?:\s?\d){9,14}$/)
    .required()
    .messages({
      'string.pattern.base': 'Numéro de téléphone invalide',
      'any.required': 'Téléphone client requis'
    }),
  customer_address: Joi.string()
    .max(500)
    .optional()
    .allow('', null),
  quantity: Joi.number()
    .integer()
    .min(1)
    .default(1),
  notes: Joi.string()
    .max(1000)
    .optional()
    .allow('', null)
});

/**
 * ✨ NOUVEAU - Validation création commande manuelle (vendeur)
 */
const manualOrderSchema = Joi.object({
  product_id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'any.required': 'Produit requis'
    }),
  customer_name: Joi.string()
    .min(2)
    .max(255)
    .required()
    .messages({
      'any.required': 'Nom client requis',
      'string.min': 'Nom minimum 2 caractères'
    }),
  customer_phone: Joi.string()
    .pattern(/^\+\d(?:\s?\d){9,14}$/)
    .required()
    .messages({
      'string.pattern.base': 'Numéro de téléphone invalide',
      'any.required': 'Téléphone requis'
    }),
  customer_address: Joi.string()
    .max(500)
    .optional()
    .allow('', null),
  quantity: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .required()
    .messages({
      'any.required': 'Quantité requise',
      'number.min': 'Quantité minimum 1',
      'number.max': 'Quantité maximum 1000'
    }),
  notes: Joi.string()
    .max(1000)
    .optional()
    .allow('', null),
  status: Joi.string()
    .valid('nouvelle', 'confirmee', 'en_preparation', 'en_livraison', 'livree', 'annulee')
    .optional()
    .default('nouvelle')
});

/**
 * ✨ NOUVEAU - Validation mise à jour complète commande
 */
const updateOrderSchema = Joi.object({
  customer_name: Joi.string()
    .min(2)
    .max(255)
    .optional(),
  customer_phone: Joi.string()
    .pattern(/^\+\d(?:\s?\d){9,14}$/)
    .optional(),
  customer_address: Joi.string()
    .max(500)
    .optional()
    .allow('', null),
  quantity: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .optional(),
  notes: Joi.string()
    .max(1000)
    .optional()
    .allow('', null),
  status: Joi.string()
    .valid('nouvelle', 'confirmee', 'en_preparation', 'en_livraison', 'livree', 'annulee')
    .optional()
});

/**
 * Validation mise à jour statut commande
 */
const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid('nouvelle', 'confirmee', 'en_preparation', 'en_livraison', 'livree', 'annulee')
    .required()
});

module.exports = {
  registerSchema,
  loginSchema,
  productSchema, orderSchema,
  manualOrderSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
  paginationSchema
};