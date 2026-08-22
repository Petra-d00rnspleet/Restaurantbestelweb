/* ============================================================
   TICKET — app.js
   Alle logica: routing, Firebase Realtime Database sync,
   en het renderen van elk scherm.
   ============================================================ */

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const root = document.getElementById("app");

// ---------- status ----------
const state = {
  restaurantCode: localStorage.getItem("ticket_code") || null,
  restaurantNaam: localStorage.getItem("ticket_naam") || null,
  actiefInRestaurant: false,  // pas true na "doorgaan" / maken / joinen
  landingScherm: "start",     // start | maken | joinen
  huidigeView: "bestellen",   // bestellen | keuken | bezorgen | instellingen
  menu: {},
  bestellingen: {},
  updates: {},
  winkelwagen: {},            // { itemId: {naam, prijs, aantal, notitie, emoji} }
  tafel: "",
  foutmelding: "",
  nieuwProductEmoji: "🍽️",
  emojiPickerOpen: false,
};

const MERKNAAM = "Ticket";
const EMOJIS = ["🍔","🍕","🌭","🥪","🌮","🌯","🥗","🍝","🍜","🍣","🍱","🍤","🍗","🥩","🍟","🍰","🧁","🍩","🍪","🍦","🥤","☕","🍺","🍷"];

