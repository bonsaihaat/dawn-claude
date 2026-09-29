(function () {
  var root = document.querySelector('[data-bh-plp]');
  if (!root) return;
  var sectionId = root.getAttribute('data-section-id');
  var shopRoot = window.Shopify && Shopify.routes ? Shopify.routes.root : '/';
  var pending;

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
    scope.querySelectorAll('[data-bh-wish]').forEach(function (b) {
      var on = false;
      try { on = !!localStorage.getItem('bh-wish-' + b.getAttribute('data-bh-wish')); } catch (e) {}
      b.setAttribute('aria-pressed', String(on));
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
    var sheetBody = root.querySelector('[data-bh-sheet-body]');
    var sheetScroll = sheetBody ? sheetBody.scrollTop : 0;
    return fetchSection(url)
      .then(function (fresh) {
        if (!fresh) { window.location.href = url; return; }
        root.innerHTML = fresh.innerHTML;
        var body = root.querySelector('[data-bh-sheet-body]');
        if (body) body.scrollTop = sheetScroll;
        syncWishlist(root);
        revealActiveChip();
        if (push) window.history.pushState({ bhPlp: true }, '', url);
      })
      .catch(function (err) { if (err.name !== 'AbortError') window.location.href = url; })
      .finally(function () { root.classList.remove('is-loading'); });
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
      more.textContent = 'Loading…';
      fetchSection(more.href).then(function (fresh) {
        var grid = root.querySelector('[data-bh-grid]');
        var freshGrid = fresh && fresh.querySelector('[data-bh-grid]');
        if (!grid || !freshGrid) { window.location.href = more.href; return; }
        while (freshGrid.firstElementChild) grid.appendChild(freshGrid.firstElementChild);
        syncWishlist(grid);
        var wrap = more.parentElement;
        var next = fresh.querySelector('[data-bh-more]');
        if (next) { more.href = next.href; more.textContent = 'Load more'; } else { wrap.remove(); }
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
      var key = 'bh-wish-' + wish.getAttribute('data-bh-wish');
      var on = wish.getAttribute('aria-pressed') !== 'true';
      wish.setAttribute('aria-pressed', String(on));
      try { on ? localStorage.setItem(key, '1') : localStorage.removeItem(key); } catch (err) {}
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
          add.textContent = 'Added ✓';
          add.classList.add('is-added');
          return fetch(shopRoot + 'cart.js').then(function (r) { return r.json(); });
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

  root.addEventListener('change', function (e) {
    var sort = e.target.closest('[data-bh-sort]');
    if (!sort) return;
    var u = new URL(window.location.href);
    u.searchParams.set('sort_by', sort.value);
    u.searchParams.delete('page');
    render(u.toString(), true);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') root.classList.remove('is-sheet-open');
  });

  window.addEventListener('popstate', function () {
    render(window.location.href, false);
  });

  syncWishlist(root);
  revealActiveChip();
})();
