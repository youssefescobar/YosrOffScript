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
  pending: false,
  intent: { fromFilter: false, filterBtn: null, sourceCard: null },
};

let loaderDone = false;
let categoryCards = [];

/* About open/close — assigned inside initRouting */
let openAboutFn = () => {};
let closeAboutFn = () => {};

/* ---------- Hash routing ---------- */
/** Leave About the way it was entered (back), or land on the portfolio. */
function closeAboutRoute() {
  if (history.state && history.state.from && history.state.from !== '#about') {
    history.back();
  } else {
    setHash('#portfolio', { replace: true });
  }
}

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

// Each history entry remembers the hash it was pushed from, so the in-page
// Back button can step back through real history (same as the browser's).
function setHash(hash, { replace = false } = {}) {
  const target = normalizeHash(hash);
  if (getHash() === target) {
    applyRoute();
    return;
  }
  if (replace) {
    history.replaceState(history.state, '', target);
  } else {
    history.pushState({ from: getHash() }, '', target);
  }
  applyRoute();
}

/** Go up to `parent`: a real history step when we came from there, else replace. */
function goBackTo(parent) {
  const target = normalizeHash(parent);
  if (getHash() === target) return;
  if (history.state && history.state.from === target) {
    history.back();
  } else {
    setHash(target, { replace: true });
  }
}

/** Does the on-screen view already match the route? */
function viewMatchesRoute(route) {
  if (route.screen === 'about') return true;
  if (route.screen === 'categories') return viewState.mode === 'categories';
  if (route.screen === 'videos') {
    return viewState.mode === 'videos' && viewState.activeCategory === route.category;
  }
  return viewState.mode === 'detail' && viewState.activeVideoId === route.videoId;
}

/**
 * Route changes that land mid-animation are ignored by the transitions, so
 * once an animation ends, catch the view up with whatever the URL says now.
 */
function endTransition() {
  viewState.transitioning = false;
  requestAnimationFrame(() => {
    if (!routing.ready || routing.applying || viewState.transitioning) return;
    if (!viewMatchesRoute(parseRoute())) applyRoute();
  });
}

function applyRoute() {
  if (!routing.ready) return;
  if (routing.applying) {
    routing.pending = true;
    return;
  }
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
      if (routing.pending) {
        routing.pending = false;
        applyRoute();
      }
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

  // Grid columns follow the real category count (empty categories are hidden)
  categoryView.style.setProperty('--cat-count', CATEGORIES.length);
  categoryView.style.setProperty('--cat-cols-mid', CATEGORIES.length % 2 === 0 ? 2 : 3);

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
        <span class="category-card__count">${count} ${count === 1 ? 'film' : 'films'}</span>
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
  tileCountEl.textContent = `${videos.length} ${videos.length === 1 ? 'Film' : 'Films'}`;
  footerHint.textContent = cat ? cat.label : '';
  filterBack.hidden = false;
  document.querySelectorAll('.filter-btn[data-filter]').forEach((btn) => {
    const isActive = btn.dataset.filter === categoryId;
    btn.classList.toggle('active', isActive);
    btn.hidden = false;
    if (isActive) revealFilter(btn);
  });
}

