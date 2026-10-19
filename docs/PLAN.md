# Atölye ERP – Detaylı Sistem ve Arayüz Planı

## Bağlam

Bu plan, [Atölye ERP – MVP Spesifikasyonu](MVP-SPESIFIKASYONU.md) üzerine kuruludur:
tekliften sevkiyata kadar sipariş yürütme, muhasebe hariç, Django + PostgreSQL + React, iç ağ.
Amacı kod yazmadan önce şunları netleştirmek:
modüller ve alt başlıklar, her ekranda ne olduğu, ekranların nasıl görüneceği, kayıt durumları, roller
ve bunların hangi sırayla geliştirileceği.

**Sizinle alınan kararlar:**
- Operatör girişi: tezgah başında ortak tablet, isme dokunup 4 haneli PIN.
- Para birimi: TL, EUR ve USD. Maliyet TL'de hesaplanır, kur teklifte elle girilir.
- Teklifte malzeme maliyeti ham ölçüden hesaplanır (ölçü × yoğunluk × kg fiyatı), elle değiştirilebilir.
- Sevkiyat çıktıları: ERP yazdırılabilir irsaliye ve müşteri CoC'si (Uygunluk Sertifikası) PDF'i üretir.
  Resmi e-irsaliye numarası dış programdan girilir.

---

## 1. Spesifikasyondaki boşluklar ve önerilen tamamlamalar

| # | Boşluk | Öneri |
|---|---|---|
| 1 | "Ana veriler › Malzemeler" menüde var ama 15 varlık arasında **Malzeme** yok | Malzeme varlığı eklenir: spesifikasyon (ör. AMS 4078), alaşım/temper, form (yuvarlak çubuk, altıgen, plaka, boru), yoğunluk, güncel kg fiyatı |
| 2 | Teklifte ham ölçüden hesap için parçada ham ölçü yok | Parça revizyonuna malzeme ve ham ölçü (Ø×boy veya en×boy×kalınlık) eklenir |
| 3 | Sevkiyat sadece sipariş satırına bağlı. Şarj no'dan müşteriye tek sorguda inmek için iş emri bağı gerekli | Sevkiyat satırı **iş emrine** de bağlanır, seri/lot aralığı iş emrinden gelir |
| 4 | İş emri tek malzeme lotuna bağlı. Çubuk biterse ikinci lot gerekir | Bir iş emrine birden fazla lot bağlanabilir. Her bağda kullanılan miktar ve o lottan çıkan seri aralığı tutulur |
| 5 | NCR sadece iş emrine bağlı. Gelen kontrolde reddedilen lotun iş emri yok | NCR; iş emri, malzeme lotu veya fason kaydından birine bağlanabilir |
| 6 | "Ara muayene" tiplerde var ama Kalite alt menüsünde yok | Ara muayeneler iş emri detayındaki "Muayene ve NCR" sekmesinden girilir |
| 7 | Fason proses listesi (eloksal, ısıl işlem vb.) tanımlı değil | Ana veriler'e "Tanımlar" alt menüsü eklenir: prosesler, operasyon tipleri, hurda sebepleri, kurlar |
| 8 | Ölçüm aleti varlığı yok (kalibrasyon kapsam dışı) | Ölçüm aleti serbest metin + otomatik tamamlama; kalibrasyon sonraki sürüm |

---

## 2. Genel arayüz iskeleti

### 2.1 Ana yerleşim

```
┌───────────────┬──────────────────────────────────────────────────────────────────┐
│  ATÖLYE ERP   │  Teklifler   Siparişler   Müşteriler      🔍 No / şarj / seri ara  👤 │  ← modül alt menüsü (sabit)
│               ├──────────────────────────────────────────────────────────────────┤
│ ▣ Genel durum │  Satış › Siparişler › SIP-2026-0042                                │  ← konum çubuğu
│ ▣ Satış     ◀ │                                                                    │
│ ▣ Üretim      │                                                                    │
│ ▣ Satınalma   │           [ sayfa içeriği: liste / form / rapor ]                  │
│   ve fason    │                                                                    │
│ ▣ Kalite      │                                                                    │
│ ▣ Sevkiyat    │                                                                    │
│ ▣ Ana veriler │                                                                    │
│               │                                                                    │
│ «  daralt     │                                                                    │
└───────────────┴──────────────────────────────────────────────────────────────────┘
```

- **Sol menü:** 7 modül, ikonlu. Sadece ikon gösterecek şekilde daraltılabilir. Rolün göremediği modüller hiç çıkmaz.
- **Üst alt menü:** seçili modülün sayfaları. Liste, form ve rapor sayfalarında yerinde kalır.
- **Modül bağlamı korunur:** Kalite › NCR'deyken iş emri linkine tıklanırsa iş emri açılır ama menü Kalite'de kalır.
  Adresler buna göre kurulur: `/kalite/kayit/is-emri/118`. Modül önekiyle açılan kayıtlar her modülde aynı detay bileşenini kullanır.
