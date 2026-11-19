// Formlar modülü: uygulama talimatı eklerinin (EK-1 … EK-5, kontrol raporu,
// asıl/yedek liste) PDF, Word ve Excel çıktısı. Yeni formlar formlar.js'e eklenir.

module.exports = {
  slug: 'belgeler',
  ad: 'Formlar',
  sira: 22,
  menu: [
    { ad: 'Formlar', yol: '/belgeler', ikon: 'ti-file-description', yetki: 'talep.gor' }
  ],
  router: require('./routes')
};
