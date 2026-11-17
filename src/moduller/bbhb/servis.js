/**
 * servis.js — Mera İzleme Sistemi (misweb) bbhb.service.js'ten uyarlanmıştır.
 *
 * Sonuç her zaman "bolumler" dizisi şeklinde döner; Türkvet dosyası birden
 * fazla mahalle içeriyorsa her (il, ilçe, mahalle) kendi bölümünü oluşturur
 * ve kayıtta ayrı bir BbhbSonuc olur. Manuel giriş tek bölümlük sonuçtur.
 */

const { hesapla, isletmeciBazindaHesapla } = require('./cekirdek');
const { topluSiniflandir } = require('./siniflandirici');
const { cokluDosyaOku } = require('./ice-aktarim');
const { AKTIF_VERSIYON } = require('./kurallar');
const BbhbSonuc = require('./model');

/** Aynı işletmeci+grup+kategori için adet=1 olan kayıtları toplar */
function adetleriTopla(kayitlar) {
  const map = new Map();
  for (const k of kayitlar) {
    const anahtar = `${k.isletmeciId}::${k.grup}::${k.kategori}`;
    if (!map.has(anahtar)) map.set(anahtar, { ...k, adet: 0 });
    map.get(anahtar).adet += k.adet;
  }
  return Array.from(map.values());
}

/** Ham kayıtları (il, ilçe, mahalle) üçlüsüne göre bölümlere ayırır */
function bolumlereAyir(hamKayitlar) {
  const map = new Map();
  for (const kayit of hamKayitlar) {
    const anahtar = `${kayit.il}::${kayit.ilce}::${kayit.mahalle}`;
    if (!map.has(anahtar)) map.set(anahtar, { il: kayit.il, ilce: kayit.ilce, mahalle: kayit.mahalle, kayitlar: [] });
    map.get(anahtar).kayitlar.push(kayit);
  }
  return Array.from(map.values());
}

/** Yaş hesabının referans tarihi: içinde bulunulan ayın 1. günü */
function hesaplamaTarihiUret() {
  const simdi = new Date();
  return new Date(simdi.getFullYear(), simdi.getMonth(), 1);
}

const tcHaritasi = (kayitlar) => {
  const m = new Map();
  kayitlar.forEach((k) => { if (k.tcKimlikNo && !m.has(k.isletmeciId)) m.set(k.isletmeciId, k.tcKimlikNo); });
  return m;
};

/**
 * MANUEL YOL: il/ilçe/mahalle kullanıcıdan alınır.
 * @param {{ kalemler: Array<{isletmeciId, isletmeciAdi, tcKimlikNo, grup, kategori, adet}>, baslik: {il, ilce, mahalle} }} p
 */
function manuelHesapla({ kalemler, baslik }) {
  const { isletmeciSonuclari, genelToplamBBHB: bolumToplamBBHB } = isletmeciBazindaHesapla(kalemler, AKTIF_VERSIYON);
  const tc = tcHaritasi(kalemler);
  isletmeciSonuclari.forEach((s) => { if (tc.has(s.isletmeciId)) s.tcKimlikNo = tc.get(s.isletmeciId); });
  return {
    kaynakTipi: 'manuel',
    kaynakDosyalar: [],
    hesaplamaTarihi: hesaplamaTarihiUret(),
    bolumler: [{ il: baslik.il, ilce: baslik.ilce, mahalle: baslik.mahalle, isletmeciSonuclari, bolumToplamBBHB }],
    genelToplamBBHB: bolumToplamBBHB,
    kuralSetiVersiyonu: AKTIF_VERSIYON
  };
}

/**
 * TÜRKVET YOLU: il/ilçe/mahalle dosyadan okunur.
 * @param {{ dosyalar: Array<{ad, icerik: Buffer}> }} p
 */
