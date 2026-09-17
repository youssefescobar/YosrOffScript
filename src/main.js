/* ===================================================
   MAIN — Infinite Wrapping 2D Canvas + Fisheye Distortion
   
   - Grid wraps in both X and Y (toroidal topology)
   - Fisheye barrel distortion: edges/corners curve inward
   - Dragging works ON tiles (not just gaps)
   - Click vs drag distinction: only opens project on clean click
   =================================================== */
import gsap from 'gsap';
import { Observer } from 'gsap/Observer';
import PROJECTS from './projects.js';

gsap.registerPlugin(Observer);

/* ---------- DOM refs ---------- */
const loader      = document.getElementById('loader');
const viewport    = document.getElementById('viewport');
const canvas      = document.getElementById('canvas');
const tileCountEl = document.getElementById('tile-count');
const aboutPanel  = document.getElementById('about-panel');
const aboutClose  = document.getElementById('about-close');
const header      = document.getElementById('header');

/* ---------- State ---------- */
const state = {
  targetX:  0,
  targetY:  0,
  currentX: 0,
  currentY: 0,
};

let tiles = [];
let activeFilter = 'all';
let loaderDone = false;

/* ---------- Grid config ---------- */
const GAP = 6;
const LERP = 0.08;
const DRAG_MULT = 1.8;
const CLICK_THRESHOLD = 6;  // px — movement below this = click, above = drag

/* Fisheye config */
const FISHEYE_ROT_X = 55;    // max rotateX at top/bottom edges (degrees)
const FISHEYE_ROT_Y = 65;    // max rotateY at left/right edges (degrees)
const FISHEYE_Z     = 450;   // positive Z = curves TOWARDS viewer at edges (inside sphere)
const FISHEYE_SCALE = 0.8;   // scale down slightly at edges to counteract perspective bloat
const FISHEYE_DIM   = 0.3;   // min brightness at extreme edges

// Tile size presets (varying aspect ratios)
const TILE_SIZES = [
  { w: 220, h: 160 },
  { w: 180, h: 240 },
  { w: 200, h: 200 },
  { w: 260, h: 170 },
  { w: 170, h: 260 },
  { w: 200, h: 150 },
  { w: 240, h: 180 },
  { w: 180, h: 180 },
];

let worldW = 0;
let worldH = 0;

/* ===================================================
   1.  BUILD THE GRID
   =================================================== */
function buildGrid() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const avgTileW = 210;
  const avgTileH = 200;
  const cols = Math.ceil(vw / (avgTileW + GAP)) + 3;
  const rows = Math.ceil(vh / (avgTileH + GAP)) + 3;

  canvas.innerHTML = '';
  tiles = [];

  const colWidths = [];
  const rowHeights = [];
  for (let c = 0; c < cols; c++) colWidths.push(TILE_SIZES[c % TILE_SIZES.length].w);
  for (let r = 0; r < rows; r++) rowHeights.push(TILE_SIZES[r % TILE_SIZES.length].h);

  const colX = [0];
  for (let c = 1; c < cols; c++) colX.push(colX[c - 1] + colWidths[c - 1] + GAP);
  const rowY = [0];
  for (let r = 1; r < rows; r++) rowY.push(rowY[r - 1] + rowHeights[r - 1] + GAP);

  worldW = colX[cols - 1] + colWidths[cols - 1] + GAP;
  worldH = rowY[rows - 1] + rowHeights[rows - 1] + GAP;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = (r * cols + c) % PROJECTS.length;
      const proj = PROJECTS[idx];
      const w = colWidths[c];
      const h = rowHeights[r];

      const el = document.createElement('div');
      el.className = 'tile';
      el.setAttribute('data-category', proj.category);
      el.setAttribute('data-project-id', proj.id);
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.innerHTML = `
        <img class="tile__img" src="${proj.img}" alt="${proj.title}" loading="lazy" draggable="false" />
        <div class="tile__overlay">
          <div class="tile__title">${proj.title}</div>
          <div class="tile__category">${proj.category}</div>
        </div>
      `;

      canvas.appendChild(el);

      tiles.push({
        el,
        project: proj,
        baseX: colX[c],
        baseY: rowY[r],
        w,
        h,
        // Screen position (updated each frame)
        screenX: 0,
        screenY: 0,
      });
    }
  }

  tileCountEl.textContent = `${PROJECTS.length} Projects`;
}

