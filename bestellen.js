/* ============================================================
   RESTAURANTS — bestellen.js
   Zelfbestel-pagina voor gasten die de QR-code scannen.
   Losstaand van app.js: gasten loggen niet in en zien alleen
   het menu + hun eigen bestellingen van dít restaurant.

   Nieuw t.o.v. de vorige versie:
   - 5 talen (NL, EN, DE, FR, ES) met taalkiezer; taal wordt onthouden
   - alle tekst uit de database wordt ge-escaped (XSS-bescherming)
   - restaurantcode wordt gecontroleerd voordat hij in een databasepad komt
   - geen bestelling "verzenden" terwijl je offline bent
   - korte wachttijd tussen bestellingen (tegen per ongeluk dubbel klikken en spam)
   - elk bestelregel bevat het menuId, zodat de databaseregels de prijs kunnen controleren
   ============================================================ */

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const root = document.getElementById("app");

const MERKNAAM = "Restaurants";
const MAX_PRODUCTEN_PER_BESTELLING = 20;
const BESTEL_WACHTTIJD_MS = 8000; // minimale tijd tussen twee bestellingen van hetzelfde apparaat

// ---------- veiligheid ----------
function esc(w){
  return String(w == null ? "" : w)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function willekeurigeTekens(n, chars){
  chars = chars || "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint32Array(n);
  crypto.getRandomValues(bytes);
  let uit = "";
  for(let i = 0; i < n; i++) uit += chars[bytes[i] % chars.length];
  return uit;
}
// Alleen deze statussen bestaan; alles anders wordt behandeld als "nieuw" (voorkomt dat
// vreemde waarden uit de database als CSS-klasse in de pagina belanden).
const GELDIGE_STATUSSEN = ["nieuw", "bereiden", "klaar"];

// ---------- talen ----------
// LET OP (afspraak met de eigenaar, bewust niet "verbeteren"): de status "nieuw" heet voor
// gasten "Afgeleverd", "bereiden" heet "In bereiding" en "klaar" heet "Onderweg". Dat is in
// elke taal hetzelfde gehouden.
const TALEN = {
  nl: { naam:"Nederlands", locale:"nl-NL", t:{
    wachtEyebrow:"Even geduld", laden:"Bezig met laden…",
    nietGevonden:"Niet gevonden",
    geenCode:"Geen restaurantcode gevonden in de link — scan de QR-code opnieuw.",
    bestaatNiet:"Dit restaurant bestaat niet (meer). Scan de QR-code opnieuw of vraag het personeel.",
    laadFout:"Er ging iets mis bij het laden. Controleer je internetverbinding en probeer het opnieuw.",
    welkom:"Welkom bij", kiesTafel:"Kies jouw tafel om te bestellen", tafel:"Tafel", stoel:"Stoel",
    tafelVrijgegeven:"Deze tafel is afgerekend en vrijgegeven — kies opnieuw een tafel.",
    verzonden:"Bestelling verzonden naar de keuken",
    maxProducten:"Je kan maximaal {n} producten per bestelling bestellen.",
    geenVerbinding:"Geen verbinding — je bestelling is nog niet verstuurd. Probeer het zo opnieuw.",
    wachtEven:"Even geduld — je vorige bestelling is net verstuurd.",
    nietToegestaan:"Bestellen niet gelukt. Vraag het personeel om hulp.",
    mijnBestellingen:"Mijn bestellingen",
    status:{ nieuw:"Afgeleverd", bereiden:"In bereiding", klaar:"Onderweg" },
    voorJou1:"1 bestelling voor jou in de wachtrij", voorJouN:"{n} bestellingen voor jou in de wachtrij",
    eersteBeurt:"Jij bent als eerste aan de beurt",
    geenMenu:"Dit restaurant heeft nog geen menu ingesteld.", uitverkocht:"Uitverkocht",
    bestellen:"Bestellen", jouwBestelling:"Jouw bestelling", nietsGekozen:"Nog niets geselecteerd.",
    metIjs:"Met ijs", metSlagroom:"Met slagroom", alGlas:"Heb al een glas",
    notitie:"Notitie, bijv. 'geen ui'", verwijderen:"verwijderen", totaal:"Totaal", verzenden:"Bestelling verzenden",
    taal:"Taal",
  }},
  en: { naam:"English", locale:"en-GB", t:{
    wachtEyebrow:"One moment", laden:"Loading…",
    nietGevonden:"Not found",
    geenCode:"No restaurant code found in the link — please scan the QR code again.",
    bestaatNiet:"This restaurant doesn't exist (anymore). Scan the QR code again or ask the staff.",
    laadFout:"Something went wrong while loading. Check your internet connection and try again.",
    welkom:"Welcome to", kiesTafel:"Choose your table to start ordering", tafel:"Table", stoel:"Chair",
    tafelVrijgegeven:"This table has been paid and released — please choose a table again.",
    verzonden:"Order sent to the kitchen",
    maxProducten:"You can order a maximum of {n} items per order.",
    geenVerbinding:"No connection — your order has not been sent yet. Please try again in a moment.",
    wachtEven:"One moment — your previous order was just sent.",
    nietToegestaan:"Ordering failed. Please ask the staff for help.",
    mijnBestellingen:"My orders",
    status:{ nieuw:"Delivered", bereiden:"Being prepared", klaar:"On its way" },
    voorJou1:"1 order ahead of you in the queue", voorJouN:"{n} orders ahead of you in the queue",
    eersteBeurt:"You're next in line",
    geenMenu:"This restaurant hasn't set up a menu yet.", uitverkocht:"Sold out",
    bestellen:"Order", jouwBestelling:"Your order", nietsGekozen:"Nothing selected yet.",
    metIjs:"With ice", metSlagroom:"With whipped cream", alGlas:"I already have a glass",
    notitie:"Note, e.g. 'no onions'", verwijderen:"remove", totaal:"Total", verzenden:"Send order",
    taal:"Language",
  }},
  de: { naam:"Deutsch", locale:"de-DE", t:{
    wachtEyebrow:"Einen Moment", laden:"Wird geladen…",
    nietGevonden:"Nicht gefunden",
    geenCode:"Kein Restaurantcode im Link gefunden — bitte scanne den QR-Code erneut.",
    bestaatNiet:"Dieses Restaurant existiert nicht (mehr). Scanne den QR-Code erneut oder frage das Personal.",
    laadFout:"Beim Laden ist etwas schiefgelaufen. Prüfe deine Internetverbindung und versuche es erneut.",
    welkom:"Willkommen bei", kiesTafel:"Wähle deinen Tisch, um zu bestellen", tafel:"Tisch", stoel:"Stuhl",
    tafelVrijgegeven:"Dieser Tisch wurde bezahlt und freigegeben — bitte wähle erneut einen Tisch.",
    verzonden:"Bestellung an die Küche gesendet",
    maxProducten:"Du kannst maximal {n} Artikel pro Bestellung bestellen.",
    geenVerbinding:"Keine Verbindung — deine Bestellung wurde noch nicht gesendet. Bitte gleich nochmal versuchen.",
    wachtEven:"Einen Moment — deine letzte Bestellung wurde gerade gesendet.",
    nietToegestaan:"Bestellung fehlgeschlagen. Bitte frage das Personal um Hilfe.",
    mijnBestellingen:"Meine Bestellungen",
    status:{ nieuw:"Geliefert", bereiden:"In Zubereitung", klaar:"Unterwegs" },
    voorJou1:"1 Bestellung vor dir in der Warteschlange", voorJouN:"{n} Bestellungen vor dir in der Warteschlange",
    eersteBeurt:"Du bist als Nächstes dran",
    geenMenu:"Dieses Restaurant hat noch keine Speisekarte eingerichtet.", uitverkocht:"Ausverkauft",
    bestellen:"Bestellen", jouwBestelling:"Deine Bestellung", nietsGekozen:"Noch nichts ausgewählt.",
    metIjs:"Mit Eis", metSlagroom:"Mit Sahne", alGlas:"Ich habe schon ein Glas",
    notitie:"Notiz, z. B. 'ohne Zwiebeln'", verwijderen:"entfernen", totaal:"Gesamt", verzenden:"Bestellung senden",
    taal:"Sprache",
  }},
  fr: { naam:"Français", locale:"fr-FR", t:{
    wachtEyebrow:"Un instant", laden:"Chargement…",
    nietGevonden:"Introuvable",
    geenCode:"Aucun code de restaurant dans le lien — veuillez scanner à nouveau le QR code.",
    bestaatNiet:"Ce restaurant n'existe pas (ou plus). Scannez à nouveau le QR code ou demandez au personnel.",
    laadFout:"Une erreur est survenue lors du chargement. Vérifiez votre connexion internet et réessayez.",
    welkom:"Bienvenue chez", kiesTafel:"Choisissez votre table pour commander", tafel:"Table", stoel:"Chaise",
    tafelVrijgegeven:"Cette table a été réglée et libérée — veuillez choisir une table à nouveau.",
    verzonden:"Commande envoyée en cuisine",
    maxProducten:"Vous pouvez commander au maximum {n} articles par commande.",
    geenVerbinding:"Pas de connexion — votre commande n'a pas encore été envoyée. Réessayez dans un instant.",
    wachtEven:"Un instant — votre commande précédente vient d'être envoyée.",
    nietToegestaan:"La commande a échoué. Demandez de l'aide au personnel.",
    mijnBestellingen:"Mes commandes",
    status:{ nieuw:"Livrée", bereiden:"En préparation", klaar:"En route" },
    voorJou1:"1 commande avant la vôtre dans la file", voorJouN:"{n} commandes avant la vôtre dans la file",
    eersteBeurt:"C'est bientôt votre tour",
    geenMenu:"Ce restaurant n'a pas encore de menu.", uitverkocht:"Épuisé",
    bestellen:"Commander", jouwBestelling:"Votre commande", nietsGekozen:"Rien de sélectionné pour l'instant.",
    metIjs:"Avec glaçons", metSlagroom:"Avec chantilly", alGlas:"J'ai déjà un verre",
    notitie:"Note, p. ex. « sans oignon »", verwijderen:"retirer", totaal:"Total", verzenden:"Envoyer la commande",
    taal:"Langue",
  }},
  es: { naam:"Español", locale:"es-ES", t:{
    wachtEyebrow:"Un momento", laden:"Cargando…",
    nietGevonden:"No encontrado",
    geenCode:"No se encontró ningún código de restaurante en el enlace — escanea de nuevo el código QR.",
    bestaatNiet:"Este restaurante no existe (ya). Escanea de nuevo el código QR o pregunta al personal.",
    laadFout:"Algo salió mal al cargar. Comprueba tu conexión a internet e inténtalo de nuevo.",
    welkom:"Bienvenido a", kiesTafel:"Elige tu mesa para pedir", tafel:"Mesa", stoel:"Silla",
    tafelVrijgegeven:"Esta mesa se ha pagado y liberado — elige una mesa de nuevo.",
    verzonden:"Pedido enviado a la cocina",
    maxProducten:"Puedes pedir un máximo de {n} productos por pedido.",
    geenVerbinding:"Sin conexión — tu pedido aún no se ha enviado. Inténtalo de nuevo en un momento.",
    wachtEven:"Un momento — tu pedido anterior se acaba de enviar.",
    nietToegestaan:"No se pudo hacer el pedido. Pide ayuda al personal.",
    mijnBestellingen:"Mis pedidos",
    status:{ nieuw:"Entregado", bereiden:"En preparación", klaar:"En camino" },
    voorJou1:"1 pedido antes que el tuyo en la cola", voorJouN:"{n} pedidos antes que el tuyo en la cola",
    eersteBeurt:"Eres el siguiente",
    geenMenu:"Este restaurante aún no tiene carta.", uitverkocht:"Agotado",
    bestellen:"Pedir", jouwBestelling:"Tu pedido", nietsGekozen:"Todavía no has elegido nada.",
    metIjs:"Con hielo", metSlagroom:"Con nata", alGlas:"Ya tengo un vaso",
    notitie:"Nota, p. ej. 'sin cebolla'", verwijderen:"quitar", totaal:"Total", verzenden:"Enviar pedido",
    taal:"Idioma",
  }},
};
function beginTaal(){
  try {
    const opgeslagen = localStorage.getItem("zelfbestel_taal");
    if(opgeslagen && TALEN[opgeslagen]) return opgeslagen;
  } catch(e) {}
  const browser = (navigator.language || "nl").slice(0, 2).toLowerCase();
  return TALEN[browser] ? browser : "nl";
}
let taal = beginTaal();
document.documentElement.lang = taal;
// Vertaalfunctie: t("verzonden") of t("maxProducten", {n:20}).
function t(sleutel, vars){
  const tekst = TALEN[taal].t[sleutel] != null ? TALEN[taal].t[sleutel] : TALEN.nl.t[sleutel];
  return String(tekst).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null) ? vars[k] : m);
}
function taalWijzigen(nieuw){
  if(!TALEN[nieuw]) return;
  taal = nieuw;
  document.documentElement.lang = taal;
  try { localStorage.setItem("zelfbestel_taal", taal); } catch(e) {}
  render();
}
function taalKiezerHtml(){
  return `
    <label class="taal-kiezer">
      <span class="taal-kiezer__icoon" aria-hidden="true">🌐</span>
      <span class="taal-kiezer__label">${esc(t("taal"))}</span>
      <select data-action="gast-taal" aria-label="${esc(t("taal"))}">
        ${Object.entries(TALEN).map(([k, v]) => `<option value="${k}" ${k === taal ? "selected" : ""}>${esc(v.naam)}</option>`).join("")}
      </select>
    </label>`;
}

