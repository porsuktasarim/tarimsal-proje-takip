// Projeler modülü: proje başlatma, listeleme, düzenleme.
// Diğer modüller (başvurular, dağıtım, raporlar vb.) projelere bu modülün
// "Proje" modeli üzerinden bağlanır.

module.exports = {
  slug: 'projeler',
  ad: 'Projeler',
  sira: 10,
  menu: [
    { ad: 'Projeler', yol: '/projeler', ikon: 'ti-folders' },
    { ad: 'Proje Başlat', yol: '/projeler/yeni', ikon: 'ti-circle-plus' }
  ],
  router: require('./routes')
};
