/**
 * public/js/public-store.js
 * Logique front-end pour la page publique d'une boutique (Marketplace)
 * Gère notamment la modale de signalement.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ── Données SSR ──────────────────────────────────────────────────────────
  const ssrDataElement = document.getElementById('ssr-store-data');
  if (!ssrDataElement) return;
  
  let storeData;
  try {
    storeData = JSON.parse(ssrDataElement.textContent);
  } catch (e) {
    console.error('Erreur parsing SSR store data', e);
    return;
  }

  const vendorId = storeData.vendorId;

  // ── Modale de Signalement (Store) ─────────────────────────────────────────
  const reportOverlay = document.getElementById('storeReportModalOverlay');
  const openBtn = document.getElementById('openStoreReportBtn');
  const closeBtn = document.getElementById('closeStoreReportModal');
  const cancelBtn = document.getElementById('cancelStoreReport');
  const form = document.getElementById('publicStoreReportForm');

  if (reportOverlay && openBtn) {
    const closeReportModal = () => {
      reportOverlay.classList.remove('open');
      if (form) form.reset();
    };

    openBtn.addEventListener('click', (e) => {
      e.preventDefault();
      reportOverlay.classList.add('open');
    });

    if (closeBtn) closeBtn.addEventListener('click', closeReportModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeReportModal);
    
    reportOverlay.addEventListener('click', (e) => {
      if (e.target === reportOverlay) closeReportModal();
    });

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('submitStoreReport');
        const reason = document.getElementById('storeReportReason').value;
        const description = document.getElementById('storeReportDescription').value;

        if (!reason) {
          alert('Veuillez sélectionner une raison.');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Envoi...';

        try {
          const resp = await fetch(`/api/reports/store/${vendorId}`, {
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
          alert('Erreur réseau. Veuillez réessayer.');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Signaler';
        }
      });
    }
  }
});
