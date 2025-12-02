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
 */
async function isFirstUser(): Promise<boolean> {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("createdAt", "asc"), limit(1));
    const snapshot = await getDocs(q);
    return snapshot.empty; // Ako nema korisnika, ovo je prvi
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

    // Ako korisnik već postoji, ne kreiraj ponovo
    if (userDoc.exists()) {
      console.log("Korisnik već postoji u Firestore, preskačem inicijalizaciju");
      return;
    }

    // Svi novi korisnici postaju vlasnici svog računa
    const isOwner = true;

    // Kreiraj glavni user dokument sa osnovnim podacima
    await setDoc(userDocRef, {
      email: email || null,
      appName: "Moja Aplikacija",
      cjenovnik: defaultCjenovnik,
      createdAt: Timestamp.fromDate(now),
      lastSignIn: Timestamp.fromDate(now),
      isOwner: isOwner, // Svi novi korisnici su vlasnici
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


