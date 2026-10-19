// Operator tablet screen: PIN login, start/finish job cards, good/scrap entry, scrap → draft NCR.
(function () {
  const E = window.ERP;
  const { html, store } = E;
  const { useState, useEffect, useRef } = React;
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* blocked */ } } };

  function jobsFor(machineId) {
    const out = [];
    E.list('workorders').forEach((w) => {
      if (['Taslak', 'İptal', 'Kapandı'].includes(w.status)) return;
      E.opProgress(w).forEach((o) => {
        if (o.type === 'Fason' || o.st === 'Bitti') return;
        if (machineId && o.machineId && o.machineId !== machineId) return;
        const free = o.input - o.good - o.scrap;
        if (free <= 0) return;
        out.push({ w, o, free });
      });
    });
    return out.sort((a, b) => (a.w.due || '').localeCompare(b.w.due || ''));
  }

  function OperatorApp({ onExit }) {
    const D = E.useStore();
    const [step, setStep] = useState('login');
    const [uid, setUid] = useState(null);
    const [pin, setPin] = useState('');
    const [msg, setMsg] = useState('');
    const [mach, setMach] = useState(ls.get('erp.machine') || '');
    const [cardId, setCardId] = useState(null);
    const [field, setField] = useState('good');
    const [vals, setVals] = useState({ good: '', scrap: '' });
    const [reason, setReason] = useState('');
    const [done, setDone] = useState(null);
    const [, tick] = useState(0);
    const idle = useRef(Date.now());
    const ops = E.list('users').filter((u) => u.active !== false && (u.roles || []).includes('operator')).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    const reset = () => { setStep('login'); setUid(null); setPin(''); setMsg(''); setCardId(null); setVals({ good: '', scrap: '' }); setReason(''); setField('good'); };
    useEffect(() => {
      const t = setInterval(() => {
        tick((x) => x + 1);
        if (step !== 'login' && step !== 'run' && Date.now() - idle.current > 60000) reset();
        if (step === 'login' && pin && Date.now() - idle.current > 60000) { setPin(''); setUid(null); }
      }, 1000);
      return () => clearInterval(t);
    }, [step, pin]);
    const user = uid ? D.users[uid] : null;
    const card = cardId ? D.jobcards[cardId] : null;
    const w = card ? D.workorders[card.woId] : null;
    const op = w ? E.opProgress(w).find((o) => o.seq === card.seq) : null;
    const pinPress = (k) => {
      if (k === '⌫') { setPin(pin.slice(0, -1)); setMsg(''); return; }
      if (k === '✓') {
        if (!user) { setMsg('Önce adınızı seçin'); return; }
        if (!user.pin) { setMsg('Bu kullanıcıya PIN tanımlanmamış. Yöneticiye başvurun.'); return; }
        if (pin !== String(user.pin)) { setMsg('PIN hatalı'); setPin(''); return; }
        setPin(''); setMsg('');
        const act = E.list('jobcards').find((c) => c.userId === user.id && c.status === 'Devam');
        if (act) { setCardId(act.id); setStep('run'); } else setStep('list');
        return;
      }
      if (pin.length < 4) setPin(pin + k);
    };
    const start = async (j) => {
      const m = mach || j.o.machineId;
      if (!m) { E.toast('Bu operasyona tezgah atanmamış; giriş ekranında tabletin tezgahını seçin', 'err'); return; }
      const c = await E.save('jobcards', { no: E.nextNo('jobcards', 'IK'), woId: j.w.id, seq: j.o.seq, userId: user.id, machineId: m, start: E.now(), status: 'Devam', good: 0, scrap: 0 }, 'Başlatıldı');
      await E.save('workorders', j.w, 'İş kartı ' + c.no + ' başlatıldı · Op' + j.o.seq + ' · ' + E.machineName(m) + ' · ' + user.name);
      setCardId(c.id); setStep('run');
    };
    const good = E.num(vals.good), scrap = E.num(vals.scrap);
    const remain = op ? op.input - op.good - op.scrap : 0;
    const over = good + scrap > remain;
    const canSave = good + scrap > 0 && !over && (scrap === 0 || !!reason);
    const numPress = (k) => {
      const cur = vals[field] || '';
      if (k === 'C') setVals(Object.assign({}, vals, { [field]: '' }));
      else if (k === '⌫') setVals(Object.assign({}, vals, { [field]: cur.slice(0, -1) }));
      else if (cur.length < 4) setVals(Object.assign({}, vals, { [field]: cur + k }));
    };
    const finish = async () => {
      if (!canSave) return;
      const c = await E.save('jobcards', Object.assign({}, card, { end: E.now(), good, scrap, reason: scrap ? reason : '', status: 'Bitti' }), 'Bitti · ' + good + ' sağlam, ' + scrap + ' hurda');
      let ncr = null;
      if (scrap > 0) ncr = await E.save('ncrs', { no: E.nextNo('ncrs', 'NCR'), woId: w.id, seq: card.seq, qty: scrap, desc: 'Operatör hurda girişi: ' + reason + ' (' + c.no + ')', cause: '', decision: '', status: 'Açık', source: 'Operatör', cardId: c.id, date: E.today() }, 'Operatör hurda girişinden otomatik açıldı');
      await E.save('workorders', w, 'İş kartı ' + c.no + ' bitti · Op' + card.seq + ' · ' + good + ' sağlam, ' + scrap + ' hurda' + (ncr ? ' · ' + ncr.no + ' açıldı' : ''));
      setDone({ c, ncr }); setStep('done');
    };
    const elapsed = () => { if (!card) return '00:00:00'; const s = Math.max(0, Math.floor((Date.now() - new Date(card.start)) / 1000)); return E.pad(Math.floor(s / 3600)) + ':' + E.pad(Math.floor(s / 60) % 60) + ':' + E.pad(s % 60); };
    const drawing = w ? E.docsFor('parts/' + w.partId + '/' + w.rev, 'Çizim')[0] : null;
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const mine = user ? E.list('jobcards').filter((c) => c.userId === user.id && (c.start || '').slice(0, 10) === E.today()).sort((a, b) => (b.start || '').localeCompare(a.start || '')) : [];
    const jobs = step === 'list' ? jobsFor(mach) : [];

    return html`<div className="op" onPointerDown=${() => { idle.current = Date.now(); }}>
      <div className="bar">
        <b>ATÖLYE ERP · OPERATÖR</b>
        <span className="mach">${mach ? E.machineName(mach) : 'Tezgah seçilmedi'}</span>
        <span className="grow"></span>
        ${user && step !== 'login' ? html`<span>${user.name}</span><button type="button" onClick=${reset}>Çıkış</button>` : null}
        ${onExit && step === 'login' ? html`<button type="button" onClick=${onExit}>Ofis ekranına dön</button>` : null}
      </div>
      <div className="body">
      ${step === 'login' ? html`<div className="split">
        <div className="l card pad col">
          <div className="big">Adınızı seçin</div>
          ${ops.length ? html`<div className="names">${ops.map((u) => html`<button type="button" key=${u.id} className=${'nm' + (u.id === uid ? ' on' : '')} onClick=${() => { setUid(u.id); setMsg(''); setPin(''); }}>${u.name}</button>`)}</div>`
            : html`<div className="muted">Operatör rolünde kullanıcı yok. Ana veriler › Kullanıcılar'dan ekleyin.</div>`}
          <label className="fld" style=${{ maxWidth: 320 }}><span>Bu tablet hangi tezgahta?</span>
            <${E.Sel} value=${mach} options=${E.machOpts()} empty="Tüm tezgahlar" onChange=${(v) => { setMach(v); ls.set('erp.machine', v); }} /></label>
        </div>
        <div className="r card pad col" style=${{ alignItems: 'center' }}>
          <div className="big">PIN</div>
          <div className="dots">${[0, 1, 2, 3].map((i) => html`<span key=${i} className=${'dot' + (i < pin.length ? ' on' : '')}></span>`)}</div>
          <div className="keys">${keys.concat(['⌫', '0', '✓']).map((k) => html`<button type="button" key=${k} aria-label=${k === '⌫' ? 'Sil' : k === '✓' ? 'Giriş' : k} className=${'k' + (k === '✓' ? ' go' : '')} onClick=${() => pinPress(k)}>${k}</button>`)}</div>
          <div style=${{ minHeight: 22, color: 'var(--bad)', fontSize: 16 }}>${msg}</div>
        </div>
      </div>` : null}

      ${step === 'list' ? html`<div className="col" style=${{ gap: 16 }}>
        <div className="big">Sıradaki işler · ${mach ? E.machineName(mach) : 'tüm tezgahlar'}</div>
        ${jobs.length ? jobs.map((j) => html`<div key=${j.w.id + j.o.seq} className="card job">
          <div className="grow col" style=${{ gap: 6 }}>
            <div style=${{ fontSize: 23, fontWeight: 700 }}><span className="mono">${j.w.no}</span> · Op${j.o.seq} ${j.o.name}</div>
            <div style=${{ fontSize: 18 }}>${E.partLabel(j.w.partId, j.w.rev)} · ${j.w.qty} adet · termin ${E.fmtD(j.w.due)}${j.o.machineId ? ' · ' + E.machineName(j.o.machineId) : ''}</div>
            <div className="muted" style=${{ fontSize: 16 }}>Bu operasyona gelen ${j.o.input} · yapılan ${j.o.good} sağlam, ${j.o.scrap} hurda · kalan ${j.free}${j.o.active ? ' · başka kart açık' : ''}</div>
          </div>
          <button type="button" className="start" onClick=${() => start(j)}>▶ BAŞLAT</button>
        </div>`) : html`<div className="card pad" style=${{ fontSize: 18 }}>Bu tezgah için bekleyen iş yok. İş emri serbest bırakılmış ve önceki operasyondan parça gelmiş olmalı.</div>`}
        <div className="muted" style=${{ fontSize: 16 }}>Bugünkü kartlarım: ${mine.length ? mine.map((c) => E.nameOf('workorders', c.woId) + ' Op' + c.seq + ' · ' + (c.status === 'Devam' ? 'devam' : (c.good || 0) + ' sağlam')).join(' | ') : 'yok'}</div>
      </div>` : null}

      ${step === 'run' && card && w ? html`<div className="split">
        <div className="l card pad col" style=${{ alignItems: 'center', justifyContent: 'center', minHeight: 360, textAlign: 'center' }}>
          <div style=${{ fontSize: 24, fontWeight: 700 }}><span className="mono">${w.no}</span> · Op${card.seq} ${op ? op.name : ''}</div>
          <div style=${{ fontSize: 18 }}>${E.partLabel(w.partId, w.rev)} · bu operasyonda kalan ${remain}</div>
          <div className="timer">${elapsed()}</div>
          <div className="muted" style=${{ fontSize: 16 }}>Başlangıç ${E.fmtDT(card.start)} · ${card.no} · ${E.machineName(card.machineId)}</div>
          ${op && op.note ? html`<div className="alert info" style=${{ fontSize: 16 }}>Talimat: ${op.note}</div>` : null}
        </div>
        <div className="r col" style=${{ gap: 18, justifyContent: 'center' }}>
          ${drawing ? html`<a className="sec" style=${{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: 'inherit' }} href=${E.blobUrl(drawing.assetId)} target="_blank" rel="noopener">ÇİZİMİ AÇ (v${drawing.version})</a>` : html`<div className="muted" style=${{ fontSize: 16, textAlign: 'center' }}>Bu revizyona çizim yüklenmemiş</div>`}
          <button type="button" className="stop" onClick=${() => { setVals({ good: '', scrap: '' }); setReason(''); setField('good'); setStep('finish'); }}>■ BİTİR</button>
        </div>
      </div>` : null}

      ${step === 'finish' && card && w ? html`<div className="split">
        <div className="l card pad col">
          <div style=${{ fontSize: 21, fontWeight: 600 }}><span className="mono">${w.no}</span> · Op${card.seq} · kalan ${remain}</div>
          <button type="button" className=${'fld2' + (field === 'good' ? ' on' : '')} onClick=${() => setField('good')}><span>Sağlam</span><b>${vals.good || '0'}</b></button>
          <button type="button" className=${'fld2' + (field === 'scrap' ? ' on' : '')} onClick=${() => setField('scrap')}><span>Hurda</span><b style=${{ color: 'var(--warn)' }}>${vals.scrap || '0'}</b></button>
          ${scrap > 0 ? html`<div style=${{ fontSize: 18, fontWeight: 600 }}>Hurda sebebi</div>
            <div className="row">${(E.settings().scrapReasons || []).map((r) => html`<button type="button" key=${r} className=${'rs' + (r === reason ? ' on' : '')} onClick=${() => setReason(r)}>${r}</button>`)}</div>` : null}
          <div style=${{ fontSize: 17, color: 'var(--bad)', minHeight: 24 }}>${over ? 'Toplam ' + (good + scrap) + ' adet, kalan ' + remain + ' adedi geçemez' : scrap > 0 && !reason ? 'Hurda sebebini seçin' : ''}</div>
        </div>
        <div className="r col" style=${{ gap: 14 }}>
          <div className="keys">${keys.concat(['C', '0', '⌫']).map((k) => html`<button type="button" key=${k} aria-label=${k === '⌫' ? 'Sil' : k === 'C' ? 'Temizle' : k} className="k" onClick=${() => numPress(k)}>${k}</button>`)}</div>
          <button type="button" className="save" disabled=${!canSave} onClick=${finish}>✓ KAYDET</button>
          <button type="button" className="btn" style=${{ minHeight: 52 }} onClick=${() => setStep('run')}>Geri dön</button>
        </div>
      </div>` : null}

      ${step === 'done' && done ? html`<div className="card pad col" style=${{ alignItems: 'center', textAlign: 'center', gap: 16, padding: 40 }}>
        <div style=${{ fontSize: 30, fontWeight: 700 }}>✓ İş kartı kaydedildi</div>
        <div style=${{ fontSize: 20 }}><span className="mono">${done.c.no}</span> · ${done.c.good} sağlam · ${done.c.scrap} hurda</div>
        ${done.ncr ? html`<div className="alert warn" style=${{ fontSize: 18 }}>${done.ncr.no} taslak olarak açıldı ve kaliteye düştü.</div>` : null}
        <button type="button" className="start" onClick=${reset}>TAMAM</button>
      </div>` : null}
      </div>
    </div>`;
  }
  E.OperatorApp = OperatorApp;

  // Office view of the operator module: who is working on what now, and today's cards.
  function OperatorPage() {
    const D = E.useStore();
    const active = Object.values(D.jobcards).filter((c) => c.status === 'Devam');
    const todays = Object.values(D.jobcards).filter((c) => (c.start || '').slice(0, 10) === E.today()).sort((a, b) => (b.start || '').localeCompare(a.start || ''));
    return html`<div className="col" style=${{ gap: 16 }}>
      <${E.Head} crumb="Üretim › Operatör ekranı" title="Operatör ekranı" actions=${E.canSee('operator') ? html`<${E.Btn} kind="p" onClick=${() => { store.tablet = true; E.emit(); }}>Tablet modunu aç<//>` : null} />
      <div className="alert info">Tablet modu tezgah başındaki ortak tablet içindir: operatör adına dokunur, PIN girer, işi başlatır ve bitirir. Operatör rolündeki kullanıcılar giriş yaptığında doğrudan bu ekran açılır.</div>
      <${E.Card} title=${'Şu an çalışanlar (' + active.length + ')'}><${E.Table} rows=${active} empty=${html`<div className="empty">Açık iş kartı yok.</div>`}
        cols=${[{ label: 'Tezgah', v: (c) => E.machineName(c.machineId) }, { label: 'Operatör', v: (c) => E.userName(c.userId) }, { label: 'İş emri', v: (c) => html`<${E.RecLink} type="workorder" id=${c.woId}>${E.nameOf('workorders', c.woId)}<//>` },
          { label: 'Op', k: 'seq' }, { label: 'Başlangıç', v: (c) => E.fmtDT(c.start) }, { label: 'Süre', v: (c) => E.fmtN((Date.now() - new Date(c.start)) / 3600000, 1) + ' s' }]} /><//>
      <${E.Card} title="Bugünkü iş kartları"><${E.Table} rows=${todays} empty=${html`<div className="empty">Bugün iş kartı yok.</div>`}
        cols=${[{ k: 'no', label: 'Kart', mono: true }, { label: 'Operatör', v: (c) => E.userName(c.userId) }, { label: 'Tezgah', v: (c) => E.machineName(c.machineId) }, { label: 'İş emri', v: (c) => html`<${E.RecLink} type="workorder" id=${c.woId}>${E.nameOf('workorders', c.woId)}<//>` },
          { label: 'Op', k: 'seq' }, { label: 'Başlangıç', v: (c) => E.fmtDT(c.start) }, { label: 'Bitiş', v: (c) => (c.end ? E.fmtDT(c.end) : html`<${E.Badge} s="Devam" />`) }, { label: 'Sağlam', num: true, v: (c) => c.good || 0 }, { label: 'Hurda', num: true, v: (c) => c.scrap || 0 }]} /><//>
    </div>`;
  }
  E.pages['uretim/operator'] = OperatorPage;
})();
