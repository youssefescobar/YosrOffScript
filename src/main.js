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
const projectPanel = document.getElementById('project-panel');
const projectClose = document.getElementById('project-close');
const projectInner = document.getElementById('project-inner');
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
let GAP = 6;
const LERP = 0.08;
const DRAG_MULT = 1.8;
const CLICK_THRESHOLD = 6;  // px — movement below this = click, above = drag

/* Fisheye config */
const FISHEYE_ROT_X = 25;    // reduced to keep items facing forward
const FISHEYE_ROT_Y = 35;    // reduced to reduce horizontal gaps
const FISHEYE_Z     = 150;   // reduced from 450 to keep outer items closer
const FISHEYE_SCALE = 0.85;  // scale down slightly at edges to counteract perspective bloat
const FISHEYE_DIM   = 0.5;   // keep outer items a bit brighter

// Tile size presets (varying aspect ratios)
let TILE_SIZES = [];

function computeSizes() {
  const isMobile = window.innerWidth <= 768;
  GAP = isMobile ? 3 : 6;
  
  if (isMobile) {
    TILE_SIZES = [
      { w: 120, h: 90 },
      { w: 90, h: 120 },
      { w: 100, h: 100 },
      { w: 140, h: 90 },
      { w: 90, h: 140 },
      { w: 110, h: 80 },
      { w: 130, h: 100 },
      { w: 100, h: 100 },
    ];
  } else {
    TILE_SIZES = [
      { w: 220, h: 160 },
      { w: 180, h: 240 },
      { w: 200, h: 200 },
      { w: 260, h: 170 },
      { w: 170, h: 260 },
      { w: 200, h: 150 },
      { w: 240, h: 180 },
      { w: 180, h: 180 },
    ];
  }
}
computeSizes();

const worldSize = { w: 0, h: 0 };

/* ===================================================
   1.  BUILD THE GRID
   =================================================== */
function buildGrid() {
  computeSizes();

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const avgTileW = TILE_SIZES[0].w;
  const avgTileH = TILE_SIZES[0].h;
  const baseCols = Math.ceil(vw / (avgTileW + GAP)) + 3;
  const baseRows = Math.ceil(vh / (avgTileH + GAP)) + 3;

  canvas.innerHTML = '';
  tiles = [];

  for (let r = 0; r < baseRows; r++) {
    for (let c = 0; c < baseCols; c++) {
      const idx = (r * baseCols + c) % PROJECTS.length;
      const proj = PROJECTS[idx];
      const w = TILE_SIZES[c % TILE_SIZES.length].w;
      const h = TILE_SIZES[r % TILE_SIZES.length].h;

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
        baseX: 0,
        baseY: 0,
        w,
        h,
        animScale: 1, // Add for GSAP animations
        screenX: 0,
        screenY: 0,
      });
    }
  }

  tileCountEl.textContent = `${PROJECTS.length} Projects`;
  layoutGrid(false);
}

/* ===================================================
   1b. LAYOUT GRID
   =================================================== */
