import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "../../../lib/firestore";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-12-18.acacia",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "No signature" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  // Handle checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Dohvati metadata
    const months = parseInt(session.metadata?.months || "1");
    const amount = parseFloat(session.metadata?.amount || "0");
    const userId = session.metadata?.userId;

    if (!userId) {
      console.error("No userId in session metadata");
      return NextResponse.json({ received: true });
    }

    try {
      // Ažuriraj subscription u Firestore
      const subscriptionRef = doc(db, "users", userId, "subscription", "info");
      const subscriptionDoc = await getDoc(subscriptionRef);

      const now = new Date();
      const newExpiryDate = new Date(now);
      newExpiryDate.setMonth(newExpiryDate.getMonth() + months);

      let subscriptionData: any = {};
      if (subscriptionDoc.exists()) {
        subscriptionData = subscriptionDoc.data();
      }

      const paymentHistory = subscriptionData.paymentHistory || [];
      paymentHistory.push({
        date: Timestamp.fromDate(now),
        amount,
        note: `Stripe - ${months} ${months === 1 ? "mjesec" : "mjeseci"}`,
        stripeSessionId: session.id,
      });

      await setDoc(subscriptionRef, {
        ...subscriptionData,
        isActive: true,
        lastPaymentDate: Timestamp.fromDate(now),
        expiryDate: Timestamp.fromDate(newExpiryDate),
        graceEndDate: null,
        paymentHistory,
        updatedAt: Timestamp.fromDate(now),
      }, { merge: true });

      console.log(`Subscription updated for user ${userId}`);
    } catch (error) {
      console.error("Error updating subscription:", error);
    }
  }

  return NextResponse.json({ received: true });
}

