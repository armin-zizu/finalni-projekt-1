import { NextResponse } from "next/server";
import { getPool, resolveUserIdToUUID } from "@/lib/db";
import { withAuth, AuthRequest } from "@/lib/auth-middleware";

type OrderPayload = {
  id?: string;
  supplierId?: string | null;
  date?: string | null;
  orderedAt?: string | null;
  receivedAt?: string | null;
  status?: string | null;
  items?: Array<{ name: string; quantity: number }>;
  totalItems?: number | null;
  invoiceProofImages?: any[];
  wasEdited?: boolean;
  editedAt?: string | null;
};

async function ensureOrdersTable() {
  const pool = getPool();
  await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      supplier_id UUID NULL,
      date_text TEXT,
      ordered_at TEXT,
      received_at TEXT,
      status TEXT DEFAULT 'pending',
      items JSONB DEFAULT '[]',
      total_items INT DEFAULT 0,
      invoice_proof_images JSONB DEFAULT '[]',
      was_edited BOOLEAN DEFAULT FALSE,
      edited_at TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  `);

  // Backfill missing columns if table already existed
  await pool.query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS supplier_id UUID NULL,
      ADD COLUMN IF NOT EXISTS date_text TEXT,
      ADD COLUMN IF NOT EXISTS ordered_at TEXT,
      ADD COLUMN IF NOT EXISTS received_at TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS total_items INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS invoice_proof_images JSONB DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS was_edited BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS edited_at TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `);
}

const mapRowToOrder = (row: any) => ({
  id: row.id,
  supplierId: row.supplier_id,
  date: row.date_text || row.date || null,
  orderedAt: row.ordered_at || null,
  receivedAt: row.received_at || null,
  status: row.status || "pending",
  items: Array.isArray(row.items) ? row.items : [],
  totalItems: row.total_items ?? (Array.isArray(row.items) ? row.items.length : 0),
  invoiceProofImages: row.invoice_proof_images || [],
  wasEdited: row.was_edited || false,
  editedAt: row.edited_at || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

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
    await ensureOrdersTable();
    const result = await pool.query(
      `SELECT id, supplier_id, date_text, ordered_at, received_at, status, items, total_items, invoice_proof_images, was_edited, edited_at, created_at, updated_at
         FROM orders
         WHERE user_id = $1
         ORDER BY created_at DESC`,
      [userId]
    );
    return NextResponse.json({ orders: result.rows.map(mapRowToOrder) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "DB error" }, { status: 500 });
  }
});

// POST /api/orders - kreiraj ili ažuriraj narudžbu
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

  const body = (await req.json()) as OrderPayload;
  const pool = getPool();

  try {
    await ensureOrdersTable();

    const payload = {
      supplierId: body.supplierId || null,
      date: body.date || null,
      orderedAt: body.orderedAt || null,
      receivedAt: body.receivedAt || null,
      status: body.status || "pending",
      items: Array.isArray(body.items) ? body.items : [],
      totalItems: body.totalItems ?? (Array.isArray(body.items) ? body.items.length : 0),
      invoiceProofImages: body.invoiceProofImages || [],
      wasEdited: !!body.wasEdited,
      editedAt: body.editedAt || null,
    };

    let result;
    if (body.id) {
      result = await pool.query(
        `UPDATE orders
           SET supplier_id = $1,
               date_text = $2,
               ordered_at = $3,
               received_at = $4,
               status = $5,
               items = $6,
               total_items = $7,
               invoice_proof_images = $8,
               was_edited = $9,
               edited_at = $10,
               updated_at = NOW()
         WHERE id = $11 AND user_id = $12
         RETURNING *`,
        [
          payload.supplierId,
          payload.date,
          payload.orderedAt,
          payload.receivedAt,
          payload.status,
          JSON.stringify(payload.items),
          payload.totalItems,
          JSON.stringify(payload.invoiceProofImages),
          payload.wasEdited,
          payload.editedAt,
          body.id,
          userId,
        ]
      );
    } else {
      result = await pool.query(
        `INSERT INTO orders
           (user_id, supplier_id, date_text, ordered_at, received_at, status, items, total_items, invoice_proof_images, was_edited, edited_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          userId,
          payload.supplierId,
          payload.date,
          payload.orderedAt,
          payload.receivedAt,
          payload.status,
          JSON.stringify(payload.items),
          payload.totalItems,
          JSON.stringify(payload.invoiceProofImages),
          payload.wasEdited,
          payload.editedAt,
        ]
      );
    }

    const saved = result.rows[0];
    if (!saved) {
      return NextResponse.json({ error: "Order not saved" }, { status: 500 });
    }

    return NextResponse.json({ order: mapRowToOrder(saved) });
  } catch (err: any) {
    console.error("❌ orders POST error:", err);
    return NextResponse.json({ error: err.message || "DB error" }, { status: 500 });
  }
});
