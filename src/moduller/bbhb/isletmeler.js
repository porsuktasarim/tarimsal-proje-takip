// BBHB işletmeleri: en güncel değerler, çiftçiyle otomatik eşleştirme ve
// çiftçinin bağlı işletmelerinden toplam BBHB.
//
// Otomatik eşleştirme (çiftçi ↔ işletmeci):
//   - T.C. kimlik no aynıysa                          → eşleşir ("tc")
//   - Ad soyad + ilçe + köy/mahalle aynıysa           → eşleşir ("ad-koy")
//   - Yalnızca ad soyad + ilçe aynıysa                → öneri (elle onaylanır)
// Karşılaştırmada büyük/küçük harf, Türkçe karakter ve "Mahallesi/Köyü" ekleri dikkate alınmaz.
// Otomatik bağı kaldırılan işletme o çiftçiye yeniden otomatik bağlanmaz.

const mongoose = require('mongoose');
const BbhbSonuc = require('./model');

// BBHB grubu → hayvan sayısı türü (talepteki hayvan türü kodlarıyla aynı)
const GRUP_TURU = {
  kulturIrki: 'buyukbas', kulturMelezi: 'buyukbas', yerliIrk: 'buyukbas', buyukbasErkek: 'buyukbas', manda: 'buyukbas',
  kucukbas: 'kucukbas', tekTirnakli: 'tekTirnakli'
};

const katla = (s) => String(s || '').toLocaleLowerCase('tr')
  .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/i̇/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
  .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const adAnahtari = (s) => katla(s);
const yerAnahtari = (s) => katla(s).replace(/\b(mahallesi|mahalle|mah|mh|koyu|koy|belde|beldesi)\b/g, '').replace(/\s+/g, ' ').trim();

// İşletmeci kimliği → en güncel değerler. Değerlendirme ızgarasındaki her hücre
// değişikliğinde yeniden hesap yapıldığı için kısa süre bellekte tutulur; BBHB
// kaydedilince ya da silinince temizlenir.
let onbellek = null;
const ONBELLEK_SURESI = 30 * 1000;
function onbellegiTemizle() { onbellek = null; }

async function isletmeHaritasi() {
  if (onbellek && Date.now() - onbellek.zaman < ONBELLEK_SURESI) return onbellek.harita;
  const harita = await haritaOlustur();
  onbellek = { zaman: Date.now(), harita };
  return harita;
}

async function haritaOlustur() {
  const sonuclar = await BbhbSonuc.find({ durum: 'aktif' }).sort({ createdAt: -1 }).lean();
  const harita = new Map();
  sonuclar.forEach((s) => (s.bolumler || []).forEach((b) => (b.isletmeciSonuclari || []).forEach((is) => {
    if (harita.has(is.isletmeciId)) return;
    const bas = { buyukbas: 0, kucukbas: 0, tekTirnakli: 0 };
    (is.detaylar || []).forEach((d) => { const t = GRUP_TURU[d.grup]; if (t) bas[t] += d.adet; });
    harita.set(is.isletmeciId, {
      isletmeciId: is.isletmeciId, isletmeciAdi: is.isletmeciAdi, tcKimlikNo: is.tcKimlikNo,
      il: b.il, ilce: b.ilce, mahalle: b.mahalle, bbhb: is.isletmeciToplamBBHB, bas, detaylar: is.detaylar,
      sonucId: String(s._id), tarih: s.createdAt, hesaplamaTarihi: s.hesaplamaTarihi, kaynakTipi: s.kaynakTipi
    });
  })));
  return harita;
}

