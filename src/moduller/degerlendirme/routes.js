const express = require('express');
const mongoose = require('mongoose');
const { talepDurumlari, icmalAsamalari } = require('../../config/sabitler');
const { talepHesabi, projeHesabi } = require('../projeler/hesap');
const { degerlendirmeHesabi, formulleri, limitleri } = require('../projeler/degerlendirme-hesabi');
const akis = require('../talepler/akis');
const { anahtar, diziyeCevir } = require('../../core/yardimcilar');
const { yetkiGerekli, ilceKisitliMi } = require('../../core/yetki');

const router = express.Router();
const V = 'degerlendirme/views/';
const sar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const Proje = () => mongoose.model('Proje');
const Talep = () => mongoose.model('Talep');

// İcmal talep.gor ile görülür; değerlendirme sayfası ve işlemleri talep.degerlendir ister.
router.use((req, res, next) => yetkiGerekli(req.path.startsWith('/icmal') ? 'talep.gor' : 'talep.degerlendir')(req, res, next));

// Değerlendirme süzgecindeki aşama grupları
const ASAMA_GRUPLARI = {
  bekleyen: { ad: 'Değerlendirilecek', durumlar: ['gonderildi', 'incelemede', 'yurutucude'] },
  karar: { ad: 'Karar verilen', durumlar: ['desteklendi', 'yedek', 'desteklenmedi', 'teslim'] },
  tumu: { ad: 'Tümü (taslaklar hariç)', durumlar: Object.keys(talepDurumlari).filter((k) => k !== 'taslak') }
};

async function projeSec(req) {
  const projeler = await Proje().find().sort({ olusturulma: -1 }).select('ad kisaAd durum donem').lean();
  if (!projeler.length) return { projeler, proje: null };
  const id = mongoose.isValidObjectId(req.query.proje) ? req.query.proje
    : String((projeler.find((p) => p.durum === 'aktif') || projeler.find((p) => p.durum === 'taslak') || projeler[0])._id);
  return { projeler, proje: await Proje().findById(id) };
}

const kalemAdi = (k) => k.urun + (k.cesit ? ' · ' + k.cesit : '');

// Sayfadaki her başvurunun satır verisi
function satirVerisi(t, proje, ayar) {
  const hesap = talepHesabi(t, proje, ayar);
  const deg = degerlendirmeHesabi(t, t.ciftciId, proje, ayar, hesap);
  const ilk = {};
  ((t.basvuru && t.basvuru.talepKalemleri) || []).forEach((x) => { ilk[String(x.kalemId)] = x.miktar; });
  const notlar = (t.gecmis || []).filter((g) => g.not);
  return { talep: t, ciftci: t.ciftciId, hesap, deg, ilk, notSayisi: notlar.length, sonNot: notlar.length ? notlar[notlar.length - 1] : null };
}

