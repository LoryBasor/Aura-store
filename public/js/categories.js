/**
 * public/js/categories.js
 * Gère l'interactivité de la page Catégories (Modals, AJAX CRUD)
 * Authentification via cookie httpOnly - pas de localStorage
 */

document.addEventListener('DOMContentLoaded', () => {
  const categoryForm = document.getElementById('categoryForm');
  const modalTitle   = document.getElementById('modalTitle');
  const categoriesList = document.getElementById('categoriesList');

  function getCategoryData(id) {
    if (!window.__SSR_CATEGORIES__) return null;
    return window.__SSR_CATEGORIES__.find(c => c.id == id);
  }

  // Nouvelle catégorie
  AppUtils.onAll('[data-action="new-category"]', 'click', () => {
    if (categoryForm) categoryForm.reset();
    document.getElementById('categoryId').value = '';
    modalTitle.textContent = 'Nouvelle catégorie';
    ModalManager.openModal('categoryModal');
  });

  // Modifier catégorie
  AppUtils.delegate(categoriesList, 'click', '[data-action="edit-category"]', (e) => {
    const btn      = e.target.closest('button');
    const id       = btn.dataset.categoryId;
    const category = getCategoryData(id);

    if (category) {
      document.getElementById('categoryId').value          = category.id;
      document.getElementById('categoryName').value        = category.name;
      document.getElementById('categoryDescription').value = category.description || '';
      modalTitle.textContent = 'Modifier la catégorie';
      ModalManager.openModal('categoryModal');
    }
  });

  // Supprimer catégorie
  AppUtils.delegate(categoriesList, 'click', '[data-action="delete-category"]', async (e) => {
    const btn = e.target.closest('button');
    if (btn.disabled) return;

    const id = btn.dataset.categoryId;
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) return;

    try {
      UI.showLoader();
      // Cookie httpOnly envoyé automatiquement par le navigateur
      const response = await fetch(`/api/categories/${id}`, { method: 'DELETE' });

      if (response.ok) {
        UI.showNotification('Succès', 'Catégorie supprimée', 'success');
        window.location.reload();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      UI.showNotification('Erreur', error.message, 'error');
    } finally {
      UI.hideLoader();
    }
  });

  // Soumission du formulaire (Création / Modification)
  if (categoryForm) {
    categoryForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const categoryId  = document.getElementById('categoryId').value;
      const isEdit      = !!categoryId;
      const name        = document.getElementById('categoryName').value.trim();
      const description = document.getElementById('categoryDescription').value.trim();

      const url    = isEdit ? `/api/categories/${categoryId}` : '/api/categories';
      const method = isEdit ? 'PUT' : 'POST';

      try {
        UI.showLoader();
        // Cookie httpOnly envoyé automatiquement - pas besoin d'Authorization header
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description })
        });

        if (response.ok) {
          UI.showNotification('Succès', `Catégorie ${isEdit ? 'modifiée' : 'créée'} avec succès`, 'success');
          ModalManager.closeModal('categoryModal');
          window.location.reload();
        } else {
          const data = await response.json();
          throw new Error(data.error || 'Erreur lors de l\'enregistrement');
        }
      } catch (error) {
        UI.showNotification('Erreur', error.message, 'error');
      } finally {
        UI.hideLoader();
      }
    });
  }
});
