// Çiftçiler modülü: projelerden bağımsız çiftçi kaydı ve çiftçi icmali.

module.exports = {
  slug: 'ciftciler',
  ad: 'Çiftçiler',
  sira: 22,
  menu: [
    { ad: 'Çiftçiler', yol: '/ciftciler', ikon: 'ti-users' }
  ],
  router: require('./routes').router
};
