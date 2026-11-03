const fs = require('fs');
const path = require('path');

// src/moduller altındaki her klasör bir modüldür. Modül klasöründeki
// index.js şu yapıyı dışa aktarır:
//   { slug, ad, sira, menu: [{ ad, yol, ikon }], router }
// Yeni modül eklemek için klasörü oluşturmak yeterlidir; menüye ve
// yönlendirmeye kendiliğinden eklenir.

const MODUL_KLASORU = path.join(__dirname, '..', 'moduller');

function modulleriYukle(app) {
  const moduller = fs.readdirSync(MODUL_KLASORU, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(MODUL_KLASORU, d.name, 'index.js')))
    .map((d) => require(path.join(MODUL_KLASORU, d.name, 'index.js')))
    .filter((m) => m.aktif !== false)
    .sort((a, b) => (a.sira || 99) - (b.sira || 99));

  const menu = [];
  for (const modul of moduller) {
    if (modul.router) app.use('/' + modul.slug, modul.router);
    for (const oge of modul.menu || []) menu.push({ ...oge, modul: modul.slug });
    console.log(`[modül] ${modul.ad} yüklendi (/${modul.slug})`);
  }

  app.locals.menu = menu;
  app.locals.moduller = moduller.map((m) => ({ slug: m.slug, ad: m.ad }));
  return moduller;
}

module.exports = { modulleriYukle };