// ---------- eigen gast-id (per apparaat/browser) zodat je je eigen bestellingen kunt volgen ----------
function gastIdOphalen(){
  let id = null;
  try { id = localStorage.getItem("zelfbestel_gast_id"); } catch(e) {}
  if(!id){
    id = "gast-" + Date.now().toString(36) + "-" + willekeurigeTekens(10);
    try { localStorage.setItem("zelfbestel_gast_id", id); } catch(e) {}
  }
  return id;
}
function codeUitUrl(){
  const c = (new URLSearchParams(location.search).get("code") || "").trim().toUpperCase();
  // Alleen letters/cijfers (4–10 tekens) komen in een databasepad terecht.
  return /^[A-Z0-9]{4,10}$/.test(c) ? c : "";
}

const gastId = gastIdOphalen();
const code = codeUitUrl();

const state = {
  fase: "laden",              // laden | fout | tafel | bestellen
  foutSleutel: "",            // vertaalsleutel van de foutmelding
  restaurantNaam: "",
  menu: {},
  categorieen: {},
  plattegrond: {},
  thema: null,
  actieveTafelCel: null,
  tafelNummer: "",            // alleen het nummer; de tekst "Tafel N" voor het personeel wordt in het Nederlands opgeslagen
  tafelBevestigdBezet: false, // hebben we deze tafel al 1x "bezet" gezien terwijl we erop zaten?
  winkelwagen: {},
  mijnBestellingen: {},       // live, gefilterd op gastId
  alleBestellingen: {},       // live, alle bestellingen — alleen om de wachtrij-positie te berekenen
  verbonden: true,
  laatsteBestelling: 0,
};

