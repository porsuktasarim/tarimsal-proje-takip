// Formlar: uygulama talimatı eklerinin PDF / Word / Excel çıktısı.
//   GET /belgeler                       proje seçimi ve form listesi
//   GET /belgeler/:form?talep=&kontrol=&bicim=     başvuru başına formlar (EK-1, 2, 4, 5)
//   GET /belgeler/:form?proje=&ilce=&bicim=        liste formları (EK-3, kontrol raporu, asıl/yedek)

const express = require('express');
const mongoose = require('mongoose');
const { FORMLAR } = require('./formlar');
const belge = require('../../core/belge');
const { talepHesabi } = require('../projeler/hesap');
const { degerlendirmeHesabi } = require('../projeler/degerlendirme-hesabi');
const bbhbIsletmeler = require('../bbhb/isletmeler');
const { calisilanIlceler, ilceKisitliMi, yetkiGerekli } = require('../../core/yetki');

const router = express.Router();
const V = 'belgeler/views/';
router.use(yetkiGerekli('talep.gor'));
const sar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const Proje = () => mongoose.model('Proje');
const Talep = () => mongoose.model('Talep');
const Ciftci = () => mongoose.model('Ciftci');
const Kisi = () => mongoose.model('Kisi');

// Formun kapsamına giren başvuru aşamaları
const KAPSAM = {
  basvuru: ['taslak', 'gonderildi', 'incelemede', 'yurutucude', 'desteklendi', 'yedek', 'teslim'],
  desteklenen: ['desteklendi', 'teslim'],
  kontrol: ['desteklendi', 'teslim'],
  karar: ['desteklendi', 'teslim', 'yedek']
};

const dosyaAdi = (s) => String(s).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
const asciiAd = (s) => s.replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => ({ ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I', ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U' }[c])).replace(/[^\x20-\x7e]/g, '_');

async function gonder(res, model, bicim, ad) {
  const { icerik, tur, uzanti } = await belge.olustur(model, bicim);
  const tam = `${dosyaAdi(ad)}.${uzanti}`;
  const tip = bicim === 'pdf' ? 'inline' : 'attachment';
  res.set('Content-Type', tur);
  res.set('Content-Disposition', `${tip}; filename="${asciiAd(tam)}"; filename*=UTF-8''${encodeURIComponent(tam)}`);
  res.send(icerik);
}

router.get('/', sar(async (req, res) => {
  const projeler = await Proje().find({ durum: { $ne: 'iptal' } }).sort({ olusturulma: -1 }).select('ad kisaAd donem durum').lean();
  const proje = req.query.proje && mongoose.isValidObjectId(req.query.proje)
    ? await Proje().findById(req.query.proje).lean()
    : (projeler[0] ? await Proje().findById(projeler[0]._id).lean() : null);
  let sayilar = {};
  let talepler = [];
  if (proje) {
    const ilceler = calisilanIlceler(req.ben, res.locals.ayar);
    const filtre = { projeId: proje._id };
    if (ilceKisitliMi(req.ben, res.locals.ayar)) filtre.ilce = { $in: ilceler };
    if (req.query.ilce) filtre.ilce = req.query.ilce;
    talepler = await Talep().find(filtre).select('ciftciId ilce durum kontroller._id kontroller.tarih').populate('ciftciId', 'adSoyad tcKimlikNo mahalle').lean();
    talepler = talepler.filter((t) => t.ciftciId).sort((a, b) => a.ilce.localeCompare(b.ilce, 'tr') || a.ciftciId.adSoyad.localeCompare(b.ciftciId.adSoyad, 'tr'));
    Object.entries(KAPSAM).forEach(([k, d]) => { sayilar[k] = talepler.filter((t) => d.includes(t.durum)).length; });
    sayilar.kontrol = talepler.reduce((a, t) => a + (t.kontroller || []).length, 0);
  }
  res.render(V + 'index', {
    baslik: 'Formlar', projeler, proje, talepler, sayilar, FORMLAR, KAPSAM,
    ilce: req.query.ilce || '', ilceler: calisilanIlceler(req.ben, res.locals.ayar), bicimler: belge.BICIMLER
  });
}));

