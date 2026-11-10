// Our Family: every relative in one register, the family tree drawn from it, and the wedding card list.
// One shared copy for both weddings (table family_register, database update 16).
// Built from the relatives page by scripts outside the repo; edit with care: it is one self-contained piece.
import { store } from './store.js?v=58';

let HOST = null;
const MARKUP = "\n\n<div class=\"fr-wrap\">\n<header class=\"top\">\n  <div class=\"eyebrow\">Wedding card register</div>\n  <h1>Our Family</h1>\n  <p class=\"lede\">Every relative in one register, eldest first: our family, then Dad's side out to his clan, then Mum's side out to hers. Each colour is one family and one wedding card. The Tree shows the same people from above.</p>\n  <div class=\"stats\" id=\"fr-stats\"></div>\n  <div class=\"prog\" id=\"fr-prog\"></div>\n  <div class=\"setup\" id=\"fr-setup\" hidden></div>\n  <p class=\"hint\">Tap any name to type over it. Tap <b>Unmarried</b> to switch to <b>Married</b>. Tap a person for more: add children or a spouse, mark meat or passed away, or remove them. When typing a child's name, press Enter to go straight to the next brother or sister.</p>\n  <div class=\"legend\"><span><span class=\"chip fam\" style=\"--fc:var(--c1)\">Family card</span> its own wedding card</span><span><span class=\"chip m\">Married</span></span><span><span class=\"chip\">Unmarried</span> on their parents' card</span><span><span class=\"chip meat\">\u2713 Meat</span> gets meat</span><span><span class=\"gone\">Grey, slanted</span> passed away</span><span><span class=\"chip c\">To confirm</span></span></div>\n</header>\n<div class=\"bar\">\n  <div class=\"search\"><input id=\"fr-q\" type=\"search\" placeholder=\"Find a name or village\" autocomplete=\"off\" aria-label=\"Find a name\"><div class=\"qres\" id=\"fr-qres\" hidden></div></div>\n  <div class=\"seg\" role=\"group\" aria-label=\"View\"><button id=\"fr-vAll\" aria-pressed=\"true\">Register</button><button id=\"fr-vFam\" aria-pressed=\"false\">Cards</button><button id=\"fr-vTree\" aria-pressed=\"false\">Tree</button><button id=\"fr-vFill\" aria-pressed=\"false\">To fill</button></div>\n  <button class=\"btn\" id=\"fr-undoBtn\" disabled>\u21b6 Undo</button>\n</div>\n<div class=\"tools\">\n  <select class=\"jump\" id=\"fr-jump\" aria-label=\"Jump to a section\"></select>\n  <button class=\"btn\" id=\"fr-editBtn\" aria-pressed=\"false\">Sections</button><button class=\"btn\" id=\"fr-expBtn\">\u21e9 Word file</button>\n  <span class=\"save\" id=\"fr-save\" aria-live=\"polite\"></span>\n</div>\n<main id=\"fr-main\"></main>\n</div>\n<div class=\"sheet\" id=\"fr-sheet\" hidden role=\"dialog\" aria-label=\"Edit person\"></div>\n<div class=\"toast\" id=\"fr-toast\" hidden></div>\n";
const CSS = "*,*::before,*::after{box-sizing:border-box}[hidden]{display:none!important}\n:host{display:block}\n.famreg button{font:inherit;color:inherit;cursor:pointer}\n.famreg a{color:inherit}\n.famreg{--bg:#f6f4ef; --card:#ffffff; --ink:#1d222c; --muted:#5d6472; --line:#e3dfd5; --soft:#efece4; --accent:#8a3b2e; --accent-ink:#ffffff; --ok:#2e6a4e; --ok-soft:#e3f0e8; --warn:#8a6418; --warn-soft:#f6ecd6; --gone:#8b8f98; --shadow:0 1px 2px rgba(30,25,15,.06),0 6px 18px rgba(30,25,15,.05);\n  --serif:\"Source Serif 4\", Georgia, \"Times New Roman\", serif;\n  --sans:\"Public Sans\", \"Segoe UI\", Roboto, system-ui, sans-serif;\n  --c0:#b4472f;--c1:#2f6f9f;--c2:#3c8a55;--c3:#8a5bb0;--c4:#c0841a;--c5:#2f8f8a;--c6:#b03a6f;--c7:#5a6b2c;--c8:#4d5bc4;--c9:#9a5a2b;--c10:#6b7f8f;--c11:#a33b3b;}\n.famreg{background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:17px;line-height:1.5;padding-block:0 120px;padding-left:max(16px, env(safe-area-inset-left, 0px));padding-right:max(16px, env(safe-area-inset-right, 0px))}\n.wrap{max-width:900px;margin:0 auto}\nbutton{font:inherit;cursor:pointer;color:inherit}\nbutton:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}\nheader.top{padding-block:24px 4px}\nh1{font-family:var(--serif);font-weight:700;font-size:clamp(28px,5.5vw,40px);line-height:1.15;margin:0;text-wrap:balance}\n.lede{color:var(--muted);margin:6px 0 0;max-width:64ch}\n.stats{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:12px;font-size:15px;color:var(--muted)}\n.stats b{color:var(--ink);font-size:20px;font-variant-numeric:tabular-nums;margin-right:4px}\n.bar{position:sticky;top:env(safe-area-inset-top, 0px);z-index:6;background:var(--bg);padding-block:10px;border-bottom:1px solid var(--line);display:flex;flex-wrap:wrap;gap:8px;align-items:center}\n.seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--card)}\n.seg button{border:0;background:none;padding:8px 14px;font-size:15px}\n.seg button[aria-pressed=\"true\"]{background:var(--ink);color:var(--bg)}\n.btn{border:1px solid var(--line);background:var(--card);border-radius:10px;padding:8px 14px;font-size:15px}\n.btn.on{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}\nselect.jump{font:inherit;font-size:15px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:10px;padding:8px 10px;max-width:100%;flex:1 1 180px;min-width:0}\n.save{font-size:13px;color:var(--muted);margin-left:auto}\n.legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:14px;color:var(--muted);margin:12px 0 0}\nsection.sec{margin-top:34px;scroll-margin-top:80px}\n.kick{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);font-weight:600}\n.sec h2{font-family:var(--serif);font-weight:700;font-size:clamp(26px,4.8vw,34px);line-height:1.2;margin:2px 0 6px;text-wrap:balance}\n.sec .intro{margin:0 0 6px;color:var(--muted);max-width:66ch}\n.sec .cnt{font-size:14px;color:var(--muted);margin-bottom:14px}\n.hh{background:var(--card);border:1px solid var(--line);border-radius:16px;margin-bottom:16px;box-shadow:var(--shadow);overflow:hidden}\n.band{height:8px;background:var(--fc)}\n.hh-in{padding:14px 18px 10px}\n.row{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:start;padding:10px 0;border-top:1px solid var(--line)}\n.row.head{border-top:0;padding-top:4px}\n.num{font-variant-numeric:tabular-nums;color:var(--muted);font-size:14px;padding-top:4px;min-width:3.4ch}\n.row.head .num{font-family:var(--serif);font-size:24px;font-weight:700;color:var(--fc);padding-top:0}\n.nm{font-weight:600;font-size:18px}\n.row.head .nm{font-family:var(--serif);font-size:23px;font-weight:700}\n.pre{font-weight:500;color:var(--muted);margin-right:6px}\n.sp{color:var(--muted);font-size:15.5px;font-weight:400}\n.gone{color:var(--gone);font-style:italic}\n.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:5px}\n.chip{font-size:12.5px;border-radius:999px;padding:2px 10px;font-weight:500;background:var(--soft);color:var(--muted);border:0}\n.chip.m{background:var(--ok-soft);color:var(--ok)}\n.chip.c{background:var(--warn-soft);color:var(--warn)}\n.chip.fam{background:color-mix(in srgb,var(--fc) 16%,transparent);color:var(--fc);border:1px solid color-mix(in srgb,var(--fc) 45%,transparent)}\n.dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--fc);margin-right:7px;vertical-align:1px}\n.note{font-size:14.5px;color:var(--muted);margin-top:2px}\n.kids{margin-left:6px;padding-left:14px;border-left:2px solid var(--line)}\n.kids .row{padding:8px 0}\n.kids .kids .nm{font-size:16px}\n.ph .nm{color:var(--muted);font-weight:400;font-style:italic}\n.edit .row{cursor:pointer;border-radius:8px}\n.edit .row:hover{background:var(--soft)}\n.add{display:none;margin:4px 0 6px;font-size:14px;border:1px dashed var(--line);background:none;border-radius:10px;padding:6px 12px;color:var(--muted)}\n.edit .add{display:inline-block}\n.quick{display:none!important;gap:6px;flex-wrap:wrap;margin-top:8px}\n.edit .quick{display:flex}\n.quick button{font:500 13px/1 var(--sans);padding:8px 12px;min-height:36px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}\n.quick button[aria-pressed=\"true\"]{background:var(--ink);color:var(--card);border-color:var(--ink)}\n.quick button[data-q=\"dead\"][aria-pressed=\"true\"]{background:var(--muted);border-color:var(--muted)}\n.row{cursor:default}\n.ed{outline:none;border-radius:4px;padding:0 2px;margin:0 -2px;cursor:text;min-width:2ch;display:inline-block}\n.ed:hover{background:var(--soft)}\n.ed:focus{background:var(--card);box-shadow:0 0 0 2px var(--fc,var(--ink))}\n.ed:empty::before{content:attr(data-ph);color:var(--muted);font-weight:400;font-style:italic}\n.spn:empty{border-bottom:2px dotted var(--muted);min-width:7ch}\n.spn:empty::before{content:\"\u2026\u2026\"}\n.hint{font-size:15px;color:var(--muted);margin:10px 0 0;max-width:60ch}\n.line{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:6px}\n.line .chips{margin:0}\n.ra{display:none;gap:6px;flex-wrap:wrap}\n.row.sel .ra, .edit .ra{display:flex}\n.row.sel{background:var(--soft);border-radius:10px;box-shadow:0 0 0 6px var(--soft)}\n.ic{min-height:30px;padding:3px 11px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--muted);font:500 12.5px/1 var(--sans);cursor:pointer}\n.ic:hover{color:var(--ink);border-color:var(--ink)}\n.ic.del:hover, .ic.del.sure{color:#fff;background:#b3261e;border-color:#b3261e}\nbutton.chip.st{font:inherit;font-size:12.5px;cursor:pointer;min-height:30px;padding:4px 12px;border:1px solid transparent}\nbutton.chip.st.married, button.chip.st.engaged{background:var(--ok-soft);color:var(--ok)}\nbutton.chip.st.single{background:var(--soft);color:var(--muted)}\nbutton.chip.st.unk{background:transparent;border:1px dashed var(--line);color:var(--muted)}\nbutton.chip.st:hover{border-color:var(--ink)}\n.edit .chips .chip.st{display:none}\n.secedit{display:none;gap:6px;flex-wrap:wrap;margin:6px 0 10px}\n.edit .secedit{display:flex}\n.dim .hh .row:not(.hl){opacity:.28}\n.check{font-size:14.5px;background:var(--warn-soft);border-radius:12px;padding:10px 14px;margin:6px 0 14px}\n.check b{color:var(--warn)}\n.fam-list{display:grid;gap:12px}\n.fcl{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}\n.fcl .vil{margin:0}\n.mc{font-size:13px;color:#8a3b17}\n.fc{box-sizing:border-box;min-width:0;display:grid;grid-template-columns:14px 1fr auto;gap:14px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;box-shadow:var(--shadow);cursor:pointer;text-align:left;width:100%}\n.fc .sw{width:14px;align-self:stretch;border-radius:7px;background:var(--fc)}\n.fc{grid-template-columns:auto 1fr auto}\n.fc .no{min-width:2.2ch;font-family:var(--serif);font-size:30px;font-weight:700;color:var(--fc);font-variant-numeric:tabular-nums;text-align:right;line-height:1;border-left:6px solid var(--fc);padding-left:12px;align-self:stretch;display:flex;align-items:center;justify-content:flex-end}\n.famsec{margin-top:22px}\n.famsec h3{font-family:var(--sans);font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:0 0 10px}\n.fc .t{all:unset;cursor:pointer;display:block;font-family:var(--serif);font-size:clamp(21px,4vw,26px);font-weight:700;line-height:1.2}\n.fc .s{font-size:14.5px;color:var(--muted);margin-top:2px}\n.fc .n{font-size:28px;font-family:var(--serif);font-weight:700;color:var(--fc);font-variant-numeric:tabular-nums;text-align:right;line-height:1}\n.fc .n small{display:block;font-family:var(--sans);font-size:11.5px;font-weight:500;color:var(--muted)}\n.fc.sub{margin-left:clamp(14px,5vw,40px);width:auto}\n.sheet{position:fixed;left:0;right:0;bottom:0;z-index:20;background:var(--card);border-top:1px solid var(--line);box-shadow:0 -10px 30px rgba(0,0,0,.18);max-height:82vh;overflow:auto;padding-block:14px calc(18px + env(safe-area-inset-bottom, 0px));padding-left:max(16px, env(safe-area-inset-left, 0px));padding-right:max(16px, env(safe-area-inset-right, 0px))}\n.sheet .in{max-width:760px;margin:0 auto;display:grid;gap:12px}\n.sheet h3{font-family:var(--serif);font-size:22px;margin:0;display:flex;justify-content:space-between;gap:10px;align-items:center}\n.f2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:10px}\nlabel.fl{display:grid;gap:4px;font-size:14px;color:var(--muted);min-width:0}\n.fl input, .fl select, .fl textarea{font:inherit;font-size:16px;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:9px 11px;width:100%;box-sizing:border-box}\n.opts{display:flex;flex-wrap:wrap;gap:6px}\n.opts button{border:1px solid var(--line);background:var(--bg);border-radius:999px;padding:7px 14px;font-size:15px}\n.opts button[aria-pressed=\"true\"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}\n.sws{display:flex;flex-wrap:wrap;gap:8px}\n.sws button{width:32px;height:32px;border-radius:50%;border:3px solid transparent;background:var(--fc)}\n.sws button[aria-pressed=\"true\"]{border-color:var(--ink)}\n.sws .auto{width:auto;border-radius:999px;padding:0 12px;background:var(--bg);border:1px solid var(--line);font-size:14px}\n.acts{display:flex;flex-wrap:wrap;gap:8px}\n.acts .danger{color:#b33a2e;border-color:#e3b2ab}\n.ck{display:flex;gap:8px;align-items:center;font-size:15px}\n.ck input{width:20px;height:20px;accent-color:var(--accent)}\n.toast{display:flex;gap:12px;align-items:center;position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom, 0px));background:var(--ink);color:var(--bg);padding:8px 14px;border-radius:10px;font-size:14px;z-index:30}\n@media (max-width:560px){\n.save{width:100%;margin-left:0}\n}\n.toast button{background:none;border:1px solid currentColor;color:inherit;border-radius:8px;padding:4px 10px;font:600 13px var(--sans);cursor:pointer}\n.btn:disabled{opacity:.4;cursor:default}\n.search{position:relative;flex:1 1 100%;min-width:0}\n@media (min-width:760px){\n.search{flex:1 1 260px}\n}\n.tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 0 4px}\n.tools .jump{flex:1 1 220px}\n.search input{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink)}\n.qres{position:absolute;left:0;right:0;top:calc(100% + 4px);background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);max-height:60vh;overflow:auto;z-index:9;padding:4px}\n.qres button{display:block;width:100%;text-align:left;background:none;border:0;border-radius:8px;padding:9px 10px;font:inherit;font-size:15.5px;color:var(--ink);cursor:pointer}\n.qres button:hover{background:var(--soft)}\n.qres small{display:block;color:var(--muted);font-size:13px;margin-top:2px}\n.qres p{margin:10px;color:var(--muted)}\n.row.flash{animation:fl 2.2s ease}\n@keyframes fl{0%,40%{background:var(--warn-soft)}100%{background:transparent}}\n.prog{display:flex;flex-direction:column;gap:6px;margin-top:10px;font-size:14.5px;color:var(--muted)}\n.prog b{color:var(--ink)}\n.pbar{height:8px;border-radius:99px;background:var(--soft);overflow:hidden;max-width:420px}\n.pbar i{display:block;height:100%;background:var(--ok)}\n.vil{font-size:14.5px;color:var(--muted);margin-top:3px}\n.vl{color:var(--ink)}\n.vl:empty{border-bottom:2px dotted var(--muted);min-width:9ch}\n.needs{display:inline-block;margin-top:5px;font-size:13px;font-weight:600;color:var(--warn);background:var(--warn-soft);border-radius:6px;padding:2px 8px}\n.fill .row:not(.need)>*{opacity:.5}\n.done{font-size:18px;padding:30px 0;color:var(--ok)}\n.fold{all:unset;cursor:pointer;display:inline-flex;gap:10px;align-items:baseline}\n.fold:focus-visible{outline:2px solid var(--accent);border-radius:4px}\n.chev{font-size:.6em;color:var(--muted);width:1em}\n.chip.meat{background:#f6e2d6;color:#8a3b17}\nbutton.chip.meatoff{font:inherit;font-size:12.5px;cursor:pointer;min-height:30px;padding:4px 12px;background:transparent;border:1px dashed var(--line);color:var(--muted)}\nbutton.chip.meat, button.chip.dead{font:inherit;font-size:12.5px;cursor:pointer;border:0;min-height:30px;padding:4px 12px}\n.ic[aria-pressed=\"true\"]{background:var(--ink);color:var(--card);border-color:var(--ink)}\n.lin{font-size:14.5px;color:var(--muted);padding:10px 12px;margin:6px 0;background:var(--soft);border-radius:10px;line-height:1.7}\n.lin b{color:var(--ink);font-weight:600}\n.lin .lk{font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;margin-right:4px}\n.lin .ar{color:var(--fc,var(--accent));font-weight:700;margin:0 2px}\n.lnote{font-size:13px}\n.lin .ic.sm2{display:none;margin-left:8px;min-height:26px;font-size:12px}\n.edit .lin .ic.sm2{display:inline-block}\n.linkids{padding-left:6px}\n.ac{position:fixed;z-index:40;width:240px;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:4px}\n.ac button{display:block;width:100%;text-align:left;border:0;background:none;padding:9px 10px;border-radius:8px;font:inherit;font-size:15px;color:var(--ink);cursor:pointer}\n.ac button.on, .ac button:hover{background:var(--soft)}\n.ac small{display:block;padding:4px 10px 6px;color:var(--muted);font-size:12px}\n@media (max-width:520px){\n#fr-undoBtn{font-size:0;width:42px;height:40px;padding:0}\n#fr-undoBtn::before{content:\"\u21b6\";font-size:19px}\n}\n.many{margin:4px 0 12px;padding:12px;border:1px dashed var(--line);border-radius:12px;display:grid;gap:8px}\n.many textarea{font:inherit;font-size:16px;width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:10px;padding:8px;background:var(--bg);color:var(--ink)}\n.famreg{--bg:#ffffff; --card:#ffffff; --ink:#142033; --muted:#5f6b7c; --faint:#97a3b3; --line:#e3e9f0; --soft:#f1f5f9;\n  --accent:#1764b3; --accent-ink:#ffffff; --coral:#ef5a4a; --coral-soft:#fdebe8; --ok:#13907a; --ok-soft:#def3ef;\n  --warn:#b9651d; --warn-soft:#fdf0e3; --gone:#8c96a4; --wash1:#e1edfa; --wash2:#ddf4f2; --shadow:0 1px 2px rgba(20,32,51,.05),0 8px 24px rgba(20,32,51,.06);\n  --serif:\"Cormorant Garamond\",Georgia,\"Times New Roman\",serif; --sans:\"Jost\",\"Segoe UI\",system-ui,sans-serif;\n  --c0:#1764b3;--c1:#0a9e9e;--c2:#ef5a4a;--c3:#6b5bd2;--c4:#e0901a;--c5:#1f8fcf;--c6:#d14d72;--c7:#2f9a67;--c8:#3f4fae;--c9:#c86a3a;--c10:#6f8295;--c11:#0d7a8a;}\n.famreg{font-size:16px;font-weight:400}\n.wrap{max-width:920px}\nheader.top{padding-block:34px 6px}\nh1{font-family:var(--serif);font-weight:500;font-size:clamp(42px,8vw,64px);line-height:1;letter-spacing:-.01em}\n.eyebrow{font-size:11.5px;letter-spacing:.26em;text-transform:uppercase;color:var(--accent);font-weight:600;margin-bottom:8px}\n.lede{font-size:16px;margin-top:10px}\n.stats{gap:10px 30px;margin-top:20px}\n.stats span{display:grid;font-size:11px;letter-spacing:.16em;text-transform:uppercase}\n.stats b{font-family:var(--serif);font-weight:500;font-size:34px;line-height:1;margin:0;letter-spacing:0;text-transform:none}\n.pbar i{background:linear-gradient(90deg,var(--accent),var(--c1))}\n.hint{font-size:14.5px}\n.bar{border-bottom:1px solid var(--line);padding-block:12px}\n.seg{border-radius:999px;background:var(--soft);border:0;padding:3px}\n.seg button{border-radius:999px;font-size:14.5px;padding:7px 15px;font-weight:500;color:var(--muted)}\n.seg button[aria-pressed=\"true\"]{background:var(--card);color:var(--ink);box-shadow:0 1px 3px rgba(20,32,51,.14)}\n.btn{border-radius:999px;font-size:14.5px;font-weight:500}\n.search input{border-radius:999px;padding:9px 16px;background:var(--soft);border-color:transparent}\n.search input:focus{background:var(--card);border-color:var(--accent);outline:none}\nselect.jump{border-radius:999px}\nsection.sec{margin-top:44px}\n.sechd{border-radius:22px;padding:26px clamp(18px,4vw,30px) 22px;background:linear-gradient(120deg,var(--wash1),var(--wash2));margin-bottom:8px}\n.kick{font-size:11.5px;letter-spacing:.24em;color:var(--accent)}\n.sec h2{font-family:var(--serif);font-weight:500;font-size:clamp(34px,6vw,48px);line-height:1.02;margin:6px 0 8px}\n.sec .intro{font-size:15.5px}\n.sec .cnt{font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin:10px 0 0;color:var(--muted)}\n.check{border-radius:14px}\n.hh{background:none;border:0;border-radius:0;box-shadow:none;margin:0;border-bottom:1px solid var(--line);overflow:visible}\n.band{display:none}\n.hh-in{padding:20px 0 14px}\n.row.head{padding:14px 16px 12px;border-radius:16px;background:color-mix(in srgb,var(--fc) 8%,var(--card));border-left:3px solid var(--fc);grid-template-columns:auto 1fr;gap:4px 16px}\n.row.head .num{font-family:var(--serif);font-weight:400;font-size:52px;line-height:.85;min-width:1.2ch;padding-top:2px}\n.row.head .num:empty{display:none}\n.nm{font-weight:500;font-size:17px}\n.row.head .nm{font-family:var(--serif);font-weight:600;font-size:clamp(26px,4.4vw,31px);line-height:1.12}\n.row.head .sp{font-family:var(--serif);font-size:.85em}\n.pre{font-weight:300;color:var(--muted);margin-right:5px}\n.row.head .pre{font-weight:500}\n.sp{font-size:15px}\n.kids{margin-left:22px;padding-left:16px;border-left:1px solid var(--line)}\n.row{border-top:1px solid var(--line);padding:11px 0}\n.kids .row:first-child{border-top:0}\n.dot{width:8px;height:8px}\n.chip{font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;font-weight:500;padding:3px 10px}\nbutton.chip.st{font-size:11.5px;letter-spacing:.06em;text-transform:uppercase}\nbutton.chip.st.married, button.chip.st.engaged{background:var(--ok-soft);color:var(--ok)}\n.chip.fam{background:transparent;border:1px solid color-mix(in srgb,var(--fc) 50%,transparent)}\n.chip.meat, button.chip.meat{background:var(--coral-soft);color:var(--coral)}\nbutton.chip.meatoff{border-color:color-mix(in srgb,var(--coral) 40%,var(--line));color:color-mix(in srgb,var(--coral) 70%,var(--muted))}\n.vil{font-size:14px}\n.vl{font-weight:500}\n.ic{border-radius:999px;font-size:12.5px}\n.row.sel{background:var(--soft);box-shadow:0 0 0 8px var(--soft)}\n.row.head.sel{box-shadow:none}\n.toast{border-radius:999px;padding:9px 16px}\n.fc{border-radius:18px;box-shadow:none;border:1px solid var(--line)}\n.fc .no{font-weight:400;font-size:40px;border-left:3px solid var(--fc)}\n.fc .t{font-weight:600;font-size:clamp(22px,3.6vw,26px)}\n.treewrap{position:relative;margin-top:16px;border-radius:24px;overflow:hidden;height:min(78vh,860px);min-height:460px;background:radial-gradient(ellipse at 50% 50%,var(--card) 0%,var(--soft) 70%);border:1px solid var(--line);touch-action:none}\n.treewrap svg{width:100%;height:100%;display:block;cursor:grab;user-select:none;-webkit-user-select:none}\n.treewrap svg.drag{cursor:grabbing}\n.tctl{position:absolute;right:12px;top:12px;display:flex;flex-direction:column;gap:6px;z-index:2}\n.tctl button{width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--ink);font:500 18px var(--sans);box-shadow:var(--shadow)}\n.tleg{position:absolute;left:12px;bottom:12px;z-index:2;display:flex;flex-wrap:wrap;gap:6px 12px;font-size:12px;color:var(--muted);background:color-mix(in srgb,var(--card) 88%,transparent);padding:8px 12px;border-radius:14px;max-width:calc(100% - 24px)}\n.tleg i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:0}\n.tpop{position:absolute;z-index:3;width:min(300px,calc(100% - 24px));background:var(--card);border:1px solid var(--line);border-radius:18px;box-shadow:0 12px 40px rgba(20,32,51,.18);padding:14px 16px;display:grid;gap:8px}\n.tpop h4{margin:0;font-family:var(--serif);font-weight:600;font-size:24px;line-height:1.1}\n.tpop .pf{font-weight:400;color:var(--muted)}\n.tpop .mt{font-size:13.5px;color:var(--muted);display:flex;flex-wrap:wrap;gap:4px 12px}\n.tpop .mt b{color:var(--ink);font-weight:500}\n.tpop .acts{gap:6px}\n.tpop .acts .btn{padding:6px 12px;font-size:13px}\n.tpop input{font:inherit;font-size:15px;border:1px solid var(--line);border-radius:999px;padding:7px 12px;background:var(--soft);color:var(--ink);min-width:0;flex:1}\n.tpop .x{position:absolute;right:10px;top:8px;border:0;background:none;font-size:20px;color:var(--muted)}\nsvg .ring{fill:none;stroke:var(--line);stroke-dasharray:2 6;vector-effect:non-scaling-stroke}\nsvg .lk{fill:none;stroke-width:1.4;vector-effect:non-scaling-stroke;opacity:.55}\nsvg .lk.anc{stroke-dasharray:3 4;opacity:.45}\nsvg text{font-family:var(--sans);fill:var(--ink);font-size:calc(12.5px / var(--k,1));paint-order:stroke;stroke:var(--bg);stroke-width:calc(3px / var(--k,1));stroke-linejoin:round}\nsvg .tn text.h{font-family:var(--serif);font-weight:600;font-size:calc(17px / var(--k,1))}\nsvg .tn.dead text{fill:var(--gone);font-style:italic}\nsvg .tn.anc text{fill:var(--muted);font-style:italic}\nsvg .tn.ph circle.o{stroke-dasharray:2 3}\nsvg .tn{cursor:pointer}\nsvg .tn:hover text{fill:var(--accent)}\nsvg .tn.hit circle.o{stroke:var(--coral);stroke-width:3}\nsvg .hub text{font-family:var(--serif);font-weight:600;font-size:calc(19px / var(--k,1));fill:var(--accent)}\nsvg .hub text.s{font-family:var(--sans);font-weight:500;font-size:calc(10px / var(--k,1));letter-spacing:.2em;fill:var(--muted)}\nsvg .side{font-family:var(--serif);font-weight:500;fill:var(--accent);opacity:.12;stroke:none;font-size:150px}\nsvg .ctr text{font-family:var(--serif);font-weight:600}\nsvg .tn.nolab text{display:none}\nsvg.vfar .cap text{font-size:calc(14px / var(--k,1))}\nsvg .wedge{fill:color-mix(in srgb,var(--accent) 4%,transparent);stroke:color-mix(in srgb,var(--accent) 14%,transparent);stroke-width:1;vector-effect:non-scaling-stroke}\nsvg .cap text{font-family:var(--serif);font-weight:600;font-size:calc(20px / var(--k,1));fill:var(--accent);stroke:none}\n@keyframes pulse{0%{r:20}100%{r:60;opacity:0}}\nsvg .pulse{fill:none;stroke:var(--coral);stroke-width:3;vector-effect:non-scaling-stroke;animation:pulse 1.4s ease-out 2}\n/* War Room fit: below the site's sticky top bar */\n.famreg{--fr-top:64px;background:transparent;color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.5;padding:0 0 120px}\n.famreg .bar{top:var(--fr-top)}\n.famreg .fr-wrap{max-width:920px;margin:0 auto}\n.famreg .setup{border-radius:16px;background:var(--warn-soft);color:var(--warn);padding:14px 18px;margin:16px 0;font-size:15px}\n.famreg .setup b{color:var(--ink)}\n.famreg.ro .ra,.famreg.ro .add,.famreg.ro .secedit,.famreg.ro #fr-editBtn,.famreg.ro .tpop .acts{display:none !important}\n.famreg.ro button.chip,.famreg.ro .fold{pointer-events:none}\n@media (max-width:700px){.famreg{--fr-top:56px}}\n";

