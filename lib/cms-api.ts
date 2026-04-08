"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  CmsAccountingStat,
  CmsBrandFlag,
  CmsBrandToken,
  CmsCategory,
  CmsDashboardStat,
  CmsInvoice,
  CmsJournalEntry,
  CmsJournalLine,
  CmsLedgerAccount,
  CmsOrder,
  CmsPaymentMethod,
  CmsProduct,
  CmsRequest,
  CmsReview,
  CmsSubcategory,
  CmsUser,
} from "@/lib/cms-data";
import { requestAdminGraphql } from "@/lib/admin-graphql-client";
import { nhostConfigError } from "@/lib/nhost";

type CmsGraphqlResponse = {
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    sort_order: number;
    is_visible: boolean;
    meta_title: string | null;
    meta_description: string | null;
    keywords: string | null;
    og_title: string | null;
    og_description: string | null;
  }>;
  subcategories: Array<{
    id: string;
    category_id: string;
    name: string;
    slug: string;
    description: string | null;
    sort_order: number;
    status: string;
    meta_title: string | null;
    meta_description: string | null;
    keywords: string | null;
    og_title: string | null;
    og_description: string | null;
  }>;
  products: Array<{
    id: string;
    sku: string;
    category_id: string;
    subcategory_id: string | null;
    name: string;
    image_url: string | null;
    image_alt: string | null;
    description: string;
    price_pkr: number;
    our_price_pkr: number;
    rating: number;
    stock_quantity: number;
    stock_label: string | null;
    discount_enabled: boolean;
    discount_percentage: number;
    is_trending: boolean;
    is_best_seller: boolean;
    is_new_arrival: boolean;
    is_top_rated: boolean;
    is_deal_of_the_day: boolean;
    status: string;
    created_at: string;
    meta_title: string | null;
    meta_description: string | null;
    keywords: string | null;
    og_title: string | null;
    og_description: string | null;
  }>;
  product_features: Array<{
    product_id: string;
    feature: string;
    sort_order: number;
  }>;
  reviews: Array<{
    id: string;
    product_id: string;
    customer_name: string;
    rating: number;
    comment: string;
    status: string;
    created_at: string;
  }>;
  review_replies: Array<{
    review_id: string;
    reply: string;
  }>;
  orders: Array<{
    id: string;
    order_no: string;
    user_id: string | null;
    customer_name: string;
    customer_email: string | null;
    customer_phone: string | null;
    city: string | null;
    address: string | null;
    subtotal_pkr: number;
    discount_pkr: number;
    shipping_pkr: number;
    total_pkr: number;
    notes: string | null;
    payment_status: string;
    fulfillment_status: string;
  }>;
  order_items: Array<{
    id: string;
    order_id: string;
    product_id: string | null;
    product_name: string;
    sku: string | null;
    quantity: number;
    unit_price_pkr: number;
    total_price_pkr: number;
  }>;
  custom_requests: Array<{
    id: string;
    request_no: string;
    user_id: string | null;
    customer_name: string;
    customer_email: string | null;
    customer_phone: string | null;
    request_type: string;
    brief: string;
    budget_pkr: number | null;
    due_date: string | null;
    priority: string;
    status: string;
    assigned_to: string | null;
  }>;
  profiles: Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    role: string;
    status: string;
    created_at: string;
  }>;
  brand_settings: Array<{
    key: string;
    value: Record<string, unknown>;
  }>;
  accounting_accounts: Array<{
    id: string;
    code: string;
    name: string;
    category: string;
    is_active: boolean;
  }>;
  invoices: Array<{
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
  }>;
  invoice_lines: Array<{
    id: string;
    invoice_id: string;
    product_id: string | null;
    description: string;
    quantity: number;
    unit_price_pkr: number;
    line_total_pkr: number;
    our_cost_pkr: number;
    sort_order: number;
  }>;
  journal_entries: Array<{
    id: string;
    journal_no: string;
    entry_date: string;
    reference_type: string | null;
    memo: string | null;
    status: string;
  }>;
  journal_lines: Array<{
    id: string;
    journal_entry_id: string;
    account_id: string;
    description: string | null;
    debit_pkr: number;
    credit_pkr: number;
  }>;
  payment_methods: Array<{
    id: string;
    name: string;
    type: string;
    account_title: string | null;
    account_number: string | null;
    bank_name: string | null;
    instructions: string | null;
    is_active: boolean;
    sort_order: number;
  }>;
};