router.get('/', sar(async (req, res) => {
  const ayar = res.locals.ayar;
  const { projeler, proje } = await projeSec(req);
  if (!proje) return res.render(V + 'liste', { baslik: 'Değerlendirme', projeler, proje: null });

  const grup = ASAMA_GRUPLARI[req.query.asama] ? req.query.asama : (talepDurumlari[req.query.asama] ? null : 'bekleyen');
  const durumlar = grup ? ASAMA_GRUPLARI[grup].durumlar : [req.query.asama];
  const tumTalepler = await Talep().find({ projeId: proje._id }).populate('ciftciId').lean();
  const gecerli = tumTalepler.filter((t) => t.ciftciId);

  // Aşama sayıları (süzgeçten önce)
  const sayilar = {};
  gecerli.forEach((t) => { sayilar[t.durum] = (sayilar[t.durum] || 0) + 1; });

  const ilce = req.query.ilce || '';
  const mahalle = req.query.mahalle || '';
  const mahalleler = [...new Set(gecerli.filter((t) => !ilce || t.ilce === ilce).map((t) => t.ciftciId.mahalle).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'tr'));
  let talepler = gecerli.filter((t) => durumlar.includes(t.durum));
  if (ilce) talepler = talepler.filter((t) => t.ilce === ilce);
  if (mahalle) talepler = talepler.filter((t) => anahtar(t.ciftciId.mahalle) === anahtar(mahalle));
  if (req.query.q) {
    const q = anahtar(req.query.q);
    talepler = talepler.filter((t) => anahtar(t.ciftciId.adSoyad).includes(q) || String(t.ciftciId.tcKimlikNo).includes(q));
  }
  let satirlar = talepler.map((t) => satirVerisi(t, proje, ayar));
  const limitUstu = satirlar.filter((s) => s.deg.limitAsimlari.length).length;
  if (req.query.limit === '1') satirlar = satirlar.filter((s) => s.deg.limitAsimlari.length);

  // Varsayılan sıra: puan (varsa) büyükten küçüğe, sonra ilçe ve ad
  const puanVar = formulleri(proje).some((f) => f.puan);
  satirlar.sort((a, b) => {
    if (puanVar && (b.deg.puan || 0) !== (a.deg.puan || 0)) return (b.deg.puan || 0) - (a.deg.puan || 0);
    return a.talep.ilce.localeCompare(b.talep.ilce, 'tr') || a.ciftci.adSoyad.localeCompare(b.ciftci.adSoyad, 'tr');
  });

  // Desteklenenlerin toplamı ve proje bütçesi
  const destek = { bedel: 0, ciftciKatkisi: 0, ciftci: 0 };
  gecerli.filter((t) => icmalAsamalari.includes(t.durum)).forEach((t) => {
    const h = talepHesabi(t, proje, ayar);
    destek.ciftci += 1; destek.bedel += h.bedel || 0; destek.ciftciKatkisi += h.ciftciKatkisi || 0;
  });
  const butce = projeHesabi(proje, ayar).butce;

  const toplam = { bedel: 0, ciftciKatkisi: 0, toplamlar: {} };
  satirlar.forEach((s) => {
    toplam.bedel += s.hesap.bedel || 0;
    toplam.ciftciKatkisi += s.hesap.ciftciKatkisi || 0;
    Object.entries(s.hesap.toplamlar).forEach(([b, v]) => { toplam.toplamlar[b] = (toplam.toplamlar[b] || 0) + v; });
  });

  res.render(V + 'liste', {
    baslik: 'Değerlendirme', projeler, proje, satirlar, sayilar, mahalleler, limitUstu, puanVar, destek, butce, toplam,
    formuller: formulleri(proje), limitler: limitleri(proje), ASAMA_GRUPLARI, kalemAdi,
    filtre: { proje: String(proje._id), asama: grup || req.query.asama, ilce, mahalle, q: req.query.q || '', limit: req.query.limit || '' },
    donus: '/degerlendirme?' + new URLSearchParams(Object.entries({
      proje: String(proje._id), asama: grup || req.query.asama, ilce, mahalle, q: req.query.q || '', limit: req.query.limit || ''
    }).filter(([, v]) => v)).toString(),
    toplu: Object.keys(akis.ISLEMLER).filter((k) => !['gonder', 'not'].includes(k)).map((k) => ({ kod: k, ...akis.ISLEMLER[k] }))
  });
}));

// Değerlendirme penceresi (liste sayfasında açılır)
router.get('/:id/panel', sar(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Başvuru bulunamadı.');
  const talep = await Talep().findById(req.params.id).populate('ciftciId');
  if (!talep || !talep.ciftciId) return res.status(404).send('Başvuru bulunamadı.');
  const proje = await Proje().findById(talep.projeId);
  const ayar = res.locals.ayar;
  const hesap = talepHesabi(talep, proje, ayar);
  const deg = degerlendirmeHesabi(talep, talep.ciftciId, proje, ayar, hesap);
  const islemler = akis.kullanilabilirIslemler(talep, { izin: req.izin, ben: req.ben, ayar, kisitli: ilceKisitliMi(req.ben, ayar) });
  const donus = typeof req.query.donus === 'string' && req.query.donus.startsWith('/degerlendirme') ? req.query.donus : `/degerlendirme?proje=${proje._id}`;
  res.render(V + 'panel', { talep, ciftci: talep.ciftciId, proje, hesap, deg, islemler, donus, degistirilebilir: talep.durum === 'incelemede' });
}));

