-- ============================================
-- MIGRATION 006: Support Marketplace
-- Date: 2026-01-12
-- Description: Ajout des colonnes ville et pays pour le marketplace
-- ============================================

USE defaultdb;

-- Ajouter les colonnes city et country à la table users
ALTER TABLE users
ADD COLUMN city VARCHAR(100) NULL AFTER whatsapp_number,
ADD COLUMN country VARCHAR(100) NULL AFTER city,
ADD INDEX idx_city (city),
ADD INDEX idx_country (country);

COMMIT;