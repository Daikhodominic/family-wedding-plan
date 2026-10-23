// The data layer. Two interchangeable backends:
//  - LiveStore talks to Supabase (the real, shared family site)
//  - DemoStore keeps sample data in this browser only (for previews)
import { SUPABASE_URL, SUPABASE_KEY, MODE } from './config.js?v=50';
import { sampleRows } from './samples.js?v=50';

export const TABLES = ['weddings', 'stages', 'areas', 'steps', 'todos', 'board_items', 'files', 'lists', 'list_rows', 'budgets', 'budget_areas', 'budget_items', 'comments', 'reactions', 'announcements', 'announcement_seen', 'partner_links', 'partners', 'edit_locks', 'activity', 'members'];
const OPTIONAL = ['todos', 'files', 'lists', 'list_rows', 'budgets', 'budget_areas', 'budget_items', 'comments', 'reactions', 'announcements', 'announcement_seen', 'partner_links', 'partners', 'edit_locks'];  // tables added by later database updates
const lockId = (r) => { if (r && r.target_table) r.id = r.target_table + ':' + r.target_id; return r; };
const UNLOGGED = ['reactions', 'announcement_seen', 'partner_links', 'partners', 'edit_locks'];


const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
const nowIso = () => new Date().toISOString();

class BaseStore {
  constructor() {
    this.cache = Object.fromEntries(TABLES.map(t => [t, []]));
    this.listeners = new Set();
    this.me = null;
    this.missing = {};
  }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  // Row-level hook for changes made by other people (used for phone notifications).
  onRemoteRow(fn) { (this._rowHooks = this._rowHooks || new Set()).add(fn); return () => this._rowHooks.delete(fn); }
  _remoteRow(ev) { for (const f of (this._rowHooks || [])) { try { f(ev); } catch (e) { console.error(e); } } }
  memberPhone(name) {
    const n = String(name || '').trim().toLowerCase(); if (!n) return '';
    const ms = this.cache.members || [];
    const m = ms.find(r => (r.name || '').trim().toLowerCase() === n) || ms.find(r => (r.name || '').trim().toLowerCase().split(/\s+/)[0] === n.split(/\s+/)[0]);
    return (m && m.phone) || '';
  }
  // Change notices. During a big action (batch) they wait and fire once at the end;
  // a burst of changes arriving from other devices is gathered into one notice.
  emit(info) {
    if (this._hold) { this._held = info || {}; return; }
    if (info && info.remote) { this._remote = info; clearTimeout(this._remT); this._remT = setTimeout(() => { const i = this._remote; this._remote = null; this._fire(i); }, 160); return; }
    this._fire(info);
  }
  _fire(info) { for (const fn of this.listeners) { try { fn(info); } catch (e) { console.error(e); } } }
  async batch(fn) {
    this._hold = (this._hold || 0) + 1;
    try { return await fn(); }
    finally { this._hold--; if (!this._hold && this._held) { const i = this._held; this._held = null; this._fire(i); } }
  }
  // The same rules the database enforces (update 14), checked first so nothing flickers on and off.
  roleOf(m) { return !m ? 'full' : (m.isAdmin || m.is_admin) ? 'full' : (m.role || 'full'); }
  heldBy(table, row) {
    const L = this.cache.edit_locks || []; if (!L.length || !row) return null;
    const k = table === 'areas' ? ['areas', row.id] : table === 'steps' ? ['areas', row.area_id] : table === 'lists' ? ['lists', row.id] : table === 'list_rows' ? ['lists', row.list_id]
      : table === 'budgets' ? ['budgets', row.id] : (table === 'budget_areas' || table === 'budget_items') ? ['budgets', row.budget_id] : null;
    return k ? L.find(l => l.target_table === k[0] && l.target_id === k[1]) || null : null;
  }
  isLocked(target, id) { return (this.cache.edit_locks || []).find(l => l.target_table === target && l.target_id === id) || null; }
  may(table, row) {
    const OPEN = ['comments', 'reactions', 'announcement_seen', 'activity', 'members', 'edit_locks'];
    const role = this.roleOf(this.me);
    if (role === 'view' && !OPEN.includes(table)) return 'view';
    if (role === 'lists' && !OPEN.includes(table) && !['lists', 'list_rows', 'files'].includes(table)) return 'lists';
    if (this.me && !this.me.isAdmin && this.heldBy(table, row)) return 'locked';
    return true;
  }
  guard(table, row) {
    const r = this.may(table, row); if (r === true) return;
    throw new Error(r === 'view' ? 'You can look, comment and vote. Ask the admin if you need to change things.' : r === 'lists' ? 'You can work on Lists & files. Ask the admin to change anything else.' : 'This is locked by the admin. Comments still work.');
  }
  rows(table) { return this.cache[table]; }
  find(table, id) { return this.cache[table].find(r => r.id === id); }
  memberName(id) { const m = this.cache.members.find(r => r.user_id === id); return m ? m.name : ''; }
  upsertLocal(table, row) {
    const list = this.cache[table];
    const key = table === 'members' ? 'user_id' : 'id';
    const i = list.findIndex(r => r[key] === row[key]);
    if (i >= 0) list[i] = { ...list[i], ...row }; else list.push(row);
  }
  dropChildren(table, id) {
    const kill = (t, pred) => { this.cache[t] = this.cache[t].filter(r => !pred(r)); };
    if (table === 'weddings') for (const t of ['stages', 'areas', 'steps', 'todos', 'board_items', 'files', 'lists', 'list_rows', 'budgets', 'budget_areas', 'budget_items', 'comments', 'reactions']) kill(t, r => r.wedding_id === id);
    if (table === 'board_items') { kill('comments', r => r.item_id === id); kill('reactions', r => r.item_id === id); }
    if (table === 'budgets') { kill('budget_areas', r => r.budget_id === id); kill('budget_items', r => r.budget_id === id); }
    if (table === 'budget_areas') this.cache.budget_items.forEach(r => { if (r.area_id === id) r.area_id = null; });
    if (table === 'lists') kill('list_rows', r => r.list_id === id);
    if (table === 'stages') { const areas = this.cache.areas.filter(a => a.stage_id === id).map(a => a.id); kill('steps', s => areas.includes(s.area_id)); kill('areas', a => a.stage_id === id); }
    if (table === 'areas') kill('steps', s => s.area_id === id);
  }
  dropLocal(table, id) {
    const key = table === 'members' ? 'user_id' : 'id';
    this.cache[table] = this.cache[table].filter(r => r[key] !== id);
  }
}

