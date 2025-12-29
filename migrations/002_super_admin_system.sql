-- ============================================
-- MIGRATION 002: Système Super Admin
-- Date: 2025-01-XX
-- Description: Rôles, Plans, Abonnements, Audit
-- ============================================

-- 1. Modifier la table users pour ajouter le rôle
ALTER TABLE users 
ADD COLUMN role ENUM('USER', 'SUPER_ADMIN') DEFAULT 'USER' AFTER email,
ADD COLUMN account_status ENUM('active', 'suspended', 'deactivated') DEFAULT 'active' AFTER is_active,
ADD COLUMN suspended_reason TEXT NULL AFTER account_status,
ADD COLUMN suspended_at TIMESTAMP NULL AFTER suspended_reason,
ADD COLUMN last_login_at TIMESTAMP NULL AFTER suspended_at,
ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE AFTER last_login_at;

-- Index pour recherche rapide par rôle et statut
CREATE INDEX idx_role_status ON users(role, account_status);

-- ============================================
-- 2. Table des plans d'abonnement
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_plans (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'XAF',
    billing_cycle ENUM('monthly', 'quarterly', 'yearly') DEFAULT 'monthly',
    
    -- Limites du plan
    max_products INT DEFAULT -1 COMMENT '-1 = illimité',
    max_orders_per_month INT DEFAULT -1 COMMENT '-1 = illimité',
    max_storage_mb INT DEFAULT 100,
    
    -- Features activées
    has_analytics BOOLEAN DEFAULT FALSE,
    has_api_access BOOLEAN DEFAULT FALSE,
    has_priority_support BOOLEAN DEFAULT FALSE,
    has_custom_branding BOOLEAN DEFAULT FALSE,
    has_whatsapp_integration BOOLEAN DEFAULT FALSE,
    
    -- Durée essai gratuit
    trial_days INT DEFAULT 0,
    
    -- Statut du plan
    is_active BOOLEAN DEFAULT TRUE,
    is_public BOOLEAN DEFAULT TRUE COMMENT 'Visible pour inscription',
    
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_active_public (is_active, is_public),
    INDEX idx_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. Table des abonnements utilisateurs
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    plan_id INT UNSIGNED NOT NULL,
    
    status ENUM('trial', 'active', 'expired', 'cancelled', 'suspended') DEFAULT 'trial',
    
    -- Dates
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trial_ends_at TIMESTAMP NULL,
    current_period_start TIMESTAMP NULL,
    current_period_end TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    cancelled_at TIMESTAMP NULL,
    
    -- Informations de paiement (pour futur)
    payment_method VARCHAR(50) NULL COMMENT 'mobile_money, bank_transfer, etc',
    payment_reference VARCHAR(100) NULL,
    last_payment_at TIMESTAMP NULL,
    next_billing_date TIMESTAMP NULL,
    
    -- Compteurs usage mensuel (reset automatique)
    current_month_orders INT DEFAULT 0,
    usage_reset_at TIMESTAMP NULL,
    
    -- Notes admin
    notes TEXT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    
    INDEX idx_user_status (user_id, status),
    INDEX idx_expires_at (expires_at),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. Table d'historique des abonnements
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_history (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    subscription_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    plan_id INT UNSIGNED NOT NULL,
    
    action ENUM('created', 'upgraded', 'downgraded', 'renewed', 'cancelled', 'expired', 'suspended', 'resumed') NOT NULL,
    old_status VARCHAR(50) NULL,
    new_status VARCHAR(50) NULL,
    
    amount DECIMAL(10, 2) NULL,
    payment_method VARCHAR(50) NULL,
    
    performed_by INT UNSIGNED NULL COMMENT 'User ID qui a fait l\'action',
    notes TEXT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    
    INDEX idx_subscription (subscription_id),
    INDEX idx_user (user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. Table d'audit des actions admin
-- ============================================
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id INT UNSIGNED NOT NULL,
    
    action VARCHAR(100) NOT NULL COMMENT 'user.suspend, user.activate, subscription.change, etc',
    entity_type VARCHAR(50) NOT NULL COMMENT 'user, subscription, order, etc',
    entity_id INT UNSIGNED NULL,
    
    old_value TEXT NULL COMMENT 'JSON de l\'ancien état',
    new_value TEXT NULL COMMENT 'JSON du nouvel état',
    
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    
    notes TEXT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_admin (admin_id),
    INDEX idx_action (action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. Table des notifications système
-- ============================================
CREATE TABLE IF NOT EXISTS system_notifications (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    
    type ENUM('info', 'warning', 'error', 'success') DEFAULT 'info',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    
    action_url VARCHAR(500) NULL COMMENT 'Lien vers action',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_user_read (user_id, is_read),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- INSERTION DES PLANS PAR DÉFAUT
-- ============================================

INSERT INTO subscription_plans (name, slug, description, price, billing_cycle, max_products, max_orders_per_month, trial_days, display_order) VALUES
('Gratuit', 'free', 'Plan de démarrage pour tester la plateforme', 0.00, 'monthly', 5, 20, 7, 1),
('Pro', 'pro', 'Pour les vendeurs actifs', 5000.00, 'monthly', -1, -1, 14, 2),
('Business', 'business', 'Pour les entreprises en croissance', 15000.00, 'monthly', -1, -1, 14, 3);

-- Features pour plan Pro
UPDATE subscription_plans SET 
    has_analytics = TRUE,
    has_priority_support = TRUE,
    max_storage_mb = 500
WHERE slug = 'pro';

-- Features pour plan Business
UPDATE subscription_plans SET 
    has_analytics = TRUE,
    has_api_access = TRUE,
    has_priority_support = TRUE,
    has_custom_branding = TRUE,
    has_whatsapp_integration = TRUE,
    max_storage_mb = 2000
WHERE slug = 'business';

-- ============================================
-- TRIGGER : Reset compteur mensuel
-- ============================================
DELIMITER $$

CREATE TRIGGER reset_monthly_usage
BEFORE UPDATE ON subscriptions
FOR EACH ROW
BEGIN
    -- Si on est dans un nouveau mois, reset le compteur
    IF NEW.usage_reset_at IS NULL OR NEW.usage_reset_at < DATE_SUB(NOW(), INTERVAL 1 MONTH) THEN
        SET NEW.current_month_orders = 0;
        SET NEW.usage_reset_at = NOW();
    END IF;
END$$

DELIMITER ;

-- ============================================
-- VUES UTILES POUR REPORTING
-- ============================================

-- Vue : Abonnements actifs avec détails
CREATE OR REPLACE VIEW v_active_subscriptions AS
SELECT 
    s.id,
    s.user_id,
    u.email,
    u.business_name,
    sp.name as plan_name,
    sp.slug as plan_slug,
    s.status,
    s.current_period_end,
    s.expires_at,
    DATEDIFF(s.expires_at, NOW()) as days_remaining,
    s.current_month_orders,
    sp.max_orders_per_month,
    (SELECT COUNT(*) FROM products p WHERE p.user_id = s.user_id AND p.deleted_at IS NULL) as current_products,
    sp.max_products
FROM subscriptions s
JOIN users u ON s.user_id = u.id
JOIN subscription_plans sp ON s.plan_id = sp.id
WHERE s.status IN ('trial', 'active')
  AND u.deleted_at IS NULL;

-- Vue : Statistiques vendeurs
CREATE OR REPLACE VIEW v_vendor_stats AS
SELECT 
    u.id as user_id,
    u.email,
    u.business_name,
    u.account_status,
    s.status as subscription_status,
    sp.name as plan_name,
    (SELECT COUNT(*) FROM products p WHERE p.user_id = u.id AND p.deleted_at IS NULL) as total_products,
    (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.deleted_at IS NULL) as total_orders,
    (SELECT SUM(o.total_amount) FROM orders o WHERE o.user_id = u.id AND o.deleted_at IS NULL) as total_revenue,
    (SELECT COUNT(*) FROM customers c WHERE c.user_id = u.id AND c.deleted_at IS NULL) as total_customers,
    u.created_at,
    u.last_login_at
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status IN ('trial', 'active')
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
WHERE u.role = 'USER' AND u.deleted_at IS NULL;

COMMIT;