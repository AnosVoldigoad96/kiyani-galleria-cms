export type CmsDashboardStat = {
  label: string;
  value: string;
  detail: string;
};

export type CmsSeoFields = {
  metaTitle?: string | null;
  metaDescription?: string | null;
  keywords?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  canonicalUrl?: string | null;
  ogImageUrl?: string | null;
  robotsNoindex?: boolean;
  sitemapPriority?: number | null;
  sitemapChangefreq?: string | null;
  structuredDataOverrides?: unknown;
};

export type CmsCategory = {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  sortOrder?: number;
  isVisible?: boolean;
  itemCount: number;
  visibility: "Live" | "Hidden";
} & CmsSeoFields;

export type CmsSubcategory = {
  id: string;
  name: string;
  categoryId: string;
  category: string;
  slug?: string;
  description?: string | null;
  sortOrder?: number;
  itemCount: number;
  status: "Live" | "Draft";
} & CmsSeoFields;

export type CmsProduct = {
  id: string;
  productId: string;
  name: string;
  imageLabel: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  videoUrl?: string | null;
  categoryId: string;
  category: string;
  subcategoryId?: string | null;
  subcategory: string;
  description: string;
  features: string[];
  priceValue: number;
  pricePkr: string;
  ourPriceValue: number;
  ourPricePkr: string;
  marginPkr: string;
  marginPercent: number;
  rating: number;
  discountEnabled: boolean;
  discountPercent: number;
  stock: string;
  stockQuantity: number;
  stockLabel: string | null;
  hasSizes: boolean;
  sizes: Array<{ size: string; price: number }>;
  hasQualityOptions: boolean;
  localPricePkr: number | null;
  importedPricePkr: number | null;
  status: "Live" | "Draft" | "Archived";
  tags: {
    trending: boolean;
    bestSeller: boolean;
    newArrival: boolean;
    topRated: boolean;
    dealOfDay: boolean;
  };
} & CmsSeoFields;

export type CmsReview = {
  reviewId: string;
  id: string;
  productId: string;
  customer: string;
  product: string;
  rating: number;
  comment: string;
  statusCode: "published" | "pending" | "flagged";
  status: "Published" | "Pending" | "Flagged";
  createdAtValue: string;
  date: string;
  reply?: string;
};

export type CmsOrderItem = {
  id: string;
  productId: string | null;
  productName: string;
  sku: string;
  quantity: number;
  unitPricePkr: number;
  totalPricePkr: number;
  unitPriceLabel: string;
  totalPriceLabel: string;
  selectedSize: string | null;
  selectedQuality: string | null;
};

export type CmsOrder = {
  orderId: string;
  orderNo: string;
  id: string;
  customer: {
    name: string;
    email: string;
    city: string;
    phone: string;
    address: string;
  };
  items: CmsOrderItem[];
  subtotalPkr: number;
  discountPkr: number;
  shippingPkr: number;
  totalPkrValue: number;
  totalPkr: string;
  notes: string;
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  fulfillmentStatus: "processing" | "packed" | "dispatched" | "delivered" | "cancelled";
  payment: "Paid" | "Pending" | "Failed" | "Refunded";
  fulfillment: "Processing" | "Packed" | "Dispatched" | "Delivered" | "Cancelled";
};

export type CmsRequest = {
  requestId: string;
  requestNo: string;
  id: string;
  userId: string | null;
  customer: string;
  customerEmail: string;
  customerPhone: string;
  type: string;
  brief: string;
  dueDateValue: string | null;
  dueDate: string;
  budgetPkrValue: number | null;
  budgetPkr: string;
  priorityCode: "high" | "medium" | "low";
  priority: "High" | "Medium" | "Low";
  statusCode: "new" | "quoted" | "in_progress" | "completed" | "cancelled";
  status: "New" | "Quoted" | "In Progress" | "Completed" | "Cancelled";
};

export type CmsUser = {
  id: string;
  name: string;
  fullName: string;
  email: string;
  roleCode: "admin" | "manager" | "customer";
  role: "Admin" | "Manager" | "Customer";
  orders: number;
  spendPkr: string;
  statusCode: string;
  status: "Active" | "Invited" | "Muted";
  joinedValue: string;
  joined: string;
};

export type CmsBrandToken = {
  key: string;
  label: string;
  value: string;
  usage: string;
};

export type CmsBrandFlag = {
  key: string;
  label: string;
  text: string;
  description: string;
  enabled: boolean;
};

export type CmsHeroSlide = {
  imageUrl: string;
  subtitle: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaLink: string;
};

export type CmsAccountingStat = {
  label: string;
  value: string;
  detail: string;
};

export type CmsPaymentMethod = {
  id: string;
  name: string;
  type: string;
  accountTitle: string;
  accountNumber: string;
  bankName: string;
  instructions: string;
  cashAccountCode: string | null;
  isActive: boolean;
  sortOrder: number;
};

export type CmsInvoice = {
  id: string;
  orderId: string | null;
  orderNo: string | null;
  invoiceNo: string;
  customerName: string;
  customerEmail: string;
  customer: string;
  issueDateValue: string;
  dueDateValue: string | null;
  issueDate: string;
  dueDate: string;
  subtotalPkrValue: number;
  discountPkrValue: number;
  shippingPkrValue: number;
  taxPkrValue: number;
  totalPkrValue: number;
  paidPkrValue: number;
  balancePkrValue: number;
  totalPkr: string;
  paidPkr: string;
  balancePkr: string;
  notes: string;
  linesCount: number;
  linkedOrder: string;
  lines: Array<{
    id: string;
    productId: string | null;
    description: string;
    quantity: number;
    unitPricePkr: number;
    lineTotalPkr: number;
    ourCostPkr: number;
  }>;
  paymentMethodId: string | null;
  statusCode: "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "void";
  status: "Draft" | "Issued" | "Paid" | "Partially Paid" | "Overdue" | "Void";
};

export type CmsLedgerAccount = {
  id: string;
  code: string;
  name: string;
  category: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense" | "COGS";
  balancePkrValue: number;
  balancePkr: string;
  entryCount: number;
  status: "Active" | "Inactive";
};

export type CmsJournalLine = {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountCategory: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense" | "COGS";
  description: string;
  side: "Debit" | "Credit";
  debitPkrValue: number;
  creditPkrValue: number;
  amountPkr: string;
};

export type CmsJournalEntry = {
  id: string;
  journalNo: string;
  entryDateValue: string;
  entryDate: string;
  referenceType: string | null;
  reference: string;
  memo: string;
  statusCode: "draft" | "posted" | "void";
  status: "Draft" | "Posted" | "Voided";
  debitPkr: string;
  creditPkr: string;
  lines: CmsJournalLine[];
};
