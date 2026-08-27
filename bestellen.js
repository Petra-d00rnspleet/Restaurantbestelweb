/* ============================================================
   RESTAURANTS — bestellen.js
   Zelfbestel-pagina voor gasten die de QR-code scannen (zie
   "Zelfbestellen (QR-code)" in Instellingen > Algemeen).
   Losstaand van app.js: gasten loggen niet in en zien alleen
   het menu + hun eigen bestellingen van dít restaurant.
   ============================================================ */

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const root = document.getElementById("app");

const MERKNAAM = "Restaurants";

// Statuslabels zoals de eigenaar ze voor gasten wil tonen — LET OP: dit is bewust geen
// letterlijke/chronologische naamgeving (zie afspraak met de eigenaar: "nieuw" heet voor
// gasten "Afgeleverd", ook al is de bestelling dan nog niet klaar). Niet "verbeteren".
const GAST_STATUS_LABELS = { nieuw: "Afgeleverd", bereiden: "In bereiding", klaar: "Onderweg" };

// ---------- eigen gast-id (per apparaat/browser) zodat je je eigen bestellingen kunt volgen ----------
function gastIdOphalen(){
  let id = localStorage.getItem("zelfbestel_gast_id");
  if(!id){
    id = "gast-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    localStorage.setItem("zelfbestel_gast_id", id);
  }
  return id;
}
function codeUitUrl(){
  return (new URLSearchParams(location.search).get("code") || "").trim().toUpperCase();
}

const gastId = gastIdOphalen();
const code = codeUitUrl();

const state = {
  fase: "laden",              // laden | fout | tafel | bestellen
  foutmelding: "",
  restaurantNaam: "",
  menu: {},
  categorieen: {},
  plattegrond: {},
  thema: null,
  actieveTafelCel: null,
  tafel: "",
  winkelwagen: {},
  mijnBestellingen: {},        // live, gefilterd op gastId
  alleBestellingen: {},        // live, ALLE bestellingen van dit restaurant — alleen gebruikt om de
                                // wachtrij-positie ("x bestellingen voor jou") te berekenen, niet getoond
};

