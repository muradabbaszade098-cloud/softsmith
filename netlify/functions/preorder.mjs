import { getStore } from "@netlify/blobs";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const STORE_NAME = "softsmith-preorders";
const STORE_KEY = "preorders.json";

// Local fallback for `netlify dev` only — never use import.meta.url (breaks under Netlify's CJS bundle).
const LOCAL_FILE = join(process.cwd(), "data", "preorders.json");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isNetlifyRuntime() {
  return Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function loadFromFile() {
  try {
    if (!existsSync(LOCAL_FILE)) return null;
    const parsed = JSON.parse(readFileSync(LOCAL_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return null;
  }
}

function saveToFile(list) {
  const dir = join(process.cwd(), "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(LOCAL_FILE, JSON.stringify(list, null, 2) + "\n", "utf8");
}

async function loadPreorders() {
  try {
    const store = getStore(STORE_NAME);
    const data = await store.get(STORE_KEY, { type: "json" });
    if (Array.isArray(data)) return data;
  } catch (err) {
    console.warn("Blobs load failed:", err?.message || err);
  }

  if (!isNetlifyRuntime()) {
    const fromFile = loadFromFile();
    if (fromFile) return fromFile;
  }

  return [];
}

async function savePreorders(list) {
  try {
    const store = getStore(STORE_NAME);
    await store.setJSON(STORE_KEY, list);
    return;
  } catch (err) {
    console.warn("Blobs save failed:", err?.message || err);
    if (isNetlifyRuntime()) throw err;
  }

  // Local `netlify dev` / offline fallback
  saveToFile(list);
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders });
  }

  if (req.method === "GET") {
    const list = await loadPreorders();
    return jsonResponse(200, list);
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const email = String(payload.email || "").trim();
  const kit = String(payload.kit || "").trim();
  const submittedAt = payload.submittedAt || new Date().toISOString();

  if (!isValidEmail(email)) {
    return jsonResponse(400, { error: "Enter a valid email address." });
  }
  if (!kit) {
    return jsonResponse(400, { error: "Kit is required." });
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

  return jsonResponse(200, { ok: true, entry, total: list.length });
};
