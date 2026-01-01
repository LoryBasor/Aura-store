-- ============================================
-- MIGRATION 003: Fonctionnalités par plan
-- Date: 2025-01-XX
-- Description: Tables pour personnalisation et intégrations
-- ============================================

USE defaultdb;

-- ============================================
-- 1. Table de personnalisation de la boutique
-- ============================================
CREATE TABLE IF NOT EXISTS store_customization (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL UNIQUE,
    
    -- Couleurs
    primary_color VARCHAR(7) DEFAULT '#253337',
    secondary_color VARCHAR(7) DEFAULT '#5C6C73',
    text_color VARCHAR(7) DEFAULT '#E0FCFC',
    
    -- Images
    logo_url VARCHAR(500) NULL,
    banner_url VARCHAR(500) NULL,
    
    -- Message de commande
    order_message TEXT DEFAULT 'Merci pour votre commande ! Nous vous contacterons bientôt.',
    
    -- Options d'affichage
    show_product_count BOOLEAN DEFAULT TRUE,
    show_social_links BOOLEAN DEFAULT TRUE,
    show_contact_info BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. Table des intégrations sociales
-- ============================================
CREATE TABLE IF NOT EXISTS social_integrations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL UNIQUE,
    
    -- WhatsApp
    whatsapp_number VARCHAR(20) NULL,
    whatsapp_enabled BOOLEAN DEFAULT FALSE,
    
    -- Instagram
    instagram_url VARCHAR(255) NULL,
    instagram_enabled BOOLEAN DEFAULT FALSE,
    
    -- Facebook
    facebook_url VARCHAR(255) NULL,
    facebook_enabled BOOLEAN DEFAULT FALSE,
    
    -- Message personnalisé pour les commandes
    custom_order_message TEXT DEFAULT 'Bonjour 👋 Je suis intéressé(e) par le produit {{product_name}} à {{product_price}} {{currency}}. Pouvez-vous me donner plus d\'informations ?',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. Vue des plans avec fonctionnalités
-- ============================================
CREATE OR REPLACE VIEW v_plan_features AS
SELECT 
    sp.id,
    sp.name,
    sp.slug,
    sp.price,
    sp.billing_cycle,
    
    -- Limites
    sp.max_products,
    sp.max_orders_per_month,
    sp.max_storage_mb,
    
    -- Features détaillées par plan
    CASE 
        WHEN sp.slug = 'free' THEN 'basic'
        WHEN sp.slug IN ('pro', 'business') THEN 'advanced'
        ELSE 'basic'
    END as stats_level,
    
    CASE 
        WHEN sp.slug IN ('pro', 'business') THEN TRUE
        ELSE FALSE
    END as can_export,
    
    CASE 
        WHEN sp.slug = 'business' THEN TRUE
        ELSE FALSE
    END as can_customize_store,
    
    CASE 
        WHEN sp.slug = 'business' THEN TRUE
        ELSE FALSE
    END as can_use_integrations,
    
    sp.has_analytics,
    sp.has_api_access,
    sp.has_priority_support,
    sp.has_custom_branding,
    sp.has_whatsapp_integration,
    
    sp.is_active,
    sp.is_public
FROM subscription_plans sp;

-- ============================================
-- 4. Vue des utilisateurs avec leurs accès
-- ============================================
CREATE OR REPLACE VIEW v_user_plan_access AS
SELECT 
    u.id as user_id,
    u.email,
    u.business_name,
    u.store_slug,
    sp.slug as plan_slug,
    sp.name as plan_name,
    s.status as subscription_status,
    
    -- Accès aux fonctionnalités
    CASE 
        WHEN sp.slug = 'free' THEN FALSE
        ELSE TRUE
    END as has_advanced_stats,
    
    CASE 
        WHEN sp.slug IN ('pro', 'business') THEN TRUE
        ELSE FALSE
    END as can_export_data,
    
    CASE 
        WHEN sp.slug = 'business' THEN TRUE
        ELSE FALSE
    END as can_customize,
    
    CASE 
        WHEN sp.slug = 'business' THEN TRUE
        ELSE FALSE
    END as can_use_social,
    
    -- Limites
    sp.max_products,
    sp.max_orders_per_month,
    (SELECT COUNT(*) FROM products p WHERE p.user_id = u.id AND p.deleted_at IS NULL) as current_products,
    s.current_month_orders,
    
    s.expires_at,
    DATEDIFF(s.expires_at, NOW()) as days_remaining
    
FROM users u
JOIN subscriptions s ON u.id = s.user_id AND s.status IN ('trial', 'active')
JOIN subscription_plans sp ON s.plan_id = sp.id
WHERE u.deleted_at IS NULL;

-- ============================================
-- INSERTION : Configuration par défaut pour utilisateur test
-- ============================================

-- Personnalisation pour l'utilisateur demo
INSERT INTO store_customization (user_id, primary_color, secondary_color, text_color)
SELECT id, '#253337', '#5C6C73', '#E0FCFC' 
FROM users 
WHERE email = 'demo@example.com'
ON DUPLICATE KEY UPDATE primary_color = primary_color;

COMMIT;