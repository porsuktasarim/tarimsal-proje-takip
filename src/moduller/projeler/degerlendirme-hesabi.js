// Başvuru değerlendirmesinde kullanılan değişkenler, formüller, puan ve limitler.
//
// Proje başlatılırken (Proje > Değerlendirme) iki şey tanımlanır:
//   formüller : ad, ifade, birim; biri "puan" olarak işaretlenirse başvurular puana göre sıralanır
//               ör. ot_ihtiyaci = buyukbas * 3650 + kucukbas * 550
//                   ot_acigi    = ot_ihtiyaci - kuru_ot_uretimi
//   limitler  : bir değişkenin ya da formülün üst sınırı; aşan başvurular işaretlenir
//               ör. bedel ≤ 20.000 TL, toplam_da ≤ 50, yulaf_teslim ≤ 600
//
// Formüller sırayla hesaplanır; bir formül kendinden önce tanımlanan formülleri kullanabilir.
// Hesap her zaman başvurunun geçerli (son değerlendirmedeki) değerleriyle yapılır.

const formul = require('../../core/formul');
const { kodUret, sonucBirimi } = require('../../core/yardimcilar');
const { normOku } = require('../ayarlar/katalog');
const { talepHesabi, normsuzMu } = require('./hesap');

const birimKodu = (b) => ({ da: 'da', adet: 'adet', 'm²': 'm2', m2: 'm2' }[b] || kodUret(b));
const uretimKodu = (normKod) => (normKod.endsWith('_verimi') ? normKod.replace(/_verimi$/, '_uretimi') : `${normKod}_uretimi`);

// Kalemlerin değişken önekleri: "Yulaf" → yulaf, "Mısır ADA" → misir_ada; çakışırsa _2, _3
function kalemKodlari(proje) {
  const kullanilan = new Set();
  const sonuc = {};
  (proje.kalemler || []).forEach((k) => {
    const temel = kodUret(`${k.urun || 'kalem'} ${k.cesit || ''}`);
    let kod = temel;
    let n = 2;
    while (kullanilan.has(kod)) kod = `${temel}_${n++}`;
    kullanilan.add(kod);
    sonuc[String(k._id || k.urun)] = kod;
  });
  return sonuc;
}

// Kullanılabilir değişkenlerin listesi (formül yardımında ve denetimde)
function degiskenTanimlari(proje, ayar) {
  const liste = [];
  const ekle = (ad, aciklama, birim, grup) => liste.push({ ad, aciklama, birim: birim || '', grup });
  (ayar.hayvanTurleri || []).forEach((h) => ekle(h.kod, `${h.ad} sayısı`, h.birim, 'Çiftçi'));
  ekle('cks', 'ÇKS kaydı varsa 1, yoksa 0', '', 'Çiftçi');
  ekle('parsel_sayisi', 'Parsel satırı sayısı', '', 'Talep');
  ['da', 'adet', 'm²'].concat(ayar.talepBirimleri || []).filter((b, i, a) => a.indexOf(b) === i)
    .forEach((b) => ekle(`toplam_${birimKodu(b)}`, `Talep edilen toplam (${b} ile sayılan kalemler)`, b, 'Talep'));
  ekle('bedel', 'Toplam bedel', 'TL', 'Talep');
  ekle('ciftci_katkisi', 'Çiftçi katkısı', 'TL', 'Talep');
  ekle('destek', 'Destek tutarı (bedel − çiftçi katkısı)', 'TL', 'Talep');
  (ayar.ciktiNormlari || []).forEach((n) => ekle(uretimKodu(n.kod), `${n.ad} ile beklenen üretim (tüm kalemler)`, sonucBirimi(n.birim), 'Çıktı'));
  const kodlar = kalemKodlari(proje);
  (proje.kalemler || []).forEach((k) => {
    const kod = kodlar[String(k._id || k.urun)];
    const ad = k.urun + (k.cesit ? ' · ' + k.cesit : '');
    const tb = k.talepBirimi || 'da';
    ekle(`${kod}_talep`, `${ad}: talep edilen (geçerli)`, tb, ad);
    ekle(`${kod}_parsel`, `${ad}: parsellerdeki toplam`, tb, ad);
    ekle(`${kod}_dagitim`, `${ad}: dağıtılacak`, k.olcuBirimi, ad);
    ekle(`${kod}_teslim`, `${ad}: teslim edilecek içerik`, k.ambalaj ? k.ambalaj.birim : k.olcuBirimi, ad);
    ekle(`${kod}_bedel`, `${ad}: bedel`, 'TL', ad);
  });
  return liste;
}

function formulleri(proje) {
  return ((proje.degerlendirme && proje.degerlendirme.formuller) || []).filter((f) => f && f.kod && f.ifade);
}
function limitleri(proje) {
  return ((proje.degerlendirme && proje.degerlendirme.limitler) || []).filter((l) => l && l.ifade && l.ust != null);
}

