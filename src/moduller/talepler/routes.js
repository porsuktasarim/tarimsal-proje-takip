const express = require('express');
const mongoose = require('mongoose');
const Talep = require('./model');
const Ciftci = require('../ciftciler/model');
const { ciftciFormuOku, ciftciDenetle } = require('../ciftciler/routes');
const { talepHesabi, fiyatBirimi, normsuzMu } = require('../projeler/hesap');
const { normOku } = require('../ayarlar/katalog');
const { talepDurumlari } = require('../../config/sabitler');
const { sayiOku, diziyeCevir, anahtar, sonucBirimi, hayvanlariOku, tarihOku } = require('../../core/yardimcilar');
const { calisilanIlceler, ilceKisitliMi, yetkiGerekli, projeFiltresi, projeErisebilirMi, projeErisimYok } = require('../../core/yetki');
const akis = require('./akis');
const multer = require('multer');
const dosyalar = require('../../core/dosyalar');
const Kisi = () => mongoose.model('Kisi');
const { degerlendirmeHesabi } = require('../projeler/degerlendirme-hesabi');
const bbhbIsletmeler = require('../bbhb/isletmeler');
const { metinVarMi } = require('../projeler/proje-metni');
// Değerlendirme işlemleri (teslim alma, değer değiştirme, karar) proje metni ister
const degerlendirmeIslemiMi = (kod) => akis.ISLEMLER[kod] && akis.ISLEMLER[kod].yetki === 'talep.degerlendir';
const metinGerekliAdres = (projeId) => `/projeler/${projeId}?bildirim=proje-metni-gerekli&metin=gerekli#proje-metni`;

const router = express.Router();
const V = 'talepler/views/';

