// Sales: quotes (cost engine + price suggestion) and sales orders.
(function () {
  const E = window.ERP;
  const { html } = E;
  const { useState } = React;
  const N = E.fmtN;

  function fasonPrice(op) {
    const sups = E.list('suppliers').filter((s) => s.active !== false && (s.procs || []).includes(op.processId) && s.prices && E.num(s.prices[op.processId]) > 0);
    const pref = op.supplierId && sups.find((s) => s.id === op.supplierId);
    const pick = pref || sups.sort((a, b) => E.num(a.prices[op.processId]) - E.num(b.prices[op.processId]))[0];
    return pick ? { p: E.num(pick.prices[op.processId]), sup: pick } : { p: 0, sup: null };
  }
  // Cost per piece in TL: material from raw size, internal ops from routing time × machine rate, subcontract from supplier price.
  function costLine(q, line) {
    const rev = E.revOf(line.partId, line.rev);
    const mat = rev ? E.get('materials', rev.materialId) : null;
    const ro = E.routingFor(line.partId, line.rev);
    const qty = Math.max(1, E.num(line.qty));
    const ov = line.ov || {};
    const fire = line.fire == null ? 5 : E.num(line.fire);
    const kg = E.rawKg(rev);
    const items = [{ key: 'mat', name: 'Malzeme', auto: kg * E.num(mat && mat.kgPrice) * (1 + fire / 100),
      calc: mat ? N(kg, 3) + ' kg × ' + N(E.num(mat.kgPrice)) + ' TL/kg × (1 + %' + fire + ' fire)' : 'malzeme tanımlı değil',
      src: mat ? mat.name + ' · ' + E.rawLabel(rev) : '—' }];
    ((ro && ro.ops) || []).slice().sort((a, b) => a.seq - b.seq).forEach((op) => {
      if (op.type === 'Fason') {
        const f = fasonPrice(op);
        items.push({ key: 'op' + op.seq, name: 'Op' + op.seq + ' ' + op.name + ' (fason)', auto: f.p, calc: N(f.p) + ' TL/ad.', src: f.sup ? 'Tedarikçi fiyatı · ' + f.sup.name : 'tedarikçi fiyatı tanımlı değil' });
      } else {
        const m = E.get('machines', op.machineId); const rate = E.num(m && m.rate);
        const mins = E.num(op.setup) / qty + E.num(op.cycle);
        items.push({ key: 'op' + op.seq, name: 'Op' + op.seq + ' ' + op.name, auto: mins / 60 * rate,
          calc: '(' + N(E.num(op.setup), 0) + ' dk ÷ ' + qty + ' + ' + N(E.num(op.cycle), 1) + ' dk) × ' + N(rate, 0) + ' TL/s', src: 'Rota · ' + (m ? m.code : 'tezgah yok') });
      }
    });
    items.forEach((it) => { it.over = ov[it.key] != null && ov[it.key] !== ''; it.v = it.over ? E.num(ov[it.key]) : it.auto; });
    const total = items.reduce((s, it) => s + it.v, 0);
    const margin = line.margin == null ? 25 : E.num(line.margin);
    const tl = total * (1 + margin / 100);
    const rate = q.currency === 'TL' ? 1 : E.num(q.rate);
    return { items, total, tl, margin, fire, cur: rate > 0 ? tl / rate : 0, noRoute: !ro, rev, mat };
  }
  E.costLine = costLine;
  const lineTotal = (lines) => (lines || []).reduce((s, l) => s + E.num(l.price) * E.num(l.qty), 0);
  const partOpts = (custId) => E.list('parts').filter((p) => !custId || p.customerId === custId).map((p) => ({ v: p.id, l: p.partNo + (p.desc ? ' · ' + p.desc : '') }));
  const revOpts = (pid) => { const p = E.get('parts', pid); return p ? (p.revs || []).filter((r) => r.status !== 'Eski').map((r) => r.rev) : []; };
  Object.assign(E, { partOpts, revOpts });

  function companyHead(title, no) {
    const st = E.settings();
    return '<div style="display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px"><div><div style="font-size:20px;font-weight:700">' + title + '</div></div><div style="text-align:right">' + E.esc(st.companyName || '[Firma adı]') + '<br>' + E.esc(st.companyAddr || '') + '<br><b>' + E.esc(no) + '</b></div></div>';
  }
  function docHtml(title, body) {
    return '<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>' + title + '</title><style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:32px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:5px 7px;text-align:left}th{background:#eee}.r{text-align:right}</style></head><body>' + body + '</body></html>';
  }
  Object.assign(E, { companyHead, docHtml });

  // ---------- quotes ----------
  function QuotesPage() {
    const D = E.useStore();
    const [chip, setChip] = useState('Açık');
    const [form, setForm] = useState(null);
    const can = E.canEdit('satis'); const price = E.canSee('fiyat');
    const rows = Object.values(D.quotes).filter((q) => chip === 'Tümü' || (chip === 'Açık' ? ['Taslak', 'Gönderildi'].includes(q.status) : chip === 'Kapanan' ? !['Taslak', 'Gönderildi'].includes(q.status) : true))
      .sort((a, b) => (b.no || '').localeCompare(a.no || ''));
    const create = async () => {
      const c = E.get('customers', form.customerId); const st = E.settings();
      const cur = form.currency || (c && c.currency) || 'TL';
      const r = await E.save('quotes', { no: E.nextNo('quotes', 'TKL'), customerId: form.customerId, date: E.today(), validDays: 30, currency: cur, rate: cur === 'TL' ? 1 : E.num((st.rates || {})[cur]), status: 'Taslak', lines: [], note: '' });
      setForm(null); E.openRec('quote', r.id);
    };
    return html`<div>
      <${E.ListPage} title="Teklifler" crumb="Satış › Teklifler" csv="Teklifler" chips=${['Açık', 'Kapanan', 'Tümü']} chip=${chip} setChip=${setChip} rows=${rows} onRow=${(r) => E.openRec('quote', r.id)}
        cols=${[{ k: 'no', label: 'No', mono: true }, { label: 'Müşteri', v: (r) => E.nameOf('customers', r.customerId) }, { label: 'Parçalar', wrap: true, v: (r) => (r.lines || []).map((l) => E.partLabel(l.partId, l.rev) + ' × ' + l.qty).join(', ') || '—' },
          price ? { label: 'Toplam', num: true, v: (r) => N(lineTotal(r.lines)) + ' ' + r.currency, csv: (r) => lineTotal(r.lines) } : null, { label: 'Tarih', v: (r) => E.fmtD(r.date) },
          { label: 'Geçerlilik', v: (r) => E.fmtD(E.addDays(r.date, +r.validDays || 0)) }, { label: 'Durum', v: (r) => html`<${E.Badge} s=${r.status} />`, csv: (r) => r.status }].filter(Boolean)}
        empty=${html`<${E.Empty} title="Teklif yok" text=${can ? ' “+ Yeni teklif” ile başlayın. Parça, rota ve tezgah ücretleri tanımlıysa fiyat otomatik önerilir.' : ''} />`}
        actions=${can ? html`<${E.Btn} kind="p" onClick=${() => setForm({})}>+ Yeni teklif<//>` : null} />
      ${form ? html`<${E.Modal} title="Yeni teklif" onClose=${() => setForm(null)} foot=${html`<${E.Btn} onClick=${() => setForm(null)}>Vazgeç<//><${E.Btn} kind="p" disabled=${!form.customerId} onClick=${create}>Oluştur<//>`}>
        <${E.SchemaForm} fields=${[{ k: 'customerId', label: 'Müşteri', type: 'select', req: true, options: E.custOpts }, { k: 'currency', label: 'Para birimi (boşsa müşterinin varsayılanı)', type: 'select', options: ['TL', 'EUR', 'USD'] }]}
          value=${form} set=${(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
      <//>` : null}
    </div>`;
  }
  E.pages['satis/teklifler'] = QuotesPage;

  function QuoteDetail({ id }) {
    const D = E.useStore();
    const rec = D.quotes[id];
    const [d, setD] = useState(null);
    const [sel, setSel] = useState(0);
    const [add, setAdd] = useState(null);
    if (!rec) return html`<${E.Empty} title="Teklif bulunamadı" text="" />`;
    const q = d || rec;
    const open = ['Taslak', 'Gönderildi'].includes(rec.status);
    const can = E.canEdit('satis') && open;
    const price = E.canSee('fiyat');
    const set = (k, v) => setD(Object.assign({}, q, { [k]: v }));
    const setLine = (i, patch) => setD(Object.assign({}, q, { lines: q.lines.map((l, j) => (j === i ? Object.assign({}, l, patch) : l)) }));
    const persist = async (body, msg) => { await E.save('quotes', body, msg); setD(null); };
    const lines = q.lines || [];
    const li = Math.min(sel, Math.max(0, lines.length - 1));
    const line = lines[li];
    const cl = line ? costLine(q, line) : null;
    const accept = () => E.ask({ title: rec.no + ' kabul edildi, sipariş açılsın mı?', body: 'Satırlar ve fiyatlar yeni siparişe kopyalanır. Müşteri PO numarasını siparişte girersiniz.', ok: 'Siparişe dönüştür', onOk: async () => {
      const c = E.get('customers', rec.customerId);
      const o = await E.save('orders', { no: E.nextNo('orders', 'SIP'), customerId: rec.customerId, po: '', date: E.today(), currency: rec.currency, rate: rec.rate, status: 'Taslak', quoteId: rec.id,
        faiReq: !!(c && c.faiReq), cocReq: !!(c && c.cocReq), pack: '', qnote: '',
        lines: (rec.lines || []).map((l) => ({ id: E.uid(), partId: l.partId, rev: l.rev, qty: E.num(l.qty), price: E.num(l.price), due: E.addDays(E.today(), (E.num(l.lead) || 4) * 7) })) }, 'Tekliften oluşturuldu: ' + rec.no);
      await E.save('quotes', Object.assign({}, rec, { status: 'Kabul', orderId: o.id }), 'Kabul edildi → ' + o.no);
      E.toast(o.no + ' oluşturuldu'); E.openRec('order', o.id);
    } });
    const download = () => {
      const c = E.get('customers', q.customerId) || {};
      const x = E.esc;
      const body = E.companyHead('TEKLİF', q.no) + '<p><b>' + x(c.name) + '</b><br>Tarih: ' + E.fmtD(q.date) + ' · Geçerlilik: ' + x(q.validDays || 30) + ' gün</p><table><tr><th>#</th><th>Parça / rev</th><th class="r">Adet</th><th class="r">Birim fiyat</th><th class="r">Tutar</th><th>Termin</th></tr>' +
        lines.map((l, i) => '<tr><td>' + (i + 1) + '</td><td>' + x(E.partLabel(l.partId, l.rev)) + '</td><td class="r">' + x(l.qty) + '</td><td class="r">' + N(E.num(l.price)) + ' ' + q.currency + '</td><td class="r">' + N(E.num(l.price) * E.num(l.qty)) + ' ' + q.currency + '</td><td>' + x(l.lead || '—') + ' hafta</td></tr>').join('') +
        '<tr><td colspan="4" class="r"><b>Toplam</b></td><td class="r"><b>' + N(lineTotal(lines)) + ' ' + q.currency + '</b></td><td></td></tr></table><p>' + x(q.note) + '</p>';
      E.saveFile(q.no + '.html', E.docHtml(q.no, body));
    };
    const addLine = () => {
      if (!add.partId || !add.rev || !E.num(add.qty)) { E.toast('Parça, revizyon ve adet girin', 'err'); return; }
      const nl = { id: E.uid(), partId: add.partId, rev: add.rev, qty: E.num(add.qty), lead: E.num(add.lead) || 4, fire: 5, margin: 25, ov: {}, price: 0 };
      const c = costLine(q, nl); nl.price = Math.ceil(c.cur * 2) / 2;
      setD(Object.assign({}, q, { lines: lines.concat(nl) })); setSel(lines.length); setAdd(null);
    };
    return html`<div className="col" style=${{ gap: 16 }}>
      <${E.Head} crumb=${html`<${E.BackCrumb} label="Teklifler" here=${rec.no} />`} title=${html`<span className="mono">${rec.no}</span> · ${E.nameOf('customers', rec.customerId)}`} badge=${html`<${E.Badge} s=${rec.status} />`}
        actions=${html`
          ${d ? html`<${E.Btn} onClick=${() => setD(null)}>Değişiklikleri at<//><${E.Btn} kind="p" onClick=${() => persist(q)}>Kaydet<//>` : null}
          ${price && lines.length ? html`<${E.Btn} onClick=${download}>Teklif belgesi<//>` : null}
          ${E.canEdit('satis') && !d && rec.status === 'Taslak' ? html`<${E.Btn} disabled=${!lines.length} onClick=${() => persist(Object.assign({}, rec, { status: 'Gönderildi' }), 'Müşteriye gönderildi')}>Gönderildi işaretle<//>` : null}
          ${E.canEdit('satis') && !d && open ? html`<${E.Btn} kind="p" disabled=${!lines.length} onClick=${accept}>Kabul → Siparişe dönüştür<//><${E.Btn} onClick=${() => persist(Object.assign({}, rec, { status: 'Ret' }), 'Müşteri reddetti')}>Reddedildi<//>` : null}
          ${E.canEdit('satis') && !d && rec.status === 'Taslak' ? html`<${E.Btn} kind="d" onClick=${() => E.deleteDraft('quotes', rec, E.closeRec)}>Sil<//>` : null}
          ${E.canEdit('satis') && !d && rec.status === 'Gönderildi' ? html`<${E.Btn} kind="d" onClick=${() => E.cancelRec('quotes', rec)}>İptal<//>` : null}
          ${rec.orderId ? html`<${E.Btn} onClick=${() => E.openRec('order', rec.orderId)}>Siparişe git<//>` : null}`} />
      <div className="split"><div className="l">
        <${E.Card} title="Genel bilgiler"><div className="pad form">
          <${E.Field} label="Tarih"><${E.Inp} type="date" value=${q.date} disabled=${!can} onChange=${(v) => set('date', v)} /><//>
          <${E.Field} label="Geçerlilik (gün)"><${E.Inp} value=${q.validDays} disabled=${!can} onChange=${(v) => set('validDays', v)} /><//>
          <${E.Field} label="Para birimi" div><${E.Chips} opts=${['TL', 'EUR', 'USD']} cur=${q.currency} set=${(v) => can && setD(Object.assign({}, q, { currency: v, rate: v === 'TL' ? 1 : E.num((E.settings().rates || {})[v]) || q.rate }))} /><//>
          <${E.Field} label="Kur (TL, elle girilir)"><${E.Inp} value=${q.currency === 'TL' ? '1' : q.rate} inputMode="decimal" disabled=${!can || q.currency === 'TL'} onChange=${(v) => set('rate', v)} /><//>
          <${E.Field} label="Not (teklif belgesine yazılır)" span><${E.Txt} value=${q.note} onChange=${(v) => can && set('note', v)} /><//>
        </div><//>
        <${E.Card} title="Satırlar" act=${can ? html`<${E.Btn} sm kind="p" onClick=${() => setAdd({})}>+ Satır<//>` : null}>
          <${E.Table} rows=${lines.map((l, i) => Object.assign({ i }, l))} onRow=${(r) => setSel(r.i)} rowClass=${(r) => (r.i === li ? 'sel' : '')}
            empty=${html`<${E.Empty} title="Satır yok" text=" Aynı parçanın farklı adetleri için ayrı satır ekleyin (adet kırılımı)." />`}
            cols=${[{ label: '#', v: (r) => r.i + 1 }, { label: 'Parça / rev', v: (r) => E.partLabel(r.partId, r.rev) }, { label: 'Adet', num: true, k: 'qty' },
              price ? { label: 'Birim fiyat', num: true, v: (r) => N(E.num(r.price)) + ' ' + q.currency } : null, price ? { label: 'Tutar', num: true, v: (r) => N(E.num(r.price) * E.num(r.qty)) + ' ' + q.currency } : null,
              { label: 'Termin', v: (r) => (r.lead || '—') + ' hafta' }, can ? { label: '', v: (r) => html`<${E.Btn} sm kind="d" onClick=${(e) => { e.stopPropagation(); setD(Object.assign({}, q, { lines: lines.filter((_, j) => j !== r.i) })); setSel(0); }}>Sil<//>` } : null].filter(Boolean)} />
          ${price && lines.length ? html`<div className="pad" style=${{ textAlign: 'right', fontWeight: 600 }}>Toplam ${N(lineTotal(lines))} ${q.currency}</div>` : null}
        <//>
        ${price && line ? html`<${E.Card} title=${'Satır ' + (li + 1) + ' · maliyet kırılımı (adet başı, TL) · ' + E.partLabel(line.partId, line.rev) + ' × ' + line.qty}>
          ${cl.noRoute ? html`<div className="pad"><div className="alert warn">Bu revizyonun rotası yok. Üretim › Rotalar'dan (taslak da olur) rota tanımlayın; işçilik maliyeti rotadan hesaplanır.</div></div>` : null}
          <div className="scroll"><table className="tbl"><thead><tr><th>Kalem</th><th>Hesap</th><th>Kaynak</th><th className="num">TL / adet</th></tr></thead><tbody>
            ${cl.items.map((it) => html`<tr key=${it.key}><td style=${{ fontWeight: 500 }}>${it.name}</td><td>${it.calc}</td><td className="muted">${it.src}</td>
              <td className="num">${can ? html`<div className="row" style=${{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                ${it.over ? html`<${E.Badge} s="elle" t="warn" />` : null}
                <input className="in sm" style=${{ width: 100, textAlign: 'right' }} aria-label=${it.name + ' maliyeti'} value=${it.over ? line.ov[it.key] : N(it.auto)}
                  onChange=${(e) => setLine(li, { ov: Object.assign({}, line.ov, { [it.key]: e.target.value }) })} />
                ${it.over ? html`<${E.Btn} sm title="Otomatik değere dön" onClick=${() => { const o = Object.assign({}, line.ov); delete o[it.key]; setLine(li, { ov: o }); }}>↺<//>` : null}</div>` : N(it.v)}</td></tr>`)}
            <tr><td colSpan="3" style=${{ fontWeight: 600 }}>Toplam maliyet</td><td className="num" style=${{ fontWeight: 600 }}>${N(cl.total)}</td></tr>
          </tbody></table></div>
          <div className="pad row" style=${{ gap: '14px 28px', alignItems: 'flex-end' }}>
            <${E.Field} label="Fire (%)"><${E.Inp} sm value=${line.fire == null ? 5 : line.fire} disabled=${!can} onChange=${(v) => setLine(li, { fire: v })} /><//>
            <${E.Field} label="Kâr marjı (%)"><${E.Inp} sm value=${line.margin == null ? 25 : line.margin} disabled=${!can} onChange=${(v) => setLine(li, { margin: v })} /><//>
            <div><div className="muted" style=${{ fontSize: 12.5 }}>Önerilen birim fiyat</div><div style=${{ fontSize: 15, marginTop: 4 }}>${N(cl.tl)} TL = <b style=${{ fontSize: 19 }}>${N(cl.cur)} ${q.currency}</b></div></div>
            <${E.Field} label=${'Teklif birim fiyatı (' + q.currency + ')'}><${E.Inp} value=${line.price} disabled=${!can} inputMode="decimal" onChange=${(v) => setLine(li, { price: v })} /><//>
            ${can ? html`<${E.Btn} onClick=${() => setLine(li, { price: Math.ceil(cl.cur * 2) / 2 })}>Önerileni kullan<//>` : null}
            <${E.Field} label="Termin (hafta)"><${E.Inp} sm value=${line.lead} disabled=${!can} onChange=${(v) => setLine(li, { lead: v })} /><//>
          </div><//>` : null}
      </div><div className="r">
        <${E.DocPanel} refKey=${'quotes/' + rec.id} kinds=${['Müşteri talebi (RFQ)', 'Çizim', 'Diğer']} />
        <${E.History} rec=${rec} />
      </div></div>
      ${add ? html`<${E.Modal} title="Satır ekle" onClose=${() => setAdd(null)} foot=${html`<${E.Btn} onClick=${() => setAdd(null)}>Vazgeç<//><${E.Btn} kind="p" onClick=${addLine}>Ekle<//>`}>
        <${E.SchemaForm} value=${add} set=${(k, v) => setAdd(Object.assign({}, add, { [k]: v }, k === 'partId' ? { rev: (revOpts(v)[0] || '') } : {}))}
          fields=${[{ k: 'partId', label: 'Parça', type: 'select', req: true, options: () => partOpts(q.customerId) }, { k: 'rev', label: 'Revizyon', type: 'select', req: true, options: (v) => revOpts(v.partId) },
            { k: 'qty', label: 'Adet', type: 'number', req: true }, { k: 'lead', label: 'Termin (hafta)', type: 'number', ph: '4' }]} />
        <div className="muted">Listede parça yoksa önce Ana veriler › Parçalar'dan ekleyin.</div>
      <//>` : null}
    </div>`;
  }
  E.details.quote = QuoteDetail;

  // ---------- orders ----------
  function OrdersPage() {
    const D = E.useStore();
    const [chip, setChip] = useState('Açık');
    const [form, setForm] = useState(null);
    const can = E.canEdit('satis'); const price = E.canSee('fiyat');
    const firstDue = (o) => (o.lines || []).filter((l) => { const s = E.lineStats(o, l); return s.shipped < l.qty; }).map((l) => l.due).sort()[0];
    const rows = Object.values(D.orders).map((o) => Object.assign({}, o, { st: E.orderStatus(o) }))
      .filter((o) => chip === 'Tümü' || (chip === 'Açık' ? !['Tamamlandı', 'İptal'].includes(o.st) : o.st === chip)).sort((a, b) => (b.no || '').localeCompare(a.no || ''));
    const pct = (o) => { const q = (o.lines || []).reduce((s, l) => s + E.num(l.qty), 0); const sh = (o.lines || []).reduce((s, l) => s + E.lineStats(o, l).shipped, 0); return q ? Math.round(sh / q * 100) : 0; };
    const create = async () => {
      const c = E.get('customers', form.customerId) || {};
      const cur = form.currency || c.currency || 'TL';
      const r = await E.save('orders', { no: E.nextNo('orders', 'SIP'), customerId: form.customerId, po: form.po || '', date: E.today(), currency: cur, rate: cur === 'TL' ? 1 : E.num((E.settings().rates || {})[cur]), status: 'Taslak', faiReq: !!c.faiReq, cocReq: !!c.cocReq, pack: '', qnote: '', lines: [] });
      setForm(null); E.openRec('order', r.id);
    };
    return html`<div>
      <${E.ListPage} title="Siparişler" crumb="Satış › Siparişler" csv="Siparisler" chips=${['Açık', 'Tamamlandı', 'İptal', 'Tümü']} chip=${chip} setChip=${setChip} rows=${rows} onRow=${(r) => E.openRec('order', r.id)}
        rowClass=${(o) => { const f = firstDue(o); return f && f < E.today() && !['Taslak', 'İptal'].includes(o.st) ? 'late' : ''; }}
        cols=${[{ k: 'no', label: 'No', mono: true }, { label: 'Müşteri', v: (r) => E.nameOf('customers', r.customerId) }, { k: 'po', label: 'Müşteri PO', mono: true }, { label: 'Satır', num: true, v: (r) => (r.lines || []).length },
          price ? { label: 'Tutar', num: true, v: (r) => N(lineTotal(r.lines)) + ' ' + r.currency, csv: (r) => lineTotal(r.lines) } : null,
          { label: 'En yakın termin', v: (r) => E.fmtD(firstDue(r)) }, { label: 'Sevk', v: (r) => html`<span className="bar"><i style=${{ width: pct(r) + '%' }}></i></span> <span className="muted">%${pct(r)}</span>`, csv: pct },
          { label: 'Durum', v: (r) => html`<${E.Badge} s=${r.st} />`, csv: (r) => r.st }].filter(Boolean)}
        empty=${html`<${E.Empty} title="Sipariş yok" text=" Kabul edilen tekliften “Siparişe dönüştür” ile ya da buradan doğrudan sipariş açın." />`}
        actions=${can ? html`<${E.Btn} kind="p" onClick=${() => setForm({})}>+ Yeni sipariş<//>` : null} />
      ${form ? html`<${E.Modal} title="Yeni sipariş" onClose=${() => setForm(null)} foot=${html`<${E.Btn} onClick=${() => setForm(null)}>Vazgeç<//><${E.Btn} kind="p" disabled=${!form.customerId} onClick=${create}>Oluştur<//>`}>
        <${E.SchemaForm} value=${form} set=${(k, v) => setForm(Object.assign({}, form, { [k]: v }))}
          fields=${[{ k: 'customerId', label: 'Müşteri', type: 'select', req: true, options: E.custOpts }, { k: 'po', label: 'Müşteri PO no' }, { k: 'currency', label: 'Para birimi (boşsa müşterinin varsayılanı)', type: 'select', options: ['TL', 'EUR', 'USD'] }]} />
      <//>` : null}
    </div>`;
  }
  E.pages['satis/siparisler'] = OrdersPage;

  function OrderDetail({ id }) {
    const D = E.useStore();
    const rec = D.orders[id];
    const [d, setD] = useState(null);
    const [add, setAdd] = useState(null);
    if (!rec) return html`<${E.Empty} title="Sipariş bulunamadı" text="" />`;
    const o = d || rec;
    const st = E.orderStatus(rec);
    const can = E.canEdit('satis') && !['İptal', 'Tamamlandı'].includes(st);
    const price = E.canSee('fiyat');
    const set = (k, v) => setD(Object.assign({}, o, { [k]: v }));
    const lines = o.lines || [];
    const confirm = async () => {
      if (!o.po) { E.toast('Müşteri PO numarasını girin', 'err'); return; }
      if (!lines.length) { E.toast('En az bir satır ekleyin', 'err'); return; }
      await E.save('orders', Object.assign({}, o, { status: 'Onaylı' }), 'Sipariş onaylandı'); setD(null);
    };
    const addLine = () => {
      if (!add.partId || !add.rev || !E.num(add.qty) || !add.due) { E.toast('Parça, revizyon, adet ve termin girin', 'err'); return; }
      setD(Object.assign({}, o, { lines: lines.concat({ id: E.uid(), partId: add.partId, rev: add.rev, qty: E.num(add.qty), price: E.num(add.price), due: add.due }) })); setAdd(null);
    };
    const wos = E.list('workorders').filter((w) => w.orderId === rec.id);
    const ships = E.list('shipments').filter((s) => s.orderId === rec.id);
    return html`<div className="col" style=${{ gap: 16 }}>
      <${E.Head} crumb=${html`<${E.BackCrumb} label="Siparişler" here=${rec.no} />`} title=${html`<span className="mono">${rec.no}</span> · ${E.nameOf('customers', rec.customerId)}`} badge=${html`<${E.Badge} s=${st} />`}
        sub=${html`<span>PO <b className="mono">${rec.po || '—'}</b></span>${rec.quoteId ? html`<span>Teklif <${E.RecLink} type="quote" id=${rec.quoteId}>${E.nameOf('quotes', rec.quoteId)}<//></span>` : null}`}
        actions=${html`
          ${d ? html`<${E.Btn} onClick=${() => setD(null)}>Değişiklikleri at<//><${E.Btn} kind="p" onClick=${async () => { await E.save('orders', o); setD(null); }}>Kaydet<//>` : null}
          ${E.canEdit('satis') && rec.status === 'Taslak' ? html`<${E.Btn} kind="p" onClick=${confirm}>Onayla<//><${E.Btn} kind="d" onClick=${() => E.deleteDraft('orders', rec, E.closeRec)}>Sil<//>` : null}
          ${E.canEdit('sevkiyat') && !d && !['Taslak', 'İptal', 'Tamamlandı'].includes(st) ? html`<${E.Btn} onClick=${() => E.newShipment && E.newShipment(rec)}>Sevkiyat aç<//>` : null}
          ${E.canEdit('satis') && !d && !['Taslak', 'İptal', 'Tamamlandı'].includes(st) ? html`<${E.Btn} kind="d" onClick=${() => E.cancelRec('orders', rec)}>İptal<//>` : null}`} />
      <div className="split"><div className="l">
        <${E.Card} title="Genel bilgiler ve kalite notları"><div className="pad form">
          <${E.Field} label="Müşteri PO no" req><${E.Inp} value=${o.po} disabled=${!can} onChange=${(v) => set('po', v)} /><//>
          <${E.Field} label="Sipariş tarihi"><${E.Inp} type="date" value=${o.date} disabled=${!can} onChange=${(v) => set('date', v)} /><//>
          <${E.Field} label="Para birimi"><${E.Sel} empty=${false} value=${o.currency} options=${['TL', 'EUR', 'USD']} disabled=${!can} onChange=${(v) => set('currency', v)} /><//>
          <${E.Field} label="FAI"><${E.Check} checked=${o.faiReq} disabled=${!can} label="FAI gerekli" onChange=${(v) => set('faiReq', v)} /><//>
          <${E.Field} label="CoC"><${E.Check} checked=${o.cocReq} disabled=${!can} label="Uygunluk sertifikası gerekli" onChange=${(v) => set('cocReq', v)} /><//>
          <${E.Field} label="Ambalaj"><${E.Inp} value=${o.pack} disabled=${!can} onChange=${(v) => set('pack', v)} /><//>
          <${E.Field} label="Siparişe özel kalite notları" span><${E.Txt} value=${o.qnote} onChange=${(v) => can && set('qnote', v)} /><//>
        </div><//>
        <${E.Card} title="Satırlar" act=${can ? html`<${E.Btn} sm kind="p" onClick=${() => setAdd({})}>+ Satır<//>` : null}>
          <${E.Table} rows=${lines} empty=${html`<${E.Empty} title="Satır yok" text="" />`}
            rowClass=${(l) => (l.due < E.today() && E.lineStats(rec, l).shipped < l.qty && rec.status !== 'Taslak' ? 'late' : '')}
            cols=${[{ label: 'Parça / rev', v: (l) => E.partLabel(l.partId, l.rev) }, { label: 'Adet', num: true, k: 'qty' }, price ? { label: 'Birim fiyat', num: true, v: (l) => N(E.num(l.price)) + ' ' + o.currency } : null,
              { label: 'Termin', v: (l) => E.fmtD(l.due) }, { label: 'İş emri', v: (l) => { const s = E.lineStats(rec, l); return s.wos.length ? s.wos.map((w) => html`<${E.RecLink} key=${w.id} type="workorder" id=${w.id}>${w.no}<//> `) : '—'; } },
              { label: 'Planlanan', num: true, v: (l) => E.lineStats(rec, l).planned }, { label: 'Sevk edilen', num: true, v: (l) => E.lineStats(rec, l).shipped },
              { label: '', v: (l) => html`<div className="row" style=${{ flexWrap: 'nowrap' }}>
                ${E.canEdit('uretim') && !['Taslak', 'İptal'].includes(rec.status) && E.lineStats(rec, l).planned < l.qty ? html`<${E.Btn} sm onClick=${() => E.newWorkOrder(rec, l)}>İş emri aç<//>` : null}
                ${can && rec.status === 'Taslak' ? html`<${E.Btn} sm kind="d" onClick=${() => setD(Object.assign({}, o, { lines: lines.filter((x) => x.id !== l.id) }))}>Sil<//>` : null}</div>` }].filter(Boolean)} />
        <//>
        ${wos.length || ships.length ? html`<${E.Card} title="Bağlı kayıtlar"><div className="pad col" style=${{ gap: 8 }}>
          ${wos.map((w) => html`<div key=${w.id}><${E.RecLink} type="workorder" id=${w.id}>${w.no}<//> · ${E.partLabel(w.partId, w.rev)} · ${w.qty} ad. · <${E.Badge} s=${E.woStatus(w)} /></div>`)}
          ${ships.map((s) => html`<div key=${s.id}><${E.RecLink} type="shipment" id=${s.id}>${s.no}<//> · ${E.fmtD(s.date)} · <${E.Badge} s=${s.status} /></div>`)}
        </div><//>` : null}
      </div><div className="r">
        <${E.DocPanel} refKey=${'orders/' + rec.id} kinds=${['Müşteri PO', 'Kalite şartı', 'Diğer']} />
        <${E.History} rec=${rec} />
      </div></div>
      ${add ? html`<${E.Modal} title="Satır ekle" onClose=${() => setAdd(null)} foot=${html`<${E.Btn} onClick=${() => setAdd(null)}>Vazgeç<//><${E.Btn} kind="p" onClick=${addLine}>Ekle<//>`}>
        <${E.SchemaForm} value=${add} set=${(k, v) => setAdd(Object.assign({}, add, { [k]: v }, k === 'partId' ? { rev: (revOpts(v)[0] || '') } : {}))}
          fields=${[{ k: 'partId', label: 'Parça', type: 'select', req: true, options: () => partOpts(o.customerId) }, { k: 'rev', label: 'Revizyon', type: 'select', req: true, options: (v) => revOpts(v.partId) },
            { k: 'qty', label: 'Adet', type: 'number', req: true }, { k: 'price', label: 'Birim fiyat (' + o.currency + ')', type: 'number' }, { k: 'due', label: 'Termin', type: 'date', req: true }]} />
      <//>` : null}
    </div>`;
  }
  E.details.order = OrderDetail;
})();
