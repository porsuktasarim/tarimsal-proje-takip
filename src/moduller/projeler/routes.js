const express = require('express');
const mongoose = require('mongoose');
const Proje = require('./model');
const Urun = require('../ayarlar/modeller/Urun');
const Kisi = require('../ayarlar/modeller/Kisi');
const katalog = require('../ayarlar/katalog');
const { projeHesabi, taleplerOzeti } = require('./hesap');
const degerlendirmeHesabi = require('./degerlendirme-hesabi');
const { yetkiGerekli } = require('../../core/yetki');
const { projeDurumlari } = require('../../config/sabitler');
const { sayiOku, diziyeCevir, tarihOku, anahtar, kodUret } = require('../../core/yardimcilar');

const router = express.Router();
const V = 'projeler/views/';

// Görüntüleme proje.gor, başlatma/düzenleme/durum/silme proje.yonet ister.
router.use((req, res, next) => {
  const goruntuleme = req.method === 'GET' && !/\/(yeni|duzenle)$/.test(req.path);
  return yetkiGerekli(goruntuleme ? 'proje.gor' : 'proje.yonet')(req, res, next);
});
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
      .map((k) => ({
        // Mevcut kalemin kimliği korunur; sonraki modüller kaleme bu kimlikle bağlanır.
        ...(mongoose.isValidObjectId(k._id) ? { _id: k._id } : {}),
        urunId: mongoose.isValidObjectId(k.urunId) ? k.urunId : undefined,
        tur: metin(k.tur),
        urun: metin(k.urun),
        cesit: metin(k.cesit) || undefined,
        talepBirimi: metin(k.talepBirimi) || 'da',
        olcuBirimi: metin(k.olcuBirimi),
        ambalaj: katalog.ambalajFormuOku(k.ambalaj),
        alan: sayiOku(k.alan),
        normlar: katalog.normFormuOku(k.normlar, ayar.normlar, true),
        olcuyeGore: k.olcuyeGore === '1' || k.olcuyeGore === 'on',
        ozellik: metin(k.ozellik) || undefined,
        toplamMiktar: sayiOku(k.toplamMiktar),
        birimFiyat: sayiOku(k.birimFiyat),
        fiyatBirimi: metin(k.fiyatBirimi) || undefined,
        aciklama: metin(k.aciklama) || undefined
      }))
      .filter((k) => k.urun || k.cesit || k.alan !== undefined || Object.keys(k.normlar).length || k.ozellik),
    ilceler: diziyeCevir(govde.ilceler)
      .filter((i) => i && i.ilce && gecerliIlceler.has(i.ilce))
      .map((i) => ({ ilce: i.ilce, hedefCiftci: sayiOku(i.hedefCiftci), hedefDekar: sayiOku(i.hedefDekar) })),
    finansman: {
      destekKaynagi: metin(govde.finansman && govde.finansman.destekKaynagi) || undefined,
      ciftciKatkiOrani: sayiOku(govde.finansman && govde.finansman.ciftciKatkiOrani)
    },
    basvuru: {
      oncelikliAlan: sayiOku(govde.basvuru && govde.basvuru.oncelikliAlan),
      azamiAlan: sayiOku(govde.basvuru && govde.basvuru.azamiAlan)
    },
    degerlendirme: {
      formuller: diziyeCevir(govde.formuller)
        .map((f) => ({
          ad: metin(f.ad), ifade: metin(f.ifade), birim: metin(f.birim) || undefined,
          ondalik: sayiOku(f.ondalik) != null ? Math.max(0, Math.min(6, Math.round(sayiOku(f.ondalik)))) : undefined,
          puan: f.puan === '1' || f.puan === 'on'
        }))
        .filter((f) => f.ad || f.ifade)
        .map((f) => ({ ...f, kod: kodUret(f.ad || 'formul') })),
      limitler: diziyeCevir(govde.limitler)
        .map((l) => ({ ad: metin(l.ad) || undefined, ifade: metin(l.ifade), ust: sayiOku(l.ust), birim: metin(l.birim) || undefined }))
        .filter((l) => l.ifade || l.ust !== undefined || l.ad)
    },
    koordinatorler: diziyeCevir(govde.koordinatorler).filter((id) => mongoose.isValidObjectId(id)),
    yurutuculer: diziyeCevir(govde.yurutuculer).filter((id) => mongoose.isValidObjectId(id))
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
  const ekimKod = ayar.ekimNormu ? ayar.ekimNormu.kod : null;
  veri.kalemler.forEach((k, i) => {
    if ((ayar.normsuzTurler || []).includes(k.tur)) {
      // Normsuz kalem: norm tutulmaz; ambalaj varsa içeriği talep biriminde olmalıdır (1 top = 100 m²)
      k.normlar = {};
      if (k.ambalaj && k.ambalaj.birim !== k.talepBirimi) {
        hatalar.push(`${i + 1}. kalemde ambalaj içeriğinin birimi talep birimiyle (${k.talepBirimi}) aynı olmalıdır (ör. 1 top = 100 m²).`);
      }
    } else {
      if (!k.ambalaj) hatalar.push(`${i + 1}. kalemin ambalaj içeriği girilmelidir (ör. 1 çuval = 25 kg, 1 paket = 50.000 adet).`);
      katalog.ekimBiriminiEsitle(k.normlar, k.ambalaj, ekimKod, k.talepBirimi);
      k.ozellik = undefined;
    }
    if (!k.tur) hatalar.push(`${i + 1}. kalemin türü seçilmelidir.`);
    if (!k.urun) hatalar.push(`${i + 1}. kalemin ürün adı girilmelidir.`);
    if (!k.olcuBirimi) hatalar.push(`${i + 1}. kalemin dağıtım birimi seçilmelidir.`);
  });
  if (veri.ilceler.length === 0) hatalar.push('Projenin uygulanacağı en az bir ilçe seçilmelidir.');
  hatalar.push(...degerlendirmeHesabi.tanimlariDenetle(veri, ayar));
  const oran = veri.finansman.ciftciKatkiOrani;
  if (oran != null && (oran < 0 || oran > 100)) hatalar.push('Çiftçi katkı oranı 0 ile 100 arasında olmalıdır.');
  const b = veri.basvuru;
  if (b.oncelikliAlan != null && b.azamiAlan != null && b.oncelikliAlan > b.azamiAlan) {
    hatalar.push('Öncelikli alan sınırı azami alandan büyük olamaz.');
  }

  return { veri, hatalar };
}

