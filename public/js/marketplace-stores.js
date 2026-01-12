// public/js/marketplace-stores.js
// Gestion des filtres et du tri pour la page boutiques du marketplace

document.addEventListener('DOMContentLoaded', () => {
  const filterForm = document.getElementById('filterForm');
  const filterToggle = document.getElementById('filterToggle');
  const filtersSidebar = document.querySelector('.filters-sidebar');
  const sortSelect = document.getElementById('sortSelect');
  const storesContainer = document.getElementById('storesContainer');
  const resultsCount = document.getElementById('resultsCount');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const pagination = document.getElementById('pagination');
  const searchInput = document.getElementById('storeSearchInput');
  const searchBtn = document.getElementById('storeSearchBtn');
  const citySelect = filterForm.querySelector('select[name="city"]');
  const countrySelect = filterForm.querySelector('select[name="country"]');

  let currentOffset = 0;
  const limit = 20;
  let allStores = [];

  // Toggle menu responsive
  if (filterToggle) {
    filterToggle.addEventListener('click', () => {
      filtersSidebar.classList.toggle('open');
    });
  }

  // Fermer le menu quand on clique en dehors
  document.addEventListener('click', (e) => {
    if (filterToggle && !filterToggle.contains(e.target) && !filtersSidebar.contains(e.target)) {
      filtersSidebar.classList.remove('open');
    }
  });

  /**
   * Récupère les filtres actuels du formulaire
   */
  function getFilters() {
    return {
      search: searchInput ? searchInput.value.trim().toLowerCase() : '',
      city: citySelect.value || '',
      country: countrySelect.value || '',
      sort: sortSelect.value,
      limit,
      offset: currentOffset
    };
  }

  /**
   * Filtre les boutiques côté client
   */
  function filterStores() {
    const filters = getFilters();
    
    let filtered = allStores.filter(store => {
      // Filtre recherche
      if (filters.search && !store.business_name.toLowerCase().includes(filters.search)) {
        return false;
      }
      
      // Filtre ville
      if (filters.city && store.city !== filters.city) {
        return false;
      }
      
      // Filtre pays
      if (filters.country && store.country !== filters.country) {
        return false;
      }
      
      return true;
    });

    // Tri
    if (filters.sort === 'recent') {
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (filters.sort === 'popular') {
      filtered.sort((a, b) => (b.total_views || 0) - (a.total_views || 0));
    }

    // Pagination
    const paginated = filtered.slice(currentOffset, currentOffset + limit);
    
    renderStores(paginated);
    resultsCount.textContent = filtered.length;
    updatePagination(filtered.length);
  }

  /**
   * Charge les boutiques avec les filtres actuels
   */
  async function loadStores() {
    try {
      loadingIndicator.style.display = 'block';
      currentOffset = 0;
      const filters = getFilters();

      // Construire l'URL avec les paramètres
      const params = new URLSearchParams();
      if (filters.city) params.append('city', filters.city);
      if (filters.country) params.append('country', filters.country);
      params.append('sort', filters.sort);
      params.append('limit', 1000);
      params.append('offset', 0);

      const response = await fetch(`/api/marketplace/api/stores?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Mettre à jour les résultats
      if (data.success && data.data) {
        allStores = data.data.stores || [];
        filterStores();
        
        // Scroll vers les boutiques
        storesContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch (error) {
      console.error('Erreur lors du chargement des boutiques:', error);
      storesContainer.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; padding: 2rem;">Erreur lors du chargement des boutiques. Veuillez réessayer.</p>';
    } finally {
      loadingIndicator.style.display = 'none';
    }
  }

  /**
   * Affiche les boutiques
   */
  function renderStores(stores) {
    if (stores.length === 0) {
      storesContainer.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; padding: 2rem;">Aucune boutique trouvée avec vos critères.</p>';
      return;
    }

    // storesContainer.innerHTML = stores.map(store => `
    //   <a href="/store/${store.store_slug}" class="store-card">
    //     ${store.logo_url ? `<img src="${store.logo_url}" alt="${store.business_name}" class="store-logo">` : '<div class="store-logo" style="display: flex; align-items: center; justify-content: center; color: var(--color-text-light);">📦</div>'}
    //     <div class="store-header">
    //       <div class="store-name">${store.business_name}</div>
    //       ${store.city ? `<div class="store-location">📍 ${store.city}, ${store.country || ''}</div>` : ''}
    //       <div class="store-badge">✓ Actif</div>
    //     </div>
    //     <div class="store-stats">
    //       <span><strong>${store.product_count}</strong> produits</span>
    //       <span><strong>${store.total_views}</strong> vues</span>
    //     </div>
    //   </a>
    // `).join('');
  }

  /**
   * Met à jour l'état des boutons de pagination
   */
  function updatePagination(total) {
    const hasNextPage = currentOffset + limit < total;
    const hasPrevPage = currentOffset > 0;

    prevBtn.disabled = !hasPrevPage;
    nextBtn.disabled = !hasNextPage;

    const currentPage = Math.floor(currentOffset / limit) + 1;
    const totalPages = Math.ceil(total / limit);
    pagination.textContent = `Page ${currentPage} / ${totalPages}`;
  }

  // Événements des filtres - Application en temps réel
  citySelect.addEventListener('change', () => {
    currentOffset = 0;
    filterStores();
  });
  
  countrySelect.addEventListener('change', () => {
    currentOffset = 0;
    filterStores();
  });
  
  sortSelect.addEventListener('change', () => {
    currentOffset = 0;
    filterStores();
  });

  // Recherche
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentOffset = 0;
      filterStores();
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      currentOffset = 0;
      filterStores();
    });
  }

  // Pagination
  prevBtn.addEventListener('click', () => {
    currentOffset = Math.max(0, currentOffset - limit);
    filterStores();
  });

  nextBtn.addEventListener('click', () => {
    currentOffset += limit;
    filterStores();
  });

  // Charger les boutiques au chargement initial
  loadStores();
});
