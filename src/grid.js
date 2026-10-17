import gsap from 'gsap';
import { getVideosByCategory } from './projects.js';
import {
  videoGrid,
  viewState,
  routing,
  isTouchUi,
  isPhone,
  escapeHtml,
  escapeAttr,
} from './state.js';
import { navigate } from './router.js';

/* ===================================================
   3. VIDEO GRID — portrait flush + idle ambient loops
   =================================================== */
export function populateVideoGrid(categoryId, animate = false) {
  const videos = getVideosByCategory(categoryId);
  previewObserver().disconnect();
  videoGrid.innerHTML = '';

  videos.forEach((video) => {
    const card = document.createElement('article');
    card.className = 'video-card';
    card.setAttribute('data-video-id', video.id);
    card.classList.toggle('is-landscape', video.aspect > 1);
    card.tabIndex = 0;

    const brandHtml = video.brand
      ? `<span class="video-card__brand">${escapeHtml(video.brand)}</span>`
      : '';

    card.innerHTML = `
      <div class="video-card__media">
        <img class="video-card__poster" src="${escapeAttr(video.poster)}" alt="" draggable="false" />
        <video
          class="video-card__video"
          data-src="${escapeAttr(video.preview)}"
          muted
          loop
          playsinline
          preload="none"
          poster="${escapeAttr(video.poster)}"
        ></video>
      </div>
      <div class="video-card__meta">
        <div class="video-card__meta-inner">
          ${brandHtml}
          <h3 class="video-card__title">${escapeHtml(video.title)}</h3>
        </div>
      </div>
    `;

    // Idle ambient sample — loads and plays only while the card is on screen
    previewObserver().observe(card);

    card.addEventListener('mouseenter', () => {
      if (!isTouchUi()) setCardHover(card, true);
    });
    card.addEventListener('mouseleave', () => {
      if (!isTouchUi()) setCardHover(card, false);
    });
    card.addEventListener('focus', () => {
      if (!isTouchUi()) setCardHover(card, true);
    });
    card.addEventListener('blur', () => {
      if (!isTouchUi()) setCardHover(card, false);
    });

    // Touch: distinguish tap vs scroll, then first tap = hover, second = open
    let pointerStart = null;
    let touchOpened = false;

    card.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'mouse') return;
        pointerStart = { x: e.clientX, y: e.clientY };
        touchOpened = false;
      },
      { passive: true }
    );

    card.addEventListener(
      'pointermove',
      (e) => {
        if (!pointerStart || e.pointerType === 'mouse') return;
        const dx = Math.abs(e.clientX - pointerStart.x);
        const dy = Math.abs(e.clientY - pointerStart.y);
        if (dx > 12 || dy > 12) pointerStart = null; // treat as scroll
      },
      { passive: true }
    );

    card.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' || !pointerStart) return;
      pointerStart = null;

      // First tap → hover preview; second tap → open detail
      if (!card.classList.contains('is-hover')) {
        clearVideoCardHovers(card);
        setCardHover(card, true);
        touchOpened = true; // suppress the synthetic click that follows
        return;
      }

      touchOpened = true;
      routing.intent.sourceCard = card;
      navigate(video.path);
    });

    card.addEventListener('pointercancel', () => {
      pointerStart = null;
    });

    card.addEventListener('click', (e) => {
      // Synthetic click after touch — already handled in pointerup
      if (isTouchUi() || touchOpened) {
        e.preventDefault();
        e.stopPropagation();
        touchOpened = false;
        return;
      }
      routing.intent.sourceCard = card;
      navigate(video.path);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        routing.intent.sourceCard = card;
        navigate(video.path);
      }
    });

    videoGrid.appendChild(card);
    setMetaPose(card, false, false);
  });

  fitVideoGrid();

  if (animate) {
    const cards = videoGrid.querySelectorAll('.video-card');
    gsap.fromTo(
      cards,
      { opacity: 0, y: 28, scale: 0.94 },
      { opacity: 1, y: 0, scale: 1, duration: 0.55, stagger: 0.05, ease: 'expo.out' }
    );
  }
}

/* Tile sizing.
   Desktop / tablet: CSS sizes the tiles (4 per row, 3 on tablets, 4:5 tiles);
   here we only pick how many go in a row so the rows come out even — 6 films
   sit 3 + 3 instead of 4 + 2. Phones: explicit heights — with aspect-ratio alone the 2-column
   grid rows collapse (overflow:hidden tiles) and each tile ends up overlapped
   by the next. */
