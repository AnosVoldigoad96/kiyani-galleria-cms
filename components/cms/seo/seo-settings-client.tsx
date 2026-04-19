"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import {
  fetchAllSeoSettings,
  saveSeoSetting,
  SEO_SETTING_KEYS,
  type SeoSettingKey,
  fetchAuditData,
  auditEntity,
  ISSUE_LABEL,
  type AuditEntity,
  type AuditIssue,
} from "@/components/cms/seo/seo-settings-api";

type TabId =
  | "global"
  | "social"
  | "robots"
  | "verification"
  | "sitemap"
  | "organization"
  | "audit";

const TABS: Array<{ id: TabId; label: string; key: SeoSettingKey | null; hint: string }> = [
  { id: "global", label: "Global", key: "seo_global", hint: "Site name, defaults, canonical domain" },
  { id: "social", label: "Social", key: "seo_social", hint: "Twitter, Facebook, Instagram, etc." },
  { id: "robots", label: "Robots", key: "seo_robots", hint: "Crawler directives" },
  { id: "verification", label: "Verification", key: "seo_verification", hint: "Search console tokens" },
  { id: "sitemap", label: "Sitemap", key: "seo_sitemap", hint: "Inclusion + custom URLs" },
  { id: "organization", label: "Organization", key: "seo_organization", hint: "Structured data (Organization)" },
  { id: "audit", label: "Audit", key: null, hint: "Entities with missing or over-length SEO fields" },
];

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-slate-400";
const labelClass =
  "text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground";

type SeoState = Record<SeoSettingKey, Record<string, unknown>>;

function emptyState(): SeoState {
  return SEO_SETTING_KEYS.reduce((acc, key) => {
    acc[key] = {};
    return acc;
  }, {} as SeoState);
}

function setField(
  state: SeoState,
  key: SeoSettingKey,
  field: string,
  value: unknown,
): SeoState {
  return { ...state, [key]: { ...state[key], [field]: value } };
}