router.get('/:form', sar(async (req, res, next) => {
  const tanim = FORMLAR[req.params.form];
  if (!tanim) return next();
  const ayar = res.locals.ayar;
  const bicim = belge.BICIMLER[req.query.bicim] ? req.query.bicim : 'pdf';
  const kisitli = ilceKisitliMi(req.ben, ayar);
  const ilceler = calisilanIlceler(req.ben, ayar);

  // Başvuru başına formlar
  if (tanim.tekil) {
    if (!mongoose.isValidObjectId(req.query.talep)) return res.status(400).send('Başvuru seçilmedi.');
    const talep = await Talep().findById(req.query.talep).lean();
    if (!talep) return next();
    if (kisitli && !ilceler.includes(talep.ilce)) return res.status(403).send('Bu ilçenin başvurularına erişiminiz yok.');
    const [proje, ciftci] = await Promise.all([Proje().findById(talep.projeId).lean(), Ciftci().findById(talep.ciftciId).lean()]);
    if (!proje || !ciftci) return next();
    const hesap = talepHesabi(talep, proje, ayar);
    const v = { talep, ciftci, proje, ayar, hesap };
    if (req.params.form === 'ek4' && talep.uygulama && talep.uygulama.teslimEden) {
      v.teslimEden = await Kisi().findById(talep.uygulama.teslimEden).select('adSoyad unvan').lean();
    }
    if (req.params.form === 'ek5' && req.query.kontrol) {
      v.kontrol = (talep.kontroller || []).find((k) => String(k._id) === String(req.query.kontrol));
      if (!v.kontrol) return res.status(404).send('Kontrol kaydı bulunamadı.');
    }
    const model = tanim.tekil(v);
    return gonder(res, model, bicim, `${tanim.kod} ${tanim.ad} - ${ciftci.adSoyad}`);
  }

  // Liste formları
  if (!mongoose.isValidObjectId(req.query.proje)) return res.status(400).send('Proje seçilmedi.');
  const proje = await Proje().findById(req.query.proje).lean();
  if (!proje) return next();
  const ilce = req.query.ilce || '';
  const filtre = { projeId: proje._id, durum: { $in: KAPSAM[tanim.kapsam] } };
  if (kisitli) filtre.ilce = { $in: ilceler };
  if (ilce) {
    if (kisitli && !ilceler.includes(ilce)) return res.status(403).send('Bu ilçenin başvurularına erişiminiz yok.');
    filtre.ilce = ilce;
  }
  const talepler = (await Talep().find(filtre).select('-gecmis').populate('ciftciId').lean()).filter((t) => t.ciftciId);
  const harita = req.params.form === 'asil-yedek' ? await bbhbIsletmeler.isletmeHaritasi() : null;
  const satirlar = talepler.map((t) => {
    const ciftci = t.ciftciId;
    const hesap = talepHesabi(t, proje, ayar);
    const s = { talep: { ...t, ciftciId: ciftci._id }, ciftci, hesap };
    if (harita) s.deg = degerlendirmeHesabi(t, ciftci, proje, ayar, hesap, bbhbIsletmeler.ciftciBbhb(ciftci, harita));
    return s;
  }).sort((a, b) => a.talep.ilce.localeCompare(b.talep.ilce, 'tr') || a.ciftci.adSoyad.localeCompare(b.ciftci.adSoyad, 'tr'));
  const puanVar = satirlar.some((s) => s.deg && s.deg.puan != null);
  const model = tanim.liste({ satirlar, proje, ayar, ilce, puanVar });
  return gonder(res, model, bicim, `${tanim.kod} ${tanim.ad} - ${proje.kisaAd || proje.ad}${ilce ? ' - ' + ilce : ''}`);
}));

module.exports = router;
