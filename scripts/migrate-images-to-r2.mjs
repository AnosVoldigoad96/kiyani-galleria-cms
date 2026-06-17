#!/usr/bin/env node
/**
 * Migrate Nhost-Storage images/videos to Cloudflare R2.
 *
 * One-time, idempotent, PHASED, and safe-by-default:
 *   node scripts/migrate-images-to-r2.mjs                 # DRY-RUN: discover + plan only (no writes)
 *   node scripts/migrate-images-to-r2.mjs --copy          # show what would be uploaded (still no writes)
 *   node scripts/migrate-images-to-r2.mjs --copy --execute        # actually upload to R2 (needs R2 creds)
 *   node scripts/migrate-images-to-r2.mjs --rewrite-db            # show planned DB URL rewrites (no writes)
 *   node scripts/migrate-images-to-r2.mjs --rewrite-db --execute  # apply DB rewrites (backs up first)
 *
 * Optional: --limit N  (process only N files — for a trial run)
 *
 * IMAGES are resized into a fixed AVIF ladder (400/800/1600) stored as static
 * objects: r2://<bucket>/<id>/<w>.avif. The stored DB URL points at the 1600
 * default (a concrete, directly-usable URL); the storefront loader swaps the
 * size segment for responsive requests. VIDEOS are transcoded to an efficient
 * H.264 mp4 (muted audio stripped, capped, faststart) at <id>/original.mp4; the
 * DB URL points at it and the existing <video src> plays it directly. Other
 * files are copied unchanged to <id>/original.<ext>.
 *
 * Nhost is never modified or deleted — it stays as a backup until you verify R2
 * in production and explicitly clean up.
 *
 * Creds:
 *   .env                    → NEXT_PUBLIC_NHOST_SUBDOMAIN, NEXT_PUBLIC_NHOST_REGION, HASURA_ADMIN_SECRET
 *   .env.migration.local    → R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE
 *   (both gitignored via `.env*`)
 */

import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ───────────────────────────────────────────────────────────── config ──
const LADDER = [400, 800, 1600]; // responsive widths (px)
const DEFAULT_WIDTH = 1600; // size stored in the DB URL / used for direct contexts
const AVIF_QUALITY = 72;
// video transcode: efficient H.264 mp4 (strip muted audio, cap, faststart)
const VIDEO_MAX_W = 1080; // cap longest dimension
const MP4_CRF = 30;

// ───────────────────────────────────────────────────────────── env ──
function loadEnv() {
  const map = {};
  for (const file of [".env", ".env.local", ".env.migration.local"]) {
    const p = resolve(root, file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      map[m[1]] = v;
    }
  }
  return map;
}

const env = loadEnv();
const subdomain = env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
const region = env.NEXT_PUBLIC_NHOST_REGION;
const adminSecret = env.HASURA_ADMIN_SECRET;

if (!subdomain || !region || !adminSecret) {
  console.error("✗ Missing NEXT_PUBLIC_NHOST_SUBDOMAIN / NEXT_PUBLIC_NHOST_REGION / HASURA_ADMIN_SECRET in .env");
  process.exit(1);
}

const hasuraBase = `https://${subdomain}.hasura.${region}.nhost.run`;
const NHOST_FILE_PREFIX = `https://${subdomain}.storage.${region}.nhost.run/v1/files/`;

// ───────────────────────────────────────────────────────────── cli ──
const args = new Set(process.argv.slice(2));
const PHASE_COPY = args.has("--copy");
const PHASE_REWRITE = args.has("--rewrite-db");
const EXECUTE = args.has("--execute");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : null;
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.split("=")[1] : null; // image | video | asset
const skipColsArg = process.argv.find((a) => a.startsWith("--skip-columns="));
const SKIP_COLS = skipColsArg ? skipColsArg.split("=")[1].split(",").map((s) => s.trim()) : [];
const inspectArg = process.argv.find((a) => a.startsWith("--inspect="));
const rmArg = process.argv.find((a) => a.startsWith("--rm=")); // delete one R2 object

