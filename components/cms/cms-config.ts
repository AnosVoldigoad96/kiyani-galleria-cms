import {
  BookOpenText,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  Package,
  Settings2,
  ShoppingBag,
  Users,
} from "lucide-react";

export type SectionId =
  | "dashboard"
  | "products"
  | "accounting"
  | "reviews"
  | "orders"
  | "requests"
  | "users"
  | "brand";

export const sections = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, count: "04" },
  { id: "products", label: "Products", icon: Package, count: "84" },
  { id: "accounting", label: "Accounting", icon: BookOpenText, count: "24" },
  { id: "reviews", label: "Reviews", icon: MessageSquare, count: "18" },
  { id: "orders", label: "Orders", icon: ShoppingBag, count: "36" },
  { id: "requests", label: "Requests", icon: FolderKanban, count: "12" },
  { id: "users", label: "Users", icon: Users, count: "248" },
  { id: "brand", label: "Brand", icon: Settings2, count: "08" },
] as const satisfies ReadonlyArray<{
  id: SectionId;
  label: string;
  icon: typeof LayoutDashboard;
  count: string;
}>;

export const navGroups = [
  { label: "Overview", ids: ["dashboard"] },
  { label: "Commerce", ids: ["products", "orders", "requests", "accounting"] },
  { label: "Community", ids: ["reviews", "users"] },
  { label: "Settings", ids: ["brand"] },
] as const satisfies ReadonlyArray<{
  label: string;
  ids: readonly SectionId[];
}>;

export function sectionCopy(section: SectionId) {
  if (section === "dashboard") {
    return {
      title: "Store Performance",
      description:
        "Overview of revenue, active orders, and catalog health.",
      action: "Refresh stats",
    };
  }

  if (section === "products") {
    return {
      title: "Catalog Management",
      description:
        "Control inventory, pricing, and feature tags across products and categories.",
      action: "New product",
    };
  }

  if (section === "accounting") {
    return {
      title: "Accounting Operations",
      description:
        "Track invoices, ledger balances, and journal batches behind every sale.",
      action: "New journal",
    };
  }

  if (section === "reviews") {
    return {
      title: "Customer Voice",
      description:
        "Moderate feedback, publish comments, and engage with your community.",
      action: "Review queue",
    };
  }

  if (section === "orders") {
    return {
      title: "Order Fulfillment",
      description:
        "Track shipments, payment status, and customer purchase history.",
      action: "Export list",
    };
  }

  if (section === "requests") {
    return {
      title: "Custom Pipelines",
      description:
        "Manage bespoke project quotes, due dates, and studio milestones.",
      action: "New quote",
    };
  }

  if (section === "users") {
    return {
      title: "Team & Customers",
      description:
        "Manage administrative roles, permissions, and customer profiles.",
      action: "Invite staff",
    };
  }

  return {
    title: "Brand Strategy",
    description:
      "Fine-tune visual tokens, announcement bars, and storefront messaging.",
    action: "Sync tokens",
  };
}
