/**
 * aciklamalar.js — Mera İzleme Sistemi (misweb) BBHB modülünden alınmıştır
 *
 * BBHB kategorilerinin yas/cinsiyet/irk kosullarini ve katsayilarini
 * ACIKLAYICI METIN olarak tutar. TEK KAYNAK: hem raporlama (Excel/
 * Word/PDF siniflandirma kriterleri paragraflari) hem de manuel giris
 * ekraninin "her hayvanin altinda yas kurali" gostergesi BURADAN okur.
 */

const { katsayiBul } = require('./kurallar');

const KRITER_ACIKLAMALARI = [
  {
    grup: 'kulturIrki', baslik: 'Kültür Irkı',
    not: '"M" ile bitmeyen ve yerli ırk listesinde yer almayan ırklar',
    kategoriler: [
      { kod: 'inek', etiket: 'İnek', kosul: 'dişi, 22 ay ve üzeri' },
      { kod: 'duve', etiket: 'Düve', kosul: 'dişi, 21 ay ve altı' },
      { kod: 'dana', etiket: 'Dana', kosul: 'erkek, 12 ay ve altı' },
    ],
  },
  {
    grup: 'kulturMelezi', baslik: 'Kültür Melezi', not: 'ırk adı "M" ile bitenler',
    kategoriler: [
      { kod: 'inek', etiket: 'İnek', kosul: 'dişi, 22 ay ve üzeri' },
      { kod: 'duve', etiket: 'Düve', kosul: 'dişi, 21 ay ve altı' },
      { kod: 'dana', etiket: 'Dana', kosul: 'erkek, 12 ay ve altı' },
    ],
  },
  {
    grup: 'yerliIrk', baslik: 'Yerli Irk',
    not: 'Akkaraman, Kıvırcık, Morkaraman, İvesi, Norduz, Hemşin, Kangal ırkları',
    kategoriler: [
      { kod: 'inek', etiket: 'İnek', kosul: 'dişi, 22 ay ve üzeri' },
      { kod: 'duve', etiket: 'Düve', kosul: 'dişi, 21 ay ve altı' },
      { kod: 'dana', etiket: 'Dana', kosul: 'erkek, 12 ay ve altı' },
    ],
  },
  {
    grup: 'buyukbasErkek', baslik: 'Büyükbaş Diğer', not: null,
    kategoriler: [
      { kod: 'boga', etiket: 'Boğa', kosul: 'erkek, 13-96 ay' },
      { kod: 'okuz', etiket: 'Öküz', kosul: 'erkek, 97 ay ve üzeri' },
    ],
  },
  {
    grup: 'manda', baslik: 'Manda', not: 'yaştan bağımsız',
    kategoriler: [
      { kod: 'mandaErkek', etiket: 'Erkek', kosul: null },
      { kod: 'mandaDisi', etiket: 'Dişi', kosul: null },
    ],
  },
  {
    grup: 'kucukbas', baslik: 'Küçükbaş', not: 'ırktan bağımsız',
    kategoriler: [
      { kod: 'koyun', etiket: 'Koyun', kosul: '12 ay üzeri' },
      { kod: 'kec', etiket: 'Keçi', kosul: '12 ay üzeri' },
      { kod: 'kuzu', etiket: 'Kuzu', kosul: 'koyun yavrusu, 12 ay ve altı' },
      { kod: 'oglak', etiket: 'Oğlak', kosul: 'keçi yavrusu, 12 ay ve altı' },
    ],
  },
  {
    grup: 'tekTirnakli', baslik: 'Tek Tırnaklı', not: 'yaş/cinsiyetten bağımsız',
    kategoriler: [
      { kod: 'at', etiket: 'At', kosul: null },
      { kod: 'katir', etiket: 'Katır', kosul: null },
      { kod: 'esek', etiket: 'Eşek', kosul: null },
    ],
  },
];

function kriterParagraflariOlustur() {
  return KRITER_ACIKLAMALARI.map((g) => {
    const kategoriMetni = g.kategoriler
      .map((k) => {
        const katsayi = katsayiBul(g.grup, k.kod);
        const kosulMetni = k.kosul ? ` (${k.kosul})` : '';
        return `${k.etiket}${kosulMetni}: ${katsayi}`;
      })
      .join('  ·  ');
    const notMetni = g.not ? ` — ${g.not}` : '';
    return `${g.baslik}${notMetni}: ${kategoriMetni}`;
  });
}

/** Manuel giris ekrani icin: katsayi eklenmis duz kategori listesi (grup bazli) */
function kategorileriKatsayiIleGetir() {
  return KRITER_ACIKLAMALARI.map((g) => ({
    grupKodu: g.grup,
    baslik: g.baslik,
    not: g.not,
    kategoriler: g.kategoriler.map((k) => ({
      kod: k.kod,
      etiket: k.etiket,
      kosul: k.kosul,
      katsayi: katsayiBul(g.grup, k.kod),
    })),
  }));
}

module.exports = { KRITER_ACIKLAMALARI, kriterParagraflariOlustur, kategorileriKatsayiIleGetir };
