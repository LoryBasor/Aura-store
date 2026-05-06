/**
 * public/js/profile.js
 * Gestion du profil utilisateur et du changement de mot de passe
 */

document.addEventListener('DOMContentLoaded', () => {
  const profileForm = document.getElementById('profileForm');
  const passwordForm = document.getElementById('passwordForm');
  const copyBtn = document.querySelector('[data-action="copy-store-link"]');

  // ── MISE À JOUR DU PROFIL ────────────────────────────────────────────────
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(profileForm);
      const payload = {
        business_name: formData.get('business_name'),
        phone: formData.get('phone'),
        whatsapp_number: formData.get('whatsapp_number'),
        country: formData.get('country'),
        city: formData.get('city')
      };

      UI.showLoader();
      try {
        const resp = await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await resp.json();

        if (resp.ok) {
          UI.showNotification('Succès', 'Profil mis à jour avec succès', 'success');
          // Optionnel: recharger la page pour voir les changements si nécessaire
          // setTimeout(() => window.location.reload(), 1500);
        } else {
          UI.showNotification('Erreur', data.message || 'Échec de la mise à jour', 'error');
        }
      } catch (error) {
        UI.showNotification('Erreur', 'Erreur réseau', 'error');
      } finally {
        UI.hideLoader();
      }
    });
  }

  // ── CHANGEMENT DE MOT DE PASSE ───────────────────────────────────────────
  if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const oldPassword = document.getElementById('old_password').value;
      const newPassword = document.getElementById('new_password').value;
      const confirmPassword = document.getElementById('confirm_password').value;

      // Validation côté client
      if (newPassword !== confirmPassword) {
        UI.showNotification('Erreur', 'Les nouveaux mots de passe ne correspondent pas', 'error');
        return;
      }

      if (newPassword.length < 8) {
        UI.showNotification('Erreur', 'Le nouveau mot de passe doit faire au moins 8 caractères', 'error');
        return;
      }

      UI.showLoader();
      try {
        const resp = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            old_password: oldPassword,
            new_password: newPassword
          })
        });

        const data = await resp.json();

        if (resp.ok) {
          UI.showNotification('Succès', 'Mot de passe modifié avec succès', 'success');
          passwordForm.reset();
        } else {
          UI.showNotification('Erreur', data.message || 'Échec du changement de mot de passe', 'error');
        }
      } catch (error) {
        UI.showNotification('Erreur', 'Erreur réseau', 'error');
      } finally {
        UI.hideLoader();
      }
    });
  }

  // ── COPIER LE LIEN DE LA BOUTIQUE ────────────────────────────────────────
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const storeLinkInput = document.getElementById('store_link');
      if (storeLinkInput) {
        storeLinkInput.select();
        storeLinkInput.setSelectionRange(0, 99999); // Pour mobile

        try {
          navigator.clipboard.writeText(storeLinkInput.value);
          UI.showNotification('Succès', 'Lien copié dans le presse-papier !', 'success');
          
          // Petit feedback visuel sur le bouton
          const originalText = copyBtn.textContent;
          copyBtn.textContent = '✅ Copié';
          setTimeout(() => {
            copyBtn.textContent = originalText;
          }, 2000);
        } catch (err) {
          UI.showNotification('Erreur', 'Impossible de copier le lien', 'error');
        }
      }
    });
  }
});
