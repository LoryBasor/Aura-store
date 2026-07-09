/**
 * public/js/admin/vendors.js
 * Gestion des interactions de la page vendeurs admin
 */

document.addEventListener('DOMContentLoaded', () => {
  const vendorActionsModal = document.getElementById('vendorActionsModal');
  const suspendModal = document.getElementById('suspendModal');
  const resetPasswordModal = document.getElementById('resetPasswordModal');
  const verifyModal = document.getElementById('verifyModal');

  // Fermeture des modals
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    });
  });

  // Action: Toggle Vérification direct depuis le tableau
  document.querySelectorAll('[data-action="toggle-verify"]').forEach(btn => {
    btn.addEventListener('click', async function() {
      const vendorId = this.dataset.vendorId;
      const isCurrentlyVerified = this.dataset.current === 'true';
      const endpoint = isCurrentlyVerified ? 'unverify' : 'verify';
      const actionLabel = isCurrentlyVerified ? 'retirer la vérification' : 'vérifier';

      if (!confirm(`Voulez-vous vraiment ${actionLabel} ce vendeur ?`)) return;

      UI.showLoader();
      try {
        const resp = await fetch(`/api/admin/vendors/${vendorId}/${endpoint}`, { method: 'POST' });
        if (resp.ok) {
          UI.showNotification('Succès', 'Statut mis à jour.', 'success');
          setTimeout(() => location.reload(), 1000);
        } else {
          const data = await resp.json();
          UI.showNotification('Erreur', data.message || 'Échec de l\'opération', 'error');
        }
      } catch (e) {
        UI.showNotification('Erreur', 'Erreur réseau', 'error');
      } finally {
        UI.hideLoader();
      }
    });
  });

  // Action: Ouvrir le menu d'actions (⚙️)
  document.querySelectorAll('[data-action="vendor-actions"]').forEach(btn => {
    btn.addEventListener('click', function() {
      const vendorId = this.dataset.vendorId;
      let vendors = [];
      try {
        const ssrEl = document.getElementById('ssr-vendors-data');
        if (ssrEl) {
          vendors = JSON.parse(ssrEl.textContent || '[]');
        }
      } catch(e) { console.error('Erreur lecture vendors SSR:', e); }

      const vendor = vendors.find(v => v.id == vendorId);
      if (!vendor) return;

      const body = document.getElementById('vendorActionsBody');
      body.innerHTML = `
        <div style="display:grid; gap:12px;">
          <button class="btn btn-secondary w-100" onclick="window.location.href='/admin/vendors/${vendorId}'">👁️ Voir les détails</button>
          
          ${vendor.account_status === 'active' 
            ? `<button class="btn btn-warning w-100" onclick="AdminVendors.openSuspendModal(${vendorId})">⛔ Suspendre le compte</button>`
            : `<button class="btn btn-success w-100" onclick="AdminVendors.activateVendor(${vendorId})">✅ Réactiver le compte</button>`
          }
          
          <button class="btn btn-primary w-100" onclick="AdminVendors.openResetPasswordModal(${vendorId})">🔑 Réinitialiser le mot de passe</button>
        </div>
      `;
      vendorActionsModal.classList.add('active');
    });
  });

  // Global actions object
  window.AdminVendors = {
    // SUSPENSION
    openSuspendModal(userId) {
      document.getElementById('suspendUserId').value = userId;
      vendorActionsModal.classList.remove('active');
      suspendModal.classList.add('active');
    },

    async activateVendor(userId) {
      if (!confirm('Voulez-vous vraiment réactiver ce vendeur ?')) return;
      UI.showLoader();
      try {
        const resp = await fetch(`/api/admin/vendors/${userId}/activate`, { method: 'POST' });
        const data = await resp.json();
        if (resp.ok) {
          UI.showNotification('Succès', 'Le vendeur a été réactivé.', 'success');
          setTimeout(() => location.reload(), 1000);
        } else {
          UI.showNotification('Erreur', data.message || 'Échec de la réactivation', 'error');
        }
      } catch (e) {
        UI.showNotification('Erreur', 'Erreur réseau', 'error');
      } finally {
        UI.hideLoader();
      }
    },

    // PASSWORD RESET
    openResetPasswordModal(userId) {
      document.getElementById('resetPasswordUserId').value = userId;
      document.getElementById('temporaryPasswordDisplay').style.display = 'none';
      vendorActionsModal.classList.remove('active');
      resetPasswordModal.classList.add('active');
    }
  };

  // Form: Suspend
  document.getElementById('suspendForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('suspendUserId').value;
    const reason = document.getElementById('suspendReason').value;

    UI.showLoader();
    try {
      const resp = await fetch(`/api/admin/vendors/${userId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const data = await resp.json();
      if (resp.ok) {
        UI.showNotification('Succès', 'Vendeur suspendu.', 'success');
        setTimeout(() => location.reload(), 1000);
      } else {
        UI.showNotification('Erreur', data.message, 'error');
      }
    } catch (e) {
      UI.showNotification('Erreur', 'Erreur réseau', 'error');
    } finally {
      UI.hideLoader();
    }
  });

  // Action: Confirm Reset Password
  document.getElementById('confirmResetPasswordBtn')?.addEventListener('click', async () => {
    const userId = document.getElementById('resetPasswordUserId').value;
    UI.showLoader();
    try {
      const resp = await fetch(`/api/admin/vendors/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ must_change_password: true })
      });
      const data = await resp.json();
      if (resp.ok) {
        document.getElementById('temporaryPasswordValue').textContent = data.data.temporary_password;
        document.getElementById('temporaryPasswordDisplay').style.display = 'block';
      } else {
        UI.showNotification('Erreur', data.message, 'error');
      }
    } catch (e) {
      UI.showNotification('Erreur', 'Erreur réseau', 'error');
    } finally {
      UI.hideLoader();
    }
  });

  // Copy Password
  document.getElementById('copyPasswordBtn')?.addEventListener('click', () => {
    const pass = document.getElementById('temporaryPasswordValue').textContent;
    navigator.clipboard.writeText(pass);
    UI.showNotification('Copié', 'Mot de passe copié dans le presse-papier', 'success');
  });
});
