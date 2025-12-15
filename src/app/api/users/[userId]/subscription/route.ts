import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

// GET - Get subscription for user
async function getHandler(req: AuthRequest): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = req.user.userId;

    // Get subscription
    const subscriptionResult = await query(
      `SELECT id, user_id, status, start_date, end_date, monthly_price, 
              trial_end_date, grace_end_date, last_payment_date, is_active, 
              subscription_data, created_at, updated_at
       FROM subscriptions
       WHERE user_id = $1`,
      [userId]
    );

    let subscription: any = null;
    if (subscriptionResult.rows.length > 0) {
      subscription = subscriptionResult.rows[0];
    }

    // Get payment history
    const paymentsResult = await query(
      `SELECT id, amount, note, date, valid_until, created_at
       FROM payments
       WHERE user_id = $1
       ORDER BY date DESC`,
      [userId]
    );

    const payments = paymentsResult.rows.map((p: any) => ({
      id: p.id,
      amount: parseFloat(p.amount),
      note: p.note,
      date: p.date,
      validUntil: p.valid_until || undefined,
      createdAt: p.created_at,
    }));

    // Get user created_at for trial period calculation
    const userResult = await query(
      `SELECT created_at FROM users WHERE id = $1`,
      [userId]
    );
    const userCreatedAt = userResult.rows[0]?.created_at || null;

    // If no subscription exists, create default one
    if (!subscription) {
      const now = new Date();
      const trialEndDate = userCreatedAt 
        ? new Date(new Date(userCreatedAt).getTime() + 15 * 24 * 60 * 60 * 1000) // 15 days
        : new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

      const insertResult = await query(
        `INSERT INTO subscriptions (user_id, status, monthly_price, trial_end_date, is_active, start_date)
         VALUES ($1, 'trial', $2, $3, TRUE, $4)
         RETURNING id, user_id, status, start_date, end_date, monthly_price, 
                   trial_end_date, grace_end_date, last_payment_date, is_active, 
                   subscription_data, created_at, updated_at`,
        [userId, 12.00, trialEndDate, now]
      );

      subscription = insertResult.rows[0];
    }

    // Transform subscription data
    const subscriptionData = {
      id: subscription.id,
      userId: subscription.user_id,
      status: subscription.status,
      startDate: subscription.start_date,
      endDate: subscription.end_date,
      monthlyPrice: parseFloat(subscription.monthly_price) || 12.00,
      trialEndDate: subscription.trial_end_date,
      graceEndDate: subscription.grace_end_date,
      lastPaymentDate: subscription.last_payment_date,
      isActive: subscription.is_active !== false,
      subscriptionData: subscription.subscription_data || {},
      createdAt: subscription.created_at,
      updatedAt: subscription.updated_at,
      userCreatedAt: userCreatedAt,
      payments: payments,
    };

    return NextResponse.json({ subscription: subscriptionData });
  } catch (error: any) {
    console.error('Get subscription error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// POST/PUT - Update subscription
async function postHandler(req: AuthRequest): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = req.user.userId;
    const body = await req.json();
    const {
      monthlyPrice,
      trialEndDate,
      graceEndDate,
      lastPaymentDate,
      isActive,
      endDate,
      status,
    } = body;

    // Update or insert subscription
    const result = await query(
      `INSERT INTO subscriptions (user_id, monthly_price, trial_end_date, grace_end_date, 
                                  last_payment_date, is_active, end_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id)
       DO UPDATE SET
         monthly_price = EXCLUDED.monthly_price,
         trial_end_date = EXCLUDED.trial_end_date,
         grace_end_date = EXCLUDED.grace_end_date,
         last_payment_date = EXCLUDED.last_payment_date,
         is_active = EXCLUDED.is_active,
         end_date = EXCLUDED.end_date,
         status = EXCLUDED.status,
         updated_at = NOW()
       RETURNING id, user_id, status, start_date, end_date, monthly_price, 
                 trial_end_date, grace_end_date, last_payment_date, is_active, 
                 subscription_data, created_at, updated_at`,
      [
        userId,
        monthlyPrice || 12.00,
        trialEndDate || null,
        graceEndDate || null,
        lastPaymentDate || null,
        isActive !== undefined ? isActive : true,
        endDate || null,
        status || 'active',
      ]
    );

    const subscription = result.rows[0];

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        userId: subscription.user_id,
        status: subscription.status,
        startDate: subscription.start_date,
        endDate: subscription.end_date,
        monthlyPrice: parseFloat(subscription.monthly_price),
        trialEndDate: subscription.trial_end_date,
        graceEndDate: subscription.grace_end_date,
        lastPaymentDate: subscription.last_payment_date,
        isActive: subscription.is_active,
        createdAt: subscription.created_at,
        updatedAt: subscription.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Update subscription error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
export const PUT = withAuth(postHandler);


