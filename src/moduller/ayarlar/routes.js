const express = require('express');
const mongoose = require('mongoose');
const ayarlar = require('../../core/ayarlar');
const Urun = require('./modeller/Urun');
const Kisi = require('./modeller/Kisi');
const {
  normTipleri, normBirimOnerileri, ambalajBirimleri, yetkiGruplari, tumYetkiler, rolRenkSecenekleri
} = require('../../config/sabitler');
const katalog = require('./katalog');
const { yetkisizSayfa } = require('../../core/yetki');
const { diziyeCevir, tarihOku, anahtar, kodUret } = require('../../core/yardimcilar');

const router = express.Router();
const V = 'ayarlar/views/';
const sar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Ayarlar içindeki sekmeler (sol menü)
const sekmeler = [
  { yol: '/ayarlar/genel', ad: 'Genel', ikon: 'ti-building-community', yetki: 'ayar.genel' },
  { yol: '/ayarlar/kisiler', ad: 'Kişiler', ikon: 'ti-users', yetki: 'ayar.kisi' },
  { yol: '/ayarlar/roller', ad: 'Roller ve yetkiler', ikon: 'ti-shield-lock', yetki: 'ayar.kisi' },
  { yol: '/ayarlar/birimler', ad: 'Yürütücü birimler', ikon: 'ti-sitemap', yetki: 'ayar.genel' },
  { yol: '/ayarlar/donemler', ad: 'Dönemler', ikon: 'ti-calendar', yetki: 'ayar.genel' },
  { yol: '/ayarlar/urunler', ad: 'Ürün kataloğu', ikon: 'ti-seeding', yetki: 'ayar.katalog' },
  { yol: '/ayarlar/normlar', ad: 'Hesaplama normları', ikon: 'ti-calculator', yetki: 'ayar.katalog' },
  { yol: '/ayarlar/hayvan-turleri', ad: 'Hayvan türleri', ikon: 'ti-paw', yetki: 'ayar.katalog' },
  { yol: '/ayarlar/kalem-turleri', ad: 'Kalem türleri', ikon: 'ti-category', yetki: 'ayar.katalog' },
  { yol: '/ayarlar/olcu-birimleri', ad: 'Dağıtım birimleri', ikon: 'ti-package', yetki: 'ayar.katalog' },
  { yol: '/ayarlar/talep-birimleri', ad: 'Talep birimleri', ikon: 'ti-ruler-measure', yetki: 'ayar.katalog' },
  { yol: '/ayarlar/ilceler', ad: 'İlçeler', ikon: 'ti-map-pin', yetki: 'ayar.genel' }
];

