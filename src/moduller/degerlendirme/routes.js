const express = require('express');
const mongoose = require('mongoose');
const { talepDurumlari, icmalAsamalari } = require('../../config/sabitler');
const { talepHesabi, projeHesabi } = require('../projeler/hesap');
const { degerlendirmeHesabi, formulleri, limitleri } = require('../projeler/degerlendirme-hesabi');
const akis = require('../talepler/akis');
const bbhbIsletmeler = require('../bbhb/isletmeler');
const { metinVarMi } = require('../projeler/proje-metni');

// Proje metni yüklenmeden değerlendirme yapılamaz: proje sayfasına yönlendirilir
const metinSayfasi = (proje) => `/projeler/${proje._id}?bildirim=proje-metni-gerekli&metin=gerekli#proje-metni`;
const { anahtar, diziyeCevir, sayi, para, sayiOku, hayvanlariOku } = require('../../core/yardimcilar');
const { normOku } = require('../ayarlar/katalog');
const { uretimKodu, birimTahmini } = require('../projeler/degerlendirme-hesabi');
const { normsuzMu } = require('../projeler/hesap');
const { yetkiGerekli, ilceKisitliMi, projeFiltresi, projeErisebilirMi, projeErisimYok } = require('../../core/yetki');

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
  const projeler = await Proje().find(projeFiltresi(req)).sort({ olusturulma: -1 }).select('ad kisaAd durum donem').lean();
  if (!projeler.length) return { projeler, proje: null };
  const id = mongoose.isValidObjectId(req.query.proje) && projeErisebilirMi(req, req.query.proje) ? req.query.proje
    : String((projeler.find((p) => p.durum === 'aktif') || projeler.find((p) => p.durum === 'taslak') || projeler[0])._id);
  return { projeler, proje: await Proje().findById(id) };
}

const kalemAdi = (k) => k.urun + (k.cesit ? ' · ' + k.cesit : '');

// Sayfadaki her başvurunun satır verisi
function satirVerisi(t, proje, ayar, bbhbHarita) {
  const hesap = talepHesabi(t, proje, ayar);
  const bbhb = bbhbHarita ? bbhbIsletmeler.ciftciBbhb(t.ciftciId, bbhbHarita) : null;
  const deg = degerlendirmeHesabi(t, t.ciftciId, proje, ayar, hesap, bbhb);
  const ilk = {};
  ((t.basvuru && t.basvuru.talepKalemleri) || []).forEach((x) => { ilk[String(x.kalemId)] = x.miktar; });
  const notlar = (t.gecmis || []).filter((g) => g.not);
  return { talep: t, ciftci: t.ciftciId, hesap, deg, ilk, notSayisi: notlar.length, sonNot: notlar.length ? notlar[notlar.length - 1] : null };
}

// Projede çıktı normu girilmiş kalemlerden beklenen üretim sütunları (ör. silaj üretimi)
function uretimSutunlari(proje, ayar) {
  return (ayar.ciktiNormlari || [])
    .filter((n) => proje.kalemler.some((k) => !normsuzMu(k, ayar) && normOku(k.normlar, n.kod)))
    .map((n) => {
      const kisa = n.ad.replace(/\s*verimi$/i, '');
      return { kod: uretimKodu(n.kod), ad: kisa + ' üretimi', kisaAd: kisa, birim: String(n.birim || 'kg').split('/')[0] };
    });
}

