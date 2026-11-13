const express = require('express');
const mongoose = require('mongoose');
const Talep = require('./model');
const Ciftci = require('../ciftciler/model');
const { ciftciFormuOku, ciftciDenetle } = require('../ciftciler/routes');
const { talepHesabi, fiyatBirimi, normsuzMu } = require('../projeler/hesap');
const { normOku } = require('../ayarlar/katalog');
const { talepDurumlari } = require('../../config/sabitler');
const { sayiOku, diziyeCevir, anahtar, sonucBirimi, hayvanlariOku } = require('../../core/yardimcilar');
const { calisilanIlceler, ilceKisitliMi, yetkiGerekli } = require('../../core/yetki');
const akis = require('./akis');
const { degerlendirmeHesabi } = require('../projeler/degerlendirme-hesabi');

const router = express.Router();
const V = 'talepler/views/';

// Görüntüleme talep.gor; giriş/düzenleme talep.gir; akış işlemleri kendi yetkisine bakar
// (akis.js); silme yalnızca Sistem Yöneticisi (core/yetki.js).
router.use((req, res, next) => {
  let gerek = 'talep.gor';
  if (/\/(islem|degistir)$/.test(req.path)) gerek = ['talep.gir', 'talep.degerlendir'];
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
const acikProjeler = () => Proje().find({ durum: { $in: ['taslak', 'aktif'] } }).sort({ olusturulma: -1 });

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
      miktar: sayiOku(s.miktar)
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
  const projeler = await Proje().find().sort({ olusturulma: -1 }).select('ad kisaAd durum donem').lean();
  if (!projeler.length) return res.render(V + 'liste', { baslik: 'Çiftçi talepleri', projeler, proje: null, satirlar: [], filtre: {}, kisitli: false, toplam: {}, bekleyenler: {} });

  const projeId = mongoose.isValidObjectId(req.query.proje) ? req.query.proje
    : String((projeler.find((p) => p.durum === 'aktif') || projeler.find((p) => p.durum === 'taslak') || projeler[0])._id);
  const proje = await Proje().findById(projeId);
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
    baslik: 'Çiftçi talepleri', projeler, proje, satirlar, toplam, kisitli, bekleyenler, filtre: { ...req.query, ilce, proje: String(proje._id) }
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
  const proje = mongoose.isValidObjectId(projeId) ? await Proje().findById(projeId) : null;
  if (!proje) return res.redirect('/talepler/yeni');

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
      talep: { _id: mevcutTalep ? mevcutTalep._id : undefined, durum: mevcutTalep ? mevcutTalep.durum : undefined, talepKalemleri, satirlar, aciklama, hayvanlar },
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

  const veri = {
    projeId: proje._id, ciftciId: ciftci._id, ilce: ciftci.ilce, talepKalemleri: talepKalemleri.filter((t) => t.miktar > 0), satirlar: satirlar.map(temizSatir), hayvanlar, aciklama
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
  const deg = degerlendirmeHesabi(req.talep, ciftci, proje, res.locals.ayar, hesap);
  const islemler = akis.kullanilabilirIslemler(req.talep, baglam(req, res));
  const duzenlenebilir = req.izin('talep.gir') && (req.talep.durum === 'taslak' || req.silebilir);
  res.render(V + 'detay', {
    baslik: ciftci.adSoyad, talep: req.talep, proje, ciftci, hesap, kalemAdi, kalemBirimi, deg, islemler, duzenlenebilir,
    degistirilebilir: req.izin('talep.degerlendir') && req.talep.durum === 'incelemede', donus: req.originalUrl.split('?')[0]
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

// Akış işlemi: gönder, teslim al, yürütücüye gönder, karar, not ...
router.post('/:id/islem', sar(talepBul), sar(async (req, res) => {
  const donus = donusAdresi(req.body.donus, `/talepler/${req.talep._id}`);
  const r = akis.uygula(req.talep, String(req.body.islem || ''), { ...baglam(req, res), not: req.body.not });
  if (r.hata) return res.redirect(bildirimEkle(donus, 'islem-yapilamadi') + '&hata=' + encodeURIComponent(r.hata));
  await req.talep.save();
  return res.redirect(bildirimEkle(donus, 'islem-yapildi'));
}));

// Değerlendirmede değer değişikliği (eski değer geçmişte kalır)
router.post('/:id/degistir', sar(talepBul), sar(async (req, res) => {
  const donus = donusAdresi(req.body.donus, `/talepler/${req.talep._id}`);
  const proje = await Proje().findById(req.talep.projeId);
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
