// Sabit değerler ve ilk kurulum varsayılanları.
// Birimler, dönemler, ilçeler, kalem türleri, ölçü birimleri ve normlar
// Ayarlar sayfasından yönetilir; buradaki listeler yalnızca veritabanında
// ayar kaydı yokken ilk kayıt olarak kullanılır.

const varsayilanlar = {
  kurum: 'İstanbul İl Tarım ve Orman Müdürlüğü',
  il: 'İstanbul',

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
    { kod: 'buyukbas', ad: 'Büyükbaş', birim: 'baş' },
    { kod: 'kucukbas', ad: 'Küçükbaş', birim: 'baş' },
    { kod: 'ari', ad: 'Arı', birim: 'koloni' }
  ],

  // Roller Ayarlar > Roller'den eklenip düzenlenir. "admin" (Sistem Yöneticisi)
  // sabittir: tek kişiye verilir ve tüm yetkilere sahiptir.
  roller: [
    { kod: 'admin', ad: 'Sistem Yöneticisi', aciklama: 'Tüm yetkilere sahiptir; tek kişiye verilir.', renk: 'red', ilceKisitli: false, yetkiler: [] },
    {
      kod: 'yonetici', ad: 'İş Planı', aciklama: 'Yöneticiler. Projelerin toplu istatistiklerini ve son durumunu izler.', renk: 'purple', ilceKisitli: false,
      yetkiler: ['pano.gor', 'proje.gor', 'talep.gor', 'ciftci.gor', 'gorev.gor', 'gorev.ver']
    },
    {
      kod: 'koordinator', ad: 'Proje Koordinatörü', aciklama: 'İşi yürüten il müdürlüğü personeli.', renk: 'blue', ilceKisitli: false,
      yetkiler: ['pano.gor', 'proje.gor', 'proje.yonet', 'talep.gor', 'talep.gir', 'talep.onayla', 'talep.sil',
        'ciftci.gor', 'ciftci.yonet', 'gorev.gor', 'gorev.ver', 'ayar.genel', 'ayar.katalog']
    },
    {
      kod: 'yurutucu', ad: 'Proje Yürütücüsü', aciklama: 'Sahada çalışan personel.', renk: 'green', ilceKisitli: true,
      yetkiler: ['pano.gor', 'proje.gor', 'talep.gor', 'talep.gir', 'ciftci.gor', 'ciftci.yonet']
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
      { kod: 'talep.onayla', ad: 'Talebi onaylar, reddeder, teslim edildi yapar' },
      { kod: 'talep.sil', ad: 'Talep siler' },
      { kod: 'ciftci.gor', ad: 'Çiftçi kayıtlarını ve icmalini görür' },
      { kod: 'ciftci.yonet', ad: 'Çiftçi kaydı ekler, düzenler, siler' }
    ]
  },
  {
    ad: 'Görevler',
    yetkiler: [
      { kod: 'gorev.gor', ad: 'Tüm görevleri görür' },
      { kod: 'gorev.ver', ad: 'Görev verir, düzenler, siler' }
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

const talepDurumlari = {
  alindi: { ad: 'Talep alındı', renk: 'secondary', ikon: 'ti-inbox' },
  onaylandi: { ad: 'Onaylandı', renk: 'green', ikon: 'ti-circle-check' },
  teslim: { ad: 'Teslim edildi', renk: 'blue', ikon: 'ti-truck-delivery' },
  reddedildi: { ad: 'Reddedildi', renk: 'red', ikon: 'ti-circle-x' }
};

const oncelikler = {
  dusuk: { ad: 'Düşük', renk: 'secondary' },
  normal: { ad: 'Normal', renk: 'blue' },
  yuksek: { ad: 'Yüksek', renk: 'orange' },
  acil: { ad: 'Acil', renk: 'red' }
};

module.exports = {
  varsayilanlar, normTipleri, normBirimOnerileri, ambalajBirimleri, projeDurumlari,
  gorevDurumlari, oncelikler, talepDurumlari, yetkiGruplari, tumYetkiler, rolRenkSecenekleri
};
