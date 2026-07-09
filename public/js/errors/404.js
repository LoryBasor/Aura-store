function goBack() {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/';
      }
    }

    // Vérifier si l'utilisateur est connecté pour proposer le bon lien d'accueil
    const token = localStorage.getItem('aura_token');
    const user = localStorage.getItem('aura_user');
    
    if (token && user) {
      try {
        const userData = JSON.parse(user);
        const homeLink = document.querySelector('a[href="/"]');
        
        if (userData.role === 'SUPER_ADMIN') {
          homeLink.href = '/admin/dashboard';
          homeLink.innerHTML = '<i class="fi fi-rr-home"></i> Dashboard Admin';
        } else {
          homeLink.href = '/dashboard';
          homeLink.innerHTML = '<i class="fi fi-rr-home"></i> Mon Dashboard';
        }
      } catch (e) {
        // Ignorer les erreurs de parsing
      }
    }