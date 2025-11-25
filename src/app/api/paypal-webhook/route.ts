import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/firestore";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = body.event_type;
    const resource = body.resource;

    // Handle payment.capture.completed event
    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      const customId = resource.custom_id;
      if (!customId) {
        return NextResponse.json({ received: true });
      }

      // Parse custom_id: userId-months-timestamp
      const [userId, monthsStr] = customId.split("-");
      const months = parseInt(monthsStr);
      const amount = parseFloat(resource.amount.value);

      if (!userId || !months) {
        console.error("Invalid custom_id format:", customId);
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
          note: `PayPal - ${months} ${months === 1 ? "mjesec" : "mjeseci"}`,
          paypalTransactionId: resource.id,
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
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: error.message || "Webhook error" },
      { status: 500 }
    );
  }
}