export function renderFamily() {
  if (!HOST) {
    // Its own shadow root: the register keeps its clean look and never borrows the site's styles (or lends its own).
    HOST = document.createElement('div');
    HOST.className = 'famreg-host';
    const SR = HOST.attachShadow({ mode: 'open' });
    SR.innerHTML = '<style>' + CSS + '</style><div class="famreg">' + MARKUP + '</div>';
    boot(SR.querySelector('.famreg'), SR);
  }
  // The page is rebuilt whenever the War Room redraws; the register itself is kept and moved into the new frame.
  const page = document.createElement('main');
  page.className = 'wrap famreg-page';
  page.setAttribute('data-fresh', '');
  page.appendChild(HOST);
  return page;
}

function boot(ROOT, SR) {
const $id = (id) => ROOT.querySelector('#fr-' + id);
const selOf = () => (SR.getSelection ? SR.getSelection() : getSelection());
// A made-up sample for the preview (?demo). The family's real register lives only in the database.
const S=[
{key:"our",title:"Our family",intro:"Mum and Dad and their children.",fam:[
 {n:"Daniel",pre:"Peter",g:"M",sp:"Ruth",m:"married",note:"Dad and Mum",k:[{n:"Anna",g:"F",m:"married",sp:"Mark",k:[{n:"Lily",g:"F"}]},{n:"Sam",g:"M",m:"engaged",sp:"Grace"},{n:"Joy",g:"F"}]}]},
{key:"dad",title:"Dad's family",intro:"Dad's brothers and sisters, eldest first.",fam:[
 {n:"Paul",pre:"Peter",g:"M",sp:"Mary",m:"married",k:[{n:"Tom",g:"M",m:"married",sp:"Esther"},{n:"Ivy",g:"F",m:"single"}]},
 {n:"Daniel",pre:"Peter",g:"M",see:"our"}]},
{key:"mobo",title:"Grandma's brothers and sisters",intro:"Dad's uncles and aunts on his mother's side.",fam:[{n:"Simon",pre:"Levi",g:"M",sp:"Hannah",m:"married"}]},
{key:"clanl",title:"Dad's clan",intro:"Blood relatives on Dad's side through the clan.",fam:[{n:"Abel",g:"M",d:1,k:[{n:"Caleb",g:"M",m:"married",sp:"Naomi"}]}]},
{key:"mum",title:"Mum's family",intro:"Mum's brothers and sisters, eldest first.",fam:[{n:"Ruth",pre:"Jacob",g:"F",see:"our"},{n:"Aaron",pre:"Jacob",g:"M",sp:"Leah",m:"married",k:[{n:"Eli",g:"M",m:"single"},{n:"Rose",g:"F",m:"married",sp:"Noah"}]}]},
{key:"nenio",title:"Grandpa's brothers and sisters",intro:"Mum's uncles and aunts.",fam:[{n:"Isaac",pre:"Abram",g:"M",sp:"Sarah",m:"married",k:[{n:"Ben",g:"M",m:"married",sp:"Dina"}]}]},
{key:"asiisa",title:"Grandma's brothers and sisters",intro:"Mum's uncles and aunts on her mother's side.",fam:[{n:"Martha",pre:"Joel",g:"F",sp:"John",m:"married"}]},
{key:"clane",title:"Mum's clan",intro:"Blood relatives on Mum's side through the clan.",fam:[{n:"Seth",g:"M",d:1,k:[{n:"Enos",g:"M",m:"married",sp:"Ada"}]}]}];
/* ---------- turn the starting data into an editable register ---------- */
const uid=()=>Math.random().toString(36).slice(2,10);
function conv(p){const notes=[p.note,p.kn,p.chart?"From the clan chart":"" ].filter(Boolean);
 return {id:uid(),n:p.n,pre:p.pre||"",g:p.g||"",sp:p.sp||"",sd:!!p.sd,d:!!p.d,m:p.m||(p.ph?"":""),note:notes.join(" · "),conf:p.c||"",ph:!!p.ph,ref:p.see||"",fc:null,k:(p.k||[]).map(conv)}}
const SIDE={our:"Our family",dad:"Dad's side",mobo:"Dad's side",clanl:"Dad's side",mum:"Mum's side",mumhalf:"Mum's side",nenio:"Mum's side",asiisa:"Mum's side",clane:"Mum's side"};
function startData(){const out=[];["our","dad","mobo","clanl","mum","nenio","asiisa","clane"].forEach(k=>{const s=S.find(x=>x.key===k);out.push({id:k,side:SIDE[k],title:s.title,intro:s.intro,check:s.check||"",people:s.fam.map(conv)});
 if(s.sub)out.push({id:"mumhalf",side:"Mum's side",title:s.sub.title,intro:"Mum's half-brother and half-sister and their families.",check:"",people:s.sub.fam.map(conv)})});return out}
let DATA=startData();

/* ---------- helpers ---------- */
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ini=f=>{if(!f)return"";const w=String(f).replace(/\([^)]*\)/g," ").replace(/\b(Dr|Mr|Mrs|Rev|Late)\.?\s/gi," ").replace(/[†·]/g," ").trim().split(/\s+/).filter(Boolean);return w.length?w[w.length-1]:""};
const fatherOf=p=>p.g==="F"?(p.sp||""):p.n;
let TOPS=new WeakSet();
const isFam=(p,top)=>!p.ph&&!p.ref&&!p.anc&&(top||TOPS.has(p)||p.m==="married"||p.m==="engaged"||(p.m!=="single"&&((p.k||[]).length>0||/·\s*(sons?|children|daughters?)\b/i.test(p.n))))&&!(p.d&&!p.sp&&!(p.k||[]).some(c=>!c.d));
function walk(fn){DATA.forEach(s=>{(function W(list,parent,depth){list.forEach((p,i)=>{fn(p,parent,depth,s,list,i);W(p.k||[],p,depth+1)})})(s.people,null,0)})}
function findP(id){let r=null;walk((p,par,d,s,list,i)=>{if(p.id===id)r={p,par,s,list,i}});return r}
/* family colours: each family card gets the next colour unless you pick one */
let FAMCOL={},FAMOF={},CARDNO={},NCARDS=0;
const SIDEORDER=s=>s.side==="Dad's side"?0:s.side==="Mum's side"?1:s.side==="Our family"?-1:2;
const numberedSecs=()=>DATA.slice().sort((a,b)=>SIDEORDER(a)-SIDEORDER(b)||DATA.indexOf(a)-DATA.indexOf(b));
function computeFamilies(){TOPS=new WeakSet();walk((p,par)=>{if(par&&par.anc)TOPS.add(p)});FAMCOL={};FAMOF={};let n=0;
 DATA.forEach(s=>{(function W(list,fam,top){list.forEach(p=>{let f=fam;if(isFam(p,top)){FAMCOL[p.id]=p.fc!=null?p.fc:(n%12);n++;f=p.id}FAMOF[p.id]=f;W(p.k||[],f,false)})})(s.people,null,true)});
 CARDNO={};NCARDS=0;numberedSecs().forEach(s=>walkSec(s,(p,top)=>{if(isFam(p,top)&&getsCard(p,s))CARDNO[p.id]=++NCARDS}))}
