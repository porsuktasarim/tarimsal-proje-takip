const express = require('express');
const mongoose = require('mongoose');
const Gorev = require('./model');
const Kisi = require('../ayarlar/modeller/Kisi');
const { gorevDurumlari, oncelikler } = require('../../config/sabitler');
const { tarihOku } = require('../../core/yardimcilar');
const { yetkiGerekli, yetkisizSayfa } = require('../../core/yetki');

const router = express.Router();
const V = 'gorevler/views/';
const sar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const metin = (v) => (v === undefined || v === null ? '' : String(v).trim());
const rolVarMi = (ayar, kod) => !!(kod && ayar.rolHaritasi[kod]);

// Görev kişiye ya da kişinin rolüne verilmişse ya da kişi görevi vermişse ilgilidir.
function ilgiliMi(gorev, ben) {
  if (!ben) return false;
  const kisiId = gorev.atama.kisiId && (gorev.atama.kisiId._id || gorev.atama.kisiId);
  const olusturan = gorev.olusturan && (gorev.olusturan._id || gorev.olusturan);
  return (gorev.atama.tur === 'kisi' && String(kisiId) === String(ben._id))
    || (gorev.atama.tur === 'rol' && gorev.atama.rol === ben.rol)
    || String(olusturan) === String(ben._id);
}

const hareket = (ben, tur, ek = {}) => ({
  tarih: new Date(),
  kisiId: ben ? ben._id : undefined,
  kisiAd: ben ? ben.adSoyad : 'Bilinmiyor',
  tur,
  ...ek
});

// Liste ve sayfalarda kullanılan doldurma
const doldur = (q) => q
  .populate('projeId', 'ad kisaAd')
  .populate('atama.kisiId', 'adSoyad rol')
  .populate('olusturan', 'adSoyad');

async function secenekler() {
  const Proje = mongoose.model('Proje');
  const [kisiler, projeler] = await Promise.all([
    Kisi.find({ aktif: true }).sort({ adSoyad: 1 }).lean(),
    Proje.find({ durum: { $in: ['taslak', 'aktif'] } }).sort({ olusturulma: -1 }).select('ad kisaAd durum').lean()
  ]);
  return { kisiler, projeler };
}

function formuOku(g, ayar) {
  const tur = g.atamaTur === 'rol' ? 'rol' : 'kisi';
  return {
    baslik: metin(g.baslik),
    aciklama: metin(g.aciklama) || undefined,
    atama: {
      tur,
      kisiId: tur === 'kisi' && mongoose.isValidObjectId(g.kisiId) ? g.kisiId : undefined,
      rol: tur === 'rol' && rolVarMi(ayar, g.rol) ? g.rol : undefined
    },
    projeId: mongoose.isValidObjectId(g.projeId) ? g.projeId : undefined,
    ilce: metin(g.ilce) || undefined,
    sonTarih: tarihOku(g.sonTarih),
    oncelik: oncelikler[g.oncelik] ? g.oncelik : 'normal'
  };
}

function denetle(v) {
  const hatalar = [];
  if (!v.baslik) hatalar.push('Görev başlığı girilmelidir.');
  if (v.atama.tur === 'kisi' && !v.atama.kisiId) hatalar.push('Görevin verileceği kişi seçilmelidir.');
  if (v.atama.tur === 'rol' && !v.atama.rol) hatalar.push('Görevin verileceği rol seçilmelidir.');
  return hatalar;
}

async function formGoster(res, durum, yerel) {
  return res.status(durum).render(V + 'form', { ...(await secenekler()), ...yerel });
}

// ---------------------------------------------------------------------------

router.get('/', sar(async (req, res) => {
  const ben = req.ben;
  let gorunum = ['bana', 'tumu', 'verdigim'].includes(req.query.gorunum) ? req.query.gorunum : (ben ? 'bana' : 'tumu');
  if (gorunum === 'tumu' && !req.izin('gorev.gor')) gorunum = 'bana';
  const durum = req.query.durum === 'tumu' || gorevDurumlari[req.query.durum] ? req.query.durum : 'acik';

  const kosullar = [];
  if (gorunum === 'bana' && ben) kosullar.push(Gorev.kisiSorgusu(ben));
  if (gorunum === 'verdigim' && ben) kosullar.push({ olusturan: ben._id });
  if (durum === 'acik') kosullar.push({ durum: { $in: ['bekliyor', 'suruyor'] } });
  else if (durum !== 'tumu') kosullar.push({ durum });
  if (mongoose.isValidObjectId(req.query.proje)) kosullar.push({ projeId: req.query.proje });
  const filtre = kosullar.length ? { $and: kosullar } : {};

  const gorevler = await doldur(Gorev.find(filtre).sort({ sonTarih: 1, olusturulma: -1 }));
  // Son tarihi olmayanlar sona
  gorevler.sort((a, b) => (a.sonTarih ? 0 : 1) - (b.sonTarih ? 0 : 1));

  const sayac = {};
  if (ben) {
    sayac.bana = await Gorev.countDocuments({ $and: [Gorev.kisiSorgusu(ben), { durum: { $in: ['bekliyor', 'suruyor'] } }] });
    sayac.verdigim = await Gorev.countDocuments({ olusturan: ben._id, durum: { $in: ['bekliyor', 'suruyor'] } });
  }
  if (req.izin('gorev.gor')) sayac.tumu = await Gorev.countDocuments({ durum: { $in: ['bekliyor', 'suruyor'] } });

  const projeler = await mongoose.model('Proje').find().select('ad kisaAd').sort({ olusturulma: -1 }).lean();
  res.render(V + 'liste', { baslik: 'Görevler', gorevler, gorunum, durum, sayac, projeler, seciliProje: req.query.proje || '' });
}));

