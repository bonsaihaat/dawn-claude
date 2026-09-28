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
    var state = {
      qty: 1,
      price: parseInt(addBtn.getAttribute('data-price'), 10) || 0,
      variantId: addBtn.getAttribute('data-variant-id'),
      available: !addBtn.disabled,
    };

    function setAddLabel(label, added) {
      [addBtn, proxyBtn].forEach(function (b) {
        if (!b) return;
        b.textContent = label;
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
      addBtn.setAttribute('aria-busy', 'true');
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
          setAddLabel('Added to cart ✓', true);
          return fetch((window.Shopify && Shopify.routes ? Shopify.routes.root : '/') + 'cart.js').then(function (r) { return r.json(); });
        })
        .then(function (cart) {
          document.querySelectorAll('.bh-badge').forEach(function (b) { b.textContent = cart.item_count; });
        })
        .catch(function (err) {
          setAddLabel(err.message, false);
          setTimeout(resetAdded, 2500);
        })
        .finally(function () { addBtn.removeAttribute('aria-busy'); });
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
    var freeFrom = parseFloat(root.getAttribute('data-free-threshold')) || 0;
    var fee = parseFloat(root.getAttribute('data-shipping-fee')) || 0;
    var days = parseInt(root.getAttribute('data-delivery-days'), 10) || 4;
    function setPinMsg(text) {
      pinMsg.textContent = text;
      pinMsg.hidden = !text;
    }
    pinInput.addEventListener('input', function () {
      pinInput.value = pinInput.value.replace(/[^0-9]/g, '').slice(0, 6);
      setPinMsg('');
    });
    pinForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var pin = pinInput.value;
      if (!/^[1-9][0-9]{5}$/.test(pin)) { setPinMsg('Please enter a valid 6-digit pincode.'); return; }
      var d = new Date();
      d.setDate(d.getDate() + days);
      var when = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
      var free = (state.price * state.qty) / 100 >= freeFrom;
      setPinMsg('Delivered to ' + pin + ' by ' + when + (free ? ' · Free shipping' : ' · ' + money.format(fee) + ' shipping'));
    });

    // Accordion: one section open at a time
    var accs = root.querySelectorAll('[data-bh-acc]');
    accs.forEach(function (acc) {
      var btn = acc.querySelector('.bh-pdp__acc-btn');
      btn.addEventListener('click', function () {
        var open = !acc.classList.contains('is-open');
        accs.forEach(function (a) {
          a.classList.remove('is-open');
          a.querySelector('.bh-pdp__acc-btn').setAttribute('aria-expanded', 'false');
        });
        acc.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
      });
    });

    // Mobile sticky bar
    var sticky = root.querySelector('[data-bh-sticky]');
    var onScroll = function () { sticky.classList.toggle('is-visible', window.scrollY > 520); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    render();
  });
})();