/* ------------------------------------------------------------------ */
/*  Live: Supabase                                                     */
/* ------------------------------------------------------------------ */
class LiveStore extends BaseStore {
  constructor() {
    super();
    this.mode = 'live';
    this.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    this.urlCache = new Map();
  }

  async init() {
    const { data } = await this.sb.auth.getSession();
    if (!data.session) return 'needs-join';
    if (await this.loadMe()) return 'ready';
    // No internet: open with the copy saved on this phone instead of asking to join again.
    if (this._netDown) { try { const sn = JSON.parse(localStorage.getItem(SNAP) || 'null'); if (sn && sn.me && sn.user === data.session.user.id) { this.me = sn.me; this.offlineStart = true; return 'ready'; } } catch (e) { /* no saved copy */ } }
    return 'needs-join';
  }

  async loadMe() {
    this._netDown = false;
    const { data: u, error: ue } = await this.sb.auth.getUser();
    if (ue && isNetErr(ue)) { this._netDown = true; return false; }
    if (!u || !u.user) return false;
    const { data, error } = await this.sb.from('members').select('*').eq('user_id', u.user.id).maybeSingle();
    if (error && isNetErr(error)) { this._netDown = true; return false; }
    if (error || !data) return false;
    this.me = { id: data.user_id, name: data.name, isAdmin: data.is_admin, isDecider: !!(data.is_admin || data.is_decider), deciderFor: data.decider_for || [], phone: data.phone || '', role: data.role || 'full', lastSeen: Number(data.last_seen_activity) || 0 };
    this.sb.rpc('touch_opened').then(() => null, () => null); // "last opened", for the admin (needs update 14)
    return true;
  }

  async join(passcode, name) {
    let { data } = await this.sb.auth.getSession();
    if (!data.session) {
      const res = await this.sb.auth.signInAnonymously();
      if (res.error) throw new Error('Could not start a session. Ask the admin to switch on anonymous sign-ins in Supabase.');
    }
    const { data: ok, error } = await this.sb.rpc('join_family', { p_passcode: passcode, p_name: name });
    if (error) throw new Error(error.message);
    if (!ok) throw new Error('That passcode is not right. Check with the family and try again.');
    await this.loadMe();
  }