const getsCard=(p,s)=>p.card!=null?p.card:s.side!=="Our family";
function splitNames(t){return t.split(/,|\band\b/).map(x=>x.trim()).filter(Boolean)}
function migrate(){}
const col=id=>`var(--c${FAMCOL[id]??10})`;
function famName(p){let pre=p.pre;if(!pre){const r=findP(p.id);if(r&&r.par&&!r.par.anc)pre=ini(fatherOf(r.par))}const a=(pre?pre+" ":"")+p.n+(p.d?" †":"");return p.sp?`${a} & ${p.sp}${p.sd?" †":""}`:a}
function famMeat(p){let c=0;if(p.meat&&!p.d)c++;(function W(l){l.forEach(k=>{if(FAMOF[k.id]===p.id){if(k.meat&&!k.d)c++;W(k.k||[])}})})(p.k||[]);return c}
function cardCount(fid){let c=0;const r=findP(fid);if(!r)return 0;const p=r.p;if(!p.d)c++;if(p.sp&&!p.sd)c++;(function W(list){list.forEach(k=>{if(FAMOF[k.id]===fid&&!k.ph&&!k.d)c++;if(FAMOF[k.id]===fid)W(k.k||[])})})(p.k||[]);return c}

/* ---------- render ---------- */
let VIEW="all",EDIT=false,HL=null,SEL=null;
let COLL=new Set();try{COLL=new Set(JSON.parse(localStorage.getItem("fwp-family-fold")||"[]"))}catch(e){}
/* what still needs filling in for one person */
function needs(p,isF){if(p.ref||p.anc)return[];const n=[];if(p.ph||!String(p.n||"").trim())n.push("Name");
 if((p.m==="married"||p.m==="engaged")&&!String(p.sp||"").trim()&&!p.d)n.push("Spouse name");
 if(isF&&CARDNO[p.id]&&!String(p.vil||"").trim())n.push("Village");if(p.conf)n.push("To confirm");return n}
const main=$id("main");
function chips(p,isF){const t=[];if(isF)t.push(`<span class="chip fam" style="--fc:${col(p.id)}">${CARDNO[p.id]?"Card "+CARDNO[p.id]:"No card"}</span>`);
 if(!p.ph&&!p.ref)t.push(`<button class="chip st ${p.m==="married"||p.m==="engaged"?p.m:"single"}" data-cycle title="Tap to change">${{married:"Married",engaged:"Engaged"}[p.m]||"Unmarried"}</button>`);
 if(p.meat)t.push(`<button class="chip meat" data-meat title="Tap to remove">✓ Meat</button>`);else if(!p.ph&&!p.ref&&!p.d&&(isF||p.m==="married"||p.m==="engaged"))t.push(`<button class="chip meatoff" data-meat title="Tap if this person gets meat">Meat</button>`);if(p.d)t.push(`<button class="chip dead" data-dead title="Tap to undo">Passed away</button>`);if(p.conf)t.push(`<span class="chip c">To confirm</span>`);return t.length?`<div class="chips">${t.join("")}</div>`:""}
function nameHTML(p,pre){const ed=!p.ref;
 const nm=ed?`<span class="ed" contenteditable="true" spellcheck="false" data-f="n" data-ph="Type a name" role="textbox" aria-label="Name">${esc(p.n)}</span>`:esc(p.n);
 const wed=p.sp||(ed&&(p.m==="married"||p.m==="engaged"));
 const sp=!wed?"":ed?` <span class="sp">· ${p.m==="engaged"?"engaged to":"married to"} <span class="ed spn${p.sd?" gone":""}" contenteditable="true" spellcheck="false" data-f="sp" data-ph="add name" role="textbox" aria-label="Wife or husband">${esc(p.sp)}</span>${p.sd?" †":""}</span>`:` <span class="sp">· married to <span class="${p.sd?"gone":""}">${esc(p.sp)}${p.sd?" †":""}</span></span>`;
 return `<span class="${p.d?"gone":""}">${pre?`<span class="pre">${esc(pre)}</span>`:""}${nm}${p.d?" †":""}</span>${sp}`}
