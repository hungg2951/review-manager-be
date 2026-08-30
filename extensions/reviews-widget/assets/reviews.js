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

  // ─── Star SVG dùng chung cho recap (bước 2) và lightbox ──────────
  const STAR_PATH =
    'M10 1l2.6 5.8 6.4.6-4.8 4.3 1.4 6.3-5.6-3.4-5.6 3.4 1.4-6.3L1 7.4l6.4-.6z';
  function starSVG(filled) {
    return `<svg class="rw-star${filled ? ' rw-star--filled' : ''}" viewBox="0 0 20 20"><path d="${STAR_PATH}"></path></svg>`;
  }

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
  const uploadDropzone = document.getElementById('rw-upload-dropzone');
  const uploadInput = document.getElementById('rw-input-images');
  const uploadFilenames = document.getElementById('rw-upload-filenames');

  function renderFilenames() {
    if (!uploadInput || !uploadFilenames) return;
    const names = Array.from(uploadInput.files || []).map((f) => f.name);
    uploadFilenames.textContent = names.join(', ');
  }

  if (uploadInput) {
    uploadInput.addEventListener('change', renderFilenames);
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
        uploadInput.files = files;
        renderFilenames();
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

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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
        form.reset();
        ratingContainer
          .querySelectorAll('.rw-star-pick')
          .forEach((s) => s.classList.remove('rw-star--filled'));
        if (recapStars) recapStars.innerHTML = '';
        if (uploadFilenames) uploadFilenames.textContent = '';
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
