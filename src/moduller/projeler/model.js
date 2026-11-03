const mongoose = require('mongoose');
const { projeDurumlari } = require('../../config/sabitler');

// Projede dağıtılacak/desteklenecek her kalem (tohum çeşidi, fide, gübre vb.)
const kalemSema = new mongoose.Schema({
  tur: { type: String, required: true, trim: true },          // Tohum, Fide, Gübre...
  ad: { type: String, required: true, trim: true },           // Yonca, Fiğ + Arpa karışımı...
  olcuBirimi: { type: String, required: true, trim: true },   // kg, adet...
  dekarBasiMiktar: { type: Number, min: 0 },                  // dekar başına verilecek miktar
  toplamMiktar: { type: Number, min: 0 },                     // projede toplam miktar
  aciklama: { type: String, trim: true }
}, { _id: true });

// İlçe bazlı hedef (kota)
const ilceHedefSema = new mongoose.Schema({
  ilce: { type: String, required: true, trim: true },
  hedefCiftci: { type: Number, min: 0 },
  hedefDekar: { type: Number, min: 0 }
}, { _id: false });

const projeSema = new mongoose.Schema({
  ad: { type: String, required: true, trim: true },
  kisaAd: { type: String, trim: true },
  birim: { type: String, required: true, trim: true },
  donem: { type: String, trim: true },                        // ör. 2026 Güzlük, 2027
  baslangicTarihi: { type: Date },
  bitisTarihi: { type: Date },
  aciklama: { type: String, trim: true },
  durum: { type: String, enum: Object.keys(projeDurumlari), default: 'taslak' },
  kalemler: { type: [kalemSema], default: [] },
  ilceler: { type: [ilceHedefSema], default: [] }
}, { timestamps: { createdAt: 'olusturulma', updatedAt: 'guncellenme' } });

projeSema.virtual('toplamHedefDekar').get(function () {
  return this.ilceler.reduce((t, i) => t + (i.hedefDekar || 0), 0);
});

projeSema.virtual('toplamHedefCiftci').get(function () {
  return this.ilceler.reduce((t, i) => t + (i.hedefCiftci || 0), 0);
});

projeSema.index({ birim: 1, durum: 1 });

module.exports = mongoose.models.Proje || mongoose.model('Proje', projeSema);
