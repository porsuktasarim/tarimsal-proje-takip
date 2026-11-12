// Genel Bakış: projelerin toplu istatistikleri ve son durumu.
// Yöneticilerin (İş Planı) ana ekranıdır; herkes kendi açık görevlerini de burada görür.

module.exports = {
  slug: 'genel-bakis',
  ad: 'Genel Bakış',
  sira: 5,
  menu: [
    { ad: 'Genel Bakış', yol: '/genel-bakis', ikon: 'ti-chart-pie', yetki: 'pano.gor' }
  ],
  router: require('./routes')
};
