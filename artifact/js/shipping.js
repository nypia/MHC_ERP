// Shipping: shipments gated by final inspection, FAI and open NCRs; dispatch note and customer CoC documents.
(function () {
  const E = window.ERP;
  const { html } = E;
  const { useState } = React;
  const x = E.esc;

  async function newShipment(order) {
    const s = await E.save('shipments', { no: E.nextNo('shipments', 'SVK'), orderId: order.id, customerId: order.customerId, date: E.today(), dispatchNo: '', carrier: '', pack: order.pack || '', status: 'Taslak', lines: [] }, 'Siparişten oluşturuldu: ' + order.no);
    E.openRec('shipment', s.id);
  }
  E.newShipment = newShipment;

  function cocBody(s) {
    const o = E.get('orders', s.orderId) || {}; const c = E.get('customers', s.customerId) || {};
    const rows = (s.lines || []).map((l) => {
      const w = E.get('workorders', l.woId) || {}; const rev = E.revOf(w.partId, w.rev) || {};
      const heats = x((w.lots || []).map((y) => { const lot = E.get('lots', y.lotId) || {}; return (lot.heat || '') + ' (' + (lot.no || '') + ')'; }).join(', '));
      const procs = E.list('subcons').filter((y) => y.woId === w.id && y.status !== 'İptal').map((y) => { const cert = E.docsFor('subcons/' + y.id, 'Proses sertifikası')[0]; return x(E.nameOf('processes', y.processId) + ' · ' + E.nameOf('suppliers', y.supplierId) + (cert ? ' · sertifika ' + cert.name : '')); }).join('<br>');
      const fins = E.list('inspections').filter((i) => i.woId === w.id && i.type === 'Final' && i.result !== 'Ret');
      const accepts = E.list('ncrs').filter((n) => n.woId === w.id && n.decision === 'Müşteri onaylı kabul').map((n) => n.no).join(', ');
      return { l, w, rev, heats, procs, fins, accepts };
    });
    const insp = rows.flatMap((r) => r.fins).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
    return E.companyHead('UYGUNLUK SERTİFİKASI · CERTIFICATE OF CONFORMITY', 'CoC-' + s.no) +
      '<p>Müşteri: <b>' + x(c.name) + '</b><br>Müşteri PO: <b>' + x(o.po || '—') + '</b><br>Sevkiyat / irsaliye: ' + x(s.no) + ' / ' + x(s.dispatchNo || '—') + ' · ' + E.fmtD(s.date) + '</p>' +
      '<table><tr><th>Parça / rev</th><th>Adet</th><th>Seri</th><th>Malzeme · şarj</th><th>Özel prosesler</th><th>FAI</th></tr>' +
      rows.map((r) => '<tr><td>' + x(E.partLabel(r.w.partId, r.w.rev)) + '</td><td>' + x(r.l.qty) + '</td><td>' + E.serial(r.l.serialFrom) + '–' + E.serial(r.l.serialTo) + '</td><td>' + x(E.nameOf('materials', r.rev.materialId) + (r.rev.spec ? ' · ' + r.rev.spec : '')) + '<br>şarj ' + (r.heats || '—') + '</td><td>' + (r.procs || '—') + '</td><td>' + x(r.rev.faiRef || (r.rev.faiDone ? 'var' : '—')) + '</td></tr>' +
        (r.accepts ? '<tr><td colspan="6">Müşteri onaylı kabul: ' + x(r.accepts) + '</td></tr>' : '')).join('') + '</table>' +
      '<p style="margin-top:18px">Yukarıda belirtilen parçaların sipariş, çizim ve ilgili şartname gerekliliklerine uygun olarak üretildiğini ve muayene edildiğini beyan ederiz.</p>' +
      '<div style="display:flex;justify-content:space-between;margin-top:30px"><div>Kalite kontrol: <b>' + x(insp ? E.userName(insp.inspector) : '—') + '</b><br>Final muayene ' + x(insp ? insp.no + ' · ' + E.fmtD(insp.date) : '—') + '</div><div style="width:200px;border-top:1px solid #111;text-align:center;padding-top:4px">İmza / kaşe</div></div>';
  }
  function dispatchBody(s) {
    const o = E.get('orders', s.orderId) || {}; const c = E.get('customers', s.customerId) || {};
    return E.companyHead('SEVK İRSALİYESİ', s.no) + '<p>Alıcı: <b>' + x(c.name) + '</b><br>' + x(c.address) + '<br>Vergi no: ' + x(c.taxNo || '—') + '</p><p>e-İrsaliye no: <b>' + x(s.dispatchNo || '—') + '</b> · Sevk tarihi: ' + E.fmtD(s.date) + ' · Müşteri PO: ' + x(o.po || '—') + ' · Taşıyıcı: ' + x(s.carrier || '—') + '</p>' +
      '<table><tr><th>#</th><th>Parça / rev</th><th>Adet</th><th>Seri</th></tr>' + (s.lines || []).map((l, i) => { const w = E.get('workorders', l.woId) || {}; return '<tr><td>' + (i + 1) + '</td><td>' + x(E.partLabel(w.partId, w.rev)) + '</td><td>' + x(l.qty) + '</td><td>' + E.serial(l.serialFrom) + '–' + E.serial(l.serialTo) + '</td></tr>'; }).join('') + '</table><p>Ambalaj: ' + x(s.pack || '—') + '</p>';
  }

  function ShipmentsPage() {
    const D = E.useStore();
    const [chip, setChip] = useState('Açık');
    const [pick, setPick] = useState(null);
    const can = E.canEdit('sevkiyat');
    const rows = Object.values(D.shipments).filter((s) => chip === 'Tümü' || (chip === 'Açık' ? ['Taslak', 'Hazır'].includes(s.status) : s.status === chip)).sort((a, b) => (b.no || '').localeCompare(a.no || ''));
    const openOrders = Object.values(D.orders).filter((o) => ['Onaylı', 'Üretimde', 'Kısmi sevk'].includes(E.orderStatus(o)));
    return html`<div>
      <${E.ListPage} title="Sevkiyatlar" crumb="Sevkiyat › Sevkiyatlar" csv="Sevkiyatlar" chips=${['Açık', 'Sevk edildi', 'İptal', 'Tümü']} chip=${chip} setChip=${setChip} rows=${rows} onRow=${(s) => E.openRec('shipment', s.id)}
        cols=${[{ k: 'no', label: 'No', mono: true }, { label: 'Müşteri', v: (s) => E.nameOf('customers', s.customerId) }, { label: 'Sipariş / PO', v: (s) => { const o = E.get('orders', s.orderId) || {}; return (o.no || '') + ' / ' + (o.po || '—'); } },
          { label: 'Tarih', v: (s) => E.fmtD(s.date) }, { k: 'dispatchNo', label: 'İrsaliye no', mono: true }, { label: 'Adet', num: true, v: (s) => (s.lines || []).reduce((a, l) => a + (+l.qty || 0), 0) }, { label: 'Durum', v: (s) => html`<${E.Badge} s=${s.status} />`, csv: (s) => s.status }]}
        empty=${html`<${E.Empty} title="Sevkiyat yok" text=" Siparişten “Sevkiyat aç” ile ya da buradan oluşturun." />`}
        actions=${can ? html`<${E.Btn} kind="p" onClick=${() => setPick({})}>+ Yeni sevkiyat<//>` : null} />
      ${pick ? html`<${E.Modal} title="Hangi sipariş sevk edilecek?" onClose=${() => setPick(null)} foot=${html`<${E.Btn} onClick=${() => setPick(null)}>Vazgeç<//><${E.Btn} kind="p" disabled=${!pick.orderId} onClick=${() => { const o = E.get('orders', pick.orderId); setPick(null); newShipment(o); }}>Oluştur<//>`}>
        <${E.SchemaForm} value=${pick} set=${(k, v) => setPick({ [k]: v })} fields=${[{ k: 'orderId', label: 'Sipariş', type: 'select', req: true, options: openOrders.map((o) => ({ v: o.id, l: o.no + ' · ' + E.nameOf('customers', o.customerId) + ' · PO ' + (o.po || '—') })) }]} />
      <//>` : null}
    </div>`;
  }
  E.pages['sevkiyat/sevkiyatlar'] = ShipmentsPage;

  function ShipmentDetail({ id }) {
    const D = E.useStore();
    const s = D.shipments[id];
    const [d, setD] = useState(null);
    const [coc, setCoc] = useState(false);
    if (!s) return html`<${E.Empty} title="Sevkiyat bulunamadı" text="" />`;
    const o = E.get('orders', s.orderId) || {};
    const can = E.canEdit('sevkiyat');
    const draft = s.status === 'Taslak';
    const cur = d || s;
    const set = (k, v) => setD(Object.assign({}, cur, { [k]: v }));
    // candidate rows: every work order of every order line
    const cands = [];
    (o.lines || []).forEach((line) => E.list('workorders').filter((w) => w.orderId === o.id && w.lineId === line.id && w.status !== 'İptal').forEach((w) => {
      const ck = E.shipChecks(w, s.id);
      const mine = (cur.lines || []).find((l) => l.woId === w.id);
      cands.push({ id: w.id, line, w, ck, mine });
    }));
    const setQty = (w, line, v) => {
      const q = E.num(v);
      const others = (cur.lines || []).filter((l) => l.woId !== w.id);
      const from = (+w.serialFrom || 1) + E.shippedQty(w.id, s.id);
      setD(Object.assign({}, cur, { lines: q > 0 ? others.concat({ lineId: line.id, woId: w.id, qty: q, serialFrom: from, serialTo: from + q - 1 }) : others }));
    };
    const errors = (cur.lines || []).map((l) => { const c = cands.find((x) => x.w.id === l.woId); if (!c) return 'Satır bulunamadı'; if (!c.ck.finOk) return c.w.no + ': final muayene kabulü yok'; if (!c.ck.fai) return c.w.no + ': FAI kabul edilmedi'; if (!c.ck.ncr) return c.w.no + ': açık NCR var'; if (l.qty > c.ck.avail) return c.w.no + ': sevke uygun ' + c.ck.avail + ' adet var'; return null; }).filter(Boolean);
    const total = (cur.lines || []).reduce((a, l) => a + l.qty, 0);
    const ready = async () => {
      if (!total) { E.toast('En az bir satıra sevk adedi girin', 'err'); return; }
      if (errors.length) { E.toast(errors[0], 'err'); return; }
      await E.save('shipments', Object.assign({}, cur, { status: 'Hazır' }), 'Hazır · ' + total + ' adet'); setD(null);
    };
    const ship = async () => {
      if (!s.dispatchNo) { E.toast('Dış programdaki e-irsaliye numarasını girin', 'err'); return; }
      await E.save('shipments', Object.assign({}, s, { status: 'Sevk edildi', shippedAt: E.now() }), 'Sevk edildi · irsaliye ' + s.dispatchNo);
      for (const l of s.lines || []) { const w = E.get('workorders', l.woId); if (w) await E.save('workorders', w, s.no + ' ile ' + l.qty + ' adet sevk edildi (seri ' + E.serial(l.serialFrom) + '–' + E.serial(l.serialTo) + ')'); }
      E.toast(s.no + ' sevk edildi');
    };
    return html`<div className="col" style=${{ gap: 16 }}>
      <${E.Head} crumb=${html`<${E.BackCrumb} label="Sevkiyatlar" here=${s.no} />`} title=${html`<span className="mono">${s.no}</span> · ${E.nameOf('customers', s.customerId)}`} badge=${html`<${E.Badge} s=${s.status} />`}
        sub=${html`<span>Sipariş <${E.RecLink} type="order" id=${o.id}>${o.no}<//> · PO <b className="mono">${o.po || '—'}</b></span><span>${total} adet</span>${o.cocReq ? html`<span>Müşteri CoC istiyor</span>` : null}`}
        actions=${html`
          ${d ? html`<${E.Btn} onClick=${() => setD(null)}>Değişiklikleri at<//><${E.Btn} kind="p" onClick=${async () => { await E.save('shipments', cur); setD(null); }}>Kaydet<//>` : null}
          ${s.lines && s.lines.length ? html`<${E.Btn} onClick=${() => E.saveFile(s.no + '_irsaliye.html', E.docHtml(s.no + ' irsaliye', dispatchBody(s)))}>İrsaliye<//><${E.Btn} onClick=${() => E.saveFile(s.no + '_CoC.html', E.docHtml(s.no + ' CoC', cocBody(s)))}>Müşteri CoC<//><${E.Btn} onClick=${() => setCoc(!coc)}>${coc ? 'Önizlemeyi kapat' : 'CoC önizle'}<//>` : null}
          ${can && draft && !d ? html`<${E.Btn} kind="p" onClick=${ready}>Hazır olarak işaretle<//><${E.Btn} kind="d" onClick=${() => E.deleteDraft('shipments', s, E.closeRec)}>Sil<//>` : null}
          ${can && s.status === 'Hazır' && !d ? html`<${E.Btn} onClick=${() => E.save('shipments', Object.assign({}, s, { status: 'Taslak' }), 'Taslağa alındı')}>Taslağa al<//><${E.Btn} kind="p" onClick=${ship}>Sevk edildi olarak işaretle<//>` : null}
          ${can && s.status !== 'Taslak' && s.status !== 'İptal' && !d && (E.currentUser().roles || []).includes('yonetici') ? html`<${E.Btn} kind="d" onClick=${() => E.cancelRec('shipments', s)}>İptal<//>` : null}`} />
      <div className="split"><div className="l">
        <${E.Card} title="Sevk satırları"><div className="scroll"><table className="tbl"><thead><tr><th>Parça / rev</th><th>İş emri</th><th className="num">Sipariş</th><th className="num">Final kabul</th><th className="num">Sevke uygun</th><th className="num">Sevk adedi</th><th>Seri</th><th>Kontroller</th></tr></thead><tbody>
          ${cands.length ? cands.map((c) => html`<tr key=${c.id} style=${!c.ck.ok && !c.mine ? { background: 'var(--bad-soft)' } : null}>
            <td>${E.partLabel(c.w.partId, c.w.rev)}</td><td><${E.RecLink} type="workorder" id=${c.w.id}>${c.w.no}<//></td><td className="num">${c.line.qty}</td><td className="num">${c.ck.fin}</td><td className="num">${c.ck.avail}</td>
            <td className="num">${can && draft ? html`<input className="in sm" style=${{ width: 74, textAlign: 'right' }} aria-label="Sevk adedi" disabled=${!c.ck.ok && !c.mine} value=${c.mine ? c.mine.qty : ''} onChange=${(e) => setQty(c.w, c.line, e.target.value)} />` : (c.mine ? c.mine.qty : '—')}</td>
            <td className="mono">${c.mine ? E.serial(c.mine.serialFrom) + '–' + E.serial(c.mine.serialTo) : '—'}</td>
            <td>${html`<span style=${{ color: c.ck.finOk ? 'var(--ok)' : 'var(--bad)' }}>${c.ck.finOk ? '✔' : '✗'} Final</span> · <span style=${{ color: c.ck.fai ? 'var(--ok)' : 'var(--bad)' }}>${c.ck.fai ? '✔' : '✗'} FAI</span> · <span style=${{ color: c.ck.ncr ? 'var(--ok)' : 'var(--bad)' }}>${c.ck.ncr ? '✔ NCR yok' : '✗ Açık NCR'}</span>`}</td>
          </tr>`) : html`<tr><td colSpan="8" className="empty">Bu siparişin iş emri yok.</td></tr>`}
        </tbody></table></div>
          <div className="pad muted" style=${{ fontSize: 13 }}>Sevke uygun = final muayenede kabul edilen − bu iş emrinden daha önce sevke ayrılan. Final kabulü olmayan, FAI gerekip kabul edilmeyen veya açık NCR'si olan iş emri sevk edilemez. Seri aralığı otomatik önerilir.</div>
          ${errors.length ? html`<div className="pad" style=${{ paddingTop: 0 }}>${errors.map((x) => html`<div key=${x} className="alert bad" style=${{ marginBottom: 6 }}>${x}</div>`)}</div>` : null}
        <//>
        <${E.Card} title="Sevk bilgileri"><div className="pad form">
          <${E.Field} label="e-İrsaliye no (dış programdan)"><${E.Inp} value=${cur.dispatchNo} disabled=${!can || s.status === 'Sevk edildi'} onChange=${(v) => set('dispatchNo', v)} /><//>
          <${E.Field} label="Sevk tarihi"><${E.Inp} type="date" value=${cur.date} disabled=${!can || s.status === 'Sevk edildi'} onChange=${(v) => set('date', v)} /><//>
          <${E.Field} label="Taşıyıcı"><${E.Inp} value=${cur.carrier} disabled=${!can || s.status === 'Sevk edildi'} onChange=${(v) => set('carrier', v)} /><//>
          <${E.Field} label="Ambalaj"><${E.Inp} value=${cur.pack} disabled=${!can || s.status === 'Sevk edildi'} onChange=${(v) => set('pack', v)} /><//>
        </div><//>
        ${coc ? html`<div className="doc" dangerouslySetInnerHTML=${{ __html: cocBody(s) }}></div>` : null}
      </div><div className="r">
        <${E.DocPanel} refKey=${'shipments/' + id} kinds=${['İmzalı irsaliye', 'İmzalı CoC', 'Diğer']} />
        <${E.History} rec=${s} />
      </div></div>
    </div>`;
  }
  E.details.shipment = ShipmentDetail;
})();
