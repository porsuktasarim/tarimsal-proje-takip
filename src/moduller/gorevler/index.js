// Görevler modülü: kişilere ya da rollere görev verme, durum ve not takibi.

module.exports = {
  slug: 'gorevler',
  ad: 'Görevler',
  sira: 30,
  menu: [
    { ad: 'Görevler', yol: '/gorevler', ikon: 'ti-checklist' }
  ],
  router: require('./routes')
};
