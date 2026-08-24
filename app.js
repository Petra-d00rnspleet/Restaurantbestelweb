/* ============================================================
   RESTAURANTS — app.js
   Alle logica: routing, Firebase Realtime Database sync,
   en het renderen van elk scherm.
   ============================================================ */

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
const root = document.getElementById("app");

// ---------- opslag van "mijn restaurants" (max 2 per apparaat/persoon) ----------
// Migreert automatisch vanaf de oude opslag (vóór meerdere restaurants per apparaat mogelijk waren).
function laadMijnRestaurants(){
  try {
    const raw = localStorage.getItem("ticket_restaurants");
    if(raw) return JSON.parse(raw) || [];
  } catch(e) {}
  const oudeCode = localStorage.getItem("ticket_code");
  if(oudeCode){
    const migratie = [{
      code: oudeCode,
      naam: localStorage.getItem("ticket_naam") || oudeCode,
      ledId: localStorage.getItem("ticket_lid_id") || null,
      gebruikersNaam: localStorage.getItem("ticket_lid_naam") || "",
    }];
    localStorage.setItem("ticket_restaurants", JSON.stringify(migratie));
    localStorage.removeItem("ticket_code");
    localStorage.removeItem("ticket_naam");
    localStorage.removeItem("ticket_lid_id");
    localStorage.removeItem("ticket_lid_naam");
    return migratie;
  }
  return [];
}
function laadGelezenUpdates(){
  try { return JSON.parse(localStorage.getItem("ticket_gelezen_updates") || "[]") || []; }
  catch(e){ return []; }
}

// ---------- status ----------
const state = {
  restaurantCode: null,
  restaurantNaam: null,
  ledId: null,                 // jouw teamlid-id binnen dit restaurant
  gebruikersNaam: null,        // jouw eigen naam
  mijnRestaurants: laadMijnRestaurants(),  // [{code, naam, ledId, gebruikersNaam}] — max 2 per apparaat
  actiefInRestaurant: false,  // pas true na "doorgaan" / maken / joinen
  landingScherm: "start",     // start | maken | joinen
  huidigeView: "bestellen",   // bestellen | keuken | bezorgen | historie | instellingen
  instellingenTab: "algemeen", // algemeen | producten | achtergrond | plattegrond
  menu: {},
  bestellingen: {},
  historie: {},
  categorieen: {},             // categorieën van het huidige restaurant
  leden: {},                  // teamleden van het huidige restaurant, met functie + rechten
  ledenGeladen: false,
  thema: null,                 // { achtergrond, tekst } — eigen kleuren voor dit restaurant
  plattegrond: {},              // { "rij-kolom": {type:"tafel"|"stoel"} }
  plattegrondTool: "tafel",
  siteUpdates: {},
  gelezenUpdates: laadGelezenUpdates(),   // ids van systeemupdates die je al als gelezen hebt gemarkeerd
  beheerderActief: false,  // wordt gezet door Firebase Auth (zie onAuthStateChanged onderaan), niet meer lokaal opgeslagen
  beheerPaneelOpen: false,     // is het sitebeheer-vak (wachtwoord-beveiligd) open?
  beheerFoutmelding: "",
  alleRestaurants: {},          // alle restaurants in de database, alleen geladen als het beheerpaneel open is
  alleRestaurantsGeladen: false,
  beheerBezoekModus: false,     // ben je als beheerder een restaurant van iemand anders aan het bekijken/bewerken?
  winkelwagen: {},            // { itemId: {naam, prijs, aantal, notitie, emoji, categorie} }
  bestelModus: "plattegrond",  // plattegrond | producten — welk scherm van Bestellen actief is (alleen relevant als er tafels zijn ingesteld)
  actieveTafelCel: null,       // welke plattegrondcel ("rij-kolom") er nu besteld wordt, of null
  tafel: "",
  foutmelding: "",
  nieuwProductEmoji: "🍽️",
  emojiPickerOpen: false,
};

const MERKNAAM = "Restaurants";
const MAX_RESTAURANTS_PER_PERSOON = 2;

// Standaardrechten voor een nieuw teamlid dat joint (de eigenaar kan dit later aanpassen).
const STANDAARD_RECHTEN = { bestellen:true, keuken:false, bezorgen:false, historie:false, instellingen:false };
const RECHTEN_DEFINITIES = [
  { key:"bestellen",    label:"Bestellen" },
  { key:"keuken",       label:"Keuken" },
  { key:"bezorgen",     label:"Bezorgen" },
  { key:"historie",     label:"Historie" },
  { key:"instellingen", label:"Instellingen" },
];

const EMOJI_CATEGORIEEN = {
  "Fastfood": ["🍔","🍕","🌭","🥪","🌮","🌯","🍗","🥓","🍟","🥙"],
  "Warme maaltijd": ["🍝","🍜","🍲","🍛","🍱","🍣","🥘","🫕","🍳","🥟"],
  "Groente & fruit": ["🥗","🍎","🍌","🍊","🍇","🍓","🍉","🥑","🥕","🍒","🍍","🥝","🍑","🥭"],
  "Bakkerij & zoet": ["🍰","🧁","🍩","🍪","🍦","🍫","🍮","🥧","🥐","🍯"],
  "Dranken": ["🥤","☕","🍺","🍷","🍹","🧃","🍵","🥃","🧉","🥛"],
};

// Patronen die als subtiele achtergrondtextuur gekozen kunnen worden (naast een eigen kleur).
const PATROON_OPTIES = [
  { key:"geen",   naam:"Geen patroon", emoji:"" },
  { key:"vlam",   naam:"Vlammen",      emoji:"🔥" },
  { key:"bord",   naam:"Bord & bestek",emoji:"🍽️" },
  { key:"wijn",   naam:"Wijnglas",     emoji:"🍷" },
  { key:"koffie", naam:"Koffie",       emoji:"☕" },
  { key:"peper",  naam:"Zout & peper", emoji:"🧂" },
  { key:"taart",  naam:"Taart",        emoji:"🍰" },
];
// Lettertypen die voor de hele app gekozen kunnen worden. "ui" wordt gebruikt voor de meeste
// tekst, "css" voor de sierlijke titels — meestal dezelfde familie, voor een consistent geheel.
const LETTERTYPE_OPTIES = [
  { key:"standaard",    naam:"Standaard",    ui:'"Inter", system-ui, sans-serif',  css:'"Playfair Display", Georgia, serif' },
  { key:"poppins",      naam:"Poppins",      ui:'"Poppins", sans-serif',           css:'"Poppins", sans-serif' },
  { key:"merriweather", naam:"Merriweather", ui:'"Merriweather", serif',           css:'"Merriweather", serif' },
  { key:"montserrat",   naam:"Montserrat",   ui:'"Montserrat", sans-serif',        css:'"Montserrat", sans-serif' },
  { key:"oswald",       naam:"Oswald",       ui:'"Oswald", sans-serif',            css:'"Oswald", sans-serif' },
  { key:"lora",         naam:"Lora",         ui:'"Lora", serif',                   css:'"Lora", serif' },
  { key:"pacifico",     naam:"Pacifico",     ui:'"Pacifico", cursive',             css:'"Pacifico", cursive' },
  { key:"caveat",       naam:"Caveat",       ui:'"Caveat", cursive',               css:'"Caveat", cursive' },
];