- **Genel arama:** kayıt numarası (TKL-, SIP-, IE-, LOT-, FSN-, NCR-, SVK-), şarj no, seri no veya PO no yazılınca doğrudan kayda gider.

### 2.2 Standart sayfa tipleri

**Liste sayfası**
```
 Siparişler                                                        [⤓ Excel]  [+ Yeni sipariş]
 [Durum ▾] [Müşteri ▾] [Termin: bu hafta ▾] [🔍 ara…]                 Kayıtlı filtre: Açık siparişler ▾
 ┌─────────────┬──────────────┬──────────┬───────┬──────────┬─────────────┬───────────┐
 │ No          │ Müşteri      │ PO no    │ Satır │ Termin   │ İlerleme    │ Durum     │
 ├─────────────┼──────────────┼──────────┼───────┼──────────┼─────────────┼───────────┤
 │ SIP-2026-42 │ ABC Havacılık│ 4500123  │ 3     │ 12.11.26 │ ██████░░ 60%│ ● Üretimde│
 │ SIP-2026-41 │ XYZ Savunma  │ PO-889   │ 1     │ 05.11.26 │ ████████ 100│ ● Sevkte  │
 └─────────────┴──────────────┴──────────┴───────┴──────────┴─────────────┴───────────┘
                                                                     ‹ 1 2 3 ›  25/sayfa
```
- Termini geçen satırlar kırmızı vurgulanır. Durumlar renkli rozetle gösterilir.
- Her listede Excel'e aktarma ve kayıtlı filtreler olur.

**Detay ve form sayfası**
```
 SIP-2026-0042 · ABC Havacılık · PO 4500123       ● Onaylı    [İş emri aç] [Sevkiyat aç] [⋯ İptal et]
 ┌──────────────────────────────────────────────────────┬──────────────────────────┐
 │ Genel bilgiler (iki sütunlu form)                    │ 📎 Belgeler (3)          │
 │ Satırlar (düzenlenebilir tablo)                      │   PO_4500123.pdf  v1     │
 │ Siparişe özel kalite notları                         │   [+ Yükle]              │
 │ Bağlı kayıtlar: Teklif TKL-17 · IE-118, IE-119 · SVK-7│ 🕓 Değişiklik geçmişi    │
 │                                                      │   19.10 14:02 Ayşe D.    │
 │                                                      │   termin 05.11 → 12.11   │
 └──────────────────────────────────────────────────────┴──────────────────────────┘
```
- Üst bant: kayıt no, ana bilgi, durum rozeti, durum geçiş butonları.
- Sağ panel: **Belgeler** (versiyonlu) ve **Değişiklik geçmişi** (kim, ne zaman, hangi alan, eski → yeni). Her detay sayfasında aynıdır.
- Onaylı kayıtta "Sil" yoktur, sadece "İptal et" vardır ve gerekçe zorunludur. Taslak kayıt silinebilir.

### 2.3 Ortak kurallar
- **Denetim izi:** her kayıtta her değişiklik kullanıcı, zaman, alan, eski ve yeni değerle saklanır.
- **Belgeler:** kayda bağlı ve versiyonludur. Yeni versiyon yüklenince eskisi silinmez, "önceki versiyonlar" altında kalır.
  Türler: çizim, malzeme CoC'si, proses sertifikası, ölçüm raporu, FAI raporu, müşteri onayı, tedarikçi sertifikası, PO, diğer.
- **Numaralandırma:** `ÖNEK-YIL-SIRA`: TKL, SIP, IE, IK, LOT, FSN, MUA, NCR, SVK (ör. `IE-2026-0118`).
- **Dil ve biçim:** arayüz Türkçe, tarih GG.AA.YYYY, ondalık virgül. Kodda ve veritabanında İngilizce isimler kullanılır.

---

## 3. Modüller, alt başlıklar ve ekran içerikleri

### 3.1 Genel durum
| Alt menü | İçerik |
|---|---|
| **Gösterge paneli** | Özet kartları ve canlı tezgah durumu (aşağıda) |
| **Geciken işler** | Termini geçmiş ve tamamı sevk edilmemiş sipariş satırları: müşteri, PO, parça/rev, termin, gecikme günü, iş emri ve bulunduğu operasyon, açık NCR var mı |
| **Fasondaki parçalar** | Dönüşü tamamlanmamış fason kayıtları: tedarikçi, proses, iş emri, giden adet/tarih, dönen adet, beklenen dönüş, dışarıda geçen gün (süre aşılınca renklenir) |