// Bir çiftçi için otomatik eşleşenler ve öneriler
function adaylar(ciftci, harita) {
  const bagli = new Set((ciftci.isletmeler || []).map((x) => x.isletmeciId));
  const reddedilen = new Set(ciftci.reddedilenIsletmeler || []);
  const ad = adAnahtari(ciftci.adSoyad);
  const ilce = yerAnahtari(ciftci.ilce);
  const mahalle = yerAnahtari(ciftci.mahalle);
  const otomatik = [];
  const oneriler = [];
  harita.forEach((is) => {
    if (bagli.has(is.isletmeciId)) return;
    if (is.tcKimlikNo && is.tcKimlikNo === ciftci.tcKimlikNo) {
      if (!reddedilen.has(is.isletmeciId)) otomatik.push({ ...is, eslesme: 'tc' }); else oneriler.push({ ...is, neden: 'T.C. aynı (daha önce kaldırılmış)' });
      return;
    }
    if (!ad || adAnahtari(is.isletmeciAdi) !== ad || yerAnahtari(is.ilce) !== ilce) return;
    if (mahalle && yerAnahtari(is.mahalle) === mahalle && !reddedilen.has(is.isletmeciId)) otomatik.push({ ...is, eslesme: 'ad-koy' });
    else oneriler.push({ ...is, neden: reddedilen.has(is.isletmeciId) ? 'daha önce kaldırılmış' : 'ad soyad ve ilçe aynı, köy/mahalle farklı' });
  });
  return { otomatik, oneriler };
}

// Otomatik eşleşenleri çiftçiye bağlar (kaydeder). Eklenen sayısını döner.
async function ciftciyiEslestir(ciftci, harita) {
  const h = harita || await isletmeHaritasi();
  const { otomatik } = adaylar(ciftci, h);
  if (!otomatik.length) return 0;
  otomatik.forEach((is) => ciftci.isletmeler.push({
    isletmeciId: is.isletmeciId, isletmeciAdi: is.isletmeciAdi, ilce: is.ilce, mahalle: is.mahalle, eslesme: is.eslesme, ekleyenAd: 'Otomatik eşleştirme'
  }));
  await ciftci.save();
  return otomatik.length;
}

// Tüm çiftçileri (isteğe bağlı ilçelerle sınırlı) eşleştirir
async function tumunuEslestir(ilceler) {
  const Ciftci = mongoose.model('Ciftci');
  const harita = await isletmeHaritasi();
  const filtre = ilceler && ilceler.length ? { ilce: { $in: ilceler } } : {};
  let eklenen = 0;
  let ciftciSayisi = 0;
  for (const c of await Ciftci.find(filtre)) {
    const n = await ciftciyiEslestir(c, harita);
    if (n) { eklenen += n; ciftciSayisi += 1; }
  }
  return { eklenen, ciftciSayisi };
}

// Çiftçinin bağlı işletmelerinden toplam BBHB ve hayvan sayıları
function ciftciBbhb(ciftci, harita) {
  const isletmeler = (ciftci && ciftci.isletmeler ? ciftci.isletmeler : []).map((bag) => {
    const is = harita.get(bag.isletmeciId);
    return { ...(bag.toObject ? bag.toObject() : bag), kayit: is || null };
  });
  const bulunan = isletmeler.filter((x) => x.kayit);
  const toplam = (f) => Number(bulunan.reduce((t, x) => t + f(x.kayit), 0).toFixed(2));
  return {
    var: bulunan.length > 0,
    isletmeSayisi: bulunan.length,
    toplam: toplam((k) => k.bbhb),
    buyukbas: toplam((k) => k.bas.buyukbas),
    kucukbas: toplam((k) => k.bas.kucukbas),
    tekTirnakli: toplam((k) => k.bas.tekTirnakli),
    isletmeler
  };
}

// Çiftçi listesine (lean ya da belge) BBHB özetini ekler: ciftciId → özet
async function ozetHaritasi(ciftciler) {
  const harita = await isletmeHaritasi();
  const sonuc = new Map();
  ciftciler.filter(Boolean).forEach((c) => sonuc.set(String(c._id), ciftciBbhb(c, harita)));
  return sonuc;
}

module.exports = { GRUP_TURU, onbellegiTemizle, isletmeHaritasi, adaylar, ciftciyiEslestir, tumunuEslestir, ciftciBbhb, ozetHaritasi, adAnahtari, yerAnahtari };
