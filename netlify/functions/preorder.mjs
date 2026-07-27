import { getStore } from "@netlify/blobs";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const STORE_KEY = "preorders.json";
const LOCAL_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "data",
  "preorders.json"
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body, null, 2),
  };
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function loadPreorders() {
  // Prefer Netlify Blobs in production; fall back to local JSON file for `netlify dev`.
  try {
    const store = getStore("softsmith-preorders");
    const data = await store.get(STORE_KEY, { type: "json" });
    if (Array.isArray(data)) return data;
  } catch {
    // Blobs unavailable locally without Netlify identity — use file.
  }

  try {
    if (existsSync(LOCAL_FILE)) {
      const raw = readFileSync(LOCAL_FILE, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    // ignore corrupt local file
  }

  return [];
}

async function savePreorders(list) {
  let blobOk = false;
  try {
    const store = getStore("softsmith-preorders");
    await store.setJSON(STORE_KEY, list);
    blobOk = true;
  } catch {
    // fall through to file write
  }

  try {
    const dir = dirname(LOCAL_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(LOCAL_FILE, JSON.stringify(list, null, 2) + "\n", "utf8");
  } catch (err) {
    if (!blobOk) throw err;
  }
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod === "GET") {
    const list = await loadPreorders();
    return json(200, list);
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const email = String(payload.email || "").trim();
  const kit = String(payload.kit || "").trim();
  const submittedAt = payload.submittedAt || new Date().toISOString();

  if (!isValidEmail(email)) {
    return json(400, { error: "Enter a valid email address." });
  }
  if (!kit) {
    return json(400, { error: "Kit is required." });
  }

  const entry = { email, kit, submittedAt };
  const list = await loadPreorders();
  const existing = list.find((p) => p.email.toLowerCase() === email.toLowerCase());

  if (existing) {
    existing.kit = kit;
    existing.submittedAt = submittedAt;
  } else {
    list.push(entry);
  }

  await savePreorders(list);

  return json(200, { ok: true, entry, total: list.length });
}
