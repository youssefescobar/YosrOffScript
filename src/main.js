/* ===================================================
   MAIN — Category cards → McKinnon video grid → detail
   =================================================== */
import gsap from 'gsap';
import { Observer } from 'gsap/Observer';
import {
  CATEGORIES,
  VIDEOS,
  getVideosByCategory,
  getCategory,
} from './projects.js';

gsap.registerPlugin(Observer);

/* ---------- DOM refs ---------- */
const loader = document.getElementById('loader');
const viewport = document.getElementById('viewport');
const categoryView = document.getElementById('category-view');
const videoView = document.getElementById('video-view');
const videoGrid = document.getElementById('video-grid');
const videoViewTitle = document.getElementById('video-view-title');
const tileCountEl = document.getElementById('tile-count');
const footerHint = document.getElementById('footer-hint');
const filterBack = document.getElementById('filter-back');
const aboutPanel = document.getElementById('about-panel');
const aboutClose = document.getElementById('about-close');
const projectPanel = document.getElementById('project-panel');
const projectClose = document.getElementById('project-close');
const projectInner = document.getElementById('project-inner');
const header = document.getElementById('header');
const flipGhost = document.getElementById('flip-ghost');

/* ---------- State ---------- */
const viewState = {
  mode: 'categories', // 'categories' | 'videos' | 'detail'
  activeCategory: null,
  transitioning: false,
  playingVideo: null,
  detailVideoEl: null,
};

const routing = {
  ready: false,
  applying: false,
  bootHash: '#portfolio',
  intent: { fromFilter: false, filterBtn: null },
};

let loaderDone = false;
let categoryCards = [];

/* About open/close — assigned inside initRouting */
let openAboutFn = () => {};
let closeAboutFn = () => {};

/* ---------- Hash routing ---------- */
function normalizeHash(hash) {
  const h = (hash || '').trim();
  if (!h || h === '#') return '#portfolio';
  return h.startsWith('#') ? h : `#${h}`;
}

function getHash() {
  return normalizeHash(window.location.hash);
}

function parseRoute(hash = getHash()) {
  const path = normalizeHash(hash).slice(1);
  if (path === 'about') return { screen: 'about' };

  const parts = path.split('/');
  if (parts[0] === 'portfolio' && parts[1]) {
    const cat = getCategory(parts[1]);
    if (cat) return { screen: 'videos', category: parts[1] };
  }

  return { screen: 'categories' };
}

function updateNav(route) {
  if (!header) return;
  header.querySelectorAll('.header__link').forEach((link) => {
    const href = link.getAttribute('href');
    const isAboutLink = href === '#about';
    link.classList.toggle(
      'active',
      isAboutLink ? route.screen === 'about' : route.screen !== 'about'
    );
  });
}

function setHash(hash, { replace = false } = {}) {
  const target = normalizeHash(hash);
  if (getHash() === target) {
    applyRoute();
    return;
  }
  if (replace) {
    history.replaceState(null, '', target);
  } else {
    history.pushState(null, '', target);
  }
  applyRoute();
}

function applyRoute() {
  if (!routing.ready || routing.applying) return;
  routing.applying = true;

  const route = parseRoute();
  updateNav(route);

  try {
    if (route.screen === 'about') {
      openAboutFn();
      return;
    }

    closeAboutFn();

    if (viewState.mode === 'detail') {
      closeVideoDetail(false);
    }

    if (route.screen === 'videos') {
      const intent = routing.intent;
      routing.intent = { fromFilter: false, filterBtn: null };
      enterCategory(route.category, {
        fromFilter: intent.fromFilter && viewState.mode === 'categories',
        filterBtn: intent.filterBtn,
      });
    } else if (viewState.mode === 'videos' || viewState.mode === 'detail') {
      exitToCategories();
    }
  } finally {
    // Release on next frame so nested hash sync can't re-enter mid-apply
    requestAnimationFrame(() => {
      routing.applying = false;
    });
  }
}

function onBrowserRouteChange() {
  if (!routing.ready) return;
  applyRoute();
}

/* ===================================================
   1. CATEGORY LANDING
   =================================================== */
function buildCategoryView() {
  categoryView.innerHTML = '';
  categoryCards = [];

  CATEGORIES.forEach((cat) => {
    const count = getVideosByCategory(cat.id).length;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'category-card';
    el.setAttribute('data-category', cat.id);
    el.innerHTML = `
      <img class="category-card__img" src="${cat.cover}" alt="${cat.label}" draggable="false" />
      <div class="category-card__overlay">
        <span class="category-card__label">${cat.label}</span>
        <span class="category-card__count">${count} films</span>
      </div>
    `;
    el.addEventListener('click', () => {
      routing.intent = { fromFilter: false, filterBtn: null };
      setHash(`#portfolio/${cat.id}`);
    });
    categoryView.appendChild(el);
    categoryCards.push(el);
  });

  updateFooterForCategories();
}

function updateFooterForCategories() {
  tileCountEl.textContent = `${CATEGORIES.length} Categories`;
  footerHint.textContent = 'Select a category';
  filterBack.hidden = true;
  document.querySelectorAll('.filter-btn[data-filter]').forEach((btn) => {
    btn.classList.remove('active');
    btn.hidden = false;
  });
}