function rowHTML(p,num,pre,head){const f=FAMOF[p.id],isF=isFam(p,head),nd=needs(p,isF);const notes=[p.note,p.conf].filter(Boolean).map(esc).join(" · ");
 const ref=p.ref?`<div class="note">Their family is listed under <a href="#fr-s-${p.ref}" data-jump="${p.ref}">${esc((DATA.find(s=>s.id===p.ref)||{}).title||"")}</a>.</div>`:"";
 return `<div class="row${nd.length?" need":""}${SEL===p.id?" sel":""}${p.ref?" refrow":""}${head?" head":""}${p.ph?" ph":""}${HL&&f===HL?" hl":""}" data-id="${p.id}" style="--fc:${col(f||p.id)}"><span class="num">${head?(isF&&CARDNO[p.id]?CARDNO[p.id]:""):`<span class="dot"></span>`}</span><div><div class="nm">${nameHTML(p,pre)}</div>${isF?`<div class="vil">Village: <span class="ed vl" contenteditable="true" spellcheck="false" data-f="vil" data-ph="add village" role="textbox" aria-label="Village">${esc(p.vil||"")}</span></div>`:""}${VIEW==="fill"&&nd.length?`<div class="needs">Missing: ${nd.join(", ")}</div>`:""}<div class="line">${chips(p,isF)}${p.ref?"":`<div class="ra"><button class="ic" data-kid>+ Child</button><button class="ic" data-many>+ Many children</button>${!p.sp&&p.m!=="married"&&p.m!=="engaged"?`<button class="ic" data-addsp>+ Spouse</button>`:""}${p.meat||isF||p.m==="married"||p.m==="engaged"?"":`<button class="ic" data-meat>Meat</button>`}<button class="ic" data-dead aria-pressed="${!!p.d}">${p.d?"✓ Passed away":"Passed away"}</button><button class="ic" data-anc title="For ancestors kept only to show whose line this is">Ancestor line only</button><button class="ic" data-showtree>Show on tree</button><button class="ic" data-more>More</button><button class="ic del" data-del>Remove</button></div>`}</div>${notes?`<div class="note">${notes}</div>`:""}${ref}${p.ref?"":`<div class="quick">${[["married","Married"],["single","Not married"],["dead","Passed away"]].map(([v,t])=>`<button data-q="${v}" aria-pressed="${v==="dead"?!!p.d:p.m===v}">${t}</button>`).join("")}</div>`}</div></div>`}
function lineName(p,note){return `<b>${esc(p.n)}</b>${note&&p.note?` <span class="lnote">(${esc(p.note.replace(/\s*·\s*From the clan chart/,""))})</span>`:""}`}
function ancHTML(p,chain,ctx){ctx=ctx||{};const c2=chain.concat([p]);const ks=p.k||[];const live=ks.filter(k=>!k.anc),deep=ks.filter(k=>k.anc);
 let h="";if(live.length||!ks.length)h+=`<div class="lin" data-id="${p.id}"><span class="lk">Line of</span> ${c2.map((x,i)=>lineName(x,i===0&&!ctx.noted)).join(' <span class="ar">→</span> ')}${live.length?' <span class="ar">↓</span>':' <span class="lnote">(no living family recorded)</span>'}<button class="ic sm2" data-unanc="${p.id}" title="Show ${esc(p.n)} as a person again">Show as person</button></div>`,ctx.noted=true;
 if(live.length){const pre=ini(p.g==="F"&&p.sp?p.sp:p.n);let r="";live.forEach(c=>{r+=rowHTML(c,"",c.ph?"":(c.pre||pre),false);if((c.k||[]).length)r+=`<div class="kids">${kidsHTML(c,"")}</div>`});h+=`<div class="linkids">${r}</div>`}
 deep.forEach(k=>h+=ancHTML(k,c2,ctx));return h}
function kidsHTML(p,num){const ks=p.k||[];const pre=ini(fatherOf(p));let h="";
 ks.forEach((c,i)=>{const n=num+"."+(i+1);if(c.anc){h+=ancHTML(c,[]);return}h+=rowHTML(c,n,c.ph?"":(c.pre||pre),false);if((c.k||[]).length)h+=`<div class="kids">${kidsHTML(c,n)}</div>`});
 return (ks.length?`<div class="kids">${h}</div>`:"")+`<button class="add" data-addkid="${p.id}">+ Add a child of ${esc(p.n)}</button>`}
function hhNeeds(p,top){let c=0;(function W(x,t){if(needs(x,isFam(x,t)).length)c++;(x.k||[]).forEach(k=>W(k,false))})(p,top);return c}
function renderAll(){let h="";const fill=VIEW==="fill";
 DATA.forEach((s,si)=>{const folded=COLL.has(s.id)&&!fill;let left=0;s.people.forEach(p=>left+=hhNeeds(p,true));if(fill&&!left)return;const fams=[];walkSec(s,(p,top)=>{if(isFam(p,top))fams.push(p)});let ppl=0;walkSec(s,p=>{if(!p.ph&&!p.ref)ppl+=1+(p.sp&&!(p.k&&0)?0:0)});
  h+=`<section class="sec" id="fr-s-${s.id}"><header class="sechd"><div class="kick">${esc(s.side)} · Part ${si+1}</div><h2><button class="fold" data-fold="${s.id}" aria-expanded="${!folded}"><span class="chev">${folded?"▸":"▾"}</span>${esc(s.title)}</button></h2>${folded?`<div class="cnt">${fams.length} family card${fams.length===1?"":"s"} · folded, tap the title to open</div></header></section>`:`${s.intro?`<p class="intro">${esc(s.intro)}</p>`:""}<div class="cnt">${fams.length} family card${fams.length===1?"":"s"}${fill?` · ${left} to fill`:""}</div></header>
  <div class="secedit"><button class="btn" data-secren="${s.id}">Rename section</button><button class="btn" data-secup="${s.id}">Move section up</button><button class="btn" data-secdel="${s.id}">Delete section</button></div>
  ${s.check?`<div class="check"><b>To confirm:</b> ${esc(s.check)}</div>`:""}
  ${s.people.filter(p=>!fill||hhNeeds(p,true)).map((p,i)=>`<article class="hh" style="--fc:${col(p.id)}"><div class="band"></div><div class="hh-in">${p.anc?ancHTML(p,[]):rowHTML(p,String(i+1),p.pre,true)+(p.ref?"":kidsHTML(p,String(i+1)))}</div></article>`).join("")||`<p class="note">No one recorded here yet.</p>`}
  <button class="add" data-addtop="${s.id}">+ Add a family to ${esc(s.title)}</button></section>`}`});
 if(fill&&!h)h=`<p class="done">Everything is filled in.</p>`;
 h+=`<button class="add" data-addsec="1" style="margin-top:30px">+ Add a new section</button>`;return h}
