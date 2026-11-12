const mongoose = require('mongoose');
const Ayar = require('../moduller/ayarlar/modeller/Ayar');
const { varsayilanlar } = require('../config/sabitler');

// Ayarlar bellekte tutulur; her kayıttan sonra yeniden okunur.
let onbellek = null;

const kopya = (v) => JSON.parse(JSON.stringify(v));

function duzenle(belge) {
  const a = { ...kopya(varsayilanlar), ...belge };
  a.donemAdlari = (a.donemler || []).map((d) => d.ad);
  a.ekimNormu = (a.normlar || []).find((n) => n.tip === 'ekim') || null;
  a.ciktiNormlari = (a.normlar || []).filter((n) => n.tip === 'cikti');
  // Rol kodları sabittir; kayıtta eksik rol varsa varsayılanı eklenir.
  a.roller = varsayilanlar.roller.map((v) => ({ ...v, ...((a.roller || []).find((r) => r.kod === v.kod) || {}) }));
  a.rolAdlari = Object.fromEntries(a.roller.map((r) => [r.kod, r.ad]));
  return a;
}

async function yukle() {
  let belge = await Ayar.findById('genel').lean();
  if (!belge) {
    await Ayar.create({ _id: 'genel', ...kopya(varsayilanlar) });
    belge = await Ayar.findById('genel').lean();
    console.log('[ayarlar] İlk kurulum varsayılanları yazıldı');
  } else {
    // Sonradan eklenen ayar alanları eski kayıtlarda yoksa varsayılanla doldurulur.
    const eksik = {};
    for (const k of Object.keys(varsayilanlar)) {
      if (belge[k] === undefined) eksik[k] = kopya(varsayilanlar[k]);
    }
    if (Object.keys(eksik).length) {
      await Ayar.updateOne({ _id: 'genel' }, { $set: eksik });
      Object.assign(belge, eksik);
    }
  }
  delete belge._id;
  delete belge.__v;
  onbellek = duzenle(belge);
  return onbellek;
}

function getir() {
  if (!onbellek) throw new Error('Ayarlar henüz yüklenmedi.');
  return onbellek;
}

async function guncelle(degisiklik) {
  await Ayar.updateOne({ _id: 'genel' }, { $set: degisiklik }, { upsert: true });
  return yukle();
}

// ---------------------------------------------------------------------------
// Liste değerlerinin başka kayıtlarda nerede kullanıldığı.
// Bir değer yeniden adlandırılınca bu kayıtlar da güncellenir; kullanılan bir
// değer silinemez.
// ---------------------------------------------------------------------------
// dizi: nesne dizisi içindeki alan; liste: düz metin dizisi (ör. kişinin ilçeleri)
const baglar = {
  birimler: [{ model: 'Proje', alan: 'birim' }, { model: 'Kisi', alan: 'birim' }],
  donemler: [{ model: 'Proje', alan: 'donem' }],
  ilceler: [
    { model: 'Proje', dizi: 'ilceler', alan: 'ilce' },
    { model: 'Kisi', liste: 'ilceler' },
    { model: 'Gorev', alan: 'ilce' },
    { model: 'Ciftci', alan: 'ilce' },
    { model: 'Talep', alan: 'ilce' },
    { model: 'Talep', dizi: 'satirlar', alan: 'parselIlce' }
  ],
  kalemTurleri: [{ model: 'Urun', alan: 'tur' }, { model: 'Proje', dizi: 'kalemler', alan: 'tur' }],
  olcuBirimleri: [{ model: 'Urun', alan: 'olcuBirimi' }, { model: 'Proje', dizi: 'kalemler', alan: 'olcuBirimi' }]
};

const modelVarMi = (ad) => mongoose.modelNames().includes(ad);
const yol = (b) => (b.liste || (b.dizi ? `${b.dizi}.${b.alan}` : b.alan));

async function kullanimSay(liste, deger) {
  let toplam = 0;
  for (const b of baglar[liste] || []) {
    if (!modelVarMi(b.model)) continue;
    toplam += await mongoose.model(b.model).countDocuments({ [yol(b)]: deger });
  }
  return toplam;
}

async function kullanimlar(liste, degerler) {
  const sonuc = {};
  for (const d of degerler) sonuc[d] = await kullanimSay(liste, d);
  return sonuc;
}

// Dizi içindeki alanlar belge belge güncellenir (arrayFilters gerektirmez).
async function yenidenAdlandir(liste, eski, yeni) {
  for (const b of baglar[liste] || []) {
    if (!modelVarMi(b.model)) continue;
    const Model = mongoose.model(b.model);
    if (b.liste) {
      const belgeler = await Model.find({ [b.liste]: eski });
      for (const belge of belgeler) {
        belge[b.liste] = belge[b.liste].map((d) => (d === eski ? yeni : d));
        await belge.save({ validateBeforeSave: false });
      }
      continue;
    }
    if (!b.dizi) {
      await Model.updateMany({ [b.alan]: eski }, { $set: { [b.alan]: yeni } });
      continue;
    }
    const belgeler = await Model.find({ [yol(b)]: eski });
    for (const belge of belgeler) {
      belge[b.dizi].forEach((oge) => { if (oge[b.alan] === eski) oge[b.alan] = yeni; });
      belge.markModified(b.dizi);
      await belge.save({ validateBeforeSave: false });
    }
  }
}

// Formdan gelen [{ eski, ad }] satırlarını ayar listesine uygular:
// boş/tekrarlı değerleri denetler, yeniden adlandırmaları yayar,
// kullanılan değerlerin silinmesini engeller.
async function listeyiUygula(liste, satirlar, mevcut) {
  const hatalar = [];
  const temiz = satirlar
    .map((s) => ({ eski: (s.eski || '').trim(), ad: (s.ad || '').trim() }))
    .filter((s) => s.ad || s.eski);

  const gorulen = new Set();
  temiz.forEach((s, i) => {
    if (!s.ad) hatalar.push(`${i + 1}. satır boş bırakılamaz; silmek için satır kaldırılmalıdır.`);
    const k = s.ad.toLocaleLowerCase('tr');
    if (s.ad && gorulen.has(k)) hatalar.push(`"${s.ad}" birden fazla kez yazılmış.`);
    gorulen.add(k);
  });

  const kalanEskiler = new Set(temiz.map((s) => s.eski).filter(Boolean));
  const silinenler = mevcut.filter((d) => !kalanEskiler.has(d));
  for (const d of silinenler) {
    const n = await kullanimSay(liste, d);
    if (n > 0) hatalar.push(`"${d}" ${n} kayıtta kullanıldığı için silinemez.`);
  }

  if (hatalar.length) return { hatalar };

  for (const s of temiz) {
    if (s.eski && s.eski !== s.ad && mevcut.includes(s.eski)) await yenidenAdlandir(liste, s.eski, s.ad);
  }
  return { hatalar: [], degerler: temiz.map((s) => s.ad), satirlar: temiz };
}

module.exports = { yukle, getir, guncelle, kullanimSay, kullanimlar, yenidenAdlandir, listeyiUygula };
