# Tarımsal Proje Takip Sistemi

İl genelinde yürütülen tarımsal destek projelerinin (tohum, fide, gübre vb. dağıtımı) ilçe bazında takip edilmesi için geliştirilen, modüler yapıda bir web uygulamasıdır. Kurum içi ağda çalışır ve IP adresi üzerinden erişilir.

İlk sürüm İstanbul İl Tarım ve Orman Müdürlüğü, Çayır Mera ve Yem Bitkileri birimi için hazırlanmıştır. Yapı, farklı birimlerin farklı kalemlerle yürüttüğü projeleri de aynı sistemde toplayabilecek şekilde kurulmuştur.

## Özellikler

### Projeler

- **Proje Başlat:** proje adı, kısa ad, yürütücü birim, dönem, başlangıç ve bitiş tarihleri, açıklama
- **Kalemler:** tür (tohum, gübre…), ürün (Mısır, Yulaf…), çeşit (AGA, ADA…), hedef alan (da), dağıtım birimi (kg, torba, çuval…), ambalaj içeriği (1 torba = 25.000 adet), normlar (değer + birim) ve toplam dağıtım
  - Katalogdan seçilen ürün ve çeşidin normları, birimleri ve ambalaj içeriği kendiliğinden dolar; proje içinde değiştirilebilir
  - Katalogda olmayan ürün ya da çeşit yazılırsa proje kaydedilince kataloğa eklenir; yeni çeşitte ürününkinden farklı girilen değerler o çeşide özel olarak saklanır
  - Toplam dağıtım boş bırakılırsa hesaplanır: ihtiyaç = alan × ekim normu; dağıtım birimi ambalajsa ihtiyaç ambalaj içeriğine bölünür (ör. 1.000 da × 7.500 adet/da = 7.500.000 adet → 300 torba)
- **İlçe hedefleri:** projenin uygulanacağı ilçeler; ilçe bazında hedef çiftçi sayısı ve hedef dekar
- **Hedef çıktılar:** kalem bazında alan × çıktı normu (ot verimi, tane verimi, silaj verimi…) ve proje toplamları
- Proje listesi, arama, birim ve durum süzgeci
- Proje durumu: Taslak, Yürütülüyor, Tamamlandı, İptal (yalnızca taslaklar silinebilir)

### Kişiler, roller ve görevler

- **Roller:** İş Planı (yöneticiler; toplu istatistik ve son durum), Proje Koordinatörü (il müdürlüğü personeli), Proje Yürütücüsü (sahada çalışan personel). Rol adları ve açıklamaları Ayarlar'dan değiştirilebilir.
- **Kişiler:** ad soyad, unvan, rol, birim, sorumlu ilçeler, iletişim; pasif yapılabilir.
- **Giriş:** şifre yoktur. İlk kişi tanımlandıktan sonra sisteme girişte "Kimsiniz?" ekranında kişi seçilir; seçim tarayıcıda hatırlanır, üst çubuktaki menüden değiştirilebilir.
- **Proje ekibi:** projeye koordinatör ve yürütücüler atanır.
- **Görevler:** kişiye ya da role verilir; proje, ilçe, son tarih ve öncelik bağlanabilir. Role verilen görev o roldeki herkesin "Görevlerim" listesinde görünür. Durum (Bekliyor, Sürüyor, Tamamlandı, İptal) ve notlar kimin ne zaman yaptığıyla birlikte görev geçmişine yazılır. Son tarihi geçen açık görevler "gecikti" olarak işaretlenir.
- **Genel Bakış:** ana sayfa. Proje sayısı, hedef alan, hedef çiftçi, açık/geciken görevler, toplam dağıtım ve hedef çıktılar, projelerin son durumu ve görev ilerlemesi; dönem süzgeci. Kişinin kendi açık görevleri yanda listelenir.

> Şimdilik tüm roller tüm ekranları görür; rollere göre ekran ve yetki ayrımı sonraki sürümlerde eklenecektir.

### Ayarlar

| Bölüm | İçerik |
|---|---|
| Genel | Kurum adı, il |
| Kişiler | Sistemi kullanan kişiler, rolleri ve sorumlu ilçeleri |
| Roller | Üç rolün ekranda görünen adları ve açıklamaları |
| Yürütücü birimler | Projeleri yürüten birimler |
| Dönemler | Dönem adı, başlangıç/bitiş, yeni projede seçili gelecek varsayılan dönem |
| Ürün kataloğu | Türe göre ürünler; dağıtım birimi, ambalaj içeriği, normların varsayılan değer ve birimleri; çeşitler ve çeşide özel değerler |
| Hesaplama normları | Dekar başına tanımlanan değerler ve hesaptaki rolleri |
| Kalem türleri, ölçü birimleri, ilçeler | Formlardaki seçim listeleri |

- Bir değerin adı değiştirildiğinde, onu kullanan projeler ve katalog kayıtları da yeni adla güncellenir.
- Kullanılan bir değer (projesi olan dönem, birim vb.) silinemez.
- İlk açılışta `src/config/sabitler.js` içindeki varsayılanlar yazılır; sonrasında her şey Ayarlar sayfasından yönetilir.

**Norm rolleri**

