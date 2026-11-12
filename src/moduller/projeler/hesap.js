const { sonucBirimi } = require('../../core/yardimcilar');
const { normOku } = require('../ayarlar/katalog');

// Proje kalemleri için norm tabanlı hesaplar.
//
//   ihtiyaç     = alan (da) × ekim normu               ör. 6.578 da × 20 kg/da = 131.560 kg
//   dağıtım     = ihtiyaç, dağıtım birimiyle aynıysa doğrudan; dağıtım birimi
//                 ambalajsa (çuval, torba) içeriğe bölünüp yukarı yuvarlanır
//                 ör. 131.560 kg ÷ 40 kg/çuval = 3.289 çuval
//   teslim      = dağıtılan ambalajların içeriği       ör. 3.289 çuval × 40 kg = 131.560 kg
//   bedel       = fiyat birimine göre miktar × birim fiyat
//                 ör. 131.560 kg × 36 TL/kg = 4.736.160 TL
//   katkılar    = bedel × çiftçi katkı oranı; kalanı destek kaynağının katkısı
//   hedef çıktı = alan (da) × çıktı normu
//
// Aynı hesap çiftçi talebine de uygulanır; yuvarlama her çiftçinin her kalemi
// için ayrı yapıldığından talep toplamları proje hedefinden biraz fazla olabilir.

function birimiAyni(a, b) {
  return String(a || '').trim().toLocaleLowerCase('tr') === String(b || '').trim().toLocaleLowerCase('tr');
}

// Kalemin fiyatı hangi birim üzerinden: dağıtım birimi (TL/çuval) ya da
// ambalaj içeriğinin birimi (TL/kg). Belirtilmemişse ambalaj varsa içerik birimi.
function fiyatBirimi(k) {
  const ambalaj = k.ambalaj && k.ambalaj.miktar > 0 ? k.ambalaj : null;
  if (k.fiyatBirimi) return k.fiyatBirimi;
  return ambalaj ? ambalaj.birim : k.olcuBirimi;
}

// Verilen alan için miktar ve bedel. elleMiktar: dağıtım biriminde elle girilen toplam.
function miktarHesabi(k, alan, ayar, proje, elleMiktar) {
  const ekimTanim = ayar.ekimNormu;
  const ekim = ekimTanim ? normOku(k.normlar, ekimTanim.kod) : null;
  const ekimBirimi = ekim ? (ekim.birim || ekimTanim.birim) : null;
  const ihtiyacBirimi = ekimBirimi ? sonucBirimi(ekimBirimi) : null;
  const ihtiyac = ekim && alan != null ? alan * ekim.deger : null;

  // Ekim normunun birimi ambalaj içeriğinin birimine bağlıdır (ör. adet/da ↔ 1 paket = 50.000 adet),
  // bu yüzden ihtiyaç doğrudan ambalaj içeriğine bölünür.
  const ambalaj = k.ambalaj && k.ambalaj.miktar > 0 ? k.ambalaj : null;
  let hesaplananMiktar = null;
  let birimUyumsuz = false;
  if (ihtiyac != null) {
    if (ambalaj && birimiAyni(ambalaj.birim, ihtiyacBirimi)) {
      hesaplananMiktar = Math.ceil(ihtiyac / ambalaj.miktar - 1e-9);
    } else if (!ambalaj && birimiAyni(ihtiyacBirimi, k.olcuBirimi)) {
      hesaplananMiktar = ihtiyac;
    } else {
      birimUyumsuz = true;
    }
  }

  const miktar = elleMiktar != null ? elleMiktar : hesaplananMiktar;
  const miktarKaynak = elleMiktar != null ? 'elle' : (hesaplananMiktar != null ? 'hesap' : null);

  // Teslim edilen içerik miktarı (ambalajlıysa içerik biriminde)
  let teslim = null;
  let teslimBirimi = null;
  if (miktar != null) {
    if (ambalaj && !birimiAyni(ambalaj.birim, k.olcuBirimi)) { teslim = miktar * ambalaj.miktar; teslimBirimi = ambalaj.birim; } else { teslim = miktar; teslimBirimi = k.olcuBirimi; }
  }

  // Bedel ve katkılar
  const fb = fiyatBirimi(k);
  let bedel = null;
  if (k.birimFiyat != null && miktar != null) {
    if (birimiAyni(fb, k.olcuBirimi)) bedel = miktar * k.birimFiyat;
    else if (birimiAyni(fb, teslimBirimi)) bedel = teslim * k.birimFiyat;
  }
  const oran = proje && proje.finansman && proje.finansman.ciftciKatkiOrani != null ? proje.finansman.ciftciKatkiOrani : null;
  const ciftciKatkisi = bedel != null && oran != null ? bedel * oran / 100 : null;
  const destek = bedel != null && ciftciKatkisi != null ? bedel - ciftciKatkisi : null;

  return {
    ekimDegeri: ekim ? ekim.deger : null,
    ekimBirimi,
    ihtiyac,
    ihtiyacBirimi,
    ambalaj,
    hesaplananMiktar,
    birimUyumsuz,
    miktar,
    miktarKaynak,
    teslim,
    teslimBirimi,
    fiyatBirimi: fb,
    bedel,
    ciftciKatkisi,
    destek
  };
}