function layoutGrid(animate = false) {
  const visibleTiles = tiles.filter(t => activeFilter === 'all' || t.project.category === activeFilter);
  const hiddenTiles = tiles.filter(t => activeFilter !== 'all' && t.project.category !== activeFilter);

  // Hide non-matching
  hiddenTiles.forEach(t => {
    t.el.style.pointerEvents = 'none'; // prevent clicks while fading out
    if (animate) {
      gsap.to(t, { animScale: 0, duration: 1.2, ease: 'expo.inOut' });
      gsap.to(t.el, { opacity: 0, duration: 1.2, ease: 'expo.inOut' });
    } else {
      t.animScale = 0;
      t.el.style.opacity = 0;
    }
  });

  if (visibleTiles.length === 0) return;

  const N = visibleTiles.length;
  let aspect = window.innerWidth / window.innerHeight;
  if (window.innerWidth <= 768) aspect *= 1.5; // force more columns on mobile
  
  let cols = Math.ceil(Math.sqrt(N * aspect));
  if (cols < 2) cols = 2; // ensure at least 2 columns
  const rows = Math.ceil(N / cols);

  const colWidths = [];
  const rowHeights = [];
  for (let c = 0; c < cols; c++) colWidths.push(TILE_SIZES[c % TILE_SIZES.length].w);
  for (let r = 0; r < rows; r++) rowHeights.push(TILE_SIZES[r % TILE_SIZES.length].h);

  const colX = [0];
  for (let c = 1; c < cols; c++) colX.push(colX[c - 1] + colWidths[c - 1] + GAP);
  const rowY = [0];
  for (let r = 1; r < rows; r++) rowY.push(rowY[r - 1] + rowHeights[r - 1] + GAP);

  const contentW = colX[cols - 1] + colWidths[cols - 1] + GAP;
  const contentH = rowY[rows - 1] + rowHeights[rows - 1] + GAP;

  const targetWorldW = Math.max(contentW, window.innerWidth);
  const targetWorldH = Math.max(contentH, window.innerHeight);

  const offsetX = (targetWorldW - contentW) / 2;
  const offsetY = (targetWorldH - contentH) / 2;

  // Center the view on the new grid & animate bounds
  if (animate) {
    gsap.to(worldSize, { w: targetWorldW, h: targetWorldH, duration: 1.5, ease: 'expo.inOut' });
    gsap.to(state, { targetX: 0, targetY: 0, duration: 1.5, ease: 'expo.inOut' });
  } else {
    worldSize.w = targetWorldW;
    worldSize.h = targetWorldH;
    state.targetX = 0;
    state.targetY = 0;
    state.currentX = 0;
    state.currentY = 0;
  }

  visibleTiles.forEach((t, i) => {
    t.el.style.pointerEvents = 'auto';
    const r = Math.floor(i / cols);
    const c = i % cols;
    
    const targetX = colX[c] + offsetX;
    const targetY = rowY[r] + offsetY;
    const targetW = colWidths[c];
    const targetH = rowHeights[r];

    t.w = targetW;
    t.h = targetH;

    if (animate) {
      gsap.to(t, { baseX: targetX, baseY: targetY, animScale: 1, duration: 1.5, ease: 'expo.inOut' });
      gsap.to(t.el, { width: targetW, height: targetH, opacity: 1, duration: 1.5, ease: 'expo.inOut' });
    } else {
      t.baseX = targetX;
      t.baseY = targetY;
      t.animScale = 1;
      t.el.style.width = `${targetW}px`;
      t.el.style.height = `${targetH}px`;
      t.el.style.opacity = 1;
    }
  });
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
      // Toroidal wrapping
      let x = ((t.baseX + state.currentX) % worldSize.w + worldSize.w) % worldSize.w;
      let y = ((t.baseY + state.currentY) % worldSize.h + worldSize.h) % worldSize.h;
      if (x > worldSize.w - t.w) x -= worldSize.w;
      if (y > worldSize.h - t.h) y -= worldSize.h;

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

      // Scale: shrink at edges, multiplied by animation scale
      const baseScale = 1 + (FISHEYE_SCALE - 1) * distSq;
      const finalScale = baseScale * (t.animScale !== undefined ? t.animScale : 1);

      // Brightness dimming at edges
      const brightness = 1 + (FISHEYE_DIM - 1) * distSq;

      t.el.style.transform =
        `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)
         translateZ(${zPush.toFixed(1)}px)
         rotateY(${rotY.toFixed(2)}deg)
         rotateX(${rotX.toFixed(2)}deg)
         scale(${finalScale.toFixed(4)})`;

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
    totalDist = 0; // Reset here so it clears properly even if we click a header link!
    if (e.target.closest('.header, .footer, .about-panel, .project-panel')) return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    lastX = e.clientX;
    lastY = e.clientY;
    dragTarget = e.target.closest('.tile');
    viewport.setPointerCapture(e.pointerId);
    // Removed e.preventDefault() to allow native clicks, focus, and text selection
  });

  // --- Block native clicks if we dragged ---
  viewport.addEventListener('click', (e) => {
    if (totalDist >= CLICK_THRESHOLD) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, { capture: true });

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
  if (!projectPanel) return;
  projectInner.innerHTML = `
    <img class="project-panel__img" src="${project.img}" alt="${project.title}" />
    <h2 class="project-panel__title">${project.title}</h2>
    <div class="project-panel__category">${project.category}</div>
  `;
  projectPanel.classList.add('is-open');
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
   5.  LOADER & PRELOADER
   =================================================== */
function preloadAssets() {
  const images = PROJECTS.map(p => p.img);
  let loadedCount = 0;
  const total = images.length;
  
  const progressEl = document.getElementById('loader-progress');
  const ctaEl = document.getElementById('loader-cta');
  
  // Pre-hide items for dramatic entrance
  gsap.set('.header__nav', { opacity: 0, y: -30 });
  gsap.set('.footer', { opacity: 0, y: 30 });
  gsap.set('.header__left', { opacity: 0 });

  tiles.forEach(t => {
    t.animScale = 0;
    t.el.style.opacity = 0;
  });

  const tl = gsap.timeline({ defaults: { ease: 'expo.out', duration: 1.2 } });

  tl.to('.loader__line > span', { y: '0%', stagger: 0.12, duration: 1 })
    .to('.loader__tagline > span', { y: '0%', duration: 0.8 }, '-=0.5')
    .to(progressEl, { opacity: 1, duration: 0.5 }, '-=0.3');

  let isReady = false;

  function checkReady() {
    if (loadedCount >= total && !isReady) {
      isReady = true;
      document.fonts.ready.then(() => {
        // Wait for intro timeline to finish so we don't conflict
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
      }
    });
  }

  if (total === 0) {
    checkReady();
  } else {
    images.forEach(src => {
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

  // Any click/scroll clears the loader
  const obs = Observer.create({
    target: window,
    type: 'pointer,wheel,touch',
    onPress: dismiss,
    onUp: dismiss,
    onWheel: dismiss
  });
  
  // Also dismiss if they click the CTA
  ctaEl.addEventListener('click', dismiss);

  function dismiss() {
    if (loaderDone) return;
    loaderDone = true;
    
    // Clean up observer
    obs.kill();

    // Activate viewport FIRST so layout is fully calculated for accurate FLIP measurements
    viewport.classList.add('is-active');

    const loaderName = document.querySelector('.loader__name');
    const loaderText = document.querySelector('.loader__line');
    const headerName = document.querySelector('.header__name');

    // Elevate header above the fading loader background so it doesn't get obscured
    gsap.set('.header', { zIndex: 101 });

    // Fade out tagline, CTA, progress, and loader background
    gsap.to(['.loader__tagline', '.loader__cta', '.loader__progress'], { opacity: 0, duration: 0.5 });
    gsap.to(loader, { backgroundColor: 'rgba(0,0,0,0)', duration: 1.2, ease: 'power2.inOut' });
    
    // Get exact starting bounds from the inline text element, NOT the block container
    const lRect = loaderText.getBoundingClientRect();
    
    // Temporarily make header left visible to get true destination bounds
    gsap.set('.header__left', { opacity: 1 });
    const hRect = headerName.getBoundingClientRect();

    // Lock the left edge ('Y') and vertical center
    gsap.set([loaderText, headerName], { transformOrigin: '0% 50%' });
    
    const lRefX = lRect.left;
    const lRefY = lRect.top + lRect.height / 2;
    const hRefX = hRect.left;
    const hRefY = hRect.top + hRect.height / 2;

    // HeaderName starts huge, anchored to the left of LoaderText, and invisible
    const headerStartScale = lRect.height / hRect.height;
    const headerStartX = lRefX - hRefX;
    const headerStartY = lRefY - hRefY;
    gsap.set(headerName, { 
      x: headerStartX, 
      y: headerStartY, 
      scale: headerStartScale,
      opacity: 0 
    });

    // LoaderText shrinks and flies to HeaderName's position
    const loaderTargetScale = hRect.height / lRect.height;
    const loaderTargetX = hRefX - lRefX;
    const loaderTargetY = hRefY - lRefY;

    // Crossfade them smoothly along the exact same trajectory
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
      }
    });

    gsap.to(loaderText, {
      x: loaderTargetX,
      y: loaderTargetY,
      scale: loaderTargetScale,
      opacity: 0,
      duration: 1.2,
      ease: 'expo.inOut'
    });

    // Tiles pop in from the center!
    gsap.to(tiles, {
      animScale: 1,
      duration: 1.5,
      stagger: { amount: 0.8, from: 'center' },
      ease: 'back.out(1.5)',
      delay: 0.3
    });
    
    gsap.to(tiles.map(t => t.el), {
      opacity: 1,
      duration: 1.5,
      stagger: { amount: 0.8, from: 'center' },
      ease: 'power2.out',
      delay: 0.3
    });

    // Reveal header nav and footer smoothly
    gsap.to(['.header__nav', '.footer'], {
      y: 0,
      opacity: 1,
      duration: 1.2,
      stagger: 0.2,
      ease: 'expo.out',
      delay: 0.6
    });
  }
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
      
      layoutGrid(true); // Animate layout
    });
  });
}

