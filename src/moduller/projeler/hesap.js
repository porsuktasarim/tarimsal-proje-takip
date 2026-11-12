const { sonucBirimi } = require('../../core/yardimcilar');
const { normOku } = require('../ayarlar/katalog');

// Proje kalemleri için norm tabanlı hesaplar.
//
//   ihtiyaç     = talep miktarı × ekim normu           ör. 6.578 da × 20 kg/da = 131.560 kg
//                 talep birimi da, adet (fidan) ya da m² (naylon) olabilir;
//                 ekim normunun paydası talep birimidir (kg/da, adet/adet, m²/m²)
//   dağıtım     = ihtiyaç, dağıtım birimiyle aynıysa doğrudan; dağıtım birimi
//                 ambalajsa (çuval, torba) içeriğe bölünüp yukarı yuvarlanır
//                 ör. 131.560 kg ÷ 40 kg/çuval = 3.289 çuval
//   teslim      = dağıtılan ambalajların içeriği       ör. 3.289 çuval × 40 kg = 131.560 kg
//   bedel       = fiyat birimine göre miktar × birim fiyat
//                 ör. 131.560 kg × 36 TL/kg = 4.736.160 TL
//   katkılar    = bedel × çiftçi katkı oranı; kalanı destek kaynağının katkısı
//   hedef çıktı = talep miktarı × çıktı normu (normun paydası talep birimiyse)
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
// Normsuz türler (makine, ekipman, malzeme): talep edilen miktar doğrudan ihtiyaçtır.
const normsuzMu = (k, ayar) => (ayar.normsuzTurler || []).includes(k.tur);

