import { NextResponse } from "next/server";
import { getPool, resolveUserIdToUUID } from "@/lib/db";
import { withAuth, AuthRequest } from "@/lib/auth-middleware";
import { Pool } from "pg";

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

async function ensureOrdersTable(pool: Pool) {
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

// PATCH /api/orders/[orderId] - partial update
export const PATCH = withAuth(async (req: AuthRequest, { params }: { params: { orderId: string } }) => {
  let userId = req.user?.userId;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    userId = await resolveUserIdToUUID(userId);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Korisnik nije pronađen" }, { status: 400 });
  }

  const pool = getPool();
  await ensureOrdersTable(pool);

  const body = await req.json();
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  const push = (column: string, value: any) => {
    fields.push(`${column} = $${idx}`);
    values.push(value);
    idx += 1;
  };

  if (body.supplierId !== undefined) push("supplier_id", body.supplierId || null);
  if (body.date !== undefined) push("date_text", body.date || null);
  if (body.orderedAt !== undefined) push("ordered_at", body.orderedAt || null);
  if (body.receivedAt !== undefined) push("received_at", body.receivedAt || null);
  if (body.status !== undefined) push("status", body.status || null);
  if (body.items !== undefined) push("items", JSON.stringify(Array.isArray(body.items) ? body.items : []));
  if (body.totalItems !== undefined) push("total_items", body.totalItems ?? 0);
  if (body.invoiceProofImages !== undefined) push("invoice_proof_images", JSON.stringify(body.invoiceProofImages || []));
  if (body.wasEdited !== undefined) push("was_edited", !!body.wasEdited);
  if (body.editedAt !== undefined) push("edited_at", body.editedAt || null);

  if (fields.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  values.push(new Date());
  fields.push(`updated_at = $${idx}`);
  idx += 1;

  values.push(params.orderId, userId);

  const query = `
    UPDATE orders
       SET ${fields.join(", ")}
     WHERE id = $${idx - 1} AND user_id = $${idx}
     RETURNING *;
  `;

  try {
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    return NextResponse.json({ order: mapRowToOrder(result.rows[0]) });
  } catch (err: any) {
    console.error("❌ orders PATCH error:", err);
    return NextResponse.json({ error: err.message || "DB error" }, { status: 500 });
  }
});

// DELETE /api/orders/[orderId]
export const DELETE = withAuth(async (req: AuthRequest, { params }: { params: { orderId: string } }) => {
  let userId = req.user?.userId;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    userId = await resolveUserIdToUUID(userId);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Korisnik nije pronađen" }, { status: 400 });
  }

  const pool = getPool();
  await ensureOrdersTable(pool);

  try {
    const result = await pool.query(
      `DELETE FROM orders WHERE id = $1 AND user_id = $2 RETURNING id`,
      [params.orderId, userId]
    );
    if (result.rowCount === 0) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("❌ orders DELETE error:", err);
    return NextResponse.json({ error: err.message || "DB error" }, { status: 500 });
  }
});