/* ===================================================
   2.  RENDER LOOP — wrapping + fisheye distortion
   =================================================== */
function startRenderLoop() {
  const halfW = () => window.innerWidth / 2;
  const halfH = () => window.innerHeight / 2;

  gsap.ticker.add(() => {
    state.currentX += (state.targetX - state.currentX) * LERP;
    state.currentY += (state.targetY - state.currentY) * LERP;

    const hw = halfW();
    const hh = halfH();

    tiles.forEach((t) => {
      if (t.el.classList.contains('is-hidden')) {
        t.el.style.visibility = 'hidden';
        return;
      }
      t.el.style.visibility = 'visible';

      // Toroidal wrapping
      let x = ((t.baseX + state.currentX) % worldW + worldW) % worldW;
      let y = ((t.baseY + state.currentY) % worldH + worldH) % worldH;
      if (x > worldW - t.w) x -= worldW;
      if (y > worldH - t.h) y -= worldH;

      t.screenX = x;
      t.screenY = y;

      // --- Fisheye distortion ---
      // Tile center in screen space
      const cx = x + t.w / 2;
      const cy = y + t.h / 2;

      // Normalized distance from viewport center (-1 to 1)
      const nx = (cx - hw) / hw;
      const ny = (cy - hh) / hh;

      // Clamped for tiles partially off-screen
      const cnx = Math.max(-1.3, Math.min(1.3, nx));
      const cny = Math.max(-1.3, Math.min(1.3, ny));

      // Distance from center (0 at center, ~1.41 at corners)
      const dist = Math.sqrt(cnx * cnx + cny * cny);

      // Barrel distortion curves (ease-in: stronger at edges)
      const distSq = dist * dist;

      // Rotations: tiles at left edge rotate right (positive Y), right edge rotate left
      const rotY = -cnx * FISHEYE_ROT_Y * Math.abs(cnx);  // quadratic curve
      const rotX = cny * FISHEYE_ROT_X * Math.abs(cny);

      // Z push-back: corners go further back
      const zPush = FISHEYE_Z * distSq;

      // Scale: shrink at edges
      const scale = 1 + (FISHEYE_SCALE - 1) * distSq;

      // Brightness dimming at edges
      const brightness = 1 + (FISHEYE_DIM - 1) * distSq;

      t.el.style.transform =
        `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)
         translateZ(${zPush.toFixed(1)}px)
         rotateY(${rotY.toFixed(2)}deg)
         rotateX(${rotX.toFixed(2)}deg)
         scale(${scale.toFixed(4)})`;

      // Apply brightness via filter (combines with grayscale)
      t.el.querySelector('.tile__img').style.filter =
        `grayscale(0.85) brightness(${(0.65 * brightness).toFixed(3)}) contrast(1.05)`;
    });
  });
}

/* ===================================================
   3.  INPUT — drag on ANYTHING (tiles + gaps)
       Click vs drag: only opens project if pointer
       barely moved (below CLICK_THRESHOLD).
   =================================================== */
