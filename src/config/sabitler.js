// Sabit değerler ve ilk kurulum varsayılanları.
// Birimler, dönemler, ilçeler, kalem türleri, ölçü birimleri ve normlar
// Ayarlar sayfasından yönetilir; buradaki listeler yalnızca veritabanında
// ayar kaydı yokken ilk kayıt olarak kullanılır.

const varsayilanlar = {
  kurum: 'İstanbul İl Tarım ve Orman Müdürlüğü',
  il: 'İstanbul',
  // Proje süreci (Ayarlar › Süreç'ten düzenlenir). yapan: adımı yapan roller; onaylayan: (isteğe bağlı)
  // yapan işaretledikten sonra onaylayan roller. alt: bir önceki ana adımın alt adımı.
  // veri: proje sayfasında gösterilecek durum bilgisi ve form bağlantısı.
  surecAdimlari: [
    { kod: 'metin', ad: 'Proje metni yüklendi', yapan: ['koordinator'], veri: 'metin', aciklama: 'Değerlendirme için zorunludur.' },
    { kod: 'yazismalar', ad: 'İlçe müdürlükleriyle yazışmalar' },
    { kod: 'fikir-yazisi', ad: 'İlçe müdürlüklerine fikir yazısı yazıldı', yapan: ['koordinator'], alt: true },
    { kod: 'on-talep-yazisi', ad: 'Ön talep yazısı yazıldı', yapan: ['koordinator'], alt: true },
    { kod: 'talep-yazisi', ad: 'Talep yazısı yazıldı', yapan: ['koordinator'], alt: true },
    { kod: 'komisyon', ad: 'İl proje uygulama komisyonu oluşturuldu', yapan: ['koordinator'], veri: 'komisyon', aciklama: 'İl müdürünün onayıyla; üyeler proje formunun Formlar bölümüne yazılır.' },
    { kod: 'duyuru', ad: 'Proje duyurusu yapıldı, üreticiler bilgilendirildi', yapan: ['yurutucu'], onaylayan: ['koordinator'], aciklama: 'Talimat md. 8/6.' },
    { kod: 'basvuru', ad: 'Üretici başvuruları alındı (EK-1)', yapan: ['yurutucu'], onaylayan: ['koordinator'], veri: 'basvuru' },
    { kod: 'degerlendirme', ad: 'Başvurular değerlendirildi' },
    { kod: 'on-degerlendirme', ad: 'Ön başvurular değerlendirildi', yapan: ['yurutucu'], onaylayan: ['koordinator'], alt: true },
    { kod: 'ara-degerlendirme', ad: 'İlçe müdürlüğü ara değerlendirmeyi yaptı; asıl ve yedek listeler gönderildi', yapan: ['yurutucu'], onaylayan: ['koordinator'], alt: true },
    { kod: 'karar', ad: 'Başvurular onaylandı (il komisyonu, asıl/yedek liste)', yapan: ['koordinator'], alt: true, veri: 'karar' },
    { kod: 'odeme-yazisi', ad: 'Çiftçi talepleri ve katkı payı ödemesi yazısı ilçelere gönderildi', yapan: ['koordinator'], veri: 'odeme-yazisi' },
    { kod: 'dekont', ad: 'Katkı payı dekontları ve icmal listeleri toplandı', yapan: ['yurutucu'], onaylayan: ['koordinator'], veri: 'dekont', aciklama: 'Alfabetik icmal (Excel ve imzalı PDF) ve aynı sırada taranmış dekontlar.' },
    { kod: 'sozlesme', ad: 'Hibe desteği sözleşmeleri imzalandı (EK-2)', yapan: ['yurutucu'], onaylayan: ['koordinator'], veri: 'sozlesme' },
    { kod: 'ilce-teslim', ad: 'Girdi yükleniciden ilçelere teslim edildi', yapan: ['yurutucu'], onaylayan: ['koordinator'], veri: 'ilce-teslim' },
    { kod: 'teslim', ad: 'Girdi üreticilere teslim edildi (EK-4)', yapan: ['yurutucu'], onaylayan: ['koordinator'], veri: 'teslim' },
    { kod: 'kesin-icmal', ad: 'Kesin icmal (EK-3) düzenlendi', yapan: ['yurutucu'], onaylayan: ['koordinator'], veri: 'kesin-icmal', aciklama: 'Sözleşme imzalayıp girdisini teslim alan üreticiler; ödemeye esas, komisyon imzalı (talimat md. 10).' },
    { kod: 'kontrol', ad: 'Arazi kontrolleri yapıldı (EK-5, kontrol raporu)', yapan: ['yurutucu'], onaylayan: ['koordinator'], veri: 'kontrol', aciklama: 'Üreticilerin en az %50\'si kontrol edilir.' },
    { kod: 'izleme', ad: 'Proje izleme formları düzenlendi', yapan: ['yurutucu'], onaylayan: ['koordinator'], veri: 'izleme', aciklama: 'En az ayda bir; imzalı taramalar yüklenir.' },
    { kod: 'yil-sonu', ad: 'Yıl sonu izleme değerlendirme raporu Bakanlığa gönderildi', yapan: ['koordinator'], aciklama: 'Talimat md. 10/2.' },
    { kod: 'kapanis', ad: 'Proje tamamlandı; sonuç raporu hazırlandı', yapan: ['yurutucu'], onaylayan: ['koordinator'], veri: 'kapanis' }
  ],
  // Üretici katkı paylarının yatırıldığı hesap (il müdürlüğü yazısındaki); projede ayrıca değiştirilebilir
  katkiHesabi: {
    banka: 'T.C. Ziraat Bankası Cağaloğlu Şubesi',
    alici: 'T.C. Başbakanlık Hazine Müsteşarlığı İç Ödemeler Saymanlığı',
    iban: 'TR89 0001 0008 8900 0010 0050 69'
  },

  birimler: ['Çayır Mera ve Yem Bitkileri'],

  donemler: [
    { ad: '2026 Güzlük' },
    { ad: '2027 Yazlık' }
  ],
  varsayilanDonem: '2026 Güzlük',

  ilceler: [
    'Adalar', 'Arnavutköy', 'Ataşehir', 'Avcılar', 'Bağcılar', 'Bahçelievler',
    'Bakırköy', 'Başakşehir', 'Bayrampaşa', 'Beşiktaş', 'Beykoz', 'Beylikdüzü',
    'Beyoğlu', 'Büyükçekmece', 'Çatalca', 'Çekmeköy', 'Esenler', 'Esenyurt',
    'Eyüpsultan', 'Fatih', 'Gaziosmanpaşa', 'Güngören', 'Kadıköy', 'Kağıthane',
    'Kartal', 'Küçükçekmece', 'Maltepe', 'Pendik', 'Sancaktepe', 'Sarıyer',
    'Silivri', 'Sultanbeyli', 'Sultangazi', 'Şile', 'Şişli', 'Tuzla',
    'Ümraniye', 'Üsküdar', 'Zeytinburnu'
  ],

  kalemTurleri: ['Tohum', 'Fide', 'Fidan', 'Gübre', 'Malzeme', 'Makine', 'Ekipman', 'Diğer'],
  // Norm kullanılmayan türler: talep edilen miktar doğrudan dağıtılır (makine, ekipman, sera naylonu)
  normsuzTurler: ['Malzeme', 'Makine', 'Ekipman', 'Diğer'],

  // Çiftçinin talebinin ve parsellerinin hangi birimle girildiği:
  // tohumda dekar, fidan ve fidede adet (tane), sera naylonunda metrekare.
  talepBirimleri: ['da', 'adet', 'm²'],

  // Kalemin çiftçiye dağıtıldığı ambalaj (dağıtım birimi). İçeriği kalemde
  // "1 çuval = 25 kg" ya da "1 paket = 50.000 adet" biçiminde girilir.
  olcuBirimleri: ['çuval', 'paket', 'torba', 'top', 'adet'],

  // tip: ekim  -> dekar başına verilecek kalem miktarı (dağıtım ihtiyacını hesaplar)
  //      cikti -> dekar başına beklenen üretim (hedef çıktıyı hesaplar)
  //      bilgi -> yalnızca kayıt amaçlı, hesaba girmez
  normlar: [
    { kod: 'ekim_normu', ad: 'Ekim normu', birim: 'kg/da', tip: 'ekim' },
    { kod: 'yesil_ot_verimi', ad: 'Yeşil ot verimi', birim: 'kg/da', tip: 'cikti' },
    { kod: 'kuru_ot_verimi', ad: 'Kuru ot verimi', birim: 'kg/da', tip: 'cikti' },
    { kod: 'tane_verimi', ad: 'Tane verimi', birim: 'kg/da', tip: 'cikti' },
    { kod: 'silaj_verimi', ad: 'Silaj verimi', birim: 'kg/da', tip: 'cikti' }
  ],

  // Talep değerlendirmesinde yardımcı bilgi olarak girilen hayvan varlığı
  hayvanTurleri: [
    // bbhbKatsayisi: beyan edilen sayıdan tahmini BBHB (ırk ve yaş bilinmediği için ortalama değer)
    { kod: 'buyukbas', ad: 'Büyükbaş', birim: 'baş', bbhbKatsayisi: 0.75 },
    { kod: 'kucukbas', ad: 'Küçükbaş', birim: 'baş', bbhbKatsayisi: 0.1 },
    { kod: 'ari', ad: 'Arı', birim: 'koloni', bbhbKatsayisi: 0 }
  ],

  // Roller Ayarlar > Roller'den eklenip düzenlenir. "admin" (Sistem Yöneticisi)
  // sabittir: tek kişiye verilir ve tüm yetkilere sahiptir.
  roller: [
    { kod: 'admin', ad: 'Sistem Yöneticisi', aciklama: 'Tüm yetkilere sahiptir; tek kişiye verilir.', renk: 'red', ilceKisitli: false, yetkiler: [] },
    {
      kod: 'yonetici', ad: 'İş Planı', aciklama: 'Yöneticiler. Projelerin toplu istatistiklerini ve son durumunu izler.', renk: 'purple', ilceKisitli: false,
      yetkiler: ['pano.gor', 'proje.gor', 'talep.gor', 'ciftci.gor', 'gorev.gor', 'gorev.ver', 'bbhb.gor']
    },
    {
      kod: 'koordinator', ad: 'Proje Koordinatörü', aciklama: 'İşi yürüten il müdürlüğü personeli.', renk: 'blue', ilceKisitli: false,
      yetkiler: ['pano.gor', 'proje.gor', 'proje.yonet', 'talep.gor', 'talep.gir', 'talep.degerlendir',
        'ciftci.gor', 'ciftci.yonet', 'gorev.gor', 'gorev.ver', 'ayar.genel', 'ayar.katalog', 'bbhb.gor', 'bbhb.hesapla']
    },
    {
      kod: 'yurutucu', ad: 'Proje Yürütücüsü', aciklama: 'Sahada çalışan personel.', renk: 'green', ilceKisitli: true,
      yetkiler: ['pano.gor', 'proje.gor', 'talep.gor', 'talep.gir', 'ciftci.gor', 'ciftci.yonet', 'bbhb.gor']
    }
  ]
};

