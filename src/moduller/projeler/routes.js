const express = require('express');
const mongoose = require('mongoose');
const Proje = require('./model');
const Urun = require('../ayarlar/modeller/Urun');
const Kisi = require('../ayarlar/modeller/Kisi');
const katalog = require('../ayarlar/katalog');
const { projeHesabi, taleplerOzeti } = require('./hesap');
const degerlendirmeHesabi = require('./degerlendirme-hesabi');
const projeMetni = require('./proje-metni');
const surec = require('./surec');
const dosyalar = require('../../core/dosyalar');
const { yetkiGerekli, projeFiltresi, projeErisebilirMi, projeErisimYok } = require('../../core/yetki');
const { projeDurumlari } = require('../../config/sabitler');
const { sayiOku, diziyeCevir, tarihOku, anahtar, kodUret } = require('../../core/yardimcilar');

const router = express.Router();
const V = 'projeler/views/';

// Görüntüleme proje.gor, başlatma/düzenleme/durum/silme proje.yonet ister.
// Proje metni yükleme ayrıca koordinatör/yönetici denetiminden geçer (proje-metni.js).
router.use((req, res, next) => {
  const goruntuleme = (req.method === 'GET' && !/\/(yeni|duzenle)$/.test(req.path)) || /\/metin$/.test(req.path);
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
    belgeAyarlari: {
      programAdi: metin(govde.belgeAyarlari && govde.belgeAyarlari.programAdi) || undefined,
      destekTuru: metin(govde.belgeAyarlari && govde.belgeAyarlari.destekTuru) || undefined,
      mudurluk: metin(govde.belgeAyarlari && govde.belgeAyarlari.mudurluk) || undefined,
      imzaYetkilisiAd: metin(govde.belgeAyarlari && govde.belgeAyarlari.imzaYetkilisiAd) || undefined,
      imzaYetkilisiUnvan: metin(govde.belgeAyarlari && govde.belgeAyarlari.imzaYetkilisiUnvan) || undefined,
      mahkeme: metin(govde.belgeAyarlari && govde.belgeAyarlari.mahkeme) || undefined,
      katkiHesabi: metin(govde.belgeAyarlari && govde.belgeAyarlari.katkiHesabi) || undefined,
      dekontKodu: metin(govde.belgeAyarlari && govde.belgeAyarlari.dekontKodu) || undefined,
      yuklenici: metin(govde.belgeAyarlari && govde.belgeAyarlari.yuklenici) || undefined,
      donemTuru: metin(govde.belgeAyarlari && govde.belgeAyarlari.donemTuru) || undefined,
      komisyonBaskani: metin(govde.belgeAyarlari && govde.belgeAyarlari.komisyonBaskani) || undefined,
      komisyonUyeleri: String((govde.belgeAyarlari && govde.belgeAyarlari.komisyonUyeleri) || '').split(/[\n;]+/).map((x) => x.trim()).filter(Boolean)
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
  if (!veri.kisaAd) hatalar.push('Kısa ad girilmelidir: proje yılı, dönemi ve esas ürünü (ör. 2027 Bahar - Silajlık Yerli Mısır).');
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
  // Yeni projede yönetici ve koordinatör rolü, mevcut projede projenin koordinatörü yükleyebilir
  const mevcutProje = sablon.mevcut || (sablon.proje && sablon.proje._id ? sablon.proje : null);
  const metinYukleyebilir = projeMetni.yukleyebilirMi(res.locals.ben, mevcutProje, res.locals.adminVar);
  return res.status(durum).render(V + 'form', { ...sablon, katalog: await katalogGetir(), kisiler, degiskenler, metinYukleyebilir });
}

async function projeBul(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return next('route');
  req.proje = await Proje.findById(req.params.id);
  if (req.proje && !projeErisebilirMi(req, req.proje._id)) return projeErisimYok(res);
  return req.proje ? next() : next('route');
}

const duzOlarak = (p) => p.toObject({ flattenMaps: true, virtuals: true });

// ---------------------------------------------------------------------------

router.get('/', sar(async (req, res) => {
  const filtre = { ...projeFiltresi(req) };
  if (req.query.birim) filtre.birim = String(req.query.birim);
  if (req.query.durum && projeDurumlari[req.query.durum]) filtre.durum = req.query.durum;
  if (req.query.donem) filtre.donem = String(req.query.donem);
  let projeler = await Proje.find(filtre).sort({ olusturulma: -1 });
  if (req.query.q) {
    const q = anahtar(req.query.q);
    projeler = projeler.filter((p) => [p.ad, p.kisaAd, p.donem].some((v) => anahtar(v).includes(q)));
  }
  const durumSayilari = {};
  for (const k of Object.keys(projeDurumlari)) durumSayilari[k] = await Proje.countDocuments({ ...projeFiltresi(req), durum: k });
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

router.post('/', projeMetni.formYukleyici, sar(async (req, res) => {
  const ayar = res.locals.ayar;
  const { veri, hatalar } = formuOku(req.body, ayar);
  if (req.dosyaHatasi) hatalar.push(req.dosyaHatasi);
  if (hatalar.length) {
    return formuGoster(res, 422, { baslik: 'Proje Başlat', proje: veri, hatalar, eylem: '/projeler' });
  }
  const eklenen = await katalogaIsle(veri.kalemler, ayar);
  const proje = await Proje.create(veri);
  let metinHatasi = null;
  if (req.file && projeMetni.yukleyebilirMi(req.ben, proje, res.locals.adminVar)) {
    metinHatasi = await projeMetni.ekle(proje, req.file, req.ben);
    if (!metinHatasi) await proje.save();
  }
  const ek = metinHatasi ? '&hata=' + encodeURIComponent('Proje kaydedildi; proje metni yüklenemedi: ' + metinHatasi) : '';
  return res.redirect(`/projeler/${proje._id}?bildirim=olusturuldu${eklenen ? '&katalog=' + eklenen : ''}${ek}`);
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
    katalogEklenen: parseInt(req.query.katalog, 10) || 0,
    metinYukleyebilir: projeMetni.yukleyebilirMi(req.ben, req.proje, res.locals.adminVar),
    metinGerekli: req.query.metin === 'gerekli',
    surecAdimlari: surec.ADIMLAR,
    surecIpuclari: surec.ipuclari(req.proje, tumTalepler),
    surecKayit: req.proje.surec || {}
  });
}));

router.get('/:id/duzenle', sar(projeBul), sar(async (req, res) => formuGoster(res, 200, {
  baslik: 'Projeyi Düzenle', proje: duzOlarak(req.proje), hatalar: [], eylem: `/projeler/${req.proje._id}`
})));

router.post('/:id', projeMetni.formYukleyici, sar(projeBul), sar(async (req, res) => {
  const ayar = res.locals.ayar;
  const { veri, hatalar } = formuOku(req.body, ayar, req.proje);
  if (req.dosyaHatasi) hatalar.push(req.dosyaHatasi);
  if (hatalar.length) {
    veri._id = req.proje._id;
    return formuGoster(res, 422, {
      baslik: 'Projeyi Düzenle', proje: veri, hatalar, eylem: `/projeler/${req.proje._id}`, mevcut: duzOlarak(req.proje)
    });
  }
  const eklenen = await katalogaIsle(veri.kalemler, ayar);
  req.proje.set(veri);
  let metinHatasi = null;
  if (req.file && projeMetni.yukleyebilirMi(req.ben, req.proje, res.locals.adminVar)) {
    metinHatasi = await projeMetni.ekle(req.proje, req.file, req.ben);
  }
  await req.proje.save();
  const ek = metinHatasi ? '&hata=' + encodeURIComponent('Proje kaydedildi; proje metni yüklenemedi: ' + metinHatasi) : '';
  return res.redirect(`/projeler/${req.proje._id}?bildirim=guncellendi${eklenen ? '&katalog=' + eklenen : ''}${ek}`);
}));

// Proje metni: yeni sürüm yükle (yalnız koordinatör / yönetici)
router.post('/:id/metin', projeMetni.yukleyici.single('projeMetni'), sar(projeBul), sar(async (req, res) => {
  const donus = `/projeler/${req.proje._id}`;
  if (!projeMetni.yukleyebilirMi(req.ben, req.proje, res.locals.adminVar)) {
    return res.redirect(`${donus}?bildirim=islem-yapilamadi&hata=${encodeURIComponent('Proje metnini yalnızca projenin koordinatörü ve Sistem Yöneticisi yükleyebilir.')}`);
  }
  const hata = await projeMetni.ekle(req.proje, req.file, req.ben);
  if (hata) return res.redirect(`${donus}?bildirim=islem-yapilamadi&hata=${encodeURIComponent(hata)}`);
  await req.proje.save();
  return res.redirect(`${donus}?bildirim=proje-metni-yuklendi`);
}), (e, req, res, next) => {
  // multer hatası (boyut aşımı)
  if (e && e.code === 'LIMIT_FILE_SIZE') return res.redirect(`/projeler/${req.params.id}?bildirim=islem-yapilamadi&hata=${encodeURIComponent('Proje metni en fazla 30 MB olabilir.')}`);
  return next(e);
});

// Proje metnini tarayıcıda oku (PDF gömülü, Word HTML'e çevrilerek)
router.get('/:id/metin', sar(projeBul), sar(async (req, res) => {
  const belgeler = req.proje.belgeler || [];
  if (!belgeler.length) return res.redirect(`/projeler/${req.proje._id}?metin=gerekli`);
  const belge = belgeler.find((b) => String(b.dosyaId) === String(req.query.surum)) || belgeler[belgeler.length - 1];
  let html = null;
  let donusumHatasi = null;
  if (belge.tur === 'docx') {
    try {
      const mammoth = require('mammoth');
      const sonuc = await mammoth.convertToHtml({ buffer: await dosyalar.oku(belge.dosyaId) });
      // Word içindeki bağlantılarda betik çalıştırılmasın
      html = sonuc.value.replace(/href\s*=\s*"\s*(javascript|data|vbscript):[^"]*"/gi, 'href="#"');
    } catch (e) {
      donusumHatasi = 'Word dosyası görüntülenemedi; indirilerek açılabilir.';
    }
  }
  res.render(V + 'metin', { baslik: 'Proje metni', proje: req.proje, belge, belgeler, html, donusumHatasi });
}));

// Dosyanın kendisi: PDF tarayıcıda açılır; ?indir=1 ile indirilir
router.get('/:id/belge/:dosyaId', sar(projeBul), sar(async (req, res, next) => {
  const belge = (req.proje.belgeler || []).find((b) => String(b.dosyaId) === String(req.params.dosyaId));
  if (!belge) return next();
  const bilgi = await dosyalar.bilgi(belge.dosyaId);
  if (!bilgi) return next();
  const tur = belge.tur === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const satirIci = belge.tur === 'pdf' && req.query.indir !== '1';
  res.set('Content-Type', tur);
  res.set('Content-Length', String(bilgi.length));
  res.set('Content-Disposition', `${satirIci ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(belge.ad || 'proje-metni.' + belge.tur)}`);
  res.set('Cache-Control', 'private, max-age=3600');
  dosyalar.okumaAkisi(belge.dosyaId).on('error', next).pipe(res);
}));

// Süreç adımı: işaretle / işareti kaldır, tarih ve not (koordinatör)
router.post('/:id/surec/:kod', sar(projeBul), sar(async (req, res) => {
  const adim = surec.ADIMLAR.find((a) => a.kod === req.params.kod);
  if (!adim) return res.redirect(`/projeler/${req.proje._id}#surec`);
  const s = { ...(req.proje.surec || {}) };
  const k = { notlar: [], ...(s[adim.kod] || {}) };
  const tamam = req.body.tamam === 'on' || req.body.tamam === '1';
  if (tamam !== !!k.tamam) {
    k.tamam = tamam;
    k.tarih = tamam ? (tarihOku(req.body.tarih) || new Date()) : null;
    k.kisiAd = req.ben ? req.ben.adSoyad : undefined;
  } else if (tamam && tarihOku(req.body.tarih)) {
    k.tarih = tarihOku(req.body.tarih);
  }
  const not = metin(req.body.not);
  if (not) k.notlar = [...(k.notlar || []), { metin: not, kisiAd: req.ben ? req.ben.adSoyad : undefined, tarih: new Date() }];
  s[adim.kod] = k;
  req.proje.surec = s;
  req.proje.markModified('surec');
  await req.proje.save();
  return res.redirect(`/projeler/${req.proje._id}?bildirim=surec-kaydedildi#surec`);
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
