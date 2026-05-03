/**
 * public/js/orders.js
 * Gestion des commandes - 100% SSR-compatible
 * - Les produits sont injectés via window.__SSR_PRODUCTS__ (rendu serveur)
 * - Les appels API utilisent les cookies httpOnly (pas de token localStorage)
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Données injectées par le serveur ──────────────────────────────────────
  const orders = window.__SSR_ORDERS__ || [];
  const availableProducts = window.__SSR_PRODUCTS__ || [];

  // ── Éléments du DOM ───────────────────────────────────────────────────────
  const orderForm       = document.getElementById('orderForm');
  const statusForm      = document.getElementById('statusForm');
  const productIdSelect = document.getElementById('productId');
  const productSearch   = document.getElementById('productSearch');
  const totalDisplay    = document.getElementById('totalAmountDisplay');
  const totalAmountEl   = document.getElementById('totalAmount');
  const quantityInput   = document.getElementById('quantity');

  // ── Remplissage initial de la liste déroulante ───────────────────────────
  function populateProductSelect(filter = '') {
    if (!productIdSelect) return;

    productIdSelect.innerHTML = '<option value="">-- Sélectionner un produit --</option>';
    const lower = filter.toLowerCase();

    const filtered = availableProducts.filter(p =>
      p.name.toLowerCase().includes(lower)
    );

    if (filtered.length === 0) {
      const opt = document.createElement('option');
      opt.disabled = true;
      opt.textContent = filter
        ? 'Aucun résultat pour "' + filter + '"'
        : 'Aucun produit disponible';
      productIdSelect.appendChild(opt);
      return;
    }

    filtered.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name}  —  ${UI.formatCurrency(p.price, p.currency)}`;
      if (!p.is_available) {
        opt.disabled = true;
        opt.textContent += ' (indisponible)';
      }
      productIdSelect.appendChild(opt);
    });
  }

  // Pré-remplir dès le chargement de la page
  populateProductSelect();

  // Filtre de recherche en temps réel
  if (productSearch) {
    productSearch.addEventListener('input', e => {
      populateProductSelect(e.target.value);
      calculateTotal();
    });
  }

  // ── Calcul du montant total ───────────────────────────────────────────────
  function calculateTotal() {
    const id  = productIdSelect ? productIdSelect.value : '';
    const qty = parseInt(quantityInput ? quantityInput.value : 0) || 0;
    const product = availableProducts.find(p => p.id == id);

    if (product && qty > 0) {
      totalAmountEl.textContent = UI.formatCurrency(product.price * qty, product.currency);
      totalDisplay.style.display = 'block';
    } else {
      totalDisplay.style.display = 'none';
    }
  }

  if (productIdSelect) productIdSelect.addEventListener('change', calculateTotal);
  if (quantityInput)   quantityInput.addEventListener('input',  calculateTotal);

  // ── Réinitialisation du modal commande ────────────────────────────────────
  function resetOrderModal(title = 'Nouvelle commande', btnLabel = 'Créer la commande') {
    const modalTitle = document.getElementById('orderModalTitle');
    const submitBtn  = document.getElementById('submitOrderBtn');
    const orderId    = document.getElementById('orderId');
    const statusGrp  = document.getElementById('statusGroup');

    if (modalTitle) modalTitle.textContent = title;
    if (submitBtn)  submitBtn.textContent  = btnLabel;
    if (orderId)    orderId.value = '';
    if (statusGrp)  statusGrp.style.display = 'none';
    if (orderForm)  orderForm.reset();
    if (totalDisplay) totalDisplay.style.display = 'none';

    // Vider la recherche et recharger la liste complète
    if (productSearch) productSearch.value = '';
    populateProductSelect();
  }

  // ── ACTION : Nouvelle commande ────────────────────────────────────────────
  AppUtils.delegate(document, 'click', '[data-action="new-order"]', () => {
    resetOrderModal();
    ModalManager.openModal('orderModal');
  });

  // ── ACTION : Changer le statut ────────────────────────────────────────────
  AppUtils.delegate(document, 'click', '[data-action="change-status"]', e => {
    const btn = e.target.closest('[data-action="change-status"]');
    document.getElementById('statusOrderId').value = btn.dataset.orderId;
    document.getElementById('newStatus').value     = btn.dataset.status;
    ModalManager.openModal('statusModal');
  });

  // ── ACTION : Voir les détails d'une commande ──────────────────────────────
  AppUtils.delegate(document, 'click', '[data-action="view-order"]', async e => {
    const btn     = e.target.closest('[data-action="view-order"]');
    const orderId = btn.dataset.orderId;

    ModalManager.openModal('orderDetailsModal');
    const body = document.getElementById('orderDetailsBody');
    body.innerHTML = '<div class="loader"></div>';

    try {
      // Le cookie aura_token est envoyé automatiquement par le navigateur
      const resp = await fetch(`/api/orders/${orderId}`);
      const data = await resp.json();

      if (resp.ok) {
        const order = data.data.order;
        body.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;">
            <div>
              <h4 style="margin-bottom:8px;color:var(--color-secondary);font-size:12px;text-transform:uppercase;">📦 Commande</h4>
              <p><strong>N° ${order.order_number}</strong></p>
              <p>Date : ${UI.formatDate(order.created_at)}</p>
              <p>Statut : <span class="badge badge-info">${order.status}</span></p>
            </div>
            <div>
              <h4 style="margin-bottom:8px;color:var(--color-secondary);font-size:12px;text-transform:uppercase;">👤 Client</h4>
              <p><strong>${order.customer_name}</strong></p>
              <p>${order.customer_phone}</p>
              <p>${order.customer_address || 'Pas d\'adresse'}</p>
            </div>
          </div>
          <div style="padding-top:16px;border-top:1px solid var(--color-border);">
            <h4 style="margin-bottom:12px;font-size:14px;">Articles</h4>
            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--color-surface);padding:12px;border-radius:4px;">
              <span>${order.product_name} × ${order.quantity}</span>
              <strong>${UI.formatCurrency(order.total_amount, order.currency)}</strong>
            </div>
          </div>
          ${order.notes ? `<div style="margin-top:16px;"><h4 style="font-size:12px;color:var(--color-secondary);">NOTES</h4><p style="font-style:italic;">${order.notes}</p></div>` : ''}
        `;
      } else {
        body.innerHTML = '<p class="text-error">Erreur lors du chargement des détails.</p>';
      }
    } catch {
      body.innerHTML = '<p class="text-error">Erreur réseau.</p>';
    }
  });

  // ── ACTION : Éditer une commande ──────────────────────────────────────────
  AppUtils.delegate(document, 'click', '[data-action="edit-order"]', async e => {
    const btn     = e.target.closest('[data-action="edit-order"]');
    const orderId = btn.dataset.orderId;

    UI.showLoader();
    try {
      const resp = await fetch(`/api/orders/${orderId}`);
      const data = await resp.json();

      if (resp.ok) {
        const o = data.data.order;

        resetOrderModal('Modifier la commande', 'Mettre à jour');
        document.getElementById('orderId').value          = o.id;
        document.getElementById('productId').value        = o.product_id;
        document.getElementById('customerName').value     = o.customer_name;
        document.getElementById('customerPhone').value    = o.customer_phone;
        document.getElementById('customerAddress').value  = o.customer_address || '';
        document.getElementById('quantity').value         = o.quantity;
        document.getElementById('orderNotes').value       = o.notes || '';
        document.getElementById('orderStatus').value      = o.status;
        document.getElementById('statusGroup').style.display = 'block';

        calculateTotal();
        ModalManager.openModal('orderModal');
      }
    } catch {
      UI.showNotification('Erreur', 'Impossible de charger la commande', 'error');
    } finally {
      UI.hideLoader();
    }
  });

  // ── SOUMISSION : Créer ou Modifier une commande ───────────────────────────
  if (orderForm) {
    orderForm.addEventListener('submit', async e => {
      e.preventDefault();

      const orderId = document.getElementById('orderId').value;
      const isEdit  = !!orderId;

      const payload = {
        product_id:       parseInt(document.getElementById('productId').value),
        customer_name:    document.getElementById('customerName').value.trim(),
        customer_phone:   document.getElementById('customerPhone').value.trim(),
        customer_address: document.getElementById('customerAddress').value.trim(),
        quantity:         parseInt(document.getElementById('quantity').value),
        notes:            document.getElementById('orderNotes').value.trim(),
        status:           document.getElementById('orderStatus') ? document.getElementById('orderStatus').value : 'nouvelle'
      };

      if (!payload.product_id) {
        UI.showNotification('Erreur', 'Veuillez sélectionner un produit', 'error');
        return;
      }

      UI.showLoader();
      try {
        const url    = isEdit ? `/api/orders/${orderId}` : '/api/orders/manual';
        const method = isEdit ? 'PUT' : 'POST';

        // Le cookie est envoyé automatiquement — pas besoin d'Authorization header
        const resp = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (resp.ok) {
          UI.showNotification('Succès', isEdit ? 'Commande mise à jour' : 'Commande créée avec succès', 'success');
          setTimeout(() => window.location.reload(), 1000);
        } else {
          const data = await resp.json();
          UI.showNotification('Erreur', data.message || 'Échec de l\'opération', 'error');
        }
      } catch {
        UI.showNotification('Erreur', 'Erreur réseau', 'error');
      } finally {
        UI.hideLoader();
      }
    });
  }

  // ── SOUMISSION : Mise à jour du statut ────────────────────────────────────
  if (statusForm) {
    statusForm.addEventListener('submit', async e => {
      e.preventDefault();

      const orderId = document.getElementById('statusOrderId').value;
      const status  = document.getElementById('newStatus').value;

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
      } catch {
        UI.showNotification('Erreur', 'Erreur réseau', 'error');
      } finally {
        UI.hideLoader();
      }
    });
  }

  // ── ACTION : Export ───────────────────────────────────────────────────────
  AppUtils.delegate(document, 'click', '[data-action="export-orders"]', () => {
    window.location.href = '/api/features/export/orders/excel';
  });

});
