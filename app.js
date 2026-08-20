(function () {
  "use strict";

  // ---------------------------------------------------------
  // Firebase init
  // ---------------------------------------------------------
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

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
    colKlaar: document.getElementById('colKlaar'),
    countNieuw: document.getElementById('countNieuw'),
    countBereiden: document.getElementById('countBereiden'),
    countKlaar: document.getElementById('countKlaar'),

    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    totalsTableBody: document.getElementById('totalsTableBody'),
    historyList: document.getElementById('historyList'),

    stockList: document.getElementById('stockList'),

    settingsCodeDisplay: document.getElementById('settingsCodeDisplay'),
    copyCodeBtn: document.getElementById('copyCodeBtn'),
    newProductName: document.getElementById('newProductName'),
    newProductEmoji: document.getElementById('newProductEmoji'),
    newProductIce: document.getElementById('newProductIce'),
    emojiQuickPick: document.getElementById('emojiQuickPick'),
    addProductBtn: document.getElementById('addProductBtn'),
    manageProductsList: document.getElementById('manageProductsList'),

    modalRoot: document.getElementById('modalRoot'),
    toast: document.getElementById('toast'),
  };

  const QUICK_EMOJIS = ['🍕','🍔','🍟','🌭','🥪','🌮','🌯','🥗','🍝','🍜','🍣','🍤','🍗','🥩','🍳','🥞',
                         '🍩','🍪','🍰','🧁','🍦','🍨','🥤','🧋','☕','🍺','🍷','🥤','🥛','🍹','🍎','🍟'];

  let currentCode = null;
  let currentRole = null; // 'owner' | 'guest' (informational only)
  let products = [];      // live products
  let orders = [];        // live orders (all, unfiltered)
  let cart = [];           // {productId, name, emoji, ice, qty}
  let unsubProducts = null;
  let unsubOrders = null;

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
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no easily-confused chars
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
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }
  function fmtDateTime(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('nl-NL') + ' ' + d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }

  // ---------------------------------------------------------
  // Start / create / join navigation
  // ---------------------------------------------------------
  el.goCreateBtn.addEventListener('click', () => { el.createError.textContent = ''; switchScreen('create'); });
  el.goJoinBtn.addEventListener('click', () => { el.joinError.textContent = ''; switchScreen('join'); });
  el.createBackBtn.addEventListener('click', () => switchScreen('start'));
  el.joinBackBtn.addEventListener('click', () => switchScreen('start'));

  el.createSubmitBtn.addEventListener('click', async () => {
    const name = el.createNameInput.value.trim();
    if (!name) { el.createError.textContent = 'Vul een naam in.'; return; }
    el.createSubmitBtn.disabled = true;
    el.createError.textContent = '';
    try {
      let code = genCode();
      // avoid collision (very unlikely, but check once)
      let existing = await db.collection('restaurants').doc(code).get();
      if (existing.exists) code = genCode();

      await db.collection('restaurants').doc(code).set({
        name: name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      enterRestaurant(code, 'owner', name);
    } catch (err) {
      console.error(err);
      el.createError.textContent = 'Kon geen verbinding maken. Controleer je Firebase-instellingen in firebase-config.js.';
    } finally {
      el.createSubmitBtn.disabled = false;
    }
  });

  el.joinSubmitBtn.addEventListener('click', async () => {
    const code = el.joinCodeInput.value.trim().toUpperCase();
    if (!code) { el.joinError.textContent = 'Vul een code in.'; return; }
    el.joinSubmitBtn.disabled = true;
    el.joinError.textContent = '';
    try {
      const doc = await db.collection('restaurants').doc(code).get();
      if (!doc.exists) {
        el.joinError.textContent = 'Geen restaurant gevonden met deze code.';
        return;
      }
      enterRestaurant(code, 'guest', doc.data().name);
    } catch (err) {
      console.error(err);
      el.joinError.textContent = 'Kon geen verbinding maken. Controleer je Firebase-instellingen in firebase-config.js.';
    } finally {
      el.joinSubmitBtn.disabled = false;
    }
  });

  el.leaveBtn.addEventListener('click', () => {
    if (unsubProducts) unsubProducts();
    if (unsubOrders) unsubOrders();
    localStorage.removeItem('restaurantCode');
    localStorage.removeItem('restaurantRole');
    currentCode = null;
    products = [];
    orders = [];
    cart = [];
    switchScreen('start');
  });

  function enterRestaurant(code, role, name) {
    currentCode = code;
    currentRole = role;
    localStorage.setItem('restaurantCode', code);
    localStorage.setItem('restaurantRole', role);

    el.restaurantNameLabel.textContent = name;
    el.topCodeChip.textContent = code;
    el.settingsCodeDisplay.textContent = code;

    switchScreen('app');
    switchTab('bestellen');
    attachListeners(code);
  }

  // try auto-resume from localStorage
  (function tryResume() {
    const code = localStorage.getItem('restaurantCode');
    const role = localStorage.getItem('restaurantRole');
    if (!code) return;
    db.collection('restaurants').doc(code).get().then(doc => {
      if (doc.exists) {
        enterRestaurant(code, role || 'guest', doc.data().name);
      } else {
        localStorage.removeItem('restaurantCode');
      }
    }).catch(() => { /* stay on start screen if offline / misconfigured */ });
  })();

  // ---------------------------------------------------------
  // Tab switching
  // ---------------------------------------------------------
  el.tabbar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    switchTab(btn.dataset.tab);
  });

  // ---------------------------------------------------------
  // Realtime listeners
  // ---------------------------------------------------------
  function attachListeners(code) {
    if (unsubProducts) unsubProducts();
    if (unsubOrders) unsubOrders();

    unsubProducts = db.collection('restaurants').doc(code).collection('products')
      .orderBy('createdAt', 'asc')
      .onSnapshot(snap => {
        products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderProductsEverywhere();
      }, err => console.error('products listener error', err));

    unsubOrders = db.collection('restaurants').doc(code).collection('orders')
      .orderBy('createdAt', 'asc')
      .onSnapshot(snap => {
        orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderKitchen();
        renderHistory();
      }, err => console.error('orders listener error', err));
  }

  function renderProductsEverywhere() {
    renderOrderProducts();
    renderStock();
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
    products.forEach(p => {
      const card = document.createElement('div');
      card.className = 'product-card' + (p.outOfStock ? ' soldout' : '');
      card.innerHTML = `<div class="emoji">${p.emoji}</div><div class="name">${p.name}</div>`;
      if (!p.outOfStock) {
        card.addEventListener('click', () => {
          if (p.hasIce) {
            openIceModal(p);
          } else {
            addToCart(p, null);
          }
        });
      }
      el.orderProductGrid.appendChild(card);
    });
  }

  function openIceModal(product) {
    el.modalRoot.innerHTML = `
      <div class="modal-overlay" id="iceOverlay">
        <div class="modal">
          <h3>${product.emoji} ${product.name}</h3>
          <p class="muted">Met of zonder ijs?</p>
          <div class="choice-row">
            <button class="btn btn-teal" id="iceYesBtn">🧊 Met ijs</button>
            <button class="btn btn-outline" id="iceNoBtn">Zonder ijs</button>
          </div>
        </div>
      </div>`;
    document.getElementById('iceOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'iceOverlay') closeModal();
    });
    document.getElementById('iceYesBtn').addEventListener('click', () => { addToCart(product, 'met'); closeModal(); });
    document.getElementById('iceNoBtn').addEventListener('click', () => { addToCart(product, 'zonder'); closeModal(); });
  }

  function closeModal() { el.modalRoot.innerHTML = ''; }

  function addToCart(product, ice) {
    const existing = cart.find(c => c.productId === product.id && c.ice === ice);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ productId: product.id, name: product.name, emoji: product.emoji, ice: ice, qty: 1 });
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
    cart.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <div class="left">${item.emoji} ${item.name} ${item.ice ? `<span class="ice-tag">${item.ice === 'met' ? '🧊 met ijs' : 'zonder ijs'}</span>` : ''}</div>
        <div class="qty-ctrl">
          <button data-act="dec" data-idx="${idx}">−</button>
          <span>${item.qty}</span>
          <button data-act="inc" data-idx="${idx}">+</button>
        </div>`;
      el.cartList.appendChild(row);
    });
  }

  el.cartList.addEventListener('click', (e) => {
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

  el.submitOrderBtn.addEventListener('click', async () => {
    if (cart.length === 0) return;
    el.submitOrderBtn.disabled = true;
    try {
      await db.collection('restaurants').doc(currentCode).collection('orders').add({
        items: cart.map(c => ({ productId: c.productId, name: c.name, emoji: c.emoji, ice: c.ice, qty: c.qty })),
        note: el.orderNote.value.trim(),
        status: 'nieuw',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      cart = [];
      el.orderNote.value = '';
      renderCart();
      showToast('Bestelling verstuurd naar de keuken! 🧾');
    } catch (err) {
      console.error(err);
      showToast('Bestelling versturen mislukt.');
    } finally {
      el.submitOrderBtn.disabled = false;
    }
  });

  // ---------------------------------------------------------
  // TAB: Keuken
  // ---------------------------------------------------------
  function ticketHtml(order, actionLabel, actionEvent, actionClass) {
    const itemsHtml = order.items.map(it =>
      `<div class="item-line"><span><span class="qty">${it.qty}×</span>${it.emoji} ${it.name}${it.ice ? (it.ice === 'met' ? ' (🧊 met ijs)' : ' (zonder ijs)') : ''}</span></div>`
    ).join('');
    return `
      <div class="ticket" data-id="${order.id}">
        <div class="time">🕐 ${fmtTime(order.createdAt)}</div>
        ${itemsHtml}
        ${order.note ? `<div class="note">💬 ${escapeHtml(order.note)}</div>` : ''}
        <div class="ticket-actions">
          <button class="btn ${actionClass} btn-sm" data-event="${actionEvent}" data-id="${order.id}">${actionLabel}</button>
        </div>
      </div>`;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function renderKitchen() {
    const nieuw = orders.filter(o => o.status === 'nieuw');
    const bereiden = orders.filter(o => o.status === 'bereiden');
    const klaar = orders.filter(o => o.status === 'klaar');

    el.countNieuw.textContent = nieuw.length;
    el.countBereiden.textContent = bereiden.length;
    el.countKlaar.textContent = klaar.length;

    el.colNieuw.innerHTML = nieuw.length ? nieuw.map(o => ticketHtml(o, '▶ Start bereiden', 'start', 'btn-mustard')).join('')
      : '<div class="empty-col-msg">Geen nieuwe bestellingen</div>';
    el.colBereiden.innerHTML = bereiden.length ? bereiden.map(o => ticketHtml(o, '✅ Klaar', 'ready', 'btn-sage')).join('')
      : '<div class="empty-col-msg">Niets in bereiding</div>';
    el.colKlaar.innerHTML = klaar.length ? klaar.map(o => ticketHtml(o, '🚚 Bezorgd', 'deliver', 'btn-teal')).join('')
      : '<div class="empty-col-msg">Niets klaar om te bezorgen</div>';
  }

  document.getElementById('tab-keuken').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-event]');
    if (!btn) return;
    const id = btn.dataset.id;
    const ref = db.collection('restaurants').doc(currentCode).collection('orders').doc(id);
    btn.disabled = true;
    try {
      if (btn.dataset.event === 'start') {
        await ref.update({ status: 'bereiden', startedAt: firebase.firestore.FieldValue.serverTimestamp() });
      } else if (btn.dataset.event === 'ready') {
        await ref.update({ status: 'klaar', readyAt: firebase.firestore.FieldValue.serverTimestamp() });
      } else if (btn.dataset.event === 'deliver') {
        await ref.update({ status: 'bezorgd', deliveredAt: firebase.firestore.FieldValue.serverTimestamp() });
      }
    } catch (err) {
      console.error(err);
      showToast('Actie mislukt.');
      btn.disabled = false;
    }
  });

  // ---------------------------------------------------------
  // TAB: Historie
  // ---------------------------------------------------------
  function renderHistory() {
    const delivered = orders.filter(o => o.status === 'bezorgd').slice().reverse();

    // Totals table
    const totals = {}; // key: name|ice -> {name, emoji, ice, qty}
    delivered.forEach(o => {
      o.items.forEach(it => {
        const key = it.name + '|' + (it.ice || '-');
        if (!totals[key]) totals[key] = { name: it.name, emoji: it.emoji, ice: it.ice, qty: 0 };
        totals[key].qty += it.qty;
      });
    });
    const totalsArr = Object.values(totals).sort((a, b) => b.qty - a.qty);
    el.totalsTableBody.innerHTML = totalsArr.length ? totalsArr.map(t =>
      `<tr><td>${t.emoji} ${t.name}</td><td>${t.ice ? (t.ice === 'met' ? '🧊 met ijs' : 'zonder ijs') : '—'}</td><td>${t.qty}</td></tr>`
    ).join('') : '<tr><td colspan="3" class="muted">Nog geen historie</td></tr>';

    // Detailed list
    if (delivered.length === 0) {
      el.historyList.innerHTML = '<p class="muted">Nog geen bezorgde bestellingen.</p>';
      return;
    }
    el.historyList.innerHTML = delivered.map(o => {
      const itemsHtml = o.items.map(it =>
        `<li>${it.qty}× ${it.emoji} ${it.name}${it.ice ? (it.ice === 'met' ? ' (🧊 met ijs)' : ' (zonder ijs)') : ''}</li>`
      ).join('');
      return `
        <div class="history-order">
          <div class="head">
            <span>🕐 Besteld: ${fmtDateTime(o.createdAt)}</span>
            <span>🚚 Bezorgd: ${fmtDateTime(o.deliveredAt)}</span>
          </div>
          <ul class="items">${itemsHtml}</ul>
          ${o.note ? `<div class="note">💬 ${escapeHtml(o.note)}</div>` : ''}
        </div>`;
    }).join('');
  }

  el.clearHistoryBtn.addEventListener('click', async () => {
    const delivered = orders.filter(o => o.status === 'bezorgd');
    if (delivered.length === 0) { showToast('Er is geen historie om te verwijderen.'); return; }
    if (!confirm('Weet je zeker dat je alle historie wilt verwijderen? Dit kan niet ongedaan gemaakt worden.')) return;
    el.clearHistoryBtn.disabled = true;
    try {
      const batch = db.batch();
      delivered.forEach(o => {
        batch.delete(db.collection('restaurants').doc(currentCode).collection('orders').doc(o.id));
      });
      await batch.commit();
      showToast('Historie verwijderd.');
    } catch (err) {
      console.error(err);
      showToast('Verwijderen mislukt.');
    } finally {
      el.clearHistoryBtn.disabled = false;
    }
  });

  // ---------------------------------------------------------
  // TAB: Voorraad
  // ---------------------------------------------------------
  function renderStock() {
    if (products.length === 0) {
      el.stockList.innerHTML = '<p class="muted">Nog geen producten. Voeg ze toe bij Instellingen.</p>';
      return;
    }
    el.stockList.innerHTML = products.map(p => `
      <div class="stock-row">
        <div class="left"><span class="emoji">${p.emoji}</span> ${p.name}</div>
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="status-badge ${p.outOfStock ? 'sold-out' : 'in-stock'}">${p.outOfStock ? 'Uitverkocht' : 'Op voorraad'}</span>
          <button class="btn btn-sm ${p.outOfStock ? 'btn-sage' : 'btn-danger'}" data-toggle-stock="${p.id}" data-current="${p.outOfStock ? '1' : '0'}">
            ${p.outOfStock ? 'Terug op voorraad' : 'Zet op uitverkocht'}
          </button>
        </div>
      </div>`).join('');
  }

  el.stockList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-toggle-stock]');
    if (!btn) return;
    const id = btn.dataset.toggleStock;
    const nowOut = btn.dataset.current === '1';
    btn.disabled = true;
    try {
      await db.collection('restaurants').doc(currentCode).collection('products').doc(id)
        .update({ outOfStock: !nowOut });
    } catch (err) {
      console.error(err);
      showToast('Aanpassen mislukt.');
    } finally {
      btn.disabled = false;
    }
  });

  // ---------------------------------------------------------
  // TAB: Instellingen
  // ---------------------------------------------------------
  el.copyCodeBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(currentCode).then(() => showToast('Code gekopieerd!'))
      .catch(() => showToast('Kon niet kopiëren, code is: ' + currentCode));
  });

  function renderEmojiPicker() {
    el.emojiQuickPick.innerHTML = QUICK_EMOJIS.map(e => `<button type="button" data-emoji="${e}">${e}</button>`).join('');
  }
  el.emojiQuickPick.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-emoji]');
    if (!btn) return;
    el.newProductEmoji.value = btn.dataset.emoji;
    document.querySelectorAll('#emojiQuickPick button').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });

  el.addProductBtn.addEventListener('click', async () => {
    const name = el.newProductName.value.trim();
    const emoji = el.newProductEmoji.value.trim();
    const hasIce = el.newProductIce.checked;
    if (!name) { showToast('Vul een productnaam in.'); return; }
    if (!emoji) { showToast('Kies of typ een emoji.'); return; }
    el.addProductBtn.disabled = true;
    try {
      await db.collection('restaurants').doc(currentCode).collection('products').add({
        name, emoji, hasIce, outOfStock: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      el.newProductName.value = '';
      el.newProductEmoji.value = '';
      el.newProductIce.checked = false;
      document.querySelectorAll('#emojiQuickPick button').forEach(b => b.classList.remove('selected'));
      showToast('Product toegevoegd! 🎉');
    } catch (err) {
      console.error(err);
      showToast('Toevoegen mislukt.');
    } finally {
      el.addProductBtn.disabled = false;
    }
  });

  function renderManageProducts() {
    if (products.length === 0) {
      el.manageProductsList.innerHTML = '<p class="muted">Nog geen producten toegevoegd.</p>';
      return;
    }
    el.manageProductsList.innerHTML = products.map(p => `
      <div class="product-manage-row">
        <div class="left">${p.emoji} ${p.name} ${p.hasIce ? '<span class="ice-flag">🧊 ijs-optie</span>' : ''}</div>
        <button class="btn btn-danger btn-sm" data-delete-product="${p.id}">Verwijder</button>
      </div>`).join('');
  }

  el.manageProductsList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-delete-product]');
    if (!btn) return;
    if (!confirm('Dit product verwijderen?')) return;
    const id = btn.dataset.deleteProduct;
    btn.disabled = true;
    try {
      await db.collection('restaurants').doc(currentCode).collection('products').doc(id).delete();
    } catch (err) {
      console.error(err);
      showToast('Verwijderen mislukt.');
      btn.disabled = false;
    }
  });

})();
