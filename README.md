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

### Bütçe ve finansman

- Kalemde birim fiyat ve fiyat birimi (TL/kg ya da TL/çuval); projede destek kaynağı ve çiftçi katkı oranı.
- Proje sayfasında girdi bütçesi: miktar × birim fiyat, toplam bütçe, destek kaynağı ve çiftçi katkısı (ör. 14.320.660 TL → Valilik %75, çiftçi %25).
- Başvuru alan sınırları: öncelikli alan (ör. 50 da) ve azami alan (ör. 100 da); aşıldığında talep formunda ve listelerde uyarı verilir.

### Çiftçiler ve talepler

- **Çiftçi kaydı** projelerden bağımsızdır: T.C. kimlik no (denetimli, benzersiz), ad soyad, telefon, ilçe, mahalle/köy, adres, ÇKS kaydı var/yok. Aynı çiftçi birden fazla projede kullanılır.
- **Talep** bir çiftçinin bir projedeki talebidir. Her satır bir parselde ekilecek bir kalemdir: kalem, parselin ilçesi, mahalle/köy, ada, parsel, ekilecek alan (da). Parsel çiftçinin ilçesi dışında olabilir; karışım ekimde aynı parsel her kalem için ayrı satırda girilir.
- Talep formunda T.C. yazıldığında kayıtlı çiftçinin bilgileri getirilir; yeni çiftçi talep ile birlikte kaydedilir. Bir çiftçinin bir projede tek talebi olur.
- Miktar her çiftçinin her kalemi için ayrı hesaplanır ve ambalaja yukarı yuvarlanır (ör. 12,5 da × 20 kg/da = 250 kg → 7 çuval / 280 kg). Bedel ve çiftçi katkısı teslim edilecek miktar üzerinden hesaplanır.
- Talep durumu: Talep alındı, Onaylandı, Teslim edildi, Reddedildi (reddedilenler toplamlara girmez).
- **İlçe kuralı:** yürütücüler yalnızca sorumlu oldukları ilçelerin çiftçisini kaydeder ve talebini girer; listeler varsayılan olarak kendi ilçeleriyle açılır. Koordinatör ve yöneticiler tüm ilçelerde çalışır.
- **Hayvan varlığı:** talepte işletmedeki hayvan sayıları (büyükbaş, küçükbaş, arı vb.; türler Ayarlar > Hayvan türleri'nden yönetilir) değerlendirmeye yardımcı bilgi olarak girilir. Talep anındaki sayılar talepte saklanır; kayıtlı çiftçinin son girilen sayıları yeni talep formuna getirilir.
- **Çiftçi icmali:** çiftçinin tüm projelerdeki talepleri, alanları, miktarları, bedelleri ve katkıları.
- Proje sayfasında kalem ve ilçe bazında talep özeti (talep / hedef); Genel Bakış'ta talep eden çiftçi, talep alanı, hedef bütçe ve çiftçi katkısı.

### Kişiler, roller ve görevler

- **Roller ve yetkiler:** roller Ayarlar > Roller ve yetkiler'den eklenir, adlandırılır, renklendirilir ve silinir (kişisi ya da görevi olan rol silinemez). Her role işaretlenerek yetki verilir: Genel Bakış, projeleri görme/yönetme, talep görme/girme/onaylama/silme, çiftçi görme/yönetme, tüm görevleri görme, görev verme, ayarlar (genel, katalog, kişi ve roller). "İlçe kısıtlı" roldeki kişiler yalnızca sorumlu oldukları ilçelerin çiftçisini ve talebini girer. Hazır roller: İş Planı, Proje Koordinatörü, Proje Yürütücüsü.
- **Sistem Yöneticisi:** tüm yetkilere sahip sabit roldür ve yalnızca bir kişiye verilebilir. Sistem Yöneticisi atanana kadar yetki denetimi uygulanmaz (ilk kurulum) ve üstte uyarı görünür.
- **Kişiler:** ad soyad, unvan, rol, birim, sorumlu ilçeler, iletişim; pasif yapılabilir.
- **Giriş:** şifre yoktur. İlk kişi tanımlandıktan sonra sisteme girişte "Kimsiniz?" ekranında kişi seçilir; seçim tarayıcıda hatırlanır, üst çubuktaki menüden değiştirilebilir.
- **Proje ekibi:** projeye koordinatör ve yürütücüler atanır.
- **Görevler:** kişiye ya da role verilir; proje, ilçe, son tarih ve öncelik bağlanabilir. Role verilen görev o roldeki herkesin "Görevlerim" listesinde görünür. Durum (Bekliyor, Sürüyor, Tamamlandı, İptal) ve notlar kimin ne zaman yaptığıyla birlikte görev geçmişine yazılır. Son tarihi geçen açık görevler "gecikti" olarak işaretlenir.
- **Genel Bakış:** ana sayfa. Proje sayısı, hedef alan, hedef çiftçi, açık/geciken görevler, toplam dağıtım ve hedef çıktılar, projelerin son durumu ve görev ilerlemesi; dönem süzgeci. Kişinin kendi açık görevleri yanda listelenir.

> Giriş şifresiz olduğundan yetkiler bir güvenlik önlemi değil, iş bölümüdür. Menüde ve sayfalarda yalnızca kişinin rolüne verilen işlemler görünür; yetkisiz adreslere girildiğinde "Yetkiniz yok" sayfası gösterilir. Kişi kendisine ya da rolüne verilen görevleri her zaman görür ve durumunu günceller.

### Ayarlar

| Bölüm | İçerik |
|---|---|
| Genel | Kurum adı, il |
| Kişiler | Sistemi kullanan kişiler, rolleri ve sorumlu ilçeleri |
| Roller ve yetkiler | Rol ekleme, silme, renk, ilçe kısıtı ve yetkiler; Sistem Yöneticisi |
| Yürütücü birimler | Projeleri yürüten birimler |
| Dönemler | Dönem adı, başlangıç/bitiş, yeni projede seçili gelecek varsayılan dönem |
| Ürün kataloğu | Türe göre ürünler; dağıtım birimi, ambalaj içeriği, normların varsayılan değer ve birimleri; çeşitler ve çeşide özel değerler |
| Hesaplama normları | Dekar başına tanımlanan değerler ve hesaptaki rolleri |
| Hayvan türleri | Talepte sorulan hayvan varlığı türleri ve birimleri |
| Kalem türleri, dağıtım birimleri, ilçeler | Formlardaki seçim listeleri (dağıtım birimi: çuval, paket, torba) |

- Bir değerin adı değiştirildiğinde, onu kullanan projeler ve katalog kayıtları da yeni adla güncellenir.
- Kullanılan bir değer (projesi olan dönem, birim vb.) silinemez.
- İlk açılışta `src/config/sabitler.js` içindeki varsayılanlar yazılır; sonrasında her şey Ayarlar sayfasından yönetilir.

**Norm rolleri**

| Rol | Hesap | Örnek |
|---|---|---|
| Ekim / uygulama normu | alan × norm = dağıtılacak miktar | Ekim normu 2,5 kg/da |
| Çıktı (verim) | alan × norm = beklenen üretim | Kuru ot verimi 500 kg/da, tane verimi 300 kg/da |
| Bilgi | hesaba girmez, kayıt amaçlı | Çiftçi başı azami alan 50 da |

Kalemler her zaman bir ambalajla (çuval, paket, torba) dağıtılır ve ambalaj içeriği zorunludur. **Ekim normunun birimi ambalaj içeriğinin birimine bağlıdır** ve elle değiştirilemez: 1 paket = 50.000 adet ise ekim normu adet/da, 1 çuval = 25 kg ise kg/da olur. Böylece ihtiyaç doğrudan ambalaj sayısına çevrilir: 1.000 da × 10.000 adet/da = 10.000.000 adet → 200 paket. Diğer normların birimi ürüne, çeşide ve kaleme göre değiştirilebilir. Çeşitte girilen değer ürünün değerinin yerine geçer; boş bırakılanlarda ürünün değeri geçerlidir.

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
    yetki.js                Rol yetkileri, yetki ara katmanı, ilçe kuralları
    modulYukleyici.js       Modülleri otomatik yükler, menüyü oluşturur
    yardimcilar.js          Sayı, tarih, miktar biçimleme
  views/                    Ortak şablonlar (üst/alt bölüm, bildirimler, hata sayfası)
  moduller/
    genel-bakis/            Toplu istatistik ve son durum panosu
    projeler/               Proje modeli, norm, miktar ve bütçe hesapları (hesap.js), sayfalar
    talepler/               Çiftçi talepleri (parsel satırları)
    ciftciler/              Çiftçi kaydı ve çiftçi icmali
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
| `ciftciler` | Çiftçiler: T.C. kimlik no, ad soyad, iletişim, ilçe, mahalle/köy, ÇKS |
| `talepler` | Çiftçi talepleri: proje, çiftçi, ilçe, parsel satırları (kalem, ilçe, mahalle, ada, parsel, alan), durum |
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

- İlçe bazında hak sahipliği ve dağıtım listeleri
- Teslim tutanakları ve çiftçi katkı tahsilatı
- Gerçekleşen verimlerin girilmesi ve hedeflerle karşılaştırılması
- Raporlar ve Excel/PDF çıktıları (çiftçi icmali, ilçe listeleri)
- Rollere göre ekranlar ve yetkiler; isteğe bağlı şifreli giriş

## Lisans

Kurum içi kullanım için geliştirilmiştir.
