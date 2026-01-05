/**
 * public/js/publicOrder.js
 * ========================================
 * Gestion des commandes côté client public
 * ========================================
 */

const PublicOrderManager = {
  currentProduct: null,
  storageKey: 'aura_customer_info',

  init() {
    setTimeout(() => {
        this.attachEventListeners();
        this.loadSavedCustomerInfo();
    }, 2000);
  },

  /**
   * Attache tous les événements nécessaires
   */
  attachEventListeners() {
    // Bouton "Commander via WhatsApp" modifié pour ouvrir le modal
    const whatsappBtn = document.querySelector('.whatsapp-btn');
    if (whatsappBtn) {
      // On remplace le comportement par défaut
      whatsappBtn.removeAttribute('href');
      whatsappBtn.removeAttribute('target');
      whatsappBtn.style.cursor = 'pointer';
      whatsappBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openOrderModal();
      });
    }

    // Fermeture du modal
    const closeBtn = document.getElementById('closeOrderModal');
    const cancelBtn = document.getElementById('cancelOrder');
    const overlay = document.getElementById('orderModalOverlay');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeOrderModal());
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.closeOrderModal());
    }

    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.closeOrderModal();
        }
      });
    }

    // Soumission du formulaire
    const form = document.getElementById('publicOrderForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleOrderSubmit(e));
    }

    // Calcul du total lors du changement de quantité
    const quantityInput = document.getElementById('clientQuantity');
    if (quantityInput) {
      quantityInput.addEventListener('input', () => this.updateOrderSummary());
    }
  },

  /**
   * Ouvre le modal de commande
   */
  openOrderModal() {
    // Récupérer les infos du produit depuis la page
    this.currentProduct = this.extractProductInfo();

    if (!this.currentProduct) {
      alert('Erreur : Impossible de récupérer les informations du produit');
      return;
    }

    // Remplir le résumé de commande
    this.updateOrderSummary();

    // Pré-remplir le formulaire si des infos sont sauvegardées
    this.fillFormWithSavedInfo();

    // Afficher le modal
    const modal = document.getElementById('orderModalOverlay');
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  },

  /**
   * Ferme le modal de commande
   */
  closeOrderModal() {
    const modal = document.getElementById('orderModalOverlay');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }

    // Reset le formulaire
    const form = document.getElementById('publicOrderForm');
    if (form) {
      form.reset();
    }

    // Reset les erreurs
    this.clearErrors();
  },

  /**
   * Extrait les informations du produit depuis la page
   */
  extractProductInfo() {
    const container = document.getElementById('productContainer');
    if (!container) return null;

    // Extraire depuis le DOM
    const titleEl = container.querySelector('.product-title');
    const priceEl = container.querySelector('.product-price');
    
    // Extraire l'ID produit depuis l'URL (format: /p/:token)
    const pathParts = window.location.pathname.split('/');
    const token = pathParts[pathParts.length - 1];

    return {
      name: titleEl ? titleEl.textContent.trim() : 'Produit',
      price: priceEl ? this.extractPrice(priceEl.textContent) : 0,
      currency: this.extractCurrency(priceEl ? priceEl.textContent : ''),
      token: token
    };
  },

  /**
   * Extrait le prix numérique d'une chaîne
   */
  extractPrice(priceText) {
    const match = priceText.match(/[\d\s,]+/);
    if (match) {
      return parseFloat(match[0].replace(/\s/g, '').replace(',', '.'));
    }
    return 0;
  },

  /**
   * Extrait la devise
   */
  extractCurrency(priceText) {
    if (priceText.includes('FCFA') || priceText.includes('XAF') || priceText.includes('XOF')) {
      return 'FCFA';
    }
    if (priceText.includes('$') || priceText.includes('USD')) {
      return 'USD';
    }
    if (priceText.includes('€') || priceText.includes('EUR')) {
      return 'EUR';
    }
    return 'FCFA';
  },

  /**
   * Met à jour le résumé de commande
   */
  updateOrderSummary() {
    const summaryDiv = document.getElementById('orderProductSummary');
    const quantityInput = document.getElementById('clientQuantity');

    if (!summaryDiv || !this.currentProduct || !quantityInput) return;

    const quantity = parseInt(quantityInput.value) || 1;
    const total = this.currentProduct.price * quantity;

    summaryDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <strong style="color: #253337;">📦 ${this.currentProduct.name}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 14px; color: #666; margin-bottom: 4px;">
        <span>Prix unitaire:</span>
        <span>${this.formatCurrency(this.currentProduct.price, this.currentProduct.currency)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 14px; color: #666; margin-bottom: 12px;">
        <span>Quantité:</span>
        <span>${quantity}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 2px solid #253337;">
        <strong style="font-size: 18px; color: #253337;">Total:</strong>
        <strong style="font-size: 20px; color: #253337;">${this.formatCurrency(total, this.currentProduct.currency)}</strong>
      </div>
    `;
  },

  /**
   * Formate une devise
   */
  formatCurrency(amount, currency = 'FCFA') {
    const formatted = new Intl.NumberFormat('fr-FR').format(amount);
    return `${formatted} ${currency}`;
  },

  /**
   * Charge les infos client sauvegardées
   */
  loadSavedCustomerInfo() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.savedInfo = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Erreur lecture localStorage:', error);
    }
  },

  /**
   * Pré-remplit le formulaire avec les infos sauvegardées
   */
  fillFormWithSavedInfo() {
    if (!this.savedInfo) return;

    const nameInput = document.getElementById('clientName');
    const phoneInput = document.getElementById('clientPhone');
    const addressInput = document.getElementById('clientAddress');
    const rememberCheckbox = document.getElementById('rememberMe');

    if (nameInput && this.savedInfo.name) {
      nameInput.value = this.savedInfo.name;
    }

    if (phoneInput && this.savedInfo.phone) {
      phoneInput.value = this.savedInfo.phone;
    }

    if (addressInput && this.savedInfo.address) {
      addressInput.value = this.savedInfo.address;
    }

    if (rememberCheckbox) {
      rememberCheckbox.checked = true;
    }
  },

  /**
   * Sauvegarde les infos client
   */
  saveCustomerInfo(name, phone, address) {
    try {
      const info = { name, phone, address };
      localStorage.setItem(this.storageKey, JSON.stringify(info));
      this.savedInfo = info;
    } catch (error) {
      console.error('Erreur sauvegarde localStorage:', error);
    }
  },

  /**
   * Supprime les infos client sauvegardées
   */
  clearCustomerInfo() {
    try {
      localStorage.removeItem(this.storageKey);
      this.savedInfo = null;
    } catch (error) {
      console.error('Erreur suppression localStorage:', error);
    }
  },

  /**
   * Valide le formulaire
   */
  validateForm() {
    this.clearErrors();

    let isValid = true;

    // Nom
    const nameInput = document.getElementById('clientName');
    if (!nameInput.value.trim() || nameInput.value.trim().length < 2) {
      this.showError('nameError', 'Le nom doit contenir au moins 2 caractères');
      nameInput.classList.add('error');
      isValid = false;
    }

    // Téléphone
    const phoneInput = document.getElementById('clientPhone');
    const phoneRegex = /^\+\d(?:\s?\d){9,14}$/;
    if (!phoneInput.value.trim() || !phoneRegex.test(phoneInput.value.trim())) {
      this.showError('phoneError', 'Numéro de téléphone invalide');
      phoneInput.classList.add('error');
      isValid = false;
    }

    // Quantité
    const quantityInput = document.getElementById('clientQuantity');
    const quantity = parseInt(quantityInput.value);
    if (!quantity || quantity < 1) {
      this.showError('quantityError', 'La quantité doit être au moins 1');
      quantityInput.classList.add('error');
      isValid = false;
    }

    return isValid;
  },

  /**
   * Affiche une erreur
   */
  showError(errorId, message) {
    const errorEl = document.getElementById(errorId);
    if (errorEl) {
      errorEl.textContent = message;
    }
  },

  /**
   * Efface toutes les erreurs
   */
  clearErrors() {
    const errorElements = document.querySelectorAll('.form-error');
    errorElements.forEach(el => el.textContent = '');

    const inputElements = document.querySelectorAll('.form-input, .form-textarea');
    inputElements.forEach(el => el.classList.remove('error'));
  },

  /**
   * Soumet la commande
   */
  async handleOrderSubmit(e) {
    e.preventDefault();

    // Validation
    if (!this.validateForm()) {
      return;
    }

    // Récupérer les données
    const formData = {
      product_token: this.currentProduct.token,
      customer_name: document.getElementById('clientName').value.trim(),
      customer_phone: document.getElementById('clientPhone').value.trim(),
      customer_address: document.getElementById('clientAddress').value.trim(),
      quantity: parseInt(document.getElementById('clientQuantity').value),
      notes: document.getElementById('clientNotes').value.trim()
    };

    // Gérer "Se souvenir de moi"
    const rememberMe = document.getElementById('rememberMe').checked;
    if (rememberMe) {
      this.saveCustomerInfo(
        formData.customer_name,
        formData.customer_phone,
        formData.customer_address
      );
    } else {
      this.clearCustomerInfo();
    }

    // Désactiver le bouton de soumission
    const submitBtn = document.getElementById('submitOrder');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Envoi en cours...';

    try {
      // Envoyer la commande
      const response = await fetch('/api/orders/public', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Succès
        this.closeOrderModal();
        this.showSuccessMessage(data.data.order);
      } else {
        // Erreur
        alert('❌ ' + (data.message || 'Erreur lors de la création de la commande'));
      }
    } catch (error) {
      console.error('Erreur soumission commande:', error);
      alert('❌ Une erreur est survenue. Veuillez réessayer.');
    } finally {
      // Réactiver le bouton
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  },
  

  getTokenFromURL() {
    const path = window.location.pathname;
    const match = path.match(/\/p\/([^\/]+)/);
    return match ? match[1] : null;
  },

  /**
   * Affiche un message de succès
   */
  async showSuccessMessage(order) {
    const token = this.getTokenFromURL();
    // Créer un overlay de succès
    const successOverlay = document.createElement('div');
    successOverlay.className = 'order-modal-overlay';
    successOverlay.style.display = 'flex';
    let dataResult = null;
    try {
      const response = await fetch(`/api/p/${token}`);
      const data = await response.json();
      if (data && data.data) {
        dataResult = data.data;
      } else {
        this.showError('Produit introuvable');
      }
    } catch (error) {
      console.error('Erreur chargement produit:', error);
      this.showError('Erreur lors du chargement');
    }
    const { product, customMessage } = dataResult.product;
    const { whatsapp_number } = product;
    let whatsapp_url = `https://wa.me/${whatsapp_number.split(' ').join('').replace('+','')}?text=`;
    let message = "Bonjour 👋 Je suis intéressé(e) par le produit {{product_name}} à {{product_price}} {{currency}}. Pouvez-vous me donner plus d'informations ?";
    if(customMessage !== null){
      const { custom_order_message } = customMessage;
      message = custom_order_message;
    }
    if(customMessage !== null){
      const { custom_order_message } = customMessage;
      message = custom_order_message;
    }
    whatsapp_url += encodeURI(message.replace('{{product_name}}', product.name).replace('{{product_price}}', product.price).replace('{{currency}}', product.currency).replace('{{quantity}}', product.stock_quantity));
    

    successOverlay.innerHTML = `
      <div class="order-modal" style="max-width: 500px; text-align: center;">
        <div class="order-modal-body" style="padding: 48px 24px;">
          <div style="font-size: 64px; margin-bottom: 24px;">✅</div>
          <h2 style="font-size: 28px; font-weight: 700; color: #253337; margin-bottom: 16px;">
            Commande confirmée !
          </h2>
          <p style="font-size: 16px; color: #666; margin-bottom: 24px;">
            Votre commande <strong>${order.order_number}</strong> a été enregistrée avec succès.
          </p>
          <p style="font-size: 15px; color: #666; margin-bottom: 32px;">
            Veuillez continuer pour finaliser la livraison.
          </p>
          <a href="${whatsapp_url}" class="whatsapp-btn" target="_blank"
            class="btn btn-primary" 
            style="width: 100%;"
          >
            👍 continuer sur whatsapp
          </a>
        </div>
      </div>
    `;

    document.body.appendChild(successOverlay);
    document.body.style.overflow = 'hidden';
  }
};

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
  PublicOrderManager.init();
});

// Export global
window.PublicOrderManager = PublicOrderManager;