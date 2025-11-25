# Stripe Payment Setup

## Environment Varijable

Dodaj sljedeće environment varijable u `.env.local` i na Vercel:

```
STRIPE_SECRET_KEY=sk_test_... (ili sk_live_... za production)
STRIPE_PUBLISHABLE_KEY=pk_test_... (ili pk_live_... za production)
STRIPE_WEBHOOK_SECRET=whsec_... (za webhook)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app (ili http://localhost:3000 za development)
```

## Stripe Account Setup

1. Kreiraj Stripe account na https://stripe.com
2. Uzmi API keys iz Stripe Dashboard:
   - Test keys za development
   - Live keys za production
3. Konfiguriši webhook endpoint:
   - URL: `https://your-app.vercel.app/api/stripe-webhook`
   - Events: `checkout.session.completed`

## Test Kartice

Za testiranje, koristi Stripe test kartice:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

Expiry: bilo koji budući datum
CVC: bilo koji 3-cifreni broj

## Valuta

Stripe podržava BAM (Bosanska marka) samo u production modu. Za testiranje, možemo koristiti EUR ili USD.

Ako želiš koristiti BAM u production-u, kontaktiraj Stripe support da omoguće BAM za tvoj account.

