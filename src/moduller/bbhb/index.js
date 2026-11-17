// BBHB (Büyükbaş Hayvan Birimi) modülü — Mera İzleme Sistemi (misweb) BBHB modülünden
// alınmıştır: manuel giriş ve Türkvet dosyasıyla hesaplama, kayıtlı sonuçlar.
// Eklemeler: işletmelerin çiftçilerle otomatik eşleştirilmesi (T.C., ad soyad + köy),
// aile işletmesi için çiftçiye birden fazla işletme bağlanması.

module.exports = {
  slug: 'bbhb',
  ad: 'BBHB',
  sira: 35,
  menu: [{ ad: 'BBHB hesaplama', yol: '/bbhb', ikon: 'ti-horse', yetki: 'bbhb.gor' }],
  router: require('./routes')
};
