const mongoose = require('mongoose');

// Ürün kataloğu: kalem türü altında ürün (Mısır, Yonca, DAP...) ve çeşitleri
// (AGA, ADA...). Normlar ürünün varsayılan değerleridir; projeye eklenirken
// kaleme kopyalanır ve orada değiştirilebilir.

const urunSema = new mongoose.Schema({
  tur: { type: String, required: true, trim: true },
  ad: { type: String, required: true, trim: true },
  olcuBirimi: { type: String, trim: true, default: 'kg' },
  cesitler: { type: [String], default: [] },
  normlar: { type: Map, of: Number, default: {} },
  aciklama: { type: String, trim: true }
}, { collection: 'urunler', timestamps: { createdAt: 'olusturulma', updatedAt: 'guncellenme' } });

urunSema.index({ tur: 1, ad: 1 });

module.exports = mongoose.models.Urun || mongoose.model('Urun', urunSema);
