const { sonucBirimi } = require('../../core/yardimcilar');
const { normOku } = require('../ayarlar/katalog');

// Proje kalemleri için norm tabanlı hesaplar.
//
//   ihtiyaç       = alan (da) × ekim normu      ör. 1.000 da × 7.000 adet/da = 7.000.000 adet
//   dağıtım       = ihtiyaç, dağıtım birimiyle aynıysa doğrudan;
//                   değilse ambalaj içeriğine bölünür (yukarı yuvarlanır)
//                   ör. 7.000.000 adet ÷ 25.000 adet/torba = 280 torba
//   hedef çıktı   = alan (da) × çıktı normu     ör. 1.000 da × 6.000 kg/da = 6.000 ton
//
// Kalemde alan girilmemişse ve projede tek kalem varsa ilçe hedeflerinin
// toplam dekarı kullanılır.

function birimiAyni(a, b) {
  return String(a || '').trim().toLocaleLowerCase('tr') === String(b || '').trim().toLocaleLowerCase('tr');
}

function kalemHesabi(k, alan, ayar) {
  const ekimTanim = ayar.ekimNormu;
  const ekim = ekimTanim ? normOku(k.normlar, ekimTanim.kod) : null;
  const ekimBirimi = ekim ? (ekim.birim || ekimTanim.birim) : null;
  const ihtiyacBirimi = ekimBirimi ? sonucBirimi(ekimBirimi) : null;
  const ihtiyac = ekim && alan != null ? alan * ekim.deger : null;

  const ambalaj = k.ambalaj && k.ambalaj.miktar > 0 ? k.ambalaj : null;
  let hesaplananMiktar = null;
  let birimUyumsuz = false;
  if (ihtiyac != null) {
    if (birimiAyni(ihtiyacBirimi, k.olcuBirimi)) {
      hesaplananMiktar = ihtiyac;
    } else if (ambalaj && birimiAyni(ambalaj.birim, ihtiyacBirimi)) {
      hesaplananMiktar = Math.ceil(ihtiyac / ambalaj.miktar);
    } else {
      birimUyumsuz = true;
    }
  }

  const miktar = k.toplamMiktar != null ? k.toplamMiktar : hesaplananMiktar;
  const miktarKaynak = k.toplamMiktar != null ? 'elle' : (hesaplananMiktar != null ? 'hesap' : null);

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
    ciktilar
  };
}

// { kg: 12, ton: 1 } biçimindeki toplamlara ekler
function topla(hedef, birim, deger) {
  if (deger == null) return;
  const b = birim || '';
  hedef[b] = (hedef[b] || 0) + deger;
}

function projeHesabi(proje, ayar) {
  const toplamDekar = proje.ilceler.reduce((t, i) => t + (i.hedefDekar || 0), 0);
  const tekKalem = proje.kalemler.length === 1;

  const kalemler = proje.kalemler.map((k) => {
    let alan = k.alan;
    let alanKaynak = 'kalem';
    if (alan == null) {
      if (tekKalem && toplamDekar > 0) { alan = toplamDekar; alanKaynak = 'proje'; } else { alan = null; alanKaynak = null; }
    }
    return { kalem: k, alan, alanKaynak, ...kalemHesabi(k, alan, ayar) };
  });

  // Çıktı toplamları birime göre ayrı tutulur (kg ile adet toplanmaz).
  const ciktiToplamlari = ayar.ciktiNormlari.map((n, i) => {
    const toplamlar = {};
    kalemler.forEach((h) => topla(toplamlar, h.ciktilar[i].birim, h.ciktilar[i].sonuc));
    return { norm: n, toplamlar, var: Object.keys(toplamlar).length > 0 };
  });

  const miktarToplamlari = {};
  kalemler.forEach((h) => topla(miktarToplamlari, h.kalem.olcuBirimi, h.miktar));

  const kalemAlanlari = proje.kalemler.filter((k) => k.alan != null);
  const kalemAlanToplami = kalemAlanlari.length ? kalemAlanlari.reduce((t, k) => t + k.alan, 0) : null;

  return {
    toplamDekar,
    kalemler,
    ciktiToplamlari,
    ciktiVar: ciktiToplamlari.some((c) => c.var),
    miktarToplamlari,
    kalemAlanToplami,
    alanFarki: kalemAlanToplami != null && toplamDekar > 0 && Math.abs(kalemAlanToplami - toplamDekar) > 0.0001
  };
}

module.exports = { projeHesabi, kalemHesabi };
