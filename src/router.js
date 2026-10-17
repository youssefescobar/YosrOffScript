/* ===================================================
   ROUTER — real paths (/, /about, /<category>, /<category>/<film>)
   =================================================== */
import gsap from 'gsap';
import {
  getCategory,
  getVideo,
  getVideoByName,
  getVideoByLegacyId,
  pageTitle,
} from './projects.js';
import {
  categoryView,
  videoView,
  header,
  projectPanel,
  projectClose,
  viewState,
  routing,
} from './state.js';
import { enterCategory, exitToCategories, updateFooterForVideos } from './categories.js';
import { populateVideoGrid } from './grid.js';
import { openVideoDetail, closeVideoDetail } from './detail.js';
import { openAbout, closeAbout } from './about.js';

export const paths = {
  home: '/',
  about: '/about',
  category: (id) => `/${id}`,
};

export function normalizePath(path) {
  const p = (path || '').split(/[?#]/)[0].replace(/\/+$/, '');
  if (!p) return '/';
  return p.startsWith('/') ? p : `/${p}`;
}

export function getPath() {
  return normalizePath(window.location.pathname);
}

export function parseRoute(path = getPath()) {
  const parts = normalizePath(path).split('/').filter(Boolean);
  if (parts.length === 1 && parts[0] === 'about') return { screen: 'about' };

  const cat = parts[0] ? getCategory(parts[0]) : null;
  if (cat) {
    if (parts[1]) {
      const video = getVideoByName(cat.id, parts[1]);
      if (video) return { screen: 'detail', category: cat.id, videoId: video.id };
    }
    return { screen: 'videos', category: cat.id };
  }

  return { screen: 'categories' };
}

/** The canonical path for a parsed route. */
export function routePath(route) {
  if (route.screen === 'about') return paths.about;
  if (route.screen === 'detail') return getVideo(route.videoId).path;
  if (route.screen === 'videos') return paths.category(route.category);
  return paths.home;
}

/** Old #portfolio/... and #about links → their new path (null if none). */
export function legacyHashPath(hash = window.location.hash) {
  const h = hash.replace(/^#\/?/, '');
  if (!h) return null;
  if (h === 'about') return paths.about;
  const [root, cat, id] = h.split('/');
  if (root !== 'portfolio') return null;
  if (!cat || !getCategory(cat)) return paths.home;
  const video = id ? getVideoByLegacyId(id) : null;
  return video && video.category === cat ? video.path : paths.category(cat);
}

export function updateNav(route) {
  if (!header) return;
  header.querySelectorAll('.header__link').forEach((link) => {
    const isAboutLink = link.getAttribute('href') === paths.about;
    link.classList.toggle(
      'active',
      isAboutLink ? route.screen === 'about' : route.screen !== 'about'
    );
  });
  document.title = pageTitle({
    about: route.screen === 'about',
    category: route.category,
    video: route.videoId ? getVideo(route.videoId) : null,
  });
}

/** Leave About the way it was entered (back), or land on the portfolio. */
export function closeAboutRoute() {
  if (history.state && history.state.from && history.state.from !== paths.about) {
    history.back();
  } else {
    navigate(paths.home, { replace: true });
  }
}

// Each history entry remembers the path it was pushed from, so the in-page
// Back button can step back through real history (same as the browser's).
export function navigate(path, { replace = false } = {}) {
  const target = normalizePath(path);
  if (getPath() === target) {
    applyRoute();
    return;
  }
  if (replace) {
    history.replaceState(history.state, '', target);
  } else {
    history.pushState({ from: getPath() }, '', target);
  }
  applyRoute();
}

/** Go up to `parent`: a real history step when we came from there, else replace. */
export function goBackTo(parent) {
  const target = normalizePath(parent);
  if (getPath() === target) return;
  if (history.state && history.state.from === target) {
    history.back();
  } else {
    navigate(target, { replace: true });
  }
}

export function requestCloseDetail() {
  const cat = viewState.activeCategory;
  goBackTo(cat ? paths.category(cat) : paths.home);
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
export function endTransition() {
  viewState.transitioning = false;
  requestAnimationFrame(() => {
    if (!routing.ready || routing.applying || viewState.transitioning) return;
    if (!viewMatchesRoute(parseRoute())) applyRoute();
  });
}

export function applyRoute() {
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
      openAbout();
      return;
    }

    closeAbout();

    if (route.screen === 'detail') {
      ensureCategoryLayer(route.category);
      const video = getVideo(route.videoId);
      if (video) {
        openVideoDetail(video, { fromRoute: true });
      } else {
        navigate(paths.category(route.category), { replace: true });
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

/**
 * Remember the deep link, but park on / so nothing opens behind the loader.
 * Old #portfolio/... links are translated to their new paths here.
 */
export function captureBootPath() {
  routing.bootPath = routePath(parseRoute(legacyHashPath() ?? getPath()));
  if (window.location.pathname !== '/' || window.location.hash) {
    history.replaceState(null, '', '/');
  }
}

/** Enable routing once the intro settles, then honor the deep link. */
export function startRouting() {
  routing.ready = true;
  const boot = routing.bootPath;
  if (boot === paths.home) {
    updateNav(parseRoute(paths.home));
    return;
  }
  // Seed the parent levels so browser back walks up like the Back button
  const route = parseRoute(boot);
  if (route.screen === 'detail') {
    history.pushState({ from: paths.home }, '', paths.category(route.category));
  }
  setTimeout(() => navigate(boot), 200);
}

export function initRouter() {
  // Browser back / forward. popstate alone: it fires for every history step,
  // and also listening to hashchange ran each route twice.
  window.addEventListener('popstate', () => {
    if (routing.ready) applyRoute();
  });

  const portfolioLink = header.querySelector(`a[href="${paths.home}"]`);
  if (portfolioLink) {
    portfolioLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (getPath() === paths.about) closeAboutRoute();
      else navigate(paths.home);
    });
  }

  const aboutLink = header.querySelector(`a[href="${paths.about}"]`);
  if (aboutLink) {
    aboutLink.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(paths.about);
    });
  }

  if (projectClose) {
    projectClose.addEventListener('click', () => requestCloseDetail());
  }

  projectPanel.addEventListener('click', (e) => {
    if (e.target === projectPanel) requestCloseDetail();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (viewState.mode === 'detail') {
      requestCloseDetail();
    } else if (viewState.mode === 'videos') {
      goBackTo(paths.home);
    } else if (getPath() === paths.about) {
      closeAboutRoute();
    }
  });
}