// Kalemleri ürün kataloğuyla eşleştirir.
// - Katalogda olmayan ürün, kalemin değerleriyle kataloğa eklenir.
// - Katalogda olmayan çeşit ürüne eklenir; kalemde ürününkinden farklı girilen
//   norm ve ambalaj değerleri o çeşidin kendi değeri olarak saklanır.
// - Kalemde boş bırakılan normlar (ve ambalaj) ürün + çeşit varsayılanıyla dolar.
async function katalogaIsle(kalemler, ayar) {
  let eklenen = 0;
  for (const k of kalemler) {
    let belge = k.urunId ? await Urun.findById(k.urunId) : null;
    if (belge && (belge.tur !== k.tur || anahtar(belge.ad) !== anahtar(k.urun))) belge = null;
    if (!belge) {
      belge = (await Urun.find({ tur: k.tur })).find((u) => anahtar(u.ad) === anahtar(k.urun)) || null;
    }

    if (!belge) {
      belge = await Urun.create({
        tur: k.tur,
        ad: k.urun,
        talepBirimi: k.talepBirimi,
        olcuBirimi: k.olcuBirimi,
        ambalaj: k.ambalaj,
        normlar: k.normlar,
        cesitler: k.cesit ? [{ ad: k.cesit, normlar: {} }] : []
      });
      eklenen += 1;
    } else if (k.cesit) {
      const urun = katalog.urunDuz(belge);
      const varolan = katalog.cesitBul(urun, k.cesit);
      if (varolan) {
        k.cesit = varolan.ad;
      } else {
        const temel = katalog.etkinVarsayilanlar(urun, null);
        const yeniCesit = { ad: k.cesit, normlar: katalog.farkliNormlar(k.normlar, temel.normlar) };
        if (k.ambalaj && k.olcuBirimi === urun.olcuBirimi && !katalog.ayniAmbalaj(k.ambalaj, temel.ambalaj)) {
          yeniCesit.ambalaj = k.ambalaj;
        }
        belge.cesitler.push(yeniCesit);
        belge.markModified('cesitler');
        await belge.save();
        eklenen += 1;
      }
    }

    const etkin = katalog.etkinVarsayilanlar(katalog.urunDuz(belge), k.cesit);
    ayar.normlar.forEach((n) => {
      if (!k.normlar[n.kod] && etkin.normlar[n.kod]) {
        const v = etkin.normlar[n.kod];
        k.normlar[n.kod] = { deger: v.deger, birim: v.birim || n.birim };
      }
    });
    if (!k.ambalaj && etkin.ambalaj && k.olcuBirimi === etkin.olcuBirimi) k.ambalaj = etkin.ambalaj;
    katalog.ekimBiriminiEsitle(k.normlar, k.ambalaj, ayar.ekimNormu ? ayar.ekimNormu.kod : null, k.talepBirimi);
    k.urunId = belge._id;
    k.urun = belge.ad;
  }
  return eklenen;
}

