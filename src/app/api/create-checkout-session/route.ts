import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-12-18.acacia",
});

export async function POST(request: NextRequest) {
  try {
    const { months, amount, userId } = await request.json();

    if (!months || !amount || !userId) {
      return NextResponse.json(
        { error: "Months, amount, and userId are required" },
        { status: 400 }
      );
    }

    // Kreiraj checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "bam",
            product_data: {
              name: `Pretplata - ${months} ${months === 1 ? "mjesec" : "mjeseci"}`,
              description: `Pretplata za ${months} ${months === 1 ? "mjesec" : "mjeseci"} (${amount} KM)`,
            },
            unit_amount: Math.round(amount * 100), // Stripe koristi cente, BAM ima 2 decimale
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/profile?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/profile?payment=cancelled`,
      metadata: {
        months: months.toString(),
        amount: amount.toString(),
        userId: userId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: error.message || "Error creating checkout session" },
      { status: 500 }
    );
  }
}