// Rollere verilebilecek yetkiler. Sistem Yöneticisi hepsine sahiptir.
// Kişi kendisine ya da rolüne verilen görevleri her zaman görür ve durumunu günceller.
const yetkiGruplari = [
  {
    ad: 'Genel Bakış ve projeler',
    yetkiler: [
      { kod: 'pano.gor', ad: 'Genel Bakış panosunu görür' },
      { kod: 'proje.gor', ad: 'Projeleri görür' },
      { kod: 'proje.yonet', ad: 'Proje başlatır, düzenler, durumunu değiştirir' }
    ]
  },
  {
    ad: 'Çiftçiler ve talepler',
    yetkiler: [
      { kod: 'talep.gor', ad: 'Çiftçi taleplerini görür' },
      { kod: 'talep.gir', ad: 'Talep girer ve düzenler' },
      { kod: 'talep.degerlendir', ad: 'Başvuruları değerlendirir: teslim alır, değiştirir, yürütücüye gönderir, karar verir' },
      { kod: 'ciftci.gor', ad: 'Çiftçi kayıtlarını ve icmalini görür' },
      { kod: 'ciftci.yonet', ad: 'Çiftçi kaydı ekler, düzenler' }
    ]
  },
  {
    ad: 'BBHB (büyükbaş hayvan birimi)',
    yetkiler: [
      { kod: 'bbhb.gor', ad: 'BBHB sonuçlarını ve çiftçinin işletmelerini görür' },
      { kod: 'bbhb.hesapla', ad: 'BBHB hesaplar ve kaydeder (manuel, Türkvet dosyası), işletmeleri çiftçilerle eşleştirir' }
    ]
  },
  {
    ad: 'Görevler',
    yetkiler: [
      { kod: 'gorev.gor', ad: 'Tüm görevleri görür' },
      { kod: 'gorev.ver', ad: 'Görev verir, düzenler' }
    ]
  },
  {
    ad: 'Ayarlar',
    yetkiler: [
      { kod: 'ayar.genel', ad: 'Genel, birimler, dönemler, ilçeler' },
      { kod: 'ayar.katalog', ad: 'Ürün kataloğu, normlar, hayvan türleri, kalem türleri, ölçü birimleri' },
      { kod: 'ayar.kisi', ad: 'Kişiler ve roller' }
    ]
  }
];
const tumYetkiler = yetkiGruplari.flatMap((g) => g.yetkiler.map((y) => y.kod));

