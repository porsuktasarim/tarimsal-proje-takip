module.exports = {
  uygulamaAdi: 'Tarımsal Proje Takip Sistemi',
  kurum: 'İstanbul İl Tarım ve Orman Müdürlüğü',
  il: 'İstanbul',
  port: parseInt(process.env.PORT, 10) || 1763,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/tpts',
  varsayilanTema: 'light'
};
