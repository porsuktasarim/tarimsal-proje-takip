const express = require('express');
const mongoose = require('mongoose');
const ayarlar = require('../../core/ayarlar');
const Urun = require('./modeller/Urun');
const { normTipleri } = require('../../config/sabitler');
const { sayiOku, diziyeCevir, tarihOku, anahtar, kodUret } = require('../../core/yardimcilar');

const router = express.Router();
const V = 'ayarlar/views/';
const sar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Ayarlar içindeki sekmeler (sol menü)
const sekmeler = [
  { yol: '/ayarlar/genel', ad: 'Genel', ikon: 'ti-building-community' },
  { yol: '/ayarlar/birimler', ad: 'Yürütücü birimler', ikon: 'ti-sitemap' },
  { yol: '/ayarlar/donemler', ad: 'Dönemler', ikon: 'ti-calendar' },
  { yol: '/ayarlar/urunler', ad: 'Ürün kataloğu', ikon: 'ti-seeding' },
  { yol: '/ayarlar/normlar', ad: 'Hesaplama normları', ikon: 'ti-calculator' },
  { yol: '/ayarlar/kalem-turleri', ad: 'Kalem türleri', ikon: 'ti-category' },
  { yol: '/ayarlar/olcu-birimleri', ad: 'Ölçü birimleri', ikon: 'ti-ruler-measure' },
  { yol: '/ayarlar/ilceler', ad: 'İlçeler', ikon: 'ti-map-pin' }
];

router.use((req, res, next) => {
  res.locals.sekmeler = sekmeler;
  res.locals.aktifSekme = req.baseUrl + req.path.replace(/^(\/[^/]+).*$/, '$1');
  next();
});

router.get('/', (req, res) => res.redirect('/ayarlar/genel'));

// ---------------------------------------------------------------------------
// Genel
// ---------------------------------------------------------------------------
router.get('/genel', (req, res) => {
  res.render(V + 'genel', { baslik: 'Genel', deger: res.locals.ayar, hatalar: [] });
});

router.post('/genel', sar(async (req, res) => {
  const deger = { kurum: (req.body.kurum || '').trim(), il: (req.body.il || '').trim() };
  const hatalar = [];
  if (!deger.kurum) hatalar.push('Kurum adı girilmelidir.');
  if (!deger.il) hatalar.push('İl adı girilmelidir.');
  if (hatalar.length) return res.status(422).render(V + 'genel', { baslik: 'Genel', deger, hatalar });
  await ayarlar.guncelle(deger);
  return res.redirect('/ayarlar/genel?bildirim=kaydedildi');
}));

// ---------------------------------------------------------------------------
// Basit listeler: birimler, kalem türleri, ölçü birimleri, ilçeler
// ---------------------------------------------------------------------------
const listeler = {
  birimler: {
    yol: 'birimler', baslik: 'Yürütücü birimler', tekil: 'Birim adı',
    aciklama: 'Projeleri yürüten birimler. Proje başlatılırken bu listeden seçilir.'
  },
  kalemTurleri: {
    yol: 'kalem-turleri', baslik: 'Kalem türleri', tekil: 'Tür',
    aciklama: 'Projelerde dağıtılan kalemlerin türleri (tohum, fide, gübre vb.). Ürün kataloğu türlere göre gruplanır.'
  },
  olcuBirimleri: {
    yol: 'olcu-birimleri', baslik: 'Ölçü birimleri', tekil: 'Ölçü birimi',
    aciklama: 'Kalem miktarlarında kullanılan ölçü birimleri.'
  },
  ilceler: {
    yol: 'ilceler', baslik: 'İlçeler', tekil: 'İlçe',
    aciklama: 'Projelerin uygulanabileceği ilçeler. Proje formunda bu sırayla listelenir.'
  }
};

