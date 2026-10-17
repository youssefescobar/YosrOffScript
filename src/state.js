/* ===================================================
   SHARED — DOM refs, view state, small helpers
   =================================================== */

/* ---------- DOM refs ---------- */
export const loader = document.getElementById('loader');
export const viewport = document.getElementById('viewport');
export const categoryView = document.getElementById('category-view');
export const videoView = document.getElementById('video-view');
export const videoGrid = document.getElementById('video-grid');
export const tileCountEl = document.getElementById('tile-count');
export const footerHint = document.getElementById('footer-hint');
export const filterBack = document.getElementById('filter-back');
export const aboutPanel = document.getElementById('about-panel');
export const aboutClose = document.getElementById('about-close');
export const projectPanel = document.getElementById('project-panel');
export const projectClose = document.getElementById('project-close');
export const projectInner = document.getElementById('project-inner');
export const header = document.getElementById('header');
export const flipGhost = document.getElementById('flip-ghost');

/* ---------- State ---------- */
export const viewState = {
  mode: 'categories', // 'categories' | 'videos' | 'detail'
  activeCategory: null,
  activeVideoId: null,
  transitioning: false,
  playingVideo: null,
  detailVideoEl: null,
};

export const routing = {
  ready: false,
  applying: false,
  bootPath: '/',
  pending: false,
  intent: { fromFilter: false, filterBtn: null, sourceCard: null },
};

/** Category landing cards, filled by buildCategoryView. */
export const categoryCards = [];

/* ---------- Helpers ---------- */
export function isTouchUi() {
  // True devices without hover (phones). Don't use pointer:coarse —
  // that misfires on hybrid tablets/laptops and breaks mouse hover.
  return window.matchMedia('(hover: none)').matches;
}

export function isPhone() {
  return window.matchMedia('(max-width: 768px)').matches;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}
export const escapeAttr = escapeHtml;
