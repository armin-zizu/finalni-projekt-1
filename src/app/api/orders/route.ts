import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getPool, resolveUserIdToUUID } from "@/lib/db";
import { withAuth, AuthRequest } from "@/lib/auth-middleware";

async function ensureOrdersTable() {
  const pool = getPool();
  try {
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
    `);
  } catch (err: any) {
    console.warn("⚠️ ensureOrdersTable: nije moguće kreirati/alter tabelu (nastavljam)", err?.message || err);
  }
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
  } catch (err) {
    // already logged; continue
  }

  try {
    const result = await pool.query(
      `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return NextResponse.json({ orders: result.rows });
  } catch (err: any) {
    console.error("❌ Greška pri čitanju narudžbi:", err);
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
  const serverNowIso = new Date().toISOString();
  const orderedAtValue = body?.orderedAt || body?.ordered_at || body?.createdAt || body?.created_at || null;

  const payload = {
    id: body?.id || randomUUID(),
    supplierId: body?.supplierId || body?.supplier_id || null,
    date: dateValue,
    orderedAt: orderedAtValue || serverNowIso,
    receivedAt: body?.receivedAt || body?.received_at || null,
    status: body?.status || "pending",
    items,
    totalItems,
    invoiceProofImages,
    wasEdited: Boolean(body?.wasEdited || body?.was_edited),
    editedAt: body?.editedAt || body?.edited_at || null,
  };

  const pool = getPool();

  let columnNames: string[] = [];
  try {
    const cols = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'orders'`
    );
    columnNames = cols.rows.map((r: any) => String(r.column_name).toLowerCase());
  } catch (err: any) {
    console.warn("⚠️ orders column introspection nije uspio:", err?.message || err);
  }

  try {
    await ensureOrdersTable();
  } catch (err) {
    // already logged; continue
  }

  try {
    const has = (col: string) => columnNames.includes(col.toLowerCase());

    const columns: string[] = ["id", "user_id"]; // pretpostavka: postoje u staroj i novoj šemi
    const placeholders: string[] = ["$1", "$2"];
    const values: any[] = [payload.id, userId];
    const updates: string[] = [];
    let idx = 3;

    const addField = (col: string, value: any) => {
      columns.push(col);
      placeholders.push(`$${idx}`);
      values.push(value);
      updates.push(`${col} = EXCLUDED.${col}`);
      idx += 1;
    };

    if (has("supplier_id")) addField("supplier_id", payload.supplierId);
    if (has("date_text")) addField("date_text", payload.date);
    else if (has("date")) addField("date", payload.date);
    if (has("ordered_at")) addField("ordered_at", payload.orderedAt);
    if (has("received_at")) addField("received_at", payload.receivedAt);
    if (has("status")) addField("status", payload.status);
    if (has("items")) addField("items", JSON.stringify(payload.items || []));
    if (has("total_items")) addField("total_items", payload.totalItems);
    if (has("invoice_proof_images")) addField("invoice_proof_images", JSON.stringify(payload.invoiceProofImages || []));
    if (has("was_edited")) addField("was_edited", payload.wasEdited);
    if (has("edited_at")) addField("edited_at", payload.editedAt);
    if (has("updated_at")) addField("updated_at", new Date().toISOString());

    const updateClause = updates.length ? updates.join(", ") : "id = EXCLUDED.id";

    const result = await pool.query(
      `INSERT INTO orders (${columns.join(", ")}) VALUES (${placeholders.join(", ")})
       ON CONFLICT (id) DO UPDATE SET ${updateClause}
       RETURNING *;`,
      values
    );

    return NextResponse.json({ order: result.rows[0] });
  } catch (err: any) {
    console.error("❌ Greška u /api/orders POST:", err);
    return NextResponse.json({ error: err.message || "DB error" }, { status: 500 });
  }
});
