// Utility funkcija za inicijalizaciju novog korisnika
import { db } from "./firestore";
import { doc, setDoc, Timestamp } from "firebase/firestore";

// Default cjenovnik
const defaultCjenovnik = [
  {
    naziv: "Kafa",
    cijena: 2.5,
    jeZestoko: false,
    proizvodnaCijena: 1.5,
    nabavnaCijena: 1.2,
    pocetnoStanje: 10,
  },
  {
    naziv: "Čaj",
    cijena: 2,
    jeZestoko: false,
    proizvodnaCijena: 1.0,
    nabavnaCijena: 0.8,
    pocetnoStanje: 15,
  },
  {
    naziv: "Vodka",
    cijena: 2,
    jeZestoko: true,
    zestokoKolicina: 0.04,
    proizvodnaCijena: 1.2,
    nabavnaCijena: 0.9,
    pocetnoStanje: 1000,
  },
  {
    naziv: "Rakija",
    cijena: 2,
    jeZestoko: true,
    zestokoKolicina: 0.03,
    proizvodnaCijena: 1.1,
    nabavnaCijena: 0.85,
    pocetnoStanje: 800,
  },
];

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

    // Kreiraj glavni user dokument sa osnovnim podacima
    await setDoc(userDocRef, {
      email: email || null,
      appName: "Moja Aplikacija",
      cjenovnik: defaultCjenovnik,
      createdAt: Timestamp.fromDate(now),
      lastSignIn: Timestamp.fromDate(now),
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

    console.log("Korisnik uspješno inicijalizovan u Firestore:", userId);
  } catch (error) {
    console.error("Greška pri inicijalizaciji korisnika:", error);
    throw error;
  }
}

