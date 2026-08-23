# Restaurants 🔥 — realtime restaurant bestelsysteem

Een klein bestelsysteem voor een restaurant: **Bestellen → Keuken → Bezorgen**,
live gesynchroniseerd tussen alle apparaten via Firebase Realtime Database.

- **Restaurant maken/joinen**: bij het maken van een restaurant, én bij het joinen met een code, vul je ook je eigen naam in. Zo weet iedereen wie er in het team zit.
- **Bestellen**: klik producten aan (met emoji, uit een gecategoriseerde kiezer), voeg per product een notitie toe, verstuur de bestelling.
- **Keuken**: nieuwe bestellingen komen direct binnen als "bonnetjes" op élk apparaat dat de site open heeft. Klik op **Bereiden** en daarna op **Bereiden klaar**.
- **Bezorgen**: bestellingen die klaar zijn verschijnen hier. Klik op **Bezorgd** om af te ronden — de bestelling verhuist dan naar Historie.
- **Historie**: alle bezorgde bestellingen per restaurant, plus een tabel met hoeveel er per categorie besteld is. Individuele bestellingen of de hele historie zijn te verwijderen.
- **Instellingen**: onderverdeeld in vijf tabbladen:
  - **Algemeen**: restaurantnaam wijzigen, restaurantcode bekijken/delen, team & rechten (eigenaar), systeemupdates, restaurant verlaten.
  - **Producten**: het menu beheren (producten toevoegen/verwijderen met emoji, prijs en categorie), en per product aangeven of gasten een **ijskeuze** en/of **slagroomkeuze** krijgen bij het bestellen.
  - **Voorraad**: elk product op **uitverkocht** zetten zonder het te verwijderen — het verschijnt dan grijs en niet-klikbaar bij Bestellen.
  - **Achtergrond**: een kant-en-klare kleurencombinatie kiezen, of je eigen achtergrond- en tekstkleur instellen — geldt voor alle apparaten van dit restaurant.
  - **Plattegrond**: een rooster waarop je tafels en stoelen kunt plaatsen om de indeling van je restaurant weer te geven.

  Producten, Voorraad, Achtergrond en Plattegrond zijn alleen zichtbaar voor teamleden met het "Instellingen"-recht (zie Team & rechten hieronder).

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

### Beheerderswachtwoord voor systeemupdates

Onder Instellingen staat een **Systeemupdates**-blok dat voor iedereen die de site gebruikt zichtbaar is, maar alleen jij (als bouwer van de site) kunt er iets in plaatsen — inclusief een optionele **titel** per update. Dit werkt met een simpel wachtwoord, ingesteld bovenin `app.js`:

```js
const BEHEERDER_WACHTWOORD = "verander-dit-wachtwoord";
```

Pas deze waarde aan naar iets alleen bij jou bekends vóórdat je de site publiceert. Let op: dit is een lichte, client-side beveiliging — prima voor een schoolproject of eigen gebruik, maar iemand die in de broncode kijkt kan het wachtwoord vinden. Voor echte beveiliging is Firebase Authentication + strengere databaseregels nodig.

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

Ga naar **Realtime Database → Regels** en zet (voor een schoolproject/demo):

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

⚠️ Dit betekent dat iedereen met de URL kan lezen/schrijven — prima voor een demo of eigen gebruik, maar niet voor een productie-app met gevoelige data.

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
    plattegrond/
      "2-5": { type: "tafel" }
      "2-6": { type: "stoel" }
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
