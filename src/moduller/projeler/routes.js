const express = require('express');
const mongoose = require('mongoose');
const Proje = require('./model');
const { birimler, ilceler, projeDurumlari } = require('../../config/sabitler');
const { sayiOku, diziyeCevir } = require('../../core/yardimcilar');

const router = express.Router();
const V = 'projeler/views/';

const tarihOku = (v) => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

// Form gövdesini proje verisine çevirir ve doğrular.
function formuOku(govde) {
  const veri = {
    ad: (govde.ad || '').trim(),
    kisaAd: (govde.kisaAd || '').trim() || undefined,
    birim: (govde.birim || '').trim(),
    donem: (govde.donem || '').trim() || undefined,
    baslangicTarihi: tarihOku(govde.baslangicTarihi),
    bitisTarihi: tarihOku(govde.bitisTarihi),
    aciklama: (govde.aciklama || '').trim() || undefined,
    kalemler: diziyeCevir(govde.kalemler)
      .map((k) => ({
        // Mevcut kalemin kimliği korunur; sonraki modüller kaleme bu kimlikle bağlanır.
        ...(mongoose.isValidObjectId(k._id) ? { _id: k._id } : {}),
        tur: (k.tur || '').trim(),
        ad: (k.ad || '').trim(),
        olcuBirimi: (k.olcuBirimi || '').trim(),
        dekarBasiMiktar: sayiOku(k.dekarBasiMiktar),
        toplamMiktar: sayiOku(k.toplamMiktar),
        aciklama: (k.aciklama || '').trim() || undefined
      }))
      .filter((k) => k.ad),
    ilceler: diziyeCevir(govde.ilceler)
      .filter((i) => i && i.ilce && ilceler.includes(i.ilce))
      .map((i) => ({ ilce: i.ilce, hedefCiftci: sayiOku(i.hedefCiftci), hedefDekar: sayiOku(i.hedefDekar) }))
  };

  const hatalar = [];
  if (!veri.ad) hatalar.push('Proje adı girilmelidir.');
  if (!birimler.includes(veri.birim)) hatalar.push('Yürütücü birim seçilmelidir.');
  if (veri.baslangicTarihi && veri.bitisTarihi && veri.bitisTarihi < veri.baslangicTarihi) {
    hatalar.push('Bitiş tarihi başlangıç tarihinden önce olamaz.');
  }
  if (veri.kalemler.length === 0) hatalar.push('En az bir kalem eklenmelidir.');
  veri.kalemler.forEach((k, i) => {
    if (!k.tur || !k.olcuBirimi) hatalar.push(`${i + 1}. kalemin türü ve ölçü birimi seçilmelidir.`);
  });
  if (veri.ilceler.length === 0) hatalar.push('Projenin uygulanacağı en az bir ilçe seçilmelidir.');

  return { veri, hatalar };
}

async function projeBul(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return next();
  const proje = await Proje.findById(req.params.id);
  if (!proje) return next();
  req.proje = proje;
  return next();
}

const sar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Liste
router.get('/', sar(async (req, res) => {
  const filtre = {};
  if (req.query.birim && birimler.includes(req.query.birim)) filtre.birim = req.query.birim;
  if (req.query.durum && projeDurumlari[req.query.durum]) filtre.durum = req.query.durum;
  if (req.query.q) {
    const aranan = String(req.query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filtre.$or = [{ ad: new RegExp(aranan, 'i') }, { kisaAd: new RegExp(aranan, 'i') }, { donem: new RegExp(aranan, 'i') }];
  }
  const projeler = await Proje.find(filtre).sort({ olusturulma: -1 });
  const sayilar = await Proje.aggregate([{ $group: { _id: '$durum', adet: { $sum: 1 } } }]);
  const durumSayilari = Object.fromEntries(sayilar.map((s) => [s._id, s.adet]));
  res.render(V + 'liste', { baslik: 'Projeler', projeler, filtre: req.query, durumSayilari });
}));

// Proje Başlat
router.get('/yeni', (req, res) => {
  res.render(V + 'form', {
    baslik: 'Proje Başlat',
    proje: { birim: birimler.length === 1 ? birimler[0] : '', kalemler: [], ilceler: [] },
    hatalar: [],
    eylem: '/projeler'
  });
});

router.post('/', sar(async (req, res) => {
  const { veri, hatalar } = formuOku(req.body);
  if (hatalar.length) {
    return res.status(422).render(V + 'form', { baslik: 'Proje Başlat', proje: veri, hatalar, eylem: '/projeler' });
  }
  const proje = await Proje.create(veri);
  return res.redirect(`/projeler/${proje._id}?bildirim=olusturuldu`);
}));

router.get('/:id', sar(projeBul), (req, res, next) => {
  if (!req.proje) return next();
  return res.render(V + 'detay', { baslik: req.proje.ad, proje: req.proje });
});

router.get('/:id/duzenle', sar(projeBul), (req, res, next) => {
  if (!req.proje) return next();
  return res.render(V + 'form', {
    baslik: 'Projeyi Düzenle', proje: req.proje, hatalar: [], eylem: `/projeler/${req.proje._id}`
  });
});

router.post('/:id', sar(projeBul), sar(async (req, res, next) => {
  if (!req.proje) return next();
  const { veri, hatalar } = formuOku(req.body);
  if (hatalar.length) {
    veri._id = req.proje._id;
    return res.status(422).render(V + 'form', {
      baslik: 'Projeyi Düzenle', proje: veri, hatalar, eylem: `/projeler/${req.proje._id}`
    });
  }
  req.proje.set(veri);
  await req.proje.save();
  return res.redirect(`/projeler/${req.proje._id}?bildirim=guncellendi`);
}));

router.post('/:id/durum', sar(projeBul), sar(async (req, res, next) => {
  if (!req.proje) return next();
  if (projeDurumlari[req.body.durum]) {
    req.proje.durum = req.body.durum;
    await req.proje.save();
  }
  return res.redirect(`/projeler/${req.proje._id}?bildirim=durum`);
}));

// Yalnızca taslak projeler silinebilir; yürütülen projeler iptal edilir.
router.post('/:id/sil', sar(projeBul), sar(async (req, res, next) => {
  if (!req.proje) return next();
  if (req.proje.durum !== 'taslak') {
    return res.redirect(`/projeler/${req.proje._id}?bildirim=silinemez`);
  }
  await req.proje.deleteOne();
  return res.redirect('/projeler?bildirim=silindi');
}));

module.exports = router;