// ---------- kleine helpers ----------
function euro(bedrag){
  try {
    return new Intl.NumberFormat(TALEN[taal].locale, { style:"currency", currency:"EUR" }).format(Number(bedrag) || 0);
  } catch(e) {
    return "€ " + (Number(bedrag) || 0).toFixed(2).replace(".", ",");
  }
}
function toonToast(tekst){
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = tekst;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
const LETTERTYPE_OPTIES = [
  { key:"standaard",    ui:'"Inter", system-ui, sans-serif',  css:'"Playfair Display", Georgia, serif' },
  { key:"poppins",      ui:'"Poppins", sans-serif',           css:'"Poppins", sans-serif' },
  { key:"merriweather", ui:'"Merriweather", serif',           css:'"Merriweather", serif' },
  { key:"montserrat",   ui:'"Montserrat", sans-serif',        css:'"Montserrat", sans-serif' },
  { key:"oswald",       ui:'"Oswald", sans-serif',            css:'"Oswald", sans-serif' },
  { key:"lora",         ui:'"Lora", serif',                   css:'"Lora", serif' },
  { key:"pacifico",     ui:'"Pacifico", cursive',             css:'"Pacifico", cursive' },
  { key:"caveat",       ui:'"Caveat", cursive',               css:'"Caveat", cursive' },
  { key:"bebas",        ui:'"Bebas Neue", sans-serif',        css:'"Bebas Neue", sans-serif' },
  { key:"dancing",      ui:'"Dancing Script", cursive',       css:'"Dancing Script", cursive' },
  { key:"abril",        ui:'"Abril Fatface", serif',          css:'"Abril Fatface", serif' },
  { key:"quicksand",    ui:'"Quicksand", sans-serif',         css:'"Quicksand", sans-serif' },
  { key:"josefin",      ui:'"Josefin Sans", sans-serif',      css:'"Josefin Sans", sans-serif' },
  { key:"bitter",       ui:'"Bitter", serif',                 css:'"Bitter", serif' },
  { key:"comfortaa",    ui:'"Comfortaa", sans-serif',         css:'"Comfortaa", sans-serif' },
  { key:"crimson",      ui:'"Crimson Pro", serif',            css:'"Crimson Pro", serif' },
];
const VORM_RADIUS = { standaard:"3px", zacht:"10px", rond:"18px", pil:"999px" };
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
  const hex = /^#[0-9a-fA-F]{6}$/;
  document.body.style.backgroundColor = thema && hex.test(thema.achtergrond || "") ? thema.achtergrond : "";
  document.body.style.backgroundImage = thema && thema.patroon ? patroonAchtergrondUrl(thema.patroon) : "";
  if(thema && hex.test(thema.tekst || "")) document.documentElement.style.setProperty("--text", thema.tekst);
  else document.documentElement.style.removeProperty("--text");
  const lettertype = thema && thema.lettertype ? LETTERTYPE_OPTIES.find(f => f.key === thema.lettertype) : null;
  if(lettertype && lettertype.key !== "standaard"){
    document.documentElement.style.setProperty("--ui", lettertype.ui);
    document.documentElement.style.setProperty("--display", lettertype.css);
  } else {
    document.documentElement.style.removeProperty("--ui");
    document.documentElement.style.removeProperty("--display");
  }
  const radius = thema && thema.vorm ? VORM_RADIUS[thema.vorm] : null;
  if(radius && thema.vorm !== "standaard") document.documentElement.style.setProperty("--radius", radius);
  else document.documentElement.style.removeProperty("--radius");
}

