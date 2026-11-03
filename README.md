# Tarımsal Proje Takip Sistemi

İl genelinde yürütülen tarımsal destek projelerinin (tohum, fide, gübre vb. dağıtımı) ilçe bazında takip edilmesi için geliştirilen, modüler yapıda bir web uygulamasıdır. Kurum içi ağda çalışır ve IP adresi üzerinden erişilir.

İlk sürüm İstanbul İl Tarım ve Orman Müdürlüğü, Çayır Mera ve Yem Bitkileri birimi için hazırlanmıştır. Yapı, farklı birimlerin farklı kalemlerle yürüttüğü projeleri de aynı sistemde toplayabilecek şekilde kurulmuştur.

## Özellikler

**Projeler modülü (v0.1)**

- **Proje Başlat:** proje adı, kısa ad, yürütücü birim, dönem, başlangıç ve bitiş tarihleri, açıklama
- **Kalemler:** her proje için tür (tohum, fide, gübre…), kalem adı/çeşit, ölçü birimi, dekar başı ve toplam miktar
- **İlçe hedefleri:** 39 ilçe arasından projenin uygulanacağı ilçelerin seçimi; ilçe bazında hedef çiftçi sayısı ve hedef dekar
- Proje listesi, arama, birim ve durum süzgeci
- Proje durumu: Taslak, Yürütülüyor, Tamamlandı, İptal (yalnızca taslaklar silinebilir)
- Açık tema varsayılan; koyu tema seçimi tarayıcıda hatırlanır

## Teknik yapı

| Katman | Kullanılan |
|---|---|
| Sunucu | Node.js 22, Express 4 |
| Veritabanı | MongoDB 7 (Mongoose 8) |
| Arayüz | EJS şablonları, [Tabler](https://tabler.io/admin-template) 1.x, Tabler Icons |
| Dağıtım | Docker, Docker Compose |
| Port | **1763** |

Tema ve ikon dosyaları `node_modules` içinden yerel olarak sunulur; uygulama internet erişimi olmayan kurum ağında da eksiksiz çalışır.

> 1763, "Tarımsal Proje Takip Sistemi" adının ebced değeridir (طاریمصال پروژه تعقیب سیستمی).

## Kurulum

### Docker ile (önerilen)

```bash
git clone https://github.com/porsuktasarim/tarimsal-proje-takil.git
cd tarimsal-proje-takil
docker compose up -d --build
```

Uygulama `http://<sunucu-ip>:1763` adresinden açılır. Veriler `tpts-veri` Docker biriminde saklanır.

### Doğrudan Node.js ile

MongoDB'nin çalışıyor olması gerekir.

```bash
npm install
MONGO_URI=mongodb://localhost:27017/tpts npm start
```

### Ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | `1763` | Uygulamanın dinlediği port |
| `MONGO_URI` | `mongodb://localhost:27017/tpts` | MongoDB bağlantı adresi |

## Klasör yapısı

```
src/
  app.js                  Uygulama girişi
  config/
    index.js              Uygulama ayarları
    sabitler.js           İlçeler, birimler, kalem türleri, ölçü birimleri, durumlar
  core/
    modulYukleyici.js     Modülleri otomatik yükler, menüyü oluşturur
    yardimcilar.js        Sayı ve tarih biçimleme
  views/                  Ortak şablonlar (üst/alt bölüm, hata sayfası)
  moduller/
    projeler/             Projeler modülü (model, yönlendirmeler, görünümler)
public/                   Uygulamaya özel CSS, JS, simge
```

## Yeni modül eklemek

`src/moduller/` altına bir klasör açılır ve içine şu yapıda bir `index.js` konur:

```js
module.exports = {
  slug: 'basvurular',          // adres: /basvurular
  ad: 'Çiftçi Başvuruları',
  sira: 20,                    // menüdeki sırası
  menu: [{ ad: 'Başvurular', yol: '/basvurular', ikon: 'ti-users' }],
  router: require('./routes')
};
```

Uygulama yeniden başlatıldığında modül menüye ve yönlendirmeye kendiliğinden eklenir. Görünümler `res.render('basvurular/views/liste', …)` biçiminde çağrılır. Projelere bağlanacak kayıtlar `Proje` modelinin `_id` değeri, kaleme bağlanacak kayıtlar ise kalemin `_id` değeri üzerinden ilişkilendirilir (kalem kimlikleri düzenlemede korunur).

## Yol haritası

- Çiftçi başvuruları ve ilçe veri girişi
- İlçe bazında hak sahipliği ve dağıtım listeleri
- Teslim tutanakları
- Raporlar ve Excel/PDF çıktıları
- Birim ve kalem türlerinin yönetimi (Ayarlar)
- Kullanıcı ve ilçe yetkilendirmesi

## Lisans

Kurum içi kullanım için geliştirilmiştir.
