// Production: work orders (release, lots, progress tabs, traveler).
(function () {
  const E = window.ERP;
  const { html } = E;
  const { useState } = React;
  const N = E.fmtN;

  function nextSerial(partId) {
    let max = 0;
    E.list('workorders').forEach((w) => { if (w.partId === partId && w.status !== 'İptal') max = Math.max(max, +w.serialTo || 0); });
    return max + 1;
  }
  async function newWorkOrder(order, line) {
    const s = E.lineStats(order, line);
    const qty = Math.max(1, (+line.qty || 0) - s.planned);
    const from = nextSerial(line.partId);
    const w = await E.save('workorders', { no: E.nextNo('workorders', 'IE'), orderId: order.id, lineId: line.id, partId: line.partId, rev: line.rev, qty, serialFrom: from, serialTo: from + qty - 1, due: line.due, status: 'Taslak', ops: [], lots: [] }, 'Siparişten oluşturuldu: ' + order.no);
    E.toast(w.no + ' oluşturuldu'); E.openRec('workorder', w.id);
  }
  E.newWorkOrder = newWorkOrder;
  const serialText = (w) => (w.serialFrom ? E.serial(w.serialFrom) + '–' + E.serial(w.serialTo) : '—');
  E.serialText = serialText;
  function curOp(w) { const p = E.opProgress(w); const o = p.find((x) => x.st !== 'Bitti'); return o ? 'Op' + o.seq + ' ' + o.name : (p.length ? 'Bitti' : '—'); }
  function pct(w) { const p = E.opProgress(w); if (!p.length) return 0; return Math.round(p.reduce((s, o) => s + Math.min(1, o.input ? (o.good + o.scrap) / (w.qty || 1) : 0), 0) / p.length * 100); }

  function WorkOrdersPage() {
    const D = E.useStore();
    const [chip, setChip] = useState('Açık');
    const rows = Object.values(D.workorders).map((w) => Object.assign({}, w, { st: E.woStatus(w) }))
      .filter((w) => chip === 'Tümü' || (chip === 'Açık' ? !['Kapandı', 'İptal', 'Tamamlandı'].includes(w.st) : w.st === chip)).sort((a, b) => (a.due || '').localeCompare(b.due || ''));
    return html`<${E.ListPage} title="İş emirleri" crumb="Üretim › İş emirleri" csv="Is_emirleri" chips=${['Açık', 'Taslak', 'Tamamlandı', 'Kapandı', 'Tümü']} chip=${chip} setChip=${setChip}
      rows=${rows} onRow=${(r) => E.openRec('workorder', r.id)} rowClass=${(w) => (w.due < E.today() && !['Kapandı', 'İptal', 'Tamamlandı'].includes(w.st) ? 'late' : '')}
      empty=${html`<${E.Empty} title="İş emri yok" text=" Onaylı siparişin satırından “İş emri aç” ile oluşturulur." />`}
      cols=${[{ k: 'no', label: 'No', mono: true }, { label: 'Sipariş', v: (w) => E.nameOf('orders', w.orderId) }, { label: 'Müşteri', v: (w) => { const o = E.orderOf(w); return o ? E.nameOf('customers', o.customerId) : '—'; } },
        { label: 'Parça / rev', v: (w) => E.partLabel(w.partId, w.rev) }, { label: 'Adet', num: true, k: 'qty' }, { label: 'Seri', mono: true, v: serialText }, { label: 'Termin', v: (w) => E.fmtD(w.due) },
        { label: 'Şu an', v: curOp, csv: curOp }, { label: 'İlerleme', v: (w) => html`<span className="bar"><i style=${{ width: pct(w) + '%' }}></i></span>`, csv: pct },
        { label: 'Durum', v: (w) => html`<${E.Badge} s=${w.st} />`, csv: (w) => w.st }]} />`;
  }
  E.pages['uretim/is-emirleri'] = WorkOrdersPage;

  function traveler(w) {
    const lots = (w.lots || []).map((l) => { const lot = E.get('lots', l.lotId) || {}; return lot.no + ' / şarj ' + (lot.heat || '—') + ' (' + l.qty + ' ' + (lot.unit || '') + ')'; }).join(', ');
    const x = E.esc;
    const body = E.companyHead('İŞ FÖYÜ', w.no) + '<p><b>' + x(E.partLabel(w.partId, w.rev)) + '</b> · ' + x(w.qty) + ' adet · seri ' + serialText(w) + ' · termin ' + E.fmtD(w.due) + '<br>Sipariş: ' + x(E.nameOf('orders', w.orderId)) + ' · Malzeme: ' + x(lots || '—') + '</p>' +
      '<table><tr><th>Op</th><th>Operasyon</th><th>Tezgah / tedarikçi</th><th>Talimat</th><th>Sağlam</th><th>Hurda</th><th>Operatör / tarih</th></tr>' +
      (w.ops || []).map((o) => '<tr><td>' + x(o.seq) + '</td><td>' + x(o.name) + '</td><td>' + x(o.type === 'Fason' ? E.nameOf('processes', o.processId) + ' (fason)' : E.machineName(o.machineId)) + '</td><td>' + x(o.note) + '</td><td style="width:60px"></td><td style="width:60px"></td><td style="width:140px"></td></tr>').join('') + '</table>';
    E.saveFile(w.no + '_is_foyu.html', E.docHtml(w.no + ' iş föyü', body));
  }

  function WorkOrderDetail({ id }) {
    const D = E.useStore();
    const w = D.workorders[id];
    const [tab, setTab] = useState('rota');
    const [open, setOpen] = useState({});
    const [ed, setEd] = useState(null);
    const [lf, setLf] = useState(null);
    if (!w) return html`<${E.Empty} title="İş emri bulunamadı" text="" />`;
    const st = E.woStatus(w);
    const can = E.canEdit('uretim') && !['İptal', 'Kapandı'].includes(w.status);
    const order = E.orderOf(w);
    const prog = E.opProgress(w);
    const rev = E.revOf(w.partId, w.rev);
    const release = async () => {
      const ro = E.routingFor(w.partId, w.rev);
      if (!ro || !(ro.ops || []).length) { E.toast('Bu revizyonun rotası yok. Önce Üretim › Rotalar\'dan tanımlayın.', 'err'); return; }
      await E.save('workorders', Object.assign({}, w, { status: 'Serbest', ops: ro.ops.map((o) => Object.assign({}, o)), routingId: ro.id, releasedAt: E.now() }), 'Serbest bırakıldı · rota kopyalandı (' + ro.ops.length + ' op)');
      E.toast(w.no + ' serbest bırakıldı');
    };
    const saveEd = async () => {
      const qty = E.num(ed.qty), from = E.num(ed.serialFrom);
      await E.save('workorders', Object.assign({}, w, { qty, due: ed.due, serialFrom: from, serialTo: from + qty - 1 })); setEd(null);
    };
    const linkLot = async () => {
      const lot = E.get('lots', lf.lotId);
      if (!lot || !E.num(lf.qty)) { E.toast('Lot ve miktar seçin', 'err'); return; }
      if (E.num(lf.qty) > E.lotRemaining(lot) + 1e-9) { E.toast('Lotta kalan miktar yetersiz (' + N(E.lotRemaining(lot), 1) + ')', 'err'); return; }
      await E.save('workorders', Object.assign({}, w, { lots: (w.lots || []).concat({ lotId: lot.id, qty: E.num(lf.qty), serial: lf.serial || serialText(w) }) }), 'Lot bağlandı: ' + lot.no + ' (şarj ' + lot.heat + ')');
      setLf(null);
    };
    const setMachine = (seq, mid) => E.save('workorders', Object.assign({}, w, { ops: w.ops.map((o) => (o.seq === seq ? Object.assign({}, o, { machineId: mid }) : o)) }), 'Op' + seq + ' tezgahı: ' + E.machineName(mid));
    const okLots = E.list('lots').filter((l) => l.status === 'Kabul' && E.lotRemaining(l) > 0);
    const subs = E.list('subcons').filter((s) => s.woId === w.id);
    const insp = E.list('inspections').filter((i) => i.woId === w.id);
    const ncrs = E.list('ncrs').filter((n) => n.woId === w.id);
    const ships = E.list('shipments').filter((s) => s.status !== 'İptal' && (s.lines || []).some((l) => l.woId === w.id));
    const cards = E.list('jobcards').filter((c) => c.woId === w.id);
    const tabs = [['rota', 'Rota ilerlemesi'], ['malzeme', 'Malzeme (' + (w.lots || []).length + ')'], ['fason', 'Fason (' + subs.length + ')'], ['muayene', 'Muayene ve NCR (' + (insp.length + ncrs.length) + ')'], ['belge', 'Belgeler'], ['izi', 'İzlenebilirlik'], ['gecmis', 'Geçmiş']];
    return html`<div className="col" style=${{ gap: 16 }}>
      <${E.Head} crumb=${html`<${E.BackCrumb} label="İş emirleri" here=${w.no} />`} title=${html`<span className="mono">${w.no}</span> · ${E.partLabel(w.partId, w.rev)}`} badge=${html`<${E.Badge} s=${st} />`}
        sub=${html`<span>Sipariş ${order ? html`<${E.RecLink} type="order" id=${order.id}>${order.no}<//>` : '—'} · ${order ? E.nameOf('customers', order.customerId) : ''}</span><span>${w.qty} adet</span><span>Seri <span className="mono">${serialText(w)}</span></span><span>Termin ${E.fmtD(w.due)}</span><span>Sağlam çıkan: ${E.woGood(w)}</span>`}
        actions=${html`
          ${can && w.status === 'Taslak' ? html`<${E.Btn} onClick=${() => setEd({ qty: w.qty, due: w.due, serialFrom: w.serialFrom })}>Düzenle<//><${E.Btn} kind="p" onClick=${release}>Serbest bırak<//><${E.Btn} kind="d" onClick=${() => E.deleteDraft('workorders', w, E.closeRec)}>Sil<//>` : null}
          ${w.status !== 'Taslak' ? html`<${E.Btn} onClick=${() => traveler(w)}>İş föyü<//>` : null}
          ${can && st === 'Tamamlandı' ? html`<${E.Btn} onClick=${() => E.save('workorders', Object.assign({}, w, { status: 'Kapandı' }), 'Kapatıldı')}>Kapat<//>` : null}
          ${can && w.status !== 'Taslak' ? html`<${E.Btn} kind="d" onClick=${() => E.cancelRec('workorders', w)}>İptal<//>` : null}`} />
      ${E.faiNeeded(w) ? html`<div className="alert warn">FAI gerekli: müşteri veya sipariş FAI istiyor ve ${E.partLabel(w.partId, w.rev)} için kabul edilmiş FAI yok. FAI kabul edilmeden sevk edilemez.</div>` : null}
      ${order && order.qnote ? html`<div className="alert info">Sipariş kalite notu: ${order.qnote}</div>` : null}
      ${w.status === 'Taslak' ? html`<div className="alert info">Taslak iş emri. Adet, termin ve seri aralığını kontrol edip “Serbest bırak” ile rotayı kopyalayın.${E.routingFor(w.partId, w.rev) ? '' : ' Bu revizyonun henüz rotası yok.'}</div>` : null}
      <section className="card">
        <${E.Tabs} tabs=${tabs} cur=${tab} set=${setTab} />
        ${tab === 'rota' ? html`<div className="scroll"><table className="tbl"><thead><tr><th>Op</th><th>Operasyon</th><th>Tezgah / tedarikçi</th><th className="num">Plan</th><th className="num">Gerçek</th><th className="num">Gelen</th><th className="num">Sağlam</th><th className="num">Hurda</th><th>Durum</th><th></th></tr></thead><tbody>
          ${prog.length ? prog.map((o) => html`<${React.Fragment} key=${o.seq}>
            <tr><td className="mono">${o.seq}</td><td>${o.name}</td>
              <td>${o.type === 'Fason' ? E.nameOf('processes', o.processId) + ' · fason' : (can ? html`<${E.Sel} sm value=${o.machineId} options=${E.machOpts()} onChange=${(v) => setMachine(o.seq, v)} />` : E.machineName(o.machineId))}</td>
              <td className="num">${o.type === 'Fason' ? '—' : N(o.planMins / 60, 1) + ' s'}</td><td className="num">${o.type === 'Fason' ? '—' : N(o.mins / 60, 1) + ' s'}</td>
              <td className="num">${o.input}</td><td className="num">${o.good}</td><td className="num" style=${o.scrap ? { color: 'var(--bad)', fontWeight: 600 } : null}>${o.scrap}</td>
              <td><${E.Badge} s=${o.st} />${o.active ? ' ●' : ''}${o.type === 'Fason' && o.sent ? html` <span className="muted">gönderilen ${o.sent}</span>` : null}</td>
              <td>${o.type !== 'Fason' ? html`<${E.Link} onClick=${() => setOpen(Object.assign({}, open, { [o.seq]: !open[o.seq] }))}>İş kartları (${cards.filter((c) => c.seq === o.seq).length})<//>` : null}</td></tr>
            ${open[o.seq] ? html`<tr><td colSpan="10" style=${{ background: 'var(--surface2)', paddingLeft: 36 }}>
              <${E.Table} rows=${cards.filter((c) => c.seq === o.seq).sort((a, b) => (a.start || '').localeCompare(b.start || ''))} empty=${html`<div className="muted">Bu operasyonda iş kartı yok.</div>`}
                cols=${[{ k: 'no', label: 'İş kartı', mono: true }, { label: 'Operatör', v: (c) => E.userName(c.userId) }, { label: 'Tezgah', v: (c) => E.machineName(c.machineId) }, { label: 'Başlangıç', v: (c) => E.fmtDT(c.start) },
                  { label: 'Bitiş', v: (c) => (c.end ? E.fmtDT(c.end) : html`<${E.Badge} s="Devam" />`) }, { label: 'Sağlam', num: true, v: (c) => c.good || 0 }, { label: 'Hurda', num: true, v: (c) => (c.scrap ? c.scrap + ' · ' + (c.reason || '') : 0) }]} />
            </td></tr>` : null}
          <//>`) : html`<tr><td colSpan="10" className="empty">Operasyonlar iş emri serbest bırakılınca rotadan kopyalanır.</td></tr>`}
          </tbody></table></div>` : null}
        ${tab === 'malzeme' ? html`<div>
          <${E.Table} rows=${(w.lots || []).map((l, i) => Object.assign({ i }, l))} empty=${html`<div className="empty">Bağlı lot yok.</div>`}
            cols=${[{ label: 'Lot', v: (l) => html`<${E.RecLink} type="lot" id=${l.lotId}>${E.nameOf('lots', l.lotId)}<//>` }, { label: 'Şarj no', mono: true, v: (l) => (E.get('lots', l.lotId) || {}).heat },
              { label: 'Malzeme', v: (l) => E.nameOf('materials', (E.get('lots', l.lotId) || {}).materialId) }, { label: 'Kullanılan', num: true, v: (l) => N(l.qty, 1) + ' ' + ((E.get('lots', l.lotId) || {}).unit || '') },
              { label: 'Seri aralığı', mono: true, k: 'serial' }, { label: 'CoC', v: (l) => { const dd = E.docsFor('lots/' + l.lotId, 'Malzeme CoC')[0]; return dd ? html`<a href=${E.blobUrl(dd.assetId)} target="_blank" rel="noopener">${dd.name}</a>` : html`<span className="muted">yok</span>`; } },
              can ? { label: '', v: (l) => html`<${E.Btn} sm kind="d" onClick=${() => E.save('workorders', Object.assign({}, w, { lots: w.lots.filter((_, j) => j !== l.i) }), 'Lot bağı kaldırıldı: ' + E.nameOf('lots', l.lotId))}>Kaldır<//>` } : null].filter(Boolean)} />
          ${can ? html`<div className="pad"><${E.Btn} onClick=${() => setLf({ serial: serialText(w) })}>+ Lot bağla<//></div>` : null}
          ${rev ? html`<div className="pad muted" style=${{ paddingTop: 0 }}>Çizimdeki malzeme: ${E.nameOf('materials', rev.materialId)} ${rev.spec ? '· ' + rev.spec : ''} · ham ölçü ${E.rawLabel(rev)} (${N(E.rawKg(rev), 3)} kg/ad.)</div>` : null}
        </div>` : null}
        ${tab === 'fason' ? html`<div>
          <${E.Table} rows=${subs} onRow=${(s) => E.openRec('subcon', s.id)} empty=${html`<div className="empty">Fason kaydı yok.</div>`}
            cols=${[{ k: 'no', label: 'Fason no', mono: true }, { label: 'Op', k: 'seq' }, { label: 'Proses', v: (s) => E.nameOf('processes', s.processId) }, { label: 'Tedarikçi', v: (s) => E.nameOf('suppliers', s.supplierId) },
              { label: 'Giden', num: true, v: (s) => (s.moves || []).filter((m) => m.type === 'Giden').reduce((a, m) => a + (+m.qty || 0), 0) }, { label: 'Dönen', num: true, v: (s) => (s.moves || []).filter((m) => m.type === 'Gelen').reduce((a, m) => a + (+m.qty || 0), 0) },
              { label: 'Durum', v: (s) => html`<${E.Badge} s=${E.subStatus ? E.subStatus(s) : s.status} />` }]} />
          ${E.canEdit('satinalma') && w.status !== 'Taslak' && (w.ops || []).some((o) => o.type === 'Fason') ? html`<div className="pad"><${E.Btn} onClick=${() => E.newSubcon(w)}>+ Fasona gönder<//></div>` : null}
        </div>` : null}
        ${tab === 'muayene' ? html`<div>
          <${E.Table} rows=${insp} onRow=${(i) => E.openRec('inspection', i.id)} empty=${html`<div className="empty">Muayene kaydı yok.</div>`}
            cols=${[{ k: 'no', label: 'No', mono: true }, { k: 'type', label: 'Tip' }, { label: 'Op', v: (i) => i.seq || '—' }, { label: 'Adet', num: true, k: 'qty' }, { label: 'Kontrolör', v: (i) => E.userName(i.inspector) }, { label: 'Tarih', v: (i) => E.fmtD(i.date) },
              { label: 'Sonuç', v: (i) => html`<${E.Badge} s=${i.result || 'Taslak'} />` }]} />
          <h3 style=${{ margin: 0, padding: '12px 16px', fontSize: 15, borderTop: '1px solid var(--line)' }}>NCR</h3>
          <${E.Table} rows=${ncrs} onRow=${(n) => E.openRec('ncr', n.id)} empty=${html`<div className="empty">NCR yok.</div>`}
            cols=${[{ k: 'no', label: 'No', mono: true }, { label: 'Op', v: (n) => n.seq || '—' }, { label: 'Adet', num: true, k: 'qty' }, { k: 'desc', label: 'Tanım', wrap: true }, { label: 'Karar', v: (n) => n.decision || '—' }, { label: 'Durum', v: (n) => html`<${E.Badge} s=${n.status} />` }]} />
          ${E.canEdit('kalite') && w.status !== 'Taslak' ? html`<div className="pad row"><${E.Btn} onClick=${() => E.newInspection({ woId: w.id, type: 'Ara' })}>+ Ara muayene<//><${E.Btn} onClick=${() => E.newInspection({ woId: w.id, type: 'Final' })}>+ Final muayene<//>
            ${E.faiNeeded(w) ? html`<${E.Btn} onClick=${() => E.newInspection({ woId: w.id, type: 'FAI' })}>+ FAI<//>` : null}<${E.Btn} onClick=${() => E.newNcr({ woId: w.id })}>+ NCR aç<//></div>` : null}
        </div>` : null}
        ${tab === 'belge' ? html`<div className="pad"><${E.DocPanel} refKey=${'workorders/' + w.id} extraRefs=${['parts/' + w.partId + '/' + w.rev]} kinds=${['Ölçüm raporu', 'İş föyü', 'Diğer']} /></div>` : null}
        ${tab === 'izi' ? html`<div className="pad">${E.Genealogy ? html`<${E.Genealogy} wo=${w} />` : null}</div>` : null}
        ${tab === 'gecmis' ? html`<div className="pad"><${E.History} rec=${w} /></div>` : null}
      </section>
      ${ed ? html`<${E.Modal} title="İş emri bilgileri" onClose=${() => setEd(null)} foot=${html`<${E.Btn} onClick=${() => setEd(null)}>Vazgeç<//><${E.Btn} kind="p" onClick=${saveEd}>Kaydet<//>`}>
        <${E.SchemaForm} value=${ed} set=${(k, v) => setEd(Object.assign({}, ed, { [k]: v }))} fields=${[{ k: 'qty', label: 'Adet', type: 'number', req: true }, { k: 'due', label: 'Termin', type: 'date' }, { k: 'serialFrom', label: 'İlk seri no', type: 'number' }]} />
        <div className="muted">Seri aralığı: ${E.serial(E.num(ed.serialFrom))}–${E.serial(E.num(ed.serialFrom) + E.num(ed.qty) - 1)}</div>
      <//>` : null}
      ${lf ? html`<${E.Modal} title="Lot bağla" onClose=${() => setLf(null)} foot=${html`<${E.Btn} onClick=${() => setLf(null)}>Vazgeç<//><${E.Btn} kind="p" onClick=${linkLot}>Bağla<//>`}>
        <div className="muted">Sadece gelen kontrolü kabul edilmiş ve kalanı olan lotlar listelenir.</div>
        <${E.SchemaForm} value=${lf} set=${(k, v) => setLf(Object.assign({}, lf, { [k]: v }, k === 'lotId' && rev ? { qty: lf.qty || E.fmtN(E.rawKg(rev) * w.qty * 1.05, 2) } : {}))}
          fields=${[{ k: 'lotId', label: 'Lot', type: 'select', req: true, options: okLots.map((l) => ({ v: l.id, l: l.no + ' · ' + E.nameOf('materials', l.materialId) + ' · şarj ' + l.heat + ' · kalan ' + N(E.lotRemaining(l), 1) + ' ' + (l.unit || '') + (rev && l.materialId !== rev.materialId ? ' (farklı malzeme!)' : '') })) },
            { k: 'qty', label: 'Kullanılan miktar', type: 'number', req: true }, { k: 'serial', label: 'Bu lottan çıkan seri aralığı' }]} />
      <//>` : null}
    </div>`;
  }
  E.details.workorder = WorkOrderDetail;
})();
