/* ===================================================
   MAIN — 3D Walkable Archive
   =================================================== */
import gsap from 'gsap';
import { Observer } from 'gsap/Observer';
import PROJECTS from './projects.js';

gsap.registerPlugin(Observer);

/* ---------- DOM refs ---------- */
const loader      = document.getElementById('loader');
const experience  = document.getElementById('experience');
const stage       = document.getElementById('stage');
const world       = document.getElementById('world');
const tileCount   = document.getElementById('tile-count');
const filterBar   = document.getElementById('filter-bar');
const aboutPanel  = document.getElementById('about-panel');
const aboutClose  = document.getElementById('about-close');
const nav         = document.getElementById('nav');

/* ---------- State ---------- */
const camera = { x: 0, y: 0 };          // current world offset
let tiles = [];                           // { el, baseX, baseY, baseZ, rotX, rotY, rotZ, project }
let activeFilter = 'all';
let loaderDone = false;

/* ---------- Layout config ---------- */
const COLS = 4;
const SPACING_X = 420;
const SPACING_Y = 500;
const Z_RANGE = 600;    // how deep tiles scatter in Z
const ROT_RANGE = 8;    // max rotation degrees

/* ===================================================
   1.  GENERATE TILES
   =================================================== */
function createTiles() {
  PROJECTS.forEach((proj, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    // Scatter positions centered around (0,0)
    const totalCols = COLS;
    const totalRows = Math.ceil(PROJECTS.length / COLS);
    const baseX = (col - (totalCols - 1) / 2) * SPACING_X + (Math.random() - 0.5) * 80;
    const baseY = (row - (totalRows - 1) / 2) * SPACING_Y + (Math.random() - 0.5) * 60;
    const baseZ = (Math.random() - 0.5) * Z_RANGE;

    const rotX = (Math.random() - 0.5) * ROT_RANGE;
    const rotY = (Math.random() - 0.5) * ROT_RANGE;
    const rotZ = (Math.random() - 0.5) * ROT_RANGE * 0.5;

    // Create DOM
    const btn = document.createElement('button');
    btn.className = 'tile';
    btn.setAttribute('data-category', proj.category);
    btn.setAttribute('aria-label', proj.title);
    btn.innerHTML = `
      <div class="tile__img-wrap">
        <img class="tile__img" src="${proj.img}" alt="${proj.title}" loading="lazy" />
        <div class="tile__label">
          <div class="tile__title">${proj.title}</div>
          <div class="tile__category">${proj.category}</div>
        </div>
      </div>
    `;

    // Click handler — you can expand this to open a project detail view
    btn.addEventListener('click', () => {
      console.log(`Open project: ${proj.title}`);
    });

    world.appendChild(btn);

    tiles.push({
      el: btn,
      baseX, baseY, baseZ,
      rotX, rotY, rotZ,
      project: proj,
    });
  });

  tileCount.textContent = `(${PROJECTS.length})`;
}

/* ===================================================
   2.  UPDATE TILE TRANSFORMS (the "camera" loop)
   =================================================== */
function updateTiles() {
  const perspective = parseFloat(getComputedStyle(stage).perspective) || 1120;

  tiles.forEach((t) => {
    // Final world-space position = base + camera offset
    const x = t.baseX + camera.x;
    const y = t.baseY + camera.y;
    const z = t.baseZ;

    // Depth-of-field blur: tiles further from z=0 get more blur
    const absZ = Math.abs(z);
    const blur = Math.min(absZ / 300, 3); // max 3px
    t.el.style.setProperty('--perspective-blur', `${blur.toFixed(2)}px`);

    // Opacity based on distance (fade out very far tiles)
    const dist = Math.sqrt(x * x + y * y + z * z);
    const opacity = gsap.utils.clamp(0.15, 1, 1 - dist / 2800);

    t.el.style.transform =
      `translate(-50%, -50%)
       translate3d(${x}px, ${y}px, ${z}px)
       rotateX(${t.rotX}deg)
       rotateY(${t.rotY}deg)
       rotateZ(${t.rotZ}deg)`;
    t.el.style.opacity = opacity;
  });
}

/* ===================================================
   3.  DRAGGABLE WITH MANUAL INERTIA
   =================================================== */
