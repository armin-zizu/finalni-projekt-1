// Utility funkcija za inicijalizaciju novog korisnika
import { db } from "./firestore";
import { doc, setDoc, Timestamp, collection, getDocs, query, orderBy, limit } from "firebase/firestore";

// Default cjenovnik - samo Kafa za nove korisnike
const defaultCjenovnik = [
  {
    naziv: "Kafa",
    cijena: 2.5,
    jeZestoko: false,
    proizvodnaCijena: 1.5,
    nabavnaCijena: 1.2,
    pocetnoStanje: 0,
  },
];

/**
 * Provjeri da li je email prvi put registriran u sistemu
 * Provjerava da li taj SPECIFIČNI email već postoji u Firestore SA AKTIVNIM KORISNIKOM
 * (korisnik sa device dokumenata = aktivan u Firebase Auth)
 * Ako email ne postoji sa aktivnim korisnikom, taj email postaje vlasnik
 * @param email - Email adresa za provjeru
 */
async function isFirstUser(email: string | null): Promise<boolean> {
  if (!email) {
    console.log("isFirstUser - Email nije dostupan, pretpostavljam da nije prvi korisnik");
    return false;
  }
  
  try {
    const usersRef = collection(db, "users");
    const { query: queryFn, where: whereFn } = await import("firebase/firestore");
    
    // Provjeri da li taj SPECIFIČNI email već postoji u Firestore
    const emailQuery = queryFn(usersRef, whereFn("email", "==", email.toLowerCase().trim()));
    const snapshot = await getDocs(emailQuery);
    
    // Ako email ne postoji u Firestore, ovo je prvi put da se registruje
    if (snapshot.empty) {
      console.log("isFirstUser provjera - email:", email, "ne postoji u Firestore, isFirst: true");
      return true;
    }
    
    // Ako email postoji u Firestore, provjeri da li postoji aktivan korisnik (sa device dokumenata)
    // Ako nema aktivnog korisnika, ovo je prvi put da se registruje
    for (const userDoc of snapshot.docs) {
      const userId = userDoc.id;
      try {
        // Provjeri da li korisnik ima device dokumenata (indikator da je aktivan u Firebase Auth)
        const devicesQuery = queryFn(collection(db, "devices"), whereFn("userId", "==", userId));
        const devicesSnapshot = await getDocs(devicesQuery);
        
        // Ako korisnik ima device dokumenata, znači da je aktivan
        if (!devicesSnapshot.empty) {
          console.log("isFirstUser provjera - email:", email, "postoji sa aktivnim korisnikom (ima device dokumenata), isFirst: false");
          return false;
        }
      } catch (deviceError) {
        // Ako ne možemo provjeriti device dokumente, pretpostavimo da korisnik nije aktivan
        console.warn("isFirstUser - Greška pri provjeri device dokumenata za korisnika:", userId, deviceError);
      }
    }
    
    // Ako email postoji u Firestore ali nema aktivnih korisnika, ovo je prvi put da se registruje
    console.log("isFirstUser provjera - email:", email, "postoji u Firestore ali nema aktivnih korisnika, isFirst: true");
    return true;
  } catch (error) {
    console.error("Greška pri provjeri prvog korisnika:", error);
    // Ako ne uspije provjera, pretpostavi da nije prvi (sigurnije)
    return false;
  }
}


/**
 * Kreira početnu strukturu za novog korisnika u Firestore
 * @param userId - User ID iz Firebase Auth
 * @param email - Email adresa korisnika
 */
export async function initializeUser(userId: string, email: string | null) {
  try {
    const now = new Date();
    const userDocRef = doc(db, "users", userId);

    // Provjeri da li korisnik već postoji
    const { getDoc } = await import("firebase/firestore");
    const userDoc = await getDoc(userDocRef);

    // Ako korisnik već postoji, provjeri da li je vlasnik
    if (userDoc.exists()) {
      const existingData = userDoc.data();
      const existingIsOwner = existingData.isOwner === true;
      console.log("⚠️ initializeUser - Korisnik već postoji u Firestore, isOwner:", existingIsOwner);
      
      // Ako korisnik već postoji i nije vlasnik, provjeri da li je prvi put da se taj email registruje
      // (možda je korisnik obrisan iz Firebase Auth ali dokument ostao u Firestore)
      if (!existingIsOwner) {
        console.log("🔍 initializeUser - Korisnik postoji ali nije vlasnik, provjeravam da li je prvi put da se email registruje...");
        const isFirst = await isFirstUser(email);
        if (isFirst) {
          console.log("✅ initializeUser - Email se prvi put registruje, ažuriram isOwner: true");
          await setDoc(userDocRef, { isOwner: true }, { merge: true });
        }
      }
      return; // Ne kreiraj ponovo
    }

    // Provjeri da li je ovo prvi put da se taj email registruje PRIJE kreiranja dokumenta
    console.log("🔍 initializeUser - Provjeravam da li je prvi put da se email registruje...");
    const isFirst = await isFirstUser(email);
    const isOwner = isFirst; // Svaki novi email (account) postaje vlasnik
    
    console.log("📊 initializeUser - Rezultat provjere:", { isFirst, isOwner, userId, email });

    // Kreiraj glavni user dokument sa osnovnim podacima
    await setDoc(userDocRef, {
      email: email || null,
      appName: "Moja Aplikacija",
      cjenovnik: defaultCjenovnik,
      createdAt: Timestamp.fromDate(now),
      lastSignIn: Timestamp.fromDate(now),
      isOwner: isOwner, // Svaki novi korisnik je vlasnik svog profila
    });

    // Kreiraj subscription dokument sa trial periodom
    const trialEndDate = new Date(now);
    trialEndDate.setDate(trialEndDate.getDate() + 15); // 15 dana trial

    const subscriptionRef = doc(db, "users", userId, "subscription", "info");
    await setDoc(subscriptionRef, {
      isActive: true,
      monthlyPrice: 12,
      lastPaymentDate: null,
      expiryDate: null,
      graceEndDate: null,
      trialEndDate: Timestamp.fromDate(trialEndDate),
      paymentHistory: [],
      createdAt: Timestamp.fromDate(now),
    });


    console.log("Korisnik uspješno inicijalizovan u Firestore:", userId, "isOwner:", isOwner);
  } catch (error) {
    console.error("Greška pri inicijalizaciji korisnika:", error);
    throw error;
  }
}


