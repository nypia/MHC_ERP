// Purchasing & subcontracting: material lots (with CoC), subcontract tracking.
(function () {
  const E = window.ERP;
  const { html } = E;
  const { useState, useRef } = React;
  const N = E.fmtN;

  // ---------- material lots ----------
  const lotFields = [
    { k: 'materialId', label: 'Malzeme', type: 'select', req: true, options: () => E.matOpts() },
    { k: 'supplierId', label: 'Tedarikçi', type: 'select', req: true, options: () => E.list('suppliers').filter((s) => s.active !== false && s.type !== 'Fason').map((s) => ({ v: s.id, l: s.name })) },
    { k: 'heat', label: 'Şarj (heat) no', req: true }, { k: 'date', label: 'Giriş tarihi', type: 'date', req: true },
    { k: 'qtyIn', label: 'Miktar', type: 'number', req: true }, { k: 'unit', label: 'Birim', type: 'select', options: ['kg', 'adet', 'mm'] },
    { k: 'bars', label: 'Boy / adet', ph: '5 × 3000 mm' }, { k: 'supplierDispatch', label: 'Tedarikçi irsaliye no' }, { k: 'certNo', label: 'Sertifika no (CoC üzerindeki)' }
  ];
  function LotsPage() {
    const D = E.useStore();
    const [chip, setChip] = useState('Kullanılabilir');
    const [form, setForm] = useState(null);
    const [file, setFile] = useState(null);
    const inp = useRef(null);
    const can = E.canEdit('satinalma');
    const rows = Object.values(D.lots).map((l) => Object.assign({}, l, { st: E.lotStatus(l), rem: E.lotRemaining(l) }))
      .filter((l) => chip === 'Tümü' || (chip === 'Kullanılabilir' ? ['Kabul', 'Karantina'].includes(l.st) : l.st === chip)).sort((a, b) => (b.no || '').localeCompare(a.no || ''));
    const submit = async () => {
      const m = E.missing(lotFields, form); if (m.length) { E.toast('Zorunlu alanları doldurun', 'err'); return; }
      const r = await E.save('lots', Object.assign({}, form, { no: E.nextNo('lots', 'LOT'), qtyIn: E.num(form.qtyIn), unit: form.unit || 'kg', status: 'Karantina' }), 'Malzeme girişi · gelen kontrol bekliyor');
      if (file) await E.uploadDoc('lots/' + r.id, 'Malzeme CoC', file);
      setForm(null); setFile(null); E.toast(r.no + ' oluşturuldu, gelen kontrol kuyruğuna düştü'); E.openRec('lot', r.id);
    };
    return html`<div>
      <${E.ListPage} title="Malzeme lotları" crumb="Satınalma ve fason › Malzeme lotları" csv="Malzeme_lotlari" chips=${['Kullanılabilir', 'Karantina', 'Kabul', 'Ret', 'Tükendi', 'Tümü']} chip=${chip} setChip=${setChip}
        rows=${rows} onRow=${(r) => E.openRec('lot', r.id)}
        cols=${[{ k: 'no', label: 'Lot', mono: true }, { label: 'Malzeme', v: (l) => E.nameOf('materials', l.materialId) }, { label: 'Tedarikçi', v: (l) => E.nameOf('suppliers', l.supplierId) }, { k: 'heat', label: 'Şarj no', mono: true },
          { label: 'Giriş', v: (l) => E.fmtD(l.date) }, { label: 'Miktar', num: true, v: (l) => N(l.qtyIn, 1) + ' ' + (l.unit || '') }, { label: 'Kalan', num: true, v: (l) => N(l.rem, 1) + ' ' + (l.unit || ''), csv: (l) => l.rem },
          { label: 'CoC', v: (l) => (E.docsFor('lots/' + l.id, 'Malzeme CoC').length ? '✔' : '—') }, { label: 'Gelen kontrol', v: (l) => html`<${E.Badge} s=${l.st} />`, csv: (l) => l.st }]}
        empty=${html`<${E.Empty} title="Lot yok" text=" Malzeme geldiğinde “+ Malzeme girişi” ile lot açın ve CoC'yi yükleyin." />`}
        actions=${can ? html`<${E.Btn} kind="p" onClick=${() => setForm({ date: E.today(), unit: 'kg' })}>+ Malzeme girişi<//>` : null} />
      ${form ? html`<${E.Modal} wide title="Malzeme girişi (yeni lot)" onClose=${() => setForm(null)} foot=${html`<${E.Btn} onClick=${() => setForm(null)}>Vazgeç<//><${E.Btn} kind="p" onClick=${submit}>Kaydet<//>`}>
        <${E.SchemaForm} fields=${lotFields} value=${form} set=${(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
        <div className="row"><${E.Btn} onClick=${() => inp.current && inp.current.click()}>${file ? 'CoC: ' + file.name : 'Malzeme CoC dosyası seç'}<//>
          <input ref=${inp} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.webp" onChange=${(e) => setFile(e.target.files && e.target.files[0])} />
          <span className="muted">CoC sadece saklanır, başka adımı etkilemez. Lot gelen kontrol kabul edilince iş emrine bağlanabilir.</span></div>
      <//>` : null}
    </div>`;
  }
  E.pages['satinalma/lotlar'] = LotsPage;
  E.details.lot = ({ id }) => {
    E.useStore();
    const l = E.get('lots', id);
    if (!l) return html`<${E.Empty} title="Lot bulunamadı" text="" />`;
    const st = E.lotStatus(l);
    const insp = E.list('inspections').filter((i) => i.lotId === id);
    const wos = E.list('workorders').filter((w) => (w.lots || []).some((x) => x.lotId === id));
    return html`<${E.CrudDetail} col="lots" id=${id} fields=${lotFields} area="satinalma" crumb="Malzeme lotları" title=${(r) => r.no + ' · şarj ' + r.heat}
      docKinds=${['Malzeme CoC', 'Tedarikçi irsaliyesi', 'Diğer']}
      side=${() => html`<${E.Card} title="Gelen kontrol"><div className="pad col" style=${{ gap: 8 }}>
        <div>Durum: <${E.Badge} s=${st} /> · kalan ${N(E.lotRemaining(l), 1)} ${l.unit || ''}</div>
        ${insp.map((i) => html`<div key=${i.id}><${E.RecLink} type="inspection" id=${i.id}>${i.no}<//> · ${E.fmtD(i.date)} · <${E.Badge} s=${i.result || 'Taslak'} /></div>`)}
        ${st === 'Karantina' && E.canEdit('gelen') ? html`<${E.Btn} kind="p" onClick=${() => E.newInspection({ lotId: id, type: 'Gelen' })}>Gelen kontrol yap<//>` : null}
      </div><//>`}
      extra=${() => html`<${E.Card} title="Bu lotu kullanan iş emirleri"><${E.Table} rows=${wos} onRow=${(w) => E.openRec('workorder', w.id)} empty=${html`<div className="empty">Henüz kullanılmadı.</div>`}
        cols=${[{ k: 'no', label: 'İş emri', mono: true }, { label: 'Parça', v: (w) => E.partLabel(w.partId, w.rev) }, { label: 'Kullanılan', num: true, v: (w) => N((w.lots || []).filter((x) => x.lotId === id).reduce((s, x) => s + x.qty, 0), 1) },
          { label: 'Seri', v: (w) => (w.lots || []).filter((x) => x.lotId === id).map((x) => x.serial).join(', ') }, { label: 'Durum', v: (w) => html`<${E.Badge} s=${E.woStatus(w)} />` }]} /><//>`} />`;
  };

  // ---------- subcontracting ----------
  const sumMoves = (s, t) => (s.moves || []).filter((m) => m.type === t).reduce((a, m) => a + (+m.qty || 0), 0);
  function subStatus(s) {
    if (s.status === 'İptal') return 'İptal';
    if (s.closed) return 'Tamamlandı';
    const out = sumMoves(s, 'Giden'), inn = sumMoves(s, 'Gelen');
    if (!out) return 'Planlandı';
    if (inn < out) return inn ? 'Kısmi döndü' : 'Gönderildi';
    return 'Döndü';
  }
  Object.assign(E, { subStatus, sumMoves });
  function supWarn(sup, pid) {
    const w = [];
    if (!sup) return w;
    if (!(sup.procs || []).includes(pid)) w.push(sup.name + ' bu proses için onaylı değil');
    const c = E.certState(sup);
    if (c && c.st === 'Süresi dolmuş') w.push(sup.name + ' sertifikasının süresi dolmuş (' + E.fmtD(sup.certExpiry) + ')');
    return w;
  }
  function NewSubcon({ w, onClose }) {
    const fops = (w.ops || []).filter((o) => o.type === 'Fason');
    const defSup = (o) => (o ? o.supplierId || (E.supOpts(o.processId)[0] || {}).v || '' : '');
    const [f, setF] = useState({ seq: fops[0] ? String(fops[0].seq) : '', supplierId: defSup(fops[0]), expectedReturn: E.addDays(E.today(), 7), why: '' });
    const op = fops.find((o) => String(o.seq) === String(f.seq));
    const sup = E.get('suppliers', f.supplierId);
    const warns = op ? supWarn(sup, op.processId) : [];
    const boss = (E.currentUser().roles || []).includes('yonetici');
    const ok = op && sup && (!warns.length || (boss && f.why.trim()));
    const create = async () => {
      const s = await E.save('subcons', { no: E.nextNo('subcons', 'FSN'), woId: w.id, seq: op.seq, processId: op.processId, supplierId: sup.id, expectedReturn: f.expectedReturn, moves: [], status: 'Açık', closed: false, overrideReason: warns.length ? f.why : '' },
        'Oluşturuldu' + (warns.length ? ' · uyarı geçildi: ' + warns.join('; ') + ' · gerekçe: ' + f.why : ''));
      onClose(); E.openRec('subcon', s.id);
    };
    return html`<${E.Modal} title=${'Fasona gönder · ' + w.no} onClose=${onClose} foot=${html`<${E.Btn} onClick=${onClose}>Vazgeç<//><${E.Btn} kind="p" disabled=${!ok} onClick=${create}>Fason kaydı oluştur<//>`}>
      <${E.SchemaForm} value=${f} set=${(k, v) => setF(Object.assign({}, f, { [k]: v }, k === 'seq' ? { supplierId: defSup(fops.find((o) => String(o.seq) === v)) } : {}))}
        fields=${[{ k: 'seq', label: 'Fason operasyon', type: 'select', req: true, options: fops.map((o) => ({ v: String(o.seq), l: 'Op' + o.seq + ' ' + o.name + ' · ' + E.nameOf('processes', o.processId) })) },
          { k: 'supplierId', label: 'Tedarikçi', type: 'select', req: true, options: () => E.list('suppliers').filter((s) => s.active !== false && s.type !== 'Malzeme').map((s) => ({ v: s.id, l: s.name + (op && (s.procs || []).includes(op.processId) ? ' ✔ onaylı' : '') })) },
          { k: 'expectedReturn', label: 'Beklenen dönüş', type: 'date' }]} />
      ${warns.map((x) => html`<div key=${x} className="alert bad">${x}</div>`)}
      ${warns.length ? (boss ? html`<${E.Field} label="Yönetici gerekçesi (kayda düşer)"><${E.Txt} value=${f.why} onChange=${(v) => setF(Object.assign({}, f, { why: v }))} /><//>` : html`<div className="muted">Bu uyarıyı sadece yönetici gerekçe yazarak geçebilir.</div>`) : null}
    <//>`;
  }
  E.newSubcon = (w) => E.showModal(NewSubcon, { w });

  function SubconsPage() {
    const D = E.useStore();
    const [chip, setChip] = useState('Açık');
    const rows = Object.values(D.subcons).map((s) => Object.assign({}, s, { st: subStatus(s) }))
      .filter((s) => chip === 'Tümü' || (chip === 'Açık' ? !['Tamamlandı', 'İptal'].includes(s.st) : s.st === chip)).sort((a, b) => (b.no || '').localeCompare(a.no || ''));
    const firstOut = (s) => (s.moves || []).filter((m) => m.type === 'Giden').map((m) => m.date).sort()[0];
    return html`<${E.ListPage} title="Fason takibi" crumb="Satınalma ve fason › Fason takibi" csv="Fason" chips=${['Açık', 'Tamamlandı', 'İptal', 'Tümü']} chip=${chip} setChip=${setChip} rows=${rows}
      onRow=${(r) => E.openRec('subcon', r.id)} rowClass=${(s) => (s.expectedReturn && s.expectedReturn < E.today() && ['Gönderildi', 'Kısmi döndü'].includes(s.st) ? 'late' : '')}
      empty=${html`<${E.Empty} title="Fason kaydı yok" text=" İş emrinin Fason sekmesinden “Fasona gönder” ile açılır." />`}
      cols=${[{ k: 'no', label: 'No', mono: true }, { label: 'İş emri', v: (s) => html`<${E.RecLink} type="workorder" id=${s.woId}>${E.nameOf('workorders', s.woId)}<//>`, csv: (s) => E.nameOf('workorders', s.woId) }, { label: 'Op', k: 'seq' },
        { label: 'Proses', v: (s) => E.nameOf('processes', s.processId) }, { label: 'Tedarikçi', v: (s) => E.nameOf('suppliers', s.supplierId) },
        { label: 'Giden', num: true, v: (s) => sumMoves(s, 'Giden') }, { label: 'Dönen', num: true, v: (s) => sumMoves(s, 'Gelen') },
        { label: 'Dışarıda', num: true, v: (s) => { const f = firstOut(s); return f && !['Tamamlandı', 'Döndü'].includes(s.st) ? E.daysBetween(f, E.today()) + ' gün' : '—'; } },
        { label: 'Beklenen dönüş', v: (s) => E.fmtD(s.expectedReturn) }, { label: 'Sertifika', v: (s) => (E.docsFor('subcons/' + s.id, 'Proses sertifikası').length ? '✔' : '✗') },
        { label: 'Durum', v: (s) => html`<${E.Badge} s=${s.st} />`, csv: (s) => s.st }]} />`;
  }
  E.pages['satinalma/fason'] = SubconsPage;

  function SubconDetail({ id }) {
    const D = E.useStore();
    const s = D.subcons[id];
    const [mv, setMv] = useState(null);
    if (!s) return html`<${E.Empty} title="Fason kaydı bulunamadı" text="" />`;
    const w = E.get('workorders', s.woId);
    const st = subStatus(s);
    const can = E.canEdit('satinalma') && !['Tamamlandı', 'İptal'].includes(st);
    const out = sumMoves(s, 'Giden'), inn = sumMoves(s, 'Gelen');
    const op = w ? E.opProgress(w).find((o) => o.seq === s.seq) : null;
    const sentOther = E.list('subcons').filter((x) => x.woId === s.woId && x.seq === s.seq && x.id !== s.id && x.status !== 'İptal').reduce((a, x) => a + sumMoves(x, 'Giden'), 0);
    const canSend = op ? op.input - sentOther - out : 0;
    const hasCert = E.docsFor('subcons/' + id, 'Proses sertifikası').length > 0;
    const sup = E.get('suppliers', s.supplierId);
    const addMove = async () => {
      const q = E.num(mv.qty);
      if (!q || !mv.date) { E.toast('Tarih ve adet girin', 'err'); return; }
      if (mv.type === 'Giden' && q > canSend) { E.toast('Gönderilebilecek en fazla ' + canSend + ' adet var (önceki operasyonun sağlam adedi)', 'err'); return; }
      if (mv.type === 'Gelen' && inn + q > out) { E.toast('Dönen adet gidenden (' + out + ') fazla olamaz', 'err'); return; }
      await E.save('subcons', Object.assign({}, s, { moves: (s.moves || []).concat({ type: mv.type, date: mv.date, qty: q, dispatchNo: mv.dispatchNo || '' }) }), mv.type + ' · ' + q + ' adet · ' + E.fmtD(mv.date) + (mv.dispatchNo ? ' · irs. ' + mv.dispatchNo : ''));
      if (w) await E.save('workorders', w, s.no + ': ' + mv.type.toLowerCase() + ' ' + q + ' adet (Op' + s.seq + ')');
      setMv(null);
    };
    const close = async () => {
      if (!hasCert) { E.toast('Kapatmak için proses sertifikasını yükleyin', 'err'); return; }
      if (inn < out) { E.toast('Tüm parçalar dönmeden kapatılamaz', 'err'); return; }
      await E.save('subcons', Object.assign({}, s, { closed: true, status: 'Tamamlandı' }), 'Kapatıldı (sertifika yüklü)');
    };
    return html`<div className="col" style=${{ gap: 16 }}>
      <${E.Head} crumb=${html`<${E.BackCrumb} label="Fason takibi" here=${s.no} />`} title=${html`<span className="mono">${s.no}</span> · ${E.nameOf('processes', s.processId)}`} badge=${html`<${E.Badge} s=${st} />`}
        sub=${html`<span>İş emri ${w ? html`<${E.RecLink} type="workorder" id=${w.id}>${w.no}<//>` : '—'} · Op${s.seq}</span><span>${E.nameOf('suppliers', s.supplierId)} ${sup && E.certState(sup) ? html`<${E.Badge} s=${E.certState(sup).st} />` : null}</span><span>Beklenen dönüş ${E.fmtD(s.expectedReturn)}</span>`}
        actions=${can ? html`<${E.Btn} onClick=${() => setMv({ type: 'Giden', date: E.today(), qty: canSend > 0 ? String(canSend) : '' })}>+ Gönderim<//><${E.Btn} onClick=${() => setMv({ type: 'Gelen', date: E.today(), qty: String(out - inn) })} disabled=${out - inn <= 0}>+ Dönüş<//>
          <${E.Btn} kind="p" onClick=${close}>Kapat<//>${!out ? html`<${E.Btn} kind="d" onClick=${() => E.cancelRec('subcons', s)}>İptal<//>` : null}` : null} />
      ${s.overrideReason ? html`<div className="alert warn">Tedarikçi uyarısı yönetici gerekçesiyle geçildi: ${s.overrideReason}</div>` : null}
      <div className="split"><div className="l">
        <${E.Card} title=${'Hareketler · giden ' + out + ' · dönen ' + inn}><${E.Table} rows=${(s.moves || []).map((m, i) => Object.assign({ i }, m))} empty=${html`<div className="empty">Henüz gönderim yok. Bu operasyona gönderilebilecek: ${canSend} adet.</div>`}
          cols=${[{ k: 'type', label: 'Hareket' }, { label: 'Tarih', v: (m) => E.fmtD(m.date) }, { k: 'qty', label: 'Adet', num: true }, { k: 'dispatchNo', label: 'İrsaliye no', mono: true }]} /><//>
        <div className="muted" style=${{ fontSize: 13 }}>Dönen adetler, iş emrinin rota ilerlemesinde bu operasyonun sağlam adedine yazılır. Kayıt, proses sertifikası yüklenmeden kapanmaz.</div>
      </div><div className="r">
        <${E.DocPanel} refKey=${'subcons/' + id} kinds=${['Proses sertifikası', 'Sevk irsaliyesi', 'Diğer']} />
        <${E.History} rec=${s} />
      </div></div>
      ${mv ? html`<${E.Modal} title=${mv.type === 'Giden' ? 'Tedarikçiye gönderim' : 'Tedarikçiden dönüş'} onClose=${() => setMv(null)} foot=${html`<${E.Btn} onClick=${() => setMv(null)}>Vazgeç<//><${E.Btn} kind="p" onClick=${addMove}>Kaydet<//>`}>
        <${E.SchemaForm} value=${mv} set=${(k, v) => setMv(Object.assign({}, mv, { [k]: v }))} fields=${[{ k: 'date', label: 'Tarih', type: 'date', req: true }, { k: 'qty', label: 'Adet', type: 'number', req: true }, { k: 'dispatchNo', label: 'İrsaliye no' }]} />
        ${mv.type === 'Gelen' ? html`<div className="muted">Dönüşte proses sertifikasını sağdaki Belgeler panelinden yükleyin.</div>` : null}
      <//>` : null}
    </div>`;
  }
  E.details.subcon = SubconDetail;
})();