```
 ┌ Açık sipariş ┐ ┌ Üretimdeki IE ┐ ┌ Bu hafta termin ┐ ┌ Geciken ┐ ┌ Fasonda ┐ ┌ Açık NCR ┐ ┌ Sevke hazır ┐
 │     14       │ │      22       │ │        6        │ │   3 ⚠   │ │ 340 ad. │ │    2     │ │     4       │
 └──────────────┘ └───────────────┘ └─────────────────┘ └─────────┘ └─────────┘ └──────────┘ └─────────────┘
 Tezgah durumu (canlı)                                     Bu hafta terminli işler
 ┌ CNC-01 ●Çalışıyor  Ahmet Y. IE-118 Op10 2s14dk ┐        SIP-42/1 PRC-1001 C   12.11  Op20'de
 │ CNC-02 ○Boş                                    │        SIP-40/2 PRC-0877 A   13.11  Fasonda
 │ CNC-03 ●Çalışıyor  Ali T.   IE-121 Op20 0s40dk ┘        …
 Uyarılar: Y Kaplama'nın NADCAP sertifikası 12 gün içinde doluyor · LOT-0031 gelen kontrol bekliyor
```
Kartlara tıklanınca ilgili filtreli liste açılır.

### 3.2 Satış
| Alt menü | İçerik |
|---|---|
| **Teklifler** | Liste: no, müşteri, parça(lar), toplam, para birimi, geçerlilik, durum. Detay: maliyet kırılımlı teklif formu (aşağıda) |
| **Siparişler** | Liste ve detay: müşteri PO no, satırlar (parça rev, adet, birim fiyat, satır termini), para birimi, siparişe özel kalite notları (FAI gerekli, CoC gerekli, özel ambalaj, serbest metin), PO belgesi. Satır bazında iş emri, üretilen ve sevk edilen adet görünür |
| **Müşteriler** | Unvan, vergi no ve dairesi, adresler, iletişim kişileri, varsayılan para birimi, **kalite notları** (FAI şartı ☐, CoC şartı ☐, özel şartlar), müşteri şartname belgeleri. Sekmeler: teklifler, siparişler, parçalar, sevkiyatlar |

**Teklif ekranı: fiyat önerisi**
```
 TKL-2026-0017 · XYZ Savunma        Para birimi [EUR ▾]  Kur [48,50] TL   Geçerlilik [30 gün]   ● Taslak
 Satırlar:  1) PRC-1001 Rev C × 50 ad.   2) PRC-1001 Rev C × 200 ad.   [+ Satır]     ← adet kırılımı = ayrı satır
 ┌ Satır 1 – Maliyet kırılımı (adet başı, TL) ───────────────────────────────────────────────┐
 │ Malzeme   7075-T6 Ø40×85 mm → 0,30 kg × 310 TL/kg × (1 + %5 fire)            =   97,65    │ ✎
 │ Op10 CNC torna   CNC-01  (60 dk hazırlık ÷ 50 + 6,0 dk) × 1.400 TL/s          =  168,00    │
 │ Op20 5 eksen     CNC-03  (120 dk hazırlık ÷ 50 + 9,0 dk) × 2.000 TL/s         =  380,00    │
 │ Op30 Eloksal     Fason · Y Kaplama · 25 TL/ad.                                =   25,00    │
 │ ─────────────────────────────────────────────────────────────────────────────────────────  │
 │ Toplam maliyet                                                                   670,65 TL │
 │ Kâr marjı [%25]  →  Önerilen birim fiyat  838,31 TL = 17,28 EUR                            │
 │ Teklif birim fiyatı  [ 17,50 ] EUR      Termin [ 6 hafta ]                                 │
 └────────────────────────────────────────────────────────────────────────────────────────────┘
 [PDF teklif]  [Gönderildi işaretle]  [Kabul → Siparişe dönüştür]  [Reddedildi]
```
- Rota süreleri parça revizyonunun rotasından, saat ücreti tezgahtan, kg fiyatı malzemeden, fason fiyatı tedarikçi-proses tanımından gelir.
  Hepsi teklif satırında elle değiştirilebilir. Değiştirilen değer işaretlenir.
- Yeni parça için önce taslak (tahmini) rota açılır, teklif onunla hesaplanır.
- Kabul edilen teklif tek tıkla siparişe dönüşür, satırlar ve fiyatlar kopyalanır.