// ───────────────────────────────────────────────────────────── hasura ──
async function hasura(path, body) {
  const res = await fetch(`${hasuraBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-hasura-admin-secret": adminSecret },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { ok: res.ok, status: res.status, body: parsed };
}

async function runSql(sql, { readOnly = true } = {}) {
  const { ok, status, body } = await hasura("/v2/query", {
    type: "run_sql",
    args: { sql, cascade: false, read_only: readOnly },
  });
  if (!ok) {
    throw new Error(`SQL failed (${status}): ${JSON.stringify(body)}\n  SQL: ${sql.slice(0, 200)}`);
  }
  // body.result = [[colnames...], [row...], ...]
  const rows = Array.isArray(body.result) ? body.result.slice(1) : [];
  const cols = Array.isArray(body.result) ? body.result[0] : [];
  return { cols, rows };
}

// ───────────────────────────────────────────────────────────── helpers ──
function extForFile(mime, name) {
  if (name && name.includes(".")) return name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (mime && mime.includes("/")) return mime.split("/")[1].toLowerCase().replace(/[^a-z0-9]/g, "");
  return "bin";
}
function isImage(mime) {
  return typeof mime === "string" && mime.startsWith("image/");
}
function isVideo(mime) {
  return typeof mime === "string" && mime.startsWith("video/");
}
function r2base() {
  return (env.R2_PUBLIC_BASE || "<R2_PUBLIC_BASE>").replace(/\/$/, "");
}
function planForFile(f) {
  const oldUrl = `${NHOST_FILE_PREFIX}${f.id}`;
  if (isImage(f.mime_type)) {
    return {
      id: f.id, kind: "image", mime: f.mime_type,
      objects: LADDER.map((w) => `${f.id}/${w}.avif`),
      oldUrl,
      newUrl: `${r2base()}/${f.id}/${DEFAULT_WIDTH}.avif`,
    };
  }
  if (isVideo(f.mime_type)) {
    return {
      id: f.id, kind: "video", mime: f.mime_type,
      objects: [`${f.id}/original.mp4`],
      oldUrl,
      // DB stores the optimized mp4 (universal playback).
      newUrl: `${r2base()}/${f.id}/original.mp4`,
    };
  }
  const ext = extForFile(f.mime_type, f.name);
  return {
    id: f.id, kind: "asset", mime: f.mime_type,
    objects: [`${f.id}/original.${ext}`],
    oldUrl,
    newUrl: `${r2base()}/${f.id}/original.${ext}`,
  };
}

// Transcode a source video buffer → an efficient H.264 mp4 using bundled ffmpeg.
function transcodeVideo(buf, ffmpegPath) {
  const dir = mkdtempSync(resolve(tmpdir(), "vid-"));
  const inPath = resolve(dir, "in");
  const mp4Path = resolve(dir, "out.mp4");
  const scale = `scale='min(${VIDEO_MAX_W},iw)':-2`;
  try {
    writeFileSync(inPath, buf);
    // no audio (clips are muted), capped resolution, web-streamable.
    execFileSync(ffmpegPath, ["-y", "-i", inPath, "-an", "-vf", scale,
      "-c:v", "libx264", "-crf", String(MP4_CRF), "-preset", "slow",
      "-movflags", "+faststart", mp4Path], { stdio: "ignore" });
    return readFileSync(mp4Path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
function fmtBytes(n) {
  n = Number(n) || 0;
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
}

// ───────────────────────────────────────────────────────────── discover ──
async function discover() {
  console.log(`\nHasura:  ${hasuraBase}`);
  console.log(`Nhost prefix: ${NHOST_FILE_PREFIX}`);

  // 1) File inventory from Nhost storage metadata
  const inv = await runSql(
    `SELECT mime_type, count(*)::int AS n, coalesce(sum(size),0)::bigint AS bytes
       FROM storage.files GROUP BY mime_type ORDER BY n DESC`
  );
  console.log("\n── Files in Nhost storage ──");
  let totalFiles = 0, totalBytes = 0, imageFiles = 0;
  for (const [mime, n, bytes] of inv.rows) {
    totalFiles += Number(n); totalBytes += Number(bytes);
    if (isImage(mime)) imageFiles += Number(n);
    console.log(`  ${String(mime).padEnd(24)} ${String(n).padStart(5)}   ${fmtBytes(bytes)}`);
  }
  console.log(`  ${"TOTAL".padEnd(24)} ${String(totalFiles).padStart(5)}   ${fmtBytes(totalBytes)}`);

  // full list for the plan
  const all = await runSql(
    `SELECT id::text, mime_type, coalesce(name,'') AS name, coalesce(size,0)::bigint AS size, coalesce(is_uploaded,false) AS up
       FROM storage.files ORDER BY created_at`
  );
  let files = all.rows.map(([id, mime_type, name, size, up]) => ({ id, mime_type, name, size: Number(size), up }));
  if (ONLY) files = files.filter((f) => planForFile(f).kind === ONLY);
  if (LIMIT) files = files.slice(0, LIMIT);

  const notUploaded = files.filter((f) => !f.up).length;
  const plans = files.map(planForFile);
  const r2ObjectCount = plans.reduce((a, p) => a + p.objects.length, 0);

  const imgCount = plans.filter((p) => p.kind === "image").length;
  const vidCount = plans.filter((p) => p.kind === "video").length;
  const otherCount = plans.filter((p) => p.kind === "asset").length;
  console.log("\n── Planned R2 layout ──");
  console.log(`  images → ${imgCount} files × ${LADDER.length} AVIF (${LADDER.join("/")}) = ${imgCount * LADDER.length} objects`);
  console.log(`  videos → ${vidCount} files × optimized mp4      = ${vidCount} objects`);
  if (otherCount) console.log(`  other  → ${otherCount} files × 1 original          = ${otherCount} objects`);
  console.log(`  TOTAL R2 objects to create: ${r2ObjectCount}`);
  if (notUploaded) console.log(`  ⚠ ${notUploaded} file(s) have is_uploaded=false (incomplete) — review before copying`);
  console.log("\n  sample mappings:");
  for (const p of plans.slice(0, 4)) {
    console.log(`    [${p.kind}] ${p.oldUrl}`);
    console.log(`        → ${p.newUrl}`);
  }

  // 2) Discover DB columns that contain Nhost file URLs
  const candidates = await runSql(
    `SELECT table_name, column_name, data_type
       FROM information_schema.columns
      WHERE table_schema='public' AND data_type IN ('text','character varying','jsonb')
      ORDER BY table_name, column_name`
  );
  console.log("\n── Scanning DB columns for Nhost URLs ──");
  const hits = [];
  for (const [table, col] of candidates.rows) {
    try {
      const c = await runSql(
        `SELECT count(*)::int FROM "public"."${table}" WHERE "${col}"::text LIKE '%${NHOST_FILE_PREFIX}%'`
      );
      const n = Number(c.rows[0]?.[0] || 0);
      if (n > 0) { hits.push({ table, col, rows: n }); console.log(`  ${table}.${col}  →  ${n} row(s)`); }
    } catch (e) {
      console.log(`  (skip ${table}.${col}: ${String(e.message).split("\n")[0]})`);
    }
  }
  if (!hits.length) console.log("  (none found — check the prefix / that data exists)");

  // 3) Manifest for review
  const manifest = {
    generatedAt: new Date().toISOString(),
    nhostPrefix: NHOST_FILE_PREFIX,
    r2PublicBase: env.R2_PUBLIC_BASE || null,
    ladder: LADDER, defaultWidth: DEFAULT_WIDTH, avifQuality: AVIF_QUALITY,
    totals: { files: totalFiles, bytes: totalBytes, imageFiles, r2ObjectCount, notUploaded },
    dbColumns: hits,
    files: plans,
  };
  const out = resolve(__dirname, "migration-manifest.json");
  writeFileSync(out, JSON.stringify(manifest, null, 2));
  console.log(`\n✓ Wrote review manifest → scripts/migration-manifest.json (${plans.length} files, ${hits.length} columns)`);
  return { files, plans, hits };
}

// ───────────────────────────────────────────────────────────── copy ──
async function copy() {
  if (!EXECUTE) console.log("\n(--copy without --execute: dry preview, no uploads)\n");
  for (const k of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
    if (EXECUTE && !env[k]) { console.error(`✗ Missing ${k} in .env`); process.exit(1); }
  }
  const { files } = await discover();

  if (!EXECUTE) {
    console.log(`\nWould process ${files.length} files into R2 (run again with --execute to upload).`);
    return;
  }

  // lazy deps — only needed for the real upload
  let sharp, S3, PutObjectCommand, HeadObjectCommand, ffmpegPath;
  try {
    ({ default: sharp } = await import("sharp"));
    ({ S3Client: S3, PutObjectCommand, HeadObjectCommand } = await import("@aws-sdk/client-s3"));
    ({ default: ffmpegPath } = await import("ffmpeg-static"));
  } catch {
    console.error("✗ Missing deps. Run:  npm i sharp @aws-sdk/client-s3 ffmpeg-static");
    process.exit(1);
  }
  const s3 = new S3({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  });

  async function exists(key) {
    try { await s3.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: key })); return true; }
    catch { return false; }
  }
  async function put(key, body, contentType) {
    await s3.send(new PutObjectCommand({
      Bucket: env.R2_BUCKET, Key: key, Body: body, ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }));
  }

  let done = 0, skipped = 0, failed = 0;
  for (const f of files) {
    const p = planForFile(f);
    try {
      // idempotent: skip if all target objects already present
      const present = await Promise.all(p.objects.map(exists));
      if (present.every(Boolean)) { skipped++; continue; }

      const res = await fetch(`${NHOST_FILE_PREFIX}${f.id}`);
      if (!res.ok) throw new Error(`download ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());

      if (p.kind === "image") {
        for (const w of LADDER) {
          const key = `${f.id}/${w}.avif`;
          if (await exists(key)) continue;
          const avif = await sharp(buf).resize({ width: w, withoutEnlargement: true }).avif({ quality: AVIF_QUALITY }).toBuffer();
          await put(key, avif, "image/avif");
        }
      } else if (p.kind === "video") {
        const mp4Key = `${f.id}/original.mp4`;
        if (!(await exists(mp4Key))) {
          const mp4 = transcodeVideo(buf, ffmpegPath);
          await put(mp4Key, mp4, "video/mp4");
        }
      } else {
        const key = p.objects[0];
        if (!(await exists(key))) await put(key, buf, f.mime_type || "application/octet-stream");
      }
      done++;
      if (done % 20 === 0) console.log(`  …${done} migrated`);
    } catch (e) {
      failed++;
      console.error(`  ✗ ${f.id}: ${e.message}`);
    }
  }
  console.log(`\n✓ copy complete — uploaded ${done}, skipped ${skipped} (already present), failed ${failed}`);
}