function kalemHesabi(k, alan, ayar, proje) {
  const m = miktarHesabi(k, alan, ayar, proje, k.toplamMiktar != null ? k.toplamMiktar : null);
  const ciktilar = ayar.ciktiNormlari.map((n) => {
    const o = normOku(k.normlar, n.kod);
    const birim = o ? (o.birim || n.birim) : n.birim;
    return {
      kod: n.kod,
      deger: o ? o.deger : null,
      normBirimi: birim,
      sonuc: o && alan != null ? alan * o.deger : null,
      birim: sonucBirimi(birim)
    };
  });
  return { ...m, ciktilar };
}

// { kg: 12, ton: 1 } biçimindeki toplamlara ekler
function topla(hedef, birim, deger) {
  if (deger == null) return;
  const b = birim || '';
  hedef[b] = (hedef[b] || 0) + deger;
}

const toplamVeyaNull = (dizi) => {
  const d = dizi.filter((v) => v != null);
  return d.length ? d.reduce((a, b) => a + b, 0) : null;
};

function projeHesabi(proje, ayar) {
  const toplamDekar = proje.ilceler.reduce((t, i) => t + (i.hedefDekar || 0), 0);
  const tekKalem = proje.kalemler.length === 1;

  const kalemler = proje.kalemler.map((k) => {
    let alan = k.alan;
    let alanKaynak = 'kalem';
    if (alan == null) {
      if (tekKalem && toplamDekar > 0) { alan = toplamDekar; alanKaynak = 'proje'; } else { alan = null; alanKaynak = null; }
    }
    return { kalem: k, alan, alanKaynak, ...kalemHesabi(k, alan, ayar, proje) };
  });

  // Çıktı toplamları birime göre ayrı tutulur (kg ile adet toplanmaz).
  const ciktiToplamlari = ayar.ciktiNormlari.map((n, i) => {
    const toplamlar = {};
    kalemler.forEach((h) => topla(toplamlar, h.ciktilar[i].birim, h.ciktilar[i].sonuc));
    return { norm: n, toplamlar, var: Object.keys(toplamlar).length > 0 };
  });

  const miktarToplamlari = {};
  const teslimToplamlari = {};
  kalemler.forEach((h) => {
    topla(miktarToplamlari, h.kalem.olcuBirimi, h.miktar);
    topla(teslimToplamlari, h.teslimBirimi, h.teslim);
  });

  const kalemAlanlari = proje.kalemler.filter((k) => k.alan != null);
  const kalemAlanToplami = kalemAlanlari.length ? kalemAlanlari.reduce((t, k) => t + k.alan, 0) : null;

  const butce = {
    toplam: toplamVeyaNull(kalemler.map((h) => h.bedel)),
    ciftciKatkisi: toplamVeyaNull(kalemler.map((h) => h.ciftciKatkisi)),
    destek: toplamVeyaNull(kalemler.map((h) => h.destek)),
    fiyatsizKalem: kalemler.filter((h) => h.kalem.birimFiyat == null).length
  };

  return {
    toplamDekar,
    kalemler,
    ciktiToplamlari,
    ciktiVar: ciktiToplamlari.some((c) => c.var),
    miktarToplamlari,
    teslimToplamlari,
    kalemAlanToplami,
    alanFarki: kalemAlanToplami != null && toplamDekar > 0 && Math.abs(kalemAlanToplami - toplamDekar) > 0.0001,
    butce
  };
}