### 3.3 Üretim
| Alt menü | İçerik |
|---|---|
| **İş emirleri** | Liste: no, sipariş/satır, parça rev, adet, seri aralığı, termin, mevcut operasyon, ilerleme, durum. Detay: sekmeli iş emri ekranı (aşağıda) |
| **Operatör ekranı** | Tablet arayüzü (aşağıda). Planlama ve yönetici için ayrıca "şu an kim neyi çalışıyor" görünümü |
| **Rotalar** | Parça revizyonuna bağlı sıralı operasyonlar: sıra no, operasyon tipi, iç/fason, tezgah (iç) veya proses ve tercih edilen tedarikçi (fason), hazırlık süresi, birim süre, talimat notu. Satırlar sürükle-bırak ile sıralanır |
| **Tezgahlar** | Ad, kod, tip (CNC torna, 3 eksen, 5 eksen, taşlama…), saat ücreti (TL), aktif/pasif. Tezgah detayında son iş kartları |

**İş emri detayı**
```
 IE-2026-0118 · SIP-0042/1 · PRC-1001 Rev C · 50 ad. · Seri 0001–0050        ● Üretimde
 Termin 12.11.2026   İlerleme ██████░░░░ Op20/40    ⚠ FAI gerekli (müşteri şartı, bu rev için ilk üretim)
 [Serbest bırak] [İş föyü yazdır] [⋯ İptal]
 ┌ Rota ilerlemesi ┬ Malzeme ┬ Fason ┬ Muayene ve NCR ┬ Belgeler ┬ İzlenebilirlik ┬ Geçmiş ┐
 ┌─────┬───────────────┬────────────────┬───────┬────────┬────────┬───────┬────────────┐
 │ Op  │ Operasyon     │ Tezgah / Ted.  │ Plan  │ Gerçek │ Sağlam │ Hurda │ Durum      │
 ├─────┼───────────────┼────────────────┼───────┼────────┼────────┼───────┼────────────┤
 │ 10  │ CNC torna     │ CNC-01         │ 6,0 s │ 5,6 s  │ 50     │ 0     │ ✔ Bitti    │
 │ 20  │ 5 eksen       │ CNC-03         │ 9,5 s │ 4,1 s  │ 22     │ 1     │ ▶ Devam    │
 │ 30  │ Eloksal       │ Fason·Y Kaplama│ —     │ —      │ 0      │ 0     │ ○ Bekliyor │
 │ 40  │ Final kontrol │ Kalite         │ —     │ —      │ 0      │ 0     │ ○ Bekliyor │
 └─────┴───────────────┴────────────────┴───────┴────────┴────────┴───────┴────────────┘
   satır açılınca: o operasyonun iş kartları (operatör, tezgah, başlangıç-bitiş, sağlam/hurda)
```
| Sekme | İçerik |
|---|---|
| Rota ilerlemesi | Yukarıdaki tablo. Operasyonlar iş emri serbest bırakılınca rotadan kopyalanır; sonradan rota değişse de bu iş emri etkilenmez |
| Malzeme | Bağlı lotlar: lot no, şarj no, malzeme, kullanılan miktar, seri aralığı, CoC linki. [Lot bağla] sadece gelen kontrolü kabul edilmiş lotları listeler |
| Fason | Bu iş emrinin fason kayıtları: [Fasona gönder] |
| Muayene ve NCR | Ara, final ve FAI muayeneleri ile NCR'ler: [Muayene ekle] [NCR aç] |
| Belgeler | İş emrine ve parça revizyonuna bağlı belgeler (çizim burada görünür) |
| İzlenebilirlik | Bu iş emrinin soy ağacı: lot ve şarj → operasyonlar → fason ve sertifika → muayeneler → sevkiyatlar |
| Geçmiş | Denetim izi |

**İş föyü (traveler) PDF:** iş emri no, parça/rev, adet, seri aralığı, operasyon listesi ve barkod. Tezgahta kağıt olarak dolaşır. Öneri, küçük iş.

