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

  // Petit helper pour ne jamais laisser une erreur JS interrompre les autres
  // listeners de la page (chaque bloc est isolé).
  function safe(fn) {
    return function (...args) {
      try {
        return fn.apply(this, args);
      } catch (err) {
        console.error('Erreur dans public-product.js:', err);
      }
    };
  }

  // ── Modal Commande ───────────────────────────────────────────────────────
  const overlay = document.getElementById('orderModalOverlay');

  document.getElementById('openOrderBtn')?.addEventListener('click', safe(() => {
    if (!overlay) return;
    overlay.classList.add('open');

    // Pré-remplir avec les infos sauvegardées (peut échouer en navigation
    // privée / localStorage désactivé : ça ne doit jamais bloquer l'ouverture
    // de la modale).
    try {
      const savedInfo = localStorage.getItem('aura_customer_info');
      if (savedInfo) {
        const info = JSON.parse(savedInfo);
        const nameEl    = document.getElementById('clientName');
        const phoneEl   = document.getElementById('clientPhone');
        const addressEl = document.getElementById('clientAddress');
        const saveCheckbox = document.getElementById('saveInfo');
        if (info.name && nameEl)       nameEl.value    = info.name;
        if (info.phone && phoneEl)     phoneEl.value   = info.phone;
        if (info.address && addressEl) addressEl.value = info.address;
        if (saveCheckbox) saveCheckbox.checked = true;
      }
    } catch (e) {
      console.warn('Impossible de lire les infos sauvegardées:', e);
    }
  }));

  document.getElementById('closeModal')?.addEventListener('click', safe(() => overlay?.classList.remove('open')));
  document.getElementById('cancelOrder')?.addEventListener('click', safe(() => overlay?.classList.remove('open')));
  overlay?.addEventListener('click', safe((e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  }));

  // ── Soumission du formulaire de commande ─────────────────────────────────
  document.getElementById('publicOrderForm')?.addEventListener('submit', safe(async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitOrder');

    const customer_name    = document.getElementById('clientName')?.value || '';
    const customer_phone   = document.getElementById('clientPhone')?.value || '';
    const customer_address = document.getElementById('clientAddress')?.value || '';

    // Sauvegarder dans le localStorage si la case est cochée (best-effort)
    try {
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
    } catch (e) {
      console.warn('localStorage indisponible, infos non sauvegardées:', e);
    }

    if (btn) {
      btn.disabled    = true;
      btn.textContent = 'Envoi...';
    }

    const payload = {
      customer_name,
      customer_phone,
      quantity:         parseInt(document.getElementById('clientQuantity')?.value, 10) || 1,
      customer_address,
      notes:            document.getElementById('clientNotes')?.value || '',
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
        const order = data?.data?.order;
        
        // --- NOUVEAU FLUX WHATSAPP AUTOMATIQUE ---
        if (order?.whatsapp?.mode === 'queued') {
          if (btn) {
            btn.textContent = 'Préparation de WhatsApp... ⏳';
            btn.disabled = true;
          }
          
          let attempts = 0;
          const maxAttempts = 20; // 40 secondes d'attente max
          
          const poll = setInterval(async () => {
            attempts++;
            try {
              const resJob = await fetch(`/api/public/orders/job/${order.whatsapp.jobId}`);
              if (!resJob.ok) throw new Error('Job not found');
              
              const dataJob = await resJob.json();
              const status = dataJob?.data?.job?.status;
              
              if (status === 'SENT') {
                clearInterval(poll);
                let num = dataJob.data.job.vendor_whatsapp_number.replace(/[^\d]/g, '');
                if (num.length === 9) num = '237' + num;
                window.location.href = `https://wa.me/${num}`;
              } else if (status === 'FAILED' || status === 'CANCELLED' || attempts > maxAttempts) {
                clearInterval(poll);
                alert("Nous n'avons pas pu préparer automatiquement votre conversation WhatsApp. Redirection classique...");
                window.location.href = order.whatsapp.fallback_url;
              }
            } catch (err) {
              clearInterval(poll);
              window.location.href = order.whatsapp.fallback_url;
            }
          }, 2000);
          
          return; // On ne réactive pas le bouton pour l'instant, on sort
        }
        
        // --- FLUX CLASSIQUE / FALLBACK ---
        overlay?.classList.remove('open');
        if (order?.whatsapp?.mode === 'classic' && order.whatsapp.whatsapp_url) {
          window.location.href = order.whatsapp.whatsapp_url;
        } else if (order?.whatsapp_url) {
          window.location.href = order.whatsapp_url;
        } else {
          alert('✅ Commande envoyée ! Le vendeur vous contactera bientôt.');
        }
      } else {
        alert('Erreur : ' + (data?.message || 'Veuillez réessayer.'));
      }
    } catch (err) {
      alert('Erreur réseau.');
    }
    
    // Réactivation du bouton par défaut (sauf si mode queued, où on a fait un return plus haut)
    if (btn) {
      btn.disabled    = false;
      btn.textContent = '✅ Confirmer la commande';
    }
  }));

  // ── Modale de Signalement (Report) ───────────────────────────────────────
  const reportOverlay = document.getElementById('reportModalOverlay');

  document.getElementById('openReportModalBtn')?.addEventListener('click', safe((e) => {
    e.preventDefault();
    reportOverlay?.classList.add('open');
  }));

  const closeReportModal = safe(() => {
    reportOverlay?.classList.remove('open');
    document.getElementById('publicReportForm')?.reset();
  });

  document.getElementById('closeReportModal')?.addEventListener('click', closeReportModal);
  document.getElementById('cancelReport')?.addEventListener('click', closeReportModal);
  reportOverlay?.addEventListener('click', safe((e) => {
    if (e.target === reportOverlay) closeReportModal();
  }));

  document.getElementById('publicReportForm')?.addEventListener('submit', safe(async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitReport');
    const reason = document.getElementById('reportReason')?.value || '';
    const description = document.getElementById('reportDescription')?.value || '';

    if (!reason) {
      alert('Veuillez sélectionner une raison.');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Envoi...';
    }

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
        alert(data?.message || 'Erreur lors du signalement.');
      }
    } catch (err) {
      alert('Erreur réseau.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Signaler';
      }
    }
  }));

})();