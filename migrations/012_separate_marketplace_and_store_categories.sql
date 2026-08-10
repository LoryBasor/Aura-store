-- ============================================
-- MIGRATION 012: Séparation Catégories Marketplace et Boutique
-- Date: 2026-08-09
-- Description: Création de marketplace_categories et mise à jour de products
-- ============================================

-- ============================================

-- ============================================
-- 1. Table des catégories globales (Marketplace)
-- ============================================
CREATE TABLE IF NOT EXISTS marketplace_categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT NULL,
    icon VARCHAR(100) NULL,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    INDEX idx_marketplace_active (is_active),
    INDEX idx_marketplace_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. Ajouter la colonne marketplace_category_id aux produits
-- ============================================
-- On ajoute la colonne si elle n'existe pas
SET @dbname = DATABASE();
SET @tablename = 'products';
SET @columnname = 'marketplace_category_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE products ADD COLUMN marketplace_category_id INT UNSIGNED NULL AFTER category_id;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- On ajoute la clé étrangère si elle n'existe pas
SET @constraintname = 'fk_product_marketplace_category';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (constraint_name = @constraintname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE products ADD CONSTRAINT fk_product_marketplace_category FOREIGN KEY (marketplace_category_id) REFERENCES marketplace_categories(id) ON DELETE SET NULL;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- On ajoute l'index si il n'existe pas
SET @indexname = 'idx_marketplace_category';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE products ADD INDEX idx_marketplace_category (marketplace_category_id);"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;


-- ============================================
-- 3. Vue des catégories Marketplace avec compteur
-- ============================================
CREATE OR REPLACE VIEW v_marketplace_categories_with_count AS
SELECT 
    mc.id,
    mc.name,
    mc.slug,
    mc.description,
    mc.icon,
    mc.display_order,
    mc.is_active,
    COUNT(p.id) as product_count,
    COUNT(CASE WHEN p.is_available = 1 THEN 1 END) as available_products,
    mc.created_at,
    mc.updated_at
FROM marketplace_categories mc
LEFT JOIN products p ON mc.id = p.marketplace_category_id AND p.deleted_at IS NULL
WHERE mc.deleted_at IS NULL
GROUP BY mc.id
ORDER BY mc.display_order ASC, mc.name ASC;

-- ============================================
-- 4. Vue des catégories Vendeurs avec compteur (mise à jour)
-- ============================================
CREATE OR REPLACE VIEW v_categories_with_count AS
SELECT 
    c.id,
    c.user_id,
    c.name,
    c.slug,
    c.description,
    c.display_order,
    c.is_active,
    COUNT(p.id) as product_count,
    COUNT(CASE WHEN p.is_available = 1 THEN 1 END) as available_products,
    c.created_at,
    c.updated_at
FROM categories c
LEFT JOIN products p ON c.id = p.category_id AND p.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id
ORDER BY c.display_order ASC, c.name ASC;

-- ============================================
-- 5. Insertion de catégories Marketplace par défaut (optionnel mais utile)
-- ============================================
INSERT IGNORE INTO marketplace_categories (name, slug, icon, display_order) VALUES 
('Mode & Vêtements', 'mode-et-vetements', 'fa-tshirt', 1),
('Électronique', 'electronique', 'fa-laptop', 2),
('Beauté & Santé', 'beaute-et-sante', 'fa-heartbeat', 3),
('Maison & Décoration', 'maison-et-decoration', 'fa-home', 4),
('Alimentation', 'alimentation', 'fa-utensils', 5),
('Services', 'services', 'fa-concierge-bell', 6),
('Autres', 'autres', 'fa-box', 99);
