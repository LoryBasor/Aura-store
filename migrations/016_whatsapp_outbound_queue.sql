-- ============================================
-- MIGRATION 016: WhatsApp Outbound Message Queue
-- Date: 2026-08-10
-- Description: Table pour gérer la file d'attente d'envoi de messages 
--              automatiques de confirmation de commande.
-- ============================================

USE aura_store_db;

CREATE TABLE IF NOT EXISTS wa_outbound_jobs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL, -- Vendeur
    customer_phone VARCHAR(50) NOT NULL,
    message_text TEXT NOT NULL,
    status ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED') DEFAULT 'PENDING',
    attempts INT DEFAULT 0,
    error_message TEXT,
    vendor_whatsapp_number VARCHAR(50),
    whatsapp_url TEXT, -- Fallback URL classique
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    sent_at TIMESTAMP NULL DEFAULT NULL,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_wa_outbound_status_user (status, user_id)
);
