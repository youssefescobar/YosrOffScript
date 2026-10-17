import gsap from 'gsap';
import { getCategory } from './projects.js';
import {
  videoGrid,
  projectPanel,
  projectInner,
  viewState,
  routing,
  escapeHtml,
  escapeAttr,
} from './state.js';
import { navigate, endTransition, requestCloseDetail } from './router.js';
import { stopAllPreviews, queueIdleLoop } from './grid.js';

/* ===================================================
   4. VIDEO DETAIL OVERLAY
   =================================================== */
function findVideoCard(videoId) {
  if (!videoId || !videoGrid) return null;
  return videoGrid.querySelector(`.video-card[data-video-id="${videoId}"]`);
}

export function openVideoDetail(video, { fromRoute = false } = {}) {
  if (!projectPanel || !video) return;

  // Navigation entry point — hash drives the open
  if (!fromRoute) {
    navigate(video.path);
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

export function closeVideoDetail({ animate = true, fromRoute = false } = {}) {
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
