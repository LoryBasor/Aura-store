/**
 * public/js/products.js
 * Gère l'interactivité de la page Produits (Modals, AJAX CRUD)
 */

document.addEventListener('DOMContentLoaded', () => {
  const productModal = document.getElementById('productModal');
  const productForm = document.getElementById('productForm');
  const modalTitle = document.getElementById('modalTitle');
  const productsGrid = document.getElementById('productsGrid');

  // Utility to fetch products from the globally injected window.__SSR_PRODUCTS__
  function getProductData(id) {
    if (!window.__SSR_PRODUCTS__) return null;
    return window.__SSR_PRODUCTS__.find(p => p.id == id);
  }

  // --- ACTIONS ---
  
  // Nouveau produit
  AppUtils.onAll('[data-action="new-product"]', 'click', () => {
    productForm.reset();
    document.getElementById('productId').value = '';
    modalTitle.textContent = 'Nouveau produit';
    
    // Reset image preview
    const preview = document.getElementById('imagePreview');
    if (preview) preview.innerHTML = '';
    
    ModalManager.openModal('productModal');
  });

  // Modifier produit
  AppUtils.delegate(productsGrid, 'click', '[data-action="edit-product"]', (e) => {
    const btn = e.target.closest('button');
    const id = btn.dataset.productId;
    const product = getProductData(id);
    
    if (product) {
      document.getElementById('productId').value = product.id;
      document.getElementById('name').value = product.name;
      document.getElementById('description').value = product.description || '';
      document.getElementById('price').value = product.price;
      document.getElementById('currency').value = product.currency || 'XAF';
      document.getElementById('stock_quantity').value = product.stock_quantity;
      document.getElementById('category_id').value = product.category_id || '';
      document.getElementById('is_available').value = product.is_available.toString();
      
      const preview = document.getElementById('imagePreview');
      if (preview) {
        if (product.image_url) {
          preview.innerHTML = `<img src="${product.image_url}" alt="Preview" style="max-width:100px; border-radius:8px;">`;
        } else {
          preview.innerHTML = '';
        }
      }
      
      modalTitle.textContent = 'Modifier le produit';
      ModalManager.openModal('productModal');
    }
  });

  // Supprimer produit
  AppUtils.delegate(productsGrid, 'click', '[data-action="delete-product"]', async (e) => {
    const btn = e.target.closest('button');
    const id = btn.dataset.productId;
    
    if (confirm('Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible.')) {
      try {
        UI.showLoader();
        const response = await fetch(`/api/products/${id}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          UI.showNotification('Succès', 'Produit supprimé avec succès', 'success');
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
    }
  });

  // Copier le lien
  AppUtils.delegate(productsGrid, 'click', '[data-action="copy-link"]', (e) => {
    const btn = e.target.closest('button');
    const link = btn.dataset.shareLink;
    if (link) {
      navigator.clipboard.writeText(link).then(() => {
        UI.showNotification('Lien copié', 'Le lien du produit a été copié dans le presse-papiers.', 'success');
      }).catch(() => {
        UI.showNotification('Erreur', 'Impossible de copier le lien.', 'error');
      });
    }
  });

  // Soumission du formulaire (Création / Modification)
  if (productForm) {
    productForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(productForm);
      const productId = document.getElementById('productId').value;
      const isEdit = !!productId;
      
      const url = isEdit ? `/api/products/${productId}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';
      
      try {
        UI.showLoader();
        
        const response = await fetch(url, {
          method: method,
          body: formData
        });
        
        if (response.ok) {
          UI.showNotification('Succès', `Produit ${isEdit ? 'modifié' : 'créé'} avec succès`, 'success');
          ModalManager.closeModal('productModal');
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

  // Aperçu de l'image
  const imageInput = document.getElementById('image');
  if (imageInput) {
    imageInput.addEventListener('change', function() {
      const preview = document.getElementById('imagePreview');
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
          preview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width:100px; border-radius:8px;">`;
        };
        reader.readAsDataURL(this.files[0]);
      }
    });
  }
});