  async adminSignIn(email, password) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Email or password is not right.');
    if (!(await this.loadMe())) throw new Error('This account is not set up as a family member yet. Run the last step of setup.sql.');
  }

  async signOut() { await this.sb.auth.signOut(); this.me = null; }

  async loadAll() {
    const q = (t, f) => f(this.sb.from(t).select('*'));
    const order = { weddings: x => x.order('position'), activity: x => x.order('id', { ascending: false }).limit(500) };
    const tables = TABLES;
    const results = await Promise.all(tables.map(t => q(t, order[t] || (x => x))));
    tables.forEach((t, i) => {
      const r = results[i];
      if (r.error) {
        if (isNetErr(r.error)) { const e = new Error('offline'); e.offline = true; throw e; }
        if (OPTIONAL.includes(t)) { this.cache[t] = []; this.missing[t] = true; if (t === 'todos') this.todosMissing = true; return; }
        throw new Error(r.error.message);
      }
      this.cache[t] = r.data || [];
      if (t === 'edit_locks') this.cache[t].forEach(lockId);
    });
    this.reapplyOutbox();
    this.subscribe();
    setTimeout(() => this.flush(), 500);
    this.saveSnapshot();
  }

  subscribe() {
    if (this.channel) return;
    this.channel = this.sb.channel('family-plan')
      .on('postgres_changes', { event: '*', schema: 'public' }, (p) => {
        const t = p.table;
        if (!this.cache[t]) return;
        if (t === 'edit_locks') { lockId(p.new); lockId(p.old); }
        if (t === 'members' && p.new && this.me && p.new.user_id === this.me.id && p.new.role) this.me.role = p.new.role;
        const key = t === 'members' ? 'user_id' : 'id';
        const prev = p.new && p.new[key] != null ? (this.cache[t].find(r => r[key] === p.new[key]) || null) : null;
        const prevCopy = prev ? { ...prev } : null;
        if (p.eventType === 'DELETE') this.dropLocal(t, (p.old || {}).id || (p.old || {}).user_id);
        else this.upsertLocal(t, p.new);
        if (p.eventType !== 'DELETE') this._remoteRow({ type: p.eventType, table: t, row: p.new, prev: prevCopy });
        if (t === 'activity') this.cache.activity.sort((x, y) => y.id - x.id);
        this.emit({ table: t, remote: true });
        this.saveSnapshot();
      })
      .subscribe();
  }

  // Every change shows at once. If the internet is down it waits in an outbox on this phone
  // and is sent, in order, as soon as the connection is back — nothing typed offline is lost.
  async _send(op, revert) {
    let res;
    try { res = await this._exec(op); } catch (e) { res = { error: e }; }
    const err = res && res.error;
    if (!err) return;
    if (isNetErr(err)) { this.queueOp(op); return; }
    if (revert) { revert(); this.emit({ table: op.table }); }
    throw new Error(err.message || String(err));
  }
  _exec(op) {
    const q = this.sb.from(op.table);
    if (op.t === 'upsert') return q.upsert(op.rows, { onConflict: 'id', ignoreDuplicates: true }); // insert; a retried row that already arrived is skipped
    if (op.t === 'update') return q.update(op.patch).eq('id', op.id);
    if (op.t === 'updateIn') return q.update(op.patch).in('id', op.ids);
    if (op.t === 'delete') return q.delete().eq('id', op.id);
    return Promise.resolve({ error: { message: 'unknown change' } });
  }

  // Who else has the War Room open right now, and on which page (Supabase realtime presence).
  setRoom(room) {
    if (!this.me || !this.sb || this._room === room) return;
    this._room = room;
    if (!this.pchan) {
      this.presence = [];
      try {
        this.pchan = this.sb.channel('who-is-here', { config: { presence: { key: this.me.id } } });
        this.pchan.on('presence', { event: 'sync' }, () => {
          const st = this.pchan.presenceState() || {};
          this.presence = Object.entries(st).map(([k, metas]) => ({ id: k, ...((metas || [])[metas.length - 1] || {}) })).filter(p => p.id !== this.me.id && p.room);
          this.emit({ table: 'presence', remote: true });
        }).subscribe((status) => { if (status === 'SUBSCRIBED') this._track(); });
        document.addEventListener('visibilitychange', () => this._track());
      } catch (e) { this.pchan = null; }
    } else this._track();
  }
  _track() {
    if (!this.pchan) return;
    try { (document.hidden ? this.pchan.untrack() : this.pchan.track({ name: this.me.name, room: this._room, at: Date.now() })).catch(() => null); } catch (e) { /* ignore */ }
  }

  async lock(target, id, weddingId) {
    const row = lockId({ target_table: target, target_id: id, wedding_id: weddingId || null, created_by: this.me.id, created_at: nowIso() });
    const { error } = await this.sb.from('edit_locks').insert({ target_table: target, target_id: id, wedding_id: weddingId || null });
    if (error && !/duplicate/i.test(error.message)) throw new Error(/edit_locks/.test(error.message) ? 'Locks need database update 14' : error.message);
    this.upsertLocal('edit_locks', row); this.emit({ table: 'edit_locks' });
  }
  async unlock(target, id) {
    const { error } = await this.sb.from('edit_locks').delete().eq('target_table', target).eq('target_id', id);
    if (error) throw new Error(error.message);
    this.dropLocal('edit_locks', target + ':' + id); this.emit({ table: 'edit_locks' });
  }
  // Smart add's AI and link reader (the smart-add edge function). Not set up → the rules work alone.
  async smartAdd(body) {
    try {
      const { data, error } = await this.sb.functions.invoke('smart-add', { body });
      if (error) return { note: 'the AI isn’t set up yet, or didn’t answer' };
      return data;
    } catch (e) { return { note: isNetErr(e) ? 'offline' : 'the AI didn’t answer' }; }
  }
  async setRole(userId, role) {
    const { error } = await this.sb.rpc('set_role', { p_user: userId, p_role: role });
    if (error) throw new Error(/set_role/.test(error.message) ? 'Roles need database update 14' : error.message);
    this.upsertLocal('members', { user_id: userId, role }); this.emit({ table: 'members' });
  }

  async insert(table, row) {
    this.guard(table, row);
    const full = table === 'weddings' ? { ...row } : { id: uid(), created_at: nowIso(), created_by: this.me && this.me.id, ...row };
    this.upsertLocal(table, full); this.emit({ table });
    await this._send({ t: 'upsert', table, rows: [full] }, () => this.dropLocal(table, full.id));
    return full;
  }

  // Many new rows in one request (used when loading a ready-made checklist).
  async insertMany(table, rows) {
    if (rows.length) this.guard(table, rows[0]);
    const full = rows.map(row => ({ id: uid(), created_at: nowIso(), created_by: this.me && this.me.id, ...row }));
    for (const r of full) this.upsertLocal(table, r);
    this.emit({ table });
    for (let i = 0; i < full.length; i += 200) await this._send({ t: 'upsert', table, rows: full.slice(i, i + 200) }, () => { for (const r of full) this.dropLocal(table, r.id); });
    return full;
  }

  async update(table, id, patch) {
    const before = { ...this.find(table, id) };
    this.guard(table, before); this.guard(table, { ...before, ...patch });
    this.upsertLocal(table, { id, ...patch }); this.emit({ table });
    await this._send({ t: 'update', table, id, patch }, () => this.upsertLocal(table, before));
  }

  remove(table, id) { return this.update(table, id, { deleted_at: nowIso(), deleted_by: this.me && this.me.id }); }
  restore(table, id) { return this.update(table, id, { deleted_at: null, deleted_by: null }); }

  // Many rows at once (Clear all, Restore all). One timestamp keeps them grouped in the Bin.
  async patchMany(table, ids, patch) {
    if (!ids.length) return;
    for (const id of ids) this.guard(table, this.find(table, id));
    for (const id of ids) this.upsertLocal(table, { id, ...patch });
    this.emit({ table });
    for (let i = 0; i < ids.length; i += 150) await this._send({ t: 'updateIn', table, ids: ids.slice(i, i + 150), patch });
  }
  removeMany(table, ids, ts = nowIso()) { return this.patchMany(table, ids, { deleted_at: ts, deleted_by: this.me && this.me.id }); }
  restoreMany(table, ids) { return this.patchMany(table, ids, { deleted_at: null, deleted_by: null }); }

  async purge(table, id) {
    const row = this.find(table, id);
    this.guard(table, row);
    const { error } = await this.sb.from(table).delete().eq('id', id);
    if (error) throw new Error(error.message);
    this.dropLocal(table, id); this.dropChildren(table, id); this.emit({ table });
    const paths = row ? [row.path, row.thumb, row.data && row.data.path, row.data && row.data.thumb].filter(Boolean) : [];
    if (paths.length) await this.sb.storage.from('media').remove(paths);
  }

  // Automatic backups live in the photo storage under backups/ (members can read; only the admin can delete).
  async saveBackup(name, json) {
    const { error } = await this.sb.storage.from('media').upload('backups/' + name, new Blob([json], { type: 'application/json' }), { contentType: 'application/json', upsert: false });
    if (error) throw new Error(error.message);
  }
  async listBackups() {
    const { data, error } = await this.sb.storage.from('media').list('backups', { limit: 100, sortBy: { column: 'name', order: 'desc' } });
    if (error) throw new Error(error.message);
    return (data || []).filter(o => /\.json$/.test(o.name)).map(o => ({ name: o.name, path: 'backups/' + o.name, size: (o.metadata && o.metadata.size) || 0 }));
  }
  async removeBackups(paths) { if (paths.length) await this.sb.storage.from('media').remove(paths); }

  // Past changes for version history, straight from the database (the app only keeps the newest 500 in memory).
  async history({ entity, ids, weddingId }) {
    let q = this.sb.from('activity').select('*').eq('entity', entity);
    if (ids) q = q.in('entity_id', ids.map(String));
    if (weddingId) q = q.eq('wedding_id', weddingId);
    const { data, error } = await q.order('id', { ascending: false }).limit(1000);
    if (error) throw new Error(error.message);
    return data || [];
  }

  async addTemplate(weddingId) {
    const { error } = await this.sb.rpc('add_template', { p_wedding: weddingId });
    if (error) throw new Error(error.message.includes('add_template') ? 'Run database update 2 in Supabase first.' : error.message);
    const [s, a, st] = await Promise.all(['stages', 'areas', 'steps'].map(t => this.sb.from(t).select('*').eq('wedding_id', weddingId)));
    for (const [t, r] of [['stages', s], ['areas', a], ['steps', st]]) for (const row of (r.data || [])) this.upsertLocal(t, row);
    this.emit({ table: 'stages' });
  }

  async removeMember(userId) {
    const { error } = await this.sb.from('members').delete().eq('user_id', userId);
    if (error) throw new Error(error.message);
    this.dropLocal('members', userId); this.emit({ table: 'members' });
  }

  async del(table, id) {
    const before = this.find(table, id);
    this.guard(table, before);
    this.dropLocal(table, id); this.emit({ table });
    await this._send({ t: 'delete', table, id }, () => { if (before) this.upsertLocal(table, before); });
  }

  async downloadUrl(path, name) {
    const { data, error } = await this.sb.storage.from('media').createSignedUrl(path, 60 * 10, { download: name || true });
    if (error) throw new Error('Could not prepare the download. Try again.');
    return data.signedUrl;
  }

  async setDeciderFor(userId, weddingIds) {
    const { error } = await this.sb.rpc('set_decider_for', { p_user: userId, p_weddings: weddingIds });
    if (error) throw new Error(/set_decider_for/.test(error.message) ? 'Run database update 10 in Supabase first.' : error.message);
    this.upsertLocal('members', { user_id: userId, decider_for: weddingIds, is_decider: weddingIds.length > 0 }); this.emit({ table: 'members' });
  }
  async setDecider(userId, on) {
    const { error } = await this.sb.rpc('set_decider', { p_user: userId, p_on: on });
    if (error) throw new Error(/set_decider/.test(error.message) ? 'Run database update 8 in Supabase first.' : error.message);
    this.upsertLocal('members', { user_id: userId, is_decider: on }); this.emit({ table: 'members' });
  }

  async setPasscode(p) {
    const { error } = await this.sb.rpc('set_passcode', { p_passcode: p });
    if (error) throw new Error(error.message);
  }

  async markSeen(activityId) {
    if (!this.me || activityId <= this.me.lastSeen) return;
    this.me.lastSeen = activityId;
    await this.sb.from('members').update({ last_seen_activity: activityId }).eq('user_id', this.me.id);
  }

  async rename(name) {
    await this.sb.from('members').update({ name }).eq('user_id', this.me.id);
    this.me.name = name; this.upsertLocal('members', { user_id: this.me.id, name }); this.emit({ table: 'members' });
  }
  async setPhone(phone) {
    const { error } = await this.sb.from('members').update({ phone }).eq('user_id', this.me.id);
    if (error) throw new Error(/phone/.test(error.message) ? 'Saving a number needs database update 11.' : error.message);
    this.me.phone = phone; this.upsertLocal('members', { user_id: this.me.id, phone }); this.emit({ table: 'members' });
  }

  async uploadBlob(blob, ext) {
    const path = `${new Date().getFullYear()}/${uid()}.${ext}`;
    const { error } = await this.sb.storage.from('media').upload(path, blob, { contentType: blob.type || undefined, upsert: false });
    if (error) throw new Error(error.message.includes('exceeded') ? 'That file is too big. The limit is 50 MB — for long videos, paste a YouTube or Google Drive link instead.' : error.message);
    return path;
  }

  async uploadPhotoPair(full, small, ext = 'jpg') {
    const base = `${new Date().getFullYear()}/${uid()}~t`;
    const up = (name, blob) => this.sb.storage.from('media').upload(name, blob, { contentType: blob.type || undefined, upsert: false });
    const { error } = await up(`${base}.${ext}`, full);
    if (error) throw new Error(error.message.includes('exceeded') ? 'That file is too big. The limit is 50 MB.' : error.message);
    if (small) await up(`${base}.small.jpg`, small).catch(() => null); // if the small copy fails, the full one is used everywhere
    return `${base}.${ext}`;
  }

  // size 'small' gives the small copy when the photo has one (photos uploaded since v44), otherwise the full picture.
  async url(path, size) {
    if (!path) return '';
    if (/^assets\//.test(path)) return path; // pictures that ship with the site (samples)
    if (size === 'small' && /~t\.\w+$/.test(path)) { const u = await this.url(path.replace(/~t\.\w+$/, '~t.small.jpg')); if (u) return u; }
    const hit = this.urlCache.get(path);
    if (hit && hit.until > Date.now()) return hit.url;
    const { data, error } = await this.sb.storage.from('media').createSignedUrl(path, 60 * 60 * 6);
    if (error) return '';
    this.urlCache.set(path, { url: data.signedUrl, until: Date.now() + 1000 * 60 * 60 * 5 });
    return data.signedUrl;
  }
}

