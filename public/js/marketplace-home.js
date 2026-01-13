// public/js/marketplace-home.js
// Gestion améliorée de la page d'accueil du marketplace avec carrousels

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');

  // === GESTION DE LA RECHERCHE ===
  function handleSearch() {
    const query = searchInput.value.trim().toLowerCase();
    
    // Filtrer les produits populaires
    const popularProductCards = document.querySelectorAll('#popularProducts .product-card');
    filterCards(popularProductCards, query, ['.product-name', '.product-vendor']);

    // Filtrer les produits récents
    const recentProductCards = document.querySelectorAll('#recentProducts .product-card');
    filterCards(recentProductCards, query, ['.product-name', '.product-vendor']);

    // Filtrer les boutiques recommandées
    const storeCards = document.querySelectorAll('#recommendedStores .store-card');
    filterCards(storeCards, query, ['.store-name']);

    // Filtrer les catégories
    const categoryCards = document.querySelectorAll('#trendingCategories .category-card');
    filterCards(categoryCards, query, ['.category-name']);
  }

  /**
   * Fonction utilitaire pour filtrer les cartes
   */
  function filterCards(cards, query, selectors) {
    cards.forEach(card => {
      if (!query) {
        card.style.display = '';
        return;
      }

      const matchesQuery = selectors.some(selector => {
        const element = card.querySelector(selector);
        return element && element.textContent.toLowerCase().includes(query);
      });

      card.style.display = matchesQuery ? '' : 'none';
    });
  }

  // Événements de recherche
  if (searchBtn) {
    searchBtn.addEventListener('click', handleSearch);
  }

  if (searchInput) {
    searchInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        handleSearch();
      }
    });

    searchInput.addEventListener('input', () => {
      if (searchInput.value.trim() === '') {
        handleSearch();
      }
    });
  }

  // === GESTION DES CARROUSELS ===
  class Carousel {
    constructor(containerSelector) {
      this.container = document.querySelector(containerSelector);
      if (!this.container) return;

      this.track = this.container.querySelector('.carousel-track');
      this.prevBtn = this.container.querySelector('.carousel-prev');
      this.nextBtn = this.container.querySelector('.carousel-next');
      
      if (!this.track) return;

      this.scrollAmount = 300; // Pixels à défiler
      this.autoplayInterval = null;
      this.autoplayDelay = 5000; // 5 secondes

      this.init();
    }

    init() {
      // Événements des boutons
      if (this.prevBtn) {
        this.prevBtn.addEventListener('click', () => this.scroll('left'));
      }

      if (this.nextBtn) {
        this.nextBtn.addEventListener('click', () => this.scroll('right'));
      }

      // Défilement tactile amélioré
      let isDown = false;
      let startX;
      let scrollLeft;

      this.track.addEventListener('mousedown', (e) => {
        isDown = true;
        this.track.style.cursor = 'grabbing';
        startX = e.pageX - this.track.offsetLeft;
        scrollLeft = this.track.scrollLeft;
        this.stopAutoplay();
      });

      this.track.addEventListener('mouseleave', () => {
        isDown = false;
        this.track.style.cursor = 'grab';
      });

      this.track.addEventListener('mouseup', () => {
        isDown = false;
        this.track.style.cursor = 'grab';
        this.startAutoplay();
      });

      this.track.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - this.track.offsetLeft;
        const walk = (x - startX) * 2;
        this.track.scrollLeft = scrollLeft - walk;
      });

      // Support tactile
      this.track.addEventListener('touchstart', () => {
        this.stopAutoplay();
      });

      this.track.addEventListener('touchend', () => {
        this.startAutoplay();
      });

      // Mise à jour de l'état des boutons
      this.track.addEventListener('scroll', () => {
        this.updateButtons();
      });

      // Démarrer l'autoplay
      this.startAutoplay();
      this.updateButtons();

      // Stopper l'autoplay au survol
      this.container.addEventListener('mouseenter', () => {
        this.stopAutoplay();
      });

      this.container.addEventListener('mouseleave', () => {
        this.startAutoplay();
      });
    }

    scroll(direction) {
      const scrollDistance = direction === 'left' ? -this.scrollAmount : this.scrollAmount;
      
      this.track.scrollBy({
        left: scrollDistance,
        behavior: 'smooth'
      });

      // Redémarrer l'autoplay après interaction manuelle
      this.stopAutoplay();
      setTimeout(() => this.startAutoplay(), 3000);
    }

    updateButtons() {
      if (!this.prevBtn || !this.nextBtn) return;

      const { scrollLeft, scrollWidth, clientWidth } = this.track;

      // Désactiver le bouton précédent si au début
      if (scrollLeft <= 0) {
        this.prevBtn.style.opacity = '0.3';
        this.prevBtn.style.cursor = 'not-allowed';
      } else {
        this.prevBtn.style.opacity = '1';
        this.prevBtn.style.cursor = 'pointer';
      }

      // Désactiver le bouton suivant si à la fin
      if (scrollLeft + clientWidth >= scrollWidth - 10) {
        this.nextBtn.style.opacity = '0.3';
        this.nextBtn.style.cursor = 'not-allowed';
      } else {
        this.nextBtn.style.opacity = '1';
        this.nextBtn.style.cursor = 'pointer';
      }
    }

    startAutoplay() {
      this.stopAutoplay();
      
      this.autoplayInterval = setInterval(() => {
        const { scrollLeft, scrollWidth, clientWidth } = this.track;
        
        // Si on est à la fin, retour au début
        if (scrollLeft + clientWidth >= scrollWidth - 10) {
          this.track.scrollTo({
            left: 0,
            behavior: 'smooth'
          });
        } else {
          // Sinon, défiler vers la droite
          this.scroll('right');
        }
      }, this.autoplayDelay);
    }

    stopAutoplay() {
      if (this.autoplayInterval) {
        clearInterval(this.autoplayInterval);
        this.autoplayInterval = null;
      }
    }
  }

  // Initialiser les carrousels
  const popularCarousel = new Carousel('#popularProducts');
  const storesCarousel = new Carousel('#recommendedStores');

  // === ANIMATIONS D'APPARITION ===
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  // Observer les sections
  const sections = document.querySelectorAll('.section-container');
  sections.forEach((section, index) => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(20px)';
    section.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
    observer.observe(section);
  });

  // Observer les cartes individuelles
  const cards = document.querySelectorAll('.product-card, .store-card, .category-card');
  cards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = `opacity 0.4s ease ${(index % 8) * 0.05}s, transform 0.4s ease ${(index % 8) * 0.05}s`;
    observer.observe(card);
  });

  // === PARALLAX EFFECT SUR LE HERO ===
  const heroSection = document.querySelector('.hero-section');
  if (heroSection) {
    window.addEventListener('scroll', () => {
      const scrolled = window.pageYOffset;
      const parallax = scrolled * 0.5;
      heroSection.style.transform = `translateY(${parallax}px)`;
    });
  }

  console.log('🎨 Marketplace home chargé avec succès !');
});