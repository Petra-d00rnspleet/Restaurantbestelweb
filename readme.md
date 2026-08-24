# Restaurants 🔥 — realtime restaurant bestelsysteem

Een klein bestelsysteem voor een restaurant: **Bestellen → Keuken → Bezorgen**,
live gesynchroniseerd tussen alle apparaten via Firebase Realtime Database.

- **Restaurant maken/joinen**: bij het maken van een restaurant, én bij het joinen met een code, vul je ook je eigen naam in. Zo weet iedereen wie er in het team zit. Per apparaat/persoon kun je **maximaal 2 restaurants** hebben (gemaakt + gejoind samen) — zolang je dat maximum nog niet hebt bereikt, zie je op het startscherm de keuzes "Restaurant maken" en "Restaurant joinen"; daarna niet meer. Een restaurant kun je niet zelf uit je lijst verwijderen door het te "verlaten" — dat kan alleen doordat de eigenaar je als teamlid verwijdert, of doordat sitebeheer het hele restaurant verwijdert. Zolang je actief in een restaurant zit, kun je via **"🔀 Wissel restaurant"** (in de bovenbalk of onderaan Instellingen) gewoon teruggaan naar het startscherm om naar je andere restaurant te gaan — dat restaurant blijft daarbij gewoon in je lijst staan.
- **Bestellen**: als er een plattegrond is ingesteld, zie je eerst de plattegrond — klik op een tafel om er een bestelling voor te plaatsen. Een tafel gaat op **bezet** zodra er een bestelling voor is verstuurd, en wordt pas weer **vrij** als je op "Tafel betaald" klikt. Er is ook altijd de optie "Bestelling zonder tafel" voor een bestelling die niet aan een tafel gekoppeld is. Klik producten aan (met emoji, uit een gecategoriseerde kiezer), voeg per product een notitie toe, verstuur de bestelling.
- **Keuken**: nieuwe bestellingen komen direct binnen als "bonnetjes" op élk apparaat dat de site open heeft. Klik op **Bereiden** en daarna op **Bereiden klaar**.
- **Bezorgen**: bestellingen die klaar zijn verschijnen hier. Klik op **Bezorgd** om af te ronden — de bestelling verhuist dan naar Historie.
- **Historie**: alle bezorgde bestellingen per restaurant, plus een tabel met hoeveel er per categorie besteld is. Individuele bestellingen of de hele historie zijn te verwijderen.
- **Voorraad**: een eigen tabblad naast Historie, waar je elk product op **uitverkocht** kunt zetten zonder het te verwijderen — het verschijnt dan grijs en niet-klikbaar bij Bestellen.
- **Systeemupdates op het startscherm**: nieuwe updates (geplaatst via Sitebeheer) verschijnen als teaser op het startscherm, met per update een knop **"Gelezen ✕"**. Klik je die aan, dan verdwijnt die update voor jou van het startscherm (dit wordt lokaal per apparaat onthouden) — in Sitebeheer zelf blijft de update gewoon volledig zichtbaar, voor iedereen.
- **Instellingen**: onderverdeeld in vier tabbladen:
  - **Algemeen**: restaurantnaam wijzigen, restaurantcode bekijken/delen, team & rechten (eigenaar), restaurant verlaten.
  - **Producten**: eerst maak je hier **categorieën** aan (bijv. "Dranken", "Fastfood"); die kies je daarna bij het toevoegen van een product uit een keuzelijst, in plaats van steeds opnieuw te typen. Zo krijgt elk product altijd een bestaande, consistente categorie. Bij Bestellen staan de producten van elke categorie automatisch in een rijtje bij elkaar, onder de naam van die categorie. Verder beheer je hier het menu (producten toevoegen/verwijderen met emoji en prijs), en geef je per product aan of gasten een **ijskeuze** (ijsklontjes, gewoon ja/nee bij het bestellen) en/of **slagroomkeuze** krijgen.
  - **Achtergrond**: een kant-en-klare kleurencombinatie kiezen, of je eigen kleuren instellen — inclusief een rij met alle kleuren van de regenboog om snel te kiezen — plus een subtiel achtergrondpatroon (bijv. vlammen, bord & bestek, wijnglas) en een lettertype voor de hele app. Geldt voor alle apparaten van dit restaurant.
  - **Plattegrond**: een rooster waarop je tafels, stoelen en banken kunt plaatsen om de indeling van je restaurant weer te geven. Elke tafel krijgt automatisch een nummer en verschijnt daarmee klikbaar bij Bestellen. Een stoel kun je draaien: klik 'm nogmaals aan met het Stoel-gereedschap om 'm 90° te roteren (gebruik Wissen om 'm te verwijderen). Een bank kies je liggend of staand en met een zelf in te stellen grootte (2 t/m 6 plekken); klik daarna op het vakje waar de bank moet beginnen.

  Producten, Achtergrond en Plattegrond (in Instellingen) zijn alleen zichtbaar voor teamleden met het "Instellingen"-recht; hetzelfde recht bepaalt ook of het losse Voorraad-tabblad zichtbaar is (zie Team & rechten hieronder).

### Team & rechten

Wie een restaurant **maakt**, wordt automatisch **eigenaar** en krijgt alle rechten.
Iedereen die daarna via de code **joint**, verschijnt in Instellingen onder **Team & rechten**
— zichtbaar voor de eigenaar. Daar kan de eigenaar per teamlid:

- een **functie** invullen (bijv. "Ober", "Kok", "Manager");
- **rechten** aan- of uitvinken voor Bestellen, Keuken, Bezorgen, Historie en Instellingen.

De tabbladen die iemand te zien krijgt, worden bepaald door die rechten — iemand zonder
"Keuken"-recht ziet dat tabblad simpelweg niet. Instellingen (code bekijken, restaurant
verlaten) blijft voor iedereen zichtbaar; menu beheren en team beheren vereisen het
"Instellingen"-recht (of eigenaarschap).

### Sitebeheer (alleen voor jou, als eigenaar van de website)

Onderaan het startscherm (en onderaan Instellingen, als je al in een restaurant zit) staat een subtiele link **"⚙ Sitebeheer"**. Daarachter zit een apart, wachtwoord-beveiligd vak dat alleen jij als bouwer van de site gebruikt — gasten en gewone teamleden zien er verder niets van. Daarin kun je:

- **Alle restaurants** zien die ooit gemaakt zijn, met naam, code, aantal teamleden, aantal producten en aantal (open + historische) bestellingen.
- Elk restaurant **bezoeken** — je stapt dan met volledige rechten in dat restaurant (Bestellen, Keuken, Bezorgen, Historie, Voorraad én Instellingen), zonder dat dit iets verandert aan je eigen apparaat: jouw eigen restaurantcode in localStorage blijft ongemoeid, en je kunt met "← Terug naar beheerpaneel" weer terug.
- Elk restaurant **volledig verwijderen** (inclusief menu, bestellingen en historie) — dit kan niet ongedaan gemaakt worden.
- De **systeemupdates** schrijven en verwijderen (titel + tekst) — dit stond eerder in het Instellingen-tabblad van elk restaurant, maar staat nu alleen nog hier.

Dit werkt met een **echt account via Firebase Authentication** — er staat geen wachtwoord meer ergens in de broncode. Zo stel je dat in:

1. Ga in de Firebase-console naar **Build → Authentication** → **Get started**.
2. Tab **Sign-in method** → zet **E-mail/wachtwoord** aan.
3. Tab **Users** → **Add user** → vul jouw eigen e-mailadres en een sterk wachtwoord in. Dit is het account waarmee jij straks inlogt bij "⚙ Sitebeheer".

Je kunt zoveel van deze accounts aanmaken als je wilt (bijv. voor jezelf en een collega) — verwijder een account in **Authentication → Users** om iemands toegang in te trekken.

⚠️ Dit inlogscherm alleen is niet genoeg: zonder de databaseregels hieronder kan iemand die de Firebase-URL kent nog steeds rechtstreeks (buiten de site om) alle restaurantgegevens opvragen. De regels hieronder zorgen dat dát ook écht bij Firebase zelf wordt afgedwongen, niet alleen in de browser.

Geen server nodig — dit is een pure HTML/CSS/JS site die op **GitHub Pages** kan draaien. Firebase Realtime Database regelt de live synchronisatie.

## 1. Firebase-project opzetten (gratis)

1. Ga naar [console.firebase.google.com](https://console.firebase.google.com) en klik **Project toevoegen**. Geef het een naam, Google Analytics is niet nodig.
2. Klik in het linkermenu op **Build → Realtime Database** → **Database maken**.
   - Kies een locatie (bijv. Europe).
   - Start in **testmodus** (open lezen/schrijven) zodat de app meteen werkt. Zie stap 3 voor uitleg over beveiliging.
3. Ga naar **Projectinstellingen** (tandwiel linksboven) → tab **Algemeen** → scroll naar **Jouw apps** → klik het `</>` (web) icoon → geef de app een naam → **App registreren**.
4. Je krijgt nu een `firebaseConfig` object te zien. Kopieer de waarden naar `firebase-config.js` in dit project:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "...",   // belangrijk: deze staat niet altijd standaard in het codeblok — check bij Realtime Database > gegevens, bovenaan staat de URL
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
};
```

### Databaseregels (testmodus verloopt na 30 dagen)

Ga naar **Realtime Database → Regels** en zet:

```json
{
  "rules": {
    "restaurants": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$code": {
        ".read": true,
        ".write": true
      }
    },
    "site_updates": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

Wat dit doet:
- Gewone gasten/teamleden kunnen, zoals voorheen, gewoon bij één specifiek restaurant via de code (`restaurants/K3F7Q/...`) — dat blijft zonder inloggen werken, precies zoals de app dat gebruikt.
- **Alle** restaurants tegelijk opvragen (`restaurants` zonder code — dat is wat het sitebeheer-paneel doet om de lijst te tonen) kan alleen nog met een geldige Firebase-inlogsessie (`auth != null`). Zonder in te loggen krijg je die lijst dus nergens meer te zien, ook niet door rechtstreeks met de database te praten.
- Systeemupdates blijven voor iedereen leesbaar, maar alleen ingelogde beheerders kunnen ze plaatsen/verwijderen.

⚠️ Let op: de restaurantcode (`$code`) zelf werkt nog steeds als een soort "wachtwoord" voor dat ene restaurant — wie de code weet of raadt, kan dat restaurant lezen/wijzigen. Dat is een bewuste, lichte keuze van dit project (net als bij een tafelbon-code) en geen verkeerde configuratie; alleen het **sitebeheer-gedeelte** (alle restaurants + systeemupdates) is nu met een echt account afgeschermd.

## 2. Lokaal uitproberen

Open `index.html` gewoon in je browser — geen build-stap nodig. Open het op twee apparaten (of twee tabbladen) met dezelfde restaurantcode om de live sync te zien.

## 3. Op GitHub zetten en publiceren met GitHub Pages

```bash
git init
git add .
git commit -m "Ticket: realtime restaurant bestelsysteem"
git branch -M main
git remote add origin https://github.com/JOUW-GEBRUIKERSNAAM/ticket-restaurant.git
git push -u origin main
```

Daarna:
1. Ga naar je repository op GitHub → **Settings → Pages**.
2. Bij **Source** kies je de `main` branch en map `/ (root)`.
3. Na een minuutje staat je site live op `https://JOUW-GEBRUIKERSNAAM.github.io/ticket-restaurant/`.

## Bestandsoverzicht

| Bestand | Inhoud |
|---|---|
| `index.html` | Paginastructuur, laadt Firebase + de app |
| `style.css` | Het "keukenbon"-ontwerp: donker staal + vlam-oranje + bestelbonnetjes |
| `app.js` | Alle logica: schermen, winkelwagen, Firebase-synchronisatie |
| `firebase-config.js` | Hier vul je je eigen Firebase-gegevens in |

## Hoe de data eruitziet in Firebase

```
restaurants/
  K3F7Q/                      ← restaurantcode
    naam: "De Gouden Pan"
    menu/
      -Nabc.../ { naam, prijs, categorie, emoji, ijsKeuze, slagroomKeuze, uitverkocht }
    categorieen/
      -Ncat.../ { naam, aangemaakt }   ← aan te maken/verwijderen in Instellingen > Producten
    leden/
      -Nlid.../ {
        naam: "Sara",
        functie: "Ober",
        eigenaar: false,
        rechten: { bestellen: true, keuken: false, bezorgen: false, historie: false, instellingen: false }
      }
    thema/
      achtergrond: "#150f0b"
      tekst: "#f3ead9"
      patroon: "vlam"        ← optioneel, zie PATROON_OPTIES in app.js
      lettertype: "poppins"  ← optioneel, zie LETTERTYPE_OPTIES in app.js
    plattegrond/
      "2-5": { type: "tafel", nummer: 1, bezet: false }
      "2-6": { type: "stoel", richting: "boven" }   ← richting: boven|rechts|onder|links (rotatie)
      "3-2": { type: "bank", bankId: "bank...", oriëntatie: "horizontaal", lengte: 3, volgorde: 0 }
      "3-3": { type: "bank-deel", bankId: "bank...", oriëntatie: "horizontaal", lengte: 3, volgorde: 1 }
      "3-4": { type: "bank-deel", bankId: "bank...", oriëntatie: "horizontaal", lengte: 3, volgorde: 2 }
    bestellingen/
      -Nxyz.../ {
        items: [{ naam, prijs, aantal, notitie }],
        tafel: "Tafel 4",
        status: "nieuw" | "bereiden" | "klaar",
        aangemaakt: <timestamp>
      }
```

Zodra de status van een bestelling wijzigt (via de Keuken- of Bezorgen-pagina), ziet ieder open apparaat dat direct — dat is de kern van Firebase Realtime Database: elk apparaat "luistert" naar dezelfde data.

## Uitbreidingsideeën

- Inloggen per medewerker (Firebase Authentication)
- Geluid/notificatie bij een nieuwe bestelling in de keuken
- Geschiedenis van bezorgde bestellingen bewaren i.p.v. verwijderen
- Prijzen per bestelling optellen tot een dagtotaal in Instellingen