// ───────────────────────────────────────────────────────────── rewrite-db ──
async function rewriteDb() {
  const { hits: allHits } = await discover();
  const hits = allHits.filter((h) => !SKIP_COLS.includes(`${h.table}.${h.col}`));
  if (SKIP_COLS.length) console.log(`\n(skipping columns: ${SKIP_COLS.join(", ")})`);
  if (!hits.length) { console.log("\nNo columns to rewrite."); return; }

  const r2base = (env.R2_PUBLIC_BASE || "").replace(/\/$/, "");
  if (EXECUTE && !r2base) { console.error("✗ R2_PUBLIC_BASE required to rewrite URLs"); process.exit(1); }

  // Build per-file old→new exact replacements (image → /1600.avif, video → /original.mp4, …).
  const all = await runSql(`SELECT id::text, mime_type, coalesce(name,'') FROM storage.files`);
  const plans = all.rows.map(([id, mime, name]) => planForFile({ id, mime_type: mime, name }));
  const map = plans.map((p) => ({ old: p.oldUrl, neu: p.newUrl }));

  if (!EXECUTE) {
    console.log("\n(--rewrite-db without --execute: preview only, no writes)");
    console.log(`  ${map.length} URL replacements would be applied across ${hits.length} columns:`);
    for (const h of hits) console.log(`    ${h.table}.${h.col} (${h.rows} rows)`);
    for (const kind of ["image", "video", "asset"]) {
      const p = plans.find((x) => x.kind === kind);
      if (p) console.log(`  e.g. [${kind}]\n    ${p.oldUrl}\n      → ${p.newUrl}`);
    }
    return;
  }

  // Backup affected columns first (reversible).
  const backup = {};
  for (const h of hits) {
    const b = await runSql(`SELECT "${h.col}"::text FROM "public"."${h.table}" WHERE "${h.col}"::text LIKE '%${NHOST_FILE_PREFIX}%'`);
    backup[`${h.table}.${h.col}`] = b.rows.map((r) => r[0]);
  }
  const bpath = resolve(__dirname, `migration-db-backup-${Date.now()}.json`);
  writeFileSync(bpath, JSON.stringify(backup, null, 2));
  console.log(`\n✓ Backed up affected column values → ${bpath}`);

  // Apply replacements. For text and jsonb (cast to text and back).
  for (const h of hits) {
    const typeRow = await runSql(
      `SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='${h.table}' AND column_name='${h.col}'`
    );
    const dtype = typeRow.rows[0]?.[0];
    const cast = dtype === "jsonb" ? "::jsonb" : "";
    // chain replace() for each mapping — safe because olds are unique full URLs
    let expr = `"${h.col}"::text`;
    for (const { old, neu } of map) {
      expr = `replace(${expr}, '${old}', '${neu}')`;
    }
    await runSql(
      `UPDATE "public"."${h.table}" SET "${h.col}" = (${expr})${cast} WHERE "${h.col}"::text LIKE '%${NHOST_FILE_PREFIX}%'`,
      { readOnly: false }
    );
    console.log(`  ✓ rewrote ${h.table}.${h.col}`);
  }
  console.log("\n✓ DB rewrite complete. Verify the storefront, then you can remove the Nhost files.");
}

