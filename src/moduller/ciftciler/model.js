const mongoose = require('mongoose');

// Çiftçi kaydı projelerden bağımsızdır; aynı çiftçi birden fazla projede
// talepte bulunabilir (çiftçi icmali bu kayıt üzerinden çıkarılır).
// T.C. kimlik numarası benzersizdir. İlçe, çiftçinin kayıtlı olduğu ilçedir;
// parseller başka ilçelerde olabilir (parsel bilgisi talepte tutulur).

// Çiftçiye bağlı hayvancılık işletmeleri (BBHB kayıtlarındaki işletmeciler).
// Aile işletmesi kavramı gereği çiftçinin kendi işletmesi dışında eşinin, babasının
// vb. işletmeleri de bağlanabilir. Değerler bağlantıda saklanmaz; her zaman o
// işletmenin en güncel BBHB kaydından okunur.
const isletmeBagiSema = new mongoose.Schema({
  isletmeciId: { type: String, required: true, trim: true },   // Türkvet işletme no (TR…) ya da manuel kod
  isletmeciAdi: { type: String, trim: true },
  ilce: { type: String, trim: true },
  mahalle: { type: String, trim: true },
  eslesme: { type: String, enum: ['tc', 'ad-koy', 'elle'], default: 'elle' },  // otomatik (T.C. / ad+köy) ya da elle
  yakinlik: { type: String, trim: true },                       // elle eklenende: kendisi, eşi, babası …
  ekleyenAd: { type: String, trim: true },
  tarih: { type: Date, default: Date.now }
}, { _id: false });

const ciftciSema = new mongoose.Schema({
  tcKimlikNo: { type: String, required: true, trim: true, match: /^[1-9][0-9]{10}$/ },
  adSoyad: { type: String, required: true, trim: true },
  telefon: { type: String, trim: true },
  ilce: { type: String, required: true, trim: true },
  mahalle: { type: String, trim: true },          // mahalle / köy
  adres: { type: String, trim: true },
  cks: { type: Boolean, default: false },
  // Başvuru formu ve kesin icmal (EK-1, EK-3) için
  cinsiyet: { type: String, enum: ['kadin', 'erkek', null], default: null },
  dogumTarihi: { type: Date },
  istihdam: { type: Number, min: 0 },                          // istihdam ettiği kişi sayısı         // Çiftçi Kayıt Sistemi kaydı var mı
  hayvanlar: { type: mongoose.Schema.Types.Mixed, default: {} },  // son talepte girilen hayvan varlığı
  hayvanTarihi: { type: Date },
  isletmeler: { type: [isletmeBagiSema], default: [] },
  reddedilenIsletmeler: { type: [String], default: [] },        // otomatik eşleşmesi kaldırılanlar yeniden bağlanmaz
  aciklama: { type: String, trim: true },
  kaydeden: { type: mongoose.Schema.Types.ObjectId, ref: 'Kisi' },
  kaydedenAd: { type: String, trim: true }
}, { collection: 'ciftciler', minimize: false, timestamps: { createdAt: 'olusturulma', updatedAt: 'guncellenme' } });

ciftciSema.index({ tcKimlikNo: 1 }, { unique: true });
ciftciSema.index({ ilce: 1, adSoyad: 1 });

module.exports = mongoose.models.Ciftci || mongoose.model('Ciftci', ciftciSema);
