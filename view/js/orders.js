/**
 * orders.js
 * Gestion de l'interactivité pour la page des commandes (Vendeur)
 */

document.addEventListener('DOMContentLoaded', () => {
  const orders = window.__SSR_ORDERS__ || [];
  let availableProducts = [];

  // Modals
  const orderModal = document.getElementById('orderModal');
  const detailsModal = document.getElementById('orderDetailsModal');
  const statusModal = document.getElementById('statusModal');
  const orderForm = document.getElementById('orderForm');
  const statusForm = document.getElementById('statusForm');

  // Inputs orderModal
  const productIdSelect = document.getElementById('productId');
  const totalAmountDisplay = document.getElementById('totalAmountDisplay');
  const totalAmountEl = document.getElementById('totalAmount');
  const quantityInput = document.getElementById('quantity');

  // --- CHARGEMENT INITIAL ---
  async function loadProducts() {
    try {
      const resp = await fetch('/api/products?limit=100');
      const data = await resp.json();
      if (resp.ok) {
        availableProducts = data.data.products;
        populateProductSelect();
      }
    } catch (err) {
      console.error('Erreur chargement produits:', err);
    }
  }

  function populateProductSelect() {
    productIdSelect.innerHTML = '<option value="">-- Sélectionner un produit --</option>';
    availableProducts.forEach(p => {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = `${p.name} (${UI.formatCurrency(p.price, p.currency)})`;
      productIdSelect.appendChild(option);
    });
  }

  function calculateTotal() {
    const productId = productIdSelect.value;
    const quantity = parseInt(quantityInput.value) || 0;
    const product = availableProducts.find(p => p.id == productId);

    if (product && quantity > 0) {
      const total = product.price * quantity;
      totalAmountEl.textContent = UI.formatCurrency(total, product.currency);
      totalAmountDisplay.style.display = 'block';
    } else {
      totalAmountDisplay.style.display = 'none';
    }
  }

  productIdSelect?.addEventListener('change', calculateTotal);
  quantityInput?.addEventListener('input', calculateTotal);

  // --- ACTIONS ---

  // Nouvelle commande
  AppUtils.delegate(document, 'click', '[data-action="new-order"]', () => {
    document.getElementById('orderModalTitle').textContent = 'Nouvelle commande';
    document.getElementById('submitOrderBtn').textContent = 'Créer la commande';
    document.getElementById('orderId').value = '';
    document.getElementById('statusGroup').style.display = 'none';
    orderForm.reset();
    totalAmountDisplay.style.display = 'none';
    ModalManager.openModal('orderModal');
    if (availableProducts.length === 0) loadProducts();
  });

  // Changer statut (depuis la liste)
  AppUtils.delegate(document, 'click', '[data-action="change-status"]', (e) => {
    const btn = e.target.closest('[data-action="change-status"]');
    const orderId = btn.dataset.orderId;
    const status = btn.dataset.status;
    
    document.getElementById('statusOrderId').value = orderId;
    document.getElementById('newStatus').value = status;
    ModalManager.openModal('statusModal');
  });

  // Voir détails
  AppUtils.delegate(document, 'click', '[data-action="view-order"]', async (e) => {
    const btn = e.target.closest('[data-action="view-order"]');
    const orderId = btn.dataset.orderId;
    
    ModalManager.openModal('orderDetailsModal');
    const body = document.getElementById('orderDetailsBody');
    body.innerHTML = '<div class="loader"></div>';

    try {
      const resp = await fetch(`/api/orders/${orderId}`);
      const data = await resp.json();
      
      if (resp.ok) {
        const order = data.data.order;
        body.innerHTML = `
          <div class="order-details-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap: 24px;">
            <div>
              <h4 style="margin-bottom:8px; color:var(--color-secondary); font-size:12px; text-transform:uppercase;">📦 Commande</h4>
              <p><strong>N° ${order.order_number}</strong></p>
              <p>Date: ${UI.formatDate(order.created_at)}</p>
              <p>Statut: <span class="badge badge-info">${order.status}</span></p>
            </div>
            <div>
              <h4 style="margin-bottom:8px; color:var(--color-secondary); font-size:12px; text-transform:uppercase;">👤 Client</h4>
              <p><strong>${order.customer_name}</strong></p>
              <p>${order.customer_phone}</p>
              <p>${order.customer_address || 'Pas d\'adresse'}</p>
            </div>
          </div>
          <div style="margin-top:24px; padding-top:24px; border-top:1px solid var(--color-border);">
            <h4 style="margin-bottom:12px; font-size:14px;">Articles</h4>
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--color-surface); padding:12px; border-radius:4px;">
              <span>${order.product_name} x ${order.quantity}</span>
              <strong>${UI.formatCurrency(order.total_amount, order.currency)}</strong>
            </div>
          </div>
          ${order.notes ? `
          <div style="margin-top:16px;">
            <h4 style="font-size:12px; color:var(--color-secondary);">NOTES</h4>
            <p style="font-style:italic;">${order.notes}</p>
          </div>` : ''}
        `;
      } else {
        body.innerHTML = '<p class="text-error">Erreur lors du chargement des détails.</p>';
      }
    } catch (err) {
      body.innerHTML = '<p class="text-error">Erreur réseau.</p>';
    }
  });

  // Éditer commande
  AppUtils.delegate(document, 'click', '[data-action="edit-order"]', async (e) => {
    const btn = e.target.closest('[data-action="edit-order"]');
    const orderId = btn.dataset.orderId;
    
    UI.showLoader();
    if (availableProducts.length === 0) await loadProducts();

    try {
      const resp = await fetch(`/api/orders/${orderId}`);
      const data = await resp.json();
      
      if (resp.ok) {
        const order = data.data.order;
        document.getElementById('orderModalTitle').textContent = 'Modifier la commande';
        document.getElementById('submitOrderBtn').textContent = 'Mettre à jour';
        document.getElementById('orderId').value = order.id;
        document.getElementById('productId').value = order.product_id;
        document.getElementById('customerName').value = order.customer_name;
        document.getElementById('customerPhone').value = order.customer_phone;
        document.getElementById('customerAddress').value = order.customer_address || '';
        document.getElementById('quantity').value = order.quantity;
        document.getElementById('orderNotes').value = order.notes || '';
        document.getElementById('orderStatus').value = order.status;
        document.getElementById('statusGroup').style.display = 'block';
        
        calculateTotal();
        ModalManager.openModal('orderModal');
      }
    } catch (err) {
      UI.showNotification('Erreur', 'Impossible de charger la commande', 'error');
    } finally {
      UI.hideLoader();
    }
  });

  // --- SUBMISSIONS ---

  // Sauvegarde (Création / Mise à jour)
  orderForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const orderId = document.getElementById('orderId').value;
    const isEdit = !!orderId;
    
    const payload = {
      product_id: parseInt(document.getElementById('productId').value),
      customer_name: document.getElementById('customerName').value,
      customer_phone: document.getElementById('customerPhone').value,
      customer_address: document.getElementById('customerAddress').value,
      quantity: parseInt(document.getElementById('quantity').value),
      notes: document.getElementById('orderNotes').value,
      status: document.getElementById('orderStatus').value
    };

    UI.showLoader();
    try {
      const url = isEdit ? `/api/orders/${orderId}` : '/api/orders/manual';
      const method = isEdit ? 'PUT' : 'POST';
      
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (resp.ok) {
        UI.showNotification('Succès', isEdit ? 'Commande mise à jour' : 'Commande créée', 'success');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        const data = await resp.json();
        UI.showNotification('Erreur', data.message || 'Échec de l\'opération', 'error');
      }
    } catch (err) {
      UI.showNotification('Erreur', 'Erreur réseau', 'error');
    } finally {
      UI.hideLoader();
    }
  });

  // Mise à jour statut simplifiée
  statusForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const orderId = document.getElementById('statusOrderId').value;
    const status = document.getElementById('newStatus').value;

    UI.showLoader();
    try {
      const resp = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      
      if (resp.ok) {
        UI.showNotification('Succès', 'Statut mis à jour', 'success');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        UI.showNotification('Erreur', 'Échec de la mise à jour', 'error');
      }
    } catch (err) {
      UI.showNotification('Erreur', 'Erreur réseau', 'error');
    } finally {
      UI.hideLoader();
    }
  });

  // Export
  AppUtils.delegate(document, 'click', '[data-action="export-orders"]', () => {
    window.location.href = '/api/features/export/orders/excel';
  });
  
  // Pré-charger les produits au cas où
  loadProducts();
});
