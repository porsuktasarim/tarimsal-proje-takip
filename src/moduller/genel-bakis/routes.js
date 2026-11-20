const express = require('express');
const mongoose = require('mongoose');
const { projeHesabi, taleplerOzeti, talepHesabi, kalemHesabi, talepBirimiOku } = require('../projeler/hesap');
const { projeDurumlari, talepDurumlari, icmalAsamalari, sayilmayanAsamalar } = require('../../config/sabitler');

const { yetkiGerekli, projeFiltresi } = require('../../core/yetki');

const router = express.Router();
router.use(yetkiGerekli('pano.gor'));
const sar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const ACIK = ['bekliyor', 'suruyor'];

function birimeTopla(hedef, kaynak) {
  Object.entries(kaynak || {}).forEach(([b, v]) => { hedef[b] = (hedef[b] || 0) + v; });
}

// Grafikler ve tablolar için proje, şube, ürün, ilçe ve dönem bazında toplamlar.
//   tahmini     : proje kalemlerinin hedef bütçesi (proje formundaki alan ve fiyatlarla)
//   talep       : başvuruların bedeli (desteklenmeyenler hariç)
//   desteklenen : desteklenmesine karar verilen ve teslim edilen başvurular
//   gerceklesen : teslim edilen başvurular
function grafikVerisi(projeler, basvurular, ayar) {
  const bos = () => ({ tahmini: 0, talep: 0, desteklenen: 0, gerceklesen: 0, hibe: 0, katki: 0, hedefDekar: 0, talepDekar: 0, desteklenenDekar: 0, gerceklesenDekar: 0, basvuru: 0, desteklenenCiftci: 0 });
  const ekle = (a, b) => Object.keys(a).forEach((k) => { a[k] += b[k] || 0; });
  const subeler = {};
  const urunler = {};
  const ilceler = {};
  const donemler = {};
  const asamalar = Object.fromEntries(Object.keys(talepDurumlari).map((k) => [k, 0]));
  const projeSatirlari = projeler.map((p) => {
    const hesap = projeHesabi(p, ayar);
    const t = bos();
    t.tahmini = hesap.butce.toplam || 0;
    t.hedefDekar = hesap.toplamDekar;
    const desteklenenKalem = {};   // kalemId -> esas miktar (çıktı hesabı için)
    basvurular.filter((b) => String(b.projeId) === String(p._id)).forEach((b) => {
      asamalar[b.durum] = (asamalar[b.durum] || 0) + 1;
      t.basvuru += 1;
      const ilce = b.ilce || '–';
      ilceler[ilce] = ilceler[ilce] || { ilce, basvuru: 0, desteklenen: 0, talepDekar: 0, desteklenenDekar: 0, butce: 0 };
      ilceler[ilce].basvuru += 1;
      if (sayilmayanAsamalar.includes(b.durum)) return;
      const h = talepHesabi(b, p, ayar);
      const dest = icmalAsamalari.includes(b.durum);
      t.talep += h.bedel || 0;
      t.talepDekar += h.toplamAlan;
      ilceler[ilce].talepDekar += h.toplamAlan;
      if (dest) {
        t.desteklenen += h.bedel || 0;
        t.hibe += h.destek || 0;
        t.katki += h.ciftciKatkisi || 0;
        t.desteklenenDekar += h.toplamAlan;
        t.desteklenenCiftci += 1;
        ilceler[ilce].desteklenen += 1;
        ilceler[ilce].desteklenenDekar += h.toplamAlan;
        ilceler[ilce].butce += h.bedel || 0;
      }
      if (b.durum === 'teslim') { t.gerceklesen += h.bedel || 0; t.gerceklesenDekar += h.toplamAlan; }
      h.kalemler.forEach((hk) => {
        const anahtar = hk.kalem.urun + '|' + hk.talepBirimi;
        urunler[anahtar] = urunler[anahtar] || { urun: hk.kalem.urun, birim: hk.talepBirimi, hedef: 0, talep: 0, desteklenen: 0, ciftci: 0 };
        urunler[anahtar].talep += hk.esasMiktari || 0;
        if (dest) {
          urunler[anahtar].desteklenen += hk.esasMiktari || 0;
          urunler[anahtar].ciftci += 1;
          desteklenenKalem[String(hk.kalem._id)] = (desteklenenKalem[String(hk.kalem._id)] || 0) + (hk.esasMiktari || 0);
        }
      });
    });
    hesap.kalemler.forEach((hk) => {
      const anahtar = hk.kalem.urun + '|' + talepBirimiOku(hk.kalem);
      urunler[anahtar] = urunler[anahtar] || { urun: hk.kalem.urun, birim: talepBirimiOku(hk.kalem), hedef: 0, talep: 0, desteklenen: 0, ciftci: 0 };
      urunler[anahtar].hedef += hk.alan || 0;
    });
    // Çıktılar: hedef (proje) ve desteklenen başvurulara göre beklenen
    const ciktilar = ayar.ciktiNormlari.map((n, i) => {
      const hedef = hesap.ciktiToplamlari[i].toplamlar;
      const beklenen = {};
      p.kalemler.forEach((k) => {
        const m = desteklenenKalem[String(k._id)];
        if (!m) return;
        const c = kalemHesabi(k, m, ayar, p).ciktilar[i];
        if (c.sonuc != null) beklenen[c.birim || ''] = (beklenen[c.birim || ''] || 0) + c.sonuc;
      });
      return { ad: n.ad, hedef, beklenen };
    }).filter((c) => Object.keys(c.hedef).length || Object.keys(c.beklenen).length);
    const sb = p.birim || '–';
    subeler[sb] = subeler[sb] || { sube: sb, proje: 0, ...bos() };
    subeler[sb].proje += 1;
    ekle(subeler[sb], t);
    const dn = p.donem || 'Dönemsiz';
    donemler[dn] = donemler[dn] || { donem: dn, proje: 0, ...bos() };
    donemler[dn].proje += 1;
    ekle(donemler[dn], t);
    return { id: String(p._id), ad: p.kisaAd || p.ad, sube: sb, durum: p.durum, ...t, ciktilar };
  });
  const toplam = bos();
  projeSatirlari.forEach((x) => ekle(toplam, x));
  const sirala = (o, f) => Object.values(o).sort(f);
  return {
    projeler: projeSatirlari,
    subeler: sirala(subeler, (a, b) => b.tahmini - a.tahmini || a.sube.localeCompare(b.sube, 'tr')),
    urunler: sirala(urunler, (a, b) => (b.hedef + b.talep) - (a.hedef + a.talep)),
    ilceler: sirala(ilceler, (a, b) => b.talepDekar - a.talepDekar || a.ilce.localeCompare(b.ilce, 'tr')),
    donemler: sirala(donemler, (a, b) => a.donem.localeCompare(b.donem, 'tr')),
    asamalar,
    toplam
  };
}

