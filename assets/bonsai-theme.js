(function () {
  // iOS Safari only applies :active (press feedback) when a touch listener exists
  document.addEventListener('touchstart', function () {}, { passive: true });

  // Scroll reveals: each item fades up once it is itself well inside the viewport;
  // items that arrive together (a row of cards, a swipe) are staggered in order
  if (document.documentElement.classList.contains('bh-anim')) {
    var revealObserver = new IntersectionObserver(function (entries) {
      var batch = new Map(); // stagger counter per group, so groups arriving together start in parallel
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        // A "group" (the sliding trust strip) reveals all its items at once, including off-screen ones
        var items = entry.target.hasAttribute('data-bh-reveal') ? entry.target.querySelectorAll('[data-bh-reveal-item]') : [entry.target];
        // In a sideways-swiping row (mobile), reveal the whole row at once so cards don't fade in mid-swipe
        var row = entry.target.parentNode;
        if (!entry.target.hasAttribute('data-bh-reveal') && row.scrollWidth > row.clientWidth) {
          items = Array.prototype.filter.call(row.children, function (child) { return !child.classList.contains('is-revealed'); });
          items.forEach(function (child) { revealObserver.unobserve(child); });
        }
        Array.prototype.forEach.call(items, function (item) {
          var i = batch.get(item.parentNode) || 0;
          batch.set(item.parentNode, i + 1);
          item.style.setProperty('--bh-i', Math.min(i, 5));
          item.classList.add('is-revealed');
        });
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.25, rootMargin: '0px 0px -20% 0px' });

    document.querySelectorAll('[data-bh-reveal="group"], [data-bh-reveal]:not([data-bh-reveal="group"]) > *').forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  // Sideways rows with arrow buttons (desktop): arrows show only when the row overflows,
  // move one page of cards, and dim at either end
  document.querySelectorAll('[data-bh-scroller]').forEach(function (row) {
    var arrows = row.previousElementSibling && row.previousElementSibling.querySelector('[data-bh-scroll-arrows]');
    if (!arrows) return;
    var prev = arrows.querySelector('[data-bh-scroll-prev]');
    var next = arrows.querySelector('[data-bh-scroll-next]');
    function update() {
      var max = row.scrollWidth - row.clientWidth;
      arrows.hidden = max <= 1;
      prev.disabled = row.scrollLeft <= 1;
      next.disabled = row.scrollLeft >= max - 1;
    }
    function page(dir) {
      var card = row.firstElementChild;
      var step = card ? card.getBoundingClientRect().width + parseFloat(getComputedStyle(row).columnGap || 0) : row.clientWidth;
      row.scrollBy({ left: dir * step * Math.max(1, Math.floor((row.clientWidth + 1) / step)), behavior: 'smooth' });
    }
    prev.addEventListener('click', function () { page(-1); });
    next.addEventListener('click', function () { page(1); });
    row.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

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

    // Hero carousel: 5s autoplay (matches the dot fill in bonsai-theme.css), restarted on manual navigation
    var slides = root.querySelectorAll('[data-bh-slide]');
    var dots = root.querySelectorAll('[data-bh-dot]');
    var active = 0;
    var autoplay;

    function goTo(i) {
      if (!slides.length) return;
      active = (i + slides.length) % slides.length;
      slides.forEach(function (s, idx) {
        s.classList.toggle('is-active', idx === active);
        s.classList.toggle('is-zoomed', idx === active);
      });
      dots.forEach(function (d, idx) {
        d.classList.toggle('is-active', idx === active);
        // Restart the progress fill even when the same dot stays active
        if (idx === active && d.getAnimations) {
          d.getAnimations({ subtree: true }).forEach(function (a) { a.currentTime = 0; });
        }
      });
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
    // Start the first slide's push-in after it has painted at its resting scale
    if (slides.length) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { slides[active].classList.add('is-zoomed'); });
      });
    }

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

  // Header search panel: the search pill opens it, results come from Shopify's predictive search
  // rendered through sections/bonsai-predictive-search.liquid. No backdrop; a click outside closes it.
  document.querySelectorAll('[data-bh-ps]').forEach(function (panel) {
    var root = panel.closest('.bh--header') || panel.parentNode;
    var input = panel.querySelector('[data-bh-ps-input]');
    var results = panel.querySelector('[data-bh-ps-results]');
    var pills = root.querySelectorAll('[data-bh-ps-open]');
    var desktop = window.matchMedia('(min-width: 820px)');
    var baseUrl = panel.getAttribute('data-bh-ps-url') || '/search/suggest';
    var openerPill = null;
    var timer, controller, lastTerm = '';

    function place() {
      if (!desktop.matches || !openerPill) { panel.style.top = panel.style.left = ''; return; }
      var r = openerPill.getBoundingClientRect();
      var rootRect = root.getBoundingClientRect();
      var width = panel.offsetWidth;
      var left = r.left + r.width / 2 - width / 2 - rootRect.left;
      left = Math.max(16, Math.min(left, rootRect.width - width - 16));
      panel.style.top = (r.bottom - rootRect.top + 8) + 'px';
      panel.style.left = left + 'px';
    }
    function open(pill) {
      openerPill = pill;
      panel.hidden = false;
      pills.forEach(function (p) { p.setAttribute('aria-expanded', 'true'); });
      if (!desktop.matches) document.documentElement.style.overflow = 'hidden';
      place();
      input.focus();
    }
    function close() {
      if (panel.hidden) return;
      panel.hidden = true;
      pills.forEach(function (p) { p.setAttribute('aria-expanded', 'false'); });
      document.documentElement.style.overflow = '';
      if (openerPill && desktop.matches) openerPill.focus();
    }
    function render(html, term) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var content = doc.querySelector('[data-bh-ps-content]');
      results.innerHTML = content ? content.innerHTML : '';
      panel.classList.toggle('no-results', !!results.querySelector('.bh-ps__none'));
      lastTerm = term;
    }
    function search() {
      var term = input.value.trim();
      panel.classList.toggle('has-query', term.length > 0);
      if (!term) {
        if (controller) controller.abort();
        results.innerHTML = '';
        panel.classList.remove('is-loading', 'no-results');
        lastTerm = '';
        return;
      }
      if (term === lastTerm) return;
      if (controller) controller.abort();
      controller = new AbortController();
      panel.classList.add('is-loading');
      var url = baseUrl + '?q=' + encodeURIComponent(term) +
        '&resources[type]=query,product,collection,page&resources[limit]=6&resources[limit_scope]=each' +
        '&resources[options][prefix]=last&section_id=bonsai-predictive-search';
      fetch(url, { signal: controller.signal })
        .then(function (res) { return res.ok ? res.text() : Promise.reject(res.status); })
        .then(function (html) { render(html, term); panel.classList.remove('is-loading'); })
        .catch(function (err) { if (!err || err.name !== 'AbortError') panel.classList.remove('is-loading'); });
    }

    pills.forEach(function (pill) {
      pill.addEventListener('click', function (e) {
        e.preventDefault();
        open(pill);
      });
    });
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(search, 200);
    });
    panel.querySelectorAll('[data-bh-ps-close]').forEach(function (el) {
      el.addEventListener('click', close);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
    document.addEventListener('click', function (e) {
      if (panel.hidden || panel.contains(e.target)) return;
      if (e.target.closest && e.target.closest('[data-bh-ps-open]')) return;
      close();
    });
    window.addEventListener('resize', function () {
      if (panel.hidden) return;
      document.documentElement.style.overflow = desktop.matches ? '' : 'hidden';
      place();
    });
  });
})();
