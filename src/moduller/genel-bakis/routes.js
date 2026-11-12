const express = require('express');
const mongoose = require('mongoose');
const { projeHesabi, taleplerOzeti } = require('../projeler/hesap');
const { projeDurumlari } = require('../../config/sabitler');

const { yetkiGerekli } = require('../../core/yetki');

const router = express.Router();
router.use(yetkiGerekli('pano.gor'));
const sar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const ACIK = ['bekliyor', 'suruyor'];

function birimeTopla(hedef, kaynak) {
  Object.entries(kaynak || {}).forEach(([b, v]) => { hedef[b] = (hedef[b] || 0) + v; });
}

router.get('/', sar(async (req, res) => {
  const ayar = res.locals.ayar;
  const Proje = mongoose.model('Proje');
  const Gorev = mongoose.model('Gorev');
  const ben = req.ben;

  const donem = req.query.donem && ayar.donemAdlari.includes(req.query.donem) ? req.query.donem : '';
  const projeler = await Proje.find(donem ? { donem } : {}).sort({ olusturulma: -1 });
  const projeIdleri = projeler.map((p) => p._id);
  const gorevler = await Gorev.find({ projeId: { $in: projeIdleri } }).select('projeId durum sonTarih').lean();
  const tumTalepler = await mongoose.model('Talep').find({ projeId: { $in: projeIdleri }, durum: { $ne: 'reddedildi' } }).lean();

  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);

  // Proje bazında son durum
  const satirlar = projeler.map((p) => {
    const hesap = projeHesabi(p, ayar);
    const pg = gorevler.filter((g) => String(g.projeId) === String(p._id));
    const talep = taleplerOzeti(tumTalepler.filter((x) => String(x.projeId) === String(p._id)), p, ayar);
    return {
      proje: p,
      hesap,
      talep,
      gorev: {
        toplam: pg.length,
        tamam: pg.filter((g) => g.durum === 'tamamlandi').length,
        acik: pg.filter((g) => ACIK.includes(g.durum)).length,
        geciken: pg.filter((g) => ACIK.includes(g.durum) && g.sonTarih && g.sonTarih < bugun).length
      }
    };
  });

  // İptal edilenler toplamlara girmez
  const sayilanlar = satirlar.filter((s) => s.proje.durum !== 'iptal');
  const ozet = {
    projeSayisi: sayilanlar.length,
    durumlar: Object.fromEntries(Object.keys(projeDurumlari).map((k) => [k, satirlar.filter((s) => s.proje.durum === k).length])),
    hedefDekar: sayilanlar.reduce((t, s) => t + s.hesap.toplamDekar, 0),
    hedefCiftci: sayilanlar.reduce((t, s) => t + s.proje.toplamHedefCiftci, 0),
    talepCiftci: new Set(tumTalepler.map((x) => String(x.ciftciId))).size,
    talepAlan: sayilanlar.reduce((t, s) => t + s.talep.toplamAlan, 0),
    butce: sayilanlar.reduce((t, s) => t + (s.hesap.butce.toplam || 0), 0),
    ciftciKatkisi: sayilanlar.reduce((t, s) => t + (s.talep.ciftciKatkisi || 0), 0),
    ilceSayisi: new Set(sayilanlar.flatMap((s) => s.proje.ilceler.map((i) => i.ilce))).size,
    dagitim: {},
    ciktilar: ayar.ciktiNormlari.map((n) => ({ norm: n, toplamlar: {} }))
  };
  sayilanlar.forEach((s) => {
    birimeTopla(ozet.dagitim, s.hesap.miktarToplamlari);
    s.hesap.ciktiToplamlari.forEach((c, i) => birimeTopla(ozet.ciktilar[i].toplamlar, c.toplamlar));
  });

  // Görev özeti (tüm görevler, projeye bağlı olmayanlar dahil)
  const tumGorevler = await Gorev.find(donem ? { projeId: { $in: projeIdleri } } : {}).select('durum sonTarih').lean();
  const gorevOzeti = {
    acik: tumGorevler.filter((g) => ACIK.includes(g.durum)).length,
    geciken: tumGorevler.filter((g) => ACIK.includes(g.durum) && g.sonTarih && g.sonTarih < bugun).length,
    tamam: tumGorevler.filter((g) => g.durum === 'tamamlandi').length,
    toplam: tumGorevler.length
  };

  // Kişinin açık görevleri
  let benimGorevlerim = [];
  if (ben) {
    benimGorevlerim = await Gorev.find({ $and: [Gorev.kisiSorgusu(ben), { durum: { $in: ACIK } }] })
      .populate('projeId', 'ad kisaAd').populate('atama.kisiId', 'adSoyad rol')
      .sort({ sonTarih: 1, olusturulma: -1 });
    benimGorevlerim.sort((a, b) => (a.sonTarih ? 0 : 1) - (b.sonTarih ? 0 : 1));
  }

  res.render('genel-bakis/views/pano', {
    baslik: 'Genel Bakış', satirlar, ozet, gorevOzeti, benimGorevlerim, donem
  });
}));

module.exports = router;