function updateFooterForVideos(categoryId) {
  const cat = getCategory(categoryId);
  const videos = getVideosByCategory(categoryId);
  tileCountEl.textContent = `${videos.length} Films`;
  footerHint.textContent = cat ? cat.label : '';
  filterBack.hidden = false;
  document.querySelectorAll('.filter-btn[data-filter]').forEach((btn) => {
    const isActive = btn.dataset.filter === categoryId;
    btn.classList.toggle('active', isActive);
    btn.hidden = false;
  });
}

/* ===================================================
   2. ENTER / EXIT CATEGORY (center morph)
   =================================================== */
function getCardCenterDelta(card) {
  const rect = card.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: (vw - rect.width) / 2 - rect.left,
    y: (vh - rect.height) / 2 - rect.top,
  };
}

function animateCardToCenter(card) {
  return new Promise((resolve) => {
    const others = categoryCards.filter((c) => c !== card);
    card.classList.add('is-focus');

    const tl = gsap.timeline({
      onComplete: resolve,
    });

    // 1) Clear the other cards
    tl.to(others, {
      opacity: 0,
      scale: 0.88,
      duration: 0.45,
      ease: 'expo.inOut',
      stagger: 0.04,
    });

    // 2) Slide selected card to viewport center
    const { x, y } = getCardCenterDelta(card);
    tl.to(
      card,
      {
        x,
        y,
        scale: 1.06,
        duration: 0.75,
        ease: 'expo.inOut',
      },
      '-=0.12'
    );
  });
}

function animateCardFromCenter(card) {
  return new Promise((resolve) => {
    const others = categoryCards.filter((c) => c !== card);

    // Measure the card in its natural grid slot
    gsap.set(card, { clearProps: 'x,y,scale' });
    gsap.set(others, { opacity: 0, scale: 0.88, clearProps: 'x,y' });
    gsap.set(card, { opacity: 1 });
    void card.offsetWidth;

    const { x, y } = getCardCenterDelta(card);
    card.classList.add('is-focus');
    gsap.set(card, { x, y, scale: 1.06, opacity: 1 });

    const tl = gsap.timeline({
      onComplete: () => {
        card.classList.remove('is-focus');
        gsap.set(categoryCards, { clearProps: 'x,y,scale,opacity' });
        resolve();
      },
    });

    // 1) Card travels back to its grid slot
    tl.to(card, {
      x: 0,
      y: 0,
      scale: 1,
      duration: 0.75,
      ease: 'expo.inOut',
    });

    // 2) Other cards fade back in
    tl.to(
      others,
      {
        opacity: 1,
        scale: 1,
        duration: 0.55,
        stagger: 0.05,
        ease: 'expo.out',
      },
      '-=0.35'
    );
  });
}

function enterCategory(categoryId, { fromFilter = false, filterBtn = null } = {}) {
  if (viewState.transitioning) return;
  if (viewState.mode === 'videos' && viewState.activeCategory === categoryId) return;

  const cat = getCategory(categoryId);
  if (!cat) return;

  viewState.transitioning = true;
  const card = categoryView.querySelector(`[data-category="${categoryId}"]`);

  const runAfterCenter = () => openVideoView(categoryId, card);

  if (viewState.mode === 'videos') {
    stopAllPreviews();
    populateVideoGrid(categoryId, true);
    viewState.activeCategory = categoryId;
    updateFooterForVideos(categoryId);
    viewState.transitioning = false;
    return;
  }

  if (!card) {
    openVideoView(categoryId, null);
    return;
  }

  const sequence = async () => {
    if (fromFilter && filterBtn) {
      await animateFilterIntoCategory(filterBtn, card);
    } else {
      await animateCardToCenter(card);
    }
    runAfterCenter();
  };

  sequence();
}

