document.addEventListener('DOMContentLoaded', () => {
  async function loadCustomers() {
    try {
      // In the new architecture, we use httpOnly cookies, so we don't need the Authorization header for fetch
      const response = await fetch('/api/dashboard');
      
      const data = await response.json();
      
      if (data.success && data.data && data.data.overview) {
        // Mettre à jour les stats
        const totalCustomers = document.getElementById('totalCustomers');
        const activeCustomers = document.getElementById('activeCustomers');
        const newCustomers = document.getElementById('newCustomers');

        if (totalCustomers) totalCustomers.textContent = data.data.overview.customers.total || 0;
        if (activeCustomers) activeCustomers.textContent = data.data.overview.customers.active_30_days || 0;
        if (newCustomers) newCustomers.textContent = 0; // TODO: ajouter dans l'API
      }

      // Pour l'instant, afficher un message
      renderEmptyCustomers();
    } catch (error) {
      console.error('Erreur chargement clients:', error);
      renderEmptyCustomers();
    }
  }

  function renderEmptyCustomers() {
    const tbody = document.getElementById('customersTableBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 64px;">
            <div class="empty-state">
              <div class="empty-state-icon">👥</div>
              <h3 class="empty-state-title">Gestion des clients</h3>
              <p class="empty-state-text">
                Les clients qui passent commande apparaîtront automatiquement ici.<br>
                Vous pourrez voir leur historique et les contacter facilement.
              </p>
            </div>
          </td>
        </tr>
      `;
    }
  }

  window.searchCustomers = function() {
    // TODO: Implémenter la recherche
  };

  window.contactCustomer = function(phone) {
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  // Charger les clients
  loadCustomers();
});
