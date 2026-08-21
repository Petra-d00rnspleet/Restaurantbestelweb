(function () {
  "use strict";

  const configLooksUnfilled = !firebaseConfig || String(firebaseConfig.apiKey || '').includes('JOUW_');
  if (configLooksUnfilled) {
    document.getElementById('configWarning').classList.remove('hidden');
  }

  window.addEventListener('error', function (e) {
    const fatal = document.getElementById('fatalError');
    fatal.textContent = '⚠️ Er ging iets mis: ' + (e.message || 'onbekende fout') + '. Open het browserconsole (F12) voor meer details.';
    fatal.classList.remove('hidden');
  });

  let db = null;
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
  } catch (err) {
    console.error('Firebase kon niet worden gestart:', err);
    const fatal = document.getElementById('fatalError');
    fatal.textContent = '⚠️ Firebase kon niet worden gestart: ' + err.message;
    fatal.classList.remove('hidden');
  }

  // ---------------------------------------------------------
  // Elements
  // ---------------------------------------------------------
  const el = {
    viewStart: document.getElementById('view-start'),
    viewCreate: document.getElementById('view-create'),
    viewJoin: document.getElementById('view-join'),
    viewApp: document.getElementById('view-app'),

    goCreateBtn: document.getElementById('goCreateBtn'),
    goJoinBtn: document.getElementById('goJoinBtn'),
    createBackBtn: document.getElementById('createBackBtn'),
    joinBackBtn: document.getElementById('joinBackBtn'),
    createNameInput: document.getElementById('createNameInput'),
    createSubmitBtn: document.getElementById('createSubmitBtn'),
    createError: document.getElementById('createError'),
    joinCodeInput: document.getElementById('joinCodeInput'),
    joinSubmitBtn: document.getElementById('joinSubmitBtn'),
    joinError: document.getElementById('joinError'),

    restaurantNameLabel: document.getElementById('restaurantNameLabel'),
    topCodeChip: document.getElementById('topCodeChip'),
    leaveBtn: document.getElementById('leaveBtn'),
    tabbar: document.getElementById('tabbar'),

    orderProductGrid: document.getElementById('orderProductGrid'),
    cartList: document.getElementById('cartList'),
    orderNote: document.getElementById('orderNote'),
    submitOrderBtn: document.getElementById('submitOrderBtn'),

    colNieuw: document.getElementById('colNieuw'),
    colBereiden: document.getElementById('colBereiden'),
    countNieuw: document.getElementById('countNieuw'),
    countBereiden: document.getElementById('countBereiden'),

    bezorgenGrid: document.getElementById('bezorgenGrid'),

    settingsCodeDisplay: document.getElementById('settingsCodeDisplay'),
    copyCodeBtn: document.getElementById('copyCodeBtn'),
    newProductName: document.getElementById('newProductName'),
    newProductEmoji: document.getElementById('newProductEmoji'),
    emojiQuickPick: document.getElementById('emojiQuickPick'),
    addProductBtn: document.getElementById('addProductBtn'),
    manageProductsList: document.getElementById('manageProductsList'),

    toast: document.getElementById('toast'),
  };

  const QUICK_EMOJIS = ['🍕','🍔','🍟','🌭','🥪','🌮','🌯','🥗','🍝','🍜','🍣','🍤','🍗','🥩','🍳','🥞',
                         '🍩','🍪','🍰','🧁','🍦','🍨','🥤','🧋','☕','🍺','🍷','🥛','🍹','🍎'];

  let currentCode = null;
  let products = [];   // [{id, name, emoji}]
  let orders = [];      // [{id, items, note, status, createdAt, ...}]
  let cart = [];         // [{productId, name, emoji, qty}]
  let productsRef = null;
  let ordersRef = null;

  // ---------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------
  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.toast.classList.remove('show'), 2000);
  }

  function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function switchScreen(name) {
    [el.viewStart, el.viewCreate, el.viewJoin, el.viewApp].forEach(v => v.classList.add('hidden'));
    if (name === 'start') el.viewStart.classList.remove('hidden');
    if (name === 'create') el.viewCreate.classList.remove('hidden');
    if (name === 'join') el.viewJoin.classList.remove('hidden');
    if (name === 'app') el.viewApp.classList.remove('hidden');
  }

  function switchTab(tab) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('tab-' + tab).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  }

  function fmtTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ---------------------------------------------------------
  // Start / create / join navigation
  // ---------------------------------------------------------
  el.goCreateBtn.addEventListener('click', () => { el.createError.textContent = ''; switchScreen('create'); });
  el.goJoinBtn.addEventListener('click', () => { el.joinError.textContent = ''; switchScreen('join'); });
  el.createBackBtn.addEventListener('click', () => switchScreen('start'));
  el.joinBackBtn.addEventListener('click', () => switchScreen('start'));

  el.createSubmitBtn.addEventListener('click', function () {
    const name = el.createNameInput.value.trim();
    if (!name) { el.createError.textContent = 'Vul een naam in.'; return; }
    if (!db) { el.createError.textContent = 'Firebase is niet ingesteld.'; return; }
    el.createSubmitBtn.disabled = true;
    el.createError.textContent = '';
    const code = genCode();
    db.ref('restaurants/' + code).set({
      name: name,
      createdAt: Date.now()
    }).then(function () {
      enterRestaurant(code, name);
    }).catch(function (err) {
      console.error(err);
      el.createError.textContent = 'Kon geen verbinding maken. Controleer je Firebase-instellingen.';
    }).finally(function () {
      el.createSubmitBtn.disabled = false;
    });
  });

  el.joinSubmitBtn.addEventListener('click', function () {
    const code = el.joinCodeInput.value.trim().toUpperCase();
    if (!code) { el.joinError.textContent = 'Vul een code in.'; return; }
    if (!db) { el.joinError.textContent = 'Firebase is niet ingesteld.'; return; }
    el.joinSubmitBtn.disabled = true;
    el.joinError.textContent = '';
    db.ref('restaurants/' + code + '/name').get().then(function (snap) {
      if (!snap.exists()) {
        el.joinError.textContent = 'Geen restaurant gevonden met deze code.';
        return;
      }
      enterRestaurant(code, snap.val());
    }).catch(function (err) {
      console.error(err);
      el.joinError.textContent = 'Kon geen verbinding maken. Controleer je Firebase-instellingen.';
    }).finally(function () {
      el.joinSubmitBtn.disabled = false;
    });
  });

  el.leaveBtn.addEventListener('click', function () {
    if (productsRef) productsRef.off();
    if (ordersRef) ordersRef.off();
    localStorage.removeItem('restaurantCode');
    currentCode = null;
    products = [];
    orders = [];
    cart = [];
    switchScreen('start');
  });

  function enterRestaurant(code, name) {
    currentCode = code;
    localStorage.setItem('restaurantCode', code);

    el.restaurantNameLabel.textContent = name;
    el.topCodeChip.textContent = code;
    el.settingsCodeDisplay.textContent = code;

    switchScreen('app');
    switchTab('bestellen');
    attachListeners(code);
  }

  // try auto-resume ("als je al een restaurant hebt zie je dat")
  (function tryResume() {
    const code = localStorage.getItem('restaurantCode');
    if (!code || !db) { switchScreen('start'); return; }
    db.ref('restaurants/' + code + '/name').get().then(function (snap) {
      if (snap.exists()) {
        enterRestaurant(code, snap.val());
      } else {
        localStorage.removeItem('restaurantCode');
        switchScreen('start');
      }
    }).catch(function () {
      switchScreen('start');
    });
  })();

  // ---------------------------------------------------------
  // Tab switching
  // ---------------------------------------------------------
  el.tabbar.addEventListener('click', function (e) {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    switchTab(btn.dataset.tab);
  });

  // ---------------------------------------------------------
  // Realtime listeners
  // ---------------------------------------------------------
  function attachListeners(code) {
    if (productsRef) productsRef.off();
    if (ordersRef) ordersRef.off();

    productsRef = db.ref('restaurants/' + code + '/products');
    productsRef.on('value', function (snap) {
      const val = snap.val() || {};
      products = Object.keys(val).map(function (id) { return Object.assign({ id: id }, val[id]); });
      renderProductsEverywhere();
    }, function (err) { console.error('products listener error', err); });

    ordersRef = db.ref('restaurants/' + code + '/orders');
    ordersRef.on('value', function (snap) {
      const val = snap.val() || {};
      orders = Object.keys(val).map(function (id) { return Object.assign({ id: id }, val[id]); })
        .sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
      renderKitchen();
      renderBezorgen();
    }, function (err) { console.error('orders listener error', err); });
  }

  function renderProductsEverywhere() {
    renderOrderProducts();
    renderManageProducts();
    renderEmojiPicker();
  }

  // ---------------------------------------------------------
  // TAB: Bestellen
  // ---------------------------------------------------------
  function renderOrderProducts() {
    el.orderProductGrid.innerHTML = '';
    if (products.length === 0) {
      el.orderProductGrid.innerHTML = '<p class="muted">Nog geen producten. Voeg ze toe bij Instellingen.</p>';
      return;
    }
    products.forEach(function (p) {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = '<div class="emoji">' + p.emoji + '</div><div class="name">' + escapeHtml(p.name) + '</div>';
      card.addEventListener('click', function () { addToCart(p); });
      el.orderProductGrid.appendChild(card);
    });
  }

  function addToCart(product) {
    const existing = cart.find(function (c) { return c.productId === product.id; });
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ productId: product.id, name: product.name, emoji: product.emoji, qty: 1 });
    }
    renderCart();
  }

  function renderCart() {
    if (cart.length === 0) {
      el.cartList.innerHTML = '<div class="cart-empty">Nog niets toegevoegd</div>';
      el.submitOrderBtn.disabled = true;
      return;
    }
    el.submitOrderBtn.disabled = false;
    el.cartList.innerHTML = '';
    cart.forEach(function (item, idx) {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML =
        '<div class="left">' + item.emoji + ' ' + escapeHtml(item.name) + '</div>' +
        '<div class="qty-ctrl">' +
        '<button data-act="dec" data-idx="' + idx + '">−</button>' +
        '<span>' + item.qty + '</span>' +
        '<button data-act="inc" data-idx="' + idx + '">+</button>' +
        '</div>';
      el.cartList.appendChild(row);
    });
  }

  el.cartList.addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    if (btn.dataset.act === 'inc') cart[idx].qty += 1;
    if (btn.dataset.act === 'dec') {
      cart[idx].qty -= 1;
      if (cart[idx].qty <= 0) cart.splice(idx, 1);
    }
    renderCart();
  });

  el.submitOrderBtn.addEventListener('click', function () {
    if (cart.length === 0) return;
    el.submitOrderBtn.disabled = true;
    ordersRef.push({
      items: cart.map(function (c) { return { productId: c.productId, name: c.name, emoji: c.emoji, qty: c.qty }; }),
      note: el.orderNote.value.trim(),
      status: 'nieuw',
      createdAt: Date.now()
    }).then(function () {
      cart = [];
      el.orderNote.value = '';
      renderCart();
      showToast('Bestelling verstuurd naar de keuken! 🧾');
    }).catch(function (err) {
      console.error(err);
      showToast('Bestelling versturen mislukt.');
    }).finally(function () {
      el.submitOrderBtn.disabled = false;
    });
  });

  // ---------------------------------------------------------
  // TAB: Keuken
  // ---------------------------------------------------------
  function itemsHtml(order) {
    return order.items.map(function (it) {
      return '<div class="item-line"><span><span class="qty">' + it.qty + '×</span>' + it.emoji + ' ' + escapeHtml(it.name) + '</span></div>';
    }).join('');
  }

  function ticketHtml(order, actionLabel, actionEvent, actionClass) {
    return '' +
      '<div class="ticket" data-id="' + order.id + '">' +
      '<div class="time">🕐 ' + fmtTime(order.createdAt) + '</div>' +
      itemsHtml(order) +
      (order.note ? '<div class="note">💬 ' + escapeHtml(order.note) + '</div>' : '') +
      '<div class="ticket-actions">' +
      '<button class="btn ' + actionClass + ' btn-sm" data-event="' + actionEvent + '" data-id="' + order.id + '">' + actionLabel + '</button>' +
      '</div></div>';
  }

  function renderKitchen() {
    const nieuw = orders.filter(function (o) { return o.status === 'nieuw'; });
    const bereiden = orders.filter(function (o) { return o.status === 'bereiden'; });

    el.countNieuw.textContent = nieuw.length;
    el.countBereiden.textContent = bereiden.length;

    el.colNieuw.innerHTML = nieuw.length
      ? nieuw.map(function (o) { return ticketHtml(o, '▶ Start bereiden', 'start', 'btn-mustard'); }).join('')
      : '<div class="empty-col-msg">Geen nieuwe bestellingen</div>';
    el.colBereiden.innerHTML = bereiden.length
      ? bereiden.map(function (o) { return ticketHtml(o, '✅ Klaar', 'ready', 'btn-sage'); }).join('')
      : '<div class="empty-col-msg">Niets in bereiding</div>';
  }

  document.getElementById('tab-keuken').addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-event]');
    if (!btn) return;
    const id = btn.dataset.id;
    btn.disabled = true;
    let update;
    if (btn.dataset.event === 'start') update = { status: 'bereiden', startedAt: Date.now() };
    if (btn.dataset.event === 'ready') update = { status: 'klaar', readyAt: Date.now() };
    db.ref('restaurants/' + currentCode + '/orders/' + id).update(update).catch(function (err) {
      console.error(err);
      showToast('Actie mislukt.');
      btn.disabled = false;
    });
  });

  // ---------------------------------------------------------
  // TAB: Bezorgen
  // ---------------------------------------------------------
  function renderBezorgen() {
    const klaar = orders.filter(function (o) { return o.status === 'klaar'; });
    if (klaar.length === 0) {
      el.bezorgenGrid.innerHTML = '<p class="muted">Niets klaar om te bezorgen.</p>';
      return;
    }
    el.bezorgenGrid.innerHTML = klaar.map(function (o) { return ticketHtml(o, '🚚 Bezorgd', 'deliver', 'btn-teal'); }).join('');
  }

  el.bezorgenGrid.addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-event="deliver"]');
    if (!btn) return;
    const id = btn.dataset.id;
    btn.disabled = true;
    db.ref('restaurants/' + currentCode + '/orders/' + id).update({ status: 'bezorgd', deliveredAt: Date.now() })
      .then(function () { showToast('Bestelling gemarkeerd als bezorgd! ✅'); })
      .catch(function (err) {
        console.error(err);
        showToast('Actie mislukt.');
        btn.disabled = false;
      });
  });

  // ---------------------------------------------------------
  // TAB: Instellingen
  // ---------------------------------------------------------
  el.copyCodeBtn.addEventListener('click', function () {
    navigator.clipboard.writeText(currentCode).then(function () {
      showToast('Code gekopieerd!');
    }).catch(function () {
      showToast('Kon niet kopiëren, code is: ' + currentCode);
    });
  });

  function renderEmojiPicker() {
    el.emojiQuickPick.innerHTML = QUICK_EMOJIS.map(function (e) {
      return '<button type="button" data-emoji="' + e + '">' + e + '</button>';
    }).join('');
  }
  el.emojiQuickPick.addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-emoji]');
    if (!btn) return;
    el.newProductEmoji.value = btn.dataset.emoji;
    document.querySelectorAll('#emojiQuickPick button').forEach(function (b) { b.classList.remove('selected'); });
    btn.classList.add('selected');
  });

  el.addProductBtn.addEventListener('click', function () {
    const name = el.newProductName.value.trim();
    const emoji = el.newProductEmoji.value.trim();
    if (!name) { showToast('Vul een productnaam in.'); return; }
    if (!emoji) { showToast('Kies of typ een emoji.'); return; }
    el.addProductBtn.disabled = true;
    productsRef.push({ name: name, emoji: emoji, createdAt: Date.now() }).then(function () {
      el.newProductName.value = '';
      el.newProductEmoji.value = '';
      document.querySelectorAll('#emojiQuickPick button').forEach(function (b) { b.classList.remove('selected'); });
      showToast('Product toegevoegd! 🎉');
    }).catch(function (err) {
      console.error(err);
      showToast('Toevoegen mislukt.');
    }).finally(function () {
      el.addProductBtn.disabled = false;
    });
  });

  function renderManageProducts() {
    if (products.length === 0) {
      el.manageProductsList.innerHTML = '<p class="muted">Nog geen producten toegevoegd.</p>';
      return;
    }
    el.manageProductsList.innerHTML = products.map(function (p) {
      return '<div class="product-manage-row"><div class="left">' + p.emoji + ' ' + escapeHtml(p.name) + '</div>' +
        '<button class="btn btn-danger btn-sm" data-delete-product="' + p.id + '">Verwijder</button></div>';
    }).join('');
  }

  el.manageProductsList.addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-delete-product]');
    if (!btn) return;
    if (!confirm('Dit product verwijderen?')) return;
    const id = btn.dataset.deleteProduct;
    btn.disabled = true;
    db.ref('restaurants/' + currentCode + '/products/' + id).remove().catch(function (err) {
      console.error(err);
      showToast('Verwijderen mislukt.');
      btn.disabled = false;
    });
  });

})();