// Görüntüleme talep.gor; giriş/düzenleme talep.gir; akış işlemleri kendi yetkisine bakar
// (akis.js); silme yalnızca Sistem Yöneticisi (core/yetki.js).
router.use((req, res, next) => {
  let gerek = 'talep.gor';
  if (/\/(islem|degistir|uygulama|kontrol|oneri|oneri-karar|toplu-not)$/.test(req.path)) gerek = ['talep.gir', 'talep.degerlendir'];
  else if (/\/kontrol\/[^/]+\/foto\//.test(req.path)) gerek = 'talep.gor';
  else if (/\/sil$/.test(req.path)) gerek = 'talep.gor';
  else if (req.method !== 'GET' || /\/(yeni|duzenle)$/.test(req.path)) gerek = 'talep.gir';
  return yetkiGerekli(gerek)(req, res, next);
});

// Akış işlemlerinin bağlamı
const baglam = (req, res) => ({ izin: req.izin, ben: req.ben, ayar: res.locals.ayar, kisitli: ilceKisitliMi(req.ben, res.locals.ayar) });
// Formdan gelen dönüş adresi yalnızca uygulama içiyse kullanılır
const donusAdresi = (v, varsayilan) => (typeof v === 'string' && /^\/[a-z]/i.test(v) && !v.startsWith('//') ? v : varsayilan);
const bildirimEkle = (adres, kod) => adres + (adres.includes('?') ? '&' : '?') + 'bildirim=' + kod;
const sar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const metin = (v) => (v === undefined || v === null ? '' : String(v).trim());
const Proje = () => mongoose.model('Proje');

// Talep girilebilecek projeler (iptal ve tamamlananlar dışında)
// Taslak projeye yalnızca değerlendirme yetkisi olan (koordinatör/yönetici) talep girebilir; yürütücü proje yürürlüğe girince girer.
const talebeAcikDurumlar = (req) => (req.izin('talep.degerlendir') ? ['taslak', 'aktif'] : ['aktif']);
const acikProjeler = (req) => Proje().find({ ...projeFiltresi(req), durum: { $in: talebeAcikDurumlar(req) } }).sort({ olusturulma: -1 });

// Formdaki canlı hesap için kalem bilgileri
function kalemVerisi(proje, ayar) {
  const ekim = ayar.ekimNormu;
  return proje.kalemler.map((k) => {
    const normsuz = normsuzMu(k, ayar);
    const n = ekim && !normsuz ? normOku(k.normlar, ekim.kod) : null;
    const ekimBirimi = n ? (n.birim || ekim.birim) : null;
    return {
      normsuz,
      olcuyeGore: !!k.olcuyeGore,
      _id: String(k._id),
      ad: k.urun + (k.cesit ? ' · ' + k.cesit : ''),
      tur: k.tur,
      talepBirimi: k.talepBirimi || 'da',
      ekim: normsuz ? 1 : (n ? n.deger : null),       // normsuz kalemde ihtiyaç = talep miktarı
      ihtiyacBirimi: normsuz ? (k.talepBirimi || 'da') : (ekimBirimi ? sonucBirimi(ekimBirimi) : null),
      olcuBirimi: k.olcuBirimi,
      ambalaj: k.ambalaj && k.ambalaj.miktar > 0 ? { miktar: k.ambalaj.miktar, birim: k.ambalaj.birim } : null,
      birimFiyat: k.birimFiyat != null ? k.birimFiyat : null,
      fiyatBirimi: fiyatBirimi(k)
    };
  });
}

// Talep edilen toplamlar: talepKalemleri[<kalemId>] = miktar
function talepKalemleriniOku(govde, proje) {
  const g = govde.talepKalemleri || {};
  return proje.kalemler
    .map((k) => ({ kalemId: String(k._id), miktar: sayiOku(g[String(k._id)]) }))
    .filter((t) => t.miktar !== undefined);
}

// Parsel satırları. Yalnızca kalem ve ilçesi seçili boş satırlar dikkate alınmaz.
function satirlariOku(govde, proje) {
  return diziyeCevir(govde.satirlar)
    .map((s) => ({
      ...(mongoose.isValidObjectId(s._id) ? { _id: s._id } : {}),
      kalemId: metin(s.kalemId),
      parselIlce: metin(s.parselIlce) || undefined,
      mahalle: metin(s.mahalle) || undefined,
      ada: metin(s.ada) || undefined,
      parsel: metin(s.parsel) || undefined,
      en: sayiOku(s.en),
      boy: sayiOku(s.boy),
      miktar: sayiOku(s.miktar),
      sulama: ['kuru', 'sulu'].includes(s.sulama) ? s.sulama : null,
      araziDurumu: ['islenen', 'islenmeyen', 'nadas', 'uygunOlmayan'].includes(s.araziDurumu) ? s.araziDurumu : null
    }))
    // En ve boy girilip miktar boş bırakılmışsa alan hesaplanır (sera: 8 m × 50 m = 400 m²)
    .map((s) => (s.miktar === undefined && s.en > 0 && s.boy > 0 ? { ...s, miktar: Math.round(s.en * s.boy * 100) / 100 } : s))
    .filter((s) => s.miktar !== undefined || s.ada || s.parsel || s.mahalle)
    .map((s) => ({ ...s, kalemGecerli: proje.kalemler.some((k) => String(k._id) === s.kalemId) }));
}

function talebiDenetle(talepKalemleri, satirlar, proje) {
  const hatalar = [];
  const birim = (id) => {
    const k = proje.kalemler.find((x) => String(x._id) === String(id));
    return (k && k.talepBirimi) || 'da';
  };
  talepKalemleri.forEach((t) => {
    if (t.miktar < 0) hatalar.push('Talep edilen miktar eksi olamaz.');
  });
  const talepVar = talepKalemleri.some((t) => t.miktar > 0);
  if (!talepVar && !satirlar.length) hatalar.push('En az bir kalem için talep edilen miktar ya da parsel girilmelidir.');
  satirlar.forEach((s, i) => {
    if (!s.kalemGecerli) hatalar.push(`${i + 1}. parselde kalem seçilmelidir.`);
    if (s.miktar === undefined || s.miktar <= 0) hatalar.push(`${i + 1}. parselde miktar (${s.kalemGecerli ? birim(s.kalemId) : 'da'}) girilmelidir.`);
    if (!s.parselIlce) hatalar.push(`${i + 1}. parselde ilçe seçilmelidir.`);
  });
  return hatalar;
}

const temizSatir = ({ kalemGecerli, ...s }) => s; // eslint-disable-line no-unused-vars

async function formGoster(res, durum, yerel) {
  const { proje } = yerel;
  return res.status(durum).render(V + 'form', {
    kalemVerisi: kalemVerisi(proje, res.locals.ayar),
    ...yerel
  });
}

// ---------------------------------------------------------------------------

router.get('/', sar(async (req, res) => {
  const ben = req.ben;
  const ayar = res.locals.ayar;
  const projeler = await Proje().find(projeFiltresi(req)).sort({ olusturulma: -1 }).select('ad kisaAd durum donem').lean();
  if (!projeler.length) return res.render(V + 'liste', { baslik: 'Çiftçi talepleri', projeler, proje: null, satirlar: [], filtre: {}, kisitli: false, toplam: {}, bekleyenler: {} });

  // Proje seçilmeden çiftçi listelenmez: önce proje seçilir.
  if (!mongoose.isValidObjectId(req.query.proje) || !projeErisebilirMi(req, req.query.proje)) {
    const kisitliSec = ilceKisitliMi(ben, ayar);
    const sayiFiltresi = { projeId: { $in: projeler.map((p) => p._id) } };
    if (kisitliSec) sayiFiltresi.ilce = { $in: ben.ilceler || [] };
    const sayilar = await Talep.aggregate([{ $match: sayiFiltresi }, { $group: { _id: { p: '$projeId', d: '$durum' }, n: { $sum: 1 } } }]);
    const ozet = {};
    sayilar.forEach((x) => { const k = String(x._id.p); ozet[k] = ozet[k] || { toplam: 0 }; ozet[k][x._id.d] = x.n; ozet[k].toplam += x.n; });
    return res.render(V + 'liste-proje-sec', { baslik: 'Çiftçi talepleri', projeler, ozet, kisitli: kisitliSec });
  }
  const proje = await Proje().findById(req.query.proje);
  if (!proje) return res.redirect('/talepler');

  const kisitli = ilceKisitliMi(ben, ayar);
  const ilce = req.query.ilce !== undefined ? String(req.query.ilce) : (kisitli ? 'benim' : '');
  const filtre = { projeId: proje._id };
  if (ilce === 'benim' && kisitli) filtre.ilce = { $in: ben.ilceler };
  else if (ilce && ilce !== 'benim') filtre.ilce = ilce;
  if (req.query.durum && talepDurumlari[req.query.durum]) filtre.durum = req.query.durum;

  // Yürütücünün görüşünü bekleyen ve taslakta kalan başvurular (aynı ilçe süzgeciyle)
  const { durum: _d, ...ilceFiltresi } = filtre; // eslint-disable-line no-unused-vars
  const bekleyenler = {
    yurutucude: await Talep.countDocuments({ ...ilceFiltresi, durum: 'yurutucude' }),
    taslak: await Talep.countDocuments({ ...ilceFiltresi, durum: 'taslak' })
  };
  let talepler = await Talep.find(filtre).populate('ciftciId').sort({ ilce: 1, olusturulma: 1 });
  talepler = talepler.filter((t) => t.ciftciId);
  if (req.query.q) {
    const q = anahtar(req.query.q);
    talepler = talepler.filter((t) => anahtar(t.ciftciId.adSoyad).includes(q) || t.ciftciId.tcKimlikNo.includes(q));
  }

  const satirlar = talepler.map((t) => ({ talep: t, ciftci: t.ciftciId, hesap: talepHesabi(t, proje, ayar) }));
  const sayilan = satirlar.filter((s) => s.talep.durum !== 'desteklenmedi');
  const toplam = {
    ciftci: sayilan.length,
    alan: sayilan.reduce((a, s) => a + s.hesap.toplamAlan, 0),
    toplamlar: {},
    bedel: sayilan.reduce((a, s) => a + (s.hesap.bedel || 0), 0),
    ciftciKatkisi: sayilan.reduce((a, s) => a + (s.hesap.ciftciKatkisi || 0), 0),
    miktar: {}
  };
  toplam.hayvanlar = {};
  sayilan.forEach((s) => Object.entries(s.talep.hayvanlar || {}).forEach(([k, v]) => {
    toplam.hayvanlar[k] = (toplam.hayvanlar[k] || 0) + (v || 0);
  }));
  sayilan.forEach((s) => Object.entries(s.hesap.toplamlar).forEach(([b, v]) => {
    toplam.toplamlar[b] = (toplam.toplamlar[b] || 0) + v;
  }));
  sayilan.forEach((s) => s.hesap.kalemler.forEach((hk) => {
    if (hk.miktar == null) return;
    toplam.miktar[hk.kalem.olcuBirimi] = (toplam.miktar[hk.kalem.olcuBirimi] || 0) + hk.miktar;
  }));

  res.render(V + 'liste', {
    baslik: 'Çiftçi talepleri', projeler, proje, satirlar, toplam, kisitli, bekleyenler, filtre: { ...req.query, ilce, proje: String(proje._id) },
    donus: req.originalUrl.replace(/([?&])(bildirim|hata)=[^&]*/g, '$1').replace(/[?&]+$/, '').replace(/[?&]{2,}/g, (m) => m[0])
  });
}));

router.get('/yeni', sar(async (req, res) => {
  const ayar = res.locals.ayar;
  let proje = mongoose.isValidObjectId(req.query.proje) && projeErisebilirMi(req, req.query.proje) ? await Proje().findById(req.query.proje) : null;
  if (proje && !talebeAcikDurumlar(req).includes(proje.durum)) proje = null;
  if (!proje) {
    const projeler = await acikProjeler(req);
    if (projeler.length === 1) return res.redirect('/talepler/yeni?proje=' + projeler[0]._id);
    return res.render(V + 'proje-sec', { baslik: 'Talep gir', projeler });
  }
  const ilceler = calisilanIlceler(req.ben, ayar);
  return formGoster(res, 200, {
    baslik: 'Talep gir',
    proje,
    talep: { talepKalemleri: [], satirlar: [] },
    ciftci: { ilce: ilceler.length === 1 ? ilceler[0] : '' },
    ilceler,
    hatalar: [],
    eylem: '/talepler'
  });
}));

// Kaydetme (yeni ve düzenleme ortak)
async function kaydet(req, res, mevcutTalep) {
  const ayar = res.locals.ayar;
  const ben = req.ben;
  // Gönderilmiş başvurunun formu kilitlidir; yalnızca Sistem Yöneticisi düzeltebilir (geçmişe yazılır).
  if (mevcutTalep && mevcutTalep.durum !== 'taslak' && !req.silebilir) {
    return res.redirect(`/talepler/${mevcutTalep._id}?bildirim=talep-kilitli`);
  }
  const projeId = mevcutTalep ? mevcutTalep.projeId : req.body.projeId;
  if (projeId && !projeErisebilirMi(req, projeId)) return projeErisimYok(res);
  const proje = mongoose.isValidObjectId(projeId) ? await Proje().findById(projeId) : null;
  if (!proje) return res.redirect('/talepler/yeni');
  if (!mevcutTalep && !talebeAcikDurumlar(req).includes(proje.durum)) return res.redirect('/talepler/yeni?bildirim=proje-taslak');

  const ilceler = calisilanIlceler(ben, ayar);
  const ciftciVeri = ciftciFormuOku(req.body.ciftci || {});
  const talepKalemleri = talepKalemleriniOku(req.body, proje);
  const satirlar = satirlariOku(req.body, proje);
  const aciklama = metin(req.body.aciklama) || undefined;
  const hayvanlar = hayvanlariOku(req.body.hayvanlar, ayar.hayvanTurleri);

  // Kayıtlı çiftçi T.C. ile bulunur; bilgileri formdakiyle güncellenir.
  let ciftci = ciftciVeri.tcKimlikNo ? await Ciftci.findOne({ tcKimlikNo: ciftciVeri.tcKimlikNo }) : null;
  let izinliIlceler = ilceler;
  if (ciftci && !ilceler.includes(ciftci.ilce)) {
    izinliIlceler = [...ilceler, ciftci.ilce];
  }
  const hatalar = [...ciftciDenetle(ciftciVeri, izinliIlceler), ...talebiDenetle(talepKalemleri, satirlar, proje)];
  if (ciftci && !ilceler.includes(ciftci.ilce) && ilceKisitliMi(ben, ayar)) {
    hatalar.push(`Bu çiftçi ${ciftci.ilce} ilçesinde kayıtlı; talebi ${ciftci.ilce} ilçesi personeli girmelidir.`);
  }
  if (ciftci) {
    const baskaTalep = await Talep.findOne({ projeId: proje._id, ciftciId: ciftci._id, ...(mevcutTalep ? { _id: { $ne: mevcutTalep._id } } : {}) });
    if (baskaTalep) hatalar.push(`Bu çiftçinin bu projede kayıtlı talebi var (talep no ${String(baskaTalep._id).slice(-6)}); yeni satırlar o talebe eklenmelidir.`);
  }

  if (hatalar.length) {
    return formGoster(res, 422, {
      baslik: mevcutTalep ? 'Talebi düzenle' : 'Talep gir',
      proje,
      talep: { _id: mevcutTalep ? mevcutTalep._id : undefined, durum: mevcutTalep ? mevcutTalep.durum : undefined, ekilmeyenAlan: sayiOku(req.body.ekilmeyenAlan), talepKalemleri, satirlar, aciklama, hayvanlar },
      ciftci: ciftciVeri,
      ilceler: izinliIlceler,
      hatalar,
      eylem: mevcutTalep ? `/talepler/${mevcutTalep._id}` : '/talepler'
    });
  }

  if (ciftci) {
    const { ilce, ...guncel } = ciftciVeri;
    const eskiIlce = ciftci.ilce;
    ciftci.set(ilceler.includes(ciftci.ilce) ? ciftciVeri : guncel);
    ciftci.hayvanlar = hayvanlar;
    ciftci.hayvanTarihi = new Date();
    ciftci.markModified('hayvanlar');
    await ciftci.save();
    if (ciftci.ilce !== eskiIlce) await Talep.updateMany({ ciftciId: ciftci._id }, { $set: { ilce: ciftci.ilce } });
  } else {
    ciftci = await Ciftci.create({
      ...ciftciVeri, hayvanlar, hayvanTarihi: new Date(), kaydeden: ben ? ben._id : undefined, kaydedenAd: ben ? ben.adSoyad : undefined
    });
  }
  // BBHB kayıtlarındaki işletmelerle otomatik eşleştirme (T.C. ya da ad soyad + köy)
  await bbhbIsletmeler.ciftciyiEslestir(ciftci);

  const veri = {
    projeId: proje._id, ciftciId: ciftci._id, ilce: ciftci.ilce, talepKalemleri: talepKalemleri.filter((t) => t.miktar > 0), satirlar: satirlar.map(temizSatir), hayvanlar, aciklama,
    ekilmeyenAlan: sayiOku(req.body.ekilmeyenAlan) !== undefined ? Math.max(0, sayiOku(req.body.ekilmeyenAlan)) : undefined
  };
  let talep = mevcutTalep;
  if (talep) {
    const eski = akis.anlik(talep);
    talep.set(veri);
    talep.markModified('hayvanlar');
    if (talep.durum !== 'taslak') {
      talep.gecmis.push({ ...akis.kisiBilgisi(ben, ayar), tur: 'duzenleme', durum: talep.durum, degisiklikler: akis.farklar(eski, akis.anlik(talep), proje, ayar) });
    }
  } else {
    talep = new Talep({
      ...veri, durum: 'taslak', kaydeden: ben ? ben._id : undefined, kaydedenAd: ben ? ben.adSoyad : undefined,
      gecmis: [{ ...akis.kisiBilgisi(ben, ayar), tur: 'olusturma', durum: 'taslak' }]
    });
  }
  let bildirim = 'talep-kaydedildi';
  if (req.body.sonra === 'gonder' || req.body.sonra === 'yeni-gonder') {
    const r = akis.uygula(talep, 'gonder', { ...baglam(req, res), not: req.body.gonderNotu });
    bildirim = r.hata ? 'talep-gonderilemedi' : 'talep-gonderildi';
  }
  await talep.save();
  const yeniden = req.body.sonra === 'yeni' || req.body.sonra === 'yeni-gonder';
  return res.redirect(yeniden ? `/talepler/yeni?proje=${proje._id}&bildirim=${bildirim}` : `/talepler/${talep._id}?bildirim=${bildirim}`);
}

router.post('/', sar(async (req, res) => kaydet(req, res, null)));

async function talepBul(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return next('route');
  req.talep = await Talep.findById(req.params.id);
  if (req.talep && !projeErisebilirMi(req, req.talep.projeId)) return projeErisimYok(res);
  return req.talep ? next() : next('route');
}

router.get('/:id', sar(talepBul), sar(async (req, res) => {
  const [proje, ciftci] = await Promise.all([Proje().findById(req.talep.projeId), Ciftci.findById(req.talep.ciftciId)]);
  if (!proje || !ciftci) return res.redirect('/talepler');
  const hesap = talepHesabi(req.talep, proje, res.locals.ayar);
  const kalemAdi = (id) => {
    const k = proje.kalemler.find((x) => String(x._id) === String(id));
    return k ? k.urun + (k.cesit ? ' · ' + k.cesit : '') : '(silinmiş kalem)';
  };
  const kalemBirimi = (id) => {
    const k = proje.kalemler.find((x) => String(x._id) === String(id));
    return (k && k.talepBirimi) || 'da';
  };
  const bbhbHarita = await bbhbIsletmeler.isletmeHaritasi();
  const bbhbOzeti = bbhbIsletmeler.ciftciBbhb(ciftci, bbhbHarita);
  const deg = degerlendirmeHesabi(req.talep, ciftci, proje, res.locals.ayar, hesap, bbhbOzeti);
  const metinVar = metinVarMi(proje);
  const islemler = akis.kullanilabilirIslemler(req.talep, baglam(req, res)).filter((i) => metinVar || !degerlendirmeIslemiMi(i.kod));
  const duzenlenebilir = req.izin('talep.gir') && (req.talep.durum === 'taslak' || req.silebilir);
  const kisiler = await Kisi().find({ aktif: { $ne: false } }).sort({ adSoyad: 1 }).select('adSoyad unvan rol ilceler').lean();
  const uygulamaYetkisi = req.izin('talep.gir') || req.izin('talep.degerlendir');
  res.render(V + 'detay', {
    kisiler, uygulamaYetkisi,
    baslik: ciftci.adSoyad, talep: req.talep, proje, ciftci, hesap, kalemAdi, kalemBirimi, deg, islemler, duzenlenebilir,
    degistirilebilir: metinVar && req.izin('talep.degerlendir') && req.talep.durum === 'incelemede' && !akis.oneriBekliyor(req.talep), donus: req.originalUrl.split('?')[0],
    // Yürütücü: geri gönderilen başvuruda değişiklik önerir; koordinatör öneriyi karara bağlar
    oneriFormu: req.izin('talep.gir') && req.talep.durum === 'yurutucude' && (!ilceKisitliMi(req.ben, res.locals.ayar) || (req.ben.ilceler || []).includes(req.talep.ilce)),
    oneriKarari: akis.oneriBekliyor(req.talep) && req.izin('talep.degerlendir') && req.talep.durum !== 'yurutucude',
    metinEksik: !metinVar && req.izin('talep.degerlendir')
  });
}));

router.get('/:id/duzenle', sar(talepBul), sar(async (req, res) => {
  if (req.talep.durum !== 'taslak' && !req.silebilir) return res.redirect(`/talepler/${req.talep._id}?bildirim=talep-kilitli`);
  const [proje, ciftci] = await Promise.all([Proje().findById(req.talep.projeId), Ciftci.findById(req.talep.ciftciId)]);
  if (!proje || !ciftci) return res.redirect('/talepler');
  const ilceler = calisilanIlceler(req.ben, res.locals.ayar);
  if (!ilceler.includes(ciftci.ilce)) ilceler.push(ciftci.ilce);
  return formGoster(res, 200, {
    baslik: 'Talebi düzenle', proje, talep: req.talep.toObject(), ciftci: ciftci.toObject(), ilceler, hatalar: [], eylem: `/talepler/${req.talep._id}`
  });
}));

router.post('/:id', sar(talepBul), sar(async (req, res) => kaydet(req, res, req.talep)));

// Uygulama bilgileri: çiftçi katkı payı ve sözleşme (desteklenen başvurularda)
router.post('/:id/uygulama', sar(talepBul), sar(async (req, res) => {
  const t = req.talep;
  const donus = `/talepler/${t._id}#uygulama`;
  if (!['desteklendi', 'teslim'].includes(t.durum)) return res.redirect(`/talepler/${t._id}?bildirim=islem-yapilamadi&hata=` + encodeURIComponent('Uygulama bilgileri desteklenen başvuruda girilir.'));
  const once = { ...((t.uygulama && t.uygulama.toObject) ? t.uygulama.toObject() : (t.uygulama || {})) };
  const yeni = {
    ...once,
    katkiPayiTarihi: tarihOku(req.body.katkiPayiTarihi),
    katkiPayiBelgeNo: metin(req.body.katkiPayiBelgeNo) || undefined,
    sozlesmeTarihi: tarihOku(req.body.sozlesmeTarihi)
  };
  const ad = { katkiPayiTarihi: 'Katkı payı yatırma tarihi', katkiPayiBelgeNo: 'Katkı payı belge no', sozlesmeTarihi: 'Sözleşme tarihi' };
  const gs = (v) => (v instanceof Date ? v.toLocaleDateString('tr-TR') : (v || null));
  const degisiklikler = Object.keys(ad)
    .filter((k) => String(gs(once[k]) || '') !== String(gs(yeni[k]) || ''))
    .map((k) => ({ alan: `uygulama:${k}`, ad: ad[k], eski: gs(once[k]), yeni: gs(yeni[k]) }));
  if (degisiklikler.length) {
    t.uygulama = yeni;
    t.gecmis.push({ ...akis.kisiBilgisi(req.ben, res.locals.ayar), tur: 'duzenleme', durum: t.durum, not: 'Uygulama bilgileri güncellendi', degisiklikler });
    await t.save();
  }
  return res.redirect(`/talepler/${t._id}?bildirim=islem-yapildi${donus.slice(donus.indexOf('#'))}`);
}));

// Saha kontrolü (EK-5): tarih, kontrol edenler, parsellerde ekim tarihi ve uygunluk, oranlar, görüş, fotoğraflar
const fotoYukle = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 12 } });
router.post('/:id/kontrol', fotoYukle.array('fotograflar'), sar(talepBul), sar(async (req, res) => {
  const t = req.talep;
  const geri = (h) => res.redirect(`/talepler/${t._id}?bildirim=islem-yapilamadi&hata=${encodeURIComponent(h)}#kontroller`);
  if (!['desteklendi', 'teslim'].includes(t.durum)) return geri('Saha kontrolü desteklenen başvuruda girilir.');
  const b = req.body;
  const tarih = tarihOku(b.tarih);
  if (!tarih) return geri('Kontrol tarihi girilmelidir.');
  const kisiler = await Kisi().find({ _id: { $in: diziyeCevir(b.kontrolEdenler).filter((x) => mongoose.isValidObjectId(x)) } }).lean();
  if (!kisiler.length) return geri('Kontrolü yapan en az bir kişi seçilmelidir.');
  const evetHayir = (v) => (v === 'evet' ? true : (v === 'hayir' ? false : null));
  const oran = (v) => { const n = sayiOku(v); return n === undefined ? undefined : Math.max(0, Math.min(100, n)); };
  const parseller = (t.satirlar || []).map((sat) => {
    const g = (b.parsel && b.parsel[String(sat._id)]) || {};
    return { satirId: sat._id, ekimTarihi: tarihOku(g.ekimTarihi), uygun: evetHayir(g.uygun) };
  });
  const fotograflar = [];
  for (const f of req.files || []) {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(f.mimetype)) continue;
    const ad = Buffer.from(f.originalname || 'foto', 'latin1').toString('utf8');
    const dosyaId = await dosyalar.kaydet(f.buffer, ad, f.mimetype, { tur: 'kontrol-foto', talepId: String(t._id) });
    fotograflar.push({ dosyaId, ad });
  }
  t.kontroller.push({
    tarih,
    kontrolEdenler: kisiler.map((k) => ({ kisi: k._id, ad: k.adSoyad, gorev: k.unvan || (res.locals.ayar.rolAdlari || {})[k.rol] || '' })),
    parseller,
    normunaUygun: evetHayir(b.normunaUygun),
    cikisOrani: oran(b.cikisOrani),
    tutmaOrani: oran(b.tutmaOrani),
    kulturelIslemler: evetHayir(b.kulturelIslemler),
    ekTespit: metin(b.ekTespit) || undefined,
    gorus: metin(b.gorus) || undefined,
    fotograflar,
    kaydedenAd: req.ben ? req.ben.adSoyad : undefined
  });
  t.gecmis.push({ ...akis.kisiBilgisi(req.ben, res.locals.ayar), tur: 'not', durum: t.durum, not: `Saha kontrolü kaydedildi (${tarih.toLocaleDateString('tr-TR')}): ${metin(b.gorus) || 'görüş yazılmadı'}` });
  await t.save();
  return res.redirect(`/talepler/${t._id}?bildirim=islem-yapildi#kontroller`);
}));