// ---------- helpers ----------
// Slaat (of werkt bij) een restaurant op in de lijst "mijn restaurants" van dit apparaat.
function mijnRestaurantOpslaan(code, naam, ledId, gebruikersNaam){
  const index = state.mijnRestaurants.findIndex(r => r.code === code);
  const entry = { code, naam, ledId, gebruikersNaam };
  if(index >= 0) state.mijnRestaurants[index] = entry;
  else state.mijnRestaurants.push(entry);
  localStorage.setItem("ticket_restaurants", JSON.stringify(state.mijnRestaurants));
}
// Haalt een restaurant uit de lijst "mijn restaurants" — gebeurt alleen automatisch (verwijderd
// door eigenaar of sitebeheer), nooit doordat iemand zelf op een "verlaten"-knop klikt.
function mijnRestaurantVerwijderenUitLijst(code){
  state.mijnRestaurants = state.mijnRestaurants.filter(r => r.code !== code);
  localStorage.setItem("ticket_restaurants", JSON.stringify(state.mijnRestaurants));
}
function restaurantNaamWijzigen(nieuweNaam){
  nieuweNaam = (nieuweNaam || "").trim();
  if(!nieuweNaam) return;
  db.ref("restaurants/" + state.restaurantCode + "/naam").set(nieuweNaam).then(() => {
    toonToast("Restaurantnaam bijgewerkt");
  });
}
// Genereert een subtiel herhalend achtergrondpatroon (SVG data-URI) op basis van een emoji.
function patroonAchtergrondUrl(patroonKey){
  const optie = PATROON_OPTIES.find(p => p.key === patroonKey);
  if(!optie || !optie.emoji) return "";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'>` +
    `<text x='12' y='48' font-size='38' opacity='0.09'>${optie.emoji}</text>` +
    `<text x='82' y='118' font-size='38' opacity='0.09'>${optie.emoji}</text>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
// Berekent of witte of donkere tekst het beste leesbaar is op een gegeven achtergrondkleur.
function contrastKleur(hex){
  hex = (hex || "").replace("#", "");
  if(hex.length === 3) hex = hex.split("").map(c => c + c).join("");
  if(hex.length !== 6) return "#f3ead9";
  const r = parseInt(hex.substr(0,2),16), g = parseInt(hex.substr(2,2),16), b = parseInt(hex.substr(4,2),16);
  const yiq = (r*299 + g*587 + b*114) / 1000;
  return yiq >= 140 ? "#241a12" : "#f3ead9";
}
// Past de gekozen achtergrond, tekstkleur, patroon en lettertype van dit restaurant toe op de pagina.
function toepassenThema(thema){
  document.body.style.backgroundColor = thema && thema.achtergrond ? thema.achtergrond : "";
  document.body.style.backgroundImage = thema && thema.patroon ? patroonAchtergrondUrl(thema.patroon) : "";
  if(thema && thema.tekst){
    document.documentElement.style.setProperty("--text", thema.tekst);
  } else {
    document.documentElement.style.removeProperty("--text");
  }
  const lettertype = thema && thema.lettertype ? LETTERTYPE_OPTIES.find(f => f.key === thema.lettertype) : null;
  if(lettertype && lettertype.key !== "standaard"){
    document.documentElement.style.setProperty("--ui", lettertype.ui);
    document.documentElement.style.setProperty("--display", lettertype.css);
  } else {
    document.documentElement.style.removeProperty("--ui");
    document.documentElement.style.removeProperty("--display");
  }
}
function themaWijzigen(veld, waarde){
  db.ref("restaurants/" + state.restaurantCode + "/thema/" + veld).set(waarde);
}
function themaPresetKiezen(achtergrond, tekst){
  db.ref("restaurants/" + state.restaurantCode + "/thema").update({ achtergrond, tekst });
}
// Sluit de live-verbindingen met het huidige restaurant af en gaat terug naar het startscherm.
// Dit is GEEN "restaurant verlaten" — het restaurant blijft gewoon in je lijst "mijn restaurants"
// staan, dit is puur even wisselen. Verwijderen uit die lijst gebeurt alleen automatisch
// (zie mijnRestaurantVerwijderenUitLijst), nooit via een knop die de gebruiker zelf indrukt.
function verlaatHuidigRestaurant(){
  const code = state.restaurantCode;
  if(code){
    db.ref("restaurants/" + code + "/naam").off();
    db.ref("restaurants/" + code + "/menu").off();
    db.ref("restaurants/" + code + "/bestellingen").off();
    db.ref("restaurants/" + code + "/historie").off();
    db.ref("restaurants/" + code + "/leden").off();
    db.ref("restaurants/" + code + "/thema").off();
    db.ref("restaurants/" + code + "/plattegrond").off();
    db.ref("restaurants/" + code + "/categorieen").off();
  }
  state.restaurantCode = null;
  state.restaurantNaam = null;
  state.ledId = null;
  state.gebruikersNaam = null;
  state.leden = {};
  state.ledenGeladen = false;
  state.thema = null;
  state.plattegrond = {};
  state.categorieen = {};
  toepassenThema(null);
  state.actiefInRestaurant = false;
  state.landingScherm = "start";
  state.winkelwagen = {};
  state.bestelModus = "plattegrond";
  state.actieveTafelCel = null;
  render();
}
// Bepaalt of het huidige teamlid een bepaald recht heeft (of alles mag, als eigenaar).
// Zolang de ledenlijst nog niet is geladen (of je eigen lid nog niet gevonden is,
// bijv. vlak na het aanmaken van een restaurant) wordt toegang tijdelijk toegestaan.
function heeftRecht(sleutel){
  if(!state.ledenGeladen) return true;
  const lid = state.leden[state.ledId];
  if(!lid) return true;
  if(lid.eigenaar) return true;
  return !!(lid.rechten && lid.rechten[sleutel]);
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
// Bouwt de link naar de zelfbestel-pagina voor een restaurant — werkt automatisch op elke
// plek waar de site gehost staat (GitHub Pages, eigen domein, lokaal), omdat 'ie uitgaat van
// de locatie van dit bestand zelf.
function zelfBestelUrl(code){
  return location.origin + location.pathname.replace(/index\.html$/, "") + "bestellen.html?code=" + code;
}
// Genereert de QR-afbeelding via een publieke QR-code-API — een gewone <img>, geen canvas/JS-
// bibliotheek nodig om te tekenen. Dat voorkomt dat de QR-code stilletjes leeg blijft (bijv. als
// een CDN-script niet op tijd laadt): een <img> toont gewoon een gebroken-afbeelding-icoontje
// als het misgaat, in plaats van onzichtbaar te falen.
function zelfBestelQrAfbeeldingUrl(code){
  return "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" + encodeURIComponent(zelfBestelUrl(code));
}

// ---------- firebase acties ----------
function restaurantMaken(naam, eigenNaam){
  naam = naam.trim();
  eigenNaam = (eigenNaam || "").trim();
  if(state.mijnRestaurants.length >= MAX_RESTAURANTS_PER_PERSOON){
    state.foutmelding = `Je hebt al ${MAX_RESTAURANTS_PER_PERSOON} restaurants op dit apparaat — dat is het maximum.`;
    render(); return;
  }
  if(!naam){ state.foutmelding = "Vul een naam voor je restaurant in."; render(); return; }
  if(!eigenNaam){ state.foutmelding = "Vul je eigen naam in."; render(); return; }
  const code = genereerCode();
  db.ref("restaurants/" + code).set({
    naam: naam,
    aangemaakt: firebase.database.ServerValue.TIMESTAMP,
    menu: {},
  }).then(() => {
    const ledRef = db.ref("restaurants/" + code + "/leden").push();
    const catRef = db.ref("restaurants/" + code + "/categorieen").push();
    return Promise.all([
      ledRef.set({
        naam: eigenNaam,
        functie: "Eigenaar",
        eigenaar: true,
        rechten: { bestellen:true, keuken:true, bezorgen:true, historie:true, instellingen:true },
        aangemaakt: firebase.database.ServerValue.TIMESTAMP,
      }),
      catRef.set({ naam: "Overig", aangemaakt: firebase.database.ServerValue.TIMESTAMP }),
    ]).then(() => ledRef.key);
  }).then(ledId => {
    mijnRestaurantOpslaan(code, naam, ledId, eigenNaam);
    state.restaurantCode = code;
    state.restaurantNaam = naam;
    state.ledId = ledId;
    state.gebruikersNaam = eigenNaam;
    startRestaurant();
  });
}
function restaurantJoinen(codeInvoer, eigenNaam){
  const code = codeInvoer.trim().toUpperCase();
  eigenNaam = (eigenNaam || "").trim();
  if(!code){ state.foutmelding = "Vul een code in."; render(); return; }
  if(!eigenNaam){ state.foutmelding = "Vul je naam in."; render(); return; }
  const bestaandLid = state.mijnRestaurants.find(r => r.code === code);
  if(bestaandLid){
    // Je bent hier op dit apparaat al lid van — gewoon doorgaan i.p.v. opnieuw joinen.
    state.restaurantCode = bestaandLid.code;
    state.restaurantNaam = bestaandLid.naam;
    state.ledId = bestaandLid.ledId;
    state.gebruikersNaam = bestaandLid.gebruikersNaam;
    startRestaurant();
    return;
  }
  if(state.mijnRestaurants.length >= MAX_RESTAURANTS_PER_PERSOON){
    state.foutmelding = `Je hebt al ${MAX_RESTAURANTS_PER_PERSOON} restaurants op dit apparaat — dat is het maximum.`;
    render(); return;
  }
  db.ref("restaurants/" + code).once("value").then(snap => {
    if(!snap.exists()){
      state.foutmelding = "Geen restaurant gevonden met code " + code + ".";
      render();
    } else {
      const ledRef = db.ref("restaurants/" + code + "/leden").push();
      ledRef.set({
        naam: eigenNaam,
        functie: "",
        eigenaar: false,
        rechten: { ...STANDAARD_RECHTEN },
        aangemaakt: firebase.database.ServerValue.TIMESTAMP,
      }).then(() => {
        mijnRestaurantOpslaan(code, snap.val().naam, ledRef.key, eigenNaam);
        state.restaurantCode = code;
        state.restaurantNaam = snap.val().naam;
        state.ledId = ledRef.key;
        state.gebruikersNaam = eigenNaam;
        startRestaurant();
      });
    }
  });
}
function startRestaurant(){
  state.foutmelding = "";
  state.actiefInRestaurant = true;
  const code = state.restaurantCode;
  db.ref("restaurants/" + code + "/naam").on("value", snap => {
    if(snap.exists()){
      if(snap.val() !== state.restaurantNaam){
        state.restaurantNaam = snap.val();
        mijnRestaurantOpslaan(code, snap.val(), state.ledId, state.gebruikersNaam);
      }
      render();
    } else if(state.actiefInRestaurant && !state.beheerBezoekModus){
      // Restaurant bestaat niet meer (verwijderd via Sitebeheer) — terug naar het startscherm.
      toonToast("Dit restaurant bestaat niet meer.");
      mijnRestaurantVerwijderenUitLijst(code);
      verlaatHuidigRestaurant();
    }
  });
  db.ref("restaurants/" + code + "/menu").on("value", snap => {
    state.menu = snap.val() || {};
    render();
  });
  db.ref("restaurants/" + code + "/bestellingen").on("value", snap => {
    state.bestellingen = snap.val() || {};
    render();
  });
  db.ref("restaurants/" + code + "/historie").on("value", snap => {
    state.historie = snap.val() || {};
    render();
  });
  db.ref("restaurants/" + code + "/leden").on("value", snap => {
    state.leden = snap.val() || {};
    state.ledenGeladen = true;
    if(state.ledId && state.actiefInRestaurant && !state.beheerBezoekModus && !state.leden[state.ledId]){
      // Je bent door de eigenaar als teamlid verwijderd — dat telt als "verwijderd worden",
      // en maakt dus weer plek vrij in je lijst met restaurants.
      toonToast("Je bent door de eigenaar uit dit restaurant verwijderd.");
      mijnRestaurantVerwijderenUitLijst(code);
      verlaatHuidigRestaurant();
      return;
    }
    render();
  });
  db.ref("restaurants/" + code + "/thema").on("value", snap => {
    state.thema = snap.val() || null;
    toepassenThema(state.thema);
    render();
  });
  db.ref("restaurants/" + code + "/plattegrond").on("value", snap => {
    state.plattegrond = snap.val() || {};
    render();
  });
  db.ref("restaurants/" + code + "/categorieen").on("value", snap => {
    state.categorieen = snap.val() || {};
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
  if(state.actieveTafelCel){
    // Deze tafel gaat op bezet totdat er is afgerekend via "Tafel betaald".
    db.ref("restaurants/" + state.restaurantCode + "/plattegrond/" + state.actieveTafelCel + "/bezet").set(true);
  } else {
    state.tafel = "";
  }
  state.winkelwagen = {};
  render();
}
// Rekent een tafel af: geeft de tafel weer vrij op de plattegrond. De reeds verzonden
// bestellingen van die tafel blijven gewoon hun eigen weg volgen (keuken → bezorgen → historie).
function tafelBetaald(cel){
  if(!cel) return;
  db.ref("restaurants/" + state.restaurantCode + "/plattegrond/" + cel + "/bezet").set(false).then(() => {
    toonToast("Tafel afgerekend en vrijgegeven");
  });
  state.actieveTafelCel = null;
  state.tafel = "";
  state.bestelModus = "plattegrond";
  render();
}
function statusBijwerken(orderId, status){
  db.ref("restaurants/" + state.restaurantCode + "/bestellingen/" + orderId).update({
    status: status,
    bijgewerkt: firebase.database.ServerValue.TIMESTAMP,
  });
}
function bestellingBezorgd(orderId){
  const bestelling = state.bestellingen[orderId];
  if(!bestelling) return;
  db.ref("restaurants/" + state.restaurantCode + "/historie/" + orderId).set({
    ...bestelling,
    status: "bezorgd",
    bezorgd: firebase.database.ServerValue.TIMESTAMP,
  }).then(() => {
    db.ref("restaurants/" + state.restaurantCode + "/bestellingen/" + orderId).remove();
    toonToast("Bestelling bezorgd en toegevoegd aan historie");
  });
}
function historieVerwijderen(id){
  if(!confirm("Deze bestelling uit de historie verwijderen?")) return;
  db.ref("restaurants/" + state.restaurantCode + "/historie/" + id).remove().then(() => {
    toonToast("Bestelling verwijderd uit historie");
  });
}
function historieWissen(){
  if(!confirm("Weet je zeker dat je de hele geschiedenis van dit restaurant wilt wissen? Dit kan niet ongedaan gemaakt worden.")) return;
  db.ref("restaurants/" + state.restaurantCode + "/historie").remove();
}
function menuItemToevoegen(naam, prijs, categorie, emoji, ijsKeuze, slagroomKeuze){
  if(!naam.trim() || !prijs || !categorie) return;
  db.ref("restaurants/" + state.restaurantCode + "/menu").push().set({
    naam: naam.trim(),
    prijs: parseFloat(prijs.replace(",", ".")) || 0,
    categorie: categorie,
    emoji: emoji || "🍽️",
    ijsKeuze: !!ijsKeuze,
    slagroomKeuze: !!slagroomKeuze,
    uitverkocht: false,
  });
}
function menuItemVerwijderen(id){
  db.ref("restaurants/" + state.restaurantCode + "/menu/" + id).remove();
}
function menuItemUitverkochtWijzigen(id, waarde){
  db.ref("restaurants/" + state.restaurantCode + "/menu/" + id + "/uitverkocht").set(!!waarde);
}

// ---------- categorieën (aan te maken in Instellingen > Producten, te kiezen per product) ----------
function categorieenGesorteerd(){
  return Object.entries(state.categorieen || {}).sort((a,b) => (a[1].aangemaakt||0)-(b[1].aangemaakt||0));
}
function categorieToevoegen(naam){
  naam = (naam || "").trim();
  if(!naam) return;
  const bestaatAl = Object.values(state.categorieen || {}).some(c => (c.naam||"").toLowerCase() === naam.toLowerCase());
  if(bestaatAl){ toonToast("Deze categorie bestaat al"); return; }
  db.ref("restaurants/" + state.restaurantCode + "/categorieen").push().set({
    naam: naam,
    aangemaakt: firebase.database.ServerValue.TIMESTAMP,
  });
}
function categorieVerwijderen(id){
  if(!confirm("Deze categorie verwijderen? Producten die deze categorie al hadden, blijven gewoon bestaan en verschijnen bij Bestellen nog steeds onder hun (oude) categorienaam.")) return;
  db.ref("restaurants/" + state.restaurantCode + "/categorieen/" + id).remove();
}

// ---------- systeemupdates als gelezen markeren (alleen lokaal, per apparaat) ----------
function updateGelezenMarkeren(id){
  if(!state.gelezenUpdates.includes(id)){
    state.gelezenUpdates.push(id);
    localStorage.setItem("ticket_gelezen_updates", JSON.stringify(state.gelezenUpdates));
  }
  render();
}

// ---------- team & rechten (alleen te beheren door de eigenaar van het restaurant) ----------
function ledFunctieWijzigen(ledId, functie){
  db.ref("restaurants/" + state.restaurantCode + "/leden/" + ledId + "/functie").set(functie.trim());
}
function ledRechtToggle(ledId, recht, waarde){
  db.ref("restaurants/" + state.restaurantCode + "/leden/" + ledId + "/rechten/" + recht).set(waarde);
}
function ledVerwijderen(ledId){
  if(!confirm("Dit teamlid verwijderen? Diegene moet opnieuw joinen om weer toegang te krijgen.")) return;
  db.ref("restaurants/" + state.restaurantCode + "/leden/" + ledId).remove();
}

// ---------- plattegrond (tafels & stoelen) ----------
function plattegrondCelKlikken(cel){
  if(!heeftRecht('instellingen')) return;
  const tool = state.plattegrondTool;
  const huidige = (state.plattegrond || {})[cel];
  const ref = db.ref("restaurants/" + state.restaurantCode + "/plattegrond/" + cel);
  if(tool === "wissen"){
    if(huidige) ref.remove();
    return;
  }
  if(huidige && huidige.type === tool){
    ref.remove();
  } else if(tool === "tafel"){
    // Nieuwe tafel: geef 'm automatisch het eerstvolgende tafelnummer.
    const bestaandeNummers = Object.values(state.plattegrond || {})
      .filter(c => c.type === "tafel").map(c => c.nummer || 0);
    const volgendeNummer = bestaandeNummers.length ? Math.max(...bestaandeNummers) + 1 : 1;
    ref.set({ type: "tafel", nummer: volgendeNummer, bezet: false });
  } else {
    ref.set({ type: tool });
  }
}

// ---------- sitebeheer (Firebase Authentication — geen wachtwoord meer in de broncode) ----------
// Alleen wie inlogt met een e-mail/wachtwoord-account dat JIJ aanmaakt in de Firebase-console
// (Authentication → Sign-in method → E-mail/wachtwoord) kan dit vak openen. De controle gebeurt
// bij Firebase zelf, niet in dit bestand — dus niet te vinden via "Weergave broncode".
// De écht gevoelige actie (alle restaurants tegelijk opvragen) is bovendien met databaseregels
// afgeschermd tot ingelogde gebruikers — zie de regels in readme.md.
function beheerPaneelOpenen(){
  state.beheerPaneelOpen = true;
  state.beheerFoutmelding = "";
  if(state.beheerderActief) alleRestaurantsLuisteren();
  render();
}
function beheerInloggen(email, wachtwoord){
  email = (email || "").trim();
  wachtwoord = wachtwoord || "";
  if(!email || !wachtwoord){ state.beheerFoutmelding = "Vul e-mail en wachtwoord in."; render(); return; }
  state.beheerFoutmelding = "Bezig met inloggen…";
  render();
  auth.signInWithEmailAndPassword(email, wachtwoord)
    .then(() => {
      // state.beheerderActief wordt door onAuthStateChanged hieronder op true gezet, incl. render()
    })
    .catch(() => {
      state.beheerFoutmelding = "Onjuiste inloggegevens.";
      render();
    });
}
function beheerderUitloggen(){
  auth.signOut();
  db.ref("restaurants").off();
  state.alleRestaurants = {};
  state.alleRestaurantsGeladen = false;
  if(state.beheerBezoekModus) beheerRestaurantVerlaten(false);
  state.beheerPaneelOpen = false;
  render();
}
function beheerPaneelSluiten(){
  if(state.beheerBezoekModus){ beheerRestaurantVerlaten(false); }
  db.ref("restaurants").off();
  state.alleRestaurants = {};
  state.alleRestaurantsGeladen = false;
  state.beheerPaneelOpen = false;
  render();
}
// Luistert live naar élk restaurant in de database, alleen zolang het beheerpaneel open is.
function alleRestaurantsLuisteren(){
  db.ref("restaurants").on("value", snap => {
    state.alleRestaurants = snap.val() || {};
    state.alleRestaurantsGeladen = true;
    render();
  });
}
// Als beheerder een restaurant van iemand anders openen — met volledige rechten, zonder
// dat dit iets aan je eigen apparaat-instellingen (localStorage) verandert.
function beheerRestaurantBezoeken(code){
  const gegevens = state.alleRestaurants[code];
  if(!gegevens) return;
  state.beheerBezoekModus = true;
  state.restaurantCode = code;
  state.restaurantNaam = gegevens.naam || code;
  state.ledId = null;               // geen lid van dit restaurant → heeftRecht() staat alles toe
  state.gebruikersNaam = "Beheerder";
  state.actiefInRestaurant = true;
  state.huidigeView = "bestellen";
  state.leden = {};
  state.ledenGeladen = false;
  state.thema = null;
  state.plattegrond = {};
  state.categorieen = {};
  db.ref("restaurants/" + code + "/menu").on("value", snap => { state.menu = snap.val() || {}; render(); });
  db.ref("restaurants/" + code + "/bestellingen").on("value", snap => { state.bestellingen = snap.val() || {}; render(); });
  db.ref("restaurants/" + code + "/historie").on("value", snap => { state.historie = snap.val() || {}; render(); });
  db.ref("restaurants/" + code + "/leden").on("value", snap => { state.leden = snap.val() || {}; state.ledenGeladen = true; render(); });
  db.ref("restaurants/" + code + "/thema").on("value", snap => { state.thema = snap.val() || null; toepassenThema(state.thema); render(); });
  db.ref("restaurants/" + code + "/plattegrond").on("value", snap => { state.plattegrond = snap.val() || {}; render(); });
  db.ref("restaurants/" + code + "/categorieen").on("value", snap => { state.categorieen = snap.val() || {}; render(); });
  render();
}
// Sluit het bezoek aan een restaurant af en gaat terug naar het beheerpaneel (tenzij
// doorRender false is, bijv. omdat beheerderUitloggen() zelf al gaat renderen).
function beheerRestaurantVerlaten(doorRender){
  const code = state.restaurantCode;
  if(code){
    db.ref("restaurants/" + code + "/menu").off();
    db.ref("restaurants/" + code + "/bestellingen").off();
    db.ref("restaurants/" + code + "/historie").off();
    db.ref("restaurants/" + code + "/leden").off();
    db.ref("restaurants/" + code + "/thema").off();
    db.ref("restaurants/" + code + "/plattegrond").off();
    db.ref("restaurants/" + code + "/categorieen").off();
  }
  toepassenThema(null);
  state.beheerBezoekModus = false;
  state.restaurantCode = null;
  state.restaurantNaam = null;
  state.ledId = null;
  state.gebruikersNaam = null;
  state.leden = {};
  state.ledenGeladen = false;
  state.thema = null;
  state.plattegrond = {};
  state.categorieen = {};
  state.actiefInRestaurant = false;
  state.winkelwagen = {};
  if(doorRender !== false) render();
}
function beheerRestaurantVerwijderen(code){
  const gegevens = state.alleRestaurants[code];
  const naam = gegevens ? gegevens.naam : code;
  if(!confirm(`Restaurant "${naam}" (${code}) volledig verwijderen? Dit verwijdert al het menu, alle bestellingen en de hele historie, en kan niet ongedaan gemaakt worden.`)) return;
  if(state.beheerBezoekModus && state.restaurantCode === code) beheerRestaurantVerlaten(false);
  db.ref("restaurants/" + code).remove().then(() => {
    toonToast("Restaurant verwijderd");
    render();
  });
}
function siteUpdateToevoegen(titel, tekst){
  if(!state.beheerderActief) return;
  titel = (titel || "").trim();
  tekst = tekst.trim();
  if(!tekst) return;
  db.ref("site_updates").push().set({
    titel: titel,
    tekst: tekst,
    tijdstip: firebase.database.ServerValue.TIMESTAMP,
  });
}
function siteUpdateVerwijderen(id){
  if(!state.beheerderActief) return;
  db.ref("site_updates/" + id).remove();
}

// ---------- winkelwagen ----------
function toevoegenAanWagen(id, item){
  if(!item || item.uitverkocht) return;
  if(state.winkelwagen[id]){
    state.winkelwagen[id].aantal += 1;
  } else {
    state.winkelwagen[id] = {
      naam:item.naam, prijs:item.prijs, emoji:item.emoji||"🍽️", categorie:item.categorie||"Overig",
      aantal:1, notitie:"",
      ijsKeuze: !!item.ijsKeuze,
      slagroomKeuze: !!item.slagroomKeuze,
      ijs: false,
      slagroom: false,
    };
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
function wagenIjsWijzigen(id, waarde){
  if(state.winkelwagen[id]) state.winkelwagen[id].ijs = !!waarde;
}
function wagenSlagroomWijzigen(id, waarde){
  if(state.winkelwagen[id]) state.winkelwagen[id].slagroom = !!waarde;
}
// Bouwt de extra-informatieregel onder een besteld item (notitie, ijs, slagroom).
function itemExtraHtml(it){
  const delen = [];
  if(it.ijs) delen.push("🧊 Met ijs");
  if(it.slagroom) delen.push("🥛 Met slagroom");
  if(it.notitie) delen.push(it.notitie);
  return delen.length ? `<span class="ticket__item-notitie">— ${delen.join(" · ")}</span>` : "";
}

// ---------- zelfbestellen: QR-code + printen ----------
function qrLinkKopieren(){
  navigator.clipboard?.writeText(zelfBestelUrl(state.restaurantCode));
  toonToast("Link gekopieerd");
}
// Zet de QR-afbeelding tijdelijk in een eigen print-vak buiten #app, print 'm, en ruimt dat
// vak daarna weer op. Wacht (indien nodig) tot de afbeelding echt geladen is voordat het
// printvenster opent, zodat 'ie nooit als leeg vak wordt afgedrukt.
function qrPrinten(){
  const bronImg = document.getElementById("qr-img-algemeen");
  if(!bronImg) return;
  const printVak = document.createElement("div");
  printVak.id = "print-qr-vak";
  printVak.innerHTML = `
    <div class="print-qr__naam">${state.restaurantNaam}</div>
    <img id="print-qr-img" src="${bronImg.src}" alt="QR-code om zelf te bestellen">
    <div class="print-qr__uitleg">Scan om zelf te bestellen</div>
    <div class="print-qr__code">Code: ${state.restaurantCode}</div>
  `;
  document.body.appendChild(printVak);
  const opruimen = () => { printVak.remove(); window.removeEventListener("afterprint", opruimen); };
  window.addEventListener("afterprint", opruimen);

  const printImg = document.getElementById("print-qr-img");
  if(printImg.complete && printImg.naturalWidth > 0){
    window.print();
  } else {
    printImg.addEventListener("load", () => window.print(), { once: true });
    printImg.addEventListener("error", () => {
      toonToast("QR-code kon niet geladen worden — controleer je internetverbinding");
      opruimen();
    }, { once: true });
  }
}

// ============================================================
// RENDER
// ============================================================
function render(){
  if(state.beheerPaneelOpen && !state.beheerBezoekModus){
    renderBeheerPaneel();
  } else if(!state.actiefInRestaurant){
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
    const siteUpdatesArr = Object.entries(state.siteUpdates || {})
      .filter(([id]) => !state.gelezenUpdates.includes(id))
      .sort((a,b) => (b[1].tijdstip||0)-(a[1].tijdstip||0))
      .slice(0,2);
    const nieuwsHtml = siteUpdatesArr.length ? `
      <div class="nieuws-teaser">
        <div class="nieuws-teaser__titel">Nieuw in ${MERKNAAM}</div>
        ${siteUpdatesArr.map(([id,u]) => `
          <div class="nieuws-teaser__regel">
            <span>${u.titel ? `<b>${u.titel}</b> — ` : ""}${u.tekst}</span>
            <button type="button" class="nieuws-teaser__gelezen" data-action="update-gelezen" data-id="${id}" title="Verberg deze update op het startscherm">Gelezen ✕</button>
          </div>`).join("")}
      </div>` : "";

    const restaurantsHtml = state.mijnRestaurants.length ? `
      <div class="landing__mijn-restaurants">
        ${state.mijnRestaurants.map(r => `
          <button class="choice-card choice-card--actief" data-action="doorgaan-restaurant" data-code="${r.code}" style="width:320px;">
            <div class="choice-card__title">Verder naar ${r.naam}</div>
            <p class="choice-card__desc">Code ${r.code} — ga er direct naartoe.</p>
          </button>`).join("")}
      </div>` : "";

    const kanNogMeer = state.mijnRestaurants.length < MAX_RESTAURANTS_PER_PERSOON;
    const keuzesHtml = kanNogMeer ? `
      <div class="landing__choices">
        <button class="choice-card" data-action="ga-maken">
          <div class="choice-card__title">Restaurant maken</div>
          <p class="choice-card__desc">Start een nieuw restaurant en krijg een unieke code om mee te delen met je team.</p>
        </button>
        <button class="choice-card" data-action="ga-joinen">
          <div class="choice-card__title">Restaurant joinen</div>
          <p class="choice-card__desc">Heb je al een code gekregen? Sluit je aan bij een bestaand restaurant.</p>
        </button>
      </div>` : `
      <p class="landing__limiet">Je hebt al ${MAX_RESTAURANTS_PER_PERSOON} restaurants op dit apparaat — dat is het maximum. Vraag een eigenaar om je als teamlid te verwijderen, of vraag sitebeheer om een restaurant te verwijderen, om weer plek te maken.</p>`;

    root.innerHTML = `
      <div class="landing">
        ${merk}
        <p class="landing__sub">Waar wilt u naartoe?</p>
        ${restaurantsHtml}
        ${keuzesHtml}
        ${nieuwsHtml}
        <button class="terug-link" data-action="beheer-open">⚙ Sitebeheer</button>
      </div>`;
  } else if(state.landingScherm === "maken"){
    root.innerHTML = `
      <div class="landing">
        ${merk}
        <div class="form-card">
          <label class="form-card__label">Naam van je restaurant</label>
          <input id="input-naam" type="text" placeholder="Bijv. De Gouden Pan" autofocus>
          <label class="form-card__label">Jouw naam</label>
          <input id="input-eigen-naam-maken" type="text" placeholder="Bijv. Sara">
          ${state.foutmelding ? `<div class="fout">${state.foutmelding}</div>` : ""}
          <button class="btn btn--flame btn--block" data-action="maak-restaurant">Restaurant aanmaken</button>
          <button class="terug-link" data-action="terug-landing">← Terug</button>
        </div>
      </div>`;
    const verstuurMaken = () => restaurantMaken(
      document.getElementById("input-naam").value,
      document.getElementById("input-eigen-naam-maken").value
    );
    document.getElementById("input-naam").addEventListener("keydown", e => { if(e.key === "Enter") verstuurMaken(); });
    document.getElementById("input-eigen-naam-maken").addEventListener("keydown", e => { if(e.key === "Enter") verstuurMaken(); });
  } else if(state.landingScherm === "joinen"){
    root.innerHTML = `
      <div class="landing">
        ${merk}
        <div class="form-card">
          <label class="form-card__label">Restaurantcode</label>
          <input id="input-code" type="text" placeholder="Bijv. K3F7Q" autofocus style="text-transform:uppercase; letter-spacing:.1em;">
          <label class="form-card__label">Jouw naam</label>
          <input id="input-eigen-naam-joinen" type="text" placeholder="Bijv. Sara">
          ${state.foutmelding ? `<div class="fout">${state.foutmelding}</div>` : ""}
          <button class="btn btn--flame btn--block" data-action="join-restaurant">Restaurant joinen</button>
          <button class="terug-link" data-action="terug-landing">← Terug</button>
        </div>
      </div>`;
    const verstuurJoinen = () => restaurantJoinen(
      document.getElementById("input-code").value,
      document.getElementById("input-eigen-naam-joinen").value
    );
    document.getElementById("input-code").addEventListener("keydown", e => { if(e.key === "Enter") verstuurJoinen(); });
    document.getElementById("input-eigen-naam-joinen").addEventListener("keydown", e => { if(e.key === "Enter") verstuurJoinen(); });
  }
}

// ============================================================
// SITEBEHEER (wachtwoord-vak voor de eigenaar van de website)
// ============================================================
function renderBeheerPaneel(){
  if(!state.beheerderActief){
    root.innerHTML = `
      <div class="landing">
        <div class="landing__mark">
          <div class="landing__eyebrow">${MERKNAAM}</div>
          <h1 class="landing__title">Sitebeheer</h1>
          <div class="landing__divider"><span class="landing__diamond"></span></div>
        </div>
        <div class="form-card">
          <label class="form-card__label">E-mailadres</label>
          <input id="beheer-email" type="email" placeholder="jij@voorbeeld.nl" autofocus>
          <label class="form-card__label">Wachtwoord</label>
          <input id="beheer-wachtwoord" type="password" placeholder="••••••••">
          ${state.beheerFoutmelding ? `<div class="fout">${state.beheerFoutmelding}</div>` : ""}
          <button class="btn btn--flame btn--block" data-action="beheer-inloggen">Inloggen</button>
          <button class="terug-link" data-action="beheer-sluiten">← Terug</button>
        </div>
      </div>`;
    const verstuur = () => beheerInloggen(
      document.getElementById("beheer-email").value,
      document.getElementById("beheer-wachtwoord").value
    );
    document.getElementById("beheer-email").addEventListener("keydown", e => { if(e.key === "Enter") verstuur(); });
    document.getElementById("beheer-wachtwoord").addEventListener("keydown", e => { if(e.key === "Enter") verstuur(); });
    return;
  }

  const restaurantsArr = Object.entries(state.alleRestaurants || {}).sort((a,b) => (b[1].aangemaakt||0)-(a[1].aangemaakt||0));
  const restaurantsHtml = !state.alleRestaurantsGeladen ? `<div class="leeg">Restaurants laden…</div>`
    : restaurantsArr.length === 0 ? `<div class="leeg">Nog geen restaurants aangemaakt.</div>`
    : restaurantsArr.map(([code, r]) => {
        const aantalLeden = Object.keys(r.leden || {}).length;
        const aantalProducten = Object.keys(r.menu || {}).length;
        const aantalOpenstaand = Object.keys(r.bestellingen || {}).length;
        const aantalHistorie = Object.keys(r.historie || {}).length;
        const datum = r.aangemaakt ? new Date(r.aangemaakt).toLocaleDateString("nl-NL",{day:"2-digit",month:"2-digit",year:"numeric"}) : "";
        return `
        <div class="beheer-rest-rij">
          <div class="beheer-rest-rij__info">
            <div class="beheer-rest-rij__naam">${r.naam || "(zonder naam)"} <span class="team-rij__badge">${code}</span></div>
            <div class="beheer-rest-rij__meta">
              ${aantalLeden} teamlid${aantalLeden===1?"":"en"} · ${aantalProducten} product${aantalProducten===1?"":"en"} ·
              ${aantalOpenstaand} openstaande bestelling${aantalOpenstaand===1?"":"en"} · ${aantalHistorie} in historie
              ${datum ? ` · aangemaakt ${datum}` : ""}
            </div>
          </div>
          <div class="beheer-rest-rij__acties">
            <button class="btn btn--steel btn--sm" data-action="beheer-bezoeken" data-id="${code}">Bezoeken</button>
            <button class="btn btn--ghost btn--sm" style="border-color:var(--ember); color:var(--ember);" data-action="beheer-verwijderen" data-id="${code}">Verwijderen</button>
          </div>
        </div>`;
      }).join("");

  const siteUpdatesArr = Object.entries(state.siteUpdates || {}).sort((a,b) => (b[1].tijdstip||0)-(a[1].tijdstip||0));
  const siteUpdatesHtml = siteUpdatesArr.length ? siteUpdatesArr.map(([id,u]) => {
    const datum = u.tijdstip ? new Date(u.tijdstip).toLocaleString("nl-NL",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "";
    return `<li>
      <div>
        <span class="update-lijst__datum">${datum}</span>
        ${u.titel ? `<span class="update-lijst__titel">${u.titel}</span>` : ""}
        <span>${u.tekst}</span>
      </div>
      <button class="verwijder-x" data-action="site-update-verwijder" data-id="${id}">✕</button>
    </li>`;
  }).join("") : `<div class="leeg">Nog geen updates geplaatst.</div>`;

  root.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="topbar__id">
          <div class="topbar__naam">🔒 Sitebeheer</div>
        </div>
        <div style="display:flex; gap:14px; align-items:center;">
          <button class="terug-link" style="margin:0;" data-action="beheer-uitloggen">Uitloggen</button>
          <button class="terug-link" style="margin:0;" data-action="beheer-sluiten">← Terug naar ${MERKNAAM}</button>
        </div>
      </header>
      <main class="view">
        <h2 class="view-titel">Alle restaurants</h2>
        <div class="instel-blok">
          <div class="beheer-rest-lijst">${restaurantsHtml}</div>
        </div>

        <h2 class="view-titel">Systeemupdates</h2>
        <div class="instel-blok">
          <p style="color:var(--text-dim); font-size:.8rem; margin:-4px 0 14px;">Zichtbaar voor iedereen die ${MERKNAAM} gebruikt.</p>
          <div class="update-form">
            <input id="site-update-titel" placeholder="Titel (optioneel)">
            <div class="update-form__row">
              <input id="site-update-tekst" placeholder="Wat is er veranderd?">
              <button class="btn btn--flame" data-action="site-update-toevoegen">Plaatsen</button>
            </div>
          </div>
          <ul class="update-lijst">${siteUpdatesHtml}</ul>
        </div>
      </main>
    </div>`;
}

