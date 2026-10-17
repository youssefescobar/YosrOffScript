/* ===================================================
   ABOUT — panel open/close + photo colour hover
   =================================================== */
import gsap from 'gsap';
import { aboutPanel, aboutClose, isTouchUi } from './state.js';
import { closeAboutRoute } from './router.js';

// Assigned inside initAbout; the router calls these on every About route change.
let openImpl = () => {};
let closeImpl = () => {};
export const openAbout = () => openImpl();
export const closeAbout = () => closeImpl();

export function initAbout() {
  const headerName = document.querySelector('.header__name');
  const photoWrap = document.querySelector('.about-panel__photo-wrap');
  const photoStack = document.querySelector('.about-panel__photo-stack');
  const photo = photoStack || document.querySelector('.about-panel__photo');
  const aboutCard = document.getElementById('about-card');

  function getAboutTarget() {
    return document.getElementById('about-name');
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
      .to(
        aboutName,
        { x: 0, y: 0, scale: 1, opacity: 1, duration: openDuration, ease: 'expo.inOut' },
        0
      )
      .to(
        headerName,
        { ...morph(hRect, aRect), opacity: 0, duration: openDuration, ease: 'expo.inOut' },
        0
      )
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

    gsap.set([headerName, aboutName], {
      transformOrigin: '0% 50%',
      willChange: 'transform, opacity',
    });
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
      .to(
        aboutName,
        { ...morph(aRect, hRect), opacity: 0, duration: closeDuration, ease: closeEase },
        0
      )
      .to(
        headerName,
        { x: 0, y: 0, scale: 1, opacity: 1, duration: closeDuration, ease: closeEase },
        0
      )
      .to(backdrop, { opacity: 0, duration: isMobile ? 0.45 : 0.8, ease: 'power2.inOut' }, 0);

    if (isMobile && aboutCard) {
      aboutTl.to(
        aboutCard,
        { opacity: 0, scale: 0.92, y: 40, duration: 0.45, ease: 'power2.in' },
        0
      );
    }
  }

  openImpl = openAbout;
  closeImpl = closeAbout;

  aboutClose.addEventListener('click', (e) => {
    e.preventDefault();
    closeAboutRoute();
  });
}