function miktarHesabi(k, alan, ayar, proje, elleMiktar) {
  const normsuz = normsuzMu(k, ayar);
  const tb = (k && k.talepBirimi) || 'da';
  const ekimTanim = normsuz ? null : ayar.ekimNormu;
  const ekim = ekimTanim ? normOku(k.normlar, ekimTanim.kod) : null;
  const ekimBirimi = ekim ? (ekim.birim || ekimTanim.birim) : null;
  const ihtiyacBirimi = normsuz ? tb : (ekimBirimi ? sonucBirimi(ekimBirimi) : null);
  let ihtiyac = null;
  if (alan != null) {
    if (normsuz) ihtiyac = alan;
    else if (ekim) ihtiyac = alan * ekim.deger;
  }

  // Ekim normunun birimi ambalaj içeriğinin birimine bağlıdır (ör. adet/da ↔ 1 paket = 50.000 adet),
  // bu yüzden ihtiyaç doğrudan ambalaj içeriğine bölünür. Ölçüye göre (özel üretim)
  // kalemlerde ambalaja yuvarlanmaz: 150 m² isteyene 1,5 top verilir.
  const ambalaj = k.ambalaj && k.ambalaj.miktar > 0 ? k.ambalaj : null;
  const yuvarla = (v) => (k.olcuyeGore ? v : Math.ceil(v - 1e-9));
  let hesaplananMiktar = null;
  let birimUyumsuz = false;
  if (ihtiyac != null) {
    if (ambalaj && birimiAyni(ambalaj.birim, ihtiyacBirimi)) {
      hesaplananMiktar = yuvarla(ihtiyac / ambalaj.miktar);
    } else if (!ambalaj && (normsuz || birimiAyni(ihtiyacBirimi, k.olcuBirimi))) {
      hesaplananMiktar = ihtiyac;   // ambalajsız: 1 dağıtım birimi = 1 talep birimi (ör. 1 adet makine)
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
    normsuz,
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

const talepBirimiOku = (k) => (k && k.talepBirimi) || 'da';

// Normun paydası (kg/da → da). Paydası kalemin talep birimiyle uyuşmayan çıktı
// normu hesaplanmaz (ör. adet ile sayılan fidanda kg/da verim).
const payda = (birim) => {
  const p = String(birim || '').split('/');
  return p.length > 1 ? p[1].trim() : '';
};

function kalemHesabi(k, alan, ayar, proje) {
  const m = miktarHesabi(k, alan, ayar, proje, k.toplamMiktar != null ? k.toplamMiktar : null);
  const tb = talepBirimiOku(k);
  const ciktilar = ayar.ciktiNormlari.map((n) => {
    const o = m.normsuz ? null : normOku(k.normlar, n.kod);
    const birim = o ? (o.birim || n.birim) : n.birim;
    const uyumlu = !payda(birim) || birimiAyni(payda(birim), tb);
    return {
      kod: n.kod,
      deger: o ? o.deger : null,
      normBirimi: birim,
      sonuc: o && alan != null && uyumlu ? alan * o.deger : null,
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
      if (tekKalem && toplamDekar > 0 && talepBirimiOku(k) === 'da') { alan = toplamDekar; alanKaynak = 'proje'; } else { alan = null; alanKaynak = null; }
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

  // Dekar hedefleri ilçe hedefleriyle karşılaştırılır; adet ve m² ile sayılan kalemler ayrı tutulur.
  const kalemAlanlari = proje.kalemler.filter((k) => k.alan != null && talepBirimiOku(k) === 'da');
  const hedefToplamlari = {};
  proje.kalemler.forEach((k) => topla(hedefToplamlari, talepBirimiOku(k), k.alan));
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
    hedefToplamlari,
    alanFarki: kalemAlanToplami != null && toplamDekar > 0 && Math.abs(kalemAlanToplami - toplamDekar) > 0.0001,
    butce
  };
}

// Bir çiftçi talebinin hesabı. Her kalem için iki miktar olabilir:
//   talep  : çiftçinin istediği toplam (talep biriminde: da, adet, m²)
//   parsel : parsellere dağıtılmış miktarların toplamı
// İkisi de ayrı ayrı hesaplanır. Esas alınan talep miktarıdır; girilmemişse
// parsel toplamı esas alınır. Yuvarlama her çiftçinin her kalemi için ayrı yapılır.
function talepHesabi(talep, proje, ayar) {
  const satirMiktari = (s) => (s.miktar != null ? s.miktar : (s.alan || 0));
  const kalemler = [];
  proje.kalemler.forEach((k) => {
    const id = String(k._id);
    const satirlar = (talep.satirlar || []).filter((s) => String(s.kalemId) === id);
    const tk = (talep.talepKalemleri || []).find((x) => String(x.kalemId) === id);
    const talepMiktari = tk && tk.miktar > 0 ? tk.miktar : null;
    const parselMiktari = satirlar.length ? satirlar.reduce((t, s) => t + satirMiktari(s), 0) : null;
    if (talepMiktari == null && parselMiktari == null) return;

    const talepHesap = talepMiktari != null ? miktarHesabi(k, talepMiktari, ayar, proje, null) : null;
    const parselHesap = parselMiktari != null ? miktarHesabi(k, parselMiktari, ayar, proje, null) : null;
    const esasKaynak = talepMiktari != null ? 'talep' : 'parsel';
    const esasMiktari = esasKaynak === 'talep' ? talepMiktari : parselMiktari;
    const fark = talepMiktari != null && parselMiktari != null ? parselMiktari - talepMiktari : null;
    kalemler.push({
      kalem: k,
      talepBirimi: talepBirimiOku(k),
      talepMiktari,
      parselMiktari,
      parselSayisi: satirlar.length,
      esasKaynak,
      esasMiktari,
      fark: fark != null && Math.abs(fark) > 1e-9 ? fark : null,
      parselsiz: talepMiktari != null && parselMiktari == null,
      talepHesap,
      parselHesap,
      ...(esasKaynak === 'talep' ? talepHesap : parselHesap)
    });
  });
  const tanimsiz = (talep.satirlar || []).filter((s) => !proje.kalemler.some((k) => String(k._id) === String(s.kalemId)));

  // Birimlere göre toplamlar (da ile adet toplanmaz)
  const toplamlar = {};
  const talepToplamlari = {};
  const parselToplamlari = {};
  kalemler.forEach((h) => {
    topla(toplamlar, h.talepBirimi, h.esasMiktari);
    topla(talepToplamlari, h.talepBirimi, h.talepMiktari);
    topla(parselToplamlari, h.talepBirimi, h.parselMiktari);
  });
  const parselBedel = toplamVeyaNull(kalemler.map((h) => (h.parselHesap ? h.parselHesap.bedel : null)));
  return {
    kalemler,
    toplamlar,
    talepToplamlari,
    parselToplamlari,
    toplamAlan: toplamlar.da || 0,                 // dekar ile sayılan kalemlerin toplamı (başvuru sınırları buna uygulanır)
    farkVar: kalemler.some((h) => h.fark != null),
    parselsizKalem: kalemler.filter((h) => h.parselsiz).length,
    tanimsizSatir: tanimsiz.length,
    bedel: toplamVeyaNull(kalemler.map((h) => h.bedel)),
    ciftciKatkisi: toplamVeyaNull(kalemler.map((h) => h.ciftciKatkisi)),
    destek: toplamVeyaNull(kalemler.map((h) => h.destek)),
    parselBedel
  };
}

// Projedeki taleplerin toplamı: kalem ve ilçe bazında
function taleplerOzeti(talepler, proje, ayar) {
  const kalemler = proje.kalemler.map((k) => ({
    kalem: k, talepBirimi: talepBirimiOku(k), ciftci: 0, esasMiktari: 0, talepMiktari: 0, parselMiktari: 0,
    miktar: null, teslim: null, teslimBirimi: null, bedel: null, ciftciKatkisi: null
  }));
  const ilceler = {};
  const ekle = (a, b) => (b == null ? a : (a || 0) + b);
  const toplamlar = {};
  let bedel = null;
  let ciftciKatkisi = null;

  talepler.forEach((t) => {
    const h = talepHesabi(t, proje, ayar);
    const ilce = t.ilce || '–';
    ilceler[ilce] = ilceler[ilce] || { ilce, ciftci: 0, alan: 0, toplamlar: {}, bedel: null, ciftciKatkisi: null };
    ilceler[ilce].ciftci += 1;
    ilceler[ilce].alan += h.toplamAlan;
    Object.entries(h.toplamlar).forEach(([b, v]) => topla(ilceler[ilce].toplamlar, b, v));
    ilceler[ilce].bedel = ekle(ilceler[ilce].bedel, h.bedel);
    ilceler[ilce].ciftciKatkisi = ekle(ilceler[ilce].ciftciKatkisi, h.ciftciKatkisi);
    Object.entries(h.toplamlar).forEach(([b, v]) => topla(toplamlar, b, v));
    bedel = ekle(bedel, h.bedel);
    ciftciKatkisi = ekle(ciftciKatkisi, h.ciftciKatkisi);
    h.kalemler.forEach((hk) => {
      const o = kalemler.find((x) => String(x.kalem._id) === String(hk.kalem._id));
      o.ciftci += 1;
      o.esasMiktari += hk.esasMiktari;
      o.talepMiktari += hk.talepMiktari || 0;
      o.parselMiktari += hk.parselMiktari || 0;
      o.miktar = ekle(o.miktar, hk.miktar);
      o.teslim = ekle(o.teslim, hk.teslim);
      o.teslimBirimi = hk.teslimBirimi || o.teslimBirimi;
      o.bedel = ekle(o.bedel, hk.bedel);
      o.ciftciKatkisi = ekle(o.ciftciKatkisi, hk.ciftciKatkisi);
    });
  });

  return {
    ciftciSayisi: talepler.length,
    toplamlar,
    toplamAlan: toplamlar.da || 0,
    bedel,
    ciftciKatkisi,
    kalemler,
    ilceler: Object.values(ilceler).sort((a, b) => a.ilce.localeCompare(b.ilce, 'tr'))
  };
}

module.exports = { normsuzMu, projeHesabi, kalemHesabi, miktarHesabi, talepHesabi, taleplerOzeti, fiyatBirimi, talepBirimiOku };