/* Off-white pill → card → center: one continuous timeline */
function animateFilterIntoCategory(filterBtn, card) {
  return new Promise((resolve) => {
    const others = categoryCards.filter((c) => c !== card);
    const from = filterBtn.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const label = filterBtn.textContent.trim();
    const { x: centerX, y: centerY } = getCardCenterDelta(card);

    // Mark active filter
    document.querySelectorAll('.filter-btn[data-filter]').forEach((b) => {
      b.classList.toggle('active', b === filterBtn);
    });

    card.classList.add('is-focus');

    // Color pill only at first — label stays hidden until the shape is large enough
    flipGhost.innerHTML = `<span class="flip-ghost__label">${label}</span>`;
    flipGhost.classList.add('is-visible', 'is-morphing');
    const ghostLabel = flipGhost.querySelector('.flip-ghost__label');

    gsap.set(flipGhost, {
      x: from.left,
      y: from.top,
      width: from.width,
      height: from.height,
      borderRadius: 100,
      opacity: 1,
      scale: 1,
    });
    gsap.set(ghostLabel, { opacity: 0, scale: 0.92 });

    // Card waits dimmed under the ghost until handoff
    gsap.set(card, { opacity: 0.35 });

    // Soft pulse on the filter as the ghost leaves
    gsap.fromTo(
      filterBtn,
      { scale: 1 },
      { scale: 0.92, duration: 0.28, yoyo: true, repeat: 1, ease: 'power2.inOut' }
    );

    const tl = gsap.timeline({
      onComplete: resolve,
    });

    // 1) Ghost flies from pill → card slot, expanding into card shape
    tl.to(
      flipGhost,
      {
        x: cardRect.left,
        y: cardRect.top,
        width: cardRect.width,
        height: cardRect.height,
        borderRadius: 12,
        duration: 1.25,
        ease: 'expo.inOut',
      },
      0
    );

    // Label eases in mid-flight once the shape has grown
    tl.to(
      ghostLabel,
      {
        opacity: 1,
        scale: 1,
        duration: 0.45,
        ease: 'power2.out',
      },
      0.55
    );

    // 2) Other cards clear while the ghost is mid-flight
    tl.to(
      others,
      {
        opacity: 0,
        scale: 0.88,
        duration: 0.65,
        stagger: 0.04,
        ease: 'expo.inOut',
      },
      0.28
    );

    // 3) Handoff: ghost dissolves into the real card (no pause)
    tl.to(
      flipGhost,
      {
        opacity: 0,
        duration: 0.35,
        ease: 'power2.out',
        onComplete: () => {
          flipGhost.classList.remove('is-visible', 'is-morphing');
          flipGhost.innerHTML = '';
          gsap.set(flipGhost, { clearProps: 'all' });
        },
      },
      1.05
    );

    tl.to(
      card,
      {
        opacity: 1,
        duration: 0.35,
        ease: 'power2.out',
      },
      1.05
    );

    // 4) Same card immediately continues into the center (overlaps handoff)
    tl.to(
      card,
      {
        x: centerX,
        y: centerY,
        scale: 1.06,
        duration: 0.75,
        ease: 'expo.inOut',
      },
      1.15
    );
  });
}

function openVideoView(categoryId, focusCard) {
  const cat = getCategory(categoryId);
  viewState.mode = 'videos';
  viewState.activeCategory = categoryId;

  populateVideoGrid(categoryId, false);
  videoViewTitle.textContent = cat ? cat.label : '';
  videoView.hidden = false;
  updateFooterForVideos(categoryId);

  const cards = videoGrid.querySelectorAll('.video-card');
  gsap.set(cards, { opacity: 0, y: 40, scale: 0.94 });
  gsap.set(videoView, { opacity: 0 });

  const tl = gsap.timeline({
    onComplete: () => {
      viewState.transitioning = false;
      if (focusCard) focusCard.classList.remove('is-focus');
      gsap.set(categoryCards, { clearProps: 'opacity,scale,x,y' });
      gsap.set(cards, { clearProps: 'opacity,y,scale' });
    },
  });

  // Fade the centered card / category stage out
  if (focusCard) {
    tl.to(focusCard, {
      opacity: 0,
      scale: 1.12,
      duration: 0.4,
      ease: 'power2.in',
    });
  }

  tl.to(
    categoryView,
    {
      opacity: 0,
      duration: 0.35,
      ease: 'power2.in',
      onComplete: () => {
        categoryView.hidden = true;
        gsap.set(categoryView, { clearProps: 'opacity' });
      },
    },
    focusCard ? '-=0.25' : 0
  )
    .to(
      videoView,
      { opacity: 1, duration: 0.4, ease: 'power2.out' },
      '-=0.1'
    )
    .to(
      cards,
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.75,
        stagger: 0.07,
        ease: 'expo.out',
      },
      '-=0.12'
    );
}

function exitToCategories() {
  if (viewState.transitioning || viewState.mode === 'categories') return;
  if (viewState.mode === 'detail') closeVideoDetail(false);

  viewState.transitioning = true;
  stopAllPreviews();

  const returningId = viewState.activeCategory;
  const focusCard = returningId
    ? categoryView.querySelector(`[data-category="${returningId}"]`)
    : null;
  const videoCards = videoGrid.querySelectorAll('.video-card');

  const tl = gsap.timeline();

  tl.to(videoCards, {
    opacity: 0,
    y: 20,
    duration: 0.35,
    stagger: 0.03,
    ease: 'power2.in',
  }).to(
    videoView,
    {
      opacity: 0,
      duration: 0.35,
      ease: 'power2.in',
      onComplete: () => {
        videoView.hidden = true;
        videoGrid.innerHTML = '';
        gsap.set(videoView, { clearProps: 'opacity' });

        categoryView.hidden = false;
        viewState.mode = 'categories';
        updateFooterForCategories();

        if (focusCard) {
          // Reverse: card starts centered, then returns to slot
          animateCardFromCenter(focusCard).then(() => {
            viewState.activeCategory = null;
            viewState.transitioning = false;
          });
        } else {
          viewState.activeCategory = null;
          gsap.fromTo(
            categoryCards,
            { opacity: 0, scale: 0.94, y: 24 },
            {
              opacity: 1,
              scale: 1,
              y: 0,
              duration: 0.75,
              stagger: 0.08,
              ease: 'expo.out',
              onComplete: () => {
                viewState.transitioning = false;
                gsap.set(categoryCards, { clearProps: 'opacity,scale,y' });
              },
            }
          );
        }
      },
    },
    '-=0.1'
  );
}

