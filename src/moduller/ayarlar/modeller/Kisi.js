const mongoose = require('mongoose');

// Sistemi kullanan kişiler. Rol, Ayarlar > Roller ve yetkiler'de tanımlı bir
// rolün kodudur; "admin" (Sistem Yöneticisi) tek kişiye verilir.
// Şimdilik şifre yoktur; giriş ekranında kişi seçilir.

const kisiSema = new mongoose.Schema({
  adSoyad: { type: String, required: true, trim: true },
  unvan: { type: String, trim: true },
  rol: { type: String, required: true, trim: true },
  birim: { type: String, trim: true },
  ilceler: { type: [String], default: [] },   // sorumlu olduğu ilçeler (özellikle yürütücüler)
  telefon: { type: String, trim: true },
  eposta: { type: String, trim: true },
  aktif: { type: Boolean, default: true },
  aciklama: { type: String, trim: true }
}, { collection: 'kisiler', timestamps: { createdAt: 'olusturulma', updatedAt: 'guncellenme' } });

kisiSema.virtual('basHarfler').get(function () {
  return String(this.adSoyad || '')
    .split(/\s+/).filter(Boolean)
    .map((p) => p[0]).slice(0, 2).join('')
    .toLocaleUpperCase('tr');
});

module.exports = mongoose.models.Kisi || mongoose.model('Kisi', kisiSema);