function turkvetIleHesapla({ dosyalar }) {
  const hesaplamaTarihi = hesaplamaTarihiUret();
  const hamKayitlar = cokluDosyaOku(dosyalar, hesaplamaTarihi);
  if (!hamKayitlar.length) throw new Error('Dosyalarda hayvan kaydı bulunamadı.');
  const tc = tcHaritasi(hamKayitlar);
  const bolumler = [];
  let genelToplamBBHB = 0;
  for (const { il, ilce, mahalle, kayitlar } of bolumlereAyir(hamKayitlar)) {
    const sayilmis = adetleriTopla(topluSiniflandir(kayitlar));
    const { isletmeciSonuclari, genelToplamBBHB: bolumToplamBBHB } = isletmeciBazindaHesapla(sayilmis, AKTIF_VERSIYON);
    isletmeciSonuclari.forEach((s) => { if (tc.has(s.isletmeciId)) s.tcKimlikNo = tc.get(s.isletmeciId); });
    bolumler.push({ il, ilce, mahalle, isletmeciSonuclari, bolumToplamBBHB });
    genelToplamBBHB += bolumToplamBBHB;
  }
  return {
    kaynakTipi: 'turkvet',
    kaynakDosyalar: dosyalar.map((d) => d.ad),
    hesaplamaTarihi,
    bolumler,
    genelToplamBBHB: Number(genelToplamBBHB.toFixed(2)),
    kuralSetiVersiyonu: AKTIF_VERSIYON
  };
}

/**
 * Önizlemeden gelen sonucu kaydeder. Katsayılar ve toplamlar kural setinden
 * yeniden hesaplanır (formdan gelen sayılara güvenilmez). Her yerleşim ayrı,
 * değişmez bir kayıttır. Dönüş: kayıt dizisi.
 */
async function sonucuKaydet(hesaplamaSonucu, olusturan) {
  const s = hesaplamaSonucu || {};
  if (!Array.isArray(s.bolumler) || !s.bolumler.length) throw new Error('Kaydedilecek sonuç yok.');
  const versiyon = AKTIF_VERSIYON;
  const kayitlar = [];
  for (const b of s.bolumler) {
    if (!b.il || !b.ilce) throw new Error('Bölümde il ve ilçe bulunmalıdır.');
    const isletmeciSonuclari = (b.isletmeciSonuclari || []).map((is) => {
      const { detaylar, toplamBBHB } = hesapla((is.detaylar || []).map((d) => ({ grup: d.grup, kategori: d.kategori, adet: Number(d.adet) })), versiyon);
      const tc = /^[1-9][0-9]{10}$/.test(String(is.tcKimlikNo || '')) ? String(is.tcKimlikNo) : undefined;
      return { isletmeciId: String(is.isletmeciId), isletmeciAdi: String(is.isletmeciAdi), tcKimlikNo: tc, detaylar, isletmeciToplamBBHB: toplamBBHB };
    });
    const bolumToplamBBHB = Number(isletmeciSonuclari.reduce((t, x) => t + x.isletmeciToplamBBHB, 0).toFixed(2));
    kayitlar.push(await BbhbSonuc.create({
      kaynakTipi: s.kaynakTipi === 'turkvet' ? 'turkvet' : 'manuel',
      kaynakDosyalar: Array.isArray(s.kaynakDosyalar) ? s.kaynakDosyalar.map(String) : [],
      hesaplamaTarihi: s.hesaplamaTarihi ? new Date(s.hesaplamaTarihi) : hesaplamaTarihiUret(),
      bolumler: [{ il: b.il, ilce: b.ilce, mahalle: b.mahalle, isletmeciSonuclari, bolumToplamBBHB }],
      genelToplamBBHB: bolumToplamBBHB,
      kuralSetiVersiyonu: versiyon,
      olusturanKullaniciId: olusturan && olusturan._id ? String(olusturan._id) : undefined,
      olusturanAd: olusturan ? olusturan.adSoyad : undefined,
      durum: 'aktif'
    }));
  }
  return kayitlar;
}

module.exports = { manuelHesapla, turkvetIleHesapla, sonucuKaydet, hesaplamaTarihiUret };