**Operatör ekranı: tablet, sol menü yok, tam ekran, büyük butonlar**
```
 ① Giriş                           ② İşlerim                                  
 ┌───────────────────────────┐     ┌──────────────────────────────────────────────┐
 │ Tezgah: CNC-03            │     │ Ali T. · CNC-03                    [ Çıkış ] │
 │                           │     │ ┌──────────────────────────────────────────┐ │
 │ [ Ahmet Y. ] [ Ali T.   ] │     │ │ IE-0118 · PRC-1001 C · Op20 5 eksen      │ │
 │ [ Ayşe D.  ] [ Mehmet K.] │     │ │ 50 ad. · önceki op'tan gelen: 50 sağlam  │ │
 │                           │     │ │ Termin 12.11            [ ▶  BAŞLAT ]    │ │
 │ PIN  ● ● ○ ○              │     │ └──────────────────────────────────────────┘ │
 │ [1] [2] [3]               │     │ ┌ IE-0121 · PRC-0877 A · Op10 …  [▶ BAŞLAT]┐ │
 │ [4] [5] [6]               │     │ Bugünkü kartlarım: IE-0115 Op20 · 18 sağlam  │
 │ [7] [8] [9]  [⌫] [0] [✓]  │     └──────────────────────────────────────────────┘
 └───────────────────────────┘
 ③ Çalışıyor                        ④ Bitir
 ┌───────────────────────────┐     ┌──────────────────────────────────────────────┐
 │ IE-0118 · Op20 5 eksen    │     │ Sağlam   [   48   ]     [1][2][3]             │
 │                           │     │ Hurda    [    2   ]     [4][5][6]             │
 │       01:42:15            │     │                         [7][8][9]             │
 │                           │     │ Hurda sebebi: [Ölçü dışı] [Yüzey] [Kırık]      │
 │ [ 📄 ÇİZİMİ AÇ ]          │     │               [Takım izi] [Diğer]             │
 │ [ ■  BİTİR ]              │     │            [   ✓ KAYDET   ]                   │
 └───────────────────────────┘     └──────────────────────────────────────────────┘
```
- Tablet bir tezgaha tanımlanır. Ortak tablette tezgah seçimi de yapılabilir.
- Operatör sadece **kendi** kartlarını ve kendisine veya tezgahına atanmış sıradaki operasyonları görür.
- Kısmi bitirme serbesttir: 22 adet yapıp bitirir, sonraki vardiya yeni kart açar.
- Bir operasyonun sağlam toplamı önceki operasyonun sağlam toplamını geçemez.
- Hurda > 0 girilince kalitenin incelemesi için otomatik **taslak NCR** açılır.
- 60 saniye işlem yapılmazsa veya kayıttan sonra oturum kendiliğinden kapanır.
- "Çizimi aç" parça revizyonunun geçerli çizim versiyonunu gösterir.

### 3.4 Satınalma ve fason
| Alt menü | İçerik |
|---|---|
| **Fason takibi** | Liste: no, iş emri, operasyon, proses, tedarikçi, giden adet/tarih, dönen adet, sertifika ✔/✗, durum. Detay: gönderim ve dönüş hareketleri (kısmi dönüşler ayrı satır), dönüş irsaliye no, **proses sertifikası yükleme** (kapatmak için zorunlu) |
| **Malzeme lotları** | Liste: lot no, malzeme, ölçü, tedarikçi, şarj no, giriş miktarı, kalan, gelen kontrol durumu. **Malzeme girişi** formu (aşağıda). Detayda bu lotu kullanan iş emirleri görünür |
| **Tedarikçiler** | Unvan, vergi no, tür (malzeme / fason / ikisi), **onaylı prosesler** (çoklu seçim + proses başına birim fiyat), sertifikalar (belge + geçerlilik tarihi), iletişim. Geçerliliği 30 gün içinde dolacak sertifikalar uyarı verir |

**Malzeme girişi**
```
 Yeni malzeme lotu                                                     LOT-2026-0031 (otomatik)
 Malzeme     [ 7075-T6 Yuvarlak çubuk Ø40 ▾ ]     Tedarikçi   [ Y Metal ▾ ]
 Şarj no     [ H-77812        ]                   Giriş tarihi [ 19.10.2026 ]
 Miktar      [ 120 ] [kg ▾]   Boy/adet [ 6 × 3000 mm ]          Tedarikçi irsaliye no [ … ]
 Malzeme CoC [ ⤒ dosya sürükleyin ]  ✔ CoC_H77812.pdf v1
 Gelen kontrol: ○ Bekliyor  → kaydedince "Kalite › Gelen kontrol" kuyruğuna düşer       [Kaydet]
```
- CoC sadece saklanır ve başka bir adımı etkilemez (spesifikasyondaki gibi).
- Lotun iş emrine bağlanabilmesi için **gelen kontrol sonucu "Kabul"** olmalıdır.

**Fasona gönderme kuralları:** seçilen tedarikçinin onaylı prosesleri bu prosesi içermiyorsa ya da sertifikası dolmuşsa uyarı çıkar;
yönetici gerekçe yazarak geçebilir ve gerekçe kayda düşer. Fason dönüşündeki sağlam adet, rota ilerlemesinde o operasyonun adedine yazılır.

