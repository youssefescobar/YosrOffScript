import gsap from 'gsap';
import { Observer } from 'gsap/Observer';
import { CATEGORIES, VIDEOS } from './projects.js';
import { loader, viewport, categoryView, categoryCards } from './state.js';
import { startRouting } from './router.js';

gsap.registerPlugin(Observer);

let loaderDone = false;

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

export function preloadAssets() {
  const aboutPhotoSrcs = Array.from(document.querySelectorAll('.about-panel__photo'))
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
    return Math.min(100, (state.images * weights.images + state.fonts * weights.fonts) * 100);
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
    gsap.set([loaderText, headerName], {
      transformOrigin: '0% 50%',
      willChange: 'transform, opacity',
    });

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
        startRouting();
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