Object.entries(listeler).forEach(([alan, tanim]) => {
  router.get('/' + tanim.yol, sar(async (req, res) => {
    const mevcut = res.locals.ayar[alan];
    const kullanim = await ayarlar.kullanimlar(alan, mevcut);
    res.render(V + 'liste', {
      baslik: tanim.baslik, tanim, satirlar: mevcut.map((d) => ({ eski: d, ad: d })), kullanim, hatalar: []
    });
  }));

  router.post('/' + tanim.yol, sar(async (req, res) => {
    const mevcut = res.locals.ayar[alan];
    const satirlar = diziyeCevir(req.body.satirlar);
    const sonuc = await ayarlar.listeyiUygula(alan, satirlar, mevcut);
    if (sonuc.hatalar.length) {
      const kullanim = await ayarlar.kullanimlar(alan, mevcut);
      return res.status(422).render(V + 'liste', {
        baslik: tanim.baslik, tanim, satirlar, kullanim, hatalar: sonuc.hatalar
      });
    }
    await ayarlar.guncelle({ [alan]: sonuc.degerler });
    return res.redirect(`/ayarlar/${tanim.yol}?bildirim=kaydedildi`);
  }));
});

// ---------------------------------------------------------------------------
// Dönemler
// ---------------------------------------------------------------------------
router.get('/donemler', sar(async (req, res) => {
  const a = res.locals.ayar;
  const kullanim = await ayarlar.kullanimlar('donemler', a.donemAdlari);
  const satirlar = a.donemler.map((d) => ({ ...d, eski: d.ad, varsayilan: d.ad === a.varsayilanDonem }));
  res.render(V + 'donemler', { baslik: 'Dönemler', satirlar, kullanim, hatalar: [] });
}));

router.post('/donemler', sar(async (req, res) => {
  const a = res.locals.ayar;
  const satirlar = diziyeCevir(req.body.satirlar).map((s, i) => ({
    eski: (s.eski || '').trim(),
    ad: (s.ad || '').trim(),
    baslangic: tarihOku(s.baslangic),
    bitis: tarihOku(s.bitis),
    varsayilan: String(req.body.varsayilanSira) === String(i)
  }));

  const sonuc = await ayarlar.listeyiUygula('donemler', satirlar, a.donemAdlari);
  satirlar.forEach((s) => {
    if (s.baslangic && s.bitis && s.bitis < s.baslangic) sonuc.hatalar.push(`"${s.ad}" döneminin bitişi başlangıcından önce olamaz.`);
  });

  if (sonuc.hatalar.length) {
    const kullanim = await ayarlar.kullanimlar('donemler', a.donemAdlari);
    return res.status(422).render(V + 'donemler', { baslik: 'Dönemler', satirlar, kullanim, hatalar: sonuc.hatalar });
  }

  const donemler = satirlar.filter((s) => s.ad).map((s) => ({ ad: s.ad, baslangic: s.baslangic, bitis: s.bitis }));
  const secili = satirlar.find((s) => s.varsayilan && s.ad);
  await ayarlar.guncelle({ donemler, varsayilanDonem: secili ? secili.ad : '' });
  return res.redirect('/ayarlar/donemler?bildirim=kaydedildi');
}));

// ---------------------------------------------------------------------------
// Hesaplama normları
// ---------------------------------------------------------------------------
async function normKullanimi(kod) {
  if (!mongoose.modelNames().includes('Proje')) return 0;
  return mongoose.model('Proje').countDocuments({ [`kalemler.normlar.${kod}`]: { $exists: true } });
}

router.get('/normlar', sar(async (req, res) => {
  const normlar = res.locals.ayar.normlar;
  const kullanim = {};
  for (const n of normlar) kullanim[n.kod] = await normKullanimi(n.kod);
  res.render(V + 'normlar', { baslik: 'Hesaplama normları', satirlar: normlar, kullanim, hatalar: [], normTipleri });
}));