/* ===================================================
   3. VIDEO GRID — portrait flush + idle ambient loops
   =================================================== */
function populateVideoGrid(categoryId, animate = false) {
  const videos = getVideosByCategory(categoryId);
  videoGrid.innerHTML = '';
  videoViewTitle.textContent = getCategory(categoryId)?.label || '';

  videos.forEach((video) => {
    const card = document.createElement('article');
    card.className = 'video-card';
    card.setAttribute('data-video-id', video.id);
    card.tabIndex = 0;

    const brandHtml = video.brand
      ? `<span class="video-card__brand">${video.brand}</span>`
      : '';

    card.innerHTML = `
      <div class="video-card__media">
        <img class="video-card__poster" src="${video.poster}" alt="" draggable="false" />
        <video
          class="video-card__video"
          src="${video.src}"
          muted
          loop
          playsinline
          preload="auto"
          poster="${video.poster}"
        ></video>
      </div>
      <div class="video-card__meta">
        <div class="video-card__meta-inner">
          ${brandHtml}
          <h3 class="video-card__title">${video.title}</h3>
        </div>
      </div>
    `;

    const videoEl = card.querySelector('.video-card__video');

    // Idle ambient sample — always looping softly under the title
    const tryIdlePlay = () => startIdleLoop(card, videoEl);
    if (videoEl.readyState >= 2) {
      tryIdlePlay();
    } else {
      videoEl.addEventListener('loadeddata', tryIdlePlay, { once: true });
    }

    card.addEventListener('mouseenter', () => setCardHover(card, true));
    card.addEventListener('mouseleave', () => setCardHover(card, false));
    card.addEventListener('focus', () => setCardHover(card, true));
    card.addEventListener('blur', () => setCardHover(card, false));

    // Mobile: first tap reveals (hover state), second opens
    card.addEventListener('click', (e) => {
      const isTouch = window.matchMedia('(hover: none)').matches;
      if (isTouch && !card.classList.contains('is-hover')) {
        e.preventDefault();
        videoGrid.querySelectorAll('.video-card.is-hover').forEach((c) => {
          if (c !== card) setCardHover(c, false);
        });
        setCardHover(card, true);
        return;
      }
      openVideoDetail(video);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openVideoDetail(video);
      }
    });

    videoGrid.appendChild(card);
  });

  if (animate) {
    const cards = videoGrid.querySelectorAll('.video-card');
    gsap.fromTo(
      cards,
      { opacity: 0, y: 28, scale: 0.94 },
      { opacity: 1, y: 0, scale: 1, duration: 0.55, stagger: 0.05, ease: 'expo.out' }
    );
  }
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

function setCardHover(card, on) {
  const inner = card.querySelector('.video-card__meta-inner');
  const title = card.querySelector('.video-card__title');
  const brand = card.querySelector('.video-card__brand');
  const wantHover = !!on;

  if (card.classList.contains('is-hover') === wantHover) return;

  if (!inner) {
    card.classList.toggle('is-hover', wantHover);
    return;
  }

  // FLIP: measure → swap layout → invert → play (brand + title travel together)
  const first = inner.getBoundingClientRect();
  const firstTitle = title ? title.getBoundingClientRect() : null;
  const firstBrand = brand ? brand.getBoundingClientRect() : null;

  card.classList.toggle('is-hover', wantHover);

  const last = inner.getBoundingClientRect();
  const lastTitle = title ? title.getBoundingClientRect() : null;
  const lastBrand = brand ? brand.getBoundingClientRect() : null;

  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const sx = first.width / Math.max(last.width, 1);
  const sy = first.height / Math.max(last.height, 1);

  gsap.killTweensOf([inner, title, brand].filter(Boolean));

  gsap.fromTo(
    inner,
    {
      x: dx,
      y: dy,
      scaleX: sx,
      scaleY: sy,
      transformOrigin: '0% 0%',
    },
    {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      duration: 0.95,
      ease: 'expo.inOut',
      overwrite: true,
      onComplete: () => {
        gsap.set(inner, { clearProps: 'transform' });
      },
    }
  );

  // Counter-scale type so it doesn't look stretched while the block moves
  const flipType = (el, firstRect, lastRect) => {
    if (!el || !firstRect || !lastRect) return;
    const tsx = (firstRect.width / Math.max(lastRect.width, 1)) / sx;
    const tsy = (firstRect.height / Math.max(lastRect.height, 1)) / sy;
    gsap.fromTo(
      el,
      { scaleX: tsx, scaleY: tsy, transformOrigin: '0% 0%' },
      {
        scaleX: 1,
        scaleY: 1,
        duration: 0.95,
        ease: 'expo.inOut',
        overwrite: true,
        onComplete: () => {
          gsap.set(el, { clearProps: 'transform' });
        },
      }
    );
  };

  flipType(title, firstTitle, lastTitle);
  flipType(brand, firstBrand, lastBrand);
}

