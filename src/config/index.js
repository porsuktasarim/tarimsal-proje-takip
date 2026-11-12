// Ortam ayarları. Kurum adı, il, birimler vb. Ayarlar sayfasından yönetilir.
module.exports = {
  uygulamaAdi: 'Tarımsal Proje Takip Sistemi',
  port: parseInt(process.env.PORT, 10) || 1763,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/tpts',
  varsayilanTema: 'light'
};
