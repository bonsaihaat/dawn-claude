(function () {
  function startTypewriter(input) {
    if (input.dataset.typewriterInit) return;
    input.dataset.typewriterInit = 'true';

    var overlay = input.parentElement && input.parentElement.querySelector('[data-typewriter-text]');
    var overlayWrapper = overlay && overlay.parentElement;

    var raw = input.getAttribute('data-placeholder-phrases');
    if (!raw) return;

    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (!Array.isArray(parsed)) return;

    var phrases = parsed
      .map(function (phrase) {
        return String(phrase).trim();
      })
      .filter(function (phrase) {
        return phrase.length > 0;
      });
    if (phrases.length === 0) return;

    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (phrases.length === 1 || reducedMotion) {
      input.setAttribute('placeholder', phrases[0]);
      if (overlayWrapper) overlayWrapper.hidden = true;
      return;
    }

    var TYPE_SPEED = 55;
    var DELETE_SPEED = 30;
    var HOLD_DELAY = 1600;
    var NEXT_DELAY = 400;

    // Phrases usually share a leading phrase like "Search for " (and often
    // more, e.g. "Search for Bonsai "). Keep that shared part static and
    // only animate the part that actually differs between phrases, instead
    // of retyping the whole string every cycle. Degrades gracefully to the
    // old whole-phrase behavior if the phrases share no common prefix.
    var prefix = phrases[0];
    for (var i = 1; i < phrases.length && prefix; i++) {
      var other = phrases[i];
      var j = 0;
      while (j < prefix.length && j < other.length && prefix[j] === other[j]) j++;
      prefix = prefix.slice(0, j);
    }
    var suffixes = phrases.map(function (phrase) {
      return phrase.slice(prefix.length);
    });

    // The overlay draws the animated text (with a real blinking caret, which
    // browsers can't render inside a placeholder attribute); the input's own
    // placeholder is cleared so it doesn't show doubled-up text behind it,
    // and kept as a static fallback if the overlay isn't present in the DOM.
    if (overlay) {
      input.setAttribute('placeholder', '');
      // :placeholder-shown can't tell us this (the placeholder is blank on
      // purpose), so track "has a value" ourselves to hide the overlay once
      // the visitor actually types something.
      var syncOverlayVisibility = function () {
        overlayWrapper.hidden = input.value.length > 0;
      };
      syncOverlayVisibility();
      input.addEventListener('input', syncOverlayVisibility);
    } else {
      input.setAttribute('placeholder', prefix + suffixes[0]);
    }

    function render(text) {
      if (overlay) {
        overlay.textContent = text;
      } else {
        input.setAttribute('placeholder', text);
      }
    }

    var phraseIndex = 0;
    var charIndex = 0;
    var deleting = false;

    function tick() {
      if (!input.isConnected) return;

      var current = suffixes[phraseIndex];

      if (!deleting) {
        charIndex += 1;
        render(prefix + current.slice(0, charIndex));

        if (charIndex === current.length) {
          deleting = true;
          window.setTimeout(tick, HOLD_DELAY);
          return;
        }
        window.setTimeout(tick, TYPE_SPEED);
        return;
      }

      charIndex -= 1;
      render(prefix + current.slice(0, charIndex));

      if (charIndex === 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % suffixes.length;
        window.setTimeout(tick, NEXT_DELAY);
        return;
      }
      window.setTimeout(tick, DELETE_SPEED);
    }

    window.setTimeout(tick, NEXT_DELAY);
  }

  function init(root) {
    var scope = root || document;
    var inputs = scope.querySelectorAll('input[data-placeholder-phrases]');
    inputs.forEach(startTypewriter);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
    });
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', function (event) {
    init(event.target);
  });
})();