// ---------- laden van het restaurant ----------
function laadRestaurant(){
  if(!code){
    state.fase = "fout";
    state.foutSleutel = "geenCode";
    render();
    return;
  }
  db.ref("restaurants/" + code + "/naam").once("value").then(snap => {
    if(!snap.exists()){
      state.fase = "fout";
      state.foutSleutel = "bestaatNiet";
      render();
      return;
    }
    state.restaurantNaam = snap.val();
    verbindenLuisteraars();
  }).catch(() => {
    state.fase = "fout";
    state.foutSleutel = "laadFout";
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
    const nieuwePlattegrond = snap.val() || {};
    // Zit je aan een tafel en rekent het team die tafel af ("Tafel betaald — vrijgeven")? Dan
    // moet je hier ook uit, anders blijf je bestellen op een tafel die alweer vrij is.
    // We wachten tot we de tafel zelf 1x "bezet" hebben gezien (na je eerste bestelling).
    if(state.actieveTafelCel && state.fase === "bestellen"){
      const huidigeCel = nieuwePlattegrond[state.actieveTafelCel];
      const nogSteedsBezet = !!(huidigeCel && huidigeCel.type === "tafel" && huidigeCel.bezet);
      if(state.tafelBevestigdBezet && !nogSteedsBezet){
        state.plattegrond = nieuwePlattegrond;
        state.actieveTafelCel = null;
        state.tafelNummer = "";
        state.winkelwagen = {};
        state.tafelBevestigdBezet = false;
        state.fase = "tafel";
        toonToast(t("tafelVrijgegeven"));
        render();
        return;
      }
      if(nogSteedsBezet) state.tafelBevestigdBezet = true;
    }
    state.plattegrond = nieuwePlattegrond;
    if(state.fase === "laden"){
      const heeftTafels = Object.values(state.plattegrond).some(c => c && c.type === "tafel");
      state.fase = heeftTafels ? "tafel" : "bestellen";
    }
    render();
  });
  // Alleen je eigen bestellingen (op dit apparaat) van dít restaurant, live.
  db.ref("restaurants/" + code + "/bestellingen").orderByChild("gastId").equalTo(gastId).on("value", snap => {
    state.mijnBestellingen = snap.val() || {};
    render();
  });
  // Alle bestellingen, live — puur om te tellen hoeveel er nog vóór de jouwe in de wachtrij staan.
  db.ref("restaurants/" + code + "/bestellingen").on("value", snap => {
    state.alleBestellingen = snap.val() || {};
    render();
  });
}
// Verbindingsstatus: een bestelling "versturen" terwijl je offline bent geeft anders een
// valse bevestiging, want Firebase zet 'm dan stilletjes in de wachtrij van de browser.
db.ref(".info/connected").on("value", snap => { state.verbonden = snap.val() === true; });

