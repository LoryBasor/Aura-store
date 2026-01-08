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
  allOrders: [],
  itemsPerPage: 20,

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
        this.currentSearch = searchInput.value.trim().toLowerCase();
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          this.currentPage = 1;
          this.applyFiltersAndPagination();
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

  async loadOrders() {
    try {
      let url = `/orders?limit=1000`;
      if (this.currentStatus) url += `&status=${this.currentStatus}`;
      
      const data = await API.get(url, false);
      
      if (data && data.data) {
        this.allOrders = data.data.orders || [];
        this.applyFiltersAndPagination();
      }
    } catch (error) {
      console.error('Erreur chargement commandes:', error);
      UI.showNotification('Erreur', 'Impossible de charger les commandes', 'error');
    }
  },

  applyFiltersAndPagination() {
    let filteredOrders = this.allOrders;

    // Filtre par recherche
    if (this.currentSearch) {
      filteredOrders = filteredOrders.filter(order => {
        const searchLower = this.currentSearch.toLowerCase();
        return (
          order.order_number.toLowerCase().includes(searchLower) ||
          order.customer_name.toLowerCase().includes(searchLower) ||
          order.product_name.toLowerCase().includes(searchLower) ||
          order.customer_phone.includes(searchLower) ||
          order.status.toLowerCase().includes(searchLower)
        );
      });
    }

    // Filtre par statut
    if (this.currentStatus) {
      filteredOrders = filteredOrders.filter(order => 
        order.status === this.currentStatus
      );
    }

    // Calculer la pagination
    const totalOrders = filteredOrders.length;
    const totalPages = Math.ceil(totalOrders / this.itemsPerPage);
    
    if (this.currentPage > totalPages && totalPages > 0) {
      this.currentPage = totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }

    // Extraire les commandes pour la page courante
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

    // Afficher les résultats
    this.renderOrdersTable(paginatedOrders);
    this.renderPagination({
      page: this.currentPage,
      limit: this.itemsPerPage,
      total: totalOrders,
      totalPages: totalPages
    });
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
        <div class="stat-value">${stats.total_en_cours || 0}</div>
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
    
    const { page, totalPages, total } = pagination;
    
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    const paginationWrapper = document.createElement('div');
    paginationWrapper.style.cssText = 'display: flex; align-items: center; gap: 12px; justify-content: center; flex-wrap: wrap;';
    
    // Bouton Première page
    if (page > 1) {
      const firstBtn = this.createPaginationButton('⏮️', 1, false, 'Première page');
      paginationWrapper.appendChild(firstBtn);
    }
    
    // Bouton Précédent
    if (page > 1) {
      const prevBtn = this.createPaginationButton('← Précédent', page - 1, false);
      paginationWrapper.appendChild(prevBtn);
    }
    
    // Numéros de pages
    const pageNumbers = this.getPageNumbers(page, totalPages);
    pageNumbers.forEach(pageNum => {
      if (pageNum === '...') {
        const dots = document.createElement('span');
        dots.style.padding = '8px';
        dots.textContent = '...';
        paginationWrapper.appendChild(dots);
      } else {
        const isActive = pageNum === page;
        const pageBtn = this.createPaginationButton(pageNum.toString(), pageNum, isActive);
        if (isActive) {
          pageBtn.disabled = true;
        }
        paginationWrapper.appendChild(pageBtn);
      }
    });
    
    // Bouton Suivant
    if (page < totalPages) {
      const nextBtn = this.createPaginationButton('Suivant →', page + 1, false);
      paginationWrapper.appendChild(nextBtn);
    }
    
    // Bouton Dernière page
    if (page < totalPages) {
      const lastBtn = this.createPaginationButton('⏭️', totalPages, false, 'Dernière page');
      paginationWrapper.appendChild(lastBtn);
    }
    
    // Informations de pagination
    const startItem = ((page - 1) * this.itemsPerPage) + 1;
    const endItem = Math.min(page * this.itemsPerPage, total);
    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = 'text-align: center; margin-top: 12px; color: var(--color-secondary); font-size: 14px;';
    infoDiv.textContent = `Affichage de ${startItem} à ${endItem} sur ${total} commande${total > 1 ? 's' : ''}`;
    
    container.innerHTML = '';
    container.appendChild(paginationWrapper);
    container.appendChild(infoDiv);
  },

  createPaginationButton(text, pageNum, isActive = false, title = '') {
    const btn = document.createElement('button');
    btn.className = `btn ${isActive ? 'btn-primary' : 'btn-secondary'} btn-sm`;
    btn.textContent = text;
    btn.dataset.page = pageNum;
    
    if (title) {
      btn.title = title;
    }
    
    if (text.match(/^\d+$/)) {
      btn.style.minWidth = '40px';
    }
    
    btn.addEventListener('click', () => this.goToPage(pageNum));
    
    return btn;
  },

  getPageNumbers(currentPage, totalPages) {
    const pages = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      pages.push(totalPages);
    }

    return pages;
  },

  goToPage(page) {
    this.currentPage = page;
    this.applyFiltersAndPagination();
    
    const tableBody = document.getElementById('ordersTableBody');
    if (tableBody) {
      tableBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  populateProductSelect() {
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
  },

  openOrderModal(orderId = null) {
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
  },

  async loadOrderForEdit(id) {
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
  },

  updateProductInfo() {
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
  },

  calculateTotal() {
    const select = document.getElementById('productId');
    const selectedOption = select.options[select.selectedIndex];
    const quantity = parseInt(document.getElementById('quantity').value) || 1;

    if (!selectedOption || !selectedOption.value) return;

    const price = parseFloat(selectedOption.dataset.price);
    const currency = selectedOption.dataset.currency;
    const total = price * quantity;

    document.getElementById('totalAmount').textContent = UI.formatCurrency(total, currency);
    document.getElementById('totalAmountDisplay').style.display = 'flex';
  },

  async handleSubmitOrder(e) {
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

    if (!formData.product_id || !formData.customer_name || !formData.customer_phone || !formData.quantity) {
      UI.showNotification('Erreur', 'Veuillez remplir tous les champs obligatoires', 'error');
      return;
    }

    try {
      let data;
      
      if (isEdit) {
        data = await API.put(`/orders/${orderId}`, formData, true);
      } else {
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
  },

  async viewOrderDetails(id) {
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
  },

  renderOrderDetails(order) {
    const body = document.getElementById('orderDetailsBody');
    if (!body) return;

    const statusColors = {
      'nouvelle': 'info',
      'confirmee': 'success',
      'en_preparation': 'warning',
      'en_livraison': 'warning',
      'livree': 'success',
      'annulee': 'error'
    };

    const detailsContainer = document.createElement('div');
    detailsContainer.style.cssText = 'display: grid; gap: 24px;';
    
    // En-tête commande
    const header = document.createElement('div');
    header.style.cssText = 'padding: 20px; background: linear-gradient(135deg, var(--color-accent), var(--color-surface)); border-radius: var(--radius-md);';
    header.innerHTML = `
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
    `;
    detailsContainer.appendChild(header);

    // Informations client
    const clientInfo = document.createElement('div');
    clientInfo.innerHTML = `
      <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 12px; color: var(--color-primary);">👤 Informations client</h4>
      <div style="padding: 16px; background: var(--color-surface); border-radius: var(--radius-sm);">
        <div style="margin-bottom: 8px;"><strong>Nom :</strong> ${order.customer_name}</div>
        <div style="margin-bottom: 8px;"><strong>Téléphone :</strong> ${order.customer_phone}</div>
        ${order.customer_address ? `<div><strong>Adresse :</strong> ${order.customer_address}</div>` : ''}
      </div>
    `;
    detailsContainer.appendChild(clientInfo);

    // Produit commandé
    const productInfo = document.createElement('div');
    productInfo.innerHTML = `
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
    `;
    detailsContainer.appendChild(productInfo);

    // Notes
    if (order.notes) {
      const notesDiv = document.createElement('div');
      notesDiv.innerHTML = `
        <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 12px; color: var(--color-primary);">📝 Notes</h4>
        <div style="padding: 16px; background: var(--color-surface); border-radius: var(--radius-sm);">
          ${order.notes}
        </div>
      `;
      detailsContainer.appendChild(notesDiv);
    }

    // Boutons d'actions
    const actionsDiv = document.createElement('div');
    actionsDiv.style.cssText = 'display: flex; gap: 12px;';
    
    const contactBtn = document.createElement('button');
    contactBtn.className = 'btn btn-primary';
    contactBtn.style.flex = '1';
    contactBtn.textContent = '💬 Contacter client';
    contactBtn.addEventListener('click', () => this.contactCustomer(order.customer_phone));
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-secondary';
    editBtn.textContent = '✏️ Modifier';
    editBtn.addEventListener('click', () => this.editOrder(order.id));
    
    actionsDiv.appendChild(contactBtn);
    actionsDiv.appendChild(editBtn);
    detailsContainer.appendChild(actionsDiv);

    body.innerHTML = '';
    body.appendChild(detailsContainer);
  },

  editOrder(id) {
    ModalManager.closeModal('orderDetailsModal');
    this.openOrderModal(id);
  },

  openStatusModal(orderId, currentStatus) {
    document.getElementById('statusOrderId').value = orderId;
    document.getElementById('newStatus').value = currentStatus;
    ModalManager.openModal('statusModal');
  },

  async handleStatusChange(e) {
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
      this.loadOrders();
      this.loadOrderStats();
    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
    }
  },

  async deleteOrder(id) {
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
  },

  contactCustomer(phone) {
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  },

  exportOrders() {
    API.exportOrdersExcel();
  }
};

// Export global
window.OrdersManager = OrdersManager;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('ordersTableBody')) { 
    OrdersManager.init();
  }
});