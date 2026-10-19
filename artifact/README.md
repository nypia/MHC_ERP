# Atölye ERP – çalışan MVP (claude.ai yapıtı)

`docs/PLAN.md`'deki modüllerin tarayıcıda çalışan sürümü. claude.ai üzerinde yayınlanır:
https://claude.ai/artifact/UNMyzLHTv9UCkV37nTXpBJ

- Arayüz: React 18 + htm (derleme adımı yok), `index.html` ve `js/` altındaki modül dosyaları.
- Veri: yapıtın paylaşılan veri deposu (`db` yeteneği). Belgeler (CoC, çizim, sertifika, ölçüm raporu) `assets` yeteneğinde versiyonlu saklanır.
- Ekran: 1100 px üstü masaüstü, 700–1099 px tablet (aynı düzen, dar menü), 700 px altı telefon (menü soldan açılır çekmece). Dokunmatik ekranda düğme ve alanlar büyür.
- Çıktılar (teklif, iş föyü, irsaliye, müşteri CoC, CSV listeler) `downloads` yeteneğiyle indirilir.

| Dosya | İçerik |
| --- | --- |
| `js/core.js` | Veri deposu, oturum, yetki matrisi, numaralandırma, değişiklik geçmişi, ortak iş kuralları |
| `js/ui.js` | Ortak bileşenler: tablo, form, modal, belge paneli, geçmiş paneli |
| `js/masters.js` | Müşteri, tedarikçi, malzeme, tezgah, kullanıcı, tanımlar, parça + revizyon, rota |
| `js/sales.js` | Teklif (maliyet motoru) ve sipariş |
| `js/production.js` | İş emri |
| `js/operator.js` | Operatör tablet ekranı |
| `js/purchasing.js` | Malzeme lotu, fason takibi |
| `js/quality.js` | Muayene, FAI, NCR, izlenebilirlik |
| `js/shipping.js` | Sevkiyat, irsaliye, müşteri CoC |
| `js/dashboard.js` | Gösterge paneli, geciken işler, fasondaki parçalar |
| `js/app.js` | Giriş, menü, arama, yönlendirme |

Sınırlar: veri claude.ai'de durur (spesifikasyondaki "iç ağ" şartı kalıcı Django sürümünde karşılanır);
yapıt deposu en fazla 25.000 kayıt tutar; ERP içi kullanıcı seçimi gerçek kimlik doğrulaması değildir.
