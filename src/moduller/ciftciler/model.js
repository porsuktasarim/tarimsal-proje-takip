const mongoose = require('mongoose');

// Çiftçi kaydı projelerden bağımsızdır; aynı çiftçi birden fazla projede
// talepte bulunabilir (çiftçi icmali bu kayıt üzerinden çıkarılır).
// T.C. kimlik numarası benzersizdir. İlçe, çiftçinin kayıtlı olduğu ilçedir;
// parseller başka ilçelerde olabilir (parsel bilgisi talepte tutulur).

const ciftciSema = new mongoose.Schema({
  tcKimlikNo: { type: String, required: true, trim: true, match: /^[1-9][0-9]{10}$/ },
  adSoyad: { type: String, required: true, trim: true },
  telefon: { type: String, trim: true },
  ilce: { type: String, required: true, trim: true },
  mahalle: { type: String, trim: true },          // mahalle / köy
  adres: { type: String, trim: true },
  cks: { type: Boolean, default: false },         // Çiftçi Kayıt Sistemi kaydı var mı
  hayvanlar: { type: mongoose.Schema.Types.Mixed, default: {} },  // son talepte girilen hayvan varlığı
  hayvanTarihi: { type: Date },
  aciklama: { type: String, trim: true },
  kaydeden: { type: mongoose.Schema.Types.ObjectId, ref: 'Kisi' },
  kaydedenAd: { type: String, trim: true }
}, { collection: 'ciftciler', minimize: false, timestamps: { createdAt: 'olusturulma', updatedAt: 'guncellenme' } });

ciftciSema.index({ tcKimlikNo: 1 }, { unique: true });
ciftciSema.index({ ilce: 1, adSoyad: 1 });

module.exports = mongoose.models.Ciftci || mongoose.model('Ciftci', ciftciSema);
