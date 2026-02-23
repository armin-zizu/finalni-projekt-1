import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

async function getHandler(req: AuthRequest): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let userIdForDb = req.user.userId;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(userIdForDb)) {
      const userResult = await query(
        'SELECT id FROM users WHERE id::text = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
        [userIdForDb]
      );

      if (userResult.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      userIdForDb = userResult.rows[0].id;
    }

    let subscription: any = null;
    let subscriptionsTableExists = true;

    try {
      const subscriptionResult = await query(
        `SELECT id, user_id, status, start_date, end_date, monthly_price,
                trial_end_date, grace_end_date, last_payment_date, is_active,
                subscription_data, created_at, updated_at
         FROM subscriptions
         WHERE user_id = $1::uuid`,
        [userIdForDb]
      );

      if (subscriptionResult.rows.length > 0) {
        subscription = subscriptionResult.rows[0];
      }
    } catch (subscriptionError: any) {
      if (subscriptionError?.code === '42P01') {
        subscriptionsTableExists = false;
      } else {
        throw subscriptionError;
      }
    }

    let payments: any[] = [];
    try {
      const paymentsResult = await query(
        `SELECT id, amount, note, date, valid_until, created_at
         FROM payments
         WHERE user_id = $1::uuid
         ORDER BY date DESC`,
        [userIdForDb]
      );

      payments = paymentsResult.rows.map((p: any) => ({
        id: p.id,
        amount: parseFloat(p.amount),
        note: p.note,
        date: p.date,
        validUntil: p.valid_until || undefined,
        createdAt: p.created_at,
      }));
    } catch (paymentsError: any) {
      if (paymentsError?.code !== '42P01') {
        throw paymentsError;
      }
    }

    const userResult = await query(
      `SELECT created_at FROM users WHERE id = $1::uuid`,
      [userIdForDb]
    );
    const userCreatedAt = userResult.rows[0]?.created_at || null;

    if (!subscription && subscriptionsTableExists) {
      const now = new Date();
      const trialEndDate = userCreatedAt
        ? new Date(new Date(userCreatedAt).getTime() + 15 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

      const insertResult = await query(
        `INSERT INTO subscriptions (user_id, status, monthly_price, trial_end_date, is_active, start_date)
         VALUES ($1::uuid, 'trial', $2, $3, TRUE, $4)
         RETURNING id, user_id, status, start_date, end_date, monthly_price,
                   trial_end_date, grace_end_date, last_payment_date, is_active,
                   subscription_data, created_at, updated_at`,
        [userIdForDb, 12.0, trialEndDate, now]
      );

      subscription = insertResult.rows[0];
    }

    if (!subscription) {
      return NextResponse.json({
        subscription: null,
      });
    }

    let subscriptionDataJson = {};
    try {
      if (subscription.subscription_data && typeof subscription.subscription_data === 'object') {
        subscriptionDataJson = subscription.subscription_data;
      } else if (typeof subscription.subscription_data === 'string') {
        subscriptionDataJson = JSON.parse(subscription.subscription_data);
      }
    } catch {
      subscriptionDataJson = {};
    }

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        userId: subscription.user_id,
        status: subscription.status,
        startDate: subscription.start_date,
        endDate: subscription.end_date,
        monthlyPrice: parseFloat(subscription.monthly_price) || 12.0,
        trialEndDate: subscription.trial_end_date,
        graceEndDate: subscription.grace_end_date,
        lastPaymentDate: subscription.last_payment_date,
        isActive: subscription.is_active !== false,
        subscriptionData: subscriptionDataJson,
        createdAt: subscription.created_at,
        updatedAt: subscription.updated_at,
        userCreatedAt,
        payments,
      },
    });
  } catch (error: any) {
    console.error('Get current user subscription error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load subscription',
        detail: error?.message || 'Unknown subscription error',
      },
      { status: 500 }
    );
  }
}

export const GET = (req: NextRequest) => withAuth((authReq) => getHandler(authReq))(req);