### 3.5 Kalite
| Alt menü | İçerik |
|---|---|
| **Gelen kontrol** | Bekleyen lotlar kuyruğu ve geçmiş. Muayene formu: lot, kontrol edilen ölçüler/özellikler, ölçüm raporu dosyası, sonuç (Kabul / Ret), kontrolör, ölçüm aleti. Ret → [NCR aç] |
| **Final muayene ve FAI** | Final muayene bekleyen iş emirleri kuyruğu. Final formu: iş emri, kontrol edilen adet, ölçüm raporu, sonuç, kontrolör, ölçüm aletleri. FAI formu: AS9102 Form 1-2-3 dosyaları, balonlu çizim, sonuç. Kabul edilen FAI parça revizyonuna "FAI tamam" olarak işlenir |
| **NCR** | Liste: no, bağlı kayıt, parça, adet, durum, karar. Detay: tanım, adet, fotoğraf/belge, kök neden (opsiyonel), **karar**: Hurda / Yeniden işleme / Müşteri onaylı kabul (müşteri onay belgesi zorunlu). Durum: Açık → Karar verildi → Kapandı |
| **İzlenebilirlik sorgusu** | İleri ve geri izleme (aşağıda) |

**FAI kuralı:** müşteride FAI şartı varsa veya siparişte "FAI gerekli" işaretliyse **ve** parça revizyonunda kabul edilmiş FAI yoksa,
iş emri "FAI gerekli" uyarısı taşır ve FAI kabul edilmeden sevk edilemez.

**NCR kararlarının etkisi:** *Hurda* iş emrinin sağlam adedinden düşer. *Yeniden işleme* iş emrine ek bir rework operasyonu ekler.
*Müşteri onaylı kabul* parçaları serbest bırakır ve onay belgesi CoC'de referans olarak yer alır.

**İzlenebilirlik sorgusu**
```
 Ara: [ Şarj no ▾ ]  [ H-77812            ]  [ Sorgula ]          (Şarj · Lot · Seri no · İş emri · İrsaliye no · PO)
 Şarj H-77812 · 7075-T6 Ø40 · Y Metal · CoC 📄
 └─ LOT-2026-0031  (120 kg, kalan 18 kg)
    ├─ IE-2026-0118 · PRC-1001 C · seri 0001–0050
    │   ├─ SVK-2026-0007 · 14.11.2026 · ABC Havacılık · PO 4500123 · 30 ad. · seri 0001–0030 · İrs. A-1234
    │   └─ SVK-2026-0009 · 21.11.2026 · ABC Havacılık · PO 4500123 · 18 ad. · seri 0031–0048 · İrs. A-1301
    └─ IE-2026-0125 · PRC-0877 A · seri 0001–0020 · henüz sevk edilmedi
 [⤓ Excel] [⤓ PDF]
```
- **İleri izleme** (şarj → müşteri): spesifikasyondaki "tek sorgu" şartı, tek bir veritabanı sorgusuyla karşılanır.
- **Geri izleme** (seri no → geçmiş): lot, şarj, CoC, her operasyonun operatör, tezgah ve tarihi, fason ve proses sertifikası, muayeneler, NCR'ler, sevkiyat.

### 3.6 Sevkiyat
| Alt menü | İçerik |
|---|---|
| **Sevkiyatlar** | Liste: no, müşteri, sipariş/PO, tarih, irsaliye no, durum. Detay ve oluşturma ekranı aşağıda |

```
 SVK-2026-0007 · ABC Havacılık · SIP-0042 / PO 4500123                                  ● Taslak
 ┌ Satır ┬ Parça / Rev    ┬ İş emri     ┬ Sevke uygun ┬ Sevk adedi ┬ Seri / lot     ┬ Kontroller ──────────────┐
 │ 1     │ PRC-1001 C     │ IE-0118     │ 48          │ [ 30 ]     │ 0001–0030      │ ✔ Final ✔ FAI ✔ NCR yok  │
 └───────┴────────────────┴─────────────┴─────────────┴────────────┴────────────────┴──────────────────────────┘
 e-İrsaliye no (dış programdan) [ A-1234 ]   Sevk tarihi [ 14.11.2026 ]   Taşıyıcı [ … ]
 [⤓ İrsaliye PDF]  [⤓ Müşteri CoC PDF]  [Sevk edildi olarak işaretle]
```
- **Sevke uygun adet** = final muayenesi kabul edilen adet − açık NCR'deki adet − daha önce sevk edilen adet.
- **Sevk kapısı:** final muayenesi kabul edilmemiş, FAI gerekip kabul edilmemiş veya açık NCR'si olan adet sevk edilemez.
- **Müşteri CoC PDF'i:** müşteri, PO, parça no/rev, adet, seri/lot aralığı, malzeme spesifikasyonu ve şarj no, fason prosesleri ve sertifika no'ları,
  varsa müşteri onaylı kabul referansı, uygunluk beyanı, final muayeneyi yapan kontrolörün adı ve tarih.

