(function () {
  var shopRoot = window.Shopify && Shopify.routes ? Shopify.routes.root : '/';

  // Shared by the cart page and the cart drawer: each root is one section.
  function initCart(root) {
    var sectionId = root.getAttribute('data-section-id');
    var queue = Promise.resolve();
    var keepClasses = ['is-open', 'is-note-open'];

    function post(path, body) {
      body.sections = [sectionId];
      body.sections_url = window.location.pathname;
      return fetch(shopRoot + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      }).then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) throw new Error(data.description || data.message || 'Something went wrong');
          return data;
        });
      });
    }

    // Swap the server-rendered parts that depend on cart contents, leaving
    // inputs (discount, pincode, note) and their state untouched.
    function applySection(data) {
      var html = data.sections && data.sections[sectionId];
      if (!html) { window.location.reload(); return; }
      swapIn(html);
    }

    function swapIn(html) {
      var fresh = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-bh-cart]');
      if (!fresh) return;
      var hadItems = root.classList.contains('has-items');
      var hasItems = fresh.classList.contains('has-items');
      if (hadItems !== hasItems) {
        var kept = keepClasses.filter(function (c) { return root.classList.contains(c); });
        root.className = fresh.className;
        kept.forEach(function (c) { root.classList.add(c); });
        root.innerHTML = fresh.innerHTML;
        var panel = root.querySelector('[data-bh-drawer-panel]');
        if (panel && root.classList.contains('is-open')) panel.removeAttribute('inert');
      } else {
        fresh.querySelectorAll('[data-bh-part]').forEach(function (part) {
          var mine = root.querySelector('[data-bh-part="' + part.getAttribute('data-bh-part') + '"]');
          if (mine) mine.replaceWith(part);
        });
      }
      // Lines still waiting on their own request keep their optimistic state.
      Object.keys(targets).forEach(function (key) {
        var line = lineEl(key);
        if (!line) return;
        line.classList.add('is-updating');
        if (targets[key] > 0) line.querySelector('[data-bh-qty]').textContent = targets[key];
      });
      root.setAttribute('data-count', fresh.getAttribute('data-count'));
      document.querySelectorAll('.bh-badge').forEach(function (b) { b.textContent = fresh.getAttribute('data-count'); });
      // The fee depends on the order value, so re-price it for the new cart.
      if (checkedPin) checkPincode(checkedPin);
    }

    function enqueue(task) {
      queue = queue.then(task, task);
      return queue;
    }

    // Quantity: optimistic count, one request per line at a time, sending the
    // latest target once the previous request settles.
    var targets = {};
    var busy = {};

    function lineEl(key) {
      return root.querySelector('[data-bh-line="' + CSS.escape(key) + '"]');
    }

    function showLineError(key, message) {
      var el = lineEl(key);
      var err = el && el.querySelector('[data-bh-line-error]');
      if (!err) return;
      err.textContent = message;
      err.hidden = false;
    }

    function sync(key) {
      if (busy[key]) return;
      busy[key] = true;
      var qty = targets[key];
      enqueue(function () {
        return post('cart/change.js', { id: key, quantity: qty })
          .then(function (data) {
            busy[key] = false;
            if (targets[key] !== qty) { sync(key); return; }
            delete targets[key];
            applySection(data);
          })
          .catch(function (err) {
            busy[key] = false;
            delete targets[key];
            return post('cart/update.js', {})
              .then(applySection)
              .then(function () { showLineError(key, err.message); });
          });
      });
    }

    function setQty(line, qty) {
      var key = line.getAttribute('data-bh-line');
      var max = parseInt(line.getAttribute('data-max'), 10);
      var current = currentQty(line);
      // Stock caps increases only; lowering or removing a line always goes through.
      if (!isNaN(max) && qty > current) qty = Math.min(qty, Math.max(max, current));
      qty = Math.max(0, qty);
      line.classList.add('is-updating');
      var err = line.querySelector('[data-bh-line-error]');
      if (err) err.hidden = true;
      if (qty > 0) line.querySelector('[data-bh-qty]').textContent = qty;
      var inc = line.querySelector('[data-bh-inc]');
      if (inc) inc.disabled = !isNaN(max) && qty >= max;
      targets[key] = qty;
      sync(key);
    }

    function currentQty(line) {
      var key = line.getAttribute('data-bh-line');
      return key in targets ? targets[key] : parseInt(line.getAttribute('data-qty'), 10);
    }

    // Discount codes: Shopify replaces the cart's codes with the list sent, so
    // always send the applied codes plus the new one.
    function appliedCodes() {
      return Array.prototype.map.call(root.querySelectorAll('[data-bh-discount-remove]'), function (b) {
        return b.getAttribute('data-bh-discount-remove');
      });
    }

    function setDiscountError(text) {
      var el = root.querySelector('[data-bh-discount-error]');
      if (!el) return;
      el.textContent = text;
      el.hidden = !text;
    }

    function updateDiscounts(codes, attempted) {
      return enqueue(function () {
        return post('cart/update.js', { discount: codes.join(',') })
          .then(function (data) {
            var bad = (data.discount_codes || []).filter(function (d) { return !d.applicable; });
            if (!bad.length) { applySection(data); return; }
            var good = codes.filter(function (c) {
              return !bad.some(function (d) { return d.code.toUpperCase() === c.toUpperCase(); });
            });
            return post('cart/update.js', { discount: good.join(',') }).then(function (clean) {
              applySection(clean);
              if (attempted) setDiscountError('Invalid or expired code');
            });
          })
          .catch(function (err) { setDiscountError(err.message); });
      });
    }

    root.addEventListener('click', function (e) {
      var line = e.target.closest('[data-bh-line]');
      if (line && e.target.closest('[data-bh-inc]')) { setQty(line, currentQty(line) + 1); return; }
      if (line && e.target.closest('[data-bh-dec]')) { setQty(line, Math.max(1, currentQty(line) - 1)); return; }
      if (line && e.target.closest('[data-bh-remove]')) { setQty(line, 0); return; }

      var removeCode = e.target.closest('[data-bh-discount-remove]');
      if (removeCode) {
        var code = removeCode.getAttribute('data-bh-discount-remove');
        setDiscountError('');
        updateDiscounts(appliedCodes().filter(function (c) { return c !== code; }), '');
      }
    });

    root.addEventListener('submit', function (e) {
      var discountForm = e.target.closest('[data-bh-discount-form]');
      if (discountForm) {
        e.preventDefault();
        var input = discountForm.querySelector('[data-bh-discount-input]');
        var code = input.value.trim().toUpperCase();
        if (!code) return;
        input.value = '';
        setDiscountError('');
        var codes = appliedCodes();
        if (codes.indexOf(code) === -1) codes.push(code);
        updateDiscounts(codes, code);
        return;
      }

      var pinForm = e.target.closest('[data-bh-pin-form]');
      if (pinForm) {
        e.preventDefault();
        checkPincode(pinForm.querySelector('[data-bh-pin]').value);
      }
    });

    root.addEventListener('input', function (e) {
      if (e.target.matches('[data-bh-discount-input]')) setDiscountError('');
      if (e.target.matches('[data-bh-pin]')) {
        e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
        checkedPin = '';
        setPinMsg('');
        setShipValue('');
      }
      if (e.target.matches('[data-bh-note]')) saveNote(e.target.value);
    });

    // Order note: saved as the shopper types; also submitted with checkout.
    var noteTimer;
    function saveNote(value) {
      clearTimeout(noteTimer);
      noteTimer = setTimeout(function () {
        fetch(shopRoot + 'cart/update.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ note: value }),
        });
      }, 400);
    }

    // Delivery check: finds the pincode's state, asks Shopify for this cart's
    // shipping rates there (Settings → Shipping and delivery) and, when a
    // courier lookup URL is set, whether the courier delivers to it.
    var checkedPin = '';
    function setPinMsg(text) {
      var el = root.querySelector('[data-bh-pin-msg]');
      if (!el) return;
      el.textContent = text;
      el.hidden = !text;
    }

    function estimate(state) {
      return 'Arrives ' + window.bhDelivery.arrival(state);
    }

    function setShipValue(text) {
      var el = root.querySelector('[data-bh-ship-value]');
      if (el) el.textContent = text || 'Calculated at checkout';
    }

    function courierCheck(pin) {
      var url = root.getAttribute('data-delivery-url');
      if (!url) return Promise.resolve(null);
      var u = new URL(url, window.location.href);
      u.searchParams.set('pincode', pin);
      return fetch(u.toString(), { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .catch(function () { return null; });
    }

    function checkPincode(pin) {
      checkedPin = '';
      setShipValue('');
      if (!/^[1-9][0-9]{5}$/.test(pin)) { setPinMsg('Please enter a valid 6-digit pincode.'); return; }
      checkedPin = pin;
      setPinMsg('Checking…');
      var current = function () { return checkedPin === pin; };
      var state = '';
      courierCheck(pin).then(function (courier) {
        if (!current()) return;
        if (courier && !courier.deliverable) {
          setPinMsg(courier.message || 'Sorry, we don’t deliver to ' + pin + ' yet.');
          return;
        }
        return window.bhDelivery.place(pin).then(function (where) {
          if (!current()) return;
          if (!where) { setPinMsg('We couldn’t find pincode ' + pin + '. Please check it.'); return; }
          var label = [where.town, where.state].filter(Boolean).join(', ') || pin;
          state = where.state;
          if (!where.state) { setPinMsg(label + ' · ' + estimate()); return; }
          return window.bhDelivery.rates(pin, where.state).then(function (list) {
            if (!current()) return;
            if (!list.length) { setPinMsg('Sorry, we don’t deliver to ' + label + ' yet.'); return; }
            var fee = parseFloat(list[0].price) || 0;
            var feeText = fee > 0 ? '₹' + fee.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : 'Free';
            setShipValue(feeText);
            setPinMsg(label + ' · ' + (fee > 0 ? 'Delivery ' + feeText : 'Free delivery') + ' · ' + estimate(where.state));
          });
        });
      }).catch(function () {
        if (current()) setPinMsg(estimate(state));
      });
    }

    // Re-render from the server, e.g. after an app changed the cart.
    function refresh() {
      return fetch(window.location.pathname + '?sections=' + encodeURIComponent(sectionId))
        .then(function (r) { return r.json(); })
        .then(function (data) { if (data[sectionId]) swapIn(data[sectionId]); });
    }
    document.addEventListener('bh:cart:refresh', refresh);

    if (root.hasAttribute('data-bh-drawer')) initDrawer(root, refresh);
  }

  // Drawer: opens from the header cart icon and after anything is added to the
  // cart; re-renders itself first so it always shows the current cart.
  function initDrawer(root, refresh) {
    var lastFocus;

    function open() {
      if (root.classList.contains('is-open')) return;
      lastFocus = document.activeElement;
      root.classList.add('is-open');
      root.querySelector('[data-bh-drawer-panel]').removeAttribute('inert');
      document.documentElement.classList.add('bh-no-scroll');
      var close = root.querySelector('button[data-bh-drawer-close]');
      if (close) close.focus({ preventScroll: true });
    }

    function close() {
      if (!root.classList.contains('is-open')) return;
      root.classList.remove('is-open');
      root.querySelector('[data-bh-drawer-panel]').setAttribute('inert', '');
      document.documentElement.classList.remove('bh-no-scroll');
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    }

    document.addEventListener('click', function (e) {
      var icon = e.target.closest('.bh-mh__cart, .bh-dh__cart');
      if (icon && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); open(); refresh(); }
    });
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-bh-drawer-close]')) { close(); return; }
      if (e.target.closest('[data-bh-note-toggle]')) {
        var on = root.classList.toggle('is-note-open');
        e.target.closest('[data-bh-note-toggle]').setAttribute('aria-expanded', String(on));
        if (on) root.querySelector('[data-bh-note]').focus();
      }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    document.addEventListener('bh:cart:added', function () { refresh().then(open, open); });
    document.addEventListener('bh:cart:open', function () { open(); refresh(); });
  }

  document.querySelectorAll('[data-bh-cart]').forEach(initCart);
})();
