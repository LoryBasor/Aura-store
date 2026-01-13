// public/js/marketplace-products.js
// Gestion CORRIGÉE des filtres, tri et pagination

document.addEventListener('DOMContentLoaded', () => {
  const filterForm = document.getElementById('filterForm');
  const filterToggle = document.getElementById('filterToggle');
  const filtersSidebar = document.querySelector('.filters-sidebar');
  const sortSelect = document.getElementById('sortSelect');
  const productsContainer = document.getElementById('productsContainer');
  const resultsCount = document.getElementById('resultsCount');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const pagination = document.getElementById('pagination');
  const searchInput = document.getElementById('productSearchInput');
  const searchBtn = document.getElementById('productSearchBtn');
  const categoryInputs = filterForm.querySelectorAll('input[name="category"]');
  const citySelect = filterForm.querySelector('select[name="city"]');
  const countrySelect = filterForm.querySelector('select[name="country"]');
  const minPriceInput = filterForm.querySelector('input[name="minPrice"]');
  const maxPriceInput = filterForm.querySelector('input[name="maxPrice"]');
  const clearFiltersBtn = document.getElementById('clearFilters');
  const closeFiltersBtn = document.getElementById('closeFilters');

  let currentOffset = 0;
  const limit = 20;
  let allProducts = [];
  let filteredProducts = [];

  // === TOGGLE SIDEBAR MOBILE ===
  if (filterToggle) {
    filterToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      filtersSidebar.classList.toggle('open');
      closeFiltersBtn.classList.toggle('open');
    });
  }

  // Bouton fermer le sidebar
  if (closeFiltersBtn) {
    closeFiltersBtn.addEventListener('click', () => {
      filtersSidebar.classList.remove('open');
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
      categoryInputs.forEach(input => {
        input.checked = input.value === '';
      });
      citySelect.value = '';
      countrySelect.value = '';
      minPriceInput.value = '';
      maxPriceInput.value = '';
      sortSelect.value = 'recent';
      
      currentOffset = 0;
      applyFilters();
    });
  }

  // === RÉCUPÉRER LES FILTRES ACTUELS ===
  function getFilters() {
    const selectedCategory = Array.from(categoryInputs).find(i => i.checked);
    
    return {
      search: searchInput ? searchInput.value.trim().toLowerCase() : '',
      category: selectedCategory ? selectedCategory.value : '',
      city: citySelect.value || '',
      country: countrySelect.value || '',
      minPrice: minPriceInput.value ? parseFloat(minPriceInput.value) : null,
      maxPrice: maxPriceInput.value ? parseFloat(maxPriceInput.value) : null,
      sort: sortSelect.value
    };
  }

  // === FILTRER LES PRODUITS CÔTÉ CLIENT ===
  function applyFilters() {
    const filters = getFilters();
    
    // Filtrer les produits
    filteredProducts = allProducts.filter(product => {
      // Filtre recherche
      if (filters.search) {
        const nameMatch = product.name.toLowerCase().includes(filters.search);
        const vendorMatch = product.business_name.toLowerCase().includes(filters.search);
        if (!nameMatch && !vendorMatch) return false;
      }
      
      // Filtre catégorie
      if (filters.category && product.category_slug !== filters.category) {
        return false;
      }
      
      // Filtre ville
      if (filters.city && product.city !== filters.city) {
        return false;
      }
      
      // Filtre pays
      if (filters.country && product.country !== filters.country) {
        return false;
      }
      
      // Filtre prix min
      if (filters.minPrice !== null && product.price < filters.minPrice) {
        return false;
      }
      
      // Filtre prix max
      if (filters.maxPrice !== null && product.price > filters.maxPrice) {
        return false;
      }
      
      return true;
    });

    // Trier les produits
    sortProducts(filteredProducts, filters.sort);

    // Mettre à jour l'affichage
    updateDisplay();
  }

  // === TRIER LES PRODUITS ===
  function sortProducts(products, sortType) {
    switch(sortType) {
      case 'recent':
        products.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'popular':
        products.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
        break;
      case 'price-asc':
        products.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        products.sort((a, b) => b.price - a.price);
        break;
    }
  }

  // === METTRE À JOUR L'AFFICHAGE ===
  function updateDisplay() {
    const total = filteredProducts.length;
    
    // Calculer la pagination
    const start = currentOffset;
    const end = Math.min(start + limit, total);
    const paginatedProducts = filteredProducts.slice(start, end);

    // Afficher les produits
    renderProducts(paginatedProducts);

    // Mettre à jour le compteur
    resultsCount.textContent = total;

    // Mettre à jour la pagination
    updatePagination(total);

    // Scroll vers le haut
    if (productsContainer) {
      productsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // === CHARGER TOUS LES PRODUITS DEPUIS L'API ===
  async function loadAllProducts() {
    try {
      loadingIndicator.style.display = 'block';
      
      const params = new URLSearchParams();
      params.append('limit', 1000);
      params.append('offset', 0);

      const response = await fetch(`/api/marketplace/api/products?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        allProducts = data.data.products || [];
        filteredProducts = [...allProducts];
        
        // Appliquer les filtres initiaux
        applyFilters();
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
      productsContainer.innerHTML = '<p class="empty-message">Erreur lors du chargement des produits. Veuillez réessayer.</p>';
    } finally {
      loadingIndicator.style.display = 'none';
    }
  }

  // === AFFICHER LES PRODUITS ===
  function renderProducts(products) {
    if (products.length === 0) {
      productsContainer.innerHTML = '<p class="empty-message">Aucun produit trouvé avec vos critères de recherche.</p>';
      return;
    }

    productsContainer.innerHTML = products.map(product => `
      <a href="/p/${product.share_token}" class="product-card">
        <div class="product-image-wrapper">
          <img src="${product.image_url || '/images/placeholder.png'}" alt="${escapeHtml(product.name)}" class="product-image">
          ${product.view_count > 100 ? '<div class="product-badge">Populaire</div>' : ''}
        </div>
        <div class="product-info">
          <h3 class="product-name">${escapeHtml(product.name)}</h3>
          <p class="product-price">${product.price} ${product.currency}</p>
          <div class="product-vendor">
            <span>${escapeHtml(product.business_name)}</span>
            ${product.is_verified ? `
              <svg class="verified-badge" width="16" height="16" viewBox="0 0 24 24" fill="#5C6C73" title="Vendeur vérifié">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
              </svg>
            ` : ''}
          </div>
          ${product.city ? `<p class="product-location">📍 ${escapeHtml(product.city)}, ${escapeHtml(product.country || '')}</p>` : ''}
        </div>
      </a>
    `).join('');

    // Ajouter des animations d'apparition
    animateProductCards();
  }

  // === ÉCHAPPER HTML POUR SÉCURITÉ ===
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // === ANIMER L'APPARITION DES CARTES ===
  function animateProductCards() {
    const cards = document.querySelectorAll('.product-card');
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
  
  // Catégories
  categoryInputs.forEach(input => {
    input.addEventListener('change', () => {
      currentOffset = 0;
      applyFilters();
    });
  });

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
  
  // Prix min
  minPriceInput.addEventListener('change', () => {
    currentOffset = 0;
    applyFilters();
  });
  
  // Prix max
  maxPriceInput.addEventListener('change', () => {
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
    if (currentOffset + limit < filteredProducts.length) {
      currentOffset += limit;
      updateDisplay();
    }
  });

  // === CHARGEMENT INITIAL ===
  loadAllProducts();

  console.log('✅ Marketplace products chargé avec filtres et pagination corrigés !');
});