const rolRenkSecenekleri = ['blue', 'azure', 'indigo', 'purple', 'pink', 'red', 'orange', 'yellow', 'lime', 'green', 'teal', 'cyan', 'secondary'];

// Norm birimi alanlarında öneri olarak gösterilir; elle başka birim de yazılabilir.
const normBirimOnerileri = ['kg/da', 'adet/da', 'g/da', 'fide/da', 'litre/da', 'ton/da'];

// Ambalaj içeriğinin birimi (1 paket = 50.000 adet, 1 çuval = 25 kg ...).
// Ekim normunun birimi bu birime bağlıdır: içerik adet ise adet/da, kg ise kg/da.
const ambalajBirimleri = ['kg', 'adet', 'g', 'fide', 'litre', 'm²', 'm'];

const normTipleri = {
  ekim: { ad: 'Ekim / uygulama normu', aciklama: 'Dekar başına verilecek miktar; dağıtım ihtiyacı hesaplanır', renk: 'green' },
  cikti: { ad: 'Çıktı (verim)', aciklama: 'Dekar başına beklenen üretim; hedef çıktı hesaplanır', renk: 'blue' },
  bilgi: { ad: 'Bilgi', aciklama: 'Kayıt amaçlı, hesaba girmez', renk: 'secondary' }
};