function walkSec(s,fn){(function W(list,top){list.forEach(p=>{fn(p,top);W(p.k||[],false)})})(s.people,true)}
function renderFams(){const groups=[];
 numberedSecs().forEach(s=>{const items=[];(function W(list,top,depth,parent){list.forEach(p=>{const f=isFam(p,top);if(f)items.push({p,depth,parent});W(p.k||[],false,f?depth+1:depth,f?p:parent)})})(s.people,true,0,null);
  let g=groups[groups.length-1];if(!g||g.side!==s.side){g={side:s.side,secs:[]};groups.push(g)}g.secs.push({s,items})});
 return groups.map(g=>{const nums=g.secs.flatMap(x=>x.items.map(i=>CARDNO[i.p.id])).filter(Boolean);
  return `<section class="sec" id="fr-side-${g.side.replace(/\W/g,"")}"><header class="sechd"><div class="kick">${nums.length?`Cards ${nums[0]} to ${nums[nums.length-1]}`:"No cards yet"}</div><h2>${esc(g.side==="Our family"?"Our own family":g.side)}</h2>${g.side==="Our family"?`<p class="intro">Families without a number don't need a card.</p>`:""}</header>${
  g.secs.map(({s,items})=>`<div id="fr-s-${s.id}" class="famsec"><h3>${esc(s.title)}</h3><div class="fam-list">${items.map(({p,depth,parent})=>{const mem=CARDNO[p.id]||true?famMeat(p):0;return `<div class="fc${depth?" sub":""}" style="--fc:${col(p.id)}" data-id="${p.id}"><span class="no">${CARDNO[p.id]||""}</span><div><button class="t" data-showfam="${p.id}">${esc(famName(p))} family</button><div class="s">${parent?"Child of "+esc((parent.pre?parent.pre+" ":"")+parent.n):esc(s.title)}${p.conf?" · to confirm":""}</div>
 <div class="fcl"><span class="vil">Village: <span class="ed vl" contenteditable="true" spellcheck="false" data-f="vil" data-ph="add village" role="textbox" aria-label="Village">${esc(p.vil||"")}</span></span><button class="chip ${p.meat?"meat":"meatoff"}" data-fmeat="${p.id}">${p.meat?"✓ Meat":"Meat"}</button>${mem>(p.meat?1:0)?`<span class="mc">${mem} meat on this card</span>`:""}</div></div><div class="n">${cardCount(p.id)}<small>people</small></div></div>`}).join("")||`<p class="note">No families recorded yet.</p>`}</div></div>`).join("")}</section>`}).join("")}
function stats(){let fam=0,ppl=0,gone=0;DATA.forEach(s=>walkSec(s,(p,top)=>{if(p.ph||p.ref||p.anc)return;ppl++;if(p.sp)ppl++;if(p.d)gone++;if(isFam(p,top))fam++}));
 let tot=0,need=0,by={};let meat=0;DATA.forEach(s=>walkSec(s,(p,top)=>{if(p.meat&&!p.d)meat++;if(p.ref||p.anc)return;tot++;const n=needs(p,isFam(p,top));if(n.length)need++;n.forEach(k=>by[k]=(by[k]||0)+1)}));
 const pf=$id("prog");if(pf)pf.innerHTML=`<div class="pbar"><i style="width:${tot?Math.round((tot-need)/tot*100):0}%"></i></div><span><b>${tot-need}</b> of ${tot} people complete${need?` · still to fill: ${Object.entries(by).map(([k,v])=>`${v} ${k.toLowerCase()}`).join(", ")}`:""}</span>`;
 $id("stats").innerHTML=`<span><b>${NCARDS}</b>numbered cards</span><span><b>${meat}</b>meat portions</span><span><b>${ppl}</b>people, with spouses</span><span><b>${DATA.length}</b>sections</span>`}
function render(){migrate();computeFamilies();stats();main.className=(EDIT?"edit ":"")+(HL?"dim ":"")+(VIEW==="fill"?"fill":"");if(VIEW==="tree"){main.innerHTML=treeShell();drawTree()}else main.innerHTML=VIEW==="fam"?renderFams():renderAll();
 const j=$id("jump");j.innerHTML=`<option value="">Jump to a section…</option>`+DATA.map((s,i)=>`<option value="${s.id}">${i+1}. ${esc(s.side)}: ${esc(s.title)}</option>`).join("")}

/* ---------- saving: one shared copy in the War Room's database (table family_register) ---------- */
let VERSION=0,saveT=0,lastSaved="",LIVE=false,saving=false,dirty=false,pendingRemote=null;
const LS="fwp-family-register";
const saveEl=$id("save");const setSave=t=>{saveEl.textContent=t};
const isNet=e=>!navigator.onLine||/fetch|network|Failed to fetch|Load failed/i.test(String(e&&(e.message||e)));
function cacheLocal(d){try{localStorage.setItem(LS,JSON.stringify({v:VERSION,dirty:!!d,data:JSON.stringify(DATA)}))}catch(e){}}
function save(){cacheLocal(true);
 if(store.mode!=="live"){setSave("Saved (sample copy)");return}
 if(!LIVE){setSave("Kept on this phone until the register is switched on");return}
 dirty=true;clearTimeout(saveT);setSave("Saving…");saveT=setTimeout(push,700)}
async function push(){if(saving){saveT=setTimeout(push,400);return}if(!dirty)return;saving=true;dirty=false;const json=JSON.stringify(DATA);
 try{const {data,error}=await store.sb.rpc("save_family_register",{p_data:JSON.parse(json),p_version:VERSION});if(error)throw error;
  if(data&&data.conflict){VERSION=data.version;DATA=data.data;lastSaved=JSON.stringify(DATA);render();LASTJSON=lastSaved;cacheLocal(false);setSave("Up to date");
   toast("Someone else saved the register at the same moment. Their version is shown; please make your last change again.",false)}
  else{VERSION=data.version;lastSaved=json;cacheLocal(dirty);setSave(dirty?"Saving…":"All changes saved")}}
 catch(e){if(isNet(e)){dirty=true;setSave("Offline · kept on this phone, sent when you're back online");addEventListener("online",()=>{if(dirty)push()},{once:true})}
  else setSave("Couldn't save: "+(e.message||e))}
 saving=false;if(dirty)saveT=setTimeout(push,300)}
function applyRemote(r){if(!r||typeof r.version!=="number"||r.version<=VERSION)return;const a=SR.activeElement;
 if(dirty||saving||(a&&ROOT.contains(a)&&(a.isContentEditable||/^(INPUT|TEXTAREA)$/.test(a.tagName)))){pendingRemote=r;return}
 pendingRemote=null;VERSION=r.version;DATA=r.data;lastSaved=JSON.stringify(DATA);render();LASTJSON=lastSaved;cacheLocal(false);
 const open=sheet.dataset.id;if(!sheet.hidden&&open&&findP(open))openP(open);toast((r.updated_by_name?r.updated_by_name+" updated":"Updated with")+" the register",false)}
ROOT.addEventListener("focusout",()=>setTimeout(()=>{if(pendingRemote&&!dirty&&!saving)applyRemote(pendingRemote)},50));
let HIST=[],LASTJSON="";
function commit(){const cur=JSON.stringify(DATA);if(LASTJSON&&cur!==LASTJSON){HIST.push(LASTJSON);if(HIST.length>60)HIST.shift();undoBtn()}LASTJSON=cur}
function undoBtn(){const b=$id("undoBtn");if(b)b.disabled=!HIST.length}
function undo(){if(!HIST.length)return;const j=HIST.pop();DATA=JSON.parse(j);LASTJSON=j;render();save();undoBtn();toast("Undone",false)}
function changed(){render();save();commit()}
/* ---------- editor sheet ---------- */
const sheet=$id("sheet");
const toast=(t,withUndo)=>{const e=$id("toast");e.innerHTML="";const s=document.createElement("span");s.textContent=t;e.appendChild(s);
 if(withUndo!==false&&HIST.length){const b=document.createElement("button");b.textContent="Undo";b.onclick=()=>{e.hidden=true;undo()};e.appendChild(b)}
 e.hidden=false;clearTimeout(e._t);e._t=setTimeout(()=>e.hidden=true,4000)};
function newPerson(n){return {id:uid(),n,pre:"",g:"",sp:"",sd:false,d:false,m:"",note:"",conf:"",ph:false,ref:"",fc:null,k:[]}}
function closeSheet(){sheet.hidden=true;sheet.dataset.id="";sheet.innerHTML=""}
function openP(id){const r=findP(id);if(!r)return;sheet.dataset.id=id;const p=r.p,top=!r.par;const fam=isFam(p,top);
 const autoPre=r.par?ini(fatherOf(r.par)):"";
 sheet.hidden=false;
 sheet.innerHTML=`<div class="in"><h3><span>${esc(p.n||"New person")}</span><button class="btn" data-close>Done</button></h3>
 <div class="f2"><label class="fl">Name<input id="fr-eN" value="${esc(p.n)}" autocomplete="off"></label>
 <label class="fl">Initials before the name<input id="fr-ePre" value="${esc(p.pre)}" placeholder="${esc(autoPre||"e.g. Kh")}" autocomplete="off"></label>
 <label class="fl">Gender<select id="fr-eG"><option value="">Not sure</option><option value="M"${p.g==="M"?" selected":""}>Man</option><option value="F"${p.g==="F"?" selected":""}>Woman</option></select></label></div>
 <div><div class="fl" style="margin-bottom:6px">Married?</div><div class="opts" id="fr-eM">${[["married","Married"],["engaged","Engaged"],["single","Not married"],["","Don't know"]].map(([v,t])=>`<button data-v="${v}" aria-pressed="${(p.m||"")===v}">${t}</button>`).join("")}</div></div>
 <div class="f2"><label class="fl">Wife or husband<input id="fr-eSp" value="${esc(p.sp)}" autocomplete="off" placeholder="Name"></label>
 <label class="ck"><input type="checkbox" id="fr-eD"${p.d?" checked":""}> ${esc(p.n||"This person")} has passed away</label>
 <label class="ck"><input type="checkbox" id="fr-eSd"${p.sd?" checked":""}> Wife or husband has passed away</label></div>
 <div class="f2"><label class="fl">Note<input id="fr-eNote" value="${esc(p.note)}" autocomplete="off" placeholder="Lives in Kohima"></label><label class="fl">To confirm<input id="fr-eConf" value="${esc(p.conf)}" autocomplete="off" placeholder="Leave empty when checked"></label></div>
 ${fam?`<label class="ck"><input type="checkbox" id="fr-eCard"${getsCard(p,r.s)?" checked":""}> Gets a wedding card${CARDNO[p.id]?" (Card "+CARDNO[p.id]+")":""}</label><div><div class="fl" style="margin-bottom:6px">Family colour</div><div class="sws">${Array.from({length:12},(_,i)=>`<button style="--fc:var(--c${i})" data-c="${i}" aria-label="Colour ${i+1}" aria-pressed="${FAMCOL[p.id]===i}"></button>`).join("")}<button class="auto" data-c="auto">Automatic</button></div></div>`:`<p class="note">Becomes a family with its own card and colour when marked Married or Engaged.</p>`}
 <div class="acts"><button class="btn" data-act="kid">+ Add a child</button><button class="btn" data-act="sib">+ Add ${top?"a family":"a brother or sister"} after</button><button class="btn" data-act="up">Move up</button><button class="btn" data-act="down">Move down</button><button class="btn danger" data-act="del">Remove</button></div>
 <div id="fr-eDel" hidden class="check"><b>Remove ${esc(p.n)}${(p.k||[]).length?" and their "+p.k.length+" children":""}?</b> <button class="btn danger" data-act="del2">Yes, remove</button> <button class="btn" data-act="nodel">Keep</button></div></div>`;
 const bind=(sel,key,fn)=>{const e=sheet.querySelector(sel);e.addEventListener(e.type==="checkbox"||e.tagName==="SELECT"?"change":"input",()=>{p[key]=fn?fn(e):e.value;changed();if(key==="n")sheet.querySelector("h3 span").textContent=p.n})};
 bind("#fr-eN","n");bind("#fr-ePre","pre");bind("#fr-eG","g");bind("#fr-eSp","sp");bind("#fr-eD","d",e=>e.checked);bind("#fr-eSd","sd",e=>e.checked);bind("#fr-eNote","note");bind("#fr-eConf","conf");
 const ec=sheet.querySelector("#fr-eCard");if(ec)ec.onchange=()=>{p.card=ec.checked;changed();openP(id)};
 sheet.querySelectorAll("#fr-eM button").forEach(b=>b.onclick=()=>{p.m=b.dataset.v;sheet.querySelectorAll("#fr-eM button").forEach(x=>x.setAttribute("aria-pressed",x===b));changed();openP(id)});
 sheet.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>{p.fc=b.dataset.c==="auto"?null:+b.dataset.c;changed();openP(id)});
 sheet.querySelector("[data-close]").onclick=closeSheet;
 sheet.querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>{const a=b.dataset.act;const R=findP(id);
  if(a==="kid"){const c=newPerson("New name");(p.k=p.k||[]).push(c);changed();openP(c.id);toast("Child added. Type the name.")}
  if(a==="sib"){const c=newPerson(top?"New family":"New name");R.list.splice(R.i+1,0,c);changed();openP(c.id)}
  if(a==="up"&&R.i>0){R.list.splice(R.i,1);R.list.splice(R.i-1,0,p);changed()}
  if(a==="down"&&R.i<R.list.length-1){R.list.splice(R.i,1);R.list.splice(R.i+1,0,p);changed()}
  if(a==="del")sheet.querySelector("#fr-eDel").hidden=false;
  if(a==="nodel")sheet.querySelector("#fr-eDel").hidden=true;
  if(a==="del2"){R.list.splice(R.i,1);changed();closeSheet();toast("Removed")}})}
function openSec(sid){const s=DATA.find(x=>x.id===sid);if(!s)return;sheet.hidden=false;
 sheet.innerHTML=`<div class="in"><h3><span>Section</span><button class="btn" data-close>Done</button></h3>
 <div class="f2"><label class="fl">Title<input id="fr-sT" value="${esc(s.title)}"></label><label class="fl">Side<select id="fr-sS">${["Our family","Dad's side","Mum's side","Friends","Other"].map(v=>`<option${s.side===v?" selected":""}>${v}</option>`).join("")}</select></label></div>
 <label class="fl">Short description<textarea id="fr-sI" rows="2">${esc(s.intro)}</textarea></label><label class="fl">To confirm<input id="fr-sC" value="${esc(s.check)}" placeholder="Leave empty when checked"></label>
 <div class="acts"><button class="btn danger" data-sdel>Delete this section</button></div><div id="fr-sDel" hidden class="check"><b>Delete "${esc(s.title)}" and everyone in it?</b> <button class="btn danger" data-sdel2>Yes, delete</button></div></div>`;
 [["#fr-sT","title"],["#fr-sS","side"],["#fr-sI","intro"],["#fr-sC","check"]].forEach(([q,k])=>{const e=sheet.querySelector(q);e.addEventListener(e.tagName==="SELECT"?"change":"input",()=>{s[k]=e.value;changed()})});
 sheet.querySelector("[data-close]").onclick=closeSheet;sheet.querySelector("[data-sdel]").onclick=()=>sheet.querySelector("#fr-sDel").hidden=false;
 sheet.querySelector("[data-sdel2]").onclick=()=>{DATA.splice(DATA.indexOf(s),1);changed();closeSheet();toast("Section deleted")}}
/* ---------- events ---------- */
main.addEventListener("click",e=>{const t=e.target;
 const j=t.closest("[data-jump]");if(j){e.preventDefault();$id("s-"+j.dataset.jump).scrollIntoView({behavior:"smooth"});return}
 const fc=t.closest("[data-showfam]");if(fc){HL=fc.dataset.showfam;setView("all");requestAnimationFrame(()=>{const el=main.querySelector(`[data-id="${HL}"]`);if(el)el.scrollIntoView({block:"center",behavior:"smooth"})});toast("Showing one family. Tap any name to clear.");return}
 if(t.closest("[data-addkid]")){const r=findP(t.closest("[data-addkid]").dataset.addkid);const c=newPerson("New name");(r.p.k=r.p.k||[]).push(c);changed();openP(c.id);return}
 if(t.closest("[data-addtop]")){const s=DATA.find(x=>x.id===t.closest("[data-addtop]").dataset.addtop);const c=newPerson("New family");s.people.push(c);changed();openP(c.id);return}
 if(t.closest("[data-addsec]")){const s={id:uid(),side:"Mum's side",title:"New section",intro:"",check:"",people:[]};DATA.push(s);changed();openSec(s.id);return}
 if(t.closest("[data-secren]")){openSec(t.closest("[data-secren]").dataset.secren);return}
 if(t.closest("[data-secdel]")){openSec(t.closest("[data-secdel]").dataset.secdel);return}
 if(t.closest("[data-secup]")){const i=DATA.findIndex(x=>x.id===t.closest("[data-secup]").dataset.secup);if(i>0){const[s]=DATA.splice(i,1);DATA.splice(i-1,0,s);changed()}return}
 const cy=t.closest("[data-cycle]");if(cy){const r=findP(cy.closest(".row").dataset.id);if(!r)return;const p=r.p;
  p.m=p.m==="married"||p.m==="engaged"?"single":"married";changed();toast(`${p.n||"Name"}: ${p.m==="married"?"married":"unmarried"}`);if(p.m==="married"&&!p.sp)focusEd(p.id,"sp");return}
 const q=t.closest("[data-q]");if(q){const r=findP(q.closest(".row").dataset.id);if(!r)return;const p=r.p,v=q.dataset.q;
  if(v==="dead")p.d=!p.d;else p.m=p.m===v?"":v;changed();toast(`${p.n}: ${v==="dead"?(p.d?"passed away":"living"):(p.m==="married"?"married":p.m==="single"?"not married":"not sure")}`);return}
 const fo=t.closest("[data-fold]");if(fo){const id=fo.dataset.fold;COLL.has(id)?COLL.delete(id):COLL.add(id);try{localStorage.setItem("fwp-family-fold",JSON.stringify([...COLL]))}catch(x){}render();return}
 const row=t.closest(".row");if(!row)return;const R=findP(row.dataset.id);if(!R)return;
 if(t.closest("[data-many]")){manyBox(R);return}
 if(t.closest("[data-kid]")){const c=newPerson("");c.fresh=true;(R.p.k=R.p.k||[]).push(c);changed();focusEd(c.id,"n");return}
 if(t.closest("[data-addsp]")){R.p.m="married";changed();focusEd(R.p.id,"sp");return}
 if(t.closest("[data-more]")){openP(R.p.id);return}
 if(t.closest("[data-showtree]")){const id=R.p.id;setView("tree");requestAnimationFrame(()=>{focusNode(id);openTPop(id)});return}
 const d=t.closest("[data-del]");if(d){if(!d.classList.contains("sure")){d.classList.add("sure");d.textContent="Tap again to remove";setTimeout(()=>{if(d.isConnected){d.classList.remove("sure");d.textContent="Remove"}},3000);return}
  R.list.splice(R.i,1);changed();toast(`${R.p.n||"Name"} removed`);return}
 selRow(row);if(t.closest(".ed"))return;
 if(HL){HL=null;render()}});
function selRow(row){SEL=row.dataset.id;main.querySelectorAll(".row.sel").forEach(r=>{if(r!==row)r.classList.remove("sel")});row.classList.add("sel")}
/* typing straight into the card */
function focusEd(id,f){const el=main.querySelector(`[data-id="${id}"] .ed[data-f="${f}"]`);if(!el)return;el.scrollIntoView({block:"center",behavior:"smooth"});el.focus()}
main.addEventListener("focusin",e=>{const el=e.target.closest(".ed");if(!el)return;{const rw=el.closest(".row");if(rw)selRow(rw)}const r=findP(el.closest("[data-id]").dataset.id);if(r&&r.p.ph&&el.dataset.f==="n"){el.dataset.was=el.textContent;el.textContent=""}});
main.addEventListener("input",e=>{const el=e.target.closest(".ed");if(!el)return;const r=findP(el.closest("[data-id]").dataset.id);if(!r)return;
 r.p[el.dataset.f]=el.textContent.replace(/\s+/g," ").trim();if(el.dataset.f==="n")r.p.ph=false;save()});
main.addEventListener("focusout",e=>{const el=e.target.closest(".ed");if(!el)return;const r=findP(el.closest("[data-id]").dataset.id);if(!r)return;
 if(el.dataset.was!=null&&!el.textContent.trim()){el.textContent=el.dataset.was;delete el.dataset.was;return}
 delete el.dataset.was;const v=el.textContent.replace(/\s+/g," ").trim();if(el.textContent!==v)el.textContent=v;
 if(el.dataset.f==="n"&&r.p.fresh){if(!v){r.list.splice(r.i,1);setTimeout(()=>{render();save();LASTJSON=JSON.stringify(DATA)},0);return}delete r.p.fresh}
 setTimeout(()=>{commit();if(!main.contains(SR.activeElement)||!SR.activeElement.closest(".ed"))render()},0)});
main.addEventListener("keydown",e=>{const el=e.target.closest(".ed");if(!el)return;if(e.key==="Escape"){el.blur();return}if(e.key!=="Enter")return;e.preventDefault();
 const R=findP(el.closest("[data-id]").dataset.id);if(!R||el.dataset.f!=="n"||!R.par){el.blur();return}
 const v=el.textContent.replace(/\s+/g," ").trim();
 if(!v){if(R.p.fresh){R.list.splice(R.i,1);delete el.dataset.was;changed()}else el.blur();return}
 if(R.p.fresh||R.i===R.list.length-1){R.p.n=v;R.p.ph=false;delete R.p.fresh;delete el.dataset.was;const c=newPerson("");c.fresh=true;R.list.splice(R.i+1,0,c);changed();focusEd(c.id,"n")}else el.blur()});
main.addEventListener("paste",e=>{const el=e.target.closest(".ed");if(!el)return;e.preventDefault();document.execCommand("insertText",false,(e.clipboardData||window.clipboardData).getData("text").replace(/\s+/g," "))});
function setView(v){VIEW=v;["all","fam","fill","tree"].forEach(k=>$id("v"+{all:"All",fam:"Fam",fill:"Fill",tree:"Tree"}[k]).setAttribute("aria-pressed",v===k));render()}
$id("vTree").onclick=()=>{HL=null;setView("tree")};
$id("vAll").onclick=()=>{HL=null;setView("all")};$id("vFam").onclick=()=>{HL=null;setView("fam")};$id("vFill").onclick=()=>{HL=null;setView("fill");window.scrollTo({top:SR.querySelector(".bar").offsetTop})};
const eb=$id("editBtn");eb.onclick=()=>{EDIT=!EDIT;eb.classList.toggle("on",EDIT);eb.setAttribute("aria-pressed",EDIT);eb.textContent=EDIT?"Done with sections":"Sections";if(EDIT&&VIEW!=="all")setView("all");else render();if(!EDIT)closeSheet();else toast("Rename, move or delete sections, and add new families or sections",false)};
$id("jump").onchange=e=>{const v=e.target.value;if(v&&VIEW==="tree"){focusHub(v);e.target.value="";return}if(v){$id("s-"+v).scrollIntoView({behavior:"smooth"});e.target.value=""}};
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&ROOT.isConnected)closeSheet()});
window.addEventListener("keydown",e=>{if(!ROOT.isConnected||!(e.ctrlKey||e.metaKey)||e.key.toLowerCase()!=="z"||e.shiftKey)return;const a=SR.activeElement;e.stopImmediatePropagation();if(a&&(a.isContentEditable||/^(INPUT|TEXTAREA)$/.test(a.tagName)))return;e.preventDefault();undo()},true);
/* ---------- start ---------- */
let local=null;try{local=JSON.parse(localStorage.getItem(LS)||"null")}catch(e){}
if(store.mode==="live")DATA=[];   // the real list only ever comes from the database (or this phone's saved copy of it)
if(local&&local.data&&store.mode==="live"){try{DATA=JSON.parse(local.data);VERSION=local.v||0}catch(e){}}
render();LASTJSON=JSON.stringify(DATA);setSave("");
if(store.me&&store.roleOf(store.me)==="view")ROOT.classList.add("ro");
(async()=>{if(store.mode!=="live"){setSave("Sample copy · saved in this browser");return}
 const sb=store.sb;let res;
 try{res=await sb.from("family_register").select("data,version,updated_by_name,updated_at").eq("id","main").maybeSingle()}catch(e){res={error:e}}
 if(res.error){if(isNet(res.error)){setSave("Offline · showing the copy on this phone");return}
  const s=$id("setup");s.hidden=false;s.innerHTML=store.me&&store.me.isAdmin?"<b>One step to switch this on.</b> Run database update 16 (supabase/016_our_family.sql) in Supabase → SQL Editor. Until then, changes here stay on this phone only.":"<b>Not switched on yet.</b> The admin needs to run one database update. Until then, changes here stay on this phone only.";
  setSave("Kept on this phone");return}
 LIVE=true;const row=res.data;
 if(row){const theirs=row.version||0;
  if(local&&local.dirty&&local.v===theirs&&local.data!==JSON.stringify(row.data)){VERSION=theirs;dirty=true;push()}   // finish sending what was made offline
  else{VERSION=theirs;DATA=row.data;lastSaved=JSON.stringify(DATA);render();LASTJSON=lastSaved;cacheLocal(false);setSave("All changes saved")}}
 else{LIVE=false;const s=$id("setup");s.hidden=false;s.innerHTML=store.me&&store.me.isAdmin?"<b>The family's list isn't loaded yet.</b> Run the second part of update 16 (016_our_family_list.sql) in Supabase → SQL Editor, then reload this page.":"<b>The family's list isn't loaded yet.</b> The admin needs to load it once.";setSave("Not loaded yet")}
 sb.channel("family-register").on("postgres_changes",{event:"*",schema:"public",table:"family_register"},p=>{if(p.new&&p.new.id==="main")applyRemote(p.new)}).subscribe()})();

/* ---------- meat, passed away, ancestor line ---------- */
main.addEventListener("click",e=>{const t=e.target;
 const fm=t.closest("[data-fmeat]");if(fm){const r=findP(fm.dataset.fmeat);if(r){r.p.meat=!r.p.meat;changed();toast(`${r.p.n}: ${r.p.meat?"gets meat":"no meat"}`)}return}
 const ua=t.closest("[data-unanc]");if(ua){const r=findP(ua.dataset.unanc);if(r){delete r.p.anc;changed();toast(`${r.p.n} shown as a person again`)}return}
 const b=t.closest("[data-meat],[data-dead],[data-anc]");if(!b)return;const row=b.closest(".row");if(!row)return;const r=findP(row.dataset.id);if(!r)return;const p=r.p;
 if(b.hasAttribute("data-meat")){p.meat=!p.meat;changed();toast(`${p.n||"Name"}: ${p.meat?"gets meat":"no meat"}`)}
 else if(b.hasAttribute("data-dead")){p.d=!p.d;changed();toast(`${p.n||"Name"}: ${p.d?"passed away":"living"}`)}
 else{p.anc=true;changed();toast(`${p.n} now shown only as part of the family line`)}});

/* ---------- type many children at once ---------- */
function manyBox(R){main.querySelectorAll(".many").forEach(x=>x.remove());const row=main.querySelector(`.row[data-id="${R.p.id}"]`);if(!row)return;
 const box=document.createElement("div");box.className="many";
 box.innerHTML=`<label class="fl">Children of ${esc(R.p.n)}, eldest first. Separate names with commas or new lines.<textarea rows="3" placeholder="Neli, Kaikho, Losa, Matia"></textarea></label><div class="acts"><button class="btn" data-go>Add them</button><button class="btn" data-x>Cancel</button></div>`;
 row.after(box);const ta=box.querySelector("textarea");ta.focus();
 box.querySelector("[data-x]").onclick=()=>box.remove();
 box.querySelector("[data-go]").onclick=()=>{const names=ta.value.split(/[,\n]/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean);if(!names.length){box.remove();return}
  R.p.k=R.p.k||[];names.forEach(n=>R.p.k.push(newPerson(n)));changed();toast(`${names.length} added under ${R.p.n}`)}}

/* ---------- search ---------- */
const sq=$id("q"),sr=$id("qres");
function pathOf(r){const s=r.s.title;if(!r.par)return s;const par=r.par;return `${par.g==="F"?"Daughter's":"Child of"} ${(par.pre?par.pre+" ":"")+par.n}`.replace("Daughter's","Child of")+" · "+s}
function runSearch(){const q=sq.value.trim().toLowerCase();if(!q){sr.hidden=true;sr.innerHTML="";return}const hits=[];
 walk((p,par,d,s)=>{if(hits.length>=40||p.ref)return;const hay=(p.n+" "+(p.sp||"")+" "+(p.vil||"")).toLowerCase();if(hay.includes(q))hits.push({p,par,s})});
 sr.innerHTML=hits.length?hits.map(h=>`<button data-go="${h.p.id}"><b>${esc((h.p.pre?h.p.pre+" ":"")+h.p.n)}</b>${h.p.sp?` · married to ${esc(h.p.sp)}`:""}${h.p.d?" †":""}<small>${esc(pathOf(h))}${CARDNO[h.p.id]?` · Card ${CARDNO[h.p.id]}`:FAMOF[h.p.id]&&CARDNO[FAMOF[h.p.id]]?` · on Card ${CARDNO[FAMOF[h.p.id]]}`:""}${h.p.vil?" · "+esc(h.p.vil):""}${h.p.anc?" · family line":""}</small></button>`).join(""):`<p>No one called “${esc(sq.value)}”.</p>`;sr.hidden=false}
sq.addEventListener("input",runSearch);sq.addEventListener("focus",runSearch);
sq.addEventListener("keydown",e=>{if(e.key==="Escape"){sq.value="";runSearch();sq.blur()}if(e.key==="Enter"){const f=sr.querySelector("[data-go]");if(f)f.click()}});
document.addEventListener("click",e=>{if(!e.composedPath().some(n=>n.classList&&n.classList.contains("search")))sr.hidden=true});
sr.addEventListener("click",e=>{const b=e.target.closest("[data-go]");if(!b)return;const id=b.dataset.go;const r=findP(id);if(!r)return;
 sr.hidden=true;if(VIEW==="tree"){focusNode(id);openTPop(id);return}if(COLL.has(r.s.id)){COLL.delete(r.s.id);try{localStorage.setItem("fwp-family-fold",JSON.stringify([...COLL]))}catch(x){}}
 HL=null;SEL=id;if(VIEW!=="all")setView("all");else render();
 requestAnimationFrame(()=>{const el=main.querySelector(`[data-id="${id}"]`);if(el){el.scrollIntoView({block:"center",behavior:"smooth"});el.classList.add("flash");setTimeout(()=>el.classList.remove("flash"),2200)}})});

/* ---------- Word export ---------- */
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function zip(files){const enc=new TextEncoder(),parts=[],cen=[];let off=0;
 files.forEach(([name,text])=>{const nb=enc.encode(name),db=enc.encode(text),crc=crc32(db);
  const h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint32(14,crc,true);h.setUint32(18,db.length,true);h.setUint32(22,db.length,true);h.setUint16(26,nb.length,true);
  parts.push(new Uint8Array(h.buffer),nb,db);
  const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint32(16,crc,true);c.setUint32(20,db.length,true);c.setUint32(24,db.length,true);c.setUint16(28,nb.length,true);c.setUint32(42,off,true);
  cen.push(new Uint8Array(c.buffer),nb);off+=30+nb.length+db.length});
 const cs=cen.reduce((a,x)=>a+x.length,0);const end=new DataView(new ArrayBuffer(22));end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,cs,true);end.setUint32(16,off,true);
 return new Blob([...parts,...cen,new Uint8Array(end.buffer)])}
const X=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const W={p:(t,o={})=>`<w:p>${o.style?`<w:pPr><w:pStyle w:val="${o.style}"/></w:pPr>`:""}<w:r>${o.b?"<w:rPr><w:b/></w:rPr>":""}<w:t xml:space="preserve">${X(t)}</w:t></w:r></w:p>`,
 cell:(t,w,head)=>`<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${head?'<w:shd w:val="clear" w:color="auto" w:fill="E9E4D8"/>':""}</w:tcPr><w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr><w:r>${head?"<w:rPr><w:b/></w:rPr>":""}<w:t xml:space="preserve">${X(t)}</w:t></w:r></w:p></w:tc>`,
 table:(heads,widths,rows)=>`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="${widths.reduce((a,b)=>a+b,0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid><w:tr><w:trPr><w:tblHeader/></w:trPr>${heads.map((h,i)=>W.cell(h,widths[i],true)).join("")}</w:tr>${rows.map(r=>`<w:tr><w:trPr><w:cantSplit/></w:trPr>${r.map((c,i)=>W.cell(c,widths[i])).join("")}</w:tr>`).join("")}</w:tbl>`};
function nm(p,pre){return ((pre?pre+" ":"")+(p.n||"")).trim()+(p.d?" †":"")}
function cardMembers(fid){const r=findP(fid);const out=[];if(!r)return out;const p=r.p;
 out.push({name:nm(p,p.pre||(r.par?ini(fatherOf(r.par)):"")),rel:"Head of family",m:p.m,sp:p.sp?(p.sp+(p.sd?" †":"")):"",meat:p.meat,note:p.note});
 (function Wk(list,parent){const pre=ini(fatherOf(parent));list.forEach(k=>{if(k.ph&&!k.n)return;
  if(CARDNO[k.id]||isFam(k,false)){out.push({name:nm(k,k.pre||pre),rel:`${k.g==="F"?"Daughter":k.g==="M"?"Son":"Child"} of ${parent.n}`,m:k.m,sp:k.sp||"",meat:k.meat,note:CARDNO[k.id]?`Own card: Card ${CARDNO[k.id]}`:"Own family"});return}
  if(k.anc)return;out.push({name:nm(k,k.ph?"":(k.pre||pre)),rel:`${k.g==="F"?"Daughter":k.g==="M"?"Son":"Child"} of ${parent.n}`,m:k.m,sp:k.sp||"",meat:k.meat,note:[k.note,k.conf?"To confirm: "+k.conf:""].filter(Boolean).join(" · ")});Wk(k.k||[],k)})})(p.k||[],p);
 return out}
function buildDocx(){computeFamilies();const cards=[],nocard=[];
 numberedSecs().forEach(s=>walkSec(s,(p,top)=>{if(!isFam(p,top))return;(CARDNO[p.id]?cards:nocard).push({p,s})}));cards.sort((a,b)=>CARDNO[a.p.id]-CARDNO[b.p.id]);
 const today=new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"});let body="";
 body+=W.p("Our Relatives — Wedding Card List",{style:"Title"})+W.p(`Made on ${today}. Card 1 is our own family, then Dad's side, then Mum's side. Names are written with the father's name first. † = passed away.`);
 let meat=0;walk(p=>{if(p.meat&&!p.d)meat++});
 body+=W.p(`${cards.length} numbered cards · ${meat} meat portion${meat===1?"":"s"}`,{b:1});
 body+=W.p("1. Card list",{style:"Heading1"});
 body+=W.table(["Card","Family","Village","People","Meat"],[800,4600,2600,1100,1000],cards.map(({p,s})=>[CARDNO[p.id],famName(p)+" family",p.vil||"",cardCount(p.id),famMeat(p)||""]));
 body+=W.p("2. Every family, with names in order",{style:"Heading1"});
 cards.forEach(({p,s})=>{const mem=cardMembers(p.id);
  body+=W.p(`Card ${CARDNO[p.id]} — ${famName(p)} family`,{style:"Heading2"})+W.p(`Village: ${p.vil||"not filled in yet"}${famMeat(p)?` · Meat: ${famMeat(p)}`:""}`);
  body+=W.table(["No.","Name","Relation","Married","Spouse","Meat","Note"],[500,2000,1900,900,1700,600,1700],mem.map((m,i)=>[i+1,m.name,m.rel,m.m==="married"?"Married":m.m==="engaged"?"Engaged":"Unmarried",m.sp,m.meat?"Yes":"",m.note||""]))});
 if(nocard.length){body+=W.p("Families without a card number",{style:"Heading1"});
  nocard.forEach(({p,s})=>{body+=W.p(`${famName(p)} family`,{style:"Heading2"})+W.table(["No.","Name","Relation","Married","Spouse","Meat","Note"],[500,2000,1900,900,1700,600,1700],cardMembers(p.id).map((m,i)=>[i+1,m.name,m.rel,m.m==="married"?"Married":"Unmarried",m.sp,m.meat?"Yes":"",m.note||""]))})}
 body+=W.p("3. Everyone, in order",{style:"Heading1"});let n=0;const rows=[];
 DATA.forEach(s=>{(function Wk(list,parent,top){list.forEach(p=>{if(p.ref||(p.ph&&!p.n))return;if(p.anc){Wk(p.k||[],p,true);return}
  const fid=FAMOF[p.id];rows.push([++n,nm(p,p.pre||(parent?ini(fatherOf(parent)):"")),parent?(parent.pre?parent.pre+" ":"")+parent.n:"",p.m==="married"?"Married":p.m==="engaged"?"Engaged":"Unmarried",p.sp||"",CARDNO[p.id]||(fid&&CARDNO[fid]?CARDNO[fid]:""),FAMOF[p.id]&&findP(FAMOF[p.id])?.p.vil||"",p.meat?"Yes":""]);Wk(p.k||[],p,false)})})(s.people,null,true)});
 body+=W.table(["S.No","Name","Child of","Married","Spouse","Card","Village","Meat"],[600,2300,1800,1000,1700,600,1400,600],rows);
 const lines=[];DATA.forEach(s=>walkSec(s,p=>{if(p.anc&&(p.k||[]).some(k=>!k.anc)){const ch=[];let x=findP(p.id);while(x&&x.p.anc){ch.unshift(x.p.n);x=x.par?findP(x.par.id):null}lines.push(`${ch.join(" → ")} → ${(p.k||[]).filter(k=>!k.anc).map(k=>k.n).join(", ")}`)}}));
 if(lines.length){body+=W.p("4. Family lines (ancestors)",{style:"Heading1"});lines.forEach(l=>body+=W.p(l))}
 const doc=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="700" w:bottom="900" w:left="700" w:header="400" w:footer="400" w:gutter="0"/></w:sectPr></w:body></w:document>`;
 const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="19"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="120"/></w:pPr><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:sz w:val="40"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="320" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:sz w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="220" w:after="40"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="23"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="BFB8A8"/><w:left w:val="single" w:sz="4" w:color="BFB8A8"/><w:bottom w:val="single" w:sz="4" w:color="BFB8A8"/><w:right w:val="single" w:sz="4" w:color="BFB8A8"/><w:insideH w:val="single" w:sz="4" w:color="BFB8A8"/><w:insideV w:val="single" w:sz="4" w:color="BFB8A8"/></w:tblBorders><w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
 return zip([["[Content_Types].xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`],
  ["_rels/.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`],
  ["word/_rels/document.xml.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
  ["word/document.xml",doc],["word/styles.xml",styles]])}
$id("expBtn").onclick=()=>{const blob=buildDocx();const d=new Date();const fn=`Our Family card list ${d.getDate()}-${d.getMonth()+1}-${d.getFullYear()}.docx`;
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fn;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);toast("Word file downloaded",false)};
$id("undoBtn").onclick=()=>undo();undoBtn();

