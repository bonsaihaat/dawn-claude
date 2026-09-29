(function () {
  var root = document.querySelector('[data-bh-cart]');
  if (!root) return;
  var sectionId = root.getAttribute('data-section-id');
  var shopRoot = window.Shopify && Shopify.routes ? Shopify.routes.root : '/';
  var queue = Promise.resolve();

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
    var fresh = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-bh-cart]');
    if (!fresh) return;
    var hadItems = root.classList.contains('has-items');
    var hasItems = fresh.classList.contains('has-items');
    if (hadItems !== hasItems) {
      root.className = fresh.className;
      root.innerHTML = fresh.innerHTML;
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
    document.querySelectorAll('.bh-badge').forEach(function (b) { b.textContent = data.item_count; });
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
    if (!isNaN(max)) qty = Math.min(qty, max);
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
      setPinMsg('');
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

  // Delivery check: asks the courier lookup URL when one is set, otherwise
  // shows the estimate window from the section settings.
  function setPinMsg(text) {
    var el = root.querySelector('[data-bh-pin-msg]');
    if (!el) return;
    el.textContent = text;
    el.hidden = !text;
  }

  function estimate() {
    var min = parseInt(root.getAttribute('data-delivery-min'), 10) || 4;
    var max = Math.max(min, parseInt(root.getAttribute('data-delivery-max'), 10) || min);
    var d = new Date();
    d.setDate(d.getDate() + Math.round((min + max) / 2));
    var when = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    var span = min === max ? String(min) : min + '–' + max;
    return 'Delivers in ' + span + ' days · by ' + when;
  }

  function checkPincode(pin) {
    if (!/^[1-9][0-9]{5}$/.test(pin)) { setPinMsg('Please enter a valid 6-digit pincode.'); return; }
    var url = root.getAttribute('data-delivery-url');
    if (!url) { setPinMsg(estimate()); return; }
    setPinMsg('Checking…');
    var u = new URL(url, window.location.href);
    u.searchParams.set('pincode', pin);
    fetch(u.toString(), { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.message) setPinMsg(res.message);
        else setPinMsg(res.deliverable ? estimate() : 'Sorry, we don’t deliver to ' + pin + ' yet.');
      })
      .catch(function () { setPinMsg(estimate()); });
  }
})();
