// Redraw only what changed.
// Every page is still built in full, but off-screen; then it is compared with what is already on screen
// and only the differences are applied. The scroll position, a box being typed in, open menus and
// pictures that have already loaded are left alone.
//
// Safety rules, because some code keeps hold of the elements it makes:
//  • Form fields (input, textarea, select) always take the newly built element, with the text, caret and focus carried over.
//  • An element that something listened to directly (not through h()) is taken whole from the new build.
//  • Areas marked data-fresh (the swipe deck, the mood board, the map) are taken whole from the new build.
//  • A picture whose address arrives later is kept, and the later address is forwarded to it.

const fwd = new WeakMap(); // new, never-shown <img> → the <img> kept on screen in its place
const kept = new WeakMap(); // any newly built element → the element kept on screen in its place
// The element actually on screen for one a page built (code that held on to an element it made can ask for it).
export const onScreen = (el) => { let x = el, n = 0; while (x && kept.has(x) && n++ < 50) x = kept.get(x); return x; };
const srcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
Object.defineProperty(HTMLImageElement.prototype, 'src', {
  configurable: true, enumerable: srcDesc.enumerable,
  get() { return srcDesc.get.call(this); },
  set(v) { srcDesc.set.call(this, v); const o = fwd.get(this); if (o && o !== this && o.isConnected) srcDesc.set.call(o, v); }
});
const realRemove = Element.prototype.remove;
Element.prototype.remove = function () { const o = this instanceof HTMLImageElement && fwd.get(this); if (o && o.isConnected && !this.isConnected) realRemove.call(o); return realRemove.call(this); };

// Listeners added through h() go through one proxy per event type, so a kept element can take the new handler.
export function listen(el, type, fn) {
  const on = el.__on || (el.__on = {});
  if (!on[type]) { on[type] = fn; inH = true; el.addEventListener(type, (e) => { const f = el.__on && el.__on[type]; if (f) return f.call(el, e); }); inH = false; }
  else on[type] = fn;
}
let inH = false;
const realAdd = EventTarget.prototype.addEventListener;
EventTarget.prototype.addEventListener = function (type, fn, opts) {
  if (!inH && this instanceof Element) this.__direct = true;
  return realAdd.call(this, type, fn, opts);
};

const FORM = /^(INPUT|TEXTAREA|SELECT)$/;
const keyOf = (n) => n.nodeType === 1 ? (n.getAttribute('data-id') || n.getAttribute('data-key') || n.id || null) : null;
const sameKind = (a, b) => a.nodeType === b.nodeType && a.nodeName === b.nodeName && keyOf(a) === keyOf(b);
const takeWhole = (o, n) => FORM.test(n.nodeName) || n.__direct || o.__direct || n.hasAttribute('data-fresh') || o.hasAttribute('data-fresh');

function carryOver(o, n) {
  // scroll positions inside the replaced element, and a form field's typing state
  if (o.scrollTop || o.scrollLeft) { const st = o.scrollTop, sl = o.scrollLeft; requestAnimationFrame(() => { n.scrollTop = st; n.scrollLeft = sl; }); }
  if (FORM.test(o.nodeName) && document.activeElement === o) {
    if ('value' in o && o.type !== 'file' && o.value !== n.value && o.nodeName !== 'SELECT') n.value = o.value;
    let a = null, b = null; try { a = o.selectionStart; b = o.selectionEnd; } catch (e) { /* not a text field */ }
    requestAnimationFrame(() => { n.focus({ preventScroll: true }); try { if (a !== null) n.setSelectionRange(a, b); } catch (e) { /* ignore */ } });
  }
}

function syncAttrs(o, n) {
  for (const { name } of [...o.attributes]) if (!n.hasAttribute(name)) { if (o.nodeName === 'IMG' && (name === 'src' || name === 'srcset')) continue; o.removeAttribute(name); }
  for (const { name, value } of [...n.attributes]) if (o.getAttribute(name) !== value) o.setAttribute(name, value);
  syncHandlers(o, n);
}

// Make the on-screen node `o` look like the freshly built `n`. Returns the node that ends up on screen.
function morphNode(o, n) {
  if (!sameKind(o, n)) { o.replaceWith(n); return n; }
  if (o.nodeType === 3 || o.nodeType === 8) { if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue; return o; }
  if (takeWhole(o, n)) { carryOver(o, n); o.replaceWith(n); return n; }
  if (o.nodeName === 'IMG') {
    const ns = n.getAttribute('src'), os = o.getAttribute('src');
    if (ns && ns !== os) { o.replaceWith(n); return n; }          // a different picture
    if (!ns && n.dataset.path && n.dataset.path !== o.dataset.path) { o.replaceWith(n); return n; }
    syncAttrs(o, n); if (!ns) fwd.set(n, o);                       // its address is on the way — send it here
    kept.set(n, o); return o;
  }
  // Nothing differs underneath (the browser checks this natively, fast): just hand over the new click handlers.
  if (o.isEqualNode(n)) { handOver(o, n); kept.set(n, o); return o; }
  syncAttrs(o, n);
  morphChildren(o, n);
  kept.set(n, o);
  return o;
}
function handOver(o, n) {
  kept.set(n, o);
  if (n.__on || o.__on) syncHandlers(o, n);
  if (FORM.test(n.nodeName) || n.__direct || o.__direct || n.nodeName === 'IMG' || n.hasAttribute('data-fresh')) return handOverSpecial(o, n);
  let a = o.firstElementChild, b = n.firstElementChild;
  while (a && b) { const na = a.nextElementSibling, nb = b.nextElementSibling; handOver(a, b); a = na; b = nb; }
}
// Equal-looking form fields and directly-listened elements still swap to the new one (the code holds it); pictures forward.
function handOverSpecial(o, n) {
  if (n.nodeName === 'IMG' && !n.__direct && !o.__direct) { if (!n.getAttribute('src')) fwd.set(n, o); return; }
  kept.delete(n); carryOver(o, n); o.replaceWith(n);
}
function syncHandlers(o, n) {
  if (n.__on) { const on = n.__on; for (const t of Object.keys(on)) { if (o.__on && o.__on[t]) o.__on[t] = on[t]; else listen(o, t, on[t]); } }
  if (o.__on) for (const t of Object.keys(o.__on)) if (!n.__on || !n.__on[t]) o.__on[t] = null;
}

function morphChildren(o, n) {
  const olds = [...o.childNodes], news = [...n.childNodes];
  const byKey = new Map();
  for (const c of olds) { const k = keyOf(c); if (k) byKey.set(k, c); }
  const used = new Set();
  let p = 0;
  news.forEach((nc, i) => {
    const k = keyOf(nc);
    let match = null;
    if (k) { const c = byKey.get(k); if (c && !used.has(c) && sameKind(c, nc)) match = c; }
    else {
      while (p < olds.length && (used.has(olds[p]) || keyOf(olds[p]))) p++;
      if (p < olds.length && sameKind(olds[p], nc)) { match = olds[p]; p++; }
    }
    let node = nc;
    if (match) { used.add(match); node = morphNode(match, nc); }
    const at = o.childNodes[i];
    if (at !== node) o.insertBefore(node, at || null);
  });
  while (o.childNodes.length > news.length) o.lastChild.remove();
}

// Put `view` on screen inside `root`, changing only what differs from what's there now.
export function morphInto(root, view) {
  const cur = root.firstChild;
  if (!cur || root.childNodes.length !== 1) { root.replaceChildren(view); return; }
  const kept = morphNode(cur, view);
  if (kept !== root.firstChild) root.replaceChildren(kept);
}
