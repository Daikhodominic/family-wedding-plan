import { store } from './store.js?v=8';
import { h, modal, field, toast, ICONS, compressImage, videoThumb, pdfThumb, fileExt, prettySize, youtubeId, hostOf, safeUrl, copyText } from './ui.js?v=8';
import { live, ui, render } from './app.js?v=8';

const KIND = {
  note: { label: 'Note', icon: 'note', w: 220 },
  image: { label: 'Photo', icon: 'image', w: 260 },
  video: { label: 'Video', icon: 'video', w: 300 },
  file: { label: 'Document', icon: 'file', w: 230 },
  link: { label: 'Link', icon: 'link', w: 260 },
  contact: { label: 'Contact', icon: 'contact', w: 250 },
  compare: { label: 'Comparison', icon: 'compare', w: 540 },
  label: { label: 'Section title', icon: 'label', w: 320 },
  palette: { label: 'Colours', icon: 'palette', w: 300 }
};

function fail(e) { console.error(e); toast(e.message || 'That did not save. Check your connection.', 'error'); }
const topZ = (w) => Math.max(1, ...live(store.rows('board_items')).filter(i => i.wedding_id === w.id).map(i => i.z || 1));

async function setImg(img, path, fallback) {
  if (!path) { if (fallback) img.replaceWith(fallback); return; }
  const url = await store.url(path);
  if (url) img.src = url; else if (fallback) img.replaceWith(fallback);
}

/* ---------- Uploading ---------- */
export async function uploadFile(file) {
  const isImg = /^image\//.test(file.type);
  const isVid = /^video\//.test(file.type);
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (file.size > 50 * 1024 * 1024 && !isImg) throw new Error(`“${file.name}” is bigger than 50 MB. For long videos, upload them to YouTube or Google Drive and add the link instead.`);
  if (isImg) {
    const blob = await compressImage(file);
    const path = await store.uploadBlob(blob, blob === file ? fileExt(file.name) : 'jpg');
    return { kind: 'image', data: { path, name: file.name, size: blob.size, caption: '' } };
  }
  if (isVid) {
    const [path, tb] = await Promise.all([store.uploadBlob(file, fileExt(file.name)), videoThumb(file)]);
    const thumb = tb ? await store.uploadBlob(tb, 'jpg') : null;
    return { kind: 'video', data: { path, thumb, name: file.name, size: file.size, mime: file.type, caption: '' } };
  }
  const path = await store.uploadBlob(file, fileExt(file.name));
  let thumb = null, pages = null;
  if (isPdf) { const t = await pdfThumb(file); if (t && t.blob) { thumb = await store.uploadBlob(t.blob, 'jpg'); pages = t.pages; } }
  return { kind: 'file', data: { path, thumb, pages, name: file.name, title: file.name.replace(/\.[^.]+$/, ''), size: file.size, mime: file.type, caption: '' } };
}

export function pickFiles(accept, multiple = true) {
  return new Promise((resolve) => {
    const inp = h('input', { type: 'file', accept, multiple: multiple ? true : null, style: { display: 'none' } });
    inp.addEventListener('change', () => { resolve([...inp.files]); inp.remove(); });
    document.body.append(inp); inp.click();
  });
}

