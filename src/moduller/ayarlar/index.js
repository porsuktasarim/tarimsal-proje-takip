// Ayarlar modülü: yürütücü birimler, dönemler, ürün kataloğu, hesaplama
// normları ve diğer listeler. Yeni ayar bölümleri bu modüle eklenir.

module.exports = {
  slug: 'ayarlar',
  ad: 'Ayarlar',
  sira: 90,
  menu: [
    { ad: 'Ayarlar', yol: '/ayarlar', ikon: 'ti-settings' }
  ],
  router: require('./routes')
};
