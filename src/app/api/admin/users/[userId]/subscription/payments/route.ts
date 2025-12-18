import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

async function postHandler(
  req: AuthRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin using email
    const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "gitara.zizu@gmail.com";
    const adminEmailLower = ADMIN_EMAIL.toLowerCase().trim();
    const userEmailLower = (req.user.email || "").toLowerCase().trim();
    const isAdmin = userEmailLower === adminEmailLower;

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const { userId: userIdParam } = await params;
    
    // Resolve userId to actual database UUID
    let userId: string = userIdParam;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // If userId is an email or non-UUID, try to resolve it
    if (emailRegex.test(userIdParam) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userIdParam)) {
      let lookupResult = await query(
        `SELECT id::text as id FROM users WHERE id = $1 OR email = $1 LIMIT 1`,
        [userIdParam]
      );
      
      if (lookupResult.rows.length === 0 && emailRegex.test(userIdParam)) {
        // Try case-insensitive email lookup
        lookupResult = await query(
          `SELECT id::text as id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
          [userIdParam]
        );
      }
      
      if (lookupResult.rows.length > 0) {
        userId = lookupResult.rows[0].id.toString();
      } else {
        return NextResponse.json(
          { error: 'Target user not found' },
          { status: 404 }
        );
      }
    }
    const body = await req.json();
    const { amount, months = 1, note } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount is required and must be positive' },
        { status: 400 }
      );
    }

    const now = new Date();

    // Get current subscription to calculate expiry date
    const subscriptionResult = await query(
      `SELECT end_date, trial_end_date FROM subscriptions WHERE user_id = $1`,
      [userId]
    );

    let existingExpiryDate: Date | null = null;
    let trialEndDate: Date | null = null;

    if (subscriptionResult.rows.length > 0) {
      const sub = subscriptionResult.rows[0];
      existingExpiryDate = sub.end_date;
      trialEndDate = sub.trial_end_date;
    }

    // Calculate new expiry date
    let startDate = now;
    if (existingExpiryDate && now < new Date(existingExpiryDate)) {
      startDate = new Date(existingExpiryDate);
    } else if (trialEndDate && now < new Date(trialEndDate)) {
      startDate = new Date(trialEndDate);
    }

    const newExpiryDate = new Date(startDate);
    newExpiryDate.setMonth(newExpiryDate.getMonth() + months);
    const validUntil = new Date(newExpiryDate);

    // Insert payment
    const paymentResult = await query(
      `INSERT INTO payments (user_id, amount, note, date, valid_until)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, amount, note, date, valid_until, created_at`,
      [
        userId,
        amount,
        note || `Bank Transfer - ${months} ${months === 1 ? 'month' : 'months'}`,
        now,
        validUntil,
      ]
    );

    const payment = paymentResult.rows[0];

    // Get existing subscription_data to merge with payment request clearing
    const existingSubResult = await query(
      `SELECT subscription_data FROM subscriptions WHERE user_id = $1`,
      [userId]
    );
    
    let subscriptionDataJson: any = {};
    if (existingSubResult.rows.length > 0 && existingSubResult.rows[0].subscription_data) {
      try {
        subscriptionDataJson = typeof existingSubResult.rows[0].subscription_data === 'object'
          ? existingSubResult.rows[0].subscription_data
          : JSON.parse(existingSubResult.rows[0].subscription_data);
      } catch (e) {
        console.warn('Error parsing subscription_data:', e);
      }
    }
    
    // Clear payment request fields
    subscriptionDataJson.paymentPendingVerification = false;
    subscriptionDataJson.paymentRequestedAt = null;
    subscriptionDataJson.paymentRequestedAmount = null;
    subscriptionDataJson.paymentRequestedMonths = null;
    subscriptionDataJson.paymentReferenceNumber = null;

    // Update subscription
    await query(
      `UPDATE subscriptions
       SET end_date = $1,
           last_payment_date = $2,
           is_active = TRUE,
           status = 'active',
           grace_end_date = NULL,
           subscription_data = $4::jsonb,
           updated_at = NOW()
       WHERE user_id = $3`,
      [newExpiryDate, now, userId, JSON.stringify(subscriptionDataJson)]
    );

    return NextResponse.json({
      payment: {
        id: payment.id,
        amount: parseFloat(payment.amount),
        note: payment.note,
        date: payment.date,
        validUntil: payment.valid_until,
        createdAt: payment.created_at,
      },
    });
  } catch (error: any) {
    console.error('Add payment error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  return withAuth((authReq) => postHandler(authReq, { params }))(req);
}