const projeDurumlari = {
  taslak: { ad: 'Taslak', renk: 'secondary' },
  aktif: { ad: 'Yürütülüyor', renk: 'green' },
  tamamlandi: { ad: 'Tamamlandı', renk: 'blue' },
  iptal: { ad: 'İptal', renk: 'red' }
};


const gorevDurumlari = {
  bekliyor: { ad: 'Bekliyor', renk: 'secondary', ikon: 'ti-clock' },
  suruyor: { ad: 'Sürüyor', renk: 'blue', ikon: 'ti-progress' },
  tamamlandi: { ad: 'Tamamlandı', renk: 'green', ikon: 'ti-circle-check' },
  iptal: { ad: 'İptal', renk: 'red', ikon: 'ti-circle-x' }
};

// Başvuru aşamaları:
//   taslak → (yürütücü gönderir) gonderildi → (koordinatör teslim alır) incelemede
//   incelemede ⇄ yurutucude (ön inceleme sonrası yürütücü görüşü; gerektiği kadar tekrarlanır)
//   incelemede → desteklendi | yedek | desteklenmedi (kesin karar) → teslim (dağıtım)
const talepDurumlari = {
  taslak: { ad: 'Taslak', uzun: 'Yürütücüde taslak', renk: 'secondary', ikon: 'ti-pencil' },
  gonderildi: { ad: 'Gönderildi', uzun: 'Koordinatöre gönderildi', renk: 'cyan', ikon: 'ti-send' },
  incelemede: { ad: 'İncelemede', uzun: 'Değerlendirmede', renk: 'blue', ikon: 'ti-zoom-check' },
  yurutucude: { ad: 'Yürütücüde', uzun: 'Yürütücü görüşü bekleniyor', renk: 'orange', ikon: 'ti-message-question' },
  desteklendi: { ad: 'Desteklendi', uzun: 'Desteklenmesine karar verildi', renk: 'green', ikon: 'ti-circle-check', karar: true },
  yedek: { ad: 'Yedek', uzun: 'Yedek listede', renk: 'yellow', ikon: 'ti-hourglass', karar: true },
  desteklenmedi: { ad: 'Desteklenmedi', uzun: 'Desteklenmemesine karar verildi', renk: 'red', ikon: 'ti-circle-x', karar: true },
  teslim: { ad: 'Teslim edildi', uzun: 'Destek teslim edildi', renk: 'teal', ikon: 'ti-truck-delivery' }
};
// Başvuru özetlerinde sayılmayanlar ve destek icmaline girenler
const sayilmayanAsamalar = ['desteklenmedi'];
const icmalAsamalari = ['desteklendi', 'teslim'];


const oncelikler = {
  dusuk: { ad: 'Düşük', renk: 'secondary' },
  normal: { ad: 'Normal', renk: 'blue' },
  yuksek: { ad: 'Yüksek', renk: 'orange' },
  acil: { ad: 'Acil', renk: 'red' }
};

module.exports = {
  varsayilanlar, normTipleri, normBirimOnerileri, ambalajBirimleri, projeDurumlari,
  gorevDurumlari, oncelikler, talepDurumlari, sayilmayanAsamalar, icmalAsamalari, yetkiGruplari, tumYetkiler, rolRenkSecenekleri
};
