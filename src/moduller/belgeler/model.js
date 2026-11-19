const mongoose = require('mongoose');

// İlçe Tarım ve Orman Müdürlüğünün imza yetkilisi (hibe desteği sözleşmesi, EK-2).
// İlçe sorumlusu (ilçesi kendisine bağlı kişi), genel ayar yetkisi olan ya da Sistem
// Yöneticisi düzenler; çıktı alınırken ayrıca elle yazılabilir.
const ilceYetkilisiSema = new mongoose.Schema({
  ilce: { type: String, required: true, trim: true, unique: true },
  ad: { type: String, trim: true },
  unvan: { type: String, trim: true },
  guncelleyenAd: { type: String, trim: true }
}, { collection: 'ilce_yetkilileri', timestamps: { createdAt: 'olusturulma', updatedAt: 'guncellenme' } });

module.exports = mongoose.models.IlceYetkilisi || mongoose.model('IlceYetkilisi', ilceYetkilisiSema);