// Izgaradaki hesaplanan hücreler: anahtar → { deger, metin, ipucu }
function hucreler(s, proje, uretimler) {
  const h = s.hesap;
  const d = s.deg.degiskenler;
  const o = {};
  const koy = (k, deger, metin, ipucu) => { o[k] = { deger: deger == null ? null : deger, metin, ipucu: ipucu || '' }; };
  proje.kalemler.forEach((k) => {
    const hk = h.kalemler.find((x) => String(x.kalem._id) === String(k._id));
    koy(`dagitim:${k._id}`, hk ? hk.miktar : null, hk && hk.miktar != null ? `${sayi(hk.miktar)} ${k.olcuBirimi}` : '–',
      hk && hk.esasKaynak === 'parsel' ? 'Talep miktarı girilmemiş; parsel toplamına göre' : '');
  });
  const bbhbVar = s.deg.bbhb && s.deg.bbhb.var;
  koy('bbhb', d.bbhb_gecerli, bbhbVar ? sayi(d.bbhb) : `~${sayi(d.bbhb_beyan)}`,
    bbhbVar ? `BBHB kaydı (${s.deg.bbhb.isletmeSayisi} işletme): ${sayi(s.deg.bbhb.buyukbas)} büyükbaş, ${sayi(s.deg.bbhb.kucukbas)} küçükbaş` : 'Kayıt eşleşmedi; beyan edilen sayılardan tahmin');
  koy('bedel', h.bedel, para(h.bedel));
  koy('katki', h.ciftciKatkisi, para(h.ciftciKatkisi));
  // Beklenen üretimler tek hücrede alt alta (ör. "Silaj: 84.000 kg")
  const uretimDegerleri = {};
  uretimler.forEach((u) => { uretimDegerleri[u.kod] = d[u.kod] || 0; });
  const uretimMetni = uretimler.filter((u) => d[u.kod]).map((u) => `${u.kisaAd}: ${sayi(d[u.kod], 0)} ${u.birim}`).join('\n');
  koy('uretim', uretimler.reduce((t, u) => t + (d[u.kod] || 0), 0), uretimMetni || '–', '');
  o.uretim.degerler = uretimDegerleri;
  s.deg.formuller.forEach((f) => koy(`f:${f.kod}`, f.deger, f.hata ? 'hata' : sayi(f.deger, f.ondalik), f.hata || ''));
  koy('limit', s.deg.limitAsimlari.length, s.deg.limitAsimlari.length ? 'limit üstü' : '',
    s.deg.limitAsimlari.map((l) => `${l.ad}: ${sayi(l.deger)} > ${sayi(l.ust)} ${l.birim}`).join('\n'));
  return o;
}

// Izgaradan gelen değerler: { talepKalemleri: { kalemId: sayı }, hayvanlar: { kod: sayı } }
function izgaraDegerleri(g, proje, ayar) {
  const tk = (g && g.talepKalemleri) || {};
  return {
    talepKalemleri: proje.kalemler
      .map((k) => ({ kalemId: String(k._id), miktar: sayiOku(tk[String(k._id)]) }))
      .filter((x) => x.miktar !== undefined && x.miktar > 0),
    hayvanlar: hayvanlariOku((g && g.hayvanlar) || {}, ayar.hayvanTurleri)
  };
}

router.get('/', sar(async (req, res) => {
  const ayar = res.locals.ayar;
  const { projeler, proje } = await projeSec(req);
  if (!proje) return res.render(V + 'liste', { baslik: 'Değerlendirme', projeler, proje: null });
  if (!metinVarMi(proje)) return res.redirect(metinSayfasi(proje));

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
  const bbhbHarita = await bbhbIsletmeler.isletmeHaritasi();
  let satirlar = talepler.map((t) => satirVerisi(t, proje, ayar, bbhbHarita));
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
    formuller: formulleri(proje).map((f) => ({ ...(f.toObject ? f.toObject() : f), birim: birimTahmini(f) })), limitler: limitleri(proje), ASAMA_GRUPLARI, kalemAdi,
    uretimler: uretimSutunlari(proje, ayar), hucreler,
    filtre: { proje: String(proje._id), asama: grup || req.query.asama, ilce, mahalle, q: req.query.q || '', limit: req.query.limit || '' },
    donus: '/degerlendirme?' + new URLSearchParams(Object.entries({
      proje: String(proje._id), asama: grup || req.query.asama, ilce, mahalle, q: req.query.q || '', limit: req.query.limit || ''
    }).filter(([, v]) => v)).toString(),
    toplu: Object.keys(akis.ISLEMLER).filter((k) => !['gonder', 'not'].includes(k)).map((k) => ({ kod: k, ...akis.ISLEMLER[k] }))
  });
}));