// Her sekme kendi yetkisini ister; menüde yalnızca yetkili sekmeler görünür.
router.use((req, res, next) => {
  const izinli = sekmeler.filter((s) => req.izin(s.yetki));
  res.locals.sekmeler = izinli;
  res.locals.aktifSekme = req.baseUrl + req.path.replace(/^(\/[^/]+).*$/, '$1');
  if (req.path === '/' || req.path === '') {
    return izinli.length ? res.redirect(izinli[0].yol) : yetkisizSayfa(res);
  }
  const sekme = sekmeler.find((s) => s.yol === res.locals.aktifSekme);
  if (sekme && !req.izin(sekme.yetki)) return yetkisizSayfa(res);
  return next();
});

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
    aciklama: 'Projelerde dağıtılan kalemlerin türleri (tohum, fide, gübre vb.). Ürün kataloğu türlere göre gruplanır.',
    isaret: {
      alan: 'normsuzTurler', baslik: 'Normsuz',
      aciklama: 'İşaretli türlerde ekim ve çıktı normları kullanılmaz; talep edilen miktar doğrudan dağıtılır (makine, ekipman, sera naylonu gibi).'
    }
  },
  olcuBirimleri: {
    yol: 'olcu-birimleri', baslik: 'Dağıtım birimleri', tekil: 'Ambalaj',
    aciklama: 'Kalemlerin çiftçiye dağıtıldığı ambalajlar (çuval, paket, torba, top, adet). İçeriği kalemde girilir: 1 çuval = 25 kg, 1 paket = 50.000 adet, 1 top = 100 m².'
  },
  talepBirimleri: {
    yol: 'talep-birimleri', baslik: 'Talep birimleri', tekil: 'Birim',
    aciklama: 'Çiftçi talebinin ve parsellerin girildiği birimler: tohumda dekar (da), fidan ve fidede adet, sera naylonunda metrekare (m²). Ekim normunun birimi "ambalaj içeriği / talep birimi" olur (kg/da, adet/adet, m²/m²).'
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
    const isaretli = tanim.isaret ? (res.locals.ayar[tanim.isaret.alan] || []) : [];
    res.render(V + 'liste', {
      baslik: tanim.baslik, tanim, satirlar: mevcut.map((d) => ({ eski: d, ad: d, isaret: isaretli.includes(d) })), kullanim, hatalar: []
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
    const degisiklik = { [alan]: sonuc.degerler };
    if (tanim.isaret) {
      degisiklik[tanim.isaret.alan] = satirlar
        .filter((s) => s && s.isaret && String(s.ad || '').trim())
        .map((s) => String(s.ad).trim());
    }
    await ayarlar.guncelle(degisiklik);
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
    talepBirimi: (govde.talepBirimi || '').trim() || 'da',
    olcuBirimi: (govde.olcuBirimi || '').trim(),
    ambalaj: katalog.ambalajFormuOku(govde.ambalaj),
    normlar: katalog.normFormuOku(govde.normlar, ayar.normlar, true),
    cesitler,
    aciklama: (govde.aciklama || '').trim() || undefined
  };
}

// Kaydedilecek biçim: çeşitte birimi boş normlar ürünün birimini alır; ekim
// normunun birimi ürünün (çeşitte varsa çeşidin) ambalaj içeriğinin birimine eşitlenir.
function urunKayitVerisi(veri, ayar) {
  const ekimKod = ayar && ayar.ekimNormu ? ayar.ekimNormu.kod : null;
  katalog.ekimBiriminiEsitle(veri.normlar, veri.ambalaj, ekimKod, veri.talepBirimi);
  veri.cesitler.forEach((c) => {
    if (c.normlar[ekimKod] && !c.normlar[ekimKod].birim && !c.ambalaj && veri.normlar[ekimKod]) {
      c.normlar[ekimKod].birim = veri.normlar[ekimKod].birim;
    }
    katalog.ekimBiriminiEsitle(c.normlar, c.ambalaj || veri.ambalaj, ekimKod, veri.talepBirimi);
  });
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
    urun: { tur: req.query.tur || a.kalemTurleri[0], talepBirimi: a.talepBirimleri[0] || 'da', olcuBirimi: a.olcuBirimleri[0], cesitler: [], normlar: {} },
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
  await Urun.create(urunKayitVerisi(veri, res.locals.ayar));
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
  req.urun.set(urunKayitVerisi(veri, res.locals.ayar));
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
// Hayvan türleri (talep değerlendirmesinde yardımcı bilgi)
// ---------------------------------------------------------------------------
async function hayvanKullanimi(kod) {
  if (!mongoose.modelNames().includes('Talep')) return 0;
  return mongoose.model('Talep').countDocuments({ [`hayvanlar.${kod}`]: { $exists: true } });
}

router.get('/hayvan-turleri', sar(async (req, res) => {
  const satirlar = res.locals.ayar.hayvanTurleri;
  const kullanim = {};
  for (const h of satirlar) kullanim[h.kod] = await hayvanKullanimi(h.kod);
  res.render(V + 'hayvan-turleri', { baslik: 'Hayvan türleri', satirlar, kullanim, hatalar: [] });
}));

router.post('/hayvan-turleri', sar(async (req, res) => {
  const mevcut = res.locals.ayar.hayvanTurleri;
  const hatalar = [];
  const satirlar = diziyeCevir(req.body.satirlar)
    .map((s) => ({ kod: (s.kod || '').trim(), ad: (s.ad || '').trim(), birim: (s.birim || '').trim() }))
    .filter((s) => s.ad || s.kod);
  const kodlar = new Set(satirlar.map((s) => s.kod).filter(Boolean));
  satirlar.forEach((s, i) => {
    if (!s.ad) hatalar.push(`${i + 1}. satırdaki hayvan türünün adı girilmelidir.`);
    if (!s.kod) {
      let kod = kodUret(s.ad);
      let n = 2;
      while (kodlar.has(kod)) kod = `${kodUret(s.ad)}_${n++}`;
      s.kod = kod;
      kodlar.add(kod);
    }
  });
  const adlar = satirlar.map((s) => anahtar(s.ad));
  if (new Set(adlar).size !== adlar.length) hatalar.push('Aynı adla birden fazla hayvan türü tanımlanamaz.');
  const kullanim = {};
  for (const h of mevcut) kullanim[h.kod] = await hayvanKullanimi(h.kod);
  mevcut.filter((h) => !satirlar.some((s) => s.kod === h.kod)).forEach((h) => {
    if (kullanim[h.kod] > 0) hatalar.push(`"${h.ad}" ${kullanim[h.kod]} talepte girildiği için silinemez.`);
  });
  if (hatalar.length) {
    return res.status(422).render(V + 'hayvan-turleri', { baslik: 'Hayvan türleri', satirlar, kullanim, hatalar });
  }
  await ayarlar.guncelle({ hayvanTurleri: satirlar });
  return res.redirect('/ayarlar/hayvan-turleri?bildirim=kaydedildi');
}));

// ---------------------------------------------------------------------------
// Roller ve yetkiler
// ---------------------------------------------------------------------------
async function rolKullanimi(kod) {
  const kisi = await Kisi.countDocuments({ rol: kod });
  const gorev = mongoose.modelNames().includes('Gorev') ? await mongoose.model('Gorev').countDocuments({ 'atama.tur': 'rol', 'atama.rol': kod }) : 0;
  return { kisi, gorev };
}

async function rollerSayfasi(res, durum, roller, hatalar) {
  const kullanim = {};
  for (const r of roller) if (r.kod) kullanim[r.kod] = await rolKullanimi(r.kod);
  return res.status(durum).render(V + 'roller', {
    baslik: 'Roller ve yetkiler', roller, kullanim, hatalar, yetkiGruplari, rolRenkSecenekleri
  });
}

router.get('/roller', sar(async (req, res) => rollerSayfasi(res, 200, res.locals.ayar.roller, [])));

router.post('/roller', sar(async (req, res) => {
  const mevcut = res.locals.ayar.roller;
  const hatalar = [];
  const satirlar = diziyeCevir(req.body.roller).map((r) => ({
    kod: (r.kod || '').trim(),
    ad: (r.ad || '').trim(),
    aciklama: (r.aciklama || '').trim(),
    renk: rolRenkSecenekleri.includes(r.renk) ? r.renk : 'secondary',
    ilceKisitli: r.ilceKisitli === 'on',
    yetkiler: diziyeCevir(r.yetkiler).filter((y) => tumYetkiler.includes(y))
  })).filter((r) => r.ad || r.kod);

  // Sistem Yöneticisi her zaman vardır ve tüm yetkilere sahiptir (yalnız adı/açıklaması/rengi değişir).
  const adminSatiri = satirlar.find((r) => r.kod === 'admin') || mevcut.find((r) => r.kod === 'admin');
  const digerleri = satirlar.filter((r) => r.kod !== 'admin');

  const kodlar = new Set(mevcut.map((r) => r.kod));
  digerleri.forEach((r, i) => {
    if (!r.ad) hatalar.push(`${i + 2}. rolün adı girilmelidir.`);
    if (!r.kod) {
      let kod = kodUret(r.ad);
      let n = 2;
      while (kodlar.has(kod) || kod === 'admin') kod = `${kodUret(r.ad)}_${n++}`;
      r.kod = kod;
    }
    kodlar.add(r.kod);
  });
  const adlar = [adminSatiri, ...digerleri].map((r) => anahtar(r.ad));
  if (new Set(adlar).size !== adlar.length) hatalar.push('Aynı adla birden fazla rol tanımlanamaz.');

  for (const r of mevcut.filter((m) => m.kod !== 'admin' && !digerleri.some((d) => d.kod === m.kod))) {
    const k = await rolKullanimi(r.kod);
    if (k.kisi) hatalar.push(`"${r.ad}" rolünde ${k.kisi} kişi olduğu için silinemez; önce kişilerin rolü değiştirilmelidir.`);
    if (k.gorev) hatalar.push(`"${r.ad}" rolüne verilmiş ${k.gorev} görev olduğu için silinemez.`);
  }

  const roller = [{ ...adminSatiri, kod: 'admin', ilceKisitli: false, yetkiler: [] }, ...digerleri];
  if (hatalar.length) return rollerSayfasi(res, 422, roller, hatalar);
  await ayarlar.guncelle({ roller });
  return res.redirect('/ayarlar/roller?bildirim=kaydedildi');
}));

// ---------------------------------------------------------------------------
// Kişiler
// ---------------------------------------------------------------------------

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
  const rolGecerli = !!ayar.rolHaritasi[govde.rol];
  const ilceler = diziyeCevir(govde.ilceler).filter((i) => ayar.ilceler.includes(i));
  return {
    adSoyad: (govde.adSoyad || '').trim().replace(/\s+/g, ' '),
    unvan: (govde.unvan || '').trim() || undefined,
    rol: rolGecerli ? govde.rol : '',
    birim: (govde.birim || '').trim() || undefined,
    ilceler,
    telefon: (govde.telefon || '').trim() || undefined,
    eposta: (govde.eposta || '').trim() || undefined,
    aktif: govde.aktif === 'on' || govde.aktif === 'true' || govde.aktif === '1',
    aciklama: (govde.aciklama || '').trim() || undefined
  };
}

// Sistem Yöneticisi tek kişidir.
async function kisiDenetle(veri, id) {
  const hatalar = [];
  if (!veri.adSoyad) hatalar.push('Ad soyad girilmelidir.');
  if (!veri.rol) hatalar.push('Rol seçilmelidir.');
  if (veri.rol === 'admin') {
    const diger = await Kisi.findOne({ rol: 'admin', ...(id ? { _id: { $ne: id } } : {}) });
    if (diger) hatalar.push(`Sistem Yöneticisi tek kişi olabilir; şu an ${diger.adSoyad} bu roldedir. Önce onun rolü değiştirilmelidir.`);
  }
  return hatalar;
}

router.get('/kisiler', sar(async (req, res) => {
  const kisiler = await Kisi.find().sort({ aktif: -1, adSoyad: 1 });
  res.render(V + 'kisiler', { baslik: 'Kişiler', kisiler });
}));

router.get('/kisiler/yeni', (req, res) => {
  res.render(V + 'kisi-form', {
    baslik: 'Yeni kişi',
    kisi: { rol: res.locals.ayar.rolHaritasi[req.query.rol] ? req.query.rol : '', aktif: true, ilceler: [] },
    hatalar: [], eylem: '/ayarlar/kisiler', kullanim: 0
  });
});

router.post('/kisiler', sar(async (req, res) => {
  const veri = kisiFormuOku(req.body, res.locals.ayar);
  const hatalar = await kisiDenetle(veri);
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
  const hatalar = await kisiDenetle(veri, req.kisi._id);
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
