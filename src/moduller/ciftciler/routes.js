const express = require('express');
const mongoose = require('mongoose');
const Ciftci = require('./model');
const Talep = require('../talepler/model');
const { talepHesabi } = require('../projeler/hesap');
const { tcGecerliMi, anahtar } = require('../../core/yardimcilar');
const { calisilanIlceler, ilceKisitliMi, yetkiGerekli } = require('../../core/yetki');

const router = express.Router();
const V = 'ciftciler/views/';

// Görüntüleme ciftci.gor; ekleme/düzenleme/silme ciftci.yonet. T.C. sorgusu talep girenlere de açık.
router.use((req, res, next) => {
  if (/^\/tc\//.test(req.path)) return yetkiGerekli('ciftci.gor', 'talep.gir')(req, res, next);
  const goruntuleme = req.method === 'GET' && !/\/(yeni|duzenle)$/.test(req.path);
  return yetkiGerekli(goruntuleme ? 'ciftci.gor' : 'ciftci.yonet')(req, res, next);
});
const sar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const metin = (v) => (v === undefined || v === null ? '' : String(v).trim());

// Talep formu da aynı alanları kullanır.
function ciftciFormuOku(g) {
  return {
    tcKimlikNo: metin(g.tcKimlikNo).replace(/\D/g, ''),
    adSoyad: metin(g.adSoyad).replace(/\s+/g, ' '),
    telefon: metin(g.telefon) || undefined,
    ilce: metin(g.ilce),
    mahalle: metin(g.mahalle) || undefined,
    adres: metin(g.adres) || undefined,
    cks: g.cks === 'on' || g.cks === 'true' || g.cks === '1',
    aciklama: metin(g.aciklama) || undefined
  };
}

function ciftciDenetle(v, izinliIlceler) {
  const hatalar = [];
  if (!tcGecerliMi(v.tcKimlikNo)) hatalar.push('Geçerli bir T.C. kimlik numarası girilmelidir.');
  if (!v.adSoyad) hatalar.push('Çiftçinin adı soyadı girilmelidir.');
  if (!v.ilce) hatalar.push('Çiftçinin ilçesi seçilmelidir.');
  else if (!izinliIlceler.includes(v.ilce)) hatalar.push(`${v.ilce} ilçesine çiftçi kaydı yapma yetkiniz bulunmuyor.`);
  return hatalar;
}

// Çiftçilerin talep sayısı ve toplam alanı
async function talepOzetleri(ciftciIdleri) {
  const talepler = await Talep.find({ ciftciId: { $in: ciftciIdleri }, durum: { $ne: 'reddedildi' } }).select('ciftciId satirlar').lean();
  const ozet = {};
  talepler.forEach((t) => {
    const k = String(t.ciftciId);
    ozet[k] = ozet[k] || { proje: 0, alan: 0 };
    ozet[k].proje += 1;
    ozet[k].alan += (t.satirlar || []).reduce((a, s) => a + (s.alan || 0), 0);
  });
  return ozet;
}

router.get('/', sar(async (req, res) => {
  const ben = req.ben;
  const kisitli = ilceKisitliMi(ben, res.locals.ayar);
  const ilce = req.query.ilce !== undefined ? String(req.query.ilce) : (kisitli ? 'benim' : '');
  const filtre = {};
  if (ilce === 'benim' && kisitli) filtre.ilce = { $in: ben.ilceler };
  else if (ilce && ilce !== 'benim') filtre.ilce = ilce;
  if (req.query.cks === 'var') filtre.cks = true;
  if (req.query.cks === 'yok') filtre.cks = false;

  let ciftciler = await Ciftci.find(filtre).sort({ ilce: 1, adSoyad: 1 }).lean();
  if (req.query.q) {
    const q = anahtar(req.query.q);
    ciftciler = ciftciler.filter((c) => anahtar(c.adSoyad).includes(q) || c.tcKimlikNo.includes(q) || anahtar(c.mahalle).includes(q) || (c.telefon || '').includes(q));
  }
  const ozet = await talepOzetleri(ciftciler.map((c) => c._id));
  res.render(V + 'liste', { baslik: 'Çiftçiler', ciftciler, ozet, filtre: { ...req.query, ilce }, kisitli });
}));

// Talep formundaki T.C. sorgusu
router.get('/tc/:tc', sar(async (req, res) => {
  const c = await Ciftci.findOne({ tcKimlikNo: String(req.params.tc).replace(/\D/g, '') }).lean();
  res.json(c ? { bulundu: true, ciftci: c } : { bulundu: false, gecerli: tcGecerliMi(req.params.tc) });
}));

router.get('/yeni', (req, res) => {
  const ilceler = calisilanIlceler(req.ben, res.locals.ayar);
  res.render(V + 'form', {
    baslik: 'Yeni çiftçi', ciftci: { ilce: ilceler.length === 1 ? ilceler[0] : '' }, ilceler, hatalar: [], eylem: '/ciftciler'
  });
});

router.post('/', sar(async (req, res) => {
  const ilceler = calisilanIlceler(req.ben, res.locals.ayar);
  const veri = ciftciFormuOku(req.body);
  const hatalar = ciftciDenetle(veri, ilceler);
  const var_ = veri.tcKimlikNo && await Ciftci.findOne({ tcKimlikNo: veri.tcKimlikNo });
  if (var_) hatalar.push(`Bu T.C. kimlik numarasıyla kayıtlı çiftçi var: ${var_.adSoyad} (${var_.ilce}).`);
  if (hatalar.length) {
    return res.status(422).render(V + 'form', { baslik: 'Yeni çiftçi', ciftci: veri, ilceler, hatalar, eylem: '/ciftciler', mevcut: var_ });
  }
  veri.kaydeden = req.ben ? req.ben._id : undefined;
  veri.kaydedenAd = req.ben ? req.ben.adSoyad : undefined;
  const c = await Ciftci.create(veri);
  return res.redirect(`/ciftciler/${c._id}?bildirim=kaydedildi`);
}));

async function ciftciBul(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return next('route');
  req.ciftci = await Ciftci.findById(req.params.id);
  return req.ciftci ? next() : next('route');
}

// Çiftçi icmali: tüm projelerdeki talepleri
router.get('/:id', sar(ciftciBul), sar(async (req, res) => {
  const talepler = await Talep.find({ ciftciId: req.ciftci._id }).populate('projeId').sort({ olusturulma: -1 });
  const satirlar = talepler.filter((t) => t.projeId).map((t) => ({
    talep: t, proje: t.projeId, hesap: talepHesabi(t, t.projeId, res.locals.ayar)
  }));
  const sayilanlar = satirlar.filter((s) => s.talep.durum !== 'reddedildi');
  const toplam = {
    alan: sayilanlar.reduce((a, s) => a + s.hesap.toplamAlan, 0),
    bedel: sayilanlar.reduce((a, s) => a + (s.hesap.bedel || 0), 0),
    ciftciKatkisi: sayilanlar.reduce((a, s) => a + (s.hesap.ciftciKatkisi || 0), 0)
  };
  res.render(V + 'detay', { baslik: req.ciftci.adSoyad, ciftci: req.ciftci, satirlar, toplam });
}));

router.get('/:id/duzenle', sar(ciftciBul), (req, res) => {
  const ilceler = calisilanIlceler(req.ben, res.locals.ayar);
  if (!ilceler.includes(req.ciftci.ilce)) ilceler.push(req.ciftci.ilce);
  res.render(V + 'form', {
    baslik: 'Çiftçiyi düzenle', ciftci: req.ciftci.toObject(), ilceler, hatalar: [], eylem: `/ciftciler/${req.ciftci._id}`
  });
});

router.post('/:id', sar(ciftciBul), sar(async (req, res) => {
  const ilceler = calisilanIlceler(req.ben, res.locals.ayar);
  const veri = ciftciFormuOku(req.body);
  // Çiftçi başka ilçeye kayıtlıysa yürütücü ilçeyi değiştiremez ama bilgileri güncelleyebilir
  const izinli = ilceler.includes(req.ciftci.ilce) ? ilceler : [...ilceler, req.ciftci.ilce];
  const hatalar = ciftciDenetle(veri, izinli);
  if (veri.tcKimlikNo !== req.ciftci.tcKimlikNo) {
    const baska = await Ciftci.findOne({ tcKimlikNo: veri.tcKimlikNo, _id: { $ne: req.ciftci._id } });
    if (baska) hatalar.push(`Bu T.C. kimlik numarasıyla kayıtlı başka çiftçi var: ${baska.adSoyad}.`);
  }
  if (hatalar.length) {
    veri._id = req.ciftci._id;
    return res.status(422).render(V + 'form', { baslik: 'Çiftçiyi düzenle', ciftci: veri, ilceler: izinli, hatalar, eylem: `/ciftciler/${req.ciftci._id}` });
  }
  req.ciftci.set(veri);
  await req.ciftci.save();
  // Taleplerdeki ilçe çiftçinin ilçesini izler
  await Talep.updateMany({ ciftciId: req.ciftci._id }, { $set: { ilce: veri.ilce } });
  return res.redirect(`/ciftciler/${req.ciftci._id}?bildirim=kaydedildi`);
}));

router.post('/:id/sil', sar(ciftciBul), sar(async (req, res) => {
  if (await Talep.exists({ ciftciId: req.ciftci._id })) {
    return res.redirect(`/ciftciler/${req.ciftci._id}?bildirim=ciftci-talepli`);
  }
  await req.ciftci.deleteOne();
  return res.redirect('/ciftciler?bildirim=ciftci-silindi');
}));

module.exports = { router, ciftciFormuOku, ciftciDenetle };
