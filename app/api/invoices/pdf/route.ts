import { NextRequest, NextResponse } from "next/server";
import { LOGO_BASE64 } from "@/lib/logo-base64";

export const dynamic = "force-dynamic";

const PDF_SERVICE_URL = "https://api.unusedmind.com/pdf/v1/render-html";

type AuthUserResponse = { id: string };
type ProfileRoleResponse = {
  data?: { profiles_by_pk: { role: "admin" | "manager" | "customer" | null } | null };
  errors?: Array<{ message: string }>;
};

type InvoicePdfRequest = { invoiceId: string };

type InvoiceData = {
  id: string;
  invoice_no: string;
  order_id: string | null;
  customer_name: string;
  customer_email: string | null;
  issue_date: string;
  due_date: string | null;
  subtotal_pkr: number;
  discount_pkr: number;
  shipping_pkr: number;
  tax_pkr: number;
  total_pkr: number;
  paid_pkr: number;
  balance_pkr: number;
  status: string;
  notes: string | null;
  payment_method_id: string | null;
  // Joined from order
  order?: {
    order_no: string;
    customer_phone: string | null;
    address: string | null;
    city: string | null;
  } | null;
};

type PaymentMethodData = {
  id: string;
  name: string;
  type: string;
  account_title: string | null;
  account_number: string | null;
  bank_name: string | null;
  instructions: string | null;
};

type InvoiceLine = {
  id: string;
  description: string;
  quantity: number;
  unit_price_pkr: number;
  line_total_pkr: number;
};

type InvoicePdfQueryData = {
  invoices_by_pk: InvoiceData | null;
  invoice_lines: InvoiceLine[];
  payment_methods_by_pk?: PaymentMethodData | null;
};

function resolveGraphqlUrl() {
  const explicit = process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL;
  if (explicit) return explicit;
  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;
  if (!subdomain || !region) throw new Error("Missing Nhost GraphQL configuration.");
  return `https://${subdomain}.graphql.${region}.nhost.run/v1`;
}

function resolveAuthUrl() {
  const explicit = process.env.NEXT_PUBLIC_NHOST_AUTH_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;
  if (!subdomain || !region) throw new Error("Missing Nhost Auth configuration.");
  return `https://${subdomain}.auth.${region}.nhost.run/v1`;
}

async function requireStaffAccess(request: Request, adminSecret: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return Response.json({ errors: [{ message: "Missing bearer token." }] }, { status: 401 });
  }
  const authResponse = await fetch(`${resolveAuthUrl()}/user`, { headers: { Authorization: authorization } });
  if (!authResponse.ok) return Response.json({ errors: [{ message: "Authentication failed." }] }, { status: 401 });
  const user = (await authResponse.json()) as AuthUserResponse;
  if (!user.id) return Response.json({ errors: [{ message: "User id not returned." }] }, { status: 401 });

  const roleResponse = await fetch(resolveGraphqlUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-hasura-admin-secret": adminSecret },
    body: JSON.stringify({
      query: `query CurrentProfileRole($id: uuid!) { profiles_by_pk(id: $id) { role } }`,
      variables: { id: user.id },
    }),
  });
  const roleBody = (await roleResponse.json()) as ProfileRoleResponse;
  const role = roleBody.data?.profiles_by_pk?.role ?? null;
  if (role !== "admin" && role !== "manager") {
    return Response.json({ errors: [{ message: "Admin access is required." }] }, { status: 403 });
  }
  return null;
}

function fmt(value: number) {
  return `PKR ${Number(value ?? 0).toLocaleString("en-PK")}`;
}

function fmtDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function esc(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

type StatusMeta = {
  label: string;
  bg: string;
  color: string;
  border: string;
  watermark: string | null;
};

function statusMeta(status: string): StatusMeta {
  const map: Record<string, StatusMeta> = {
    paid:            { label: "PAID",      bg: "#ecfdf5", color: "#065f46", border: "#10b981", watermark: "PAID" },
    issued:          { label: "ISSUED",    bg: "#eff6ff", color: "#1e40af", border: "#3b82f6", watermark: null },
    partially_paid:  { label: "PARTIAL",   bg: "#fffbeb", color: "#92400e", border: "#f59e0b", watermark: null },
    overdue:         { label: "OVERDUE",   bg: "#fef2f2", color: "#991b1b", border: "#ef4444", watermark: "OVERDUE" },
    void:            { label: "VOID",      bg: "#f1f5f9", color: "#475569", border: "#94a3b8", watermark: "VOID" },
    draft:           { label: "DRAFT",     bg: "#f8fafc", color: "#475569", border: "#cbd5e1", watermark: null },
  };
  return map[status] ?? map.draft;
}

function statusBadge(meta: StatusMeta) {
  return `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:0.14em;background:${meta.bg};color:${meta.color};border:1px solid ${meta.border};">
    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${meta.border};"></span>${meta.label}
  </span>`;
}

function parseLineDescription(description: string) {
  // Parse "Product Name (15% off PKR 3,000)" format
  const match = description.match(/^(.+?)\s*\((\d+)%\s*off\s*PKR\s*([\d,]+)\)$/);
  if (match) {
    return {
      name: match[1].trim(),
      discountPercent: Number(match[2]),
      originalPrice: Number(match[3].replace(/,/g, "")),
    };
  }
  return { name: description, discountPercent: 0, originalPrice: 0 };
}

function buildInvoiceHtml(inv: InvoiceData, lines: InvoiceLine[], paymentMethod?: PaymentMethodData | null, whatsappNumber?: string | null) {
  const orderNo = inv.order?.order_no ?? null;
  const customerPhone = inv.order?.customer_phone ?? null;
  const customerAddress = inv.order ? [inv.order.address, inv.order.city].filter(Boolean).join(", ") : null;
  const status = statusMeta(inv.status);

  const subtotal = Number(inv.subtotal_pkr || 0);
  const discount = Number(inv.discount_pkr || 0);
  const shipping = Number(inv.shipping_pkr || 0);
  const tax = Number(inv.tax_pkr || 0);
  const total = Number(inv.total_pkr || 0);
  const paid = Number(inv.paid_pkr || 0);
  const balance = Number(inv.balance_pkr || 0);

  const rows = lines.map((l, i) => {
    const parsed = parseLineDescription(l.description);
    const hasDiscount = parsed.discountPercent > 0 && parsed.originalPrice > 0;
    const unit = Number(l.unit_price_pkr);

    const priceCell = hasDiscount
      ? `<span style="color:#94a3b8;text-decoration:line-through;font-size:11px;">${fmt(parsed.originalPrice)}</span>
         <span style="display:block;color:#1a1a1a;font-weight:600;">${fmt(unit)}</span>`
      : `<span style="color:#1a1a1a;font-weight:500;">${fmt(unit)}</span>`;

    const nameCell = hasDiscount
      ? `<div style="color:#1a1a1a;font-weight:600;">${esc(parsed.name)}</div>
         <div style="margin-top:3px;display:inline-block;padding:2px 8px;background:#fef2f2;color:#991b1b;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:0.04em;">${parsed.discountPercent}% off</div>`
      : `<div style="color:#1a1a1a;font-weight:600;">${esc(l.description)}</div>`;

    return `
    <tr style="background:${i % 2 === 0 ? "#ffffff" : "#fafafa"};">
      <td style="padding:14px 18px;font-size:13px;vertical-align:top;border-bottom:1px solid #f1f5f9;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:22px;height:22px;flex-shrink:0;border-radius:6px;background:#fef7f5;color:#c55e4e;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;">${i + 1}</div>
          <div>${nameCell}</div>
        </div>
      </td>
      <td style="padding:14px 18px;font-size:13px;text-align:right;vertical-align:top;border-bottom:1px solid #f1f5f9;">${priceCell}</td>
      <td style="padding:14px 18px;font-size:13px;text-align:center;vertical-align:top;border-bottom:1px solid #f1f5f9;color:#475569;">${l.quantity}</td>
      <td style="padding:14px 18px;font-size:13px;text-align:right;vertical-align:top;border-bottom:1px solid #f1f5f9;font-weight:700;color:#1a1a1a;">${fmt(Number(l.line_total_pkr))}</td>
    </tr>`;
  }).join("");

  const paymentRowsHtml = paymentMethod ? [
    ["Method", paymentMethod.name],
    paymentMethod.account_title ? ["Account Title", paymentMethod.account_title] : null,
    paymentMethod.account_number ? ["Account Number", paymentMethod.account_number] : null,
    paymentMethod.bank_name ? ["Bank", paymentMethod.bank_name] : null,
  ].filter((r): r is [string, string] => r !== null).map(([label, value]) =>
    `<div style="flex:1;min-width:130px;">
      <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.18em;margin-bottom:4px;font-weight:700;">${label}</div>
      <div style="font-size:13px;color:#1a1a1a;font-weight:700;word-break:break-all;">${esc(value)}</div>
    </div>`
  ).join("") : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${esc(inv.invoice_no)}</title>
  <style>
    :root {
      --accent: #c55e4e;
      --accent-soft: #fef7f5;
      --ink: #0f172a;
      --ink-2: #334155;
      --ink-3: #64748b;
      --ink-4: #94a3b8;
      --line: #e2e8f0;
      --line-soft: #f1f5f9;
      --bg-soft: #fafafa;
    }
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { font-family: 'Inter', 'Segoe UI', -apple-system, Arial, sans-serif; color: var(--ink); background: #fff; -webkit-font-smoothing: antialiased; }

    .sheet { position: relative; min-height: 297mm; padding: 36px 44px 28px; display: flex; flex-direction: column; }
    .sheet::before {
      content: ""; position: absolute; top: 0; left: 0; right: 0; height: 6px;
      background: linear-gradient(90deg, #d97a69 0%, var(--accent) 45%, #a84a3c 100%);
    }

    ${status.watermark ? `
    .watermark {
      position: absolute;
      top: 42%; left: 50%;
      transform: translate(-50%, -50%) rotate(-22deg);
      font-size: 180px; font-weight: 900; letter-spacing: 0.05em;
      color: ${status.border}; opacity: 0.07;
      pointer-events: none; user-select: none;
      white-space: nowrap;
    }
    ` : ""}

    /* ─── Masthead ─────────────────────────────────────── */
    .masthead { display: flex; justify-content: space-between; align-items: flex-start; gap: 40px; padding-bottom: 24px; border-bottom: 1px solid var(--line); }
    .brand-block { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
    .brand-block img { height: 56px; width: auto; max-width: 260px; object-fit: contain; display: block; margin-bottom: 6px; flex: 0 0 auto; align-self: flex-start; }
    .brand-tag { font-size: 10px; color: var(--ink-4); letter-spacing: 0.2em; text-transform: uppercase; }
    .brand-url { font-size: 11px; color: var(--accent); font-weight: 700; letter-spacing: 0.02em; margin-top: 2px; }

    .meta-block { text-align: right; }
    .meta-title {
      font-size: 11px; letter-spacing: 0.3em; color: var(--ink-4); text-transform: uppercase; font-weight: 700;
    }
    .meta-number {
      font-family: ui-monospace, 'SF Mono', Menlo, monospace;
      font-size: 26px; font-weight: 800; color: var(--ink); letter-spacing: -0.02em;
      margin-top: 6px;
    }
    .meta-status { margin-top: 10px; }

    /* ─── Parties ──────────────────────────────────────── */
    .parties { display: flex; gap: 16px; margin-top: 28px; }
    .party-card {
      flex: 1; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px;
    }
    .party-card.accent {
      border-color: ${status.border}; background: ${status.bg};
    }
    .party-label {
      font-size: 9px; font-weight: 800; color: var(--accent);
      text-transform: uppercase; letter-spacing: 0.22em; margin-bottom: 10px;
    }
    .party-card.accent .party-label { color: ${status.color}; }
    .party-value { font-size: 12px; line-height: 1.65; color: var(--ink-2); }
    .party-value strong { color: var(--ink); font-weight: 700; }
    .party-dates { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; }
    .party-dates dt { font-size: 10px; color: var(--ink-4); text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; align-self: center; }
    .party-dates dd { font-size: 12px; color: var(--ink); font-weight: 600; }

    .amount-due-label { font-size: 9px; font-weight: 800; color: ${status.color}; text-transform: uppercase; letter-spacing: 0.22em; }
    .amount-due-value { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 26px; font-weight: 800; color: ${status.color}; margin-top: 6px; line-height: 1; letter-spacing: -0.02em; }
    .amount-due-hint { font-size: 10px; color: ${status.color}; margin-top: 8px; font-weight: 600; opacity: 0.8; }

    /* ─── Items ────────────────────────────────────────── */
    .items-title {
      display: flex; align-items: baseline; justify-content: space-between;
      margin-top: 32px; margin-bottom: 12px;
    }
    .items-title h2 {
      font-size: 11px; letter-spacing: 0.25em; color: var(--accent);
      text-transform: uppercase; font-weight: 800;
    }
    .items-title .count {
      font-size: 11px; color: var(--ink-4); font-weight: 600;
    }

    table.items { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
    table.items thead th {
      padding: 11px 18px; font-size: 9px; font-weight: 800; color: var(--ink-3);
      text-transform: uppercase; letter-spacing: 0.18em; text-align: left;
      background: #f8fafc; border-bottom: 1px solid var(--line);
    }
    table.items thead th:nth-child(2), table.items thead th:nth-child(4) { text-align: right; }
    table.items thead th:nth-child(3) { text-align: center; }
    table.items tbody tr:last-child td { border-bottom: none !important; }

    /* ─── Totals + Notes ──────────────────────────────── */
    .summary-row { display: flex; gap: 20px; margin-top: 24px; align-items: stretch; }
    .notes-panel {
      flex: 1; background: var(--accent-soft); border-radius: 12px; padding: 18px 20px;
      border: 1px solid #f4d8d2;
    }
    .notes-panel h3 {
      font-size: 9px; font-weight: 800; color: var(--accent); text-transform: uppercase;
      letter-spacing: 0.22em; margin-bottom: 8px;
    }
    .notes-panel .body { font-size: 12px; color: var(--ink-2); line-height: 1.7; white-space: pre-wrap; }

    .totals-panel {
      width: 320px; flex-shrink: 0; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px;
    }
    .totals-row { display: flex; justify-content: space-between; align-items: baseline; padding: 6px 0; font-size: 12px; color: var(--ink-3); }
    .totals-row span:last-child { color: var(--ink); font-weight: 600; font-variant-numeric: tabular-nums; }
    .totals-row.muted span:last-child { color: var(--ink-2); font-weight: 500; }
    .totals-divider { height: 1px; background: var(--line-soft); margin: 8px 0; }
    .totals-row.grand {
      padding-top: 10px; border-top: 2px solid var(--accent); margin-top: 4px;
    }
    .totals-row.grand span:first-child { font-size: 11px; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.18em; font-weight: 800; }
    .totals-row.grand span:last-child { font-size: 20px; color: var(--accent); font-weight: 800; font-variant-numeric: tabular-nums; }
    .totals-row.balance {
      padding: 8px 10px; margin-top: 8px; border-radius: 8px;
      background: ${status.bg}; color: ${status.color};
    }
    .totals-row.balance span:first-child { font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; font-weight: 800; }
    .totals-row.balance span:last-child { font-size: 15px; font-weight: 800; color: ${status.color}; }

    /* ─── Payment details ─────────────────────────────── */
    .payment {
      margin-top: 24px; border: 1px solid var(--line); border-radius: 12px; padding: 20px 22px;
      background: #fff; position: relative;
    }
    .payment::before {
      content: ""; position: absolute; top: 0; left: 20px; right: 20px; height: 3px;
      background: var(--accent); border-radius: 0 0 3px 3px;
    }
    .payment h3 {
      font-size: 9px; font-weight: 800; color: var(--accent); text-transform: uppercase;
      letter-spacing: 0.22em; margin-bottom: 14px;
    }
    .payment-grid { display: flex; flex-wrap: wrap; gap: 20px 28px; }
    .payment-note {
      margin-top: 14px; padding-top: 14px; border-top: 1px dashed var(--line);
      font-size: 11px; color: var(--ink-3); line-height: 1.7;
    }
    .payment-whatsapp {
      margin-top: 12px; display: inline-flex; align-items: center; gap: 8px;
      background: #dcfce7; color: #14532d; border: 1px solid #86efac;
      padding: 8px 14px; border-radius: 8px; font-size: 11px; font-weight: 700;
    }
    .payment-whatsapp strong { font-weight: 800; }

    /* ─── Footer ──────────────────────────────────────── */
    .footer {
      margin-top: auto; padding-top: 20px; display: grid;
      grid-template-columns: 1fr 1fr 1fr; align-items: end; gap: 16px;
      border-top: 1px solid var(--line); font-size: 10px; color: var(--ink-4);
    }
    .footer .brand-line { font-weight: 700; color: var(--accent); font-size: 11px; letter-spacing: 0.04em; }
    .footer .footer-contact { line-height: 1.7; }
    .footer .footer-center { text-align: center; line-height: 1.7; }
    .footer .footer-right { text-align: right; line-height: 1.7; }
    .footer .thanks { display: inline-block; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line); color: var(--ink-3); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; font-size: 9px; }
  </style>
</head>
<body>
  <div class="sheet">
    ${status.watermark ? `<div class="watermark">${status.watermark}</div>` : ""}

    <!-- Masthead -->
    <header class="masthead">
      <div class="brand-block">
        <img src="${LOGO_BASE64}" alt="Kiyani Galleria" style="height:56px;width:auto;max-width:260px;object-fit:contain;display:block;flex:0 0 auto;align-self:flex-start;margin-bottom:6px;" />
        <div class="brand-tag">Handcrafted in Arifwala, Punjab</div>
        <div class="brand-url">www.kiyanigalleria.com</div>
      </div>
      <div class="meta-block">
        <div class="meta-title">Invoice</div>
        <div class="meta-number">${esc(inv.invoice_no)}</div>
        <div class="meta-status">${statusBadge(status)}</div>
      </div>
    </header>

    <!-- Bill To / Dates / Amount -->
    <section class="parties">
      <div class="party-card">
        <div class="party-label">Bill To</div>
        <div class="party-value">
          <strong>${esc(inv.customer_name || "Customer")}</strong><br/>
          ${esc(inv.customer_email || "No email on file")}
          ${customerPhone ? `<br/>${esc(customerPhone)}` : ""}
          ${customerAddress ? `<br/>${esc(customerAddress)}` : ""}
        </div>
      </div>
      <div class="party-card">
        <div class="party-label">Invoice Details</div>
        <dl class="party-dates">
          <dt>Issued</dt><dd>${esc(fmtDate(inv.issue_date))}</dd>
          <dt>Due</dt><dd>${esc(fmtDate(inv.due_date))}</dd>
          ${orderNo ? `<dt>Order</dt><dd style="font-family:ui-monospace,monospace;">${esc(orderNo)}</dd>` : ""}
        </dl>
      </div>
      <div class="party-card accent">
        <div class="amount-due-label">Amount Due</div>
        <div class="amount-due-value">${fmt(balance)}</div>
        <div class="amount-due-hint">
          ${balance <= 0 ? "Settled in full — thank you." : `of ${fmt(total)} total`}
        </div>
      </div>
    </section>

    <!-- Items -->
    <div class="items-title">
      <h2>Items</h2>
      <span class="count">${lines.length} line${lines.length === 1 ? "" : "s"}</span>
    </div>
    <table class="items">
      <thead>
        <tr>
          <th style="width:52%;">Description</th>
          <th style="width:18%;text-align:right;">Unit Price</th>
          <th style="width:10%;text-align:center;">Qty</th>
          <th style="width:20%;text-align:right;">Line Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="4" style="padding:28px;text-align:center;color:var(--ink-4);font-size:13px;">No line items on this invoice</td></tr>'}
      </tbody>
    </table>

    <!-- Totals + Notes -->
    <section class="summary-row">
      ${inv.notes ? `
        <div class="notes-panel">
          <h3>Notes</h3>
          <div class="body">${esc(inv.notes)}</div>
        </div>
      ` : `<div style="flex:1;"></div>`}
      <div class="totals-panel">
        <div class="totals-row muted"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
        ${discount > 0 ? `<div class="totals-row muted"><span>Discount</span><span style="color:#c55e4e !important;">−${fmt(discount)}</span></div>` : ""}
        ${shipping > 0 ? `<div class="totals-row muted"><span>Shipping</span><span>+${fmt(shipping)}</span></div>` : ""}
        ${tax > 0 ? `<div class="totals-row muted"><span>Tax</span><span>+${fmt(tax)}</span></div>` : ""}
        <div class="totals-row grand"><span>Total</span><span>${fmt(total)}</span></div>
        ${paid > 0 ? `
          <div class="totals-divider"></div>
          <div class="totals-row"><span>Paid</span><span>−${fmt(paid)}</span></div>
          <div class="totals-row balance"><span>Balance due</span><span>${fmt(balance)}</span></div>
        ` : balance !== total ? `
          <div class="totals-divider"></div>
          <div class="totals-row balance"><span>Balance due</span><span>${fmt(balance)}</span></div>
        ` : ""}
      </div>
    </section>

    ${paymentMethod ? `
      <section class="payment">
        <h3>How to pay</h3>
        <div class="payment-grid">${paymentRowsHtml}</div>
        ${paymentMethod.instructions ? `<p class="payment-note">${esc(paymentMethod.instructions)}</p>` : ""}
        ${whatsappNumber ? `
          <div class="payment-whatsapp">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.465 3.488"/></svg>
            After payment, send a receipt to <strong>${esc(whatsappNumber)}</strong> on WhatsApp.
          </div>
        ` : `
          <p class="payment-note" style="color:var(--accent);font-weight:700;">After payment, please send the receipt to us so we can confirm your order.</p>
        `}
      </section>
    ` : ""}

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-contact">
        <div class="brand-line">Kiyani Galleria</div>
        hello@kiyanigalleria.com<br/>
        Arifwala, Punjab, Pakistan
      </div>
      <div class="footer-center">
        <span class="thanks">Thank you</span>
      </div>
      <div class="footer-right">
        Generated ${new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}<br/>
        www.kiyanigalleria.com
      </div>
    </footer>
  </div>
</body>
</html>`;
}

async function loadInvoiceData(invoiceId: string, graphqlUrl: string, adminSecret: string) {
  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-hasura-admin-secret": adminSecret },
    body: JSON.stringify({
      query: `
        query InvoicePdfData($invoiceId: uuid!) {
          invoices_by_pk(id: $invoiceId) {
            id invoice_no order_id customer_name customer_email
            issue_date due_date subtotal_pkr discount_pkr shipping_pkr tax_pkr
            total_pkr paid_pkr balance_pkr status notes payment_method_id
            order {
              order_no
              customer_phone
              address
              city
            }
          }
          invoice_lines(where: { invoice_id: { _eq: $invoiceId } }, order_by: { sort_order: asc }) {
            id description quantity unit_price_pkr line_total_pkr
          }
        }
      `,
      variables: { invoiceId },
    }),
  });

  const body = (await response.json()) as { data?: InvoicePdfQueryData; errors?: Array<{ message: string }> };
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join(", "));
  if (!body.data?.invoices_by_pk) throw new Error("Invoice not found.");
  return body.data;
}

export async function POST(request: NextRequest) {
  try {
    const adminSecret = process.env.HASURA_ADMIN_SECRET;
    if (!adminSecret) {
      return NextResponse.json({ errors: [{ message: "HASURA_ADMIN_SECRET is not configured." }] }, { status: 500 });
    }

    const authError = await requireStaffAccess(request, adminSecret);
    if (authError) return authError;

    const payload = (await request.json()) as InvoicePdfRequest;
    if (!payload.invoiceId) {
      return NextResponse.json({ errors: [{ message: "invoiceId is required." }] }, { status: 400 });
    }

    const graphqlUrl = resolveGraphqlUrl();
    const data = await loadInvoiceData(payload.invoiceId, graphqlUrl, adminSecret);
    const invoice = data.invoices_by_pk!;

    // Fetch payment method + WhatsApp from brand settings
    let paymentMethod: PaymentMethodData | null = null;
    let whatsappNumber: string | null = null;

    try {
      const extraRes = await fetch(graphqlUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hasura-admin-secret": adminSecret },
        body: JSON.stringify({
          query: `query InvoiceExtras($pmId: uuid!, $hasPm: Boolean!) {
            payment_methods_by_pk(id: $pmId) @include(if: $hasPm) { id name type account_title account_number bank_name instructions }
            brand_settings(where: { key: { _eq: "contact_whatsapp" } }) { value }
          }`,
          variables: { pmId: invoice.payment_method_id ?? "00000000-0000-0000-0000-000000000000", hasPm: Boolean(invoice.payment_method_id) },
        }),
      });
      const extraBody = await extraRes.json();
      paymentMethod = extraBody.data?.payment_methods_by_pk ?? null;
      const waValue = extraBody.data?.brand_settings?.[0]?.value;
      if (waValue?.text && waValue.text !== "+92 3XX XXXXXXX") {
        whatsappNumber = waValue.text;
      }
    } catch { /* non-critical */ }

    const html = buildInvoiceHtml(invoice, data.invoice_lines, paymentMethod, whatsappNumber);

    // Send HTML to PDF service
    const pdfResponse = await fetch(PDF_SERVICE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html,
        filename: `invoice-${invoice.invoice_no}.pdf`,
        landscape: false,
      }),
      signal: AbortSignal.timeout(65000),
    });

    if (!pdfResponse.ok) {
      const errBody = await pdfResponse.text();
      console.error("PDF service error:", pdfResponse.status, errBody);
      return NextResponse.json({ errors: [{ message: "PDF generation failed. Please try again." }] }, { status: 502 });
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${invoice.invoice_no}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate invoice PDF.";
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}
