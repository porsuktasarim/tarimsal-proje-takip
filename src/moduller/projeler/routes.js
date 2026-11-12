const express = require('express');
const mongoose = require('mongoose');
const Proje = require('./model');
const Urun = require('../ayarlar/modeller/Urun');
const { projeHesabi } = require('./hesap');
const { projeDurumlari } = require('../../config/sabitler');
const { sayiOku, diziyeCevir, tarihOku, anahtar, mapDeger } = require('../../core/yardimcilar');

const router = express.Router();
const V = 'projeler/views/';
const sar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const metin = (v) => (v === undefined || v === null ? '' : String(v).trim());

// Form gövdesini proje verisine çevirir ve doğrular.
// "mevcut" düzenlenen projedir: ayarlardan kaldırılmış ama projede kayıtlı
// olan değerler (eski birim, dönem, ilçe) geçerli sayılır.
function formuOku(govde, ayar, mevcut) {
  const eski = mevcut || { kalemler: [], ilceler: [] };
  const gecerliIlceler = new Set([...ayar.ilceler, ...eski.ilceler.map((i) => i.ilce)]);

  const veri = {
    ad: metin(govde.ad),
    kisaAd: metin(govde.kisaAd) || undefined,
    birim: metin(govde.birim),
    donem: metin(govde.donem) || undefined,
    baslangicTarihi: tarihOku(govde.baslangicTarihi),
    bitisTarihi: tarihOku(govde.bitisTarihi),
    aciklama: metin(govde.aciklama) || undefined,
    kalemler: diziyeCevir(govde.kalemler)
      .map((k) => {
        const normlar = {};
        ayar.normlar.forEach((n) => {
          const d = sayiOku(k.normlar && k.normlar[n.kod]);
          if (d !== undefined) normlar[n.kod] = d;
        });
        return {
          // Mevcut kalemin kimliği korunur; sonraki modüller kaleme bu kimlikle bağlanır.
          ...(mongoose.isValidObjectId(k._id) ? { _id: k._id } : {}),
          urunId: mongoose.isValidObjectId(k.urunId) ? k.urunId : undefined,
          tur: metin(k.tur),
          urun: metin(k.urun),
          cesit: metin(k.cesit) || undefined,
          olcuBirimi: metin(k.olcuBirimi),
          alan: sayiOku(k.alan),
          normlar,
          toplamMiktar: sayiOku(k.toplamMiktar),
          aciklama: metin(k.aciklama) || undefined
        };
      })
      .filter((k) => k.urun || k.cesit || k.alan !== undefined || Object.keys(k.normlar).length),
    ilceler: diziyeCevir(govde.ilceler)
      .filter((i) => i && i.ilce && gecerliIlceler.has(i.ilce))
      .map((i) => ({ ilce: i.ilce, hedefCiftci: sayiOku(i.hedefCiftci), hedefDekar: sayiOku(i.hedefDekar) }))
  };

  const hatalar = [];
  if (!veri.ad) hatalar.push('Proje adı girilmelidir.');
  if (!veri.birim || !(ayar.birimler.includes(veri.birim) || veri.birim === eski.birim)) {
    hatalar.push('Yürütücü birim seçilmelidir.');
  }
  if (veri.donem && !(ayar.donemAdlari.includes(veri.donem) || veri.donem === eski.donem)) {
    hatalar.push('Seçilen dönem Ayarlar\'da tanımlı değil.');
  }
  if (veri.baslangicTarihi && veri.bitisTarihi && veri.bitisTarihi < veri.baslangicTarihi) {
    hatalar.push('Bitiş tarihi başlangıç tarihinden önce olamaz.');
  }
  if (veri.kalemler.length === 0) hatalar.push('En az bir kalem eklenmelidir.');
  veri.kalemler.forEach((k, i) => {
    if (!k.tur) hatalar.push(`${i + 1}. kalemin türü seçilmelidir.`);
    if (!k.urun) hatalar.push(`${i + 1}. kalemin ürün adı girilmelidir.`);
    if (!k.olcuBirimi) hatalar.push(`${i + 1}. kalemin ölçü birimi seçilmelidir.`);
  });
  if (veri.ilceler.length === 0) hatalar.push('Projenin uygulanacağı en az bir ilçe seçilmelidir.');

  return { veri, hatalar };
}

// Kalemleri ürün kataloğuyla eşleştirir. Katalogda olmayan ürün ya da çeşit
// kataloğa eklenir; kalemde boş bırakılan normlar ürünün varsayılanıyla dolar.
async function katalogaIsle(kalemler, ayar) {
  let eklenen = 0;
  for (const k of kalemler) {
    let urun = k.urunId ? await Urun.findById(k.urunId) : null;
    if (urun && (urun.tur !== k.tur || anahtar(urun.ad) !== anahtar(k.urun))) urun = null;
    if (!urun) {
      urun = (await Urun.find({ tur: k.tur })).find((u) => anahtar(u.ad) === anahtar(k.urun)) || null;
    }

    if (!urun) {
      urun = await Urun.create({
        tur: k.tur,
        ad: k.urun,
        olcuBirimi: k.olcuBirimi,
        cesitler: k.cesit ? [k.cesit] : [],
        normlar: k.normlar
      });
      eklenen += 1;
    } else if (k.cesit) {
      const varolan = urun.cesitler.find((c) => anahtar(c) === anahtar(k.cesit));
      if (varolan) {
        k.cesit = varolan;
      } else {
        urun.cesitler.push(k.cesit);
        await urun.save();
        eklenen += 1;
      }
    }

    ayar.normlar.forEach((n) => {
      if (k.normlar[n.kod] === undefined) {
        const d = mapDeger(urun.normlar, n.kod);
        if (d != null) k.normlar[n.kod] = d;
      }
    });
    k.urunId = urun._id;
    k.urun = urun.ad;
  }
  return eklenen;
}

