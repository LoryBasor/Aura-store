// src/services/orderCodeService.js
const { pool } = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Statuts de commandes "actives" (le code ne peut pas être réutilisé)
 */
const ACTIVE_STATUSES = ['nouvelle', 'confirmee', 'en_preparation', 'en_livraison'];

/**
 * Statuts de commandes "libérées" (le code peut être récupéré en fallback)
 */
const RELEASED_STATUSES = ['livree', 'annulee'];

/**
 * Génère un code à 4 chiffres aléatoire (avec zéros initiaux conservés)
 * @returns {string} ex: "0007", "5831", "9999"
 */
function generateRandom4DigitCode() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

/**
 * Vérifie si un code est déjà utilisé par une commande ACTIVE de ce vendeur
 * @param {number} userId - ID du vendeur
 * @param {string} code - Code à vérifier
 * @returns {boolean} true si le code est déjà pris
 */
async function isCodeActiveForVendor(userId, code) {
  const placeholders = ACTIVE_STATUSES.map(() => '?').join(', ');
  const [rows] = await pool.execute(
    `SELECT id FROM orders
     WHERE user_id = ? AND order_code = ? AND status IN (${placeholders}) AND deleted_at IS NULL
     LIMIT 1`,
    [userId, code, ...ACTIVE_STATUSES]
  );
  return rows.length > 0;
}

/**
 * Service principal : génère et attribue un code à 4 chiffres unique
 * pour une commande active d'un vendeur donné.
 *
 * Algorithme :
 *  1. Générer un code aléatoire
 *  2. Vérifier sa disponibilité (max 10 tentatives)
 *  3. Fallback : récupérer le code d'une commande livrée/annulée de ce vendeur
 *  4. Si impossible → erreur métier claire
 *
 * @param {number} userId - ID du vendeur (boutique)
 * @returns {string} Code à 4 chiffres disponible
 * @throws {AppError} Si aucun code ne peut être attribué
 */
async function generateOrderCode(userId) {
  const MAX_ATTEMPTS = 10;

  // ── Tentatives aléatoires ──────────────────────────────────────────
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const code = generateRandom4DigitCode();
    const taken = await isCodeActiveForVendor(userId, code);

    if (!taken) {
      console.log(`[OrderCode] Code ${code} attribué (tentative ${attempt}/${MAX_ATTEMPTS})`);
      return code;
    }

    console.log(`[OrderCode] Tentative ${attempt}: code ${code} déjà actif pour le vendeur ${userId}`);
  }

  // ── Fallback : récupérer un code d'une commande livrée ou annulée ──
  console.log(`[OrderCode] 10 tentatives épuisées pour le vendeur ${userId}. Activation du fallback.`);

  const placeholders = RELEASED_STATUSES.map(() => '?').join(', ');
  const [releasedRows] = await pool.execute(
    `SELECT order_code FROM orders
     WHERE user_id = ? AND status IN (${placeholders}) AND order_code IS NOT NULL AND deleted_at IS NULL
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId, ...RELEASED_STATUSES]
  );

  if (releasedRows.length > 0) {
    const recycledCode = releasedRows[0].order_code;
    console.log(`[OrderCode] Fallback: code ${recycledCode} récupéré d'une commande terminée du vendeur ${userId}`);
    return recycledCode;
  }

  // ── Cas extrême : impossible d'attribuer un code ────────────────────
  console.error(`[OrderCode] Impossible d'attribuer un code pour le vendeur ${userId}`);
  throw new AppError(
    'Impossible d\'attribuer un code de commande. Veuillez réessayer dans quelques instants.',
    503
  );
}

module.exports = {
  generateOrderCode,
  generateRandom4DigitCode,
  isCodeActiveForVendor,
  ACTIVE_STATUSES,
  RELEASED_STATUSES
};
