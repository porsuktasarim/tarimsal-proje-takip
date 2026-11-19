# Tarımsal Proje Takip Sistemi

İl genelinde yürütülen tarımsal destek projelerinin (tohum, fide, gübre vb. dağıtımı) ilçe bazında takip edilmesi için geliştirilen, modüler yapıda bir web uygulamasıdır. Kurum içi ağda çalışır ve IP adresi üzerinden erişilir.

İlk sürüm İstanbul İl Tarım ve Orman Müdürlüğü, Çayır Mera ve Yem Bitkileri birimi için hazırlanmıştır. Yapı, farklı birimlerin farklı kalemlerle yürüttüğü projeleri de aynı sistemde toplayabilecek şekilde kurulmuştur.

## Özellikler

### Projeler

- **Proje Başlat:** proje adı, kısa ad (zorunlu; proje yılı, dönemi ve esas ürünü, ör. "2027 Bahar - Silajlık Yerli Mısır"; tüm formların alt bilgisinde yer alır), yürütücü birim, dönem, başlangıç ve bitiş tarihleri, açıklama
- **Kalemler:** tür (tohum, gübre, malzeme, makine…), ürün (Mısır, Yulaf…), çeşit (AGA, ADA…), talep birimi (da, adet, m²), hedef miktar, dağıtım birimi (çuval, paket, torba, top, adet), ambalaj içeriği (1 torba = 25.000 adet, 1 top = 100 m²), normlar (değer + birim) ve toplam dağıtım
  - **Talep birimi:** tohumda dekar, fidan ve fidede adet, sera naylonunda m². Ekim normunun birimi "ambalaj içeriği / talep birimi" olur (kg/da, adet/da, adet/adet)
  - **Normsuz türler** (Ayarlar > Kalem türleri'nde işaretlenir; varsayılan malzeme, makine, ekipman, diğer): ekim ve çıktı normu sorulmaz, talep edilen miktar doğrudan dağıtılır. Ambalaj isteğe bağlıdır ve içeriği talep birimindedir (1 top = 100 m² → 150 m² isteyene 2 top); ambalajsızsa 1 adet = 1 adet. Teknik özellik / marka-model girilebilir
  - **Ölçüye göre (özel üretim):** işaretli kalemde ambalaja yukarı yuvarlanmaz, istenen ölçü kadar teslim edilir (125 m² → 1,25 top). Standart ve özel üretim aynı ürünün iki kalemi (ör. çeşit "Özel üretim") olarak girilebilir
  - Katalogdan seçilen ürün ve çeşidin normları, birimleri ve ambalaj içeriği kendiliğinden dolar; proje içinde değiştirilebilir
  - Katalogda olmayan ürün ya da çeşit yazılırsa proje kaydedilince kataloğa eklenir; yeni çeşitte ürününkinden farklı girilen değerler o çeşide özel olarak saklanır
  - Toplam dağıtım boş bırakılırsa hesaplanır: ihtiyaç = alan × ekim normu; dağıtım birimi ambalajsa ihtiyaç ambalaj içeriğine bölünür (ör. 1.000 da × 7.500 adet/da = 7.500.000 adet → 300 torba)
- **İlçe hedefleri:** projenin uygulanacağı ilçeler; ilçe bazında hedef çiftçi sayısı ve hedef dekar
- **Hedef çıktılar:** kalem bazında hedef × çıktı normu (normun paydası talep birimiyse) (ot verimi, tane verimi, silaj verimi…) ve proje toplamları
- Proje listesi, arama, birim ve durum süzgeci
- Proje durumu: Taslak, Yürütülüyor, Tamamlandı, İptal (yalnızca taslaklar silinebilir)

### Bütçe ve finansman

- Kalemde birim fiyat ve fiyat birimi (TL/kg ya da TL/çuval); projede destek kaynağı ve çiftçi katkı oranı.
- Proje sayfasında girdi bütçesi: miktar × birim fiyat, toplam bütçe, destek kaynağı ve çiftçi katkısı (ör. 14.320.660 TL → Valilik %75, çiftçi %25).
- Başvuru alan sınırları: öncelikli alan (ör. 50 da) ve azami alan (ör. 100 da); aşıldığında talep formunda ve listelerde uyarı verilir.

### Çiftçiler ve talepler

- **Çiftçi kaydı** projelerden bağımsızdır: T.C. kimlik no (denetimli, benzersiz), ad soyad, telefon, ilçe, mahalle/köy, adres, ÇKS kaydı var/yok. Aynı çiftçi birden fazla projede kullanılır.
- **Talep** bir çiftçinin bir projedeki talebidir ve iki kısımdır:
  - **Talep edilen miktar:** her kalem için istenen toplam, kalemin talep biriminde (30 da yulaf, 50 adet ceviz fidanı, 500 m² sera naylonu)
  - **Parseller:** talebin hangi parsellerde kullanılacağı — kalem, parselin ilçesi, mahalle/köy, ada, parsel, miktar. m² ile sayılan kalemlerde en × boy (m) girilirse miktar hesaplanır. Parsel çiftçinin ilçesi dışında olabilir; karışım ekimde aynı parsel her kalem için ayrı satırda girilir; parseller henüz belli değilse boş bırakılabilir
  - Hesap hem talebe hem parsellere göre yapılır ve yan yana gösterilir; farklar işaretlenir. Toplamlarda talep miktarı esas alınır, girilmemişse parsel toplamı kullanılır. Başvuru alan sınırları dekar ile sayılan kalemlere uygulanır
- Talep formunda T.C. yazıldığında kayıtlı çiftçinin bilgileri getirilir; yeni çiftçi talep ile birlikte kaydedilir. Bir çiftçinin bir projede tek talebi olur.
- Miktar her çiftçinin her kalemi için ayrı hesaplanır ve ambalaja yukarı yuvarlanır (ör. 12,5 da × 20 kg/da = 250 kg → 7 çuval / 280 kg). Bedel ve çiftçi katkısı teslim edilecek miktar üzerinden hesaplanır.
- Talep durumu: Talep alındı, Onaylandı, Teslim edildi, Reddedildi (reddedilenler toplamlara girmez).
- **İlçe kuralı:** yürütücüler yalnızca sorumlu oldukları ilçelerin çiftçisini kaydeder ve talebini girer; listeler varsayılan olarak kendi ilçeleriyle açılır. Koordinatör ve yöneticiler tüm ilçelerde çalışır.
- **Hayvan varlığı:** talepte işletmedeki hayvan sayıları (büyükbaş, küçükbaş, arı vb.; türler Ayarlar > Hayvan türleri'nden yönetilir) değerlendirmeye yardımcı bilgi olarak girilir. Talep anındaki sayılar talepte saklanır; kayıtlı çiftçinin son girilen sayıları yeni talep formuna getirilir.
- **Çiftçi icmali:** çiftçinin tüm projelerdeki talepleri, alanları, miktarları, bedelleri ve katkıları.
- Proje sayfasında kalem ve ilçe bazında talep özeti (talep / hedef); Genel Bakış'ta talep eden çiftçi, talep alanı, hedef bütçe ve çiftçi katkısı.

### Proje metni

- Proje başlatılırken ya da sonradan proje sayfasından projenin metni (PDF ya da Word .docx) yüklenir; en fazla 30 MB. Eski .doc biçimi tarayıcıda gösterilemediği için kabul edilmez.
- Metin indirilmeden tarayıcıda okunur: PDF sayfaya gömülü açılır, Word belgesi (başlıklar, tablolar, görseller) sayfaya çevrilerek gösterilir. İstenirse indirilebilir.
- Her yükleme yeni sürümdür; eski sürümler saklanır ve okunabilir. Dosyalar veritabanında (GridFS) tutulur, ayrı klasör ya da birim gerekmez.
- Yalnızca projenin koordinatörü ve Sistem Yöneticisi yükler; projede koordinatör atanmamışsa "Proje Koordinatörü" rolündekiler yükleyebilir.
- **Değerlendirme proje metni yüklenmeden yapılamaz:** değerlendirme sayfası ve teslim alma, değer değiştirme, karar gibi işlemler proje sayfasına yönlendirir. Yürütücünün başvuru girmesi ve göndermesi etkilenmez.

### Başvuru değerlendirmesi

- **Akış:** yürütücü başvuruyu girer (taslak) ve koordinatöre gönderir → koordinatör teslim alır → ön incelemede hayvan sayısı ve talep edilen miktarlar değiştirilebilir, not düşülür → gerekirse yürütücüye geri gönderilir; yürütücü yalnızca not düşüp yeniden gönderir (gerektiği kadar tekrarlanır) → kesin karar: **Desteklendi**, **Yedek** ya da **Desteklenmedi** → desteklenenler destek icmaline girer, dağıtımda **Teslim edildi** yapılır. Karar gerekçeyle geri alınabilir.
- **Geçmiş:** her işlem, değer değişikliği (eski → yeni) ve not başvurunun geçmişinde kalır; notlar ve geçmiş değiştirilemez, silinemez. Başvurudaki ilk değerler ayrıca saklanır ve "başvuru: 60 da" olarak gösterilir.
- Gönderilen başvurunun formu kilitlenir; form düzeltmesini yalnızca Sistem Yöneticisi yapar (geçmişe yazılır).
- Gerekçe zorunlu: Desteklenmedi, yürütücüye geri gönderme, kararı geri alma ve talep edilen miktarı düşürme.
- **Değerlendirme ızgarası:** liste bir tablo gibi çalışır; incelemedeki başvurularda talep edilen miktarlar ve hayvan sayıları doğrudan hücrede değiştirilir, satır (dağıtım, BBHB, bedel, beklenen üretim, formüller, limit) hemen yeniden hesaplanır, alt satırdaki toplamlar güncellenir. Değişen hücreler kaydedilene kadar sarı görünür; hücrenin altındaki gri, üstü çizili sayı başvurudaki ilk değerdir. Değişiklikler tek notla birlikte kaydedilir (miktar düşürülüyorsa not zorunlu); eski değerler geçmişte kalır. Enter / ↑ ↓ satırlar, Tab hücreler arasında geçer, Esc hücreyi geri alır.
- **Beklenen üretim sütunları:** projedeki kalemlerde çıktı normu (ör. silaj, kuru ot verimi) girilmişse talep edilen miktar × norm ile hesaplanan üretim ızgarada ayrı sütun olarak görünür; ot ihtiyacıyla yan yana karşılaştırılır.
- **Çiftçi sayfasında değişiklikler:** her başvuruda değişen talep miktarları ve hayvan sayıları sıralı zincir olarak görünür (ör. Yulaf talebi: 100 → 60 → 40 da): başvurudaki değer ve giren kişi, ardından her değişiklikte yeni değer, yapan kişi ve rolü, tarih-saat ve nedeni (o işlemde yazılan not). Başvurunun tüm geçmişi ve notları aynı kartta açılır.
- **Toplu gönderme:** yürütücü, çiftçi talepleri listesinde taslak ve kendisine geri gönderilmiş başvuruları seçip tek seferde koordinatöre gönderir (geri gönderilmişlerde not zorunlu).
- **Değerlendirme sayfası:** projenin tüm başvuruları tek listede; aşama, ilçe, mahalle (ya da il geneli), ad/T.C. ve "limit üstü" süzgeçleri; sütunlara göre sıralama; her başvuru açılır pencerede değerlendirilir (teslim alma, değer değiştirme, not, yürütücüye gönderme, karar); seçilen başvurularda toplu işlem.
- **Formüller:** proje başlatılırken değerlendirmede hesaplanacak değerler tanımlanır (ör. `ot_ihtiyaci = buyukbas * 3650 + kucukbas * 550`, `ot_acigi = ot_ihtiyaci - kuru_ot_uretimi`). Her formül listede bir sütun olur; biri **puan** işaretlenirse başvurular puana göre sıralanır. Değişkenler: hayvan sayıları, `cks`, `toplam_da`, `bedel`, `ciftci_katkisi`, `destek`, beklenen üretimler (`kuru_ot_uretimi` …) ve kalem bazında `<kalem>_talep`, `_parsel`, `_dagitim`, `_teslim`, `_bedel`. İşlevler: `min`, `max`, `yuvarla`, `yukari`, `asagi`, `mutlak`, `karekok`, `eger(koşul; a; b)`.
- **Üst limitler:** bir değişkenin ya da formülün üst sınırı (maddi: `destek ≤ 20.000 TL`, tohum miktarı: `yulaf_teslim ≤ 600 kg`, alan: `toplam_da ≤ 50`). Aşan başvurular listede işaretlenir; miktar kendiliğinden değişmez.
- **Destek icmali:** kesin desteklenen başvurular ilçe bazında (kalem miktarları, dağıtım, bedel, çiftçi katkısı, destek; ilçe ve genel toplam), yedek liste puana göre; yazdırılabilir.
- **Silme:** sistemin tamamında kayıt silme (proje, başvuru, çiftçi, görev, kişi, rol, ürün, çeşit, liste değerleri) yalnızca Sistem Yöneticisi tarafından yapılır.

### BBHB (büyükbaş hayvan birimi)

Mera İzleme Sistemi'ndeki (misweb) BBHB modülü alınmıştır; katsayı tablosu (kural seti v1, 4342 sayılı Mera Kanunu esasları), sınıflandırma (ırk, yaş, cinsiyet) ve hesap çekirdeği aynıdır.

- **Manuel giriş:** ilçe, köy/mahalle, işletmeci adı (isteğe bağlı T.C. ve işletme no) ve 20 kategoride adet; önizleme, onaylanırsa kayıt.
- **Türkvet dosyası:** .xls/.xlsx/.csv, birden fazla dosya; il/ilçe/mahalle dosyadan okunur, her yerleşim ayrı kayıt olur. Dosyalar sunucuda saklanmaz. Beklenen sütunlar: Küpe Numarası, Tür, Irk, Cinsiyet, Doğum Tarihi, İl, İlçe, Mahalle, İşletme Sahibi Kişi/Firma, Bulunduğu İşletme; "T.C. kimlik no" sütunu varsa eşleştirmede kullanılır.
- **Kayıtlar değişmez:** her hesaplama yeni kayıttır; bir işletmenin değeri her zaman en güncel kaydından okunur. Silme yalnızca Sistem Yöneticisi.
- **Otomatik eşleştirme:** kayıttan sonra (ve çiftçi kaydedildiğinde) işletmeler çiftçilerle eşleştirilir: T.C. kimlik no aynıysa ya da ad soyad + ilçe + köy/mahalle aynıysa bağlanır; yalnızca ad soyad ve ilçe tutuyorsa çiftçi sayfasında öneri olarak çıkar. Karşılaştırmada büyük/küçük harf, Türkçe karakter ve "Mahallesi/Köyü" ekleri dikkate alınmaz. Kaldırılan otomatik bağ yeniden kurulmaz.
- **Aile işletmesi:** çiftçi sayfasında eşinin, babasının vb. işletmeleri yakınlığıyla birlikte eklenir; çiftçinin BBHB'si bağlı işletmelerin toplamıdır.
- **Başvuru girişi değişmez:** yürütücü beyan edilen hayvan sayılarını eskisi gibi girer. Değerlendirmede beyanın yanında BBHB kaydı (büyükbaş, küçükbaş, BBHB) görünür; "Değerlere aktar" ile hayvan sayıları kayda göre düzeltilir (eski değer geçmişte kalır).
- **Formül değişkenleri:** `bbhb` (bağlı işletmelerin toplamı), `bbhb_var`, `bbhb_beyan` (beyan edilen sayılar × Ayarlar > Hayvan türleri'ndeki BBHB katsayısı), `bbhb_gecerli` (kayıt varsa kayıt, yoksa beyan), `bbhb_buyukbas`, `bbhb_kucukbas`.
- **Ot ihtiyacı:** proje formundaki "Ot ihtiyacı formülleri" düğmesi `bbhb_gecerli * 12.5 * 365` (1 BBHB, günde ≈12,5 kg kuru madde), yalnız beyanla `bbhb_beyan * 12.5 * 365` ve `ot_acigi = ot_ihtiyaci - kuru_ot_uretimi` formüllerini ekler; değerler değiştirilebilir.

### Uygulama ve formlar

TAKE 2026 Uygulama Talimatı ekleri sisteme uyarlanmıştır. Her form tek bir belge tanımından PDF (tarayıcıda açılır), Word ve Excel olarak üretilir (`src/core/belge.js`).

- **Formlar sayfası** (menü › Formlar, proje sayfasındaki "Formlar" düğmesi): proje ve ilçe seçilir; liste formları ile her başvurunun formları tek yerde.
  - **EK-1 Hibe desteği başvuru formu:** üretici bilgileri (cinsiyet, istihdam, adres, telefon) ve arazi tablosu (köy, ada, parsel, bitki türü, alan, tohum/fide/fidan miktarı, sulama, aşı yapılacak ağaç, ekilmeyen alan). Girdi miktarı kalemin teslim miktarının parsellere alan oranında bölünmesiyle bulunur; TOPLAM satırında ürün bazında yazılır (EK-2'de de aynı).
  - **EK-2 Hibe desteği sözleşmesi:** talimattaki sözleşme metni; ilçe müdürlüğü, üretici, destek türü (başvurudaki kalem türleri), hibe oranı (100 − çiftçi katkı oranı), parsel ve girdi tablosu (bitki türü çeşidiyle: "Silajlık Mısır (AGA)"), yıl ve dönem (projeden), yetkili mahkeme doldurulur. "Hazırla" ekranında sözleşme tarihi ve ilçe müdürü girilir; tarih girilmezse gün/ay boş, yıl projeden yazılır.
  - **İlçe müdürleri:** Formlar sayfasında ilçe bazında kayıtlıdır (sözleşme imzası). İlçe sorumlusu (ilçesi kendisine bağlı kişi), genel ayar yetkisi olan ya da Sistem Yöneticisi düzenler; çıktı alınırken yalnızca o çıktı için değiştirilebilir.
  - **EK-3 Kesin icmal:** desteklenen/teslim edilen başvurular; talimattaki sütunlar (doğum tarihi, cinsiyet 1/0, sulama 1/0, işlenmeyen/nadas/uygun olmayan alan, istihdam, teslim edilen girdi, proje tutarı, hibe tutarı), TOPLAM satırı ve komisyon imzaları. Destek icmali sayfasından da alınır.
  - **EK-4 Teslim tutanağı:** teslim edilen girdi miktarları, teslim tarihi ve teslim eden yetkili.
  - **EK-5 Arazi kontrol tutanağı:** her saha kontrolü için doldurulmuş hâli ya da sahada elle doldurulacak boş hâli.
  - **Arazi kontrol raporu:** kontrol listesi (ziyaret tarihi, fotoğraf eklendi mi, görüşler) ve kontrol edilen üretici oranı (talimat gereği asgari %50).
  - **Asıl ve yedek liste:** ilçe bazında; yedekler puana göre sıralı. Her ilçenin listesini ilçe proje uygulama birimi (teknik personel ve birim başkanı ilçe müdürü) imzalar, sonda il proje uygulama komisyonunun onayı yer alır.
  - **İl proje uygulama komisyonu** (talimat md. 4/e) il müdürlüğünce oluşturulur: il müdürü ya da yardımcısı başkanlığında şube müdürü, ilçe müdürleri ve en az iki ziraat mühendisi. Üyeler ve başkan proje formunun Formlar bölümünde girilir; EK-3 ve asıl/yedek listede üyeler üstte, başkan altta ortada imzalar.
- **EK-1 üretici bilgileri** yalnızca dış çerçeveli, eşit iki yarıda; etiketler tek sütunda, değerler ":" ile hizalı. Adres 6, imza 7 satırlık alan kaplar.
- **EK-4 ve EK-5'teki etiket kutuları** (teslim alan/eden, üretici bilgileri, düzenleyenler) EK-1 düzeninde ama çerçevesizdir. EK-5'in parsel tablosu çizgilidir.
- **Üretici katkı payı dilekçesi:** ödeme sırasında dekontla verilir. Bireysel (başvuru sayfası › Formlar) ya da toplu (Formlar sayfası, proje/ilçe) alınır. Her üretici için bitki türü, miktar (ambalajıyla), birim fiyat, toplam tutar, hibe payı ve üretici payı; TOPLAM satırı; "banka dekontu ekte" ibaresi. Toplu dilekçede yatıran kısmı boştur (herhangi bir üretici yatırabilir). Yatırılacak hesap proje formunun Formlar bölümünde girilir.
- **EK-5 düzenleyenler** ve toplu dilekçenin yatıran kısmı sayfanın en altına sabitlenir (elle doldurulur).
- **Alt bilgi** "proje kısa adı | T.C. - ad soyad | form adı" biçimindedir (ör. "Ek-5 Tohum Hibe Desteğine Esas Arazi Kontrol Tutanağı").
- **Önizle ve düzenle:** her formun PDF/Word/Excel düğmelerinin yanında kalem simgesi; form tarayıcıda kâğıt görünümünde açılır, metinler üzerine tıklanarak değiştirilir ("Düzenlemek için metnin üzerine tıklayın"), "Yazdır / PDF olarak kaydet" ile alınır. Değişiklikler kaydedilmez.
- **Kurum logosu:** Ayarlar › Genel'de yüklenir (PNG/JPEG) ve yanındaki yazı girilir; proje izleme formunun ve il müdürlüğü yazısının başında yer alır, tüm projelerde kullanılır.
- **İzleme raporları:** proje izleme formu kaydedilir (izleme tarihi, yürütenler, cevaplar, saha fotoğrafı adedi); kayıtlar listelenir, yeniden açılıp düzenlenir, yeniden alınır, imzalı taraması (PDF/resim) yüklenir. Yürütenler projenin yürütücülerinden (varsayılan seçili), koordinatörlerinden ya da diğer personelden işaretlenir. Formun sonunda "Saha fotoğrafları (… adet) ektedir." yazar.
- **Süreç (proje sayfası):** adımlar Ayarlar › Süreç'te tanımlanır (ad, açıklama, sorumlu, alt adım, sıra, durum bilgisi). Sorumlu **İl** ise koordinatör işaretler; **İlçe** ise yürütücü "yapıldı" der, koordinatör onaylar; **İl-İlçe** ise önce yürütücü, sonra koordinatör işaretler. Koordinatör, yürütücü kısmı tamamlanmadan onaylayamaz; onaylanmış adımı yürütücü geri alamaz. Kişi hem koordinatör hem yürütücüyse (ya da projeye yürütücü atanmamışsa) iki kısmı birlikte işaretler. Alt adımları olan ana adım (ör. "İlçe müdürlükleriyle yazışmalar": fikir, ön talep, talep yazısı; "Başvurular değerlendirildi": ön değerlendirme, ilçe ara değerlendirmesi, onay) alt adımlar bitince tamamlanır. Her adıma not düşülür; yanında sistemdeki kayıtlardan durum ve ilgili formun bağlantısı görünür. Kişi hem koordinatör hem yürütücüyse ekipte ve seçimlerde koordinatörlerde gösterilir.
- **İzleme raporu silinmez:** yürütücü gerekçe yazarak pasife alınmasını önerir, koordinatör not yazarak onaylar ya da reddeder (koordinatör doğrudan pasife alabilir, yeniden etkinleştirebilir). Pasif raporlar soluk görünür ve süreçteki sayıma girmez.
- **İlçe uygulamasından uyarlanan formlar** (her proje için):
  - **Katkı payı icmal listesi:** çiftçi adına göre alfabetik; ilçe, mahalle, ekilecek alan, ambalaj (torba/çuval) sayısı, çiftçi payı ve dekont açıklaması (İlçe, Proje kodu, Üretici, Miktar). Dekontlar bu sırayla dizilir. Excel ve imzalı PDF.
  - **İlçe teslim tutanağı:** yüklenicinin il müdürlüğü adına ilçe müdürlüğüne teslim ettiği girdi ("… 53 torba … tohumu teslim edilmiştir"); ilçe başına bir sayfa; teslim eden yüklenici, teslim alan ilçe müdürü.
  - **Proje izleme formu (BÜGEM):** proje bilgileri, bütçe (B-Bakanlık, Y-Yerel katkı) ve gerçekleşmesi, uygulama yerleri, izleme faaliyetini yürütenler; Evet/Hayır soruları "Hazırla" ekranında işaretlenir; faaliyet çıktıları ve bütçe tablosu başvurulardan hesaplanır.
  - **Çiftçi talepleri ve katkı payı ödemesi yazısı** (il müdürlüğünden ilçelere, EBYS'ye aktarılacak taslak): torba fiyatı, toplam torba, torba başına katkı payı, hesap bilgisi, dekont açıklaması kuralı, ilçelerden istenecek evrak, son tarih, imzacı, dağıtım; ekinde ilçe ilçe çiftçi listesi.
- **Katkı payı hesabı:** varsayılan hesap Ayarlar › Genel'dedir (banka/şube, alıcı, IBAN); proje için farklıysa projenin Formlar bölümünde yazılır. Projede ayrıca dekont açıklamasındaki **proje kodu** (ör. Mısır-01) ve girdiyi ilçelere teslim eden **yüklenici** girilir.
- **Teslim miktarı** içerik ve ambalajıyla yazılır: "520 kg (13 çuval)", "50.000 adet (1 torba)" (EK-4 metni, EK-1/EK-2 toplam satırı).
- **EK-2, EK-4, EK-5** başvuru desteklendi ya da teslim aşamasına geçince açılır; öncesinde başvuru sayfasında ve Formlar sayfasında "karardan sonra" olarak görünür. Doldurulmuş EK-5 her saha kontrolünün yanında, boş EK-5 Formlar kartındadır.
- **Excel çıktıları** eşit genişlikte bir ızgaraya yerleşir (dikey 40, yatay 60 sütun); her tablo sütunu genişliği oranında birden çok hücreyi birleştirerek kaplar. Böylece aynı sayfadaki tablolar ve imza blokları birbirinin sütun genişliğini bozmaz.
- **Form başlıkları:** program/kaynak adı (formların üst başlığı ve EK-2'deki "… kapsamında kaynak gönderilen" ifadesi) proje formundaki **Destek kaynağı** alanından gelir. Proje formunun "Formlar" bölümünde destek türü (boşsa kalem türlerinden), müdürlük, yetkili mahkeme, dönem (boşsa proje döneminden: Güz/Bahar), komisyon başkanı ve üyeleri girilir; boş bırakılanlar formda doldurulacak nokta olarak çıkar.
- **Başvuruya eklenen bilgiler:** çiftçide cinsiyet, doğum tarihi, istihdam edilen kişi sayısı; parselde sulama (kuru/sulu) ve arazi durumu (işlenen, işlenmeyen, nadas, işlemeli tarıma uygun olmayan); başvuruda bu yıl ekim yapılmayan toplam alan.
- **Uygulama kartı** (desteklenen başvuruda): katkı payı yatırma tarihi ve makbuz no, sözleşme tarihi; "Teslim edildi" işleminde teslim tarihi ve teslim eden kendiliğinden yazılır. Değişiklikler geçmişe işlenir.
- **Saha kontrolleri:** kontrol tarihi, kontrol edenler, parsel bazında ekim tarihi ve uygunluk, ekim normuna uygunluk, çıkış/tutma oranı, kültürel işlemler, görüş ve fotoğraflar. Her kayıt EK-5'e ve kontrol raporuna aktarılır.
- **Yeni formlar** `src/moduller/belgeler/formlar.js` dosyasına aynı belge modeliyle eklenir; üç biçim de kendiliğinden çıkar.

### Kişiler, roller ve görevler

- **Roller ve yetkiler:** roller Ayarlar > Roller ve yetkiler'den eklenir, adlandırılır, renklendirilir ve silinir (kişisi ya da görevi olan rol silinemez). Her role işaretlenerek yetki verilir: Genel Bakış, projeleri görme/yönetme, talep görme/girme, başvuru değerlendirme, BBHB görme/hesaplama, çiftçi görme/yönetme, tüm görevleri görme, görev verme, ayarlar (genel, katalog, kişi ve roller). "İlçe kısıtlı" roldeki kişiler yalnızca sorumlu oldukları ilçelerin çiftçisini ve talebini girer. "Proje kısıtlı" roldeki kişiler yalnızca koordinatörü ya da yürütücüsü oldukları projeleri, bu projelerin başvurularını, değerlendirmesini, formlarını ve görevlerini görür (atama proje formunun ekip bölümünden). Hazır roller: İş Planı, Proje Koordinatörü, Proje Yürütücüsü.
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
| Roller ve yetkiler | Rol ekleme, silme, renk, ilçe ve proje kısıtı, yetkiler; Sistem Yöneticisi |
| Yürütücü birimler | Projeleri yürüten birimler |
| Dönemler | Dönem adı, başlangıç/bitiş, yeni projede seçili gelecek varsayılan dönem |
| Ürün kataloğu | Türe göre ürünler; dağıtım birimi, ambalaj içeriği, normların varsayılan değer ve birimleri; çeşitler ve çeşide özel değerler |
| Hesaplama normları | Talep birimi başına tanımlanan değerler ve hesaptaki rolleri |
| Talep birimleri | Talep ve parsellerin birimleri (da, adet, m²) |
| Hayvan türleri | Talepte sorulan hayvan varlığı türleri ve birimleri |
| Kalem türleri, dağıtım birimleri, ilçeler | Formlardaki seçim listeleri (dağıtım birimi: çuval, paket, torba, top, adet); kalem türlerinde normsuz olanlar işaretlenir |

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
git clone https://github.com/porsuktasarim/tarimsal-proje-takip.git
cd tarimsal-proje-takip
docker compose up -d --build
```

Uygulama `http://<sunucu-ip>:1763` adresinden açılır. Veriler `tpts-veri` Docker biriminde saklanır.

### Güncelleme

Coolify ile kuruluysa GitHub'daki `main` dalına gönderilen her sürüm Coolify tarafından kendiliğinden kurulur (Coolify > uygulama > Advanced > Deployment > Auto deploy). Veritabanı birimi korunur; göçler uygulama açılırken kendiliğinden çalışır. `docker-compose.yml`'de `${...}` değişkenli birim yolu kullanılmamalıdır; Coolify bu dosyayı güvenlik gereği yüklemez.

Elle güncelleme:

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
    belge.js                Belge motoru: tek modelden PDF, Word, Excel
  views/                    Ortak şablonlar (üst/alt bölüm, bildirimler, hata sayfası)
  moduller/
    genel-bakis/            Toplu istatistik ve son durum panosu
    projeler/               Proje modeli, norm, miktar ve bütçe hesapları (hesap.js), sayfalar
    talepler/               Çiftçi talepleri, başvuru akışı (akis.js) ve geçmiş
    degerlendirme/          Değerlendirme sayfası ve destek icmali
    belgeler/               Uygulama talimatı formları (EK-1…EK-5, kontrol raporu, asıl/yedek liste)
    ciftciler/              Çiftçi kaydı, çiftçi icmali ve bağlı işletmeler
    bbhb/                   BBHB hesaplama (misweb'den), Türkvet içe aktarma, işletme eşleştirme
    gorevler/               Görev modeli ve sayfaları
    ayarlar/                Ayar, Ürün ve Kişi modelleri, ayar sayfaları
public/                     Uygulamaya özel CSS, JS, simge
```

## Veri modeli

| Koleksiyon | İçerik |
|---|---|
| `dosyalar.files`, `dosyalar.chunks` | Yüklenen dosyalar (GridFS): proje metinleri |
| `bbhb_sonuclari` | Değişmez BBHB hesaplamaları: kaynak (manuel/Türkvet), yaş referans tarihi, bölüm (il/ilçe/mahalle), işletmeci sonuçları (işletme no, ad, T.C., kategori detayları, toplam) |
| `ayarlar` | Tek belge (`_id: genel`): kurum, il, birimler, dönemler, ilçeler, kalem türleri, ölçü birimleri, norm tanımları |
| `urunler` | Ürün kataloğu: tür, ad, dağıtım birimi, ambalaj, normlar `{ kod: { deger, birim } }`, çeşitler (kendi normları ve ambalajıyla) |
| `projeler` | Proje bilgileri, kalemler (ürün kimliği, ürün, çeşit, alan, dağıtım birimi, ambalaj, normlar), ilçe hedefleri, proje ekibi |
| `ciftciler` | Çiftçiler: T.C. kimlik no, ad soyad, iletişim, ilçe, mahalle/köy, ÇKS |
| `talepler` | Çiftçi talepleri: proje, çiftçi, ilçe, talep edilen miktarlar (kalem, miktar), parsel satırları (kalem, ilçe, mahalle, ada, parsel, en, boy, miktar), durum |
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
- Gerçekleşen verimlerin girilmesi ve hedeflerle karşılaştırılması
- Süreç ilerledikçe çıkacak diğer formlar (aynı belge motoruyla)
- Rollere göre ekranlar ve yetkiler; isteğe bağlı şifreli giriş

## Lisans

Kurum içi kullanım için geliştirilmiştir.
