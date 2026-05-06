// src/utils/helpers.js
const crypto = require('crypto');

/**
 * Génère un slug URL-friendly à partir d'un texte
 * @param {string} text - Texte à slugifier
 * @returns {string} Slug généré
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // Décomposer les caractères accentués
    .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
    .replace(/[^a-z0-9]+/g, '-') // Remplacer caractères spéciaux par -
    .replace(/^-+|-+$/g, '') // Supprimer - au début/fin
    .substring(0, 100); // Limiter longueur
}

/**
 * Génère un token unique aléatoire
 * @param {number} length - Longueur du token
 * @returns {string} Token généré
 */
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Génère un numéro de commande unique
 * Format: ORD-YYYYMMDD-XXXX
 * @returns {string} Numéro de commande
 */
function generateOrderNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = crypto.randomBytes(2).toString('hex').toUpperCase();
  
  return `ORD-${year}${month}${day}-${random}`;
}

/**
 * Construit un message WhatsApp pour commander un produit
 * @param {object} product - Objet produit (name, price, currency)
 * @param {string} vendorPhone - Numéro WhatsApp du vendeur
 * @param {number} quantity - Quantité commandée
 * @param {string} customTemplate - Modèle de message personnalisé (optionnel)
 * @returns {string} URL WhatsApp avec message pré-rempli
 */
function buildWhatsAppOrderUrl(product, vendorPhone, quantity = 1, customTemplate = null) {
  let messageText = '';

  if (customTemplate) {
    messageText = customTemplate
      .replace(/{{product_name}}/g, product.name)
      .replace(/{{product_price}}/g, product.price.toLocaleString())
      .replace(/{{currency}}/g, product.currency || 'FCFA')
      .replace(/{{quantity}}/g, quantity);
  } else {
    messageText = 
      `Bonjour 👋\n\n` +
      `Je suis intéressé(e) par ce produit :\n` +
      `📦 ${product.name}\n` +
      `💰 ${product.price.toLocaleString()} ${product.currency || 'FCFA'}\n` +
      `🔢 Quantité : ${quantity}\n\n` +
      `Pouvez-vous me confirmer la disponibilité ?`;
  }
  
  const encodedMessage = encodeURIComponent(messageText);
  let cleanPhone = vendorPhone.replace(/[^\d]/g, '');
  
  // Si c'est un numéro à 9 chiffres (Cameroun), ajouter le code pays 237
  if (cleanPhone.length === 9) {
    cleanPhone = '237' + cleanPhone;
  }
  
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

/**
 * Construit un lien public de partage produit
 * @param {string} token - Token unique du produit
 * @returns {string} URL publique du produit
 */
function buildProductShareLink(token) {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  return `${baseUrl}/p/${token}`;
}

/**
 * Formate un montant avec séparateur de milliers
 * @param {number} amount - Montant
 * @param {string} currency - Code devise
 * @returns {string} Montant formaté
 */
function formatCurrency(amount, currency = 'FCFA') {
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
  
  return `${formatted} ${currency}`;
}

/**
 * Calcule l'offset pour la pagination SQL
 * @param {number} page - Numéro de page
 * @param {number} limit - Éléments par page
 * @returns {number} Offset SQL
 */
function calculateOffset(page, limit) {
  return (page - 1) * limit;
}

/**
 * Vérifie si un email est valide
 * @param {string} email - Email à vérifier
 * @returns {boolean}
 */
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Nettoie un numéro de téléphone
 * @param {string} phone - Numéro de téléphone
 * @returns {string} Numéro nettoyé
 */
function cleanPhoneNumber(phone) {
  return phone.replace(/[^\d+]/g, '');
}

/**
 * Génère un slug unique en ajoutant un suffix si collision
 * @param {string} baseSlug - Slug de base
 * @param {number} suffix - Suffix à ajouter
 * @returns {string} Slug unique
 */
function generateUniqueSlug(baseSlug, suffix = null) {
  if (suffix) {
    return `${baseSlug}-${suffix}`;
  }
  return baseSlug;
}

module.exports = {
  slugify,
  generateToken,
  generateOrderNumber,
  buildWhatsAppOrderUrl,
  buildProductShareLink,
  formatCurrency,
  calculateOffset,
  isValidEmail,
  cleanPhoneNumber,
  generateUniqueSlug
};