function stopAllPreviews() {
  videoGrid.querySelectorAll('.video-card').forEach((card) => {
    const v = card.querySelector('.video-card__video');
    card.classList.remove('is-hover', 'is-playing', 'is-previewing');
    if (v) {
      v.pause();
      try {
        v.currentTime = 0;
      } catch (_) {}
    }
  });
  viewState.playingVideo = null;
}

/* ===================================================
   4. VIDEO DETAIL OVERLAY
   =================================================== */
function openVideoDetail(video) {
  if (!projectPanel || !video) return;
  stopAllPreviews();
  viewState.mode = 'detail';

  const brandHtml = video.brand
    ? `<span class="project-panel__brand">${video.brand}</span>`
    : '';

  const cat = getCategory(video.category);

  projectInner.innerHTML = `
    <div class="project-panel__player-wrap">
      <video
        class="project-panel__video"
        id="detail-video"
        src="${video.src}"
        poster="${video.poster}"
        controls
        playsinline
        autoplay
      ></video>
    </div>
    <div class="project-panel__meta">
      ${brandHtml}
      <h2 class="project-panel__title">${video.title}</h2>
      <div class="project-panel__category">${cat ? cat.label : video.category}</div>
      <p class="project-panel__desc">${video.description || ''}</p>
      <button class="project-panel__fullscreen" id="detail-fullscreen" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
        <span>View fullscreen</span>
      </button>
    </div>
  `;

  const detailVideo = document.getElementById('detail-video');
  viewState.detailVideoEl = detailVideo;

  const fsBtn = document.getElementById('detail-fullscreen');
  if (fsBtn && detailVideo) {
    fsBtn.addEventListener('click', () => requestVideoFullscreen(detailVideo));
  }

  projectPanel.setAttribute('aria-hidden', 'false');
  projectPanel.classList.add('is-open');

  gsap.fromTo(
    projectInner,
    { opacity: 0, y: 28, scale: 0.97 },
    { opacity: 1, y: 0, scale: 1, duration: 0.65, ease: 'expo.out' }
  );
}

function requestVideoFullscreen(videoEl) {
  if (!videoEl) return;
  if (videoEl.requestFullscreen) {
    videoEl.requestFullscreen();
  } else if (videoEl.webkitEnterFullscreen) {
    videoEl.webkitEnterFullscreen();
  } else if (videoEl.webkitRequestFullscreen) {
    videoEl.webkitRequestFullscreen();
  }
}

function closeVideoDetail(restoreMode = true) {
  if (!projectPanel.classList.contains('is-open')) return;

  if (viewState.detailVideoEl) {
    viewState.detailVideoEl.pause();
    viewState.detailVideoEl = null;
  }

  gsap.to(projectInner, {
    opacity: 0,
    y: 16,
    scale: 0.98,
    duration: 0.35,
    ease: 'power2.in',
    onComplete: () => {
      projectPanel.classList.remove('is-open');
      projectPanel.setAttribute('aria-hidden', 'true');
      projectInner.innerHTML = '';
      gsap.set(projectInner, { clearProps: 'opacity,y,scale' });
      if (restoreMode) {
        viewState.mode = viewState.activeCategory ? 'videos' : 'categories';
      }
    },
  });
}

/* ===================================================
   5. FILTERS + BACK
   =================================================== */
function initFilters() {
  document.querySelectorAll('.filter-btn[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      routing.intent = {
        fromFilter: viewState.mode === 'categories',
        filterBtn: btn,
      };
      setHash(`#portfolio/${filter}`);
    });
  });

  filterBack.addEventListener('click', () => {
    setHash('#portfolio');
  });
}

/* ===================================================
   6. KEYBOARD
   =================================================== */
function initKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (viewState.mode === 'detail') {
        closeVideoDetail();
      } else if (viewState.mode === 'videos') {
        setHash('#portfolio');
      } else if ((getHash() === '#about')) {
        setHash('#portfolio');
      }
    }
  });
}

/* ===================================================
   7. LOADER & PRELOADER
   =================================================== */
