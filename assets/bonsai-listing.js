(function () {
  var root = document.querySelector('[data-bh-plp]');
  if (!root) return;
  var sectionId = root.getAttribute('data-section-id');
  var shopRoot = window.Shopify && Shopify.routes ? Shopify.routes.root : '/';
  var pending;
  // Set once "Load more" has added products, so leaving the page saves them for Back.
  var extended = false;
  var SNAPSHOT_KEY = 'bh-plp-snapshot';
  var SNAPSHOT_MAX_AGE = 30 * 60 * 1000;
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, calm ? 0 : ms); });
  }

  // Thin loading bar along the top of the window while filters and sort load
  var bar = document.createElement('div');
  bar.className = 'bh-plp-bar';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  function barStart() {
    bar.classList.remove('is-done', 'is-running');
    void bar.offsetWidth; // restart from empty
    bar.classList.add('is-running');
  }
  function barDone() {
    bar.classList.remove('is-running');
    bar.classList.add('is-done');
  }

  // Swap in fresh results inside a view transition, so cards glide to their new places.
  // The first few photos get a moment to decode, so arriving cards don't fade in empty.
  function transition(update) {
    // Skipped under the open mobile sheet: the moving cards would be drawn on top of it
    if (calm || !document.startViewTransition || root.classList.contains('is-sheet-open')) {
      update();
      return Promise.resolve();
    }
    return document.startViewTransition(function () {
      update();
      var imgs = Array.prototype.slice.call(root.querySelectorAll('.bh-plp-card__img img:not(.bh-plp-card__alt)'), 0, 8);
      return Promise.race([
        Promise.all(imgs.map(function (img) { return img.decode ? img.decode().catch(function () {}) : null; })),
        wait(300),
      ]);
    }).updateCallbackDone;
  }

  function sectionUrl(url) {
    var u = new URL(url, window.location.href);
    u.searchParams.set('section_id', sectionId);
    return u.toString();
  }

  function fetchSection(url) {
    if (pending) pending.abort();
    pending = new AbortController();
    return fetch(sectionUrl(url), { signal: pending.signal })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        return new DOMParser().parseFromString(html, 'text/html').querySelector('[data-bh-plp]');
      });
  }

  function syncWishlist(scope) {
    if (!window.bhWishlist) return;
    scope.querySelectorAll('[data-bh-wish]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(bhWishlist.has(b.getAttribute('data-bh-wish'))));
    });
  }

  function revealActiveChip() {
    var chip = root.querySelector('.bh-plp__chip.is-active');
    if (!chip) return;
    var row = chip.parentElement;
    var overflow = chip.getBoundingClientRect().right - row.getBoundingClientRect().right;
    if (overflow > 0) row.scrollLeft += overflow + 20;
  }

  function render(url, push) {
    root.classList.add('is-loading');
    barStart();
    var sheetBody = root.querySelector('[data-bh-sheet-body]');
    var sheetScroll = sheetBody ? sheetBody.scrollTop : 0;
    var request = fetchSection(url);
    var mine = pending;
    return request
      .then(function (fresh) {
        if (!fresh) { window.location.href = url; return; }
        return transition(function () {
          root.innerHTML = fresh.innerHTML;
          root.classList.remove('is-loading');
          var body = root.querySelector('[data-bh-sheet-body]');
          if (body) body.scrollTop = sheetScroll;
          syncWishlist(root);
          revealActiveChip();
          extended = false;
          if (push) window.history.pushState({ bhPlp: true }, '', url);
        });
      })
      .catch(function (err) { if (err.name !== 'AbortError') window.location.href = url; })
      .finally(function () {
        // A newer request aborted this one and is still loading: leave the bar running for it
        if (pending !== mine) return;
        root.classList.remove('is-loading');
        barDone();
      });
  }

  root.addEventListener('click', function (e) {
    var nav = e.target.closest('[data-bh-nav]');
    if (nav) {
      e.preventDefault();
      render(nav.href, true);
      return;
    }

    var more = e.target.closest('[data-bh-more]');
    if (more) {
      e.preventDefault();
      if (more.getAttribute('aria-busy') === 'true') return;
      more.setAttribute('aria-busy', 'true');
      more.textContent = 'Loading';
      fetchSection(more.href)
        .then(function (fresh) {
          var grid = root.querySelector('[data-bh-grid]');
          var freshGrid = fresh && fresh.querySelector('[data-bh-grid]');
          if (!grid || !freshGrid) { window.location.href = more.href; return; }
          var firstNew = freshGrid.firstElementChild;
          var n = 0;
          while (freshGrid.firstElementChild) {
            var card = freshGrid.firstElementChild;
            card.classList.add('is-arriving');
            card.style.setProperty('--bh-i', Math.min(n++, 7));
            card.addEventListener('animationend', function (ev) { ev.currentTarget.classList.remove('is-arriving'); }, { once: true });
            grid.appendChild(card);
          }
          syncWishlist(grid);
          extended = true;
          var wrap = more.closest('[data-bh-more-wrap]');
          var freshWrap = fresh.querySelector('[data-bh-more-wrap]');
          var range = wrap.querySelector('[data-bh-range]');
          if (range) {
            var start = Number(range.getAttribute('data-start'));
            var end = start - 1 + grid.children.length;
            var total = range.getAttribute('data-total');
            range.textContent = start > 1 ? 'Showing ' + start + '–' + end + ' of ' + total : 'Showing ' + end + ' of ' + total;
          }
          var next = freshWrap && freshWrap.querySelector('[data-bh-more]');
          if (next) {
            more.href = next.href;
            more.textContent = 'Load more';
            more.removeAttribute('aria-busy');
          } else {
            more.remove();
          }
          var link = firstNew && firstNew.querySelector('.bh-plp-card__info');
          if (link) link.focus({ preventScroll: true });
        })
        .catch(function (err) {
          if (err.name === 'AbortError') return;
          more.removeAttribute('aria-busy');
          more.textContent = 'Couldn’t load — try again';
        });
      return;
    }

    if (e.target.closest('[data-bh-sheet-open]')) {
      root.classList.add('is-sheet-open');
      return;
    }
    if (e.target.closest('[data-bh-sheet-close]')) {
      root.classList.remove('is-sheet-open');
      return;
    }

    var wish = e.target.closest('[data-bh-wish]');
    if (wish) {
      if (!window.bhWishlist) return;
      var on = bhWishlist.toggle(wish.getAttribute('data-bh-wish'), wish.getAttribute('data-bh-wish-handle'));
      wish.setAttribute('aria-pressed', String(on));
      if (on && !calm) {
        wish.classList.remove('is-popping');
        void wish.offsetWidth;
        wish.classList.add('is-popping');
        if (window.bhLeafBurst) window.bhLeafBurst(wish.closest('.bh-plp-card'), wish);
      }
      return;
    }

    var add = e.target.closest('[data-bh-add]');
    if (add && !add.classList.contains('is-added') && add.getAttribute('aria-busy') !== 'true') {
      add.setAttribute('aria-busy', 'true');
      fetch(shopRoot + 'cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [{ id: Number(add.getAttribute('data-bh-add')), quantity: 1 }] }),
      })
        .then(function (r) {
          return r.json().then(function (body) {
            if (!r.ok) throw new Error(body.description || body.message || 'Could not add');
          });
        })
        .then(function () {
          add.removeAttribute('aria-busy');
          add.innerHTML = '<svg class="bh-plp-card__tick" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path pathLength="1" d="M4 12.5L9.5 18L20 6" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>Added';
          add.classList.add('is-added');
          // Let the tick finish drawing before the cart drawer slides over
          return Promise.all([fetch(shopRoot + 'cart.js').then(function (r) { return r.json(); }), wait(550)]);
        })
        .then(function (results) {
          return results[0];
        })
        .then(function (cart) {
          document.querySelectorAll('.bh-badge').forEach(function (b) { b.textContent = cart.item_count; });
          document.dispatchEvent(new CustomEvent('bh:cart:added'));
        })
        .catch(function (err) {
          add.textContent = err.message;
          setTimeout(function () { add.textContent = 'Add to cart'; }, 2500);
        })
        .finally(function () { add.removeAttribute('aria-busy'); });
    }
  });

  // Range sliders (Price, Size): two range inputs share one track, with typed Min/Max boxes underneath.
  // The sidebar and the mobile sheet each carry a copy, so everything works from the one
  // that was touched. Dragging only moves the handles; results load once a handle is let go.
  function priceParts(box) {
    return {
      lo: box.querySelector('[data-bh-price-lo]'),
      hi: box.querySelector('[data-bh-price-hi]'),
      loInput: box.querySelector('[data-bh-price-lo-input]'),
      hiInput: box.querySelector('[data-bh-price-hi-input]'),
      ceil: Number(box.getAttribute('data-ceil')),
    };
  }

  function priceDraw(box, lo, hi) {
    var p = priceParts(box);
    box.style.setProperty('--lo', (lo / p.ceil) * 100 + '%');
    box.style.setProperty('--hi', (hi / p.ceil) * 100 + '%');
    // With both handles at the top end, the low one has to sit above the high one to be draggable
    box.classList.toggle('is-lo-top', lo > p.ceil / 2);
  }

  function priceApply(box, lo, hi) {
    var p = priceParts(box);
    var u = new URL(box.getAttribute('data-base'), window.location.href);
    u.searchParams.delete('page');
    // Size: Shopify filters a number field by exact values, so pick every size inside the range
    var valuesParam = box.getAttribute('data-values-param');
    if (valuesParam) {
      u.searchParams.delete(valuesParam);
      var values = JSON.parse(box.getAttribute('data-values') || '[]');
      var picked = values.filter(function (x) { return x.n >= lo && x.n <= hi; });
      // A range that takes in every size here is no filter at all
      if (picked.length < values.length) {
        // Nothing that size here: take the size nearest the middle of the range rather than show nothing
        if (!picked.length && values.length) {
          var mid = (lo + hi) / 2;
          picked = [values.reduce(function (a, b) { return Math.abs(b.n - mid) < Math.abs(a.n - mid) ? b : a; })];
        }
        picked.forEach(function (x) { u.searchParams.append(valuesParam, x.v); });
      }
      if (u.toString() === window.location.href) return;
      render(u.toString(), true);
      return;
    }
    u.searchParams.delete(box.getAttribute('data-min-param'));
    u.searchParams.delete(box.getAttribute('data-max-param'));
    if (lo > 0) u.searchParams.set(box.getAttribute('data-min-param'), lo);
    if (hi < p.ceil) u.searchParams.set(box.getAttribute('data-max-param'), hi);
    if (u.toString() === window.location.href) return;
    render(u.toString(), true);
  }

  root.addEventListener('input', function (e) {
    var box = e.target.closest('[data-bh-price]');
    if (!box || e.target.type !== 'range') return;
    var p = priceParts(box);
    var lo = Number(p.lo.value);
    var hi = Number(p.hi.value);
    // Handles can meet but not cross
    if (lo > hi) {
      if (e.target === p.lo) p.lo.value = lo = hi;
      else p.hi.value = hi = lo;
    }
    p.loInput.value = lo;
    p.hiInput.value = hi;
    priceDraw(box, lo, hi);
  });

  root.addEventListener('change', function (e) {
    var box = e.target.closest('[data-bh-price]');
    if (box) {
      var p = priceParts(box);
      var lo, hi;
      if (e.target.type === 'range') {
        lo = Number(p.lo.value);
        hi = Number(p.hi.value);
      } else {
        // Price rounds typed amounts to whole rupees, Size to the nearest half inch
        var unit = Number(box.getAttribute('data-round')) || 1;
        lo = Math.round((Number(p.loInput.value) || 0) / unit) * unit;
        hi = p.hiInput.value === '' ? p.ceil : Math.round((Number(p.hiInput.value) || 0) / unit) * unit;
        lo = Math.min(Math.max(lo, 0), p.ceil);
        hi = Math.min(Math.max(hi, 0), p.ceil);
        if (lo > hi) {
          if (e.target === p.loInput) lo = hi;
          else hi = lo;
        }
        p.loInput.value = lo;
        p.hiInput.value = hi;
        p.lo.value = lo;
        p.hi.value = hi;
        priceDraw(box, lo, hi);
      }
      priceApply(box, lo, hi);
      return;
    }

    var sort = e.target.closest('[data-bh-sort]');
    if (!sort) return;
    var u = new URL(window.location.href);
    u.searchParams.set('sort_by', sort.value);
    u.searchParams.delete('page');
    render(u.toString(), true);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') root.classList.remove('is-sheet-open');
    // Enter in a typed Min/Max box applies it, the same as leaving the box
    if (e.key === 'Enter' && e.target.closest && e.target.closest('[data-bh-price]') && e.target.type === 'number') e.target.blur();
  });

  window.addEventListener('popstate', function () {
    render(window.location.href, false);
  });

  function pageKey() {
    return window.location.pathname + window.location.search;
  }

  function saveSnapshot() {
    try {
      if (!extended) { sessionStorage.removeItem(SNAPSHOT_KEY); return; }
      var grid = root.querySelector('[data-bh-grid]');
      var wrap = root.querySelector('[data-bh-more-wrap]');
      if (!grid) return;
      var copy = grid.cloneNode(true);
      copy.querySelectorAll('.is-arriving').forEach(function (c) { c.classList.remove('is-arriving'); });
      copy.querySelectorAll('.bh-leaves').forEach(function (l) { l.remove(); });
      copy.querySelectorAll('.bh-plp-card__cart.is-added').forEach(function (b) {
        b.classList.remove('is-added');
        b.textContent = 'Add to cart';
      });
      sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
        key: pageKey(),
        time: Date.now(),
        grid: copy.innerHTML,
        wrap: wrap ? wrap.outerHTML : '',
        scrollY: window.scrollY,
      }));
    } catch (e) {}
  }

  // Coming back with the browser's Back button: put back the products that
  // "Load more" had added and the scroll position. Pages restored whole from
  // the back/forward cache never re-run this script and need nothing.
  function restoreSnapshot() {
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (!nav || nav.type !== 'back_forward') return;
    var snap;
    try { snap = JSON.parse(sessionStorage.getItem(SNAPSHOT_KEY)); } catch (e) { return; }
    if (!snap || snap.key !== pageKey() || Date.now() - snap.time > SNAPSHOT_MAX_AGE) return;
    var grid = root.querySelector('[data-bh-grid]');
    if (!grid) return;
    grid.innerHTML = snap.grid;
    var wrap = root.querySelector('[data-bh-more-wrap]');
    if (wrap && snap.wrap) wrap.outerHTML = snap.wrap;
    else if (wrap) wrap.remove();
    extended = true;
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, snap.scrollY);
  }

  window.addEventListener('pagehide', saveSnapshot);

  // Hearts changed in another tab
  document.addEventListener('bh:wishlist:change', function (e) {
    if (e.detail && e.detail.external) syncWishlist(root);
  });

  restoreSnapshot();
  syncWishlist(root);
  revealActiveChip();
})();