export function fitVideoGrid() {
  if (!videoGrid) return;
  const cards = Array.from(videoGrid.querySelectorAll('.video-card'));
  const phone = isPhone();
  const colW = videoGrid.clientWidth / 2;

  if (phone) {
    videoGrid.style.removeProperty('--per-row');
  } else {
    const maxCols = parseInt(getComputedStyle(videoGrid).getPropertyValue('--cols'), 10) || 4;
    const slots = cards.reduce((n, c) => n + (c.classList.contains('is-landscape') ? 2 : 1), 0);
    const rows = Math.max(1, Math.ceil(slots / maxCols));
    const perRow = Math.max(1, Math.min(maxCols, Math.ceil(slots / rows)));
    videoGrid.style.setProperty('--per-row', perRow);
    // A single row would leave empty bands above and below: stretch it to full height.
    if (rows === 1 && videoGrid.clientHeight) {
      videoGrid.style.setProperty('--tile-h', `${videoGrid.clientHeight}px`);
    } else {
      videoGrid.style.removeProperty('--tile-h');
    }
  }

  cards.forEach((c) => {
    if (!phone || !colW) {
      c.style.height = '';
      return;
    }
    const landscape = c.classList.contains('is-landscape');
    c.style.height = `${Math.round(landscape ? colW * 2 * (5 / 8) : colW * 1.25)}px`;
  });
}

/* Mouse-wheel smoothing for the desktop film grid. The scrollbar is hidden,
   so ease the wheel into a glide instead of native jumpy steps. Touch and
   trackpad inertia keep their native behaviour on phones. */
export function initSmoothScroll() {
  if (!videoGrid) return;
  let target = 0;
  let raf = 0;

  const step = () => {
    const max = videoGrid.scrollHeight - videoGrid.clientHeight;
    target = Math.max(0, Math.min(target, max));
    const cur = videoGrid.scrollTop;
    const d = target - cur;
    if (Math.abs(d) < 0.5) {
      videoGrid.scrollTop = target;
      raf = 0;
      return;
    }
    const move = Math.sign(d) * Math.max(1, Math.abs(d) * 0.14);
    videoGrid.scrollTop = Math.abs(move) > Math.abs(d) ? target : cur + move;
    raf = requestAnimationFrame(step);
  };

  videoGrid.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || isPhone()) return;
      const max = videoGrid.scrollHeight - videoGrid.clientHeight;
      if (max <= 0) return;
      e.preventDefault();
      if (!raf) target = videoGrid.scrollTop;
      const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
      target = Math.max(0, Math.min(target + dy, max));
      if (!raf) raf = requestAnimationFrame(step);
    },
    { passive: false }
  );
}

let _fitRaf = 0;
export function initGridResize() {
  window.addEventListener('resize', () => {
    cancelAnimationFrame(_fitRaf);
    _fitRaf = requestAnimationFrame(fitVideoGrid);
  });
}

/* One shared observer: a card's preview clip downloads and plays only while
   it is on screen, and pauses when it scrolls away. */
let _previewObserver = null;
function previewObserver() {
  if (_previewObserver) return _previewObserver;
  _previewObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const card = entry.target;
        const videoEl = card.querySelector('.video-card__video');
        if (!videoEl) return;
        if (entry.isIntersecting) {
          if (viewState.mode === 'detail') return;
          // Reduced motion: keep the still poster, never load/play the loop
          if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
          queueIdleLoop(card, videoEl);
        } else {
          unqueueIdleLoop(card);
          videoEl.pause();
          card.classList.remove('is-playing');
        }
      });
    },
    { threshold: 0.25 }
  );
  return _previewObserver;
}

/* Starting every preview decoder in the same frame stalls the page for about
   half a second on integrated GPUs, so loops start one at a time. */
const previewQueue = [];
let previewTimer = 0;

export function queueIdleLoop(card, videoEl) {
  if (!videoEl || previewQueue.some(([c]) => c === card)) return;
  previewQueue.push([card, videoEl]);
  if (!previewTimer) drainPreviewQueue();
}

function unqueueIdleLoop(card) {
  const i = previewQueue.findIndex(([c]) => c === card);
  if (i >= 0) previewQueue.splice(i, 1);
}

