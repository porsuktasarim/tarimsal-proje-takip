/**
 * ice-aktarim.js — Mera İzleme Sistemi (misweb) BBHB modülünden alınmıştır
 *
 * Turkvet Excel (.xls/.xlsx) veya CSV dosyalarini okuyup normalize
 * hayvan kaydi formatina cevirir. Coklu dosya destekler, birlestirir.
 *
 * ONEMLI: Turkvet disa aktarimlari eski binary .xls formatinda gelebilir
 * (ExcelJS bunu okuyamaz) - bu yuzden 'xlsx' (SheetJS) paketi kullanilir,
 * o hem .xls hem .xlsx hem .csv okuyabilir.
 *
 * Gercek Turkvet basliklari (Kucukbas ve Buyukbas sablonlarinda sutun
 * SIRASI farkli olabilir - orn. Buyukbas'ta "Anne Kupe Numarasi" ekstra
 * sutunu var). Bu yuzden ISIM bazli eslestirme yapilir, pozisyon bazli
 * DEGIL.
 *
 * Beklenen basliklar: Küpe Numarası, Tür, Irk, Cinsiyet, Doğum Tarihi,
 * İl, İlçe, Mahalle, İşletme Sahibi Kişi/Firma, Bulunduğu İşletme
 *
 * Cikti (normalize kayit):
 *   { isletmeciId, isletmeciAdi, tur, cinsiyet, yasAy, irk,
 *     kaynak, kaynakReferans }
 *
 *   isletmeciId   <- "Bulunduğu İşletme" (TR kodu, essiz/kalici referans)
 *   isletmeciAdi  <- "İşletme Sahibi Kişi/Firma" (goruntu adi)
 */

const XLSX = require('xlsx');
const path = require('path');

// Tarımsal Proje Takip Sistemi uyarlaması:
// - Dosyalar diske yazılmaz; yüklenen dosya bellekten (Buffer) okunur.
// - İsteğe bağlı "T.C. kimlik no" sütunu okunur (çiftçi eşleştirmesinde kullanılır);
//   Türkvet dışa aktarımında bu sütun yoksa boş kalır.

const TUR_ESLEME = {
  'sığır': 'sigir',
  'sigir': 'sigir',
  'manda': 'manda',
  'koyun': 'koyun',
  'keçi': 'kec',
  'keci': 'kec',
  'at': 'at',
  'katır': 'katir',
  'katir': 'katir',
  'eşek': 'esek',
  'esek': 'esek',
};

const CINSIYET_ESLEME = {
  'dişi': 'disi',
  'disi': 'disi',
  'erkek': 'erkek',
};

// Baslik adi -> olasi yaziliş varyasyonlari (Turkce karakter/harf farkina
// dayanikli olmak icin kucuk harfe cevrilip karsilastirilir)
const BASLIK_ANAHTARLARI = {
  kupeNumarasi: ['küpe numarası', 'kupe numarasi'],
  tur: ['tür', 'tur'],
  irk: ['irk', 'ırk'],
  cinsiyet: ['cinsiyet'],
  dogumTarihi: ['doğum tarihi', 'dogum tarihi'],
  il: ['il'],
  ilce: ['ilçe', 'ilce'],
  mahalle: ['mahalle'],
  isletmeSahibi: ['işletme sahibi kişi/firma', 'isletme sahibi kisi/firma'],
  bulunduguIsletme: ['bulunduğu işletme', 'bulundugu isletme'],
};

// Bulunmasa da olur
const ISTEGE_BAGLI_BASLIKLAR = {
  tcKimlikNo: ['işletme sahibi tc kimlik no', 'işletme sahibi t.c. kimlik no', 'işletme sahibi kimlik no', 'tc kimlik no', 't.c. kimlik no',
    'tc kimlik numarası', 't.c. kimlik numarası', 'kimlik no', 'tckn', 'tc no', 'tc'],
};

function turNormalizeEt(hamDeger) {
  const key = String(hamDeger || '').trim().toLocaleLowerCase('tr-TR');
  const sonuc = TUR_ESLEME[key];
  if (!sonuc) throw new Error(`Bilinmeyen tür değeri: "${hamDeger}"`);
  return sonuc;
}

function cinsiyetNormalizeEt(hamDeger) {
  const key = String(hamDeger || '').trim().toLocaleLowerCase('tr-TR');
  const sonuc = CINSIYET_ESLEME[key];
  if (!sonuc) throw new Error(`Bilinmeyen cinsiyet değeri: "${hamDeger}"`);
  return sonuc;
}

/**
 * Turkvet tarihleri metin olarak "GG.AA.YY" formatinda gelir (orn. "01.12.21").
 * 2 haneli yil: 00-30 -> 2000'ler, 31-99 -> 1900'ler kabul edilir.
 *
 * ONEMLI: referansTarih parametresi ZORUNLUDUR ve "bugun" degil,
 * hesaplamanin yapildigi/kaydedildigi ayin 1. gunudur (bkz. bbhb.service.js
 * hesaplamaTarihiUret()). Boylece ayin hangi gununde hesaplama yapilirsa
 * yapilsin, o ay icin herkes AYNI yas referansiyla hesaplanir ve sonuc
 * rapor tarihinden BAGIMSIZ, kaydedildigi anda SABITLENIR.
 */
