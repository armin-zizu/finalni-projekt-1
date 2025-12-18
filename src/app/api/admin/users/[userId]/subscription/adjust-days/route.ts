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

    // Check if user is admin - use email from JWT token (more reliable)
    const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "gitara.zizu@gmail.com";
    const userEmail = req.user.email || '';
    const adminEmailLower = ADMIN_EMAIL.toLowerCase().trim();
    const userEmailLower = (userEmail || "").toLowerCase().trim();
    const isAdmin = userEmail && userEmailLower === adminEmailLower;

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const { userId } = await params;
    const body = await req.json();
    const { days, type } = body; // type: 'premium' | 'trial'

    if (!days || typeof days !== 'number') {
      return NextResponse.json(
        { error: 'Days must be a number' },
        { status: 400 }
      );
    }

    // Get current subscription
    const subscriptionResult = await query(
      `SELECT id, user_id, end_date, trial_end_date, is_active, updated_at
       FROM subscriptions
       WHERE user_id = $1`,
      [userId]
    );

    if (subscriptionResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    const subscription = subscriptionResult.rows[0];
    const now = new Date();

    let updateField: string;
    let currentDate: Date | null = null;

    if (type === 'premium') {
      updateField = 'end_date';
      currentDate = subscription.end_date ? new Date(subscription.end_date) : null;
      if (!currentDate || currentDate < now) {
        currentDate = now;
      }
    } else {
      updateField = 'trial_end_date';
      currentDate = subscription.trial_end_date ? new Date(subscription.trial_end_date) : null;
      if (!currentDate) {
        currentDate = new Date(now);
        currentDate.setDate(currentDate.getDate() + 15);
      }
    }

    // Add or subtract days
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);

    // If new date is in the past and days > 0, set to now + days
    if (newDate < now && days > 0) {
      newDate.setTime(now.getTime() + days * 24 * 60 * 60 * 1000);
    }

    // Update subscription
    const updateQuery = type === 'premium'
      ? `UPDATE subscriptions 
         SET end_date = $1, is_active = $2, updated_at = NOW()
         WHERE user_id = $3
         RETURNING id, user_id, status, start_date, end_date, monthly_price, 
                   trial_end_date, grace_end_date, last_payment_date, is_active, 
                   subscription_data, created_at, updated_at`
      : `UPDATE subscriptions 
         SET trial_end_date = $1, updated_at = NOW()
         WHERE user_id = $2
         RETURNING id, user_id, status, start_date, end_date, monthly_price, 
                   trial_end_date, grace_end_date, last_payment_date, is_active, 
                   subscription_data, created_at, updated_at`;

    const updateParams = type === 'premium'
      ? [newDate, newDate > now, userId]
      : [newDate, userId];

    const result = await query(updateQuery, updateParams);

    const updatedSubscription = result.rows[0];

    return NextResponse.json({
      subscription: {
        id: updatedSubscription.id,
        userId: updatedSubscription.user_id,
        status: updatedSubscription.status,
        startDate: updatedSubscription.start_date,
        endDate: updatedSubscription.end_date,
        monthlyPrice: parseFloat(updatedSubscription.monthly_price),
        trialEndDate: updatedSubscription.trial_end_date,
        graceEndDate: updatedSubscription.grace_end_date,
        lastPaymentDate: updatedSubscription.last_payment_date,
        isActive: updatedSubscription.is_active,
        createdAt: updatedSubscription.created_at,
        updatedAt: updatedSubscription.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Adjust days error:', error);
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