async function katalogGetir() {
  const urunler = await Urun.find().sort({ ad: 1 }).lean();
  return urunler.map((u) => ({
    _id: String(u._id), tur: u.tur, ad: u.ad, olcuBirimi: u.olcuBirimi, cesitler: u.cesitler || [], normlar: u.normlar || {}
  }));
}

async function formuGoster(res, durum, sablon) {
  const katalog = await katalogGetir();
  return res.status(durum).render(V + 'form', { ...sablon, katalog });
}

async function projeBul(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return next('route');
  req.proje = await Proje.findById(req.params.id);
  return req.proje ? next() : next('route');
}

const duzOlarak = (p) => p.toObject({ flattenMaps: true, virtuals: true });

// ---------------------------------------------------------------------------

router.get('/', sar(async (req, res) => {
  const filtre = {};
  if (req.query.birim) filtre.birim = String(req.query.birim);
  if (req.query.durum && projeDurumlari[req.query.durum]) filtre.durum = req.query.durum;
  if (req.query.donem) filtre.donem = String(req.query.donem);
  let projeler = await Proje.find(filtre).sort({ olusturulma: -1 });
  if (req.query.q) {
    const q = anahtar(req.query.q);
    projeler = projeler.filter((p) => [p.ad, p.kisaAd, p.donem].some((v) => anahtar(v).includes(q)));
  }
  const durumSayilari = {};
  for (const k of Object.keys(projeDurumlari)) durumSayilari[k] = await Proje.countDocuments({ durum: k });
  res.render(V + 'liste', { baslik: 'Projeler', projeler, filtre: req.query, durumSayilari });
}));

router.get('/yeni', sar(async (req, res) => {
  const a = res.locals.ayar;
  return formuGoster(res, 200, {
    baslik: 'Proje Başlat',
    proje: {
      birim: a.birimler.length === 1 ? a.birimler[0] : '',
      donem: a.varsayilanDonem || '',
      kalemler: [],
      ilceler: []
    },
    hatalar: [],
    eylem: '/projeler'
  });
}));

router.post('/', sar(async (req, res) => {
  const ayar = res.locals.ayar;
  const { veri, hatalar } = formuOku(req.body, ayar);
  if (hatalar.length) {
    return formuGoster(res, 422, { baslik: 'Proje Başlat', proje: veri, hatalar, eylem: '/projeler' });
  }
  const eklenen = await katalogaIsle(veri.kalemler, ayar);
  const proje = await Proje.create(veri);
  return res.redirect(`/projeler/${proje._id}?bildirim=olusturuldu${eklenen ? '&katalog=' + eklenen : ''}`);
}));

router.get('/:id', sar(projeBul), (req, res) => {
  const hesap = projeHesabi(req.proje, res.locals.ayar);
  res.render(V + 'detay', {
    baslik: req.proje.ad,
    proje: req.proje,
    hesap,
    katalogEklenen: parseInt(req.query.katalog, 10) || 0
  });
});

router.get('/:id/duzenle', sar(projeBul), sar(async (req, res) => formuGoster(res, 200, {
  baslik: 'Projeyi Düzenle', proje: duzOlarak(req.proje), hatalar: [], eylem: `/projeler/${req.proje._id}`
})));

router.post('/:id', sar(projeBul), sar(async (req, res) => {
  const ayar = res.locals.ayar;
  const { veri, hatalar } = formuOku(req.body, ayar, req.proje);
  if (hatalar.length) {
    veri._id = req.proje._id;
    return formuGoster(res, 422, {
      baslik: 'Projeyi Düzenle', proje: veri, hatalar, eylem: `/projeler/${req.proje._id}`, mevcut: duzOlarak(req.proje)
    });
  }
  const eklenen = await katalogaIsle(veri.kalemler, ayar);
  req.proje.set(veri);
  await req.proje.save();
  return res.redirect(`/projeler/${req.proje._id}?bildirim=guncellendi${eklenen ? '&katalog=' + eklenen : ''}`);
}));

router.post('/:id/durum', sar(projeBul), sar(async (req, res) => {
  if (projeDurumlari[req.body.durum]) {
    req.proje.durum = req.body.durum;
    await req.proje.save();
  }
  return res.redirect(`/projeler/${req.proje._id}?bildirim=durum`);
}));

// Yalnızca taslak projeler silinebilir; yürütülen projeler iptal edilir.
router.post('/:id/sil', sar(projeBul), sar(async (req, res) => {
  if (req.proje.durum !== 'taslak') {
    return res.redirect(`/projeler/${req.proje._id}?bildirim=silinemez`);
  }
  await req.proje.deleteOne();
  return res.redirect('/projeler?bildirim=silindi');
}));

module.exports = router;
