const mongoose = require('mongoose');
const { projeDurumlari } = require('../../config/sabitler');

// Projede dağıtılacak/desteklenecek her kalem. Ürün ve çeşit ayrı tutulur:
// ör. tür "Tohum", ürün "Mısır", çeşit "ADA".
// Normlar ve ambalaj ürün kataloğundaki (ürün + çeşit) varsayılanlardan
// kopyalanır, proje içinde değiştirilebilir; katalog sonradan değişse de
// proje etkilenmez.
const kalemSema = new mongoose.Schema({
  urunId: { type: mongoose.Schema.Types.ObjectId, ref: 'Urun' },
  tur: { type: String, required: true, trim: true },
  urun: { type: String, required: true, trim: true },
  cesit: { type: String, trim: true },
  talepBirimi: { type: String, trim: true, default: 'da' },   // talep ve parsel birimi: da, adet (fidan), m² (naylon)
  olcuBirimi: { type: String, required: true, trim: true },   // dağıtım birimi (çuval, paket, torba)
  ambalaj: {                                                  // 1 dağıtım birimi = miktar + birim
    type: new mongoose.Schema({ miktar: { type: Number, min: 0 }, birim: { type: String, trim: true } }, { _id: false }),
    default: undefined
  },
  alan: { type: Number, min: 0 },                             // hedef miktar, talep biriminde (da, adet, m²)
  normlar: { type: mongoose.Schema.Types.Mixed, default: {} },// { <kod>: { deger, birim } }
  olcuyeGore: { type: Boolean, default: false },              // özel üretim: ambalaja yuvarlanmaz, istenen ölçü kadar teslim edilir
  ozellik: { type: String, trim: true },                      // normsuz kalemlerde marka, model, teknik özellik
  toplamMiktar: { type: Number, min: 0 },                     // elle girilirse hesaplananın yerine geçer
  birimFiyat: { type: Number, min: 0 },                       // TL; fiyat birimine göre (ör. 36 TL/kg)
  fiyatBirimi: { type: String, trim: true },                  // dağıtım birimi (çuval) ya da ambalaj içeriği birimi (kg)
  aciklama: { type: String, trim: true }
}, { _id: true, minimize: false });

// İlçe bazlı hedef
const ilceHedefSema = new mongoose.Schema({
  ilce: { type: String, required: true, trim: true },
  hedefCiftci: { type: Number, min: 0 },
  hedefDekar: { type: Number, min: 0 }
}, { _id: false });

const projeSema = new mongoose.Schema({
  ad: { type: String, required: true, trim: true },
  kisaAd: { type: String, trim: true },
  birim: { type: String, required: true, trim: true },
  donem: { type: String, trim: true },
  baslangicTarihi: { type: Date },
  bitisTarihi: { type: Date },
  aciklama: { type: String, trim: true },
  durum: { type: String, enum: Object.keys(projeDurumlari), default: 'taslak' },
  kalemler: { type: [kalemSema], default: [] },
  ilceler: { type: [ilceHedefSema], default: [] },
  // Bütçe ve finansman: kalem bedellerinin çiftçi katkısı oranı, kalanı destek kaynağınca karşılanır
  finansman: {
    destekKaynagi: { type: String, trim: true },              // ör. İstanbul Valiliği
    ciftciKatkiOrani: { type: Number, min: 0, max: 100 }      // yüzde
  },
  // Çiftçi başvurularında alan sınırları (aşıldığında uyarı verilir)
  basvuru: {
    oncelikliAlan: { type: Number, min: 0 },                  // ör. 50 da'ya kadar öncelikli
    azamiAlan: { type: Number, min: 0 }                       // ör. 100 da'ya kadar değerlendirilir
  },
  // Proje ekibi (Ayarlar > Kişiler)
  koordinatorler: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Kisi' }],
  yurutuculer: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Kisi' }]
}, { collection: 'projeler', timestamps: { createdAt: 'olusturulma', updatedAt: 'guncellenme' } });

projeSema.virtual('toplamHedefDekar').get(function () {
  return this.ilceler.reduce((t, i) => t + (i.hedefDekar || 0), 0);
});

projeSema.virtual('toplamHedefCiftci').get(function () {
  return this.ilceler.reduce((t, i) => t + (i.hedefCiftci || 0), 0);
});

projeSema.index({ birim: 1, durum: 1 });

module.exports = mongoose.models.Proje || mongoose.model('Proje', projeSema);
