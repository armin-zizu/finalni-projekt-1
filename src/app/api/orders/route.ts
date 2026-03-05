import { NextRequest, NextResponse } from "next/server";
import { getPool, resolveUserIdToUUID } from "@/lib/db";
import { withAuth, AuthRequest } from "@/lib/auth-middleware";

// GET /api/orders - vraca sve narudzbe za trenutnog korisnika
export const GET = withAuth(async (req: AuthRequest) => {
  let userId = req.user?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Pretvori email u UUID ako treba
  try {
    userId = await resolveUserIdToUUID(userId);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Korisnik nije pronađen" }, { status: 400 });
  }

  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return NextResponse.json({ orders: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "DB error" }, { status: 500 });
  }
});