// Saving status ("Saved", "Saving…", "Offline") and a saved copy for instant loading.
for (const m of ['insert', 'update', 'patchMany', 'del', 'purge']) {
  const f = LiveStore.prototype[m];
  LiveStore.prototype[m] = async function (...a) {
    this.pending = (this.pending || 0) + 1; syncStatus(this);
    try { return await f.apply(this, a); } finally { this.pending--; syncStatus(this); this.saveSnapshot(); }
  };
}
/* ---------- The outbox: changes made without internet ---------- */
const OUTBOX = 'fwp-outbox-v1';
const isNetErr = (e) => !navigator.onLine || /failed to fetch|networkerror|load failed|fetch failed|network request failed|timed? ?out/i.test(String((e && (e.message || e)) || ''));
LiveStore.prototype.loadOutbox = function () { try { this.outbox = JSON.parse(localStorage.getItem(OUTBOX) || '[]'); } catch (e) { this.outbox = []; } return this.outbox; };
LiveStore.prototype.saveOutbox = function () { try { localStorage.setItem(OUTBOX, JSON.stringify(this.outbox || [])); } catch (e) { /* storage full: keeps working in memory */ } syncStatus(this); };
LiveStore.prototype.queueOp = function (op) {
  (this.outbox || this.loadOutbox()).push({ ...op, at: nowIso(), by: this.me && this.me.name });
  this.saveOutbox();
  clearTimeout(this._flushT); this._flushT = setTimeout(() => this.flush(), 15000);
};
// After loading fresh data, put back what's still waiting, so the screen keeps showing it.
LiveStore.prototype.reapplyOutbox = function () {
  for (const op of this.outbox || this.loadOutbox()) {
    if (!this.cache[op.table]) continue;
    if (op.t === 'upsert') op.rows.forEach(r => this.upsertLocal(op.table, r));
    else if (op.t === 'update') this.upsertLocal(op.table, { id: op.id, ...op.patch });
    else if (op.t === 'updateIn') op.ids.forEach(id => this.upsertLocal(op.table, { id, ...op.patch }));
    else if (op.t === 'delete') this.dropLocal(op.table, op.id);
  }
};
LiveStore.prototype.flush = async function () {
  if (this._flushing || !(this.outbox || this.loadOutbox()).length || !navigator.onLine) return;
  this._flushing = true;
  try {
    while (this.outbox.length) {
      const op = this.outbox[0];
      let res; try { res = await this._exec(op); } catch (e) { res = { error: e }; }
      if (res && res.error) {
        if (isNetErr(res.error)) break; // still offline — try again later
        (this.failed || (this.failed = [])).push({ ...op, error: res.error.message || String(res.error) }); // refused by the database: set aside, don't block the rest
      }
      this.outbox.shift(); this.saveOutbox();
    }
  } finally { this._flushing = false; }
  if (this.outbox.length) { clearTimeout(this._flushT); this._flushT = setTimeout(() => this.flush(), 20000); }
  else this.emit({ table: 'outbox' });
};
window.addEventListener('online', () => { if (store && store.flush) setTimeout(() => store.flush(), 800); });
// What's waiting, in words.
export function outboxItems(st = store) {
  const label = (t) => ({ steps: 'Step', todos: 'To-do', board_items: 'Card / option', list_rows: 'List row', lists: 'List', comments: 'Comment', reactions: 'Vote', budget_items: 'Payment', budget_areas: 'Budget line', files: 'File', areas: 'Section', stages: 'Stage' }[t] || t);
  const what = (op) => { const r = op.rows && op.rows[0]; const d = (r && (r.data || {})) || {}; const name = (r && (r.title || r.body || r.name || d.title || d.text || (r.cells || []).filter(Boolean)[0])) || (op.patch && (op.patch.title || (op.patch.data && op.patch.data.title))) || ''; return String(name).slice(0, 60); };
  return ((st && st.outbox) || []).map(op => ({ kind: label(op.table), action: op.t === 'upsert' ? 'added' : op.t === 'delete' ? 'deleted' : (op.patch && 'deleted_at' in op.patch && op.patch.deleted_at) ? 'moved to the Bin' : 'changed', name: what(op), at: op.at }));
}
const SNAP = 'fwp-live-copy-v1';
LiveStore.prototype.saveSnapshot = function () {
  clearTimeout(this._snapT);
  this._snapT = setTimeout(() => {
    try {
      const cache = { ...this.cache, activity: (this.cache.activity || []).slice(0, 200) };
      localStorage.setItem(SNAP, JSON.stringify({ user: this.me && this.me.id, me: this.me, at: Date.now(), cache, missing: this.missing }));
    } catch (e) { /* too big or blocked — fine, it just loads normally */ }
  }, 1500);
};
LiveStore.prototype.hydrate = function () {
  try {
    const s = JSON.parse(localStorage.getItem(SNAP) || 'null');
    if (!s || !this.me || s.user !== this.me.id) return false;
    this.cache = { ...this.cache, ...s.cache }; this.missing = s.missing || {};
    this.reapplyOutbox();
    return true;
  } catch (e) { return false; }
};
const statusFns = new Set();
export const onStatus = (fn) => { statusFns.add(fn); return () => statusFns.delete(fn); };
export function syncState(st = store) { return !navigator.onLine ? 'offline' : (st && st.outbox && st.outbox.length) ? 'waiting' : (st && st.pending) ? 'saving' : 'saved'; }
function syncStatus(st) { const v = syncState(st); for (const fn of statusFns) fn(v); }
window.addEventListener('online', () => syncStatus(store));
window.addEventListener('offline', () => syncStatus(store));

