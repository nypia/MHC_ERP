# Atölye ERP – MVP Spesifikasyonu

Oct 19, 2026 · @Mustafa Mıhcı

## Kapsam

İlk sürüm, bir siparişin tekliften sevkiyata kadar yürütülmesini kapsar. Muhasebe dışarıda kalır; fatura hazır bir muhasebe programında kesilir.

- **Girenler:** ana veriler, teklif, sipariş, iş emri ve rota, operatör iş kartı, fason takibi, malzeme lotu ve CoC dosyası, muayene, uygunsuzluk (NCR), sevkiyat.
- **Girmeyenler (sonraki sürüm):** muhasebe ve e-fatura (dış programa API ile bağlanacak), stok değerleme, kapasite çizelgeleme, kalibrasyon yönetimi.
- **İlkeler:**
  - Her değişiklik kim, ne zaman, neyi değiştirdi bilgisiyle kaydedilir. Onaylı kayıt silinmez, sadece iptal edilir.
  - Çizim, sertifika ve ölçüm raporu gibi belgeler ilgili kayda bağlı ve versiyonlu saklanır.
  - ERPNext sadece tasarım referansıdır, kod kopyalanmaz.
  - Sistem iç ağda çalışır, dışarıdan erişim yoktur.
  - Önerilen teknoloji: Django + PostgreSQL backend, React arayüz.

## Veri modeli

MVP 15 varlıktan oluşur. İzlenebilirliğin omurgası malzeme lotu, iş kartı, fason kaydı ve muayene kayıtlarının iş emrine bağlanmasıdır.

| Varlık | Temel alanlar | ERPNext karşılığı |
| --- | --- | --- |
| Müşteri | unvan, vergi no, kalite notları (ör. FAI şartı) | Customer |
| Tedarikçi | tür (malzeme / fason), onaylı prosesler, sertifika geçerlilik tarihi | Supplier |
| Parça | müşteri parça no, revizyon, çizim, malzeme spesifikasyonu | Item |
| Rota | parça revizyonu, sıralı operasyonlar (iç veya fason), hazırlık ve birim süre | Routing, BOM Operation |
| Tezgah | ad, tip, saat ücreti | Workstation |
| Malzeme lotu | malzeme, tedarikçi, şarj (heat) no, malzeme CoC'si (yüklenen dosya), gelen kontrol sonucu, kalan miktar | Batch |
| Teklif | müşteri, parça rev, adet, maliyet kırılımı, birim fiyat, termin | Quotation |
| Sipariş | müşteri PO no, satırlar, termin, siparişe özel kalite notları | Sales Order |
| İş emri | sipariş satırı, parça rev, adet, malzeme lotu, seri/lot no aralığı, durum | Work Order |
| İş kartı | iş emri, operasyon, operatör, tezgah, başlangıç-bitiş, sağlam/hurda adet | Job Card |
| Fason kaydı | iş emri, operasyon, tedarikçi, giden/gelen adet ve tarih, proses sertifikası | Subcontracting Order |
| Muayene | tip (gelen, ara, final, FAI), ölçüm raporu, sonuç, kontrolör, ölçüm aleti | Quality Inspection |
| Uygunsuzluk (NCR) | iş emri, tanım, adet, karar (hurda, yeniden işleme, müşteri onaylı kabul) | Non Conformance |
| Sevkiyat | sipariş satırları, adet, seri/lot no, irsaliye no | Delivery Note |
| Belge | bağlı kayıt, tür, versiyon, yükleyen, tarih | File |

&#91;embedded content: kayıt ilişkileri · sevkiyattan malzeme lotuna\]

Geri izleme şartı: bir şarj numarası girildiğinde, o malzemeden yapılan parçaların hangi sevkiyatla hangi müşteriye gittiği tek sorguda listelenir.

## Ekranlar

Solda modül menüsü, üstte modüle ait sabit bir alt menü bulunur. Alt menü liste, form ve rapor sayfalarında yerinde kalır. Başka modüle ait bir kayda tıklamak menüyü değiştirmez.

| Modül (sol menü) | Alt menü (üstte sabit) |
| --- | --- |
| Genel durum | Gösterge paneli · Geciken işler · Fasondaki parçalar |
| Satış | Teklifler · Siparişler · Müşteriler |
| Üretim | İş emirleri · Operatör ekranı · Rotalar · Tezgahlar |
| Satınalma ve fason | Fason takibi · Malzeme lotları · Tedarikçiler |
| Kalite | Gelen kontrol · Final muayene ve FAI · NCR · İzlenebilirlik sorgusu |
| Sevkiyat | Sevkiyatlar |
| Ana veriler | Parçalar · Malzemeler · Kullanıcılar ve roller |

**Özel ekranlar:**

- **Teklif:** rota süresi × tezgah saat ücreti + malzeme + fason maliyetinden fiyat önerir.
- **İş emri detayı:** sekmeler halinde rota ilerlemesi, malzeme, fason, muayene, belgeler ve izlenebilirlik.
- **Operatör ekranı:** tablet için büyük butonlar; iş kartını başlat, bitir, sağlam ve hurda adedi gir.
- **Malzeme girişi:** lot ve şarj no girilir, malzemenin CoC'si dosya olarak yüklenir. CoC sadece saklanır, başka bir adımı etkilemez.

**Roller:** satış, planlama, operatör, kalite, yönetici. Operatör sadece kendi iş kartlarını görür.

**Ana akış:**

1. Satış teklifi hazırlar; müşteri onaylayınca sipariş açılır.
2. Planlama siparişten iş emri açar. Malzeme gelince lot açılır, CoC yüklenir ve lot iş emrine bağlanır.
3. Operatör iş kartında operasyonları başlatır ve bitirir.
4. Fason operasyonda parça tedarikçiye gider; dönüşte proses sertifikası yüklenir.
5. Kalite final muayeneyi, gerekiyorsa FAI'yi yapar.
6. Sevkiyat açılır ve irsaliye kesilir.
