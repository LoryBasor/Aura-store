/**
 * public/js/customization.js
 * ========================================
 * PAGE PERSONNALISATION BOUTIQUE (BUSINESS)
 * ========================================
 */

const CustomizationPage = {
  currentConfig: null,

  init() {
    if (!document.getElementById('customizationContainer')) return;
    setTimeout(() => {
      if (!PlanManager.hasAccess('customization')) {
        this.showAccessDenied();
        return;
      }
      this.loadCustomization();
    }, 1000);
    
    setTimeout(() => {
      this.attachEventListeners();
    }, 1000);

  },

  attachEventListeners() {
    // Form couleurs
    const colorsForm = document.getElementById('colorsForm');
    if (colorsForm) {
      colorsForm.addEventListener('submit', (e) => this.handleColorsSubmit(e));
    }

    // Form message
    const messageForm = document.getElementById('messageForm');
    if (messageForm) {
      messageForm.addEventListener('submit', (e) => this.handleMessageSubmit(e));
    }

    // Form options
    const optionsForm = document.getElementById('optionsForm');
    if (optionsForm) {
      optionsForm.addEventListener('submit', (e) => this.handleOptionsSubmit(e));
    }

    // Upload logo
    const logoInput = document.getElementById('logoUpload');
    if (logoInput) {
      logoInput.addEventListener('change', (e) => this.handleLogoUpload(e));
    }

    // Upload bannière
    const bannerInput = document.getElementById('bannerUpload');
    if (bannerInput) {
      bannerInput.addEventListener('change', (e) => this.handleBannerUpload(e));
    }

    // Réinitialiser
    const resetBtn = document.querySelector('[data-action="reset-customization"]');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetCustomization());
    }

    // Prévisualisation temps réel des couleurs
    ['primaryColor', 'secondaryColor', 'textColor'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('input', () => this.updatePreview());
      }
    });
  },

  async loadCustomization() {
    try {
      UI.showLoader();
      const data = await API.getCustomization();

      if (data && data.data && data.data.customization) {
        this.currentConfig = data.data.customization;
        this.renderCustomization();
      }

      UI.hideLoader();
    } catch (error) {
      UI.hideLoader();
      console.error('Erreur chargement personnalisation:', error);
    }
  },

  renderCustomization() {
    // Couleurs
    document.getElementById('primaryColor').value = this.currentConfig.primary_color || '#4F46E5';
    document.getElementById('secondaryColor').value = this.currentConfig.secondary_color || '#10B981';
    document.getElementById('textColor').value = this.currentConfig.text_color || '#1F2937';

    // Message
    document.getElementById('orderMessage').value = this.currentConfig.order_message || '';

    // Options
    document.getElementById('showProductCount').checked = this.currentConfig.show_product_count;
    document.getElementById('showSocialLinks').checked = this.currentConfig.show_social_links;
    document.getElementById('showContactInfo').checked = this.currentConfig.show_contact_info;

    // Logo
    if (this.currentConfig.logo_url) {
      document.getElementById('logoPreview').innerHTML = `
        <img src="${this.currentConfig.logo_url}" alt="Logo" style="max-width: 200px; border-radius: var(--radius-sm);">
      `;
      document.getElementById('deleteLogo').innerHTML = `
      <button type="button" class="btn btn-danger btn-sm" id="deleteLogoBtn" data-action="delete-logo" style="margin-top: 8px;">
          🗑️ Supprimer le logo
        </button>`;
      // Supprimer logo
        const deleteLogoBtn = document.querySelector('#deleteLogoBtn');
      if (deleteLogoBtn) {
        deleteLogoBtn.addEventListener('click', () => this.deleteLogo());
      }
    }

    // Bannière
    if (this.currentConfig.banner_url) {
      document.getElementById('bannerPreview').innerHTML = `
        <img src="${this.currentConfig.banner_url}" alt="Bannière" style="max-width: 100%; max-height: 200px; border-radius: var(--radius-sm);">
      `;
      document.getElementById('deleteBanner').innerHTML = `
      <button type="button" class="btn btn-danger btn-sm" data-action="delete-banner" style="margin-top: 8px;">
          🗑️ Supprimer la bannière
        </button>`;
      
      // Supprimer bannière
      const deleteBannerBtn = document.querySelector('[data-action="delete-banner"]');
      if (deleteBannerBtn) {

        deleteBannerBtn.addEventListener('click', () => this.deleteBanner());
      }
    }

    this.updatePreview();
  },

  updatePreview() {
    const primary = document.getElementById('primaryColor').value;
    const secondary = document.getElementById('secondaryColor').value;
    const text = document.getElementById('textColor').value;

    const preview = document.getElementById('storePreview');
    if (!preview) return;

    preview.innerHTML = `
      <div style="
        padding: 32px;
        background: linear-gradient(135deg, ${primary}, ${secondary});
        color: white;
        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
        text-align: center;
      ">
        <h2 style="font-size: 32px; font-weight: 700; margin-bottom: 8px;">Ma Boutique</h2>
        <p style="opacity: 0.9;">Aperçu de votre boutique personnalisée</p>
      </div>
      <div style="padding: 24px; background: white;">
        <div style="
          padding: 20px;
          background: #F9FAFB;
          border-radius: var(--radius-md);
          margin-bottom: 16px;
        ">
          <h3 style="font-size: 18px; font-weight: 700; color: ${text}; margin-bottom: 8px;">
            Produit Exemple
          </h3>
          <div style="font-size: 24px; font-weight: 700; color: ${primary};">
            15,000 FCFA
          </div>
        </div>
        <button style="
          width: 100%;
          padding: 16px;
          background: ${secondary};
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-weight: 700;
          cursor: pointer;
        ">
          Commander
        </button>
      </div>
    `;
  },

  async handleColorsSubmit(e) {
    e.preventDefault();

    const updates = {
      primary_color: document.getElementById('primaryColor').value,
      secondary_color: document.getElementById('secondaryColor').value,
      text_color: document.getElementById('textColor').value
    };

    try {
      await API.updateCustomization(updates);
      UI.showNotification('Succès', 'Couleurs mises à jour', 'success');
      this.loadCustomization();
    } catch (error) {
      console.error('Erreur mise à jour couleurs:', error);
    }
  },

  async handleMessageSubmit(e) {
    e.preventDefault();

    const updates = {
      order_message: document.getElementById('orderMessage').value
    };

    try {
      await API.updateCustomization(updates);
      UI.showNotification('Succès', 'Message mis à jour', 'success');
    } catch (error) {
      console.error('Erreur mise à jour message:', error);
    }
  },

  async handleOptionsSubmit(e) {
    e.preventDefault();

    const updates = {
      show_product_count: document.getElementById('showProductCount').checked,
      show_social_links: document.getElementById('showSocialLinks').checked,
      show_contact_info: document.getElementById('showContactInfo').checked
    };

    try {
      await API.updateCustomization(updates);
      UI.showNotification('Succès', 'Options mises à jour', 'success');
    } catch (error) {
      console.error('Erreur mise à jour options:', error);
    }
  },

  async handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('logo', file);

    try {
      await API.uploadLogo(formData);
      UI.showNotification('Succès', 'Logo uploadé', 'success');
      this.loadCustomization();
    } catch (error) {
      console.error('Erreur upload logo:', error);
    }
  },

  async handleBannerUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('banner', file);

    try {
      await API.uploadBanner(formData);
      UI.showNotification('Succès', 'Bannière uploadée', 'success');
      this.loadCustomization();
    } catch (error) {
      console.error('Erreur upload bannière:', error);
    }
  },

  async deleteLogo() {
    const confirmed = await UI.confirm(
      'Supprimer le logo',
      'Êtes-vous sûr de vouloir supprimer le logo ?'
    );

    if (confirmed) {
      try {
        await API.deleteLogo();
        UI.showNotification('Succès', 'Logo supprimé', 'success');
        this.loadCustomization();
      } catch (error) {
        console.error('Erreur suppression logo:', error);
      }
    }
  },

  async deleteBanner() {
    const confirmed = await UI.confirm(
      'Supprimer la bannière',
      'Êtes-vous sûr de vouloir supprimer la bannière ?'
    );

    if (confirmed) {
      try {
        await API.deleteBanner();
        UI.showNotification('Succès', 'Bannière supprimée', 'success');
        this.loadCustomization();
      } catch (error) {
        console.error('Erreur suppression bannière:', error);
      }
    }
  },

  async resetCustomization() {
    const confirmed = await UI.confirm(
      'Réinitialiser',
      'Êtes-vous sûr de vouloir réinitialiser toute la personnalisation ?'
    );

    if (confirmed) {
      try {
        await API.resetCustomization();
        UI.showNotification('Succès', 'Personnalisation réinitialisée', 'success');
        this.loadCustomization();
      } catch (error) {
        console.error('Erreur réinitialisation:', error);
      }
    }
  },

  showAccessDenied() {
    const container = document.getElementById('customizationContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 64px;">
        <div style="font-size: 64px; margin-bottom: 24px;">🔒</div>
        <h2 style="font-size: 28px; font-weight: 700; color: var(--color-primary); margin-bottom: 12px;">
          Fonctionnalité Business
        </h2>
        <p style="font-size: 16px; color: var(--color-secondary); margin-bottom: 32px;">
          La personnalisation de la boutique est réservée au plan Business.
        </p>
        <a href="/subscription" class="btn btn-primary btn-lg">
          🚀 Passer au plan Business
        </a>
      </div>
    `;
  }
};

window.CustomizationPage = CustomizationPage;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('customizationContainer')) {
    setTimeout(() => {
      CustomizationPage.init();
    }, 100);
  }
});