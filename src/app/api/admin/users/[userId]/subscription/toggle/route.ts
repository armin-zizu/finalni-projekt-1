import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

async function putHandler(
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
    const { isActive } = body;

    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'isActive must be a boolean' },
        { status: 400 }
      );
    }

    // Get current subscription
    const subscriptionResult = await query(
      `SELECT id, user_id, end_date, trial_end_date, is_active
       FROM subscriptions
       WHERE user_id = $1::uuid`,
      [userId]
    );

    const now = new Date();

    if (subscriptionResult.rows.length > 0) {
      const subscription = subscriptionResult.rows[0];
      let trialEndDate: Date | null = null;
      
      if (subscription.trial_end_date) {
        trialEndDate = new Date(subscription.trial_end_date);
      }

      // Find trial end date
      let startDate = now;
      if (trialEndDate && now < trialEndDate) {
        startDate = trialEndDate;
      }

      const expiryDate = isActive
        ? new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000) // +30 days
        : new Date(0); // Past date

      // Update subscription
      const result = await query(
        `UPDATE subscriptions
         SET is_active = $1, end_date = $2, grace_end_date = NULL, updated_at = NOW()
         WHERE user_id = $3::uuid
         RETURNING id, user_id, status, start_date, end_date, monthly_price, 
                   trial_end_date, grace_end_date, last_payment_date, is_active, 
                   subscription_data, created_at, updated_at`,
        [isActive, expiryDate, userId]
      );

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
    } else {
      // Create new subscription
      const expiryDate = isActive
        ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        : new Date(0);

      const result = await query(
        `INSERT INTO subscriptions (user_id, monthly_price, is_active, end_date, status, created_at, updated_at)
         VALUES ($1::uuid, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id, user_id, status, start_date, end_date, monthly_price, 
                   trial_end_date, grace_end_date, last_payment_date, is_active, 
                   subscription_data, created_at, updated_at`,
        [userId, 12.00, isActive, expiryDate, isActive ? 'active' : 'inactive']
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
    }
  } catch (error: any) {
    console.error('Toggle subscription error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  return withAuth((authReq) => putHandler(authReq, { params }))(req);
}

