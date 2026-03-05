import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getPool, resolveUserIdToUUID } from "@/lib/db";
import { withAuth, AuthRequest } from "@/lib/auth-middleware";

async function ensureOrdersTable() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      supplier_id TEXT,
      date_text TEXT,
      date TEXT,
      ordered_at TEXT,
      received_at TEXT,
      status TEXT,
      items JSONB DEFAULT '[]'::jsonb,
      total_items INTEGER DEFAULT 0,
      invoice_proof_images JSONB DEFAULT '[]'::jsonb,
      was_edited BOOLEAN DEFAULT FALSE,
      edited_at TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_id TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS date_text TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS date TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS ordered_at TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS received_at TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_items INTEGER DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_proof_images JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS was_edited BOOLEAN DEFAULT FALSE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS edited_at TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
  `);
}

// GET /api/orders - vraca sve narudzbe za trenutnog korisnika
export const GET = withAuth(async (req: AuthRequest) => {
  let userId = req.user?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    userId = await resolveUserIdToUUID(userId);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Korisnik nije pronađen" }, { status: 400 });
  }

  const pool = getPool();
  try {
    await ensureOrdersTable();
    const result = await pool.query(
      `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return NextResponse.json({ orders: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "DB error" }, { status: 500 });
  }
});

// POST /api/orders - kreiraj ili azuriraj narudzbu
export const POST = withAuth(async (req: AuthRequest) => {
  let userId = req.user?.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    userId = await resolveUserIdToUUID(userId);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Korisnik nije pronađen" }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: "Neispravan JSON payload" }, { status: 400 });
  }

  const items = Array.isArray(body?.items) ? body.items : [];
  const invoiceProofImages = Array.isArray(body?.invoiceProofImages) ? body.invoiceProofImages : [];
  const totalItems = typeof body?.totalItems === "number" ? body.totalItems : items.length;
  const dateValue = body?.date || body?.date_text || null;

  const payload = {
    id: body?.id || randomUUID(),
    supplierId: body?.supplierId || body?.supplier_id || null,
    date: dateValue,
    orderedAt: body?.orderedAt || body?.ordered_at || null,
    receivedAt: body?.receivedAt || body?.received_at || null,
    status: body?.status || "pending",
    items,
    totalItems,
    invoiceProofImages,
    wasEdited: Boolean(body?.wasEdited || body?.was_edited),
    editedAt: body?.editedAt || body?.edited_at || null,
  };

  const pool = getPool();

  try {
    await ensureOrdersTable();
    const result = await pool.query(
      `INSERT INTO orders (id, user_id, supplier_id, date_text, date, ordered_at, received_at, status, items, total_items, invoice_proof_images, was_edited, edited_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, '[]'::jsonb), COALESCE($10, 0), COALESCE($11, '[]'::jsonb), $12, $13)
       ON CONFLICT (id) DO UPDATE SET
         supplier_id = EXCLUDED.supplier_id,
         date_text = EXCLUDED.date_text,
         date = EXCLUDED.date,
         ordered_at = EXCLUDED.ordered_at,
         received_at = EXCLUDED.received_at,
         status = EXCLUDED.status,
         items = EXCLUDED.items,
         total_items = EXCLUDED.total_items,
         invoice_proof_images = EXCLUDED.invoice_proof_images,
         was_edited = EXCLUDED.was_edited,
         edited_at = EXCLUDED.edited_at,
         updated_at = now()
       RETURNING *;`,
      [
        payload.id,
        userId,
        payload.supplierId,
        payload.date,
        payload.date,
        payload.orderedAt,
        payload.receivedAt,
        payload.status,
        JSON.stringify(payload.items || []),
        payload.totalItems,
        JSON.stringify(payload.invoiceProofImages || []),
        payload.wasEdited,
        payload.editedAt,
      ]
    );

    return NextResponse.json({ order: result.rows[0] });
  } catch (err: any) {
    console.error("❌ Greška u /api/orders POST:", err);
    return NextResponse.json({ error: err.message || "DB error" }, { status: 500 });
  }
});
