import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

// Helper function to calculate subscription status (similar to SubscriptionContext)
function calculateSubscriptionStatus(
  subscription: any,
  payments: any[],
  userCreatedAt: Date | null
): any {
  const now = new Date();
  let trialEndDate: Date | null = subscription?.trial_end_date ? new Date(subscription.trial_end_date) : null;
  let expiryDate: Date | null = subscription?.end_date ? new Date(subscription.end_date) : null;
  let graceEndDate: Date | null = subscription?.grace_end_date ? new Date(subscription.grace_end_date) : null;
  let isTrial = false;
  let isGracePeriod = false;
  let daysRemaining = 0;
  let daysUntilExpiry = 0;
  let daysInGrace = 0;

  const explicitIsActive = subscription?.is_active !== undefined ? subscription.is_active : null;
  const hasPayment = subscription?.last_payment_date != null;

  // If no trial end date exists and user is not explicitly deactivated, create one (15 days from registration)
  if (!trialEndDate && userCreatedAt && explicitIsActive !== false) {
    trialEndDate = new Date(userCreatedAt);
    trialEndDate.setDate(trialEndDate.getDate() + 15);
  }

  // Check if in trial period
  if (trialEndDate && now < trialEndDate && !hasPayment && explicitIsActive !== false) {
    isTrial = true;
    daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  } else if (expiryDate) {
    if (now < expiryDate) {
      // Subscription is active
      daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      // Subscription expired, check grace period
      if (!graceEndDate) {
        // Create grace period (5 days from expiry) if not explicitly set
        graceEndDate = new Date(expiryDate);
        graceEndDate.setDate(graceEndDate.getDate() + 5);
      }

      if (graceEndDate && now < graceEndDate) {
        isGracePeriod = true;
        daysInGrace = Math.ceil((graceEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }
    }
  } else if (graceEndDate) {
    // If no expiryDate but graceEndDate exists, check grace period
    if (graceEndDate && now < graceEndDate) {
      isGracePeriod = true;
      daysInGrace = Math.ceil((graceEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  const isActiveFromDB = subscription?.is_active === true;
  const isActive = isTrial || (expiryDate && now < expiryDate) || isGracePeriod || (explicitIsActive === true);
  const isPremium = hasPayment && !isTrial && (isActiveFromDB || isGracePeriod);

  return {
    isActive,
    monthlyPrice: parseFloat(subscription?.monthly_price) || 12,
    lastPaymentDate: subscription?.last_payment_date ? new Date(subscription.last_payment_date) : null,
    expiryDate: expiryDate,
    graceEndDate: graceEndDate,
    trialEndDate: trialEndDate,
    paymentHistory: payments.map((p: any) => ({
      date: p.date ? new Date(p.date) : new Date(),
      amount: parseFloat(p.amount) || 0,
      note: p.note || "",
      validUntil: p.valid_until ? new Date(p.valid_until) : undefined,
    })),
    isTrial,
    isPremium,
    isGracePeriod,
    daysRemaining,
    daysUntilExpiry,
    daysInGrace,
    paymentPendingVerification: subscription?.subscription_data?.paymentPendingVerification || false,
    paymentRequestedAt: subscription?.subscription_data?.paymentRequestedAt ? new Date(subscription.subscription_data.paymentRequestedAt) : null,
    paymentRequestedAmount: subscription?.subscription_data?.paymentRequestedAmount || 0,
    paymentRequestedMonths: subscription?.subscription_data?.paymentRequestedMonths || 0,
    paymentReferenceNumber: subscription?.subscription_data?.paymentReferenceNumber || null,
  };
}

async function getHandler(req: AuthRequest): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "gitara.zizu@gmail.com";
    
    // Resolve userId to UUID if needed (it might be non-UUID like "admin-user")
    let userId: string = req.user.userId;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // If userId is not a UUID, try to find user by email
    if (!uuidRegex.test(userId)) {
      console.log('List users - Non-UUID userId detected, looking up by email:', userId);
      const userLookup = await query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [userId]
      );
      if (userLookup.rows.length > 0) {
        userId = userLookup.rows[0].id;
        console.log('List users - Found UUID for user:', userId);
      } else {
        console.error('List users - User not found:', req.user.userId);
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
    }
    
    // Get user from database to check admin status (userId is now guaranteed to be a valid UUID string)
    const currentUserResult = await query(
      `SELECT email, is_owner, role FROM users WHERE id = $1::uuid`,
      [userId]
    );

    if (currentUserResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const currentUser = currentUserResult.rows[0];
    const isAdmin = currentUser.email === ADMIN_EMAIL || currentUser.is_owner === true;

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Get all users from database
    const usersResult = await query(
      `SELECT id, email, app_name, role, is_owner, permissions, created_at, updated_at
       FROM users
       ORDER BY created_at DESC`
    );

    // Get last login for each user from devices table
    // Convert user_id UUID to text for consistent key lookup
    const lastLoginResult = await query(
      `SELECT user_id::text as user_id, MAX(last_login) as last_login
       FROM devices
       WHERE last_login IS NOT NULL
       GROUP BY user_id`
    );

    const lastLoginMap: Record<string, Date> = {};
    lastLoginResult.rows.forEach((row: any) => {
      if (row.last_login && row.user_id) {
        lastLoginMap[row.user_id] = new Date(row.last_login);
      }
    });

    // Get all subscriptions
    // Convert user_id UUID to text for consistent key lookup
    const subscriptionsResult = await query(
      `SELECT user_id::text as user_id, status, start_date, end_date, monthly_price, 
              trial_end_date, grace_end_date, last_payment_date, is_active, 
              subscription_data
       FROM subscriptions`
    );

    const subscriptionsMap: Record<string, any> = {};
    subscriptionsResult.rows.forEach((row: any) => {
      if (row.user_id) {
        subscriptionsMap[row.user_id] = row;
      }
    });

    // Get all payments grouped by user
    // Convert user_id UUID to text for consistent key lookup
    const paymentsResult = await query(
      `SELECT user_id::text as user_id, id, amount, note, date, valid_until, created_at
       FROM payments
       ORDER BY date DESC`
    );

    const paymentsMap: Record<string, any[]> = {};
    paymentsResult.rows.forEach((row: any) => {
      if (row.user_id) {
        if (!paymentsMap[row.user_id]) {
          paymentsMap[row.user_id] = [];
        }
        paymentsMap[row.user_id].push(row);
      }
    });

    // Build response with users and their subscriptions
    const usersWithData = await Promise.all(
      usersResult.rows.map(async (user: any) => {
        try {
          // Convert UUID to string for consistent key lookup in maps
          const userId = user.id.toString();
          const subscription = subscriptionsMap[userId] || null;
          const payments = paymentsMap[userId] || [];
          const userCreatedAt = user.created_at ? new Date(user.created_at) : null;

          // Calculate subscription status
          const subscriptionStatus = calculateSubscriptionStatus(
            subscription,
            payments,
            userCreatedAt
          );

          return {
            id: userId,
            email: user.email,
            appName: user.app_name || "N/A",
            createdAt: user.created_at ? new Date(user.created_at) : null,
            lastSignIn: lastLoginMap[userId] || null,
            imeKorisnika: user.permissions?.imeKorisnika || undefined,
            brojTelefona: user.permissions?.brojTelefona || undefined,
            lokacija: user.permissions?.lokacija || undefined,
            subscription: subscriptionStatus,
          };
        } catch (error) {
          console.error(`Error processing user ${user.id}:`, error);
          // Return basic user data if processing fails
          const userIdStr = user.id.toString();
          return {
            id: userIdStr,
            email: user.email,
            appName: user.app_name || "N/A",
            createdAt: user.created_at ? new Date(user.created_at) : null,
            lastSignIn: lastLoginMap[userIdStr] || null,
            subscription: {
              isActive: false,
              monthlyPrice: 12,
              lastPaymentDate: null,
              expiryDate: null,
              graceEndDate: null,
              trialEndDate: null,
              paymentHistory: [],
              isTrial: false,
              isPremium: false,
              isGracePeriod: false,
              daysRemaining: 0,
              daysUntilExpiry: 0,
              daysInGrace: 0,
              paymentPendingVerification: false,
              paymentRequestedAt: null,
              paymentRequestedAmount: 0,
              paymentRequestedMonths: 0,
              paymentReferenceNumber: null,
            },
          };
        }
      })
    );

    return NextResponse.json({ users: usersWithData });
  } catch (error: any) {
    console.error('Error loading users:', error);
    return NextResponse.json(
      { error: error.message || 'Error loading users' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
