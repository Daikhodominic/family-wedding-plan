// A stand-in for Supabase in the browser tests: tables in memory, and a switch (window.__net = false) that makes
// every request fail the way a phone with no signal does.
(function () {
  const db = window.__db = { weddings: [{ id: 'w1', couple: 'Test & Couple', monogram: 'T&C', theme: 'blue', position: 1, wedding_date: '2026-12-07' }], members: [{ user_id: 'u1', name: 'Tester', is_admin: true, is_decider: true, decider_for: [], phone: '' }] };
  window.__net = window.__net === false ? false : true; window.__sent = [];
  const fail = { data: null, error: { message: 'TypeError: Failed to fetch' } };
  function builder(table) {
    let rows = null, filt = [], op = 'select', payload = null, single = false, opts = {};
    const b = {
      select() { return b; }, order() { return b; }, limit() { return b; },
      eq(k, v) { filt.push(r => r[k] === v); return b; }, in(k, vs) { filt.push(r => vs.includes(r[k])); return b; },
      maybeSingle() { single = true; return b; }, single() { single = true; return b; },
      insert(p) { op = 'insert'; payload = p; return b; }, upsert(p, o) { op = 'upsert'; payload = p; opts = o || {}; return b; },
      update(p) { op = 'update'; payload = p; return b; }, delete() { op = 'delete'; return b; },
      then(res, rej) {
        return new Promise(r => setTimeout(r, 5)).then(() => {
          if (!window.__net) return fail;
          const t = db[table] || (db[table] = []);
          const m = (r) => filt.every(f => f(r));
          if (op === 'select') { const out = t.filter(m); return { data: single ? (out[0] || null) : out, error: null }; }
          window.__sent.push({ table, op, payload });
          if (op === 'insert' || op === 'upsert') { for (const r of [].concat(payload)) { const i = t.findIndex(x => x.id === r.id); if (i >= 0) { if (!opts.ignoreDuplicates) t[i] = { ...t[i], ...r }; } else t.push({ ...r }); } return { data: null, error: null }; }
          if (op === 'update') { t.forEach((r, i) => { if (m(r)) t[i] = { ...r, ...payload }; }); return { data: null, error: null }; }
          if (op === 'delete') { db[table] = t.filter(r => !m(r)); return { data: null, error: null }; }
        }).then(res, rej);
      }
    };
    return b;
  }
  const channel = { on() { return channel; }, subscribe() { return channel; }, track() { return Promise.resolve(); }, presenceState() { return {}; }, unsubscribe() { } };
  window.supabase = { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }), getUser: async () => ({ data: { user: { id: 'u1' } } }), onAuthStateChange() { return { data: { subscription: { unsubscribe() { } } } }; } },
    from: (t) => builder(t), rpc: async () => ({ data: true, error: null }), channel: () => channel, removeChannel() { },
    storage: { from: () => ({ upload: async () => ({ error: null }), createSignedUrl: async (p) => ({ data: { signedUrl: 'data:,' }, error: null }), list: async () => ({ data: [], error: null }), remove: async () => ({ error: null }) }) },
    functions: { invoke: async (name, opts) => { window.__fnCalls = (window.__fnCalls || []).concat([{ name, body: opts && opts.body }]); return window.__smart ? { data: window.__smart(opts.body), error: null } : { data: null, error: { message: 'not deployed' } }; } }
  }) };
})();