### 3.7 Ana veriler
| Alt menü | İçerik |
|---|---|
| **Parçalar** | Parça: müşteri, müşteri parça no, tanım. **Revizyonlar** alt tablosu: rev, çizim (versiyonlu belge), malzeme spesifikasyonu, malzeme, ham ölçü, durum (aktif/eski), FAI durumu. Parça detayının sekmeleri: revizyonlar, rotalar, teklifler, iş emirleri |
| **Malzemeler** | Spesifikasyon, alaşım/temper, form, ölçü, yoğunluk (g/cm³), güncel kg fiyatı (TL), lotlar sekmesi |
| **Kullanıcılar ve roller** | Kullanıcı: ad, kullanıcı adı, rol(ler), aktif/pasif. Operatörler için 4 haneli PIN ve varsayılan tezgah. Sadece yönetici erişir |
| **Tanımlar** *(eklenen)* | Prosesler (eloksal, ısıl işlem, NDT, pasivasyon, boya…), operasyon tipleri, hurda sebepleri, kurlar (son girilen kur varsayılan olur), numara serileri |

---

## 4. Kayıt durumları

| Kayıt | Durumlar |
|---|---|
| Teklif | Taslak → Gönderildi → Kabul (→ sipariş) / Ret / Süresi doldu · İptal |
| Sipariş | Taslak → Onaylı → Üretimde → Kısmi sevk → Tamamlandı · İptal |
| İş emri | Taslak → Serbest → Üretimde → Tamamlandı → Kapandı · İptal (ekranda ek bilgi olarak: Fasonda, Muayene bekliyor) |
| İş kartı | Devam ediyor → Bitti |
| Malzeme lotu | Karantina → Kabul / Ret · Tükendi |
| Fason kaydı | Planlandı → Gönderildi → Kısmi döndü → Döndü → Tamamlandı (sertifika yüklenince) |
| Muayene | Taslak → Sonuçlandı (Kabul / Ret / Şartlı kabul) |
| NCR | Açık → Karar verildi → Kapandı |
| Sevkiyat | Taslak → Hazır → Sevk edildi · İptal |

---

## 5. Roller ve yetkiler

G = görür, D = oluşturur/düzenler, O = onaylar/iptal eder, – = göremez

| Alan | Satış | Planlama | Operatör | Kalite | Yönetici |
|---|---|---|---|---|---|
| Genel durum | G | G | – | G | G |
| Teklif, sipariş, müşteri | D, O | G | – | G | D, O |
| İş emri, rota, tezgah | G | D, O | – | G | D, O |
| Operatör ekranı | – | G | kendi kartları | – | G |
| Fason, malzeme lotu, tedarikçi | – | D | – | G (lot: gelen kontrol D) | D, O |
| Muayene, FAI, NCR | G | G | – (hurda → taslak NCR) | D, O | D, O |
| Sevkiyat | D | D | – | G | D, O |
| Parça, malzeme, tanımlar | G | D | – | G | D |
| Kullanıcılar ve roller | – | – | – | – | D |
| Fiyat ve maliyet alanları | G | – | – | – | G |

Bir kullanıcıya birden fazla rol verilebilir (küçük atölyede planlama ile yönetici aynı kişi olabilir).

---

## 6. Veri modeli (son hali)

Spesifikasyondaki 15 varlık korunur. Eklenenler: **Malzeme**, **Rota operasyonu**, **Sipariş satırı**, **Teklif satırı**,
**İş emri operasyonu** (rota kopyası), **İş emri–lot bağı**, **Fason hareketi**, **Sevkiyat satırı**, **Proses**, **Kur**, denetim izi.

```
Müşteri ─< Teklif ─< Teklif satırı >─ Parça rev ─< Rota ─< Rota operasyonu >─ Tezgah | Proses
Müşteri ─< Sipariş ─< Sipariş satırı ─< İş emri ─< İş emri operasyonu ─< İş kartı (operatör, tezgah)
                                          │                         └─< Fason kaydı ─< Fason hareketi >─ Tedarikçi
                                          ├─< İş emri–lot bağı >─ Malzeme lotu >─ Malzeme, Tedarikçi (şarj no)
                                          ├─< Muayene (ara, final, FAI)        Malzeme lotu ─< Muayene (gelen)
                                          ├─< NCR (veya lot / fason kaydına bağlı)
                                          └─< Sevkiyat satırı >─ Sevkiyat >─ Müşteri
Belge ── herhangi bir kayda (genel bağ, versiyonlu)
```

---

## 7. Teknik mimari (özet)

- **Backend:** Django + Django REST Framework + PostgreSQL.
  Django uygulamaları: `core` (kullanıcı/rol, denetim izi, belge, numaralandırma), `masterdata`, `sales`, `production`, `purchasing`, `quality`, `shipping`.