// Toplu işlem: seçilen başvurularda aynı işlem (aynı not/gerekçe ile)
router.post('/toplu', sar(async (req, res) => {
  const ayar = res.locals.ayar;
  const donus = typeof req.body.donus === 'string' && req.body.donus.startsWith('/degerlendirme') ? req.body.donus : '/degerlendirme';
  const ids = diziyeCevir(req.body.ids).filter((id) => mongoose.isValidObjectId(id));
  const islem = String(req.body.islem || '');
  const ek = donus.includes('?') ? '&' : '?';
  if (!ids.length || !akis.ISLEMLER[islem]) return res.redirect(`${donus}${ek}bildirim=islem-yapilamadi&hata=${encodeURIComponent('Başvuru ve işlem seçilmelidir.')}`);
  const baglam = { izin: req.izin, ben: req.ben, ayar, kisitli: ilceKisitliMi(req.ben, ayar), not: req.body.not };
  let tamam = 0;
  const hatalar = new Set();
  for (const id of ids) {
    const t = await Talep().findById(id);
    if (!t) continue;
    const r = akis.uygula(t, islem, baglam);
    if (r.hata) { hatalar.add(r.hata); continue; }
    await t.save();
    tamam += 1;
  }
  if (!tamam) return res.redirect(`${donus}${ek}bildirim=islem-yapilamadi&hata=${encodeURIComponent([...hatalar].join(' '))}`);
  const not = hatalar.size ? `${tamam} başvuruda yapıldı; ${ids.length - tamam} başvuruda yapılamadı: ${[...hatalar].join(' ')}` : `${tamam} başvuru.`;
  return res.redirect(`${donus}${ek}bildirim=toplu-islem&hata=${encodeURIComponent(not)}`);
}));

// Destek icmali: kesin desteklenenler (ve teslim edilenler) ilçe bazında; yedekler ayrıca
router.get('/icmal', sar(async (req, res) => {
  const ayar = res.locals.ayar;
  const { projeler, proje } = await projeSec(req);
  if (!proje) return res.render(V + 'icmal', { baslik: 'Destek icmali', projeler, proje: null });
  const ilce = req.query.ilce || '';
  const filtre = { projeId: proje._id, durum: { $in: [...icmalAsamalari, 'yedek'] } };
  if (ilce) filtre.ilce = ilce;
  const talepler = (await Talep().find(filtre).populate('ciftciId').lean()).filter((t) => t.ciftciId);
  const satirlar = talepler.map((t) => satirVerisi(t, proje, ayar));
  const desteklenen = satirlar.filter((s) => icmalAsamalari.includes(s.talep.durum))
    .sort((a, b) => a.talep.ilce.localeCompare(b.talep.ilce, 'tr') || a.ciftci.adSoyad.localeCompare(b.ciftci.adSoyad, 'tr'));
  const yedekler = satirlar.filter((s) => s.talep.durum === 'yedek').sort((a, b) => (b.deg.puan || 0) - (a.deg.puan || 0));

  // İlçe grupları ve kalem toplamları
  const gruplar = [];
  desteklenen.forEach((s) => {
    let g = gruplar.find((x) => x.ilce === s.talep.ilce);
    if (!g) { g = { ilce: s.talep.ilce, satirlar: [] }; gruplar.push(g); }
    g.satirlar.push(s);
  });
  const topla = (liste) => {
    const t = { bedel: 0, ciftciKatkisi: 0, destek: 0, kalemler: {} };
    liste.forEach((s) => {
      t.bedel += s.hesap.bedel || 0; t.ciftciKatkisi += s.hesap.ciftciKatkisi || 0; t.destek += s.hesap.destek || 0;
      s.hesap.kalemler.forEach((hk) => {
        const id = String(hk.kalem._id);
        t.kalemler[id] = t.kalemler[id] || { miktar: 0, dagitim: 0, teslim: 0 };
        t.kalemler[id].miktar += hk.esasMiktari || 0;
        t.kalemler[id].dagitim += hk.miktar || 0;
        t.kalemler[id].teslim += hk.teslim || 0;
      });
    });
    return t;
  };
  gruplar.forEach((g) => { g.toplam = topla(g.satirlar); });
  res.render(V + 'icmal', {
    baslik: 'Destek icmali', projeler, proje, gruplar, genel: topla(desteklenen), yedekler, ciftciSayisi: desteklenen.length,
    filtre: { proje: String(proje._id), ilce }, kalemAdi, puanVar: formulleri(proje).some((f) => f.puan)
  });
}));

module.exports = router;
