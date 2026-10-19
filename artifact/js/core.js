// Core: data store (db capability), session, permissions, routing, shared domain rules.
(function () {
  const html = htm.bind(React.createElement);
  const { useState, useEffect } = React;

  const COLS = ['customers', 'suppliers', 'materials', 'processes', 'machines', 'users', 'parts', 'routings',
    'quotes', 'orders', 'workorders', 'jobcards', 'lots', 'subcons', 'inspections', 'ncrs', 'shipments',
    'documents', 'settings'];

  const store = {
    data: {}, ready: {}, mode: 'loading', db: null, assets: null, downloads: null,
    listeners: new Set(), toasts: [], dialog: null,
    route: { mod: 'genel', page: 'panel', rec: null }
  };
  COLS.forEach((c) => { store.data[c] = {}; });

  function emit() { store.listeners.forEach((f) => f()); }
  function useStore() {
    const [, set] = useState(0);
    useEffect(() => {
      const f = () => set((v) => v + 1);
      store.listeners.add(f);
      return () => store.listeners.delete(f);
    }, []);
    return store.data;
  }

  // ---- session (which ERP user is working on this device) ----
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }
  };
  const session = { uid: ls.get('erp.uid') };
  function currentUser() { return session.uid ? store.data.users[session.uid] || null : null; }
  function login(id) { session.uid = id; ls.set('erp.uid', id); store.route = { mod: 'genel', page: 'panel', rec: null }; emit(); }
  function logout() { session.uid = null; ls.set('erp.uid', null); emit(); }

  async function initStore() {
    const c = window.claude;
    let db = null;
    if (c && c.use) {
      const safe = (n) => c.use(n).catch(() => null);
      const [d, a, dl] = await Promise.all([safe('db'), safe('assets'), safe('downloads')]);
      db = d; store.assets = a; store.downloads = dl;
    }
    if (!db) { store.mode = 'local'; COLS.forEach((col) => { store.ready[col] = true; }); emit(); return; }
    store.db = db;
    store.mode = 'live';
    COLS.forEach((col) => {
      db.collection(col).onSnapshot((snap) => {
        const m = {};
        snap.docs.forEach((d) => { m[d.id] = Object.assign({}, d.data(), { id: d.id }); });
        store.data[col] = m;
        store.ready[col] = true;
        emit();
      }, (e) => { store.ready[col] = true; toast('Veri bağlantısı kesildi (' + col + '): ' + e.code, 'err'); emit(); });
    });
  }
  function allReady() { return COLS.every((c) => store.ready[c]); }

  // ---- formatting ----
  const pad = (n, w) => String(n).padStart(w || 2, '0');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const now = () => new Date().toISOString();
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  function addDays(iso, n) { const d = new Date((iso || today()) + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function daysBetween(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); }
  function fmtD(iso) { if (!iso) return '—'; const s = String(iso).slice(0, 10).split('-'); return s.length === 3 ? s[2] + '.' + s[1] + '.' + s[0] : iso; }
  function fmtDT(iso) { if (!iso) return '—'; const d = new Date(iso); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function fmtN(n, dec) { const v = Number(n) || 0; const d = dec == null ? 2 : dec; return v.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function num(v) { if (typeof v === 'number') return v; const s = String(v == null ? '' : v).trim().replace(/\./g, '').replace(',', '.'); const n = parseFloat(s); return isNaN(n) ? 0 : n; }
  function serial(n) { return pad(n, 4); }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- toasts & dialogs ----
  function toast(msg, kind) {
    const t = { id: uid(), msg, kind };
    store.toasts = store.toasts.concat(t); emit();
    setTimeout(() => { store.toasts = store.toasts.filter((x) => x.id !== t.id); emit(); }, kind === 'err' ? 7000 : 3500);
  }
  // dialog: {title, body, input (label) , danger, ok, onOk(value)}
  function ask(d) { store.dialog = d; emit(); }
  function closeDialog() { store.dialog = null; emit(); }

  // ---- writes ----
  const LABELS = {
    status: 'Durum', name: 'Ad', no: 'No', qty: 'Adet', due: 'Termin', price: 'Fiyat', po: 'PO no', note: 'Not',
    customerId: 'Müşteri', supplierId: 'Tedarikçi', partId: 'Parça', rev: 'Rev', currency: 'Para birimi', rate: 'Kur',
    heat: 'Şarj no', qtyIn: 'Giriş miktarı', result: 'Sonuç', decision: 'Karar', dispatchNo: 'İrsaliye no',
    serialFrom: 'Seri başı', serialTo: 'Seri sonu', machineId: 'Tezgah', certExpiry: 'Sertifika geçerlilik',
    kgPrice: 'Kg fiyatı', density: 'Yoğunluk', active: 'Aktif', date: 'Tarih', validDays: 'Geçerlilik (gün)',
    faiReq: 'FAI şartı', cocReq: 'CoC şartı', type: 'Tür', taxNo: 'Vergi no', desc: 'Tanım', partNo: 'Parça no',
    expectedReturn: 'Beklenen dönüş', carrier: 'Taşıyıcı', cause: 'Kök neden', pin: 'PIN'
  };
  function fmtV(v) { if (v === true) return 'evet'; if (v === false) return 'hayır'; if (v == null || v === '') return '—'; return String(v); }
  function diffMsg(a, b) {
    const out = [];
    Object.keys(LABELS).forEach((k) => {
      const x = a ? a[k] : undefined; const y = b[k];
      if (k === 'pin') { if ((x || '') !== (y || '')) out.push('PIN değişti'); return; }
      if ((y !== null && typeof y === 'object') || (x !== null && typeof x === 'object')) return;
      if (fmtV(x) !== fmtV(y)) out.push(LABELS[k] + ': ' + fmtV(x) + ' → ' + fmtV(y));
    });
    return out.join(' · ');
  }
  async function put(col, id, body) {
    const clean = JSON.parse(JSON.stringify(body)); delete clean.id;
    store.data[col] = Object.assign({}, store.data[col], { [id]: Object.assign({}, clean, { id }) });
    emit();
    if (store.db) {
      try { await store.db.collection(col).doc(id).set(clean); }
      catch (e) { toast('Kaydedilemedi: ' + (e.code === 'quota_exceeded' ? 'kayıt sınırı doldu, eski kayıtları silin' : (e.code || e.message)), 'err'); throw e; }
    }
  }
  async function remove(col, id) {
    const m = Object.assign({}, store.data[col]); delete m[id]; store.data[col] = m; emit();
    if (store.db) await store.db.collection(col).doc(id).delete();
  }
  // save(): full write plus a change-log entry (who, when, what changed)
  async function save(col, rec, msg) {
    const id = rec.id || uid();
    const old = store.data[col][id];
    const m = msg || (old ? diffMsg(old, rec) : 'Oluşturuldu');
    const log = ((old && old.log) || rec.log || []).slice();
    if (m) log.push({ at: now(), by: session.uid || '', m });
    if (log.length > 150) log.splice(0, log.length - 150);
    const body = Object.assign({}, rec, { id, log, createdAt: rec.createdAt || (old && old.createdAt) || now(), updatedAt: now() });
    await put(col, id, body);
    return body;
  }
  function nextNo(col, prefix) {
    const y = new Date().getFullYear();
    const re = new RegExp('^' + prefix + '-' + y + '-(\\d+)$');
    let max = 0;
    Object.values(store.data[col]).forEach((r) => { const m = re.exec(r.no || ''); if (m) max = Math.max(max, +m[1]); });
    return prefix + '-' + y + '-' + pad(max + 1, 4);
  }
  // Approved records are never deleted: cancel with a mandatory reason.
  function cancelRec(col, rec, after) {
    ask({
      title: (rec.no || rec.name) + ' iptal edilsin mi?', input: 'İptal gerekçesi (zorunlu)', danger: true, ok: 'İptal et',
      onOk: async (why) => { await save(col, Object.assign({}, rec, { status: 'İptal', cancelReason: why }), 'İptal edildi: ' + why); toast((rec.no || '') + ' iptal edildi'); if (after) after(); }
    });
  }
  function deleteDraft(col, rec, after) {
    ask({
      title: (rec.no || rec.name) + ' silinsin mi?', body: 'Taslak kayıt kalıcı olarak silinir.', danger: true, ok: 'Sil',
      onOk: async () => { await remove(col, rec.id); toast('Silindi'); if (after) after(); }
    });
  }

  // ---- permissions (plan §5): '' none, 'G' view, 'D' edit ----
  const ROLES = { satis: 'Satış', planlama: 'Planlama', operator: 'Operatör', kalite: 'Kalite', yonetici: 'Yönetici' };
  const PERM = {
    genel: { satis: 'G', planlama: 'G', kalite: 'G', yonetici: 'D' },
    satis: { satis: 'D', planlama: 'G', kalite: 'G', yonetici: 'D' },
    uretim: { satis: 'G', planlama: 'D', kalite: 'G', yonetici: 'D' },
    satinalma: { planlama: 'D', kalite: 'G', yonetici: 'D' },
    gelen: { planlama: 'G', kalite: 'D', yonetici: 'D' },
    kalite: { satis: 'G', planlama: 'G', kalite: 'D', yonetici: 'D' },
    sevkiyat: { satis: 'D', planlama: 'D', kalite: 'G', yonetici: 'D' },
    ana: { satis: 'G', planlama: 'D', kalite: 'G', yonetici: 'D' },
    kullanici: { yonetici: 'D' },
    fiyat: { satis: 'G', yonetici: 'G' },
    operator: { operator: 'D', planlama: 'G', yonetici: 'D' }
  };
  function lvl(area) {
    const u = currentUser(); if (!u) return '';
    let best = '';
    (u.roles || []).forEach((r) => { const v = (PERM[area] || {})[r]; if (v === 'D' || (v === 'G' && best !== 'D')) best = v; });
    return best;
  }
  const canSee = (a) => !!lvl(a);
  const canEdit = (a) => lvl(a) === 'D';

  // ---- navigation: module context is kept when a record from another module opens ----
  function nav(mod, page) { store.route = { mod, page, rec: null }; emit(); window.scrollTo(0, 0); }
  function openRec(type, id) { store.route = Object.assign({}, store.route, { rec: { type, id } }); emit(); window.scrollTo(0, 0); }
  function closeRec() { store.route = Object.assign({}, store.route, { rec: null }); emit(); }

  // ---- documents (versioned files on the assets capability) ----
  const TYPES = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', csv: 'text/csv', txt: 'text/plain', json: 'application/json', md: 'text/markdown', svg: 'image/svg+xml' };
  async function uploadDoc(ref, kind, file, note) {
    if (!store.assets) { toast('Dosya yükleme bu görünümde kullanılamıyor', 'err'); return null; }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!TYPES[ext]) { toast('Bu dosya türü desteklenmiyor. PDF, görsel (PNG/JPG) veya CSV yükleyin.', 'err'); return null; }
    try {
      const r = await store.assets.upload(file, { type: TYPES[ext] });
      const same = Object.values(store.data.documents).filter((d) => d.ref === ref && d.kind === kind);
      const version = same.reduce((m, d) => Math.max(m, d.version || 0), 0) + 1;
      const doc = await save('documents', { ref, kind, name: file.name, version, assetId: r.id, size: r.sizeBytes, note: note || '', by: session.uid, at: now() }, kind + ' v' + version + ' yüklendi');
      toast(file.name + ' yüklendi (v' + version + ')');
      return doc;
    } catch (e) {
      const why = { too_large: 'dosya 20 MB sınırını aşıyor', unsupported_type: 'dosya türü desteklenmiyor', quota_or_state: 'depolama alanı dolu', rate_limited: 'çok sık yükleme, biraz bekleyin' }[e.code] || (e.code || e.message);
      toast('Yüklenemedi: ' + why, 'err'); return null;
    }
  }
  function docsFor(ref, kind) {
    return Object.values(store.data.documents).filter((d) => d.ref === ref && (!kind || d.kind === kind)).sort((a, b) => (b.version || 0) - (a.version || 0));
  }
  const blobUrl = (id) => '/_blob/' + id;

  async function saveFile(filename, data) {
    if (!store.downloads) { toast('Dosya indirme bu görünümde kullanılamıyor', 'err'); return; }
    try { await store.downloads.save({ filename, data }); }
    catch (e) { if (e.code !== 'declined') toast('İndirilemedi: ' + (e.code || e.message), 'err'); }
  }
  function exportCsv(name, cols, rows) {
    const esc = (v) => { const s = v == null ? '' : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = [cols.map((c) => esc(c.label)).join(';')].concat(rows.map((r) => cols.map((c) => esc(c.csv ? c.csv(r) : (typeof c.v === 'function' ? c.v(r) : r[c.k]))).join(';')));
    saveFile(name + '_' + today() + '.csv', '﻿' + lines.join('\r\n'));
  }

  // ---- lookups ----
  const D = store.data;
  const get = (col, id) => (id ? D[col][id] : null) || null;
  const list = (col) => Object.values(D[col]);
  const nameOf = (col, id) => { const r = get(col, id); return r ? (r.name || r.no || r.code || '—') : '—'; };
  const userName = (id) => { const u = get('users', id); return u ? u.name : '—'; };
  const machineName = (id) => { const m = get('machines', id); return m ? m.code : '—'; };
  function revOf(partId, rev) { const p = get('parts', partId); return p ? (p.revs || []).find((r) => r.rev === rev) || null : null; }
  function partLabel(partId, rev) { const p = get('parts', partId); return p ? p.partNo + (rev ? ' Rev ' + rev : '') : '—'; }
  function routingFor(partId, rev) {
    const rs = list('routings').filter((r) => r.partId === partId && r.rev === rev);
    return rs.find((r) => r.status === 'Onaylı') || rs[0] || null;
  }
  function settings() { return D.settings.main || { scrapReasons: ['Ölçü dışı', 'Yüzey hatası', 'Kırık / çatlak', 'Takım izi', 'Diğer'], rates: { EUR: 0, USD: 0 } }; }

  // ---- production progress ----
  function opProgress(wo) {
    const ops = (wo.ops || []).slice().sort((a, b) => a.seq - b.seq);
    const cards = list('jobcards').filter((c) => c.woId === wo.id);
    const subs = list('subcons').filter((s) => s.woId === wo.id && s.status !== 'İptal');
    let input = wo.qty || 0;
    return ops.map((op) => {
      let good = 0, scrap = 0, active = false, sent = 0, mins = 0;
      if (op.type === 'Fason') {
        subs.filter((s) => s.seq === op.seq).forEach((s) => (s.moves || []).forEach((m) => { if (m.type === 'Gelen') good += +m.qty || 0; else sent += +m.qty || 0; }));
      } else {
        cards.filter((c) => c.seq === op.seq).forEach((c) => {
          if (c.status === 'Devam') active = true;
          good += +c.good || 0; scrap += +c.scrap || 0;
          if (c.end) mins += (new Date(c.end) - new Date(c.start)) / 60000;
        });
        // Closed scrap NCRs can return parts to good: reworked pieces or customer-approved acceptance.
        list('ncrs').filter((n) => n.woId === wo.id && n.seq === op.seq && n.source === 'Operatör' && n.status === 'Kapandı').forEach((n) => {
          const back = n.decision === 'Yeniden işleme' ? Math.min(+n.recovered || 0, +n.qty || 0) : n.decision === 'Müşteri onaylı kabul' ? (+n.qty || 0) : 0;
          good += back; scrap -= back;
        });
      }
      const remain = Math.max(0, input - good - scrap);
      const done = input > 0 && good + scrap >= input;
      const st = done ? 'Bitti' : (active || good + scrap > 0 || sent > 0) ? 'Devam' : 'Bekliyor';
      const row = Object.assign({}, op, { input, good, scrap, active, sent, remain, st, mins, planMins: (+op.setup || 0) + (+op.cycle || 0) * (wo.qty || 0) });
      input = good;
      return row;
    });
  }
  function woStatus(wo) {
    if (['Taslak', 'İptal', 'Kapandı'].includes(wo.status)) return wo.status;
    const p = opProgress(wo);
    if (p.length && p.every((o) => o.st === 'Bitti')) return 'Tamamlandı';
    if (p.some((o) => o.st !== 'Bekliyor')) return 'Üretimde';
    return 'Serbest';
  }
  function woGood(wo) { const p = opProgress(wo); return p.length ? p[p.length - 1].good : 0; }
  function finalAccepted(woId) {
    return list('inspections').filter((i) => i.woId === woId && i.type === 'Final' && ['Kabul', 'Şartlı kabul'].includes(i.result)).reduce((s, i) => s + (+i.qty || 0), 0);
  }
  function orderOf(wo) { return get('orders', wo.orderId); }
  function faiNeeded(wo) {
    const o = orderOf(wo); const c = o ? get('customers', o.customerId) : null;
    const req = !!((o && o.faiReq) || (c && c.faiReq));
    const r = revOf(wo.partId, wo.rev);
    return req && !(r && r.faiDone);
  }
  function openNcrs(woId) { return list('ncrs').filter((n) => n.woId === woId && n.status === 'Açık'); }
  function shippedQty(woId, exceptShipId, onlyShipped) {
    let s = 0;
    list('shipments').forEach((sh) => {
      if (sh.status === 'İptal' || sh.id === exceptShipId) return;
      if (onlyShipped && sh.status !== 'Sevk edildi') return;
      (sh.lines || []).forEach((l) => { if (l.woId === woId) s += +l.qty || 0; });
    });
    return s;
  }
  function shipChecks(wo, exceptShipId) {
    const fin = finalAccepted(wo.id);
    const fai = !faiNeeded(wo);
    const ncr = openNcrs(wo.id).length === 0;
    const avail = Math.max(0, fin - shippedQty(wo.id, exceptShipId));
    return { fin, finOk: fin > 0, fai, ncr, avail, ok: fin > 0 && fai && ncr && avail > 0 };
  }
  function lotUsed(lotId) {
    let u = 0;
    list('workorders').forEach((w) => { if (w.status === 'İptal') return; (w.lots || []).forEach((l) => { if (l.lotId === lotId) u += +l.qty || 0; }); });
    return u;
  }
  function lotRemaining(lot) { return (+lot.qtyIn || 0) - lotUsed(lot.id); }
  function lotStatus(lot) { return lot.status === 'Kabul' && lotRemaining(lot) <= 0 ? 'Tükendi' : (lot.status || 'Karantina'); }
  function lineStats(order, line) {
    const wos = list('workorders').filter((w) => w.orderId === order.id && w.lineId === line.id && w.status !== 'İptal');
    let shipped = 0;
    list('shipments').forEach((s) => { if (s.status !== 'Sevk edildi') return; (s.lines || []).forEach((l) => { if (l.lineId === line.id) shipped += +l.qty || 0; }); });
    const planned = wos.reduce((s, w) => s + (+w.qty || 0), 0);
    return { wos, planned, shipped };
  }
  function orderStatus(o) {
    if (['Taslak', 'İptal'].includes(o.status)) return o.status;
    const st = (o.lines || []).map((l) => Object.assign({ qty: +l.qty || 0 }, lineStats(o, l)));
    if (st.length && st.every((x) => x.shipped >= x.qty)) return 'Tamamlandı';
    if (st.some((x) => x.shipped > 0)) return 'Kısmi sevk';
    if (st.some((x) => x.wos.length)) return 'Üretimde';
    return 'Onaylı';
  }
  function certState(s) {
    if (!s || !s.certExpiry) return null;
    const d = daysBetween(today(), s.certExpiry);
    return { days: d, st: d < 0 ? 'Süresi dolmuş' : d <= 30 ? 'Yakında doluyor' : 'Geçerli' };
  }
  function rawKg(rev) {
    const m = rev ? get('materials', rev.materialId) : null;
    if (!m || !rev) return 0;
    const d = num(rev.d), l = num(rev.l), w = num(rev.w), t = num(rev.t);
    let mm3 = 0;
    if (rev.raw === 'Plaka') mm3 = w * l * t;
    else if (rev.raw === 'Altıgen') mm3 = (Math.sqrt(3) / 2) * d * d * l;
    else mm3 = Math.PI * (d / 2) * (d / 2) * l;
    return mm3 / 1000 * num(m.density) / 1000;
  }
  function rawLabel(rev) {
    if (!rev) return '—';
    if (rev.raw === 'Plaka') return rev.w + ' × ' + rev.l + ' × ' + rev.t + ' mm';
    return (rev.raw === 'Altıgen' ? 'SW' : 'Ø') + rev.d + ' × ' + rev.l + ' mm';
  }

  window.ERP = {
    html, React, store, COLS, emit, useStore, session, currentUser, login, logout, initStore, allReady,
    uid, now, today, addDays, daysBetween, fmtD, fmtDT, fmtN, num, serial, pad, esc,
    toast, ask, closeDialog, put, remove, save, nextNo, cancelRec, deleteDraft,
    ROLES, lvl, canSee, canEdit, nav, openRec, closeRec,
    uploadDoc, docsFor, blobUrl, saveFile, exportCsv,
    get, list, nameOf, userName, machineName, revOf, partLabel, routingFor, settings,
    opProgress, woStatus, woGood, finalAccepted, orderOf, faiNeeded, openNcrs, shippedQty, shipChecks,
    lotUsed, lotRemaining, lotStatus, lineStats, orderStatus, certState, rawKg, rawLabel,
    pages: {}, details: {}
  };
})();
