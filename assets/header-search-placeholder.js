(function () {
  function startTypewriter(input) {
    var raw = input.getAttribute('data-placeholder-phrases');
    if (!raw) return;

    var phrases;
    try {
      phrases = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (!Array.isArray(phrases) || phrases.length === 0) return;

    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (phrases.length === 1 || reducedMotion) {
      input.setAttribute('placeholder', phrases[0]);
      return;
    }

    var TYPE_SPEED = 55;
    var DELETE_SPEED = 30;
    var HOLD_DELAY = 1600;
    var NEXT_DELAY = 400;

    var phraseIndex = 0;
    var charIndex = 0;
    var deleting = false;

    function tick() {
      var current = phrases[phraseIndex];

      if (!deleting) {
        charIndex += 1;
        input.setAttribute('placeholder', current.slice(0, charIndex));

        if (charIndex === current.length) {
          deleting = true;
          window.setTimeout(tick, HOLD_DELAY);
          return;
        }
        window.setTimeout(tick, TYPE_SPEED);
        return;
      }

      charIndex -= 1;
      input.setAttribute('placeholder', current.slice(0, charIndex));

      if (charIndex === 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        window.setTimeout(tick, NEXT_DELAY);
        return;
      }
      window.setTimeout(tick, DELETE_SPEED);
    }

    window.setTimeout(tick, NEXT_DELAY);
  }

  function init() {
    var inputs = document.querySelectorAll('input[data-placeholder-phrases]');
    inputs.forEach(startTypewriter);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