router.get('/yeni', yetkiGerekli('gorev.ver'), sar(async (req, res) => {
  const q = req.query;
  return formGoster(res, 200, {
    baslik: 'Yeni görev',
    gorev: {
      atama: {
        tur: rolVarMi(res.locals.ayar, q.rol) ? 'rol' : 'kisi',
        rol: rolVarMi(res.locals.ayar, q.rol) ? q.rol : undefined,
        kisiId: mongoose.isValidObjectId(q.kisi) ? q.kisi : undefined
      },
      projeId: mongoose.isValidObjectId(q.proje) ? q.proje : undefined,
      ilce: q.ilce || undefined,
      oncelik: 'normal'
    },
    hatalar: [],
    eylem: '/gorevler',
    geri: q.geri && String(q.geri).startsWith('/') ? q.geri : '/gorevler'
  });
}));

router.post('/', yetkiGerekli('gorev.ver'), sar(async (req, res) => {
  const veri = formuOku(req.body, res.locals.ayar);
  const hatalar = denetle(veri);
  if (hatalar.length) {
    return formGoster(res, 422, { baslik: 'Yeni görev', gorev: veri, hatalar, eylem: '/gorevler', geri: '/gorevler' });
  }
  veri.olusturan = req.ben ? req.ben._id : undefined;
  veri.hareketler = [hareket(req.ben, 'olusturma')];
  const gorev = await Gorev.create(veri);
  return res.redirect(`/gorevler/${gorev._id}?bildirim=gorev-olusturuldu`);
}));

async function gorevBul(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return next('route');
  req.gorev = await Gorev.findById(req.params.id);
  return req.gorev ? next() : next('route');
}

router.get('/:id', sar(gorevBul), sar(async (req, res) => {
  if (!req.izin('gorev.gor') && !ilgiliMi(req.gorev, req.ben)) return yetkisizSayfa(res);
  const gorev = await doldur(Gorev.findById(req.gorev._id));
  res.render(V + 'detay', { baslik: gorev.baslik, gorev });
}));

router.get('/:id/duzenle', yetkiGerekli('gorev.ver'), sar(gorevBul), sar(async (req, res) => formGoster(res, 200, {
  baslik: 'Görevi düzenle', gorev: req.gorev.toObject(), hatalar: [], eylem: `/gorevler/${req.gorev._id}`, geri: `/gorevler/${req.gorev._id}`
})));

router.post('/:id', yetkiGerekli('gorev.ver'), sar(gorevBul), sar(async (req, res) => {
  const veri = formuOku(req.body, res.locals.ayar);
  const hatalar = denetle(veri);
  if (hatalar.length) {
    veri._id = req.gorev._id;
    return formGoster(res, 422, { baslik: 'Görevi düzenle', gorev: veri, hatalar, eylem: `/gorevler/${req.gorev._id}`, geri: `/gorevler/${req.gorev._id}` });
  }
  req.gorev.set(veri);
  req.gorev.hareketler.push(hareket(req.ben, 'duzenleme'));
  await req.gorev.save();
  return res.redirect(`/gorevler/${req.gorev._id}?bildirim=gorev-guncellendi`);
}));

router.post('/:id/durum', sar(gorevBul), sar(async (req, res) => {
  if (!req.izin('gorev.ver') && !ilgiliMi(req.gorev, req.ben)) return yetkisizSayfa(res);
  const yeni = req.body.durum;
  const not = metin(req.body.not);
  if (gorevDurumlari[yeni] && yeni !== req.gorev.durum) {
    req.gorev.durum = yeni;
    req.gorev.tamamlanma = yeni === 'tamamlandi' ? new Date() : undefined;
    req.gorev.hareketler.push(hareket(req.ben, 'durum', { durum: yeni, metin: not || undefined }));
    await req.gorev.save();
  } else if (not) {
    req.gorev.hareketler.push(hareket(req.ben, 'not', { metin: not }));
    await req.gorev.save();
  }
  const geri = req.body.geri && String(req.body.geri).startsWith('/') ? req.body.geri : `/gorevler/${req.gorev._id}`;
  return res.redirect(geri + (geri.includes('?') ? '&' : '?') + 'bildirim=gorev-guncellendi');
}));

router.post('/:id/not', sar(gorevBul), sar(async (req, res) => {
  if (!req.izin('gorev.ver') && !ilgiliMi(req.gorev, req.ben)) return yetkisizSayfa(res);
  const not = metin(req.body.metin);
  if (not) {
    req.gorev.hareketler.push(hareket(req.ben, 'not', { metin: not }));
    await req.gorev.save();
  }
  return res.redirect(`/gorevler/${req.gorev._id}?bildirim=not-eklendi`);
}));

router.post('/:id/sil', yetkiGerekli('gorev.ver'), sar(gorevBul), sar(async (req, res) => {
  await req.gorev.deleteOne();
  return res.redirect('/gorevler?bildirim=gorev-silindi');
}));

module.exports = router;