// ---------- winkelwagen ----------
function gastWagenTotaalAantal(wagen){
  return Object.values(wagen || {}).reduce((s, i) => s + (i.aantal || 0), 0);
}
function gastToevoegenAanWagen(id, item){
  if(!item || item.uitverkocht) return;
  if(gastWagenTotaalAantal(state.winkelwagen) >= MAX_PRODUCTEN_PER_BESTELLING){
    toonToast(t("maxProducten", { n: MAX_PRODUCTEN_PER_BESTELLING }));
    return;
  }
  if(state.winkelwagen[id]) state.winkelwagen[id].aantal += 1;
  else state.winkelwagen[id] = {
    menuId:id, naam:item.naam, prijs:item.prijs, aantal:1, notitie:"", emoji:item.emoji||"", categorie:item.categorie||"",
    ijsKeuze:!!item.ijsKeuze, slagroomKeuze:!!item.slagroomKeuze, glasKeuze:!!item.glasKeuze,
    ijs:false, slagroom:false, glas:false,
  };
  render();
}
function gastWagenAantalWijzigen(id, delta){
  const item = state.winkelwagen[id];
  if(!item) return;
  if(delta > 0 && gastWagenTotaalAantal(state.winkelwagen) >= MAX_PRODUCTEN_PER_BESTELLING){
    toonToast(t("maxProducten", { n: MAX_PRODUCTEN_PER_BESTELLING }));
    return;
  }
  item.aantal += delta;
  if(item.aantal <= 0) delete state.winkelwagen[id];
  render();
}
function gastWagenVerwijderen(id){ delete state.winkelwagen[id]; render(); }
function gastWagenNotitieWijzigen(id, waarde){ if(state.winkelwagen[id]) state.winkelwagen[id].notitie = String(waarde).slice(0, 120); }
function gastWagenIjsWijzigen(id, waarde){ if(state.winkelwagen[id]) state.winkelwagen[id].ijs = waarde; }
function gastWagenSlagroomWijzigen(id, waarde){ if(state.winkelwagen[id]) state.winkelwagen[id].slagroom = waarde; }
function gastWagenGlasWijzigen(id, waarde){ if(state.winkelwagen[id]) state.winkelwagen[id].glas = waarde; }

