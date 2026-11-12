const path = require('path');
const express = require('express');
const mongoose = require('mongoose');

const config = require('./config');
const sabitler = require('./config/sabitler');
const yardimcilar = require('./core/yardimcilar');
const ayarlar = require('./core/ayarlar');
const { modulleriYukle } = require('./core/modulYukleyici');
const { gocleriUygula } = require('./core/gocler');
const { kimlikAraKatmani, kimlikRouter } = require('./core/kimlik');

const app = express();
const KOK = path.join(__dirname, '..');

app.set('view engine', 'ejs');
app.set('views', [path.join(__dirname, 'views'), path.join(__dirname, 'moduller')]);
app.disable('x-powered-by');

app.use(express.urlencoded({ extended: true, limit: '2mb', parameterLimit: 10000 }));
app.use(express.json({ limit: '2mb' }));

// Kurum ağında dışarıya bağımlılık olmaması için tema dosyaları yerelden sunulur.
const sabitDosya = { maxAge: '7d' };
app.use('/vendor/tabler', express.static(path.join(KOK, 'node_modules/@tabler/core/dist'), sabitDosya));
app.use('/vendor/tabler-icons', express.static(path.join(KOK, 'node_modules/@tabler/icons-webfont/dist'), sabitDosya));
app.use('/public', express.static(path.join(KOK, 'public'), sabitDosya));

app.locals.config = config;
// Sürüm alt bilgide gösterilir. CSS/JS adreslerine eklenen etiket her
// yeniden başlatmada değişir; tarayıcı eski dosyayı önbellekten kullanmaz.
app.locals.surum = require('../package.json').version;
app.locals.varlikSurumu = `${app.locals.surum}-${Date.now().toString(36)}`;
app.locals.sabitler = sabitler;
app.locals.ben = null;          // kimlik ara katmanı doldurur
app.locals.kurulumKipi = false;
app.locals.y = { ...yardimcilar, normOku: require('./moduller/ayarlar/katalog').normOku };

app.use((req, res, next) => {
  res.locals.ayar = ayarlar.getir();
  res.locals.aktifYol = req.path;
  // Menüde adresle en uzun eşleşen öğe seçili görünür.
  res.locals.aktifMenu = (app.locals.menu || [])
    .map((m) => m.yol)
    .filter((yol) => req.path === yol || req.path.startsWith(yol + '/'))
    .sort((a, b) => b.length - a.length)[0] || null;
  res.locals.bildirim = req.query.bildirim || null;
  next();
});

app.use(kimlikAraKatmani);
app.use('/kimlik', kimlikRouter);

app.get('/', (req, res) => res.redirect('/genel-bakis'));

modulleriYukle(app);

app.use((req, res) => {
  res.status(404).render('hata', { baslik: 'Sayfa bulunamadı', kod: 404, mesaj: 'Aradığınız sayfa bulunamadı.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).render('hata', {
    baslik: 'Hata', kod: err.status || 500, mesaj: err.status ? err.message : 'Beklenmeyen bir hata oluştu.'
  });
});

async function baslat() {
  await mongoose.connect(config.mongoUri);
  console.log('[db] MongoDB bağlantısı kuruldu');
  await ayarlar.yukle();
  await gocleriUygula();
  await ayarlar.yukle();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`[http] ${config.uygulamaAdi} ${config.port} portunda çalışıyor`);
  });
}

if (require.main === module) {
  baslat().catch((e) => {
    console.error('[başlatma] ', e.message);
    process.exit(1);
  });
}

module.exports = { app, baslat };