// ---------- helpers ----------
function opslaanRestaurant(code, naam){
  state.restaurantCode = code;
  state.restaurantNaam = naam;
  localStorage.setItem("ticket_code", code);
  localStorage.setItem("ticket_naam", naam);
}
function restaurantVerlaten(){
  localStorage.removeItem("ticket_code");
  localStorage.removeItem("ticket_naam");
  db.ref("restaurants/" + state.restaurantCode + "/menu").off();
  db.ref("restaurants/" + state.restaurantCode + "/bestellingen").off();
  db.ref("restaurants/" + state.restaurantCode + "/updates").off();
  state.restaurantCode = null;
  state.restaurantNaam = null;
  state.actiefInRestaurant = false;
  state.landingScherm = "start";
  state.winkelwagen = {};
  render();
}
function genereerCode(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // zonder verwarrende tekens
  let code = "";
  for(let i=0;i<5;i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
}
function euro(bedrag){
  return "€ " + Number(bedrag).toFixed(2).replace(".", ",");
}
function toonToast(tekst){
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = tekst;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

// ---------- firebase acties ----------
function restaurantMaken(naam){
  naam = naam.trim();
  if(!naam){ state.foutmelding = "Vul een naam in."; render(); return; }
  const code = genereerCode();
  db.ref("restaurants/" + code).set({
    naam: naam,
    aangemaakt: firebase.database.ServerValue.TIMESTAMP,
    menu: {},
  }).then(() => {
    opslaanRestaurant(code, naam);
    startRestaurant();
  });
}
function restaurantJoinen(codeInvoer){
  const code = codeInvoer.trim().toUpperCase();
  if(!code){ state.foutmelding = "Vul een code in."; render(); return; }
  db.ref("restaurants/" + code).once("value").then(snap => {
    if(!snap.exists()){
      state.foutmelding = "Geen restaurant gevonden met code " + code + ".";
      render();
    } else {
      opslaanRestaurant(code, snap.val().naam);
      startRestaurant();
    }
  });
}
function startRestaurant(){
  state.foutmelding = "";
  state.actiefInRestaurant = true;
  const code = state.restaurantCode;
  db.ref("restaurants/" + code + "/menu").on("value", snap => {
    state.menu = snap.val() || {};
    render();
  });
  db.ref("restaurants/" + code + "/bestellingen").on("value", snap => {
    state.bestellingen = snap.val() || {};
    render();
  });
  db.ref("restaurants/" + code + "/updates").on("value", snap => {
    state.updates = snap.val() || {};
    render();
  });
  render();
}

function bestellingVerzenden(){
  const items = Object.values(state.winkelwagen);
  if(items.length === 0) return;
  const ref = db.ref("restaurants/" + state.restaurantCode + "/bestellingen").push();
  ref.set({
    items: items,
    tafel: state.tafel || "",
    status: "nieuw",
    aangemaakt: firebase.database.ServerValue.TIMESTAMP,
  }).then(() => toonToast("Bestelling verzonden naar de keuken"));
  state.winkelwagen = {};
  state.tafel = "";
  render();
}
function statusBijwerken(orderId, status){
  db.ref("restaurants/" + state.restaurantCode + "/bestellingen/" + orderId).update({
    status: status,
    bijgewerkt: firebase.database.ServerValue.TIMESTAMP,
  });
}
function bestellingArchiveren(orderId){
  db.ref("restaurants/" + state.restaurantCode + "/bestellingen/" + orderId).remove();
}
function menuItemToevoegen(naam, prijs, categorie, emoji){
  if(!naam.trim() || !prijs) return;
  db.ref("restaurants/" + state.restaurantCode + "/menu").push().set({
    naam: naam.trim(),
    prijs: parseFloat(prijs.replace(",", ".")) || 0,
    categorie: categorie.trim() || "Overig",
    emoji: emoji || "🍽️",
  });
}
function menuItemVerwijderen(id){
  db.ref("restaurants/" + state.restaurantCode + "/menu/" + id).remove();
}
function updateToevoegen(tekst){
  tekst = tekst.trim();
  if(!tekst) return;
  db.ref("restaurants/" + state.restaurantCode + "/updates").push().set({
    tekst: tekst,
    tijdstip: firebase.database.ServerValue.TIMESTAMP,
  });
}

// ---------- winkelwagen ----------
function toevoegenAanWagen(id, item){
  if(state.winkelwagen[id]){
    state.winkelwagen[id].aantal += 1;
  } else {
    state.winkelwagen[id] = { naam:item.naam, prijs:item.prijs, emoji:item.emoji||"🍽️", aantal:1, notitie:"" };
  }
  render();
}
function wagenAantalWijzigen(id, delta){
  if(!state.winkelwagen[id]) return;
  state.winkelwagen[id].aantal += delta;
  if(state.winkelwagen[id].aantal <= 0) delete state.winkelwagen[id];
  render();
}
function wagenVerwijderen(id){
  delete state.winkelwagen[id];
  render();
}
function wagenNotitieWijzigen(id, tekst){
  if(state.winkelwagen[id]) state.winkelwagen[id].notitie = tekst;
}

// ============================================================
// RENDER
// ============================================================
function render(){
  if(!state.actiefInRestaurant){
    renderLanding();
  } else {
    renderDashboard();
  }
}

function renderLanding(){
  const merk = `
    <div class="landing__mark">
      <div class="landing__eyebrow">Welkom bij</div>
      <h1 class="landing__title">${MERKNAAM}</h1>
      <div class="landing__divider"><span class="landing__diamond"></span></div>
    </div>`;

  if(state.landingScherm === "start"){
    root.innerHTML = `
      <div class="landing">
        ${merk}
        <p class="landing__sub">Waar wilt u naartoe?</p>
        ${state.restaurantCode ? `
          <button class="choice-card choice-card--actief" data-action="doorgaan-restaurant" style="width:320px;">
            <div class="choice-card__title">Verder naar ${state.restaurantNaam}</div>
            <p class="choice-card__desc">Je hebt hier al een restaurant (code ${state.restaurantCode}) — ga er direct naartoe.</p>
          </button>
        ` : ""}
        <div class="landing__choices">
          <button class="choice-card" data-action="ga-maken">
            <div class="choice-card__title">Restaurant maken</div>
            <p class="choice-card__desc">Start een nieuw restaurant en krijg een unieke code om mee te delen met je team.</p>
          </button>
          <button class="choice-card" data-action="ga-joinen">
            <div class="choice-card__title">Restaurant joinen</div>
            <p class="choice-card__desc">Heb je al een code gekregen? Sluit je aan bij een bestaand restaurant.</p>
          </button>
        </div>
      </div>`;
  } else if(state.landingScherm === "maken"){
    root.innerHTML = `
      <div class="landing">
        ${merk}
        <div class="form-card">
          <label class="form-card__label">Naam van je restaurant</label>
          <input id="input-naam" type="text" placeholder="Bijv. De Gouden Pan" autofocus>
          ${state.foutmelding ? `<div class="fout">${state.foutmelding}</div>` : ""}
          <button class="btn btn--flame btn--block" data-action="maak-restaurant">Restaurant aanmaken</button>
          <button class="terug-link" data-action="terug-landing">← Terug</button>
        </div>
      </div>`;
    document.getElementById("input-naam").addEventListener("keydown", e => {
      if(e.key === "Enter") restaurantMaken(e.target.value);
    });
  } else if(state.landingScherm === "joinen"){
    root.innerHTML = `
      <div class="landing">
        ${merk}
        <div class="form-card">
          <label class="form-card__label">Restaurantcode</label>
          <input id="input-code" type="text" placeholder="Bijv. K3F7Q" autofocus style="text-transform:uppercase; letter-spacing:.1em;">
          ${state.foutmelding ? `<div class="fout">${state.foutmelding}</div>` : ""}
          <button class="btn btn--flame btn--block" data-action="join-restaurant">Restaurant joinen</button>
          <button class="terug-link" data-action="terug-landing">← Terug</button>
        </div>
      </div>`;
    document.getElementById("input-code").addEventListener("keydown", e => {
      if(e.key === "Enter") restaurantJoinen(e.target.value);
    });
  }
}

function renderDashboard(){
  const bestellingenArr = Object.entries(state.bestellingen || {});
  const aantalNieuw = bestellingenArr.filter(([,b]) => b.status === "nieuw").length;
  const aantalKlaar = bestellingenArr.filter(([,b]) => b.status === "klaar").length;

  root.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="topbar__id">
          <div class="topbar__naam">${state.restaurantNaam}</div>
          <button class="topbar__code" data-action="kopieer-code" title="Klik om code te kopiëren">${state.restaurantCode}</button>
        </div>
      </header>
      <nav class="tabs">
        <button class="tab ${state.huidigeView==='bestellen'?'actief':''}" data-action="wissel-view" data-view="bestellen">Bestellen</button>
        <button class="tab ${state.huidigeView==='keuken'?'actief':''}" data-action="wissel-view" data-view="keuken">Keuken ${aantalNieuw?`<span class="badge">${aantalNieuw}</span>`:""}</button>
        <button class="tab ${state.huidigeView==='bezorgen'?'actief':''}" data-action="wissel-view" data-view="bezorgen">Bezorgen ${aantalKlaar?`<span class="badge">${aantalKlaar}</span>`:""}</button>
        <button class="tab ${state.huidigeView==='instellingen'?'actief':''}" data-action="wissel-view" data-view="instellingen">Instellingen</button>
      </nav>
      <main class="view" id="view-inhoud"></main>
    </div>`;

  const inhoud = document.getElementById("view-inhoud");
  if(state.huidigeView === "bestellen") inhoud.innerHTML = renderBestellen();
  else if(state.huidigeView === "keuken") inhoud.innerHTML = renderKeuken();
  else if(state.huidigeView === "bezorgen") inhoud.innerHTML = renderBezorgen();
  else if(state.huidigeView === "instellingen") inhoud.innerHTML = renderInstellingen();
}

function renderBestellen(){
  const menuArr = Object.entries(state.menu || {});
  const categorieen = [...new Set(menuArr.map(([,i]) => i.categorie || "Overig"))];

  let productenHtml = "";
  if(menuArr.length === 0){
    productenHtml = `<div class="leeg">Nog geen producten. Voeg ze toe via Instellingen.</div>`;
  } else {
    categorieen.forEach(cat => {
      productenHtml += `<div class="categorie-titel">${cat}</div><div class="product-grid">`;
      menuArr.filter(([,i]) => (i.categorie||"Overig") === cat).forEach(([id,i]) => {
        productenHtml += `
          <button class="product-card" data-action="toevoegen-wagen" data-id="${id}">
            <span class="product-card__plus">+</span>
            <div class="product-card__emoji">${i.emoji||"🍽️"}</div>
            <div class="product-card__naam">${i.naam}</div>
            <div class="product-card__prijs">${euro(i.prijs)}</div>
          </button>`;
      });
      productenHtml += `</div>`;
    });
  }

  const wagenItems = Object.entries(state.winkelwagen);
  const totaal = wagenItems.reduce((s,[,i]) => s + i.prijs*i.aantal, 0);
  let wagenHtml = `<div class="leeg" style="padding:24px 12px;">Nog niets geselecteerd.</div>`;
  if(wagenItems.length){
    wagenHtml = wagenItems.map(([id,i]) => `
      <div class="wagen__regel">
        <div class="wagen__regel-top">
          <div class="wagen__regel-naam">${i.emoji?i.emoji+" ":""}${i.naam}</div>
          <div class="wagen__aantal">
            <button data-action="wagen-min" data-id="${id}">−</button>
            <span>${i.aantal}</span>
            <button data-action="wagen-plus" data-id="${id}">+</button>
          </div>
        </div>
        <input class="wagen__notitie" placeholder="Notitie, bijv. 'geen ui'" value="${i.notitie||""}" data-action="wagen-notitie" data-id="${id}">
        <button class="wagen__verwijder" data-action="wagen-verwijder" data-id="${id}">verwijderen</button>
      </div>`).join("");
  }

  return `
    <div class="bestel-layout">
      <div>
        <h2 class="view-titel">Bestellen</h2>
        ${productenHtml}
      </div>
      <div class="wagen">
        <div class="wagen__titel">Bestelling</div>
        <input class="wagen__tafel" placeholder="Tafel / naam (optioneel)" value="${state.tafel}" data-action="tafel-invoer">
        ${wagenHtml}
        <div class="wagen__totaal"><span>Totaal</span><span>${euro(totaal)}</span></div>
        <button class="btn btn--flame btn--block" data-action="verzend-bestelling" ${wagenItems.length?"":"disabled"}>Bestelling verzenden</button>
      </div>
    </div>`;
}

function ticketHtml(id, b, kolom){
  const items = (b.items||[]).map(it => `
    <li class="ticket__item"><b>${it.aantal}×</b> ${it.emoji?it.emoji+" ":""}${it.naam}
      ${it.notitie ? `<span class="ticket__item-notitie">— ${it.notitie}</span>` : ""}
    </li>`).join("");
  const tijd = b.aangemaakt ? new Date(b.aangemaakt).toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"}) : "";

  let acties = "";
  if(kolom === "nieuw"){
    acties = `<button class="btn btn--steel btn--sm" style="flex:1" data-action="start-bereiden" data-id="${id}">Bereiden</button>`;
  } else if(kolom === "bereiden"){
    acties = `<button class="btn btn--fresh btn--sm" style="flex:1" data-action="bereiden-klaar" data-id="${id}">Bereiden klaar</button>`;
  } else if(kolom === "klaar"){
    acties = `<button class="btn btn--flame btn--sm" style="flex:1" data-action="markeer-bezorgd" data-id="${id}">Bezorgd</button>`;
  }

  return `
    <div class="ticket">
      <div class="ticket__top">
        <div class="ticket__nr">#${id.slice(-5).toUpperCase()}</div>
        <div class="ticket__tijd">${tijd}</div>
      </div>
      ${b.tafel ? `<div class="ticket__tafel">${b.tafel}</div>` : ""}
      <ul class="ticket__items">${items}</ul>
      <div class="ticket__acties">${acties}</div>
    </div>`;
}

function renderKeuken(){
  const alle = Object.entries(state.bestellingen || {}).sort((a,b) => (a[1].aangemaakt||0)-(b[1].aangemaakt||0));
  const nieuw = alle.filter(([,b]) => b.status === "nieuw");
  const bereiden = alle.filter(([,b]) => b.status === "bereiden");

  return `
    <h2 class="view-titel">Keuken</h2>
    <div class="ticket-kolommen">
      <div>
        <div class="ticket-kolom__titel"><span class="stip stip--nieuw"></span>Nieuw (${nieuw.length})</div>
        <div class="ticket-stack">
          ${nieuw.length ? nieuw.map(([id,b]) => ticketHtml(id,b,"nieuw")).join("") : `<div class="leeg">Geen nieuwe bestellingen.</div>`}
        </div>
      </div>
      <div>
        <div class="ticket-kolom__titel"><span class="stip stip--bereiden"></span>In bereiding (${bereiden.length})</div>
        <div class="ticket-stack">
          ${bereiden.length ? bereiden.map(([id,b]) => ticketHtml(id,b,"bereiden")).join("") : `<div class="leeg">Nog niets in bereiding.</div>`}
        </div>
      </div>
    </div>`;
}

function renderBezorgen(){
  const klaar = Object.entries(state.bestellingen || {})
    .filter(([,b]) => b.status === "klaar")
    .sort((a,b) => (a[1].aangemaakt||0)-(b[1].aangemaakt||0));

  return `
    <h2 class="view-titel">Bezorgen</h2>
    <div class="ticket-kolommen">
      <div style="grid-column:1/-1; max-width:420px;">
        <div class="ticket-kolom__titel"><span class="stip stip--klaar"></span>Klaar om te bezorgen (${klaar.length})</div>
        <div class="ticket-stack">
          ${klaar.length ? klaar.map(([id,b]) => ticketHtml(id,b,"klaar")).join("") : `<div class="leeg">Niets klaar om te bezorgen.</div>`}
        </div>
      </div>
    </div>`;
}

function renderInstellingen(){
  const menuArr = Object.entries(state.menu || {});
  const menuHtml = menuArr.length ? menuArr.map(([id,i]) => `
    <li>
      <span>${i.emoji||"🍽️"} ${i.naam} <span class="cat">${i.categorie}</span></span>
      <span style="display:flex; align-items:center; gap:10px;">
        <span>${euro(i.prijs)}</span>
        <button class="verwijder-x" data-action="menu-verwijder" data-id="${id}">✕</button>
      </span>
    </li>`).join("") : `<div class="leeg">Nog geen producten toegevoegd.</div>`;

  const emojiGrid = state.emojiPickerOpen ? `
    <div class="emoji-grid">
      ${EMOJIS.map(e => `<button type="button" data-action="emoji-kies" data-emoji="${e}" class="${e===state.nieuwProductEmoji?'actief':''}">${e}</button>`).join("")}
    </div>` : "";

  const updatesArr = Object.entries(state.updates || {}).sort((a,b) => (b[1].tijdstip||0)-(a[1].tijdstip||0));
  const updatesHtml = updatesArr.length ? updatesArr.map(([,u]) => {
    const datum = u.tijdstip ? new Date(u.tijdstip).toLocaleString("nl-NL",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "";
    return `<li><span class="update-lijst__datum">${datum}</span><span>${u.tekst}</span></li>`;
  }).join("") : `<div class="leeg">Nog geen updates geplaatst.</div>`;

  return `
    <h2 class="view-titel">Instellingen</h2>

    <div class="instel-blok">
      <div class="instel-blok__titel">Restaurantcode</div>
      <div class="code-tonen">
        <div class="code-tonen__code">${state.restaurantCode}</div>
        <button class="btn btn--ghost btn--sm" data-action="kopieer-code">Code kopiëren</button>
      </div>
      <p style="color:var(--text-dim); font-size:.82rem; margin-top:12px;">Deel deze code met collega's zodat zij kunnen joinen op hun eigen apparaat.</p>
    </div>

    <div class="instel-blok">
      <div class="instel-blok__titel">Menu beheren</div>
      <div class="menu-form">
        <div class="emoji-kiezer">
          <button type="button" class="emoji-kiezer__knop" data-action="emoji-toggle">${state.nieuwProductEmoji}</button>
          ${emojiGrid}
        </div>
        <input id="menu-naam" placeholder="Productnaam">
        <input id="menu-prijs" placeholder="Prijs (bijv. 5.50)">
        <input id="menu-categorie" placeholder="Categorie">
        <button class="btn btn--flame" data-action="menu-toevoegen">Toevoegen</button>
      </div>
      <ul class="menu-lijst">${menuHtml}</ul>
    </div>

    <div class="instel-blok">
      <div class="instel-blok__titel">Updatelog</div>
      <div class="menu-form" style="grid-template-columns:1fr auto;">
        <input id="update-tekst" placeholder="Wat is er veranderd?">
        <button class="btn btn--flame" data-action="update-toevoegen">Plaatsen</button>
      </div>
      <ul class="update-lijst">${updatesHtml}</ul>
    </div>

    <div class="instel-blok">
      <div class="instel-blok__titel">Restaurant verlaten</div>
      <button class="btn btn--ghost" data-action="verlaat-restaurant">Verlaat dit restaurant op dit apparaat</button>
    </div>`;
}

// ============================================================
// EVENTS (delegatie op #app)
// ============================================================
root.addEventListener("click", e => {
  const el = e.target.closest("[data-action]");
  if(!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;

  switch(action){
    case "ga-maken": state.landingScherm="maken"; state.foutmelding=""; render(); break;
    case "ga-joinen": state.landingScherm="joinen"; state.foutmelding=""; render(); break;
    case "terug-landing": state.landingScherm="start"; state.foutmelding=""; render(); break;
    case "maak-restaurant": restaurantMaken(document.getElementById("input-naam").value); break;
    case "join-restaurant": restaurantJoinen(document.getElementById("input-code").value); break;
    case "doorgaan-restaurant": startRestaurant(); break;

    case "wissel-view": state.huidigeView = el.dataset.view; render(); break;
    case "kopieer-code":
      navigator.clipboard?.writeText(state.restaurantCode);
      toonToast("Code gekopieerd: " + state.restaurantCode);
      break;
    case "verlaat-restaurant": restaurantVerlaten(); break;

    case "toevoegen-wagen": toevoegenAanWagen(id, state.menu[id]); break;
    case "wagen-plus": wagenAantalWijzigen(id, 1); break;
    case "wagen-min": wagenAantalWijzigen(id, -1); break;
    case "wagen-verwijder": wagenVerwijderen(id); break;
    case "verzend-bestelling": bestellingVerzenden(); break;

    case "start-bereiden": statusBijwerken(id, "bereiden"); break;
    case "bereiden-klaar": statusBijwerken(id, "klaar"); break;
    case "markeer-bezorgd": bestellingArchiveren(id); toonToast("Bestelling bezorgd"); break;

    case "emoji-toggle": state.emojiPickerOpen = !state.emojiPickerOpen; render(); break;
    case "emoji-kies": state.nieuwProductEmoji = el.dataset.emoji; state.emojiPickerOpen = false; render(); break;

    case "menu-toevoegen":
      menuItemToevoegen(
        document.getElementById("menu-naam").value,
        document.getElementById("menu-prijs").value,
        document.getElementById("menu-categorie").value,
        state.nieuwProductEmoji
      );
      state.nieuwProductEmoji = "🍽️";
      render();
      break;
    case "menu-verwijder": menuItemVerwijderen(id); break;

    case "update-toevoegen":
      updateToevoegen(document.getElementById("update-tekst").value);
      render();
      break;
  }
});

root.addEventListener("input", e => {
  const el = e.target.closest("[data-action]");
  if(!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;
  if(action === "wagen-notitie") wagenNotitieWijzigen(id, el.value);
  if(action === "tafel-invoer") state.tafel = el.value;
});

// ============================================================
// START
// ============================================================
render();
