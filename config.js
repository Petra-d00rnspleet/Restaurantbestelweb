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
  apiKey: "AIzaSyCKSu7jHB6WmXpC2s3e-fmYqHUl2hGETfE",
  authDomain: "sara-4dc17.firebaseapp.com",
  databaseURL: "https://sara-4dc17-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "sara-4dc17",
  storageBucket: "sara-4dc17.firebasestorage.app",
  messagingSenderId: "854913873540",
  appId: "1:854913873540:web:873fb076dde7aee281f4d1"
};
