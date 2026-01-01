/**
 * public/js/orders.js
 * ========================================
 * GESTION COMPLÈTE DES COMMANDES VENDEUR
 * ========================================
 */

const OrdersManager = {
  currentPage: 1,
  currentStatus: null,
  currentSearch: '',
  products: [],
  editingOrderId: null,
  filterOrders: [],

  init() {
    this.attachEventListeners();
    this.loadAllData();
  },

  attachEventListeners() {
    // Bouton nouvelle commande
    const newOrderBtn = document.querySelector('[data-action="new-order"]');
    if (newOrderBtn) {
      newOrderBtn.addEventListener('click', () => this.openOrderModal());
    }

    // Filtre statut
    const statusFilter = document.querySelector('[data-filter="order-status"]');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.currentStatus = e.target.value || null;
        this.currentPage = 1;
        this.loadOrders();
      });
    }

    // Recherche
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('keyup', () => {
        this.currentSearch = searchInput.value.trim();
        // Debounce simple
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          this.currentPage = 1;
          this.loadOrders();
        }, 500);
      });
    }

    // Export
    const exportBtn = document.querySelector('[data-action="export-orders"]');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportOrders());
    }

    // Form commande
    const orderForm = document.getElementById('orderForm');
    if (orderForm) {
      orderForm.addEventListener('submit', (e) => this.handleSubmitOrder(e));
    }

    // Form statut
    const statusForm = document.getElementById('statusForm');
    if (statusForm) {
      statusForm.addEventListener('submit', (e) => this.handleStatusChange(e));
    }

    // Changement produit → calcul automatique
    const productSelect = document.getElementById('productId');
    if (productSelect) {
      productSelect.addEventListener('change', () => this.updateProductInfo());
    }

    // Changement quantité → recalcul
    const quantityInput = document.getElementById('quantity');
    if (quantityInput) {
      quantityInput.addEventListener('input', () => this.calculateTotal());
    }
  },

  async loadAllData() {
    try {
      UI.showLoader();
      
      await Promise.all([
        this.loadOrders(),
        this.loadOrderStats(),
        this.loadProducts()
      ]);

      UI.hideLoader();
    } catch (error) {
      UI.hideLoader();
      console.error('Erreur chargement données:', error);
    }
  },

  async loadOrders(page = 1) {
    this.currentPage = page;
    
    try {
      let url = `/orders?page=${page}&limit=20`;
      if (this.currentStatus) url += `&status=${this.currentStatus}`;
      
      const data = await API.get(url, false);
      
      if (data && data.data) {
        this.filterOrders = data.data.orders.filter(order => 
          order.order_number.includes(this.currentSearch) ||
          order.customer_name.includes(this.currentSearch) ||
          order.product_name.includes(this.currentSearch) ||
          order.product_price.includes(this.currentSearch) ||
          order.status.includes(this.currentSearch) ||
          order.status.includes(this.currentStatus)

        );
        this.renderOrdersTable(this.filterOrders);
        this.renderPagination(data.data.pagination);
      }
    } catch (error) {
      console.error('Erreur chargement commandes:', error);
      UI.showNotification('Erreur', 'Impossible de charger les commandes', 'error');
    }
  },

  async loadOrderStats() {
    try {
      const data = await API.get('/orders/stats', false);
      
      if (data && data.data && data.data.stats) {
        this.renderOrderStats(data.data.stats);
      }
    } catch (error) {
      console.error('Erreur stats:', error);
    }
  },

  async loadProducts() {
    try {
      const data = await API.get('/products/search=/true', false);
      
      if (data && data.data && data.data.products) {
        this.products = data.data.products;
        this.populateProductSelect();
      }
    } catch (error) {
      console.error('Erreur chargement produits:', error);
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
        <div class="stat-value">${stats.total_en_cours}</div>
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
              <button class="btn btn-primary" data-action="new-order">Créer une commande</button>
            </div>
          </td>
        </tr>
      `;
      
      // Réattacher l'événement
      const btn = tbody.querySelector('[data-action="new-order"]');
      if (btn) {
        btn.addEventListener('click', () => this.openOrderModal());
      }
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
            <button class="table-action-btn" data-action="edit-order" data-order-id="${order.id}" title="Modifier">✏️</button>
            <button class="table-action-btn" data-action="change-status" data-order-id="${order.id}" data-current-status="${order.status}" title="Changer statut">🔄</button>
            <button class="table-action-btn" data-action="contact-customer" data-phone="${order.customer_phone}" title="Contacter">💬</button>
            <button class="table-action-btn" data-action="delete-order" data-order-id="${order.id}" title="Supprimer">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');

    // Attacher événements
    this.attachTableActions();
  },

  attachTableActions() {
    // Voir détails
    document.querySelectorAll('[data-action="view-order"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const orderId = e.target.closest('[data-order-id]').dataset.orderId;
        this.viewOrderDetails(orderId);
      });
    });

    // Modifier
    document.querySelectorAll('[data-action="edit-order"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const orderId = e.target.closest('[data-order-id]').dataset.orderId;
        this.editOrder(orderId);
      });
    });

    // Changer statut
    document.querySelectorAll('[data-action="change-status"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target.closest('[data-order-id]');
        this.openStatusModal(target.dataset.orderId, target.dataset.currentStatus);
      });
    });

    // Contacter client
    document.querySelectorAll('[data-action="contact-customer"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const phone = e.target.closest('[data-phone]').dataset.phone;
        this.contactCustomer(phone);
      });
    });

    // Supprimer
    document.querySelectorAll('[data-action="delete-order"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const orderId = e.target.closest('[data-order-id]').dataset.orderId;
        this.deleteOrder(orderId);
      });
    });
  },

  renderPagination(pagination) {
    const container = document.getElementById('pagination');
    if (!container) return;
    
    const { page, limit, total } = pagination;
    const totalPages = Math.ceil(total / limit);
    
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '';
    
    if (page > 1) {
      html += `<button class="btn btn-secondary btn-sm" id="prevPageOrders">← Précédent</button>`;
    }
    
    html += `<span style="padding: 8px 16px; color: var(--color-secondary);">Page ${page} sur ${totalPages} (${total} commandes)</span>`;
    
    if (page < totalPages) {
      html += `<button class="btn btn-secondary btn-sm" id="nextPageOrders">Suivant →</button>`;
    }
    
    container.innerHTML = html;

    // Attacher événements pagination
    const prevBtn = document.getElementById('prevPageOrders');
    const nextBtn = document.getElementById('nextPageOrders');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.loadOrders(this.currentPage - 1));
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.loadOrders(this.currentPage + 1));
    }
  }
};

OrdersManager.populateProductSelect = function() {
  const select = document.getElementById('productId');
  if (!select || !this.products) return;

  const options = this.products
    .filter(p => p.is_available)
    .map(p => `
      <option value="${p.id}" data-price="${p.price}" data-currency="${p.currency}" data-stock="${p.stock_quantity}">
        ${p.name} - ${UI.formatCurrency(p.price, p.currency)}
      </option>
    `).join('');

  select.innerHTML = '<option value="">-- Sélectionner un produit --</option>' + options;
};

OrdersManager.openOrderModal = function(orderId = null) {
  this.editingOrderId = orderId;
  
  const modal = document.getElementById('orderModal');
  const title = document.getElementById('orderModalTitle');
  const submitBtn = document.getElementById('submitOrderBtn');
  const statusGroup = document.getElementById('statusGroup');
  const form = document.getElementById('orderForm');
  
  form.reset();
  document.getElementById('orderId').value = '';
  document.getElementById('totalAmountDisplay').style.display = 'none';
  document.getElementById('productInfo').textContent = '';
  document.getElementById('stockInfo').textContent = '';
  
  if (orderId) {
    title.textContent = 'Modifier la commande';
    submitBtn.textContent = 'Enregistrer les modifications';
    statusGroup.style.display = 'block';
    this.loadOrderForEdit(orderId);
  } else {
    title.textContent = 'Nouvelle commande';
    submitBtn.textContent = 'Créer la commande';
    statusGroup.style.display = 'none';
  }
  
  ModalManager.openModal('orderModal');
};

OrdersManager.loadOrderForEdit = async function(id) {
  try {
    const data = await API.get(`/orders/${id}`, true);
    
    if (data && data.data && data.data.order) {
      const order = data.data.order;
      
      document.getElementById('orderId').value = order.id;
      document.getElementById('productId').value = order.product_id;
      document.getElementById('customerName').value = order.customer_name;
      document.getElementById('customerPhone').value = order.customer_phone;
      document.getElementById('customerAddress').value = order.customer_address || '';
      document.getElementById('quantity').value = order.quantity;
      document.getElementById('orderStatus').value = order.status;
      document.getElementById('orderNotes').value = order.notes || '';
      
      this.updateProductInfo();
      this.calculateTotal();
    }
  } catch (error) {
    console.error('Erreur chargement commande:', error);
    UI.showNotification('Erreur', 'Impossible de charger la commande', 'error');
  }
};

OrdersManager.updateProductInfo = function() {
  const select = document.getElementById('productId');
  const selectedOption = select.options[select.selectedIndex];
  
  if (!selectedOption || !selectedOption.value) {
    document.getElementById('productInfo').textContent = '';
    document.getElementById('stockInfo').textContent = '';
    document.getElementById('totalAmountDisplay').style.display = 'none';
    return;
  }

  const price = parseFloat(selectedOption.dataset.price);
  const currency = selectedOption.dataset.currency;
  const stock = parseInt(selectedOption.dataset.stock);

  document.getElementById('productInfo').textContent = `Prix: ${UI.formatCurrency(price, currency)}`;
  
  if (stock > 0) {
    document.getElementById('stockInfo').textContent = `Stock disponible: ${stock} unité(s)`;
  } else {
    document.getElementById('stockInfo').textContent = 'Stock illimité';
  }

  this.calculateTotal();
};

OrdersManager.calculateTotal = function() {
  const select = document.getElementById('productId');
  const selectedOption = select.options[select.selectedIndex];
  const quantity = parseInt(document.getElementById('quantity').value) || 1;

  if (!selectedOption || !selectedOption.value) return;

  const price = parseFloat(selectedOption.dataset.price);
  const currency = selectedOption.dataset.currency;
  const total = price * quantity;

  document.getElementById('totalAmount').textContent = UI.formatCurrency(total, currency);
  document.getElementById('totalAmountDisplay').style.display = 'flex';
};

OrdersManager.handleSubmitOrder = async function(e) {
  e.preventDefault();

  const orderId = document.getElementById('orderId').value;
  const isEdit = !!orderId;

  const formData = {
    product_id: parseInt(document.getElementById('productId').value),
    customer_name: document.getElementById('customerName').value.trim(),
    customer_phone: document.getElementById('customerPhone').value.trim(),
    customer_address: document.getElementById('customerAddress').value.trim(),
    quantity: parseInt(document.getElementById('quantity').value),
    notes: document.getElementById('orderNotes').value.trim()
  };

  if (isEdit) {
    formData.status = document.getElementById('orderStatus').value;
  }

  // Validation
  if (!formData.product_id || !formData.customer_name || !formData.customer_phone || !formData.quantity) {
    UI.showNotification('Erreur', 'Veuillez remplir tous les champs obligatoires', 'error');
    return;
  }

  try {
    let data;
    
    if (isEdit) {
      // Mise à jour complète
      data = await API.put(`/orders/${orderId}`, formData, true);
    } else {
      // Création manuelle
      data = await API.post('/orders/manual', formData, true);
    }

    if (data && data.success) {
      UI.showNotification('Succès', isEdit ? 'Commande modifiée' : 'Commande créée', 'success');
      ModalManager.closeModal('orderModal');
      this.loadAllData();
    }
  } catch (error) {
    console.error('Erreur sauvegarde commande:', error);
  }
};

OrdersManager.viewOrderDetails = async function(id) {
  try {
    const data = await API.get(`/orders/${id}`, true);
    
    if (data && data.data && data.data.order) {
      const order = data.data.order;
      this.renderOrderDetails(order);
      ModalManager.openModal('orderDetailsModal');
    }
  } catch (error) {
    console.error('Erreur détails commande:', error);
  }
};

OrdersManager.renderOrderDetails = function(order) {
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
        <button class="btn btn-primary" style="flex: 1;" onclick="OrdersManager.contactCustomer('${order.customer_phone}')">
          💬 Contacter client
        </button>
        <button class="btn btn-secondary" onclick="OrdersManager.editOrder(${order.id})">
          ✏️ Modifier
        </button>
      </div>
    </div>
  `;
};

OrdersManager.editOrder = function(id) {
  ModalManager.closeModal('orderDetailsModal');
  this.openOrderModal(id);
};

OrdersManager.openStatusModal = function(orderId, currentStatus) {
  document.getElementById('statusOrderId').value = orderId;
  document.getElementById('newStatus').value = currentStatus;
  ModalManager.openModal('statusModal');
};

OrdersManager.handleStatusChange = async function(e) {
  e.preventDefault();
  
  const orderId = document.getElementById('statusOrderId').value;
  const newStatus = document.getElementById('newStatus').value;
  
  if (!newStatus) {
    UI.showNotification('Erreur', 'Veuillez sélectionner un statut', 'error');
    return;
  }

  try {
    await API.patch(`/orders/${orderId}/status`, { status: newStatus }, true);
    UI.showNotification('Succès', 'Statut mis à jour', 'success');
    ModalManager.closeModal('statusModal');
    this.loadOrders(this.currentPage);
    this.loadOrderStats();
  } catch (error) {
    console.error('Erreur mise à jour statut:', error);
  }
};

OrdersManager.deleteOrder = async function(id) {
  const confirmed = await UI.confirm(
    'Supprimer la commande',
    'Êtes-vous sûr de vouloir supprimer cette commande ? Cette action est irréversible.'
  );
  
  if (confirmed) {
    try {
      await API.delete(`/orders/${id}`, true);
      UI.showNotification('Succès', 'Commande supprimée', 'success');
      this.loadAllData();
    } catch (error) {
      console.error('Erreur suppression commande:', error);
    }
  }
};

OrdersManager.contactCustomer = function(phone) {
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  window.open(`https://wa.me/${cleanPhone}`, '_blank');
};

OrdersManager.exportOrders = function() {
  API.exportOrdersExcel();
};

// Export global
window.OrdersManager = OrdersManager;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('ordersTableBody')) {
    OrdersManager.init();
  }
});
