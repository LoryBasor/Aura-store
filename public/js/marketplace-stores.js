// public/js/marketplace-stores.js
// Gestion CORRIGÉE des filtres, tri et pagination pour les boutiques

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
  const clearFiltersBtn = document.getElementById('clearFilters');

  let currentOffset = 0;
  const limit = 20;
  let allStores = [];
  let filteredStores = [];

  // === TOGGLE SIDEBAR MOBILE ===
  if (filterToggle) {
    filterToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      filtersSidebar.classList.toggle('open');
    });
  }

  // Fermer le sidebar en cliquant sur l'overlay
  document.addEventListener('click', (e) => {
    if (filtersSidebar && filtersSidebar.classList.contains('open')) {
      if (!filtersSidebar.contains(e.target) && e.target !== filterToggle) {
        filtersSidebar.classList.remove('open');
      }
    }
  });

  // === RÉINITIALISER LES FILTRES ===
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      searchInput.value = '';
      citySelect.value = '';
      countrySelect.value = '';
      sortSelect.value = 'recent';
      
      currentOffset = 0;
      applyFilters();
    });
  }

  // === RÉCUPÉRER LES FILTRES ACTUELS ===
  function getFilters() {
    return {
      search: searchInput ? searchInput.value.trim().toLowerCase() : '',
      city: citySelect.value || '',
      country: countrySelect.value || '',
      sort: sortSelect.value
    };
  }

  // === FILTRER LES BOUTIQUES CÔTÉ CLIENT ===
  function applyFilters() {
    const filters = getFilters();
    
    // Filtrer les boutiques
    filteredStores = allStores.filter(store => {
      // Filtre recherche
      if (filters.search) {
        const nameMatch = store.business_name.toLowerCase().includes(filters.search);
        if (!nameMatch) return false;
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

    // Trier les boutiques
    sortStores(filteredStores, filters.sort);

    // Mettre à jour l'affichage
    updateDisplay();
  }

  // === TRIER LES BOUTIQUES ===
  function sortStores(stores, sortType) {
    switch(sortType) {
      case 'recent':
        stores.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'popular':
        stores.sort((a, b) => (b.total_views || 0) - (a.total_views || 0));
        break;
    }
  }

  // === METTRE À JOUR L'AFFICHAGE ===
  function updateDisplay() {
    const total = filteredStores.length;
    
    // Calculer la pagination
    const start = currentOffset;
    const end = Math.min(start + limit, total);
    const paginatedStores = filteredStores.slice(start, end);

    // Afficher les boutiques
    renderStores(paginatedStores);

    // Mettre à jour le compteur
    resultsCount.textContent = total;

    // Mettre à jour la pagination
    updatePagination(total);

    // Scroll vers le haut
    if (storesContainer) {
      storesContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // === CHARGER TOUTES LES BOUTIQUES DEPUIS L'API ===
  async function loadAllStores() {
    try {
      loadingIndicator.style.display = 'block';
      
      const params = new URLSearchParams();
      params.append('limit', 1000);
      params.append('offset', 0);

      const response = await fetch(`/api/marketplace/api/stores?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        allStores = data.data.stores || [];
        filteredStores = [...allStores];
        
        // Appliquer les filtres initiaux
        applyFilters();
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Erreur lors du chargement des boutiques:', error);
      storesContainer.innerHTML = '<p class="empty-message">Erreur lors du chargement des boutiques. Veuillez réessayer.</p>';
    } finally {
      loadingIndicator.style.display = 'none';
    }
  }

  // === AFFICHER LES BOUTIQUES ===
  function renderStores(stores) {
    if (stores.length === 0) {
      storesContainer.innerHTML = '<p class="empty-message">Aucune boutique trouvée avec vos critères de recherche.</p>';
      return;
    }

    storesContainer.innerHTML = stores.map(store => {
      const productsHTML = store.products && store.products.length > 0
        ? store.products.slice(0, 4).map(product => `
            <div class="product-thumb-wrapper">
              <img src="${product.image_url || '/images/placeholder.png'}" alt="${escapeHtml(product.name)}" class="product-thumb">
            </div>
          `).join('')
        : '';

      return `
        <a href="/store/${store.store_slug}" class="store-card">
          <div class="store-header">
            ${store.logo_url 
              ? `<img src="${store.logo_url}" alt="${escapeHtml(store.business_name)}" class="store-logo">`
              : '<div class="store-logo-placeholder">🏪</div>'
            }
            
            <div class="store-info">
              <h3 class="store-name">
                ${escapeHtml(store.business_name)}
                ${store.is_verified ? `
                  <svg class="verified-badge" width="18" height="18" viewBox="0 0 24 24" fill="#5C6C73" title="Vendeur vérifié">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                  </svg>
                ` : ''}
              </h3>
              ${store.city ? `<p class="store-location">📍 ${escapeHtml(store.city)}, ${escapeHtml(store.country || '')}</p>` : ''}
            </div>
          </div>

          <div class="store-stats">
            <div class="stat-item">
              <span class="stat-value">${store.product_count}</span>
              <span class="stat-label">Produits</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${store.total_views || 0}</span>
              <span class="stat-label">Vues</span>
            </div>
          </div>

          ${productsHTML ? `<div class="store-products">${productsHTML}</div>` : ''}
        </a>
      `;
    }).join('');

    // Ajouter des animations d'apparition
    animateStoreCards();
  }

  // === ÉCHAPPER HTML POUR SÉCURITÉ ===
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // === ANIMER L'APPARITION DES CARTES ===
  function animateStoreCards() {
    const cards = document.querySelectorAll('.store-card');
    cards.forEach((card, index) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      
      setTimeout(() => {
        card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, index * 30);
    });
  }

  // === METTRE À JOUR LA PAGINATION ===
  function updatePagination(total) {
    const currentPage = Math.floor(currentOffset / limit) + 1;
    const totalPages = Math.ceil(total / limit);
    
    // Désactiver/activer les boutons
    const hasPrev = currentOffset > 0;
    const hasNext = currentOffset + limit < total;

    prevBtn.disabled = !hasPrev;
    nextBtn.disabled = !hasNext;

    // Mettre à jour le texte
    pagination.textContent = totalPages > 0 ? `Page ${currentPage} / ${totalPages}` : 'Aucune page';
  }

  // === ÉVÉNEMENTS DES FILTRES ===
  
  // Ville
  citySelect.addEventListener('change', () => {
    currentOffset = 0;
    applyFilters();
  });
  
  // Pays
  countrySelect.addEventListener('change', () => {
    currentOffset = 0;
    applyFilters();
  });
  
  // Tri
  sortSelect.addEventListener('change', () => {
    currentOffset = 0;
    applyFilters();
  });

  // Recherche en temps réel
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentOffset = 0;
        applyFilters();
      }, 300); // Debounce de 300ms
    });

    searchInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchTimeout);
        currentOffset = 0;
        applyFilters();
      }
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      currentOffset = 0;
      applyFilters();
    });
  }

  // === PAGINATION ===
  prevBtn.addEventListener('click', () => {
    if (currentOffset > 0) {
      currentOffset = Math.max(0, currentOffset - limit);
      updateDisplay();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentOffset + limit < filteredStores.length) {
      currentOffset += limit;
      updateDisplay();
    }
  });

  // === CHARGEMENT INITIAL ===
  loadAllStores();

  console.log('✅ Marketplace stores chargé avec filtres et pagination corrigés !');
});