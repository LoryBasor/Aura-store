/**
 * public/js/products.js
 * Gère l'interactivité de la page Produits (Modals, AJAX CRUD)
 */

document.addEventListener('DOMContentLoaded', () => {
  const productModal = document.getElementById('productModal');
  const productForm  = document.getElementById('productForm');
  const modalTitle   = document.getElementById('modalTitle');
  const productsGrid = document.getElementById('productsGrid');

  /* ─────────────────────────────────────────
     Helpers pour la zone de prévisualisation
     ───────────────────────────────────────── */

  /** Vide tous les aperçus médias du modal */
  function resetMediaPreviews() {
    const imgPreview      = document.getElementById('imagesPreview');
    const newImgPreview   = document.getElementById('newImagesPreview');
    const vidPreview      = document.getElementById('videoPreview');
    const deleteVidFlag   = document.getElementById('deleteVideoFlag');
    const deleteVidBtn    = document.getElementById('deleteExistingVideoBtn');

    if (imgPreview)    imgPreview.innerHTML    = '';
    if (newImgPreview) newImgPreview.innerHTML = '';
    if (vidPreview)    vidPreview.innerHTML    = '';
    if (deleteVidFlag) deleteVidFlag.value     = 'false';
    if (deleteVidBtn)  deleteVidBtn.style.display = 'none';
  }

  /** Insère les thumbnails des médias existants dans le modal (mode édition) */
  function renderExistingMedia(media) {
    const imgPreview = document.getElementById('imagesPreview');
    const vidPreview = document.getElementById('videoPreview');
    const deleteVidBtn = document.getElementById('deleteExistingVideoBtn');

    if (!media || media.length === 0) return;

    media.forEach(m => {
      if (m.media_type === 'image' && imgPreview) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:relative; display:inline-block; margin:4px;';
        wrapper.innerHTML = `
          <img src="${m.url}"
               style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:2px solid var(--color-border,#e5e7eb);"
               loading="lazy"
               onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22><rect width=%2280%22 height=%2280%22 fill=%22%23f3f4f6%22/><text x=%2240%22 y=%2245%22 text-anchor=%22middle%22 fill=%22%239ca3af%22 font-size=%2212%22>img</text></svg>'">
          <input type="hidden" name="retainedMediaIds" value="${m.public_id}">
          <button type="button"
                  class="remove-retained-img"
                  title="Supprimer"
                  style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#ef4444;color:white;border:none;cursor:pointer;font-size:14px;line-height:1;display:flex;align-items:center;justify-content:center;">×</button>
        `;
        imgPreview.appendChild(wrapper);

      } else if (m.media_type === 'video' && vidPreview) {
        vidPreview.innerHTML = `
          <video src="${m.url}" controls
                 style="max-width:200px;max-height:120px;border-radius:6px;"></video>`;
        if (deleteVidBtn) deleteVidBtn.style.display = 'inline-block';
      }
    });
  }

  /* ─────────────────────────────────────────
     Action : Nouveau produit
     ───────────────────────────────────────── */
  AppUtils.onAll('[data-action="new-product"]', 'click', () => {
    productForm.reset();
    document.getElementById('productId').value = '';
    modalTitle.textContent = 'Nouveau produit';
    resetMediaPreviews();
    ModalManager.openModal('productModal');
  });

  /* ─────────────────────────────────────────
     Action : Modifier produit
     ───────────────────────────────────────── */
  AppUtils.delegate(productsGrid, 'click', '[data-action="edit-product"]', async (e) => {
    const btn = e.target.closest('button');
    const id  = btn.dataset.productId;

    try {
      UI.showLoader();
      const res  = await fetch(`/api/products/${id}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Impossible de charger le produit');
      }

      const product = data.data.product;

      // Remplir les champs texte
      document.getElementById('productId').value       = product.id;
      document.getElementById('name').value            = product.name;
      document.getElementById('description').value     = product.description || '';
      document.getElementById('price').value           = product.price;
      document.getElementById('currency').value        = product.currency || 'XAF';
      document.getElementById('stock_quantity').value  = product.stock_quantity;
      document.getElementById('category_id').value     = product.category_id || '';
      document.getElementById('is_available').value    = product.is_available.toString();

      // Réinitialiser les aperçus puis afficher les médias existants
      resetMediaPreviews();
      renderExistingMedia(product.media || []);

      modalTitle.textContent = 'Modifier le produit';
      ModalManager.openModal('productModal');

    } catch (err) {
      UI.showNotification('Erreur', err.message || 'Impossible de charger le produit', 'error');
    } finally {
      UI.hideLoader();
    }
  });

  /* ─────────────────────────────────────────
     Action : Supprimer produit
     ───────────────────────────────────────── */
  AppUtils.delegate(productsGrid, 'click', '[data-action="delete-product"]', async (e) => {
    const btn = e.target.closest('button');
    const id  = btn.dataset.productId;

    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible.')) return;

    try {
      UI.showLoader();
      const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });

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
  });

  /* ─────────────────────────────────────────
     Action : Copier le lien
     ───────────────────────────────────────── */
  AppUtils.delegate(productsGrid, 'click', '[data-action="copy-link"]', (e) => {
    const btn  = e.target.closest('button');
    const link = btn.dataset.shareLink;
    if (!link) return;
    navigator.clipboard.writeText(link)
      .then(() => UI.showNotification('Lien copié', 'Le lien a été copié dans le presse-papiers.', 'success'))
      .catch(() => UI.showNotification('Erreur', 'Impossible de copier le lien.', 'error'));
  });

  /* ─────────────────────────────────────────
     Soumission du formulaire (Création / Modification)
     ───────────────────────────────────────── */
  if (productForm) {
    productForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const productId = document.getElementById('productId').value;
      const isEdit    = !!productId;
      const url       = isEdit ? `/api/products/${productId}` : '/api/products';
      const method    = isEdit ? 'PUT' : 'POST';

      // Construire le FormData depuis le formulaire
      const formData = new FormData(productForm);

      try {
        UI.showLoader();
        const response = await fetch(url, { method, body: formData });
        const result   = await response.json();

        if (response.ok && result.success) {
          UI.showNotification('Succès', `Produit ${isEdit ? 'modifié' : 'créé'} avec succès`, 'success');
          ModalManager.closeModal('productModal');
          window.location.reload();
        } else {
          throw new Error(result.error || result.message || "Erreur lors de l'enregistrement");
        }
      } catch (error) {
        UI.showNotification('Erreur', error.message, 'error');
      } finally {
        UI.hideLoader();
      }
    });
  }

  /* ─────────────────────────────────────────
     Prévisualisation : Images sélectionnées
     ───────────────────────────────────────── */
  const imagesInput = document.getElementById('images');
  if (imagesInput) {
    imagesInput.addEventListener('change', function () {
      // Conteneur dédié aux NOUVELLES images (à distinguer des images existantes)
      let newContainer = document.getElementById('newImagesPreview');
      if (!newContainer) {
        newContainer = document.createElement('div');
        newContainer.id = 'newImagesPreview';
        newContainer.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;';
        const imagesPreview = document.getElementById('imagesPreview');
        if (imagesPreview) imagesPreview.parentNode.insertBefore(newContainer, imagesPreview.nextSibling);
      }
      newContainer.innerHTML = '';

      const form          = document.getElementById('productForm');
      const maxImages     = form && form.dataset.maxImages ? parseInt(form.dataset.maxImages) : 1;
      const retainedCount = document.querySelectorAll('#imagesPreview input[name="retainedMediaIds"]').length;
      const files         = Array.from(this.files);

      if (files.length + retainedCount > maxImages) {
        UI.showNotification('Erreur', `Limite atteinte : max ${maxImages} image(s) (${retainedCount} conservée(s)).`, 'error');
        this.value = '';
        return;
      }

      let hasError = false;
      files.forEach(file => {
        if (file.size > 3 * 1024 * 1024) {
          UI.showNotification('Erreur', `"${file.name}" dépasse 3 Mo.`, 'error');
          hasError = true;
          return;
        }
        const reader = new FileReader();
        reader.onload = (evt) => {
          const img = document.createElement('img');
          img.src   = evt.target.result;
          img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:6px;border:2px solid var(--color-primary,#6366f1);';
          img.title = file.name;
          newContainer.appendChild(img);
        };
        reader.readAsDataURL(file);
      });

      if (hasError) {
        this.value = '';
        newContainer.innerHTML = '';
      }
    });
  }

  /* ─────────────────────────────────────────
     Prévisualisation : Vidéo sélectionnée
     ───────────────────────────────────────── */
  const videoInput = document.getElementById('video');
  if (videoInput) {
    videoInput.addEventListener('change', function () {
      const vidPreview = document.getElementById('videoPreview');
      if (!vidPreview) return;

      if (this.files && this.files[0]) {
        const file = this.files[0];
        if (file.size > 15 * 1024 * 1024) {
          UI.showNotification('Erreur', 'La vidéo ne doit pas dépasser 15 Mo.', 'error');
          this.value = '';
          return;
        }
        vidPreview.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--color-accent,#f3f4f6);border-radius:6px;">
            <span style="font-size:24px;">🎬</span>
            <div>
              <div style="font-weight:600;font-size:13px;">${file.name}</div>
              <div style="font-size:12px;color:var(--color-secondary,#6b7280);">${(file.size / 1024 / 1024).toFixed(1)} Mo</div>
            </div>
          </div>`;
      }
    });
  }

  /* ─────────────────────────────────────────
     Délégation : Supprimer image conservée / Supprimer vidéo
     ───────────────────────────────────────── */
  document.addEventListener('click', (e) => {
    // Supprimer une image conservée
    if (e.target.classList.contains('remove-retained-img')) {
      e.target.closest('div[style]').remove();
    }

    // Marquer la vidéo existante pour suppression
    if (e.target.id === 'deleteExistingVideoBtn') {
      const flag = document.getElementById('deleteVideoFlag');
      if (flag) flag.value = 'true';
      const vidPreview = document.getElementById('videoPreview');
      if (vidPreview) vidPreview.innerHTML = '<p style="color:#ef4444;font-size:13px;">Vidéo supprimée à l\'enregistrement</p>';
      e.target.style.display = 'none';
    }
  });
});
