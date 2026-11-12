const mongoose = require('mongoose');
const { gorevDurumlari, oncelikler } = require('../../config/sabitler');

// Görev bir kişiye ya da bir role verilir. Role verilen görev o roldeki
// herkesin "Görevlerim" listesinde görünür ve içlerinden biri yürütür.
// Her durum değişikliği ve not "hareketler" içinde saklanır.

const hareketSema = new mongoose.Schema({
  tarih: { type: Date, default: Date.now },
  kisiId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kisi' },
  kisiAd: { type: String, trim: true },          // kişi sonradan silinse de kayıtta kalsın
  tur: { type: String, enum: ['olusturma', 'durum', 'not', 'duzenleme'], required: true },
  durum: { type: String },
  metin: { type: String, trim: true }
}, { _id: true });

const gorevSema = new mongoose.Schema({
  baslik: { type: String, required: true, trim: true },
  aciklama: { type: String, trim: true },
  atama: {
    tur: { type: String, enum: ['kisi', 'rol'], required: true },
    kisiId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kisi' },
    rol: { type: String }
  },
  projeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Proje' },
  ilce: { type: String, trim: true },
  sonTarih: { type: Date },
  oncelik: { type: String, enum: Object.keys(oncelikler), default: 'normal' },
  durum: { type: String, enum: Object.keys(gorevDurumlari), default: 'bekliyor' },
  olusturan: { type: mongoose.Schema.Types.ObjectId, ref: 'Kisi' },
  tamamlanma: { type: Date },
  hareketler: { type: [hareketSema], default: [] }
}, { collection: 'gorevler', timestamps: { createdAt: 'olusturulma', updatedAt: 'guncellenme' } });

gorevSema.virtual('acik').get(function () {
  return this.durum === 'bekliyor' || this.durum === 'suruyor';
});

gorevSema.virtual('gecikti').get(function () {
  if (!this.sonTarih || !(this.durum === 'bekliyor' || this.durum === 'suruyor')) return false;
  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);
  return this.sonTarih < bugun;
});

gorevSema.index({ 'atama.kisiId': 1, durum: 1 });
gorevSema.index({ 'atama.rol': 1, durum: 1 });
gorevSema.index({ projeId: 1 });

// Kişinin "Görevlerim" listesi: kendisine ya da rolüne verilen görevler
gorevSema.statics.kisiSorgusu = function (ben) {
  return {
    $or: [
      { 'atama.tur': 'kisi', 'atama.kisiId': ben._id },
      { 'atama.tur': 'rol', 'atama.rol': ben.rol }
    ]
  };
};

module.exports = mongoose.models.Gorev || mongoose.model('Gorev', gorevSema);
