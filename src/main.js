/* ===================================================
   MAIN — Category cards → McKinnon video grid → detail

   categories.js  landing cards, category enter/exit, footer filters
   grid.js        film grid, idle preview loops, card hover
   detail.js      film detail overlay
   about.js       About panel
   loader.js      intro loader + asset preloading
   router.js      URL ⇄ view (real paths, history)
   =================================================== */
import '@fontsource-variable/inter';
import { buildCategoryView, initFilters } from './categories.js';
import { initSmoothScroll, initGridResize, bindTouchCardDismiss } from './grid.js';
import { initAbout } from './about.js';
import { preloadAssets } from './loader.js';
import { initRouter, captureBootPath, updateNav, parseRoute, paths } from './router.js';

function init() {
  captureBootPath();

  buildCategoryView();
  initFilters();
  initSmoothScroll();
  initGridResize();
  initRouter();
  initAbout();
  bindTouchCardDismiss();
  updateNav(parseRoute(paths.home));
  preloadAssets();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
