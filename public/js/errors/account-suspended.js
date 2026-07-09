function logout() {
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace('/login');
    }
    document.querySelector('.deco').addEventListener('click', logout);