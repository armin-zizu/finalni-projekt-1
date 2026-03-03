import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";

// GET /api/orders - vraca sve narudzbe za trenutnog korisnika
export const GET = withAuth(async (req: NextRequest) => {
  const userId = req.user?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
