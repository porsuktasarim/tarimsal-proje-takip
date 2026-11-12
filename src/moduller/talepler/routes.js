const express = require('express');
const mongoose = require('mongoose');
const Talep = require('./model');
const Ciftci = require('../ciftciler/model');
const { ciftciFormuOku, ciftciDenetle } = require('../ciftciler/routes');
const { talepHesabi, fiyatBirimi } = require('../projeler/hesap');
const { normOku } = require('../ayarlar/katalog');
const { talepDurumlari } = require('../../config/sabitler');
const { sayiOku, diziyeCevir, anahtar, sonucBirimi } = require('../../core/yardimcilar');
const { calisilanIlceler, ilceKisitliMi } = require('../../core/yetki');

const router = express.Router();
const V = 'talepler/views/';
const sar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const metin = (v) => (v === undefined || v === null ? '' : String(v).trim());
const Proje = () => mongoose.model('Proje');

// Talep girilebilecek projeler (iptal ve tamamlananlar dışında)
const acikProjeler = () => Proje().find({ durum: { $in: ['taslak', 'aktif'] } }).sort({ olusturulma: -1 });

// Formdaki canlı hesap için kalem bilgileri
function kalemVerisi(proje, ayar) {
  const ekim = ayar.ekimNormu;
  return proje.kalemler.map((k) => {
    const n = ekim ? normOku(k.normlar, ekim.kod) : null;
    const ekimBirimi = n ? (n.birim || ekim.birim) : null;
    return {
      _id: String(k._id),
      ad: k.urun + (k.cesit ? ' · ' + k.cesit : ''),
      tur: k.tur,
      ekim: n ? n.deger : null,
      ihtiyacBirimi: ekimBirimi ? sonucBirimi(ekimBirimi) : null,
      olcuBirimi: k.olcuBirimi,
      ambalaj: k.ambalaj && k.ambalaj.miktar > 0 ? { miktar: k.ambalaj.miktar, birim: k.ambalaj.birim } : null,
      birimFiyat: k.birimFiyat != null ? k.birimFiyat : null,
      fiyatBirimi: fiyatBirimi(k)
    };
  });
}

function satirlariOku(govde, proje) {
  return diziyeCevir(govde.satirlar)
    .map((s) => ({
      ...(mongoose.isValidObjectId(s._id) ? { _id: s._id } : {}),
      kalemId: metin(s.kalemId),
      parselIlce: metin(s.parselIlce) || undefined,
      mahalle: metin(s.mahalle) || undefined,
      ada: metin(s.ada) || undefined,
      parsel: metin(s.parsel) || undefined,
      alan: sayiOku(s.alan)
    }))
    .filter((s) => s.kalemId || s.alan !== undefined || s.ada || s.parsel)
    .map((s) => ({ ...s, kalemGecerli: proje.kalemler.some((k) => String(k._id) === s.kalemId) }));
}

function satirlariDenetle(satirlar) {
  const hatalar = [];
  if (!satirlar.length) hatalar.push('En az bir parsel satırı girilmelidir.');
  satirlar.forEach((s, i) => {
    if (!s.kalemGecerli) hatalar.push(`${i + 1}. satırda ekilecek kalem seçilmelidir.`);
    if (s.alan === undefined || s.alan <= 0) hatalar.push(`${i + 1}. satırda ekilecek alan (da) girilmelidir.`);
    if (!s.parselIlce) hatalar.push(`${i + 1}. satırda parselin ilçesi seçilmelidir.`);
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
  const projeler = await Proje().find().sort({ olusturulma: -1 }).select('ad kisaAd durum donem').lean();
  if (!projeler.length) return res.render(V + 'liste', { baslik: 'Çiftçi talepleri', projeler, proje: null, satirlar: [], filtre: {}, kisitli: false, toplam: {} });

  const projeId = mongoose.isValidObjectId(req.query.proje) ? req.query.proje
    : String((projeler.find((p) => p.durum === 'aktif') || projeler.find((p) => p.durum === 'taslak') || projeler[0])._id);
  const proje = await Proje().findById(projeId);
  if (!proje) return res.redirect('/talepler');

  const kisitli = ilceKisitliMi(ben);
  const ilce = req.query.ilce !== undefined ? String(req.query.ilce) : (kisitli ? 'benim' : '');
  const filtre = { projeId: proje._id };
  if (ilce === 'benim' && kisitli) filtre.ilce = { $in: ben.ilceler };
  else if (ilce && ilce !== 'benim') filtre.ilce = ilce;
  if (req.query.durum && talepDurumlari[req.query.durum]) filtre.durum = req.query.durum;

  let talepler = await Talep.find(filtre).populate('ciftciId').sort({ ilce: 1, olusturulma: 1 });
  talepler = talepler.filter((t) => t.ciftciId);
  if (req.query.q) {
    const q = anahtar(req.query.q);
    talepler = talepler.filter((t) => anahtar(t.ciftciId.adSoyad).includes(q) || t.ciftciId.tcKimlikNo.includes(q));
  }

  const satirlar = talepler.map((t) => ({ talep: t, ciftci: t.ciftciId, hesap: talepHesabi(t, proje, ayar) }));
  const sayilan = satirlar.filter((s) => s.talep.durum !== 'reddedildi');
  const toplam = {
    ciftci: sayilan.length,
    alan: sayilan.reduce((a, s) => a + s.hesap.toplamAlan, 0),
    bedel: sayilan.reduce((a, s) => a + (s.hesap.bedel || 0), 0),
    ciftciKatkisi: sayilan.reduce((a, s) => a + (s.hesap.ciftciKatkisi || 0), 0),
    miktar: {}
  };
  sayilan.forEach((s) => s.hesap.kalemler.forEach((hk) => {
    if (hk.miktar == null) return;
    toplam.miktar[hk.kalem.olcuBirimi] = (toplam.miktar[hk.kalem.olcuBirimi] || 0) + hk.miktar;
  }));

  res.render(V + 'liste', {
    baslik: 'Çiftçi talepleri', projeler, proje, satirlar, toplam, kisitli, filtre: { ...req.query, ilce, proje: String(proje._id) }
  });
}));

