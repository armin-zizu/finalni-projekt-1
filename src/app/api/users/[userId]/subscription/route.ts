import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

// GET - Get subscription for user
async function getHandler(req: AuthRequest, { params }: { params: Promise<{ userId: string }> }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Email je glavni identifikator - koristimo email iz JWT tokena
    let userEmail = req.user.email || req.user.userId;
    const { userId: requestedUserId } = await params;
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // Ako userId nije email format, pokušaj da nađeš email iz baze
    if (!emailRegex.test(userEmail) && !uuidRegex.test(userEmail)) {
      try {
        const userLookup = await query(
          'SELECT email FROM users WHERE id::text = $1 OR email = $1 LIMIT 1',
          [req.user.userId]
        );
        if (userLookup.rows.length > 0) {
          userEmail = userLookup.rows[0].email;
        }
      } catch (lookupError: any) {
        if (req.user.email && emailRegex.test(req.user.email)) {
          userEmail = req.user.email;
        }
      }
    }
    
    // Resolv-ujemo email u ID za SQL upite (baza koristi text u user_id koloni, ne UUID)
    let userIdForDb: string;
    
    if (emailRegex.test(userEmail)) {
      const userResult = await query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [userEmail]
      );
      
      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      
      userIdForDb = userResult.rows[0].id;
    } else {
      userIdForDb = userEmail;
    }

    // Get subscription
    const subscriptionResult = await query(
      `SELECT id, user_id, status, start_date, end_date, monthly_price, 
              trial_end_date, grace_end_date, last_payment_date, is_active, 
              subscription_data, created_at, updated_at
       FROM subscriptions
       WHERE user_id = $1::text`,
      [userIdForDb]
    );

    let subscription: any = null;
    if (subscriptionResult.rows.length > 0) {
      subscription = subscriptionResult.rows[0];
    }

    // Get payment history
    const paymentsResult = await query(
      `SELECT id, amount, note, date, valid_until, created_at
       FROM payments
       WHERE user_id = $1::text
       ORDER BY date DESC`,
      [userIdForDb]
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
      [userIdForDb]
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
         VALUES ($1::text, 'trial', $2, $3, TRUE, $4)
         RETURNING id, user_id, status, start_date, end_date, monthly_price, 
                   trial_end_date, grace_end_date, last_payment_date, is_active, 
                   subscription_data, created_at, updated_at`,
        [userIdForDb, 12.00, trialEndDate, now]
      );

      subscription = insertResult.rows[0];
    }

    // Parse subscription_data JSONB field for additional payment info
    let subscriptionDataJson = {};
    try {
      if (subscription.subscription_data && typeof subscription.subscription_data === 'object') {
        subscriptionDataJson = subscription.subscription_data;
      } else if (typeof subscription.subscription_data === 'string') {
        subscriptionDataJson = JSON.parse(subscription.subscription_data);
      }
    } catch (e) {
      console.warn('Get subscription - Error parsing subscription_data:', e);
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
      subscriptionData: subscriptionDataJson,
      createdAt: subscription.created_at,
      updatedAt: subscription.updated_at,
      userCreatedAt: userCreatedAt,
      payments: payments,
    };

    console.log('Get subscription - Success:', {
      userId: userEmail,
      userIdForDb,
      hasSubscription: !!subscription,
      subscriptionId: subscription?.id,
      subscriptionStatus: subscription?.status,
      isActive: subscription?.is_active,
    });
    
    return NextResponse.json({ subscription: subscriptionData });
  } catch (error: any) {
    console.error('Get subscription error:', error);
    console.error('Get subscription - Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// POST/PUT - Update subscription
async function postHandler(req: AuthRequest, { params }: { params: Promise<{ userId: string }> }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Email je glavni identifikator - koristimo email iz JWT tokena
    let userEmail = req.user.email || req.user.userId;
    const { userId: requestedUserId } = await params;
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // Ako userId nije email format, pokušaj da nađeš email iz baze
    if (!emailRegex.test(userEmail) && !uuidRegex.test(userEmail)) {
      try {
        const userLookup = await query(
          'SELECT email FROM users WHERE id::text = $1 OR email = $1 LIMIT 1',
          [req.user.userId]
        );
        if (userLookup.rows.length > 0) {
          userEmail = userLookup.rows[0].email;
        }
      } catch (lookupError: any) {
        if (req.user.email && emailRegex.test(req.user.email)) {
          userEmail = req.user.email;
        }
      }
    }
    
    // Resolv-ujemo email u ID za SQL upite
    let userIdForDb: string;
    
    if (emailRegex.test(userEmail)) {
      const userResult = await query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [userEmail]
      );
      
      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      
      userIdForDb = userResult.rows[0].id;
    } else {
      userIdForDb = userEmail;
    }

    const body = await req.json();
    const {
      monthlyPrice,
      trialEndDate,
      graceEndDate,
      lastPaymentDate,
      isActive,
      endDate,
      status,
      subscriptionData,
    } = body;

    // Get existing subscription_data if updating
    let existingSubscriptionData = {};
    if (subscriptionData) {
      const existingResult = await query(
        `SELECT subscription_data FROM subscriptions WHERE user_id = $1::text`,
        [userIdForDb]
      );
      if (existingResult.rows.length > 0 && existingResult.rows[0].subscription_data) {
        try {
          existingSubscriptionData = typeof existingResult.rows[0].subscription_data === 'object' 
            ? existingResult.rows[0].subscription_data 
            : JSON.parse(existingResult.rows[0].subscription_data);
        } catch (e) {
          console.warn('Error parsing existing subscription_data:', e);
        }
      }
      // Merge with new subscriptionData
      Object.assign(existingSubscriptionData, subscriptionData);
    }

    // Update or insert subscription
    const result = await query(
      `INSERT INTO subscriptions (user_id, monthly_price, trial_end_date, grace_end_date, 
                                  last_payment_date, is_active, end_date, status, subscription_data)
       VALUES ($1::text, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id)
       DO UPDATE SET
         monthly_price = COALESCE(EXCLUDED.monthly_price, subscriptions.monthly_price),
         trial_end_date = COALESCE(EXCLUDED.trial_end_date, subscriptions.trial_end_date),
         grace_end_date = COALESCE(EXCLUDED.grace_end_date, subscriptions.grace_end_date),
         last_payment_date = COALESCE(EXCLUDED.last_payment_date, subscriptions.last_payment_date),
         is_active = COALESCE(EXCLUDED.is_active, subscriptions.is_active),
         end_date = COALESCE(EXCLUDED.end_date, subscriptions.end_date),
         status = COALESCE(EXCLUDED.status, subscriptions.status),
         subscription_data = COALESCE(EXCLUDED.subscription_data, subscriptions.subscription_data),
         updated_at = NOW()
       RETURNING id, user_id, status, start_date, end_date, monthly_price, 
                 trial_end_date, grace_end_date, last_payment_date, is_active, 
                 subscription_data, created_at, updated_at`,
      [
        userIdForDb,
        monthlyPrice || 12.00,
        trialEndDate || null,
        graceEndDate || null,
        lastPaymentDate || null,
        isActive !== undefined ? isActive : true,
        endDate || null,
        status || 'active',
        subscriptionData ? JSON.stringify(existingSubscriptionData) : null,
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

export const GET = (req: NextRequest, context: { params: Promise<{ userId: string }> }) => {
  return withAuth((authReq: AuthRequest) => getHandler(authReq, context))(req);
};

export const POST = (req: NextRequest, context: { params: Promise<{ userId: string }> }) => {
  return withAuth((authReq: AuthRequest) => postHandler(authReq, context))(req);
};
export const PUT = (req: NextRequest, context: { params: Promise<{ userId: string }> }) => {
  return withAuth((authReq: AuthRequest) => postHandler(authReq, context))(req);
};


