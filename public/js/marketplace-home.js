// public/js/marketplace-home.js
// Gestion de la page d'accueil du marketplace

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');

  /**
   * Filtre les produits et boutiques par recherche côté client
   */
  function handleSearch() {
    const query = searchInput.value.trim().toLowerCase();
    
    // Filtrer les produits populaires
    const popularProductCards = document.querySelectorAll('#popularProducts .product-card');
    popularProductCards.forEach(card => {
      const name = card.querySelector('.product-name').textContent.toLowerCase();
      const vendor = card.querySelector('.product-vendor').textContent.toLowerCase();
      card.style.display = (name.includes(query) || vendor.includes(query)) ? '' : 'none';
    });

    // Filtrer les produits récents
    const recentProductCards = document.querySelectorAll('#recentProducts .product-card');
    recentProductCards.forEach(card => {
      const name = card.querySelector('.product-name').textContent.toLowerCase();
      const vendor = card.querySelector('.product-vendor').textContent.toLowerCase();
      card.style.display = (name.includes(query) || vendor.includes(query)) ? '' : 'none';
    });

    // Filtrer les boutiques recommandées
    const storeCards = document.querySelectorAll('#recommendedStores .store-card');
    storeCards.forEach(card => {
      const name = card.querySelector('.store-name').textContent.toLowerCase();
      card.style.display = name.includes(query) ? '' : 'none';
    });

    // Filtrer les catégories
    const categoryCards = document.querySelectorAll('#trendingCategories .category-card');
    categoryCards.forEach(card => {
      const name = card.querySelector('.category-name').textContent.toLowerCase();
      card.style.display = name.includes(query) ? '' : 'none';
    });
  }

  /**
   * Déclenche la recherche au clic du bouton
   */
  searchBtn.addEventListener('click', handleSearch);

  /**
   * Déclenche la recherche à l'appui d'Entrée
   */
  searchInput.addEventListener('keyup', (e) => {
    handleSearch();
  });

  /**
   * Réinitialise la recherche si le champ est vidé
   */
  searchInput.addEventListener('input', () => {
    if (searchInput.value.trim() === '') {
      handleSearch();
    }
  });
});