/* ---------- village autofill: remembers every village typed so far ---------- */
const AC=document.createElement("div");AC.className="ac";AC.hidden=true;ROOT.appendChild(AC);let acEl=null,acI=0,acList=[];
function villages(){const m=new Map();walk(p=>{const v=String(p.vil||"").trim();if(v)m.set(v.toLowerCase(),v)});return [...m.values()].sort((a,b)=>a.localeCompare(b))}
function acShow(el){const q=el.textContent.replace(/\s+/g," ").trim().toLowerCase();acEl=el;
 acList=q?villages().filter(v=>v.toLowerCase().startsWith(q)&&v.toLowerCase()!==q).concat(villages().filter(v=>!v.toLowerCase().startsWith(q)&&v.toLowerCase().includes(q))).slice(0,6):villages().slice(0,6);
 if(!acList.length){AC.hidden=true;return}acI=0;acDraw();const r=el.getBoundingClientRect();AC.style.left=Math.max(8,Math.min(r.left,innerWidth-248))+"px";AC.style.top=(r.bottom+4)+"px";AC.hidden=false}
function acDraw(){AC.innerHTML=acList.map((v,i)=>`<button data-v="${esc(v)}" class="${i===acI?"on":""}">${esc(v)}</button>`).join("")+`<small>Enter, Tab or → to fill · ↑ ↓ to choose</small>`}
function acTake(v){if(!acEl)return;const el=acEl;el.textContent=v;const r=findP(el.closest("[data-id]").dataset.id);if(r){r.p.vil=v;save()}AC.hidden=true;
 const rg=document.createRange();rg.selectNodeContents(el);rg.collapse(false);const sel=selOf();sel.removeAllRanges();sel.addRange(rg)}
