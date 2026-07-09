// public/js/marketplace-home.js
// Gestion de la page d'accueil marketplace (recherche + carousels)

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');

  const handleSearch = () => {
    const query = searchInput ? searchInput.value.trim() : '';
    if (query) {
      window.location.href = '/marketplace/products?search=' + encodeURIComponent(query);
    }
  };

  if (searchBtn) searchBtn.addEventListener('click', handleSearch);
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSearch();
    });
  }

  // Carousels — navigation par scroll horizontal
  document.querySelectorAll('.carousel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const carouselId = btn.getAttribute('data-carousel');
      const track = document.querySelector('.carousel-track[data-carousel="' + carouselId + '"]');
      if (!track) return;
      const scrollAmount = track.clientWidth * 0.8;
      if (btn.classList.contains('carousel-prev')) {
        track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
        track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    });
  });
});