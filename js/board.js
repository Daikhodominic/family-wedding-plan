import { store } from './store.js';
import { h, modal, field, toast, ICONS, compressImage, videoThumb, pdfThumb, fileExt, prettySize, youtubeId, hostOf, safeUrl, copyText } from './ui.js';
import { live, ui } from './app.js';

const W = 3200, H = 2200;
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
let zoom = 1;
try { zoom = Number(localStorage.getItem('fwp-zoom')) || 1; } catch (e) { zoom = 1; }

function fail(e) { console.error(e); toast(e.message || 'That did not save. Check your connection.', 'error'); }
const topZ = (w) => Math.max(1, ...live(store.rows('board_items')).filter(i => i.wedding_id === w.id).map(i => i.z || 1));

async function setImg(img, path, fallback) {
  if (!path) { if (fallback) img.replaceWith(fallback); return; }
  const url = await store.url(path);
  if (url) img.src = url; else if (fallback) img.replaceWith(fallback);
}

/* ---------- Uploading ---------- */
async function uploadFile(file) {
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

function pickFiles(accept, multiple = true) {
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
    return modal({ title: KIND[k].label, body: [field('Title', title), field('Caption', cap)], actions: [{ label: 'Save', onClick: () => save({ ...d, title: title.value.trim(), caption: cap.value }) }] });
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
    return modal({
      title: 'Link', body: [field('Address', url), field('Title', title, 'What the link is, e.g. “Sky blue flower-girl dress”'), field('Notes', cap),
        h('div', { class: 'field' }, h('label', {}, 'Preview picture'), h('div', { class: 'hint' }, youtubeId(url.value) ? 'YouTube links show their own picture.' : 'Optional: a screenshot or photo to show on the card.'), thumbBtn)],
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
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove colour', html: ICONS.trash, onclick: () => { colors.splice(i, 1); draw(); } }))));
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
    };
    drawImg();
    return h('div', { class: 'opt-edit' },
      h('div', { class: 'full' }, h('strong', {}, 'Option ' + String.fromCharCode(65 + i)),
        h('button', { class: 'link-btn', type: 'button', style: { color: 'var(--warn)' }, onclick: () => { opts.splice(i, 1); draw(); } }, 'Remove option')),
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

function cardEl(item, w) {
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
  dragify(card, handle, item, w, 'move');
  dragify(card, rz, item, w, 'resize');
  return card;
}

function dragify(card, grip, item, w, mode) {
  grip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    ui.busy = true;
    const sx = e.clientX, sy = e.clientY;
    const ox = item.x, oy = item.y, ow = card.offsetWidth;
    const z = topZ(w) + 1;
    card.style.zIndex = z; card.classList.add('dragging');
    let nx = ox, ny = oy, nw = ow, moved = false;
    const move = (ev) => {
      const dx = (ev.clientX - sx) / zoom, dy = (ev.clientY - sy) / zoom;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      if (mode === 'move') {
        nx = Math.max(0, Math.min(W - 60, Math.round(ox + dx))); ny = Math.max(0, Math.min(H - 40, Math.round(oy + dy)));
        card.style.left = nx + 'px'; card.style.top = ny + 'px';
      } else {
        nw = Math.max(160, Math.min(900, Math.round(ow + dx))); card.style.width = nw + 'px';
      }
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

/* ---------- Board ---------- */
export function renderBoard(root, w, params) {
  const items = live(store.rows('board_items')).filter(i => i.wedding_id === w.id).sort((a, b) => (a.z || 1) - (b.z || 1));
  const canvas = h('div', { class: 'board-canvas', style: { transform: `scale(${zoom})` } });
  const sizer = h('div', { style: { width: W * zoom + 'px', height: H * zoom + 'px', position: 'relative' } }, canvas);
  const view = h('div', { class: 'board-view', role: 'region', 'aria-label': 'Mood board' });

  const setZoom = (z) => {
    zoom = Math.max(0.35, Math.min(1.6, Math.round(z * 100) / 100));
    try { localStorage.setItem('fwp-zoom', String(zoom)); } catch (e) { }
    canvas.style.transform = `scale(${zoom})`; sizer.style.width = W * zoom + 'px'; sizer.style.height = H * zoom + 'px';
    zl.textContent = Math.round(zoom * 100) + '%';
  };
  const zl = h('span', { style: { fontSize: '12px', alignSelf: 'center', minWidth: '40px', textAlign: 'center' } }, Math.round(zoom * 100) + '%');
  view.append(h('div', { class: 'zoom' },
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Zoom out', html: ICONS.zoomOut, onclick: () => setZoom(zoom - 0.15) }), zl,
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Zoom in', html: ICONS.zoomIn, onclick: () => setZoom(zoom + 0.15) })), sizer);

  if (!items.length) canvas.append(h('div', { class: 'empty-board' }, h('p', { style: { margin: 0, fontSize: '18px' } }, 'The board is empty.'), h('p', {}, 'Use the buttons above to pin photos, links, notes, contacts or a comparison. Drag cards by their top bar to arrange them.')));
  for (const it of items) canvas.append(cardEl(it, w));

  // Find the first free space in the visible part of the board.
  const spot = (wd) => {
    const rects = [...canvas.querySelectorAll('.card')].map(c => ({ x: c.offsetLeft - 16, y: c.offsetTop - 16, r: c.offsetLeft + c.offsetWidth + 16, b: c.offsetTop + c.offsetHeight + 16 }));
    const vx = view.scrollLeft / zoom, vy = view.scrollTop / zoom;
    const vw = Math.max(wd + 40, view.clientWidth / zoom), vh = Math.max(300, view.clientHeight / zoom);
    const ht = 200;
    for (let y = vy + 20; y < Math.min(H - ht, vy + vh * 2); y += 30) {
      for (let x = vx + 20; x + wd < Math.min(W, vx + vw); x += 30) {
        if (!rects.some(q => x < q.r && x + wd > q.x && y < q.b && y + ht > q.y)) return { x: Math.round(x), y: Math.round(y) };
      }
    }
    return { x: Math.round(vx + 40), y: Math.round(vy + 40) };
  };
  const add = async (kind, data) => {
    const wd = KIND[kind].w;
    const it = await store.insert('board_items', { wedding_id: w.id, kind, ...spot(wd), w: wd, z: topZ(w) + 1, data }).catch(fail);
    return it;
  };
  const addThenEdit = async (kind, data) => { const it = await add(kind, data); if (it) editItem(it, w); };
  const uploadTool = async (accept) => {
    const files = await pickFiles(accept);
    for (const f of files) {
      toast(`Uploading ${f.name}…`);
      try { const r = await uploadFile(f); await add(r.kind, r.data); }
      catch (e) { fail(e); }
    }
  };

  root.append(h('div', { class: 'wrap' }, h('div', { class: 'board-bar' },
    h('h2', {}, 'Mood board'),
    h('div', { class: 'tools', role: 'toolbar', 'aria-label': 'Add to the board' },
      tool('note', 'Note', () => addThenEdit('note', { text: '', tint: 'yellow' })),
      tool('image', 'Photo or video', () => uploadTool('image/*,video/*')),
      tool('link', 'Link', () => addThenEdit('link', { url: '', title: '' })),
      tool('file', 'Document', () => uploadTool('.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,application/pdf')),
      tool('contact', 'Contact', () => addThenEdit('contact', { title: '', phone: '', role: '' })),
      tool('compare', 'Comparison', () => addThenEdit('compare', { title: '', options: [{ title: '', rate: '', contact: '', chosen: false }, { title: '', rate: '', contact: '', chosen: false }] })),
      tool('label', 'Section', () => addThenEdit('label', { text: '' })),
      tool('palette', 'Colours', () => addThenEdit('palette', { title: 'Colours', colors: [{ name: 'Colour', hex: '#cccccc' }] }))))),
    h('div', { class: 'wrap', style: { paddingBottom: '50px' } }, view));

  // Drop files straight onto the board
  view.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  view.addEventListener('drop', async (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    for (const f of e.dataTransfer.files) { toast(`Uploading ${f.name}…`); try { const r = await uploadFile(f); await add(r.kind, r.data); } catch (x) { fail(x); } }
  });

  if (params.focus) {
    requestAnimationFrame(() => {
      const el = canvas.querySelector(`[data-id="${CSS.escape(params.focus)}"]`);
      const it = items.find(i => i.id === params.focus);
      if (el && it) { view.scrollTo({ left: Math.max(0, it.x * zoom - 60), top: Math.max(0, it.y * zoom - 60), behavior: 'smooth' }); el.classList.add('flash'); el.scrollIntoView({ block: 'nearest' }); }
    });
  }
}

function tool(icon, label, onClick) {
  return h('button', { class: 'tool', type: 'button', onclick: onClick }, h('span', { html: ICONS[icon], style: { display: 'inline-flex' } }), label);
}
