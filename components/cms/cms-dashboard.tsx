"use client";

import { useCallback, useDeferredValue, useState } from "react";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { sections, type SectionId } from "@/components/cms/cms-config";
import { CmsHeader } from "@/components/cms/cms-header";
import { CmsSidebar } from "@/components/cms/cms-sidebar";
import { BrandSection } from "@/components/cms/sections/brand-section";
import { CategoriesSection } from "@/components/cms/sections/categories-section";
import { SeoSettingsClient } from "@/components/cms/seo/seo-settings-client";
import { AccountingSection } from "@/components/cms/sections/accounting-section";
import { DashboardSection } from "@/components/cms/sections/dashboard-section";
import { OrdersSection } from "@/components/cms/sections/orders-section";
import { ProductsSection } from "@/components/cms/sections/products-section";
import { RequestsSection } from "@/components/cms/sections/requests-section";
import { ReviewsSection } from "@/components/cms/sections/reviews-section";
import { UsersSection } from "@/components/cms/sections/users-section";
import { useAuth } from "@/components/providers/auth-provider";
import { useCmsData } from "@/lib/cms-api";

export function CmsDashboard() {
  const { logout, user } = useAuth();
  const { data, error, isLoading, refetch } = useCmsData();
  const [activeSection, setActiveSection] = useState<SectionId>(() => {
    if (typeof window === "undefined") return "dashboard";
    const saved = window.localStorage.getItem("cms-active-section");
    const valid = sections.some((s) => s.id === saved);
    return valid ? (saved as SectionId) : "dashboard";
  });
  const changeSection = useCallback((section: SectionId) => {
    setActiveSection(section);
    window.localStorage.setItem("cms-active-section", section);
  }, []);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("cms-sidebar-collapsed") === "true";
  });
  const reducedMotion = useReducedMotion();
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const handleToggleCollapse = () => {
    setSidebarCollapsed((previous) => {
      const next = !previous;
      window.localStorage.setItem("cms-sidebar-collapsed", String(next));
      return next;
    });
  };

  const filteredProducts = (data?.products ?? []).filter((product) => {
    if (!deferredQuery) return true;
    return [product.name, product.category, product.subcategory, product.description, product.id]
      .join(" ").toLowerCase().includes(deferredQuery);
  });

  const filteredReviews = (data?.reviews ?? []).filter((review) => {
    if (!deferredQuery) return true;
    return [review.customer, review.product, review.comment]
      .join(" ").toLowerCase().includes(deferredQuery);
  });

  const filteredOrders = (data?.orders ?? []).filter((order) => {
    if (!deferredQuery) return true;
    return [order.id, order.orderNo, order.customer.name, order.customer.email, order.customer.city,
      ...order.items.map((item) => item.productName), ...order.items.map((item) => item.sku)]
      .join(" ").toLowerCase().includes(deferredQuery);
  });

  const filteredRequests = (data?.requests ?? []).filter((request) => {
    if (!deferredQuery) return true;
    return [request.id, request.customer, request.type, request.brief]
      .join(" ").toLowerCase().includes(deferredQuery);
  });

  const filteredUsers = (data?.users ?? []).filter((u) => {
    if (!deferredQuery) return true;
    return [u.name, u.email, u.role, u.status]
      .join(" ").toLowerCase().includes(deferredQuery);
  });

  const filteredInvoices = (data?.invoices ?? []).filter((invoice) => {
    if (!deferredQuery) return true;
    return [invoice.invoiceNo, invoice.customer, invoice.status, invoice.linkedOrder]
      .join(" ").toLowerCase().includes(deferredQuery);
  });

  const filteredJournalEntries = (data?.journalEntries ?? []).filter((entry) => {
    if (!deferredQuery) return true;
    return [entry.journalNo, entry.reference, entry.memo, entry.status]
      .join(" ").toLowerCase().includes(deferredQuery);
  });

  const filteredLedgerAccounts = (data?.ledgerAccounts ?? []).filter((account) => {
    if (!deferredQuery) return true;
    return [account.code, account.name, account.category, account.status]
      .join(" ").toLowerCase().includes(deferredQuery);
  });

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-8">
          <p className="text-sm font-semibold text-foreground">CMS data failed to load</p>
          <p className="mt-3 text-sm leading-7 text-destructive">{error}</p>
        </div>
      </main>
    );
  }

  let sectionView: React.ReactNode = (
    <DashboardSection stats={data?.stats ?? []} orders={data?.orders ?? []} />
  );

  if (activeSection === "products") {
    sectionView = (
      <ProductsSection
        categories={data?.categories ?? []}
        products={filteredProducts}
        subcategories={data?.subcategories ?? []}
        onRefresh={refetch}
      />
    );
  } else if (activeSection === "categories") {
    sectionView = (
      <CategoriesSection
        categories={data?.categories ?? []}
        subcategories={data?.subcategories ?? []}
        onRefresh={refetch}
      />
    );
  } else if (activeSection === "accounting") {
    sectionView = (
      <AccountingSection
        accountingStats={data?.accountingStats ?? []}
        invoices={filteredInvoices}
        journalEntries={filteredJournalEntries}
        ledgerAccounts={filteredLedgerAccounts}
        orders={data?.orders ?? []}
        products={data?.products ?? []}
        paymentMethods={data?.paymentMethods ?? []}
        onRefresh={refetch}
      />
    );
  } else if (activeSection === "reviews") {
    sectionView = <ReviewsSection reviews={filteredReviews} onRefresh={refetch} />;
  } else if (activeSection === "orders") {
    sectionView = (
      <OrdersSection
        orders={filteredOrders}
        products={data?.products ?? []}
        invoices={data?.invoices ?? []}
        paymentMethods={data?.paymentMethods ?? []}
        accounts={data?.ledgerAccounts ?? []}
        onRefresh={refetch}
      />
    );
  } else if (activeSection === "requests") {
    sectionView = <RequestsSection requests={filteredRequests} products={data?.products ?? []} onRefresh={refetch} />;
  } else if (activeSection === "users") {
    sectionView = <UsersSection users={filteredUsers} onRefresh={refetch} />;
  } else if (activeSection === "brand") {
    sectionView = (
      <BrandSection
        brandFlags={data?.brandFlags ?? []}
        brandTokens={data?.brandTokens ?? []}
        onRefresh={refetch}
      />
    );
  } else if (activeSection === "seo") {
    sectionView = <SeoSettingsClient />;
  }

  return (
    <main className="min-h-screen bg-muted text-foreground">
      <AnimatePresence>
        {sidebarOpen && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            type="button"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      <div className="flex min-h-screen">
        <CmsSidebar
          activeSection={activeSection}
          isOpen={sidebarOpen}
          isCollapsed={sidebarCollapsed}
          counts={{
            dashboard: data?.stats.length ?? 0,
            products: data?.products.length ?? 0,
            categories: (data?.categories.length ?? 0) + (data?.subcategories.length ?? 0),
            accounting: data?.invoices.length ?? 0,
            reviews: data?.reviews.length ?? 0,
            orders: data?.orders.length ?? 0,
            requests: data?.requests.length ?? 0,
            users: data?.users.length ?? 0,
            brand: data?.brandFlags.length ?? 0,
            seo: 6,
          }}
          onClose={() => setSidebarOpen(false)}
          onToggleCollapse={handleToggleCollapse}
          onSectionChange={changeSection}
          onLogout={logout}
        />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <CmsHeader
            activeSection={activeSection}
            query={query}
            userEmail={user?.email}
            userLabel={user?.displayName ?? user?.email ?? "Admin"}
            onOpenSidebar={() => setSidebarOpen(true)}
            onQueryChange={setQuery}
          />

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
            <motion.div
              key={activeSection}
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={reducedMotion ? undefined : { opacity: 1 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              {sectionView}
            </motion.div>
          </div>
        </div>
      </div>
    </main>
  );
}