function preloadAssets() {
  const images = [
    ...CATEGORIES.map((c) => c.cover),
    ...VIDEOS.map((v) => v.poster),
  ];
  let loadedCount = 0;
  const total = images.length;

  const progressEl = document.getElementById('loader-progress');
  const ctaEl = document.getElementById('loader-cta');

  gsap.set('.header__nav', { opacity: 0, y: -30 });
  gsap.set('.footer', { opacity: 0, y: 30 });
  gsap.set('.header__left', { opacity: 0 });
  gsap.set(categoryCards, { opacity: 0, scale: 0.9, y: 30 });

  const tl = gsap.timeline({ defaults: { ease: 'expo.out', duration: 1.2 } });

  tl.to('.loader__line > span', { y: '0%', stagger: 0.12, duration: 1 })
    .to('.loader__tagline > span', { y: '0%', duration: 0.8 }, '-=0.5')
    .to(progressEl, { opacity: 1, duration: 0.5 }, '-=0.3');

  let isReady = false;

  function checkReady() {
    if (loadedCount >= total && !isReady) {
      isReady = true;
      document.fonts.ready.then(() => {
        if (tl.isActive()) {
          tl.eventCallback('onComplete', () => hideProgressAndShowCTA());
        } else {
          hideProgressAndShowCTA();
        }
      });
    }
  }

  function hideProgressAndShowCTA() {
    gsap.to(progressEl, {
      opacity: 0,
      duration: 0.4,
      onComplete: () => {
        ctaEl.classList.add('is-ready');
        playLoader();
      },
    });
  }

  if (total === 0) {
    checkReady();
  } else {
    images.forEach((src) => {
      const img = new Image();
      img.onload = () => {
        loadedCount++;
        const percent = Math.floor((loadedCount / total) * 100);
        if (progressEl) progressEl.innerText = `${percent}%`;
        checkReady();
      };
      img.onerror = () => {
        loadedCount++;
        checkReady();
      };
      img.src = src;
    });
  }
}

function playLoader() {
  const ctaEl = document.getElementById('loader-cta');

  gsap.to('.loader__cta > span', { y: '0%', opacity: 1, duration: 0.8 });

  const obs = Observer.create({
    target: window,
    type: 'pointer,wheel,touch',
    onPress: dismiss,
    onUp: dismiss,
    onWheel: dismiss,
  });

  ctaEl.addEventListener('click', dismiss);

  function dismiss() {
    if (loaderDone) return;
    loaderDone = true;
    obs.kill();

    // Stop loader from blocking interactions immediately
    loader.style.pointerEvents = 'none';

    viewport.classList.add('is-active');

    const loaderText = document.querySelector('.loader__line');
    const headerName = document.querySelector('.header__name');

    gsap.set('.header', { zIndex: 101 });

    gsap.to(['.loader__tagline', '.loader__cta', '.loader__progress'], {
      opacity: 0,
      duration: 0.5,
    });
    gsap.to(loader, {
      backgroundColor: 'rgba(0,0,0,0)',
      duration: 1.2,
      ease: 'power2.inOut',
    });

    const lRect = loaderText.getBoundingClientRect();
    gsap.set('.header__left', { opacity: 1 });
    const hRect = headerName.getBoundingClientRect();

    gsap.set([loaderText, headerName], { transformOrigin: '0% 50%' });

    const lRefX = lRect.left;
    const lRefY = lRect.top + lRect.height / 2;
    const hRefX = hRect.left;
    const hRefY = hRect.top + hRect.height / 2;

    const headerStartScale = lRect.height / hRect.height;
    const headerStartX = lRefX - hRefX;
    const headerStartY = lRefY - hRefY;
    gsap.set(headerName, {
      x: headerStartX,
      y: headerStartY,
      scale: headerStartScale,
      opacity: 0,
    });

    const loaderTargetScale = hRect.height / lRect.height;
    const loaderTargetX = hRefX - lRefX;
    const loaderTargetY = hRefY - lRefY;

    gsap.to(headerName, {
      x: 0,
      y: 0,
      scale: 1,
      opacity: 1,
      duration: 1.2,
      ease: 'expo.inOut',
      onComplete: () => {
        loader.style.display = 'none';
        gsap.set(headerName, { clearProps: 'transform,opacity' });
        gsap.set('.header', { clearProps: 'zIndex' });

        // Enable routing only after intro settles — then honor deep link
        routing.ready = true;
        const boot = routing.bootHash;
        if (boot === '#about' || boot.startsWith('#portfolio/')) {
          setTimeout(() => setHash(boot, { replace: true }), 200);
        } else {
          updateNav(parseRoute('#portfolio'));
        }
      },
    });

    gsap.to(loaderText, {
      x: loaderTargetX,
      y: loaderTargetY,
      scale: loaderTargetScale,
      opacity: 0,
      duration: 1.2,
      ease: 'expo.inOut',
    });

    gsap.to(categoryCards, {
      opacity: 1,
      scale: 1,
      y: 0,
      duration: 1.1,
      stagger: 0.1,
      ease: 'expo.out',
      delay: 0.35,
    });

    gsap.to(['.header__nav', '.footer'], {
      y: 0,
      opacity: 1,
      duration: 1.2,
      stagger: 0.2,
      ease: 'expo.out',
      delay: 0.6,
    });
  }
}

/* ===================================================
   8. ROUTING (About) — preserved from prior design
   =================================================== */
