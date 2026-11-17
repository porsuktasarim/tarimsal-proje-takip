/**
 * cekirdek.js — Mera İzleme Sistemi (misweb) BBHB modülünden alınmıştır
 *
 * SAF hesaplama cekirdegi. Express, DB, dosya sistemi bilmez.
 * Manuel giris ve Turkvet yolu AYNI fonksiyonu cagirir.
 *
 * Girdi: [{ grup, kategori, adet }]
 * Cikti: { detaylar: [{grup,kategori,adet,katsayi,bbhb}], toplamBBHB }
 */

const { katsayiBul } = require('./kurallar');

/**
 * @param {Array<{grup:string, kategori:string, adet:number}>} kayitlar
 * @param {string} versiyon - kural seti versiyonu (varsayilan: aktif versiyon)
 */
function hesapla(kayitlar, versiyon) {
  if (!Array.isArray(kayitlar) || kayitlar.length === 0) {
    return { detaylar: [], toplamBBHB: 0 };
  }

  const detaylar = kayitlar.map(({ grup, kategori, adet }) => {
    if (!adet || adet < 0) {
      throw new Error(`Gecersiz adet degeri: grup=${grup} kategori=${kategori}`);
    }
    const katsayi = katsayiBul(grup, kategori, versiyon);
    const bbhb = Number((adet * katsayi).toFixed(2));
    return { grup, kategori, adet, katsayi, bbhb };
  });

  const toplamBBHB = Number(
    detaylar.reduce((toplam, d) => toplam + d.bbhb, 0).toFixed(2)
  );

  return { detaylar, toplamBBHB };
}

/**
 * Ayni normalize kategori listesini isletmeci bazinda gruplayip
 * her isletmeci icin ayri hesapla() cagirir.
 *
 * @param {Array<{isletmeciId, isletmeciAdi, grup, kategori, adet}>} kayitlar
 */
function isletmeciBazindaHesapla(kayitlar, versiyon) {
  const gruplar = new Map();

  for (const kayit of kayitlar) {
    const anahtar = kayit.isletmeciId;
    if (!gruplar.has(anahtar)) {
      gruplar.set(anahtar, {
        isletmeciId: kayit.isletmeciId,
        isletmeciAdi: kayit.isletmeciAdi,
        kalemler: [],
      });
    }
    gruplar.get(anahtar).kalemler.push({
      grup: kayit.grup,
      kategori: kayit.kategori,
      adet: kayit.adet,
    });
  }

  const isletmeciSonuclari = [];
  let genelToplamBBHB = 0;

  for (const { isletmeciId, isletmeciAdi, kalemler } of gruplar.values()) {
    const { detaylar, toplamBBHB } = hesapla(kalemler, versiyon);
    isletmeciSonuclari.push({
      isletmeciId,
      isletmeciAdi,
      detaylar,
      isletmeciToplamBBHB: toplamBBHB,
    });
    genelToplamBBHB += toplamBBHB;
  }

  // Ciftci ailesi adinin bas harfine gore (Turkce alfabetik) sirala
  isletmeciSonuclari.sort((a, b) => a.isletmeciAdi.localeCompare(b.isletmeciAdi, 'tr-TR'));

  return {
    isletmeciSonuclari,
    genelToplamBBHB: Number(genelToplamBBHB.toFixed(2)),
  };
}

module.exports = { hesapla, isletmeciBazindaHesapla };