/* ---------- Editors ---------- */
function editItem(item, w) {
  const d = { ...(item.data || {}) };
  const save = (data) => store.update('board_items', item.id, { data }).catch(fail);
  const k = item.kind;
  if (k === 'note') {
    const text = h('textarea', { rows: 5 }); text.value = d.text || '';
    const tint = h('select', {}, [['yellow', 'Butter'], ['blue', 'Blue'], ['rose', 'Rose'], ['green', 'Sage']].map(([v, l]) => h('option', { value: v, selected: (d.tint || 'yellow') === v ? true : null }, l)));
    return modal({ title: 'Note', body: [field('Note', text), field('Colour', tint)], actions: [{ label: 'Save', onClick: () => save({ ...d, text: text.value, tint: tint.value }) }] });
  }
  if (k === 'label') {
    const text = h('input', { value: d.text || '', maxlength: 60 });
    return modal({ title: 'Section title', body: field('Title', text, 'Use these to group the board, like “Flowers” or “Food”.'), actions: [{ label: 'Save', onClick: () => save({ ...d, text: text.value.trim() }) }] });
  }
  if (k === 'image' || k === 'video' || k === 'file') {
    const title = h('input', { value: d.title || '', maxlength: 120, placeholder: k === 'file' ? d.name : 'Optional' });
    const cap = h('textarea', { rows: 3, placeholder: 'What is this? Price, where it is from…' }); cap.value = d.caption || '';
    let fileData = null;
    const replace = h('button', {
      class: 'btn ghost small', type: 'button', onclick: async () => {
        const [f] = await pickFiles(k === 'file' ? '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,application/pdf' : 'image/*,video/*', false); if (!f) return;
        replace.textContent = 'Uploading…'; replace.disabled = true;
        try { const r = await uploadFile(f); fileData = r; replace.textContent = 'New file ready ✓ — press Save'; }
        catch (e) { fail(e); replace.textContent = 'Replace the file'; replace.disabled = false; }
      }
    }, k === 'image' ? 'Replace the photo' : k === 'video' ? 'Replace the video' : 'Replace the file');
    return modal({
      title: KIND[k].label, body: [field('Title', title), field('Caption', cap), h('div', { class: 'field' }, h('label', {}, 'File'), h('div', { class: 'hint' }, d.name || ''), replace)],
      actions: [{
        label: 'Save', onClick: () => {
          if (fileData) {
            const { title: _t, caption: _c, ...fd } = fileData.data;
            return store.update('board_items', item.id, { kind: fileData.kind, data: { ...d, path: null, thumb: null, pages: null, ...fd, title: title.value.trim(), caption: cap.value } }).catch(fail);
          }
          return save({ ...d, title: title.value.trim(), caption: cap.value });
        }
      }]
    });
  }
  if (k === 'link') {
    const url = h('input', { type: 'url', value: d.url || '', placeholder: 'https://' });
    const title = h('input', { value: d.title || '', maxlength: 140 });
    const cap = h('textarea', { rows: 2 }); cap.value = d.caption || '';
    let thumb = d.thumb || null;
    const thumbBtn = h('button', {
      class: 'btn ghost small', type: 'button', onclick: async () => {
        const [f] = await pickFiles('image/*', false); if (!f) return;
        thumbBtn.textContent = 'Uploading…';
        try { const r = await uploadFile(f); thumb = r.data.path; thumbBtn.textContent = 'Picture added ✓'; } catch (e) { fail(e); thumbBtn.textContent = 'Add a picture'; }
      }
    }, thumb ? 'Change picture' : 'Add a picture');
    const dropThumb = h('button', { class: 'link-btn', type: 'button', hidden: !thumb, style: { color: 'var(--warn)' }, onclick: () => { thumb = null; dropThumb.hidden = true; thumbBtn.textContent = 'Add a picture'; } }, 'Remove picture');
    return modal({
      title: 'Link', body: [field('Address', url), field('Title', title, 'What the link is, e.g. “Sky blue flower-girl dress”'), field('Notes', cap),
        h('div', { class: 'field' }, h('label', {}, 'Preview picture'), h('div', { class: 'hint' }, youtubeId(url.value) ? 'YouTube links show their own picture.' : 'Optional: a screenshot or photo to show on the card.'), h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } }, thumbBtn, dropThumb))],
      actions: [{ label: 'Save', onClick: () => { const u = safeUrl(url.value.trim()); if (!u) { toast('That address does not look right. It should start with https://', 'error'); return false; } return save({ ...d, url: u, title: title.value.trim(), caption: cap.value, thumb }); } }]
    });
  }
  if (k === 'contact') {
    const name = h('input', { value: d.title || '', maxlength: 80 });
    const phone = h('input', { type: 'tel', value: d.phone || '', maxlength: 40 });
    const role = h('input', { value: d.role || '', maxlength: 120, placeholder: 'e.g. Caterer, florist' });
    const notes = h('textarea', { rows: 3 }); notes.value = d.notes || '';
    return modal({ title: 'Contact', body: h('div', { class: 'form-grid' }, field('Name', name), field('Phone', phone), h('div', { class: 'full' }, field('What they do', role)), h('div', { class: 'full' }, field('Notes', notes))), actions: [{ label: 'Save', onClick: () => save({ ...d, title: name.value.trim(), phone: phone.value.trim(), role: role.value.trim(), notes: notes.value }) }] });
  }
  if (k === 'palette') {
    const title = h('input', { value: d.title || 'Colours', maxlength: 80 });
    let colors = (d.colors || []).map(c => ({ ...c }));
    const list = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });
    const draw = () => list.replaceChildren(...colors.map((c, i) => h('div', { style: { display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: '8px', alignItems: 'center' } },
      h('input', { type: 'color', value: c.hex, 'aria-label': 'Colour', oninput: (e) => { c.hex = e.target.value; } }),
      h('input', { value: c.name, 'aria-label': 'Colour name', oninput: (e) => { c.name = e.target.value; } }),
      h('span', { style: { display: 'flex' } },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move colour up', disabled: i === 0 ? true : null, onclick: () => { [colors[i - 1], colors[i]] = [colors[i], colors[i - 1]]; draw(); } }, '↑'),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove colour', html: ICONS.trash, onclick: () => { colors.splice(i, 1); draw(); } })))));
    draw();
    return modal({ title: 'Colours', body: [field('Title', title), list, h('button', { class: 'dashed', type: 'button', onclick: () => { colors.push({ name: 'New colour', hex: '#cccccc' }); draw(); } }, '+ Add a colour')], actions: [{ label: 'Save', onClick: () => save({ ...d, title: title.value.trim(), colors }) }] });
  }
  if (k === 'compare') return editCompare(item);
}

function editCompare(item) {
  const d = item.data || {};
  const title = h('input', { value: d.title || '', maxlength: 120, placeholder: 'e.g. Custard cups' });
  const opts = (d.options || []).map(o => ({ ...o }));
  const list = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } });
  const draw = () => list.replaceChildren(...opts.map((o, i) => {
    const imgBox = h('div', { class: 'thumb-row' });
    const drawImg = () => {
      imgBox.replaceChildren();
      if (o.image) { const im = h('img', { alt: '' }); imgBox.append(im); setImg(im, o.image); }
      imgBox.append(h('button', {
        class: 'btn ghost small', type: 'button', onclick: async (e) => {
          const [f] = await pickFiles('image/*', false); if (!f) return;
          e.target.textContent = 'Uploading…';
          try { const r = await uploadFile(f); o.image = r.data.path; drawImg(); } catch (x) { fail(x); }
        }
      }, o.image ? 'Change photo' : 'Add a photo'));
      if (o.image) imgBox.append(h('button', { class: 'link-btn', type: 'button', style: { color: 'var(--warn)' }, onclick: () => { o.image = null; drawImg(); } }, 'Remove photo'));
    };
    drawImg();
    return h('div', { class: 'opt-edit' },
      h('div', { class: 'full' }, h('strong', {}, 'Option ' + String.fromCharCode(65 + i)),
        h('span', { style: { display: 'flex', gap: '4px', alignItems: 'center' } },
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move option up', disabled: i === 0 ? true : null, onclick: () => { [opts[i - 1], opts[i]] = [opts[i], opts[i - 1]]; draw(); } }, '↑'),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move option down', disabled: i === opts.length - 1 ? true : null, onclick: () => { [opts[i + 1], opts[i]] = [opts[i], opts[i + 1]]; draw(); } }, '↓'),
          h('button', { class: 'link-btn', type: 'button', style: { color: 'var(--warn)', marginLeft: '6px' }, onclick: () => { opts.splice(i, 1); draw(); } }, 'Remove option'))),
      field('Name', h('input', { value: o.title || '', oninput: (e) => { o.title = e.target.value; } })),
      field('Rate (₹)', h('input', { value: o.rate || '', placeholder: 'e.g. 45 per cup', oninput: (e) => { o.rate = e.target.value; } })),
      field('Contact', h('input', { value: o.contact || '', placeholder: 'Name / phone', oninput: (e) => { o.contact = e.target.value; } })),
      field('Notes', h('input', { value: o.notes || '', oninput: (e) => { o.notes = e.target.value; } })),
      h('div', { class: 'full' }, imgBox));
  }));
  draw();
  modal({
    title: 'Comparison', wide: true,
    body: [field('What are you comparing?', title), list, h('button', { class: 'dashed', type: 'button', onclick: () => { opts.push({ title: '', rate: '', contact: '', notes: '', chosen: false }); draw(); } }, '+ Add an option')],
    actions: [{ label: 'Save', onClick: () => store.update('board_items', item.id, { data: { ...d, title: title.value.trim(), options: opts } }).catch(fail) }]
  });
}