function initRouting() {
  let aboutAnimated = false;
  let photoTiltActive = false;

  const headerName = document.querySelector('.header__name');
  const photoWrap = document.querySelector('.about-panel__photo-wrap');
  const photo = document.querySelector('.about-panel__photo');
  const cardFlipper = document.getElementById('about-flipper');
  const aboutCard = document.getElementById('about-card');
  const flipBadge = document.getElementById('about-flip-badge');

  function getAboutTarget() {
    const isMobile = window.innerWidth <= 768;
    return isMobile
      ? document.getElementById('about-name-mobile') || document.getElementById('about-name')
      : document.getElementById('about-name');
  }

  if (cardFlipper) {
    cardFlipper.addEventListener('click', (e) => {
      if (window.innerWidth > 768) return;
      if (e.target.closest('a, .about-panel__social')) return;
      cardFlipper.classList.toggle('is-flipped');
    });
  }

  if (flipBadge) {
    flipBadge.addEventListener('click', (e) => {
      if (window.innerWidth > 768) return;
      e.stopPropagation();
      if (cardFlipper) cardFlipper.classList.toggle('is-flipped');
    });
  }

  const socialButtons = aboutPanel.querySelectorAll('.about-panel__social');
  socialButtons.forEach((btn) => {
    const brand = btn.dataset.brand;
    if (!brand) return;

    btn.addEventListener('mouseenter', () => {
      if (aboutCard) aboutCard.setAttribute('data-active-brand', brand);
    });
    btn.addEventListener('mouseleave', () => {
      if (aboutCard) aboutCard.removeAttribute('data-active-brand');
    });
    btn.addEventListener('focus', () => {
      if (aboutCard) aboutCard.setAttribute('data-active-brand', brand);
    });
    btn.addEventListener('blur', () => {
      if (aboutCard) aboutCard.removeAttribute('data-active-brand');
    });
  });

  function onPhotoMove(e) {
    if (!photoTiltActive || !photoWrap || window.innerWidth <= 768) return;
    const rect = photoWrap.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotY = (x - 0.5) * 20;
    const rotX = (0.5 - y) * 20;
    gsap.to(photo, {
      rotateX: rotX,
      rotateY: rotY,
      duration: 0.4,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  }

  function onPhotoLeave() {
    if (window.innerWidth <= 768) return;
    gsap.to(photo, {
      rotateX: 0,
      rotateY: 0,
      duration: 0.6,
      ease: 'expo.out',
      overwrite: 'auto',
    });
  }

  if (photoWrap) {
    photoWrap.addEventListener('mousemove', onPhotoMove);
    photoWrap.addEventListener('mouseleave', onPhotoLeave);
  }

  function openAbout() {
    if (aboutAnimated) {
      aboutPanel.classList.add('is-open');
      return;
    }
    aboutAnimated = true;
    photoTiltActive = true;

    if (cardFlipper) cardFlipper.classList.remove('is-flipped');

    const aboutName = getAboutTarget();
    const hRect = headerName.getBoundingClientRect();

    aboutPanel.style.visibility = 'visible';
    aboutPanel.style.opacity = '0';
    aboutPanel.style.transition = 'none';
    gsap.set(aboutName, { opacity: 1, x: 0, y: 0, scale: 1 });
    const aRect = aboutName.getBoundingClientRect();

    gsap.set([headerName, aboutName], { transformOrigin: '0% 50%' });

    const hRefX = hRect.left;
    const hRefY = hRect.top + hRect.height / 2;
    const aRefX = aRect.left;
    const aRefY = aRect.top + aRect.height / 2;

    const aboutStartScale = hRect.height / aRect.height;
    const aboutStartX = hRefX - aRefX;
    const aboutStartY = hRefY - aRefY;
    gsap.set(aboutName, {
      x: aboutStartX,
      y: aboutStartY,
      scale: aboutStartScale,
      opacity: 0,
    });

    const headerTargetScale = aRect.height / hRect.height;
    const headerTargetX = aRefX - hRefX;
    const headerTargetY = aRefY - hRefY;

    gsap.set(photo, { scale: 1.3, clipPath: 'inset(100% 0% 0% 0%)' });
    const reveals = aboutPanel.querySelectorAll('.about-reveal');
    gsap.set(reveals, { opacity: 0, y: 25 });

    aboutPanel.style.removeProperty('visibility');
    aboutPanel.style.removeProperty('opacity');
    aboutPanel.style.removeProperty('transition');
    aboutPanel.classList.add('is-open');

    const isMobile = window.innerWidth <= 768;
    const openDuration = isMobile ? 0.7 : 1.2;

    if (isMobile && aboutCard) {
      gsap.fromTo(
        aboutCard,
        { opacity: 0, scale: 0.94, y: 30 },
        { opacity: 1, scale: 1, y: 0, duration: 0.7, ease: 'expo.out', delay: 0.08 }
      );
    }

    gsap.to(aboutName, {
      x: 0,
      y: 0,
      scale: 1,
      opacity: 1,
      duration: openDuration,
      ease: 'expo.inOut',
    });

    gsap.to(headerName, {
      x: headerTargetX,
      y: headerTargetY,
      scale: headerTargetScale,
      opacity: 0,
      duration: openDuration,
      ease: 'expo.inOut',
      onComplete: () => {
        gsap.set(headerName, { clearProps: 'transform' });
      },
    });

    gsap.to(photo, {
      scale: 1,
      clipPath: 'inset(0% 0% 0% 0%)',
      duration: 1.4,
      ease: 'expo.inOut',
      delay: 0.1,
    });

    gsap.to(reveals, {
      opacity: 1,
      y: 0,
      duration: 1,
      stagger: 0.1,
      ease: 'expo.out',
      delay: 0.4,
    });
  }

  function closeAbout() {
    photoTiltActive = false;

    if (!aboutAnimated) {
      aboutPanel.classList.remove('is-open');
      return;
    }
    aboutAnimated = false;

    const isMobile = window.innerWidth <= 768;
    const aboutName = getAboutTarget();

    if (isMobile && aboutCard) {
      gsap.to(aboutCard, {
        opacity: 0,
        scale: 0.92,
        y: 40,
        duration: 0.45,
        ease: 'power2.in',
      });
    }

    const aRect = aboutName.getBoundingClientRect();

    gsap.set(headerName, { clearProps: 'transform,opacity' });
    gsap.set(headerName, { opacity: 1 });
    const hRect = headerName.getBoundingClientRect();

    gsap.set([headerName, aboutName], { transformOrigin: '0% 50%' });

    const hRefX = hRect.left;
    const hRefY = hRect.top + hRect.height / 2;
    const aRefX = aRect.left;
    const aRefY = aRect.top + aRect.height / 2;

    const headerStartScale = aRect.height / hRect.height;
    const headerStartX = aRefX - hRefX;
    const headerStartY = aRefY - hRefY;
    gsap.set(headerName, {
      x: headerStartX,
      y: headerStartY,
      scale: headerStartScale,
      opacity: 0,
    });

    const aboutTargetScale = hRect.height / aRect.height;
    const aboutTargetX = hRefX - aRefX;
    const aboutTargetY = hRefY - aRefY;

    const reveals = aboutPanel.querySelectorAll('.about-reveal');
    gsap.to(reveals, { opacity: 0, y: -15, duration: 0.4, ease: 'power2.in' });
    gsap.to(photo, {
      clipPath: 'inset(0% 0% 100% 0%)',
      scale: 1.1,
      duration: 0.6,
      ease: 'power2.in',
    });

    const closeDuration = isMobile ? 0.55 : 1.2;
    const closeEase = isMobile ? 'power3.out' : 'expo.inOut';

    gsap.to(aboutName, {
      x: aboutTargetX,
      y: aboutTargetY,
      scale: aboutTargetScale,
      opacity: 0,
      duration: closeDuration,
      ease: closeEase,
    });

    gsap.to(headerName, {
      x: 0,
      y: 0,
      scale: 1,
      opacity: 1,
      duration: closeDuration,
      ease: closeEase,
      onComplete: () => {
        gsap.set(headerName, { clearProps: 'transform' });
        aboutPanel.style.transition = 'none';
        aboutPanel.classList.remove('is-open');
        if (aboutCard) {
          gsap.set(aboutCard, { clearProps: 'opacity,scale,y' });
          aboutCard.removeAttribute('data-active-brand');
        }
        if (cardFlipper) cardFlipper.classList.remove('is-flipped');
        gsap.set(aboutName, { opacity: 0, clearProps: 'x,y,scale,transformOrigin' });
        gsap.set(photo, { clearProps: 'clipPath,scale,rotateX,rotateY' });
        gsap.set(reveals, { opacity: 0, y: 25 });
        const backdrop = aboutPanel.querySelector('.about-panel__backdrop');
        gsap.set(backdrop, { clearProps: 'opacity' });
        requestAnimationFrame(() => {
          aboutPanel.style.removeProperty('transition');
        });
      },
    });

    const backdrop = aboutPanel.querySelector('.about-panel__backdrop');
    const backdropDuration = isMobile ? 0.45 : 0.8;
    gsap.to(backdrop, { opacity: 0, duration: backdropDuration, ease: 'power2.inOut' });
  }

  openAboutFn = openAbout;
  closeAboutFn = closeAbout;

  // Browser back / forward / hash links
  window.addEventListener('hashchange', onBrowserRouteChange);
  window.addEventListener('popstate', onBrowserRouteChange);

  aboutClose.addEventListener('click', (e) => {
    e.preventDefault();
    setHash('#portfolio');
  });

  const portfolioLink = header.querySelector('a[href="#portfolio"]');
  if (portfolioLink) {
    portfolioLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (viewState.mode === 'detail') closeVideoDetail();
      setHash('#portfolio');
    });
  }

  const aboutLink = header.querySelector('a[href="#about"]');
  if (aboutLink) {
    aboutLink.addEventListener('click', (e) => {
      e.preventDefault();
      setHash('#about');
    });
  }

  if (projectClose) {
    projectClose.addEventListener('click', () => closeVideoDetail());
  }

  projectPanel.addEventListener('click', (e) => {
    if (e.target === projectPanel) closeVideoDetail();
  });
}

/* ===================================================
   INIT
   =================================================== */
function init() {
  // Remember deep link, but park on #portfolio so About can't open during loader
  routing.bootHash = normalizeHash(window.location.hash);
  if (routing.bootHash !== '#portfolio') {
    history.replaceState(null, '', '#portfolio');
  }

  buildCategoryView();
  initFilters();
  initKeyboard();
  initRouting();
  updateNav(parseRoute('#portfolio'));
  preloadAssets();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
