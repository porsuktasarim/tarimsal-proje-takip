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

const talepSema = new mongoose.Schema({
  projeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Proje', required: true },
  ciftciId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ciftci', required: true },
  ilce: { type: String, required: true, trim: true },                   // talebi alan ilçe (çiftçinin ilçesi)
  talepKalemleri: { type: [talepKalemiSema], default: [] },
  satirlar: { type: [satirSema], default: [] },
  hayvanlar: { type: mongoose.Schema.Types.Mixed, default: {} },       // { <hayvan türü kodu>: sayı } talep anındaki varlık
  durum: { type: String, enum: Object.keys(talepDurumlari), default: 'alindi' },
  aciklama: { type: String, trim: true },
  kaydeden: { type: mongoose.Schema.Types.ObjectId, ref: 'Kisi' },
  kaydedenAd: { type: String, trim: true }
}, { collection: 'talepler', minimize: false, timestamps: { createdAt: 'olusturulma', updatedAt: 'guncellenme' } });

talepSema.index({ projeId: 1, ciftciId: 1 }, { unique: true });
talepSema.index({ projeId: 1, ilce: 1 });
talepSema.index({ ciftciId: 1 });

module.exports = mongoose.models.Talep || mongoose.model('Talep', talepSema);
