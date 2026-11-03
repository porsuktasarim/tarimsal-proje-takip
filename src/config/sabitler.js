// İl genelindeki sabit listeler. Birimler ve kalem türleri ileride
// "Ayarlar" modülüne taşınabilir; şimdilik buradan yönetilir.

const ilceler = [
  'Adalar', 'Arnavutköy', 'Ataşehir', 'Avcılar', 'Bağcılar', 'Bahçelievler',
  'Bakırköy', 'Başakşehir', 'Bayrampaşa', 'Beşiktaş', 'Beykoz', 'Beylikdüzü',
  'Beyoğlu', 'Büyükçekmece', 'Çatalca', 'Çekmeköy', 'Esenler', 'Esenyurt',
  'Eyüpsultan', 'Fatih', 'Gaziosmanpaşa', 'Güngören', 'Kadıköy', 'Kağıthane',
  'Kartal', 'Küçükçekmece', 'Maltepe', 'Pendik', 'Sancaktepe', 'Sarıyer',
  'Silivri', 'Sultanbeyli', 'Sultangazi', 'Şile', 'Şişli', 'Tuzla',
  'Ümraniye', 'Üsküdar', 'Zeytinburnu'
];

const birimler = [
  'Çayır Mera ve Yem Bitkileri'
];

const kalemTurleri = ['Tohum', 'Fide', 'Fidan', 'Gübre', 'Ekipman', 'Diğer'];

const olcuBirimleri = ['kg', 'adet', 'paket', 'litre', 'ton'];

const projeDurumlari = {
  taslak: { ad: 'Taslak', renk: 'secondary' },
  aktif: { ad: 'Yürütülüyor', renk: 'green' },
  tamamlandi: { ad: 'Tamamlandı', renk: 'blue' },
  iptal: { ad: 'İptal', renk: 'red' }
};

module.exports = { ilceler, birimler, kalemTurleri, olcuBirimleri, projeDurumlari };
