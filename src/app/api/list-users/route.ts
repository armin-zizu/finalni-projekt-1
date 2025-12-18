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
    
    // Resolve userId to UUID if needed (it might be non-UUID like "admin-user" from old tokens)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // IMPORTANT: Always use email from JWT if available, it's more reliable than userId
    let userEmail = req.user.email || '';
    let userId: string = req.user.userId || '';
    
    console.log('List users - Initial values:', { 
      userId, 
      userEmail, 
      hasEmail: !!userEmail,
      reqUserKeys: Object.keys(req.user || {}),
      reqUser: req.user
    });
    
    // If userId is not a UUID, try to resolve it using email or other methods
    if (!uuidRegex.test(userId)) {
      console.log('List users - Non-UUID userId detected, attempting resolution:', userId);
      
      // Priority 1: Use email from JWT token if available (most reliable)
      if (userEmail && emailRegex.test(userEmail)) {
        console.log('List users - Attempting lookup by email from JWT:', userEmail);
        try {
          // Try exact match first (fastest)
          let emailLookup = await query(
            'SELECT id::text as id, email FROM users WHERE email = $1 LIMIT 1',
            [userEmail]
          );
          
          // If not found, try case-insensitive
          if (emailLookup.rows.length === 0) {
            console.log('List users - Exact match failed, trying case-insensitive');
            emailLookup = await query(
              'SELECT id::text as id, email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
              [userEmail]
            );
          }
          
          console.log('List users - Email lookup result:', { 
            rowsFound: emailLookup.rows.length,
            firstRow: emailLookup.rows[0] || null,
            emailSearched: userEmail
          });
          
          if (emailLookup.rows.length > 0) {
            const foundId = emailLookup.rows[0].id;
            userId = foundId.toString();
            console.log('List users - Found userId via email from JWT:', userId);
          } else {
            console.error('List users - User not found by email from JWT:', userEmail);
            // Let's check what emails exist in database for debugging
            try {
              const allUsersCheck = await query('SELECT email FROM users LIMIT 10');
              console.log('List users - Sample emails in database:', allUsersCheck.rows.map((r: any) => r.email));
            } catch (debugError) {
              console.error('List users - Error getting sample emails:', debugError);
            }
            return NextResponse.json(
              { error: `User not found with email: ${userEmail}. Please log out and log in again.` },
              { status: 404 }
            );
          }
        } catch (queryError: any) {
          console.error('List users - Error executing email lookup query:', queryError);
          return NextResponse.json(
            { error: `Database error: ${queryError.message}` },
            { status: 500 }
          );
        }
      } else if (emailRegex.test(userId)) {
        // Priority 2: userId itself might be an email
        // userId itself might be an email
        console.log('List users - userId appears to be email:', userId);
        const emailLookup = await query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
          [userId]
        );
        if (emailLookup.rows.length > 0) {
          userId = emailLookup.rows[0].id.toString();
          console.log('List users - Found UUID from email-like userId:', userId);
        } else {
          console.error('List users - User not found by email-like userId:', userId);
          return NextResponse.json(
            { error: `User not found with email: ${userId}. Please log out and log in again.` },
            { status: 404 }
          );
        }
      } else {
        // Try by id as text (for backward compatibility) - but this shouldn't happen for admin-user
        console.log('List users - Trying to find user by id as text:', userId);
        const idLookup = await query(
          'SELECT id FROM users WHERE id::text = $1 LIMIT 1',
          [userId]
        );
        if (idLookup.rows.length > 0) {
          userId = idLookup.rows[0].id.toString();
          console.log('List users - Found UUID from id as text:', userId);
        } else {
          // Last resort: if we still have userEmail, try it one more time
          if (userEmail && emailRegex.test(userEmail)) {
            console.log('List users - Last resort: trying email again:', userEmail);
            const finalEmailLookup = await query(
              'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
              [userEmail]
            );
            if (finalEmailLookup.rows.length > 0) {
              userId = finalEmailLookup.rows[0].id.toString();
              console.log('List users - Found UUID via email (last resort):', userId);
            } else {
              console.error('List users - User not found by any method:', { userId, userEmail });
              return NextResponse.json(
                { error: `User not found. userId: ${userId}, email: ${userEmail || 'N/A'}. Please log out and log in again.` },
                { status: 404 }
              );
            }
          } else {
            console.error('List users - User not found by any method:', { userId, userEmail });
            return NextResponse.json(
              { error: `User not found. userId: ${userId}, email: ${userEmail || 'N/A'}. Please log out and log in again.` },
              { status: 404 }
            );
          }
        }
      }
    }
    
    // Note: userId can be any text format (not necessarily UUID) since users.id is text type in database
    console.log('List users - Successfully resolved userId:', userId);
    
    const currentUserResult = await query(
      `SELECT email, is_owner, role FROM users WHERE id = $1`,
      [userId]
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
        // Parse subscription_data JSONB field if it's a string
        let subscriptionDataParsed = row.subscription_data;
        if (subscriptionDataParsed && typeof subscriptionDataParsed === 'string') {
          try {
            subscriptionDataParsed = JSON.parse(subscriptionDataParsed);
          } catch (e) {
            console.warn('Error parsing subscription_data for user', row.user_id, e);
          }
        }
        subscriptionsMap[row.user_id] = {
          ...row,
          subscription_data: subscriptionDataParsed,
        };
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
