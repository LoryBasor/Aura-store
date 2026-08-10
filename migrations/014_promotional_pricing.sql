-- ============================================
-- MIGRATION 014: Prix Promotionnels
-- Date: 2026-08-09
-- Description: Ajout du système de prix promotionnel pour les produits.
-- ============================================

USE aura_store_db;

-- Ajout de la colonne promotion_price dans la table products
-- Le type DECIMAL(10, 2) est utilisé pour correspondre à la colonne 'price' existante.
ALTER TABLE products 
ADD COLUMN promotion_price DECIMAL(10, 2) NULL AFTER price;

-- Mise à jour optionnelle : s'assurer que tous les anciens produits ont une valeur NULL
-- (Ceci est le comportement par défaut de ADD COLUMN NULL, mais il est toujours bon d'être explicite mentalement).

COMMIT;