// Izgara: hücre değişince satırın yeniden hesabı (kaydetmez)
router.post('/onizle', sar(async (req, res) => {
  const ayar = res.locals.ayar;
  const b = req.body || {};
  if (!mongoose.isValidObjectId(b.id)) return res.status(400).json({ hata: 'Başvuru bulunamadı.' });
  const t = await Talep().findById(b.id).populate('ciftciId').lean();
  if (!t || !t.ciftciId || !projeErisebilirMi(req, t.projeId)) return res.status(404).json({ hata: 'Başvuru bulunamadı.' });
  const proje = await Proje().findById(t.projeId);
  const v = izgaraDegerleri(b, proje, ayar);
  const kopya = { ...t, talepKalemleri: v.talepKalemleri, hayvanlar: v.hayvanlar };
  const s = satirVerisi(kopya, proje, ayar, await bbhbIsletmeler.isletmeHaritasi());
  return res.json({ hucreler: hucreler(s, proje, uretimSutunlari(proje, ayar)) });
}));

// Izgara: değişiklikleri kaydet. Her başvuruda eski değerler geçmişte kalır; miktar
// düşürülüyorsa gerekçe zorunludur (akis.degistir).
router.post('/kaydet', sar(async (req, res) => {
  const ayar = res.locals.ayar;
  const b = req.body || {};
  const liste = Array.isArray(b.degisiklikler) ? b.degisiklikler : [];
  const sonuc = { tamam: 0, hatalar: [] };
  const projeler = {};
  for (const d of liste) {
    if (!mongoose.isValidObjectId(d.id)) continue;
    const t = await Talep().findById(d.id).populate('ciftciId', 'adSoyad');
    if (!t || !projeErisebilirMi(req, t.projeId)) continue;
    const ad = t.ciftciId ? t.ciftciId.adSoyad : String(t._id);
    const pid = String(t.projeId);
    if (!projeler[pid]) projeler[pid] = await Proje().findById(pid);
    const proje = projeler[pid];
    if (!metinVarMi(proje)) { sonuc.hatalar.push({ id: d.id, ad, hata: 'Proje metni yüklenmemiş.' }); continue; }
    const v = izgaraDegerleri(d, proje, ayar);
    const r = akis.degistir(t, proje, { ...v, not: b.not }, { izin: req.izin, ben: req.ben, ayar });
    if (r.hata) { if (r.hata !== 'Değişiklik yapılmadı.') sonuc.hatalar.push({ id: d.id, ad, hata: r.hata }); continue; }
    t.depopulate('ciftciId');
    await t.save();
    sonuc.tamam += 1;
  }
  return res.json(sonuc);
}));

// Değerlendirme penceresi (liste sayfasında açılır)
router.get('/:id/panel', sar(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Başvuru bulunamadı.');
  const talep = await Talep().findById(req.params.id).populate('ciftciId');
  if (!talep || !talep.ciftciId) return res.status(404).send('Başvuru bulunamadı.');
  if (!projeErisebilirMi(req, talep.projeId)) return projeErisimYok(res);
  const proje = await Proje().findById(talep.projeId);
  if (!metinVarMi(proje)) return res.send(`<div class="alert alert-warning">Değerlendirme için önce <a href="${metinSayfasi(proje)}">proje metni</a> yüklenmelidir.</div>`);
  const ayar = res.locals.ayar;
  const hesap = talepHesabi(talep, proje, ayar);
  const bbhb = bbhbIsletmeler.ciftciBbhb(talep.ciftciId, await bbhbIsletmeler.isletmeHaritasi());
  const deg = degerlendirmeHesabi(talep, talep.ciftciId, proje, ayar, hesap, bbhb);
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
  const ilkTalep = await Talep().findById(ids[0]).select('projeId').lean();
  const tProje = ilkTalep ? await Proje().findById(ilkTalep.projeId).select('belgeler').lean() : null;
  if (tProje && !metinVarMi(tProje)) return res.redirect(metinSayfasi(tProje));
  const baglam = { izin: req.izin, ben: req.ben, ayar, kisitli: ilceKisitliMi(req.ben, ayar), not: req.body.not };
  let tamam = 0;
  const hatalar = new Set();
  for (const id of ids) {
    const t = await Talep().findById(id);
    if (!t || !projeErisebilirMi(req, t.projeId)) continue;
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
  const bbhbHarita = await bbhbIsletmeler.isletmeHaritasi();
  const satirlar = talepler.map((t) => satirVerisi(t, proje, ayar, bbhbHarita));
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
