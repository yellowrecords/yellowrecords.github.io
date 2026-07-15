(function (global) {
  'use strict';

  var DEFAULT_SELECTORS = [
    '.contact-card-btn',
    '.film-card',
    '.film-featured-link',
    '.latest-hero-streaming a',
    '.album-dropdown',
    '.slideshow-controls .prev',
    '.slideshow-controls .next',
    '.slideshow-container > .slideshow-resume.contact-card-btn',
    '.single-chip-streaming a',
    '.album-dropdown-content .streamingicons a',
    '.album-film-btn'
  ].join(', ');

  var PROXIMITY_CLASS = 'is-proximity-hover';
  var tracked = [];
  var proximityPx = 28;
  var rafId = 0;
  var pendingX = 0;
  var pendingY = 0;
  var pointerActive = false;
  var proximityEnabled = true;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function isTrackable(el) {
    if (!el || !el.isConnected) return false;
    if (el.classList.contains('is-hidden')) return false;

    var style = global.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') {
      return false;
    }

    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function closestPointOnRect(clientX, clientY, rect) {
    return {
      x: clamp(clientX, rect.left, rect.right),
      y: clamp(clientY, rect.top, rect.bottom)
    };
  }

  function distanceToRect(clientX, clientY, rect) {
    var point = closestPointOnRect(clientX, clientY, rect);
    var dx = clientX - point.x;
    var dy = clientY - point.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function setGlowPosition(el, clientX, clientY) {
    var rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    var point = closestPointOnRect(clientX, clientY, rect);
    var x = ((point.x - rect.left) / rect.width) * 100;
    var y = ((point.y - rect.top) / rect.height) * 100;

    el.style.setProperty('--mouse-x', x + '%');
    el.style.setProperty('--mouse-y', y + '%');
  }

  function clearProximity(el) {
    el.classList.remove(PROXIMITY_CLASS);
    el.style.removeProperty('--proximity-opacity');
  }

  function collectElements(selectors) {
    var map = new Map();
    selectors.split(',').forEach(function (part) {
      var selector = part.trim();
      if (!selector) return;
      global.document.querySelectorAll(selector).forEach(function (el) {
        map.set(el, true);
      });
    });
    return Array.from(map.keys());
  }

  function bindDirectTracking(el) {
    el.addEventListener('mouseenter', onDirectPointer);
    el.addEventListener('mousemove', onDirectPointer);
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
  }

  function onDirectPointer(e) {
    setGlowPosition(e.currentTarget, e.clientX, e.clientY);
  }

  function onTouchStart(e) {
    var el = e.currentTarget;
    if (!e.touches.length) return;
    setGlowPosition(el, e.touches[0].clientX, e.touches[0].clientY);
    el.classList.add('touch-active');
  }

  function onTouchMove(e) {
    if (!e.touches.length) return;
    setGlowPosition(e.currentTarget, e.touches[0].clientX, e.touches[0].clientY);
  }

  function onTouchEnd(e) {
    e.currentTarget.classList.remove('touch-active');
  }

  function updateProximityStates() {
    rafId = 0;

    if (!pointerActive || !proximityEnabled) {
      tracked.forEach(clearProximity);
      return;
    }

    tracked.forEach(function (el) {
      if (!isTrackable(el)) {
        clearProximity(el);
        return;
      }

      var rect = el.getBoundingClientRect();
      var distance = distanceToRect(pendingX, pendingY, rect);

      if (distance > proximityPx) {
        clearProximity(el);
        return;
      }

      setGlowPosition(el, pendingX, pendingY);

      var strength = 1 - distance / proximityPx;
      strength = clamp(strength, 0.35, 1);
      el.style.setProperty('--proximity-opacity', strength.toFixed(3));
      el.classList.add(PROXIMITY_CLASS);
    });
  }

  function scheduleProximityUpdate(clientX, clientY) {
    pendingX = clientX;
    pendingY = clientY;
    pointerActive = true;
    if (!rafId) {
      rafId = global.requestAnimationFrame(updateProximityStates);
    }
  }

  function onDocumentPointerMove(e) {
    scheduleProximityUpdate(e.clientX, e.clientY);
  }

  function onDocumentPointerLeave() {
    pointerActive = false;
    if (!rafId) {
      rafId = global.requestAnimationFrame(updateProximityStates);
    }
  }

  function initFluentReveal(options) {
    options = options || {};

    if (typeof options.proximity === 'number') {
      proximityPx = options.proximity;
    } else {
      var rootStyle = global.getComputedStyle(global.document.documentElement);
      var fromCss = parseFloat(rootStyle.getPropertyValue('--fluent-proximity-radius'));
      if (!isNaN(fromCss) && fromCss > 0) {
        proximityPx = fromCss;
      }
    }

    var selectors = options.selectors || DEFAULT_SELECTORS;
    if (options.extraSelectors) {
      selectors += ', ' + options.extraSelectors;
    }

    tracked = collectElements(selectors);
    tracked.forEach(bindDirectTracking);

    if (options.proximity === false) {
      proximityEnabled = false;
      return tracked;
    }

    proximityEnabled = !global.matchMedia('(hover: none)').matches;

    if (!initFluentReveal._documentBound && proximityEnabled) {
      global.document.addEventListener('mousemove', onDocumentPointerMove, { passive: true });
      global.document.documentElement.addEventListener('mouseleave', onDocumentPointerLeave);
      initFluentReveal._documentBound = true;
    }

    return tracked;
  }

  initFluentReveal.refresh = function (options) {
    return initFluentReveal(options);
  };

  global.initFluentReveal = initFluentReveal;

  // Back-compat for pages that still call initCursorGlow
  global.initCursorGlow = function (selector) {
    return initFluentReveal({ extraSelectors: selector });
  };

  // Pause expensive background motion while the tab is hidden.
  function syncXmbPause() {
    global.document.documentElement.classList.toggle('xmb-paused', global.document.hidden);
  }
  global.document.addEventListener('visibilitychange', syncXmbPause);
  syncXmbPause();
})(window);
