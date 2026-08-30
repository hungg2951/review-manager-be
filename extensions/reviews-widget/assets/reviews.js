let rwGradIdCounter = 0;
// ─── Star SVG dùng chung cho recap (bước 2) và lightbox ──────────
const STAR_PATH =
  'M10 1l2.6 5.8 6.4.6-4.8 4.3 1.4 6.3-5.6-3.4-5.6 3.4 1.4-6.3L1 7.4l6.4-.6z';
function starSVG(filled) {
  return `<svg class="rw-star${filled ? ' rw-star--filled' : ''}" viewBox="0 0 20 20"><path d="${STAR_PATH}"></path></svg>`;
}

function renderPartialStars(avg, sizeClass) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    const diff = avg - i + 1;
    let fillPercent;
    if (diff >= 1) fillPercent = 100;
    else if (diff <= 0) fillPercent = 0;
    else fillPercent = Math.round(diff * 100);

    const gradId = `rw-dyn-grad-${rwGradIdCounter++}`;
    html += `
      <svg class="rw-star${sizeClass ? ' ' + sizeClass : ''}" viewBox="0 0 20 20">
        <defs>
          <linearGradient id="${gradId}">
            <stop offset="${fillPercent}%" class="rw-star-partial-fill" />
            <stop offset="${fillPercent}%" class="rw-star-partial-empty" />
          </linearGradient>
        </defs>
        <path d="M10 1l2.6 5.8 6.4.6-4.8 4.3 1.4 6.3-5.6-3.4-5.6 3.4 1.4-6.3L1 7.4l6.4-.6z" fill="url(#${gradId})" />
      </svg>`;
  }
  return html;
}

function updateSummaryAfterSubmit(newRating) {
  // ─── Summary trong reviews-main ─────────────────────────────────
  const summaryAvgEl = document.getElementById('rw-summary-avg');
  if (summaryAvgEl) {
    const sum = Number(summaryAvgEl.dataset.sum || 0) + newRating;
    const count = Number(summaryAvgEl.dataset.count || 0) + 1;
    const avg = sum / count;

    summaryAvgEl.textContent = avg.toFixed(1);
    summaryAvgEl.dataset.sum = sum;
    summaryAvgEl.dataset.count = count;

    const starsEl = document.getElementById('rw-summary-stars');
    if (starsEl) starsEl.innerHTML = renderPartialStars(avg);

    const countEl = document.getElementById('rw-summary-count');
    if (countEl)
      countEl.textContent = `${count} review${count !== 1 ? 's' : ''}`;
  }

  // ─── Badge (block riêng, có thể không tồn tại nếu merchant chưa đặt) ─
  const badgeEl = document.getElementById('rw-badge');
  if (badgeEl) {
    const sum = Number(badgeEl.dataset.sum || 0) + newRating;
    const count = Number(badgeEl.dataset.count || 0) + 1;
    const avg = sum / count;

    badgeEl.dataset.sum = sum;
    badgeEl.dataset.count = count;

    const starsEl = document.getElementById('rw-badge-stars');
    if (starsEl) starsEl.innerHTML = renderPartialStars(avg, 'rw-star--sm');

    const textEl = document.getElementById('rw-badge-text');
    if (textEl) textEl.textContent = `${avg.toFixed(1)} (${count})`;
  }
}

