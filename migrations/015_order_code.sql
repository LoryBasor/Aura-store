-- ============================================
-- MIGRATION 015: Code Commande WhatsApp (4 chiffres)
-- Date: 2026-08-10
-- Description: Ajout d'un code opérationnel à 4 chiffres (order_code)
--              pour identifier les commandes via WhatsApp.
--              L'ID DB reste l'identifiant interne.
-- ============================================

USE aura_store_db;

-- Ajouter la colonne order_code (CHAR(4) pour préserver les zéros initiaux)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_code CHAR(4) NULL DEFAULT NULL
  AFTER order_number;

-- Index composite (user_id + order_code) pour la recherche WhatsApp performante
-- Ne pas rendre UNIQUE car le même code peut exister chez deux boutiques différentes
-- et peut être réutilisé après livraison
ALTER TABLE orders
  ADD INDEX IF NOT EXISTS idx_user_order_code (user_id, order_code);

-- Backfill : attribuer un code aléatoire à 4 chiffres aux commandes existantes
-- On utilise un code basé sur l'ID pour garantir l'unicité lors du backfill
-- (LPAD assure le formatage avec zéros initiaux)
UPDATE orders
SET order_code = LPAD(MOD(id, 10000), 4, '0')
WHERE order_code IS NULL;

-- Vérification
SELECT 
  COUNT(*) as total_orders,
  COUNT(order_code) as orders_with_code,
  COUNT(*) - COUNT(order_code) as orders_without_code
FROM orders;
