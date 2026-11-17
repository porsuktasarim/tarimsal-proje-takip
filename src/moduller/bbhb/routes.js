const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const servis = require('./servis');
const isletmeler = require('./isletmeler');
const BbhbSonuc = require('./model');
const { kategorileriKatsayiIleGetir, kriterParagraflariOlustur } = require('./aciklamalar');
const { AKTIF_VERSIYON, KATSAYI_TABLOLARI } = require('./kurallar');
const { yetkiGerekli } = require('../../core/yetki');
const { kodUret, anahtar, tcGecerliMi } = require('../../core/yardimcilar');

const router = express.Router();
const V = 'bbhb/views/';
const sar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
// Dosyalar diske yazılmaz, yalnızca hesap için bellekte tutulur
const yukle = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 20 } });

const ISLETME_YETKI = ['ciftci.yonet', 'talep.degerlendir', 'bbhb.hesapla'];
router.use((req, res, next) => {
  let gerek = 'bbhb.gor';
  if (/^\/ciftci\//.test(req.path) || req.path === '/isletme-ara') gerek = ISLETME_YETKI;
  else if (req.method === 'POST' && !/\/sil$/.test(req.path)) gerek = 'bbhb.hesapla';
  else if (req.path === '/manuel') gerek = 'bbhb.hesapla';
  return yetkiGerekli(gerek)(req, res, next);
});

const donusAdresi = (v, varsayilan) => (typeof v === 'string' && /^\/[a-z]/i.test(v) && !v.startsWith('//') ? v : varsayilan);
const ekle = (adres, q) => adres + (adres.includes('?') ? '&' : '?') + q;

// Ana sayfa: manuel giriş, Türkvet dosyası, kayıtlı sonuçlar
router.get('/', sar(async (req, res) => {
  const sekme = ['manuel', 'turkvet', 'kayitli', 'isletmeler'].includes(req.query.sekme) ? req.query.sekme : (req.izin('bbhb.hesapla') ? 'manuel' : 'kayitli');
  const sonuclar = await BbhbSonuc.find({ durum: 'aktif' }).sort({ createdAt: -1 })
    .select('bolumler.il bolumler.ilce bolumler.mahalle bolumler.isletmeciSonuclari.isletmeciId genelToplamBBHB kaynakTipi kaynakDosyalar kuralSetiVersiyonu createdAt olusturanAd').lean();
  let ciftci = null;
  if (mongoose.isValidObjectId(req.query.ciftci)) ciftci = await mongoose.model('Ciftci').findById(req.query.ciftci).lean();

  // İşletmeler sekmesi: en güncel değerler ve bağlı çiftçiler
  let isletmeListesi = [];
  if (sekme === 'isletmeler') {
    const harita = await isletmeler.isletmeHaritasi();
    const bagli = await mongoose.model('Ciftci').find({ 'isletmeler.0': { $exists: true } }).select('adSoyad isletmeler').lean();
    const kime = new Map();
    bagli.forEach((c) => c.isletmeler.forEach((b) => { if (!kime.has(b.isletmeciId)) kime.set(b.isletmeciId, []); kime.get(b.isletmeciId).push({ _id: c._id, adSoyad: c.adSoyad, eslesme: b.eslesme, yakinlik: b.yakinlik }); }));
    isletmeListesi = [...harita.values()].map((is) => ({ ...is, ciftciler: kime.get(is.isletmeciId) || [] }));
    if (req.query.ilce) isletmeListesi = isletmeListesi.filter((x) => isletmeler.yerAnahtari(x.ilce) === isletmeler.yerAnahtari(req.query.ilce));
    if (req.query.q) {
      const q = isletmeler.adAnahtari(req.query.q);
      isletmeListesi = isletmeListesi.filter((x) => isletmeler.adAnahtari(`${x.isletmeciAdi} ${x.isletmeciId} ${x.mahalle} ${x.tcKimlikNo || ''}`).includes(q));
    }
    if (req.query.eslesmemis === '1') isletmeListesi = isletmeListesi.filter((x) => !x.ciftciler.length);
    isletmeListesi.sort((a, b) => (a.ilce || '').localeCompare(b.ilce || '', 'tr') || (a.mahalle || '').localeCompare(b.mahalle || '', 'tr') || a.isletmeciAdi.localeCompare(b.isletmeciAdi, 'tr'));
  }
  res.render(V + 'index', {
    baslik: 'BBHB hesaplama', sekme, sonuclar, ciftci, isletmeListesi,
    kategoriler: kategorileriKatsayiIleGetir(), kriterler: kriterParagraflariOlustur(),
    versiyon: AKTIF_VERSIYON, kategoriSayisi: KATSAYI_TABLOLARI[AKTIF_VERSIYON].length,
    filtre: { ilce: req.query.ilce || '', q: req.query.q || '', eslesmemis: req.query.eslesmemis || '' }, hatalar: []
  });
}));

// Manuel giriş: hesapla ve önizle
router.post('/manuel/hesapla', sar(async (req, res) => {
  const ayar = res.locals.ayar;
  const b = req.body;
  const hatalar = [];
  const isletmeciAdi = String(b.isletmeciAdi || '').trim();
  const tc = String(b.tcKimlikNo || '').trim();
  const isletmeNo = String(b.isletmeNo || '').trim().toUpperCase();
  const baslik = { il: ayar.il || 'İstanbul', ilce: String(b.ilce || '').trim(), mahalle: String(b.mahalle || '').trim() };
  if (!baslik.ilce) hatalar.push('İlçe seçilmelidir.');
  if (!isletmeciAdi) hatalar.push('İşletmeci adı girilmelidir.');
  if (tc && !tcGecerliMi(tc)) hatalar.push('T.C. kimlik numarası geçersiz.');
  const isletmeciId = isletmeNo || `M-${kodUret(baslik.ilce)}-${kodUret(baslik.mahalle || 'merkez')}-${kodUret(isletmeciAdi)}`;
  const kalemler = [];
  kategorileriKatsayiIleGetir().forEach((g) => g.kategoriler.forEach((k) => {
    const adet = parseInt((b.adet && b.adet[g.grupKodu] && b.adet[g.grupKodu][k.kod]) || '', 10);
    if (adet > 0) kalemler.push({ isletmeciId, isletmeciAdi, tcKimlikNo: tc || undefined, grup: g.grupKodu, kategori: k.kod, adet });
  }));
  if (!kalemler.length) hatalar.push('En az bir kategoriye adet girilmelidir.');
  if (hatalar.length) {
    return res.status(422).render(V + 'index', {
      baslik: 'BBHB hesaplama', sekme: 'manuel', sonuclar: [], ciftci: null, isletmeListesi: [], form: b,
      kategoriler: kategorileriKatsayiIleGetir(), kriterler: kriterParagraflariOlustur(), versiyon: AKTIF_VERSIYON,
      kategoriSayisi: KATSAYI_TABLOLARI[AKTIF_VERSIYON].length, filtre: {}, hatalar, ciftciId: b.ciftciId
    });
  }
  const sonuc = servis.manuelHesapla({ kalemler, baslik });
  res.render(V + 'onizleme', { baslik: 'BBHB önizleme', sonuc, kategoriler: kategorileriKatsayiIleGetir(), ciftciId: b.ciftciId || '' });
}));

// Türkvet dosyaları: hesapla ve önizle (dosyalar saklanmaz)
router.post('/turkvet/onizleme', yukle.array('dosyalar'), sar(async (req, res) => {
  const dosyalar = (req.files || []).map((f) => ({ ad: Buffer.from(f.originalname, 'latin1').toString('utf8'), icerik: f.buffer }));
  const hataGoster = (mesaj) => res.status(422).render(V + 'index', {
    baslik: 'BBHB hesaplama', sekme: 'turkvet', sonuclar: [], ciftci: null, isletmeListesi: [],
    kategoriler: kategorileriKatsayiIleGetir(), kriterler: kriterParagraflariOlustur(), versiyon: AKTIF_VERSIYON,
    kategoriSayisi: KATSAYI_TABLOLARI[AKTIF_VERSIYON].length, filtre: {}, hatalar: [mesaj]
  });
  if (!dosyalar.length) return hataGoster('En az bir dosya seçilmelidir.');
  let sonuc;
  try {
    sonuc = servis.turkvetIleHesapla({ dosyalar });
  } catch (e) {
    return hataGoster(e.message);
  }
  res.render(V + 'onizleme', { baslik: 'BBHB önizleme', sonuc, kategoriler: kategorileriKatsayiIleGetir(), ciftciId: '' });
}));

// Önizlemeyi kaydet; ardından ilgili ilçelerde çiftçilerle otomatik eşleştir
router.post('/kaydet', sar(async (req, res) => {
  let sonuc;
  try { sonuc = JSON.parse(req.body.sonuc || ''); } catch (e) { sonuc = null; }
  if (!sonuc) return res.redirect('/bbhb?bildirim=islem-yapilamadi&hata=' + encodeURIComponent('Önizleme verisi okunamadı.'));
  const kayitlar = await servis.sonucuKaydet(sonuc, req.ben);
  // Belirli bir çiftçinin sayfasından gelindiyse işletme o çiftçiye bağlanır
  if (mongoose.isValidObjectId(req.body.ciftciId)) {
    const c = await mongoose.model('Ciftci').findById(req.body.ciftciId);
    if (c) {
      kayitlar.forEach((k) => k.bolumler[0].isletmeciSonuclari.forEach((is) => {
        if (c.isletmeler.some((x) => x.isletmeciId === is.isletmeciId)) return;
        c.isletmeler.push({ isletmeciId: is.isletmeciId, isletmeciAdi: is.isletmeciAdi, ilce: k.bolumler[0].ilce, mahalle: k.bolumler[0].mahalle, eslesme: 'elle', yakinlik: 'kendisi', ekleyenAd: req.ben ? req.ben.adSoyad : undefined });
      }));
      await c.save();
    }
  }
  const ilceler = [...new Set(kayitlar.map((k) => k.bolumler[0].ilce))];
  const ilceAdlari = (res.locals.ayar.ilceler || []).filter((i) => ilceler.some((x) => anahtar(x) === anahtar(i)));
  const e = await isletmeler.tumunuEslestir(ilceAdlari.length ? ilceAdlari : undefined);
  const yerler = kayitlar.map((k) => [k.bolumler[0].ilce, k.bolumler[0].mahalle].filter(Boolean).join('/')).join(', ');
  const mesaj = `${kayitlar.length > 1 ? kayitlar.length + ' ayrı sonuç' : 'Sonuç'} kaydedildi (${yerler}).${e.eklenen ? ` ${e.eklenen} işletme ${e.ciftciSayisi} çiftçiyle otomatik eşleşti.` : ''}`;
  if (mongoose.isValidObjectId(req.body.ciftciId)) return res.redirect(`/ciftciler/${req.body.ciftciId}?bildirim=islem-yapildi&hata=${encodeURIComponent(mesaj)}`);
  return res.redirect('/bbhb?sekme=kayitli&bildirim=islem-yapildi&hata=' + encodeURIComponent(mesaj));
}));

// Tüm çiftçileri yeniden eşleştir
router.post('/eslestir', sar(async (req, res) => {
  const e = await isletmeler.tumunuEslestir();
  return res.redirect('/bbhb?sekme=isletmeler&bildirim=islem-yapildi&hata=' + encodeURIComponent(e.eklenen ? `${e.eklenen} işletme ${e.ciftciSayisi} çiftçiyle eşleşti.` : 'Yeni eşleşme bulunmadı.'));
}));

// İşletme arama (çiftçiye elle işletme eklemek için)
router.get('/isletme-ara', sar(async (req, res) => {
  const q = isletmeler.adAnahtari(req.query.q || '');
  if (q.length < 2) return res.json([]);
  const harita = await isletmeler.isletmeHaritasi();
  const liste = [...harita.values()]
    .filter((x) => isletmeler.adAnahtari(`${x.isletmeciAdi} ${x.isletmeciId} ${x.mahalle} ${x.ilce} ${x.tcKimlikNo || ''}`).includes(q))
    .slice(0, 20)
    .map((x) => ({ isletmeciId: x.isletmeciId, isletmeciAdi: x.isletmeciAdi, ilce: x.ilce, mahalle: x.mahalle, bbhb: x.bbhb, bas: x.bas }));
  return res.json(liste);
}));

// Çiftçiye işletme bağla (aile işletmesi ya da öneriyi onaylama)
router.post('/ciftci/:id/bagla', sar(async (req, res) => {
  const donus = donusAdresi(req.body.donus, `/ciftciler/${req.params.id}`);
  const c = mongoose.isValidObjectId(req.params.id) ? await mongoose.model('Ciftci').findById(req.params.id) : null;
  const id = String(req.body.isletmeciId || '').trim();
  const harita = await isletmeler.isletmeHaritasi();
  const is = harita.get(id);
  if (!c || !is) return res.redirect(ekle(donus, 'bildirim=islem-yapilamadi&hata=' + encodeURIComponent('İşletme bulunamadı.')));
  if (!c.isletmeler.some((x) => x.isletmeciId === id)) {
    c.isletmeler.push({
      isletmeciId: id, isletmeciAdi: is.isletmeciAdi, ilce: is.ilce, mahalle: is.mahalle, eslesme: 'elle',
      yakinlik: String(req.body.yakinlik || '').trim() || undefined, ekleyenAd: req.ben ? req.ben.adSoyad : undefined
    });
    c.reddedilenIsletmeler = (c.reddedilenIsletmeler || []).filter((x) => x !== id);
    await c.save();
  }
  return res.redirect(ekle(donus, 'bildirim=islem-yapildi'));
}));

// İşletme bağını kaldır (kayıt silinmez; otomatik eşleşme bir daha yapılmaz)
router.post('/ciftci/:id/kaldir', sar(async (req, res) => {
  const donus = donusAdresi(req.body.donus, `/ciftciler/${req.params.id}`);
  const c = mongoose.isValidObjectId(req.params.id) ? await mongoose.model('Ciftci').findById(req.params.id) : null;
  const id = String(req.body.isletmeciId || '').trim();
  if (c) {
    c.isletmeler = c.isletmeler.filter((x) => x.isletmeciId !== id);
    if (!c.reddedilenIsletmeler.includes(id)) c.reddedilenIsletmeler.push(id);
    await c.save();
  }
  return res.redirect(ekle(donus, 'bildirim=islem-yapildi'));
}));

// Sonuç ayrıntısı
router.get('/:id', sar(async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return next();
  const sonuc = await BbhbSonuc.findById(req.params.id).lean();
  if (!sonuc) return next();
  const ids = sonuc.bolumler.flatMap((b) => b.isletmeciSonuclari.map((x) => x.isletmeciId));
  const ciftciler = await mongoose.model('Ciftci').find({ 'isletmeler.isletmeciId': { $in: ids } }).select('adSoyad tcKimlikNo isletmeler').lean();
  const bagliCiftciler = (id) => ciftciler.filter((c) => c.isletmeler.some((x) => x.isletmeciId === id))
    .map((c) => ({ _id: c._id, adSoyad: c.adSoyad, bag: c.isletmeler.find((x) => x.isletmeciId === id) }));
  res.render(V + 'detay', { baslik: 'BBHB sonucu', sonuc, kategoriler: kategorileriKatsayiIleGetir(), bagliCiftciler });
}));

// Silme yalnızca Sistem Yöneticisi (core/yetki.js)
router.post('/:id/sil', sar(async (req, res) => {
  if (mongoose.isValidObjectId(req.params.id)) await BbhbSonuc.findByIdAndDelete(req.params.id);
  return res.redirect('/bbhb?sekme=kayitli&bildirim=islem-yapildi&hata=' + encodeURIComponent('Kayıt silindi.'));
}));

module.exports = router;
