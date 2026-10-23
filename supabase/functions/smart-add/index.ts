// Smart add — the AI and link reader behind the "Smart add" bar.
// Deploy:  supabase functions deploy smart-add
// Secrets (set in Supabase → Edge Functions → Secrets, never in the app or chat):
//   GEMINI_API_KEY        free key from Google AI Studio (Gemini Flash-Lite)          — main AI
//   CF_ACCOUNT_ID, CF_API_TOKEN   Cloudflare Workers AI (free tier)                   — backup AI
//   IG_USER_ID, IG_ACCESS_TOKEN   Instagram Business Discovery (a Meta app, optional) — public business profiles
//
// What it does, and what it never does:
//  • Only family members can call it (their sign-in is checked).
//  • It reads websites the family pasted, and public Instagram *business* profiles through Meta's official API.
//  • Only vendor content goes to the AI — never names of family members, budgets or anything else from the plan.
//  • The AI is told to use only what it's given. It never searches the web for a name, so a different
//    business with the same name can't sneak in.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const env = (k: string) => Deno.env.get(k) || '';

type Img = { b64: string; mime: string };
type Body = { text?: string; links?: string[]; images?: Img[]; categories?: { id: string; title: string }[] };

// ---------- Reading links ----------
async function readWebsite(url: string) {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (WeddingWarRoom link reader)', 'Accept': 'text/html' } });
    clearTimeout(t);
    if (!r.ok || !(r.headers.get('content-type') || '').includes('html')) return null;
    const html = (await r.text()).slice(0, 400_000);
    const meta = (p: string) => (html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)`, 'i')) || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${p}["']`, 'i')) || [])[1] || '';
    const title = meta('og:title') || (html.match(/<title[^>]*>([^<]{1,200})/i) || [])[1] || '';
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, 6000);
    const tel = [...new Set((html.match(/tel:([+\d\s-]{8,})/gi) || []).map(x => x.slice(4).trim()))];
    const mail = [...new Set((html.match(/mailto:([^"'?\s]+)/gi) || []).map(x => x.slice(7)))];
    const ent = (x: string) => x.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    return { url, title: ent(title), description: ent(meta('og:description') || meta('description')), image: meta('og:image'), text, phones: tel, emails: mail };
  } catch (_) { return null; }
}

async function readInstagram(handle: string) {
  const id = env('IG_USER_ID'), token = env('IG_ACCESS_TOKEN');
  if (!id || !token) return { handle, unavailable: 'Instagram reading is not set up yet' };
  const fields = `business_discovery.username(${handle}){username,name,biography,website,followers_count,media_count,profile_picture_url,media.limit(8){media_type,media_url,thumbnail_url,permalink,caption}}`;
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${id}?fields=${encodeURIComponent(fields)}&access_token=${token}`);
    const j = await r.json();
    if (j.error) return { handle, unavailable: /not.*business|cannot be found|does not exist/i.test(j.error.message) ? 'This is a personal account — Instagram only shares business and creator profiles' : j.error.message };
    const b = j.business_discovery || {};
    const media = (b.media && b.media.data || []).filter((m: any) => m.media_type !== 'VIDEO' || m.thumbnail_url).slice(0, 6);
    // the pictures are sent back as small copies, so the phone can keep them
    const photos: { b64: string; mime: string; permalink: string; caption: string }[] = [];
    for (const m of media.slice(0, 4)) {
      try { const pr = await fetch(m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url); const buf = new Uint8Array(await pr.arrayBuffer()); if (buf.length < 2_500_000) photos.push({ b64: b64(buf), mime: pr.headers.get('content-type') || 'image/jpeg', permalink: m.permalink, caption: (m.caption || '').slice(0, 300) }); } catch (_) { /* skip */ }
    }
    return { handle, name: b.name || '', username: b.username, bio: b.biography || '', website: b.website || '', followers: b.followers_count || 0, posts: b.media_count || 0, captions: media.map((m: any) => (m.caption || '').slice(0, 300)), photos };
  } catch (e) { return { handle, unavailable: String(e) }; }
}
function b64(buf: Uint8Array) { let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(s); }

// ---------- The AI ----------
const SCHEMA = {
  type: 'object', properties: {
    vendors: { type: 'array', items: { type: 'object', properties: {
      name: { type: 'string' }, category_id: { type: 'string' }, kind: { type: 'string' }, confidence: { type: 'number' },
      phone: { type: 'string' }, whatsapp: { type: 'string' }, instagram: { type: 'string' }, website: { type: 'string' }, email: { type: 'string' },
      price_text: { type: 'string' }, price_value: { type: 'number' }, location: { type: 'string' }, notes: { type: 'string' },
      images: { type: 'array', items: { type: 'integer' } },
      crops: { type: 'array', items: { type: 'object', properties: { image: { type: 'integer' }, box: { type: 'array', items: { type: 'integer' } } } } }
    }, required: ['name', 'confidence'] } }
  }, required: ['vendors']
};
function prompt(b: Body, sites: unknown[], ig: unknown[]) {
  return `You help a family plan a wedding in North-East India. From the material below, list each wedding vendor it describes.
Rules:
- Use ONLY the material given. Never invent, guess or look anything up. If something isn't there, leave it empty.
- One entry per vendor. A message listing several vendors gives several entries. The same vendor mentioned twice is one entry.
- category_id: pick the best id from CATEGORIES, or "" if none fits. confidence: 0–1 for the whole entry (name + category).
- price_value in rupees (85k = 85000, 1.2 lakh = 120000). price_text as written, with "per plate" etc. if given.
- phone in +91 form when it's an Indian mobile. instagram as the handle without @.
- images: indexes (from 0) of the attached images that show this vendor's work or details.
- crops: for screenshots, the box [ymin, xmin, ymax, xmax] on a 0–1000 scale around each actual photo of their work, leaving out phone status bars, app buttons and text. Only for screenshots.
- notes: one or two short lines on what they offer, in plain words, from the material.
CATEGORIES: ${JSON.stringify(b.categories || [])}
PASTED TEXT:
${(b.text || '').slice(0, 8000)}
WEBSITES READ: ${JSON.stringify(sites).slice(0, 12000)}
INSTAGRAM PROFILES: ${JSON.stringify(ig.map((x: any) => ({ ...x, photos: undefined }))).slice(0, 8000)}
IMAGES ATTACHED: ${(b.images || []).length}`;
}

async function gemini(b: Body, text: string) {
  const key = env('GEMINI_API_KEY'); if (!key) throw new Error('no-gemini');
  const parts: unknown[] = [{ text }, ...(b.images || []).slice(0, 8).map(i => ({ inline_data: { mime_type: i.mime || 'image/jpeg', data: i.b64 } }))];
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: SCHEMA } })
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  const out = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '{}';
  return JSON.parse(out);
}
async function cloudflare(_b: Body, text: string) {
  const acc = env('CF_ACCOUNT_ID'), tok = env('CF_API_TOKEN'); if (!acc || !tok) throw new Error('no-cloudflare');
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acc}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast`, {
    method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'system', content: 'Reply with JSON only, matching: {"vendors":[{"name","category_id","kind","confidence","phone","whatsapp","instagram","website","email","price_text","price_value","location","notes"}]}' }, { role: 'user', content: text }], max_tokens: 1500, temperature: 0.1 })
  });
  const j = await r.json(); if (!j.success) throw new Error('cloudflare failed');
  const s = String(j.result?.response ?? ''); const m = typeof j.result?.response === 'object' ? j.result.response : JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
  return m;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  // Family members only.
  const auth = req.headers.get('Authorization') || '';
  const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: auth } } });
  const { data: isMember } = await sb.rpc('is_member');
  if (!isMember) return json({ error: 'Only family members can use Smart add' }, 401);

  let b: Body; try { b = await req.json(); } catch (_) { return json({ error: 'Bad request' }, 400); }
  const links = [...new Set((b.links || []).slice(0, 8))];
  const igs = links.map(u => (u.match(/instagram\.com\/([A-Za-z0-9._]{1,30})\/?$/i) || [])[1]).filter(h => h && !['p', 'reel', 'reels', 'stories', 'explore'].includes(h.toLowerCase())) as string[];
  const webs = links.filter(u => !/instagram\.com|instagr\.am|facebook\.com|fb\.com|wa\.me/i.test(u));
  const [sites, ig] = await Promise.all([Promise.all(webs.map(readWebsite)), Promise.all(igs.slice(0, 4).map(readInstagram))]);
  const read = sites.filter(Boolean);

  const text = prompt(b, read, ig);
  let ai = null, used = '', note = '';
  for (const [name, fn] of [['gemini', gemini], ['cloudflare', cloudflare]] as const) {
    try { ai = await fn(b, text); used = name; break; } catch (e) { note += `${name}: ${String((e as Error).message || e)}. `; }
  }
  const unset = /no-gemini/.test(note) && /no-cloudflare/.test(note);
  return json({ ai, used, note: ai ? '' : unset ? 'the AI isn’t set up yet' : 'the AI didn’t answer', detail: ai ? undefined : note.trim(), sites: read.map((s: any) => ({ url: s.url, title: s.title, description: s.description, image: s.image, phones: s.phones, emails: s.emails })), instagram: ig });
});