// Kontrol fotoğrafı
router.get('/:id/kontrol/:kid/foto/:dosyaId', sar(talepBul), sar(async (req, res, next) => {
  const k = (req.talep.kontroller || []).find((x) => String(x._id) === req.params.kid);
  const f = k && (k.fotograflar || []).find((x) => String(x.dosyaId) === req.params.dosyaId);
  if (!f) return next();
  const bilgi = await dosyalar.bilgi(f.dosyaId);
  if (!bilgi) return next();
  res.set('Content-Type', (bilgi.metadata && bilgi.metadata.icerikTuru) || 'image/jpeg');
  res.set('Cache-Control', 'private, max-age=86400');
  dosyalar.okumaAkisi(f.dosyaId).on('error', next).pipe(res);
}));

// Toplu gönderme: seçilen taslak / geri gönderilmiş başvurular koordinatöre
router.post('/toplu-gonder', sar(async (req, res) => {
  const donus = donusAdresi(req.body.donus, '/talepler');
  const ids = diziyeCevir(req.body.ids).filter((id) => mongoose.isValidObjectId(id));
  if (!ids.length) return res.redirect(bildirimEkle(donus, 'islem-yapilamadi') + '&hata=' + encodeURIComponent('Başvuru seçilmelidir.'));
  let tamam = 0;
  const hatalar = new Set();
  for (const id of ids) {
    const t = await Talep.findById(id);
    if (!t || !projeErisebilirMi(req, t.projeId)) continue;
    const r = akis.uygula(t, 'gonder', { ...baglam(req, res), not: req.body.not });
    if (r.hata) { hatalar.add(r.hata); continue; }
    await t.save();
    tamam += 1;
  }
  if (!tamam) return res.redirect(bildirimEkle(donus, 'islem-yapilamadi') + '&hata=' + encodeURIComponent([...hatalar].join(' ')));
  const mesaj = hatalar.size ? `${tamam} başvuru gönderildi; ${ids.length - tamam} başvuru gönderilemedi: ${[...hatalar].join(' ')}` : `${tamam} başvuru koordinatöre gönderildi.`;
  return res.redirect(bildirimEkle(donus, 'toplu-islem') + '&hata=' + encodeURIComponent(mesaj));
}));

