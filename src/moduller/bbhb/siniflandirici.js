/**
 * siniflandirici.js — Mera İzleme Sistemi (misweb) BBHB modülünden alınmıştır
 *
 * Ham hayvan kaydini (tur/cinsiyet/yasAy/irk) core.js'in anladigi
 * standart {grup, kategori} ciftine cevirir.
 *
 * SADECE Turkvet yolu icin kullanilir. Manuel giriste kullanici
 * zaten grup+kategori secer, siniflandirmaya gerek yoktur.
 *
 * Girdi (normalize kayit):
 *   { isletmeciId, isletmeciAdi, tur, cinsiyet, yasAy, irk }
 *   tur: 'sigir' | 'manda' | 'koyun' | 'kec' | 'at' | 'katir' | 'esek'
 *   cinsiyet: 'disi' | 'erkek'  (sigir ve manda icin zorunlu)
 *
 * Cikti:
 *   { isletmeciId, isletmeciAdi, grup, kategori, adet: 1 }
 *   (service katmani ayni grup+kategori+isletmeci kayitlarini toplar)
 */

const { YERLI_IRK_LISTESI } = require('./kurallar');

function irkSinifiBelirle(irk) {
  if (!irk) return 'kulturIrki'; // irk bilinmiyorsa varsayilan: kultur
  const normalize = irk.trim().toLocaleLowerCase('tr-TR');

  if (normalize.endsWith('m')) {
    return 'kulturMelezi';
  }
  if (YERLI_IRK_LISTESI.includes(normalize)) {
    return 'yerliIrk';
  }
  return 'kulturIrki';
}

function sigirSiniflandir({ cinsiyet, yasAy, irk }) {
  const irkGrubu = irkSinifiBelirle(irk);

  if (cinsiyet === 'disi') {
    return yasAy <= 21
      ? { grup: irkGrubu, kategori: 'duve' }
      : { grup: irkGrubu, kategori: 'inek' };
  }

  // erkek
  if (yasAy <= 12) {
    return { grup: irkGrubu, kategori: 'dana' };
  }
  if (yasAy <= 96) {
    return { grup: 'buyukbasErkek', kategori: 'boga' };
  }
  return { grup: 'buyukbasErkek', kategori: 'okuz' };
}

function mandaSiniflandir({ cinsiyet }) {
  return cinsiyet === 'erkek'
    ? { grup: 'manda', kategori: 'mandaErkek' }
    : { grup: 'manda', kategori: 'mandaDisi' };
}

function kucukbasSiniflandir({ tur, yasAy }) {
  const genc = yasAy <= 12;
  if (tur === 'koyun') {
    return { grup: 'kucukbas', kategori: genc ? 'kuzu' : 'koyun' };
  }
  // kec
  return { grup: 'kucukbas', kategori: genc ? 'oglak' : 'kec' };
}

function tekTirnakliSiniflandir({ tur }) {
  return { grup: 'tekTirnakli', kategori: tur }; // tur: 'at' | 'katir' | 'esek'
}

/**
 * @param {object} hamKayit
 * @returns {{grup:string, kategori:string}}
 */
function siniflandir(hamKayit) {
  const { tur } = hamKayit;

  switch (tur) {
    case 'sigir':
      return sigirSiniflandir(hamKayit);
    case 'manda':
      return mandaSiniflandir(hamKayit);
    case 'koyun':
    case 'kec':
      return kucukbasSiniflandir(hamKayit);
    case 'at':
    case 'katir':
    case 'esek':
      return tekTirnakliSiniflandir(hamKayit);
    default:
      throw new Error(`Bilinmeyen tur: ${tur}`);
  }
}

/**
 * Ham kayit listesini {grup, kategori} ile etiketleyip dondurur.
 * Sayim/toplama islemi service katmaninda yapilir.
 */
function topluSiniflandir(hamKayitlar) {
  return hamKayitlar.map((kayit) => ({
    isletmeciId: kayit.isletmeciId,
    isletmeciAdi: kayit.isletmeciAdi,
    ...siniflandir(kayit),
    adet: 1,
  }));
}

module.exports = { siniflandir, topluSiniflandir, irkSinifiBelirle };
