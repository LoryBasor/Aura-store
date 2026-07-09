document.addEventListener('DOMContentLoaded', () => {
  // Filtrage des produits
  const searchInput = document.getElementById('productSearch');
  const statusFilter = document.getElementById('statusFilter');
  const tableRows = document.querySelectorAll('#productsTable tbody tr');

  function filterProducts() {
    if (!searchInput || !statusFilter) return;
    const searchTerm = searchInput.value.toLowerCase();
    const statusTerm = statusFilter.value;

    tableRows.forEach(row => {
      const name = row.dataset.name || '';
      const status = row.dataset.status || '';
      
      const matchesSearch = name.includes(searchTerm);
      const matchesStatus = statusTerm === 'all' || status === statusTerm;

      if (matchesSearch && matchesStatus) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  }

  if (searchInput) searchInput.addEventListener('input', filterProducts);
  if (statusFilter) statusFilter.addEventListener('change', filterProducts);

  // Actions Admin exposées globalement
  window.toggleProductStatus = async function(productId, isCurrentlyDisabled) {
    const action = isCurrentlyDisabled ? 'réactiver' : 'rendre indisponible';
    if (!confirm(`Êtes-vous sûr de vouloir ${action} ce produit ?`)) return;

    try {
      UI.showLoader();
      const resp = await fetch(`/api/admin/products/${productId}/toggle-admin-disable`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await resp.json();
      if (resp.ok) {
        UI.showNotification('Succès', data.message, 'success');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        UI.showNotification('Erreur', data.message, 'error');
      }
    } catch (err) {
      UI.showNotification('Erreur', 'Erreur réseau', 'error');
    } finally {
      UI.hideLoader();
    }
  };

  window.deleteProduct = async function(productId) {
    if (!confirm('Supprimer définitivement ce produit ? Cette action est irréversible.')) return;

    try {
      UI.showLoader();
      const resp = await fetch(`/api/admin/products/${productId}`, {
        method: 'DELETE'
      });

      const data = await resp.json();
      if (resp.ok) {
        UI.showNotification('Succès', 'Produit supprimé', 'success');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        UI.showNotification('Erreur', data.message, 'error');
      }
    } catch (err) {
      UI.showNotification('Erreur', 'Erreur réseau', 'error');
    } finally {
      UI.hideLoader();
    }
  };
});