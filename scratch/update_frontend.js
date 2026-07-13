const fs = require('fs');
const path = require('path');

const ejsPath = path.join(__dirname, '../views/dashboard/products.ejs');
let ejsContent = fs.readFileSync(ejsPath, 'utf8');

const htmlToReplace = `<div class="form-group">
          <label for="image" class="form-label">Image du produit</label>
          <input type="file" id="image" name="image" class="form-input" accept="image/jpeg,image/png,image/gif,image/webp">
          <p class="form-help">Format acceptés: JPG, PNG, GIF, WEBP (max 5MB)</p>
          <div id="imagePreview" style="margin-top:12px;"></div>
        </div>`;

const newHtml = `<% 
          let maxImages = 1;
          let maxVideos = 0;
          if(user.plan_slug === 'pro') maxImages = 4;
          else if(user.plan_slug === 'business') {
            maxImages = 7;
            maxVideos = 1;
          }
        %>
        <div class="form-group">
          <label for="images" class="form-label">Images du produit (Max: <%= maxImages %>)</label>
          <input type="file" id="images" name="images" class="form-input" accept="image/jpeg,image/png,image/gif,image/webp" multiple>
          <p class="form-help">Formats acceptés: JPG, PNG, GIF, WEBP (max 3Mo/image). La première image sera la couverture.</p>
          <div id="imagesPreview" style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;"></div>
        </div>
        
        <% if (maxVideos > 0) { %>
        <div class="form-group">
          <label for="video" class="form-label">Vidéo du produit (Optionnel, Max: 1)</label>
          <input type="file" id="video" name="video" class="form-input" accept="video/mp4,video/webm,video/quicktime">
          <p class="form-help">Formats acceptés: MP4, WEBM, MOV (max 15Mo, 45s). <button type="button" id="deleteExistingVideoBtn" class="btn btn-sm btn-danger" style="display:none;margin-top:5px;">Supprimer la vidéo existante</button></p>
          <div id="videoPreview" style="margin-top:12px;"></div>
        </div>
        <% } %>
        <div id="retainedMediaContainer"></div>
        <input type="hidden" id="deleteVideoFlag" name="deleteVideo" value="false">`;

ejsContent = ejsContent.replace(htmlToReplace, newHtml);

// Also add data-attributes to the form
ejsContent = ejsContent.replace('<form id="productForm" enctype="multipart/form-data">', '<form id="productForm" enctype="multipart/form-data" data-max-images="<%= maxImages %>" data-max-videos="<%= maxVideos %>">');

fs.writeFileSync(ejsPath, ejsContent);

const jsPath = path.join(__dirname, '../public/js/products.js');
let jsContent = fs.readFileSync(jsPath, 'utf8');

const jsEditLogic = `  // Modifier produit
  AppUtils.delegate(productsGrid, 'click', '[data-action="edit-product"]', async (e) => {
    const btn = e.target.closest('button');
    const id = btn.dataset.productId;
    
    try {
      UI.showLoader();
      const res = await fetch(\`/api/products/\${id}\`);
      const data = await res.json();
      if(data.success) {
        const product = data.data.product;
        document.getElementById('productId').value = product.id;
        document.getElementById('name').value = product.name;
        document.getElementById('description').value = product.description || '';
        document.getElementById('price').value = product.price;
        document.getElementById('currency').value = product.currency || 'XAF';
        document.getElementById('stock_quantity').value = product.stock_quantity;
        document.getElementById('category_id').value = product.category_id || '';
        document.getElementById('is_available').value = product.is_available.toString();
        
        document.getElementById('deleteVideoFlag').value = 'false';
        const deleteVidBtn = document.getElementById('deleteExistingVideoBtn');
        if(deleteVidBtn) deleteVidBtn.style.display = 'none';

        const imgPreview = document.getElementById('imagesPreview');
        const vidPreview = document.getElementById('videoPreview');
        const retainedContainer = document.getElementById('retainedMediaContainer');
        if (imgPreview) imgPreview.innerHTML = '';
        if (vidPreview) vidPreview.innerHTML = '';
        if (retainedContainer) retainedContainer.innerHTML = '';

        if(product.media && product.media.length > 0) {
           product.media.forEach(m => {
             if(m.media_type === 'image') {
               imgPreview.innerHTML += \`<div style="position:relative; display:inline-block;">
                  <img src="\${m.url}" style="width:80px;height:80px;object-fit:cover;border-radius:4px;">
                  <input type="hidden" name="retainedMediaIds" value="\${m.public_id}">
                  <button type="button" class="btn btn-sm btn-danger remove-retained-img" style="position:absolute;top:-5px;right:-5px;padding:2px 5px;border-radius:50%;">×</button>
               </div>\`;
             } else if (m.media_type === 'video' && vidPreview) {
               vidPreview.innerHTML = \`<video src="\${m.url}" controls style="max-width:200px;border-radius:4px;"></video>\`;
               if(deleteVidBtn) deleteVidBtn.style.display = 'inline-block';
             }
           });
        }

        modalTitle.textContent = 'Modifier le produit';
        ModalManager.openModal('productModal');
      }
    } catch(err) {
       UI.showNotification('Erreur', 'Impossible de charger le produit', 'error');
    } finally {
      UI.hideLoader();
    }
  });`;