main.addEventListener("input",e=>{const el=e.target.closest('.ed[data-f="vil"]');if(el)acShow(el)});
main.addEventListener("focusin",e=>{const el=e.target.closest('.ed[data-f="vil"]');if(el)acShow(el)});
main.addEventListener("focusout",e=>{if(e.target.closest('.ed[data-f="vil"]'))setTimeout(()=>{if(!AC.matches(":hover"))AC.hidden=true},120)});
main.addEventListener("keydown",e=>{if(AC.hidden||!e.target.closest('.ed[data-f="vil"]'))return;
 if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();acI=(acI+(e.key==="ArrowDown"?1:acList.length-1))%acList.length;acDraw();return}
 if(e.key==="Enter"||e.key==="Tab"||e.key==="ArrowRight"){const sel=selOf();if(e.key==="ArrowRight"&&sel.focusOffset<e.target.textContent.length)return;
  e.preventDefault();e.stopImmediatePropagation();acTake(acList[acI]);if(e.key==="Enter")e.target.blur()}
 if(e.key==="Escape")AC.hidden=true},true);
AC.addEventListener("mousedown",e=>{const b=e.target.closest("[data-v]");if(!b)return;e.preventDefault();acTake(b.dataset.v)});
addEventListener("scroll",()=>{if(!AC.hidden&&acEl){const r=acEl.getBoundingClientRect();AC.style.top=(r.bottom+4)+"px"}},{passive:true});


/* ---------- Tree: the same register seen from above ----------
   Our family in the centre, Dad's side to the right, Mum's side to the left, other sections below.
   Each part of the register is a wedge; heads of families sit on the first ring, their children on the next, and so on.
   Everything is drawn from DATA, so any change in the register shows here at once. */
const SVGNS="http://www.w3.org/2000/svg";
let TR={k:.35,x:0,y:0,init:false},TSEL=null,TNODES={},THUBS={};
const RAD=d=>d*Math.PI/180,TREE_R0=760,TREE_STEP=380;
const SHORT={};
function tWeight(p){if(p.ref)return 0;const ks=(p.k||[]).filter(k=>!k.ref);return ks.length?Math.max(1,ks.reduce((a,c)=>a+tWeight(c),0)):1}
function treeLayout(){const nodes=[],links=[],hubs=[];TNODES={};THUBS={};
 const R0=TREE_R0,STEP=TREE_STEP;
 function place(list,a0,a1,depth,par,r,step,sec){const L=list.filter(p=>!p.ref);const tot=L.reduce((a,p)=>a+tWeight(p),0)||1;let a=a0;
  L.forEach(p=>{const w=tWeight(p)/tot*(a1-a0),am=a+w/2;
   const n={p,a:am,r,w,x:r*Math.cos(RAD(am)),y:r*Math.sin(RAD(am)),depth,par,sec,kids:(p.k||[]).filter(k=>!k.ref).length};
   nodes.push(n);TNODES[p.id]=n;if(par)links.push([par,n]);
   if(n.kids)place(p.k,a,a+w,depth+1,n,r+(p.anc?step*.5:step),step,sec);a+=w})}
 // centre: our own family
 const ourSec=DATA.find(s=>s.side==="Our family");let centre=null;
 if(ourSec&&ourSec.people.length){const p=ourSec.people[0];centre={p,a:-90,r:0,x:0,y:0,depth:-1,centre:true,sec:ourSec,kids:(p.k||[]).length};TNODES[p.id]=centre;nodes.push(centre);
  if(p.k&&p.k.length)place(p.k,-132,-48,0,centre,260,260,ourSec);
  ourSec.people.slice(1).forEach((q,i)=>{const n={p:q,a:-90,r:0,x:0,y:150+i*40,depth:0,sec:ourSec,kids:0};nodes.push(n);TNODES[q.id]=n})}
 function side(secs,a0,a1,mirror){const n0=nodes.length,h0=hubs.length;const live=secs.map(s=>({s,w:s.people.reduce((a,p)=>a+tWeight(p),0)})).filter(x=>x.w>0);if(!live.length)return;
  const gap=4,span=a1-a0-gap*(live.length-1),tot=live.reduce((a,x)=>a+x.w,0);let a=a0;
  live.forEach(({s,w})=>{const ww=Math.max(6,w/tot*span),am=a+ww/2,hr=R0-330;
   const hub={s,a:am,x:hr*Math.cos(RAD(am)),y:hr*Math.sin(RAD(am)),a0:a,a1:a+ww};hubs.push(hub);THUBS[s.id]=hub;
   place(s.people,a,a+ww,0,hub,R0,STEP,s);a+=ww+gap});
  if(mirror){const mir=o=>{o.a=180-o.a;const r=Math.hypot(o.x,o.y);o.x=r*Math.cos(RAD(o.a));o.y=r*Math.sin(RAD(o.a))};
   nodes.slice(n0).forEach(mir);hubs.slice(h0).forEach(h=>{mir(h);const b0=180-h.a1,b1=180-h.a0;h.a0=b0;h.a1=b1})}}
 side(DATA.filter(s=>s.side==="Dad's side"),-74,74);
 side(DATA.filter(s=>s.side==="Mum's side"),-74,74,true);
 side(DATA.filter(s=>!["Our family","Dad's side","Mum's side"].includes(s.side)),78,102);
 return {nodes,links,hubs,centre}}