router.get('/yeni', sar(async (req, res) => {
  const ayar = res.locals.ayar;
  const proje = mongoose.isValidObjectId(req.query.proje) ? await Proje().findById(req.query.proje) : null;
  if (!proje) {
    const projeler = await acikProjeler();
    if (projeler.length === 1) return res.redirect('/talepler/yeni?proje=' + projeler[0]._id);
    return res.render(V + 'proje-sec', { baslik: 'Talep gir', projeler });
  }
  const ilceler = calisilanIlceler(req.ben, ayar);
  return formGoster(res, 200, {
    baslik: 'Talep gir',
    proje,
    talep: { satirlar: [] },
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
  const projeId = mevcutTalep ? mevcutTalep.projeId : req.body.projeId;
  const proje = mongoose.isValidObjectId(projeId) ? await Proje().findById(projeId) : null;
  if (!proje) return res.redirect('/talepler/yeni');

  const ilceler = calisilanIlceler(ben, ayar);
  const ciftciVeri = ciftciFormuOku(req.body.ciftci || {});
  const satirlar = satirlariOku(req.body, proje);
  const aciklama = metin(req.body.aciklama) || undefined;

  // Kayıtlı çiftçi T.C. ile bulunur; bilgileri formdakiyle güncellenir.
  let ciftci = ciftciVeri.tcKimlikNo ? await Ciftci.findOne({ tcKimlikNo: ciftciVeri.tcKimlikNo }) : null;
  let izinliIlceler = ilceler;
  if (ciftci && !ilceler.includes(ciftci.ilce)) {
    izinliIlceler = [...ilceler, ciftci.ilce];
  }
  const hatalar = [...ciftciDenetle(ciftciVeri, izinliIlceler), ...satirlariDenetle(satirlar)];
  if (ciftci && !ilceler.includes(ciftci.ilce) && ilceKisitliMi(ben)) {
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
      talep: { _id: mevcutTalep ? mevcutTalep._id : undefined, satirlar, aciklama },
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
    await ciftci.save();
    if (ciftci.ilce !== eskiIlce) await Talep.updateMany({ ciftciId: ciftci._id }, { $set: { ilce: ciftci.ilce } });
  } else {
    ciftci = await Ciftci.create({ ...ciftciVeri, kaydeden: ben ? ben._id : undefined, kaydedenAd: ben ? ben.adSoyad : undefined });
  }

  const veri = { projeId: proje._id, ciftciId: ciftci._id, ilce: ciftci.ilce, satirlar: satirlar.map(temizSatir), aciklama };
  let talep = mevcutTalep;
  if (talep) {
    talep.set(veri);
    await talep.save();
  } else {
    talep = await Talep.create({ ...veri, kaydeden: ben ? ben._id : undefined, kaydedenAd: ben ? ben.adSoyad : undefined });
  }
  const sonra = req.body.sonra === 'yeni' ? `/talepler/yeni?proje=${proje._id}&bildirim=talep-kaydedildi` : `/talepler/${talep._id}?bildirim=talep-kaydedildi`;
  return res.redirect(sonra);
}

router.post('/', sar(async (req, res) => kaydet(req, res, null)));

async function talepBul(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return next('route');
  req.talep = await Talep.findById(req.params.id);
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
  res.render(V + 'detay', { baslik: ciftci.adSoyad, talep: req.talep, proje, ciftci, hesap, kalemAdi });
}));

router.get('/:id/duzenle', sar(talepBul), sar(async (req, res) => {
  const [proje, ciftci] = await Promise.all([Proje().findById(req.talep.projeId), Ciftci.findById(req.talep.ciftciId)]);
  if (!proje || !ciftci) return res.redirect('/talepler');
  const ilceler = calisilanIlceler(req.ben, res.locals.ayar);
  if (!ilceler.includes(ciftci.ilce)) ilceler.push(ciftci.ilce);
  return formGoster(res, 200, {
    baslik: 'Talebi düzenle', proje, talep: req.talep.toObject(), ciftci: ciftci.toObject(), ilceler, hatalar: [], eylem: `/talepler/${req.talep._id}`
  });
}));

router.post('/:id', sar(talepBul), sar(async (req, res) => kaydet(req, res, req.talep)));

router.post('/:id/durum', sar(talepBul), sar(async (req, res) => {
  if (talepDurumlari[req.body.durum]) {
    req.talep.durum = req.body.durum;
    await req.talep.save();
  }
  return res.redirect(`/talepler/${req.talep._id}?bildirim=talep-durum`);
}));

router.post('/:id/sil', sar(talepBul), sar(async (req, res) => {
  const projeId = req.talep.projeId;
  await req.talep.deleteOne();
  return res.redirect(`/talepler?proje=${projeId}&bildirim=talep-silindi`);
}));

module.exports = router;