router.get('/', sar(async (req, res) => {
  const ayar = res.locals.ayar;
  const Proje = mongoose.model('Proje');
  const Gorev = mongoose.model('Gorev');
  const ben = req.ben;

  const donem = req.query.donem && ayar.donemAdlari.includes(req.query.donem) ? req.query.donem : '';
  const sube = req.query.sube && (ayar.birimler || []).includes(req.query.sube) ? req.query.sube : '';
  const projeler = await Proje.find({ ...projeFiltresi(req), ...(donem ? { donem } : {}), ...(sube ? { birim: sube } : {}) }).sort({ olusturulma: -1 });
  const projeIdleri = projeler.map((p) => p._id);
  const gorevler = await Gorev.find({ projeId: { $in: projeIdleri } }).select('projeId durum sonTarih').lean();
  const basvurular = await mongoose.model('Talep').find({ projeId: { $in: projeIdleri } }).lean();
  const tumTalepler = basvurular.filter((t) => !sayilmayanAsamalar.includes(t.durum));

  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);

  // Proje bazında son durum
  const satirlar = projeler.map((p) => {
    const hesap = projeHesabi(p, ayar);
    const pg = gorevler.filter((g) => String(g.projeId) === String(p._id));
    const talep = taleplerOzeti(tumTalepler.filter((x) => String(x.projeId) === String(p._id)), p, ayar);
    return {
      proje: p,
      hesap,
      talep,
      gorev: {
        toplam: pg.length,
        tamam: pg.filter((g) => g.durum === 'tamamlandi').length,
        acik: pg.filter((g) => ACIK.includes(g.durum)).length,
        geciken: pg.filter((g) => ACIK.includes(g.durum) && g.sonTarih && g.sonTarih < bugun).length
      }
    };
  });

  // İptal edilenler toplamlara girmez
  const sayilanlar = satirlar.filter((s) => s.proje.durum !== 'iptal');
  const ozet = {
    projeSayisi: sayilanlar.length,
    durumlar: Object.fromEntries(Object.keys(projeDurumlari).map((k) => [k, satirlar.filter((s) => s.proje.durum === k).length])),
    hedefDekar: sayilanlar.reduce((t, s) => t + s.hesap.toplamDekar, 0),
    hedefCiftci: sayilanlar.reduce((t, s) => t + s.proje.toplamHedefCiftci, 0),
    talepCiftci: new Set(tumTalepler.map((x) => String(x.ciftciId))).size,
    talepAlan: sayilanlar.reduce((t, s) => t + s.talep.toplamAlan, 0),
    butce: sayilanlar.reduce((t, s) => t + (s.hesap.butce.toplam || 0), 0),
    ciftciKatkisi: sayilanlar.reduce((t, s) => t + (s.talep.ciftciKatkisi || 0), 0),
    ilceSayisi: new Set(sayilanlar.flatMap((s) => s.proje.ilceler.map((i) => i.ilce))).size,
    dagitim: {},
    ciktilar: ayar.ciktiNormlari.map((n) => ({ norm: n, toplamlar: {} }))
  };
  sayilanlar.forEach((s) => {
    birimeTopla(ozet.dagitim, s.hesap.miktarToplamlari);
    s.hesap.ciktiToplamlari.forEach((c, i) => birimeTopla(ozet.ciktilar[i].toplamlar, c.toplamlar));
  });

  const grafik = grafikVerisi(sayilanlar.map((s) => s.proje), basvurular, ayar);

  // Görev özeti (tüm görevler, projeye bağlı olmayanlar dahil)
  const tumGorevler = await Gorev.find(donem ? { projeId: { $in: projeIdleri } } : {}).select('durum sonTarih').lean();
  const gorevOzeti = {
    acik: tumGorevler.filter((g) => ACIK.includes(g.durum)).length,
    geciken: tumGorevler.filter((g) => ACIK.includes(g.durum) && g.sonTarih && g.sonTarih < bugun).length,
    tamam: tumGorevler.filter((g) => g.durum === 'tamamlandi').length,
    toplam: tumGorevler.length
  };

  // Kişinin açık görevleri
  let benimGorevlerim = [];
  if (ben) {
    benimGorevlerim = await Gorev.find({ $and: [Gorev.kisiSorgusu(ben), { durum: { $in: ACIK } }] })
      .populate('projeId', 'ad kisaAd').populate('atama.kisiId', 'adSoyad rol')
      .sort({ sonTarih: 1, olusturulma: -1 });
    benimGorevlerim.sort((a, b) => (a.sonTarih ? 0 : 1) - (b.sonTarih ? 0 : 1));
  }

  res.render('genel-bakis/views/pano', {
    baslik: 'Genel Bakış', satirlar, ozet, gorevOzeti, benimGorevlerim, donem, sube, grafik
  });
}));

module.exports = router;