async function katalogGetir() {
  const urunler = await Urun.find().sort({ ad: 1 }).lean();
  return urunler.map(katalog.urunDuz);
}

async function formuGoster(res, durum, sablon) {
  const kisiler = await Kisi.find().sort({ adSoyad: 1 }).lean();
  const degiskenler = degerlendirmeHesabi.degiskenTanimlari({ kalemler: (sablon.proje && sablon.proje.kalemler) || [] }, res.locals.ayar);
  return res.status(durum).render(V + 'form', { ...sablon, katalog: await katalogGetir(), kisiler, degiskenler });
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

router.get('/:id', sar(projeBul), sar(async (req, res) => {
  const hesap = projeHesabi(req.proje, res.locals.ayar);
  const Gorev = mongoose.model('Gorev');
  const [ekip, gorevler] = await Promise.all([
    Kisi.find({ _id: { $in: [...req.proje.koordinatorler, ...req.proje.yurutuculer] } }).lean(),
    Gorev.find({ projeId: req.proje._id })
      .populate('atama.kisiId', 'adSoyad rol').populate('projeId', 'ad kisaAd')
      .sort({ sonTarih: 1, olusturulma: -1 })
  ]);
  const kisiBul = (id) => ekip.find((k) => String(k._id) === String(id));
  const tumTalepler = await mongoose.model('Talep').find({ projeId: req.proje._id }).select('-gecmis').lean();
  const talepler = tumTalepler.filter((t) => t.durum !== 'desteklenmedi');
  const talepOzeti = taleplerOzeti(talepler, req.proje, res.locals.ayar);
  const asamaSayilari = {};
  tumTalepler.forEach((t) => { asamaSayilari[t.durum] = (asamaSayilari[t.durum] || 0) + 1; });
  res.render(V + 'detay', {
    baslik: req.proje.ad,
    proje: req.proje,
    hesap,
    koordinatorler: req.proje.koordinatorler.map(kisiBul).filter(Boolean),
    yurutuculer: req.proje.yurutuculer.map(kisiBul).filter(Boolean),
    gorevler,
    talepOzeti,
    asamaSayilari,
    katalogEklenen: parseInt(req.query.katalog, 10) || 0
  });
}));

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
