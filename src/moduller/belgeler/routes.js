// Formlar: uygulama talimatı eklerinin PDF / Word / Excel çıktısı.
//   GET /belgeler                       proje seçimi ve form listesi
//   GET /belgeler/:form?talep=&kontrol=&bicim=     başvuru başına formlar (EK-1, 2, 4, 5)
//   GET /belgeler/:form?proje=&ilce=&bicim=        liste formları (EK-3, kontrol raporu, asıl/yedek, icmal ...)
//   GET /belgeler/hazirla/:form?talep=|proje=      çıktı öncesi girilen bilgiler (EK-2, izleme formu, ödeme yazısı)

const express = require('express');
const mongoose = require('mongoose');
const { FORMLAR } = require('./formlar');
const belge = require('../../core/belge');
const { talepHesabi } = require('../projeler/hesap');
const { degerlendirmeHesabi } = require('../projeler/degerlendirme-hesabi');
const bbhbIsletmeler = require('../bbhb/isletmeler');
const { calisilanIlceler, ilceKisitliMi, yetkiGerekli, projeFiltresi, projeErisebilirMi, projeErisimYok } = require('../../core/yetki');

const router = express.Router();
const V = 'belgeler/views/';
router.use(yetkiGerekli('talep.gor'));
const sar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const Proje = () => mongoose.model('Proje');
const Talep = () => mongoose.model('Talep');
const Ciftci = () => mongoose.model('Ciftci');
const Kisi = () => mongoose.model('Kisi');
const IlceYetkilisi = require('./model');
const { tarihOku } = require('../../core/yardimcilar');
const metin = (v) => (typeof v === 'string' ? v.trim() : '');

// İlçe müdürünü kim düzenler: Sistem Yöneticisi, genel ayar yetkisi olan ya da
// ilçesi kendisine bağlı ve talep giren kişi (ilçe sorumlusu)
const yetkiliDuzenlerMi = (req, ilce) => !!(req.silebilir || req.izin('ayar.genel') ||
  (req.ben && (req.ben.ilceler || []).includes(ilce) && req.izin(['talep.gir', 'talep.degerlendir'])));
// Çıktı alınırken girilen seçenekler (EK-2: sözleşme tarihi, imza yetkilisi)
async function secenekleriOku(q, ilce) {
  const kayit = await IlceYetkilisi.findOne({ ilce }).lean();
  const ad = metin(q.yetkiliAd) || (kayit && kayit.ad) || '';
  const unvan = metin(q.yetkiliUnvan) || (kayit && kayit.unvan) || '';
  return { sozlesmeTarihi: tarihOku(q.sozlesmeTarihi), yetkili: { ad, unvan } };
}

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
  const projeler = await Proje().find({ ...projeFiltresi(req), durum: { $ne: 'iptal' } }).sort({ olusturulma: -1 }).select('ad kisaAd donem durum').lean();
  const proje = req.query.proje && mongoose.isValidObjectId(req.query.proje) && projeErisebilirMi(req, req.query.proje)
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
  const ilceListesi = res.locals.ayar.ilceler || [];
  const yetkililer = await IlceYetkilisi.find({}).lean();
  res.render(V + 'index', {
    yetkililer: ilceListesi.map((i) => ({ ilce: i, kayit: yetkililer.find((x) => x.ilce === i) || {}, duzenlenebilir: yetkiliDuzenlerMi(req, i) })),
    baslik: 'Formlar', projeler, proje, talepler, sayilar, FORMLAR, KAPSAM,
    ilce: req.query.ilce || '', ilceler: calisilanIlceler(req.ben, res.locals.ayar), bicimler: belge.BICIMLER
  });
}));

// İlçe müdürü kaydı
router.post('/ilce-yetkilisi', sar(async (req, res) => {
  const ilce = metin(req.body.ilce);
  const donus = typeof req.body.donus === 'string' && /^\/belgeler/.test(req.body.donus) ? req.body.donus : '/belgeler';
  const ek = donus.includes('?') ? '&' : '?';
  if (!(res.locals.ayar.ilceler || []).includes(ilce)) return res.redirect(donus + ek + 'bildirim=islem-yapilamadi');
  if (!yetkiliDuzenlerMi(req, ilce)) return res.redirect(donus + ek + 'bildirim=islem-yapilamadi&hata=' + encodeURIComponent(`${ilce} ilçe müdürünü yalnızca ilçe sorumlusu düzenleyebilir.`));
  await IlceYetkilisi.findOneAndUpdate({ ilce }, {
    ilce, ad: metin(req.body.yetkiliAd) || undefined, unvan: metin(req.body.yetkiliUnvan) || undefined,
    ...(req.body.birimUyeleri !== undefined ? { birimUyeleri: String(req.body.birimUyeleri).split(/\r?\n|;/).map((x) => x.trim()).filter(Boolean) } : {}),
    guncelleyenAd: req.ben ? req.ben.adSoyad : undefined
  }, { upsert: true, new: true, setDefaultsOnInsert: true });
  return res.redirect(donus + ek + 'bildirim=kaydedildi');
}));