router.post('/normlar', sar(async (req, res) => {
  const mevcut = res.locals.ayar.normlar;
  const hatalar = [];
  const satirlar = diziyeCevir(req.body.satirlar)
    .map((s) => ({
      kod: (s.kod || '').trim(),
      ad: (s.ad || '').trim(),
      birim: (s.birim || '').trim(),
      tip: normTipleri[s.tip] ? s.tip : 'cikti'
    }))
    .filter((s) => s.ad || s.kod);

  // Yeni normlara addan kod verilir; kodlar sonradan değişmez.
  const kodlar = new Set(satirlar.map((s) => s.kod).filter(Boolean));
  satirlar.forEach((s, i) => {
    if (!s.ad) hatalar.push(`${i + 1}. satırdaki normun adı girilmelidir.`);
    if (!s.kod) {
      let kod = kodUret(s.ad);
      let n = 2;
      while (kodlar.has(kod)) kod = `${kodUret(s.ad)}_${n++}`;
      s.kod = kod;
      kodlar.add(kod);
    }
  });
  const adlar = satirlar.map((s) => anahtar(s.ad));
  if (new Set(adlar).size !== adlar.length) hatalar.push('Aynı adla birden fazla norm tanımlanamaz.');
  if (satirlar.filter((s) => s.tip === 'ekim').length > 1) {
    hatalar.push('Yalnızca bir norm "Ekim / uygulama normu" olarak tanımlanabilir; dağıtım miktarı bu normdan hesaplanır.');
  }

  const silinenler = mevcut.filter((n) => !satirlar.some((s) => s.kod === n.kod));
  const kullanim = {};
  for (const n of mevcut) kullanim[n.kod] = await normKullanimi(n.kod);
  silinenler.forEach((n) => {
    if (kullanim[n.kod] > 0) hatalar.push(`"${n.ad}" ${kullanim[n.kod]} projede kullanıldığı için silinemez.`);
  });

  if (hatalar.length) {
    return res.status(422).render(V + 'normlar', { baslik: 'Hesaplama normları', satirlar, kullanim, hatalar, normTipleri });
  }

  for (const n of silinenler) {
    await Urun.updateMany({}, { $unset: { [`normlar.${n.kod}`]: '' } });
  }
  await ayarlar.guncelle({ normlar: satirlar });
  return res.redirect('/ayarlar/normlar?bildirim=kaydedildi');
}));

// ---------------------------------------------------------------------------
// Ürün kataloğu
// ---------------------------------------------------------------------------
async function urunKullanimi(id) {
  if (!mongoose.modelNames().includes('Proje')) return 0;
  return mongoose.model('Proje').countDocuments({ 'kalemler.urunId': id });
}

function urunFormuOku(govde, ayar) {
  const normlar = {};
  ayar.normlar.forEach((n) => {
    const d = sayiOku(govde.normlar && govde.normlar[n.kod]);
    if (d !== undefined) normlar[n.kod] = d;
  });
  const gorulen = new Set();
  const cesitler = String(govde.cesitler || '')
    .split(/[\n,;]+/)
    .map((c) => c.trim())
    .filter((c) => c && !gorulen.has(anahtar(c)) && gorulen.add(anahtar(c)));
  return {
    tur: (govde.tur || '').trim(),
    ad: (govde.ad || '').trim(),
    olcuBirimi: (govde.olcuBirimi || '').trim(),
    cesitler,
    normlar,
    aciklama: (govde.aciklama || '').trim() || undefined
  };
}

async function urunDenetle(veri, ayar, id) {
  const hatalar = [];
  if (!veri.tur) hatalar.push('Kalem türü seçilmelidir.');
  if (!veri.ad) hatalar.push('Ürün adı girilmelidir.');
  if (!veri.olcuBirimi) hatalar.push('Ölçü birimi seçilmelidir.');
  if (veri.tur && veri.ad) {
    const ayni = (await Urun.find({ tur: veri.tur }).lean())
      .find((u) => anahtar(u.ad) === anahtar(veri.ad) && String(u._id) !== String(id || ''));
    if (ayni) hatalar.push(`${veri.tur} türünde "${ayni.ad}" adlı ürün zaten kayıtlı.`);
  }
  return hatalar;
}

