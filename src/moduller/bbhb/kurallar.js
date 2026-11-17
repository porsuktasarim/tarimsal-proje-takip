/**
 * kurallar.js — Mera İzleme Sistemi (misweb) BBHB modülünden alınmıştır
 *
 * BBHB katsayi tablosu. Kanuni/bilimsel esaslara dayanir.
 * Bu dosya SADECE veri icerir - hesaplama mantigi bbhb.core.js'dedir.
 *
 * Kural degisirse (mevzuat guncellenirse) VERSIYON artirilir ve
 * yeni bir tablo eklenir; eski VERSIYON ve tablosu SILINMEZ.
 * Cunku gecmis BBHB sonuclari hangi versiyonla hesaplandigini saklar
 * ve o versiyonla tutarli kalmalidir.
 */

const AKTIF_VERSIYON = 'v1';

const KATSAYI_TABLOLARI = {
  v1: [
    // Kultur irki
    { grup: 'kulturIrki', kategori: 'inek', katsayi: 1.00 },
    { grup: 'kulturIrki', kategori: 'duve', katsayi: 0.60 },
    { grup: 'kulturIrki', kategori: 'dana', katsayi: 0.60 },

    // Kultur melezi
    { grup: 'kulturMelezi', kategori: 'inek', katsayi: 0.75 },
    { grup: 'kulturMelezi', kategori: 'duve', katsayi: 0.45 },
    { grup: 'kulturMelezi', kategori: 'dana', katsayi: 0.45 },

    // Yerli irk
    { grup: 'yerliIrk', kategori: 'inek', katsayi: 0.50 },
    { grup: 'yerliIrk', kategori: 'duve', katsayi: 0.30 },
    { grup: 'yerliIrk', kategori: 'dana', katsayi: 0.30 },

    // Buyukbas erkek (irktan bagimsiz)
    { grup: 'buyukbasErkek', kategori: 'boga', katsayi: 1.50 },
    { grup: 'buyukbasErkek', kategori: 'okuz', katsayi: 0.60 },

    // Manda (yastan bagimsiz, sadece cinsiyet)
    { grup: 'manda', kategori: 'mandaErkek', katsayi: 0.90 },
    { grup: 'manda', kategori: 'mandaDisi', katsayi: 0.75 },

    // Kucukbas (irktan bagimsiz, yasa gore)
    { grup: 'kucukbas', kategori: 'koyun', katsayi: 0.10 },
    { grup: 'kucukbas', kategori: 'kec', katsayi: 0.08 },
    { grup: 'kucukbas', kategori: 'kuzu', katsayi: 0.04 },
    { grup: 'kucukbas', kategori: 'oglak', katsayi: 0.04 },

    // Tek tirnakli (yas/cinsiyetten bagimsiz)
    { grup: 'tekTirnakli', kategori: 'at', katsayi: 0.50 },
    { grup: 'tekTirnakli', kategori: 'katir', katsayi: 0.40 },
    { grup: 'tekTirnakli', kategori: 'esek', katsayi: 0.30 },
  ],
};

/** Sinif ayrimi olmayan (irktan bagimsiz) sigir/buyukbas erkek kategorileri
 *  ve tum diger turler icin "yerli ırk" listesi - SADECE sigir icin gecerlidir. */
const YERLI_IRK_LISTESI = [
  'akkaraman',
  'kivircik',
  'morkaraman',
  'ivesi',
  'norduz',
  'hemsin',
  'kangal',
];

function katsayiTablosunuGetir(versiyon = AKTIF_VERSIYON) {
  const tablo = KATSAYI_TABLOLARI[versiyon];
  if (!tablo) {
    throw new Error(`Bilinmeyen katsayi versiyonu: ${versiyon}`);
  }
  return tablo;
}

function katsayiBul(grup, kategori, versiyon = AKTIF_VERSIYON) {
  const tablo = katsayiTablosunuGetir(versiyon);
  const satir = tablo.find((s) => s.grup === grup && s.kategori === kategori);
  if (!satir) {
    throw new Error(`Katsayi bulunamadi: grup=${grup} kategori=${kategori}`);
  }
  return satir.katsayi;
}

module.exports = {
  AKTIF_VERSIYON,
  KATSAYI_TABLOLARI,
  YERLI_IRK_LISTESI,
  katsayiTablosunuGetir,
  katsayiBul,
};
