import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { months, amount, userId } = await request.json();

    if (!months || !amount || !userId) {
      return NextResponse.json(
        { error: "Months, amount, and userId are required" },
        { status: 400 }
      );
    }

    const accessToken = await getPayPalAccessToken();
    
    // Kreiraj PayPal order
    const order = await createPayPalOrder(accessToken, {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "EUR", // PayPal sandbox ne podržava BAM, koristimo EUR za testiranje
            value: amount.toFixed(2),
          },
          description: `Pretplata - ${months} ${months === 1 ? "mjesec" : "mjeseci"}`,
          custom_id: `${userId}-${months}-${Date.now()}`,
        },
      ],
      application_context: {
        brand_name: "Office App",
        landing_page: "BILLING",
        user_action: "PAY_NOW",
        return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/profile?payment=success`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/profile?payment=cancelled`,
      },
    });

    // Vrati approval URL umjesto order ID
    const approvalUrl = order.links?.find((link: any) => link.rel === "approve")?.href;
    
    return NextResponse.json({ orderID: order.id, approvalUrl });
  } catch (error: any) {
    console.error("Error creating PayPal order:", error);
    return NextResponse.json(
      { error: error.message || "Error creating PayPal order" },
      { status: 500 }
    );
  }
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const baseUrl = process.env.PAYPAL_MODE === "live" 
    ? "https://api-m.paypal.com" 
    : "https://api-m.sandbox.paypal.com";

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json();
  return data.access_token;
}

async function createPayPalOrder(accessToken: string, orderData: any) {
  const baseUrl = process.env.PAYPAL_MODE === "live" 
    ? "https://api-m.paypal.com" 
    : "https://api-m.sandbox.paypal.com";

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(orderData),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to create PayPal order");
  }
  return data;
}

