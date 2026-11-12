const mongoose = require('mongoose');

// Sistem ayarları tek bir belgede (_id: 'genel') tutulur.

const donemSema = new mongoose.Schema({
  ad: { type: String, required: true, trim: true },
  baslangic: { type: Date },
  bitis: { type: Date }
}, { _id: false });

const normSema = new mongoose.Schema({
  kod: { type: String, required: true, trim: true },
  ad: { type: String, required: true, trim: true },
  birim: { type: String, trim: true, default: 'kg/da' },
  tip: { type: String, enum: ['ekim', 'cikti', 'bilgi'], default: 'cikti' }
}, { _id: false });

const rolSema = new mongoose.Schema({
  kod: { type: String, required: true, trim: true },
  ad: { type: String, required: true, trim: true },
  aciklama: { type: String, trim: true },
  renk: { type: String, trim: true },
  ilceKisitli: { type: Boolean, default: false },   // yalnızca kişinin sorumlu ilçelerinde çalışır
  yetkiler: { type: [String], default: [] }
}, { _id: false });

const ayarSema = new mongoose.Schema({
  _id: { type: String, default: 'genel' },
  kurum: { type: String, trim: true },
  il: { type: String, trim: true },
  birimler: { type: [String], default: [] },
  donemler: { type: [donemSema], default: [] },
  varsayilanDonem: { type: String, trim: true },
  ilceler: { type: [String], default: [] },
  kalemTurleri: { type: [String], default: [] },
  olcuBirimleri: { type: [String], default: [] },
  normlar: { type: [normSema], default: [] },
  roller: { type: [rolSema], default: undefined },
  hayvanTurleri: {
    type: [new mongoose.Schema({ kod: String, ad: String, birim: String }, { _id: false })],
    default: undefined
  },
  gocSurumu: { type: Number, default: 0 }   // uygulanmış veri dönüşümlerinin sürümü (core/gocler.js)
}, { collection: 'ayarlar', timestamps: { createdAt: false, updatedAt: 'guncellenme' } });

module.exports = mongoose.models.Ayar || mongoose.model('Ayar', ayarSema);
