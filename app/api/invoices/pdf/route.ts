import path from "path";

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type AuthUserResponse = {
  id: string;
};

type ProfileRoleResponse = {
  data?: {
    profiles_by_pk: {
      role: "admin" | "manager" | "customer" | null;
    } | null;
  };
  errors?: Array<{ message: string }>;
};

type InvoicePdfRequest = {
  invoiceId: string;
};

type InvoicePdfQueryData = {
  invoices_by_pk: {
    id: string;
    invoice_no: string;
    order_id: string | null;
    customer_name: string;
    customer_email: string | null;
    issue_date: string;
    due_date: string | null;
    subtotal_pkr: number;
    discount_pkr: number;
    tax_pkr: number;
    total_pkr: number;
    paid_pkr: number;
    balance_pkr: number;
    status: string;
    notes: string | null;
  } | null;
  invoice_lines: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price_pkr: number;
    line_total_pkr: number;
  }>;
};

function resolveGraphqlUrl() {
  const explicit = process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL;
  if (explicit) {
    return explicit;
  }

  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;
  if (!subdomain || !region) {
    throw new Error("Missing Nhost GraphQL configuration.");
  }

  return `https://${subdomain}.graphql.${region}.nhost.run/v1`;
}

function resolveAuthUrl() {
  const explicit = process.env.NEXT_PUBLIC_NHOST_AUTH_URL;
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;
  if (!subdomain || !region) {
    throw new Error("Missing Nhost Auth configuration.");
  }

  return `https://${subdomain}.auth.${region}.nhost.run/v1`;
}

async function requireStaffAccess(request: Request, adminSecret: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return Response.json(
      { errors: [{ message: "Missing bearer token." }] },
      { status: 401 },
    );
  }

  const authResponse = await fetch(`${resolveAuthUrl()}/user`, {
    headers: {
      Authorization: authorization,
    },
  });

  if (!authResponse.ok) {
    return Response.json(
      { errors: [{ message: "Authentication failed." }] },
      { status: 401 },
    );
  }

  const user = (await authResponse.json()) as AuthUserResponse;
  if (!user.id) {
    return Response.json(
      { errors: [{ message: "Authenticated user id was not returned." }] },
      { status: 401 },
    );
  }

  const roleResponse = await fetch(resolveGraphqlUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": adminSecret,
    },
    body: JSON.stringify({
      query: `
        query CurrentProfileRole($id: uuid!) {
          profiles_by_pk(id: $id) {
            role
          }
        }
      `,
      variables: {
        id: user.id,
      },
    }),
  });

  const roleBody = (await roleResponse.json()) as ProfileRoleResponse;
  const role = roleBody.data?.profiles_by_pk?.role ?? null;
  if (role !== "admin" && role !== "manager") {
    return Response.json(
      { errors: [{ message: "Admin access is required." }] },
      { status: 403 },
    );
  }

  return null;
}