export type CmsDataBundle = {
  stats: CmsDashboardStat[];
  categories: CmsCategory[];
  subcategories: CmsSubcategory[];
  products: CmsProduct[];
  reviews: CmsReview[];
  orders: CmsOrder[];
  requests: CmsRequest[];
  users: CmsUser[];
  brandTokens: CmsBrandToken[];
  brandFlags: CmsBrandFlag[];
  accountingStats: CmsAccountingStat[];
  invoices: CmsInvoice[];
  paymentMethods: CmsPaymentMethod[];
  ledgerAccounts: CmsLedgerAccount[];
  journalEntries: CmsJournalEntry[];
};

const CMS_QUERY = `
  query CmsBootstrapData {
    categories(order_by: { sort_order: asc }) {
      id
      name
      slug
      description
      sort_order
      is_visible
      meta_title
      meta_description
      keywords
      og_title
      og_description
    }
    subcategories(order_by: { sort_order: asc }) {
      id
      category_id
      name
      slug
      description
      sort_order
      status
      meta_title
      meta_description
      keywords
      og_title
      og_description
    }
    products(order_by: { created_at: desc }) {
      id
      sku
      category_id
      subcategory_id
      name
      image_url
      image_alt
      description
      price_pkr
      our_price_pkr
      rating
      stock_quantity
      stock_label
      discount_enabled
      discount_percentage
      is_trending
      is_best_seller
      is_new_arrival
      is_top_rated
      is_deal_of_the_day
      status
      created_at
      meta_title
      meta_description
      keywords
      og_title
      og_description
    }
    product_features(order_by: [{ product_id: asc }, { sort_order: asc }]) {
      product_id
      feature
      sort_order
    }
    reviews(order_by: { created_at: desc }) {
      id
      product_id
      customer_name
      rating
      comment
      status
      created_at
    }
    review_replies {
      review_id
      reply
    }
    orders(order_by: { created_at: desc }) {
      id
      order_no
      user_id
      customer_name
      customer_email
      customer_phone
      city
      address
      subtotal_pkr
      discount_pkr
      shipping_pkr
      total_pkr
      notes
      payment_status
      fulfillment_status
    }
    order_items {
      id
      order_id
      product_id
      product_name
      sku
      quantity
      unit_price_pkr
      total_price_pkr
    }
    custom_requests(order_by: { created_at: desc }) {
      id
      request_no
      user_id
      customer_name
      customer_email
      customer_phone
      request_type
      brief
      budget_pkr
      due_date
      priority
      status
      assigned_to
    }
    profiles(order_by: { created_at: desc }) {
      id
      full_name
      email
      role
      status
      created_at
    }
    brand_settings {
      key
      value
    }
    accounting_accounts(order_by: [{ category: asc }, { code: asc }]) {
      id
      code
      name
      category
      is_active
    }
    invoices(order_by: { issue_date: desc }) {
      id
      invoice_no
      order_id
      customer_name
      customer_email
      issue_date
      due_date
      subtotal_pkr
      discount_pkr
      shipping_pkr
      tax_pkr
      total_pkr
      paid_pkr
      balance_pkr
      status
      notes
      payment_method_id
    }
    invoice_lines(order_by: [{ invoice_id: asc }, { sort_order: asc }]) {
      id
      invoice_id
      product_id
      description
      quantity
      unit_price_pkr
      line_total_pkr
      our_cost_pkr
      sort_order
    }
    journal_entries(order_by: { entry_date: desc }) {
      id
      journal_no
      entry_date
      reference_type
      memo
      status
    }
    journal_lines(order_by: [{ journal_entry_id: asc }, { line_order: asc }]) {
      id
      journal_entry_id
      account_id
      description
      debit_pkr
      credit_pkr
    }
    payment_methods(order_by: { sort_order: asc }) {
      id
      name
      type
      account_title
      account_number
      bank_name
      instructions
      is_active
      sort_order
    }
  }
`;

