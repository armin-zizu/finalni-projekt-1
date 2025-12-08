import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, cert, getApps } from "firebase-admin/app";

// Inicijalizuj Firebase Admin samo ako još nije inicijalizovan
function initializeAdmin() {
  if (getApps().length > 0) {
    return; // Već je inicijalizovan
  }

  // Provjeri da li su environment varijable dostupne
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    throw new Error("Firebase Admin environment varijable nisu postavljene");
  }

  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  } catch (error: any) {
    console.error("Greška pri inicijalizaciji Firebase Admin:", error);
    throw new Error(`Firebase Admin inicijalizacija neuspješna: ${error.message}`);
  }
}

export async function GET(request: NextRequest) {
  try {
    // Inicijalizuj Firebase Admin ako nije već
    try {
      initializeAdmin();
    } catch (initError: any) {
      console.error("Greška pri inicijalizaciji Firebase Admin u API route:", initError);
      return NextResponse.json(
        { error: `Firebase Admin inicijalizacija neuspješna: ${initError.message}` },
        { status: 500 }
      );
    }

    // Verifikuj admin token iz header-a
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Nedostaje authorization token' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    let adminAuth;
    try {
      adminAuth = getAuth();
    } catch (error: any) {
      console.error("Greška pri dobijanju Admin Auth instance:", error);
      return NextResponse.json(
        { error: `Firebase Admin Auth greška: ${error.message}` },
        { status: 500 }
      );
    }
    
    // Verifikuj token korisnika
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json(
        { error: 'Nevažeći token' },
        { status: 401 }
      );
    }

    // Proveri da li je admin
    const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "gitara.zizu@gmail.com";
    if (decodedToken.email !== ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Nedozvoljen pristup' },
        { status: 403 }
      );
    }

    // Listaj sve korisnike iz Firebase Auth
    const listUsersResult = await adminAuth.listUsers();
    const authUsers = listUsersResult.users;

    // Uzmi Firestore instance (admin SDK)
    const db = getFirestore();
    const usersCollection = db.collection('users');

    // Za svakog korisnika iz Auth, uzmi podatke iz Firestore
    const usersWithData = await Promise.all(
      authUsers.map(async (authUser) => {
        try {
          const userId = authUser.uid;
          const userDoc = await usersCollection.doc(userId).get();
          const userData = userDoc.exists ? userDoc.data() : {};

          // Učitaj subscription
          let subscription = {
            isActive: false,
            monthlyPrice: 12,
            lastPaymentDate: null,
            expiryDate: null,
            graceEndDate: null,
            trialEndDate: null,
            paymentHistory: [],
          };

          try {
            const subscriptionDoc = await usersCollection
              .doc(userId)
              .collection('subscription')
              .doc('info')
              .get();

            if (subscriptionDoc.exists) {
              const subData = subscriptionDoc.data();
              const now = new Date();
              
              const trialEndDate = subData?.trialEndDate?.toDate?.() || 
                (subData?.trialEndDate ? new Date(subData.trialEndDate) : null);
              const expiryDate = subData?.expiryDate?.toDate?.() || 
                (subData?.expiryDate ? new Date(subData.expiryDate) : null);
              const graceEndDate = subData?.graceEndDate?.toDate?.() || 
                (subData?.graceEndDate ? new Date(subData.graceEndDate) : null);

              let isTrial = false;
              let isGracePeriod = false;
              let daysRemaining = 0;
              let daysUntilExpiry = 0;
              let daysInGrace = 0;

              const hasPayment = subData?.lastPaymentDate != null;
              const explicitIsActive = subData?.isActive !== undefined ? subData.isActive : null;

              if (trialEndDate && now < trialEndDate && !hasPayment && explicitIsActive !== false) {
                isTrial = true;
                daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              } else if (expiryDate) {
                if (now < expiryDate) {
                  daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                } else {
                  let calculatedGraceEnd: Date | null = null;
                  if (graceEndDate) {
                    calculatedGraceEnd = graceEndDate;
                  } else if (expiryDate) {
                    calculatedGraceEnd = new Date(expiryDate);
                    calculatedGraceEnd.setDate(calculatedGraceEnd.getDate() + 5);
                  }

                  if (calculatedGraceEnd && now < calculatedGraceEnd) {
                    isGracePeriod = true;
                    daysInGrace = Math.ceil((calculatedGraceEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  }
                }
              } else if (graceEndDate) {
                if (graceEndDate && now < graceEndDate) {
                  isGracePeriod = true;
                  daysInGrace = Math.ceil((graceEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                }
              }

              const isActiveFromFirebase = subData?.isActive === true;

              subscription = {
                isActive: isActiveFromFirebase,
                monthlyPrice: subData?.monthlyPrice || 12,
                lastPaymentDate: subData?.lastPaymentDate?.toDate?.() || 
                  (subData?.lastPaymentDate ? new Date(subData.lastPaymentDate) : null),
                expiryDate: expiryDate,
                graceEndDate: graceEndDate,
                trialEndDate: trialEndDate,
                paymentHistory: (subData?.paymentHistory || []).map((p: any) => ({
                  date: p.date?.toDate?.() || (p.date ? new Date(p.date) : new Date()),
                  amount: p.amount || 0,
                  note: p.note || "",
                  validUntil: p.validUntil?.toDate?.() || (p.validUntil ? new Date(p.validUntil) : undefined),
                })),
                isTrial,
                isPremium: hasPayment && !isTrial && (isActiveFromFirebase || isGracePeriod),
                isGracePeriod,
                daysRemaining,
                daysUntilExpiry,
                daysInGrace,
                paymentPendingVerification: subData?.paymentPendingVerification || false,
                paymentRequestedAt: subData?.paymentRequestedAt?.toDate?.() || 
                  (subData?.paymentRequestedAt ? new Date(subData.paymentRequestedAt) : null),
                paymentRequestedAmount: subData?.paymentRequestedAmount || 0,
                paymentRequestedMonths: subData?.paymentRequestedMonths || 0,
                paymentReferenceNumber: subData?.paymentReferenceNumber || null,
              };
            }
          } catch (subError) {
            console.warn(`Greška pri učitavanju subscription za korisnika ${userId}:`, subError);
          }

          return {
            id: userId,
            email: authUser.email || null,
            appName: userData?.appName || "N/A",
            createdAt: authUser.metadata.creationTime ? new Date(authUser.metadata.creationTime) : null,
            lastSignIn: authUser.metadata.lastSignInTime ? new Date(authUser.metadata.lastSignInTime) : null,
            imeKorisnika: userData?.imeKorisnika || undefined,
            brojTelefona: userData?.brojTelefona || undefined,
            lokacija: userData?.lokacija || undefined,
            subscription,
          };
        } catch (error) {
          console.error(`Greška pri obradi korisnika ${authUser.uid}:`, error);
          // Vrati osnovne podatke iz Auth ako ne možemo učitati iz Firestore
          return {
            id: authUser.uid,
            email: authUser.email || null,
            appName: "N/A",
            createdAt: authUser.metadata.creationTime ? new Date(authUser.metadata.creationTime) : null,
            lastSignIn: authUser.metadata.lastSignInTime ? new Date(authUser.metadata.lastSignInTime) : null,
            subscription: {
              isActive: false,
              monthlyPrice: 12,
              lastPaymentDate: null,
              expiryDate: null,
              graceEndDate: null,
              trialEndDate: null,
              paymentHistory: [],
            },
          };
        }
      })
    );

    return NextResponse.json({ users: usersWithData });
  } catch (error: any) {
    console.error('Greška pri učitavanju korisnika:', error);
    return NextResponse.json(
      { error: error.message || 'Greška pri učitavanju korisnika' },
      { status: 500 }
    );
  }
}