// Çıktı öncesi bilgiler (EK-2: sözleşme tarihi ve ilçe müdürü)
router.get('/hazirla/:form', sar(async (req, res, next) => {
  const tanim = FORMLAR[req.params.form];
  if (!tanim) return next();
  // Liste formları (proje izleme formu, ödeme yazısı): proje ve ilçe ile
  if (tanim.hazirla && mongoose.isValidObjectId(req.query.proje)) {
    if (!projeErisebilirMi(req, req.query.proje)) return projeErisimYok(res);
    const proje = await Proje().findById(req.query.proje).lean();
    if (!proje) return next();
    const kisiler = await Kisi().find({ aktif: true }).sort({ adSoyad: 1 }).select('adSoyad unvan eposta telefon').lean();
    const ekip = [...(proje.koordinatorler || []), ...(proje.yurutuculer || [])].map(String);
    return res.render(V + 'hazirla-liste', {
      baslik: tanim.ad, tanim, form: req.params.form, proje, kisiler, ekip,
      ilce: typeof req.query.ilce === 'string' ? req.query.ilce : '', ilceler: calisilanIlceler(req.ben, res.locals.ayar)
    });
  }
  if (!tanim.tekil || !mongoose.isValidObjectId(req.query.talep)) return next();
  const talep = await Talep().findById(req.query.talep).select('ciftciId ilce projeId durum').populate('ciftciId', 'adSoyad').lean();
  if (!talep || !talep.ciftciId) return next();
  if (!projeErisebilirMi(req, talep.projeId)) return projeErisimYok(res);
  if (ilceKisitliMi(req.ben, res.locals.ayar) && !calisilanIlceler(req.ben, res.locals.ayar).includes(talep.ilce)) return res.status(403).send('Bu ilçenin başvurularına erişiminiz yok.');
  const kayit = await IlceYetkilisi.findOne({ ilce: talep.ilce }).lean();
  res.render(V + 'hazirla', {
    baslik: `${tanim.kod} ${tanim.ad}`, tanim, form: req.params.form, talep, kayit: kayit || {},
    duzenlenebilir: yetkiliDuzenlerMi(req, talep.ilce), donus: req.originalUrl
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
  // Hem bireysel hem toplu alınabilen formlarda (katkı payı dilekçesi) başvuru verilmişse bireysel
  if (tanim.tekil && (req.query.talep || !tanim.liste)) {
    if (!mongoose.isValidObjectId(req.query.talep)) return res.status(400).send('Başvuru seçilmedi.');
    const talep = await Talep().findById(req.query.talep).lean();
    if (!talep) return next();
    if (!projeErisebilirMi(req, talep.projeId)) return projeErisimYok(res);
    if (kisitli && !ilceler.includes(talep.ilce)) return res.status(403).send('Bu ilçenin başvurularına erişiminiz yok.');
    const [proje, ciftci] = await Promise.all([Proje().findById(talep.projeId).lean(), Ciftci().findById(talep.ciftciId).lean()]);
    if (!proje || !ciftci) return next();
    const hesap = talepHesabi(talep, proje, ayar);
    const v = { talep, ciftci, proje, ayar, hesap, secenekler: await secenekleriOku(req.query, talep.ilce) };
    if (req.params.form === 'ek4' && talep.uygulama && talep.uygulama.teslimEden) {
      v.teslimEden = await Kisi().findById(talep.uygulama.teslimEden).select('adSoyad unvan').lean();
    }
    if (req.params.form === 'ek5' && req.query.kontrol) {
      v.kontrol = (talep.kontroller || []).find((k) => String(k._id) === String(req.query.kontrol));
      if (!v.kontrol) return res.status(404).send('Kontrol kaydı bulunamadı.');
    }
    const model = tanim.tekil(v);
    // Alt bilgi: proje kısa adı | başvuranın T.C.'si - adı soyadı (sağda sayfa numarası)
    model.altBilgi = `${proje.kisaAd || proje.ad} | ${ciftci.tcKimlikNo} - ${ciftci.adSoyad} | ${model.formAdi || tanim.ad}`;
    return gonder(res, model, bicim, `${tanim.kod} ${tanim.ad} - ${ciftci.adSoyad}`);
  }

  // Liste formları
  if (!mongoose.isValidObjectId(req.query.proje)) return res.status(400).send('Proje seçilmedi.');
  if (!projeErisebilirMi(req, req.query.proje)) return projeErisimYok(res);
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
  const ilceYetkilileri = await IlceYetkilisi.find({}).lean();
  // Çıktı alınırken girilen bilgiler (izleme formu, ödeme yazısı)
  const q = req.query;
  const secenekler = {
    tarih: tarihOku(q.tarih), sonTarih: tarihOku(q.sonTarih), sayi: metin(q.sayi), imzaciAd: metin(q.imzaciAd), imzaciUnvan: metin(q.imzaciUnvan),
    cevaplar: Object.fromEntries(['s1', 's2', 's3', 's4', 's5', 's6'].map((k) => [k, { secim: metin(q[k]), aciklama: metin(q[k + 'a']) }]))
  };
  const yurutenIdleri = [].concat(q.yurutenler || []).filter((id) => mongoose.isValidObjectId(id));
  secenekler.yurutenler = yurutenIdleri.length ? await Kisi().find({ _id: { $in: yurutenIdleri } }).select('adSoyad unvan eposta telefon').lean() : [];
  const model = tanim.liste({ satirlar, proje, ayar, ilce, puanVar, ilceYetkilileri, secenekler });
  model.altBilgi = `${proje.kisaAd || proje.ad}${ilce ? ' | ' + ilce : ''} | ${model.formAdi || tanim.ad}`;
  return gonder(res, model, bicim, `${tanim.kod} ${tanim.ad} - ${proje.kisaAd || proje.ad}${ilce ? ' - ' + ilce : ''}`);
}));

module.exports = router;
