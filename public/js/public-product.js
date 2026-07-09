/**
 * public/js/public-product.js
 * Gestion de la page produit publique (modal de commande, soumission du formulaire)
 * Les données produit sont lues depuis le bloc JSON SSR injecté dans la page.
 */

(function () {
  // ── Données injectées par le serveur (SSR JSON) ────────────────────────────
  let productData = {};
  let customMessage = '';
  try {
    const ssrProduct = document.getElementById('ssr-product-data');
    if (ssrProduct) {
      productData = JSON.parse(ssrProduct.textContent || '{}');
    }
    const ssrMsg = document.getElementById('ssr-custom-message-data');
    if (ssrMsg) {
      customMessage = JSON.parse(ssrMsg.textContent || '""');
    }
  } catch (e) {
    console.error('Erreur lecture données produit SSR:', e);
  }

  // ── Modal ──────────────────────────────────────────────────────────────────
  const overlay = document.getElementById('orderModalOverlay');

  document.getElementById('openOrderBtn')?.addEventListener('click', () => {
    overlay.classList.add('open');

    // Pré-remplir avec les infos sauvegardées
    const savedInfo = localStorage.getItem('aura_customer_info');
    if (savedInfo) {
      try {
        const info = JSON.parse(savedInfo);
        if (info.name)    document.getElementById('clientName').value    = info.name;
        if (info.phone)   document.getElementById('clientPhone').value   = info.phone;
        if (info.address) document.getElementById('clientAddress').value = info.address;
        const saveCheckbox = document.getElementById('saveInfo');
        if (saveCheckbox) saveCheckbox.checked = true;
      } catch (e) {}
    }
  });

  document.getElementById('closeModal')?.addEventListener('click', () => overlay.classList.remove('open'));
  document.getElementById('cancelOrder')?.addEventListener('click', () => overlay.classList.remove('open'));
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });

  // ── Soumission du formulaire ───────────────────────────────────────────────
  document.getElementById('publicOrderForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitOrder');

    const customer_name    = document.getElementById('clientName').value;
    const customer_phone   = document.getElementById('clientPhone').value;
    const customer_address = document.getElementById('clientAddress').value;

    // Sauvegarder dans le localStorage si la case est cochée
    const saveInfo = document.getElementById('saveInfo');
    if (saveInfo?.checked) {
      localStorage.setItem('aura_customer_info', JSON.stringify({
        name: customer_name,
        phone: customer_phone,
        address: customer_address
      }));
    } else {
      localStorage.removeItem('aura_customer_info');
    }

    btn.disabled     = true;
    btn.textContent  = 'Envoi...';

    const payload = {
      customer_name,
      customer_phone,
      quantity:         parseInt(document.getElementById('clientQuantity').value),
      customer_address,
      notes:            document.getElementById('clientNotes').value,
      product_id:       productData.id
    };

    try {
      const resp = await fetch('/api/public/orders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
      });
      const data = await resp.json();

      if (resp.ok) {
        overlay.classList.remove('open');
        const order = data.data.order;
        if (order.whatsapp_url) {
          window.location.href = order.whatsapp_url;
        } else {
          alert('✅ Commande envoyée ! Le vendeur vous contactera bientôt.');
        }
      } else {
        alert('Erreur : ' + (data.message || 'Veuillez réessayer.'));
      }
    } catch (err) {
      alert('Erreur réseau.');
    } finally {
      btn.disabled    = false;
      btn.textContent = '✅ Confirmer la commande';
    }
  });

  // ── Modale de Signalement (Report) ─────────────────────────────────────────
  const reportOverlay = document.getElementById('reportModalOverlay');
  document.getElementById('openReportModalBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    reportOverlay.classList.add('open');
  });

  const closeReportModal = () => {
    reportOverlay.classList.remove('open');
    document.getElementById('publicReportForm')?.reset();
  };

  document.getElementById('closeReportModal')?.addEventListener('click', closeReportModal);
  document.getElementById('cancelReport')?.addEventListener('click', closeReportModal);
  reportOverlay?.addEventListener('click', (e) => {
    if (e.target === reportOverlay) closeReportModal();
  });

  document.getElementById('publicReportForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitReport');
    const reason = document.getElementById('reportReason').value;
    const description = document.getElementById('reportDescription').value;

    if (!reason) {
      alert('Veuillez sélectionner une raison.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Envoi...';

    try {
      const resp = await fetch(`/api/reports/product/${productData.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, description })
      });
      
      if (resp.ok) {
        alert('Signalement envoyé. Merci de votre aide pour sécuriser Aura Marketplace.');
        closeReportModal();
      } else {
        const data = await resp.json();
        alert(data.message || 'Erreur lors du signalement.');
      }
    } catch (err) {
      alert('Erreur réseau.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Signaler';
    }
  });

})();