/* ===================================================
   7.  ROUTING
   =================================================== */
function initRouting() {
  let aboutAnimated = false;
  let photoTiltActive = false;

  const headerName = document.querySelector('.header__name');
  const aboutName = document.getElementById('about-name');
  const photoWrap = document.querySelector('.about-panel__photo-wrap');
  const photo = document.querySelector('.about-panel__photo');

  // --- 3D photo tilt on mouse move ---
  function onPhotoMove(e) {
    if (!photoTiltActive || !photoWrap) return;
    const rect = photoWrap.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;   // 0..1
    const y = (e.clientY - rect.top) / rect.height;    // 0..1
    const rotY = (x - 0.5) * 20;   // -10 to +10 deg
    const rotX = (0.5 - y) * 20;   // -10 to +10 deg
    gsap.to(photo, {
      rotateX: rotX,
      rotateY: rotY,
      duration: 0.4,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  }

  function onPhotoLeave() {
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

    // --- Crossfade FLIP (same technique as loader → header) ---
    // Both elements share transformOrigin: '0% 50%' so they scale from the left edge

    // 1. Measure header name (the "source")
    const hRect = headerName.getBoundingClientRect();

    // 2. Temporarily show panel to measure about name (the "destination")
    aboutPanel.style.visibility = 'visible';
    aboutPanel.style.opacity = '0';
    aboutPanel.style.transition = 'none';
    gsap.set(aboutName, { opacity: 1, x: 0, y: 0, scale: 1 });
    const aRect = aboutName.getBoundingClientRect();

    // 3. Lock transform origins
    gsap.set([headerName, aboutName], { transformOrigin: '0% 50%' });

    // Reference points (left edge, vertical center)
    const hRefX = hRect.left;
    const hRefY = hRect.top + hRect.height / 2;
    const aRefX = aRect.left;
    const aRefY = aRect.top + aRect.height / 2;

    // 4. aboutName starts at headerName's position/size (scaled up from header)
    const aboutStartScale = hRect.height / aRect.height;
    const aboutStartX = hRefX - aRefX;
    const aboutStartY = hRefY - aRefY;
    gsap.set(aboutName, {
      x: aboutStartX,
      y: aboutStartY,
      scale: aboutStartScale,
      opacity: 0,
    });

    // 5. headerName will shrink and fly TO aboutName's position
    const headerTargetScale = aRect.height / hRect.height;
    const headerTargetX = aRefX - hRefX;
    const headerTargetY = aRefY - hRefY;

    // 6. Pre-set photo and reveals
    gsap.set(photo, { scale: 1.3, clipPath: 'inset(100% 0% 0% 0%)' });
    const reveals = aboutPanel.querySelectorAll('.about-reveal');
    gsap.set(reveals, { opacity: 0, y: 25 });

    // 7. Open the panel
    aboutPanel.style.removeProperty('visibility');
    aboutPanel.style.removeProperty('opacity');
    aboutPanel.style.removeProperty('transition');
    aboutPanel.classList.add('is-open');

    // 8. Crossfade: aboutName grows in, headerName shrinks out (same path)
    gsap.to(aboutName, {
      x: 0, y: 0, scale: 1, opacity: 1,
      duration: 1.2, ease: 'expo.inOut',
    });

    gsap.to(headerName, {
      x: headerTargetX, y: headerTargetY, scale: headerTargetScale, opacity: 0,
      duration: 1.2, ease: 'expo.inOut',
      onComplete: () => {
        gsap.set(headerName, { clearProps: 'transform' });
        // opacity stays 0 — header name stays hidden while about is open
      }
    });

    // Photo: clip-path wipe reveal + zoom out
    gsap.to(photo, {
      scale: 1, clipPath: 'inset(0% 0% 0% 0%)',
      duration: 1.4, ease: 'expo.inOut', delay: 0.1,
    });

    // Staggered reveal for the rest
    gsap.to(reveals, {
      opacity: 1, y: 0,
      duration: 1, stagger: 0.1, ease: 'expo.out', delay: 0.4,
    });
  }

  function closeAbout() {
    photoTiltActive = false;

    if (!aboutAnimated) {
      aboutPanel.classList.remove('is-open');
      return;
    }
    aboutAnimated = false;

    // --- Reverse crossfade FLIP ---
    // 1. Measure both positions
    const aRect = aboutName.getBoundingClientRect();

    // We need the header's natural position — temporarily restore it
    gsap.set(headerName, { clearProps: 'transform,opacity' });
    gsap.set(headerName, { opacity: 1 });
    const hRect = headerName.getBoundingClientRect();

    // Lock transform origins
    gsap.set([headerName, aboutName], { transformOrigin: '0% 50%' });

    // Reference points
    const hRefX = hRect.left;
    const hRefY = hRect.top + hRect.height / 2;
    const aRefX = aRect.left;
    const aRefY = aRect.top + aRect.height / 2;

    // 2. headerName starts at aboutName's position/size (scaled up)
    const headerStartScale = aRect.height / hRect.height;
    const headerStartX = aRefX - hRefX;
    const headerStartY = aRefY - hRefY;
    gsap.set(headerName, {
      x: headerStartX,
      y: headerStartY,
      scale: headerStartScale,
      opacity: 0,
    });

    // 3. aboutName will shrink and fly TO headerName's position
    const aboutTargetScale = hRect.height / aRect.height;
    const aboutTargetX = hRefX - aRefX;
    const aboutTargetY = hRefY - aRefY;

    // 4. Fade out reveals and photo
    const reveals = aboutPanel.querySelectorAll('.about-reveal');
    gsap.to(reveals, { opacity: 0, y: -15, duration: 0.4, ease: 'power2.in' });
    gsap.to(photo, {
      clipPath: 'inset(0% 0% 100% 0%)', scale: 1.1,
      duration: 0.6, ease: 'power2.in',
    });

    // 5. Crossfade: aboutName shrinks out, headerName grows in (same path)
    gsap.to(aboutName, {
      x: aboutTargetX, y: aboutTargetY, scale: aboutTargetScale, opacity: 0,
      duration: 1.2, ease: 'expo.inOut',
    });

    gsap.to(headerName, {
      x: 0, y: 0, scale: 1, opacity: 1,
      duration: 1.2, ease: 'expo.inOut',
      onComplete: () => {
        gsap.set(headerName, { clearProps: 'transform' });
        // Clean up about panel — skip CSS transition, hide instantly
        aboutPanel.style.transition = 'none';
        aboutPanel.classList.remove('is-open');
        gsap.set(aboutName, { opacity: 0, clearProps: 'x,y,scale,transformOrigin' });
        gsap.set(photo, { clearProps: 'clipPath,scale,rotateX,rotateY' });
        gsap.set(reveals, { opacity: 0, y: 25 });
        gsap.set(backdrop, { clearProps: 'opacity' });
        // Re-enable transition for next open
        requestAnimationFrame(() => {
          aboutPanel.style.removeProperty('transition');
        });
      }
    });

    // 6. Fade out backdrop
    const backdrop = aboutPanel.querySelector('.about-panel__backdrop');
    gsap.to(backdrop, { opacity: 0, duration: 0.8, ease: 'power2.inOut' });
  }

  function handleHash() {
    const hash = window.location.hash || '#portfolio';
    header.querySelectorAll('.header__link').forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === hash);
    });

    if (hash === '#about') {
      openAbout();
    } else {
      closeAbout();
    }
  }

  window.addEventListener('hashchange', handleHash);
  handleHash();

  // Click backdrop to close
  aboutClose.addEventListener('click', () => { window.location.hash = '#portfolio'; });

  if (projectClose) {
    projectClose.addEventListener('click', () => { projectPanel.classList.remove('is-open'); });
  }
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
  preloadAssets();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
