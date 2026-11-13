// Değerlendirme modülü: projeye gelen başvuruların tek sayfada değerlendirilmesi
// (teslim alma, değer değişikliği, yürütücüye gönderme, karar) ve destek icmali.

module.exports = {
  slug: 'degerlendirme',
  ad: 'Değerlendirme',
  sira: 21,
  menu: [
    { ad: 'Değerlendirme', yol: '/degerlendirme', ikon: 'ti-list-check', yetki: 'talep.degerlendir' },
    { ad: 'Destek icmali', yol: '/degerlendirme/icmal', ikon: 'ti-report-money', yetki: 'talep.gor' }
  ],
  router: require('./routes')
};