function parseCsvArray(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function joinArray(value: unknown): string {
  if (Array.isArray(value)) return value.join("\n");
  return "";
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function asNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function SeoSettingsClient() {
  const [state, setState] = useState<SeoState>(emptyState);
  const [initial, setInitial] = useState<SeoState>(emptyState);
  const [activeTab, setActiveTab] = useState<TabId>("global");
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<SeoSettingKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAllSeoSettings();
        if (cancelled) return;
        setState(data);
        setInitial(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(() => {
    const out: Record<SeoSettingKey, boolean> = {} as Record<SeoSettingKey, boolean>;
    for (const key of SEO_SETTING_KEYS) {
      out[key] = JSON.stringify(state[key]) !== JSON.stringify(initial[key]);
    }
    return out;
  }, [state, initial]);

  async function handleSave(key: SeoSettingKey) {
    setSavingKey(key);
    setError(null);
    try {
      await saveSeoSetting(key, state[key]);
      setInitial((prev) => ({ ...prev, [key]: state[key] }));
      toast.success("SEO settings saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(`Save failed: ${message}`);
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeTabDef = TABS.find((t) => t.id === activeTab)!;
  const activeKey = activeTabDef.key;
  const activeDirty = activeKey ? dirty[activeKey] : false;
  const saving = activeKey ? savingKey === activeKey : false;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight">SEO Settings</h1>
        <p className="text-sm text-muted-foreground">
          Global SEO defaults consumed by the storefront. Per-product and
          per-category overrides live on their own editors.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors ${
              activeTab === tab.id
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-white text-foreground hover:border-slate-400"
            } ${tab.key && dirty[tab.key] && activeTab !== tab.id ? "ring-2 ring-amber-300" : ""}`}
          >
            {tab.label}
            {tab.key && dirty[tab.key] ? " •" : ""}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-white p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">
              {TABS.find((t) => t.id === activeTab)!.label}
            </h2>
            <p className="text-xs text-muted-foreground">
              {TABS.find((t) => t.id === activeTab)!.hint}
            </p>
          </div>
          {activeKey ? (
            <button
              type="button"
              onClick={() => handleSave(activeKey)}
              disabled={!activeDirty || saving}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-bold uppercase tracking-widest text-background transition-opacity disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save"}
            </button>
          ) : null}
        </div>

        {activeTab === "global" && (
          <GlobalTab
            value={state.seo_global}
            onField={(f, v) =>
              setState((s) => setField(s, "seo_global", f, v))
            }
          />
        )}
        {activeTab === "social" && (
          <SocialTab
            value={state.seo_social}
            onField={(f, v) =>
              setState((s) => setField(s, "seo_social", f, v))
            }
          />
        )}
        {activeTab === "robots" && (
          <RobotsTab
            value={state.seo_robots}
            onField={(f, v) =>
              setState((s) => setField(s, "seo_robots", f, v))
            }
          />
        )}
        {activeTab === "verification" && (
          <VerificationTab
            value={state.seo_verification}
            onField={(f, v) =>
              setState((s) => setField(s, "seo_verification", f, v))
            }
          />
        )}
        {activeTab === "sitemap" && (
          <SitemapTab
            value={state.seo_sitemap}
            onField={(f, v) =>
              setState((s) => setField(s, "seo_sitemap", f, v))
            }
          />
        )}
        {activeTab === "organization" && (
          <OrganizationTab
            value={state.seo_organization}
            onField={(f, v) =>
              setState((s) => setField(s, "seo_organization", f, v))
            }
          />
        )}
        {activeTab === "audit" && <AuditTab />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── tab forms ──

type TabProps = {
  value: Record<string, unknown>;
  onField: (field: string, value: unknown) => void;
};

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className={labelClass}>{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function GlobalTab({ value, onField }: TabProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Site name">
        <input
          className={inputClass}
          value={asString(value.site_name)}
          onChange={(e) => onField("site_name", e.target.value)}
        />
      </Field>
      <Field label="Tagline">
        <input
          className={inputClass}
          value={asString(value.site_tagline)}
          onChange={(e) => onField("site_tagline", e.target.value)}
        />
      </Field>
      <Field label="Default title" hint="Homepage & fallback title.">
        <input
          className={inputClass}
          value={asString(value.default_title)}
          onChange={(e) => onField("default_title", e.target.value)}
        />
      </Field>
      <Field label="Title template" hint="Use %s as the page title placeholder.">
        <input
          className={inputClass}
          value={asString(value.title_template)}
          onChange={(e) => onField("title_template", e.target.value)}
          placeholder="%s | Kiyani Galleria"
        />
      </Field>
      <Field label="Default description">
        <textarea
          className={`${inputClass} min-h-[90px]`}
          value={asString(value.default_description)}
          onChange={(e) => onField("default_description", e.target.value)}
        />
      </Field>
      <Field label="Default keywords" hint="One per line, or comma-separated.">
        <textarea
          className={`${inputClass} min-h-[90px]`}
          value={joinArray(value.default_keywords)}
          onChange={(e) => onField("default_keywords", parseCsvArray(e.target.value))}
        />
      </Field>
      <Field label="Canonical domain" hint="No trailing slash.">
        <input
          className={inputClass}
          value={asString(value.canonical_domain)}
          onChange={(e) => onField("canonical_domain", e.target.value)}
          placeholder="https://www.example.com"
        />
      </Field>
      <Field label="Default locale">
        <input
          className={inputClass}
          value={asString(value.default_locale)}
          onChange={(e) => onField("default_locale", e.target.value)}
          placeholder="en"
        />
      </Field>
      <Field label="Default OG image URL">
        <input
          className={inputClass}
          value={asString(value.default_og_image_url)}
          onChange={(e) => onField("default_og_image_url", e.target.value)}
        />
      </Field>
      <Field label="Favicon URL">
        <input
          className={inputClass}
          value={asString(value.favicon_url)}
          onChange={(e) => onField("favicon_url", e.target.value)}
        />
      </Field>
    </div>
  );
}

function SocialTab({ value, onField }: TabProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Twitter handle" hint="Without @.">
        <input
          className={inputClass}
          value={asString(value.twitter_handle)}
          onChange={(e) => onField("twitter_handle", e.target.value)}
        />
      </Field>
      <Field label="Twitter card type">
        <select
          className={inputClass}
          value={asString(value.twitter_card_type) || "summary_large_image"}
          onChange={(e) => onField("twitter_card_type", e.target.value)}
        >
          <option value="summary">summary</option>
          <option value="summary_large_image">summary_large_image</option>
          <option value="app">app</option>
          <option value="player">player</option>
        </select>
      </Field>
      <Field label="Facebook App ID">
        <input
          className={inputClass}
          value={asString(value.facebook_app_id)}
          onChange={(e) => onField("facebook_app_id", e.target.value)}
        />
      </Field>
      <Field label="Instagram URL">
        <input
          className={inputClass}
          value={asString(value.instagram_url)}
          onChange={(e) => onField("instagram_url", e.target.value)}
        />
      </Field>
      <Field label="Facebook URL">
        <input
          className={inputClass}
          value={asString(value.facebook_url)}
          onChange={(e) => onField("facebook_url", e.target.value)}
        />
      </Field>
      <Field label="Pinterest URL">
        <input
          className={inputClass}
          value={asString(value.pinterest_url)}
          onChange={(e) => onField("pinterest_url", e.target.value)}
        />
      </Field>
      <Field label="TikTok URL">
        <input
          className={inputClass}
          value={asString(value.tiktok_url)}
          onChange={(e) => onField("tiktok_url", e.target.value)}
        />
      </Field>
      <Field label="YouTube URL">
        <input
          className={inputClass}
          value={asString(value.youtube_url)}
          onChange={(e) => onField("youtube_url", e.target.value)}
        />
      </Field>
      <Field label="WhatsApp number" hint="International format, no +.">
        <input
          className={inputClass}
          value={asString(value.whatsapp_number)}
          onChange={(e) => onField("whatsapp_number", e.target.value)}
        />
      </Field>
    </div>
  );
}

function RobotsTab({ value, onField }: TabProps) {
  const mode = asString(value.mode) || "allow";
  return (
    <div className="space-y-4">
      <Field label="Mode" hint="Disallow blocks all crawling; Custom uses paths below.">
        <select
          className={inputClass}
          value={mode}
          onChange={(e) => onField("mode", e.target.value)}
        >
          <option value="allow">Allow (use disallow list)</option>
          <option value="disallow">Disallow all</option>
          <option value="custom">Custom</option>
        </select>
      </Field>
      <Field label="Disallow paths" hint="One per line.">
        <textarea
          className={`${inputClass} min-h-[140px] font-mono text-xs`}
          value={joinArray(value.disallow_paths)}
          onChange={(e) => onField("disallow_paths", parseCsvArray(e.target.value))}
        />
      </Field>
      <Field label="Allow paths (overrides disallow)" hint="One per line.">
        <textarea
          className={`${inputClass} min-h-[90px] font-mono text-xs`}
          value={joinArray(value.allow_paths)}
          onChange={(e) => onField("allow_paths", parseCsvArray(e.target.value))}
        />
      </Field>
      <Field label="Crawl delay (seconds, optional)">
        <input
          className={inputClass}
          type="number"
          min={0}
          value={asString(value.crawl_delay)}
          onChange={(e) =>
            onField(
              "crawl_delay",
              e.target.value === "" ? null : Number(e.target.value),
            )
          }
        />
      </Field>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={asBool(value.sitemap_enabled, true)}
          onChange={(e) => onField("sitemap_enabled", e.target.checked)}
        />
        <span className={labelClass}>Advertise sitemap.xml in robots.txt</span>
      </label>
    </div>
  );
}

function VerificationTab({ value, onField }: TabProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(["google", "bing", "yandex", "pinterest", "facebook"] as const).map(
        (k) => (
          <Field key={k} label={`${k} verification`}>
            <input
              className={inputClass}
              value={asString(value[k])}
              onChange={(e) => onField(k, e.target.value || null)}
            />
          </Field>
        ),
      )}
    </div>
  );
}

function SitemapTab({ value, onField }: TabProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2 md:grid-cols-2">
        {(["include_products", "include_categories", "include_subcategories", "include_static"] as const).map((k) => (
          <label key={k} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={asBool(value[k], true)}
              onChange={(e) => onField(k, e.target.checked)}
            />
            <span className={labelClass}>{k.replace(/_/g, " ")}</span>
          </label>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Default change frequency">
          <select
            className={inputClass}
            value={asString(value.default_change_freq) || "weekly"}
            onChange={(e) => onField("default_change_freq", e.target.value)}
          >
            {["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"].map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Default priority" hint="0.0 – 1.0">
          <input
            className={inputClass}
            type="number"
            step="0.1"
            min={0}
            max={1}
            value={asString(value.default_priority) || "0.7"}
            onChange={(e) =>
              onField("default_priority", asNumberOrNull(e.target.value))
            }
          />
        </Field>
      </div>
      <Field label="Custom URLs (JSON array)" hint='[{"loc":"/foo","priority":0.5}]'>
        <textarea
          className={`${inputClass} min-h-[120px] font-mono text-xs`}
          value={JSON.stringify(value.custom_urls ?? [], null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              if (Array.isArray(parsed)) onField("custom_urls", parsed);
            } catch {
              // Ignore parse errors — user can keep typing.
            }
          }}
        />
      </Field>
    </div>
  );
}

function OrganizationTab({ value, onField }: TabProps) {
  const address = (value.address as Record<string, unknown> | undefined) ?? {};
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Legal name">
          <input
            className={inputClass}
            value={asString(value.legal_name)}
            onChange={(e) => onField("legal_name", e.target.value)}
          />
        </Field>
        <Field label="Founding date">
          <input
            className={inputClass}
            type="date"
            value={asString(value.founding_date).slice(0, 10)}
            onChange={(e) => onField("founding_date", e.target.value || null)}
          />
        </Field>
        <Field label="Founders" hint="One per line.">
          <textarea
            className={`${inputClass} min-h-[90px]`}
            value={joinArray(value.founders)}
            onChange={(e) => onField("founders", parseCsvArray(e.target.value))}
          />
        </Field>
        <Field label="Logo URL">
          <input
            className={inputClass}
            value={asString(value.logo_url)}
            onChange={(e) => onField("logo_url", e.target.value)}
          />
        </Field>
        <Field label="Email">
          <input
            className={inputClass}
            type="email"
            value={asString(value.email)}
            onChange={(e) => onField("email", e.target.value || null)}
          />
        </Field>
        <Field label="Phone">
          <input
            className={inputClass}
            value={asString(value.phone)}
            onChange={(e) => onField("phone", e.target.value || null)}
          />
        </Field>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          Address
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(["street", "city", "region", "postal", "country"] as const).map((k) => (
            <Field key={k} label={k}>
              <input
                className={inputClass}
                value={asString(address[k])}
                onChange={(e) =>
                  onField("address", {
                    ...address,
                    [k]: e.target.value || null,
                  })
                }
              />
            </Field>
          ))}
        </div>
      </div>

      <Field label="Same-as URLs" hint="One per line; leave empty to auto-derive from Social tab.">
        <textarea
          className={`${inputClass} min-h-[90px] font-mono text-xs`}
          value={joinArray(value.same_as)}
          onChange={(e) => onField("same_as", parseCsvArray(e.target.value))}
        />
      </Field>
    </div>
  );
}

// ───────────────────────────────────────────────────────────── audit tab ──

function AuditTab() {
  const [rows, setRows] = useState<AuditEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyIssues, setOnlyIssues] = useState(true);
  const [kind, setKind] = useState<"all" | "product" | "category" | "subcategory">("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAuditData();
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return rows
      .filter((r) => (kind === "all" ? true : r.kind === kind))
      .map((r) => ({ entity: r, issues: auditEntity(r) }))
      .filter((r) => (onlyIssues ? r.issues.length > 0 : true));
  }, [rows, kind, onlyIssues]);

  const issueCounts = useMemo(() => {
    const counts: Record<AuditIssue, number> = {
      missing_meta_title: 0,
      missing_meta_description: 0,
      meta_title_too_long: 0,
      meta_description_too_long: 0,
      missing_keywords: 0,
      missing_og: 0,
    };
    for (const r of rows) {
      for (const i of auditEntity(r)) counts[i]++;
    }
    return counts;
  }, [rows]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {(Object.keys(ISSUE_LABEL) as AuditIssue[]).map((issue) => (
          <div
            key={issue}
            className="rounded-xl border border-border bg-muted/30 px-3 py-2"
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {ISSUE_LABEL[issue]}
            </div>
            <div className="mt-1 text-xl font-extrabold tabular-nums">
              {issueCounts[issue]}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          <option value="all">All entities</option>
          <option value="product">Products</option>
          <option value="category">Categories</option>
          <option value="subcategory">Subcategories</option>
        </select>
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <input
            type="checkbox"
            checked={onlyIssues}
            onChange={(e) => setOnlyIssues(e.target.checked)}
          />
          Only show rows with issues
        </label>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {rows.length} shown
        </span>
      </div>

      <div className="overflow-auto rounded-xl border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2">Noindex</th>
              <th className="px-3 py-2">Issues</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No rows match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map(({ entity, issues }) => (
                <tr key={`${entity.kind}-${entity.id}`} className="border-t border-border">
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                      {entity.kind}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-semibold">{entity.name}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{entity.slug}</td>
                  <td className="px-3 py-2">
                    {entity.robotsNoindex ? (
                      <span className="text-rose-600 font-semibold">yes</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {issues.length === 0 ? (
                      <span className="text-emerald-600 font-semibold">ok</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {issues.map((i) => (
                          <span
                            key={i}
                            className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900"
                          >
                            {ISSUE_LABEL[i]}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
