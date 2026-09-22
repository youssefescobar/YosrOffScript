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
  getVideo,
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
  activeVideoId: null,
  transitioning: false,
  playingVideo: null,
  detailVideoEl: null,
};

const routing = {
  ready: false,
  applying: false,
  bootHash: '#portfolio',
  intent: { fromFilter: false, filterBtn: null, sourceCard: null },
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
    if (cat) {
      if (parts[2]) {
        const video = getVideo(parts[2]);
        if (video && video.category === cat.id) {
          return {
            screen: 'detail',
            category: cat.id,
            videoId: video.id,
          };
        }
      }
      return { screen: 'videos', category: cat.id };
    }
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
      if (viewState.mode === 'detail') closeVideoDetail({ animate: true, fromRoute: true });
      openAboutFn();
      return;
    }

    closeAboutFn();

    if (route.screen === 'detail') {
      ensureCategoryLayer(route.category);
      const video = getVideo(route.videoId);
      if (video) {
        openVideoDetail(video, { fromRoute: true });
      } else {
        setHash(`#portfolio/${route.category}`, { replace: true });
      }
      return;
    }

    // Leaving detail → category film grid
    if (viewState.mode === 'detail') {
      const stayingOnCategory =
        route.screen === 'videos' && viewState.activeCategory === route.category;
      closeVideoDetail({ animate: true, fromRoute: true });
      if (stayingOnCategory) return;
    }

    if (route.screen === 'videos') {
      const intent = routing.intent;
      routing.intent = { fromFilter: false, filterBtn: null, sourceCard: null };
      enterCategory(route.category, {
        fromFilter: intent.fromFilter && viewState.mode === 'categories',
        filterBtn: intent.filterBtn,
      });
    } else if (viewState.mode === 'videos') {
      exitToCategories();
    }
  } finally {
    requestAnimationFrame(() => {
      routing.applying = false;
    });
  }
}

/** Instantly sync the videos layer under a detail overlay (deep links / back). */
function ensureCategoryLayer(categoryId) {
  if (
    viewState.activeCategory === categoryId &&
    (viewState.mode === 'videos' || viewState.mode === 'detail')
  ) {
    return;
  }

  categoryView.hidden = true;
  gsap.set(categoryView, { clearProps: 'opacity' });
  videoView.hidden = false;
  gsap.set(videoView, { opacity: 1 });
  populateVideoGrid(categoryId, false);
  viewState.activeCategory = categoryId;
  if (viewState.mode !== 'detail') viewState.mode = 'videos';
  updateFooterForVideos(categoryId);
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
      routing.intent = { fromFilter: false, filterBtn: null, sourceCard: null };
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

  // Already in a film grid — crossfade into the new category
  if (viewState.mode === 'videos') {
    switchVideoCategory(categoryId);
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

/** Animate film grid when switching categories via footer filters. */
function switchVideoCategory(categoryId) {
  stopAllPreviews();

  // Update filter / counts immediately — don't wait for the grid crossfade
  viewState.activeCategory = categoryId;
  updateFooterForVideos(categoryId);

  const oldCards = Array.from(videoGrid.querySelectorAll('.video-card'));
  const titleEl = videoViewTitle;

  const finishIn = () => {
    viewState.transitioning = false;
  };

  const revealNew = () => {
    populateVideoGrid(categoryId, false);
    const newCards = videoGrid.querySelectorAll('.video-card');

    gsap.set(titleEl, { opacity: 0, y: 10 });
    gsap.set(newCards, { opacity: 0, y: 24, scale: 0.97 });

    gsap
      .timeline({
        defaults: { overwrite: true },
        onComplete: () => {
          gsap.set([titleEl, newCards], { clearProps: 'opacity,y,scale' });
          finishIn();
        },
      })
      .to(titleEl, {
        opacity: 1,
        y: 0,
        duration: 0.35,
        ease: 'power2.out',
      })
      .to(
        newCards,
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.55,
          stagger: 0.04,
          ease: 'expo.out',
        },
        '-=0.18'
      );
  };

  if (!oldCards.length) {
    revealNew();
    return;
  }

  gsap
    .timeline({ defaults: { overwrite: true } })
    .to(
      oldCards,
      {
        opacity: 0,
        y: -12,
        scale: 0.98,
        duration: 0.28,
        stagger: { each: 0.02, from: 'start' },
        ease: 'power2.in',
      },
      0
    )
    .to(
      titleEl,
      {
        opacity: 0,
        y: -8,
        duration: 0.22,
        ease: 'power2.in',
      },
      0
    )
    .add(() => {
      revealNew();
    });
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
  if (viewState.mode === 'detail') closeVideoDetail({ animate: false, fromRoute: true });

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
      setHash(`#portfolio/${video.category}/${video.id}`);
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
      setHash(`#portfolio/${video.category}/${video.id}`);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        routing.intent.sourceCard = card;
        setHash(`#portfolio/${video.category}/${video.id}`);
      }
    });

    videoGrid.appendChild(card);
    setMetaPose(card, false, false);
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