// Proje formundaki formül ve limitlerin denetimi; hata metinleri döner
function tanimlariDenetle(proje, ayar) {
  const hatalar = [];
  const hazir = new Set(degiskenTanimlari(proje, ayar).map((d) => d.ad));
  const bilinen = new Set(hazir);
  const formulKodlari = new Set();
  (proje.degerlendirme.formuller || []).forEach((f, i) => {
    if (!f.ad) hatalar.push(`${i + 1}. formülün adı girilmelidir.`);
    if (!f.ifade) { hatalar.push(`"${f.ad || i + 1}" formülü boş.`); return; }
    if (hazir.has(f.kod)) hatalar.push(`"${f.ad}" adı hazır bir değişkenle (${f.kod}) aynı; başka bir ad verilmelidir.`);
    if (formulKodlari.has(f.kod)) hatalar.push(`"${f.ad}" adıyla birden fazla formül var.`);
    formulKodlari.add(f.kod);
    const h = formul.denetle(f.ifade, bilinen);
    if (h) hatalar.push(`"${f.ad}" formülü: ${h}`);
    bilinen.add(f.kod);
  });
  if ((proje.degerlendirme.formuller || []).filter((f) => f.puan).length > 1) hatalar.push('Yalnızca bir formül puan olarak işaretlenebilir.');
  (proje.degerlendirme.limitler || []).forEach((l, i) => {
    if (!l.ifade) { hatalar.push(`${i + 1}. limitin ölçütü girilmelidir.`); return; }
    if (l.ust == null) hatalar.push(`${i + 1}. limitin üst değeri girilmelidir.`);
    const h = formul.denetle(l.ifade, bilinen);
    if (h) hatalar.push(`${i + 1}. limit (${l.ifade}): ${h}`);
  });
  return hatalar;
}

// Bir başvurunun değişken değerleri
function degiskenDegerleri(talep, ciftci, proje, ayar, hesap) {
  const h = hesap || talepHesabi(talep, proje, ayar);
  const d = {};
  const hv = talep.hayvanlar || {};
  (ayar.hayvanTurleri || []).forEach((t) => { d[t.kod] = Number(hv[t.kod]) || 0; });
  d.cks = ciftci && ciftci.cks ? 1 : 0;
  d.parsel_sayisi = (talep.satirlar || []).length;
  ['da', 'adet', 'm²'].concat(ayar.talepBirimleri || []).forEach((b) => { d[`toplam_${birimKodu(b)}`] = (h.toplamlar && h.toplamlar[b]) || 0; });
  d.bedel = h.bedel || 0;
  d.ciftci_katkisi = h.ciftciKatkisi || 0;
  d.destek = h.destek || 0;
  (ayar.ciktiNormlari || []).forEach((n) => { d[uretimKodu(n.kod)] = 0; });
  const kodlar = kalemKodlari(proje);
  (proje.kalemler || []).forEach((k) => {
    const kod = kodlar[String(k._id || k.urun)];
    const hk = h.kalemler.find((x) => String(x.kalem._id) === String(k._id));
    d[`${kod}_talep`] = hk ? hk.esasMiktari : 0;
    d[`${kod}_parsel`] = hk && hk.parselMiktari != null ? hk.parselMiktari : 0;
    d[`${kod}_dagitim`] = hk && hk.miktar != null ? hk.miktar : 0;
    d[`${kod}_teslim`] = hk && hk.teslim != null ? hk.teslim : 0;
    d[`${kod}_bedel`] = hk && hk.bedel != null ? hk.bedel : 0;
    if (hk && !normsuzMu(k, ayar)) {
      (ayar.ciktiNormlari || []).forEach((n) => {
        const o = normOku(k.normlar, n.kod);
        if (!o) return;
        const birim = o.birim || n.birim;
        const payda = String(birim).split('/')[1];
        if (payda && payda.trim() !== (k.talepBirimi || 'da')) return;
        d[uretimKodu(n.kod)] += hk.esasMiktari * o.deger;
      });
    }
  });
  return d;
}

// Başvurunun formül değerleri, puanı ve limit aşımları
function degerlendirmeHesabi(talep, ciftci, proje, ayar, hesap) {
  const h = hesap || talepHesabi(talep, proje, ayar);
  const d = degiskenDegerleri(talep, ciftci, proje, ayar, h);
  const formuller = formulleri(proje).map((f) => {
    const r = formul.degerlendir(f.ifade, d);
    d[f.kod] = r.deger == null ? 0 : r.deger;
    return { kod: f.kod, ad: f.ad, birim: f.birim || '', ondalik: f.ondalik != null ? f.ondalik : 2, puan: !!f.puan, deger: r.deger, hata: r.hata };
  });
  const puanF = formuller.find((f) => f.puan);
  const limitAsimlari = [];
  limitleri(proje).forEach((l) => {
    const r = formul.degerlendir(l.ifade, d);
    if (r.deger != null && r.deger > l.ust + 1e-9) limitAsimlari.push({ ad: l.ad || l.ifade, ifade: l.ifade, deger: r.deger, ust: l.ust, birim: l.birim || '' });
  });
  return { hesap: h, degiskenler: d, formuller, puan: puanF ? puanF.deger : null, limitAsimlari };
}

module.exports = {
  kalemKodlari, degiskenTanimlari, tanimlariDenetle, degiskenDegerleri, degerlendirmeHesabi, formulleri, limitleri, uretimKodu
};
