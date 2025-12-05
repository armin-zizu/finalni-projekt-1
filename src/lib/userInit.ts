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
 * Provjeri da li je korisnik prvi korisnik u sistemu
 * Provjerava da li već postoji bilo koji korisnik sa isOwner: true koji ima device dokumente
 * (što znači da je aktivan - postoji u Firebase Auth)
 * Ako nema aktivnih vlasnika, novi korisnik postaje vlasnik
 */
async function isFirstUser(): Promise<boolean> {
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    
    // Provjeri da li postoji bilo koji korisnik sa isOwner: true koji ima device dokumente
    // (što znači da je aktivan)
    let hasActiveOwner = false;
    
    for (const userDoc of snapshot.docs) {
      const userData = userDoc.data();
      if (userData.isOwner === true) {
        // Provjeri da li ovaj korisnik ima device dokumente (što znači da je aktivan)
        try {
          const { collection: getCollection, getDocs: getDocsQuery, query: queryFn, where: whereFn } = await import("firebase/firestore");
          const devicesRef = getCollection(db, "devices");
          const devicesQuery = queryFn(devicesRef, whereFn("userId", "==", userDoc.id));
          const devicesSnapshot = await getDocsQuery(devicesQuery);
          
          // Ako korisnik ima device dokumente, znači da je aktivan
          if (!devicesSnapshot.empty) {
            hasActiveOwner = true;
            console.log("isFirstUser - Pronađen aktivan vlasnik:", userDoc.id);
            break; // Nema potrebe provjeravati dalje
          }
        } catch (deviceError) {
          // Ignoriraj greške pri provjeri device dokumenata
          console.warn("isFirstUser - Greška pri provjeri device dokumenata za korisnika:", userDoc.id, deviceError);
        }
      }
    }
    
    // Ako nema aktivnih vlasnika, ovo je prvi korisnik
    const isFirst = !hasActiveOwner;
    console.log("isFirstUser provjera - broj korisnika:", snapshot.size, "hasActiveOwner:", hasActiveOwner, "isFirst:", isFirst);
    return isFirst;
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
      
      // Ako korisnik već postoji i nije vlasnik, provjeri da li je prvi korisnik
      // (možda je korisnik obrisan iz Firebase Auth ali dokument ostao u Firestore)
      if (!existingIsOwner) {
        console.log("🔍 initializeUser - Korisnik postoji ali nije vlasnik, provjeravam da li je prvi...");
        const isFirst = await isFirstUser();
        if (isFirst) {
          console.log("✅ initializeUser - Korisnik je prvi, ažuriram isOwner: true");
          await setDoc(userDocRef, { isOwner: true }, { merge: true });
        }
      }
      return; // Ne kreiraj ponovo
    }

    // Provjeri da li je ovo prvi korisnik u sistemu PRIJE kreiranja dokumenta
    console.log("🔍 initializeUser - Provjeravam da li je prvi korisnik...");
    const isFirst = await isFirstUser();
    const isOwner = isFirst; // Samo prvi korisnik u sistemu dobija isOwner: true
    
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