| Rol | Hesap | Örnek |
|---|---|---|
| Ekim / uygulama normu | alan × norm = dağıtılacak miktar | Ekim normu 2,5 kg/da |
| Çıktı (verim) | alan × norm = beklenen üretim | Kuru ot verimi 500 kg/da, tane verimi 300 kg/da |
| Bilgi | hesaba girmez, kayıt amaçlı | Çiftçi başı azami alan 50 da |

Normun birimi ürüne, çeşide ve kaleme göre değiştirilebilir (ör. ekim normu mısırda adet/da, yulafta kg/da). Çeşitte girilen değer ürünün değerinin yerine geçer; boş bırakılanlarda ürünün değeri geçerlidir.

Normlar kaleme kopyalanarak saklanır; katalogda sonradan yapılan değişiklik eski projelerin hesaplarını etkilemez.

## Teknik yapı

| Katman | Kullanılan |
|---|---|
| Sunucu | Node.js 22, Express 4 |
| Veritabanı | MongoDB 7 (Mongoose 8) |
| Arayüz | EJS şablonları, [Tabler](https://tabler.io/admin-template) 1.x, Tabler Icons |
| Dağıtım | Docker, Docker Compose |
| Port | **1763** |

Tema ve ikon dosyaları `node_modules` içinden yerel olarak sunulur; uygulama internet erişimi olmayan kurum ağında da eksiksiz çalışır. Açık tema varsayılandır; koyu tema seçimi tarayıcıda hatırlanır.

> 1763, "Tarımsal Proje Takip Sistemi" adının ebced değeridir (طاریمصال پروژه تعقیب سیستمی).

## Kurulum

### Docker ile (önerilen)

```bash
git clone https://github.com/porsuktasarim/tarimsal-proje-takil.git
cd tarimsal-proje-takil
docker compose up -d --build
```

Uygulama `http://<sunucu-ip>:1763` adresinden açılır. Veriler `tpts-veri` Docker biriminde saklanır.

### Güncelleme

```bash
git pull
docker compose up -d --build
```

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
  app.js                    Uygulama girişi
  config/
    index.js                Ortam ayarları (port, veritabanı)
    sabitler.js             İlk kurulum varsayılanları, norm rolleri, proje durumları
  core/
    ayarlar.js              Ayar servisi: önbellek, kullanım sayımı, yeniden adlandırma
    gocler.js               Veri dönüşümleri (sürüm geçişleri)
    kimlik.js               "Kimsiniz?" girişi (kişi seçimi, çerez)
    modulYukleyici.js       Modülleri otomatik yükler, menüyü oluşturur
    yardimcilar.js          Sayı, tarih, miktar biçimleme
  views/                    Ortak şablonlar (üst/alt bölüm, bildirimler, hata sayfası)
  moduller/
    genel-bakis/            Toplu istatistik ve son durum panosu
    projeler/               Proje modeli, norm hesapları (hesap.js), sayfalar
    gorevler/               Görev modeli ve sayfaları
    ayarlar/                Ayar, Ürün ve Kişi modelleri, ayar sayfaları
public/                     Uygulamaya özel CSS, JS, simge
```

## Veri modeli

| Koleksiyon | İçerik |
|---|---|
| `ayarlar` | Tek belge (`_id: genel`): kurum, il, birimler, dönemler, ilçeler, kalem türleri, ölçü birimleri, norm tanımları |
| `urunler` | Ürün kataloğu: tür, ad, dağıtım birimi, ambalaj, normlar `{ kod: { deger, birim } }`, çeşitler (kendi normları ve ambalajıyla) |
| `projeler` | Proje bilgileri, kalemler (ürün kimliği, ürün, çeşit, alan, dağıtım birimi, ambalaj, normlar), ilçe hedefleri, proje ekibi |
| `kisiler` | Kişiler: ad soyad, unvan, rol kodu, birim, ilçeler, aktiflik |
| `gorevler` | Görevler: atama (kişi ya da rol), proje, ilçe, son tarih, öncelik, durum, hareket geçmişi |

Veri biçimi değiştiğinde dönüşümler `src/core/gocler.js` içinde tanımlanır ve uygulama açılırken bir kez çalışır.

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

Uygulama yeniden başlatıldığında modül menüye ve yönlendirmeye kendiliğinden eklenir. Görünümler `res.render('basvurular/views/liste', …)` biçiminde çağrılır; ayarlar her görünümde `ayar` olarak hazırdır. Projelere bağlanacak kayıtlar `Proje` modelinin `_id` değeri, kaleme bağlanacak kayıtlar ise kalemin `_id` değeri üzerinden ilişkilendirilir (kalem kimlikleri düzenlemede korunur).

Yeni bir ayar listesi başka kayıtlarda kullanılacaksa `src/core/ayarlar.js` içindeki `baglar` tablosuna eklenir; böylece yeniden adlandırma ve silme denetimi o kayıtları da kapsar.

## Yol haritası

- Çiftçi başvuruları ve ilçe veri girişi
- İlçe bazında hak sahipliği ve dağıtım listeleri
- Teslim tutanakları
- Gerçekleşen verimlerin girilmesi ve hedeflerle karşılaştırılması
- Raporlar ve Excel/PDF çıktıları
- Rollere göre ekranlar ve yetkiler; isteğe bağlı şifreli giriş

## Lisans

Kurum içi kullanım için geliştirilmiştir.