- **Denetim izi:** `django-simple-history`. **PDF:** WeasyPrint (HTML şablondan). **Dosyalar:** sunucu diski veya NAS, versiyonlu `Belge` modeli üzerinden.
- **Frontend:** React + TypeScript + Vite, **Ant Design** (zengin tablo ve formlar, Türkçe dil desteği), TanStack Query, React Router.
  Operatör ekranı aynı uygulamada ayrı bir `/operator` yerleşimidir.
- **Kimlik doğrulama:** iç ağda oturum (session) tabanlı. Operatörler için PIN ile kısa oturum.
- **Kurulum:** Docker Compose (postgres, backend, frontend/nginx) iç ağdaki bir sunucuda. Günlük `pg_dump` ve belge klasörü yedeği.

```
MHC_ERP/
  backend/   atolye/ (ayarlar) · apps/{core,masterdata,sales,production,purchasing,quality,shipping}
  frontend/  src/{layout, modules/<modül>/, operator/, components/(Belgeler, Geçmiş, DurumRozeti…)}
  docs/      bu plan ve ekran taslakları
  docker-compose.yml
```

---

## 8. Geliştirme sırası

| Faz | Kapsam | Bitince gösterilebilen |
|---|---|---|
| 0 | Repo iskeleti, Docker, giriş, roller, ana yerleşim (sol menü + sabit alt menü), denetim izi, belge paneli, numaralandırma | Boş modüllerle gezilebilen uygulama |
| 1 | Ana veriler: müşteri, tedarikçi, malzeme, parça + revizyon, tezgah, rota, tanımlar | Parça ve rota tanımlanabiliyor |
| 2 | Satış: teklif (maliyet motoru, çoklu para birimi, PDF), sipariş, tekliften siparişe | Teklif → sipariş |
| 3 | Malzeme lotu + gelen kontrol, iş emri (serbest bırakma, lot bağlama, sekmeler), iş föyü | Siparişten iş emri, lot bağlı |
| 4 | Operatör ekranı (PIN, başlat/bitir, hurda → taslak NCR), canlı tezgah durumu | Tablette üretim kaydı |
| 5 | Fason takibi, final muayene, FAI, NCR | Fason ve kalite döngüsü |
| 6 | Sevkiyat, irsaliye ve CoC PDF'leri, izlenebilirlik sorgusu, gösterge paneli, geciken işler, fasondaki parçalar | Uçtan uca akış |
| 7 | Örnek veri, kullanıcı kabul testi, sunucu kurulumu, yedekleme | Canlıya hazır MVP |

**Sonraki adım:** istenirse önce ekranların tıklanabilir bir HTML prototipi hazırlanıp gözden geçirilir, ardından Faz 0'a başlanır.

---

## 9. Varsayımlar (itiraz edilmezse böyle uygulanır)

1. Sevk kapısı katıdır: final kabul, gerekiyorsa FAI kabulü ve açık NCR olmaması şarttır.
2. Lot iş emrine sadece gelen kontrol "Kabul" ise bağlanır. CoC bunu etkilemez.
3. Teklifte adet kırılımı aynı parçanın ayrı satırlarıyla yapılır.
4. Seri aralığı iş emri açılırken otomatik önerilir (parça bazında devam eden sıra) ve elle düzeltilebilir.
5. Rota iş emri serbest bırakıldığında kopyalanır.
6. Fiyat ve maliyet alanlarını sadece satış ve yönetici görür.

---

## 10. Doğrulama

- **Plan aşaması:** bu doküman ve (istenirse) HTML prototip üzerinden ekranları birlikte gözden geçiririz.
- **Her fazda:**
  - Backend için pytest. Durum geçişleri, iptal/silme kuralı, sevk kapısı, maliyet hesabı ve sağlam adet kuralları birim testleriyle kontrol edilir.
  - Frontend için tip kontrolü ve lint.
- **Uçtan uca senaryo** (Faz 6 sonunda, Playwright ile):
  1. Teklif → sipariş.
  2. Malzeme girişi + CoC → gelen kontrol kabul.
  3. İş emri + lot bağı.
  4. Operatör ekranında (tablet çözünürlüğü) başlat/bitir, 2 hurda → taslak NCR.
  5. Fason gönder/dönüş + sertifika.
  6. Final + FAI.
  7. Sevkiyat + PDF'ler.
  8. Şarj no ile izlenebilirlik sorgusu sevkiyatı ve müşteriyi doğru listeler; seri no ile geri izleme tüm zinciri gösterir.
- **Denetim kontrolü:** senaryodaki her değişiklik geçmiş panelinde kullanıcı ve zamanla görünür. Onaylı kayıtlarda sil butonu yoktur.
