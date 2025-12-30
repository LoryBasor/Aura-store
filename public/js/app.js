/**
 * public/js/app.js
 * ========================================
 * AURA - Module JavaScript Principal
 * ========================================
 * Gestion centralisée des événements avec addEventListener
 * ========================================
 */

// ========================================
// UTILITAIRES GLOBAUX
// ========================================
const AppUtils = {
  /**
   * Délégation d'événements pour les éléments dynamiques
   */
  delegate(element, eventType, selector, handler) {
    element.addEventListener(eventType, (e) => {
      const target = e.target.closest(selector);
      if (target) {
        handler.call(target, e);
      }
    });
  },

  /**
   * Attacher un événement avec vérification d'existence
   */
  on(selector, event, handler) {
    const element = document.querySelector(selector);
    if (element) {
      element.addEventListener(event, handler);
    }
  },

  /**
   * Attacher un événement à plusieurs éléments
   */
  onAll(selector, event, handler) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => el.addEventListener(event, handler));
  }
};

// ========================================
// GESTION DE LA SIDEBAR (MOBILE)
// ========================================
const SidebarManager = {
  init() {
    // Toggle sidebar mobile
    AppUtils.on('#mobileMenuBtn', 'click', this.toggleSidebar);
    
    // Fermer sidebar au clic sur overlay
    AppUtils.on('.sidebar-overlay', 'click', this.closeSidebar);
    
    // Responsive check
    window.addEventListener('resize', this.handleResize.bind(this));
  },

  toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.classList.toggle('active');
    }
  },

  closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.classList.remove('active');
    }
  },

  handleResize() {
    const mobileBtn = document.getElementById('mobileMenuBtn');
    if (mobileBtn) {
      mobileBtn.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
      mobileBtn.style.display = window.screenX <= 900 ? 'flex' : 'none';
    }
  }
};

// ========================================
// GESTION DES NOTIFICATIONS (HEADER)
// ========================================
const NotificationManager = {
  init() {
    AppUtils.on('.header-notification1', 'click', this.showNotifications);
  },

  showNotifications() {
    UI.showNotification('Notifications', 'Aucune nouvelle notification', 'info');
  }
};

// ========================================
// GESTION DE LA DÉCONNEXION
// ========================================
const AuthManager = {
  init() {
    AppUtils.onAll('.deco', 'click', this.handleLogout);
  },

  handleLogout(e) {
    e.preventDefault();
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
      API.logout();
    }
  }
};

// ========================================
// GESTION DES MODALS
// ========================================
const ModalManager = {
  init() {
    // Fermer les modals au clic sur overlay
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.closeModal(e.target);
      }
    });

    // Boutons de fermeture
    AppUtils.delegate(document, 'click', '.modal-close', (e) => {
      const modal = e.target.closest('.modal-overlay');
      if (modal) {
        this.closeModal(modal);
      }
    });
    AppUtils.delegate(document, 'click', '.annuler', (e) => {
      const modal = e.target.closest('.modal-overlay');
      if (modal) {
        this.closeModal(modal);
      }
    });
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  },

  closeModal(modalElement) {
    if (typeof modalElement === 'string') {
      modalElement = document.getElementById(modalElement);
    }
    if (modalElement) {
      modalElement.classList.remove('active');
    }
  }
};

// ========================================
// PAGE: LOGIN
// ========================================
const LoginPage = {
  init() {
    const form = document.getElementById('loginForm');
    if (!form) return;
    form.addEventListener('submit', this.handleSubmit.bind(this));
  },

  async handleSubmit(e) {
    e.preventDefault();

    // Reset erreurs
    document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.form-input').forEach(el => el.classList.remove('error'));

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Validation
    let hasError = false;

    if (!email || !email.includes('@')) {
      document.getElementById('emailError').textContent = 'Email invalide';
      document.getElementById('email').classList.add('error');
      hasError = true;
    }

    if (!password) {
      document.getElementById('passwordError').textContent = 'Mot de passe requis';
      document.getElementById('password').classList.add('error');
      hasError = true;
    }

    if (hasError) return;

    await API.login(email, password);
  }
};

// ========================================
// PAGE: REGISTER
// ========================================
const RegisterPage = {
  init() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    form.addEventListener('submit', this.handleSubmit.bind(this));
  },

  async handleSubmit(e) {
    e.preventDefault();

    // Reset erreurs
    document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.form-input').forEach(el => el.classList.remove('error'));

    const formData = {
      business_name: document.getElementById('business_name').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      whatsapp_number: document.getElementById('whatsapp_number').value.trim(),
      password: document.getElementById('password').value,
      confirm_password: document.getElementById('confirm_password').value
    };

    // Validation
    let hasError = false;

    if (!formData.business_name || formData.business_name.length < 2) {
      document.getElementById('businessNameError').textContent = 'Nom minimum 2 caractères';
      document.getElementById('business_name').classList.add('error');
      hasError = true;
    }

    if (!formData.email || !formData.email.includes('@')) {
      document.getElementById('emailError').textContent = 'Email invalide';
      document.getElementById('email').classList.add('error');
      hasError = true;
    }

    if (!formData.password || formData.password.length < 8) {
      document.getElementById('passwordError').textContent = 'Mot de passe minimum 8 caractères';
      document.getElementById('password').classList.add('error');
      hasError = true;
    }

    if (formData.password !== formData.confirm_password) {
      document.getElementById('confirmPasswordError').textContent = 'Les mots de passe ne correspondent pas';
      document.getElementById('confirm_password').classList.add('error');
      hasError = true;
    }

    if (hasError) return;

    delete formData.confirm_password;
    await API.register(formData);
  }
};