// Replace the old edit product block which started at `// Modifier produit` until `// Supprimer produit`
jsContent = jsContent.replace(/\/\/ Modifier produit[\s\S]*?\/\/ Supprimer produit/, jsEditLogic + '\n\n  // Supprimer produit');

const jsPreviewLogic = `  // Aperçu de l'image
  const imagesInput = document.getElementById('images');
  if (imagesInput) {
    imagesInput.addEventListener('change', function () {
      const preview = document.getElementById('imagesPreview');
      // Do not clear entirely, as there might be retained images
      // But we can clear previously selected new images preview if we want to isolate them.
      // We will just append them or use a separate container. Let's use a separate container for new ones.
      let newPreviewContainer = document.getElementById('newImagesPreview');
      if(!newPreviewContainer) {
         newPreviewContainer = document.createElement('div');
         newPreviewContainer.id = 'newImagesPreview';
         newPreviewContainer.style.display = 'flex';
         newPreviewContainer.style.gap = '8px';
         newPreviewContainer.style.flexWrap = 'wrap';
         preview.parentNode.appendChild(newPreviewContainer);
      }
      newPreviewContainer.innerHTML = '';
      
      const maxImages = parseInt(document.getElementById('productForm').dataset.maxImages) || 1;
      const retainedCount = document.querySelectorAll('input[name="retainedMediaIds"]').length;
      
      if (this.files.length + retainedCount > maxImages) {
         UI.showNotification('Erreur', \`Vous ne pouvez pas dépasser \${maxImages} image(s) au total.\`, 'error');
         this.value = ''; // clear
         return;
      }

      Array.from(this.files).forEach(file => {
        if(file.size > 3 * 1024 * 1024) {
           UI.showNotification('Erreur', \`L'image \${file.name} dépasse 3 Mo.\`, 'error');
           this.value = '';
           newPreviewContainer.innerHTML = '';
           return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
          newPreviewContainer.innerHTML += \`<img src="\${e.target.result}" style="width:80px;height:80px;object-fit:cover;border-radius:4px;border:2px solid var(--color-primary);">\`;
        };
        reader.readAsDataURL(file);
      });
    });
  }

  const videoInput = document.getElementById('video');
  if (videoInput) {
     videoInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
           const file = this.files[0];
           if (file.size > 15 * 1024 * 1024) {
              UI.showNotification('Erreur', 'La vidéo ne doit pas dépasser 15 Mo.', 'error');
              this.value = '';
              return;
           }
           const vidPreview = document.getElementById('videoPreview');
           vidPreview.innerHTML = \`<p style="color:var(--color-primary);">Vidéo sélectionnée: \${file.name}</p>\`;
        }
     });
  }

  // Handle remove retained image
  document.addEventListener('click', (e) => {
     if(e.target.classList.contains('remove-retained-img')) {
        e.target.parentElement.remove();
     }
     if(e.target.id === 'deleteExistingVideoBtn') {
        document.getElementById('deleteVideoFlag').value = 'true';
        const vidPreview = document.getElementById('videoPreview');
        if(vidPreview) vidPreview.innerHTML = '';
        e.target.style.display = 'none';
     }
  });`;

jsContent = jsContent.replace(/\/\/ Aperçu de l'image[\s\S]*?\}\);/g, jsPreviewLogic + '\n});');

fs.writeFileSync(jsPath, jsContent);
console.log('Frontend updated');
`;
fs.writeFileSync(path.join(__dirname, 'update_frontend.js'), fileContent);
