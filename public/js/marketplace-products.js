// public/js/marketplace-products.js
// Gestion des filtres et du tri pour la page produits du marketplace

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

  let currentOffset = 0;
  const limit = 20;
  let allProducts = [];

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
    const selectedCategory = Array.from(categoryInputs).find(i => i.checked);
    
    return {
      search: searchInput ? searchInput.value.trim().toLowerCase() : '',
      category: selectedCategory ? selectedCategory.value : '',
      city: citySelect.value || '',
      country: countrySelect.value || '',
      minPrice: minPriceInput.value ? parseFloat(minPriceInput.value) : null,
      maxPrice: maxPriceInput.value ? parseFloat(maxPriceInput.value) : null,
      sort: sortSelect.value,
      limit,
      offset: currentOffset
    };
  }

  /**
   * Filtre les produits côté client
   */
  function filterProducts() {
    const filters = getFilters();
    
    let filtered = allProducts.filter(product => {
      // Filtre recherche
      if (filters.search && !product.name.toLowerCase().includes(filters.search) && 
          !product.business_name.toLowerCase().includes(filters.search)) {
        return false;
      }
      
      // Filtre catégorie
      if (filters.category && product.category_name !== filters.category) {
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

    // Tri
    if (filters.sort === 'recent') {
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (filters.sort === 'popular') {
      filtered.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
    } else if (filters.sort === 'price-asc') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (filters.sort === 'price-desc') {
      filtered.sort((a, b) => b.price - a.price);
    }

    // Pagination
    const paginated = filtered.slice(currentOffset, currentOffset + limit);
    
    renderProducts(paginated);
    resultsCount.textContent = filtered.length;
    updatePagination(filtered.length);
  }

  /**
   * Charge les produits avec les filtres actuels
   */
  async function loadProducts() {
    try {
      loadingIndicator.style.display = 'block';
      currentOffset = 0;
      const filters = getFilters();

      // Construire l'URL avec les paramètres
      const params = new URLSearchParams();
      if (filters.category) params.append('category', filters.category);
      if (filters.city) params.append('city', filters.city);
      if (filters.country) params.append('country', filters.country);
      if (filters.minPrice) params.append('minPrice', filters.minPrice);
      if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
      params.append('sort', filters.sort);
      params.append('limit', 1000);
      params.append('offset', 0);

      const response = await fetch(`/api/marketplace/api/products?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Mettre à jour les résultats
      if (data.success && data.data) {
        allProducts = data.data.products || [];
        filterProducts();
        
        // Scroll vers les produits
        productsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
      productsContainer.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; padding: 2rem;">Erreur lors du chargement des produits. Veuillez réessayer.</p>';
    } finally {
      loadingIndicator.style.display = 'none';
    }
  }

  /**
   * Affiche les produits
   */
  function renderProducts(products) {
    if (products.length === 0) {
      productsContainer.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; padding: 2rem;">Aucun produit trouvé avec vos critères.</p>';
      return;
    }

    productsContainer.innerHTML = products.map(product => `
      <a href="/p/${product.share_token}" class="product-card">
        <img src="${product.image_url || '/images/placeholder.png'}" alt="${product.name}" class="product-image">
        <div class="product-info">
          <div class="product-name">${product.name}</div>
          <div class="product-price">${product.price} ${product.currency}</div>
          <div class="product-vendor">${product.business_name}</div>
          ${product.city ? `<div class="product-location">${product.city}, ${product.country || ''}</div>` : ''}
        </div>
      </a>
    `).join('');
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
  categoryInputs.forEach(input => {
    input.addEventListener('change', () => {
      currentOffset = 0;
      filterProducts();
    });
  });

  citySelect.addEventListener('change', () => {
    currentOffset = 0;
    filterProducts();
  });
  
  countrySelect.addEventListener('change', () => {
    currentOffset = 0;
    filterProducts();
  });
  
  minPriceInput.addEventListener('change', () => {
    currentOffset = 0;
    filterProducts();
  });
  
  maxPriceInput.addEventListener('change', () => {
    currentOffset = 0;
    filterProducts();
  });
  
  sortSelect.addEventListener('change', () => {
    currentOffset = 0;
    filterProducts();
  });

  // Recherche
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentOffset = 0;
      filterProducts();
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      currentOffset = 0;
      filterProducts();
    });
  }

  // Pagination
  prevBtn.addEventListener('click', () => {
    currentOffset = Math.max(0, currentOffset - limit);
    filterProducts();
  });

  nextBtn.addEventListener('click', () => {
    currentOffset += limit;
    filterProducts();
  });

  // Charger les produits au chargement initial
  loadProducts();
});
