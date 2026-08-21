// ============================================================
// VUL HIER JE EIGEN FIREBASE-GEGEVENS IN
// ============================================================
// 1. Ga naar https://console.firebase.google.com en maak een gratis project
// 2. Ga naar "Build" -> "Realtime Database" -> "Create Database"
//    - Kies een locatie, start in "test mode"
// 3. Ga naar het tandwiel-icoon -> "Project settings" -> tab "General"
// 4. Scroll naar "Your apps" -> klik "</>" (web) -> registreer een app
// 5. Kopieer het firebaseConfig object hieronder in de plek
//    (let op: bij Realtime Database heb je ook een "databaseURL" nodig,
//    die staat er ook bij)
// ============================================================
const firebaseConfig = {
  apiKey: "JOUW_API_KEY",
  authDomain: "JOUW_PROJECT.firebaseapp.com",
  databaseURL: "https://JOUW_PROJECT-default-rtdb.firebaseio.com",
  projectId: "JOUW_PROJECT_ID",
  storageBucket: "JOUW_PROJECT.appspot.com",
  messagingSenderId: "JOUW_SENDER_ID",
  appId: "JOUW_APP_ID"
};