function isTouchUi() {
  // True devices without hover (phones). Don't use pointer:coarse —
  // that misfires on hybrid tablets/laptops and breaks mouse hover.
  return window.matchMedia('(hover: none)').matches;
}

function metaPoseVars(hover) {
  const mobile = window.matchMedia('(max-width: 768px)').matches;
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
    scale: mobile ? 1.12 : 1.72,
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
  card.classList.toggle('is-hover', wantHover);
  setMetaPose(card, wantHover, animate);
}

function clearVideoCardHovers(except = null) {
  if (!videoGrid) return;
  videoGrid.querySelectorAll('.video-card.is-hover').forEach((card) => {
    if (card !== except) setCardHover(card, false);
  });
}

function bindTouchCardDismiss() {
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

function stopAllPreviews() {
  videoGrid.querySelectorAll('.video-card').forEach((card) => {
    const v = card.querySelector('.video-card__video');
    if (card.classList.contains('is-hover')) {
      card.classList.remove('is-hover');
      setMetaPose(card, false, false);
    }
    card.classList.remove('is-playing', 'is-previewing');
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
function findVideoCard(videoId) {
  if (!videoId || !videoGrid) return null;
  return videoGrid.querySelector(`.video-card[data-video-id="${videoId}"]`);
}

function openVideoDetail(video, { fromRoute = false } = {}) {
  if (!projectPanel || !video) return;

  // Navigation entry point — hash drives the open
  if (!fromRoute) {
    setHash(`#portfolio/${video.category}/${video.id}`);
    return;
  }

  if (viewState.mode === 'detail' && viewState.activeVideoId === video.id) {
    return;
  }

  stopAllPreviews();
  viewState.mode = 'detail';
  viewState.activeVideoId = video.id;
  viewState.activeCategory = video.category;
  viewState.transitioning = true;

  const sourceCard =
    routing.intent.sourceCard || findVideoCard(video.id);
  routing.intent.sourceCard = null;
  const sourceRect = sourceCard ? sourceCard.getBoundingClientRect() : null;

  if (sourceCard) {
    gsap.set(sourceCard, { opacity: 0, pointerEvents: 'none' });
    sourceCard.classList.add('is-detail-source');
  }

  const brandHtml = video.brand
    ? `<span class="project-panel__brand project-panel__meta-item">${video.brand}</span>`
    : '';

  const cat = getCategory(video.category);

  projectInner.innerHTML = `
    <div class="project-panel__player-slot" id="detail-player-slot">
      <div class="project-panel__player-wrap" id="detail-player">
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
    </div>
    <div class="project-panel__meta" id="detail-meta">
      ${brandHtml}
      <h2 class="project-panel__title project-panel__meta-item">${video.title}</h2>
      <div class="project-panel__category project-panel__meta-item">${cat ? cat.label : video.category}</div>
      <p class="project-panel__desc project-panel__meta-item">${video.description || ''}</p>
      <button class="project-panel__fullscreen project-panel__meta-item" id="detail-fullscreen" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
        <span>View fullscreen</span>
      </button>
    </div>
  `;

  const detailVideo = document.getElementById('detail-video');
  const playerSlot = document.getElementById('detail-player-slot');
  const playerWrap = document.getElementById('detail-player');
  const metaEl = document.getElementById('detail-meta');
  const metaItems = metaEl
    ? Array.from(metaEl.querySelectorAll('.project-panel__meta-item'))
    : [];
  viewState.detailVideoEl = detailVideo;

  const fsBtn = document.getElementById('detail-fullscreen');
  if (fsBtn && detailVideo) {
    fsBtn.addEventListener('click', () => requestVideoFullscreen(detailVideo));
  }

  projectPanel.setAttribute('aria-hidden', 'false');
  projectPanel.classList.add('is-open');

  gsap.killTweensOf([projectPanel, projectInner, playerWrap, metaEl, ...metaItems]);

  // Measure final layout while panel is invisible
  gsap.set(projectPanel, { opacity: 0, visibility: 'visible' });
  gsap.set(metaEl, { opacity: 0 });
  gsap.set(metaItems, { opacity: 0 });
  const destRect = playerWrap.getBoundingClientRect();

  const finishOpen = () => {
    viewState.transitioning = false;
  };

  // Deep link / no source card — softer fallback
  if (!sourceRect || sourceRect.width < 8) {
    gsap.set(playerWrap, { clearProps: 'all' });
    playerWrap.classList.remove('is-flying');
    gsap.fromTo(
      projectPanel,
      { opacity: 0 },
      { opacity: 1, duration: 0.4, ease: 'power2.out', overwrite: true }
    );
    gsap.fromTo(
      playerWrap,
      { opacity: 0, scale: 0.92, y: 24 },
      { opacity: 1, scale: 1, y: 0, duration: 0.7, ease: 'expo.out', overwrite: true }
    );
    gsap.fromTo(
      metaItems,
      { opacity: 0, x: -48 },
      {
        opacity: 1,
        x: 0,
        duration: 0.65,
        stagger: 0.05,
        delay: 0.28,
        ease: 'power3.out',
        overwrite: true,
        onComplete: finishOpen,
      }
    );
    gsap.set(metaEl, { opacity: 1 });
    return;
  }

  // Hold layout space while the player flies fixed
  if (playerSlot) {
    gsap.set(playerSlot, {
      width: destRect.width,
      height: destRect.height,
    });
  }

  // Card → front → left video, text emerges from behind
  playerWrap.classList.add('is-flying');
  gsap.set(playerWrap, {
    position: 'fixed',
    top: sourceRect.top,
    left: sourceRect.left,
    width: sourceRect.width,
    height: sourceRect.height,
    margin: 0,
    maxWidth: 'none',
    borderRadius: 0,
    zIndex: 60,
    boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
    opacity: 1,
  });
  gsap.set(metaEl, { opacity: 1 });
  gsap.set(metaItems, {
    opacity: 0,
    x: -72,
  });

  const tl = gsap.timeline({
    defaults: { overwrite: true },
    onComplete: finishOpen,
  });

  tl.to(
    projectPanel,
    { opacity: 1, duration: 0.45, ease: 'power2.out' },
    0
  );

  // Bring card forward
  tl.to(
    playerWrap,
    {
      scale: 1.045,
      boxShadow: '0 28px 70px rgba(0,0,0,0.55)',
      duration: 0.32,
      ease: 'power2.out',
    },
    0.05
  );

  // Morph into detail player on the left
  tl.to(
    playerWrap,
    {
      top: destRect.top,
      left: destRect.left,
      width: destRect.width,
      height: destRect.height,
      borderRadius: 12,
      scale: 1,
      boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
      duration: 0.85,
      ease: 'power3.inOut',
      onComplete: () => {
        playerWrap.classList.remove('is-flying');
        gsap.set(playerWrap, {
          clearProps:
            'position,top,left,width,height,margin,maxWidth,zIndex,scale,boxShadow,borderRadius',
        });
        if (playerSlot) {
          gsap.set(playerSlot, { clearProps: 'width,height' });
        }
      },
    },
    0.28
  );

  // Text slides out from behind the card
  tl.to(
    metaItems,
    {
      opacity: 1,
      x: 0,
      y: 0,
      duration: 0.7,
      stagger: 0.055,
      ease: 'power3.out',
    },
    0.78
  );
}

function restoreDetailSourceCard() {
  videoGrid?.querySelectorAll('.video-card.is-detail-source').forEach((card) => {
    card.classList.remove('is-detail-source');
    gsap.set(card, { clearProps: 'opacity,pointerEvents' });
  });
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

function requestCloseDetail() {
  const cat = viewState.activeCategory;
  if (cat) setHash(`#portfolio/${cat}`);
  else setHash('#portfolio');
}

function closeVideoDetail({ animate = true, fromRoute = false } = {}) {
  if (!projectPanel.classList.contains('is-open') && viewState.mode !== 'detail') return;

  // Prefer hash navigation so back/forward stays correct
  if (!fromRoute) {
    requestCloseDetail();
    return;
  }

  const closingVideoId = viewState.activeVideoId;
  const playerWrap =
    document.getElementById('detail-player') ||
    projectInner.querySelector('.project-panel__player-wrap');
  const metaEl =
    document.getElementById('detail-meta') ||
    projectInner.querySelector('.project-panel__meta');
  const metaItems = metaEl
    ? Array.from(metaEl.querySelectorAll('.project-panel__meta-item'))
    : [];

  if (viewState.detailVideoEl) {
    viewState.detailVideoEl.pause();
    viewState.detailVideoEl = null;
  }

  viewState.activeVideoId = null;
  viewState.mode = viewState.activeCategory ? 'videos' : 'categories';
  viewState.transitioning = true;

  const targetCard = findVideoCard(closingVideoId);
  const targetRect = targetCard ? targetCard.getBoundingClientRect() : null;
  if (targetCard) {
    gsap.set(targetCard, { opacity: 0, pointerEvents: 'none' });
    targetCard.classList.add('is-detail-source');
  }

  const finish = () => {
    projectPanel.classList.remove('is-open');
    projectPanel.setAttribute('aria-hidden', 'true');
    projectInner.innerHTML = '';
    gsap.set([projectPanel, projectInner], { clearProps: 'opacity,y,scale,visibility' });
    restoreDetailSourceCard();
    viewState.transitioning = false;

    // Resume ambient loops on the grid
    if (viewState.mode === 'videos') {
      videoGrid.querySelectorAll('.video-card').forEach((card) => {
        const v = card.querySelector('.video-card__video');
        startIdleLoop(card, v);
      });
    }
  };

  gsap.killTweensOf([projectPanel, projectInner, playerWrap, metaEl, ...metaItems]);

  if (!animate) {
    finish();
    return;
  }

  const stacked = window.matchMedia('(max-width: 768px)').matches;

  // Reverse: text slips back behind the card, card flies home
  if (playerWrap && targetRect && targetRect.width >= 8) {
    const startRect = playerWrap.getBoundingClientRect();
    playerWrap.classList.add('is-flying');
    gsap.set(playerWrap, {
      position: 'fixed',
      top: startRect.top,
      left: startRect.left,
      width: startRect.width,
      height: startRect.height,
      margin: 0,
      maxWidth: 'none',
      zIndex: 60,
      borderRadius: 12,
    });

    const tl = gsap.timeline({
      defaults: { overwrite: true },
      onComplete: finish,
    });

    tl.to(
      metaItems,
      {
        opacity: 0,
        x: -64,
        duration: 0.35,
        stagger: { each: 0.03, from: 'end' },
        ease: 'power2.in',
      },
      0
    );

    tl.to(
      playerWrap,
      {
        top: targetRect.top,
        left: targetRect.left,
        width: targetRect.width,
        height: targetRect.height,
        borderRadius: 0,
        boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
        duration: 0.7,
        ease: 'power3.inOut',
      },
      0.18
    );

    tl.to(
      projectPanel,
      { opacity: 0, duration: 0.4, ease: 'power2.in' },
      0.45
    );

    return;
  }

  gsap.to(metaItems, {
    opacity: 0,
    x: -40,
    duration: 0.3,
    stagger: { each: 0.03, from: 'end' },
    ease: 'power2.in',
    overwrite: true,
  });
  gsap.to(playerWrap || projectInner, {
    opacity: 0,
    y: 20,
    scale: 0.96,
    duration: 0.4,
    ease: 'power2.in',
    overwrite: true,
  });
  gsap.to(projectPanel, {
    opacity: 0,
    duration: 0.45,
    ease: 'power2.in',
    overwrite: true,
    onComplete: finish,
  });
}

/* ===================================================
   5. FILTERS + BACK
   =================================================== */
function initFilters() {
  document.querySelectorAll('.filter-btn[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;

      // Highlight filter immediately (don't wait for route / grid anim)
      document.querySelectorAll('.filter-btn[data-filter]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });

      routing.intent = {
        fromFilter: viewState.mode === 'categories',
        filterBtn: btn,
        sourceCard: null,
      };
      setHash(`#portfolio/${filter}`);
    });
  });

  filterBack.addEventListener('click', () => {
    if (viewState.mode === 'detail') {
      requestCloseDetail();
      return;
    }
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
        requestCloseDetail();
      } else if (viewState.mode === 'videos') {
        setHash('#portfolio');
      } else if (getHash() === '#about') {
        setHash('#portfolio');
      }
    }
  });
}

/* ===================================================
   7. LOADER & PRELOADER
   =================================================== */
function preloadAssets() {
  const aboutPhotoSrcs = Array.from(
    document.querySelectorAll('.about-panel__photo')
  )
    .map((img) => img.getAttribute('src'))
    .filter(Boolean);

  const images = [
    ...aboutPhotoSrcs,
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
  const photoStack = document.querySelector('.about-panel__photo-stack');
  const photo = photoStack || document.querySelector('.about-panel__photo');
  const cardFlipper = document.getElementById('about-flipper');
  const aboutCard = document.getElementById('about-card');

  function getAboutTarget() {
    return document.getElementById('about-name');
  }

  // Flip card was mobile-only; About now matches desktop on all sizes
  if (cardFlipper) {
    cardFlipper.classList.remove('is-flipped');
  }

  function setPhotoHover(active) {
    if (!aboutPanel) return;
    aboutPanel.classList.toggle('is-photo-hover', active);
  }

  if (photoWrap) {
    photoWrap.addEventListener('mouseenter', () => {
      if (!isTouchUi()) setPhotoHover(true);
    });
    photoWrap.addEventListener('mouseleave', () => {
      if (!isTouchUi()) setPhotoHover(false);
    });
    photoWrap.addEventListener('focusin', () => {
      if (!isTouchUi()) setPhotoHover(true);
    });
    photoWrap.addEventListener('focusout', (e) => {
      if (isTouchUi()) return;
      if (!photoWrap.contains(e.relatedTarget)) setPhotoHover(false);
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
    if (!photoTiltActive || !photoWrap || !photo || window.innerWidth <= 768) return;
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
    if (isTouchUi()) return;
    setPhotoHover(false);
    if (!photo || window.innerWidth <= 768) return;
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

    // Mobile: tap portrait to colorize / restore
    photoWrap.addEventListener('click', (e) => {
      if (!isTouchUi()) return;
      e.stopPropagation();
      setPhotoHover(!aboutPanel.classList.contains('is-photo-hover'));
    });
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
    setPhotoHover(false);

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
        setPhotoHover(false);
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
    projectClose.addEventListener('click', () => requestCloseDetail());
  }

  projectPanel.addEventListener('click', (e) => {
    if (e.target === projectPanel) requestCloseDetail();
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
  bindTouchCardDismiss();
  updateNav(parseRoute('#portfolio'));
  preloadAssets();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
