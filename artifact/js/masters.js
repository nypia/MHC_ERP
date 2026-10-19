// Master data: customers, suppliers, materials, machines, processes, users, settings, parts + revisions, routings.
(function () {
  const E = window.ERP;
  const { html } = E;
  const { useState } = React;

  const procOpts = () => E.list('processes').map((p) => ({ v: p.id, l: p.name }));
  const custOpts = () => E.list('customers').filter((c) => c.active !== false).map((c) => ({ v: c.id, l: c.name }));
  const matOpts = () => E.list('materials').filter((m) => m.active !== false).map((m) => ({ v: m.id, l: m.name }));
  const machOpts = () => E.list('machines').filter((m) => m.active !== false).sort((a, b) => a.code.localeCompare(b.code)).map((m) => ({ v: m.id, l: m.code + ' · ' + (m.name || m.type || '') }));
  const supOpts = (pid) => E.list('suppliers').filter((s) => s.active !== false && (!pid || (s.procs || []).includes(pid))).map((s) => ({ v: s.id, l: s.name }));
  Object.assign(E, { procOpts, custOpts, matOpts, machOpts, supOpts });

  // ---------- customers ----------
  const custFields = [
    { k: 'name', label: 'Unvan', req: true }, { k: 'taxNo', label: 'Vergi no' }, { k: 'taxOffice', label: 'Vergi dairesi' },
    { k: 'currency', label: 'Varsayılan para birimi', type: 'select', options: ['TL', 'EUR', 'USD'] },
    { k: 'contact', label: 'İlgili kişi' }, { k: 'phone', label: 'Telefon' }, { k: 'email', label: 'E-posta' },
    { k: 'faiReq', label: 'FAI şartı', type: 'check', text: 'Yeni parça revizyonunda FAI istenir' },
    { k: 'cocReq', label: 'CoC şartı', type: 'check', text: 'Sevkiyatta uygunluk sertifikası istenir' },
    { k: 'address', label: 'Adres', type: 'textarea' }, { k: 'qualityNotes', label: 'Kalite notları', type: 'textarea' }
  ];
  E.pages['satis/musteriler'] = () => html`<${E.CrudPage} col="customers" type="customer" title="Müşteriler" crumb="Satış › Müşteriler" area="satis" newLabel="+ Yeni müşteri"
    fields=${custFields} defaults=${{ currency: 'TL' }}
    cols=${[{ k: 'name', label: 'Unvan' }, { k: 'taxNo', label: 'Vergi no' }, { k: 'currency', label: 'Para birimi' },
      { label: 'Kalite şartı', v: (r) => [r.faiReq ? 'FAI' : '', r.cocReq ? 'CoC' : ''].filter(Boolean).join(' · ') || '—', csv: (r) => [r.faiReq ? 'FAI' : '', r.cocReq ? 'CoC' : ''].join(' ') },
      { k: 'contact', label: 'İlgili kişi' }, { k: 'phone', label: 'Telefon' }]} />`;
  E.details.customer = ({ id }) => html`<${E.CrudDetail} col="customers" id=${id} fields=${custFields} area="satis" crumb="Müşteriler" title=${(r) => r.name} docKinds=${['Kalite şartnamesi', 'Sözleşme', 'Diğer']}
    extra=${(r) => html`<${E.Card} title="Parçalar"><${E.Table} cols=${[{ label: 'Parça no', v: (p) => html`<${E.RecLink} type="part" id=${p.id}>${p.partNo}<//>` }, { k: 'desc', label: 'Tanım' }, { label: 'Aktif rev', v: (p) => (p.revs || []).filter((x) => x.status !== 'Eski').map((x) => x.rev).join(', ') }]}
      rows=${E.list('parts').filter((p) => p.customerId === r.id)} empty=${html`<div className="empty">Bu müşteriye ait parça yok.</div>`} /><//>`} />`;

  // ---------- suppliers ----------
  const supFields = [
    { k: 'name', label: 'Unvan', req: true }, { k: 'taxNo', label: 'Vergi no' },
    { k: 'type', label: 'Tür', type: 'select', req: true, options: ['Malzeme', 'Fason', 'Malzeme ve fason'] },
    { k: 'certName', label: 'Sertifika (ör. NADCAP, AS9100)' }, { k: 'certNo', label: 'Sertifika no' }, { k: 'certExpiry', label: 'Sertifika geçerlilik', type: 'date' },
    { k: 'contact', label: 'İlgili kişi' }, { k: 'phone', label: 'Telefon' }, { k: 'email', label: 'E-posta' },
    { k: 'procs', label: 'Onaylı prosesler', type: 'multi', options: procOpts }
  ];
  const certBadge = (s) => { const c = E.certState(s); return c ? html`<${E.Badge} s=${c.st} /> <span className="muted">${E.fmtD(s.certExpiry)}</span>` : '—'; };
  E.pages['satinalma/tedarikciler'] = () => html`<${E.CrudPage} col="suppliers" type="supplier" title="Tedarikçiler" crumb="Satınalma ve fason › Tedarikçiler" area="satinalma" newLabel="+ Yeni tedarikçi"
    fields=${supFields} defaults=${{ procs: [] }}
    cols=${[{ k: 'name', label: 'Unvan' }, { k: 'type', label: 'Tür' }, { label: 'Onaylı prosesler', wrap: true, v: (r) => (r.procs || []).map((p) => E.nameOf('processes', p)).join(', ') || '—' },
      { label: 'Sertifika', v: (r) => (r.certName ? r.certName + ' ' : ''), csv: (r) => r.certName }, { label: 'Geçerlilik', v: certBadge, csv: (r) => r.certExpiry }]} />`;
  function PriceCard({ s }) {
    const [p, setP] = useState(null);
    const can = E.canEdit('satinalma');
    const procs = s.procs || [];
    if (!procs.length) return null;
    const cur = p || Object.assign({}, s.prices || {});
    return html`<${E.Card} title="Proses birim fiyatları (TL/adet)" act=${can && p ? html`<${E.Btn} sm kind="p" onClick=${async () => { await E.save('suppliers', Object.assign({}, s, { prices: p }), 'Proses fiyatları güncellendi'); setP(null); E.toast('Kaydedildi'); }}>Kaydet<//>` : null}>
      <div className="pad form">${procs.map((pid) => html`<${E.Field} key=${pid} label=${E.nameOf('processes', pid)}>
        <${E.Inp} value=${cur[pid] == null ? '' : cur[pid]} disabled=${!can} inputMode="decimal" onChange=${(v) => setP(Object.assign({}, cur, { [pid]: v }))} /><//>`)}</div>
      <div className="pad muted" style=${{ paddingTop: 0, fontSize: 12.5 }}>Tekliflerde fason maliyeti bu fiyatlardan gelir.</div><//>`;
  }
  E.details.supplier = ({ id }) => html`<${E.CrudDetail} col="suppliers" id=${id} fields=${supFields} area="satinalma" crumb="Tedarikçiler" title=${(r) => r.name}
    docKinds=${['Tedarikçi sertifikası', 'Onay belgesi', 'Diğer']} view=${{ certExpiry: certBadge }}
    extra=${(r) => html`<${PriceCard} s=${r} />`} />`;

  // ---------- materials ----------
  const matFields = [
    { k: 'name', label: 'Kısa ad', req: true, ph: '7075-T6 Ø40 çubuk' }, { k: 'spec', label: 'Spesifikasyon', ph: 'AMS 4123' },
    { k: 'alloy', label: 'Alaşım / temper', req: true, ph: '7075-T6' },
    { k: 'form', label: 'Form', type: 'select', req: true, options: ['Yuvarlak çubuk', 'Altıgen çubuk', 'Plaka', 'Boru'] },
    { k: 'size', label: 'Ölçü', ph: 'Ø40' }, { k: 'density', label: 'Yoğunluk (g/cm³)', type: 'number', req: true, ph: '2,81' },
    { k: 'kgPrice', label: 'Güncel kg fiyatı (TL)', type: 'number', req: true }
  ];
  E.pages['ana/malzemeler'] = () => html`<${E.CrudPage} col="materials" type="material" title="Malzemeler" crumb="Ana veriler › Malzemeler" area="ana" newLabel="+ Yeni malzeme" fields=${matFields}
    cols=${[{ k: 'name', label: 'Ad' }, { k: 'spec', label: 'Spesifikasyon' }, { k: 'form', label: 'Form' }, { k: 'density', label: 'Yoğunluk', num: true }, { label: 'Kg fiyatı (TL)', num: true, v: (r) => E.fmtN(E.num(r.kgPrice)), csv: (r) => r.kgPrice },
      { label: 'Stok (kabul)', num: true, v: (r) => E.fmtN(E.list('lots').filter((l) => l.materialId === r.id && l.status === 'Kabul').reduce((s, l) => s + E.lotRemaining(l), 0), 1), csv: false }]} />`;
  E.details.material = ({ id }) => html`<${E.CrudDetail} col="materials" id=${id} fields=${matFields} area="ana" crumb="Malzemeler" title=${(r) => r.name}
    extra=${(r) => html`<${E.Card} title="Lotlar"><${E.Table} cols=${[{ label: 'Lot', v: (l) => html`<${E.RecLink} type="lot" id=${l.id}>${l.no}<//>` }, { k: 'heat', label: 'Şarj no', mono: true },
      { label: 'Kalan', num: true, v: (l) => E.fmtN(E.lotRemaining(l), 1) + ' ' + (l.unit || '') }, { label: 'Durum', v: (l) => html`<${E.Badge} s=${E.lotStatus(l)} />` }]}
      rows=${E.list('lots').filter((l) => l.materialId === r.id)} empty=${html`<div className="empty">Lot yok.</div>`} /><//>`} />`;

  // ---------- machines ----------
  const machFields = [
    { k: 'code', label: 'Kod', req: true, ph: 'CNC-01' }, { k: 'name', label: 'Ad', ph: 'Doosan Lynx 220' },
    { k: 'type', label: 'Tip', type: 'select', options: ['CNC torna', '3 eksen freze', '5 eksen freze', 'Taşlama', 'Erozyon', 'Testere', 'Diğer'] },
    { k: 'rate', label: 'Saat ücreti (TL)', type: 'number', req: true }
  ];
  E.pages['uretim/tezgahlar'] = () => html`<${E.CrudPage} col="machines" type="machine" title="Tezgahlar" crumb="Üretim › Tezgahlar" area="uretim" newLabel="+ Yeni tezgah" fields=${machFields}
    sort=${(a, b) => String(a.code).localeCompare(String(b.code))}
    cols=${[{ k: 'code', label: 'Kod', mono: true }, { k: 'name', label: 'Ad' }, { k: 'type', label: 'Tip' }, { label: 'Saat ücreti (TL)', num: true, v: (r) => E.fmtN(E.num(r.rate)), csv: (r) => r.rate },
      { label: 'Şu an', v: (r) => { const c = E.list('jobcards').find((j) => j.machineId === r.id && j.status === 'Devam'); return c ? html`<${E.Badge} s="Devam" /> ${E.userName(c.userId)}` : html`<${E.Badge} s="Boş" />`; }, csv: false }]} />`;
  E.details.machine = ({ id }) => html`<${E.CrudDetail} col="machines" id=${id} fields=${machFields} area="uretim" crumb="Tezgahlar" title=${(r) => r.code + (r.name ? ' · ' + r.name : '')}
    extra=${(r) => html`<${E.Card} title="Son iş kartları"><${E.Table} cols=${[{ k: 'no', label: 'Kart', mono: true }, { label: 'İş emri', v: (c) => html`<${E.RecLink} type="workorder" id=${c.woId}>${E.nameOf('workorders', c.woId)}<//>` },
      { label: 'Op', v: (c) => c.seq }, { label: 'Operatör', v: (c) => E.userName(c.userId) }, { label: 'Başlangıç', v: (c) => E.fmtDT(c.start) }, { label: 'Sağlam', num: true, k: 'good' }, { label: 'Hurda', num: true, k: 'scrap' }]}
      rows=${E.list('jobcards').filter((c) => c.machineId === r.id).sort((a, b) => (b.start || '').localeCompare(a.start || '')).slice(0, 20)} empty=${html`<div className="empty">Henüz iş kartı yok.</div>`} /><//>`} />`;

  // ---------- users ----------
  const userFields = [
    { k: 'name', label: 'Ad soyad', req: true }, { k: 'roles', label: 'Roller', type: 'multi', req: true, options: Object.keys(E.ROLES).map((k) => ({ v: k, l: E.ROLES[k] })) },
    { k: 'pin', label: 'PIN (4 hane, operatörler için zorunlu)', ph: '1234' }, { k: 'machineId', label: 'Varsayılan tezgah', type: 'select', options: machOpts }
  ];
  E.pages['ana/kullanicilar'] = () => html`<${E.CrudPage} col="users" type="user" title="Kullanıcılar ve roller" crumb="Ana veriler › Kullanıcılar ve roller" area="kullanici" newLabel="+ Yeni kullanıcı" fields=${userFields} defaults=${{ roles: [] }}
    cols=${[{ k: 'name', label: 'Ad soyad' }, { label: 'Roller', v: (r) => (r.roles || []).map((x) => E.ROLES[x]).join(', ') }, { label: 'PIN', v: (r) => (r.pin ? '••••' : '—'), csv: false }, { label: 'Tezgah', v: (r) => (r.machineId ? E.machineName(r.machineId) : '—') }]} />`;
  E.details.user = ({ id }) => html`<${E.CrudDetail} col="users" id=${id} fields=${userFields} area="kullanici" crumb="Kullanıcılar" title=${(r) => r.name}
    view=${{ roles: (r) => (r.roles || []).map((x) => E.ROLES[x]).join(', '), machineId: (r) => (r.machineId ? E.machineName(r.machineId) : '—') }} />`;

  // ---------- definitions ----------
  function Defs() {
    const D = E.useStore();
    const can = E.canEdit('ana');
    const st = E.settings();
    const [form, setForm] = useState(null);
    const [pform, setPform] = useState(null);
    const sample = E.COLS.reduce((n, c) => n + Object.values(D[c]).filter((r) => r.sample).length, 0);
    const f = form || { company: st.companyName || '', addr: st.companyAddr || '', reasons: (st.scrapReasons || []).join('\n'), eur: st.rates && st.rates.EUR ? String(st.rates.EUR).replace('.', ',') : '', usd: st.rates && st.rates.USD ? String(st.rates.USD).replace('.', ',') : '' };
    const saveSet = async () => {
      await E.save('settings', Object.assign({}, st, { id: 'main', companyName: f.company, companyAddr: f.addr, scrapReasons: f.reasons.split('\n').map((x) => x.trim()).filter(Boolean), rates: { EUR: E.num(f.eur), USD: E.num(f.usd) } }), 'Tanımlar güncellendi');
      setForm(null); E.toast('Kaydedildi');
    };
    const wipe = () => E.ask({ title: 'Örnek veriler silinsin mi?', body: sample + ' örnek kayıt kalıcı olarak silinir. Sizin girdiğiniz kayıtlar silinmez.', danger: true, ok: 'Örnekleri sil',
      onOk: async () => { for (const c of E.COLS) for (const r of Object.values(D[c]).filter((x) => x.sample)) await E.remove(c, r.id); E.toast('Örnek veriler silindi'); } });
    return html`<div className="col" style=${{ gap: 16 }}>
      <${E.Head} crumb="Ana veriler › Tanımlar" title="Tanımlar" />
      <div className="split"><div className="l">
        <${E.Card} title="Fason prosesleri" act=${can ? html`<${E.Btn} sm kind="p" onClick=${() => setPform({ kind: 'Kaplama' })}>+ Proses<//>` : null}>
          <${E.Table} cols=${[{ k: 'name', label: 'Proses' }, { k: 'kind', label: 'Tür' }, { label: 'Onaylı tedarikçi', v: (p) => E.list('suppliers').filter((s) => (s.procs || []).includes(p.id)).map((s) => s.name).join(', ') || '—' }]}
            rows=${E.list('processes').sort((a, b) => a.name.localeCompare(b.name, 'tr'))} onRow=${can ? (p) => setPform(Object.assign({}, p)) : null} />
        <//>
        <${E.Card} title="Firma bilgisi, hurda sebepleri ve kurlar" act=${can && form ? html`<${E.Btn} sm onClick=${() => setForm(null)}>Vazgeç<//><${E.Btn} sm kind="p" onClick=${saveSet}>Kaydet<//>` : null}>
          <div className="pad form">
            <${E.Field} label="Firma adı (belgelerde görünür)"><${E.Inp} value=${f.company} disabled=${!can} onChange=${(v) => setForm(Object.assign({}, f, { company: v }))} /><//>
            <${E.Field} label="Firma adresi"><${E.Inp} value=${f.addr} disabled=${!can} onChange=${(v) => setForm(Object.assign({}, f, { addr: v }))} /><//>
            <${E.Field} label="Hurda sebepleri (her satıra bir tane)" span><${E.Txt} rows=${5} value=${f.reasons} onChange=${(v) => can && setForm(Object.assign({}, f, { reasons: v }))} /><//>
            <${E.Field} label="EUR kuru (TL)"><${E.Inp} value=${f.eur} inputMode="decimal" disabled=${!can} onChange=${(v) => setForm(Object.assign({}, f, { eur: v }))} /><//>
            <${E.Field} label="USD kuru (TL)"><${E.Inp} value=${f.usd} inputMode="decimal" disabled=${!can} onChange=${(v) => setForm(Object.assign({}, f, { usd: v }))} /><//>
          </div>
          <div className="pad muted" style=${{ paddingTop: 0, fontSize: 12.5 }}>Kur, yeni tekliflere varsayılan olarak gelir; teklifte elle değiştirilebilir.</div>
        <//>
      </div><div className="r">
        ${E.canEdit('kullanici') ? html`<${E.Card} title="Örnek veriler"><div className="pad col" style=${{ gap: 10 }}>
          <div>${sample ? sample + ' örnek kayıt var. Kendi verilerinizi girmeye başlamadan önce silebilirsiniz.' : 'Örnek kayıt yok.'}</div>
          ${sample ? html`<${E.Btn} kind="d" onClick=${wipe}>Örnek verileri sil<//>` : null}</div><//>` : null}
      </div></div>
      ${pform ? html`<${E.Modal} title=${pform.id ? 'Proses' : 'Yeni proses'} onClose=${() => setPform(null)} foot=${html`<${E.Btn} onClick=${() => setPform(null)}>Vazgeç<//><${E.Btn} kind="p" disabled=${!pform.name} onClick=${async () => { await E.save('processes', pform); setPform(null); E.toast('Kaydedildi'); }}>Kaydet<//>`}>
        <${E.SchemaForm} fields=${[{ k: 'name', label: 'Proses adı', req: true, ph: 'Eloksal Tip II' }, { k: 'kind', label: 'Tür', type: 'select', options: ['Kaplama', 'Isıl işlem', 'NDT', 'Boya', 'Pasivasyon', 'Diğer'] }]} value=${pform} set=${(k, v) => setPform(Object.assign({}, pform, { [k]: v }))} />
      <//>` : null}
    </div>`;
  }
  E.pages['ana/tanimlar'] = Defs;

  // ---------- parts + revisions ----------
  const revFields = [
    { k: 'rev', label: 'Revizyon', req: true, ph: 'C' }, { k: 'status', label: 'Durum', type: 'select', options: ['Aktif', 'Eski'] },
    { k: 'materialId', label: 'Malzeme', type: 'select', req: true, options: matOpts }, { k: 'spec', label: 'Çizimdeki malzeme spesifikasyonu', ph: 'AMS 4123 / AMS-QQ-A-225/9' },
    { k: 'raw', label: 'Ham ölçü tipi', type: 'select', options: ['Yuvarlak', 'Altıgen', 'Plaka'] },
    { k: 'd', label: 'Çap / anahtar ağzı (mm)', type: 'number', show: (v) => v.raw !== 'Plaka' }, { k: 'w', label: 'En (mm)', type: 'number', show: (v) => v.raw === 'Plaka' },
    { k: 'l', label: 'Boy (mm)', type: 'number' }, { k: 't', label: 'Kalınlık (mm)', type: 'number', show: (v) => v.raw === 'Plaka' },
    { k: 'faiDone', label: 'FAI', type: 'check', text: 'Bu revizyon için kabul edilmiş FAI var' }
  ];
  const partFields = [{ k: 'customerId', label: 'Müşteri', type: 'select', req: true, options: custOpts }, { k: 'partNo', label: 'Müşteri parça no', req: true }, { k: 'desc', label: 'Tanım' }];
  function PartsPage() {
    const D = E.useStore();
    const [form, setForm] = useState(null);
    const can = E.canEdit('ana');
    const fields = partFields.concat(revFields.filter((f) => f.k !== 'status' && f.k !== 'faiDone'));
    const submit = async () => {
      const m = E.missing(fields, form); if (m.length) { E.toast('Zorunlu alanları doldurun', 'err'); return; }
      const rev = { rev: form.rev, status: 'Aktif', materialId: form.materialId, spec: form.spec || '', raw: form.raw || 'Yuvarlak', d: form.d || '', w: form.w || '', l: form.l || '', t: form.t || '', faiDone: false };
      const r = await E.save('parts', { customerId: form.customerId, partNo: form.partNo, desc: form.desc || '', revs: [rev], active: true });
      setForm(null); E.openRec('part', r.id);
    };
    return html`<div>
      <${E.ListPage} title="Parçalar" crumb="Ana veriler › Parçalar" csv="Parcalar" onRow=${(r) => E.openRec('part', r.id)}
        rows=${Object.values(D.parts).sort((a, b) => a.partNo.localeCompare(b.partNo))}
        cols=${[{ k: 'partNo', label: 'Parça no', mono: true }, { label: 'Müşteri', v: (r) => E.nameOf('customers', r.customerId) }, { k: 'desc', label: 'Tanım' },
          { label: 'Aktif rev', v: (r) => (r.revs || []).filter((x) => x.status !== 'Eski').map((x) => x.rev).join(', ') },
          { label: 'FAI', v: (r) => (r.revs || []).filter((x) => x.status !== 'Eski').map((x) => (x.faiDone ? x.rev + ' ✔' : x.rev + ' yok')).join(' · ') }]}
        empty=${html`<${E.Empty} title="Henüz parça yok" text=" Önce müşteri ve malzeme tanımlayın, sonra parçayı ilk revizyonuyla ekleyin." />`}
        actions=${can ? html`<${E.Btn} kind="p" onClick=${() => setForm({ raw: 'Yuvarlak' })}>+ Yeni parça<//>` : null} />
      ${form ? html`<${E.Modal} wide title="Yeni parça" onClose=${() => setForm(null)} foot=${html`<${E.Btn} onClick=${() => setForm(null)}>Vazgeç<//><${E.Btn} kind="p" onClick=${submit}>Kaydet<//>`}>
        <${E.SchemaForm} fields=${fields} value=${form} set=${(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
      <//>` : null}
    </div>`;
  }
  E.pages['ana/parcalar'] = PartsPage;
  function PartDetail({ id }) {
    const D = E.useStore();
    const p = D.parts[id];
    const [rf, setRf] = useState(null);
    const [sel, setSel] = useState(null);
    const [edit, setEdit] = useState(null);
    if (!p) return html`<${E.Empty} title="Parça bulunamadı" text="" />`;
    const can = E.canEdit('ana');
    const revs = p.revs || [];
    const cur = sel || (revs.find((r) => r.status !== 'Eski') || revs[0] || {}).rev;
    const saveRev = async () => {
      if (E.missing(revFields, rf).length) { E.toast('Zorunlu alanları doldurun', 'err'); return; }
      const exists = revs.some((r) => r.rev === rf._orig);
      if (!exists && revs.some((r) => r.rev === rf.rev)) { E.toast('Bu revizyon zaten var', 'err'); return; }
      const nr = Object.assign({}, rf); delete nr._orig;
      const list = exists ? revs.map((r) => (r.rev === rf._orig ? nr : r)) : revs.concat(nr);
      await E.save('parts', Object.assign({}, p, { revs: list }), (exists ? 'Rev ' + nr.rev + ' güncellendi' : 'Rev ' + nr.rev + ' eklendi') + (nr.faiDone ? ' (FAI var)' : ''));
      setRf(null); setSel(nr.rev); E.toast('Kaydedildi');
    };
    return html`<div className="col" style=${{ gap: 16 }}>
      <${E.Head} crumb=${html`<${E.BackCrumb} label="Parçalar" here=${p.partNo} />`} title=${p.partNo} sub=${html`<span>${E.nameOf('customers', p.customerId)}</span><span>${p.desc}</span>`}
        actions=${can ? html`<${E.Btn} onClick=${() => setEdit(Object.assign({}, p))}>Düzenle<//><${E.Btn} kind="p" onClick=${() => setRf({ status: 'Aktif', raw: 'Yuvarlak', faiDone: false, materialId: (revs[revs.length - 1] || {}).materialId })}>+ Revizyon<//>` : null} />
      <div className="split"><div className="l">
        <${E.Card} title="Revizyonlar"><${E.Table} rows=${revs.map((r) => Object.assign({ id: r.rev }, r))} onRow=${(r) => setSel(r.rev)} rowClass=${(r) => (r.rev === cur ? 'sel' : '')}
          cols=${[{ k: 'rev', label: 'Rev', mono: true }, { label: 'Durum', v: (r) => html`<${E.Badge} s=${r.status} />` }, { label: 'Malzeme', v: (r) => E.nameOf('materials', r.materialId) },
            { label: 'Ham ölçü', v: (r) => E.rawLabel(r) }, { label: 'Ham ağırlık', num: true, v: (r) => E.fmtN(E.rawKg(r), 3) + ' kg' },
            { label: 'FAI', v: (r) => html`<${E.Badge} s=${r.faiDone ? 'Var' : 'Yok'} t=${r.faiDone ? 'ok' : 'warn'} />` },
            { label: 'Rota', v: (r) => { const ro = E.routingFor(p.id, r.rev); return ro ? html`<${E.RecLink} type="routing" id=${ro.id}>${ro.status}<//>` : html`<span className="muted">yok</span>`; } },
            can ? { label: '', v: (r) => html`<${E.Btn} sm onClick=${(e) => { e.stopPropagation(); setRf(Object.assign({ _orig: r.rev }, r)); }}>Düzenle<//>` } : null].filter(Boolean)} /><//>
        <div className="muted" style=${{ fontSize: 12.5 }}>Seçili revizyon (${cur || '—'}) için çizimler sağ panelde. Satıra tıklayarak revizyon seçin.</div>
      </div><div className="r">
        ${cur ? html`<${E.DocPanel} key=${cur} title=${'Rev ' + cur + ' belgeleri'} refKey=${'parts/' + p.id + '/' + cur} kinds=${['Çizim', 'Model / diğer']} />` : null}
        <${E.History} rec=${p} />
      </div></div>
      ${rf ? html`<${E.Modal} wide title=${rf._orig ? 'Rev ' + rf._orig : 'Yeni revizyon'} onClose=${() => setRf(null)} foot=${html`<${E.Btn} onClick=${() => setRf(null)}>Vazgeç<//><${E.Btn} kind="p" onClick=${saveRev}>Kaydet<//>`}>
        <${E.SchemaForm} fields=${revFields} value=${rf} set=${(k, v) => setRf(Object.assign({}, rf, { [k]: v }))} />
        <div className="muted">Ham ağırlık: ${E.fmtN(E.rawKg(rf), 3)} kg</div>
      <//>` : null}
      ${edit ? html`<${E.Modal} title="Parça bilgileri" onClose=${() => setEdit(null)} foot=${html`<${E.Btn} onClick=${() => setEdit(null)}>Vazgeç<//><${E.Btn} kind="p" onClick=${async () => { await E.save('parts', edit); setEdit(null); }}>Kaydet<//>`}>
        <${E.SchemaForm} fields=${partFields} value=${edit} set=${(k, v) => setEdit(Object.assign({}, edit, { [k]: v }))} />
      <//>` : null}
    </div>`;
  }
  E.details.part = PartDetail;

  // ---------- routings ----------
  function RoutingsPage() {
    const D = E.useStore();
    const [form, setForm] = useState(null);
    const can = E.canEdit('uretim');
    const revOpts = (v) => { const p = E.get('parts', v.partId); return p ? (p.revs || []).map((r) => r.rev) : []; };
    const create = async () => {
      if (!form.partId || !form.rev) return;
      if (E.list('routings').some((r) => r.partId === form.partId && r.rev === form.rev)) { E.toast('Bu revizyonun rotası zaten var', 'err'); return; }
      const r = await E.save('routings', { partId: form.partId, rev: form.rev, status: 'Taslak', ops: [] });
      setForm(null); E.openRec('routing', r.id);
    };
    return html`<div>
      <${E.ListPage} title="Rotalar" crumb="Üretim › Rotalar" onRow=${(r) => E.openRec('routing', r.id)}
        rows=${Object.values(D.routings)} searchKeys=${(r) => E.partLabel(r.partId, r.rev)}
        cols=${[{ label: 'Parça / rev', v: (r) => E.partLabel(r.partId, r.rev) }, { label: 'Müşteri', v: (r) => { const p = E.get('parts', r.partId); return p ? E.nameOf('customers', p.customerId) : '—'; } },
          { label: 'Operasyon', num: true, v: (r) => (r.ops || []).length }, { label: 'Fason op.', num: true, v: (r) => (r.ops || []).filter((o) => o.type === 'Fason').length },
          { label: 'Durum', v: (r) => html`<${E.Badge} s=${r.status} />` }]}
        empty=${html`<${E.Empty} title="Henüz rota yok" text=" Parça revizyonu için sıralı operasyonları tanımlayın; teklif ve iş emri buradan beslenir." />`}
        actions=${can ? html`<${E.Btn} kind="p" onClick=${() => setForm({})}>+ Yeni rota<//>` : null} />
      ${form ? html`<${E.Modal} title="Yeni rota" onClose=${() => setForm(null)} foot=${html`<${E.Btn} onClick=${() => setForm(null)}>Vazgeç<//><${E.Btn} kind="p" disabled=${!form.partId || !form.rev} onClick=${create}>Oluştur<//>`}>
        <${E.SchemaForm} fields=${[{ k: 'partId', label: 'Parça', type: 'select', req: true, options: () => E.list('parts').map((p) => ({ v: p.id, l: p.partNo + ' · ' + E.nameOf('customers', p.customerId) })) }, { k: 'rev', label: 'Revizyon', type: 'select', req: true, options: revOpts }]}
          value=${form} set=${(k, v) => setForm(Object.assign({}, form, { [k]: v }, k === 'partId' ? { rev: '' } : {}))} />
      <//>` : null}
    </div>`;
  }
  E.pages['uretim/rotalar'] = RoutingsPage;
  function RoutingDetail({ id }) {
    const D = E.useStore();
    const r = D.routings[id];
    const [ops, setOps] = useState(null);
    if (!r) return html`<${E.Empty} title="Rota bulunamadı" text="" />`;
    const can = E.canEdit('uretim');
    const cur = ops || r.ops || [];
    const editing = !!ops;
    const upd = (i, k, v) => setOps(cur.map((o, j) => (j === i ? Object.assign({}, o, { [k]: v }) : o)));
    const move = (i, d) => { const a = cur.slice(); const t = a[i]; a[i] = a[i + d]; a[i + d] = t; setOps(a); };
    const add = () => { const last = cur.length ? Math.max.apply(null, cur.map((o) => +o.seq || 0)) : 0; setOps(cur.concat({ seq: last + 10, name: '', type: 'İç', machineId: '', processId: '', supplierId: '', setup: '', cycle: '', note: '' })); };
    const saveOps = async () => {
      const clean = cur.map((o) => Object.assign({}, o, { seq: +o.seq || 0, setup: E.num(o.setup), cycle: E.num(o.cycle) }));
      if (clean.some((o) => !o.name)) { E.toast('Her operasyona ad verin', 'err'); return; }
      await E.save('routings', Object.assign({}, r, { ops: clean }), 'Operasyonlar güncellendi (' + clean.length + ' op)');
      setOps(null); E.toast('Rota kaydedildi');
    };
    const tot = cur.reduce((s, o) => s + E.num(o.cycle), 0);
    return html`<div className="col" style=${{ gap: 16 }}>
      <${E.Head} crumb=${html`<${E.BackCrumb} label="Rotalar" here=${E.partLabel(r.partId, r.rev)} />`} title=${'Rota · ' + E.partLabel(r.partId, r.rev)} badge=${html`<${E.Badge} s=${r.status} />`}
        sub=${html`<span>Toplam birim süre: ${E.fmtN(tot, 1)} dk/ad</span><span>Hazırlık: ${E.fmtN(cur.reduce((s, o) => s + E.num(o.setup), 0), 0)} dk</span>`}
        actions=${can && !editing ? html`<${E.Btn} onClick=${() => setOps(cur.slice())}>Operasyonları düzenle<//>
          ${r.status === 'Onaylı' ? html`<${E.Btn} onClick=${() => E.save('routings', Object.assign({}, r, { status: 'Taslak' }))}>Taslağa al<//>` : html`<${E.Btn} kind="p" disabled=${!cur.length} onClick=${() => E.save('routings', Object.assign({}, r, { status: 'Onaylı' }))}>Onayla<//>`}` : null} />
      <div className="alert info">İş emri serbest bırakıldığında bu operasyonlar iş emrine kopyalanır. Rotayı sonradan değiştirmek açık iş emirlerini etkilemez.</div>
      <${E.Card} title="Operasyonlar" act=${editing ? html`<${E.Btn} sm onClick=${add}>+ Operasyon<//><${E.Btn} sm onClick=${() => setOps(null)}>Vazgeç<//><${E.Btn} sm kind="p" onClick=${saveOps}>Kaydet<//>` : null}>
        ${editing ? html`<div className="scroll"><table className="tbl"><thead><tr><th>Sıra</th><th>Operasyon</th><th>Tip</th><th>Tezgah / proses</th><th>Tedarikçi</th><th>Hazırlık (dk)</th><th>Birim (dk/ad)</th><th>Not</th><th></th></tr></thead><tbody>
          ${cur.map((o, i) => html`<tr key=${i}>
            <td><input className="in sm" style=${{ width: 64 }} value=${o.seq} onChange=${(e) => upd(i, 'seq', e.target.value)} aria-label="Sıra" /></td>
            <td><input className="in sm" style=${{ minWidth: 150 }} value=${o.name} onChange=${(e) => upd(i, 'name', e.target.value)} aria-label="Operasyon adı" /></td>
            <td><${E.Sel} sm empty=${false} value=${o.type} options=${['İç', 'Fason']} onChange=${(v) => upd(i, 'type', v)} /></td>
            <td>${o.type === 'Fason' ? html`<${E.Sel} sm value=${o.processId} options=${procOpts()} onChange=${(v) => upd(i, 'processId', v)} />` : html`<${E.Sel} sm value=${o.machineId} options=${machOpts()} onChange=${(v) => upd(i, 'machineId', v)} />`}</td>
            <td>${o.type === 'Fason' ? html`<${E.Sel} sm value=${o.supplierId} empty="Tercih yok" options=${supOpts(o.processId)} onChange=${(v) => upd(i, 'supplierId', v)} />` : '—'}</td>
            <td><input className="in sm" style=${{ width: 80 }} inputMode="decimal" value=${o.setup} disabled=${o.type === 'Fason'} onChange=${(e) => upd(i, 'setup', e.target.value)} aria-label="Hazırlık" /></td>
            <td><input className="in sm" style=${{ width: 80 }} inputMode="decimal" value=${o.cycle} disabled=${o.type === 'Fason'} onChange=${(e) => upd(i, 'cycle', e.target.value)} aria-label="Birim süre" /></td>
            <td><input className="in sm" style=${{ minWidth: 140 }} value=${o.note} onChange=${(e) => upd(i, 'note', e.target.value)} aria-label="Not" /></td>
            <td><div className="row" style=${{ flexWrap: 'nowrap' }}><${E.Btn} sm disabled=${i === 0} onClick=${() => move(i, -1)}>↑<//><${E.Btn} sm disabled=${i === cur.length - 1} onClick=${() => move(i, 1)}>↓<//><${E.Btn} sm kind="d" onClick=${() => setOps(cur.filter((_, j) => j !== i))}>Sil<//></div></td>
          </tr>`)}</tbody></table></div>`
        : html`<${E.Table} rows=${cur.map((o, i) => Object.assign({ id: i }, o))} empty=${html`<${E.Empty} title="Operasyon yok" text=${can ? ' “Operasyonları düzenle” ile ekleyin.' : ''} />`}
            cols=${[{ k: 'seq', label: 'Sıra', mono: true }, { k: 'name', label: 'Operasyon' }, { k: 'type', label: 'Tip' },
              { label: 'Tezgah / proses', v: (o) => (o.type === 'Fason' ? E.nameOf('processes', o.processId) : E.machineName(o.machineId)) },
              { label: 'Tedarikçi', v: (o) => (o.type === 'Fason' ? (o.supplierId ? E.nameOf('suppliers', o.supplierId) : 'tercih yok') : '—') },
              { label: 'Hazırlık', num: true, v: (o) => (o.type === 'Fason' ? '—' : E.fmtN(o.setup, 0) + ' dk') }, { label: 'Birim', num: true, v: (o) => (o.type === 'Fason' ? '—' : E.fmtN(o.cycle, 1) + ' dk') },
              { k: 'note', label: 'Not', wrap: true }]} />`}
      <//>
      <${E.History} rec=${r} />
    </div>`;
  }
  E.details.routing = RoutingDetail;
})();