// Bir çiftçi talebinin hesabı: satırlar kaleme göre toplanır, her kalem için
// ihtiyaç ayrı hesaplanıp ambalaja yukarı yuvarlanır.
function talepHesabi(talep, proje, ayar) {
  const kalemler = [];
  proje.kalemler.forEach((k) => {
    const satirlar = (talep.satirlar || []).filter((s) => String(s.kalemId) === String(k._id));
    if (!satirlar.length) return;
    const alan = satirlar.reduce((t, s) => t + (s.alan || 0), 0);
    kalemler.push({ kalem: k, alan, parselSayisi: satirlar.length, ...miktarHesabi(k, alan, ayar, proje, null) });
  });
  const tanimsiz = (talep.satirlar || []).filter((s) => !proje.kalemler.some((k) => String(k._id) === String(s.kalemId)));
  const toplamAlan = (talep.satirlar || []).reduce((t, s) => t + (s.alan || 0), 0);
  return {
    kalemler,
    toplamAlan,
    tanimsizSatir: tanimsiz.length,
    bedel: toplamVeyaNull(kalemler.map((h) => h.bedel)),
    ciftciKatkisi: toplamVeyaNull(kalemler.map((h) => h.ciftciKatkisi)),
    destek: toplamVeyaNull(kalemler.map((h) => h.destek))
  };
}

// Projedeki taleplerin toplamı: kalem ve ilçe bazında
function taleplerOzeti(talepler, proje, ayar) {
  const kalemler = proje.kalemler.map((k) => ({
    kalem: k, ciftci: 0, alan: 0, miktar: null, teslim: null, teslimBirimi: null, bedel: null, ciftciKatkisi: null
  }));
  const ilceler = {};
  const ekle = (a, b) => (b == null ? a : (a || 0) + b);
  let toplamAlan = 0;
  let bedel = null;
  let ciftciKatkisi = null;

  talepler.forEach((t) => {
    const h = talepHesabi(t, proje, ayar);
    const ilce = t.ilce || '–';
    ilceler[ilce] = ilceler[ilce] || { ilce, ciftci: 0, alan: 0, bedel: null, ciftciKatkisi: null };
    ilceler[ilce].ciftci += 1;
    ilceler[ilce].alan += h.toplamAlan;
    ilceler[ilce].bedel = ekle(ilceler[ilce].bedel, h.bedel);
    ilceler[ilce].ciftciKatkisi = ekle(ilceler[ilce].ciftciKatkisi, h.ciftciKatkisi);
    toplamAlan += h.toplamAlan;
    bedel = ekle(bedel, h.bedel);
    ciftciKatkisi = ekle(ciftciKatkisi, h.ciftciKatkisi);
    h.kalemler.forEach((hk) => {
      const o = kalemler.find((x) => String(x.kalem._id) === String(hk.kalem._id));
      o.ciftci += 1;
      o.alan += hk.alan;
      o.miktar = ekle(o.miktar, hk.miktar);
      o.teslim = ekle(o.teslim, hk.teslim);
      o.teslimBirimi = hk.teslimBirimi || o.teslimBirimi;
      o.bedel = ekle(o.bedel, hk.bedel);
      o.ciftciKatkisi = ekle(o.ciftciKatkisi, hk.ciftciKatkisi);
    });
  });

  return {
    ciftciSayisi: talepler.length,
    toplamAlan,
    bedel,
    ciftciKatkisi,
    kalemler,
    ilceler: Object.values(ilceler).sort((a, b) => a.ilce.localeCompare(b.ilce, 'tr'))
  };
}

module.exports = { projeHesabi, kalemHesabi, miktarHesabi, talepHesabi, taleplerOzeti, fiyatBirimi };
