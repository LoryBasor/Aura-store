-- ============================================
-- MIGRATION 015: Code Commande WhatsApp (4 chiffres)
-- Date: 2026-08-10
-- Description: Ajout d'un code opérationnel à 4 chiffres (order_code)
--              pour identifier les commandes via WhatsApp.
--              L'ID DB reste l'identifiant interne.
-- ============================================

USE aura_store_db;

-- 1. Ajouter la colonne order_code
ALTER TABLE orders
  ADD COLUMN order_code CHAR(4) NULL DEFAULT NULL
  AFTER order_number;

-- 2. Ajouter l'index composite
ALTER TABLE orders
  ADD INDEX idx_user_order_code (user_id, order_code);

-- 3. Backfill : attribuer un code à 4 chiffres aux commandes existantes
UPDATE orders
SET order_code = LPAD(MOD(id, 10000), 4, '0')
WHERE order_code IS NULL;

-- 4. Vérification
SELECT 
  COUNT(*) as total_orders,
  COUNT(order_code) as orders_with_code,
  COUNT(*) - COUNT(order_code) as orders_without_code
FROM orders;