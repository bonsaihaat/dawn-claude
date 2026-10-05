(function () {
  document.querySelectorAll('[data-bh-pdp]').forEach(function (root) {
    var currency = root.getAttribute('data-currency') || 'INR';
    var money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency, maximumFractionDigits: 0 });
    var fmt = function (cents) { return money.format(cents / 100); };

    // Gallery
    var slides = root.querySelectorAll('[data-bh-slide]');
    var thumbs = root.querySelectorAll('[data-bh-thumb]');
    function showImage(i) {
      slides.forEach(function (s, idx) { s.classList.toggle('is-active', idx === i); });
      thumbs.forEach(function (t, idx) { t.classList.toggle('is-active', idx === i); });
    }
    thumbs.forEach(function (t, idx) {
      t.addEventListener('click', function () { showImage(idx); });
    });

    // Quantity, variant and total
    var addBtn = root.querySelector('[data-bh-add]');
    var proxyBtn = root.querySelector('[data-bh-add-proxy]');
    var qtyEl = root.querySelector('[data-bh-qty-value]');
    var totals = root.querySelectorAll('[data-bh-total]');
    var compares = root.querySelectorAll('[data-bh-compare]');
    var saleTags = root.querySelectorAll('[data-bh-sale-tag]');
    var state = {
      qty: 1,
      price: parseInt(addBtn.getAttribute('data-price'), 10) || 0,
      compare: parseInt(addBtn.getAttribute('data-compare-price'), 10) || 0,
      variantId: addBtn.getAttribute('data-variant-id'),
      available: !addBtn.disabled,
    };

    var TICK = '<svg class="bh-pdp__tick" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path pathLength="1" d="M4 12.5L9.5 18L20 6" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function setAddLabel(label, added) {
      [addBtn, proxyBtn].forEach(function (b) {
        if (!b) return;
        // "Added" gets a tick that draws itself (bonsai-product.css)
        if (added) b.innerHTML = TICK + label;
        else b.textContent = label;
        b.classList.toggle('is-added', !!added);
        b.disabled = !state.available;
      });
    }
    function resetAdded() {
      setAddLabel(state.available ? 'Add to cart' : 'Sold out', false);
    }
    function render() {
      qtyEl.textContent = state.qty;
      var label = fmt(state.price * state.qty);
      totals.forEach(function (t) { t.textContent = label; });
      var onSale = state.compare > state.price;
      var compareLabel = fmt(state.compare * state.qty);
      compares.forEach(function (c) {
        c.hidden = !onSale;
        if (onSale) c.textContent = compareLabel;
      });
      saleTags.forEach(function (s) { s.hidden = !onSale; });
    }

    root.querySelectorAll('[data-bh-qty]').forEach(function (b) {
      b.addEventListener('click', function () {
        var next = state.qty + parseInt(b.getAttribute('data-bh-qty'), 10);
        state.qty = Math.min(10, Math.max(1, next));
        render();
        resetAdded();
      });
    });

    root.querySelectorAll('input[name="bh-variant"]').forEach(function (input) {
      input.addEventListener('change', function () {
        root.querySelectorAll('.bh-pdp__option').forEach(function (o) {
          o.classList.toggle('is-selected', o.contains(input));
        });
        state.variantId = input.value;
        state.price = parseInt(input.getAttribute('data-price'), 10) || 0;
        state.compare = parseInt(input.getAttribute('data-compare-price'), 10) || 0;
        state.available = input.getAttribute('data-available') === 'true';
        var mediaId = input.getAttribute('data-media-id');
        if (mediaId) {
          slides.forEach(function (s, idx) {
            if (s.getAttribute('data-media-id') === mediaId) showImage(idx);
          });
        }
        var url = new URL(window.location.href);
        url.searchParams.set('variant', state.variantId);
        window.history.replaceState({}, '', url.toString());
        render();
        resetAdded();
      });
    });

    function addToCart() {
      if (!state.available || addBtn.getAttribute('aria-busy') === 'true') return;
      // Both buttons (main + sticky bar) show a spinner while the item is added
      [addBtn, proxyBtn].forEach(function (b) { if (b) b.setAttribute('aria-busy', 'true'); });
      fetch((window.Shopify && Shopify.routes ? Shopify.routes.root : '/') + 'cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [{ id: Number(state.variantId), quantity: state.qty }] }),
      })
        .then(function (r) {
          return r.json().then(function (body) {
            if (!r.ok) throw new Error(body.description || body.message || 'Could not add to cart');
            return body;
          });
        })
        .then(function () {
          [addBtn, proxyBtn].forEach(function (b) { if (b) b.removeAttribute('aria-busy'); });
          setAddLabel('Added to cart', true);
          // Let the tick finish drawing before the cart drawer slides over
          return Promise.all([
            fetch((window.Shopify && Shopify.routes ? Shopify.routes.root : '/') + 'cart.js').then(function (r) { return r.json(); }),
            new Promise(function (resolve) { setTimeout(resolve, calm ? 0 : 550); }),
          ]);
        })
        .then(function (results) {
          var cart = results[0];
          document.querySelectorAll('.bh-badge').forEach(function (b) { b.textContent = cart.item_count; });
          document.dispatchEvent(new CustomEvent('bh:cart:added'));
        })
        .catch(function (err) {
          setAddLabel(err.message, false);
          setTimeout(resetAdded, 2500);
        })
        .finally(function () {
          [addBtn, proxyBtn].forEach(function (b) { if (b) b.removeAttribute('aria-busy'); });
        });
    }
    addBtn.addEventListener('click', addToCart);
    if (proxyBtn) proxyBtn.addEventListener('click', addToCart);

    // Wishlist (per-browser)
    var wish = root.querySelector('[data-bh-wish]');
    var wishKey = 'bh-wish-' + root.getAttribute('data-product-id');
    try { if (localStorage.getItem(wishKey)) wish.setAttribute('aria-pressed', 'true'); } catch (e) {}
    wish.addEventListener('click', function () {
      var on = wish.getAttribute('aria-pressed') !== 'true';
      wish.setAttribute('aria-pressed', String(on));
      try { on ? localStorage.setItem(wishKey, '1') : localStorage.removeItem(wishKey); } catch (e) {}
    });

    // Delivery estimate
    var pinForm = root.querySelector('[data-bh-pin-form]');
    var pinInput = root.querySelector('[data-bh-pin]');
    var pinMsg = root.querySelector('[data-bh-pin-msg]');
    function setPinMsg(text) {
      pinMsg.textContent = text;
      pinMsg.hidden = !text;
    }
    pinInput.addEventListener('input', function () {
      pinInput.value = pinInput.value.replace(/[^0-9]/g, '').slice(0, 6);
      setPinMsg('');
      if (!pinInput.value) window.bhDelivery.rememberPin('');
    });
    pinForm.addEventListener('submit', function (e) {
      e.preventDefault();
      checkPin(pinInput.value);
    });
    function checkPin(pin) {
      if (!/^[1-9][0-9]{5}$/.test(pin)) { setPinMsg('Please enter a valid 6-digit pincode.'); return; }
      setPinMsg('Checking…');
      window.bhDelivery.place(pin).then(function (where) {
        if (pinInput.value !== pin) return;
        if (!where) { setPinMsg('We couldn’t find pincode ' + pin + '. Please check it.'); return; }
        window.bhDelivery.rememberPin(pin);
        var label = [where.town, where.state].filter(Boolean).join(', ') || pin;
        var msg = label + ' · Arrives ' + window.bhDelivery.arrival(where.state);
        if (!where.state) setPinMsg(msg);
        else if (window.bhDelivery.region(where.state).paid) setPinMsg(msg + ' · Delivery charges apply, based on order value. You’ll see the exact amount in your cart.');
        else setPinMsg(msg + ' · Free shipping');
      });
    }
    // Start from the pincode checked last time, or the customer's saved address.
    var startPin = window.bhDelivery.savedPin(root.getAttribute('data-account-pin'));
    if (startPin) {
      pinInput.value = startPin;
      checkPin(startPin);
    }

    // Mobile sticky bar
    var sticky = root.querySelector('[data-bh-sticky]');
    var onScroll = function () { sticky.classList.toggle('is-visible', window.scrollY > 520); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    render();
  });
})();