// Toplu not: seçilen başvuruların her birinin geçmişine aynı not düşülür
router.post('/toplu-not', sar(async (req, res) => {
  const donus = donusAdresi(req.body.donus, '/talepler');
  const ids = diziyeCevir(req.body.ids).filter((id) => mongoose.isValidObjectId(id));
  if (!ids.length) return res.redirect(bildirimEkle(donus, 'islem-yapilamadi') + '&hata=' + encodeURIComponent('Başvuru seçilmelidir.'));
  let tamam = 0;
  const hatalar = new Set();
  for (const id of ids) {
    const t = await Talep.findById(id);
    if (!t || !projeErisebilirMi(req, t.projeId)) continue;
    const r = akis.uygula(t, 'not', { ...baglam(req, res), not: req.body.not });
    if (r.hata) { hatalar.add(r.hata); continue; }
    await t.save();
    tamam += 1;
  }
  if (!tamam) return res.redirect(bildirimEkle(donus, 'islem-yapilamadi') + '&hata=' + encodeURIComponent([...hatalar].join(' ')));
  const mesaj = hatalar.size ? `${tamam} başvuruya not düşüldü; ${ids.length - tamam} başvuruya düşülemedi: ${[...hatalar].join(' ')}` : `${tamam} başvuruya not düşüldü.`;
  return res.redirect(bildirimEkle(donus, 'toplu-islem') + '&hata=' + encodeURIComponent(mesaj));
}));

