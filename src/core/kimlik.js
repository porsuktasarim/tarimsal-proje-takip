const express = require('express');
const mongoose = require('mongoose');
const Kisi = require('../moduller/ayarlar/modeller/Kisi');

// "Kimsiniz?" girişi. Şifre yoktur: kişi listeden seçilir, seçim tarayıcıda
// çerezde tutulur. Henüz hiç kişi tanımlanmamışsa (ilk kurulum) seçim istenmez.
//
// res.locals.ben: seçili kişi (yoksa null)

const CEREZ = 'tpts_kisi';
const ACIK_YOLLAR = [/^\/kimlik/, /^\/public\//, /^\/vendor\//, /^\/favicon/];

function cerezOku(req, ad) {
  const baslik = req.headers.cookie || '';
  const parca = baslik.split(';').map((s) => s.trim()).find((s) => s.startsWith(ad + '='));
  return parca ? decodeURIComponent(parca.slice(ad.length + 1)) : null;
}

const duzKisi = (k) => (k ? { ...k.toObject({ virtuals: true }), _id: String(k._id) } : null);

async function kimlikAraKatmani(req, res, next) {
  try {
    if (ACIK_YOLLAR.some((r) => r.test(req.path))) return next();

    const id = cerezOku(req, CEREZ);
    let ben = null;
    if (id && mongoose.isValidObjectId(id)) {
      const k = await Kisi.findById(id);
      if (k && k.aktif) ben = duzKisi(k);
    }
    req.ben = ben;
    res.locals.ben = ben;
    // Sistem Yöneticisi atanmadıysa yetki denetimi uygulanmaz (ilk kurulum)
    res.locals.adminVar = !!(await Kisi.exists({ rol: 'admin', aktif: true }));

    if (!ben) {
      const kisiSayisi = await Kisi.countDocuments({ aktif: true });
      res.locals.kurulumKipi = kisiSayisi === 0;
      // Kişi tanımlıysa seçim istenir; ilk kurulumda Ayarlar'a erişim serbesttir.
      if (kisiSayisi > 0 && req.method === 'GET') {
        return res.redirect('/kimlik?geri=' + encodeURIComponent(req.originalUrl));
      }
    }
    return next();
  } catch (e) {
    return next(e);
  }
}

const router = express.Router();
const guvenliGeri = (g) => (typeof g === 'string' && g.startsWith('/') && !g.startsWith('//') ? g : '/');

router.get('/', async (req, res, next) => {
  try {
    const kisiler = await Kisi.find({ aktif: true }).sort({ adSoyad: 1 });
    if (!kisiler.length) return res.redirect('/ayarlar/kisiler');
    const id = cerezOku(req, CEREZ);
    res.render('kimlik', {
      baslik: 'Kimsiniz?',
      kisiler: kisiler.map(duzKisi),
      geri: guvenliGeri(req.query.geri),
      seciliId: id
    });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const id = req.body.kisi;
    if (!mongoose.isValidObjectId(id) || !(await Kisi.exists({ _id: id, aktif: true }))) return res.redirect('/kimlik');
    res.cookie(CEREZ, String(id), { maxAge: 365 * 24 * 3600 * 1000, httpOnly: true, sameSite: 'lax' });
    return res.redirect(guvenliGeri(req.body.geri));
  } catch (e) { return next(e); }
});

router.get('/degistir', (req, res) => {
  res.clearCookie(CEREZ);
  res.redirect('/kimlik');
});

module.exports = { kimlikAraKatmani, kimlikRouter: router };
