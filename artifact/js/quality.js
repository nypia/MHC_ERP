// Quality: incoming / in-process / final / FAI inspections, NCR, traceability.
(function () {
  const E = window.ERP;
  const { html } = E;
  const { useState, useRef } = React;

  // ---------- inspections ----------
  function NewInspection({ lotId, woId, type, onClose }) {
    const w = woId ? E.get('workorders', woId) : null;
    const lot = lotId ? E.get('lots', lotId) : null;
    const defQty = type === 'Final' && w ? Math.max(0, E.woGood(w) - E.finalAccepted(w.id)) : type === 'FAI' ? 1 : type === 'Gelen' ? '' : 5;
    const [f, setF] = useState({ qty: String(defQty), result: 'Kabul', inspector: E.session.uid, date: E.today(), tools: '', note: '', seq: '' });
    const [file, setFile] = useState(null);
    const inp = useRef(null);
    const fields = [
      type === 'Ara' ? { k: 'seq', label: 'Operasyon', type: 'select', options: (w.ops || []).map((o) => ({ v: String(o.seq), l: 'Op' + o.seq + ' ' + o.name })) } : null,
      { k: 'qty', label: type === 'Gelen' ? 'Kontrol edilen numune (adet)' : type === 'Final' ? 'Kabul edilen / kontrol edilen adet' : 'Kontrol edilen adet', type: 'number', req: type !== 'Gelen' },
      { k: 'result', label: 'Sonuç', type: 'select', req: true, options: ['Kabul', 'Şartlı kabul', 'Ret'] },
      { k: 'inspector', label: 'Kontrolör', type: 'select', req: true, options: () => E.list('users').filter((u) => (u.roles || []).some((r) => ['kalite', 'yonetici'].includes(r))).map((u) => ({ v: u.id, l: u.name })) },
      { k: 'date', label: 'Tarih', type: 'date', req: true }, { k: 'tools', label: 'Ölçüm aletleri', ph: 'Mikrometre 25–50, CMM' },
      { k: 'note', label: 'Kontrol edilen özellikler / not', type: 'textarea' }
    ].filter(Boolean);
    const save = async () => {
      if (E.missing(fields, f).length) { E.toast('Zorunlu alanları doldurun', 'err'); return; }
      if (type === 'Final' && w && E.num(f.qty) > E.woGood(w) - E.finalAccepted(w.id) && f.result !== 'Ret') { E.toast('Kabul adedi, son operasyondan çıkan sağlam adedi aşamaz (' + (E.woGood(w) - E.finalAccepted(w.id)) + ')', 'err'); return; }
      const r = await E.save('inspections', { no: E.nextNo('inspections', 'MUA'), type, lotId: lotId || '', woId: woId || '', seq: f.seq ? +f.seq : '', qty: E.num(f.qty), result: f.result, inspector: f.inspector, date: f.date, tools: f.tools, note: f.note, status: 'Sonuçlandı' }, type + ' muayene · ' + f.result);
      if (file) await E.uploadDoc('inspections/' + r.id, type === 'FAI' ? 'FAI raporu' : 'Ölçüm raporu', file);
      if (lot) await E.save('lots', Object.assign({}, lot, { status: f.result === 'Ret' ? 'Ret' : 'Kabul' }), 'Gelen kontrol ' + r.no + ': ' + f.result);
      if (w) await E.save('workorders', w, r.no + ' · ' + type + ' muayene · ' + f.result + (f.qty ? ' · ' + f.qty + ' ad.' : ''));
      if (type === 'FAI' && w && f.result !== 'Ret') {
        const p = E.get('parts', w.partId);
        if (p) await E.save('parts', Object.assign({}, p, { revs: (p.revs || []).map((x) => (x.rev === w.rev ? Object.assign({}, x, { faiDone: true, faiRef: r.no }) : x)) }), 'Rev ' + w.rev + ' FAI kabul: ' + r.no);
      }
      onClose();
      E.toast(r.no + ' kaydedildi');
      if (f.result === 'Ret') E.newNcr({ woId: woId || '', lotId: lotId || '', seq: f.seq ? +f.seq : '', qty: f.qty, desc: type + ' muayene reddi (' + r.no + '): ' + (f.note || '') });
    };
    return html`<${E.Modal} wide title=${type + ' muayene · ' + (w ? w.no + ' · ' + E.partLabel(w.partId, w.rev) : lot ? lot.no + ' · şarj ' + lot.heat : '')} onClose=${onClose}
      foot=${html`<${E.Btn} onClick=${onClose}>Vazgeç<//><${E.Btn} kind="p" onClick=${save}>Sonucu kaydet<//>`}>
      ${type === 'Final' && w ? html`<div className="muted">Son operasyondan çıkan sağlam: ${E.woGood(w)} · daha önce final kabul: ${E.finalAccepted(w.id)}</div>` : null}
      ${type === 'Gelen' && lot ? html`<div className="muted">${E.nameOf('materials', lot.materialId)} · ${E.nameOf('suppliers', lot.supplierId)} · ${E.fmtN(lot.qtyIn, 1)} ${lot.unit} · CoC ${E.docsFor('lots/' + lot.id, 'Malzeme CoC').length ? 'yüklü' : 'yok'}</div>` : null}
      <${E.SchemaForm} fields=${fields} value=${f} set=${(k, v) => setF(Object.assign({}, f, { [k]: v }))} />
      <div className="row"><${E.Btn} onClick=${() => inp.current && inp.current.click()}>${file ? 'Rapor: ' + file.name : (type === 'FAI' ? 'FAI raporu seç (AS9102 form 1-2-3)' : 'Ölçüm raporu seç')}<//>
        <input ref=${inp} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.csv" onChange=${(e) => setFile(e.target.files && e.target.files[0])} /><span className="muted">PDF, görsel veya CSV</span></div>
      ${f.result === 'Ret' ? html`<div className="alert bad">Ret kaydedildikten sonra NCR formu açılır.</div>` : null}
    <//>`;
  }
  E.newInspection = (p) => E.showModal(NewInspection, p);

  const inspCols = [{ k: 'no', label: 'No', mono: true }, { k: 'type', label: 'Tip' },
    { label: 'Kayıt', v: (i) => (i.woId ? html`<${E.RecLink} type="workorder" id=${i.woId}>${E.nameOf('workorders', i.woId)}<//>` : html`<${E.RecLink} type="lot" id=${i.lotId}>${E.nameOf('lots', i.lotId)}<//>`), csv: (i) => E.nameOf(i.woId ? 'workorders' : 'lots', i.woId || i.lotId) },
    { label: 'Adet', num: true, k: 'qty' }, { label: 'Kontrolör', v: (i) => E.userName(i.inspector) }, { label: 'Tarih', v: (i) => E.fmtD(i.date) }, { label: 'Sonuç', v: (i) => html`<${E.Badge} s=${i.result} />`, csv: (i) => i.result }];

  E.pages['kalite/gelen'] = () => {
    const D = E.useStore();
    const queue = Object.values(D.lots).filter((l) => (l.status || 'Karantina') === 'Karantina');
    const can = E.canEdit('gelen');
    return html`<div className="col" style=${{ gap: 16 }}>
      <${E.Head} crumb="Kalite › Gelen kontrol" title="Gelen kontrol" />
      <${E.Card} title=${'Bekleyen lotlar (' + queue.length + ')'}><${E.Table} rows=${queue} empty=${html`<div className="empty">Gelen kontrol bekleyen lot yok.</div>`}
        cols=${[{ label: 'Lot', v: (l) => html`<${E.RecLink} type="lot" id=${l.id}>${l.no}<//>` }, { label: 'Malzeme', v: (l) => E.nameOf('materials', l.materialId) }, { label: 'Tedarikçi', v: (l) => E.nameOf('suppliers', l.supplierId) },
          { k: 'heat', label: 'Şarj no', mono: true }, { label: 'Giriş', v: (l) => E.fmtD(l.date) }, { label: 'CoC', v: (l) => (E.docsFor('lots/' + l.id, 'Malzeme CoC').length ? '✔' : 'yok') },
          can ? { label: '', v: (l) => html`<${E.Btn} sm kind="p" onClick=${() => E.newInspection({ lotId: l.id, type: 'Gelen' })}>Muayene et<//>` } : null].filter(Boolean)} /><//>
      <${E.ListPage} title="Geçmiş gelen kontroller" csv="Gelen_kontrol" rows=${Object.values(D.inspections).filter((i) => i.type === 'Gelen').sort((a, b) => (b.no || '').localeCompare(a.no || ''))} cols=${inspCols} onRow=${(i) => E.openRec('inspection', i.id)} />
    </div>`;
  };
  E.pages['kalite/final'] = () => {
    const D = E.useStore();
    const can = E.canEdit('kalite');
    const queue = Object.values(D.workorders).filter((w) => !['Taslak', 'İptal', 'Kapandı'].includes(w.status) && (E.woGood(w) > E.finalAccepted(w.id) || (E.faiNeeded(w) && E.woGood(w) > 0)));
    return html`<div className="col" style=${{ gap: 16 }}>
      <${E.Head} crumb="Kalite › Final muayene ve FAI" title="Final muayene ve FAI" />
      <${E.Card} title=${'Muayene bekleyen iş emirleri (' + queue.length + ')'}><${E.Table} rows=${queue} empty=${html`<div className="empty">Final muayene bekleyen iş emri yok. Son operasyondan sağlam parça çıktıkça burada görünür.</div>`}
        cols=${[{ label: 'İş emri', v: (w) => html`<${E.RecLink} type="workorder" id=${w.id}>${w.no}<//>` }, { label: 'Parça', v: (w) => E.partLabel(w.partId, w.rev) }, { label: 'Müşteri', v: (w) => { const o = E.orderOf(w); return o ? E.nameOf('customers', o.customerId) : '—'; } },
          { label: 'Sağlam çıkan', num: true, v: (w) => E.woGood(w) }, { label: 'Final kabul', num: true, v: (w) => E.finalAccepted(w.id) }, { label: 'FAI', v: (w) => (E.faiNeeded(w) ? html`<${E.Badge} s="FAI gerekli" />` : '—') },
          can ? { label: '', v: (w) => html`<div className="row" style=${{ flexWrap: 'nowrap' }}>${E.faiNeeded(w) ? html`<${E.Btn} sm onClick=${() => E.newInspection({ woId: w.id, type: 'FAI' })}>FAI<//>` : null}<${E.Btn} sm kind="p" onClick=${() => E.newInspection({ woId: w.id, type: 'Final' })}>Final<//></div>` } : null].filter(Boolean)} /><//>
      <${E.ListPage} title="Geçmiş final, ara ve FAI muayeneleri" csv="Muayeneler" rows=${Object.values(D.inspections).filter((i) => i.type !== 'Gelen').sort((a, b) => (b.no || '').localeCompare(a.no || ''))} cols=${inspCols} onRow=${(i) => E.openRec('inspection', i.id)} />
    </div>`;
  };
  E.details.inspection = ({ id }) => {
    E.useStore();
    const i = E.get('inspections', id);
    if (!i) return html`<${E.Empty} title="Muayene bulunamadı" text="" />`;
    const w = i.woId ? E.get('workorders', i.woId) : null;
    return html`<div className="col" style=${{ gap: 16 }}>
      <${E.Head} crumb=${html`<${E.BackCrumb} label="Muayeneler" here=${i.no} />`} title=${html`<span className="mono">${i.no}</span> · ${i.type} muayene`} badge=${html`<${E.Badge} s=${i.result} />`} />
      <div className="split"><div className="l"><${E.Card} title="Sonuç"><div className="pad"><${E.KV} items=${[
        ['Kayıt', w ? html`<${E.RecLink} type="workorder" id=${w.id}>${w.no}<//>` : html`<${E.RecLink} type="lot" id=${i.lotId}>${E.nameOf('lots', i.lotId)}<//>`],
        w ? ['Parça', E.partLabel(w.partId, w.rev)] : ['Şarj no', (E.get('lots', i.lotId) || {}).heat], i.seq ? ['Operasyon', 'Op' + i.seq] : null,
        ['Adet', i.qty], ['Sonuç', i.result], ['Kontrolör', E.userName(i.inspector)], ['Tarih', E.fmtD(i.date)], ['Ölçüm aletleri', i.tools], ['Not', i.note]]} /></div><//></div>
      <div className="r"><${E.DocPanel} refKey=${'inspections/' + id} kinds=${['Ölçüm raporu', 'FAI raporu', 'Fotoğraf', 'Diğer']} /><${E.History} rec=${i} /></div></div>
    </div>`;
  };

  // ---------- NCR ----------
  function NewNcr({ woId, lotId, subId, seq, qty, desc, onClose }) {
    const [f, setF] = useState({ kind: lotId ? 'lot' : subId ? 'sub' : 'wo', woId: woId || '', lotId: lotId || '', subId: subId || '', seq: seq ? String(seq) : '', qty: qty ? String(qty) : '', desc: desc || '' });
    const w = f.woId ? E.get('workorders', f.woId) : null;
    const fields = [
      { k: 'kind', label: 'Bağlı kayıt türü', type: 'select', options: [{ v: 'wo', l: 'İş emri' }, { v: 'lot', l: 'Malzeme lotu' }, { v: 'sub', l: 'Fason kaydı' }] },
      { k: 'woId', label: 'İş emri', type: 'select', req: true, show: (v) => v.kind === 'wo', options: () => E.list('workorders').filter((x) => !['İptal', 'Taslak'].includes(x.status)).map((x) => ({ v: x.id, l: x.no + ' · ' + E.partLabel(x.partId, x.rev) })) },
      { k: 'seq', label: 'Operasyon', type: 'select', show: (v) => v.kind === 'wo', options: () => ((w && w.ops) || []).map((o) => ({ v: String(o.seq), l: 'Op' + o.seq + ' ' + o.name })) },
      { k: 'lotId', label: 'Lot', type: 'select', req: true, show: (v) => v.kind === 'lot', options: () => E.list('lots').map((l) => ({ v: l.id, l: l.no + ' · şarj ' + l.heat })) },
      { k: 'subId', label: 'Fason kaydı', type: 'select', req: true, show: (v) => v.kind === 'sub', options: () => E.list('subcons').map((s) => ({ v: s.id, l: s.no + ' · ' + E.nameOf('suppliers', s.supplierId) })) },
      { k: 'qty', label: 'Uygunsuz adet / miktar', type: 'number', req: true }, { k: 'desc', label: 'Uygunsuzluk tanımı', type: 'textarea', req: true }
    ];
    const save = async () => {
      if (E.missing(fields, f).length) { E.toast('Zorunlu alanları doldurun', 'err'); return; }
      const sub = f.kind === 'sub' ? E.get('subcons', f.subId) : null;
      const n = await E.save('ncrs', { no: E.nextNo('ncrs', 'NCR'), woId: f.kind === 'wo' ? f.woId : sub ? sub.woId : '', lotId: f.kind === 'lot' ? f.lotId : '', subId: f.kind === 'sub' ? f.subId : '', seq: f.kind === 'wo' && f.seq ? +f.seq : sub ? sub.seq : '',
        qty: E.num(f.qty), desc: f.desc, cause: '', decision: '', status: 'Açık', source: 'Kalite', date: E.today() }, 'NCR açıldı');
      onClose(); E.openRec('ncr', n.id);
    };
    return html`<${E.Modal} wide title="Uygunsuzluk (NCR) aç" onClose=${onClose} foot=${html`<${E.Btn} onClick=${onClose}>Vazgeç<//><${E.Btn} kind="p" onClick=${save}>NCR aç<//>`}>
      <${E.SchemaForm} fields=${fields} value=${f} set=${(k, v) => setF(Object.assign({}, f, { [k]: v }))} />
    <//>`;
  }
  E.newNcr = (p) => E.showModal(NewNcr, p);
  const ncrRef = (n) => (n.woId ? html`<${E.RecLink} type="workorder" id=${n.woId}>${E.nameOf('workorders', n.woId)}<//>${n.seq ? ' · Op' + n.seq : ''}` : n.lotId ? html`<${E.RecLink} type="lot" id=${n.lotId}>${E.nameOf('lots', n.lotId)}<//>` : '—');
  E.pages['kalite/ncr'] = () => {
    const D = E.useStore();
    const [chip, setChip] = useState('Açık');
    const rows = Object.values(D.ncrs).filter((n) => chip === 'Tümü' || n.status === chip).sort((a, b) => (b.no || '').localeCompare(a.no || ''));
    return html`<${E.ListPage} title="Uygunsuzluklar (NCR)" crumb="Kalite › NCR" csv="NCR" chips=${['Açık', 'Karar verildi', 'Kapandı', 'Tümü']} chip=${chip} setChip=${setChip} rows=${rows} onRow=${(n) => E.openRec('ncr', n.id)}
      actions=${E.canEdit('kalite') ? html`<${E.Btn} kind="p" onClick=${() => E.newNcr({})}>+ NCR aç<//>` : null}
      empty=${html`<${E.Empty} title="Bu filtrede NCR yok" text=" Operatör hurda girdiğinde veya muayene reddinde NCR otomatik açılır." />`}
      cols=${[{ k: 'no', label: 'No', mono: true }, { label: 'Bağlı kayıt', v: ncrRef, csv: (n) => E.nameOf(n.woId ? 'workorders' : 'lots', n.woId || n.lotId) }, { label: 'Parça', v: (n) => { const w = E.get('workorders', n.woId); return w ? E.partLabel(w.partId, w.rev) : '—'; } },
        { k: 'qty', label: 'Adet', num: true }, { k: 'desc', label: 'Tanım', wrap: true }, { k: 'source', label: 'Kaynak' }, { label: 'Karar', v: (n) => n.decision || '—' }, { label: 'Tarih', v: (n) => E.fmtD(n.date) }, { label: 'Durum', v: (n) => html`<${E.Badge} s=${n.status} />`, csv: (n) => n.status }]} />`;
  };
  function NcrDetail({ id }) {
    E.useStore();
    const n = E.get('ncrs', id);
    const [f, setF] = useState(null);
    if (!n) return html`<${E.Empty} title="NCR bulunamadı" text="" />`;
    const can = E.canEdit('kalite') && n.status !== 'Kapandı';
    const cur = f || { decision: n.decision || '', cause: n.cause || '', recovered: n.recovered == null ? '' : String(n.recovered) };
    const approval = E.docsFor('ncrs/' + id, 'Müşteri onayı').length > 0;
    const decide = async () => {
      if (!cur.decision) { E.toast('Karar seçin', 'err'); return; }
      await E.save('ncrs', Object.assign({}, n, { decision: cur.decision, cause: cur.cause, status: 'Karar verildi' }), 'Karar: ' + cur.decision); setF(null);
    };
    const close = async () => {
      if (n.decision === 'Müşteri onaylı kabul' && !approval) { E.toast('Müşteri onaylı kabul için müşteri onay belgesini yükleyin', 'err'); return; }
      const rec = E.num(cur.recovered);
      if (n.decision === 'Yeniden işleme' && (cur.recovered === '' || rec > n.qty)) { E.toast('Yeniden işlemeden sağlam çıkan adedi girin (en fazla ' + n.qty + ')', 'err'); return; }
      await E.save('ncrs', Object.assign({}, n, { cause: cur.cause, recovered: n.decision === 'Yeniden işleme' ? rec : null, status: 'Kapandı', closedAt: E.now() }), 'Kapatıldı' + (n.decision === 'Yeniden işleme' ? ' · ' + rec + ' adet kurtarıldı' : ''));
      const w = E.get('workorders', n.woId); if (w) await E.save('workorders', w, n.no + ' kapatıldı · ' + n.decision);
      setF(null);
    };
    return html`<div className="col" style=${{ gap: 16 }}>
      <${E.Head} crumb=${html`<${E.BackCrumb} label="NCR" here=${n.no} />`} title=${html`<span className="mono">${n.no}</span> · ${n.qty} adet`} badge=${html`<${E.Badge} s=${n.status} />`}
        actions=${can && n.status === 'Karar verildi' ? html`<${E.Btn} kind="p" onClick=${close}>Kapat<//>` : null} />
      <div className="split"><div className="l">
        <${E.Card} title="Uygunsuzluk"><div className="pad"><${E.KV} items=${[['Bağlı kayıt', ncrRef(n)], ['Kaynak', n.source], ['Tarih', E.fmtD(n.date)], ['Adet', n.qty], ['Tanım', n.desc]]} /></div><//>
        <${E.Card} title="Karar" act=${can && n.status === 'Açık' ? html`<${E.Btn} sm kind="p" onClick=${decide}>Kararı kaydet<//>` : null}><div className="pad col">
          <${E.Field} label="Karar" div><${E.Chips} opts=${['Hurda', 'Yeniden işleme', 'Müşteri onaylı kabul']} cur=${cur.decision} set=${(v) => can && n.status === 'Açık' && setF(Object.assign({}, cur, { decision: v }))} /><//>
          <${E.Field} label="Kök neden"><${E.Txt} value=${cur.cause} onChange=${(v) => can && setF(Object.assign({}, cur, { cause: v }))} /><//>
          ${n.decision === 'Yeniden işleme' && n.status === 'Karar verildi' ? html`<${E.Field} label="Yeniden işlemeden sağlam çıkan adet (kapatırken)"><${E.Inp} value=${cur.recovered} disabled=${!can} onChange=${(v) => setF(Object.assign({}, cur, { recovered: v }))} /><//>` : null}
          ${n.decision === 'Müşteri onaylı kabul' ? html`<div className=${'alert ' + (approval ? 'ok' : 'warn')}>${approval ? 'Müşteri onay belgesi yüklü.' : 'Kapatmak için sağdaki Belgeler panelinden “Müşteri onayı” yükleyin.'}</div>` : null}
          <div className="muted" style=${{ fontSize: 12.5 }}>Hurda: parçalar hurda kalır. Yeniden işleme: kapatırken girilen sağlam adet operasyona geri eklenir. Müşteri onaylı kabul: operatör hurdası sağlam sayılır, onay belgesi CoC'de referans olur. Açık NCR'si olan iş emri sevk edilemez.</div>
          ${n.recovered != null && n.status === 'Kapandı' ? html`<div>Kurtarılan: ${n.recovered} adet</div>` : null}
        </div><//>
      </div><div className="r">
        <${E.DocPanel} refKey=${'ncrs/' + id} kinds=${['Fotoğraf', 'Müşteri onayı', 'Diğer']} />
        <${E.History} rec=${n} />
      </div></div>
    </div>`;
  }
  E.details.ncr = NcrDetail;

  // ---------- traceability ----------
  const inRange = (txt, n) => { const m = /(\d+)\s*[–-]\s*(\d+)/.exec(txt || ''); return !m || (n >= +m[1] && n <= +m[2]); };
  function shipLinesFor(woId) {
    const out = [];
    E.list('shipments').forEach((s) => { if (s.status === 'İptal') return; (s.lines || []).forEach((l) => { if (l.woId === woId) out.push({ s, l }); }); });
    return out;
  }
  function Genealogy({ wo, serial }) {
    E.useStore();
    const n = serial ? +serial : null;
    const lots = (wo.lots || []).filter((l) => !n || inRange(l.serial, n));
    const prog = E.opProgress(wo);
    const cards = E.list('jobcards').filter((c) => c.woId === wo.id);
    const subs = E.list('subcons').filter((s) => s.woId === wo.id && s.status !== 'İptal');
    const insp = E.list('inspections').filter((i) => i.woId === wo.id);
    const ncrs = E.list('ncrs').filter((x) => x.woId === wo.id);
    const ships = shipLinesFor(wo.id).filter((x) => !n || (n >= +x.l.serialFrom && n <= +x.l.serialTo));
    const Row = ({ k, children }) => html`<div className="n"><span className="k">${k}</span><span>${children}</span></div>`;
    return html`<div className="tree">
      ${lots.length ? lots.map((l) => { const lot = E.get('lots', l.lotId) || {}; const coc = E.docsFor('lots/' + lot.id, 'Malzeme CoC')[0];
        return html`<${Row} key=${l.lotId} k="Malzeme"><${E.RecLink} type="lot" id=${lot.id}>${lot.no}<//> · şarj <b className="mono">${lot.heat}</b> · ${E.nameOf('materials', lot.materialId)} · ${E.nameOf('suppliers', lot.supplierId)} · seri ${l.serial} ${coc ? html`· <a href=${E.blobUrl(coc.assetId)} target="_blank" rel="noopener">CoC</a>` : '· CoC yok'}<//>`; })
        : html`<${Row} k="Malzeme"><span className="muted">Bağlı lot yok</span><//>`}
      ${prog.map((o) => html`<${Row} key=${o.seq} k=${'Op' + o.seq}>${o.name} · ${o.type === 'Fason'
        ? subs.filter((s) => s.seq === o.seq).map((s) => { const c = E.docsFor('subcons/' + s.id, 'Proses sertifikası')[0]; return html`<span key=${s.id}><${E.RecLink} type="subcon" id=${s.id}>${s.no}<//> ${E.nameOf('suppliers', s.supplierId)} · ${(s.moves || []).map((m) => m.type + ' ' + E.fmtD(m.date)).join(', ') || 'gönderilmedi'} · ${c ? html`<a href=${E.blobUrl(c.assetId)} target="_blank" rel="noopener">sertifika</a>` : 'sertifika yok'} </span>`; })
        : cards.filter((c) => c.seq === o.seq).map((c) => E.userName(c.userId) + ' · ' + E.machineName(c.machineId) + ' · ' + E.fmtDT(c.start) + (c.end ? '' : ' (devam)')).join(' | ') || 'henüz işlenmedi'}<//>`)}
      <${Row} k="Muayene">${insp.length ? insp.map((i) => html`<span key=${i.id}><${E.RecLink} type="inspection" id=${i.id}>${i.no}<//> ${i.type} ${i.result} (${E.userName(i.inspector)}, ${E.fmtD(i.date)}) </span>`) : 'yok'}<//>
      <${Row} k="NCR">${ncrs.length ? ncrs.map((x) => html`<span key=${x.id}><${E.RecLink} type="ncr" id=${x.id}>${x.no}<//> ${x.qty} ad. ${x.decision || x.status} </span>`) : 'yok'}<//>
      <${Row} k="Sevkiyat">${ships.length ? ships.map(({ s, l }) => html`<span key=${s.id + l.woId}><${E.RecLink} type="shipment" id=${s.id}>${s.no}<//> ${E.fmtD(s.date)} · <b>${E.nameOf('customers', s.customerId)}</b> · ${l.qty} ad. seri ${E.serial(l.serialFrom)}–${E.serial(l.serialTo)} · irs. ${s.dispatchNo || '—'} (${s.status}) </span>`) : 'henüz sevk yok'}<//>
    </div>`;
  }
  E.Genealogy = Genealogy;

  function TracePage() {
    const D = E.useStore();
    const [type, setType] = useState('sarj');
    const [q, setQ] = useState('');
    const [part, setPart] = useState('');
    const s = q.trim().toLocaleUpperCase('tr');
    let wos = [], lots = [], seriWo = null;
    if (s) {
      const allW = Object.values(D.workorders).filter((w) => w.status !== 'İptal');
      if (type === 'sarj' || type === 'lot') {
        lots = Object.values(D.lots).filter((l) => (type === 'sarj' ? (l.heat || '').toLocaleUpperCase('tr') === s : (l.no || '').toLocaleUpperCase('tr') === s));
        wos = allW.filter((w) => (w.lots || []).some((x) => lots.some((l) => l.id === x.lotId)));
      } else if (type === 'ie') wos = allW.filter((w) => (w.no || '').toLocaleUpperCase('tr') === s);
      else if (type === 'irs') { const ids = new Set(); Object.values(D.shipments).filter((x) => (x.dispatchNo || '').toLocaleUpperCase('tr') === s || (x.no || '').toLocaleUpperCase('tr') === s).forEach((x) => (x.lines || []).forEach((l) => ids.add(l.woId))); wos = allW.filter((w) => ids.has(w.id)); }
      else if (type === 'po') { const os = Object.values(D.orders).filter((o) => (o.po || '').toLocaleUpperCase('tr') === s).map((o) => o.id); wos = allW.filter((w) => os.includes(w.orderId)); }
      else if (type === 'seri' && part) { const n = parseInt(s, 10); seriWo = allW.find((w) => w.partId === part && n >= +w.serialFrom && n <= +w.serialTo) || null; }
      if (type !== 'sarj' && type !== 'lot') { const ids = new Set(); wos.forEach((w) => (w.lots || []).forEach((x) => ids.add(x.lotId))); lots = Object.values(D.lots).filter((l) => ids.has(l.id)); }
    }
    const rows = [];
    wos.forEach((w) => shipLinesFor(w.id).forEach(({ s: sh, l }) => rows.push({ id: sh.id + w.id, cust: E.nameOf('customers', sh.customerId), po: (E.get('orders', sh.orderId) || {}).po, ship: sh.no, date: sh.date, irs: sh.dispatchNo, part: E.partLabel(w.partId, w.rev), wo: w.no, qty: l.qty, serial: E.serial(l.serialFrom) + '–' + E.serial(l.serialTo), heat: (w.lots || []).map((x) => (E.get('lots', x.lotId) || {}).heat).join(', '), st: sh.status })));
    const heats = {};
    lots.forEach((l) => { (heats[l.heat] = heats[l.heat] || []).push(l); });
    const rcols = [{ k: 'cust', label: 'Müşteri' }, { k: 'po', label: 'PO', mono: true }, { k: 'ship', label: 'Sevkiyat', mono: true }, { label: 'Tarih', v: (r) => E.fmtD(r.date), csv: (r) => r.date }, { k: 'irs', label: 'İrsaliye', mono: true },
      { k: 'part', label: 'Parça' }, { k: 'wo', label: 'İş emri', mono: true }, { k: 'qty', label: 'Adet', num: true }, { k: 'serial', label: 'Seri', mono: true }, { k: 'heat', label: 'Şarj', mono: true }, { k: 'st', label: 'Durum' }];
    return html`<div className="col" style=${{ gap: 16 }}>
      <${E.Head} crumb="Kalite › İzlenebilirlik sorgusu" title="İzlenebilirlik sorgusu" />
      <div className="card pad col">
        <div className="row"><span className="muted">Ne ile arıyorsunuz?</span><${E.Chips} opts=${[['sarj', 'Şarj no'], ['lot', 'Lot no'], ['seri', 'Seri no'], ['ie', 'İş emri'], ['irs', 'İrsaliye / sevkiyat no'], ['po', 'Müşteri PO']]} cur=${type} set=${(v) => { setType(v); setQ(''); }} /></div>
        <div className="row">
          ${type === 'seri' ? html`<${E.Sel} value=${part} options=${E.list('parts').map((p) => ({ v: p.id, l: p.partNo }))} empty="Parça seçin" onChange=${setPart} />` : null}
          <input className="in mono" style=${{ maxWidth: 320, height: 44, fontSize: 16 }} aria-label="Aranacak değer" placeholder=${type === 'seri' ? 'Seri no (ör. 17)' : 'Tam değeri yazın'} value=${q} onChange=${(e) => setQ(e.target.value)} />
          <span className="muted">${type === 'seri' ? 'Geri izleme: o parçanın tüm geçmişi' : 'İleri izleme: bu kayıttan çıkan parçalar hangi müşteriye gitti'}</span>
        </div>
      </div>
      ${type === 'seri' ? (s && part ? (seriWo ? html`<${E.Card} title=${'Geri izleme · ' + E.partLabel(seriWo.partId, seriWo.rev) + ' · seri ' + E.serial(+s) + ' · ' + seriWo.no}><div className="pad"><${Genealogy} wo=${seriWo} serial=${s} /></div><//>`
        : html`<div className="card"><${E.Empty} title="Bulunamadı" text=" Bu parça için bu seri numarasını kapsayan iş emri yok." /></div>`) : null)
      : s ? html`
        <${E.Card} title="İleri izleme">${lots.length || wos.length ? html`<div className="pad tree">
          ${Object.keys(heats).map((h) => html`<div key=${h} className="tree">
            <div className="n"><span className="k">Şarj</span><b className="mono">${h}</b> · ${E.nameOf('materials', heats[h][0].materialId)} · ${E.nameOf('suppliers', heats[h][0].supplierId)}</div>
            <div className="sub">${heats[h].map((l) => html`<div key=${l.id} className="tree">
              <div className="n"><span className="k">Lot</span><${E.RecLink} type="lot" id=${l.id}>${l.no}<//> · giriş ${E.fmtN(l.qtyIn, 1)} ${l.unit} · kalan ${E.fmtN(E.lotRemaining(l), 1)} · <${E.Badge} s=${E.lotStatus(l)} /></div>
              <div className="sub">${wos.filter((w) => (w.lots || []).some((x) => x.lotId === l.id)).map((w) => html`<div key=${w.id} className="tree">
                <div className="n"><span className="k">İş emri</span><${E.RecLink} type="workorder" id=${w.id}>${w.no}<//> · ${E.partLabel(w.partId, w.rev)} · ${w.qty} ad. · seri ${E.serialText(w)} · <${E.Badge} s=${E.woStatus(w)} /></div>
                <div className="sub">${shipLinesFor(w.id).length ? shipLinesFor(w.id).map(({ s: sh, l: ln }) => html`<div key=${sh.id} className="n"><span className="k">Sevkiyat</span><${E.RecLink} type="shipment" id=${sh.id}>${sh.no}<//> · ${E.fmtD(sh.date)} · <b>${E.nameOf('customers', sh.customerId)}</b> · PO ${(E.get('orders', sh.orderId) || {}).po || '—'} · ${ln.qty} ad. · seri ${E.serial(ln.serialFrom)}–${E.serial(ln.serialTo)} · irs. ${sh.dispatchNo || '—'}</div>`)
                  : html`<div className="n muted">Henüz sevk yok</div>`}</div></div>`)}</div></div>`)}</div></div>`)}
          ${wos.filter((w) => !(w.lots || []).length).map((w) => html`<div key=${w.id} className="n"><span className="k">İş emri</span><${E.RecLink} type="workorder" id=${w.id}>${w.no}<//> · lot bağlanmamış</div>`)}
        </div>` : html`<${E.Empty} title="Sonuç yok" text=" Değeri tam olarak yazın (büyük/küçük harf fark etmez)." />`}<//>
        ${rows.length ? html`<div className="card"><h3 style=${{ margin: 0, padding: '12px 16px', fontSize: 15, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center' }}>Sonuç tablosu<span style=${{ marginLeft: 'auto' }}><${E.Btn} sm onClick=${() => E.exportCsv('Izlenebilirlik_' + s, rcols, rows)}>Excel'e aktar (CSV)<//></span></h3><${E.Table} cols=${rcols} rows=${rows} /></div>` : null}` : null}
    </div>`;
  }
  E.pages['kalite/izlenebilirlik'] = TracePage;
})();