router.get('/urunler', sar(async (req, res) => {
  const tur = req.query.tur && res.locals.ayar.kalemTurleri.includes(req.query.tur) ? req.query.tur : '';
  const urunler = await Urun.find(tur ? { tur } : {}).lean();
  const sira = res.locals.ayar.kalemTurleri;
  urunler.sort((a, b) => {
    const t = (sira.indexOf(a.tur) + 1 || 999) - (sira.indexOf(b.tur) + 1 || 999);
    return t || a.ad.localeCompare(b.ad, 'tr');
  });
  const kullanim = {};
  for (const u of urunler) kullanim[u._id] = await urunKullanimi(u._id);
  res.render(V + 'urunler', { baslik: 'Ürün kataloğu', urunler, kullanim, tur });
}));

router.get('/urunler/yeni', (req, res) => {
  const a = res.locals.ayar;
  res.render(V + 'urun-form', {
    baslik: 'Yeni ürün',
    urun: { tur: req.query.tur || a.kalemTurleri[0], olcuBirimi: a.olcuBirimleri[0], cesitler: [], normlar: {} },
    hatalar: [],
    eylem: '/ayarlar/urunler'
  });
});

router.post('/urunler', sar(async (req, res) => {
  const veri = urunFormuOku(req.body, res.locals.ayar);
  const hatalar = await urunDenetle(veri, res.locals.ayar);
  if (hatalar.length) {
    return res.status(422).render(V + 'urun-form', { baslik: 'Yeni ürün', urun: veri, hatalar, eylem: '/ayarlar/urunler' });
  }
  await Urun.create(veri);
  return res.redirect(`/ayarlar/urunler?tur=${encodeURIComponent(veri.tur)}&bildirim=kaydedildi`);
}));

async function urunBul(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return next('route');
  req.urun = await Urun.findById(req.params.id);
  return req.urun ? next() : next('route');
}

router.get('/urunler/:id/duzenle', sar(urunBul), sar(async (req, res) => {
  const urun = req.urun.toObject({ flattenMaps: true });
  const kullanim = await urunKullanimi(req.urun._id);
  res.render(V + 'urun-form', {
    baslik: 'Ürünü düzenle', urun, kullanim, hatalar: [], eylem: `/ayarlar/urunler/${req.urun._id}`
  });
}));

router.post('/urunler/:id', sar(urunBul), sar(async (req, res) => {
  const veri = urunFormuOku(req.body, res.locals.ayar);
  const hatalar = await urunDenetle(veri, res.locals.ayar, req.urun._id);
  if (hatalar.length) {
    veri._id = req.urun._id;
    return res.status(422).render(V + 'urun-form', {
      baslik: 'Ürünü düzenle', urun: veri, hatalar, eylem: `/ayarlar/urunler/${req.urun._id}`
    });
  }

  // Ad ya da tür değişirse projelerdeki kalemler de güncellenir.
  const adDegisti = req.urun.ad !== veri.ad || req.urun.tur !== veri.tur;
  req.urun.set(veri);
  req.urun.normlar = veri.normlar;
  await req.urun.save();

  if (adDegisti && mongoose.modelNames().includes('Proje')) {
    const projeler = await mongoose.model('Proje').find({ 'kalemler.urunId': req.urun._id });
    for (const p of projeler) {
      p.kalemler.forEach((k) => {
        if (String(k.urunId) === String(req.urun._id)) { k.urun = veri.ad; k.tur = veri.tur; }
      });
      await p.save({ validateBeforeSave: false });
    }
  }
  return res.redirect(`/ayarlar/urunler?tur=${encodeURIComponent(veri.tur)}&bildirim=kaydedildi`);
}));

router.post('/urunler/:id/sil', sar(urunBul), sar(async (req, res) => {
  const n = await urunKullanimi(req.urun._id);
  if (n > 0) return res.redirect(`/ayarlar/urunler/${req.urun._id}/duzenle?bildirim=urun-kullaniliyor`);
  await req.urun.deleteOne();
  return res.redirect('/ayarlar/urunler?bildirim=urun-silindi');
}));

module.exports = router;
