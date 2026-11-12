// Talepler modülü: ilçelerin çiftçi taleplerini (parsel, alan, kalem) projeye girmesi.

module.exports = {
  slug: 'talepler',
  ad: 'Talepler',
  sira: 20,
  menu: [
    { ad: 'Çiftçi talepleri', yol: '/talepler', ikon: 'ti-clipboard-list' }
  ],
  router: require('./routes')
};
