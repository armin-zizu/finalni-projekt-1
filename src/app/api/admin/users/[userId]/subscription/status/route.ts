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

    // Check if user is admin
    const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "gitara.zizu@gmail.com";
    const currentUserResult = await query(
      `SELECT email, is_owner FROM users WHERE id = $1`,
      [req.user.userId]
    );

    if (currentUserResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const currentUser = currentUserResult.rows[0];
    // Samo gitara.zizu@gmail.com ima pristup admin panelu (ne bilo koji owner)
    const adminEmailLower = ADMIN_EMAIL.toLowerCase().trim();
    const userEmailLower = (currentUser.email || "").toLowerCase().trim();
    const isAdmin = userEmailLower === adminEmailLower;

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const { userId } = await params;
    const body = await req.json();
    const { status } = body; // "trial" | "premium" | "grace" | "inactive"

    if (!['trial', 'premium', 'grace', 'inactive'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: trial, premium, grace, inactive' },
        { status: 400 }
      );
    }

    // Get current subscription
    const subscriptionResult = await query(
      `SELECT id, user_id, end_date, trial_end_date, grace_end_date, last_payment_date, is_active
       FROM subscriptions
       WHERE user_id = $1`,
      [userId]
    );

    const now = new Date();
    let updateData: any = {};

    if (status === "trial") {
      // Set trial period - user has no payment, subscription is active
      const trialEndDate = new Date(now);
      trialEndDate.setDate(trialEndDate.getDate() + 15);
      updateData = {
        trial_end_date: trialEndDate,
        is_active: true,
        end_date: null,
        grace_end_date: null,
        last_payment_date: null,
        status: 'trial',
      };
    } else if (status === "premium") {
      // Set premium - user has active subscription
      const expiryDate = new Date(now);
      expiryDate.setMonth(expiryDate.getMonth() + 1);
      updateData = {
        end_date: expiryDate,
        is_active: true,
        trial_end_date: null,
        grace_end_date: null,
        status: 'active',
        last_payment_date: subscriptionResult.rows[0]?.last_payment_date || now,
      };
    } else if (status === "grace") {
      // Set grace period - subscription expired, but has grace period
      const graceEndDate = new Date(now);
      graceEndDate.setDate(graceEndDate.getDate() + 5);
      updateData = {
        grace_end_date: graceEndDate,
        is_active: false,
        end_date: now,
        trial_end_date: null,
        status: 'expired',
      };
    } else {
      // inactive - completely blocked
      const existingSubscription = subscriptionResult.rows[0];
      let expiryDate = new Date(0);
      
      if (existingSubscription) {
        if (existingSubscription.grace_end_date) {
          expiryDate = new Date(existingSubscription.grace_end_date);
        } else if (existingSubscription.end_date) {
          const endDate = new Date(existingSubscription.end_date);
          if (endDate.getFullYear() > 1970) {
            expiryDate = endDate;
          }
        }
      }
      
      updateData = {
        end_date: expiryDate,
        is_active: false,
        trial_end_date: null,
        status: 'inactive',
        last_payment_date: existingSubscription?.last_payment_date || (() => {
          const pastDate = new Date(now);
          pastDate.setDate(pastDate.getDate() - 100);
          return pastDate;
        })(),
      };
    }

    // Update or insert subscription
    const result = await query(
      `INSERT INTO subscriptions (user_id, monthly_price, trial_end_date, grace_end_date, 
                                  last_payment_date, is_active, end_date, status, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
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
        12.00,
        updateData.trial_end_date,
        updateData.grace_end_date,
        updateData.last_payment_date,
        updateData.is_active,
        updateData.end_date,
        updateData.status,
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
    console.error('Change subscription status error:', error);
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

