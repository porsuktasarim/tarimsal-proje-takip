const { mapDeger, sonucBirimi } = require('../../core/yardimcilar');

// Proje kalemleri için norm tabanlı hesaplar:
//   dağıtım miktarı = alan (da) × ekim normu
//   hedef çıktı     = alan (da) × çıktı normu (ot verimi, tane verimi...)
// Kalemde alan girilmemişse ve projede tek kalem varsa ilçe hedeflerinin
// toplam dekarı kullanılır.
function projeHesabi(proje, ayar) {
  const toplamDekar = proje.ilceler.reduce((t, i) => t + (i.hedefDekar || 0), 0);
  const tekKalem = proje.kalemler.length === 1;
  const ekim = ayar.ekimNormu;
  const ciktiNormlari = ayar.ciktiNormlari;

  const kalemler = proje.kalemler.map((k) => {
    let alan = k.alan;
    let alanKaynak = 'kalem';
    if (alan == null) {
      if (tekKalem && toplamDekar > 0) { alan = toplamDekar; alanKaynak = 'proje'; } else { alan = null; alanKaynak = null; }
    }

    const ekimDegeri = ekim ? mapDeger(k.normlar, ekim.kod) : undefined;
    const hesaplananMiktar = alan != null && ekimDegeri != null ? alan * ekimDegeri : null;
    const miktar = k.toplamMiktar != null ? k.toplamMiktar : hesaplananMiktar;
    const miktarKaynak = k.toplamMiktar != null ? 'elle' : (hesaplananMiktar != null ? 'hesap' : null);

    const ciktilar = ciktiNormlari.map((n) => {
      const deger = mapDeger(k.normlar, n.kod);
      return {
        kod: n.kod,
        deger: deger != null ? deger : null,
        sonuc: deger != null && alan != null ? alan * deger : null,
        birim: sonucBirimi(n.birim)
      };
    });

    return { kalem: k, alan, alanKaynak, ekimDegeri, hesaplananMiktar, miktar, miktarKaynak, ciktilar };
  });

  const ciktiToplamlari = ciktiNormlari.map((n, i) => {
    const sonuclar = kalemler.map((h) => h.ciktilar[i].sonuc).filter((s) => s != null);
    return {
      norm: n,
      birim: sonucBirimi(n.birim),
      toplam: sonuclar.length ? sonuclar.reduce((a, b) => a + b, 0) : null,
      kalemSayisi: sonuclar.length
    };
  });

  // Dağıtım miktarları ölçü birimine göre toplanır (kg ile adet toplanmaz).
  const miktarToplamlari = {};
  kalemler.forEach((h) => {
    if (h.miktar == null) return;
    const b = h.kalem.olcuBirimi;
    miktarToplamlari[b] = (miktarToplamlari[b] || 0) + h.miktar;
  });

  const kalemAlanlari = proje.kalemler.filter((k) => k.alan != null);
  const kalemAlanToplami = kalemAlanlari.length ? kalemAlanlari.reduce((t, k) => t + k.alan, 0) : null;

  return {
    toplamDekar,
    kalemler,
    ciktiToplamlari,
    ciktiVar: ciktiToplamlari.some((c) => c.toplam != null),
    miktarToplamlari,
    kalemAlanToplami,
    alanFarki: kalemAlanToplami != null && toplamDekar > 0 && Math.abs(kalemAlanToplami - toplamDekar) > 0.0001
  };
}

module.exports = { projeHesabi };
