// Wishlist page (sections/bonsai-wishlist.liquid). Saved items come from window.bhWishlist
// (snippets/bonsai-wishlist-store.liquid); each one's listing card is fetched with the Section
// Rendering API, in saved order, newest first.
(function () {
  var root = document.querySelector('[data-bh-wl]');
  if (!root || !window.bhWishlist) return;

  var grid = root.querySelector('[data-bh-wl-grid]');
  var empty = root.querySelector('[data-bh-wl-empty]');
  var countEl = root.querySelector('[data-bh-wl-count]');
  var errorEl = root.querySelector('[data-bh-wl-error]');
  var toast = root.querySelector('[data-bh-wl-toast]');
  var toastText = root.querySelector('[data-bh-wl-toast-text]');
  var undoBtn = root.querySelector('[data-bh-wl-undo]');
  var skeleton = root.querySelector('[data-bh-wl-skeleton]').innerHTML;
  var shopRoot = window.Shopify && Shopify.routes ? Shopify.routes.root : '/';
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var renderId = 0;
  var lastRemoved = null;
  var toastTimer;

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, calm ? 0 : ms); });
  }

  // Cards carry view-transition names, so the rest of the grid glides into place.
  // Resolves once the DOM has been updated.
  function transition(update) {
    if (calm || !document.startViewTransition) { update(); return Promise.resolve(); }
    return document.startViewTransition(update).updateCallbackDone.catch(function () {});
  }

  function setCount(n) {
    countEl.textContent = n === 1 ? '1 saved item' : n + ' saved items';
    countEl.hidden = n === 0;
  }

  function showEmpty(on) {
    empty.hidden = !on;
    grid.hidden = on;
  }

  function fetchCard(item) {
    var url = shopRoot + 'products/' + encodeURIComponent(item.handle) + '?section_id=bonsai-wishlist-card';
    return fetch(url)
      .then(function (r) {
        // Deleted or unpublished: no longer something to save
        if (r.status === 404) return { gone: true };
        if (!r.ok) return { failed: true };
        return r.text().then(function (html) {
          var card = new DOMParser().parseFromString(html, 'text/html').querySelector('.bh-plp-card');
          return card ? { card: card } : { failed: true };
        });
      })
      .catch(function () { return { failed: true }; });
  }

  function render() {
    var id = ++renderId;
    var items = bhWishlist.items();
    errorEl.hidden = true;
    setCount(items.length);
    if (!items.length) {
      grid.innerHTML = '';
      grid.removeAttribute('aria-busy');
      showEmpty(true);
      return;
    }
    showEmpty(false);
    if (!grid.querySelector('.bh-wl__skel')) {
      var html = '';
      for (var i = 0; i < Math.min(items.length, 8); i++) html += skeleton;
      grid.innerHTML = html;
    }
    grid.setAttribute('aria-busy', 'true');

    Promise.all(items.map(fetchCard)).then(function (results) {
      if (id !== renderId) return;
      var frag = document.createDocumentFragment();
      var shown = 0;
      results.forEach(function (res, i) {
        if (res.gone) { bhWishlist.remove(items[i].id); return; }
        if (!res.card) return;
        var card = res.card;
        var heart = card.querySelector('[data-bh-wish]');
        if (heart) {
          heart.setAttribute('aria-pressed', 'true');
          heart.setAttribute('aria-label', 'Remove from wishlist');
        }
        if (!calm) {
          card.classList.add('is-arriving');
          card.style.setProperty('--bh-i', Math.min(shown, 7));
          card.addEventListener('animationend', function (e) {
            if (e.target === card) card.classList.remove('is-arriving');
          });
        }
        frag.appendChild(card);
        shown++;
      });
      grid.innerHTML = '';
      grid.appendChild(frag);
      grid.removeAttribute('aria-busy');
      setCount(bhWishlist.count());
      if (!bhWishlist.count()) showEmpty(true);
      else if (shown < bhWishlist.count()) errorEl.hidden = false;
    });
  }

  function showToast(title) {
    toastText.textContent = title ? 'Removed “' + title + '”' : 'Removed from your wishlist';
    toast.hidden = false;
    // Next frame, so the slide-in plays from the hidden state
    requestAnimationFrame(function () { toast.classList.add('is-open'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 6000);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    toast.classList.remove('is-open');
    setTimeout(function () { if (!toast.classList.contains('is-open')) toast.hidden = true; }, calm ? 0 : 250);
  }

  // Keyboard focus lands on the next card's heart, or the heading when the list runs out
  function focusAfter(sibling) {
    var heart = sibling && sibling.isConnected && sibling.querySelector('[data-bh-wish]');
    if (heart) { heart.focus({ preventScroll: true }); return; }
    var target = bhWishlist.count() ? root.querySelector('[data-bh-wl-heading]') : root.querySelector('[data-bh-wl-empty-title]');
    if (target) target.focus({ preventScroll: true });
  }

  function remove(card, heart) {
    if (card.classList.contains('is-leaving')) return;
    var entry = bhWishlist.remove(heart.getAttribute('data-bh-wish'));
    if (!entry) return;
    var hadFocus = document.activeElement === heart;
    var sibling = card.nextElementSibling || card.previousElementSibling;
    var nameEl = card.querySelector('.bh-plp-card__name');
    lastRemoved = { entry: entry, card: card, index: Array.prototype.indexOf.call(grid.children, card) };
    heart.setAttribute('aria-pressed', 'false');

    function done() {
      // Undo was pressed while the card was still fading out
      if (bhWishlist.has(entry.item.id)) { card.classList.remove('is-leaving'); return; }
      transition(function () {
        card.remove();
        card.classList.remove('is-leaving');
        setCount(bhWishlist.count());
        if (!bhWishlist.count()) showEmpty(true);
      }).then(function () {
        if (hadFocus) focusAfter(sibling);
      });
    }
    if (calm) done();
    else {
      card.classList.add('is-leaving');
      wait(260).then(done);
    }
    showToast(nameEl ? nameEl.textContent.trim() : '');
  }

  undoBtn.addEventListener('click', function () {
    if (!lastRemoved) return;
    var r = lastRemoved;
    lastRemoved = null;
    bhWishlist.restore(r.entry);
    var heart = r.card.querySelector('[data-bh-wish]');
    if (heart) heart.setAttribute('aria-pressed', 'true');
    hideToast();
    transition(function () {
      showEmpty(false);
      grid.insertBefore(r.card, grid.children[r.index] || null);
      setCount(bhWishlist.count());
    }).then(function () {
      if (heart) heart.focus({ preventScroll: true });
    });
  });

  // Keep the toast up while someone is reaching for Undo
  toast.addEventListener('mouseenter', function () { clearTimeout(toastTimer); });
  toast.addEventListener('mouseleave', function () { toastTimer = setTimeout(hideToast, 3000); });
  toast.addEventListener('focusin', function () { clearTimeout(toastTimer); });
  toast.addEventListener('focusout', function () { toastTimer = setTimeout(hideToast, 3000); });

  function addToCart(add) {
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
        document.querySelectorAll('.bh-badge').forEach(function (b) { b.textContent = results[0].item_count; });
        document.dispatchEvent(new CustomEvent('bh:cart:added'));
      })
      .catch(function (err) {
        add.textContent = err.message;
        setTimeout(function () { add.textContent = 'Add to cart'; }, 2500);
      })
      .finally(function () { add.removeAttribute('aria-busy'); });
  }

  grid.addEventListener('click', function (e) {
    var heart = e.target.closest('[data-bh-wish]');
    if (heart) {
      remove(heart.closest('.bh-plp-card'), heart);
      return;
    }
    var add = e.target.closest('[data-bh-add]');
    if (add && !add.classList.contains('is-added') && add.getAttribute('aria-busy') !== 'true') addToCart(add);
  });

  // Saved or removed in another tab
  document.addEventListener('bh:wishlist:change', function (e) {
    if (e.detail && e.detail.external) render();
  });

  // Back from a product page whose heart was tapped: the restored page may be out of date
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    var shown = Array.prototype.map.call(grid.querySelectorAll('[data-bh-wish]'), function (b) {
      return b.getAttribute('data-bh-wish');
    }).join();
    var saved = bhWishlist.items().map(function (i) { return i.id; }).join();
    if (shown !== saved) render();
  });

  render();
})();