// Akış işlemi: gönder, teslim al, yürütücüye gönder, karar, not ...
router.post('/:id/islem', sar(talepBul), sar(async (req, res) => {
  const donus = donusAdresi(req.body.donus, `/talepler/${req.talep._id}`);
  if (degerlendirmeIslemiMi(String(req.body.islem || ''))) {
    const p = await Proje().findById(req.talep.projeId).select('belgeler').lean();
    if (!metinVarMi(p)) return res.redirect(metinGerekliAdres(req.talep.projeId));
  }
  const r = akis.uygula(req.talep, String(req.body.islem || ''), { ...baglam(req, res), not: req.body.not });
  if (r.hata) return res.redirect(bildirimEkle(donus, 'islem-yapilamadi') + '&hata=' + encodeURIComponent(r.hata));
  await req.talep.save();
  return res.redirect(bildirimEkle(donus, 'islem-yapildi'));
}));

// Yürütücünün değişiklik önerisi (geri gönderilen başvuruda; geçerli değerler değişmez)
router.post('/:id/oneri', sar(talepBul), sar(async (req, res) => {
  const donus = donusAdresi(req.body.donus, `/talepler/${req.talep._id}`);
  const proje = await Proje().findById(req.talep.projeId);
  const ayar = res.locals.ayar;
  const r = akis.oneriKaydet(req.talep, proje, {
    talepKalemleri: talepKalemleriniOku(req.body, proje),
    hayvanlar: hayvanlariOku(req.body.hayvanlar, ayar.hayvanTurleri),
    not: req.body.not
  }, baglam(req, res));
  if (r.hata) return res.redirect(bildirimEkle(donus, 'islem-yapilamadi') + '&hata=' + encodeURIComponent(r.hata));
  await req.talep.save();
  return res.redirect(bildirimEkle(donus, 'oneri-kaydedildi'));
}));

