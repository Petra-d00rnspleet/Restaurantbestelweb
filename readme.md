# 🍽️ Restaurant Bestelsysteem

Een kleurrijke, live-synchroniserende restaurant-bestelapp: klik "Restaurant starten" of "Restaurant joinen" met een code. Werkt op meerdere apparaten tegelijk (bijv. een tablet bij de bestellingen en een scherm in de keuken) via een gratis Firebase-database.

## Twee versies — gebruik er maar één

- **`index-standalone.html`** — alles (HTML + CSS + JS) in één bestand. Gebruik dit als je snel wil testen (bijv. door 'm gewoon te dubbelklikken) of als je het simpel wil houden: één bestand uploaden naar GitHub is genoeg.
- **`index.html` + `style.css` + `app.js` + `firebase-config.js`** — dezelfde site, maar netjes uitgesplitst in losse bestanden. Functioneel identiek, alleen handiger als je zelf verder wil aanpassen aan de code. **Let op:** deze versie moet je echt hosten (GitHub Pages of een lokale webserver) — als je alleen het los bestand opent of bekijkt in een preview die geen bijbehorende bestanden laadt, valt de styling weg en lijkt de site "kapot" (alles onder elkaar, geen opmaak). Twijfel je? Gebruik dan `index-standalone.html`.

## Wat zit erin

- `index-standalone.html` — de complete site in één bestand (aanbevolen)
- `index.html` — alle schermen, losse-bestanden versie
- `style.css` — de styling (alleen voor de losse-bestanden versie)
- `app.js` — alle logica en de live-koppeling met Firebase (alleen voor de losse-bestanden versie)
- `firebase-config.js` — **hier vul jij je eigen Firebase-gegevens in** (losse-bestanden versie; in de standalone versie staat dit blok bovenin het bestand zelf)
- `firestore.rules` — voorbeeld beveiligingsregels voor je Firestore-database
- `.nojekyll` — leeg bestand dat voorkomt dat GitHub Pages de site via Jekyll probeert te verwerken (kan anders soms bestanden negeren of paden verstoren)

## Stap 1 — Firebase-project aanmaken (gratis)

1. Ga naar [console.firebase.google.com](https://console.firebase.google.com) en log in met een Google-account.
2. Klik **"Project toevoegen"**, geef het een naam (bijv. "mijn-restaurant") en maak het aan. Google Analytics kun je uitzetten, dat heb je niet nodig.
3. Klik in het linkermenu op **Build → Firestore Database → Create database**.
   - Kies een locatie (bijv. `eur3 (Europe)`).
   - Kies **"Start in test mode"** (later kun je de regels uit `firestore.rules` gebruiken).
4. Ga naar het tandwiel-icoon linksboven → **Project settings** → tab **General**.
5. Scroll naar **"Your apps"** → klik het **`</>`** (web) icoon → geef de app een bijnaam → **Register app**.
6. Je krijgt nu een blokje code te zien met `const firebaseConfig = { ... }`. Kopieer die gegevens.

## Stap 2 — Config invullen

**Gebruik je `index-standalone.html`?** Open het bestand in een teksteditor (bijv. Kladblok, VS Code of Kladblok++), zoek naar `firebaseConfig` bovenin het `<script>`-blok, en vul daar je gegevens in.

**Gebruik je de losse bestanden?** Open `firebase-config.js` en plak je eigen gegevens in plaats van de `JOUW_...` placeholders:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "mijn-restaurant.firebaseapp.com",
  projectId: "mijn-restaurant",
  storageBucket: "mijn-restaurant.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

## Stap 3 — Beveiligingsregels instellen (aanbevolen)

Standaard staat een Firestore in test-mode zichzelf na 30 dagen dicht. Ga naar **Firestore Database → Rules** en plak de inhoud van `firestore.rules`, klik dan **Publish**.

> ⚠️ Deze regels laten iedereen die de code raadt lezen/schrijven. Dat past bij een systeem zonder inlog, maar zet er geen gevoelige data in. Wil je het steviger afsluiten, dan kun je later Firebase Authentication toevoegen.

## Stap 4 — Op GitHub Pages zetten

1. Maak een nieuwe repository op GitHub (bijv. `restaurant-app`).
2. Upload alle bestanden uit deze map (`index.html`, `style.css`, `app.js`, `firebase-config.js`, `firestore.rules`).
3. Ga naar **Settings → Pages**, kies bij "Source" je `main`-branch en map `/ (root)`.
4. Na een paar minuten staat je site live op `https://jouwgebruikersnaam.github.io/restaurant-app`.

## Hoe het werkt

- **Restaurant starten** → geef een naam op → je krijgt een unieke 6-tekens code (te vinden bij Instellingen).
- **Restaurant joinen** → vul die code in op een ander apparaat → je ziet dezelfde live data.
- **Bestellen** → klik producten aan (bij ijs-producten kies je meteen met/zonder ijs), schrijf eventueel een opmerking, klik **Bestellen**.
- **Keuken** → drie kolommen: Nieuw → Start bereiden → In bereiding → Klaar → Bezorgen → Bezorgd (verdwijnt naar Historie).
- **Historie** → alle bezorgde bestellingen in detail, plus een totaaltabel per product, en een knop om alles te wissen.
- **Voorraad** → zet producten op "uitverkocht" en weer terug (ze zijn dan tijdelijk niet aan te klikken bij Bestellen).
- **Instellingen** → voeg producten toe met je eigen naam + emoji, kies of het een ijs-keuze heeft, bekijk/kopieer je aansluitcode. Er is bewust geen prijsveld.

Elk apparaat dat dezelfde code gebruikt, ziet dezelfde live gegevens — dankzij Firebase's real-time database hoeft niemand te verversen.

## Problemen oplossen

- **Alles staat onder elkaar / geen kleuren of opmaak** → de styling laadt niet. Gebruik `index-standalone.html`, of zorg dat je de losse-bestanden versie via een echte webserver bekijkt (GitHub Pages, of lokaal met bijv. `python3 -m http.server`) — niet via een preview die alleen het HTML-bestand zelf laadt.
- **Rode balk bovenaan "Firebase is nog niet ingesteld"** → je hebt `firebaseConfig` nog niet ingevuld met je eigen gegevens (stap 2).
- **Restaurant maken/joinen doet niets, of geeft een foutmelding** → open de browserconsole (F12 → tab "Console") en kijk naar de foutmelding. Meestal betekent dit dat de Firestore-database nog niet is aangemaakt (stap 1.3) of dat de rules nog niet gepubliceerd zijn (stap 3).
- **Werkt lokaal wel maar niet op GitHub Pages** → controleer of alle bestanden echt geüpload zijn en of Pages naar de juiste branch/map wijst (stap 4).