/* ------------------------------------------------------------------ */
/*  Demo: sample data kept in this browser                             */
/* ------------------------------------------------------------------ */
const DEMO_KEY = 'fwp-demo-v7';
const GATES = ['Fix the wedding date and church', 'Book the reception venue for the date', 'Pay the advance', 'Finalise the menu', 'Finalise the guest list', 'Print the invitation cards', 'Buy the gifts'];
const TEMPLATE = [
  ['Before', [
    ['Dates & booking', ['Fix the wedding date and church', 'Book the reception venue for the date']],
    ['Venue & location', ['Shortlist venues', 'Visit and compare', 'Pay the advance']],
    ['Food & menus', ['Shortlist caterers and compare rates', 'Food tasting', 'Finalise the menu', 'Confirm the head count']],
    ['Invitation list', ['Collect names from both families', 'Finalise the guest list', 'Print the invitation cards', 'Send the invitations']],
    ['Gift preparation', ['Decide gifts for guests and relatives', 'Buy the gifts', 'Pack and label the gifts']]
  ]],
  ['During', [
    ['The wedding day', ['Write the day-of schedule', 'Receive guests at the church', 'Food service at the reception', 'Photography and video']],
    ['Guests & transport', ['Arrange transport for guests', 'Seating and welcome']]
  ]],
  ['After', [
    ['Payments & returns', ['Settle vendor payments', 'Return rented items']],
    ['Thank-yous', ['Thank-you calls and messages', 'Collect photos from everyone']],
    ['Final accounts', ['Write up what was spent']]
  ]]
];

