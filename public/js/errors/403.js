function goBack() {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/dashboard';
      }
    }

    // Vérifier si l'utilisateur est admin
    const user = localStorage.getItem('aura_user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        if (userData.role === 'SUPER_ADMIN') {
          document.querySelector('a[href="/dashboard"]').href = '/admin/dashboard';
          document.querySelector('a[href="/dashboard"]').innerHTML = '<i class="fi fi-rr-home"></i> Dashboard Admin';
        }
      } catch (e) {
        // Ignorer les erreurs
      }
    }