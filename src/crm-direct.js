// Reads the full inventory straight from the CRM (read-only), logged in with
// CRM_EMAIL / CRM_PASSWORD from src/config.js:
//   - designs (name, photos, metal, purity, category) via the CRM's own
//     getDesignsPaginated server action, 100 per page;
//   - stock, weights and today's prices from the Pieces export CSV.
// Only designs with at least one piece "In Stock" are shown to customers.
// It never creates, edits or deletes anything in the CRM.

import config from './config.js';

const BASE = () => (config.CRM_BASE_URL || 'https://crm.ittanjeweller.com').replace(/\/$/, '');

export function directConfigured() {
  return Boolean(config.CRM_EMAIL && config.CRM_PASSWORD);
}

// --- minimal cookie jar -------------------------------------------------------
class Jar {
  cookies = new Map();
  take(res) {
    for (const c of res.headers.getSetCookie?.() || []) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      if (value) this.cookies.set(name, value);
      else this.cookies.delete(name);
    }
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

async function req(jar, path, opts = {}) {
  const res = await fetch(BASE() + path, {
    redirect: 'manual',
    ...opts,
    headers: { 'user-agent': 'ittan-ai-agent/1.0', cookie: jar.header(), ...(opts.headers || {}) },
  });
  jar.take(res);
  return res;
}

async function login() {
  const jar = new Jar();
  const csrf = await (await req(jar, '/api/auth/csrf')).json();
  await req(jar, '/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-auth-return-redirect': '1' },
    body: new URLSearchParams({
      email: config.CRM_EMAIL.toLowerCase(),
      password: config.CRM_PASSWORD,
      csrfToken: csrf.csrfToken,
      callbackUrl: `${BASE()}/dashboard`,
    }),
  });
  const session = await (await req(jar, '/api/auth/session')).json().catch(() => null);
  if (!session?.user) throw new Error('CRM login failed - check CRM_EMAIL / CRM_PASSWORD in src/config.js');
  return jar;
}

// The server-action id changes whenever the CRM is redeployed, so find it in
// the page's JavaScript instead of hard-coding it.
let actionId = null;
async function findActionId(jar) {
  const html = await (await req(jar, '/dashboard/inventory/designs')).text();
  const chunks = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[\w.-]+\.js/g)].map((m) => m[0]))];
  for (const c of chunks) {
    const js = await (await req(jar, c)).text();
    const m = js.match(/createServerReference\)\("([0-9a-f]{40,})",[^)]{0,120}"getDesignsPaginated"\)/);
    if (m) return m[1];
  }
  throw new Error('could not find the CRM designs list function (CRM may have changed)');
}

// Server-action responses are lines of `<id>:<json>`; return the one with data.
export function parseActionResponse(text) {
  for (const line of text.split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    try {
      const obj = JSON.parse(line.slice(i + 1));
      if (obj && Array.isArray(obj.data)) return obj;
    } catch {
      /* not JSON */
    }
  }
  return null;
}

async function designsPage(jar, page) {
  const res = await req(jar, '/dashboard/inventory/designs', {
    method: 'POST',
    headers: { 'next-action': actionId, accept: 'text/x-component', 'content-type': 'text/plain;charset=UTF-8', origin: BASE() },
    body: JSON.stringify([{ page, pageSize: 100 }]),
  });
  return res.ok ? parseActionResponse(await res.text()) : null;
}

async function fetchAllDesigns(jar) {
  actionId ??= await findActionId(jar);
  let first = await designsPage(jar, 1);
  if (!first) {
    actionId = await findActionId(jar); // CRM redeployed since last sync
    first = await designsPage(jar, 1);
  }
  if (!first) throw new Error('CRM did not return the designs list');
  const all = [...first.data];
  const pages = first.pagination?.totalPages || 1;
  for (let p = 2; p <= pages; p++) {
    const r = await designsPage(jar, p);
    if (!r) throw new Error(`CRM designs page ${p} failed`);
    all.push(...r.data);
  }
  return all;
}

export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift() || [];
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const money = (s) => {
  const n = parseFloat(String(s || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// The pieces export writes purity as "22K (916)"; the rest of the app uses "K22".
function purityCode(label) {
  const s = String(label || '').trim().toUpperCase();
  const k = s.match(/^(\d{2})\s*K/);
  if (k) return `K${k[1]}`;
  const silver = s.match(/^S?(\d{3})\b/); // "925 Silver" / "S925" → S925
  if (silver) return `S${silver[1]}`;
  return s.split(/\s/)[0] || '';
}

const GENDER = { WOMEN: 'Ladies', MEN: 'Gents', KIDS: 'Kids', UNISEX: 'Unisex' };

const pretty = (s) => String(s || '').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Joins designs + pieces into the product list the agent searches. */
export function buildProducts(designs, pieces, { includeOutOfStock = false } = {}) {
  const base = BASE();
  const stock = new Map();
  for (const p of pieces) {
    if (p.Status !== 'In Stock') continue;
    const code = p['Design Code'];
    if (!stock.has(code)) stock.set(code, []);
    stock.get(code).push({ weight: parseFloat(p['Net Weight (g)']) || null, price: money(p['Price (incl. GST)']), category: p.Category, purity: purityCode(p.Purity) });
  }

  const products = [];
  for (const d of designs) {
    if (d.isDeleted || !d.isPublished) continue;
    const code = String(d.designCode || '').trim();
    const inStock = (stock.get(code) || []).filter((s) => s.price != null).sort((a, b) => a.price - b.price);
    if (!inStock.length && !includeOutOfStock) continue;

    const cheapest = inStock[0];
    const name = String(d.name || '').replace(/\s+/g, ' ').trim();
    const markup = parseFloat(d.compareAtMarkupPct) || 0;
    const price = cheapest ? Math.round(cheapest.price) : null;
    const img = d.mediaUrls?.[0] || d.thumbnailUrl || null;
    const metal = /silver/i.test(name) ? 'silver' : String(d.metal || '').toLowerCase() || 'other';
    const category = cheapest?.category || pretty(d.category);
    products.push({
      code,
      title: name,
      purity: cheapest?.purity || d.defaultPurity || '',
      metal,
      weightG: cheapest?.weight ?? (parseFloat(d.representativeWeightG) || null),
      price,
      compareAtPrice: price && markup > 0 ? Math.round(price * (1 + markup / 100)) : null,
      inStock: inStock.length,
      weightsG: inStock.map((s) => s.weight).filter(Boolean),
      image: img ? base + img : null,
      thumb: img ? base + img.replace(/\.webp$/, '-thumb.webp') : null,
      catalogues: [category, ...(d.genderFor || []).map((g) => GENDER[g] || pretty(g))].filter(Boolean),
      url: null,
    });
  }
  return products;
}

export async function fetchDirect(settings) {
  const jar = await login();
  const designs = await fetchAllDesigns(jar);
  const piecesRes = await req(jar, '/dashboard/inventory/pieces/export');
  if (!piecesRes.ok) throw new Error(`pieces export failed: HTTP ${piecesRes.status}`);
  const pieces = parseCsv(await piecesRes.text());
  const products = buildProducts(designs, pieces, { includeOutOfStock: Boolean(settings.includeOutOfStock) });
  return {
    products,
    stats: {
      designs: designs.filter((d) => !d.isDeleted).length,
      pieces: pieces.length,
      piecesInStock: pieces.filter((p) => p.Status === 'In Stock').length,
      shown: products.length,
    },
  };
}