function yasAyHesapla(hamTarih, referansTarih) {
  if (!referansTarih) {
    throw new Error('yasAyHesapla: referansTarih zorunludur (bugunun tarihi kullanilmaz)');
  }
  const metin = String(hamTarih || '').trim();
  // GG.AA.YY (Türkvet), GG.AA.YYYY, GG/AA/YYYY ve YYYY-AA-GG kabul edilir
  let parcalar;
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(metin)) parcalar = metin.slice(0, 10).split('-').reverse();
  else parcalar = metin.split(/[./]/);
  if (parcalar.length !== 3) {
    throw new Error(`Geçersiz doğum tarihi formatı: "${hamTarih}"`);
  }
  let [gun, ay, yil] = parcalar.map((p) => parseInt(p, 10));
  if (yil < 100) {
    yil += yil <= 30 ? 2000 : 1900;
  }
  const dogumTarihi = new Date(yil, ay - 1, gun);
  if (Number.isNaN(dogumTarihi.getTime())) {
    throw new Error(`Geçersiz doğum tarihi: "${hamTarih}"`);
  }
  const ayFarki =
    (referansTarih.getFullYear() - dogumTarihi.getFullYear()) * 12 +
    (referansTarih.getMonth() - dogumTarihi.getMonth());
  return Math.max(ayFarki, 0);
}

/** Baslik satirindaki sutun index'lerini ISIM bazli bulur. */
function basliklariEslestir(hamBaslikSatiri) {
  const normalize = hamBaslikSatiri.map((v) =>
    String(v || '').trim().toLocaleLowerCase('tr-TR')
  );
  const eslesme = {};
  for (const [anahtar, adaylar] of Object.entries(BASLIK_ANAHTARLARI)) {
    const index = normalize.findIndex((baslik) => adaylar.includes(baslik));
    if (index === -1) {
      throw new Error(`Beklenen sütun bulunamadı: "${adaylar[0]}"`);
    }
    eslesme[anahtar] = index;
  }
  for (const [anahtar, adaylar] of Object.entries(ISTEGE_BAGLI_BASLIKLAR)) {
    eslesme[anahtar] = normalize.findIndex((baslik) => adaylar.includes(baslik));
  }
  return eslesme;
}

/**
 * Tek bir dosyayi (bellekteki icerik) okuyup normalize kayit dizisine cevirir.
 * @param {{ ad: string, icerik: Buffer }} dosya
 * @param {Date} hesaplamaTarihi - yas hesaplamasinda kullanilacak referans tarih
 * @returns {Array}
 */
function dosyaOku(dosya, hesaplamaTarihi) {
  const ad = dosya.ad || 'dosya';
  let workbook;
  if (path.extname(ad).toLowerCase() === '.csv') {
    // CSV acikca UTF-8 metin olarak okunur (SheetJS kodlamayi bazen yanlis algilar)
    // raw: true -> "01.06.25" gibi metinler tarihe cevrilmez (aksi halde ay/gun karisir)
    workbook = XLSX.read(dosya.icerik.toString('utf-8').replace(/^\uFEFF/, ''), { type: 'string', raw: true });
  } else {
    workbook = XLSX.read(dosya.icerik, { type: 'buffer' });
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  // header:1 -> her satiri dizi olarak al (baslik/pozisyon bagimsiz okuma)
  const satirlar = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

  if (satirlar.length < 2) {
    throw new Error(`Dosyada veri satırı bulunamadı: "${ad}"`);
  }

  const eslesme = basliklariEslestir(satirlar[0]);
  const kayitlar = [];

  for (let i = 1; i < satirlar.length; i++) {
    const satir = satirlar[i];
    if (!satir || satir.every((h) => String(h).trim() === '')) continue;

    const kupeNo = satir[eslesme.kupeNumarasi];
    if (!kupeNo) continue;

    const tc = eslesme.tcKimlikNo >= 0 ? String(satir[eslesme.tcKimlikNo] || '').replace(/\D/g, '') : '';
    kayitlar.push({
      isletmeciId: String(satir[eslesme.bulunduguIsletme] || '').trim(),
      isletmeciAdi: String(satir[eslesme.isletmeSahibi] || '').trim(),
      tcKimlikNo: /^[1-9][0-9]{10}$/.test(tc) ? tc : undefined,
      il: String(satir[eslesme.il] || '').trim(),
      ilce: String(satir[eslesme.ilce] || '').trim(),
      mahalle: String(satir[eslesme.mahalle] || '').trim(),
      tur: turNormalizeEt(satir[eslesme.tur]),
      cinsiyet: cinsiyetNormalizeEt(satir[eslesme.cinsiyet]),
      yasAy: yasAyHesapla(satir[eslesme.dogumTarihi], hesaplamaTarihi),
      irk: String(satir[eslesme.irk] || '').trim(),
      kaynak: 'turkvet_excel',
      kaynakReferans: `${ad}:${String(kupeNo).trim()}`,
    });
  }

  return kayitlar;
}

/**
 * Birden fazla dosyayi okuyup tek bir normalize kayit listesinde birlestirir.
 * @param {Array<{ad, icerik}>} dosyalar
 * @param {Date} hesaplamaTarihi - yas hesaplamasinda kullanilacak referans tarih
 * @returns {Array}
 */
function cokluDosyaOku(dosyalar, hesaplamaTarihi) {
  const tumKayitlar = [];
  for (const dosya of dosyalar) {
    tumKayitlar.push(...dosyaOku(dosya, hesaplamaTarihi));
  }
  return tumKayitlar;
}

/**
 * Normalize kayitlari isletmeci bazinda gruplar.
 * @param {Array} kayitlar
 */
function isletmeciBazindaGrupla(kayitlar) {
  const gruplar = new Map();
  for (const kayit of kayitlar) {
    if (!gruplar.has(kayit.isletmeciId)) {
      gruplar.set(kayit.isletmeciId, {
        isletmeciId: kayit.isletmeciId,
        isletmeciAdi: kayit.isletmeciAdi,
        kayitlar: [],
      });
    }
    gruplar.get(kayit.isletmeciId).kayitlar.push(kayit);
  }
  return gruplar;
}

module.exports = { dosyaOku, cokluDosyaOku, isletmeciBazindaGrupla };
