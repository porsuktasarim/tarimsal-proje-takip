const express = require('express');
const mongoose = require('mongoose');
const ayarlar = require('../../core/ayarlar');
const Urun = require('./modeller/Urun');
const Kisi = require('./modeller/Kisi');
const { normTipleri, normBirimOnerileri, ambalajBirimleri } = require('../../config/sabitler');
const katalog = require('./katalog');
const { diziyeCevir, tarihOku, anahtar, kodUret } = require('../../core/yardimcilar');

const router = express.Router();
const V = 'ayarlar/views/';
const sar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Ayarlar içindeki sekmeler (sol menü)
const sekmeler = [
  { yol: '/ayarlar/genel', ad: 'Genel', ikon: 'ti-building-community' },
  { yol: '/ayarlar/kisiler', ad: 'Kişiler', ikon: 'ti-users' },
  { yol: '/ayarlar/roller', ad: 'Roller', ikon: 'ti-id-badge-2' },
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

  // Silinen normun değerleri ürünlerden ve çeşitlerden kaldırılır.
  if (silinenler.length) {
    const urunler = await Urun.find();
    for (const u of urunler) {
      silinenler.forEach((n) => {
        if (u.normlar) delete u.normlar[n.kod];
        u.cesitler.forEach((c) => { if (c.normlar) delete c.normlar[n.kod]; });
      });
      u.markModified('normlar');
      u.markModified('cesitler');
      await u.save();
    }
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
  const gorulen = new Set();
  const cesitler = diziyeCevir(govde.cesitler)
    .map((c) => ({
      eski: (c.eski || '').trim(),
      ad: (c.ad || '').trim(),
      ambalaj: katalog.ambalajFormuOku(c.ambalaj),
      // Çeşitte birim boş bırakılırsa ürünün birimi geçerli olur.
      normlar: katalog.normFormuOku(c.normlar, ayar.normlar, false),
      aciklama: (c.aciklama || '').trim() || undefined
    }))
    .filter((c) => c.ad && !gorulen.has(anahtar(c.ad)) && gorulen.add(anahtar(c.ad)));

  return {
    tur: (govde.tur || '').trim(),
    ad: (govde.ad || '').trim(),
    olcuBirimi: (govde.olcuBirimi || '').trim(),
    ambalaj: katalog.ambalajFormuOku(govde.ambalaj),
    normlar: katalog.normFormuOku(govde.normlar, ayar.normlar, true),
    cesitler,
    aciklama: (govde.aciklama || '').trim() || undefined
  };
}

// Kaydedilecek biçim: çeşitte birimi boş normlar ürünün birimini alır.
function urunKayitVerisi(veri) {
  return {
    ...veri,
    ambalaj: veri.ambalaj || undefined,
    cesitler: veri.cesitler.map((c) => {
      const normlar = {};
      Object.entries(c.normlar).forEach(([k, n]) => {
        normlar[k] = { deger: n.deger, birim: n.birim || (veri.normlar[k] && veri.normlar[k].birim) || '' };
      });
      return { ad: c.ad, normlar, ambalaj: c.ambalaj || undefined, aciklama: c.aciklama };
    })
  };
}

async function urunDenetle(veri, ayar, id) {
  const hatalar = [];
  if (!veri.tur) hatalar.push('Kalem türü seçilmelidir.');
  if (!veri.ad) hatalar.push('Ürün adı girilmelidir.');
  if (!veri.olcuBirimi) hatalar.push('Dağıtım birimi seçilmelidir.');
  if (veri.tur && veri.ad) {
    const ayni = (await Urun.find({ tur: veri.tur }).lean())
      .find((u) => anahtar(u.ad) === anahtar(veri.ad) && String(u._id) !== String(id || ''));
    if (ayni) hatalar.push(`${veri.tur} türünde "${ayni.ad}" adlı ürün zaten kayıtlı.`);
  }
  return hatalar;
}

function urunFormu(res, durum, yerel) {
  return res.status(durum).render(V + 'urun-form', {
    normBirimOnerileri, ambalajBirimleri, kullanim: 0, ...yerel
  });
}

router.get('/urunler', sar(async (req, res) => {
  const tur = req.query.tur && res.locals.ayar.kalemTurleri.includes(req.query.tur) ? req.query.tur : '';
  const urunler = (await Urun.find(tur ? { tur } : {}).lean()).map(katalog.urunDuz);
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
  urunFormu(res, 200, {
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
    return urunFormu(res, 422, { baslik: 'Yeni ürün', urun: veri, hatalar, eylem: '/ayarlar/urunler' });
  }
  await Urun.create(urunKayitVerisi(veri));
  return res.redirect(`/ayarlar/urunler?tur=${encodeURIComponent(veri.tur)}&bildirim=kaydedildi`);
}));

async function urunBul(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return next('route');
  req.urun = await Urun.findById(req.params.id);
  return req.urun ? next() : next('route');
}

router.get('/urunler/:id/duzenle', sar(urunBul), sar(async (req, res) => {
  const urun = katalog.urunDuz(req.urun);
  urun.cesitler.forEach((c) => { c.eski = c.ad; });
  urunFormu(res, 200, {
    baslik: 'Ürünü düzenle',
    urun,
    kullanim: await urunKullanimi(req.urun._id),
    hatalar: [],
    eylem: `/ayarlar/urunler/${req.urun._id}`
  });
}));

router.post('/urunler/:id', sar(urunBul), sar(async (req, res) => {
  const veri = urunFormuOku(req.body, res.locals.ayar);
  const hatalar = await urunDenetle(veri, res.locals.ayar, req.urun._id);
  if (hatalar.length) {
    veri._id = req.urun._id;
    return urunFormu(res, 422, {
      baslik: 'Ürünü düzenle', urun: veri, hatalar, eylem: `/ayarlar/urunler/${req.urun._id}`,
      kullanim: await urunKullanimi(req.urun._id)
    });
  }

  const adDegisti = req.urun.ad !== veri.ad || req.urun.tur !== veri.tur;
  const cesitAdlari = veri.cesitler.filter((c) => c.eski && c.eski !== c.ad);
  req.urun.set(urunKayitVerisi(veri));
  req.urun.markModified('normlar');
  req.urun.markModified('cesitler');
  await req.urun.save();

  // Ürün, tür ya da çeşit adı değişirse projelerdeki kalemler de güncellenir.
  if ((adDegisti || cesitAdlari.length) && mongoose.modelNames().includes('Proje')) {
    const projeler = await mongoose.model('Proje').find({ 'kalemler.urunId': req.urun._id });
    for (const p of projeler) {
      p.kalemler.forEach((k) => {
        if (String(k.urunId) !== String(req.urun._id)) return;
        k.urun = veri.ad;
        k.tur = veri.tur;
        const c = cesitAdlari.find((x) => k.cesit && anahtar(x.eski) === anahtar(k.cesit));
        if (c) k.cesit = c.ad;
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

// ---------------------------------------------------------------------------
// Roller (kodlar sabit; ad ve açıklama değiştirilebilir)
// ---------------------------------------------------------------------------
router.get('/roller', sar(async (req, res) => {
  const sayilar = {};
  for (const r of res.locals.ayar.roller) sayilar[r.kod] = await Kisi.countDocuments({ rol: r.kod, aktif: true });
  res.render(V + 'roller', { baslik: 'Roller', roller: res.locals.ayar.roller, sayilar, hatalar: [] });
}));

router.post('/roller', sar(async (req, res) => {
  const gelen = req.body.roller || {};
  const hatalar = [];
  const roller = res.locals.ayar.roller.map((r) => {
    const g = gelen[r.kod] || {};
    const ad = (g.ad || '').trim();
    if (!ad) hatalar.push(`"${r.ad}" rolünün adı boş bırakılamaz.`);
    return { kod: r.kod, ad: ad || r.ad, aciklama: (g.aciklama || '').trim() };
  });
  if (hatalar.length) return res.status(422).render(V + 'roller', { baslik: 'Roller', roller, sayilar: {}, hatalar });
  await ayarlar.guncelle({ roller });
  return res.redirect('/ayarlar/roller?bildirim=kaydedildi');
}));

// ---------------------------------------------------------------------------
// Kişiler
// ---------------------------------------------------------------------------
const ROL_KODLARI = ['yonetici', 'koordinator', 'yurutucu'];

async function kisiKullanimi(id) {
  let n = 0;
  if (mongoose.modelNames().includes('Proje')) {
    n += await mongoose.model('Proje').countDocuments({ $or: [{ koordinatorler: id }, { yurutuculer: id }] });
  }
  if (mongoose.modelNames().includes('Gorev')) {
    n += await mongoose.model('Gorev').countDocuments({ $or: [{ 'atama.kisiId': id }, { olusturan: id }] });
  }
  return n;
}

function kisiFormuOku(govde, ayar) {
  const ilceler = diziyeCevir(govde.ilceler).filter((i) => ayar.ilceler.includes(i));
  return {
    adSoyad: (govde.adSoyad || '').trim().replace(/\s+/g, ' '),
    unvan: (govde.unvan || '').trim() || undefined,
    rol: ROL_KODLARI.includes(govde.rol) ? govde.rol : '',
    birim: (govde.birim || '').trim() || undefined,
    ilceler,
    telefon: (govde.telefon || '').trim() || undefined,
    eposta: (govde.eposta || '').trim() || undefined,
    aktif: govde.aktif === 'on' || govde.aktif === 'true' || govde.aktif === '1',
    aciklama: (govde.aciklama || '').trim() || undefined
  };
}

function kisiDenetle(veri) {
  const hatalar = [];
  if (!veri.adSoyad) hatalar.push('Ad soyad girilmelidir.');
  if (!veri.rol) hatalar.push('Rol seçilmelidir.');
  return hatalar;
}

router.get('/kisiler', sar(async (req, res) => {
  const kisiler = await Kisi.find().sort({ aktif: -1, adSoyad: 1 });
  res.render(V + 'kisiler', { baslik: 'Kişiler', kisiler });
}));

router.get('/kisiler/yeni', (req, res) => {
  res.render(V + 'kisi-form', {
    baslik: 'Yeni kişi',
    kisi: { rol: ROL_KODLARI.includes(req.query.rol) ? req.query.rol : 'yurutucu', aktif: true, ilceler: [] },
    hatalar: [], eylem: '/ayarlar/kisiler', kullanim: 0
  });
});

router.post('/kisiler', sar(async (req, res) => {
  const veri = kisiFormuOku(req.body, res.locals.ayar);
  const hatalar = kisiDenetle(veri);
  if (hatalar.length) {
    return res.status(422).render(V + 'kisi-form', { baslik: 'Yeni kişi', kisi: veri, hatalar, eylem: '/ayarlar/kisiler', kullanim: 0 });
  }
  await Kisi.create(veri);
  return res.redirect('/ayarlar/kisiler?bildirim=kaydedildi');
}));

async function kisiBul(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return next('route');
  req.kisi = await Kisi.findById(req.params.id);
  return req.kisi ? next() : next('route');
}

router.get('/kisiler/:id/duzenle', sar(kisiBul), sar(async (req, res) => {
  res.render(V + 'kisi-form', {
    baslik: 'Kişiyi düzenle', kisi: req.kisi.toObject(), hatalar: [],
    eylem: `/ayarlar/kisiler/${req.kisi._id}`, kullanim: await kisiKullanimi(req.kisi._id)
  });
}));

router.post('/kisiler/:id', sar(kisiBul), sar(async (req, res) => {
  const veri = kisiFormuOku(req.body, res.locals.ayar);
  const hatalar = kisiDenetle(veri);
  if (hatalar.length) {
    veri._id = req.kisi._id;
    return res.status(422).render(V + 'kisi-form', {
      baslik: 'Kişiyi düzenle', kisi: veri, hatalar, eylem: `/ayarlar/kisiler/${req.kisi._id}`, kullanim: await kisiKullanimi(req.kisi._id)
    });
  }
  req.kisi.set(veri);
  await req.kisi.save();
  return res.redirect('/ayarlar/kisiler?bildirim=kaydedildi');
}));

// Görev ya da projede adı geçen kişi silinmez; pasif yapılır.
router.post('/kisiler/:id/sil', sar(kisiBul), sar(async (req, res) => {
  if ((await kisiKullanimi(req.kisi._id)) > 0) return res.redirect(`/ayarlar/kisiler/${req.kisi._id}/duzenle?bildirim=kisi-kullaniliyor`);
  await req.kisi.deleteOne();
  return res.redirect('/ayarlar/kisiler?bildirim=kisi-silindi');
}));

module.exports = router;