// ========================================
// PAGE: DASHBOARD
// ========================================
const DashboardPage = {
  init() {
    if (document.getElementById('statsGrid')) {
      this.loadDashboard();
    }
  },

  async loadDashboard() {
    try {
      const data = await API.getDashboard();
      
      if (data && data.data) {
        this.renderStats(data.data.overview);
        this.renderRecentOrders(data.data.recent_orders);
        this.renderTopProducts(data.data.top_products);
      }
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
    }
  },

  renderStats(stats) {
    const statsGrid = document.getElementById('statsGrid');
    if (!statsGrid) return;
    
    statsGrid.innerHTML = `
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Total Produits</span>
          <div class="stat-icon">📦</div>
        </div>
        <div class="stat-value">${stats.products.total || 0}</div>
        <div class="stat-change positive">${stats.products.available || 0} disponibles</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Commandes</span>
          <div class="stat-icon">🛒</div>
        </div>
        <div class="stat-value">${stats.orders.total || 0}</div>
        <div class="stat-change positive">+${stats.orders.this_month || 0} ce mois</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Chiffre d'affaires</span>
          <div class="stat-icon">💰</div>
        </div>
        <div class="stat-value">${UI.formatCurrency(stats.revenue.total || 0)}</div>
        <div class="stat-change positive">${UI.formatCurrency(stats.revenue.this_month || 0)} ce mois</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Clients</span>
          <div class="stat-icon">👥</div>
        </div>
        <div class="stat-value">${stats.customers.total || 0}</div>
        <div class="stat-change">${stats.customers.active_30_days || 0} actifs</div>
      </div>
    `;
  },

  renderRecentOrders(orders) {
    const container = document.getElementById('recentOrders');
    if (!container) return;
    
    if (!orders || orders.length === 0) {
      container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Aucune commande récente</p></div>';
      return;
    }

    const statusColors = {
      'nouvelle': 'info',
      'confirmee': 'success',
      'en_preparation': 'warning',
      'en_livraison': 'warning',
      'livree': 'success',
      'annulee': 'error'
    };

    const statusLabels = {
      'nouvelle': 'Nouvelle',
      'confirmee': 'Confirmée',
      'en_preparation': 'En préparation',
      'en_livraison': 'En livraison',
      'livree': 'Livrée',
      'annulee': 'Annulée'
    };

    container.innerHTML = `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>N° Commande</th>
              <th>Client</th>
              <th>Produit</th>
              <th>Montant</th>
              <th>Statut</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${orders.slice(0, 5).map(order => `
              <tr>
                <td><strong>${order.order_number}</strong></td>
                <td>${order.customer_name}</td>
                <td>${order.product_name}</td>
                <td>${UI.formatCurrency(order.total_amount)}</td>
                <td><span class="badge badge-${statusColors[order.status]}">${statusLabels[order.status]}</span></td>
                <td>${UI.formatRelativeDate(order.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderTopProducts(products) {
    const container = document.getElementById('topProducts');
    if (!container) return;
    
    if (!products || products.length === 0) {
      container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Aucun produit</p></div>';
      return;
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${products.slice(0, 5).map(product => `
          <div style="padding: 12px; background: var(--color-surface); border-radius: var(--radius-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong style="font-size: 14px; color: var(--color-primary);">${product.name}</strong>
              <span style="font-size: 13px; font-weight: 600; color: var(--color-secondary);">${product.order_count || 0} ventes</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; color: var(--color-secondary);">${UI.formatCurrency(product.price, product.currency)}</span>
              <span style="font-size: 12px; color: var(--color-tertiary);">${product.view_count || 0} vues</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
};

// ========================================
// PAGE: PRODUCTS
// ========================================
const ProductsPage = {
  currentPage: 1,
  currentFilter: 'undefined',

  init() {
    if (!document.getElementById('productsGrid')) return;

    // Charger les produits
    this.loadProducts();

    // Bouton nouveau produit
    AppUtils.on('[data-action="new-product"]', 'click', () => this.openProductModal());

    // Formulaire produit
    const form = document.getElementById('productForm');
    if (form) {
      form.addEventListener('submit', this.handleProductSubmit.bind(this));
    }

    // Preview image
    AppUtils.on('#image', 'change', this.handleImagePreview);

    // Recherche
    AppUtils.on('#searchInput', 'keyup', () => this.loadProducts(1, document.querySelector('#searchInput').value));

    // Filtre statut
    AppUtils.on('[data-filter="status"]', 'change', (e) => {
      this.currentFilter = e.target.value;
      this.loadProducts(1, '');
    });

    // Délégation pour actions sur produits
    AppUtils.delegate(document, 'click', '[data-action="edit-product"]', (e) => {
      const id = e.target.dataset.productId;
      this.editProduct(id);
    });

    AppUtils.delegate(document, 'click', '[data-action="delete-product"]', (e) => {
      const id = e.target.dataset.productId;
      this.deleteProduct(id);
    });

    AppUtils.delegate(document, 'click', '[data-action="copy-link"]', (e) => {
      const link = e.target.dataset.shareLink;
      this.copyShareLink(link);
    });
  },

  async loadProducts(page = 1, search) {
    this.currentPage = page;
    try {
      const data = await API.getProducts(page, search,1, this.currentFilter);
      
      if (data && data.data) {
        this.renderProducts(data.data.products);
        this.renderPagination(data.data.pagination);
      }
    } catch (error) {
      console.error('Erreur chargement produits:', error);
    }
  },

  renderProducts(products) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    if (!products || products.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">📦</div>
          <h3 class="empty-state-title">Aucun produit</h3>
          <p class="empty-state-text">Commencez par ajouter votre premier produit</p>
          <button class="btn btn-primary" data-action="new-product">Créer un produit</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = products.map(product => `
      <div class="card" style="padding: 0; overflow: hidden;">
        ${product.image_url ? 
          `<img src="${product.image_url}" alt="${product.name}" style="width: 100%; height: 200px; object-fit: cover;">` :
          `<div style="width: 100%; height: 200px; background: linear-gradient(135deg, var(--color-surface), var(--color-accent)); display: flex; align-items: center; justify-content: center; font-size: 48px;">📦</div>`
        }
        <div style="padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
            <h3 style="font-size: 18px; font-weight: 700; color: var(--color-primary); flex: 1;">${product.name}</h3>
            <span class="badge badge-${product.is_available ? 'success' : 'error'}" style="margin-left: 8px;">
              ${product.is_available ? 'Disponible' : 'Indisponible'}
            </span>
          </div>
          
          ${product.description ? 
            `<p style="font-size: 14px; color: var(--color-secondary); margin-bottom: 16px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${product.description}</p>` :
            ''
          }
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div>
              <div style="font-size: 24px; font-weight: 700; color: var(--color-primary);">${UI.formatCurrency(product.price, product.currency)}</div>
              ${product.stock_quantity > 0 ? 
                `<div style="font-size: 13px; color: var(--color-secondary);">Stock: ${product.stock_quantity}</div>` :
                ''
              }
            </div>
            <div style="text-align: right;">
              <div style="font-size: 13px; color: var(--color-secondary);">${product.order_count || 0} ventes</div>
              <div style="font-size: 13px; color: var(--color-tertiary);">${product.view_count || 0} vues</div>
            </div>
          </div>

          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary" style="flex: 1;" data-action="copy-link" data-share-link="${product.share_link}">
              📋 Copier lien
            </button>
            <button class="btn btn-primary" style="flex: 1;" data-action="edit-product" data-product-id="${product.id}">
              ✏️ Modifier
            </button>
            <button class="btn btn-danger" data-action="delete-product" data-product-id="${product.id}">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  renderPagination(pagination) {
    const container = document.getElementById('pagination');
    if (!container) return;
    
    const { page, totalPages } = pagination;
    
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '';
    
    if (page > 1) {
      html += `<button class="btn btn-secondary btn-sm" data-action="prev-page">← Précédent</button>`;
    }
    
    html += `<span style="padding: 8px 16px; color: var(--color-secondary);">Page ${page} sur ${totalPages}</span>`;
    
    if (page < totalPages) {
      html += `<button class="btn btn-secondary btn-sm" data-action="next-page">Suivant →</button>`;
    }
    
    container.innerHTML = html;

    // Attacher les événements de pagination
    AppUtils.on('[data-action="prev-page"]', 'click', () => this.loadProducts(this.currentPage - 1));
    AppUtils.on('[data-action="next-page"]', 'click', () => this.loadProducts(this.currentPage + 1));
  },

  openProductModal(productId = null) {
    const modal = document.getElementById('productModal');
    const form = document.getElementById('productForm');
    const title = document.getElementById('modalTitle');
    
    if (!modal) return;
    
    form.reset();
    document.getElementById('imagePreview').innerHTML = '';
    
    if (productId) {
      title.textContent = 'Modifier le produit';
      this.loadProductForEdit(productId);
    } else {
      title.textContent = 'Nouveau produit';
    }
    
    ModalManager.openModal('productModal');
  },

  async loadProductForEdit(id) {
    try {
      const data = await API.getProduct(id);
      if (data && data.data && data.data.product) {
        const product = data.data.product;
        document.getElementById('productId').value = product.id;
        document.getElementById('name').value = product.name;
        document.getElementById('description').value = product.description || '';
        document.getElementById('price').value = product.price;
        document.getElementById('currency').value = product.currency;
        document.getElementById('stock_quantity').value = product.stock_quantity;
        document.getElementById('is_available').value = product.is_available.toString();
        
        if (product.image_url) {
          document.getElementById('imagePreview').innerHTML = `
            <img src="${product.image_url}" alt="Image actuelle" style="max-width: 200px; border-radius: var(--radius-sm);">
          `;
        }
      }
    } catch (error) {
      console.error('Erreur chargement produit:', error);
    }
  },

  async handleProductSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData();
    const productId = document.getElementById('productId').value;
    
    formData.append('name', document.getElementById('name').value);
    formData.append('description', document.getElementById('description').value);
    formData.append('price', document.getElementById('price').value);
    formData.append('currency', document.getElementById('currency').value);
    formData.append('stock_quantity', document.getElementById('stock_quantity').value);
    formData.append('is_available', document.getElementById('is_available').value.toLowerCase() === 'true');
    
    const imageFile = document.getElementById('image').files[0];
    if (imageFile) {
      formData.append('image', imageFile);
    }
    
    try {
      const url = productId ? `/api/products/${productId}` : '/api/products';
      const method = productId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${API.getToken()}`
        },
        body: formData
      });
      
      const data = await response.json();
      
      if (data.success) {
        UI.showNotification('Succès', productId ? 'Produit modifié' : 'Produit créé', 'success');
        ModalManager.closeModal('productModal');
        this.loadProducts(this.currentPage);
      } else {
        UI.showNotification('Erreur', data.message, 'error');
      }
    } catch (error) {
      console.error('Erreur sauvegarde produit:', error);
      UI.showNotification('Erreur', 'Erreur lors de la sauvegarde', 'error');
    }
  },

  async deleteProduct(id) {
    const confirmed = await UI.confirm(
      'Supprimer le produit',
      'Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible.'
    );
    
    if (confirmed) {
      try {
        await API.deleteProduct(id);
        UI.showNotification('Succès', 'Produit supprimé', 'success');
        this.loadProducts(this.currentPage);
      } catch (error) {
        console.error('Erreur suppression produit:', error);
      }
    }
  },

  copyShareLink(link) {
    navigator.clipboard.writeText(link).then(() => {
      UI.showNotification('Copié !', 'Le lien de partage a été copié', 'success');
    });
  },

  handleImagePreview(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        document.getElementById('imagePreview').innerHTML = `
          <img src="${event.target.result}" alt="Aperçu" style="max-width: 200px; border-radius: var(--radius-sm);">
        `;
      };
      reader.readAsDataURL(file);
    }
  },

  editProduct(id) {
    this.openProductModal(id);
  }
};

// ========================================
// PAGE: ORDERS
// ========================================
const OrdersPage = {
  currentPage: 1,
  currentStatus: null,

  init() {
    if (!document.getElementById('ordersTableBody')) return;

    this.loadOrders();
    this.loadOrderStats();

    // Filtre statut
    AppUtils.on('[data-filter="order-status"]', 'change', (e) => {
      this.currentStatus = e.target.value || null;
      this.loadOrders(1);
    });

    // Recherche
    AppUtils.on('#searchInput', 'keyup', () => this.loadOrders(1));

    // Formulaire changement statut
    const statusForm = document.getElementById('statusForm');
    if (statusForm) {
      statusForm.addEventListener('submit', this.handleStatusChange.bind(this));
    }

    // Délégation événements
    AppUtils.delegate(document, 'click', '[data-action="view-order"]', (e) => {
      this.viewOrderDetails(e.target.dataset.orderId);
    });

    AppUtils.delegate(document, 'click', '[data-action="change-status"]', (e) => {
      this.openStatusModal(e.target.dataset.orderId, e.target.dataset.currentStatus);
    });

    AppUtils.delegate(document, 'click', '[data-action="contact-customer"]', (e) => {
      this.contactCustomer(e.target.dataset.phone);
    });
  },

  async loadOrders(page = 1) {
    this.currentPage = page;
    try {
      const data = await API.getOrders(page, 20, this.currentStatus);
      
      if (data && data.data) {
        this.renderOrdersTable(data.data.orders);
        this.renderPagination(data.data.pagination);
      }
    } catch (error) {
      console.error('Erreur chargement commandes:', error);
    }
  },

  async loadOrderStats() {
    try {
      const data = await API.getOrderStats();
      
      if (data && data.data && data.data.stats) {
        this.renderOrderStats(data.data.stats);
      }
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
  },

  renderOrderStats(stats) {
    const container = document.getElementById('orderStats');
    if (!container) return;
    
    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Total Commandes</span>
          <div class="stat-icon">📦</div>
        </div>
        <div class="stat-value">${stats.total_orders || 0}</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Nouvelles</span>
          <div class="stat-icon">🆕</div>
        </div>
        <div class="stat-value">${stats.nouvelles || 0}</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">En cours</span>
          <div class="stat-icon">🔄</div>
        </div>
        <div class="stat-value">${(stats.confirmees || 0) + (stats.en_preparation || 0) + (stats.en_livraison || 0)}</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Livrées</span>
          <div class="stat-icon">✅</div>
        </div>
        <div class="stat-value">${stats.livrees || 0}</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Chiffre d'affaires</span>
          <div class="stat-icon">💰</div>
        </div>
        <div class="stat-value">${UI.formatCurrency(stats.total_revenue || 0)}</div>
      </div>
    `;
  },

  renderOrdersTable(orders) {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;
    
    if (!orders || orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 48px;">
            <div class="empty-state">
              <div class="empty-state-icon">📦</div>
              <h3 class="empty-state-title">Aucune commande</h3>
              <p class="empty-state-text">Les commandes apparaîtront ici</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const statusColors = {
      'nouvelle': 'info',
      'confirmee': 'success',
      'en_preparation': 'warning',
      'en_livraison': 'warning',
      'livree': 'success',
      'annulee': 'error'
    };

    const statusIcons = {
      'nouvelle': '🆕',
      'confirmee': '✅',
      'en_preparation': '👨‍🍳',
      'en_livraison': '🚚',
      'livree': '📦',
      'annulee': '❌'
    };

    const statusLabels = {
      'nouvelle': 'Nouvelle',
      'confirmee': 'Confirmée',
      'en_preparation': 'En préparation',
      'en_livraison': 'En livraison',
      'livree': 'Livrée',
      'annulee': 'Annulée'
    };

    tbody.innerHTML = orders.map(order => `
      <tr>
        <td><strong style="color: var(--color-primary);">${order.order_number}</strong></td>
        <td style="font-size: 13px; color: var(--color-secondary);">${UI.formatRelativeDate(order.created_at)}</td>
        <td>
          <div style="font-weight: 600;">${order.customer_name}</div>
          <div style="font-size: 13px; color: var(--color-secondary);">${order.customer_phone}</div>
        </td>
        <td>
          <div style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${order.product_name}
          </div>
        </td>
        <td style="text-align: right; font-weight: 600;">${order.quantity}</td>
        <td style="text-align: right; font-weight: 700; color: var(--color-primary);">
          ${UI.formatCurrency(order.total_amount)}
        </td>
        <td>
          <span class="badge badge-${statusColors[order.status]}">
            ${statusIcons[order.status]} ${statusLabels[order.status]}
          </span>
        </td>
        <td>
          <div class="table-actions">
            <button class="table-action-btn" data-action="view-order" data-order-id="${order.id}" title="Voir détails">👁️</button>
            <button class="table-action-btn" data-action="change-status" data-order-id="${order.id}" data-current-status="${order.status}" title="Changer statut">🔄</button>
            <button class="table-action-btn" data-action="contact-customer" data-phone="${order.customer_phone}" title="Contacter">💬</button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  renderPagination(pagination) {
    const container = document.getElementById('pagination');
    if (!container) return;
    
    const { page, totalPages, total } = pagination;
    
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '';
    
    if (page > 1) {
      html += `<button class="btn btn-secondary btn-sm" data-action="prev-page-orders">← Précédent</button>`;
    }
    
    html += `<span style="padding: 8px 16px; color: var(--color-secondary);">Page ${page} sur ${totalPages} (${total} commandes)</span>`;
    
    if (page < totalPages) {
      html += `<button class="btn btn-secondary btn-sm" data-action="next-page-orders">Suivant →</button>`;
    }
    
    container.innerHTML = html;

    AppUtils.on('[data-action="prev-page-orders"]', 'click', () => this.loadOrders(this.currentPage - 1));
    AppUtils.on('[data-action="next-page-orders"]', 'click', () => this.loadOrders(this.currentPage + 1));
  },

  async viewOrderDetails(id) {
    try {
      const data = await API.getOrder(id);
      
      if (data && data.data && data.data.order) {
        const order = data.data.order;
        const modal = document.getElementById('orderDetailsModal');
        const body = document.getElementById('orderDetailsBody');

        const statusColors = {
          'nouvelle': 'info',
          'confirmee': 'success',
          'en_preparation': 'warning',
          'en_livraison': 'warning',
          'livree': 'success',
          'annulee': 'error'
        };

        body.innerHTML = `
          <div style="display: grid; gap: 24px;">
            <div style="padding: 20px; background: linear-gradient(135deg, var(--color-accent), var(--color-surface)); border-radius: var(--radius-md);">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                <div>
                  <div style="font-size: 13px; color: var(--color-secondary); margin-bottom: 4px;">Commande</div>
                  <h3 style="font-size: 24px; font-weight: 700; color: var(--color-primary);">${order.order_number}</h3>
                </div>
                <span class="badge badge-${statusColors[order.status]}" style="font-size: 14px; padding: 8px 16px;">
                  ${order.status}
                </span>
              </div>
              <div style="font-size: 13px; color: var(--color-secondary);">
                Créée le ${UI.formatDate(order.created_at)}
              </div>
            </div>

            <div>
              <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 12px; color: var(--color-primary);">👤 Informations client</h4>
              <div style="padding: 16px; background: var(--color-surface); border-radius: var(--radius-sm);">
                <div style="margin-bottom: 8px;"><strong>Nom :</strong> ${order.customer_name}</div>
                <div style="margin-bottom: 8px;"><strong>Téléphone :</strong> ${order.customer_phone}</div>
                ${order.customer_address ? `<div><strong>Adresse :</strong> ${order.customer_address}</div>` : ''}
              </div>
            </div>

            <div>
              <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 12px; color: var(--color-primary);">📦 Produit commandé</h4>
              <div style="padding: 16px; background: var(--color-surface); border-radius: var(--radius-sm);">
                <div style="margin-bottom: 8px;"><strong>Produit :</strong> ${order.product_name}</div>
                <div style="margin-bottom: 8px;"><strong>Prix unitaire :</strong> ${UI.formatCurrency(order.product_price)}</div>
                <div style="margin-bottom: 12px;"><strong>Quantité :</strong> ${order.quantity}</div>
                <div style="padding-top: 12px; border-top: 2px solid var(--color-primary);">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong style="font-size: 18px;">Total :</strong>
                    <strong style="font-size: 24px; color: var(--color-primary);">
                      ${UI.formatCurrency(order.total_amount)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            ${order.notes ? `
              <div>
                <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 12px; color: var(--color-primary);">📝 Notes</h4>
                <div style="padding: 16px; background: var(--color-surface); border-radius: var(--radius-sm);">
                  ${order.notes}
                </div>
              </div>
            ` : ''}

            <div style="display: flex; gap: 12px;">
              <button class="btn btn-primary" style="flex: 1;" data-action="contact-customer" data-phone="${order.customer_phone}">
                💬 Contacter client
              </button>
              <button class="btn btn-secondary" data-action="change-status" data-order-id="${order.id}" data-current-status="${order.status}">
                🔄 Changer statut
              </button>
            </div>
          </div>
        `;

        ModalManager.openModal('orderDetailsModal');
      }
    } catch (error) {
      console.error('Erreur chargement commande:', error);
    }
  },

  openStatusModal(orderId, currentStatus) {
    document.getElementById('statusOrderId').value = orderId;
    document.getElementById('newStatus').value = currentStatus;
    ModalManager.closeModal('orderDetailsModal');
    ModalManager.openModal('statusModal');
  },

  async handleStatusChange(e) {
    e.preventDefault();
    
    const orderId = document.getElementById('statusOrderId').value;
    const newStatus = document.getElementById('newStatus').value;
    
    try {
      await API.updateOrderStatus(orderId, newStatus);
      UI.showNotification('Succès', 'Statut mis à jour', 'success');
      ModalManager.closeModal('statusModal');
      this.loadOrders(this.currentPage);
      this.loadOrderStats();
    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
    }
  },

  contactCustomer(phone) {
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  }
};

// ========================================
// PAGE: PROFILE
// ========================================
const ProfilePage = {
  init() {
    const profileForm = document.getElementById('profileForm');
    const passwordForm = document.getElementById('passwordForm');

    if (profileForm) {
      this.loadProfile();
      profileForm.addEventListener('submit', this.handleProfileSubmit.bind(this));
    }

    if (passwordForm) {
      passwordForm.addEventListener('submit', this.handlePasswordSubmit.bind(this));
    }

    AppUtils.on('[data-action="copy-store-link"]', 'click', this.copyStoreLink);
  },

  async loadProfile() {
    try {
      const data = await API.getProfile();
      
      if (data && data.data && data.data.user) {
        const user = data.data.user;
        document.getElementById('business_name').value = user.business_name || '';
        document.getElementById('email').value = user.email || '';
        document.getElementById('phone').value = user.phone || '';
        document.getElementById('whatsapp_number').value = user.whatsapp_number || '';
        
        const storeLink = `${window.location.origin}/store/${user.store_slug}`;
        document.getElementById('store_link').value = storeLink;
      }
    } catch (error) {
      console.error('Erreur chargement profil:', error);
      UI.showNotification('Erreur', 'Erreur lors du chargement du profil', 'error');
    }
  },

  async handleProfileSubmit(e) {
    e.preventDefault();
    
    const formData = {
      business_name: document.getElementById('business_name').value,
      phone: document.getElementById('phone').value,
      whatsapp_number: document.getElementById('whatsapp_number').value
    };
    
    try {
      await API.updateProfile(formData);
      UI.showNotification('Succès', 'Profil mis à jour', 'success');
      
      // Mettre à jour localStorage
      const currentUser = API.getUser();
      currentUser.business_name = formData.business_name;
      API.setUser(currentUser);
      
      setTimeout(() => location.reload(), 1000);
    } catch (error) {
      console.error('Erreur mise à jour profil:', error);
    }
  },

  async handlePasswordSubmit(e) {
    e.preventDefault();
    
    const oldPassword = document.getElementById('old_password').value;
    const newPassword = document.getElementById('new_password').value;
    const confirmPassword = document.getElementById('confirm_password').value;
    
    if (newPassword !== confirmPassword) {
      UI.showNotification('Erreur', 'Les mots de passe ne correspondent pas', 'error');
      return;
    }
    
    if (newPassword.length < 8) {
      UI.showNotification('Erreur', 'Le mot de passe doit faire au moins 8 caractères', 'error');
      return;
    }
    
    try {
      await API.post('/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword
      });
      
      UI.showNotification('Succès', 'Mot de passe modifié', 'success');
      document.getElementById('passwordForm').reset();
    } catch (error) {
      console.error('Erreur changement mot de passe:', error);
    }
  },

  copyStoreLink() {
    const input = document.getElementById('store_link');
    input.select();
    navigator.clipboard.writeText(input.value).then(() => {
      UI.showNotification('Copié !', 'Lien copié dans le presse-papier', 'success');
    });
  }
};

// ========================================
// PAGE: SUBSCRIPTION
// ========================================
const SubscriptionPage = {
  init() {
    if (document.getElementById('currentSubscription')) {
      this.loadSubscription();
    }

    AppUtils.delegate(document, 'click', '[data-action="upgrade"]', this.showUpgradeModal);
    AppUtils.delegate(document, 'click', '[data-action="contact-support"]', (e) => {
      this.contactSupport(e.target.dataset.plan);
    });
  },

  async loadSubscription() {
    try {
      const data = await API.getProfile();
      if (data && data.data) {
        this.renderCurrentSubscription(data.data.user);
        this.loadUsageStats();
        this.loadAvailablePlans();
      }
    } catch (error) {
      console.error('Erreur chargement abonnement:', error);
    }
  },

  renderCurrentSubscription(data) {
    const container = document.getElementById('currentSubscription');
    if (!container) return;
    
    container.innerHTML = `
      <div style="padding: 32px; background: linear-gradient(135deg, var(--color-primary), var(--color-secondary)); color: white; border-radius: var(--radius-lg);">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 24px;">
          <div>
            <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">Plan Actuel</div>
            <h2 style="font-size: 32px; font-weight: 700; margin-bottom: 8px;">Plan ${data.plan_name}</h2>
            <p style="opacity: 0.9;">Découvrez toutes les fonctionnalités de base</p>
          </div>
          <span class="badge" style="background: rgba(255, 255, 255, 0.2); color: white; font-size: 14px; padding: 8px 16px;">
            ✅ Actif
          </span>
        </div>
        
        <div style="padding: 20px; background: rgba(255, 255, 255, 0.1); border-radius: var(--radius-md); margin-bottom: 16px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px;">
            <div>
              <div style="font-size: 13px; opacity: 0.9; margin-bottom: 4px;">Produits</div>
              <div style="font-size: 24px; font-weight: 700;"> ${data.plan_name.toLowerCase() === 'gratuit'? '5 max': '∞'}</div>
            </div>
            <div>
              <div style="font-size: 13px; opacity: 0.9; margin-bottom: 4px;">Commandes/mois</div>
              <div style="font-size: 24px; font-weight: 700;">${data.plan_name.toLowerCase() === 'gratuit'? '20 max': '∞'}</div>
            </div>
            <div>
              <div style="font-size: 13px; opacity: 0.9; margin-bottom: 4px;">Stockage</div>
              <div style="font-size: 24px; font-weight: 700;">${data.plan_name.toLowerCase() === 'gratuit'? '100 MB': data.plan_name.toLowerCase() === 'pro'? '500 MB' : '2 GB'}</div>
            </div>
          </div>
        </div>
        
        <button class="btn" style="background: white; color: var(--color-primary); width: 100%;" data-action="upgrade">
          🚀 Passer au plan supérieur
        </button>
      </div>
    `;
  },

  async loadUsageStats() {
    try {
      const data = await API.getDashboard();
      const user = await API.getProfile();
      
      if (data && data.data && data.data.overview && user.data.user) {
        this.renderUsageStats(data.data.overview, user.data.user);
      }
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
  },

  renderUsageStats(stats, user) {
    const container = document.getElementById('usageStats');
    if (!container) return;
    
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px;">
        <div>
          <div style="font-size: 14px; color: var(--color-secondary); margin-bottom: 8px;">Produits créés</div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div style="font-size: 28px; font-weight: 700; color: var(--color-primary);">
              ${stats.products.total || 0}
            </div>
            <div style="font-size: 14px; color: var(--color-secondary);">/ ${user.plan_name.toLowerCase() === 'gratuit'? '5' : '∞' } </div>
          </div>
          <div style="width: 100%; height: 8px; background: var(--color-surface); border-radius: 100px; overflow: hidden;">
            <div style="width: ${Math.min(((stats.products.total || 0) / 5) * 100, 100)}%; height: 100%; background: var(--color-primary);"></div>
          </div>
        </div>
        
        <div>
          <div style="font-size: 14px; color: var(--color-secondary); margin-bottom: 8px;">Commandes ce mois</div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div style="font-size: 28px; font-weight: 700; color: var(--color-primary);">
              ${stats.orders.this_month || 0}
            </div>
            <div style="font-size: 14px; color: var(--color-secondary);">/ ${user.plan_name.toLowerCase() === 'gratuit'? '20' : '∞' }</div>
          </div>
          <div style="width: 100%; height: 8px; background: var(--color-surface); border-radius: 100px; overflow: hidden;">
            <div style="width: ${Math.min(((stats.orders.this_month || 0) / 20) * 100, 100)}%; height: 100%; background: var(--color-success);"></div>
          </div>
        </div>
        
        <div>
          <div style="font-size: 14px; color: var(--color-secondary); margin-bottom: 8px;">Clients totaux</div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div style="font-size: 28px; font-weight: 700; color: var(--color-primary);">
              ${stats.customers.total || 0}
            </div>
          </div>
          <div style="font-size: 13px; color: var(--color-secondary);">Illimité dans tous les plans</div>
        </div>
      </div>
    `;
  },

  loadAvailablePlans() {
    const container = document.getElementById('availablePlans');
    if (!container) return;
    
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
        <div style="border: 2px solid var(--color-surface); border-radius: var(--radius-lg); padding: 24px; position: relative;">
          <div style="position: absolute; top: -12px; right: 24px; background: var(--color-warning); color: white; padding: 4px 12px; border-radius: 100px; font-size: 12px; font-weight: 700;">
            POPULAIRE
          </div>
          <h3 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">Pro</h3>
          <div style="font-size: 36px; font-weight: 700; color: var(--color-primary); margin-bottom: 4px;">
            5,000 <span style="font-size: 18px; font-weight: 400;">FCFA</span>
          </div>
          <div style="font-size: 13px; color: var(--color-secondary); margin-bottom: 24px;">par mois</div>
          
          <ul style="list-style: none; margin-bottom: 24px;">
            <li style="padding: 8px 0; display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--color-success); font-size: 18px;">✓</span>
              Produits illimités
            </li>
            <li style="padding: 8px 0; display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--color-success); font-size: 18px;">✓</span>
              Commandes illimitées
            </li>
            <li style="padding: 8px 0; display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--color-success); font-size: 18px;">✓</span>
              Statistiques avancées
            </li>
            <li style="padding: 8px 0; display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--color-success); font-size: 18px;">✓</span>
              Support prioritaire
            </li>
            <li style="padding: 8px 0; display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--color-success); font-size: 18px;">✓</span>
              500 MB stockage
            </li>
          </ul>
          
          <button class="btn btn-primary w-full" data-action="contact-support" data-plan="Pro">
            Contacter le support
          </button>
        </div>
        
        <div style="border: 2px solid var(--color-primary); border-radius: var(--radius-lg); padding: 24px; background: linear-gradient(135deg, rgba(224, 252, 252, 0.1), rgba(194, 224, 227, 0.1));">
          <h3 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">Business</h3>
          <div style="font-size: 36px; font-weight: 700; color: var(--color-primary); margin-bottom: 4px;">
            15,000 <span style="font-size: 18px; font-weight: 400;">FCFA</span>
          </div>
          <div style="font-size: 13px; color: var(--color-secondary); margin-bottom: 24px;">par mois</div>
          
          <ul style="list-style: none; margin-bottom: 24px;">
            <li style="padding: 8px 0; display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--color-success); font-size: 18px;">✓</span>
              <strong>Tout du plan Pro</strong>
            </li>
            <li style="padding: 8px 0; display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--color-success); font-size: 18px;">✓</span>
              Accès API
            </li>
            <li style="padding: 8px 0; display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--color-success); font-size: 18px;">✓</span>
              Branding personnalisé
            </li>
            <li style="padding: 8px 0; display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--color-success); font-size: 18px;">✓</span>
              Intégration WhatsApp
            </li>
            <li style="padding: 8px 0; display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--color-success); font-size: 18px;">✓</span>
              2 GB stockage
            </li>
          </ul>
          
          <button class="btn btn-primary w-full" data-action="contact-support" data-plan="Business">
            Contacter le support
          </button>
        </div>
      </div>
    `;
  },

  showUpgradeModal() {
    UI.showNotification(
      'Mise à niveau',
      'Contactez notre support pour passer à un plan supérieur',
      'info'
    );
  },

  contactSupport(plan) {
    UI.showNotification(
      'Contact Support',
      `Pour souscrire au plan ${plan}, contactez-nous:\n\nEmail: bryantzoua4@gmail.com\nTéléphone: +237 671 64 63 35`,
      'info'
    );
  }
};

// ========================================
// PAGE: ADMIN DASHBOARD
// ========================================
const AdminDashboardPage = {
  init() {
    if (document.getElementById('globalStats')) {
      this.loadAdminDashboard();
    }

    AppUtils.on('[data-action="change-period"]', 'change', (e) => {
      this.changePeriod(e.target.value);
    });
  },

  async loadAdminDashboard() {
    try {
      const data = await API.getAdminDashboard();
      
      if (data && data.data) {
        this.renderGlobalStats(data.data.stats);
        this.renderConversionStats(data.data.conversion);
        this.renderTopVendors(data.data.top_vendors);
        this.renderRecentVendors(data.data.recent_vendors);
      }
    } catch (error) {
      console.error('Erreur chargement dashboard admin:', error);
    }
  },

  renderGlobalStats(stats) {
    const container = document.getElementById('globalStats');
    if (!container) return;
    
    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Vendeurs Actifs</span>
          <div class="stat-icon">👥</div>
        </div>
        <div class="stat-value">${stats.vendors.active || 0}</div>
        <div class="stat-change positive">+${stats.vendors.new_last_30_days || 0} ce mois</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Produits Totaux</span>
          <div class="stat-icon">📦</div>
        </div>
        <div class="stat-value">${stats.products.total || 0}</div>
        <div class="stat-change">${stats.products.available || 0} disponibles</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Commandes</span>
          <div class="stat-icon">🛒</div>
        </div>
        <div class="stat-value">${stats.orders.total || 0}</div>
        <div class="stat-change positive">+${stats.orders.last_30_days || 0} (30j)</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Chiffre d'affaires</span>
          <div class="stat-icon">💰</div>
        </div>
        <div class="stat-value">${UI.formatCurrency(stats.revenue.total || 0)}</div>
        <div class="stat-change positive">${UI.formatCurrency(stats.revenue.last_30_days || 0)} (30j)</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Abonnements Trial</span>
          <div class="stat-icon">🎯</div>
        </div>
        <div class="stat-value">${stats.subscriptions.trial || 0}</div>
        <div class="stat-change">${stats.subscriptions.active || 0} actifs</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Vendeurs Suspendus</span>
          <div class="stat-icon">⛔</div>
        </div>
        <div class="stat-value">${stats.vendors.suspended || 0}</div>
        <div class="stat-change negative">${stats.subscriptions.expired || 0} expirés</div>
      </div>
    `;
  },

  renderConversionStats(conversion) {
    const container = document.getElementById('conversionStats');
    if (!container) return;
    
    container.innerHTML = `
      <div style="padding: 24px; text-align: center;">
        <div style="font-size: 48px; font-weight: 700; color: var(--color-primary); margin-bottom: 8px;">
          ${conversion.conversion_rate}%
        </div>
        <div style="font-size: 14px; color: var(--color-secondary); margin-bottom: 24px;">
          Taux de conversion
        </div>
        <div style="display: flex; flex-direction: column; gap: 16px; text-align: left;">
          <div style="padding: 12px; background: var(--color-surface); border-radius: var(--radius-sm);">
            <div style="font-size: 24px; font-weight: 700; color: var(--color-primary);">${conversion.total_signups || 0}</div>
            <div style="font-size: 13px; color: var(--color-secondary);">Inscriptions totales</div>
          </div>
          <div style="padding: 12px; background: var(--color-accent); border-radius: var(--radius-sm);">
            <div style="font-size: 24px; font-weight: 700; color: var(--color-primary);">${conversion.active_users || 0}</div>
            <div style="font-size: 13px; color: var(--color-primary);">Utilisateurs actifs</div>
          </div>
        </div>
      </div>
    `;
  },

  renderTopVendors(vendors) {
    const container = document.getElementById('topVendors');
    if (!container) return;
    
    if (!vendors || vendors.length === 0) {
      container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Aucun vendeur</p></div>';
      return;
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${vendors.map((vendor, index) => `
          <div style="padding: 16px; background: ${index === 0 ? 'linear-gradient(135deg, var(--color-accent), var(--color-surface))' : 'var(--color-surface)'}; border-radius: var(--radius-sm); display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--color-primary); color: var(--color-white); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px;">
              ${index + 1}
            </div>
            <div style="flex: 1;">
              <div style="font-weight: 700; color: var(--color-primary); margin-bottom: 4px;">${vendor.business_name}</div>
              <div style="font-size: 13px; color: var(--color-secondary);">${vendor.total_orders || 0} commandes • ${UI.formatCurrency(vendor.total_revenue || 0)}</div>
            </div>
            <a href="/admin/vendors/${vendor.id}" class="btn btn-sm btn-secondary">Voir</a>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderRecentVendors(vendors) {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    
    if (!vendors || vendors.length === 0) {
      container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Aucune activité</p></div>';
      return;
    }

    const statusColors = {
      'active': 'success',
      'suspended': 'error',
      'deactivated': 'neutral'
    };

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${vendors.map(vendor => `
          <div style="padding: 12px; border-left: 3px solid var(--color-accent); background: var(--color-surface); border-radius: var(--radius-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong style="font-size: 14px; color: var(--color-primary);">${vendor.business_name}</strong>
              <span class="badge badge-${statusColors[vendor.account_status]}">${vendor.account_status}</span>
            </div>
            <div style="font-size: 13px; color: var(--color-secondary);">
              ${vendor.email} • Inscrit ${UI.formatRelativeDate(vendor.created_at)}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  changePeriod(period) {
    console.log('Changement période:', period);
    // TODO: Implémenter le changement de période
  }
};

// ========================================
// PAGE: ADMIN VENDORS
// ========================================
const AdminVendorsPage = {
  currentPage: 1,
  currentStatus: null,
  currentSearch: '',

  init() {
    if (!document.getElementById('vendorsTableBody')) return;

    this.loadVendors();

    // Recherche
    AppUtils.on('#searchInput', 'keyup', () => {
      this.currentSearch = document.getElementById('searchInput').value.trim();
      this.loadVendors(1);
    });

    // Filtre statut
    AppUtils.on('[data-filter="vendor-status"]', 'change', (e) => {
      this.currentStatus = e.target.value || null;
      this.loadVendors(1);
    });

    // Export
    AppUtils.on('[data-action="export-vendors"]', 'click', this.exportVendors);

    // Formulaire suspension
    const suspendForm = document.getElementById('suspendForm');
    if (suspendForm) {
      suspendForm.addEventListener('submit', this.handleSuspend.bind(this));
    }

    // Délégation événements
    AppUtils.delegate(document, 'click', '[data-action="view-vendor"]', (e) => {
      window.location.href = `/admin/vendors/${e.target.dataset.vendorId}`;
    });

    AppUtils.delegate(document, 'click', '[data-action="vendor-actions"]', (e) => {
      this.openVendorActions(e.target.dataset.vendorId);
    });

    AppUtils.delegate(document, 'click', '[data-action="suspend-vendor"]', (e) => {
      this.openSuspendModal(e.target.dataset.vendorId);
    });

    AppUtils.delegate(document, 'click', '[data-action="activate-vendor"]', (e) => {
      this.activateVendor(e.target.dataset.vendorId);
    });
  },

  async loadVendors(page = 1) {
    this.currentPage = page;
    try {
      const data = await API.getVendors();
      if (data && data.data) {
        this.renderVendorsTable(data.data);
        // this.renderPagination(data.data.pagination);
      }
    } catch (error) {
      console.error('Erreur chargement vendeurs:', error);
    }
  },

  renderVendorsTable(vendors) {
    const tbody = document.getElementById('vendorsTableBody');
    if (!tbody) return;
    
    if (!vendors || vendors.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 48px;">
            <div class="empty-state-text">Aucun vendeur trouvé</div>
          </td>
        </tr>
      `;
      return;
    }

    const statusColors = {
      'active': 'success',
      'suspended': 'error',
      'deactivated': 'neutral'
    };

    const statusLabels = {
      'active': 'Actif',
      'suspended': 'Suspendu',
      'deactivated': 'Désactivé'
    };

    tbody.innerHTML = vendors.map(vendor => `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--color-primary); margin-bottom: 4px;">${vendor.business_name}</div>
          <div style="font-size: 13px; color: var(--color-secondary);">${vendor.store_slug}</div>
        </td>
        <td>
          <div style="margin-bottom: 4px;">${vendor.email}</div>
          ${vendor.phone ? `<div style="font-size: 13px; color: var(--color-secondary);">${vendor.phone}</div>` : ''}
        </td>
        <td>
          ${vendor.plan_name ? 
            `<span class="badge badge-info">${vendor.plan_name}</span>` :
            `<span class="badge badge-neutral">Aucun</span>`
          }
        </td>
        <td style="text-align: center;">${vendor.products_count || 0}</td>
        <td style="text-align: center;">${vendor.orders_count || 0}</td>
        <td style="font-weight: 600;">${UI.formatCurrency(vendor.total_revenue || 0)}</td>
        <td>
          <span class="badge badge-${statusColors[vendor.account_status]}">${statusLabels[vendor.account_status]}</span>
        </td>
        <td style="font-size: 13px; color: var(--color-secondary);">
          ${UI.formatRelativeDate(vendor.created_at)}
        </td>
        <td>
          <div class="table-actions">
            <button class="table-action-btn" data-action="view-vendor" data-vendor-id="${vendor.id}" title="Voir détails">👁️</button>
            <button class="table-action-btn" data-action="vendor-actions" data-vendor-id="${vendor.id}" title="Actions">⚙️</button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  renderPagination(pagination) {
    const container = document.getElementById('pagination');
    if (!container) return;
    
    const { page, totalPages, total } = pagination;
    
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '';
    
    if (page > 1) {
      html += `<button class="btn btn-secondary btn-sm" data-action="prev-page-vendors">← Précédent</button>`;
    }
    
    html += `<span style="padding: 8px 16px; color: var(--color-secondary);">Page ${page} sur ${totalPages} (${total} vendeurs)</span>`;
    
    if (page < totalPages) {
      html += `<button class="btn btn-secondary btn-sm" data-action="next-page-vendors">Suivant →</button>`;
    }
    
    container.innerHTML = html;

    AppUtils.on('[data-action="prev-page-vendors"]', 'click', () => this.loadVendors(this.currentPage - 1));
    AppUtils.on('[data-action="next-page-vendors"]', 'click', () => this.loadVendors(this.currentPage + 1));
  },

  async openVendorActions(id) {
    try {
      const data = await API.getVendor(id);
      
      if (data && data.data) {
        const vendor = data.data.user;
        const modal = document.getElementById('vendorActionsModal');
        const body = document.getElementById('vendorActionsBody');
        
        const isSuspended = vendor.account_status === 'suspended';
        const isDeactivated = vendor.account_status === 'deactivated';
        
        body.innerHTML = `
          <div style="margin-bottom: 24px; padding: 16px; background: var(--color-surface); border-radius: var(--radius-sm);">
            <h4 style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">${vendor.business_name}</h4>
            <p style="color: var(--color-secondary); margin-bottom: 4px;">${vendor.email}</p>
            <span class="badge badge-${vendor.account_status === 'active' ? 'success' : 'error'}">${vendor.account_status}</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${!isSuspended && !isDeactivated ? 
              `<button class="btn btn-danger w-full" data-action="suspend-vendor" data-vendor-id="${id}">
                ⛔ Suspendre le vendeur
              </button>` : ''
            }
            
            ${isSuspended ? 
              `<button class="btn btn-success w-full" data-action="activate-vendor" data-vendor-id="${id}">
                ✅ Réactiver le vendeur
              </button>` : ''
            }
            
            <button class="btn btn-secondary w-full" data-action="view-vendor" data-vendor-id="${id}">
              👁️ Voir tous les détails
            </button>
          </div>
        `;
        
        ModalManager.openModal('vendorActionsModal');
      }
    } catch (error) {
      console.error('Erreur chargement vendeur:', error);
    }
  },

  openSuspendModal(userId) {
    document.getElementById('suspendUserId').value = userId;
    ModalManager.closeModal('vendorActionsModal');
    ModalManager.openModal('suspendModal');
  },

  async handleSuspend(e) {
    e.preventDefault();
    
    const userId = document.getElementById('suspendUserId').value;
    const reason = document.getElementById('suspendReason').value;
    
    try {
      await API.suspendVendor(userId, reason);
      UI.showNotification('Succès', 'Vendeur suspendu', 'success');
      ModalManager.closeModal('suspendModal');
      this.loadVendors(this.currentPage);
    } catch (error) {
      console.error('Erreur suspension:', error);
    }
  },

  async activateVendor(id) {
    const confirmed = await UI.confirm(
      'Réactiver le vendeur',
      'Êtes-vous sûr de vouloir réactiver ce vendeur ?'
    );
    
    if (confirmed) {
      try {
        await API.activateVendor(id);
        UI.showNotification('Succès', 'Vendeur réactivé', 'success');
        ModalManager.closeModal('vendorActionsModal');
        this.loadVendors(this.currentPage);
      } catch (error) {
        console.error('Erreur réactivation:', error);
      }
    }
  },

  exportVendors() {
    UI.showNotification('Export', 'Fonctionnalité à venir', 'info');
  }
};

// ========================================
// PAGE: PUBLIC PRODUCT
// ========================================
const PublicProductPage = {
  init() {
    const token = this.getTokenFromURL();
    if (token && document.getElementById('productContainer')) {
      this.loadProduct(token);
    }
  },

  getTokenFromURL() {
    const path = window.location.pathname;
    const match = path.match(/\/p\/([^\/]+)/);
    return match ? match[1] : null;
  },

  async loadProduct(token) {
    try {
      const response = await fetch(`/api/p/${token}`);
      const data = await response.json();

      if (data && data.data) {
        this.renderProduct(data.data);
      } else {
        this.showError('Produit introuvable');
      }
    } catch (error) {
      console.error('Erreur chargement produit:', error);
      this.showError('Erreur lors du chargement');
    }
  },

  renderProduct(data) {
    const { product, vendor, whatsapp_url } = data;
    const container = document.getElementById('productContainer');
    if (!container) return;

    // Update meta tags
    document.title = `${product.name} | ${vendor.business_name}`;
    
    container.innerHTML = `
      ${product.image_url ? 
        `<img src="${product.image_url}" alt="${product.name}" class="product-image">` :
        `<div class="product-image" style="display: flex; align-items: center; justify-content: center; font-size: 120px;">📦</div>`
      }

      <div class="product-content">
        <div class="product-header">
          <h1 class="product-title">${product.name}</h1>
          <div class="product-price">${UI.formatCurrency(product.price, product.currency)}</div>
          <span class="product-availability ${product.is_available ? 'available' : 'unavailable'}">
            ${product.is_available ? '✅ Disponible' : '❌ Indisponible'}
          </span>
        </div>

        <div class="vendor-info">
          <div class="vendor-name">🏪 ${vendor.business_name}</div>
          <div style="font-size: 14px; color: var(--color-secondary);">
            Vendeur vérifié sur AURA
          </div>
        </div>

        ${product.description ? 
          `<div class="product-description">${product.description.replace(/\n/g, '<br>')}</div>` :
          ''
        }

        ${product.stock_quantity > 0 ? 
          `<div style="padding: 12px; background: rgba(76, 175, 80, 0.1); border-radius: var(--radius-sm); margin-bottom: 24px; text-align: center;">
            <strong style="color: var(--color-success);">Stock disponible : ${product.stock_quantity} unité(s)</strong>
          </div>` :
          ''
        }

        <div class="order-actions">
          ${whatsapp_url && product.is_available ? 
            `<a href="${whatsapp_url}" class="whatsapp-btn" target="_blank">
              <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              Commander via WhatsApp
            </a>` :
            `<div style="padding: 20px; background: var(--color-surface); border-radius: var(--radius-md); text-align: center; color: var(--color-secondary);">
              ${product.is_available ? 'Contactez le vendeur pour commander' : 'Produit actuellement indisponible'}
            </div>`
          }
        </div>

        <div class="product-stats">
          <div class="product-stat">
            <div class="product-stat-value">${product.click_count || 0}</div>
            <div class="product-stat-label">👁️ Vues</div>
          </div>
          <div class="product-stat">
            <div class="product-stat-value">${product.order_count || 0}</div>
            <div class="product-stat-label">🛒 Commandes</div>
          </div>
        </div>
      </div>

      <div class="powered-by">
        Propulsé par <a href="/">AURA</a> ✨
      </div>
    `;
  },

  showError(message) {
    const container = document.getElementById('productContainer');
    if (!container) return;
    
    container.innerHTML = `
      <div style="text-align: center; padding: 64px;">
        <div style="font-size: 64px; margin-bottom: 24px;">😔</div>
        <h2 style="font-size: 24px; font-weight: 700; color: var(--color-primary); margin-bottom: 12px;">
          ${message}
        </h2>
        <p style="color: var(--color-secondary); margin-bottom: 24px;">
          Ce produit n'existe pas ou n'est plus disponible
        </p>
        <a href="/" class="btn btn-primary">Retour à l'accueil</a>
      </div>
    `;
  }
};

// ========================================
// PAGE: PUBLIC STORE
// ========================================
const PublicStorePage = {
  init() {
    const storeSlug = this.getSlugFromURL();
    if (storeSlug && document.getElementById('storeInfo')) {
      this.loadStore(storeSlug);
    }
  },

  getSlugFromURL() {
    const path = window.location.pathname;
    const match = path.match(/\/store\/([^\/]+)/);
    return match ? match[1] : null;
  },

  async loadStore(storeSlug) {
    try {
      const response = await fetch(`/api/store/${storeSlug}`);
      const data = await response.json();

      if (data && data.data) {
        this.renderStore(data.data);
      } else {
        this.showError('Boutique introuvable');
      }
    } catch (error) {
      console.error('Erreur chargement boutique:', error);
      this.showError('Erreur lors du chargement');
    }
  },

  renderStore(data) {
    const { vendor, products } = data;

    document.title = `${vendor.business_name} | AURA`;

    document.getElementById('storeInfo').innerHTML = `
      <div class="store-name">${vendor.business_name}</div>
      <div class="store-subtitle">
        ✨ ${products.length} produit${products.length > 1 ? 's' : ''} disponible${products.length > 1 ? 's' : ''}
      </div>
    `;

    const grid = document.getElementById('productsGridStore');
    if (!grid) return;

    if (!products || products.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 64px 24px;">
          <div style="font-size: 64px; margin-bottom: 16px;">🛒</div>
          <h3 style="font-size: 24px; font-weight: 700; color: var(--color-primary); margin-bottom: 8px;">
            Aucun produit disponible
          </h3>
          <p style="color: var(--color-secondary);">
            Cette boutique n'a pas encore de produits.
          </p>
        </div>
      `;
      return;
    }

    grid.innerHTML = products.map(product => `
      <div class="product-card" data-action="view-product" data-token="${product.share_token}">
        ${product.image_url ? 
          `<img src="${product.image_url}" alt="${product.name}" class="product-image">` :
          `<div class="product-image" style="display: flex; align-items: center; justify-content: center; font-size: 80px;">📦</div>`
        }
        <div class="product-info">
          <h3 class="product-name">${product.name}</h3>
          <div class="product-price">${UI.formatCurrency(product.price, product.currency)}</div>
          ${product.stock_quantity > 0 ? 
            `<div style="font-size: 13px; color: var(--color-success); margin-bottom: 12px;">
              ✔ En stock (${product.stock_quantity})
            </div>` : ''
          }
          <button class="product-cta" data-action="order-product" data-token="${product.share_token}">
            💬 Commander via WhatsApp
          </button>
        </div>
      </div>
    `).join('');

    // Attacher événements
    AppUtils.delegate(grid, 'click', '[data-action="view-product"]', (e) => {
      if (!e.target.closest('[data-action="order-product"]')) {
        window.location.href = `/p/${e.target.closest('[data-action="view-product"]').dataset.token}`;
      }
    });

    AppUtils.delegate(grid, 'click', '[data-action="order-product"]', (e) => {
      e.stopPropagation();
      window.location.href = `/p/${e.target.dataset.token}`;
    });
  },

  showError(message) {
    document.getElementById('storeInfo').innerHTML = `
      <div style="padding: 64px 24px; text-align: center;">
        <div style="font-size: 64px; margin-bottom: 24px;">😔</div>
        <h2 style="font-size: 32px; font-weight: 700; margin-bottom: 12px;">
          ${message}
        </h2>
        <p style="font-size: 16px; opacity: 0.8;">
          Cette boutique n'existe pas ou n'est plus disponible
        </p>
      </div>
    `;
    document.getElementById('productsGrid').innerHTML = '';
  }
};

// ========================================
// INITIALISATION GLOBALE
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  // Initialiser les modules communs
  SidebarManager.init();
  NotificationManager.init();
  AuthManager.init();
  ModalManager.init();

  // Initialiser les pages spécifiques
  LoginPage.init();
  RegisterPage.init();
  DashboardPage.init();
  ProductsPage.init();
  ProfilePage.init();
  SubscriptionPage.init();
  AdminDashboardPage.init();
  AdminVendorsPage.init();
  PublicProductPage.init();
  PublicStorePage.init();
});

// Export pour utilisation globale
window.AppUtils = AppUtils;
window.ModalManager = ModalManager;