function gastTafelKiezen(cel){
  const celData = state.plattegrond[cel];
  if(!celData || celData.type !== "tafel") return;
  state.actieveTafelCel = cel;
  state.tafelNummer = celData.nummer || "";
  state.tafelBevestigdBezet = !!celData.bezet;
  state.fase = "bestellen";
  render();
}

function gastBestellingVerzenden(){
  const items = Object.values(state.winkelwagen);
  if(!items.length) return;
  if(!state.verbonden){ toonToast(t("geenVerbinding")); return; }
  if(Date.now() - state.laatsteBestelling < BESTEL_WACHTTIJD_MS){ toonToast(t("wachtEven")); return; }
  state.laatsteBestelling = Date.now();
  const ref = db.ref("restaurants/" + code + "/bestellingen").push();
  ref.set({
    items: items,
    // Het personeel leest dit in het Nederlands, ongeacht de taal van de gast.
    tafel: state.tafelNummer !== "" ? "Tafel " + state.tafelNummer : "",
    status: "nieuw",
    gastId: gastId,
    aangemaakt: firebase.database.ServerValue.TIMESTAMP,
  }).then(() => toonToast(t("verzonden")))
    .catch(() => { state.laatsteBestelling = 0; toonToast(t("nietToegestaan")); });
  if(state.actieveTafelCel){
    db.ref("restaurants/" + code + "/plattegrond/" + state.actieveTafelCel + "/bezet").set(true).catch(() => {});
  }
  state.winkelwagen = {};
  render();
}

// ============================================================
// RENDER
// ============================================================
function huidigeFocusVastleggen(){
  const el = document.activeElement;
  if(!el || !root.contains(el) || !("value" in el)) return null;
  return {
    id: el.id || null,
    action: el.dataset ? el.dataset.action || null : null,
    dataId: el.dataset ? (el.dataset.id != null ? el.dataset.id : null) : null,
    waarde: el.value,
    selStart: (typeof el.selectionStart === "number") ? el.selectionStart : null,
    selEnd: (typeof el.selectionEnd === "number") ? el.selectionEnd : null,
  };
}
function focusHerstellen(bewaard){
  if(!bewaard) return;
  let el = null;
  if(bewaard.id) el = document.getElementById(bewaard.id);
  if(!el && bewaard.action){
    const selector = bewaard.dataId != null
      ? `[data-action="${bewaard.action}"][data-id="${CSS.escape(bewaard.dataId)}"]`
      : `[data-action="${bewaard.action}"]`;
    el = root.querySelector(selector);
  }
  if(!el || !("value" in el)) return;
  el.value = bewaard.waarde;
  el.focus();
  if(bewaard.selStart !== null && typeof el.setSelectionRange === "function"){
    try{ el.setSelectionRange(bewaard.selStart, bewaard.selEnd); }catch(err){ /* niet elk inputtype ondersteunt dit */ }
  }
}
function render(){
  const bewaardeFocus = huidigeFocusVastleggen();
  renderScherm();
  focusHerstellen(bewaardeFocus);
}
function renderScherm(){
  if(state.fase === "laden") root.innerHTML = renderLaden();
  else if(state.fase === "fout") root.innerHTML = renderFout();
  else if(state.fase === "tafel") root.innerHTML = renderTafelKiezen();
  else root.innerHTML = renderZelfBestellen();
}

