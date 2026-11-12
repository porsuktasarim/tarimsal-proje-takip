const mongoose = require('mongoose');

// Ürün kataloğu: kalem türü altında ürün (Mısır, Yulaf, DAP...) ve çeşitleri
// (AGA, ADA...).
//
// normlar: { <norm kodu>: { deger, birim } } — ör. ekim_normu: { deger: 7000, birim: 'adet/da' }
// ambalaj: dağıtım biriminin içeriği — ör. 1 torba = { miktar: 25000, birim: 'adet' }
// Çeşitte girilen norm ve ambalaj, ürünün değerinin yerine geçer.

const ambalajSema = new mongoose.Schema({
  miktar: { type: Number, min: 0 },
  birim: { type: String, trim: true }
}, { _id: false });

const cesitSema = new mongoose.Schema({
  ad: { type: String, required: true, trim: true },
  normlar: { type: mongoose.Schema.Types.Mixed, default: {} },
  ambalaj: { type: ambalajSema, default: undefined },
  aciklama: { type: String, trim: true }
}, { _id: false, minimize: false });

const urunSema = new mongoose.Schema({
  tur: { type: String, required: true, trim: true },
  ad: { type: String, required: true, trim: true },
  talepBirimi: { type: String, trim: true, default: 'da' },  // talep ve parsel birimi (da, adet, m²)
  olcuBirimi: { type: String, trim: true, default: 'kg' },   // dağıtım birimi
  ambalaj: { type: ambalajSema, default: undefined },
  normlar: { type: mongoose.Schema.Types.Mixed, default: {} },
  cesitler: { type: [cesitSema], default: [] },
  aciklama: { type: String, trim: true }
}, { collection: 'urunler', minimize: false, timestamps: { createdAt: 'olusturulma', updatedAt: 'guncellenme' } });

urunSema.index({ tur: 1, ad: 1 });

module.exports = mongoose.models.Urun || mongoose.model('Urun', urunSema);