/* Phones: the filter row scrolls sideways, so keep the active pill in view */
function revealFilter(btn) {
  const row = btn.parentElement;
  if (!row || row.scrollWidth <= row.clientWidth) return;
  const left = btn.offsetLeft - (row.clientWidth - btn.offsetWidth) / 2;
  row.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
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

  const finishIn = () => {
    endTransition();
  };

  const revealNew = () => {
    populateVideoGrid(categoryId, false);
    const newCards = videoGrid.querySelectorAll('.video-card');

    gsap.set(newCards, { opacity: 0, y: 24, scale: 0.97 });

    gsap
      .timeline({
        defaults: { overwrite: true },
        onComplete: () => {
          gsap.set(newCards, { clearProps: 'opacity,y,scale' });
          finishIn();
        },
      })
      .to(newCards, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.55,
        stagger: 0.04,
        ease: 'expo.out',
      });
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
  viewState.mode = 'videos';
  viewState.activeCategory = categoryId;

  populateVideoGrid(categoryId, false);
  videoView.hidden = false;
  fitVideoGrid(); // the grid has no size while the view is hidden
  updateFooterForVideos(categoryId);

  const cards = videoGrid.querySelectorAll('.video-card');
  gsap.set(cards, { opacity: 0, y: 40, scale: 0.94 });
  gsap.set(videoView, { opacity: 0 });

  const tl = gsap.timeline({
    onComplete: () => {
      endTransition();
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
            endTransition();
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
                endTransition();
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

    const videoEl = card.querySelector('.video-card__video');

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
function fitVideoGrid() {
  if (!videoGrid) return;
  const cards = Array.from(videoGrid.querySelectorAll('.video-card'));
  const phone = window.matchMedia('(max-width: 768px)').matches;
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
function initSmoothScroll() {
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
      if (e.ctrlKey || window.matchMedia('(max-width: 768px)').matches) return;
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
window.addEventListener('resize', () => {
  cancelAnimationFrame(_fitRaf);
  _fitRaf = requestAnimationFrame(fitVideoGrid);
});

function escapeHtml(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}
const escapeAttr = escapeHtml;

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

function queueIdleLoop(card, videoEl) {
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
    unqueueIdleLoop(card);
    // Pause only: seeking every clip back to 0 at once is decoder work right
    // as a transition starts, and startIdleLoop rewinds long-run clips anyway
    if (v) v.pause();
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
    ? `<span class="project-panel__brand project-panel__meta-item">${escapeHtml(video.brand)}</span>`
    : '';

  const cat = getCategory(video.category);
  const isLandscape = video.aspect > 1;
  projectInner.classList.toggle('is-landscape', isLandscape);

  projectInner.innerHTML = `
    <div class="project-panel__player-slot" id="detail-player-slot">
      <div class="project-panel__player-wrap" id="detail-player">
        <video
          class="project-panel__video"
          id="detail-video"
          src="${escapeAttr(video.src)}"
          poster="${escapeAttr(video.poster)}"
          style="aspect-ratio: ${video.aspect}"
          controls
          controlslist="nodownload"
          oncontextmenu="return false"
          playsinline
          preload="metadata"
        ></video>
      </div>
    </div>
    <div class="project-panel__meta" id="detail-meta">
      ${brandHtml}
      <h2 class="project-panel__title project-panel__meta-item">${escapeHtml(video.title)}</h2>
      <div class="project-panel__category project-panel__meta-item">${escapeHtml(cat ? cat.label : video.category)}</div>
      ${video.description ? `<p class="project-panel__desc project-panel__meta-item">${escapeHtml(video.description)}</p>` : ''}
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

  // Start playback once the player has landed: decoding the first frames
  // mid-flight competes with the fly-in animation (the poster shows meanwhile)
  const finishOpen = () => {
    if (viewState.detailVideoEl === detailVideo) detailVideo.play().catch(() => {});
    endTransition();
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
    // One fixed shadow: tweening a large blurred shadow repaints it every frame
    boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
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
  goBackTo(cat ? `#portfolio/${cat}` : '#portfolio');
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
    endTransition();

    // Resume ambient loops on the grid
    if (viewState.mode === 'videos') {
      videoGrid.querySelectorAll('.video-card').forEach((card) => {
        const v = card.querySelector('.video-card__video');
        if (v && v.getAttribute('src')) queueIdleLoop(card, v);
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
  // Hide filters for categories that have no videos
  document.querySelectorAll('.filter-btn[data-filter]').forEach((btn) => {
    if (!getCategory(btn.dataset.filter)) btn.remove();
  });

  document.querySelectorAll('.filter-btn[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;

      // Highlight filter immediately (don't wait for route / grid anim)
      document.querySelectorAll('.filter-btn[data-filter]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });

      const fromCategories = parseRoute().screen === 'categories';
      routing.intent = {
        fromFilter: viewState.mode === 'categories',
        filterBtn: btn,
        sourceCard: null,
      };
      // Category → category is a sideways move: keep one grid entry in history
      setHash(`#portfolio/${filter}`, { replace: !fromCategories });
    });
  });

  filterBack.addEventListener('click', () => {
    if (viewState.mode === 'detail') {
      requestCloseDetail();
      return;
    }
    goBackTo('#portfolio');
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
        goBackTo('#portfolio');
      } else if (getHash() === '#about') {
        closeAboutRoute();
      }
    }
  });
}

/* ===================================================
   7. LOADER & PRELOADER
   =================================================== */
const MIN_LOADER_MS = 3600;
const HOLD_AT_FULL_MS = 700;

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

function loadImageAsset(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    const finish = () => resolve(src);
    img.onload = () => {
      if (img.decode) {
        img.decode().then(finish).catch(finish);
      } else {
        finish();
      }
    };
    img.onerror = finish;
    img.src = src;
  });
}

function preloadAssets() {
  const aboutPhotoSrcs = Array.from(
    document.querySelectorAll('.about-panel__photo')
  )
    .map((img) => img.getAttribute('src'))
    .filter(Boolean);

  const imageSrcs = unique([
    ...aboutPhotoSrcs,
    ...CATEGORIES.map((c) => c.cover),
    ...VIDEOS.map((v) => v.poster),
    '/preview.png',
    '/favicon.svg',
  ]);

  const progressEl = document.getElementById('loader-progress');
  const ctaEl = document.getElementById('loader-cta');
  const startedAt = performance.now();

  gsap.set('.header__nav', { opacity: 0, y: -30 });
  gsap.set('.footer', { opacity: 0, y: 30 });
  gsap.set('.header__left', { opacity: 0 });
  gsap.set(categoryCards, { opacity: 0, scale: 0.9, y: 30 });

  const tl = gsap.timeline({ defaults: { ease: 'expo.out', duration: 1.2 } });

  tl.to('.loader__line > span', { y: '0%', stagger: 0.12, duration: 1 })
    .to('.loader__tagline-line', { y: '0%', duration: 0.8 }, '-=0.5')
    .to(progressEl, { opacity: 1, duration: 0.5 }, '-=0.3');

  // Weighted progress: images + fonts only. Videos load lazily (cards on
  // view, detail on open) so the loader never waits on film bandwidth.
  const weights = {
    images: 0.9,
    fonts: 0.1,
  };
  const state = {
    images: 0,
    fonts: 0,
  };

  let displayProgress = 0;
  let targetProgress = 0;
  let progressRaf = 0;
  let unlocked = false;

  function computeTarget() {
    return Math.min(
      100,
      (state.images * weights.images + state.fonts * weights.fonts) * 100
    );
  }

  function paintProgress() {
    displayProgress += (targetProgress - displayProgress) * 0.07;
    if (Math.abs(targetProgress - displayProgress) < 0.15) {
      displayProgress = targetProgress;
    }
    if (progressEl) {
      progressEl.textContent = `${Math.floor(displayProgress)}%`;
    }
    if (displayProgress < 99.9 || targetProgress < 100) {
      progressRaf = requestAnimationFrame(paintProgress);
    } else if (progressEl) {
      progressEl.textContent = '100%';
    }
  }
  progressRaf = requestAnimationFrame(paintProgress);

  function syncProgress() {
    targetProgress = computeTarget();
  }

  async function finishWhenReady() {
    if (unlocked) return;
    // Wait until weighted load is complete
    while (computeTarget() < 99.5) {
      await new Promise((r) => setTimeout(r, 50));
    }
    targetProgress = 100;

    const elapsed = performance.now() - startedAt;
    const waitMore = Math.max(0, MIN_LOADER_MS - elapsed);
    await new Promise((r) => setTimeout(r, waitMore));

    // Let the % ease up to 100, then hold a beat
    await new Promise((r) => {
      const check = () => {
        if (displayProgress >= 99.5) r();
        else requestAnimationFrame(check);
      };
      check();
    });
    await new Promise((r) => setTimeout(r, HOLD_AT_FULL_MS));

    // Warm up the first screen behind the opaque loader: decode the covers and
    // let the browser lay out and paint the (still transparent) category view
    // now, so the click into the site doesn't stall on that first paint.
    viewport.classList.add('is-active');
    gsap.set(categoryCards, { opacity: 0.01 });
    await Promise.allSettled(
      Array.from(document.querySelectorAll('.category-view img, .about-panel__photo'), (img) =>
        img.decode()
      )
    );
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    if (unlocked) return;
    unlocked = true;
    cancelAnimationFrame(progressRaf);

    const reveal = () => hideProgressAndShowCTA();
    if (tl.isActive()) {
      tl.eventCallback('onComplete', reveal);
    } else {
      reveal();
    }
  }

  function hideProgressAndShowCTA() {
    gsap.to(progressEl, {
      opacity: 0,
      duration: 0.45,
      onComplete: () => {
        ctaEl.classList.add('is-ready');
        playLoader();
      },
    });
  }

  // Kick off work in parallel
  (async () => {
    const imageJobs = imageSrcs.map(async (src) => {
      await loadImageAsset(src);
      state.images += 1 / Math.max(imageSrcs.length, 1);
      syncProgress();
    });

    const fontJob = document.fonts.ready
      .then(() => {
        state.fonts = 1;
        syncProgress();
      })
      .catch(() => {
        state.fonts = 1;
        syncProgress();
      });

    await Promise.allSettled([...imageJobs, fontJob]);

    // Safety: force remaining bars full if a counter drifted
    state.images = 1;
    state.fonts = 1;
    syncProgress();
    finishWhenReady();
  })();
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

    gsap.set(['.loader__tagline', '.loader__cta', '.loader__progress'], { willChange: 'opacity' });
    gsap.to(['.loader__tagline', '.loader__cta', '.loader__progress'], {
      opacity: 0,
      duration: 0.5,
    });
    gsap.to('.loader__bg', {
      opacity: 0,
      duration: 1.2,
      ease: 'power2.inOut',
    });

    const lRect = loaderText.getBoundingClientRect();
    gsap.set('.header__left', { opacity: 1 });
    const hRect = headerName.getBoundingClientRect();

    // Own GPU layers while they fly, so the scale tweens don't repaint the
    // full-screen loader and header every frame.
    gsap.set([loaderText, headerName], { transformOrigin: '0% 50%', willChange: 'transform, opacity' });

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
        gsap.set(headerName, { clearProps: 'transform,opacity,willChange' });
        gsap.set('.header', { clearProps: 'zIndex' });

        // Enable routing only after intro settles — then honor deep link
        routing.ready = true;
        const boot = routing.bootHash;
        if (boot === '#about' || boot.startsWith('#portfolio/')) {
          // Seed the parent levels so browser back walks up like the Back button
          const route = parseRoute(boot);
          if (route.screen === 'detail') {
            history.pushState({ from: '#portfolio' }, '', `#portfolio/${route.category}`);
          }
          setTimeout(() => setHash(boot), 200);
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

    // No hover effects mid-entrance: a cursor resting where a card lands would
    // start its letter-spacing transition and relayout every frame.
    categoryView.classList.add('is-entering');
    gsap.to(categoryCards, {
      opacity: 1,
      scale: 1,
      y: 0,
      duration: 1.1,
      stagger: 0.1,
      ease: 'expo.out',
      delay: 0.35,
      onComplete: () => categoryView.classList.remove('is-entering'),
    });

    gsap.set(['.header__nav', '.footer'], { willChange: 'transform, opacity' });
    gsap.to(['.header__nav', '.footer'], {
      y: 0,
      opacity: 1,
      duration: 1.2,
      stagger: 0.2,
      ease: 'expo.out',
      delay: 0.6,
      onComplete: () => gsap.set(['.header__nav', '.footer'], { clearProps: 'willChange' }),
    });
  }
}

/* ===================================================
   8. ROUTING (About) — preserved from prior design
   =================================================== */
function initRouting() {

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
    aboutPanel.classList.toggle('is-photo-hover', !!active);
  }

  function togglePhotoColor() {
    setPhotoHover(!aboutPanel.classList.contains('is-photo-hover'));
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

  function onPhotoLeave() {
    if (isTouchUi()) return;
    setPhotoHover(false);
  }

  if (photoWrap) {
    photoWrap.addEventListener('mouseleave', onPhotoLeave);

    // Mobile: tap cycles colorize ↔ muted (pointerup avoids sticky-hover bugs)
    let photoTapStart = null;
    photoWrap.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'mouse') return;
        photoTapStart = { x: e.clientX, y: e.clientY };
      },
      { passive: true }
    );
    photoWrap.addEventListener(
      'pointermove',
      (e) => {
        if (!photoTapStart || e.pointerType === 'mouse') return;
        if (
          Math.abs(e.clientX - photoTapStart.x) > 12 ||
          Math.abs(e.clientY - photoTapStart.y) > 12
        ) {
          photoTapStart = null;
        }
      },
      { passive: true }
    );
    photoWrap.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' || !photoTapStart) return;
      photoTapStart = null;
      e.preventDefault();
      e.stopPropagation();
      togglePhotoColor();
    });
    photoWrap.addEventListener('pointercancel', () => {
      photoTapStart = null;
    });
  }

  // closed → opening → open → closing → closed. A route change that lands
  // mid-animation reverses the running timeline instead of starting another,
  // so About never snaps, and open/close are safe to call repeatedly.
  let aboutState = 'closed';
  let aboutTl = null;
  const reveals = aboutPanel.querySelectorAll('.about-reveal');
  const backdrop = aboutPanel.querySelector('.about-panel__backdrop');

  // Transform that lays `from` over `to`: left edges and vertical centres meet
  function morph(from, to) {
    return {
      x: to.left - from.left,
      y: to.top + to.height / 2 - (from.top + from.height / 2),
      scale: to.height / from.height,
    };
  }

  function settleOpen() {
    aboutState = 'open';
    aboutTl = null;
    // Brand lives in About now — keep it out of the nav until close
    gsap.set(headerName, { clearProps: 'transform,willChange', opacity: 0, visibility: 'hidden' });
    gsap.set(getAboutTarget(), { clearProps: 'willChange' });
  }

  function settleClosed() {
    aboutState = 'closed';
    aboutTl = null;
    gsap.set(headerName, { clearProps: 'transform,opacity,visibility,willChange' });
    aboutPanel.style.transition = 'none';
    aboutPanel.classList.remove('is-open');
    gsap.set(aboutPanel, { clearProps: 'opacity' });
    if (aboutCard) {
      gsap.set(aboutCard, { clearProps: 'opacity,scale,y' });
      aboutCard.removeAttribute('data-active-brand');
    }
    if (cardFlipper) cardFlipper.classList.remove('is-flipped');
    setPhotoHover(false);
    gsap.set(getAboutTarget(), { opacity: 0, clearProps: 'x,y,scale,transformOrigin,willChange' });
    gsap.set(photo, { clearProps: 'transform' });
    gsap.set(photoWrap, { clearProps: 'transform,willChange' });
    gsap.set(reveals, { opacity: 0, y: 25 });
    gsap.set(backdrop, { clearProps: 'opacity' });
    requestAnimationFrame(() => aboutPanel.style.removeProperty('transition'));
  }

  function openAbout() {
    if (aboutState === 'open' || aboutState === 'opening') return;
    if (aboutState === 'closing') {
      aboutState = 'opening';
      aboutTl.reversed(!aboutTl.reversed()); // flip direction: reverse() only ever plays backwards
      return;
    }
    aboutState = 'opening';

    if (cardFlipper) cardFlipper.classList.remove('is-flipped');

    const aboutName = getAboutTarget();
    const hRect = headerName.getBoundingClientRect();

    // GSAP owns the panel fade (not the CSS transition) so it can reverse
    aboutPanel.style.transition = 'none';
    aboutPanel.classList.add('is-open');
    gsap.set(aboutPanel, { opacity: 0 });
    gsap.set(aboutName, { opacity: 1, x: 0, y: 0, scale: 1 });
    const aRect = aboutName.getBoundingClientRect();

    gsap.set([headerName, aboutName], {
      transformOrigin: '0% 50%',
      // Own layers while the names fly, so the scale tweens don't repaint the page
      willChange: 'transform, opacity',
    });
    gsap.set(aboutName, { ...morph(aRect, hRect), opacity: 0 });

    // Bottom-up wipe as two opposite slides (the frame rises while the photo
    // inside sinks by the same amount): GPU-composited, where animating
    // clip-path repainted the whole photo every frame.
    gsap.set(photoWrap, { yPercent: 100, willChange: 'transform' });
    gsap.set(photo, { yPercent: -100, scale: 1.3 });
    gsap.set(reveals, { opacity: 0, y: 25 });

    const isMobile = window.innerWidth <= 768;
    const openDuration = isMobile ? 0.7 : 1.2;

    aboutTl = gsap.timeline({ onComplete: settleOpen, onReverseComplete: settleClosed });
    aboutTl
      .to(aboutPanel, { opacity: 1, duration: 0.6, ease: 'expo.out' }, 0)
      .to(aboutName, { x: 0, y: 0, scale: 1, opacity: 1, duration: openDuration, ease: 'expo.inOut' }, 0)
      .to(headerName, { ...morph(hRect, aRect), opacity: 0, duration: openDuration, ease: 'expo.inOut' }, 0)
      .to(photoWrap, { yPercent: 0, duration: 1.4, ease: 'expo.inOut' }, 0.1)
      .to(photo, { yPercent: 0, scale: 1, duration: 1.4, ease: 'expo.inOut' }, 0.1)
      .to(reveals, { opacity: 1, y: 0, duration: 1, stagger: 0.1, ease: 'expo.out' }, 0.4);

    if (isMobile && aboutCard) {
      aboutTl.fromTo(
        aboutCard,
        { opacity: 0, scale: 0.94, y: 30 },
        { opacity: 1, scale: 1, y: 0, duration: 0.7, ease: 'expo.out' },
        0.08
      );
    }
  }

  function closeAbout() {
    if (aboutState === 'closed' || aboutState === 'closing') return;
    setPhotoHover(false);
    if (aboutState === 'opening') {
      aboutState = 'closing';
      aboutTl.reversed(!aboutTl.reversed()); // flip direction: reverse() only ever plays backwards
      return;
    }
    aboutState = 'closing';

    const isMobile = window.innerWidth <= 768;
    const aboutName = getAboutTarget();
    const aRect = aboutName.getBoundingClientRect();

    // Bring nav brand back for the reverse morph into the header
    gsap.set(headerName, { clearProps: 'transform,opacity,visibility' });
    gsap.set(headerName, { opacity: 1, visibility: 'visible' });
    const hRect = headerName.getBoundingClientRect();

    gsap.set([headerName, aboutName], { transformOrigin: '0% 50%', willChange: 'transform, opacity' });
    gsap.set(headerName, { ...morph(hRect, aRect), opacity: 0 });
    gsap.set(photoWrap, { willChange: 'transform' });

    const closeDuration = isMobile ? 0.55 : 1.2;
    const closeEase = isMobile ? 'power3.out' : 'expo.inOut';

    aboutTl = gsap.timeline({ onComplete: settleClosed, onReverseComplete: settleOpen });
    aboutTl
      .to(reveals, { opacity: 0, y: -15, duration: 0.4, ease: 'power2.in' }, 0)
      // Reverse wipe: frame rises out the top while the photo holds still
      .to(photoWrap, { yPercent: -100, duration: 0.6, ease: 'power2.in' }, 0)
      .to(photo, { yPercent: 100, scale: 1.1, duration: 0.6, ease: 'power2.in' }, 0)
      .to(aboutName, { ...morph(aRect, hRect), opacity: 0, duration: closeDuration, ease: closeEase }, 0)
      .to(headerName, { x: 0, y: 0, scale: 1, opacity: 1, duration: closeDuration, ease: closeEase }, 0)
      .to(backdrop, { opacity: 0, duration: isMobile ? 0.45 : 0.8, ease: 'power2.inOut' }, 0);

    if (isMobile && aboutCard) {
      aboutTl.to(aboutCard, { opacity: 0, scale: 0.92, y: 40, duration: 0.45, ease: 'power2.in' }, 0);
    }
  }

  openAboutFn = openAbout;
  closeAboutFn = closeAbout;

  // Browser back / forward / hash links. popstate alone: it fires for every
  // hash navigation too, and also listening to hashchange ran each route twice.
  window.addEventListener('popstate', onBrowserRouteChange);

  aboutClose.addEventListener('click', (e) => {
    e.preventDefault();
    closeAboutRoute();
  });

  const portfolioLink = header.querySelector('a[href="#portfolio"]');
  if (portfolioLink) {
    portfolioLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (getHash() === '#about') closeAboutRoute();
      else setHash('#portfolio');
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
  initSmoothScroll();
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
