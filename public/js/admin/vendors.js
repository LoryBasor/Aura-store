/**
 * public/js/admin/vendors.js
 * ========================================
 * GESTION DES VENDEURS - SUPER ADMIN
 * ========================================
 */

const AdminVendors = {
  currentPage: 1,
  currentStatus: null,
  currentSearch: '',

  init() {
    this.attachEventListeners();
    this.loadVendors();
  },

  attachEventListeners() {
    // Recherche
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        this.currentSearch = searchInput.value.trim();
        this.currentPage = 1;
        this.loadVendors();
      });
    }

    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.currentSearch = searchInput.value.trim();
          this.currentPage = 1;
          this.loadVendors();
        }
      });
    }

    // Filtre statut
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.currentStatus = e.target.value || null;
        this.currentPage = 1;
        this.loadVendors();
      });
    }

    // Export
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportVendors());
    }

    // Form suspension
    const suspendForm = document.getElementById('suspendForm');
    if (suspendForm) {
      suspendForm.addEventListener('submit', (e) => this.handleSuspend(e));
    }

    // Reset password
    const confirmResetBtn = document.getElementById('confirmResetPasswordBtn');
    if (confirmResetBtn) {
      confirmResetBtn.addEventListener('click', () => this.handleResetPassword());
    }

    const copyPasswordBtn = document.getElementById('copyPasswordBtn');
    if (copyPasswordBtn) {
      copyPasswordBtn.addEventListener('click', () => this.copyTemporaryPassword());
    }
  },

  async loadVendors(page = 1) {
    this.currentPage = page;
    
    try {
      let url = `/admin/vendors`;
      // if (this.currentStatus) url += `&status=${this.currentStatus}`;
      // if (this.currentSearch) url += `&search=${encodeURIComponent(this.currentSearch)}`;

      const data = await API.get(url, true);
      
      if (data && data.data) {
        this.renderVendorsTable(data.data.vendors);
        // this.renderPagination(data.data.pagination);
      }
    } catch (error) {
      console.error('Erreur chargement vendeurs:', error);
      UI.showNotification('Erreur', 'Impossible de charger les vendeurs', 'error');
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
          <div style="font-weight: 700; color: var(--color-primary); margin-bottom: 4px;">
            ${vendor.business_name}
          </div>
          <div style="font-size: 13px; color: var(--color-secondary);">
            ${vendor.store_slug}
          </div>
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
          <span class="badge badge-${statusColors[vendor.account_status]}">
            ${statusLabels[vendor.account_status]}
          </span>
        </td>
        <td style="font-size: 13px; color: var(--color-secondary);">
          ${UI.formatRelativeDate(vendor.created_at)}
        </td>
        <td>
          <div class="table-actions">
            <button class="table-action-btn" data-action="view-vendor" data-vendor-id="${vendor.id}" title="Voir détails">
              👁️
            </button>
            <button class="table-action-btn" data-action="vendor-actions" data-vendor-id="${vendor.id}" title="Actions">
              ⚙️
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    // Attacher les événements après le rendu
    this.attachTableActions();
  },

  attachTableActions() {
    // Voir détails
    document.querySelectorAll('[data-action="view-vendor"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const vendorId = e.target.closest('[data-vendor-id]').dataset.vendorId;
        window.location.href = `/admin/vendors/${vendorId}`;
      });
    });

    // Actions
    document.querySelectorAll('[data-action="vendor-actions"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const vendorId = e.target.closest('[data-vendor-id]').dataset.vendorId;
        this.openVendorActions(vendorId);
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
      html += `<button class="btn btn-secondary btn-sm" id="prevPage">← Précédent</button>`;
    }

    html += `<span style="padding: 8px 16px; color: var(--color-secondary);">Page ${page} sur ${totalPages} (${total} vendeurs)</span>`;

    if (page < totalPages) {
      html += `<button class="btn btn-secondary btn-sm" id="nextPage">Suivant →</button>`;
    }

    container.innerHTML = html;

    // Attacher événements pagination
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.loadVendors(this.currentPage - 1));
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.loadVendors(this.currentPage + 1));
    }
  },

  async openVendorActions(id) {
    try {
      const data = await API.get(`/admin/vendors/${id}`, true);

      if (data && data.data) {
        const vendor = data.data.user;
        const body = document.getElementById('vendorActionsBody');

        const isSuspended = vendor.account_status === 'suspended';
        const isDeactivated = vendor.account_status === 'deactivated';

        body.innerHTML = `
          <div style="margin-bottom: 24px; padding: 16px; background: var(--color-surface); border-radius: var(--radius-sm);">
            <h4 style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">${vendor.business_name}</h4>
            <p style="color: var(--color-secondary); margin-bottom: 4px;">${vendor.email}</p>
            <span class="badge badge-${vendor.account_status === 'active' ? 'success' : 'error'}">
              ${vendor.account_status}
            </span>
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

            ${!isDeactivated ? 
              `<button class="btn btn-warning w-full" data-action="deactivate-vendor" data-vendor-id="${id}">
                🚫 Désactiver définitivement
              </button>` : ''
            }
            
            <button class="btn btn-secondary w-full" data-action="reset-password" data-vendor-id="${id}">
              🔑 Réinitialiser mot de passe
            </button>
            
            <button class="btn btn-outline w-full" data-action="view-vendor-details" data-vendor-id="${id}">
              👁️ Voir tous les détails
            </button>
          </div>
        `;

        // Attacher événements actions
        this.attachActionButtons(id);

        ModalManager.openModal('vendorActionsModal');
      }
    } catch (error) {
      console.error('Erreur chargement vendeur:', error);
      UI.showNotification('Erreur', 'Impossible de charger les détails', 'error');
    }
  },

  attachActionButtons(vendorId) {
    // Suspendre
    const suspendBtn = document.querySelector('[data-action="suspend-vendor"]');
    if (suspendBtn) {
      suspendBtn.addEventListener('click', () => this.openSuspendModal(vendorId));
    }

    // Activer
    const activateBtn = document.querySelector('[data-action="activate-vendor"]');
    if (activateBtn) {
      activateBtn.addEventListener('click', () => this.activateVendor(vendorId));
    }

    // Désactiver
    const deactivateBtn = document.querySelector('[data-action="deactivate-vendor"]');
    if (deactivateBtn) {
      deactivateBtn.addEventListener('click', () => this.deactivateVendor(vendorId));
    }

    // Reset password
    const resetBtn = document.querySelector('[data-action="reset-password"]');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.openResetPasswordModal(vendorId));
    }

    // Voir détails
    const viewBtn = document.querySelector('[data-action="view-vendor-details"]');
    if (viewBtn) {
      viewBtn.addEventListener('click', () => {
        window.location.href = `/admin/vendors/${vendorId}`;
      });
    }
  },

  openSuspendModal(userId) {
    document.getElementById('suspendUserId').value = userId;
    document.getElementById('suspendReason').value = '';
    ModalManager.closeModal('vendorActionsModal');
    ModalManager.openModal('suspendModal');
  },

  async handleSuspend(e) {
    e.preventDefault();

    const userId = document.getElementById('suspendUserId').value;
    const reason = document.getElementById('suspendReason').value.trim();

    if (!reason) {
      UI.showNotification('Erreur', 'Veuillez préciser une raison', 'error');
      return;
    }

    try {
      await API.post(`/admin/vendors/${userId}/suspend`, { reason }, true);
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
        await API.post(`/admin/vendors/${id}/activate`, {}, true);
        UI.showNotification('Succès', 'Vendeur réactivé', 'success');
        ModalManager.closeModal('vendorActionsModal');
        this.loadVendors(this.currentPage);
      } catch (error) {
        console.error('Erreur réactivation:', error);
      }
    }
  },

  async deactivateVendor(id) {
    const confirmed = await UI.confirm(
      'Désactiver définitivement',
      'Cette action est définitive. Le vendeur ne pourra plus se connecter. Confirmer ?'
    );

    if (confirmed) {
      try {
        await API.post(`/admin/vendors/${id}/deactivate`, {}, true);
        UI.showNotification('Succès', 'Vendeur désactivé', 'success');
        ModalManager.closeModal('vendorActionsModal');
        this.loadVendors(this.currentPage);
      } catch (error) {
        console.error('Erreur désactivation:', error);
      }
    }
  },

  openResetPasswordModal(userId) {
    document.getElementById('resetPasswordUserId').value = userId;
    document.getElementById('temporaryPasswordDisplay').style.display = 'none';
    document.getElementById('confirmResetPasswordBtn').style.display = 'block';
    ModalManager.closeModal('vendorActionsModal');
    ModalManager.openModal('resetPasswordModal');
  },

  async handleResetPassword() {
    const userId = document.getElementById('resetPasswordUserId').value;

    try {
      const data = await API.post(`/admin/vendors/${userId}/reset-password`, {}, true);

      if (data && data.data && data.data.temporary_password) {
        document.getElementById('temporaryPasswordValue').textContent = data.data.temporary_password;
        document.getElementById('temporaryPasswordDisplay').style.display = 'block';
        document.getElementById('confirmResetPasswordBtn').style.display = 'none';
        
        UI.showNotification('Succès', 'Mot de passe réinitialisé', 'success');
      }
    } catch (error) {
      console.error('Erreur reset password:', error);
    }
  },

  copyTemporaryPassword() {
    const password = document.getElementById('temporaryPasswordValue').textContent;
    navigator.clipboard.writeText(password).then(() => {
      UI.showNotification('Copié !', 'Mot de passe copié dans le presse-papier', 'success');
    });
  },

  exportVendors() {
    UI.showNotification('Export', 'Fonctionnalité à venir', 'info');
  }
};

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('vendorsTableBody')) {
    AdminVendors.init();
  }
});