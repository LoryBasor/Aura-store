// src/config/constants.js

/**
 * Statuts de commande possibles
 */
const ORDER_STATUS = {
  NOUVELLE: 'nouvelle',
  CONFIRMEE: 'confirmee',
  EN_PREPARATION: 'en_preparation',
  EN_LIVRAISON: 'en_livraison',
  LIVREE: 'livree',
  ANNULEE: 'annulee'
};

/**
 * Devises supportées (Afrique francophone principalement)
 */
const CURRENCIES = {
  XAF: { code: 'XAF', symbol: 'FCFA', name: 'Franc CFA' },
  XOF: { code: 'XOF', symbol: 'FCFA', name: 'Franc CFA' },
  USD: { code: 'USD', symbol: '$', name: 'Dollar US' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro' }
};

/**
 * Rôles utilisateurs
 */
const USER_ROLES = {
  USER: 'USER',
  SUPER_ADMIN: 'SUPER_ADMIN'
};

/**
 * Statuts de compte utilisateur
 */
const ACCOUNT_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DEACTIVATED: 'deactivated'
};

/**
 * Statuts d'abonnement
 */
const SUBSCRIPTION_STATUS = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  SUSPENDED: 'suspended'
};

/**
 * Types d'actions admin (pour audit)
 */
const ADMIN_ACTIONS = {
  USER_SUSPEND: 'user.suspend',
  USER_ACTIVATE: 'user.activate',
  USER_DEACTIVATE: 'user.deactivate',
  USER_RESET_PASSWORD: 'user.reset_password',
  SUBSCRIPTION_CREATE: 'subscription.create',
  SUBSCRIPTION_CHANGE: 'subscription.change',
  SUBSCRIPTION_CANCEL: 'subscription.cancel',
  SUBSCRIPTION_SUSPEND: 'subscription.suspend',
  SUBSCRIPTION_RESUME: 'subscription.resume'
};

/**
 * Messages d'erreur standardisés
 */
const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Non autorisé',
  FORBIDDEN: 'Accès interdit',
  NOT_FOUND: 'Ressource introuvable',
  VALIDATION_ERROR: 'Données invalides',
  SERVER_ERROR: 'Erreur serveur',
  DUPLICATE_ENTRY: 'Cette entrée existe déjà',
  INVALID_CREDENTIALS: 'Identifiants incorrects'
};

/**
 * Codes de succès standardisés
 */
const SUCCESS_MESSAGES = {
  CREATED: 'Créé avec succès',
  UPDATED: 'Modifié avec succès',
  DELETED: 'Supprimé avec succès',
  LOGIN_SUCCESS: 'Connexion réussie',
  LOGOUT_SUCCESS: 'Déconnexion réussie'
};

/**
 * Configuration rate limiting
 */
const RATE_LIMITS = {
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20 // 5 tentatives max
  },
  API: {
    windowMs: 15 * 60 * 1000,
    max: 100
  },
  PUBLIC: {
    windowMs: 15 * 60 * 1000,
    max: 200 // Plus permissif pour les liens publics 
  }
};

/**
 * Pagination par défaut
 */
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100
};

module.exports = {
  ORDER_STATUS,
  CURRENCIES,
  USER_ROLES,
  SUBSCRIPTION_STATUS,
  ADMIN_ACTIONS,
  ACCOUNT_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  RATE_LIMITS,
  PAGINATION
};