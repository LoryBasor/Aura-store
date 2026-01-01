/**
 * public/js/integrations.js
 * ========================================
 * PAGE INTÉGRATIONS SOCIALES (BUSINESS)
 * ========================================
 */

const IntegrationsPage = {
  currentIntegrations: null,

  init() {
    if (!document.getElementById('integrationsContainer')) return;
    setTimeout(() => {
      if (!PlanManager.hasAccess('social_integrations')) {
        this.showAccessDenied();
        return;
      }
    }, 600);
    this.attachEventListeners();
    this.loadIntegrations();
  },

  attachEventListeners() {
    // Form WhatsApp
    const whatsappForm = document.getElementById('whatsappForm');
    if (whatsappForm) {
      whatsappForm.addEventListener('submit', (e) => this.handleWhatsAppSubmit(e));
    }

    // Toggle WhatsApp
    const whatsappToggle = document.getElementById('whatsappEnabled');
    if (whatsappToggle) {
      whatsappToggle.addEventListener('change', (e) => {
        API.toggleWhatsApp(e.target.checked);
      });
    }

    // Form Instagram
    const instagramForm = document.getElementById('instagramForm');
    if (instagramForm) {
      instagramForm.addEventListener('submit', (e) => this.handleInstagramSubmit(e));
    }

    // Toggle Instagram
    const instagramToggle = document.getElementById('instagramEnabled');
    if (instagramToggle) {
      instagramToggle.addEventListener('change', (e) => {
        API.toggleInstagram(e.target.checked);
      });
    }

    // Form Facebook
    const facebookForm = document.getElementById('facebookForm');
    if (facebookForm) {
      facebookForm.addEventListener('submit', (e) => this.handleFacebookSubmit(e));
    }

    // Toggle Facebook
    const facebookToggle = document.getElementById('facebookEnabled');
    if (facebookToggle) {
      facebookToggle.addEventListener('change', (e) => {
        API.toggleFacebook(e.target.checked);
      });
    }

    // Form message personnalisé
    const messageForm = document.getElementById('customMessageForm');
    if (messageForm) {
      messageForm.addEventListener('submit', (e) => this.handleMessageSubmit(e));
    }

    // Tester WhatsApp
    const testBtn = document.querySelector('[data-action="test-whatsapp"]');
    if (testBtn) {
      testBtn.addEventListener('click', () => this.testWhatsApp());
    }
  },

  async loadIntegrations() {
    try {
      UI.showLoader();
      const data = await API.getIntegrations();

      if (data && data.data && data.data.integrations) {
        this.currentIntegrations = data.data.integrations;
        this.renderIntegrations();
      }

      UI.hideLoader();
    } catch (error) {
      UI.hideLoader();
      console.error('Erreur chargement intégrations:', error);
    }
  },

  renderIntegrations() {
    // WhatsApp
    document.getElementById('whatsappNumber').value = this.currentIntegrations.whatsapp_number || '';
    document.getElementById('whatsappEnabled').checked = this.currentIntegrations.whatsapp_enabled;

    // Instagram
    document.getElementById('instagramUrl').value = this.currentIntegrations.instagram_url || '';
    document.getElementById('instagramEnabled').checked = this.currentIntegrations.instagram_enabled;

    // Facebook
    document.getElementById('facebookUrl').value = this.currentIntegrations.facebook_url || '';
    document.getElementById('facebookEnabled').checked = this.currentIntegrations.facebook_enabled;

    // Message personnalisé
    document.getElementById('customOrderMessage').value = 
      this.currentIntegrations.custom_order_message || 
      'Bonjour 👋 Je suis intéressé(e) par le produit {{product_name}} à {{product_price}} {{currency}}.';

    this.updateMessagePreview();
    this.updateStatusIndicators();
  },

  updateStatusIndicators() {
    // WhatsApp
    const whatsappStatus = document.getElementById('whatsappStatus');
    if (whatsappStatus) {
      whatsappStatus.innerHTML = this.currentIntegrations.whatsapp_enabled
        ? '<span class="badge badge-success">✅ Activé</span>'
        : '<span class="badge badge-neutral">⏸️ Désactivé</span>';
    }

    // Instagram
    const instagramStatus = document.getElementById('instagramStatus');
    if (instagramStatus) {
      instagramStatus.innerHTML = this.currentIntegrations.instagram_enabled
        ? '<span class="badge badge-success">✅ Activé</span>'
        : '<span class="badge badge-neutral">⏸️ Désactivé</span>';
    }

    // Facebook
    const facebookStatus = document.getElementById('facebookStatus');
    if (facebookStatus) {
      facebookStatus.innerHTML = this.currentIntegrations.facebook_enabled
        ? '<span class="badge badge-success">✅ Activé</span>'
        : '<span class="badge badge-neutral">⏸️ Désactivé</span>';
    }
  },

  async handleWhatsAppSubmit(e) {
    e.preventDefault();

    const updates = {
      whatsapp_number: document.getElementById('whatsappNumber').value,
      whatsapp_enabled: document.getElementById('whatsappEnabled').checked
    };

    try {
      await API.updateIntegrations(updates);
      UI.showNotification('Succès', 'WhatsApp mis à jour', 'success');
      this.loadIntegrations();
    } catch (error) {
      console.error('Erreur mise à jour WhatsApp:', error);
    }
  },

  async handleInstagramSubmit(e) {
    e.preventDefault();

    const updates = {
      instagram_url: document.getElementById('instagramUrl').value,
      instagram_enabled: document.getElementById('instagramEnabled').checked
    };

    try {
      await API.updateIntegrations(updates);
      UI.showNotification('Succès', 'Instagram mis à jour', 'success');
      this.loadIntegrations();
    } catch (error) {
      console.error('Erreur mise à jour Instagram:', error);
    }
  },

  async handleFacebookSubmit(e) {
    e.preventDefault();

    const updates = {
      facebook_url: document.getElementById('facebookUrl').value,
      facebook_enabled: document.getElementById('facebookEnabled').checked
    };

    try {
      await API.updateIntegrations(updates);
      UI.showNotification('Succès', 'Facebook mis à jour', 'success');
      this.loadIntegrations();
    } catch (error) {
      console.error('Erreur mise à jour Facebook:', error);
    }
  },

  async handleMessageSubmit(e) {
    e.preventDefault();

    const updates = {
      custom_order_message: document.getElementById('customOrderMessage').value
    };

    try {
      await API.updateIntegrations(updates);
      UI.showNotification('Succès', 'Message personnalisé mis à jour', 'success');
      // Prévisualisation message
    const messageInput = document.getElementById('customOrderMessage');
    if (messageInput) {
      this.updateMessagePreview();
    }
    } catch (error) {
      console.error('Erreur mise à jour message:', error);
    }
  },

  async testWhatsApp() {
    try {
      const data = await API.testWhatsAppMessage();

      if (data && data.data && data.data.test_url) {
        window.open(data.data.test_url, '_blank');
        UI.showNotification('Succès', 'Message de test généré', 'success');
      }
    } catch (error) {
      console.error('Erreur test WhatsApp:', error);
    }
  },

  async updateMessagePreview() {
    try {
      const data = await API.getMessagePreview();

      if (data && data.data && data.data.preview) {
        const preview = document.getElementById('messagePreview');
        if (preview) {
          preview.innerHTML = `
            <div style="
              padding: 16px;
              background: var(--color-surface);
              border-radius: var(--radius-md);
              border-left: 4px solid #25D366;
            ">
              <div style="font-size: 13px; color: var(--color-secondary); margin-bottom: 8px;">
                📱 Aperçu du message WhatsApp
              </div>
              <div style="white-space: pre-wrap; font-size: 14px; color: var(--color-primary);">
                ${data.data.preview}
              </div>
            </div>
          `;
        }
      }
    } catch (error) {
      console.error('Erreur prévisualisation:', error);
    }
  },

  showAccessDenied() {
    const container = document.getElementById('integrationsContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 64px;">
        <div style="font-size: 64px; margin-bottom: 24px;">🔒</div>
        <h2 style="font-size: 28px; font-weight: 700; color: var(--color-primary); margin-bottom: 12px;">
          Fonctionnalité Business
        </h2>
        <p style="font-size: 16px; color: var(--color-secondary); margin-bottom: 32px;">
          Les intégrations sociales sont réservées au plan Business.
        </p>
        <a href="/subscription" class="btn btn-primary btn-lg">
          🚀 Passer au plan Business
        </a>
      </div>
    `;
  }
};

window.IntegrationsPage = IntegrationsPage;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('integrationsContainer')) {
    setTimeout(() => {
      IntegrationsPage.init();
    }, 100);
  }
});