function el(tag,attrs,parent){const e=document.createElementNS(SVGNS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e}
function linkPath(a,b){if(a.centre||a.r===undefined&&a.x===0)return `M${a.x},${a.y}L${b.x},${b.y}`;
 const ra=Math.hypot(a.x,a.y),rb=Math.hypot(b.x,b.y),aa=Math.atan2(a.y,a.x),ab=Math.atan2(b.y,b.x),rm=(ra+rb)/2;
 return `M${a.x},${a.y}C${rm*Math.cos(aa)},${rm*Math.sin(aa)} ${rm*Math.cos(ab)},${rm*Math.sin(ab)} ${b.x},${b.y}`}
function treeShell(){return `<div class="treewrap" id="fr-tw"><svg id="fr-tsvg" aria-label="Family tree"><g id="fr-tg"></g></svg>
 <div class="tctl"><button data-tz="in" aria-label="Zoom in">+</button><button data-tz="out" aria-label="Zoom out">−</button><button data-tz="fit" aria-label="Show everything">⤢</button></div>
 <div class="tleg"><span><i style="background:var(--c0)"></i>Each colour is one family</span><span><i style="background:var(--coral)"></i>Meat</span><span><i style="border:1.5px dashed var(--faint);width:8px;height:8px"></i>Ancestor line</span><span>Tap anyone to edit</span></div>
 <div class="tpop" id="fr-tpop" hidden></div></div>`}
function drawTree(){const svg=$id("tsvg"),g=$id("tg");if(!svg)return;g.innerHTML="";
 const {nodes,links,hubs,centre}=treeLayout();
 const maxR=nodes.reduce((m,n)=>Math.max(m,Math.hypot(n.x,n.y)),600);
 // orbits and side names
 const WG=el("g",{},g);
 for(let r=TREE_R0;r<=maxR+10;r+=TREE_STEP)el("circle",{class:"ring",cx:0,cy:0,r},g);
 const sd=el("text",{class:"side","text-anchor":"start",x:maxR*.18,y:-maxR*.98},g);sd.textContent="Dad's side →";
 const sm=el("text",{class:"side","text-anchor":"end",x:-maxR*.18,y:-maxR*.98},g);sm.textContent="← Mum's side";
 // links
 const LG=el("g",{},g);
 hubs.forEach(h=>{if(centre)el("path",{class:"lk",d:`M0,0L${h.x},${h.y}`,style:"stroke:var(--accent)"},LG)});
 links.forEach(([a,b])=>{const f=FAMOF[b.p.id]||b.p.id;el("path",{class:"lk"+(b.p.anc||a.p&&a.p.anc?" anc":""),d:linkPath(a,b),style:`stroke:${col(f)}`},LG)});
 // hubs: one per part of the register
 hubs.forEach(h=>{const hg=el("g",{class:"hub",transform:`translate(${h.x},${h.y})`},g);
  el("circle",{r:8,style:"fill:var(--card);stroke:var(--accent);stroke-width:2;vector-effect:non-scaling-stroke"},hg);
  // a soft wedge marks the part of the register this belongs to
  const r1=TREE_R0-120,r2=maxR+60,a0=RAD(h.a0-1),a1=RAD(h.a1+1),big=(h.a1-h.a0)>180?1:0;
  el("path",{class:"wedge",d:`M${r1*Math.cos(a0)},${r1*Math.sin(a0)}A${r1},${r1} 0 ${big} 1 ${r1*Math.cos(a1)},${r1*Math.sin(a1)}L${r2*Math.cos(a1)},${r2*Math.sin(a1)}A${r2},${r2} 0 ${big} 0 ${r2*Math.cos(a0)},${r2*Math.sin(a0)}Z`},WG);
  let am=((h.a%360)+360)%360;const flip=am>90&&am<270;const rr=maxR+90;
  const cg=el("g",{class:"cap",transform:`rotate(${h.a}) translate(${rr},0) rotate(${flip?180:0})`},g);
  const c1=el("text",{"text-anchor":flip?"end":"start",dy:".35em"},cg);c1.textContent=h.s.short||SHORT[h.s.id]||h.s.title;
  });
 // people
 const NG=el("g",{},g);
 nodes.forEach(n=>{const p=n.p,top=!n.par||n.par.s,isF=n.centre||isFam(p,!!(n.par&&n.par.s));const f=FAMOF[p.id]||p.id;
  const cls=["tn",p.ph?"ph":"",isF?"fam":"",n.kids?"":"leaf",p.d?"dead":"",p.anc?"anc":"",(n.centre||(n.par&&n.par.s)||(isF&&CARDNO[p.id]))?"big":"",TSEL===p.id?"hit":""].filter(Boolean).join(" ");
  const ng=el("g",{class:cls,"data-tid":p.id,transform:`translate(${n.x},${n.y})`},NG);
  if(n.centre){el("circle",{r:150,style:"fill:color-mix(in srgb,var(--accent) 10%,var(--card));stroke:var(--accent);stroke-width:1.5;vector-effect:non-scaling-stroke"},ng);
   const c=el("g",{class:"ctr"},ng);const t=el("text",{"text-anchor":"middle",dy:"-.1em",style:"font-size:calc(24px / var(--k,1))"},c);t.textContent="Our Family";
   const t2=el("text",{"text-anchor":"middle",dy:"1.7em",style:"font-size:calc(12px / var(--k,1));font-family:var(--sans);font-weight:400;fill:var(--muted)"},c);t2.textContent=famName(p);return}
  const rr=isF?11:6;
  el("circle",{class:"o",r:rr,style:p.anc?"fill:var(--card);stroke:var(--faint);stroke-dasharray:3 3;stroke-width:1.5;vector-effect:non-scaling-stroke":p.d?"fill:var(--card);stroke:var(--gone);stroke-width:1.5;vector-effect:non-scaling-stroke":isF?`fill:${col(f)};stroke:var(--card);stroke-width:2;vector-effect:non-scaling-stroke`:`fill:var(--card);stroke:${col(f)};stroke-width:2;vector-effect:non-scaling-stroke`},ng);
  if(p.meat&&!p.d)el("circle",{r:4.5,cx:rr*.8,cy:-rr*.8,style:"fill:var(--coral);stroke:var(--card);stroke-width:1.5;vector-effect:non-scaling-stroke"},ng);
  const pre=p.pre||(n.par&&n.par.p&&!n.par.s&&!n.par.centre?ini(fatherOf(n.par.p)):n.par&&n.par.centre?ini(fatherOf(n.par.p)):"");
  const label=(isF&&!n.kids?"":"")+((pre?pre+" ":"")+(p.n||"…"))+(p.d?" †":"")+(CARDNO[p.id]?"  · "+CARDNO[p.id]:"");
  let a=((n.a%360)+360)%360;const flip=a>90&&a<270;const inward=!!n.kids;const dir=(inward?-1:1)*(flip?-1:1);
  const t=el("text",{"text-anchor":dir>0?"start":"end",x:dir*(rr+7),dy:".34em",transform:`rotate(${flip?a-180:a})`,class:isF?"h":""},ng);
  const txt=p.ph?"":label+(p.sp&&isF&&!n.kids?"  & "+p.sp:"");t.textContent=txt;
  ng.dataset.slot=(RAD(n.w||0)*n.r).toFixed(1);ng.dataset.len=txt.length*(isF?8.6:7);
  ng.dataset.room=inward?Math.max(0,(n.depth===0?n.r-(TREE_R0-330):n.r-(n.par&&n.par.r!=null?n.par.r:0))-30):99999});
 treeApply();if(!TR.init){treeFit();TR.init=true}
 if(TSEL&&TNODES[TSEL])openTPop(TSEL)}
function treeApply(){const g=$id("tg"),svg=$id("tsvg");if(!g)return;g.setAttribute("transform",`translate(${TR.x},${TR.y}) scale(${TR.k})`);
 svg.style.setProperty("--k",TR.k);
 // show a name only when it has room at this zoom
 svg.querySelectorAll(".tn[data-slot]").forEach(n=>{const side=+n.dataset.slot*TR.k,len=+n.dataset.len/TR.k;n.classList.toggle("nolab",side<(n.classList.contains("fam")?15:12.5)||len>+n.dataset.room)});
 svg.classList.toggle("vfar",TR.k<.12);positionTPop()}
function treeFit(){const w=$id("tw");if(!w)return;const W=w.clientWidth,H=w.clientHeight;let m=600;Object.values(TNODES).forEach(n=>m=Math.max(m,Math.hypot(n.x,n.y)));
 TR.k=Math.max(.05,(Math.min(W,H)/2-(W<600?50:160))/(m+60));TR.x=W/2;TR.y=H/2;treeApply()}
function treeZoom(f,cx,cy){const w=$id("tw");if(!w)return;if(cx==null){cx=w.clientWidth/2;cy=w.clientHeight/2}
 const k=Math.max(.08,Math.min(4,TR.k*f));TR.x=cx-(cx-TR.x)*(k/TR.k);TR.y=cy-(cy-TR.y)*(k/TR.k);TR.k=k;treeApply()}
function focusNode(id){const n=TNODES[id],w=$id("tw");if(!n||!w)return;TR.k=Math.max(TR.k,1.1);TR.x=w.clientWidth/2-n.x*TR.k;TR.y=w.clientHeight/2-n.y*TR.k;TSEL=id;drawTree();
 const ng=SR.querySelector(`[data-tid="${id}"]`);if(ng){const c=el("circle",{class:"pulse",r:20},ng)}}
function focusHub(sid){const h=THUBS[sid],w=$id("tw");if(!h||!w)return;const r=900,mx=Math.cos(RAD((h.a0+h.a1)/2))*(TREE_R0+r/2),my=Math.sin(RAD((h.a0+h.a1)/2))*(TREE_R0+r/2);
 TR.k=Math.max(.5,Math.min(1.2,Math.min(w.clientWidth,w.clientHeight)/(r*1.6)));TR.x=w.clientWidth/2-mx*TR.k;TR.y=w.clientHeight/2-my*TR.k;treeApply()}
/* pop-up card for one person */
function openTPop(id){const pop=$id("tpop");const r=findP(id),n=TNODES[id];if(!pop||!r||!n){if(pop)pop.hidden=true;return}const p=r.p;TSEL=id;
 const pre=p.pre||(r.par?ini(fatherOf(r.par)):"");const fid=FAMOF[p.id];const card=CARDNO[p.id]||(fid&&CARDNO[fid]);const fam=findP(fid);
 pop.innerHTML=`<button class="x" data-tp="close" aria-label="Close">×</button><h4><span class="pf">${esc(pre)}</span> ${esc(p.n||"Name")}${p.d?" †":""}</h4>
 <div class="mt">${p.sp?`<span>Married to <b>${esc(p.sp)}</b></span>`:""}${card?`<span>Card <b>${card}</b></span>`:""}${fam&&fam.p.vil?`<span>Village <b>${esc(fam.p.vil)}</b></span>`:""}<span>${esc(r.s.title)}</span>${r.par?`<span>Child of <b>${esc(r.par.n)}</b></span>`:""}</div>
 ${p.anc?`<div class="mt">Shown as part of a family line.</div>`:`<div class="acts"><button class="btn" data-tp="m">${p.m==="married"||p.m==="engaged"?"✓ Married":"Unmarried"}</button><button class="btn" data-tp="meat">${p.meat?"✓ Meat":"Meat"}</button><button class="btn" data-tp="dead">${p.d?"✓ Passed away":"Passed away"}</button></div>`}
 <div class="acts" style="display:flex"><input id="fr-tpk" placeholder="Add a child's name" aria-label="Add a child's name"><button class="btn" data-tp="kid">Add</button></div>
 <div class="acts"><button class="btn" data-tp="reg">Open in register</button></div>`;pop.hidden=false;positionTPop();
 SR.querySelectorAll(".tn.hit").forEach(x=>x.classList.remove("hit"));const ng=SR.querySelector(`[data-tid="${id}"]`);if(ng)ng.classList.add("hit")}
function positionTPop(){const pop=$id("tpop"),w=$id("tw");if(!pop||pop.hidden||!TSEL||!TNODES[TSEL]||!w)return;const n=TNODES[TSEL];
 const sx=TR.x+n.x*TR.k,sy=TR.y+n.y*TR.k,W=w.clientWidth,H=w.clientHeight,pw=pop.offsetWidth,ph=pop.offsetHeight;
 let x=sx+18,y=sy-ph/2;if(x+pw>W-10)x=sx-pw-18;if(x<10)x=Math.max(10,(W-pw)/2);y=Math.max(10,Math.min(H-ph-10,y));pop.style.left=x+"px";pop.style.top=y+"px"}
main.addEventListener("click",e=>{const b=e.target.closest("[data-tp]");if(!b)return;const r=findP(TSEL);const a=b.dataset.tp;
 if(a==="close"){TSEL=null;$id("tpop").hidden=true;SR.querySelectorAll(".tn.hit").forEach(x=>x.classList.remove("hit"));return}
 if(!r)return;const p=r.p;
 if(a==="m"){p.m=p.m==="married"||p.m==="engaged"?"single":"married";changed()}
 if(a==="meat"){p.meat=!p.meat;changed()}
 if(a==="dead"){p.d=!p.d;changed()}
 if(a==="kid"){const v=$id("tpk").value.replace(/\s+/g," ").trim();if(!v)return;(p.k=p.k||[]).push(newPerson(v));changed();toast(`${v} added under ${p.n}`);setTimeout(()=>{const i=$id("tpk");if(i)i.focus()},50)}
 if(a==="reg"){const id=TSEL;TSEL=null;SEL=id;setView("all");requestAnimationFrame(()=>{const el2=main.querySelector(`.row[data-id="${id}"]`);if(el2){el2.scrollIntoView({block:"center",behavior:"smooth"});el2.classList.add("flash")}})}});
main.addEventListener("keydown",e=>{if(e.target.id==="tpk"&&e.key==="Enter"){e.preventDefault();main.querySelector('[data-tp="kid"]').click()}});
/* pan, pinch and wheel */
(function(){let pts=new Map(),start=null,moved=0,pinch=null;
 main.addEventListener("pointerdown",e=>{const svg=e.target.closest("#fr-tsvg");if(!svg)return;svg.setPointerCapture(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=0;
  if(pts.size===1)start={x:e.clientX,y:e.clientY,tx:TR.x,ty:TR.y,t:e.target};
  if(pts.size===2){const [a,b]=[...pts.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),k:TR.k,tx:TR.x,ty:TR.y,cx:(a.x+b.x)/2,cy:(a.y+b.y)/2}}});
 main.addEventListener("pointermove",e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});const svg=$id("tsvg");const R=svg.getBoundingClientRect();
  if(pts.size===2&&pinch){const [a,b]=[...pts.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);const k=Math.max(.08,Math.min(4,pinch.k*d/pinch.d));const cx=pinch.cx-R.left,cy=pinch.cy-R.top;
   TR.x=cx-(cx-pinch.tx)*(k/pinch.k);TR.y=cy-(cy-pinch.ty)*(k/pinch.k);TR.k=k;moved=99;treeApply();return}
  if(start){const dx=e.clientX-start.x,dy=e.clientY-start.y;moved=Math.max(moved,Math.hypot(dx,dy));if(moved>4){svg.classList.add("drag");TR.x=start.tx+dx;TR.y=start.ty+dy;treeApply()}}});
 function up(e){if(!pts.has(e.pointerId))return;pts.delete(e.pointerId);const svg=$id("tsvg");if(svg)svg.classList.remove("drag");
  if(pts.size<2)pinch=null;
  if(!pts.size&&start){if(moved<=4){const ng=start.t.closest&&start.t.closest("[data-tid]");if(ng)openTPop(ng.dataset.tid);else{const pop=$id("tpop");if(pop)pop.hidden=true;TSEL=null;SR.querySelectorAll(".tn.hit").forEach(x=>x.classList.remove("hit"))}}start=null}}
 main.addEventListener("pointerup",up);main.addEventListener("pointercancel",up);
 main.addEventListener("wheel",e=>{const svg=e.target.closest("#fr-tsvg");if(!svg)return;e.preventDefault();const R=svg.getBoundingClientRect();treeZoom(Math.exp(-e.deltaY*.0015),e.clientX-R.left,e.clientY-R.top)},{passive:false});
 main.addEventListener("click",e=>{const z=e.target.closest("[data-tz]");if(!z)return;const v=z.dataset.tz;if(v==="fit")treeFit();else treeZoom(v==="in"?1.4:1/1.4)});
 addEventListener("resize",()=>{if(VIEW==="tree")treeApply()});})();

}
