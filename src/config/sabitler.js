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

  kalemTurleri: ['Tohum', 'Fide', 'Fidan', 'Gübre', 'Ekipman', 'Diğer'],

  olcuBirimleri: ['kg', 'adet', 'paket', 'litre', 'ton'],

  // tip: ekim  -> dekar başına verilecek kalem miktarı (dağıtım ihtiyacını hesaplar)
  //      cikti -> dekar başına beklenen üretim (hedef çıktıyı hesaplar)
  //      bilgi -> yalnızca kayıt amaçlı, hesaba girmez
  normlar: [
    { kod: 'ekim_normu', ad: 'Ekim normu', birim: 'kg/da', tip: 'ekim' },
    { kod: 'yesil_ot_verimi', ad: 'Yeşil ot verimi', birim: 'kg/da', tip: 'cikti' },
    { kod: 'kuru_ot_verimi', ad: 'Kuru ot verimi', birim: 'kg/da', tip: 'cikti' },
    { kod: 'tane_verimi', ad: 'Tane verimi', birim: 'kg/da', tip: 'cikti' },
    { kod: 'silaj_verimi', ad: 'Silaj verimi', birim: 'kg/da', tip: 'cikti' }
  ]
};

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

module.exports = { varsayilanlar, normTipleri, projeDurumlari };