// Koordinatör: öneriyi not yazarak kabul ya da reddeder
router.post('/:id/oneri-karar', sar(talepBul), sar(async (req, res) => {
  const donus = donusAdresi(req.body.donus, `/talepler/${req.talep._id}`);
  const proje = await Proje().findById(req.talep.projeId);
  const r = akis.oneriKarar(req.talep, proje, { kabul: req.body.karar === 'kabul', not: req.body.not }, baglam(req, res));
  if (r.hata) return res.redirect(bildirimEkle(donus, 'islem-yapilamadi') + '&hata=' + encodeURIComponent(r.hata));
  await req.talep.save();
  return res.redirect(bildirimEkle(donus, req.body.karar === 'kabul' ? 'oneri-kabul' : 'oneri-red'));
}));

// Değerlendirmede değer değişikliği (eski değer geçmişte kalır)
router.post('/:id/degistir', sar(talepBul), sar(async (req, res) => {
  const donus = donusAdresi(req.body.donus, `/talepler/${req.talep._id}`);
  const proje = await Proje().findById(req.talep.projeId);
  if (!metinVarMi(proje)) return res.redirect(metinGerekliAdres(req.talep.projeId));
  const ayar = res.locals.ayar;
  const r = akis.degistir(req.talep, proje, {
    talepKalemleri: talepKalemleriniOku(req.body, proje),
    hayvanlar: hayvanlariOku(req.body.hayvanlar, ayar.hayvanTurleri),
    not: req.body.not
  }, baglam(req, res));
  if (r.hata) return res.redirect(bildirimEkle(donus, 'islem-yapilamadi') + '&hata=' + encodeURIComponent(r.hata));
  await req.talep.save();
  return res.redirect(bildirimEkle(donus, 'degisiklik-kaydedildi'));
}));

router.post('/:id/sil', sar(talepBul), sar(async (req, res) => {
  const projeId = req.talep.projeId;
  await req.talep.deleteOne();
  return res.redirect(`/talepler?proje=${projeId}&bildirim=talep-silindi`);
}));

module.exports = router;
