// The data layer. Two interchangeable backends:
//  - LiveStore talks to Supabase (the real, shared family site)
//  - DemoStore keeps sample data in this browser only (for previews)
import { SUPABASE_URL, SUPABASE_KEY, MODE } from './config.js';

export const TABLES = ['weddings', 'stages', 'areas', 'steps', 'todos', 'board_items', 'files', 'lists', 'list_rows', 'activity', 'members'];
const OPTIONAL = ['todos', 'files', 'lists', 'list_rows'];  // tables added by later database updates
const UNLOGGED = ['list_rows'];


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
  emit(info) { for (const fn of this.listeners) { try { fn(info); } catch (e) { console.error(e); } } }
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
    if (table === 'weddings') for (const t of ['stages', 'areas', 'steps', 'todos', 'board_items', 'files', 'lists', 'list_rows']) kill(t, r => r.wedding_id === id);
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
    return (await this.loadMe()) ? 'ready' : 'needs-join';
  }

  async loadMe() {
    const { data: u } = await this.sb.auth.getUser();
    if (!u || !u.user) return false;
    const { data, error } = await this.sb.from('members').select('*').eq('user_id', u.user.id).maybeSingle();
    if (error || !data) return false;
    this.me = { id: data.user_id, name: data.name, isAdmin: data.is_admin, lastSeen: Number(data.last_seen_activity) || 0 };
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
        if (OPTIONAL.includes(t)) { this.cache[t] = []; this.missing[t] = true; if (t === 'todos') this.todosMissing = true; return; }
        throw new Error(r.error.message);
      }
      this.cache[t] = r.data || [];
    });
    this.subscribe();
  }

  subscribe() {
    if (this.channel) return;
    this.channel = this.sb.channel('family-plan')
      .on('postgres_changes', { event: '*', schema: 'public' }, (p) => {
        const t = p.table;
        if (!this.cache[t]) return;
        if (p.eventType === 'DELETE') this.dropLocal(t, (p.old || {}).id || (p.old || {}).user_id);
        else this.upsertLocal(t, p.new);
        if (t === 'activity') this.cache.activity.sort((x, y) => y.id - x.id);
        this.emit({ table: t, remote: true });
      })
      .subscribe();
  }

  async insert(table, row) {
    const full = table === 'weddings' ? { ...row } : { id: uid(), created_at: nowIso(), created_by: this.me && this.me.id, ...row };
    this.upsertLocal(table, full); this.emit({ table });
    const { error } = await this.sb.from(table).insert(full);
    if (error) { this.dropLocal(table, full.id); this.emit({ table }); throw new Error(error.message); }
    return full;
  }

  async update(table, id, patch) {
    const before = { ...this.find(table, id) };
    this.upsertLocal(table, { id, ...patch }); this.emit({ table });
    const { error } = await this.sb.from(table).update(patch).eq('id', id);
    if (error) { this.upsertLocal(table, before); this.emit({ table }); throw new Error(error.message); }
  }

  remove(table, id) { return this.update(table, id, { deleted_at: nowIso(), deleted_by: this.me && this.me.id }); }
  restore(table, id) { return this.update(table, id, { deleted_at: null, deleted_by: null }); }

  async purge(table, id) {
    const row = this.find(table, id);
    const { error } = await this.sb.from(table).delete().eq('id', id);
    if (error) throw new Error(error.message);
    this.dropLocal(table, id); this.dropChildren(table, id); this.emit({ table });
    const paths = row ? [row.path, row.thumb, row.data && row.data.path, row.data && row.data.thumb].filter(Boolean) : [];
    if (paths.length) await this.sb.storage.from('media').remove(paths);
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
    this.dropLocal(table, id); this.emit({ table });
    const { error } = await this.sb.from(table).delete().eq('id', id);
    if (error) { if (before) this.upsertLocal(table, before); this.emit({ table }); throw new Error(error.message); }
  }

  async downloadUrl(path, name) {
    const { data, error } = await this.sb.storage.from('media').createSignedUrl(path, 60 * 10, { download: name || true });
    if (error) throw new Error('Could not prepare the download. Try again.');
    return data.signedUrl;
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

  async uploadBlob(blob, ext) {
    const path = `${new Date().getFullYear()}/${uid()}.${ext}`;
    const { error } = await this.sb.storage.from('media').upload(path, blob, { contentType: blob.type || undefined, upsert: false });
    if (error) throw new Error(error.message.includes('exceeded') ? 'That file is too big. The limit is 50 MB — for long videos, paste a YouTube or Google Drive link instead.' : error.message);
    return path;
  }

  async url(path) {
    if (!path) return '';
    const hit = this.urlCache.get(path);
    if (hit && hit.until > Date.now()) return hit.url;
    const { data, error } = await this.sb.storage.from('media').createSignedUrl(path, 60 * 60 * 6);
    if (error) return '';
    this.urlCache.set(path, { url: data.signedUrl, until: Date.now() + 1000 * 60 * 60 * 5 });
    return data.signedUrl;
  }
}

