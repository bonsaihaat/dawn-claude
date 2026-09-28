(function () {
  // Scroll reveals: stagger each group's children once it enters the viewport
  if (document.documentElement.classList.contains('bh-anim')) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px' });

    document.querySelectorAll('[data-bh-reveal]').forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (child, i) {
        child.style.setProperty('--bh-i', Math.min(i, 7));
      });
      revealObserver.observe(group);
    });
  }

  document.querySelectorAll('[data-bh]').forEach(function (root) {
    // Mobile drawer with main pane and per-category sub panes
    var subPanes = root.querySelectorAll('[data-bh-subpane]');

    function showMain() {
      root.classList.remove('is-submenu');
      subPanes.forEach(function (p) { p.classList.remove('is-active'); });
    }
    function openDrawer() {
      showMain();
      root.classList.add('is-drawer-open');
    }
    function closeDrawer() {
      root.classList.remove('is-drawer-open');
    }

    root.querySelectorAll('[data-bh-open-drawer]').forEach(function (el) {
      el.addEventListener('click', openDrawer);
    });
    root.querySelectorAll('[data-bh-close-drawer]').forEach(function (el) {
      el.addEventListener('click', closeDrawer);
    });
    root.querySelectorAll('[data-bh-open-sub]').forEach(function (el) {
      el.addEventListener('click', function () {
        var key = el.getAttribute('data-bh-open-sub');
        subPanes.forEach(function (p) {
          p.classList.toggle('is-active', p.getAttribute('data-bh-subpane') === key);
        });
        root.classList.add('is-submenu');
      });
    });
    root.querySelectorAll('[data-bh-back]').forEach(function (el) {
      el.addEventListener('click', showMain);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });

    // Hero carousel: 5s autoplay, restarted on manual navigation
    var slides = root.querySelectorAll('[data-bh-slide]');
    var dots = root.querySelectorAll('[data-bh-dot]');
    var active = 0;
    var autoplay;

    function goTo(i) {
      if (!slides.length) return;
      active = (i + slides.length) % slides.length;
      slides.forEach(function (s, idx) { s.classList.toggle('is-active', idx === active); });
      dots.forEach(function (d, idx) { d.classList.toggle('is-active', idx === active); });
    }
    function startAutoplay() {
      clearInterval(autoplay);
      if (slides.length < 2) return;
      autoplay = setInterval(function () { goTo(active + 1); }, 5000);
    }

    var prev = root.querySelector('[data-bh-prev]');
    var next = root.querySelector('[data-bh-next]');
    if (prev) prev.addEventListener('click', function () { goTo(active - 1); startAutoplay(); });
    if (next) next.addEventListener('click', function () { goTo(active + 1); startAutoplay(); });
    dots.forEach(function (d, idx) {
      d.addEventListener('click', function () { goTo(idx); startAutoplay(); });
    });
    startAutoplay();

    // Search placeholder typewriter
    var typedEls = root.querySelectorAll('[data-bh-typed]');
    var phrases = [];
    try {
      phrases = JSON.parse(root.getAttribute('data-bh-phrases') || '[]')
        .map(function (p) { return String(p).trim(); })
        .filter(Boolean);
    } catch (e) {}

    if (typedEls.length && phrases.length) {
      var t = { phraseIndex: 0, charIndex: 0, deleting: false };
      var tick = function () {
        var phrase = phrases[t.phraseIndex];
        var delay = 55;
        if (!t.deleting) {
          t.charIndex++;
          if (t.charIndex >= phrase.length) {
            t.charIndex = phrase.length;
            t.deleting = true;
            delay = 1400;
          }
        } else {
          t.charIndex--;
          delay = 30;
          if (t.charIndex <= 0) {
            t.charIndex = 0;
            t.deleting = false;
            t.phraseIndex = (t.phraseIndex + 1) % phrases.length;
            delay = 300;
          }
        }
        var text = phrase.slice(0, t.charIndex);
        typedEls.forEach(function (el) { el.textContent = text; });
        setTimeout(tick, delay);
      };
      tick();
    }
  });
})();