function drainPreviewQueue() {
  const next = previewQueue.shift();
  if (!next) {
    previewTimer = 0;
    return;
  }
  const [card, videoEl] = next;
  if (card.isConnected && viewState.mode !== 'detail') {
    if (!videoEl.getAttribute('src')) {
      videoEl.setAttribute('src', videoEl.dataset.src);
      videoEl.preload = 'auto';
    }
    startIdleLoop(card, videoEl);
  }
  previewTimer = setTimeout(drainPreviewQueue, 150);
}

function startIdleLoop(card, videoEl) {
  if (!videoEl) return;
  // Keep a short ambient sample feel — start near the head of the clip
  try {
    if (videoEl.currentTime > 6) videoEl.currentTime = 0;
  } catch (_) {}
  const playPromise = videoEl.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise
      .then(() => card.classList.add('is-playing'))
      .catch(() => {});
  } else {
    card.classList.add('is-playing');
  }
}

/* Meta pose — GSAP owns position/scale so hover never layout-snaps */
const META_IDLE = {
  left: '50%',
  top: '50%',
  xPercent: -50,
  yPercent: -50,
  x: 0,
  y: 0,
  scale: 1.72,
  transformOrigin: '50% 50%',
};

const META_HOVER = {
  left: 18,
  top: '100%',
  xPercent: 0,
  yPercent: -100,
  x: 0,
  y: -20,
  scale: 1,
  transformOrigin: '50% 50%',
};

function metaPoseVars(hover) {
  const mobile = isPhone();
  if (hover) {
    return {
      ...META_HOVER,
      left: mobile ? 12 : 18,
      y: mobile ? -12 : -20,
      scale: 1,
    };
  }
  return {
    ...META_IDLE,
    scale: mobile ? 1 : 1.2,
  };
}

function setMetaPose(card, hover, animate = true) {
  const inner = card.querySelector('.video-card__meta-inner');
  if (!inner) return;

  const vars = metaPoseVars(hover);
  gsap.killTweensOf(inner);

  if (animate) {
    gsap.to(inner, {
      ...vars,
      duration: isTouchUi() ? 0.55 : 0.95,
      ease: 'expo.inOut',
      overwrite: true,
    });
  } else {
    gsap.set(inner, vars);
  }
}

function setCardHover(card, on, { animate = true } = {}) {
  const wantHover = !!on;
  if (card.classList.contains('is-hover') === wantHover) return;
  // The class flips the lines from centred to left-aligned; slide each line
  // from its old spot instead of letting it jump (FLIP).
  const lines = animate ? Array.from(card.querySelectorAll('.video-card__meta-inner > *')) : [];
  const before = lines.map((el) => el.offsetLeft);
  card.classList.toggle('is-hover', wantHover);
  lines.forEach((el, i) => {
    gsap.fromTo(
      el,
      { x: before[i] - el.offsetLeft },
      { x: 0, duration: isTouchUi() ? 0.55 : 0.95, ease: 'expo.inOut', overwrite: true }
    );
  });
  setMetaPose(card, wantHover, animate);
}

function clearVideoCardHovers(except = null) {
  if (!videoGrid) return;
  videoGrid.querySelectorAll('.video-card.is-hover').forEach((card) => {
    if (card !== except) setCardHover(card, false);
  });
}

export function bindTouchCardDismiss() {
  if (!videoGrid) return;
  // Tap empty chrome / backdrop clears hover preview
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!isTouchUi() || viewState.mode !== 'videos') return;
      if (e.target.closest('.video-card')) return;
      if (e.target.closest('.header, .footer, .project-panel, .about-panel')) return;
      clearVideoCardHovers();
    },
    { passive: true }
  );
}

export function stopAllPreviews() {
  videoGrid.querySelectorAll('.video-card').forEach((card) => {
    const v = card.querySelector('.video-card__video');
    if (card.classList.contains('is-hover')) {
      card.classList.remove('is-hover');
      setMetaPose(card, false, false);
    }
    card.classList.remove('is-playing', 'is-previewing');
    unqueueIdleLoop(card);
    // Pause only: seeking every clip back to 0 at once is decoder work right
    // as a transition starts, and startIdleLoop rewinds long-run clips anyway
    if (v) v.pause();
  });
  viewState.playingVideo = null;
}