function renderLaden(){
  return `
    <div class="landing">
      ${taalKiezerHtml()}
      <div class="landing__mark">
        <div class="landing__eyebrow">${esc(t("wachtEyebrow"))}</div>
        <h1 class="landing__title">${esc(t("laden"))}</h1>
        <div class="landing__divider"><span class="landing__diamond"></span></div>
      </div>
    </div>`;
}
function renderFout(){
  return `
    <div class="landing">
      ${taalKiezerHtml()}
      <div class="landing__mark">
        <div class="landing__eyebrow">${MERKNAAM}</div>
        <h1 class="landing__title">${esc(t("nietGevonden"))}</h1>
        <div class="landing__divider"><span class="landing__diamond"></span></div>
      </div>
      <p class="landing__sub">${esc(t(state.foutSleutel || "laadFout"))}</p>
    </div>`;
}
function stoelIconHtml(rotatie){
  return `<span class="plattegrond__stoel-icoon" style="transform:rotate(${Number(rotatie) || 0}deg);">
    <span class="plattegrond__stoel-icoon__rug"></span>
    <span class="plattegrond__stoel-icoon__zit"></span>
    <span class="plattegrond__stoel-icoon__poot plattegrond__stoel-icoon__poot--l"></span>
    <span class="plattegrond__stoel-icoon__poot plattegrond__stoel-icoon__poot--r"></span>
  </span>`;
}
function renderTafelKiezen(){
  const RIJEN = 7, KOLOMMEN = 12;
  let cellenHtml = "";
  for(let r = 0; r < RIJEN; r++){
    for(let c = 0; c < KOLOMMEN; c++){
      const key = r + "-" + c;
      const obj = (state.plattegrond || {})[key];
      if(!obj){
        cellenHtml += `<div class="plattegrond__cel plattegrond__cel--leeg"></div>`;
      } else if(obj.type === "tafel"){
        const bezet = !!obj.bezet;
        const nr = esc(obj.nummer || "");
        cellenHtml += `
          <button type="button" class="plattegrond__cel plattegrond__cel--tafel ${bezet ? "plattegrond__cel--bezet" : "plattegrond__cel--vrij"}"
            data-action="gast-tafel-kiezen" data-cel="${key}" title="${esc(t("tafel"))} ${nr}">
            🍽️<span class="plattegrond__nr">${nr}</span>
          </button>`;
      } else if(obj.type === "stoel"){
        cellenHtml += `<div class="plattegrond__cel plattegrond__cel--stoel" title="${esc(t("stoel"))}">${stoelIconHtml(obj.rotatie)}</div>`;
      } else {
        cellenHtml += `<div class="plattegrond__cel"></div>`;
      }
    }
  }
  return `
    <div class="landing">
      ${taalKiezerHtml()}
      <div class="landing__mark">
        <div class="landing__eyebrow">${esc(t("welkom"))}</div>
        <h1 class="landing__title">${esc(state.restaurantNaam)}</h1>
        <div class="landing__divider"><span class="landing__diamond"></span></div>
      </div>
      <p class="landing__sub">${esc(t("kiesTafel"))}</p>
      <div class="plattegrond-wrap">
        <div class="plattegrond-grid" style="grid-template-columns:repeat(${KOLOMMEN}, 1fr);">${cellenHtml}</div>
      </div>
    </div>`;
}
function renderMijnBestellingenTracker(){
  const eigen = Object.entries(state.mijnBestellingen || {});
  if(!eigen.length) return "";
  const nogInDeWachtrij = Object.entries(state.alleBestellingen || {})
    .filter(([,b]) => b && (b.status === "nieuw" || b.status === "bereiden"));
  const rijen = eigen
    .sort((a,b) => (a[1].aangemaakt||0)-(b[1].aangemaakt||0))
    .map(([id,b]) => {
      const status = GELDIGE_STATUSSEN.includes(b.status) ? b.status : "nieuw";
      const label = TALEN[taal].t.status[status];
      const items = (b.items||[]).map(it => `${esc(it.aantal)}× ${esc(it.naam)}`).join(", ");
      let wachtrijHtml = "";
      if(status === "nieuw" || status === "bereiden"){
        const voorJou = nogInDeWachtrij.filter(([oid,o]) => oid !== id && (o.aangemaakt||0) < (b.aangemaakt||0)).length;
        const tekst = voorJou === 0 ? t("eersteBeurt") : voorJou === 1 ? t("voorJou1") : t("voorJouN", { n: voorJou });
        wachtrijHtml = `<div class="gast-tracker__wachtrij">🧑‍🍳 ${esc(tekst)}</div>`;
      }
      return `
        <div class="gast-tracker__rij">
          <div class="gast-tracker__top">
            <span class="gast-tracker__nr">#${esc(id.slice(-5).toUpperCase())}</span>
            <span class="gast-status gast-status--${status}">${esc(label)}</span>
          </div>
          <div class="gast-tracker__items">${items}</div>
          ${wachtrijHtml}
        </div>`;
    }).join("");
  return `
    <div class="instel-blok gast-tracker">
      <div class="instel-blok__titel">${esc(t("mijnBestellingen"))}</div>
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
    productenHtml = `<div class="leeg">${esc(t("geenMenu"))}</div>`;
  } else {
    categorieen.forEach(cat => {
      productenHtml += `<div class="categorie-titel">${esc(cat)}</div><div class="product-grid">`;
      menuArr.filter(([,i]) => (i.categorie||"Overig") === cat).forEach(([id,i]) => {
        const uitverkocht = !!i.uitverkocht;
        const opties = [];
        if(i.ijsKeuze) opties.push("🧊");
        if(i.slagroomKeuze) opties.push("🥛");
        if(i.glasKeuze) opties.push("🥂");
        productenHtml += `
          <button class="product-card ${uitverkocht ? "product-card--uitverkocht" : ""}" ${uitverkocht ? "disabled" : 'data-action="gast-toevoegen-wagen"'} data-id="${esc(id)}">
            ${uitverkocht ? `<span class="product-card__uitverkocht-badge">${esc(t("uitverkocht"))}</span>` : `<span class="product-card__plus">+</span>`}
            <div class="product-card__emoji">${esc(i.emoji||"🍽️")}</div>
            <div class="product-card__naam">${esc(i.naam)}${opties.length ? ` <span class="product-card__opties">${opties.join(" ")}</span>` : ""}</div>
            <div class="product-card__prijs">${esc(euro(i.prijs))}</div>
          </button>`;
      });
      productenHtml += `</div>`;
    });
  }

  const wagenItems = Object.entries(state.winkelwagen);
  const totaal = wagenItems.reduce((s,[,i]) => s + i.prijs*i.aantal, 0);
  let wagenHtml = `<div class="leeg" style="padding:24px 12px;">${esc(t("nietsGekozen"))}</div>`;
  if(wagenItems.length){
    wagenHtml = wagenItems.map(([id,i]) => `
      <div class="wagen__regel">
        <div class="wagen__regel-top">
          <div class="wagen__regel-naam">${i.emoji ? esc(i.emoji) + " " : ""}${esc(i.naam)}</div>
          <div class="wagen__aantal">
            <button data-action="gast-wagen-min" data-id="${esc(id)}">−</button>
            <span>${esc(i.aantal)}</span>
            <button data-action="gast-wagen-plus" data-id="${esc(id)}">+</button>
          </div>
        </div>
        ${i.ijsKeuze ? `
          <label class="wagen__checkbox">
            <input type="checkbox" data-action="gast-wagen-ijs" data-id="${esc(id)}" ${i.ijs ? "checked" : ""}>
            🧊 ${esc(t("metIjs"))}
          </label>` : ""}
        ${i.slagroomKeuze ? `
          <label class="wagen__checkbox">
            <input type="checkbox" data-action="gast-wagen-slagroom" data-id="${esc(id)}" ${i.slagroom ? "checked" : ""}>
            🥛 ${esc(t("metSlagroom"))}
          </label>` : ""}
        ${i.glasKeuze ? `
          <label class="wagen__checkbox">
            <input type="checkbox" data-action="gast-wagen-glas" data-id="${esc(id)}" ${i.glas ? "checked" : ""}>
            🥂 ${esc(t("alGlas"))}
          </label>` : ""}
        <input class="wagen__notitie" maxlength="120" placeholder="${esc(t("notitie"))}" value="${esc(i.notitie || "")}" data-action="gast-wagen-notitie" data-id="${esc(id)}">
        <button class="wagen__verwijder" data-action="gast-wagen-verwijder" data-id="${esc(id)}">${esc(t("verwijderen"))}</button>
      </div>`).join("");
  }

  return `
    <div class="shell">
      <header class="topbar">
        <div class="topbar__id">
          <div class="topbar__naam">${esc(state.restaurantNaam)}</div>
          ${state.tafelNummer !== "" ? `<span class="topbar__code">${esc(t("tafel"))} ${esc(state.tafelNummer)}</span>` : ""}
        </div>
        ${taalKiezerHtml()}
      </header>
      ${!state.verbonden ? `<div class="offline-banner">⚠ ${esc(t("geenVerbinding"))}</div>` : ""}
      <main class="view">
        ${renderMijnBestellingenTracker()}
        <div class="bestel-layout">
          <div>
            <h2 class="view-titel">${esc(t("bestellen"))}</h2>
            ${productenHtml}
          </div>
          <div class="wagen">
            <div class="wagen__titel">${esc(t("jouwBestelling"))}</div>
            ${wagenHtml}
            <div class="wagen__totaal"><span>${esc(t("totaal"))}</span><span>${esc(euro(totaal))}</span></div>
            <button class="btn btn--flame btn--block" data-action="gast-verzenden" ${wagenItems.length ? "" : "disabled"}>${esc(t("verzenden"))}</button>
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
  if(action === "gast-taal") taalWijzigen(el.value);
  if(action === "gast-wagen-ijs") gastWagenIjsWijzigen(id, el.checked);
  if(action === "gast-wagen-slagroom") gastWagenSlagroomWijzigen(id, el.checked);
  if(action === "gast-wagen-glas") gastWagenGlasWijzigen(id, el.checked);
});

// Geweigerde schrijfacties (databaseregels) of wegvallende verbinding niet stil laten verdwijnen.
window.addEventListener("unhandledrejection", e => {
  const r = e.reason || {};
  if(/permission[_ ]denied/i.test(String(r.code || r.message || ""))){
    toonToast(t("nietToegestaan"));
    e.preventDefault();
  }
});

// ============================================================
// START
// ============================================================
render();
laadRestaurant();