function initInput() {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let totalDist = 0;  // total movement during this drag
  let dragTarget = null;

  // --- Pointer down: start drag from anywhere ---
  viewport.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.header, .footer, .about-panel')) return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    lastX = e.clientX;
    lastY = e.clientY;
    totalDist = 0;
    dragTarget = e.target.closest('.tile');
    viewport.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  // --- Pointer move: always drag the canvas ---
  viewport.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    totalDist += Math.abs(dx) + Math.abs(dy);

    state.targetX += dx * DRAG_MULT;
    state.targetY += dy * DRAG_MULT;
  });

  // --- Pointer up: click vs drag ---
  viewport.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    isDragging = false;

    // If barely moved → it's a click
    if (totalDist < CLICK_THRESHOLD && dragTarget) {
      const projId = dragTarget.getAttribute('data-project-id');
      const proj = PROJECTS.find((p) => p.id === Number(projId));
      if (proj) {
        handleProjectClick(proj, dragTarget);
      }
    }

    dragTarget = null;
  });

  viewport.addEventListener('pointercancel', () => {
    isDragging = false;
    dragTarget = null;
  });

  // --- Wheel ---
  Observer.create({
    target: viewport,
    type: 'wheel',
    onChange(self) {
      state.targetX -= self.deltaX * 1.0;
      state.targetY -= self.deltaY * 1.0;
    },
    preventDefault: true,
  });
}

/* ===================================================
   3b. PROJECT CLICK HANDLER
   =================================================== */
function handleProjectClick(project, tileEl) {
  console.log(`Open project: ${project.title}`);
  // Flash the tile to confirm the click
  gsap.fromTo(tileEl, 
    { boxShadow: '0 0 0px rgba(200,184,168,0)' },
    { boxShadow: '0 0 30px rgba(200,184,168,0.5)', duration: 0.3, yoyo: true, repeat: 1 }
  );
}

/* ===================================================
   4.  KEYBOARD
   =================================================== */
function initKeyboard() {
  const SPEED = 60;
  const keys = {};
  window.addEventListener('keydown', (e) => { keys[e.key] = true; });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });

  gsap.ticker.add(() => {
    if (keys['ArrowLeft']  || keys['a']) state.targetX += SPEED;
    if (keys['ArrowRight'] || keys['d']) state.targetX -= SPEED;
    if (keys['ArrowUp']    || keys['w']) state.targetY += SPEED;
    if (keys['ArrowDown']  || keys['s']) state.targetY -= SPEED;
  });
}

/* ===================================================
   5.  LOADER
   =================================================== */
function playLoader() {
  const tl = gsap.timeline({ defaults: { ease: 'expo.out', duration: 1.2 } });

  tl.to('.loader__line > span', { y: '0%', stagger: 0.12, duration: 1 })
    .to('.loader__tagline > span', { y: '0%', duration: 0.8 }, '-=0.5')
    .to('.loader__cta > span', { y: '0%', opacity: 1, duration: 0.8 }, '-=0.3');

  function dismiss() {
    if (loaderDone) return;
    loaderDone = true;
    gsap.to(loader, {
      opacity: 0, duration: 0.8, ease: 'power2.inOut',
      onComplete() { loader.style.display = 'none'; },
    });
    viewport.classList.add('is-active');
  }

  Observer.create({
    target: loader,
    type: 'wheel,touch,pointer',
    onDown: dismiss, onUp: dismiss, onWheel: dismiss,
  });
  loader.addEventListener('click', dismiss);
}

/* ===================================================
   6.  FILTERS
   =================================================== */
function initFilters() {
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      if (filter === activeFilter) return;
      activeFilter = filter;
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      tiles.forEach((t) => {
        const show = filter === 'all' || t.project.category === filter;
        t.el.classList.toggle('is-hidden', !show);
      });
    });
  });
}

/* ===================================================
   7.  ROUTING
   =================================================== */
function initRouting() {
  function handleHash() {
    const hash = window.location.hash || '#archive';
    header.querySelectorAll('.header__link').forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === hash);
    });
    aboutPanel.classList.toggle('is-open', hash === '#about');
  }
  window.addEventListener('hashchange', handleHash);
  handleHash();
  aboutClose.addEventListener('click', () => { window.location.hash = '#archive'; });
}

/* ===================================================
   8.  RESIZE
   =================================================== */
function initResize() {
  let timer;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(buildGrid, 200);
  });
}

/* ===================================================
   INIT
   =================================================== */
function init() {
  buildGrid();
  startRenderLoop();
  initInput();
  initKeyboard();
  initFilters();
  initRouting();
  initResize();
  playLoader();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