function renderDashboard(){
  const bestellingenArr = Object.entries(state.bestellingen || {});
  const aantalNieuw = bestellingenArr.filter(([,b]) => b.status === "nieuw").length;
  const aantalKlaar = bestellingenArr.filter(([,b]) => b.status === "klaar").length;

  // Alleen tabbladen tonen waar dit teamlid rechten voor heeft; Instellingen is altijd zichtbaar
  // (code bekijken / restaurant verlaten kan iedereen).
  const tabsConfig = [
    { key:"bestellen", label:"Bestellen" },
    { key:"keuken", label:`Keuken ${aantalNieuw?`<span class="badge">${aantalNieuw}</span>`:""}` },
    { key:"bezorgen", label:`Bezorgen ${aantalKlaar?`<span class="badge">${aantalKlaar}</span>`:""}` },
    { key:"historie", label:"Historie" },
  ].filter(t => heeftRecht(t.key));
  if(heeftRecht('instellingen')) tabsConfig.push({ key:"voorraad", label:"Voorraad" });
  tabsConfig.push({ key:"instellingen", label:"Instellingen" });

  if(!tabsConfig.some(t => t.key === state.huidigeView)){
    state.huidigeView = tabsConfig[0].key;
  }

  const tabsHtml = tabsConfig.map(t =>
    `<button class="tab ${state.huidigeView===t.key?'actief':''}" data-action="wissel-view" data-view="${t.key}">${t.label}</button>`
  ).join("");

  root.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="topbar__id">
          <div class="topbar__naam">${state.restaurantNaam}</div>
          <button class="topbar__code" data-action="kopieer-code" title="Klik om code te kopiëren">${state.restaurantCode}</button>
          ${state.beheerBezoekModus ? `<span class="beheer-badge">🔒 Beheerder-weergave</span>` : ""}
        </div>
        <div style="display:flex; gap:14px; align-items:center;">
          ${state.beheerBezoekModus ? `<button class="terug-link" style="margin:0;" data-action="beheer-terug-paneel">← Terug naar beheerpaneel</button>` : `<button class="terug-link" style="margin:0;" data-action="terug-naar-start">🔀 Wissel restaurant</button>`}
          ${state.gebruikersNaam ? `<div class="topbar__gebruiker">${state.gebruikersNaam}</div>` : ""}
        </div>
      </header>
      <nav class="tabs">${tabsHtml}</nav>
      <main class="view" id="view-inhoud"></main>
    </div>`;

  const inhoud = document.getElementById("view-inhoud");
  if(state.huidigeView === "bestellen") inhoud.innerHTML = renderBestellen();
  else if(state.huidigeView === "keuken") inhoud.innerHTML = renderKeuken();
  else if(state.huidigeView === "bezorgen") inhoud.innerHTML = renderBezorgen();
  else if(state.huidigeView === "historie") inhoud.innerHTML = renderHistorie();
  else if(state.huidigeView === "voorraad") inhoud.innerHTML = renderVoorraad();
  else if(state.huidigeView === "instellingen") inhoud.innerHTML = renderInstellingen();
}

function renderBestellen(){
  const heeftPlattegrond = Object.values(state.plattegrond || {}).some(c => c.type === "tafel");
  if(heeftPlattegrond && state.bestelModus === "plattegrond"){
    return renderBestellenPlattegrond();
  }
  return renderBestellenProducten();
}

// Toont de plattegrond als eerste stap van Bestellen: klik op een tafel om ervoor te bestellen.
function renderBestellenPlattegrond(){
  const RIJEN = 7, KOLOMMEN = 12;
  let cellenHtml = "";
  for(let r=0;r<RIJEN;r++){
    for(let c=0;c<KOLOMMEN;c++){
      const key = r + "-" + c;
      const obj = (state.plattegrond || {})[key];
      if(!obj){
        cellenHtml += `<div class="plattegrond__cel plattegrond__cel--leeg"></div>`;
      } else if(obj.type === "stoel"){
        cellenHtml += `<div class="plattegrond__cel plattegrond__cel--stoel" title="Stoel">🪑</div>`;
      } else {
        const bezet = !!obj.bezet;
        cellenHtml += `
          <button type="button" class="plattegrond__cel plattegrond__cel--tafel ${bezet?'plattegrond__cel--bezet':'plattegrond__cel--vrij'}"
            data-action="bestel-tafel-kiezen" data-cel="${key}" title="Tafel ${obj.nummer||''} — ${bezet?'bezet':'vrij'}">
            🍽️<span class="plattegrond__nr">${obj.nummer||''}</span>
          </button>`;
      }
    }
  }

  return `
    <h2 class="view-titel">Bestellen</h2>
    <p class="plattegrond-uitleg">Klik op een tafel om er een bestelling voor te plaatsen.</p>
    <div class="plattegrond-legenda">
      <span><span class="legenda-stip legenda-stip--vrij"></span>Vrij</span>
      <span><span class="legenda-stip legenda-stip--bezet"></span>Bezet</span>
    </div>
    <div class="plattegrond-wrap">
      <div class="plattegrond-grid" style="grid-template-columns:repeat(${KOLOMMEN}, 1fr);">${cellenHtml}</div>
    </div>
    <button class="btn btn--ghost" style="margin-top:18px;" data-action="bestel-zonder-tafel">Bestelling zonder tafel</button>`;
}

function renderBestellenProducten(){
  const menuArr = Object.entries(state.menu || {});
  const categorieVolgorde = categorieenGesorteerd().map(([,c]) => c.naam);
  const gebruikteCategorieen = [...new Set(menuArr.map(([,i]) => i.categorie || "Overig"))];
  const categorieen = [
    ...categorieVolgorde.filter(cat => gebruikteCategorieen.includes(cat)),
    ...gebruikteCategorieen.filter(cat => !categorieVolgorde.includes(cat)),
  ];

  let productenHtml = "";
  if(menuArr.length === 0){
    productenHtml = `<div class="leeg">Nog geen producten. Voeg ze toe via Instellingen.</div>`;
  } else {
    categorieen.forEach(cat => {
      productenHtml += `<div class="categorie-titel">${cat}</div><div class="product-grid">`;
      menuArr.filter(([,i]) => (i.categorie||"Overig") === cat).forEach(([id,i]) => {
        const uitverkocht = !!i.uitverkocht;
        const opties = [];
        if(i.ijsKeuze) opties.push("🧊");
        if(i.slagroomKeuze) opties.push("🥛");
        productenHtml += `
          <button class="product-card ${uitverkocht?'product-card--uitverkocht':''}" ${uitverkocht?'disabled':'data-action="toevoegen-wagen"'} data-id="${id}">
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
            <button data-action="wagen-min" data-id="${id}">−</button>
            <span>${i.aantal}</span>
            <button data-action="wagen-plus" data-id="${id}">+</button>
          </div>
        </div>
        ${i.ijsKeuze ? `
          <label class="wagen__checkbox">
            <input type="checkbox" data-action="wagen-ijs" data-id="${id}" ${i.ijs?"checked":""}>
            🧊 Met ijs
          </label>` : ""}
        ${i.slagroomKeuze ? `
          <label class="wagen__checkbox">
            <input type="checkbox" data-action="wagen-slagroom" data-id="${id}" ${i.slagroom?"checked":""}>
            🥛 Met slagroom
          </label>` : ""}
        <input class="wagen__notitie" placeholder="Notitie, bijv. 'geen ui'" value="${i.notitie||""}" data-action="wagen-notitie" data-id="${id}">
        <button class="wagen__verwijder" data-action="wagen-verwijder" data-id="${id}">verwijderen</button>
      </div>`).join("");
  }

  const heeftPlattegrond = Object.values(state.plattegrond || {}).some(c => c.type === "tafel");
  const actieveCel = state.actieveTafelCel ? (state.plattegrond || {})[state.actieveTafelCel] : null;

  return `
    <div class="bestel-layout">
      <div>
        <h2 class="view-titel">Bestellen</h2>
        ${productenHtml}
      </div>
      <div class="wagen">
        <div class="wagen__titel">Bestelling</div>
        ${heeftPlattegrond ? `<button type="button" class="terug-link" data-action="bestel-terug-plattegrond">← Terug naar plattegrond</button>` : ""}
        ${state.actieveTafelCel ? `
          <div class="wagen__tafel-label">
            🍽️ Tafel ${actieveCel ? actieveCel.nummer : ""}
            ${actieveCel && actieveCel.bezet ? `<span class="tafel-status tafel-status--bezet">bezet</span>` : `<span class="tafel-status tafel-status--vrij">nog vrij</span>`}
          </div>
        ` : `<input class="wagen__tafel" placeholder="Tafel / naam (optioneel)" value="${state.tafel}" data-action="tafel-invoer">`}
        ${wagenHtml}
        <div class="wagen__totaal"><span>Totaal</span><span>${euro(totaal)}</span></div>
        <button class="btn btn--flame btn--block" data-action="verzend-bestelling" ${wagenItems.length?"":"disabled"}>Bestelling verzenden</button>
        ${state.actieveTafelCel && actieveCel && actieveCel.bezet ? `
          <button type="button" class="btn btn--steel btn--block" style="margin-top:10px;" data-action="tafel-betaald">Tafel betaald — vrijgeven</button>
        ` : ""}
      </div>
    </div>`;
}

function ticketHtml(id, b, kolom){
  const items = (b.items||[]).map(it => `
    <li class="ticket__item"><b>${it.aantal}×</b> ${it.emoji?it.emoji+" ":""}${it.naam}
      ${itemExtraHtml(it)}
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

function renderHistorie(){
  const historieArr = Object.entries(state.historie || {})
    .sort((a,b) => (b[1].bezorgd||b[1].aangemaakt||0) - (a[1].bezorgd||a[1].aangemaakt||0));

  const tellingen = {};
  historieArr.forEach(([,b]) => {
    (b.items||[]).forEach(it => {
      const cat = it.categorie || "Overig";
      tellingen[cat] = (tellingen[cat]||0) + (it.aantal||0);
    });
  });
  const tellingenArr = Object.entries(tellingen).sort((a,b) => b[1]-a[1]);

  const tabelHtml = tellingenArr.length ? `
    <table class="historie-tabel">
      <thead><tr><th>Categorie</th><th>Aantal besteld</th></tr></thead>
      <tbody>
        ${tellingenArr.map(([cat,aantal]) => `<tr><td>${cat}</td><td>${aantal}×</td></tr>`).join("")}
      </tbody>
    </table>` : `<div class="leeg">Nog geen geschiedenis om te tellen.</div>`;

  const lijstHtml = historieArr.map(([id,b]) => {
    const tijd = b.bezorgd ? new Date(b.bezorgd).toLocaleString("nl-NL",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "";
    const items = (b.items||[]).map(it => `
      <li class="ticket__item"><b>${it.aantal}×</b> ${it.emoji?it.emoji+" ":""}${it.naam}
        ${itemExtraHtml(it)}
      </li>`).join("");
    return `
      <div class="ticket">
        <div class="ticket__top">
          <div class="ticket__nr">#${id.slice(-5).toUpperCase()}</div>
          <div class="ticket__tijd">${tijd}</div>
          <button class="ticket__verwijder" data-action="historie-verwijder" data-id="${id}" title="Bestelling verwijderen">✕</button>
        </div>
        ${b.tafel ? `<div class="ticket__tafel">${b.tafel}</div>` : ""}
        <ul class="ticket__items">${items}</ul>
      </div>`;
  }).join("");

  return `
    <h2 class="view-titel">Historie</h2>

    <div class="instel-blok">
      <div class="instel-blok__titel">Bestellingen per categorie</div>
      ${tabelHtml}
    </div>

    <div class="instel-blok">
      <div class="instel-blok__titel" style="display:flex; justify-content:space-between; align-items:center;">
        <span>Alle bezorgde bestellingen (${historieArr.length})</span>
        ${historieArr.length ? `<button class="btn btn--ghost btn--sm" data-action="historie-wissen">Hele historie wissen</button>` : ""}
      </div>
      <div class="ticket-stack">
        ${lijstHtml || `<div class="leeg">Nog geen bezorgde bestellingen.</div>`}
      </div>
    </div>`;
}

// ============================================================
// INSTELLINGEN — met subnavigatie: Algemeen / Producten / Achtergrond / Plattegrond
// ============================================================
const THEMA_PRESETS = [
  { naam:"Kastanje",   achtergrond:"#150f0b", tekst:"#f3ead9" },
  { naam:"Middernacht", achtergrond:"#0d1420", tekst:"#e8eef7" },
  { naam:"Olijf",      achtergrond:"#1b2016", tekst:"#eef2e6" },
  { naam:"Bordeaux",   achtergrond:"#1f0d12", tekst:"#f5e6ea" },
  { naam:"Grafiet",    achtergrond:"#161616", tekst:"#f1f1f1" },
  { naam:"Crème",      achtergrond:"#f2ead9", tekst:"#241a12" },
];

function renderInstellingen(){
  const subtabs = [{ key:"algemeen", label:"Algemeen" }];
  if(heeftRecht('instellingen')) subtabs.push({ key:"producten", label:"Producten" });
  if(heeftRecht('instellingen')) subtabs.push({ key:"achtergrond", label:"Achtergrond" });
  if(heeftRecht('instellingen')) subtabs.push({ key:"plattegrond", label:"Plattegrond" });

  if(!subtabs.some(t => t.key === state.instellingenTab)) state.instellingenTab = subtabs[0].key;

  const subnavHtml = subtabs.map(t =>
    `<button class="subtab ${state.instellingenTab===t.key?'actief':''}" data-action="instellingen-subtab" data-tab="${t.key}">${t.label}</button>`
  ).join("");

  let inhoudHtml = "";
  if(state.instellingenTab === "algemeen") inhoudHtml = renderInstellingenAlgemeen();
  else if(state.instellingenTab === "producten") inhoudHtml = renderInstellingenProducten();
  else if(state.instellingenTab === "achtergrond") inhoudHtml = renderInstellingenAchtergrond();
  else if(state.instellingenTab === "plattegrond") inhoudHtml = renderPlattegrond();

  return `
    <h2 class="view-titel">Instellingen</h2>
    <div class="subtabs">${subnavHtml}</div>
    ${inhoudHtml}`;
}

function renderInstellingenAlgemeen(){
  const eigenLid = state.leden[state.ledId];
  const isEigenaar = !!(eigenLid && eigenLid.eigenaar);
  const ledenArr = Object.entries(state.leden || {}).sort((a,b) => (a[1].aangemaakt||0)-(b[1].aangemaakt||0));

  const teamHtml = isEigenaar ? `
    <div class="instel-blok">
      <div class="instel-blok__titel">Team &amp; rechten</div>
      <p style="color:var(--text-dim); font-size:.8rem; margin:-4px 0 14px;">Stel per teamlid een functie en rechten in — dat bepaalt welke tabbladen diegene te zien krijgt.</p>
      <div class="team-lijst">
        ${ledenArr.map(([id, lid]) => `
          <div class="team-rij">
            <div class="team-rij__naam">${lid.naam}${lid.eigenaar ? ' <span class="team-rij__badge">Eigenaar</span>' : ""}</div>
            ${lid.eigenaar ? "" : `
              <input class="team-rij__functie" placeholder="Functie, bijv. Ober" value="${lid.functie||""}" data-action="functie-wijzigen" data-id="${id}">
              <div class="team-rij__rechten">
                ${RECHTEN_DEFINITIES.map(r => `
                  <label class="team-recht">
                    <input type="checkbox" data-action="recht-toggle" data-id="${id}" data-recht="${r.key}" ${lid.rechten && lid.rechten[r.key] ? "checked" : ""}>
                    ${r.label}
                  </label>`).join("")}
              </div>
              <button class="verwijder-x" data-action="lid-verwijderen" data-id="${id}" title="Teamlid verwijderen">✕</button>
            `}
          </div>`).join("")}
      </div>
    </div>` : "";

  return `
    <div class="instel-blok">
      <div class="instel-blok__titel">Restaurantnaam</div>
      ${heeftRecht('instellingen') ? `
        <div class="naam-wijzig-form">
          <input id="restaurant-naam-invoer" value="${state.restaurantNaam}">
          <button class="btn btn--flame btn--sm" data-action="naam-opslaan">Opslaan</button>
        </div>` : `<div>${state.restaurantNaam}</div>`}
    </div>

    <div class="instel-blok">
      <div class="instel-blok__titel">Restaurantcode</div>
      <div class="code-tonen">
        <div class="code-tonen__code">${state.restaurantCode}</div>
        <button class="btn btn--ghost btn--sm" data-action="kopieer-code">Code kopiëren</button>
      </div>
      <p style="color:var(--text-dim); font-size:.82rem; margin-top:12px;">Deel deze code met collega's zodat zij kunnen joinen op hun eigen apparaat.</p>
    </div>

    ${teamHtml}

    <div class="instel-blok">
      <div class="instel-blok__titel">Zelfbestellen (QR-code)</div>
      <p style="color:var(--text-dim); font-size:.82rem; margin:-4px 0 14px;">Gasten scannen deze code, kiezen hun eigen tafel en bestellen zelf — de bestelling komt gewoon bij Keuken binnen, precies zoals bij een bestelling die het team invoert.</p>
      <div class="qr-vak"><img id="qr-img-algemeen" src="${zelfBestelQrAfbeeldingUrl(state.restaurantCode)}" width="220" height="220" alt="QR-code naar de zelfbestel-pagina"></div>
      <div class="qr-link-tonen">
        <input readonly value="${zelfBestelUrl(state.restaurantCode)}">
        <button class="btn btn--ghost btn--sm" data-action="qr-link-kopieren">Link kopiëren</button>
      </div>
      <button class="btn btn--flame btn--block" style="margin-top:12px;" data-action="qr-printen">🖨️ Printen als PDF</button>
    </div>

    <div class="instel-blok">
      <div class="instel-blok__titel">Dit restaurant</div>
      ${state.beheerBezoekModus ? `
        <p style="color:var(--text-dim); font-size:.82rem; margin:0 0 12px;">Je bekijkt dit restaurant als beheerder — dit apparaat is er geen lid van.</p>
        <button class="btn btn--ghost" data-action="beheer-terug-paneel">← Terug naar beheerpaneel</button>
      ` : `
        <p style="color:var(--text-dim); font-size:.82rem; margin:0 0 12px;">Je kunt een restaurant niet zelf verlaten — het blijft in je lijst staan, ook op dit apparaat. Alleen de eigenaar (door jou als teamlid te verwijderen) of sitebeheer (door het hele restaurant te verwijderen) kan het uit je lijst halen.</p>
        <button class="btn btn--ghost" data-action="terug-naar-start">🔀 Wissel naar een ander restaurant</button>
      `}
    </div>

    <button class="terug-link" data-action="beheer-open">⚙ Sitebeheer</button>`;
}

function renderInstellingenProducten(){
  const menuArr = Object.entries(state.menu || {});
  const categorieenArr = categorieenGesorteerd();
  const categorieLijstHtml = categorieenArr.length ? categorieenArr.map(([id,c]) => `
    <span class="categorie-chip">${c.naam}<button type="button" class="categorie-chip__x" data-action="categorie-verwijder" data-id="${id}" title="Categorie verwijderen">✕</button></span>
  `).join("") : `<div class="leeg">Nog geen categorieën. Maak er hieronder een aan.</div>`;
  const categorieOptiesHtml = categorieenArr.map(([,c]) => `<option value="${c.naam}">${c.naam}</option>`).join("");

  const menuHtml = menuArr.length ? menuArr.map(([id,i]) => `
    <li>
      <span>${i.emoji||"🍽️"} ${i.naam} <span class="cat">${i.categorie}</span>${i.ijsKeuze?' <span class="cat">🧊 ijs</span>':''}${i.slagroomKeuze?' <span class="cat">🥛 slagroom</span>':''}${i.uitverkocht?' <span class="cat cat--uitverkocht">uitverkocht</span>':''}</span>
      <span style="display:flex; align-items:center; gap:10px;">
        <span>${euro(i.prijs)}</span>
        <button class="verwijder-x" data-action="menu-verwijder" data-id="${id}">✕</button>
      </span>
    </li>`).join("") : `<div class="leeg">Nog geen producten toegevoegd.</div>`;

  const emojiGrid = state.emojiPickerOpen ? `
    <div class="emoji-grid">
      ${Object.entries(EMOJI_CATEGORIEEN).map(([cat, lijst]) => `
        <div class="emoji-grid__categorie">${cat}</div>
        <div class="emoji-grid__rij">
          ${lijst.map(e => `<button type="button" data-action="emoji-kies" data-emoji="${e}" class="${e===state.nieuwProductEmoji?'actief':''}">${e}</button>`).join("")}
        </div>
      `).join("")}
    </div>` : "";

  return `
    <div class="instel-blok">
      <div class="instel-blok__titel">Categorieën</div>
      <p style="color:var(--text-dim); font-size:.82rem; margin:-4px 0 14px;">Maak hier eerst een categorie aan — die kies je daarna bij het toevoegen van een product. Bij Bestellen staan de producten van elke categorie in een rijtje onder de naam van die categorie.</p>
      <div class="categorie-lijst">${categorieLijstHtml}</div>
      <div class="categorie-form">
        <input id="nieuwe-categorie" placeholder="Nieuwe categorie, bijv. Dranken">
        <button class="btn btn--flame btn--sm" data-action="categorie-toevoegen">Toevoegen</button>
      </div>
    </div>

    <div class="instel-blok">
      <div class="instel-blok__titel">Producten</div>
      <div class="menu-form">
        <div class="emoji-kiezer">
          <button type="button" class="emoji-kiezer__knop" data-action="emoji-toggle">${state.nieuwProductEmoji}</button>
          ${emojiGrid}
        </div>
        <input id="menu-naam" placeholder="Productnaam">
        <input id="menu-prijs" placeholder="Prijs (bijv. 5.50)">
        <select id="menu-categorie" ${categorieenArr.length?"":"disabled"}>
          ${categorieenArr.length ? categorieOptiesHtml : `<option value="">Maak eerst een categorie</option>`}
        </select>
        <button class="btn btn--flame" data-action="menu-toevoegen" ${categorieenArr.length?"":"disabled"}>Toevoegen</button>
      </div>
      <div class="menu-form__opties">
        <label class="menu-form__optie">
          <input type="checkbox" id="menu-ijskeuze">
          🧊 IJskeuze aanbieden (ijsklontjes, ja/nee)
        </label>
        <label class="menu-form__optie">
          <input type="checkbox" id="menu-slagroom">
          🥛 Slagroomkeuze aanbieden
        </label>
      </div>
      <ul class="menu-lijst">${menuHtml}</ul>
    </div>`;
}

function renderVoorraad(){
  const menuArr = Object.entries(state.menu || {});
  const lijstHtml = menuArr.length ? menuArr.map(([id,i]) => `
    <li class="voorraad-rij ${i.uitverkocht?'voorraad-rij--uitverkocht':''}">
      <span class="voorraad-rij__naam">${i.emoji||"🍽️"} ${i.naam} <span class="cat">${i.categorie}</span></span>
      <label class="voorraad-toggle">
        <input type="checkbox" data-action="voorraad-toggle" data-id="${id}" ${i.uitverkocht?"checked":""}>
        <span>Uitverkocht</span>
      </label>
    </li>`).join("") : `<div class="leeg">Nog geen producten toegevoegd.</div>`;

  return `
    <h2 class="view-titel">Voorraad</h2>
    <div class="instel-blok">
      <p style="color:var(--text-dim); font-size:.82rem; margin:-4px 0 16px;">Zet een product op uitverkocht om het tijdelijk te verbergen bij Bestellen, zonder het te verwijderen.</p>
      <ul class="voorraad-lijst">${lijstHtml}</ul>
    </div>`;
}

const REGENBOOG_KLEUREN = [
  "#e6194b","#f58231","#ffe119","#bfef45","#3cb44b","#42d4f4",
  "#4363d8","#911eb4","#f032e6","#800000","#a9a9a9","#000000","#ffffff"
];

function renderInstellingenAchtergrond(){
  const huidig = state.thema || {};
  const huidigeAchtergrond = huidig.achtergrond || "#150f0b";
  const huidigeTekst = huidig.tekst || "#f3ead9";
  const huidigPatroon = huidig.patroon || "geen";
  const huidigLettertype = huidig.lettertype || "standaard";

  const presetsHtml = THEMA_PRESETS.map(p => `
    <button type="button" class="thema-swatch ${huidigeAchtergrond.toLowerCase()===p.achtergrond.toLowerCase() && huidigeTekst.toLowerCase()===p.tekst.toLowerCase() ? 'actief':''}"
      style="background:${p.achtergrond}; color:${p.tekst};"
      data-action="thema-preset" data-bg="${p.achtergrond}" data-tekst="${p.tekst}">
      Aa<br><span>${p.naam}</span>
    </button>`).join("");

  const regenboogHtml = REGENBOOG_KLEUREN.map(kleur => `
    <button type="button" class="regenboog-swatch ${huidigeAchtergrond.toLowerCase()===kleur.toLowerCase()?'actief':''}"
      style="background:${kleur};" data-action="thema-regenboog" data-kleur="${kleur}" title="${kleur}"></button>`).join("");

  const patroonHtml = PATROON_OPTIES.map(p => `
    <button type="button" class="patroon-swatch ${huidigPatroon===p.key?'actief':''}" data-action="thema-patroon" data-patroon="${p.key}">
      <span class="patroon-swatch__emoji">${p.emoji || "🚫"}</span>
      <span>${p.naam}</span>
    </button>`).join("");

  const lettertypeHtml = LETTERTYPE_OPTIES.map(f => `
    <button type="button" class="lettertype-swatch ${huidigLettertype===f.key?'actief':''}" style="font-family:${f.ui};" data-action="thema-lettertype" data-lettertype="${f.key}">${f.naam}</button>`).join("");

  return `
    <div class="instel-blok">
      <div class="instel-blok__titel">Achtergrond</div>
      <p style="color:var(--text-dim); font-size:.82rem; margin:-4px 0 16px;">Kies een kant-en-klare combinatie, of stel hieronder je eigen kleuren, patroon en lettertype in. Dit geldt voor alle apparaten van dit restaurant.</p>
      <div class="thema-swatches">${presetsHtml}</div>

      <div class="thema-eigen">
        <div class="thema-eigen__rij">
          <label>Achtergrondkleur</label>
          <input type="color" value="${huidigeAchtergrond}" data-action="thema-achtergrond">
        </div>
        <div class="thema-eigen__rij">
          <label>Tekstkleur</label>
          <input type="color" value="${huidigeTekst}" data-action="thema-tekst">
        </div>
      </div>
    </div>

    <div class="instel-blok">
      <div class="instel-blok__titel">Alle kleuren van de regenboog</div>
      <p style="color:var(--text-dim); font-size:.82rem; margin:-4px 0 14px;">Klik zo op een kleur voor de achtergrond — de tekstkleur past zich automatisch aan zodat alles leesbaar blijft.</p>
      <div class="regenboog-rij">${regenboogHtml}</div>
    </div>

    <div class="instel-blok">
      <div class="instel-blok__titel">Achtergrondpatroon</div>
      <p style="color:var(--text-dim); font-size:.82rem; margin:-4px 0 14px;">Een subtiel, herhalend patroon over de achtergrond.</p>
      <div class="patroon-rij">${patroonHtml}</div>
    </div>

    <div class="instel-blok">
      <div class="instel-blok__titel">Lettertype</div>
      <p style="color:var(--text-dim); font-size:.82rem; margin:-4px 0 14px;">Verander het lettertype van de hele app.</p>
      <div class="lettertype-rij">${lettertypeHtml}</div>
    </div>`;
}

function renderPlattegrond(){
  const magBewerken = heeftRecht('instellingen');
  const RIJEN = 7, KOLOMMEN = 12;
  let cellenHtml = "";
  for(let r=0;r<RIJEN;r++){
    for(let c=0;c<KOLOMMEN;c++){
      const key = r + "-" + c;
      const obj = (state.plattegrond || {})[key];
      const inhoud = obj ? (obj.type === "tafel" ? `🍽️${obj.nummer?`<span class="plattegrond__nr">${obj.nummer}</span>`:""}` : "🪑") : "";
      cellenHtml += `<button type="button" class="plattegrond__cel ${obj?('plattegrond__cel--'+obj.type):''}" data-action="plattegrond-cel" data-cel="${key}" ${magBewerken?"":"disabled"}>${inhoud}</button>`;
    }
  }

  return `
    <div class="instel-blok">
      <div class="instel-blok__titel">Plattegrond</div>
      ${magBewerken ? `
        <div class="plattegrond-tools">
          <button type="button" class="btn btn--sm ${state.plattegrondTool==='tafel'?'btn--flame':'btn--ghost'}" data-action="plattegrond-tool" data-tool="tafel">🍽️ Tafel</button>
          <button type="button" class="btn btn--sm ${state.plattegrondTool==='stoel'?'btn--flame':'btn--ghost'}" data-action="plattegrond-tool" data-tool="stoel">🪑 Stoel</button>
          <button type="button" class="btn btn--sm ${state.plattegrondTool==='wissen'?'btn--flame':'btn--ghost'}" data-action="plattegrond-tool" data-tool="wissen">🧹 Wissen</button>
        </div>
        <p style="color:var(--text-dim); font-size:.8rem; margin:12px 0 16px;">Kies hierboven wat je wilt plaatsen en klik daarna op een vakje. Nogmaals klikken met hetzelfde gereedschap haalt het weer weg. Elke tafel krijgt automatisch een nummer, en verschijnt daarmee klikbaar bij Bestellen.</p>
      ` : ""}
      <div class="plattegrond-wrap">
        <div class="plattegrond-grid" style="grid-template-columns:repeat(${KOLOMMEN}, 1fr);">${cellenHtml}</div>
      </div>
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
    case "maak-restaurant":
      restaurantMaken(
        document.getElementById("input-naam").value,
        document.getElementById("input-eigen-naam-maken").value
      );
      break;
    case "join-restaurant":
      restaurantJoinen(
        document.getElementById("input-code").value,
        document.getElementById("input-eigen-naam-joinen").value
      );
      break;
    case "doorgaan-restaurant": {
      const gekozen = state.mijnRestaurants.find(r => r.code === el.dataset.code);
      if(gekozen){
        state.restaurantCode = gekozen.code;
        state.restaurantNaam = gekozen.naam;
        state.ledId = gekozen.ledId;
        state.gebruikersNaam = gekozen.gebruikersNaam;
        startRestaurant();
      }
      break;
    }

    case "wissel-view": state.huidigeView = el.dataset.view; render(); break;
    case "kopieer-code":
      navigator.clipboard?.writeText(state.restaurantCode);
      toonToast("Code gekopieerd: " + state.restaurantCode);
      break;
    case "terug-naar-start": verlaatHuidigRestaurant(); break;

    case "toevoegen-wagen": toevoegenAanWagen(id, state.menu[id]); break;
    case "wagen-plus": wagenAantalWijzigen(id, 1); break;
    case "wagen-min": wagenAantalWijzigen(id, -1); break;
    case "wagen-verwijder": wagenVerwijderen(id); break;
    case "verzend-bestelling": bestellingVerzenden(); break;

    case "start-bereiden": statusBijwerken(id, "bereiden"); break;
    case "bereiden-klaar": statusBijwerken(id, "klaar"); break;
    case "markeer-bezorgd": bestellingBezorgd(id); break;

    case "historie-verwijder": historieVerwijderen(id); break;
    case "historie-wissen": historieWissen(); break;

    case "beheer-open": beheerPaneelOpenen(); break;
    case "qr-printen": qrPrinten(); break;
    case "qr-link-kopieren": qrLinkKopieren(); break;
    case "beheer-sluiten": beheerPaneelSluiten(); break;
    case "beheer-inloggen":
      beheerInloggen(
        document.getElementById("beheer-email").value,
        document.getElementById("beheer-wachtwoord").value
      );
      break;
    case "beheer-uitloggen": beheerderUitloggen(); break;
    case "beheer-bezoeken": beheerRestaurantBezoeken(id); break;
    case "beheer-verwijderen": beheerRestaurantVerwijderen(id); break;
    case "beheer-terug-paneel": beheerRestaurantVerlaten(); break;
    case "site-update-toevoegen":
      siteUpdateToevoegen(
        document.getElementById("site-update-titel").value,
        document.getElementById("site-update-tekst").value
      );
      break;
    case "site-update-verwijder": siteUpdateVerwijderen(id); break;

    case "lid-verwijderen": ledVerwijderen(id); break;

    case "instellingen-subtab": state.instellingenTab = el.dataset.tab; render(); break;
    case "naam-opslaan":
      restaurantNaamWijzigen(document.getElementById("restaurant-naam-invoer").value);
      break;
    case "thema-preset": themaPresetKiezen(el.dataset.bg, el.dataset.tekst); break;
    case "thema-regenboog":
      db.ref("restaurants/" + state.restaurantCode + "/thema").update({
        achtergrond: el.dataset.kleur,
        tekst: contrastKleur(el.dataset.kleur),
      });
      break;
    case "thema-patroon": themaWijzigen("patroon", el.dataset.patroon); break;
    case "thema-lettertype": themaWijzigen("lettertype", el.dataset.lettertype); break;
    case "plattegrond-tool": state.plattegrondTool = el.dataset.tool; render(); break;
    case "plattegrond-cel": plattegrondCelKlikken(el.dataset.cel); break;

    case "bestel-tafel-kiezen": {
      const cel = el.dataset.cel;
      const celData = state.plattegrond[cel];
      state.actieveTafelCel = cel;
      state.tafel = "Tafel " + (celData && celData.nummer ? celData.nummer : "");
      state.bestelModus = "producten";
      render();
      break;
    }
    case "bestel-zonder-tafel":
      state.actieveTafelCel = null;
      state.tafel = "";
      state.bestelModus = "producten";
      render();
      break;
    case "bestel-terug-plattegrond": state.bestelModus = "plattegrond"; render(); break;
    case "tafel-betaald": tafelBetaald(state.actieveTafelCel); break;

    case "emoji-toggle": state.emojiPickerOpen = !state.emojiPickerOpen; render(); break;
    case "emoji-kies": state.nieuwProductEmoji = el.dataset.emoji; state.emojiPickerOpen = false; render(); break;

    case "menu-toevoegen":
      menuItemToevoegen(
        document.getElementById("menu-naam").value,
        document.getElementById("menu-prijs").value,
        document.getElementById("menu-categorie").value,
        state.nieuwProductEmoji,
        document.getElementById("menu-ijskeuze").checked,
        document.getElementById("menu-slagroom").checked
      );
      state.nieuwProductEmoji = "🍽️";
      render();
      break;
    case "menu-verwijder": menuItemVerwijderen(id); break;

    case "categorie-toevoegen":
      categorieToevoegen(document.getElementById("nieuwe-categorie").value);
      break;
    case "categorie-verwijder": categorieVerwijderen(id); break;

    case "update-gelezen": updateGelezenMarkeren(id); break;
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

root.addEventListener("change", e => {
  const el = e.target.closest("[data-action]");
  if(!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;
  if(action === "recht-toggle") ledRechtToggle(id, el.dataset.recht, el.checked);
  if(action === "functie-wijzigen") ledFunctieWijzigen(id, el.value);
  if(action === "thema-achtergrond") themaWijzigen("achtergrond", el.value);
  if(action === "thema-tekst") themaWijzigen("tekst", el.value);
  if(action === "voorraad-toggle") menuItemUitverkochtWijzigen(id, el.checked);
  if(action === "wagen-ijs") wagenIjsWijzigen(id, el.checked);
  if(action === "wagen-slagroom") wagenSlagroomWijzigen(id, el.checked);
});

// ============================================================
// START
// ============================================================
// Systeemupdates zijn site-breed en dus altijd actief, ook als er nog geen restaurant gekozen is.
db.ref("site_updates").on("value", snap => {
  state.siteUpdates = snap.val() || {};
  render();
});
// Houdt de sitebeheer-status bij op basis van Firebase Authentication (server-side gecontroleerd,
// niet meer via localStorage) — vuurt ook meteen bij het laden als je nog een geldige sessie hebt.
auth.onAuthStateChanged(gebruiker => {
  state.beheerderActief = !!gebruiker;
  state.beheerFoutmelding = "";
  if(gebruiker && state.beheerPaneelOpen) alleRestaurantsLuisteren();
  render();
});
render();