function formatMoney(value: number) {
  return `PKR ${Number(value ?? 0).toLocaleString()}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusLabel(status: string) {
  if (status === "paid") return "PAID";
  if (status === "issued") return "ISSUED";
  if (status === "partially_paid") return "PARTIALLY PAID";
  if (status === "overdue") return "OVERDUE";
  if (status === "void") return "VOID";
  return "DRAFT";
}

function statusClass(status: string) {
  if (status === "paid") return "status-paid";
  if (status === "issued") return "status-issued";
  if (status === "partially_paid") return "status-partial";
  if (status === "overdue" || status === "void") return "status-danger";
  return "status-draft";
}

function generateInvoiceHtml(data: InvoicePdfQueryData["invoices_by_pk"], lines: InvoicePdfQueryData["invoice_lines"]) {
  if (!data) {
    throw new Error("Invoice not found.");
  }

  const rows = lines
    .map((line) => {
      return `
        <tr>
          <td>${escapeHtml(line.description)}</td>
          <td>${line.quantity}</td>
          <td>${formatMoney(Number(line.unit_price_pkr ?? 0))}</td>
          <td>${formatMoney(Number(line.line_total_pkr ?? 0))}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Invoice ${escapeHtml(data.invoice_no)}</title>
        <style>
          @page { size: A4; margin: 10mm; }
          body {
            font-family: Inter, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            background: #ffffff;
          }
          .page {
            width: 100%;
            min-height: 100%;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 14px;
            margin-bottom: 16px;
          }
          .brand h1 {
            margin: 0;
            font-size: 22px;
            letter-spacing: 0.2px;
          }
          .brand p {
            margin: 5px 0 0;
            font-size: 12px;
            color: #475569;
          }
          .meta h2 {
            margin: 0 0 8px;
            font-size: 20px;
            text-align: right;
          }
          .meta p {
            margin: 3px 0;
            font-size: 12px;
            text-align: right;
            color: #334155;
          }
          .status-badge {
            display: inline-block;
            border-radius: 999px;
            padding: 2px 8px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.08em;
          }
          .status-paid { background: #dcfce7; color: #166534; }
          .status-issued { background: #dbeafe; color: #1d4ed8; }
          .status-partial { background: #fef3c7; color: #92400e; }
          .status-danger { background: #fee2e2; color: #991b1b; }
          .status-draft { background: #e2e8f0; color: #334155; }
          .bill {
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 12px;
            margin-bottom: 16px;
          }
          .bill h3 {
            margin: 0 0 8px;
            font-size: 10px;
            letter-spacing: 0.12em;
            color: #64748b;
          }
          .bill p {
            margin: 3px 0;
            font-size: 12px;
            color: #334155;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
          }
          th {
            font-size: 10px;
            color: #64748b;
            letter-spacing: 0.09em;
            text-transform: uppercase;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
            padding: 8px 6px;
          }
          td {
            font-size: 12px;
            color: #1f2937;
            border-bottom: 1px solid #f1f5f9;
            padding: 8px 6px;
          }
          .totals {
            margin-top: 14px;
            width: 300px;
            margin-left: auto;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            padding: 4px 0;
          }
          .totals-final {
            border-top: 1px solid #cbd5e1;
            margin-top: 8px;
            padding-top: 8px;
            font-size: 15px;
            font-weight: 700;
          }
          .notes {
            margin-top: 14px;
            border: 1px dashed #cbd5e1;
            border-radius: 8px;
            padding: 10px;
            font-size: 12px;
            color: #334155;
            white-space: pre-wrap;
          }
          .footer {
            margin-top: 24px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
            font-size: 11px;
            color: #64748b;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div class="brand">
              <h1>Crafts by Kiyani</h1>
              <p>Handmade Retail & Craft Operations</p>
            </div>
            <div class="meta">
              <h2>INVOICE</h2>
              <p><strong>${escapeHtml(data.invoice_no)}</strong></p>
              <p>Issue: ${escapeHtml(formatDate(data.issue_date))}</p>
              <p>Due: ${escapeHtml(formatDate(data.due_date))}</p>
              <p>Order: ${escapeHtml(data.order_id ?? "Standalone")}</p>
              <p>
                <span class="status-badge ${statusClass(data.status)}">${statusLabel(data.status)}</span>
              </p>
            </div>
          </div>

          <div class="bill">
            <h3>Bill To</h3>
            <p><strong>${escapeHtml(data.customer_name || "Unknown customer")}</strong></p>
            <p>${escapeHtml(data.customer_email || "No email")}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Line Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="4">No invoice lines.</td></tr>'}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row"><span>Subtotal</span><span>${formatMoney(data.subtotal_pkr)}</span></div>
            <div class="totals-row"><span>Discount</span><span>${formatMoney(data.discount_pkr)}</span></div>
            <div class="totals-row"><span>Tax</span><span>${formatMoney(data.tax_pkr)}</span></div>
            <div class="totals-row"><span>Paid</span><span>${formatMoney(data.paid_pkr)}</span></div>
            <div class="totals-row"><span>Balance</span><span>${formatMoney(data.balance_pkr)}</span></div>
            <div class="totals-row totals-final"><span>Total</span><span>${formatMoney(data.total_pkr)}</span></div>
          </div>

          ${data.notes ? `<div class="notes"><strong>Notes</strong><br/>${escapeHtml(data.notes)}</div>` : ""}

          <div class="footer">
            Generated ${new Date().toLocaleString("en-US")} · Accounting PDF
          </div>
        </div>
      </body>
    </html>
  `;
}

async function loadInvoiceData(
  invoiceId: string,
  graphqlUrl: string,
  adminSecret: string,
) {
  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": adminSecret,
    },
    body: JSON.stringify({
      query: `
        query InvoicePdfData($invoiceId: uuid!) {
          invoices_by_pk(id: $invoiceId) {
            id
            invoice_no
            order_id
            customer_name
            customer_email
            issue_date
            due_date
            subtotal_pkr
            discount_pkr
            tax_pkr
            total_pkr
            paid_pkr
            balance_pkr
            status
            notes
          }
          invoice_lines(
            where: { invoice_id: { _eq: $invoiceId } }
            order_by: { sort_order: asc }
          ) {
            id
            description
            quantity
            unit_price_pkr
            line_total_pkr
          }
        }
      `,
      variables: { invoiceId },
    }),
  });

  const body = (await response.json()) as {
    data?: InvoicePdfQueryData;
    errors?: Array<{ message: string }>;
  };

  if (body.errors?.length) {
    throw new Error(body.errors.map((item) => item.message).join(", "));
  }
  if (!body.data?.invoices_by_pk) {
    throw new Error("Invoice not found.");
  }

  return body.data;
}

async function renderPdfFromHtml(html: string) {
  const isVercel = Boolean(process.env.VERCEL_ENV);
  let puppeteer: typeof import("puppeteer-core");
  let launchOptions: Record<string, unknown> = { headless: true };

  if (isVercel) {
    puppeteer = await import("puppeteer-core");
    const chromium = (await import("@sparticuz/chromium-min")).default;

    const remoteExecutablePath =
      process.env.CHROMIUM_EXECUTABLE_URL ||
      "https://github.com/Sparticuz/chromium/releases/download/v131.0.0/chromium-v131.0.0-pack.tar";

    const executablePath = await chromium.executablePath(remoteExecutablePath);
    launchOptions = {
      ...launchOptions,
      args: chromium.args,
      executablePath,
      headless: true,
    };
  } else {
    const { install, Browser, detectBrowserPlatform, resolveBuildId } = await import(
      "@puppeteer/browsers"
    );
    puppeteer = await import("puppeteer-core");

    const platform = detectBrowserPlatform();
    if (!platform) {
      throw new Error("Could not detect browser platform.");
    }

    const buildId = await resolveBuildId(Browser.CHROMIUM, platform, "latest");
    const installed = await install({
      browser: Browser.CHROMIUM,
      buildId,
      platform,
      cacheDir: path.join(process.cwd(), ".cache", "puppeteer"),
    });

    launchOptions = {
      ...launchOptions,
      executablePath: installed.executablePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
      ],
    };
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdf = await page.pdf({
    format: "A4",
    margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    printBackground: true,
  });
  await browser.close();
  return pdf;
}

export async function POST(request: NextRequest) {
  try {
    const adminSecret = process.env.HASURA_ADMIN_SECRET;
    if (!adminSecret) {
      return NextResponse.json(
        { errors: [{ message: "HASURA_ADMIN_SECRET is not configured." }] },
        { status: 500 },
      );
    }

    const authError = await requireStaffAccess(request, adminSecret);
    if (authError) {
      return authError;
    }

    const payload = (await request.json()) as InvoicePdfRequest;
    if (!payload.invoiceId) {
      return NextResponse.json(
        { errors: [{ message: "invoiceId is required." }] },
        { status: 400 },
      );
    }

    const data = await loadInvoiceData(payload.invoiceId, resolveGraphqlUrl(), adminSecret);
    const invoice = data.invoices_by_pk;
    if (!invoice) {
      return NextResponse.json({ errors: [{ message: "Invoice not found." }] }, { status: 404 });
    }

    const html = generateInvoiceHtml(invoice, data.invoice_lines);
    const pdf = await renderPdfFromHtml(html);
    const pdfArrayBuffer = new ArrayBuffer(pdf.byteLength);
    new Uint8Array(pdfArrayBuffer).set(pdf);
    const pdfBlob = new Blob([pdfArrayBuffer], { type: "application/pdf" });

    return new NextResponse(pdfBlob, {
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