/* ------------------------------------------------------------------ */
/*  Demo: sample data kept in this browser                             */
/* ------------------------------------------------------------------ */
const DEMO_KEY = 'fwp-demo-v2';
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
  c.members = [{ user_id: 'demo-admin', name: 'You', is_admin: true, last_seen_activity: 0 }, { user_id: 'demo-aunty', name: 'Example relative', is_admin: false, last_seen_activity: 0 }];
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
  const guestStep = c.steps.find(s => s.wedding_id === 'charani' && s.title === 'Finalise the guest list');
  const gl = { id: uid(), wedding_id: 'charani', step_id: guestStep && guestStep.id, title: 'Example guest list', columns: ['Name', 'Side', 'Phone', 'Count', 'Notes'], created_at: nowIso(), deleted_at: null };
  c.lists.push(gl);
  [['Example: Uncle and family', 'Bride', '', '4', ''], ['Example: Church choir', 'Both', '', '12', 'Confirm with pastor']].forEach((cells, i) => c.list_rows.push({ id: uid(), list_id: gl.id, wedding_id: 'charani', cells, position: (i + 1) * 1000 }));
  c.board_items.push(
    { id: uid(), wedding_id: 'charani', kind: 'palette', x: 40, y: 60, w: 280, z: 1, deleted_at: null, data: { title: 'Colour palette', colors: [{ name: 'Cream White', hex: '#F9F7F2' }, { name: 'Dusty Blue', hex: '#AFBEC8' }, { name: 'French Blue', hex: '#637F99' }, { name: 'Warm Beige', hex: '#DCC9B6' }] } },
    { id: uid(), wedding_id: 'charani', kind: 'label', x: 380, y: 40, w: 300, z: 1, deleted_at: null, data: { text: 'Boutonnieres' } },
    { id: uid(), wedding_id: 'charani', kind: 'compare', x: 380, y: 90, w: 520, z: 2, deleted_at: null, data: { title: 'Boutonnieres for the groom’s side', options: [{ title: 'Dried hydrangea', rate: '', contact: '', chosen: true }, { title: 'Foam roses with tags', rate: '', contact: '', chosen: false }] } },
    { id: uid(), wedding_id: 'charani', kind: 'note', x: 960, y: 70, w: 220, z: 3, deleted_at: null, data: { text: 'Example note: pick one flower-girl style so all the girls match?', tint: 'blue' } },
    { id: uid(), wedding_id: 'charani', kind: 'contact', x: 40, y: 330, w: 260, z: 1, deleted_at: null, data: { title: 'Example florist', phone: '', role: 'Dried and foam boutonnieres', notes: '' } },
    { id: uid(), wedding_id: 'elow', kind: 'palette', x: 40, y: 60, w: 340, z: 1, deleted_at: null, data: { title: 'Chateau Rose palette', colors: [{ name: 'Dusty Rose', hex: '#D9A9A0' }, { name: 'Vintage Mauve', hex: '#9E7280' }, { name: 'English Rose', hex: '#E3B7AE' }, { name: 'Champagne', hex: '#EFE3D3' }, { name: 'Rose Gold', hex: '#C9967F' }] } },
    { id: uid(), wedding_id: 'elow', kind: 'compare', x: 420, y: 60, w: 480, z: 2, deleted_at: null, data: { title: 'Custard cups', options: [{ title: 'Option A', rate: '', contact: '', chosen: false }, { title: 'Option B', rate: '', contact: '', chosen: false }] } },
    { id: uid(), wedding_id: 'elow', kind: 'link', x: 960, y: 60, w: 260, z: 1, deleted_at: null, data: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Example video link' } }
  );
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
    this.me = { id: m.user_id, name: m.name, isAdmin: true, lastSeen: Number(m.last_seen_activity) || 0 };
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
    const r = after || before;
    const label = r.title || r.couple || (r.data && (r.data.title || r.data.text)) || null;
    this.cache.activity.unshift({
      id: this.nextAct++, wedding_id: r.wedding_id || (table === 'weddings' ? r.id : null),
      actor: this.me.id, actor_name: this.me.name, action, entity: table, entity_id: r.id,
      label: label ? String(label).slice(0, 140) : null, changes, created_at: nowIso()
    });
  }

  async insert(table, row) {
    const full = { id: uid(), created_at: nowIso(), created_by: this.me.id, deleted_at: null, ...row };
    this.cache[table].push(full); if (!UNLOGGED.includes(table)) this.log('create', table, null, full);
    this.save(); this.emit({ table }); return full;
  }
  async update(table, id, patch) {
    const before = { ...this.find(table, id) };
    const after = { ...before, ...patch };
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
  async purge(table, id) {
    const row = this.find(table, id);
    this.dropChildren(table, id);
    this.dropLocal(table, id); this.log('purge', table, row, null);
    this.save(); this.emit({ table });
  }
  async setPasscode() { }
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
  async del(table, id) { this.dropLocal(table, id); this.save(); this.emit({ table }); }
  async downloadUrl(path) { return this.blobs.get(path) || ''; }
  async markSeen(activityId) {
    if (activityId <= this.me.lastSeen) return;
    this.me.lastSeen = activityId; this.cache.members[0].last_seen_activity = activityId; this.save();
  }
  async rename(name) { this.me.name = name; this.cache.members[0].name = name; this.save(); this.emit({ table: 'members' }); }
  async uploadBlob(blob, ext) {
    const path = `demo/${uid()}.${ext}`;
    this.blobs.set(path, URL.createObjectURL(blob));
    return path;
  }
  async url(path) { return this.blobs.get(path) || ''; }
}

export const store = MODE === 'demo' ? new DemoStore() : new LiveStore();
export { uid, nowIso };