/* ---------- Card rendering ---------- */
function cardBody(item) {
  const d = item.data || {};
  const by = store.memberName(item.created_by);
  const byline = by ? h('div', { class: 'by' }, 'added by ' + by) : null;
  switch (item.kind) {
    case 'note': return h('div', { class: 'body' }, h('div', { class: 'cap' }, d.text || 'Empty note — tap the pencil to write'), byline);
    case 'label': return h('div', { class: 'lbl' }, d.text || 'Section');
    case 'image': {
      const img = h('img', { class: 'media', alt: d.caption || d.title || d.name || 'Photo', loading: 'lazy' });
      setImg(img, d.path, h('div', { class: 'ph' }, 'Photo not available'));
      const a = h('a', { href: '#', onclick: async (e) => { e.preventDefault(); const u = await store.url(d.path); if (u) window.open(u, '_blank', 'noopener'); } }, img);
      return [a, (d.title || d.caption || byline) ? h('div', { class: 'body', style: { paddingTop: '8px' } }, d.title ? h('div', { class: 'ttl' }, d.title) : null, d.caption ? h('div', { class: 'cap' }, d.caption) : null, byline) : null];
    }
    case 'video': {
      const box = h('div', { class: 'play' });
      const img = h('img', { class: 'media', alt: d.caption || d.name || 'Video', loading: 'lazy' });
      box.append(img); setImg(img, d.thumb, h('div', { class: 'ph' }, 'Video'));
      box.addEventListener('click', async () => {
        const u = await store.url(d.path); if (!u) return;
        box.replaceChildren(h('video', { class: 'media', src: u, controls: true, autoplay: true, playsinline: true }));
      });
      return [box, h('div', { class: 'body', style: { paddingTop: '8px' } }, h('div', { class: 'ttl' }, d.title || d.name || 'Video'), d.caption ? h('div', { class: 'cap' }, d.caption) : null, byline)];
    }
    case 'file': {
      const ext = fileExt(d.name).toUpperCase();
      let top;
      if (d.thumb) { top = h('img', { class: 'media', alt: '', style: { maxHeight: '220px', objectPosition: 'top' } }); setImg(top, d.thumb, h('div', { class: 'doc' }, h('div', { class: 'pg' }, ext))); }
      else top = h('div', { class: 'doc' }, h('div', { class: 'pg' }, ext));
      const open = async (e) => { e.preventDefault(); const u = await store.url(d.path); if (u) window.open(u, '_blank', 'noopener'); };
      return [h('a', { href: '#', onclick: open }, top), h('div', { class: 'body', style: { paddingTop: '8px' } },
        h('div', { class: 'ttl' }, d.title || d.name), h('div', { class: 'by' }, [ext, d.pages ? d.pages + (d.pages === 1 ? ' page' : ' pages') : null, prettySize(d.size)].filter(Boolean).join(' · ')),
        d.caption ? h('div', { class: 'cap' }, d.caption) : null,
        h('a', { href: '#', onclick: open, style: { fontSize: '13px', color: 'var(--w-accent)' } }, 'Open ↗'), byline)];
    }
    case 'link': {
      const url = safeUrl(d.url);
      const yt = youtubeId(url);
      let pic = null;
      if (yt) pic = h('div', { class: 'play' }, h('img', { class: 'media', src: `https://img.youtube.com/vi/${yt}/hqdefault.jpg`, alt: '', loading: 'lazy' }));
      else if (d.thumb) { pic = h('img', { class: 'media', alt: '', loading: 'lazy' }); setImg(pic, d.thumb, null); }
      const host = hostOf(url);
      return [pic ? h('a', { href: url || '#', target: '_blank', rel: 'noopener' }, pic) : null,
        h('div', { class: 'body linkcard', style: { paddingTop: pic ? '8px' : '2px' } },
          h('span', { class: 'host' }, host ? h('img', { src: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`, alt: '' }) : null, host || 'Link'),
          h('div', { class: 'ttl' }, d.title || url || 'Add the address'),
          d.caption ? h('div', { class: 'cap' }, d.caption) : null,
          url ? h('a', { href: url, target: '_blank', rel: 'noopener', style: { fontSize: '13px', color: 'var(--w-accent)' } }, 'Open link ↗') : null, byline)];
    }
    case 'contact':
      return h('div', { class: 'body' },
        h('div', { class: 'ttl' }, d.title || 'Name'),
        d.role ? h('div', { class: 'cap', style: { color: 'var(--w-muted)' } }, d.role) : null,
        d.phone ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
          h('a', { href: 'tel:' + d.phone.replace(/[^\d+]/g, ''), style: { fontSize: '16px', fontWeight: 500 } }, d.phone),
          h('button', { class: 'pill', type: 'button', onclick: () => copyText(d.phone) }, 'Copy')) : null,
        d.notes ? h('div', { class: 'cap' }, d.notes) : null, byline);
    case 'palette':
      return h('div', { class: 'body' }, h('div', { class: 'ttl' }, d.title || 'Colours'),
        h('div', { class: 'pal' }, (d.colors || []).map(c => h('div', {}, h('span', { class: 'sw', style: { background: c.hex } }), c.name))));
    case 'compare': {
      const opts = d.options || [];
      const choose = (i) => {
        const next = opts.map((o, j) => ({ ...o, chosen: j === i ? !o.chosen : false }));
        store.update('board_items', item.id, { data: { ...d, options: next } }).catch(fail);
      };
      return h('div', { class: 'body' },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' } },
          h('div', { class: 'ttl' }, d.title || 'Comparison'), h('span', { class: 'by' }, opts.length + (opts.length === 1 ? ' option' : ' options'))),
        opts.length ? h('div', { class: 'cmp' }, opts.map((o, i) => {
          let pic = h('div', { class: 'noimg' });
          if (o.image) { pic = h('img', { alt: o.title || '' }); setImg(pic, o.image, h('div', { class: 'noimg' })); }
          return h('div', { class: 'opt' + (o.chosen ? ' chosen' : '') }, pic,
            h('div', { class: 'o' },
              h('b', {}, String.fromCharCode(65 + i) + ' · ' + (o.title || 'Option')),
              o.rate ? h('span', {}, '₹ ' + o.rate) : h('span', { class: 'by' }, 'No rate yet'),
              o.contact ? h('span', { class: 'by' }, o.contact) : null,
              o.notes ? h('span', {}, o.notes) : null,
              h('button', { class: 'pill' + (o.chosen ? ' on' : ''), type: 'button', onclick: () => choose(i) }, o.chosen ? '✓ Chosen' : 'Choose')));
        })) : h('div', { class: 'by' }, 'No options yet — tap the pencil to add them.'), byline);
    }
  }
  return h('div', { class: 'body' }, 'Card');
}

function cardEl(item, w, onMove) {
  const d = item.data || {};
  const tint = item.kind === 'note' ? ' ' + (d.tint || 'yellow') : '';
  const card = h('article', { class: 'card ' + item.kind + tint, dataset: { id: item.id }, style: { left: item.x + 'px', top: item.y + 'px', width: (item.w || KIND[item.kind].w) + 'px', zIndex: item.z || 1 } });
  const handle = h('div', { class: 'handle', title: 'Drag to move' },
    h('span', { class: 'kind' }, KIND[item.kind] ? KIND[item.kind].label : ''),
    h('button', { type: 'button', 'aria-label': 'Edit', html: ICONS.edit, onclick: (e) => { e.stopPropagation(); editItem(item, w); } }),
    h('button', {
      type: 'button', 'aria-label': 'Move to Bin', html: ICONS.trash, onclick: (e) => {
        e.stopPropagation();
        store.remove('board_items', item.id).then(() => toast('Moved to the Bin — restore it from there anytime')).catch(fail);
      }
    }));
  card.append(handle, ...[].concat(cardBody(item)).filter(Boolean));
  const rz = h('span', { class: 'resize', 'aria-hidden': 'true' });
  card.append(rz);
  dragify(card, handle, item, w, 'move', onMove);
  dragify(card, rz, item, w, 'resize', onMove);
  return card;
}

function dragify(card, grip, item, w, mode, onMove) {
  grip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button') || board.tool !== 'select') return;
    e.preventDefault(); e.stopPropagation();
    grip.setPointerCapture(e.pointerId);
    ui.busy = true;
    const sx = e.clientX, sy = e.clientY;
    const ox = item.x, oy = item.y, ow = card.offsetWidth;
    const z = topZ(w) + 1;
    card.style.zIndex = z; card.classList.add('dragging');
    let nx = ox, ny = oy, nw = ow, moved = false;
    const move = (ev) => {
      const dx = (ev.clientX - sx) / board.zoom, dy = (ev.clientY - sy) / board.zoom;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      if (mode === 'move') {
        nx = Math.max(0, Math.round(ox + dx)); ny = Math.max(0, Math.round(oy + dy));
        card.style.left = nx + 'px'; card.style.top = ny + 'px';
      } else {
        nw = Math.max(160, Math.min(1200, Math.round(ow + dx))); card.style.width = nw + 'px';
      }
      onMove && onMove();
    };
    const up = () => {
      grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up);
      card.classList.remove('dragging'); ui.busy = false;
      if (!moved) { if (mode === 'move' && (item.z || 1) < z - 1) store.update('board_items', item.id, { z }).catch(fail); return; }
      const patch = mode === 'move' ? { x: nx, y: ny, z } : { w: nw };
      item = { ...item, ...patch };
      store.update('board_items', item.id, patch).catch(fail);
    };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
  });
}

/* ---------- Drawing ---------- */
const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(k, v); return e; };
const SIZES = { 1: 2, 2: 4, 3: 7 };
const DRAW_TOOLS = [
  ['select', 'Move & pan', '<path d="M5 3l14 8-6 2-2 6z"/>'],
  ['pen', 'Pen', '<path d="M4 20c4-1 6-3 8-7s4-7 8-9"/><path d="M4 20l2-5"/>'],
  ['line', 'Line', '<path d="M5 19L19 5"/>'],
  ['arrow', 'Arrow', '<path d="M5 19L19 5M10 5h9v9"/>'],
  ['ellipse', 'Circle', '<ellipse cx="12" cy="12" rx="8.5" ry="6.5"/>'],
  ['rect', 'Box', '<rect x="4" y="6" width="16" height="12" rx="2"/>'],
  ['dot', 'Dot', '<circle cx="12" cy="12" r="4" fill="currentColor"/>'],
  ['connect', 'Connect two cards', '<circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="12" r="2.5"/><path d="M7.5 12h9"/>']
];
const drawIcon = (p) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

function normalize(abs) {
  const xs = abs.map(p => p[0]), ys = abs.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x: Math.round(x), y: Math.round(y), w: Math.max(1, Math.round(Math.max(...xs) - x)), h: Math.max(1, Math.round(Math.max(...ys) - y)), pts: abs.map(([a, b]) => [Math.round(a - x), Math.round(b - y)]) };
}
function absPts(item) { const d = item.data || {}; return (d.pts || []).map(([a, b]) => [a + item.x, b + item.y]); }
function arrowHead(x1, y1, x2, y2, sw) {
  const len = 10 + sw * 2.2, ang = Math.atan2(y2 - y1, x2 - x1), a = Math.PI / 7;
  return `${x2},${y2} ${x2 - len * Math.cos(ang - a)},${y2 - len * Math.sin(ang - a)} ${x2 - len * Math.cos(ang + a)},${y2 - len * Math.sin(ang + a)}`;
}
function penPath(p) {
  if (p.length < 2) return p.length ? `M${p[0][0]} ${p[0][1]}l0.1 0` : '';
  let s = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; s += ` Q${p[i][0]} ${p[i][1]} ${mx} ${my}`; }
  const l = p[p.length - 1]; return s + ` L${l[0]} ${l[1]}`;
}
// Draws one shape (absolute points) into a <g>.
function drawShape(g, shape, abs, color, size, extra = {}) {
  const sw = SIZES[size] || 4;
  const common = { stroke: color, 'stroke-width': sw, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const parts = [];
  if (shape === 'pen') parts.push(svgEl('path', { d: penPath(abs), ...common }));
  else if (shape === 'line' || shape === 'arrow') {
    const [[x1, y1], [x2, y2]] = abs.length > 1 ? abs : [abs[0], abs[0]];
    parts.push(svgEl('line', { x1, y1, x2, y2, ...common }));
    if (shape === 'arrow') parts.push(svgEl('polygon', { points: arrowHead(x1, y1, x2, y2, sw), fill: color, stroke: color, 'stroke-width': 1, 'stroke-linejoin': 'round' }));
  } else if (shape === 'ellipse' || shape === 'rect') {
    const [[x1, y1], [x2, y2]] = abs.length > 1 ? abs : [abs[0], abs[0]];
    const x = Math.min(x1, x2), y = Math.min(y1, y2), wd = Math.abs(x2 - x1), ht = Math.abs(y2 - y1);
    parts.push(shape === 'ellipse' ? svgEl('ellipse', { cx: x + wd / 2, cy: y + ht / 2, rx: wd / 2, ry: ht / 2, ...common }) : svgEl('rect', { x, y, width: wd, height: ht, rx: 8, ...common }));
  } else if (shape === 'dot') {
    parts.push(svgEl('circle', { cx: abs[0][0], cy: abs[0][1], r: 3 + sw * 1.4, fill: color }));
  }
  g.replaceChildren(...parts);
  if (extra.hit) for (const p of parts) { const hit = p.cloneNode(); hit.setAttribute('class', 'hit'); hit.setAttribute('stroke', 'transparent'); hit.setAttribute('stroke-width', Math.max(16, sw + 12)); if (shape === 'dot' || (shape !== 'pen' && p.tagName === 'polygon')) hit.setAttribute('fill', 'transparent'); g.append(hit); }
}
function rectOf(el) { return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }; }
function edgePoint(r, tx, ty, pad = 8) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, dx = tx - cx, dy = ty - cy;
  if (!dx && !dy) return [cx, cy];
  const t = Math.min((r.w / 2 + pad) / Math.abs(dx || 1e-6), (r.h / 2 + pad) / Math.abs(dy || 1e-6));
  return [cx + dx * t, cy + dy * t];
}

/* ---------- Board ---------- */
const board = { zoom: 1, tool: 'select', color: null, size: 2, selected: null, connectFrom: null, full: false };
try { board.zoom = Number(localStorage.getItem('fwp-zoom')) || 1; } catch (e) { board.zoom = 1; }

export function renderBoard(root, w, params) {
  const all = live(store.rows('board_items')).filter(i => i.wedding_id === w.id);
  const items = all.filter(i => i.kind !== 'shape' && i.kind !== 'connector').sort((a, b) => (a.z || 1) - (b.z || 1));
  const shapes = all.filter(i => i.kind === 'shape').sort((a, b) => (a.z || 1) - (b.z || 1));
  const links = all.filter(i => i.kind === 'connector');
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--w-accent').trim();
  const COLORS = ['#2F2B2C', '#4F6A84', '#7A4A5C', '#C0392B', '#D9961A', '#3E8E5E'];
  if (!board.color) board.color = COLORS[1];
  if (board.selected && !all.some(i => i.id === board.selected)) board.selected = null;

  // Board size grows to fit everything, with room to spare.
  const ext = (i) => [i.x + (i.w || 300) + 900, i.y + ((i.data && i.data.h) || 500) + 700];
  const W = Math.max(3200, ...all.map(i => Math.ceil(ext(i)[0] / 400) * 400));
  const H = Math.max(2200, ...all.map(i => Math.ceil(ext(i)[1] / 400) * 400));

  const canvas = h('div', { class: 'board-canvas', style: { width: W + 'px', height: H + 'px', transform: `scale(${board.zoom})` } });
  const sizer = h('div', { class: 'board-sizer', style: { width: W * board.zoom + 'px', height: H * board.zoom + 'px' } }, canvas);
  const drawing = !['select', 'connect'].includes(board.tool);
  const view = h('div', { class: 'board-view tool-' + board.tool + (drawing ? ' tool-draw' : ''), role: 'region', 'aria-label': 'Mood board' }, sizer);
  const svg = svgEl('svg', { class: 'ink', width: W, height: H, viewBox: `0 0 ${W} ${H}` });
  const preview = svgEl('g', { class: 'preview' });

  if (!items.length && !shapes.length) canvas.append(h('div', { class: 'empty-board' }, h('p', { style: { margin: 0, fontSize: '18px' } }, 'The board is empty.'), h('p', {}, 'Use the buttons above to pin photos, links, notes, contacts or a comparison — then draw, circle and connect them with the drawing tools.')));
  const cardEls = new Map();
  const redrawLinks = () => {
    for (const l of links) {
      const g = svg.querySelector(`[data-id="${l.id}"]`); if (!g) continue;
      const a = cardEls.get(l.data && l.data.from), b = cardEls.get(l.data && l.data.to);
      if (!a || !b) { g.replaceChildren(); continue; }
      const ra = rectOf(a), rb = rectOf(b);
      const p1 = edgePoint(ra, rb.x + rb.w / 2, rb.y + rb.h / 2), p2 = edgePoint(rb, ra.x + ra.w / 2, ra.y + ra.h / 2);
      drawShape(g, l.data.arrow === false ? 'line' : 'arrow', [p1, p2], l.data.color || COLORS[1], l.data.size || 2, { hit: true });
    }
  };
  for (const it of items) { const el = cardEl(it, w, redrawLinks); cardEls.set(it.id, el); canvas.append(el); }

  for (const s of shapes) {
    const g = svgEl('g', { 'data-id': s.id, 'data-shape': '1', class: board.selected === s.id ? 'sel' : '' });
    drawShape(g, s.data.shape, absPts(s), s.data.color, s.data.size, { hit: true });
    svg.append(g);
  }
  for (const l of links) svg.append(svgEl('g', { 'data-id': l.id, 'data-shape': '1', class: board.selected === l.id ? 'sel' : '' }));
  svg.append(preview);
  canvas.append(svg);

  // Selection handles
  const handles = svgEl('g', { class: 'handles' });
  svg.append(handles);
  const drawHandles = () => {
    handles.replaceChildren();
    const s = shapes.find(x => x.id === board.selected);
    if (!s) return;
    const abs = absPts(s);
    const pad = 10;
    handles.append(svgEl('rect', { x: s.x - pad, y: s.y - pad, width: (s.w || 1) + pad * 2, height: ((s.data && s.data.h) || 1) + pad * 2, class: 'selbox' }));
    if (['line', 'arrow', 'ellipse', 'rect'].includes(s.data.shape) && abs.length > 1) {
      abs.forEach((p, idx) => handles.append(svgEl('circle', { cx: p[0], cy: p[1], r: 9 / Math.min(1, board.zoom), class: 'knob', 'data-knob': idx })));
    }
  };
  drawHandles();

  /* --- coordinates & zoom --- */
  const local = (cx, cy) => { const r = canvas.getBoundingClientRect(); return [(cx - r.left) / board.zoom, (cy - r.top) / board.zoom]; };
  const zl = h('button', { class: 'zoom-pct', type: 'button', title: 'Back to 100%', onclick: () => setZoom(1) }, Math.round(board.zoom * 100) + '%');
  const setZoom = (z, cx, cy) => {
    const old = board.zoom;
    z = Math.max(0.2, Math.min(2.5, z));
    if (Math.abs(z - old) < 0.001) return;
    const vr = view.getBoundingClientRect();
    const px = cx === undefined ? vr.width / 2 : cx - vr.left, py = cy === undefined ? vr.height / 2 : cy - vr.top;
    const lx = (view.scrollLeft + px) / old, ly = (view.scrollTop + py) / old;
    board.zoom = z;
    canvas.style.transform = `scale(${z})`; sizer.style.width = W * z + 'px'; sizer.style.height = H * z + 'px';
    view.scrollLeft = lx * z - px; view.scrollTop = ly * z - py;
    zl.textContent = Math.round(z * 100) + '%';
    try { localStorage.setItem('fwp-zoom', String(z)); } catch (e) { }
  };
  const fit = () => {
    const boxes = [...cardEls.values()].map(rectOf).concat(shapes.map(s => ({ x: s.x, y: s.y, w: s.w || 1, h: (s.data && s.data.h) || 1 })));
    if (!boxes.length) { setZoom(1); view.scrollTo(0, 0); return; }
    const x1 = Math.min(...boxes.map(b => b.x)) - 40, y1 = Math.min(...boxes.map(b => b.y)) - 40;
    const x2 = Math.max(...boxes.map(b => b.x + b.w)) + 40, y2 = Math.max(...boxes.map(b => b.y + b.h)) + 40;
    const z = Math.max(0.2, Math.min(1.5, Math.min(view.clientWidth / (x2 - x1), view.clientHeight / (y2 - y1))));
    setZoom(z); view.scrollLeft = x1 * z; view.scrollTop = y1 * z;
  };

  /* --- toolbars --- */
  const mkAdd = (cls = 'tools') => h('div', { class: cls, role: 'toolbar', 'aria-label': 'Add to the board' },
    tool('note', 'Note', () => addThenEdit('note', { text: '', tint: 'yellow' })),
    tool('image', 'Photo or video', () => uploadTool('image/*,video/*')),
    tool('link', 'Link', () => addThenEdit('link', { url: '', title: '' })),
    tool('file', 'Document', () => uploadTool('.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,application/pdf')),
    tool('contact', 'Contact', () => addThenEdit('contact', { title: '', phone: '', role: '' })),
    tool('compare', 'Comparison', () => addThenEdit('compare', { title: '', options: [{ title: '', rate: '', contact: '', chosen: false }, { title: '', rate: '', contact: '', chosen: false }] })),
    tool('label', 'Section', () => addThenEdit('label', { text: '' })),
    tool('palette', 'Colours', () => addThenEdit('palette', { title: 'Colours', colors: [{ name: 'Colour', hex: '#cccccc' }] })));
  const addBar = mkAdd();

  const sel = all.find(i => i.id === board.selected);
  const setTool = (t) => { board.tool = t; board.connectFrom = null; if (t !== 'select') board.selected = null; render(); };
  const restyle = (patch) => {
    if (!sel) return;
    store.update('board_items', sel.id, { data: { ...sel.data, ...patch } }).catch(fail);
  };
  const palOpen = board.palette || board.tool !== 'select' || !!sel;
  const drawBar = !palOpen ? h('div', { class: 'drawbar palette closed' },
    h('button', { type: 'button', class: 'dt wide', title: 'Pen, lines, arrows, circles, boxes, dots and connections', onclick: () => { board.palette = true; render(); } }, h('span', { html: drawIcon(DRAW_TOOLS[1][2]), style: { display: 'inline-flex' } }), 'Draw')) :
  h('div', { class: 'drawbar palette', role: 'toolbar', 'aria-label': 'Drawing tools' },
    h('button', { type: 'button', class: 'pal-close', 'aria-label': 'Hide drawing tools', title: 'Hide drawing tools', html: ICONS.close, onclick: () => { board.palette = false; board.tool = 'select'; board.selected = null; render(); } }),
    h('div', { class: 'seg' }, DRAW_TOOLS.map(([k, label, p]) => h('button', { type: 'button', class: 'dt' + (board.tool === k ? ' on' : ''), title: label, 'aria-label': label, 'aria-pressed': String(board.tool === k), html: drawIcon(p), onclick: () => setTool(k) }))),
    h('div', { class: 'seg' }, COLORS.map(c => h('button', {
      type: 'button', class: 'swatch' + (((sel && sel.data.color) || board.color) === c ? ' on' : ''), style: { background: c }, 'aria-label': 'Colour ' + c,
      onclick: () => { board.color = c; if (sel) restyle({ color: c }); else render(); }
    }))),
    h('div', { class: 'seg' }, [1, 2, 3].map(sz => h('button', {
      type: 'button', class: 'dt' + (((sel && sel.data.size) || board.size) === sz ? ' on' : ''), 'aria-label': ['Thin', 'Medium', 'Thick'][sz - 1], title: ['Thin', 'Medium', 'Thick'][sz - 1],
      html: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-linecap="round" stroke-width="${SIZES[sz]}"/></svg>`,
      onclick: () => { board.size = sz; if (sel) restyle({ size: sz }); else render(); }
    }))));
  const selBar = sel ? h('div', { class: 'selbar', role: 'toolbar', 'aria-label': 'Selected drawing' },
    sel.kind === 'connector' || (sel.data && (sel.data.shape === 'line' || sel.data.shape === 'arrow'))
      ? h('button', { type: 'button', class: 'dt wide', onclick: () => sel.kind === 'connector' ? restyle({ arrow: sel.data.arrow === false }) : restyle({ shape: sel.data.shape === 'arrow' ? 'line' : 'arrow' }) }, (sel.kind === 'connector' ? sel.data.arrow !== false : sel.data.shape === 'arrow') ? 'Remove arrowhead' : 'Add arrowhead') : null,
    h('button', { type: 'button', class: 'dt wide danger', onclick: () => { const id = sel.id; board.selected = null; store.remove('board_items', id).then(() => toast('Moved to the Bin')).catch(fail); } }, 'Delete')) : null;
  const zoomBar = h('div', { class: 'zoompill', role: 'toolbar', 'aria-label': 'Zoom' },
    h('button', { type: 'button', class: 'dt', 'aria-label': 'Zoom out', html: ICONS.zoomOut, onclick: () => setZoom(board.zoom / 1.25) }), zl,
    h('button', { type: 'button', class: 'dt', 'aria-label': 'Zoom in', html: ICONS.zoomIn, onclick: () => setZoom(board.zoom * 1.25) }),
    h('button', { type: 'button', class: 'dt wide', onclick: fit, title: 'Zoom to show everything' }, 'Fit'),
    h('button', { type: 'button', class: 'dt wide', onclick: () => { board.full = !board.full; render(); } }, board.full ? 'Exit full screen' : 'Full screen'));
  const addMenu = h('div', { class: 'addmenu', hidden: true, onclick: (e) => { if (e.target.closest('button')) addMenu.hidden = true; } }, h('div', { class: 'am-h' }, 'Add to the board'), addBar);
  const fab = h('button', { type: 'button', class: 'fab', 'aria-label': 'Add to the board', 'aria-expanded': 'false', html: ICONS.plus,
    onclick: () => { addMenu.hidden = !addMenu.hidden; fab.setAttribute('aria-expanded', String(!addMenu.hidden)); } });

  const hint = {
    select: 'Drag empty space to move around · pinch or Ctrl + scroll to zoom · tap a drawing to select it',
    pen: 'Draw freely with your finger or mouse', line: 'Drag to draw a line', arrow: 'Drag to draw an arrow — e.g. pointing at a photo',
    ellipse: 'Drag to circle something', rect: 'Drag to draw a box around something', dot: 'Tap to place a dot',
    connect: board.connectFrom ? 'Now tap the second card' : 'Tap a card, then another card, to connect them with an arrow that follows them when moved'
  }[board.tool];

  const wrapCls = 'board-shell' + (board.full ? ' full' : '');
  root.append(h('div', { class: wrapCls },
    h('div', { class: 'wrap' },
      h('div', { class: 'plan-head board-bar' },
        h('div', { class: 'ph-title' }, h('div', { class: 'eyebrow' }, 'Ideas and samples'), h('h1', {}, 'Mood board')),
        mkAdd('addrow')),
      h('p', { class: 'board-hint' }, hint)),
    h('div', { class: 'wrap board-holder' }, view, drawBar, selBar, zoomBar, fab, addMenu)));

  /* --- pointer handling: pan, pinch, draw, select, connect --- */
  const pointers = new Map();
  let gesture = null;
  const startPinch = () => {
    const [a, b] = [...pointers.values()];
    gesture = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: board.zoom };
    preview.replaceChildren();
  };
  view.addEventListener('pointerdown', (e) => {
    const onCard = e.target.closest('.card');
    if (board.tool === 'connect') {
      if (!onCard) { board.connectFrom = null; render(); return; }
      e.preventDefault();
      const id = onCard.dataset.id;
      if (!board.connectFrom) { board.connectFrom = id; onCard.classList.add('linking'); document.querySelector('.board-hint').textContent = 'Now tap the second card'; return; }
      if (board.connectFrom !== id) {
        const from = board.connectFrom; board.connectFrom = null;
        store.insert('board_items', { wedding_id: w.id, kind: 'connector', x: 0, y: 0, w: 1, z: 1, data: { from, to: id, color: board.color, size: board.size, arrow: true } }).catch(fail);
      }
      return;
    }
    if (onCard && board.tool === 'select' && e.target.closest('.handle, .resize, button, a, input, video')) return; // card controls and drag bars
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { view.setPointerCapture(e.pointerId); } catch (x) { }
    if (pointers.size === 2) { startPinch(); return; }
    if (pointers.size > 2) return;
    ui.busy = true;
    const [lx, ly] = local(e.clientX, e.clientY);
    if (board.tool === 'select') {
      const knob = e.target.closest('[data-knob]');
      const g = e.target.closest('[data-shape]');
      if (knob && sel) { gesture = { type: 'knob', idx: Number(knob.dataset.knob), abs: absPts(sel) }; return; }
      if (g) {
        const id = g.getAttribute('data-id');
        const it = all.find(i => i.id === id);
        if (board.selected !== id) { board.selected = id; ui.busy = false; pointers.clear(); render(); return; }
        if (it && it.kind === 'shape') { gesture = { type: 'move', sx: lx, sy: ly, ox: it.x, oy: it.y, g }; return; }
        gesture = null; return;
      }
      if (board.selected) { board.selected = null; ui.busy = false; pointers.clear(); render(); return; }
      gesture = { type: 'pan', sx: e.clientX, sy: e.clientY, sl: view.scrollLeft, st: view.scrollTop };
      view.classList.add('panning');
      return;
    }
    e.preventDefault();
    gesture = { type: 'draw', shape: board.tool, pts: [[lx, ly]] };
    if (board.tool === 'dot') drawShape(preview, 'dot', [[lx, ly]], board.color, board.size);
  });
  view.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!gesture) return;
    if (gesture.type === 'pinch' && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      setZoom(gesture.z0 * Math.hypot(a.x - b.x, a.y - b.y) / gesture.d0, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    const [lx, ly] = local(e.clientX, e.clientY);
    if (gesture.type === 'pan') { view.scrollLeft = gesture.sl - (e.clientX - gesture.sx); view.scrollTop = gesture.st - (e.clientY - gesture.sy); return; }
    if (gesture.type === 'move') { gesture.dx = lx - gesture.sx; gesture.dy = ly - gesture.sy; gesture.g.setAttribute('transform', `translate(${gesture.dx} ${gesture.dy})`); handles.setAttribute('transform', `translate(${gesture.dx} ${gesture.dy})`); return; }
    if (gesture.type === 'knob') {
      gesture.abs[gesture.idx] = [lx, ly];
      const g = svg.querySelector(`[data-id="${sel.id}"]`);
      drawShape(g, sel.data.shape, gesture.abs, sel.data.color, sel.data.size, { hit: true });
      const k = handles.querySelector(`[data-knob="${gesture.idx}"]`); if (k) { k.setAttribute('cx', lx); k.setAttribute('cy', ly); }
      return;
    }
    if (gesture.type === 'draw') {
      const pts = gesture.pts;
      if (gesture.shape === 'pen') { const l = pts[pts.length - 1]; if (Math.hypot(lx - l[0], ly - l[1]) > 2.5 && pts.length < 1500) pts.push([lx, ly]); }
      else if (gesture.shape === 'dot') return;
      else pts[1] = [lx, ly];
      drawShape(preview, gesture.shape, pts.length > 1 ? pts : [pts[0], pts[0]], board.color, board.size);
    }
  });
  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (gesture && gesture.type === 'pinch') { if (pointers.size === 0) { gesture = null; ui.busy = false; } return; }
    if (pointers.size) return;
    const gst = gesture; gesture = null; ui.busy = false; view.classList.remove('panning');
    if (!gst) return;
    if (gst.type === 'move' && sel && (Math.abs(gst.dx || 0) + Math.abs(gst.dy || 0) > 1)) {
      store.update('board_items', sel.id, { x: Math.round(gst.ox + gst.dx), y: Math.round(gst.oy + gst.dy) }).catch(fail);
    } else if (gst.type === 'knob' && sel) {
      const n = normalize(gst.abs);
      store.update('board_items', sel.id, { x: n.x, y: n.y, w: n.w, data: { ...sel.data, pts: n.pts, h: n.h } }).catch(fail);
    } else if (gst.type === 'draw') {
      let pts = gst.pts;
      if (gst.shape !== 'pen' && gst.shape !== 'dot' && (pts.length < 2 || Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) < 6)) { preview.replaceChildren(); return; }
      if (gst.shape === 'pen' && pts.length < 2) pts = [pts[0], [pts[0][0] + 0.5, pts[0][1] + 0.5]];
      const n = normalize(pts);
      const z = Math.max(1, ...all.map(i => i.z || 1)) + 1;
      store.insert('board_items', { wedding_id: w.id, kind: 'shape', x: n.x, y: n.y, w: n.w, z, data: { shape: gst.shape, pts: n.pts, h: n.h, color: board.color, size: board.size } })
        .then(() => preview.replaceChildren()).catch(fail);
    }
  };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
  view.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setZoom(board.zoom * Math.exp(-e.deltaY * 0.0022), e.clientX, e.clientY);
  }, { passive: false });

  // Keyboard: Delete removes the selected drawing, Escape goes back to Move.
  if (!window.__fwpBoardKeys) {
    window.__fwpBoardKeys = true;
    document.addEventListener('keydown', (e) => {
      if (!document.querySelector('.board-view') || document.querySelector('.modal-wrap')) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && board.selected) { const id = board.selected; board.selected = null; store.remove('board_items', id).then(() => toast('Moved to the Bin')).catch(fail); e.preventDefault(); }
      else if (e.key === 'Escape') { if (board.full) board.full = false; board.tool = 'select'; board.selected = null; board.connectFrom = null; render(); }
    });
  }

  // Keep connections attached while card sizes settle (images loading etc.)
  requestAnimationFrame(redrawLinks);
  if (window.ResizeObserver) { const ro = new ResizeObserver(() => redrawLinks()); cardEls.forEach(el => ro.observe(el)); }

  /* --- adding cards --- */
  const spot = (wd) => {
    const rects = [...canvas.querySelectorAll('.card')].map(c => ({ x: c.offsetLeft - 16, y: c.offsetTop - 16, r: c.offsetLeft + c.offsetWidth + 16, b: c.offsetTop + c.offsetHeight + 16 }));
    const vx = view.scrollLeft / board.zoom, vy = view.scrollTop / board.zoom;
    const vw = Math.max(wd + 40, view.clientWidth / board.zoom), vh = Math.max(300, view.clientHeight / board.zoom);
    const ht = 200;
    for (let y = vy + 20; y < vy + vh * 2; y += 30) {
      for (let x = vx + 20; x + wd < vx + vw; x += 30) {
        if (!rects.some(q => x < q.r && x + wd > q.x && y < q.b && y + ht > q.y)) return { x: Math.round(x), y: Math.round(y) };
      }
    }
    return { x: Math.round(vx + 40), y: Math.round(vy + 40) };
  };
  const add = async (kind, data) => {
    const wd = KIND[kind].w;
    return store.insert('board_items', { wedding_id: w.id, kind, ...spot(wd), w: wd, z: topZ(w) + 1, data }).catch(fail);
  };
  const addThenEdit = async (kind, data) => { const it = await add(kind, data); if (it) editItem(it, w); };
  const uploadTool = async (accept) => {
    const files = await pickFiles(accept);
    for (const f of files) {
      toast(`Uploading ${f.name}…`);
      try { const r = await uploadFile(f); await add(r.kind, r.data); } catch (e) { fail(e); }
    }
  };

  // Drop files straight onto the board
  view.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  view.addEventListener('drop', async (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    for (const f of e.dataTransfer.files) { toast(`Uploading ${f.name}…`); try { const r = await uploadFile(f); await add(r.kind, r.data); } catch (x) { fail(x); } }
  });

  if (params.focus) {
    requestAnimationFrame(() => {
      const it = all.find(i => i.id === params.focus);
      const el = cardEls.get(params.focus);
      if (it) { view.scrollTo({ left: Math.max(0, it.x * board.zoom - 60), top: Math.max(0, it.y * board.zoom - 60), behavior: 'smooth' }); }
      if (el) el.classList.add('flash');
    });
  }
}

function tool(icon, label, onClick) {
  return h('button', { class: 'tool', type: 'button', onclick: onClick }, h('span', { html: ICONS[icon], style: { display: 'inline-flex' } }), label);
}
