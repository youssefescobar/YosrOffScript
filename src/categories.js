import gsap from 'gsap';
import { CATEGORIES, getVideosByCategory, getCategory } from './projects.js';
import {
  categoryView,
  videoView,
  videoGrid,
  tileCountEl,
  footerHint,
  filterBack,
  flipGhost,
  viewState,
  routing,
  categoryCards,
} from './state.js';
import { paths, parseRoute, navigate, goBackTo, endTransition, requestCloseDetail } from './router.js';
import { populateVideoGrid, fitVideoGrid, stopAllPreviews } from './grid.js';
import { closeVideoDetail } from './detail.js';

/* ===================================================
   1. CATEGORY LANDING
   =================================================== */
export function buildCategoryView() {
  categoryView.innerHTML = '';
  categoryCards.length = 0;

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
      navigate(paths.category(cat.id));
    });
    categoryView.appendChild(el);
    categoryCards.push(el);
  });

  updateFooterForCategories();
}

export function updateFooterForCategories() {
  tileCountEl.textContent = `${CATEGORIES.length} Categories`;
  footerHint.textContent = 'Select a category';
  filterBack.hidden = true;
  document.querySelectorAll('.filter-btn[data-filter]').forEach((btn) => {
    btn.classList.remove('active');
    btn.hidden = false;
  });
}

export function updateFooterForVideos(categoryId) {
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

export function enterCategory(categoryId, { fromFilter = false, filterBtn = null } = {}) {
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

export function exitToCategories() {
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
   5. FILTERS + BACK
   =================================================== */
export function initFilters() {
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
      navigate(paths.category(filter), { replace: !fromCategories });
    });
  });

  filterBack.addEventListener('click', () => {
    if (viewState.mode === 'detail') {
      requestCloseDetail();
      return;
    }
    goBackTo(paths.home);
  });
}