function insertOptimisticReview({ rating, author, title, body, images }) {
  const list = document.getElementById('rw-list');
  const emptyMsg = document.querySelector('.rw-empty');
  if (!list) return;

  const starsHtml = Array.from({ length: 5 }, (_, i) =>
    starSVG(i < rating).replace('rw-star', 'rw-star rw-star--sm'),
  ).join('');
  const safeAuthor = escapeHtml(author || 'Anonymous');
  const safeTitle = title ? escapeHtml(title) : '';
  const safeBody = escapeHtml(body || '');

  const imagesHtml =
    images && images.length > 0
      ? `<div class="rw-item-images">${images
          .map(
            (url) =>
              `<img src="${url}" alt="" class="rw-item-image" loading="lazy" width="60" height="60">`,
          )
          .join('')}</div>`
      : '';

  const item = document.createElement('div');
  item.className = 'rw-item';
  item.dataset.rating = rating;
  item.dataset.hasImage = 0;
  item.dataset.hasImage = images && images.length > 0 ? 1 : 0;
  item.dataset.index = -1;

  item.innerHTML = `
    <div class="rw-item-top">
      <div class="rw-avatar">${safeAuthor.charAt(0).toUpperCase()}</div>
      <div>
        <div class="rw-author-name">${safeAuthor} <span class="rw-verified">✓ Verified</span></div>
        <div class="rw-item-date">${new Date().toLocaleDateString()}</div>
      </div>
    </div>
    <span class="rw-stars" aria-hidden="true">${starsHtml}</span>
    ${safeTitle ? `<p class="rw-item-title">${safeTitle}</p>` : ''}
    <p class="rw-item-body">${safeBody}</p>
    ${imagesHtml}
  `;

  // Nếu trước đó chưa có review nào (đang hiện "No reviews yet"), ẩn message đó
  // và cần tạo #rw-list nếu nó chưa tồn tại trong DOM (trường hợp reviews.size == 0 lúc render).
  if (emptyMsg) emptyMsg.style.display = 'none';

  list.insertBefore(item, list.firstChild);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  const main = document.getElementById('rw-main');
  if (!main) return;

  const productGid = main.dataset.productId;
  const list = document.getElementById('rw-list');
  const items = list ? Array.from(list.querySelectorAll('.rw-item')) : [];

  // ─── Filter ─────────────────────────────────────────────────────
  const activeRatings = new Set();
  let onlyWithImages = false;

  const filterEmptyMsg = document.getElementById('rw-filter-empty');

  function applyFilters() {
    let visibleCount = 0;
    items.forEach((item) => {
      const rating = Number(item.dataset.rating);
      const hasImage = Number(item.dataset.hasImage) > 0;
      const matchRating = activeRatings.size === 0 || activeRatings.has(rating);
      const matchImage = !onlyWithImages || hasImage;
      const visible = matchRating && matchImage;
      item.style.display = visible ? '' : 'none';
      if (visible) visibleCount++;
    });

    if (filterEmptyMsg) {
      filterEmptyMsg.hidden = visibleCount !== 0;
    }
  }

  document.querySelectorAll('[data-filter-rating]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = Number(btn.dataset.filterRating);
      if (activeRatings.has(val)) {
        activeRatings.delete(val);
        btn.classList.remove('rw-filter-tag--active');
      } else {
        activeRatings.add(val);
        btn.classList.add('rw-filter-tag--active');
      }
      applyFilters();
    });
  });

  const imgFilterBtn = document.querySelector('[data-filter-images]');
  if (imgFilterBtn) {
    imgFilterBtn.addEventListener('click', () => {
      onlyWithImages = !onlyWithImages;
      imgFilterBtn.classList.toggle('rw-filter-tag--active', onlyWithImages);
      applyFilters();
    });
  }

  // ─── Sort: icon button + dropdown thay cho <select> ────────────────
  const sortBtn = document.getElementById('rw-sort-btn');
  const sortMenu = document.getElementById('rw-sort-menu');

  function applySort(mode) {
    const sorted = [...items].sort((a, b) => {
      if (mode === 'highest')
        return Number(b.dataset.rating) - Number(a.dataset.rating);
      if (mode === 'lowest')
        return Number(a.dataset.rating) - Number(b.dataset.rating);
      if (mode === 'pictures')
        return Number(b.dataset.hasImage) - Number(a.dataset.hasImage);
      return Number(a.dataset.index) - Number(b.dataset.index);
    });
    sorted.forEach((el) => list.appendChild(el));
  }

  if (sortBtn && sortMenu) {
    sortBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !sortMenu.hidden;
      sortMenu.hidden = isOpen;
      sortBtn.setAttribute('aria-expanded', String(!isOpen));
    });

    sortMenu.querySelectorAll('[data-sort-value]').forEach((option) => {
      option.addEventListener('click', () => {
        sortMenu
          .querySelectorAll('.rw-sort-menu-item')
          .forEach((el) => el.classList.remove('rw-sort-menu-item--active'));
        option.classList.add('rw-sort-menu-item--active');
        applySort(option.dataset.sortValue);
        sortMenu.hidden = true;
        sortBtn.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', (e) => {
      if (
        !sortMenu.hidden &&
        !sortMenu.contains(e.target) &&
        e.target !== sortBtn
      ) {
        sortMenu.hidden = true;
        sortBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ─── Modal viết review ───────────────────────────────────────────
  const overlay = document.getElementById('rw-modal-overlay');
  const openBtn = document.getElementById('rw-open-modal');
  const closeBtn = document.getElementById('rw-modal-close');
  const form = document.getElementById('rw-form');
  const errorBox = document.getElementById('rw-form-error');
  const submitBtn = document.getElementById('rw-submit-btn');

  // ─── Rating picker — dùng event delegation trên container cha ────
  const ratingContainer = document.getElementById('rw-rating-input');
  const ratingInput = document.getElementById('rw-rating-value');
  const recapStars = document.getElementById('rw-recap-stars');

  if (ratingContainer) {
    ratingContainer.addEventListener('click', (e) => {
      const star = e.target.closest('.rw-star-pick');
      if (!star) return;
      const val = Number(star.dataset.value);
      ratingInput.value = val;
      ratingContainer.querySelectorAll('.rw-star-pick').forEach((s) => {
        s.classList.toggle('rw-star--filled', Number(s.dataset.value) <= val);
      });
      if (recapStars) {
        recapStars.innerHTML = Array.from({ length: 5 }, (_, i) =>
          starSVG(i < val),
        ).join('');
      }
    });
  }

  // ─── Điều hướng modal nhiều bước ──────────────────────────────────
  const steps = form ? Array.from(form.querySelectorAll('.rw-step')) : [];
  const backBtn = document.getElementById('rw-step-back');
  const nextBtn = document.getElementById('rw-step-next');
  const totalSteps = steps.length;
  let currentStep = 1;

  function showStep(stepNum) {
    steps.forEach((s) => {
      s.hidden = Number(s.dataset.step) !== stepNum;
    });
    if (backBtn) backBtn.hidden = stepNum === 1;
    if (nextBtn) nextBtn.hidden = stepNum === totalSteps;
    if (submitBtn) submitBtn.hidden = stepNum !== totalSteps;
    if (errorBox) errorBox.hidden = true;
  }

  function validateStep(stepNum) {
    if (stepNum === 1 && !ratingInput.value) {
      errorBox.textContent = 'Please select a rating.';
      errorBox.hidden = false;
      return false;
    }
    if (stepNum === 2) {
      const body = document.getElementById('rw-input-body');
      if (!body.value.trim()) {
        errorBox.textContent = 'Please write your review.';
        errorBox.hidden = false;
        return false;
      }
    }
    if (stepNum === 3) {
      const email = document.getElementById('rw-input-email');
      const nameInput = document.getElementById('rw-input-name');
      // const anonymous = document.getElementById('rw-input-anonymous'); // tạm comment: tính năng ẩn danh
      if (!email.value.trim()) {
        errorBox.textContent = 'Please enter your email address.';
        errorBox.hidden = false;
        return false;
      }
      // if (!anonymous.checked && !nameInput.value.trim()) {
      if (!nameInput.value.trim()) {
        errorBox.textContent = 'Please enter a display name.';
        errorBox.hidden = false;
        return false;
      }
    }
    return true;
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (!validateStep(currentStep)) return;
      currentStep = Math.min(currentStep + 1, totalSteps);
      showStep(currentStep);
    });
  }
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      currentStep = Math.max(currentStep - 1, 1);
      showStep(currentStep);
    });
  }

  // ─── Dropzone upload ảnh (kéo-thả + hiện tên file đã chọn) ────────
  // ─── Upload ảnh: validate định dạng + preview + cho xoá từng ảnh ───
  const uploadDropzone = document.getElementById('rw-upload-dropzone');
  const uploadInput = document.getElementById('rw-input-images');
  const uploadPreviews = document.getElementById('rw-upload-previews');
  const uploadError = document.getElementById('rw-upload-error');

  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ];
  const MAX_FILES = 5;

  // Giữ danh sách file hợp lệ ở đây (không dùng thẳng input.files vì
  // FileList là read-only, không thể xoá từng phần tử trực tiếp).
  let selectedFiles = [];

  function showUploadError(message) {
    if (!uploadError) return;
    uploadError.textContent = message;
    uploadError.hidden = false;
  }

  function clearUploadError() {
    if (uploadError) uploadError.hidden = true;
  }

  // Đồng bộ selectedFiles → input.files thật, để form submit lấy đúng
  // danh sách file đã lọc (dùng DataTransfer vì không gán trực tiếp
  // FileList được).
  function syncInputFiles() {
    const dt = new DataTransfer();
    selectedFiles.forEach((file) => dt.items.add(file));
    uploadInput.files = dt.files;
  }

  function renderPreviews() {
    uploadPreviews.innerHTML = '';
    selectedFiles.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      const item = document.createElement('div');
      item.className = 'rw-upload-preview-item';
      item.innerHTML = `
      <img src="${url}" alt="">
      <button type="button" class="rw-upload-preview-remove" data-index="${index}" aria-label="Remove image">&times;</button>
    `;
      uploadPreviews.appendChild(item);
    });
  }

  function handleNewFiles(fileList) {
    clearUploadError();
    const incoming = Array.from(fileList || []);
    const rejected = [];

    incoming.forEach((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        rejected.push(file.name);
        return;
      }
      if (selectedFiles.length >= MAX_FILES) {
        rejected.push(`${file.name} (đã đạt tối đa ${MAX_FILES} ảnh)`);
        return;
      }
      selectedFiles.push(file);
    });

    if (rejected.length > 0) {
      showUploadError(
        `Không hỗ trợ hoặc vượt giới hạn: ${rejected.join(', ')}. Chỉ chấp nhận JPEG, PNG, WEBP, HEIC.`,
      );
    }

    syncInputFiles();
    renderPreviews();
  }

  if (uploadInput) {
    uploadInput.addEventListener('change', () => {
      handleNewFiles(uploadInput.files);
    });
  }

  if (uploadPreviews) {
    uploadPreviews.addEventListener('click', (e) => {
      const btn = e.target.closest('.rw-upload-preview-remove');
      if (!btn) return;
      const index = Number(btn.dataset.index);
      selectedFiles.splice(index, 1);
      syncInputFiles();
      renderPreviews();
    });
  }

  if (uploadDropzone && uploadInput) {
    ['dragenter', 'dragover'].forEach((evt) => {
      uploadDropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        uploadDropzone.classList.add('rw-upload-dropzone--dragover');
      });
    });
    ['dragleave', 'drop'].forEach((evt) => {
      uploadDropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        uploadDropzone.classList.remove('rw-upload-dropzone--dragover');
      });
    });
    uploadDropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length) {
        // Kéo-thả không bị lọc bởi accept attribute, nên bắt buộc validate ở đây
        handleNewFiles(files);
      }
    });
  }

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      currentStep = 1;
      showStep(currentStep);
      overlay.classList.add('rw-modal-overlay--open');
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () =>
      overlay.classList.remove('rw-modal-overlay--open'),
    );
  }
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay)
        overlay.classList.remove('rw-modal-overlay--open');
    });
  }

  // ─── Lightbox — split view: ảnh lớn + panel review bên phải ───────
  let reviewsData = [];
  try {
    const raw = document.getElementById('rw-reviews-data');
    if (raw) reviewsData = JSON.parse(raw.textContent);
  } catch (err) {
    console.error('Không đọc được rw-reviews-data:', err);
  }

  const lightbox = document.getElementById('rw-lightbox');
  const lightboxImg = document.getElementById('rw-lightbox-img');
  const lightboxClose = document.getElementById('rw-lightbox-close');
  const lightboxPrev = document.getElementById('rw-lightbox-prev');
  const lightboxNext = document.getElementById('rw-lightbox-next');
  const lightboxThumbs = document.getElementById('rw-lightbox-thumbs');
  const lightboxStars = document.getElementById('rw-lightbox-stars');
  const lightboxAvatar = document.getElementById('rw-lightbox-avatar');
  const lightboxName = document.getElementById('rw-lightbox-name');
  const lightboxDate = document.getElementById('rw-lightbox-date');
  const lightboxBody = document.getElementById('rw-lightbox-body');

  // ─── Thoát khỏi stacking context của theme ────────────────────────
  // Nếu bất kỳ phần tử cha nào (header, section wrapper...) có transform/
  // filter/will-change/perspective/contain, thì position:fixed của modal
  // sẽ bị "nhốt" theo khung của phần tử đó thay vì theo viewport — khiến
  // menu/header (nằm ở nhánh DOM khác, stacking context khác) đè lên được
  // dù z-index của modal có lớn cỡ nào. Đẩy thẳng 2 phần tử này ra làm con
  // của <body> để chúng luôn nằm ở stacking context gốc, cao nhất trang.
  [overlay, lightbox].forEach((el) => {
    if (el && el.parentElement !== document.body) {
      document.body.appendChild(el);
    }
  });

  let lbReviewIndex = 0;
  let lbImageIndex = 0;

  function renderLightbox() {
    const review = reviewsData[lbReviewIndex];
    if (!review) return;
    const imgs = review.images || [];
    const current = imgs[lbImageIndex];

    lightboxImg.src = current ? current.full : '';

    // Panel thông tin review
    lightboxStars.innerHTML = Array.from({ length: 5 }, (_, i) =>
      starSVG(i < review.rating),
    ).join('');
    lightboxAvatar.textContent = (review.author || 'A')
      .slice(0, 1)
      .toUpperCase();
    lightboxName.innerHTML = review.verified
      ? `${escapeHtml(review.author || 'Anonymous')} <span class="rw-verified">✓ Verified</span>`
      : escapeHtml(review.author || 'Anonymous');
    lightboxDate.textContent = review.date || '';
    lightboxDate.style.display = review.date ? '' : 'none';
    lightboxBody.textContent = review.body || '';

    // Nút prev/next: ẩn nếu chỉ có 1 ảnh
    const multi = imgs.length > 1;
    lightboxPrev.hidden = !multi;
    lightboxNext.hidden = !multi;
    lightboxThumbs.hidden = !multi;

    // Dải thumbnail
    lightboxThumbs.innerHTML = imgs
      .map(
        (img, i) =>
          `<img src="${img.thumb}" class="rw-lightbox-thumb${i === lbImageIndex ? ' rw-lightbox-thumb--active' : ''}" data-thumb-index="${i}" alt="">`,
      )
      .join('');
  }

  function openLightbox(reviewIndex, imageIndex) {
    if (!reviewsData[reviewIndex]) return;
    lbReviewIndex = reviewIndex;
    lbImageIndex = imageIndex || 0;
    renderLightbox();
    lightbox.classList.add('rw-lightbox--open');
  }

  function closeLightbox() {
    lightbox.classList.remove('rw-lightbox--open');
  }

  function stepImage(delta) {
    const imgs = reviewsData[lbReviewIndex]?.images || [];
    if (imgs.length === 0) return;
    lbImageIndex = (lbImageIndex + delta + imgs.length) % imgs.length;
    renderLightbox();
  }

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.rw-lightbox-trigger');
    if (!trigger) return;
    openLightbox(
      Number(trigger.dataset.reviewIndex),
      Number(trigger.dataset.imageIndex),
    );
  });

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightboxPrev) lightboxPrev.addEventListener('click', () => stepImage(-1));
  if (lightboxNext) lightboxNext.addEventListener('click', () => stepImage(1));
  if (lightboxThumbs) {
    lightboxThumbs.addEventListener('click', (e) => {
      const thumb = e.target.closest('[data-thumb-index]');
      if (!thumb) return;
      lbImageIndex = Number(thumb.dataset.thumbIndex);
      renderLightbox();
    });
  }
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('rw-lightbox--open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') stepImage(-1);
      if (e.key === 'ArrowRight') stepImage(1);
    });
  }

  // ─── Submit form qua App Proxy ──────────────────────────────────
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.hidden = true;

      if (!ratingInput.value) {
        errorBox.textContent = 'Please select a rating.';
        errorBox.hidden = false;
        currentStep = 1;
        showStep(currentStep);
        return;
      }

      const formData = new FormData(form);
      formData.set('shopify_product_id', productGid);

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      try {
        const res = await fetch('/apps/reviews/submit', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Failed to submit review');
        }

        overlay.classList.remove('rw-modal-overlay--open');

        const submittedRating = Number(ratingInput.value);
        const previewImageUrls = selectedFiles.map((file) =>
          URL.createObjectURL(file),
        );

        insertOptimisticReview({
          rating: submittedRating,
          author: formData.get('author_name'),
          title: formData.get('title'),
          body: formData.get('body'),
          images: previewImageUrls,
        });
        updateSummaryAfterSubmit(submittedRating);

        form.reset();
        ratingContainer
          .querySelectorAll('.rw-star-pick')
          .forEach((s) => s.classList.remove('rw-star--filled'));
        if (recapStars) recapStars.innerHTML = '';
        selectedFiles = [];
        if (uploadPreviews) uploadPreviews.innerHTML = '';
        if (uploadInput) uploadInput.value = '';
        currentStep = 1;
        showStep(currentStep);
        // alert(
        //   'Thank you! Your review has been submitted and is pending approval.',
        // );
      } catch (err) {
        errorBox.textContent =
          err.message || 'Something went wrong. Please try again.';
        errorBox.hidden = false;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit review';
      }
    });
  }
});
