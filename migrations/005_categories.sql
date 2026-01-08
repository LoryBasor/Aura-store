-- ============================================
-- MIGRATION 005: Système de catégories
-- Date: 2025-01-09
-- Description: Ajout des catégories par vendeur
-- ============================================

USE saas_vendor_db;

-- ============================================
-- 1. Table des catégories
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    description TEXT NULL,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_category (user_id, slug),
    INDEX idx_user_categories (user_id, is_active),
    INDEX idx_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. Ajouter la colonne category_id aux produits
-- ============================================
ALTER TABLE products 
ADD COLUMN category_id INT UNSIGNED NULL AFTER user_id,
ADD FOREIGN KEY fk_product_category (category_id) REFERENCES categories(id) ON DELETE SET NULL,
ADD INDEX idx_category (category_id);

-- ============================================
-- 3. Vue des catégories avec compteur de produits
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
