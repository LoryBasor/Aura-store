// Header scroll effect
    const header = document.getElementById('header');
    
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
    
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          const headerOffset = 80;
          const elementPosition = target.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      });
    });

    // Animate elements on scroll
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

    // Observe all cards and sections
    document.querySelectorAll('.feature-card, .pricing-card, .problem-card, .solution-card, .audience-card').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(el);
    });

    // Mobile menu toggle (if needed later)
    const mobileMenuBtn = document.createElement('button');
    mobileMenuBtn.className = 'mobile-menu-btn';
    mobileMenuBtn.innerHTML = '<i class="fi fi-rr-menu-burger"></i>';
    mobileMenuBtn.style.display = 'none';
    mobileMenuBtn.style.fontSize = '1.5rem';
    mobileMenuBtn.style.background = 'transparent';
    mobileMenuBtn.style.border = 'none';
    mobileMenuBtn.style.cursor = 'pointer';
    mobileMenuBtn.style.color = 'var(--color-primary)';

    // Show mobile menu button on small screens
    function handleResize() {
      if (window.innerWidth <= 768) {
        mobileMenuBtn.style.display = 'block';
        document.querySelector('.nav-actions').style.display = 'none';
      } else {
        mobileMenuBtn.style.display = 'none';
        document.querySelector('.nav-actions').style.display = 'flex';
      }
    }

    window.addEventListener('resize', handleResize);
    handleResize();

    // Add hover effect to pricing cards
    document.querySelectorAll('.pricing-card').forEach(card => {
      card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-8px)';
      });
      
      card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
      });
    });

    // Track CTA clicks (for analytics - optional)
    document.querySelectorAll('.btn-primary, .btn-white').forEach(btn => {
      btn.addEventListener('click', function(e) {
        // You can add analytics tracking here
        console.log('CTA clicked:', this.textContent);
      });
    });

    // Add loading animation
    window.addEventListener('load', () => {
      document.body.style.opacity = '0';
      document.body.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        document.body.style.opacity = '1';
      }, 100);
    });