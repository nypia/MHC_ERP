// Overview: dashboard, late work, parts at subcontractors.
(function () {
  const E = window.ERP;
  const { html } = E;

  function openLines() {
    const out = [];
    E.list('orders').forEach((o) => {
      if (['Taslak', 'İptal', 'Tamamlandı'].includes(E.orderStatus(o))) return;
      (o.lines || []).forEach((l) => { const s = E.lineStats(o, l); if (s.shipped < l.qty) out.push({ id: o.id + l.id, o, l, s }); });
    });
    return out.sort((a, b) => (a.l.due || '').localeCompare(b.l.due || ''));
  }
  function where(r) {
    if (!r.s.wos.length) return 'İş emri yok';
    return r.s.wos.map((w) => { const st = E.woStatus(w); const p = E.opProgress(w).find((x) => x.st !== 'Bitti'); return w.no + ' · ' + (p ? 'Op' + p.seq + ' ' + p.name : st); }).join(' | ');
  }
  function Kpi({ label, value, go, bad }) { return html`<button type="button" className=${'card kpi' + (bad ? ' bad' : '')} onClick=${go}><span>${label}</span><b>${value}</b></button>`; }

  function Dashboard() {
    const D = E.useStore();
    const today = E.today(); const week = E.addDays(today, 7);
    const lines = openLines();
    const late = lines.filter((r) => r.l.due < today);
    const thisWeek = lines.filter((r) => r.l.due >= today && r.l.due <= week);
    const wos = Object.values(D.workorders);
    const running = wos.filter((w) => ['Serbest', 'Üretimde'].includes(E.woStatus(w)));
    const atSub = Object.values(D.subcons).filter((s) => !s.closed && s.status !== 'İptal').reduce((a, s) => a + Math.max(0, E.sumMoves(s, 'Giden') - E.sumMoves(s, 'Gelen')), 0);
    const ncrs = Object.values(D.ncrs).filter((n) => n.status === 'Açık');
    const quarantine = Object.values(D.lots).filter((l) => (l.status || 'Karantina') === 'Karantina');
    const ship = wos.filter((w) => !['İptal', 'Kapandı', 'Taslak'].includes(w.status) && E.shipChecks(w).ok);
    const finWait = wos.filter((w) => !['Taslak', 'İptal', 'Kapandı'].includes(w.status) && E.woGood(w) > E.finalAccepted(w.id));
    const certs = Object.values(D.suppliers).filter((s) => s.active !== false).map((s) => ({ s, c: E.certState(s) })).filter((x) => x.c && x.c.st !== 'Geçerli');
    const machines = Object.values(D.machines).filter((m) => m.active !== false).sort((a, b) => a.code.localeCompare(b.code));
    const empty = !Object.values(D.orders).length && !Object.values(D.parts).length;
    return html`<div className="col" style=${{ gap: 16 }}>
      <${E.Head} crumb="Genel durum › Gösterge paneli" title="Gösterge paneli" actions=${html`<span className="muted">${E.fmtD(today)}</span>`} />
      ${empty ? html`<div className="alert info">Sistem boş. Başlamak için: Ana veriler'de müşteri, malzeme, tezgah ve parça tanımlayın, Üretim › Rotalar'dan rota girin, sonra Satış › Teklifler'den ilk teklifi hazırlayın.</div>` : null}
      <div className="kpis">
        <${Kpi} label="Açık sipariş" value=${Object.values(D.orders).filter((o) => !['Taslak', 'İptal', 'Tamamlandı'].includes(E.orderStatus(o))).length} go=${() => E.nav('satis', 'siparisler')} />
        <${Kpi} label="Üretimdeki iş emri" value=${running.length} go=${() => E.nav('uretim', 'is-emirleri')} />
        <${Kpi} label="Bu hafta termin" value=${thisWeek.length} go=${() => E.nav('genel', 'geciken')} />
        <${Kpi} label="Geciken" value=${late.length} bad=${late.length > 0} go=${() => E.nav('genel', 'geciken')} />
        <${Kpi} label="Fasonda (adet)" value=${atSub} go=${() => E.nav('genel', 'fason')} />
        <${Kpi} label="Açık NCR" value=${ncrs.length} bad=${ncrs.length > 0} go=${() => E.nav('kalite', 'ncr')} />
        <${Kpi} label="Final bekleyen" value=${finWait.length} go=${() => E.nav('kalite', 'final')} />
        <${Kpi} label="Sevke hazır" value=${ship.length} go=${() => E.nav('sevkiyat', 'sevkiyatlar')} />
      </div>
      <div className="split"><div className="l">
        <${E.Card} title="Tezgah durumu (canlı)"><${E.Table} rows=${machines} empty=${html`<div className="empty">Tezgah tanımlı değil.</div>`}
          cols=${[{ k: 'code', label: 'Tezgah', mono: true }, { label: 'Durum', v: (m) => { const c = E.list('jobcards').find((j) => j.machineId === m.id && j.status === 'Devam'); return html`<${E.Badge} s=${c ? 'Çalışıyor' : 'Boş'} t=${c ? 'ok' : 'gray'} />`; } },
            { label: 'Operatör', v: (m) => { const c = E.list('jobcards').find((j) => j.machineId === m.id && j.status === 'Devam'); return c ? E.userName(c.userId) : '—'; } },
            { label: 'İş', v: (m) => { const c = E.list('jobcards').find((j) => j.machineId === m.id && j.status === 'Devam'); return c ? html`<${E.RecLink} type="workorder" id=${c.woId}>${E.nameOf('workorders', c.woId)}<//> · Op${c.seq}` : '—'; } },
            { label: 'Süre', v: (m) => { const c = E.list('jobcards').find((j) => j.machineId === m.id && j.status === 'Devam'); return c ? E.fmtN((Date.now() - new Date(c.start)) / 3600000, 1) + ' s' : '—'; } }]} /><//>
        <${E.Card} title="Bu hafta terminli işler"><${E.Table} rows=${thisWeek.concat(late).sort((a, b) => a.l.due.localeCompare(b.l.due))} onRow=${(r) => E.openRec('order', r.o.id)} rowClass=${(r) => (r.l.due < today ? 'late' : '')}
          empty=${html`<div className="empty">Bu hafta termini olan açık iş yok.</div>`}
          cols=${[{ label: 'Sipariş', v: (r) => r.o.no, mono: true }, { label: 'Müşteri', v: (r) => E.nameOf('customers', r.o.customerId) }, { label: 'Parça', v: (r) => E.partLabel(r.l.partId, r.l.rev) },
            { label: 'Termin', v: (r) => E.fmtD(r.l.due) + (r.l.due < today ? ' · ' + E.daysBetween(r.l.due, today) + ' gün gecikti' : '') }, { label: 'Nerede', wrap: true, v: where }]} /><//>
      </div><div className="r">
        <${E.Card} title="Uyarılar"><div className="pad col" style=${{ gap: 10 }}>
          ${certs.map((x) => html`<div key=${x.s.id}><${E.Badge} s=${x.c.st} /> <${E.RecLink} type="supplier" id=${x.s.id}>${x.s.name}<//> · ${x.s.certName || 'sertifika'} ${E.fmtD(x.s.certExpiry)}</div>`)}
          ${quarantine.map((l) => html`<div key=${l.id}><${E.Badge} s="Karantina" /> <${E.RecLink} type="lot" id=${l.id}>${l.no}<//> gelen kontrol bekliyor</div>`)}
          ${ncrs.map((n) => html`<div key=${n.id}><${E.Badge} s="Açık" /> <${E.RecLink} type="ncr" id=${n.id}>${n.no}<//> karar bekliyor · ${n.qty} ad.</div>`)}
          ${!certs.length && !quarantine.length && !ncrs.length ? html`<div className="muted">Uyarı yok.</div>` : null}
        </div><//>
      </div></div>
    </div>`;
  }
  E.pages['genel/panel'] = Dashboard;

  E.pages['genel/geciken'] = () => {
    E.useStore();
    const today = E.today();
    const rows = openLines().filter((r) => r.l.due < E.addDays(today, 7));
    return html`<${E.ListPage} title="Geciken ve bu hafta terminli işler" crumb="Genel durum › Geciken işler" csv="Geciken_isler" rows=${rows} onRow=${(r) => E.openRec('order', r.o.id)} rowClass=${(r) => (r.l.due < today ? 'late' : '')}
      searchKeys=${(r) => r.o.no + ' ' + E.nameOf('customers', r.o.customerId) + ' ' + E.partLabel(r.l.partId, r.l.rev) + ' ' + (r.o.po || '')}
      empty=${html`<${E.Empty} title="Geciken iş yok" text="" />`}
      cols=${[{ label: 'Sipariş', mono: true, v: (r) => r.o.no }, { label: 'Müşteri', v: (r) => E.nameOf('customers', r.o.customerId) }, { label: 'PO', mono: true, v: (r) => r.o.po }, { label: 'Parça', v: (r) => E.partLabel(r.l.partId, r.l.rev) },
        { label: 'Adet', num: true, v: (r) => r.l.qty }, { label: 'Sevk edilen', num: true, v: (r) => r.s.shipped }, { label: 'Termin', v: (r) => E.fmtD(r.l.due) },
        { label: 'Gecikme', num: true, v: (r) => (r.l.due < today ? E.daysBetween(r.l.due, today) + ' gün' : '—') }, { label: 'Nerede', wrap: true, v: where },
        { label: 'Açık NCR', v: (r) => (r.s.wos.some((w) => E.openNcrs(w.id).length) ? html`<${E.Badge} s="Açık" />` : '—'), csv: (r) => (r.s.wos.some((w) => E.openNcrs(w.id).length) ? 'var' : '') }]} />`;
  };

  E.pages['genel/fason'] = () => {
    const D = E.useStore();
    const rows = Object.values(D.subcons).filter((s) => !s.closed && s.status !== 'İptal' && E.sumMoves(s, 'Giden') > E.sumMoves(s, 'Gelen'));
    const first = (s) => (s.moves || []).filter((m) => m.type === 'Giden').map((m) => m.date).sort()[0];
    return html`<${E.ListPage} title="Fasondaki parçalar" crumb="Genel durum › Fasondaki parçalar" csv="Fasondaki_parcalar" rows=${rows} onRow=${(s) => E.openRec('subcon', s.id)}
      rowClass=${(s) => (s.expectedReturn && s.expectedReturn < E.today() ? 'late' : '')} empty=${html`<${E.Empty} title="Fasonda parça yok" text="" />`}
      cols=${[{ label: 'Tedarikçi', v: (s) => E.nameOf('suppliers', s.supplierId) }, { label: 'Proses', v: (s) => E.nameOf('processes', s.processId) }, { label: 'İş emri', mono: true, v: (s) => E.nameOf('workorders', s.woId) },
        { label: 'Parça', v: (s) => { const w = E.get('workorders', s.woId); return w ? E.partLabel(w.partId, w.rev) : '—'; } }, { label: 'Giden', num: true, v: (s) => E.sumMoves(s, 'Giden') }, { label: 'Dönen', num: true, v: (s) => E.sumMoves(s, 'Gelen') },
        { label: 'İlk gönderim', v: (s) => E.fmtD(first(s)) }, { label: 'Dışarıda', num: true, v: (s) => E.daysBetween(first(s), E.today()) + ' gün' }, { label: 'Beklenen dönüş', v: (s) => E.fmtD(s.expectedReturn) }]} />`;
  };
})();