function titleCase(value: string) {
  return value
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatPkr(value: number | null | undefined) {
  const amount = value ?? 0;
  return `PKR ${amount.toLocaleString()}`;
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
  }).format(date);
}

function formatDateValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function mapCmsData(data: CmsGraphqlResponse): CmsDataBundle {
  const categoryMap = new Map(data.categories.map((item) => [item.id, item]));
  const subcategoryMap = new Map(data.subcategories.map((item) => [item.id, item]));
  const featuresByProduct = new Map<string, string[]>();
  const reviewReplyByReview = new Map(data.review_replies.map((item) => [item.review_id, item.reply]));
  const orderItemsByOrder = new Map<string, CmsGraphqlResponse["order_items"]>();
  const invoiceLineCountByInvoice = new Map<string, number>();
  const invoiceLinesByInvoice = new Map<string, CmsGraphqlResponse["invoice_lines"]>();
  const linesByJournal = new Map<string, CmsGraphqlResponse["journal_lines"]>();

  data.product_features.forEach((feature) => {
    const current = featuresByProduct.get(feature.product_id) ?? [];
    current.push(feature.feature);
    featuresByProduct.set(feature.product_id, current);
  });

  data.order_items.forEach((item) => {
    const current = orderItemsByOrder.get(item.order_id) ?? [];
    current.push(item);
    orderItemsByOrder.set(item.order_id, current);
  });

  data.invoice_lines.forEach((line) => {
    invoiceLineCountByInvoice.set(
      line.invoice_id,
      (invoiceLineCountByInvoice.get(line.invoice_id) ?? 0) + 1,
    );

    const current = invoiceLinesByInvoice.get(line.invoice_id) ?? [];
    current.push(line);
    invoiceLinesByInvoice.set(line.invoice_id, current);
  });

  data.journal_lines.forEach((line) => {
    const current = linesByJournal.get(line.journal_entry_id) ?? [];
    current.push(line);
    linesByJournal.set(line.journal_entry_id, current);
  });

  const categories: CmsCategory[] = data.categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    sortOrder: category.sort_order,
    isVisible: category.is_visible,
    itemCount: data.products.filter((product) => product.category_id === category.id).length,
    visibility: category.is_visible ? "Live" : "Hidden",
    metaTitle: category.meta_title,
    metaDescription: category.meta_description,
    keywords: category.keywords,
    ogTitle: category.og_title,
    ogDescription: category.og_description,
  }));

  const subcategories: CmsSubcategory[] = data.subcategories.map((subcategory) => ({
    id: subcategory.id,
    name: subcategory.name,
    categoryId: subcategory.category_id,
    category: categoryMap.get(subcategory.category_id)?.name ?? "Unassigned",
    slug: subcategory.slug,
    description: subcategory.description,
    sortOrder: subcategory.sort_order,
    itemCount: data.products.filter((product) => product.subcategory_id === subcategory.id).length,
    status: subcategory.status === "live" ? "Live" : "Draft",
    metaTitle: subcategory.meta_title,
    metaDescription: subcategory.meta_description,
    keywords: subcategory.keywords,
    ogTitle: subcategory.og_title,
    ogDescription: subcategory.og_description,
  }));

  const products: CmsProduct[] = data.products.map((product) => ({
    id: product.sku,
    productId: product.id,
    name: product.name,
    imageLabel: product.image_alt || product.name,
    imageUrl: product.image_url,
    imageAlt: product.image_alt,
    categoryId: product.category_id,
    category: categoryMap.get(product.category_id)?.name ?? "Unassigned",
    subcategoryId: product.subcategory_id,
    subcategory: product.subcategory_id
      ? subcategoryMap.get(product.subcategory_id)?.name ?? "Unassigned"
      : "General",
    description: product.description,
    features: featuresByProduct.get(product.id) ?? [],
    priceValue: Number(product.price_pkr ?? 0),
    pricePkr: formatPkr(product.price_pkr),
    ourPriceValue: Number(product.our_price_pkr ?? 0),
    ourPricePkr: formatPkr(product.our_price_pkr),
    marginPkr: formatPkr(Number(product.price_pkr ?? 0) - Number(product.our_price_pkr ?? 0)),
    marginPercent:
      Number(product.price_pkr ?? 0) > 0
        ? ((Number(product.price_pkr ?? 0) - Number(product.our_price_pkr ?? 0)) /
            Number(product.price_pkr ?? 0)) *
          100
        : 0,
    rating: Number(product.rating ?? 0),
    discountEnabled: product.discount_enabled,
    discountPercent: Number(product.discount_percentage ?? 0),
    stock:
      product.stock_label ||
      `${product.stock_quantity} ${product.stock_quantity === 1 ? "unit" : "units"}`,
    status:
      product.status === "live"
        ? "Live"
        : product.status === "archived"
          ? "Archived"
          : "Draft",
    tags: {
      trending: product.is_trending,
      bestSeller: product.is_best_seller,
      newArrival: product.is_new_arrival,
      topRated: product.is_top_rated,
      dealOfDay: product.is_deal_of_the_day,
    },
    metaTitle: product.meta_title,
    metaDescription: product.meta_description,
    keywords: product.keywords,
    ogTitle: product.og_title,
    ogDescription: product.og_description,
  }));

  const reviews: CmsReview[] = data.reviews.map((review) => {
    const relatedProduct = data.products.find((product) => product.id === review.product_id);
    return {
      reviewId: review.id,
      id: review.id,
      productId: review.product_id,
      customer: review.customer_name,
      product: relatedProduct?.name ?? "Unknown product",
      rating: Number(review.rating ?? 0),
      comment: review.comment,
      statusCode:
        review.status === "published"
          ? "published"
          : review.status === "flagged"
            ? "flagged"
            : "pending",
      status:
        review.status === "published"
          ? "Published"
          : review.status === "flagged"
            ? "Flagged"
            : "Pending",
      createdAtValue: formatDateValue(review.created_at),
      date: formatDateLabel(review.created_at),
      reply: reviewReplyByReview.get(review.id),
    };
  });

  const orders: CmsOrder[] = data.orders.map((order) => {
    const items = (orderItemsByOrder.get(order.id) ?? []).map((item) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      sku: item.sku ?? "N/A",
      quantity: Number(item.quantity ?? 0),
      unitPricePkr: Number(item.unit_price_pkr ?? 0),
      totalPricePkr: Number(item.total_price_pkr ?? 0),
      unitPriceLabel: formatPkr(item.unit_price_pkr),
      totalPriceLabel: formatPkr(item.total_price_pkr),
    }));

    return {
      id: order.order_no,
      orderId: order.id,
      orderNo: order.order_no,
      customer: {
        name: order.customer_name,
        email: order.customer_email ?? "No email",
        city: order.city ?? "Unknown",
        phone: order.customer_phone ?? "",
        address: order.address ?? "",
      },
      items,
      subtotalPkr: Number(order.subtotal_pkr ?? 0),
      discountPkr: Number(order.discount_pkr ?? 0),
      shippingPkr: Number(order.shipping_pkr ?? 0),
      totalPkrValue: Number(order.total_pkr ?? 0),
      totalPkr: formatPkr(order.total_pkr),
      notes: order.notes ?? "",
      paymentStatus:
        order.payment_status === "paid"
          ? "paid"
          : order.payment_status === "failed"
            ? "failed"
            : order.payment_status === "refunded"
              ? "refunded"
              : "pending",
      payment:
        order.payment_status === "paid"
          ? "Paid"
          : order.payment_status === "failed"
            ? "Failed"
            : order.payment_status === "refunded"
              ? "Refunded"
              : "Pending",
      fulfillmentStatus:
        order.fulfillment_status === "packed"
          ? "packed"
          : order.fulfillment_status === "dispatched"
            ? "dispatched"
            : order.fulfillment_status === "delivered"
              ? "delivered"
              : order.fulfillment_status === "cancelled"
                ? "cancelled"
                : "processing",
      fulfillment:
        order.fulfillment_status === "dispatched"
          ? "Dispatched"
          : order.fulfillment_status === "packed"
            ? "Packed"
            : order.fulfillment_status === "delivered"
              ? "Delivered"
              : order.fulfillment_status === "cancelled"
                ? "Cancelled"
            : "Processing",
    };
  });

  const requests: CmsRequest[] = data.custom_requests.map((request) => ({
    requestId: request.id,
    requestNo: request.request_no,
    id: request.request_no,
    customer: request.customer_name,
    customerEmail: request.customer_email ?? "",
    customerPhone: request.customer_phone ?? "",
    type: request.request_type,
    brief: request.brief,
    dueDateValue: formatDateValue(request.due_date) || null,
    dueDate: formatDateLabel(request.due_date),
    budgetPkrValue: request.budget_pkr === null ? null : Number(request.budget_pkr),
    budgetPkr: formatPkr(request.budget_pkr),
    priorityCode:
      request.priority === "high"
        ? "high"
        : request.priority === "low"
          ? "low"
          : "medium",
    priority: titleCase(request.priority) as CmsRequest["priority"],
    statusCode:
      request.status === "quoted"
        ? "quoted"
        : request.status === "in_progress"
          ? "in_progress"
          : request.status === "completed"
            ? "completed"
            : request.status === "cancelled"
              ? "cancelled"
              : "new",
    status:
      request.status === "in_progress"
        ? "In Progress"
        : titleCase(request.status) as CmsRequest["status"],
  }));

  const users: CmsUser[] = data.profiles.map((profile) => {
    const userOrders = data.orders.filter((order) => order.user_id === profile.id);
    const spend = userOrders.reduce((sum, order) => sum + Number(order.total_pkr ?? 0), 0);
    return {
      id: profile.id,
      name: profile.full_name ?? profile.email ?? "Unnamed user",
      fullName: profile.full_name ?? "",
      email: profile.email ?? "No email",
      roleCode:
        profile.role === "admin"
          ? "admin"
          : profile.role === "manager"
            ? "manager"
            : "customer",
      role: titleCase(profile.role) as CmsUser["role"],
      orders: userOrders.length,
      spendPkr: formatPkr(spend),
      statusCode: profile.status,
      status:
        profile.status === "active"
          ? "Active"
          : profile.status === "invited"
            ? "Invited"
            : "Muted",
      joinedValue: formatDateValue(profile.created_at),
      joined: formatDateLabel(profile.created_at),
    };
  });

  const settingValue = (key: string) => data.brand_settings.find((item) => item.key === key)?.value;
  const settingText = (key: string, fallback: string) =>
    String(settingValue(key)?.text ?? fallback);
  const settingEnabled = (key: string, fallback = true) => {
    const value = settingValue(key)?.enabled;
    if (typeof value === "boolean") {
      return value;
    }
    return fallback;
  };

  // Debit-normal accounts: Asset, Expense, COGS → balance = debits - credits
  // Credit-normal accounts: Liability, Revenue, Equity → balance = credits - debits
  const isDebitNormal = (cat: string) => {
    const c = cat.toLowerCase();
    return c === "asset" || c === "expense" || c === "cogs";
  };

  const ledgerAccounts: CmsLedgerAccount[] = data.accounting_accounts.map((account) => {
    const relatedLines = data.journal_lines.filter((line) => line.account_id === account.id);
    const rawBalance = relatedLines.reduce(
      (sum, line) => sum + Number(line.debit_pkr ?? 0) - Number(line.credit_pkr ?? 0),
      0,
    );
    // For credit-normal accounts, flip the sign so positive = normal balance
    const balance = isDebitNormal(account.category) ? rawBalance : -rawBalance;

    return {
      id: account.id,
      code: account.code,
      name: account.name,
      category: account.category.toUpperCase() === "COGS"
        ? "COGS"
        : (titleCase(account.category) as CmsLedgerAccount["category"]),
      balancePkr: formatPkr(balance),
      entryCount: relatedLines.length,
      status: account.is_active ? "Active" : "Inactive",
    };
  });

  const invoices: CmsInvoice[] = data.invoices.map((invoice) => {
    const linkedOrder = invoice.order_id
      ? data.orders.find((order) => order.id === invoice.order_id)?.order_no ?? null
      : null;
    return {
      id: invoice.id,
      orderId: invoice.order_id,
      orderNo: linkedOrder,
      invoiceNo: invoice.invoice_no,
      customerName: invoice.customer_name || "Unknown customer",
      customerEmail: invoice.customer_email ?? "",
      customer: invoice.customer_name || invoice.customer_email || "Unknown customer",
      issueDateValue: formatDateValue(invoice.issue_date),
      dueDateValue: formatDateValue(invoice.due_date) || null,
      issueDate: formatDateLabel(invoice.issue_date),
      dueDate: formatDateLabel(invoice.due_date),
      subtotalPkrValue: Number(invoice.subtotal_pkr ?? 0),
      discountPkrValue: Number(invoice.discount_pkr ?? 0),
      shippingPkrValue: Number(invoice.shipping_pkr ?? 0),
      taxPkrValue: Number(invoice.tax_pkr ?? 0),
      totalPkrValue: Number(invoice.total_pkr ?? 0),
      paidPkrValue: Number(invoice.paid_pkr ?? 0),
      balancePkrValue: Number(invoice.balance_pkr ?? 0),
      totalPkr: formatPkr(invoice.total_pkr),
      paidPkr: formatPkr(invoice.paid_pkr),
      balancePkr: formatPkr(invoice.balance_pkr),
      notes: invoice.notes ?? "",
      linesCount: invoiceLineCountByInvoice.get(invoice.id) ?? 0,
      linkedOrder: linkedOrder ? `Linked: ${linkedOrder}` : "Standalone",
      paymentMethodId: invoice.payment_method_id ?? null,
      lines: (invoiceLinesByInvoice.get(invoice.id) ?? []).map((line) => ({
        id: line.id,
        productId: line.product_id,
        description: line.description,
        quantity: Number(line.quantity ?? 0),
        unitPricePkr: Number(line.unit_price_pkr ?? 0),
        lineTotalPkr: Number(line.line_total_pkr ?? 0),
        ourCostPkr: Number(line.our_cost_pkr ?? 0),
      })),
      statusCode:
        invoice.status === "paid"
          ? "paid"
          : invoice.status === "issued"
            ? "issued"
            : invoice.status === "partially_paid"
              ? "partially_paid"
              : invoice.status === "overdue"
                ? "overdue"
                : invoice.status === "void"
                  ? "void"
                  : "draft",
      status:
        invoice.status === "paid"
          ? "Paid"
          : invoice.status === "issued"
            ? "Issued"
            : invoice.status === "partially_paid"
              ? "Partially Paid"
              : invoice.status === "overdue"
                ? "Overdue"
                : invoice.status === "void"
                  ? "Void"
                  : "Draft",
    };
  });

  const journalEntries: CmsJournalEntry[] = data.journal_entries.map((entry) => {
    const lines = (linesByJournal.get(entry.id) ?? []).map((line): CmsJournalLine => {
      const account = data.accounting_accounts.find((item) => item.id === line.account_id);
      const debit = Number(line.debit_pkr ?? 0);
      const credit = Number(line.credit_pkr ?? 0);

      return {
        id: line.id,
        accountCode: account?.code ?? "N/A",
        accountName: account?.name ?? "Unknown account",
        description: line.description ?? "Journal line",
        side: debit > 0 ? "Debit" : "Credit",
        amountPkr: formatPkr(debit > 0 ? debit : credit),
      };
    });

    const debitTotal = (linesByJournal.get(entry.id) ?? []).reduce(
      (sum, line) => sum + Number(line.debit_pkr ?? 0),
      0,
    );
    const creditTotal = (linesByJournal.get(entry.id) ?? []).reduce(
      (sum, line) => sum + Number(line.credit_pkr ?? 0),
      0,
    );

    return {
      id: entry.id,
      journalNo: entry.journal_no,
      entryDate: formatDateLabel(entry.entry_date),
      reference: entry.reference_type ? titleCase(entry.reference_type) : "Manual",
      memo: entry.memo ?? "No memo attached",
      status:
        entry.status === "posted"
          ? "Posted"
          : entry.status === "void"
            ? "Voided"
            : "Draft",
      debitPkr: formatPkr(debitTotal),
      creditPkr: formatPkr(creditTotal),
      lines,
    };
  });

  const receivables = data.invoices.reduce((sum, invoice) => sum + Number(invoice.balance_pkr ?? 0), 0);
  const postedJournals = data.journal_entries.filter((entry) => entry.status === "posted").length;
  const inventoryCost = data.products.reduce(
    (sum, product) => sum + Number(product.our_price_pkr ?? 0) * Number(product.stock_quantity ?? 0),
    0,
  );
  const draftInvoices = data.invoices.filter((invoice) => invoice.status === "draft").length;

  const accountingStats: CmsAccountingStat[] = [
    {
      label: "Outstanding receivables",
      value: formatPkr(receivables),
      detail: `${data.invoices.filter((invoice) => Number(invoice.balance_pkr ?? 0) > 0).length} open invoices`,
    },
    {
      label: "Inventory at cost",
      value: formatPkr(inventoryCost),
      detail: `${data.products.length} catalog SKUs tracked`,
    },
    {
      label: "Posted journals",
      value: String(postedJournals),
      detail: `${data.journal_entries.length} total journal batches`,
    },
    {
      label: "Draft invoices",
      value: String(draftInvoices),
      detail: `${data.invoices.length} invoice headers in accounting`,
    },
  ];

  const brandTokens: CmsBrandToken[] = [
    {
      key: "brand_token_primary",
      label: "Primary",
      value: settingText("brand_token_primary", "#FF6F7D"),
      usage: "Primary actions and active states",
    },
    {
      key: "brand_token_secondary",
      label: "Secondary",
      value: settingText("brand_token_secondary", "#F7C6B8"),
      usage: "Highlights and soft tags",
    },
    {
      key: "brand_token_surface",
      label: "Surface",
      value: settingText("brand_token_surface", "#FFFFFF"),
      usage: "Cards and form areas",
    },
    {
      key: "brand_token_text",
      label: "Text",
      value: settingText("brand_token_text", "#222222"),
      usage: "Primary text and headings",
    },
  ];

  const brandFlags: CmsBrandFlag[] = [
    {
      key: "announcement_bar",
      label: "Announcement bar visible",
      text: settingText("announcement_bar", "Announcement bar setting"),
      description: settingText("announcement_bar", "Announcement bar setting"),
      enabled: settingEnabled("announcement_bar", true),
    },
    {
      key: "primary_cta_label",
      label: "Primary CTA label",
      text: settingText("primary_cta_label", "Shop curated gifts"),
      description: settingText("primary_cta_label", "Shop curated gifts"),
      enabled: settingEnabled("primary_cta_label", true),
    },
    {
      key: "review_request_message",
      label: "Review request message",
      text: settingText("review_request_message", "Tell us how your order felt when it arrived"),
      description: settingText(
        "review_request_message",
        "Tell us how your order felt when it arrived",
      ),
      enabled: settingEnabled("review_request_message", true),
    },
    {
      key: "brand_voice",
      label: "Brand voice",
      text: settingText("brand_voice", "Soft, polished, handmade, premium"),
      description: settingText("brand_voice", "Soft, polished, handmade, premium"),
      enabled: settingEnabled("brand_voice", true),
    },
    {
      key: "contact_whatsapp",
      label: "WhatsApp number",
      text: settingText("contact_whatsapp", "+92 3XX XXXXXXX"),
      description: "WhatsApp number for payment confirmations and customer support",
      enabled: settingEnabled("contact_whatsapp", true),
    },
    {
      key: "contact_phone",
      label: "Phone number",
      text: settingText("contact_phone", "+92 3XX XXXXXXX"),
      description: "Primary phone number shown on invoices and contact page",
      enabled: settingEnabled("contact_phone", true),
    },
    {
      key: "contact_email",
      label: "Email address",
      text: settingText("contact_email", "hello@kiyanigalleria.com"),
      description: "Business email shown on invoices and contact page",
      enabled: settingEnabled("contact_email", true),
    },
    {
      key: "contact_address",
      label: "Business address",
      text: settingText("contact_address", "Arifwala, Punjab, Pakistan"),
      description: "Physical address shown on invoices",
      enabled: settingEnabled("contact_address", true),
    },
  ];

  const paidOrders = data.orders.filter((order) => order.payment_status === "paid");
  const monthlyRevenue = paidOrders.reduce((sum, order) => sum + Number(order.total_pkr ?? 0), 0);

  const stats: CmsDashboardStat[] = [
    {
      label: "Revenue tracked",
      value: formatPkr(monthlyRevenue),
      detail: `${paidOrders.length} paid orders`,
    },
    {
      label: "Open orders",
      value: String(
        data.orders.filter((order) => order.fulfillment_status !== "dispatched").length,
      ),
      detail: `${data.orders.filter((order) => order.fulfillment_status === "packed").length} packed`,
    },
    {
      label: "Published products",
      value: String(data.products.filter((product) => product.status === "live").length),
      detail: `${data.products.length} total products`,
    },
    {
      label: "Pending reviews",
      value: String(data.reviews.filter((review) => review.status === "pending").length),
      detail: `${data.reviews.filter((review) => !reviewReplyByReview.has(review.id)).length} need replies`,
    },
  ];

  return {
    stats,
    categories,
    subcategories,
    products,
    reviews,
    orders,
    requests,
    users,
    brandTokens,
    brandFlags,
    accountingStats,
    invoices,
    paymentMethods: (data.payment_methods ?? []).map((pm) => ({
      id: pm.id,
      name: pm.name,
      type: pm.type,
      accountTitle: pm.account_title ?? "",
      accountNumber: pm.account_number ?? "",
      bankName: pm.bank_name ?? "",
      instructions: pm.instructions ?? "",
      isActive: pm.is_active,
      sortOrder: pm.sort_order,
    })),
    ledgerAccounts,
    journalEntries,
  };
}

export function useCmsData() {
  const [data, setData] = useState<CmsDataBundle | null>(null);
  const [isLoading, setIsLoading] = useState(() => nhostConfigError === null);
  const [error, setError] = useState<string | null>(nhostConfigError);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const refetch = useCallback(() => {
    setRefreshIndex((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;

    void requestAdminGraphql<CmsGraphqlResponse>(CMS_QUERY)
      .then((response) => {
        if (!active) {
          return;
        }

        if (response.body.errors?.length) {
          const message = response.body.errors.map((item) => item.message).join(", ");
          setError(message);
          setIsLoading(false);
          return;
        }

        if (!response.body.data) {
          setError("No CMS data returned from GraphQL.");
          setIsLoading(false);
          return;
        }

        setData(mapCmsData(response.body.data));
        setIsLoading(false);
      })
      .catch((caughtError) => {
        if (!active) {
          return;
        }

        const message =
          caughtError instanceof Error ? caughtError.message : "Failed to load CMS data.";

        setError(message);
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshIndex]);

  return { data, error, isLoading, refetch };
}