// ---------- kleine helpers (bewust gedupliceerd uit app.js — losstaand script) ----------
function euro(bedrag){ return "€ " + Number(bedrag).toFixed(2).replace(".", ","); }
function toonToast(tekst){
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = tekst;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}
const LETTERTYPE_OPTIES = [
  { key:"standaard",    ui:'"Inter", system-ui, sans-serif',  css:'"Playfair Display", Georgia, serif' },
  { key:"poppins",      ui:'"Poppins", sans-serif',           css:'"Poppins", sans-serif' },
  { key:"merriweather", ui:'"Merriweather", serif',           css:'"Merriweather", serif' },
  { key:"montserrat",   ui:'"Montserrat", sans-serif',        css:'"Montserrat", sans-serif' },
  { key:"oswald",       ui:'"Oswald", sans-serif',            css:'"Oswald", sans-serif' },
  { key:"lora",         ui:'"Lora", serif',                   css:'"Lora", serif' },
  { key:"pacifico",     ui:'"Pacifico", cursive',             css:'"Pacifico", cursive' },
  { key:"caveat",       ui:'"Caveat", cursive',                css:'"Caveat", cursive' },
];
function patroonAchtergrondUrl(patroonKey){
  const emojis = { vlam:"🔥", bord:"🍽️", wijn:"🍷", koffie:"☕", peper:"🧂", taart:"🍰" };
  const emoji = emojis[patroonKey];
  if(!emoji) return "";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'>` +
    `<text x='12' y='48' font-size='38' opacity='0.09'>${emoji}</text>` +
    `<text x='82' y='118' font-size='38' opacity='0.09'>${emoji}</text>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
function toepassenThema(thema){
  document.body.style.backgroundColor = thema && thema.achtergrond ? thema.achtergrond : "";
  document.body.style.backgroundImage = thema && thema.patroon ? patroonAchtergrondUrl(thema.patroon) : "";
  if(thema && thema.tekst) document.documentElement.style.setProperty("--text", thema.tekst);
  else document.documentElement.style.removeProperty("--text");
  const lettertype = thema && thema.lettertype ? LETTERTYPE_OPTIES.find(f => f.key === thema.lettertype) : null;
  if(lettertype && lettertype.key !== "standaard"){
    document.documentElement.style.setProperty("--ui", lettertype.ui);
    document.documentElement.style.setProperty("--display", lettertype.css);
  } else {
    document.documentElement.style.removeProperty("--ui");
    document.documentElement.style.removeProperty("--display");
  }
}

// ---------- laden van het restaurant ----------
function laadRestaurant(){
  if(!code){
    state.fase = "fout";
    state.foutmelding = "Geen restaurantcode gevonden in de link — scan de QR-code opnieuw.";
    render();
    return;
  }
  db.ref("restaurants/" + code + "/naam").once("value").then(snap => {
    if(!snap.exists()){
      state.fase = "fout";
      state.foutmelding = "Dit restaurant bestaat niet (meer). Scan de QR-code opnieuw of vraag het personeel.";
      render();
      return;
    }
    state.restaurantNaam = snap.val();
    verbindenLuisteraars();
  }).catch(() => {
    state.fase = "fout";
    state.foutmelding = "Er ging iets mis bij het laden. Controleer je internetverbinding en probeer het opnieuw.";
    render();
  });
}
function verbindenLuisteraars(){
  db.ref("restaurants/" + code + "/naam").on("value", snap => {
    if(snap.exists()){ state.restaurantNaam = snap.val(); render(); }
  });
  db.ref("restaurants/" + code + "/menu").on("value", snap => { state.menu = snap.val() || {}; render(); });
  db.ref("restaurants/" + code + "/categorieen").on("value", snap => { state.categorieen = snap.val() || {}; render(); });
  db.ref("restaurants/" + code + "/thema").on("value", snap => {
    state.thema = snap.val() || null;
    toepassenThema(state.thema);
    render();
  });
  db.ref("restaurants/" + code + "/plattegrond").on("value", snap => {
    state.plattegrond = snap.val() || {};
    if(state.fase === "laden"){
      const heeftTafels = Object.values(state.plattegrond).some(c => c.type === "tafel");
      state.fase = heeftTafels ? "tafel" : "bestellen";
    }
    render();
  });
  // Alleen je eigen bestellingen (op dit apparaat) van dít restaurant, live.
  db.ref("restaurants/" + code + "/bestellingen").orderByChild("gastId").equalTo(gastId).on("value", snap => {
    state.mijnBestellingen = snap.val() || {};
    render();
  });
  // ALLE bestellingen van dit restaurant, live — puur om te kunnen tellen hoeveel bestellingen
  // er nog vóór die van jou in de wachtrij staan (zie renderMijnBestellingenTracker).
  db.ref("restaurants/" + code + "/bestellingen").on("value", snap => {
    state.alleBestellingen = snap.val() || {};
    render();
  });
}

// ---------- winkelwagen ----------
function gastToevoegenAanWagen(id, item){
  if(!item) return;
  if(state.winkelwagen[id]) state.winkelwagen[id].aantal += 1;
  else state.winkelwagen[id] = {
    naam:item.naam, prijs:item.prijs, aantal:1, notitie:"", emoji:item.emoji||"", categorie:item.categorie||"",
    ijsKeuze:!!item.ijsKeuze, slagroomKeuze:!!item.slagroomKeuze, glasKeuze:!!item.glasKeuze,
    ijs:false, slagroom:false, glas:false,
  };
  render();
}
function gastWagenAantalWijzigen(id, delta){
  const item = state.winkelwagen[id];
  if(!item) return;
  item.aantal += delta;
  if(item.aantal <= 0) delete state.winkelwagen[id];
  render();
}
function gastWagenVerwijderen(id){ delete state.winkelwagen[id]; render(); }
function gastWagenNotitieWijzigen(id, waarde){ if(state.winkelwagen[id]) state.winkelwagen[id].notitie = waarde; }
function gastWagenIjsWijzigen(id, waarde){ if(state.winkelwagen[id]) state.winkelwagen[id].ijs = waarde; }
function gastWagenSlagroomWijzigen(id, waarde){ if(state.winkelwagen[id]) state.winkelwagen[id].slagroom = waarde; }
function gastWagenGlasWijzigen(id, waarde){ if(state.winkelwagen[id]) state.winkelwagen[id].glas = waarde; }

function gastTafelKiezen(cel){
  const celData = state.plattegrond[cel];
  if(!celData || celData.type !== "tafel") return;
  state.actieveTafelCel = cel;
  state.tafel = "Tafel " + (celData.nummer || "");
  state.fase = "bestellen";
  render();
}

function gastBestellingVerzenden(){
  const items = Object.values(state.winkelwagen);
  if(!items.length) return;
  const ref = db.ref("restaurants/" + code + "/bestellingen").push();
  ref.set({
    items: items,
    tafel: state.tafel || "",
    status: "nieuw",
    gastId: gastId,
    aangemaakt: firebase.database.ServerValue.TIMESTAMP,
  }).then(() => toonToast("Bestelling verzonden naar de keuken"));
  if(state.actieveTafelCel){
    db.ref("restaurants/" + code + "/plattegrond/" + state.actieveTafelCel + "/bezet").set(true);
  }
  state.winkelwagen = {};
  render();
}

// ============================================================
// RENDER
// ============================================================
function render(){
  if(state.fase === "laden") root.innerHTML = renderLaden();
  else if(state.fase === "fout") root.innerHTML = renderFout();
  else if(state.fase === "tafel") root.innerHTML = renderTafelKiezen();
  else root.innerHTML = renderZelfBestellen();
}

function renderLaden(){
  return `
    <div class="landing">
      <div class="landing__mark">
        <div class="landing__eyebrow">Even geduld</div>
        <h1 class="landing__title">Bezig met laden…</h1>
        <div class="landing__divider"><span class="landing__diamond"></span></div>
      </div>
    </div>`;
}
function renderFout(){
  return `
    <div class="landing">
      <div class="landing__mark">
        <div class="landing__eyebrow">${MERKNAAM}</div>
        <h1 class="landing__title">Niet gevonden</h1>
        <div class="landing__divider"><span class="landing__diamond"></span></div>
      </div>
      <p class="landing__sub">${state.foutmelding}</p>
    </div>`;
}
// Zelfde "3D" stoeltje (zit + rugleuning) als in het team-dashboard, i.p.v. het 🪑-emoji dat
// er op zijn kop uitziet zodra een stoel 180° gedraaid is.
function stoelIconHtml(rotatie){
  return `<span class="plattegrond__stoel-icoon" style="transform:rotate(${rotatie||0}deg);">
    <span class="plattegrond__stoel-icoon__rug"></span>
    <span class="plattegrond__stoel-icoon__zit"></span>
    <span class="plattegrond__stoel-icoon__poot plattegrond__stoel-icoon__poot--l"></span>
    <span class="plattegrond__stoel-icoon__poot plattegrond__stoel-icoon__poot--r"></span>
  </span>`;
}
function renderTafelKiezen(){
  const RIJEN = 7, KOLOMMEN = 12;
  let cellenHtml = "";
  for(let r=0;r<RIJEN;r++){
    for(let c=0;c<KOLOMMEN;c++){
      const key = r + "-" + c;
      const obj = (state.plattegrond || {})[key];
      if(!obj){
        cellenHtml += `<div class="plattegrond__cel plattegrond__cel--leeg"></div>`;
      } else if(obj.type === "tafel"){
        const bezet = !!obj.bezet;
        cellenHtml += `
          <button type="button" class="plattegrond__cel plattegrond__cel--tafel ${bezet?'plattegrond__cel--bezet':'plattegrond__cel--vrij'}"
            data-action="gast-tafel-kiezen" data-cel="${key}" title="Tafel ${obj.nummer||''}">
            🍽️<span class="plattegrond__nr">${obj.nummer||''}</span>
          </button>`;
      } else if(obj.type === "stoel"){
        cellenHtml += `<div class="plattegrond__cel plattegrond__cel--stoel" title="Stoel">${stoelIconHtml(obj.rotatie)}</div>`;
      } else {
        cellenHtml += `<div class="plattegrond__cel"></div>`;
      }
    }
  }
  return `
    <div class="landing">
      <div class="landing__mark">
        <div class="landing__eyebrow">Welkom bij</div>
        <h1 class="landing__title">${state.restaurantNaam}</h1>
        <div class="landing__divider"><span class="landing__diamond"></span></div>
      </div>
      <p class="landing__sub">Kies jouw tafel om te bestellen</p>
      <div class="plattegrond-wrap">
        <div class="plattegrond-grid" style="grid-template-columns:repeat(${KOLOMMEN}, 1fr);">${cellenHtml}</div>
      </div>
    </div>`;
}
function renderMijnBestellingenTracker(){
  const eigen = Object.entries(state.mijnBestellingen || {});
  if(!eigen.length) return "";
  // Alle bestellingen van het hele restaurant die nog niet klaar zijn (dus nog in de keuken-
  // wachtrij staan) — gebruikt om te laten zien hoeveel bestellingen er nog vóór die van jou zijn.
  const nogInDeWachtrij = Object.entries(state.alleBestellingen || {})
    .filter(([,b]) => b.status === "nieuw" || b.status === "bereiden");
  const rijen = eigen
    .sort((a,b) => (a[1].aangemaakt||0)-(b[1].aangemaakt||0))
    .map(([id,b]) => {
      const label = GAST_STATUS_LABELS[b.status] || b.status;
      const items = (b.items||[]).map(it => `${it.aantal}× ${it.naam}`).join(", ");
      let wachtrijHtml = "";
      if(b.status === "nieuw" || b.status === "bereiden"){
        const voorJou = nogInDeWachtrij.filter(([oid,o]) => oid !== id && (o.aangemaakt||0) < (b.aangemaakt||0)).length;
        wachtrijHtml = `<div class="gast-tracker__wachtrij">🧑‍🍳 ${voorJou > 0 ? `${voorJou} bestelling${voorJou===1?"":"en"} voor jou in de wachtrij` : "Jij bent als eerste aan de beurt"}</div>`;
      }
      return `
        <div class="gast-tracker__rij">
          <div class="gast-tracker__top">
            <span class="gast-tracker__nr">#${id.slice(-5).toUpperCase()}</span>
            <span class="gast-status gast-status--${b.status||'nieuw'}">${label}</span>
          </div>
          <div class="gast-tracker__items">${items}</div>
          ${wachtrijHtml}
        </div>`;
    }).join("");
  return `
    <div class="instel-blok gast-tracker">
      <div class="instel-blok__titel">Mijn bestellingen</div>
      ${rijen}
    </div>`;
}
function renderZelfBestellen(){
  const menuArr = Object.entries(state.menu || {});
  const categorieVolgorde = Object.entries(state.categorieen || {})
    .sort((a,b) => (a[1].aangemaakt||0)-(b[1].aangemaakt||0)).map(([,c]) => c.naam);
  const gebruikteCategorieen = [...new Set(menuArr.map(([,i]) => i.categorie || "Overig"))];
  const categorieen = [
    ...categorieVolgorde.filter(cat => gebruikteCategorieen.includes(cat)),
    ...gebruikteCategorieen.filter(cat => !categorieVolgorde.includes(cat)),
  ];

  let productenHtml = "";
  if(menuArr.length === 0){
    productenHtml = `<div class="leeg">Dit restaurant heeft nog geen menu ingesteld.</div>`;
  } else {
    categorieen.forEach(cat => {
      productenHtml += `<div class="categorie-titel">${cat}</div><div class="product-grid">`;
      menuArr.filter(([,i]) => (i.categorie||"Overig") === cat).forEach(([id,i]) => {
        const uitverkocht = !!i.uitverkocht;
        const opties = [];
        if(i.ijsKeuze) opties.push("🧊");
        if(i.slagroomKeuze) opties.push("🥛");
        if(i.glasKeuze) opties.push("🥂");
        productenHtml += `
          <button class="product-card ${uitverkocht?'product-card--uitverkocht':''}" ${uitverkocht?'disabled':'data-action="gast-toevoegen-wagen"'} data-id="${id}">
            ${uitverkocht ? `<span class="product-card__uitverkocht-badge">Uitverkocht</span>` : `<span class="product-card__plus">+</span>`}
            <div class="product-card__emoji">${i.emoji||"🍽️"}</div>
            <div class="product-card__naam">${i.naam}${opties.length?` <span class="product-card__opties">${opties.join(" ")}</span>`:""}</div>
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
            <button data-action="gast-wagen-min" data-id="${id}">−</button>
            <span>${i.aantal}</span>
            <button data-action="gast-wagen-plus" data-id="${id}">+</button>
          </div>
        </div>
        ${i.ijsKeuze ? `
          <label class="wagen__checkbox">
            <input type="checkbox" data-action="gast-wagen-ijs" data-id="${id}" ${i.ijs?"checked":""}>
            🧊 Met ijs
          </label>` : ""}
        ${i.slagroomKeuze ? `
          <label class="wagen__checkbox">
            <input type="checkbox" data-action="gast-wagen-slagroom" data-id="${id}" ${i.slagroom?"checked":""}>
            🥛 Met slagroom
          </label>` : ""}
        ${i.glasKeuze ? `
          <label class="wagen__checkbox">
            <input type="checkbox" data-action="gast-wagen-glas" data-id="${id}" ${i.glas?"checked":""}>
            🥂 Heb al een glas
          </label>` : ""}
        <input class="wagen__notitie" placeholder="Notitie, bijv. 'geen ui'" value="${i.notitie||""}" data-action="gast-wagen-notitie" data-id="${id}">
        <button class="wagen__verwijder" data-action="gast-wagen-verwijder" data-id="${id}">verwijderen</button>
      </div>`).join("");
  }

  return `
    <div class="shell">
      <header class="topbar">
        <div class="topbar__id">
          <div class="topbar__naam">${state.restaurantNaam}</div>
          ${state.tafel ? `<span class="topbar__code">${state.tafel}</span>` : ""}
        </div>
      </header>
      <main class="view">
        ${renderMijnBestellingenTracker()}
        <div class="bestel-layout">
          <div>
            <h2 class="view-titel">Bestellen</h2>
            ${productenHtml}
          </div>
          <div class="wagen">
            <div class="wagen__titel">Jouw bestelling</div>
            ${wagenHtml}
            <div class="wagen__totaal"><span>Totaal</span><span>${euro(totaal)}</span></div>
            <button class="btn btn--flame btn--block" data-action="gast-verzenden" ${wagenItems.length?"":"disabled"}>Bestelling verzenden</button>
          </div>
        </div>
      </main>
    </div>`;
}

// ============================================================
// EVENTS
// ============================================================
root.addEventListener("click", e => {
  const el = e.target.closest("[data-action]");
  if(!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;
  switch(action){
    case "gast-tafel-kiezen": gastTafelKiezen(el.dataset.cel); break;
    case "gast-toevoegen-wagen": gastToevoegenAanWagen(id, state.menu[id]); break;
    case "gast-wagen-plus": gastWagenAantalWijzigen(id, 1); break;
    case "gast-wagen-min": gastWagenAantalWijzigen(id, -1); break;
    case "gast-wagen-verwijder": gastWagenVerwijderen(id); break;
    case "gast-verzenden": gastBestellingVerzenden(); break;
  }
});
root.addEventListener("input", e => {
  const el = e.target.closest("[data-action]");
  if(!el) return;
  if(el.dataset.action === "gast-wagen-notitie") gastWagenNotitieWijzigen(el.dataset.id, el.value);
});
root.addEventListener("change", e => {
  const el = e.target.closest("[data-action]");
  if(!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;
  if(action === "gast-wagen-ijs") gastWagenIjsWijzigen(id, el.checked);
  if(action === "gast-wagen-slagroom") gastWagenSlagroomWijzigen(id, el.checked);
  if(action === "gast-wagen-glas") gastWagenGlasWijzigen(id, el.checked);
});

// ============================================================
// START
// ============================================================
render();
laadRestaurant();
