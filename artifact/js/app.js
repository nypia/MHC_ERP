// App shell: login, module sidebar, fixed submenu, global search, routing.
(function () {
  const E = window.ERP;
  const { html, store } = E;
  const { useState } = React;

  const MENU = [
    { k: 'genel', l: 'Genel durum', area: 'genel', pages: [['panel', 'Gösterge paneli'], ['geciken', 'Geciken işler'], ['fason', 'Fasondaki parçalar']] },
    { k: 'satis', l: 'Satış', area: 'satis', pages: [['teklifler', 'Teklifler'], ['siparisler', 'Siparişler'], ['musteriler', 'Müşteriler']] },
    { k: 'uretim', l: 'Üretim', area: 'uretim', pages: [['is-emirleri', 'İş emirleri'], ['operator', 'Operatör ekranı'], ['rotalar', 'Rotalar'], ['tezgahlar', 'Tezgahlar']] },
    { k: 'satinalma', l: 'Satınalma ve fason', area: 'satinalma', pages: [['fason', 'Fason takibi'], ['lotlar', 'Malzeme lotları'], ['tedarikciler', 'Tedarikçiler']] },
    { k: 'kalite', l: 'Kalite', area: 'kalite', pages: [['gelen', 'Gelen kontrol'], ['final', 'Final muayene ve FAI'], ['ncr', 'NCR'], ['izlenebilirlik', 'İzlenebilirlik sorgusu']] },
    { k: 'sevkiyat', l: 'Sevkiyat', area: 'sevkiyat', pages: [['sevkiyatlar', 'Sevkiyatlar']] },
    { k: 'ana', l: 'Ana veriler', area: 'ana', pages: [['parcalar', 'Parçalar'], ['malzemeler', 'Malzemeler'], ['kullanicilar', 'Kullanıcılar ve roller', 'kullanici'], ['tanimlar', 'Tanımlar']] }
  ];
  const visible = () => MENU.filter((m) => E.canSee(m.area));
  const pagesOf = (m) => m.pages.filter((p) => !p[2] || E.canSee(p[2]));
  function home() { const m = visible()[0]; if (m) store.route = { mod: m.k, page: pagesOf(m)[0][0], rec: null }; }
  const operatorOnly = (u) => u && (u.roles || []).length > 0 && (u.roles || []).every((r) => r === 'operator');

  function Login() {
    const D = E.useStore();
    const [sel, setSel] = useState(null);
    const [pin, setPin] = useState('');
    const [err, setErr] = useState('');
    const [first, setFirst] = useState('');
    const users = Object.values(D.users).filter((u) => u.active !== false && !operatorOnly(u)).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    const u = sel ? D.users[sel] : null;
    const go = () => {
      if (!u) return;
      if (u.pin && pin !== String(u.pin)) { setErr('PIN hatalı'); setPin(''); return; }
      E.login(u.id); home(); E.emit();
    };
    const setup = async () => {
      if (!first.trim()) return;
      const r = await E.save('users', { name: first.trim(), roles: ['yonetici'], pin: '', active: true }, 'İlk kurulum: yönetici oluşturuldu');
      E.login(r.id); home(); E.emit();
    };
    if (!Object.keys(D.users).length) {
      return html`<div className="login"><div className="card"><h3 style=${{ margin: 0, padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>Atölye ERP · İlk kurulum</h3>
        <div className="pad col"><div>Sistemde henüz kullanıcı yok. Yönetici olarak adınızı yazın; diğer kullanıcıları ve rolleri sonra Ana veriler › Kullanıcılar'dan eklersiniz.</div>
        <${E.Field} label="Ad soyad"><${E.Inp} value=${first} onChange=${setFirst} /><//><${E.Btn} kind="p" disabled=${!first.trim()} onClick=${setup}>Yönetici olarak başla<//></div></div></div>`;
    }
    return html`<div className="login"><div className="card">
      <h3 style=${{ margin: 0, padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>Atölye ERP · Kim çalışıyor?</h3>
      <div className="pad col">
        <div className="ulist">${users.map((x) => html`<button type="button" key=${x.id} className=${'ubtn' + (x.id === sel ? ' on' : '')} onClick=${() => { setSel(x.id); setErr(''); setPin(''); }}>${x.name}<small>${(x.roles || []).map((r) => E.ROLES[r]).join(', ')}</small></button>`)}</div>
        ${u && u.pin ? html`<${E.Field} label="PIN"><input className="in" type="password" inputMode="numeric" autoFocus value=${pin} onChange=${(e) => setPin(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') go(); }} /><//>` : null}
        ${err ? html`<div className="alert bad">${err}</div>` : null}
        <div className="row"><${E.Btn} kind="p" disabled=${!u} onClick=${go}>Giriş<//><span className="grow"></span><${E.Btn} onClick=${() => { store.tablet = true; E.emit(); }}>Operatör (tablet) ekranı<//></div>
        <div className="muted" style=${{ fontSize: 12.5 }}>Seçim bu cihazda hatırlanır. Kayıtlardaki “kim değiştirdi” bilgisi buradaki kullanıcıdan gelir.</div>
      </div></div></div>`;
  }

  function Search() {
    const D = E.useStore();
    const [q, setQ] = useState('');
    const s = q.trim().toLocaleUpperCase('tr');
    const res = [];
    if (s.length >= 2) {
      const add = (type, r, label) => { if (res.length < 12) res.push({ type, id: r.id, label }); };
      const has = (v) => (v || '').toLocaleUpperCase('tr').includes(s);
      Object.values(D.quotes).forEach((r) => has(r.no) && add('quote', r, r.no + ' · teklif · ' + E.nameOf('customers', r.customerId)));
      Object.values(D.orders).forEach((r) => (has(r.no) || has(r.po)) && add('order', r, r.no + ' · sipariş · PO ' + (r.po || '—')));
      Object.values(D.workorders).forEach((r) => has(r.no) && add('workorder', r, r.no + ' · iş emri · ' + E.partLabel(r.partId, r.rev)));
      Object.values(D.lots).forEach((r) => (has(r.no) || has(r.heat)) && add('lot', r, r.no + ' · lot · şarj ' + r.heat));
      Object.values(D.subcons).forEach((r) => has(r.no) && add('subcon', r, r.no + ' · fason'));
      Object.values(D.ncrs).forEach((r) => has(r.no) && add('ncr', r, r.no + ' · NCR'));
      Object.values(D.shipments).forEach((r) => (has(r.no) || has(r.dispatchNo)) && add('shipment', r, r.no + ' · sevkiyat · irs. ' + (r.dispatchNo || '—')));
      Object.values(D.inspections).forEach((r) => has(r.no) && add('inspection', r, r.no + ' · ' + r.type + ' muayene'));
      Object.values(D.parts).forEach((r) => has(r.partNo) && add('part', r, r.partNo + ' · parça'));
      Object.values(D.customers).forEach((r) => has(r.name) && add('customer', r, r.name + ' · müşteri'));
    }
    return html`<div className="search">
      <input aria-label="Kayıt no, şarj no, PO veya parça ara" placeholder="No, şarj, PO, parça ara…" value=${q} onChange=${(e) => setQ(e.target.value)} />
      ${s.length >= 2 ? html`<div className="sres">${res.length ? res.map((r) => html`<button type="button" key=${r.type + r.id} onClick=${() => { setQ(''); E.openRec(r.type, r.id); }}>${r.label}</button>`) : html`<div className="pad muted">Sonuç yok</div>`}</div>` : null}
    </div>`;
  }

  function Shell() {
    E.useStore();
    const u = E.currentUser();
    const mods = visible();
    let r = store.route;
    if (!mods.find((m) => m.k === r.mod)) { home(); r = store.route; }
    const mod = mods.find((m) => m.k === r.mod);
    if (!mod) return html`<div className="login"><div className="card pad col">Bu kullanıcıya rol atanmamış. Yöneticiden rol isteyin.<${E.Btn} onClick=${E.logout}>Çıkış<//></div></div>`;
    const Page = E.pages[r.mod + '/' + r.page];
    const Det = r.rec ? E.details[r.rec.type] : null;
    return html`<div className="shell">
      <nav className="side" aria-label="Modüller">
        <div className="brand">ATÖLYE ERP<small>Tekliften sevkiyata</small></div>
        ${mods.map((m) => html`<button type="button" key=${m.k} className=${'nav' + (m.k === r.mod ? ' on' : '')} onClick=${() => E.nav(m.k, pagesOf(m)[0][0])}>${E.ICONS[m.k]}${m.l}</button>`)}
        <div className="who"><b>${u.name}</b>${(u.roles || []).map((x) => E.ROLES[x]).join(', ')}<br /><button type="button" onClick=${E.logout}>Kullanıcı değiştir</button></div>
      </nav>
      <div className="main">
        ${store.mode === 'local' ? html`<div className="banner">Bu görünümde kalıcı veri deposuna bağlanılamadı. Yaptığınız değişiklikler sayfa kapanınca kaybolur.</div>` : null}
        <header className="top">
          ${pagesOf(mod).map(([k, l]) => html`<button type="button" key=${k} className=${'t' + (k === r.page && !r.rec ? ' on' : '')} onClick=${() => E.nav(mod.k, k)}>${l}</button>`)}
          <${Search} />
        </header>
        <main className="page">
          ${Det ? html`<${Det} key=${r.rec.type + r.rec.id} id=${r.rec.id} />` : Page ? html`<${Page} key=${r.mod + r.page} />` : html`<${E.Empty} title="Sayfa bulunamadı" text="" />`}
        </main>
      </div>
    </div>`;
  }

  function App() {
    E.useStore();
    let body;
    if (store.mode === 'loading' || !E.allReady()) body = html`<div className="login"><div className="card pad">Veriler yükleniyor…</div></div>`;
    else if (store.tablet) body = html`<${E.OperatorApp} onExit=${() => { store.tablet = false; E.emit(); }} />`;
    else if (!E.currentUser()) body = html`<${Login} />`;
    else if (operatorOnly(E.currentUser())) body = html`<${E.OperatorApp} onExit=${E.logout} />`;
    else body = html`<${Shell} />`;
    return html`${body}<${E.ModalHost} /><${E.Dialogs} /><${E.Toasts} />`;
  }

  ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
  E.initStore();
  setTimeout(() => { if (!E.allReady()) { E.COLS.forEach((c) => { store.ready[c] = true; }); E.emit(); } }, 12000);
})();
