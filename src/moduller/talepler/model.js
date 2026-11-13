const mongoose = require('mongoose');
const { talepDurumlari } = require('../../config/sabitler');

// Çiftçinin bir projedeki talebi iki kısımdır:
//   talepKalemleri: her kalem için istenen toplam miktar (kalemin talep biriminde:
//                   tohumda da, fidanda adet, sera naylonunda m²)
//   satirlar      : bu miktarın hangi parsellere dağıtılacağı (ada/parsel ve miktar)
// Karışım ekimlerde aynı parsel iki satırda yer alabilir. Dağıtım miktarı ve bedel
// kaydedilmez, projedeki kalem normu, ambalajı ve fiyatından hesaplanır.

const talepKalemiSema = new mongoose.Schema({
  kalemId: { type: mongoose.Schema.Types.ObjectId, required: true },  // proje kalemi
  miktar: { type: Number, required: true, min: 0 }                      // istenen toplam (talep biriminde)
}, { _id: false });

const satirSema = new mongoose.Schema({
  kalemId: { type: mongoose.Schema.Types.ObjectId, required: true },  // proje kalemi
  parselIlce: { type: String, trim: true },
  mahalle: { type: String, trim: true },                                // mahalle / köy
  ada: { type: String, trim: true },
  parsel: { type: String, trim: true },
  en: { type: Number, min: 0 },                                         // m² ile sayılan kalemlerde (sera) en ve boy, m
  boy: { type: Number, min: 0 },
  miktar: { type: Number, required: true, min: 0 }                      // parseldeki miktar (kalemin talep biriminde)
}, { _id: true });

// Başvuru geçmişi: her aşama değişikliği, değer değişikliği ve not bir kayıttır.
// Kayıtlar değiştirilmez ve silinmez; değiştirilen değerin eskisi burada kalır.
const gecmisSema = new mongoose.Schema({
  tarih: { type: Date, default: Date.now },
  kisi: { type: mongoose.Schema.Types.ObjectId, ref: 'Kisi' },
  kisiAd: { type: String, trim: true },
  rolAd: { type: String, trim: true },
  tur: { type: String, trim: true },        // olusturma, gonderme, teslim_alma, degisiklik, not, geri_gonderme, karar, karar_geri_alma, teslim, duzenleme
  onceki: { type: String, trim: true },     // önceki aşama
  durum: { type: String, trim: true },      // yeni aşama
  not: { type: String, trim: true },
  degisiklikler: [{ _id: false, alan: String, ad: String, eski: mongoose.Schema.Types.Mixed, yeni: mongoose.Schema.Types.Mixed, birim: String }]
}, { _id: true });

const talepSema = new mongoose.Schema({
  projeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Proje', required: true },
  ciftciId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ciftci', required: true },
  ilce: { type: String, required: true, trim: true },                   // talebi alan ilçe (çiftçinin ilçesi)
  talepKalemleri: { type: [talepKalemiSema], default: [] },
  satirlar: { type: [satirSema], default: [] },
  hayvanlar: { type: mongoose.Schema.Types.Mixed, default: {} },       // { <hayvan türü kodu>: sayı } talep anındaki varlık
  durum: { type: String, enum: Object.keys(talepDurumlari), default: 'taslak' },   // başvuru aşaması
  // Koordinatöre ilk gönderildiğindeki değerler (başvuru); değerlendirmede değişse de korunur
  basvuru: {
    tarih: { type: Date },
    talepKalemleri: { type: mongoose.Schema.Types.Mixed },
    hayvanlar: { type: mongoose.Schema.Types.Mixed }
  },
  karar: {
    sonuc: { type: String, trim: true },
    gerekce: { type: String, trim: true },
    tarih: { type: Date },
    kisiAd: { type: String, trim: true }
  },
  gecmis: { type: [gecmisSema], default: [] },
  aciklama: { type: String, trim: true },
  kaydeden: { type: mongoose.Schema.Types.ObjectId, ref: 'Kisi' },
  kaydedenAd: { type: String, trim: true }
}, { collection: 'talepler', minimize: false, timestamps: { createdAt: 'olusturulma', updatedAt: 'guncellenme' } });

talepSema.index({ projeId: 1, ciftciId: 1 }, { unique: true });
talepSema.index({ projeId: 1, ilce: 1 });
talepSema.index({ ciftciId: 1 });

module.exports = mongoose.models.Talep || mongoose.model('Talep', talepSema);
