/**
 * model.js — Mera İzleme Sistemi (misweb) BBHB modülünden alınmıştır.
 *
 * Her hesaplama YENI ve DEGISMEZ bir kayit olusturur. Her kayit tek bir
 * (il, ilce, mahalle) bolumu tasir (misweb'de oldugu gibi coklu yerlesim
 * ayri kayitlara bolunur).
 *
 * Tarımsal Proje Takip Sistemi eklemeleri: isletmeci sonucunda T.C. kimlik
 * no (varsa), kaydi olusturan kisinin adi.
 */

const mongoose = require('mongoose');

const detaySchema = new mongoose.Schema({
  grup: { type: String, required: true },
  kategori: { type: String, required: true },
  adet: { type: Number, required: true, min: 0 },
  katsayi: { type: Number, required: true },
  bbhb: { type: Number, required: true }
}, { _id: false });

const isletmeciSonucSchema = new mongoose.Schema({
  isletmeciId: { type: String, required: true },     // Türkvet: "Bulunduğu İşletme" (TR kodu); manuelde işletme no ya da üretilen kod
  isletmeciAdi: { type: String, required: true },
  tcKimlikNo: { type: String },
  detaylar: { type: [detaySchema], default: [] },
  isletmeciToplamBBHB: { type: Number, required: true }
}, { _id: false });

const bolumSchema = new mongoose.Schema({
  il: { type: String, required: true },
  ilce: { type: String, required: true },
  mahalle: { type: String },
  isletmeciSonuclari: { type: [isletmeciSonucSchema], default: [] },
  bolumToplamBBHB: { type: Number, required: true }
}, { _id: false });

const bbhbSonucSchema = new mongoose.Schema({
  kaynakTipi: { type: String, enum: ['manuel', 'turkvet'], required: true },
  kaynakDosyalar: { type: [String], default: [] },
  // Yaş hesabının referans tarihi: kaydedildiği ayın 1. günü (rapor tarihi değil)
  hesaplamaTarihi: { type: Date, required: true },
  bolumler: { type: [bolumSchema], default: [] },
  genelToplamBBHB: { type: Number, required: true },
  kuralSetiVersiyonu: { type: String, required: true },
  olusturanKullaniciId: { type: String },
  olusturanAd: { type: String },
  durum: { type: String, enum: ['aktif', 'arsiv'], default: 'aktif' }
}, { collection: 'bbhb_sonuclari', timestamps: true });

bbhbSonucSchema.index({ 'bolumler.il': 1, 'bolumler.ilce': 1, 'bolumler.mahalle': 1, durum: 1 });
bbhbSonucSchema.index({ 'bolumler.isletmeciSonuclari.isletmeciId': 1 });

module.exports = mongoose.models.BbhbSonuc || mongoose.model('BbhbSonuc', bbhbSonucSchema);
