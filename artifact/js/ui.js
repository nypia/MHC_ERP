// UI building blocks shared by every module.
(function () {
  const E = window.ERP;
  const { html, store } = E;
  const { useState, useRef } = React;

  const TONE = {
    ok: ['Kabul', 'Bitti', 'Tamamlandı', 'Sevk edildi', 'Geçerli', 'Aktif', 'Onaylı', 'Hurda', 'Yeniden işleme', 'Müşteri onaylı kabul'],
    info: ['Üretimde', 'Serbest', 'Gönderildi', 'Devam', 'Hazır', 'Kısmi döndü', 'Karar verildi', 'Döndü', 'Kısmi sevk', 'Devam ediyor'],
    warn: ['Karantina', 'Yakında doluyor', 'Şartlı kabul', 'FAI gerekli', 'Bekliyor'],
    bad: ['Ret', 'İptal', 'Süresi dolmuş', 'Açık', 'Gecikti']
  };
  function tone(s) { for (const k in TONE) if (TONE[k].includes(s)) return k; return 'gray'; }
  function Badge({ s, t }) { return s ? html`<span className=${'b ' + (t || tone(s))}>${s}</span>` : null; }

  function Btn({ kind, sm, onClick, disabled, children, title, type }) {
    return html`<button type=${type || 'button'} title=${title} className=${'btn ' + (kind || '') + (sm ? ' sm' : '')} onClick=${onClick} disabled=${disabled}>${children}</button>`;
  }
  function Link({ onClick, children }) { return html`<button type="button" className="link" onClick=${onClick}>${children}</button>`; }
  function RecLink({ type, id, children }) {
    if (!id) return html`<span>${children || '—'}</span>`;
    return html`<button type="button" className="link mono" onClick=${(e) => { e.stopPropagation(); E.openRec(type, id); }}>${children}</button>`;
  }

  function Field({ label, req, span, children, div }) {
    const tag = div ? 'div' : 'label';
    return html`<${tag} className=${'fld' + (span ? ' span' : '')}><span>${label}${req ? html` <span className="req">*</span>` : null}</span>${children}<//>`;
  }
  function Inp({ value, onChange, type, sm, placeholder, err, id, disabled, inputMode }) {
    return html`<input id=${id} className=${'in' + (sm ? ' sm' : '') + (err ? ' err' : '')} type=${type || 'text'} inputMode=${inputMode} value=${value == null ? '' : value} placeholder=${placeholder} disabled=${disabled} onChange=${(e) => onChange(e.target.value)} />`;
  }
  function Sel({ value, onChange, options, empty, sm, disabled, id }) {
    const opts = (options || []).map((o) => (typeof o === 'string' ? { v: o, l: o } : o));
    return html`<select id=${id} className=${'in' + (sm ? ' sm' : '')} value=${value == null ? '' : value} disabled=${disabled} onChange=${(e) => onChange(e.target.value)}>
      ${empty !== false ? html`<option value="">${empty || 'Seçin…'}</option>` : null}
      ${opts.map((o) => html`<option key=${o.v} value=${o.v}>${o.l}</option>`)}
    </select>`;
  }
  function Txt({ value, onChange, rows }) { return html`<textarea className="in" rows=${rows || 3} value=${value || ''} onChange=${(e) => onChange(e.target.value)}></textarea>`; }
  function Check({ checked, onChange, label, disabled }) {
    return html`<span className="check"><input type="checkbox" checked=${!!checked} disabled=${disabled} onChange=${(e) => onChange(e.target.checked)} />${label}</span>`;
  }
  function Multi({ value, onChange, options }) {
    const v = value || [];
    const opts = options.map((o) => (typeof o === 'string' ? { v: o, l: o } : o));
    return html`<div className="multi">${opts.map((o) => html`<button type="button" key=${o.v} className=${'chip' + (v.includes(o.v) ? ' on' : '')}
      onClick=${() => onChange(v.includes(o.v) ? v.filter((x) => x !== o.v) : v.concat(o.v))}>${o.l}</button>`)}</div>`;
  }
  function Chips({ opts, cur, set }) {
    return html`<div className="row">${opts.map((o) => { const v = Array.isArray(o) ? o[0] : o; const l = Array.isArray(o) ? o[1] : o;
      return html`<button type="button" key=${v} className=${'chip' + (cur === v ? ' on' : '')} onClick=${() => set(v)}>${l}</button>`; })}</div>`;
  }

  // fields: [{k,label,type,options,req,span,show(v)}]
  function SchemaForm({ fields, value, set, errs }) {
    return html`<div className="form">${fields.filter((f) => !f.show || f.show(value)).map((f) => {
      const v = value[f.k];
      const opts = typeof f.options === 'function' ? f.options(value) : f.options;
      let input;
      if (f.type === 'select') input = html`<${Sel} value=${v} options=${opts} onChange=${(x) => set(f.k, x)} />`;
      else if (f.type === 'textarea') input = html`<${Txt} value=${v} onChange=${(x) => set(f.k, x)} />`;
      else if (f.type === 'check') input = html`<${Check} checked=${v} label=${f.text || 'Evet'} onChange=${(x) => set(f.k, x)} />`;
      else if (f.type === 'multi') input = html`<${Multi} value=${v} options=${opts} onChange=${(x) => set(f.k, x)} />`;
      else input = html`<${Inp} value=${v} type=${f.type === 'date' ? 'date' : 'text'} inputMode=${f.type === 'number' ? 'decimal' : undefined} placeholder=${f.ph} err=${errs && errs.includes(f.k)} onChange=${(x) => set(f.k, x)} />`;
      return html`<${Field} key=${f.k} label=${f.label} req=${f.req} div=${f.type === 'multi'} span=${f.span || f.type === 'textarea' || f.type === 'multi'}>${input}<//>`;
    })}</div>`;
  }
  function missing(fields, v) { return fields.filter((f) => f.req && (!f.show || f.show(v)) && (v[f.k] == null || v[f.k] === '' || (Array.isArray(v[f.k]) && !v[f.k].length))).map((f) => f.k); }
  function useForm(init) {
    const [v, setV] = useState(init);
    return [v, (k, x) => setV((o) => Object.assign({}, o, { [k]: x })), setV];
  }

  function Modal({ title, onClose, children, foot, wide }) {
    return html`<div className="modal-bg" onMouseDown=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className=${'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label=${title}>
        <h2>${title}<${Btn} sm onClick=${onClose}>Kapat<//></h2>
        <div className="body">${children}</div>
        ${foot ? html`<div className="foot">${foot}</div>` : null}
      </div></div>`;
  }
  function Dialogs() {
    const d = store.dialog;
    const [val, setVal] = useState('');
    if (!d) return null;
    const close = () => { setVal(''); E.closeDialog(); };
    const ok = async () => { if (d.input && !val.trim()) return; const v = val.trim(); close(); await d.onOk(v); };
    return html`<${Modal} title=${d.title} onClose=${close} foot=${html`<${Btn} onClick=${close}>Vazgeç<//><${Btn} kind=${d.danger ? 'd' : 'p'} disabled=${d.input && !val.trim()} onClick=${ok}>${d.ok || 'Tamam'}<//>`}>
      ${d.body ? html`<div>${d.body}</div>` : null}
      ${d.input ? html`<${Field} label=${d.input}><${Txt} value=${val} onChange=${setVal} /><//>` : null}
    <//>`;
  }
  function Toasts() { return html`<div className="toasts" aria-live="polite">${store.toasts.map((t) => html`<div key=${t.id} className=${'toast' + (t.kind === 'err' ? ' err' : '')}>${t.msg}</div>`)}</div>`; }

  function Table({ cols, rows, onRow, empty, rowClass }) {
    if (!rows.length) return empty || html`<div className="empty">Kayıt yok</div>`;
    return html`<div className="scroll"><table className="tbl">
      <thead><tr>${cols.map((c, i) => html`<th key=${i} className=${c.num ? 'num' : ''}>${c.label}</th>`)}</tr></thead>
      <tbody>${rows.map((r, ri) => html`<tr key=${r.id || ri} className=${(onRow ? 'click ' : '') + (rowClass ? rowClass(r) || '' : '')} onClick=${onRow ? () => onRow(r) : undefined}>
        ${cols.map((c, i) => html`<td key=${i} className=${(c.num ? 'num ' : '') + (c.mono ? 'mono ' : '') + (c.wrap ? 'wrap' : '')}>${c.v ? c.v(r) : r[c.k]}</td>`)}
      </tr>`)}</tbody></table></div>`;
  }
  function Card({ title, act, children, pad }) {
    return html`<section className="card">${title ? html`<h3>${title}${act ? html`<span className="act">${act}</span>` : null}</h3>` : null}${pad ? html`<div className="pad">${children}</div>` : children}</section>`;
  }
  function Empty({ title, text, action }) { return html`<div className="empty"><b>${title}</b>${text}${action ? html`<div style=${{ marginTop: 12 }}>${action}</div>` : null}</div>`; }
  function Tabs({ tabs, cur, set }) {
    return html`<div className="stabs" role="tablist">${tabs.map(([k, l]) => html`<button type="button" role="tab" key=${k} aria-selected=${cur === k} className=${cur === k ? 'on' : ''} onClick=${() => set(k)}>${l}</button>`)}</div>`;
  }
  function KV({ items }) { return html`<div className="kv">${items.filter(Boolean).map(([l, v], i) => html`<div key=${i}><span>${l}</span>${v == null || v === '' ? '—' : v}</div>`)}</div>`; }
  function Head({ crumb, title, badge, actions, sub }) {
    return html`<div className="col" style=${{ gap: 8 }}>
      ${crumb ? html`<div className="crumb">${crumb}</div>` : null}
      <div className="head"><div className="row" style=${{ gap: 12 }}><h1>${title}</h1>${badge}</div>${actions ? html`<div className="row">${actions}</div>` : null}</div>
      ${sub ? html`<div className="row muted" style=${{ gap: '6px 22px' }}>${sub}</div>` : null}
    </div>`;
  }
  function BackCrumb({ label, here }) { return html`<span><button type="button" onClick=${E.closeRec}>${label}</button> › ${here}</span>`; }

  function DocPanel({ refKey, kinds, title, extraRefs }) {
    E.useStore();
    const [kind, setKind] = useState(kinds[0]);
    const [old, setOld] = useState({});
    const inp = useRef(null);
    const refs = [refKey].concat(extraRefs || []);
    const docs = refs.flatMap((r) => E.docsFor(r));
    const groups = {};
    docs.forEach((d) => { const g = d.ref + '|' + d.kind; (groups[g] = groups[g] || []).push(d); });
    const canUp = !!store.assets && E.currentUser();
    const pick = async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) await E.uploadDoc(refKey, kind, f); };
    return html`<${Card} title=${(title || 'Belgeler') + ' (' + docs.length + ')'}>
      <div className="pad col" style=${{ gap: 10 }}>
        ${Object.keys(groups).length ? Object.keys(groups).map((g) => {
          const vs = groups[g]; const top = vs[0];
          return html`<div key=${g} style=${{ fontSize: 14 }}>
            <a href=${E.blobUrl(top.assetId)} target="_blank" rel="noopener">${top.name}</a>
            <span className="muted"> · v${top.version} · ${top.kind}${top.ref !== refKey ? ' (bağlı kayıttan)' : ''} · ${E.fmtDT(top.at)} ${E.userName(top.by)}</span>
            ${vs.length > 1 ? html` <${Link} onClick=${() => setOld(Object.assign({}, old, { [g]: !old[g] }))}>önceki versiyonlar (${vs.length - 1})<//>` : null}
            ${old[g] ? html`<div style=${{ paddingLeft: 14, marginTop: 4 }}>${vs.slice(1).map((d) => html`<div key=${d.id}><a href=${E.blobUrl(d.assetId)} target="_blank" rel="noopener">${d.name}</a> <span className="muted">v${d.version} · ${E.fmtDT(d.at)}</span></div>`)}</div>` : null}
          </div>`;
        }) : html`<div className="muted">Henüz belge yok.</div>`}
        ${canUp ? html`<div className="row">
          <${Sel} sm value=${kind} empty=${false} options=${kinds} onChange=${setKind} />
          <${Btn} sm onClick=${() => inp.current && inp.current.click()}>+ Dosya yükle<//>
          <input ref=${inp} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.txt" onChange=${pick} />
        </div><div className="muted" style=${{ fontSize: 12 }}>PDF, PNG/JPG veya CSV. Aynı türde yeni dosya yeni versiyon olur; eskiler silinmez.</div>` : null}
      </div><//>`;
  }
  function History({ rec }) {
    E.useStore();
    const log = (rec && rec.log) || [];
    return html`<${Card} title="Değişiklik geçmişi"><div className="pad hist">
      ${log.length ? log.slice().reverse().map((l, i) => html`<div key=${i}><span>${E.fmtDT(l.at)} · ${E.userName(l.by)}</span>${l.m}</div>`) : html`<div className="muted">Kayıt yok.</div>`}
    </div><//>`;
  }

  // List page with search box, optional chip filter and CSV export
  function ListPage({ title, crumb, actions, chips, chip, setChip, cols, rows, onRow, empty, csv, rowClass, searchKeys }) {
    const [q, setQ] = useState('');
    const s = q.trim().toLocaleLowerCase('tr');
    const shown = s ? rows.filter((r) => (searchKeys ? searchKeys(r) : Object.values(r).filter((x) => typeof x === 'string' || typeof x === 'number').join(' ')).toLocaleLowerCase('tr').includes(s)) : rows;
    return html`<div className="col" style=${{ gap: 14 }}>
      <${Head} crumb=${crumb} title=${title} actions=${html`${csv ? html`<${Btn} onClick=${() => E.exportCsv(csv, cols.filter((c) => c.csv !== false), shown)}>Excel'e aktar (CSV)<//>` : null}${actions}`} />
      <div className="card pad row">
        ${chips ? html`<${Chips} opts=${chips} cur=${chip} set=${setChip} />` : null}
        <input className="in" style=${{ maxWidth: 280, marginLeft: chips ? 'auto' : 0 }} placeholder="Bu listede ara…" aria-label="Bu listede ara" value=${q} onChange=${(e) => setQ(e.target.value)} />
        <span className="muted">${shown.length} kayıt</span>
      </div>
      <div className="card"><${Table} cols=${cols} rows=${shown} onRow=${onRow} empty=${empty} rowClass=${rowClass} /></div>
    </div>`;
  }

  // Generic master-data list + record page (customers, suppliers, materials, machines, processes, users)
  function CrudPage({ col, type, title, crumb, fields, cols, area, defaults, newLabel, sort }) {
    const D = E.useStore();
    const [form, setForm] = useState(null);
    const [errs, setErrs] = useState([]);
    const can = E.canEdit(area);
    const rows = Object.values(D[col]).sort(sort || ((a, b) => String(a.name || a.code || '').localeCompare(String(b.name || b.code || ''), 'tr')));
    const set = (k, v) => setForm(Object.assign({}, form, { [k]: v }));
    const submit = async () => {
      const m = missing(fields, form); setErrs(m);
      if (m.length) { E.toast('Zorunlu alanları doldurun', 'err'); return; }
      const r = await E.save(col, Object.assign({ active: true }, form));
      setForm(null); E.toast('Kaydedildi'); E.openRec(type, r.id);
    };
    return html`<div>
      <${ListPage} title=${title} crumb=${crumb} csv=${title} cols=${cols} rows=${rows} onRow=${(r) => E.openRec(type, r.id)}
        rowClass=${(r) => (r.active === false ? 'muted' : '')}
        empty=${html`<${Empty} title=${'Henüz kayıt yok'} text=${can ? ' Sağ üstteki düğmeyle ilk kaydı ekleyin.' : ''} />`}
        actions=${can ? html`<${Btn} kind="p" onClick=${() => { setErrs([]); setForm(Object.assign({}, defaults || {})); }}>${newLabel || '+ Yeni'}<//>` : null} />
      ${form ? html`<${Modal} title=${newLabel ? newLabel.replace('+ ', '') : 'Yeni kayıt'} onClose=${() => setForm(null)} wide
        foot=${html`<${Btn} onClick=${() => setForm(null)}>Vazgeç<//><${Btn} kind="p" onClick=${submit}>Kaydet<//>`}>
        <${SchemaForm} fields=${fields} value=${form} set=${set} errs=${errs} />
      <//>` : null}
    </div>`;
  }
  function CrudDetail({ col, id, fields, area, title, crumb, docKinds, extra, side, view }) {
    const D = E.useStore();
    const r = D[col][id];
    const [edit, setEdit] = useState(null);
    const [errs, setErrs] = useState([]);
    if (!r) return html`<${Empty} title="Kayıt bulunamadı" text="" action=${html`<${Btn} onClick=${E.closeRec}>Geri dön<//>`} />`;
    const can = E.canEdit(area);
    const submit = async () => { const m = missing(fields, edit); setErrs(m); if (m.length) return; await E.save(col, edit); setEdit(null); E.toast('Kaydedildi'); };
    const toggle = () => E.save(col, Object.assign({}, r, { active: r.active === false }), r.active === false ? 'Aktif yapıldı' : 'Pasif yapıldı');
    return html`<div className="col" style=${{ gap: 16 }}>
      <${Head} crumb=${html`<${BackCrumb} label=${crumb} here=${title(r)} />`} title=${title(r)} badge=${r.active === false ? html`<${Badge} s="Pasif" />` : null}
        actions=${can && !edit ? html`<${Btn} onClick=${() => { setErrs([]); setEdit(Object.assign({}, r)); }}>Düzenle<//><${Btn} onClick=${toggle}>${r.active === false ? 'Aktif yap' : 'Pasif yap'}<//>` : null} />
      <div className="split"><div className="l">
        <${Card} title="Bilgiler" act=${edit ? html`<${Btn} sm onClick=${() => setEdit(null)}>Vazgeç<//><${Btn} sm kind="p" onClick=${submit}>Kaydet<//>` : null}>
          <div className="pad">${edit ? html`<${SchemaForm} fields=${fields} value=${edit} set=${(k, v) => setEdit(Object.assign({}, edit, { [k]: v }))} errs=${errs} />`
            : html`<${KV} items=${fields.filter((f) => f.k !== 'pin').map((f) => [f.label, view && view[f.k] ? view[f.k](r) : f.type === 'check' ? (r[f.k] ? 'Evet' : 'Hayır') : f.type === 'multi' ? (r[f.k] || []).map((x) => { const o = (typeof f.options === 'function' ? f.options(r) : f.options).find((y) => (y.v || y) === x); return o ? (o.l || o) : x; }).join(', ') : f.type === 'date' ? E.fmtD(r[f.k]) : f.type === 'select' ? (() => { const o = (typeof f.options === 'function' ? f.options(r) : f.options).find((y) => (y.v || y) === r[f.k]); return o ? (o.l || o) : r[f.k]; })() : r[f.k]])} />`}</div>
        <//>
        ${extra ? extra(r) : null}
      </div><div className="r">
        ${side ? side(r) : null}
        ${docKinds ? html`<${DocPanel} refKey=${col + '/' + id} kinds=${docKinds} />` : null}
        <${History} rec=${r} />
      </div></div>
    </div>`;
  }

  const ICONS = {
    genel: html`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect></svg>`,
    satis: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"></path><path d="M9 12h7M9 16h7"></path></svg>`,
    uretim: html`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"></path></svg>`,
    satinalma: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7l9-4 9 4v10l-9 4-9-4z"></path><path d="M3 7l9 4 9-4M12 11v10"></path></svg>`,
    kalite: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"></path><path d="M8.5 12l2.5 2.5 4.5-5"></path></svg>`,
    sevkiyat: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6h12v10H2zM14 10h4l3 3v3h-7z"></path><circle cx="6" cy="18" r="2"></circle><circle cx="17" cy="18" r="2"></circle></svg>`,
    ana: html`<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3"></ellipse><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"></path></svg>`
  };

  // A crash in one screen shows its message instead of blanking the whole app.
  class ErrorBoundary extends React.Component {
    constructor(p) { super(p); this.state = { err: null }; }
    static getDerivedStateFromError(err) { return { err }; }
    componentDidCatch(err, info) { try { console.error('Ekran hatası', err, info && info.componentStack); } catch (e) { /* ignore */ } }
    render() {
      const err = this.state.err;
      if (!err) return this.props.children;
      const reset = () => this.setState({ err: null });
      return html`<div className="card pad col" role="alert" style=${{ margin: this.props.full ? 16 : 0 }}>
        <b style=${{ fontSize: 16 }}>Bu ekran açılırken bir hata oluştu</b>
        <div className="alert bad mono" style=${{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>${String((err && (err.stack || err.message)) || err).split('\n').slice(0, 4).join('\n')}</div>
        <div className="row">
          ${this.props.full ? html`<${Btn} kind="p" onClick=${() => window.location.reload()}>Sayfayı yenile<//>` : html`<${Btn} onClick=${reset}>Tekrar dene<//><${Btn} kind="p" onClick=${() => { reset(); E.nav('genel', 'panel'); }}>Gösterge paneline dön<//>`}
        </div>
        <div className="muted" style=${{ fontSize: 12.5, wordBreak: 'break-word' }}>Bu mesajın ekran görüntüsünü iletirseniz sorunu bulabilirim. Tarayıcı: ${navigator.userAgent}</div>
      </div>`;
    }
  }
  window.addEventListener('error', (e) => { if (e && e.message) E.toast('Hata: ' + e.message, 'err'); });
  window.addEventListener('unhandledrejection', (e) => { const r = e && e.reason; E.toast('Hata: ' + ((r && (r.message || r.code)) || String(r)), 'err'); });

  // Modals opened from other modules (e.g. "Fasona gönder" from a work order): rendered by the app shell.
  function showModal(C, props) { store.modal = { C, props: props || {} }; E.emit(); }
  function hideModal() { store.modal = null; E.emit(); }
  function ModalHost() { const m = store.modal; return m ? html`<${m.C} ...${m.props} onClose=${hideModal} />` : null; }

  Object.assign(E, { ErrorBoundary, showModal, hideModal, ModalHost, Badge, tone, Btn, Link, RecLink, Field, Inp, Sel, Txt, Check, Multi, Chips, SchemaForm, missing, useForm,
    Modal, Dialogs, Toasts, Table, Card, Empty, Tabs, KV, Head, BackCrumb, DocPanel, History, ListPage, CrudPage, CrudDetail, ICONS });
})();