// ───────────────────────────────────────────────────────── inspect ──
// Read-only: list which JSON string fields in a column hold Nhost URLs.
async function inspectColumn(tableCol) {
  const [table, col] = tableCol.split(".");
  console.log(`\nInspecting ${tableCol} — JSON fields whose value is a Nhost URL:`);
  const { rows } = await runSql(
    `SELECT (regexp_matches("${col}"::text, '"([a-zA-Z_]+)"\\s*:\\s*"[^"]*nhost[^"]*"', 'g'))[1] AS field,
            count(*)::int AS n
       FROM "public"."${table}" WHERE "${col}"::text LIKE '%nhost%'
      GROUP BY 1 ORDER BY n DESC`
  );
  if (!rows.length) console.log("  (no Nhost URLs found inside JSON string fields)");
  for (const [field, n] of rows) console.log(`  ${String(field).padEnd(28)} ${n}`);
}

// ───────────────────────────────────────────────────────── rm one object ──
async function rmObject(key) {
  const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  });
  await s3.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
  console.log(`✓ deleted r2://${env.R2_BUCKET}/${key}`);
}

// ───────────────────────────────────────────────────────────── main ──
(async () => {
  try {
    if (rmArg) await rmObject(rmArg.split("=")[1]);
    else if (inspectArg) await inspectColumn(inspectArg.split("=")[1]);
    else if (PHASE_COPY) await copy();
    else if (PHASE_REWRITE) await rewriteDb();
    else await discover(); // default = pure dry-run
  } catch (e) {
    console.error("\n✗ Error:", e.message);
    process.exit(1);
  }
})();
