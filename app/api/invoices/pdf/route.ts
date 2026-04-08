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

function statusBadge(status: string) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    paid: { label: "PAID", bg: "#dcfce7", color: "#166534" },
    issued: { label: "ISSUED", bg: "#dbeafe", color: "#1d4ed8" },
    partially_paid: { label: "PARTIAL", bg: "#fef3c7", color: "#92400e" },
    overdue: { label: "OVERDUE", bg: "#fee2e2", color: "#991b1b" },
    void: { label: "VOID", bg: "#fee2e2", color: "#991b1b" },
  };
  const s = map[status] ?? { label: "DRAFT", bg: "#f1f5f9", color: "#475569" };
  return `<span style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:10px;font-weight:800;letter-spacing:0.1em;background:${s.bg};color:${s.color};">${s.label}</span>`;
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

  const rows = lines.map((l, i) => {
    const parsed = parseLineDescription(l.description);
    const hasDiscount = parsed.discountPercent > 0 && parsed.originalPrice > 0;
    const displayName = hasDiscount
      ? `${esc(parsed.name)} <span style="color:#c55e4e;font-size:11px;font-weight:700;">(${parsed.discountPercent}% off)</span>`
      : esc(l.description);
    const originalPrice = hasDiscount ? parsed.originalPrice : Number(l.unit_price_pkr);
    const discountedPrice = Number(l.unit_price_pkr);

    return `
    <tr style="background:${i % 2 === 0 ? "#ffffff" : "#faf9f7"};">
      <td style="padding:12px 16px;font-size:13px;color:#1a1a1a;">${displayName}</td>
      <td style="padding:12px 16px;font-size:13px;color:#1a1a1a;text-align:right;">${fmt(originalPrice)}</td>
      <td style="padding:12px 16px;font-size:13px;color:#1a1a1a;text-align:right;">${hasDiscount ? `<span style="color:#c55e4e;font-weight:600;">${fmt(discountedPrice)}</span>` : "—"}</td>
      <td style="padding:12px 16px;font-size:13px;color:#1a1a1a;text-align:center;">${l.quantity}</td>
      <td style="padding:12px 16px;font-size:13px;color:#1a1a1a;text-align:right;font-weight:600;">${fmt(Number(l.line_total_pkr))}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; background: #fff; }
    .page { padding: 40px 48px; min-height: 100vh; display: flex; flex-direction: column; }

    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .brand { }
    .brand-name { font-size: 28px; font-weight: 800; color: #c55e4e; letter-spacing: -0.5px; }
    .brand-sub { font-size: 11px; color: #94a3b8; margin-top: 4px; letter-spacing: 0.15em; text-transform: uppercase; }
    .invoice-title { font-size: 36px; font-weight: 800; color: #e2e8f0; text-align: right; letter-spacing: -1px; line-height: 1; }
    .invoice-no { font-size: 14px; font-weight: 700; color: #1a1a1a; text-align: right; margin-top: 8px; }

    .info-grid { display: flex; gap: 24px; margin-bottom: 32px; }
    .info-card { flex: 1; background: #faf9f7; border-radius: 12px; padding: 20px; }
    .info-label { font-size: 9px; font-weight: 800; color: #c55e4e; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 10px; }
    .info-value { font-size: 13px; color: #334155; line-height: 1.6; }
    .info-value strong { color: #1a1a1a; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { border-bottom: 2px solid #c55e4e; }
    th { padding: 10px 16px; font-size: 9px; font-weight: 800; color: #c55e4e; text-transform: uppercase; letter-spacing: 0.15em; text-align: left; }
    th:nth-child(2) { text-align: center; }
    th:nth-child(3), th:nth-child(4) { text-align: right; }
    tbody tr { border-bottom: 1px solid #f1f0ee; }

    .totals { margin-left: auto; width: 280px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #64748b; }
    .total-row span:last-child { color: #1a1a1a; font-weight: 500; }
    .total-final { border-top: 2px solid #c55e4e; margin-top: 8px; padding-top: 12px; }
    .total-final span { font-size: 18px; font-weight: 800; color: #c55e4e; }

    .notes { background: #faf9f7; border-left: 3px solid #c55e4e; border-radius: 0 8px 8px 0; padding: 16px 20px; margin-top: 8px; font-size: 12px; color: #475569; line-height: 1.7; white-space: pre-wrap; }
    .notes-title { font-size: 9px; font-weight: 800; color: #c55e4e; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 6px; }

    .footer { margin-top: auto; padding-top: 24px; border-top: 1px solid #f1f0ee; display: flex; justify-content: space-between; align-items: center; }
    .footer-left { font-size: 10px; color: #94a3b8; }
    .footer-right { font-size: 10px; color: #94a3b8; text-align: right; }
    .footer-brand { font-weight: 700; color: #c55e4e; }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div class="brand">
        <img src="${LOGO_BASE64}" alt="Kiyani Galleria" style="height:70px;width:auto;margin-bottom:6px;" />
        <div class="brand-sub">Handcrafted with Love &bull; Arifwala, Punjab</div>
        <div style="font-size:11px;color:#c55e4e;margin-top:2px;font-weight:600;">www.kiyanigalleria.com</div>
      </div>
      <div>
        <div class="invoice-title">INVOICE</div>
        <div class="invoice-no">${esc(inv.invoice_no)} &nbsp;${statusBadge(inv.status)}</div>
      </div>
    </div>

    <!-- Info Cards -->
    <div class="info-grid">
      <div class="info-card">
        <div class="info-label">Bill To</div>
        <div class="info-value">
          <strong>${esc(inv.customer_name || "Customer")}</strong><br/>
          ${esc(inv.customer_email || "No email on file")}
          ${customerPhone ? `<br/>${esc(customerPhone)}` : ""}
          ${customerAddress ? `<br/>${esc(customerAddress)}` : ""}
        </div>
      </div>
      <div class="info-card">
        <div class="info-label">Invoice Details</div>
        <div class="info-value">
          <strong>Issue Date:</strong> ${esc(fmtDate(inv.issue_date))}<br/>
          <strong>Due Date:</strong> ${esc(fmtDate(inv.due_date))}
          ${orderNo ? `<br/><strong>Order:</strong> ${esc(orderNo)}` : ""}
        </div>
      </div>
      <div class="info-card" style="text-align:center;">
        <div class="info-label">Amount Due</div>
        <div style="font-size:24px;font-weight:800;color:#c55e4e;margin-top:8px;">${fmt(inv.balance_pkr)}</div>
      </div>
    </div>

    <!-- Line Items -->
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align:right;">Price</th>
          <th style="text-align:right;">Discounted</th>
          <th style="text-align:center;">Qty</th>
          <th style="text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="5" style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">No line items</td></tr>'}
      </tbody>
    </table>

    <!-- Totals + Notes side by side -->
    <div style="display:flex;gap:24px;margin-top:16px;">
      ${inv.notes ? `
      <div class="notes" style="flex:1;margin-top:0;">
        <div class="notes-title">Notes</div>
        ${esc(inv.notes)}
      </div>
      ` : "<div style='flex:1;'></div>"}
      <div class="totals" style="margin-top:0;">
        <div class="total-row"><span>Subtotal</span><span>${fmt(inv.subtotal_pkr)}</span></div>
        ${Number(inv.discount_pkr) > 0 ? `<div class="total-row"><span>Discount</span><span>-${fmt(inv.discount_pkr)}</span></div>` : ""}
        ${Number(inv.shipping_pkr) > 0 ? `<div class="total-row"><span>Shipping</span><span>+${fmt(inv.shipping_pkr)}</span></div>` : ""}
        ${Number(inv.tax_pkr) > 0 ? `<div class="total-row"><span>Tax</span><span>+${fmt(inv.tax_pkr)}</span></div>` : ""}
        <div class="total-row"><span>Paid</span><span>${fmt(inv.paid_pkr)}</span></div>
        <div class="total-row total-final"><span>Total</span><span>${fmt(inv.total_pkr)}</span></div>
      </div>
    </div>

    ${paymentMethod ? `
    <div style="margin-top:24px;border:2px solid #c55e4e;border-radius:12px;padding:20px;background:#fef7f5;">
      <div style="font-size:9px;font-weight:800;color:#c55e4e;text-transform:uppercase;letter-spacing:0.2em;margin-bottom:12px;">Payment Details</div>
      <div style="display:flex;gap:32px;font-size:13px;color:#1a1a1a;">
        <div>
          <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Method</div>
          <strong>${esc(paymentMethod.name)}</strong>
        </div>
        ${paymentMethod.account_title ? `<div>
          <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Account Title</div>
          <strong>${esc(paymentMethod.account_title)}</strong>
        </div>` : ""}
        ${paymentMethod.account_number ? `<div>
          <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Account Number</div>
          <strong>${esc(paymentMethod.account_number)}</strong>
        </div>` : ""}
        ${paymentMethod.bank_name ? `<div>
          <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Bank</div>
          <strong>${esc(paymentMethod.bank_name)}</strong>
        </div>` : ""}
      </div>
      ${paymentMethod.instructions ? `<p style="margin-top:12px;font-size:12px;color:#475569;line-height:1.6;">${esc(paymentMethod.instructions)}</p>` : ""}
      <div style="margin-top:14px;padding-top:14px;border-top:1px dashed #c55e4e40;font-size:12px;color:#c55e4e;font-weight:700;">
        After payment, please send a screenshot via WhatsApp${whatsappNumber ? ` to <span style="color:#1a1a1a;">${esc(whatsappNumber)}</span>` : ""} to confirm your payment.
      </div>
    </div>
    ` : ""}

    <!-- Footer -->
    <div class="footer">
      <div class="footer-left">
        <span class="footer-brand">Kiyani Galleria</span> &bull; hello@kiyanigalleria.com<br/>
        Arifwala, Punjab, Pakistan &bull; www.kiyanigalleria.com
      </div>
      <div class="footer-right">
        Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}<br/>
        Thank you for your business
      </div>
    </div>
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