function initDrag() {
  let isDragging = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let velocityX = 0;
  let velocityY = 0;
  const friction = 0.92; // momentum decay per frame

  // Pointer events for drag
  stage.addEventListener('pointerdown', (e) => {
    isDragging = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    velocityX = 0;
    velocityY = 0;
    stage.setPointerCapture(e.pointerId);
  });

  stage.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;

    camera.x += dx;
    camera.y += dy;
    velocityX = dx;
    velocityY = dy;
    updateTiles();
  });

  stage.addEventListener('pointerup', () => {
    isDragging = false;
  });
  stage.addEventListener('pointercancel', () => {
    isDragging = false;
  });

  // Inertia via GSAP ticker
  gsap.ticker.add(() => {
    if (isDragging) return;
    if (Math.abs(velocityX) < 0.1 && Math.abs(velocityY) < 0.1) return;

    velocityX *= friction;
    velocityY *= friction;
    camera.x += velocityX;
    camera.y += velocityY;
    updateTiles();
  });
}

/* ===================================================
   4.  SCROLL / WHEEL OBSERVER
   =================================================== */
function initScroll() {
  Observer.create({
    target: stage,
    type: 'wheel,touch',
    onChangeY(self) {
      camera.y -= self.deltaY * 0.8;
      updateTiles();
    },
    onChangeX(self) {
      camera.x -= self.deltaX * 0.8;
      updateTiles();
    },
    tolerance: 10,
    preventDefault: true,
  });
}

/* ===================================================
   5.  LOADER ANIMATION
   =================================================== */
function playLoader() {
  const tl = gsap.timeline({
    defaults: { ease: 'expo.out', duration: 1.2 },
  });

  // Reveal name lines
  tl.to('.loader__line > span', {
    y: '0%',
    stagger: 0.12,
    duration: 1,
  })
    .to(
      '.loader__tagline > span',
      { y: '0%', duration: 0.8 },
      '-=0.5'
    )
    .to(
      '.loader__cta > span',
      { y: '0%', opacity: 1, duration: 0.8 },
      '-=0.3'
    );

  // Wait for scroll/click to dismiss
  function dismiss() {
    if (loaderDone) return;
    loaderDone = true;

    gsap.to(loader, {
      opacity: 0,
      duration: 0.8,
      ease: 'power2.inOut',
      onComplete() {
        loader.style.display = 'none';
      },
    });

    experience.classList.add('is-active');
    gsap.from(tiles.map((t) => t.el), {
      opacity: 0,
      duration: 1.2,
      stagger: { each: 0.04, from: 'random' },
      ease: 'power2.out',
    });
  }

  // Listen for scroll or click on the loader
  Observer.create({
    target: loader,
    type: 'wheel,touch,pointer',
    onDown: dismiss,
    onUp: dismiss,
    onWheel: dismiss,
  });

  loader.addEventListener('click', dismiss);
}

/* ===================================================
   6.  FILTERS
   =================================================== */
function initFilters() {
  const buttons = filterBar.querySelectorAll('.filter-btn');

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      if (filter === activeFilter) return;
      activeFilter = filter;

      // Update active button
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      // Show/hide tiles
      tiles.forEach((t) => {
        const show = filter === 'all' || t.project.category === filter;
        if (show) {
          t.el.classList.remove('is-hidden');
        } else {
          t.el.classList.add('is-hidden');
        }
      });
    });
  });
}

/* ===================================================
   7.  HASH ROUTING (simple)
   =================================================== */
function initRouting() {
  function handleHash() {
    const hash = window.location.hash || '#archive';

    // Update nav active state
    nav.querySelectorAll('.nav-overlay__link').forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === hash);
    });

    // Toggle about panel
    if (hash === '#about') {
      aboutPanel.classList.add('is-open');
    } else {
      aboutPanel.classList.remove('is-open');
    }
  }

  window.addEventListener('hashchange', handleHash);
  handleHash();

  aboutClose.addEventListener('click', () => {
    window.location.hash = '#archive';
  });
}

/* ===================================================
   8.  KEYBOARD NAVIGATION
   =================================================== */
function initKeyboard() {
  const SPEED = 60;
  const keys = {};

  window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
  });
  window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
  });

  gsap.ticker.add(() => {
    let moved = false;
    if (keys['ArrowLeft'] || keys['a']) { camera.x += SPEED; moved = true; }
    if (keys['ArrowRight'] || keys['d']) { camera.x -= SPEED; moved = true; }
    if (keys['ArrowUp'] || keys['w']) { camera.y += SPEED; moved = true; }
    if (keys['ArrowDown'] || keys['s']) { camera.y -= SPEED; moved = true; }
    if (moved) updateTiles();
  });
}

/* ===================================================
   INIT
   =================================================== */
function init() {
  createTiles();
  updateTiles();
  initDrag();
  initScroll();
  initFilters();
  initRouting();
  initKeyboard();
  playLoader();
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
