-- ============================================
-- MIGRATION 007: Vérification Vendeur & Localisation
-- Date: 2025-01-12
-- Description: Ajout champs is_verified, country, city
-- ============================================

-- Ajouter colonne is_verified pour la vérification par Super Admin
ALTER TABLE users 
ADD COLUMN is_verified BOOLEAN DEFAULT FALSE AFTER is_active,
ADD COLUMN verified_at TIMESTAMP NULL AFTER is_verified,
ADD COLUMN verified_by INT UNSIGNED NULL AFTER verified_at;

-- Index pour recherche rapide
CREATE INDEX idx_is_verified ON users(is_verified);
CREATE INDEX idx_country_city ON users(country, city);

-- Clé étrangère pour qui a vérifié
ALTER TABLE users 
ADD CONSTRAINT fk_verified_by FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;