function demoSeed() {
  const c = Object.fromEntries(TABLES.map(t => [t, []]));
  c.weddings = [
    { id: 'charani', couple: 'Charani & Adahrii', monogram: 'C&A', wedding_date: '2026-12-07', date_note: '', theme: 'blue', theme_custom: {}, position: 1 },
    { id: 'elow', couple: 'Elow & Maniziia', monogram: 'E&M', wedding_date: null, date_note: 'February – March 2027', theme: 'rose', theme_custom: {}, position: 2 }
  ];
  c.members = [{ user_id: 'demo-admin', name: 'You', is_admin: true, last_seen_activity: 0 }, { user_id: 'demo-aunty', name: 'Example relative', is_admin: false, is_decider: false, last_seen_activity: 0 }, { user_id: 'demo-charani', name: 'Charani', is_admin: false, is_decider: true, decider_for: ['charani'], last_seen_activity: 0 }, { user_id: 'demo-elow', name: 'Elow', is_admin: false, is_decider: true, decider_for: ['elow'], last_seen_activity: 0 }];
  c.todos = [
    { id: uid(), wedding_id: 'charani', title: 'Example: call the florist about boutonniere samples', owner: '', due: null, status: 'todo', notes: '', position: 1000, created_at: nowIso(), deleted_at: null },
    { id: uid(), wedding_id: 'charani', title: 'Example: pick up the invitation proofs', owner: '', due: null, status: 'todo', notes: '', position: 2000, created_at: nowIso(), deleted_at: null },
    { id: uid(), wedding_id: 'elow', title: 'Example: ask for a custard sample tray', owner: '', due: null, status: 'todo', notes: '', position: 1000, created_at: nowIso(), deleted_at: null }
  ];
  for (const w of ['charani', 'elow']) {
    TEMPLATE.forEach(([stage, areas], si) => {
      const s = { id: uid(), wedding_id: w, title: stage, position: (si + 1) * 1000, created_at: nowIso(), deleted_at: null };
      c.stages.push(s);
      areas.forEach(([area, steps], ai) => {
        const a = { id: uid(), wedding_id: w, stage_id: s.id, title: area, position: (ai + 1) * 1000, created_at: nowIso(), deleted_at: null };
        c.areas.push(a);
        steps.forEach((t, ti) => c.steps.push({ id: uid(), wedding_id: w, area_id: a.id, title: t, notes: '', owner: '', due: null, status: 'todo', position: (ti + 1) * 1000, created_at: nowIso(), deleted_at: null, gate: GATES.includes(t), locked_at: null, lock_note: {} }));
      });
    });
  }
  // Sample options to swipe: photographers for Charani, cakes for Elow.
  const photoStep = c.steps.find(s => s.wedding_id === 'charani' && s.title === 'Photography and video');
  const cakeStep = c.steps.find(s => s.wedding_id === 'elow' && /cake/i.test(s.title)) || c.steps.find(s => s.wedding_id === 'elow' && s.title === 'Finalise the menu');
  if (photoStep) photoStep.gate = true;
  // Sample options with pictures, so swiping and comparing can be tried straight away.
  for (const w of c.weddings) c.board_items.push(...sampleRows(w.id, c.steps.filter(st => st.wedding_id === w.id), { uid, now: nowIso, by: w.id === 'elow' ? 'demo-elow' : 'demo-charani' }));
  if (cakeStep) cakeStep.gate = true;
  const guestStep = c.steps.find(s => s.wedding_id === 'charani' && s.title === 'Finalise the guest list');
  const gl = { id: uid(), wedding_id: 'charani', step_id: guestStep && guestStep.id, title: 'Example guest list', columns: ['Name', 'Side', 'Phone', 'Count', 'Notes'], created_at: nowIso(), deleted_at: null };
  c.lists.push(gl);
  [['Example: Uncle and family', 'Bride', '', '4', ''], ['Example: Church choir', 'Both', '', '12', 'Confirm with pastor']].forEach((cells, i) => c.list_rows.push({ id: uid(), list_id: gl.id, wedding_id: 'charani', cells, position: (i + 1) * 1000 }));
  c.board_items.push(
    { id: uid(), wedding_id: 'charani', kind: 'palette', x: 40, y: 60, w: 280, z: 1, deleted_at: null, data: { title: 'Colour palette', colors: [{ name: 'Cream White', hex: '#F9F7F2' }, { name: 'Dusty Blue', hex: '#AFBEC8' }, { name: 'French Blue', hex: '#637F99' }, { name: 'Warm Beige', hex: '#DCC9B6' }] } },
    { id: uid(), wedding_id: 'charani', kind: 'label', x: 380, y: 40, w: 300, z: 1, deleted_at: null, data: { text: 'Boutonnieres' } },
    { id: 'demo-compare', wedding_id: 'charani', kind: 'compare', x: 380, y: 90, w: 520, z: 2, deleted_at: null, data: { title: 'Boutonnieres for the groom’s side', options: [{ oid: 'o-a', title: 'Dried hydrangea', rate: '', contact: '', chosen: true }, { oid: 'o-b', title: 'Foam roses with tags', rate: '', contact: '', chosen: false }] } },
    { id: uid(), wedding_id: 'charani', kind: 'note', x: 960, y: 70, w: 220, z: 3, deleted_at: null, data: { text: 'Example note: pick one flower-girl style so all the girls match?', tint: 'blue' } },
    { id: uid(), wedding_id: 'charani', kind: 'contact', x: 40, y: 330, w: 260, z: 1, deleted_at: null, data: { title: 'Example florist', phone: '', role: 'Dried and foam boutonnieres', notes: '' } },
    { id: uid(), wedding_id: 'elow', kind: 'palette', x: 40, y: 60, w: 340, z: 1, deleted_at: null, data: { title: 'Chateau Rose palette', colors: [{ name: 'Dusty Rose', hex: '#D9A9A0' }, { name: 'Vintage Mauve', hex: '#9E7280' }, { name: 'English Rose', hex: '#E3B7AE' }, { name: 'Champagne', hex: '#EFE3D3' }, { name: 'Rose Gold', hex: '#C9967F' }] } },
    { id: uid(), wedding_id: 'elow', kind: 'compare', x: 420, y: 60, w: 480, z: 2, deleted_at: null, data: { title: 'Custard cups', options: [{ title: 'Option A', rate: '', contact: '', chosen: false }, { title: 'Option B', rate: '', contact: '', chosen: false }] } },
    { id: uid(), wedding_id: 'elow', kind: 'link', x: 960, y: 60, w: 260, z: 1, deleted_at: null, data: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Example video link' } }
  );
  // Example comments, reactions and votes
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
  c.comments.push(
    { id: uid(), wedding_id: 'charani', item_id: 'demo-compare', kind: 'comment', body: 'Example: the dried hydrangea matches the invitation colours really well.', title: 'Example comment', author_name: 'Example relative', created_by: 'demo-aunty', created_at: ago(300), deleted_at: null },
    { id: uid(), wedding_id: 'charani', item_id: 'demo-compare', kind: 'suggestion', body: 'Example: could we ask the florist for one sample of each before deciding?', title: 'Example suggestion', author_name: 'Example relative', created_by: 'demo-aunty', created_at: ago(20), deleted_at: null });
  c.reactions.push(
    { id: uid(), wedding_id: 'charani', item_id: 'demo-compare', target: 'card', value: '❤️', user_name: 'Example relative', created_by: 'demo-aunty', created_at: ago(30) },
    { id: uid(), wedding_id: 'charani', item_id: 'demo-compare', target: 'o-a', value: 'up', user_name: 'Example relative', created_by: 'demo-aunty', created_at: ago(30) });

  // Example budgets (made-up numbers, just to show how it works)
  const B = (id, wid, title, total, contingency, pos) => c.budgets.push({ id, wedding_id: wid, title, total, contingency, position: pos, created_at: nowIso(), deleted_at: null });
  const A = (bid, wid, title, planned, pos) => { const a = { id: uid(), budget_id: bid, wedding_id: wid, title, planned, position: pos, created_at: nowIso(), deleted_at: null }; c.budget_areas.push(a); return a.id; };
  const I = (bid, wid, area, title, amount, due, paid, payee = '') => c.budget_items.push({ id: uid(), budget_id: bid, area_id: area, wedding_id: wid, step_id: null, title, payee, amount, due, paid_at: paid ? nowIso() : null, refund_expected: false, notes: '', position: 0, created_at: nowIso(), deleted_at: null });
  B('elow', 'elow', 'Elow & Maniziia', 1500000, 100000, 2);
  const cat = A('elow', 'elow', 'Example: Catering', 450000, 1000), ven = A('elow', 'elow', 'Example: Venue', 300000, 2000), dec = A('elow', 'elow', 'Example: Décor & flowers', 150000, 3000), inv = A('elow', 'elow', 'Example: Invitations', 50000, 4000);
  I('elow', 'elow', ven, 'Example: Venue advance', 100000, '2026-10-05', true, 'Example hall');
  I('elow', 'elow', ven, 'Example: Venue balance', 200000, '2027-01-20', false, 'Example hall');
  I('elow', 'elow', cat, 'Example: Caterer advance', 90000, '2026-11-10', false, 'Example caterer');
  I('elow', 'elow', inv, 'Example: Invitation printing', 62000, '2026-12-01', false);
  I('elow', 'elow', null, 'Example: Extra chairs (unplanned)', 15000, '2026-12-15', false);
  void dec;
  B('charani', 'charani', 'Charani & Adahrii', 400000, 30000, 1);
  const gif = A('charani', 'charani', 'Example: Gifts for Charani', 150000, 1000), drs = A('charani', 'charani', 'Example: Dress stitching', 80000, 2000);
  I('charani', 'charani', drs, 'Example: Tailor advance', 20000, '2026-10-12', true, 'Example tailor');
  I('charani', 'charani', gif, 'Example: Gold set', 120000, '2026-11-20', false);
  B('shared', null, 'Shared home costs', 300000, 0, 3);
  const pnt = A('shared', null, 'Example: House painting', 120000, 1000), cur = A('shared', null, 'Example: Curtains & mattresses', 60000, 2000);
  I('shared', null, pnt, 'Example: Painter', 110000, '2026-11-05', false, 'Example painter');
  I('shared', null, cur, 'Example: Mattresses', 45000, '2026-11-25', false);
  return c;
}

class DemoStore extends BaseStore {
  constructor() {
    super();
    this.mode = 'demo';
    this.blobs = new Map();
    this.nextAct = 1;
  }
  save() {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify({ cache: this.cache, nextAct: this.nextAct })); } catch (e) { /* storage may be full or blocked */ }
  }
  async init() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch (e) { saved = null; }
    if (saved && saved.cache) { this.cache = { ...this.cache, ...saved.cache }; for (const t of TABLES) if (!this.cache[t]) this.cache[t] = []; this.nextAct = saved.nextAct || 1; }
    else { this.cache = demoSeed(); this.save(); }
    const m = this.cache.members[0];
    this.me = { id: m.user_id, name: m.name, phone: m.phone || '', isAdmin: true, isDecider: true, role: 'full', lastSeen: Number(m.last_seen_activity) || 0 };
    m.last_opened = nowIso(); this.save();
    return 'ready';
  }
  async join() { }
  async adminSignIn() { }
  async signOut() { }
  async loadAll() { }
  resetDemo() { try { localStorage.removeItem(DEMO_KEY); } catch (e) { } location.reload(); }

  log(action, table, before, after) {
    const changes = {};
    if (action === 'update') {
      for (const k of Object.keys(after)) {
        if (['position', 'x', 'y', 'w', 'z', 'deleted_by', 'created_at', 'created_by'].includes(k)) continue;
        if (k === 'data') {
          const keys = new Set([...Object.keys(before.data || {}), ...Object.keys(after.data || {})]);
          for (const ik of keys) if (JSON.stringify((before.data || {})[ik]) !== JSON.stringify((after.data || {})[ik])) changes[ik] = { old: (before.data || {})[ik] ?? null, new: (after.data || {})[ik] ?? null };
        } else if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changes[k] = { old: before[k] ?? null, new: after[k] ?? null };
      }
      if (!Object.keys(changes).length) return;
    }
    if (action === 'purge' && before) changes._old = before;               // so a deleted row can be brought back
    if (action === 'create' && after && after.list_id) changes._new = { list_id: after.list_id };
    const r = after || before;
    const label = r.title || r.couple || (r.data && (r.data.title || r.data.text)) || null;
    this.cache.activity.unshift({
      id: this.nextAct++, wedding_id: r.wedding_id || (table === 'weddings' ? r.id : null),
      actor: this.me.id, actor_name: this.me.name, action, entity: table, entity_id: r.id,
      label: label ? String(label).slice(0, 140) : null, changes, created_at: nowIso()
    });
  }

  setRoom() { this.presence = this.presence || []; }
  async smartAdd() { return null; }
  async lock(target, id, weddingId) { if (!this.isLocked(target, id)) this.cache.edit_locks.push({ id: target + ':' + id, target_table: target, target_id: id, wedding_id: weddingId || null, created_by: this.me.id, created_at: nowIso() }); this.save(); this.emit({ table: 'edit_locks' }); }
  async unlock(target, id) { this.dropLocal('edit_locks', target + ':' + id); this.save(); this.emit({ table: 'edit_locks' }); }
  async setRole(userId, role) { this.upsertLocal('members', { user_id: userId, role }); this.save(); this.emit({ table: 'members' }); }
  async insert(table, row) {
    this.guard(table, row);
    const full = { id: uid(), created_at: nowIso(), created_by: this.me.id, deleted_at: null, ...row };
    this.cache[table].push(full); if (!UNLOGGED.includes(table)) this.log('create', table, null, full);
    this.save(); this.emit({ table }); return full;
  }
  async insertMany(table, rows) {
    if (rows.length) this.guard(table, rows[0]);
    const full = rows.map(row => ({ id: uid(), created_at: nowIso(), created_by: this.me.id, deleted_at: null, ...row }));
    this.cache[table].push(...full);
    this.save(); this.emit({ table }); return full;
  }
  async update(table, id, patch) {
    const before = { ...this.find(table, id) };
    const after = { ...before, ...patch };
    this.guard(table, before); this.guard(table, after);
    if (table === 'steps' && before.locked_at && !after.locked_at && !this.me.isAdmin) throw new Error('Only the admin can unlock this');
    if (table === 'steps' && !before.locked_at && after.locked_at) after.locked_by = this.me.id;
    let action = 'update';
    if (!before.deleted_at && after.deleted_at) action = 'remove';
    else if (before.deleted_at && !after.deleted_at) action = 'restore';
    this.upsertLocal(table, after); if (!UNLOGGED.includes(table)) this.log(action, table, before, after);
    this.save(); this.emit({ table });
  }
  remove(table, id) { return this.update(table, id, { deleted_at: nowIso(), deleted_by: this.me.id }); }
  restore(table, id) { return this.update(table, id, { deleted_at: null, deleted_by: null }); }
  async patchMany(table, ids, patch) {
    for (const id of ids) this.guard(table, this.find(table, id));
    for (const id of ids) {
      const before = { ...this.find(table, id) }; const after = { ...before, ...patch };
      this.upsertLocal(table, after);
      this.log(!before.deleted_at && after.deleted_at ? 'remove' : before.deleted_at && !after.deleted_at ? 'restore' : 'update', table, before, after);
    }
    this.save(); this.emit({ table });
  }
  removeMany(table, ids, ts = nowIso()) { return this.patchMany(table, ids, { deleted_at: ts, deleted_by: this.me.id }); }
  restoreMany(table, ids) { return this.patchMany(table, ids, { deleted_at: null, deleted_by: null }); }
  async purge(table, id) {
    const row = this.find(table, id);
    this.guard(table, row);
    this.dropChildren(table, id);
    this.dropLocal(table, id); this.log('purge', table, row, null);
    this.save(); this.emit({ table });
  }
  async setPasscode() { }
  async setDecider(userId, on) { this.upsertLocal('members', { user_id: userId, is_decider: on }); this.save(); this.emit({ table: 'members' }); }
  async setDeciderFor(userId, weddingIds) { this.upsertLocal('members', { user_id: userId, decider_for: weddingIds, is_decider: weddingIds.length > 0 }); this.save(); this.emit({ table: 'members' }); }
  async addTemplate(weddingId) {
    TEMPLATE.forEach(([stage, areas], si) => {
      const s = { id: uid(), wedding_id: weddingId, title: stage, position: (si + 1) * 1000, created_at: nowIso(), deleted_at: null };
      this.cache.stages.push(s);
      areas.forEach(([area, steps], ai) => {
        const a = { id: uid(), wedding_id: weddingId, stage_id: s.id, title: area, position: (ai + 1) * 1000, created_at: nowIso(), deleted_at: null };
        this.cache.areas.push(a);
        steps.forEach((t, ti) => this.cache.steps.push({ id: uid(), wedding_id: weddingId, area_id: a.id, title: t, notes: '', owner: '', due: null, status: 'todo', position: (ti + 1) * 1000, created_at: nowIso(), deleted_at: null }));
      });
    });
    this.save(); this.emit({ table: 'stages' });
  }
  async removeMember(userId) { this.dropLocal('members', userId); this.save(); this.emit({ table: 'members' }); }
  async del(table, id) { const before = this.find(table, id); this.guard(table, before); this.dropLocal(table, id); if (before && !UNLOGGED.includes(table)) this.log('purge', table, before, null); this.save(); this.emit({ table }); }
  async saveBackup(name, json) { this.blobs.set('backups/' + name, URL.createObjectURL(new Blob([json], { type: 'application/json' }))); this._bsize = { ...(this._bsize || {}), ['backups/' + name]: json.length }; }
  async listBackups() { return [...this.blobs.keys()].filter(k => k.startsWith('backups/')).sort().reverse().map(p => ({ name: p.slice(8), path: p, size: (this._bsize || {})[p] || 0 })); }
  async removeBackups(paths) { for (const p of paths) this.blobs.delete(p); }
  async history({ entity, ids, weddingId }) { return (this.cache.activity || []).filter(a => a.entity === entity && (!ids || ids.includes(a.entity_id)) && (!weddingId || a.wedding_id === weddingId)); }
  async downloadUrl(path) { return this.blobs.get(path) || ''; }
  async markSeen(activityId) {
    if (activityId <= this.me.lastSeen) return;
    this.me.lastSeen = activityId; this.cache.members[0].last_seen_activity = activityId; this.save();
  }
  async rename(name) { this.me.name = name; this.cache.members[0].name = name; this.save(); this.emit({ table: 'members' }); }
  async setPhone(phone) { this.me.phone = phone; this.cache.members[0].phone = phone; this.save(); this.emit({ table: 'members' }); }
  // Pretend someone else changed a row (tests and the notification preview).
  simulateRemote(table, row, type = 'INSERT') { const key = table === 'members' ? 'user_id' : 'id'; const prev = this.cache[table].find(r => r[key] === row[key]); const prevCopy = prev ? { ...prev } : null; this.upsertLocal(table, row); this.save(); this._remoteRow({ type, table, row, prev: prevCopy }); this.emit({ table, remote: true }); }
  async uploadBlob(blob, ext) {
    const path = `demo/${uid()}.${ext}`;
    this.blobs.set(path, URL.createObjectURL(blob));
    return path;
  }
  async uploadPhotoPair(full, small, ext = 'jpg') {
    const base = `demo/${uid()}~t`;
    this.blobs.set(`${base}.${ext}`, URL.createObjectURL(full));
    if (small) this.blobs.set(`${base}.small.jpg`, URL.createObjectURL(small));
    return `${base}.${ext}`;
  }
  async url(path, size) {
    if (/^assets\//.test(path || '')) return path;
    if (size === 'small' && /~t\.\w+$/.test(path || '')) { const u = this.blobs.get(path.replace(/~t\.\w+$/, '~t.small.jpg')); if (u) return u; }
    return this.blobs.get(path) || '';
  }
}

export const store = MODE === 'demo' ? new DemoStore() : new LiveStore();
export { uid, nowIso };
