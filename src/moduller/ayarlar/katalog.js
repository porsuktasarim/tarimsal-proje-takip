// Ürün kataloğu ve norm değerleri için ortak yardımcılar.
//
// Norm değeri { deger, birim } biçiminde saklanır: aynı "Ekim normu" mısırda
// adet/da, yulafta kg/da olabilir. Birim boşsa norm tanımındaki birim geçerlidir.
//
// Varsayılanlar iki katmanlıdır: ürünün değerleri, çeşidin değerleriyle
// (girilmişse) ezilir. Projeye eklenirken etkin değerler kaleme kopyalanır.

const { sayiOku, mapDeger, anahtar } = require('../../core/yardimcilar');

const metin = (v) => (v === undefined || v === null ? '' : String(v).trim());

// Eski biçim (yalnızca sayı) ve yeni biçim ({ deger, birim }) okunur.
function normOku(normlar, kod) {
  const v = mapDeger(normlar, kod);
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? { deger: v, birim: '' } : null;
  if (typeof v === 'object' && v.deger !== null && v.deger !== undefined && Number.isFinite(Number(v.deger))) {
    return { deger: Number(v.deger), birim: metin(v.birim) };
  }
  return null;
}

function normlarDuz(normlar) {
  const sonuc = {};
  if (!normlar) return sonuc;
  const anahtarlar = typeof normlar.keys === 'function' && typeof normlar.get === 'function'
    ? Array.from(normlar.keys()) : Object.keys(normlar);
  anahtarlar.forEach((k) => {
    const n = normOku(normlar, k);
    if (n) sonuc[k] = n;
  });
  return sonuc;
}

function ambalajDuz(a) {
  if (!a) return null;
  const miktar = Number(a.miktar);
  if (!Number.isFinite(miktar) || miktar <= 0) return null;
  return { miktar, birim: metin(a.birim) || 'kg' };
}

function cesitDuz(c) {
  if (typeof c === 'string') return { ad: c, normlar: {}, ambalaj: null };
  return {
    ad: metin(c && c.ad),
    normlar: normlarDuz(c && c.normlar),
    ambalaj: ambalajDuz(c && c.ambalaj),
    aciklama: metin(c && c.aciklama) || undefined
  };
}

// Mongoose belgesi ya da lean nesneden düz ürün nesnesi
function urunDuz(u) {
  const o = u && typeof u.toObject === 'function' ? u.toObject({ flattenMaps: true }) : (u || {});
  return {
    _id: o._id ? String(o._id) : undefined,
    tur: o.tur,
    ad: o.ad,
    olcuBirimi: o.olcuBirimi,
    ambalaj: ambalajDuz(o.ambalaj),
    normlar: normlarDuz(o.normlar),
    cesitler: (o.cesitler || []).map(cesitDuz).filter((c) => c.ad),
    aciklama: o.aciklama
  };
}

function cesitBul(urun, ad) {
  const k = anahtar(ad);
  if (!k || !urun) return null;
  return (urun.cesitler || []).find((c) => anahtar(c.ad) === k) || null;
}

// Ürün + çeşit katmanlarından etkin varsayılanlar
function etkinVarsayilanlar(urun, cesitAd) {
  const cesit = cesitBul(urun, cesitAd);
  return {
    olcuBirimi: urun.olcuBirimi,
    ambalaj: (cesit && cesit.ambalaj) || urun.ambalaj || null,
    normlar: { ...urun.normlar, ...((cesit && cesit.normlar) || {}) }
  };
}

// Formdan normlar[kod][deger] / normlar[kod][birim] okunur. Değeri girilmemiş
// normlar alınmaz; birim boşsa norm tanımının birimi yazılır.
function normFormuOku(govde, tanimlar, birimBossaVarsayilan = true) {
  const sonuc = {};
  tanimlar.forEach((n) => {
    const g = govde && govde[n.kod];
    if (!g) return;
    const deger = sayiOku(typeof g === 'object' ? g.deger : g);
    if (deger === undefined) return;
    const birim = metin(typeof g === 'object' ? g.birim : '') || (birimBossaVarsayilan ? n.birim : '');
    sonuc[n.kod] = { deger, birim };
  });
  return sonuc;
}

function ambalajFormuOku(g) {
  if (!g) return undefined;
  const miktar = sayiOku(g.miktar);
  if (miktar === undefined || miktar <= 0) return undefined;
  return { miktar, birim: metin(g.birim) || 'kg' };
}

// Kalemin normlarından, ürünün varsayılanından farklı olanlar (yeni çeşide yazılır)
function farkliNormlar(normlar, temel) {
  const sonuc = {};
  Object.keys(normlar || {}).forEach((k) => {
    const a = normlar[k];
    const b = temel && temel[k];
    if (!b || b.deger !== a.deger || (a.birim || '') !== (b.birim || '')) sonuc[k] = a;
  });
  return sonuc;
}

// Ekim normunun birimi ambalaj içeriğinin birimine bağlıdır: 1 paket = 50.000 adet
// ise ekim normu adet/da, 1 çuval = 25 kg ise kg/da. Normlar nesnesini yerinde günceller.
function ekimBiriminiEsitle(normlar, ambalaj, ekimKod) {
  if (!ekimKod || !normlar || !normlar[ekimKod] || !ambalaj || !ambalaj.birim) return normlar;
  normlar[ekimKod] = { ...normlar[ekimKod], birim: `${ambalaj.birim}/da` };
  return normlar;
}

const ayniAmbalaj = (a, b) => (!a && !b) || (a && b && a.miktar === b.miktar && a.birim === b.birim);

module.exports = {
  normOku, normlarDuz, ambalajDuz, cesitDuz, urunDuz, cesitBul, etkinVarsayilanlar,
  normFormuOku, ambalajFormuOku, farkliNormlar, ayniAmbalaj, ekimBiriminiEsitle
};
