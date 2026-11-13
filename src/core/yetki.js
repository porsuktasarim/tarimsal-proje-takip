const { tumYetkiler } = require('../config/sabitler');

// Yetkiler ve ilçe kuralları.
//
// - Sistem Yöneticisi (rol kodu "admin") tüm yetkilere sahiptir; tek kişiye verilir.
// - Diğer roller Ayarlar > Roller'de işaretlenen yetkilere sahiptir.
// - Henüz Sistem Yöneticisi atanmamışsa (ilk kurulum) herkes tüm yetkilere
//   sahiptir ve üst kısımda uyarı gösterilir.
// - Kayıt silme (proje, talep, çiftçi, görev, kişi, rol, ürün, liste değerleri)
//   yalnızca Sistem Yöneticisi tarafından yapılır.
// - Rolü "ilçe kısıtlı" olan kişiler yalnızca sorumlu oldukları ilçelerin
//   çiftçisini ve talebini girer.
//
// Şifreli giriş olmadığı için bunlar bir güvenlik önlemi değil, iş kuralıdır.

function kisiYetkileri(ben, ayar, adminVar) {
  if (!adminVar) return new Set(tumYetkiler);
  if (!ben) return new Set();
  if (ben.rol === 'admin') return new Set(tumYetkiler);
  const rol = ayar.rolHaritasi[ben.rol];
  return new Set(rol ? rol.yetkiler : []);
}

// res.locals.izin('talep.gir') ya da izin(['ayar.genel', 'ayar.katalog']) (herhangi biri)
// Kayıt silme yalnızca Sistem Yöneticisinin işidir (ilk kurulumda, yönetici atanana kadar herkes).
function silebilirMi(ben, adminVar) {
  return !adminVar || !!(ben && ben.rol === 'admin');
}

function yetkiAraKatmani(req, res, next) {
  const yetkiler = kisiYetkileri(req.ben, res.locals.ayar, res.locals.adminVar);
  req.silebilir = silebilirMi(req.ben, res.locals.adminVar);
  res.locals.silebilir = req.silebilir;
  // Tüm modüllerde .../sil istekleri yalnızca Sistem Yöneticisine açıktır.
  if (req.method === 'POST' && /\/sil$/.test(req.path) && !req.silebilir) {
    return res.status(403).render('hata', {
      baslik: 'Yetkiniz yok', kod: 403, mesaj: 'Kayıtları yalnızca Sistem Yöneticisi silebilir.'
    });
  }
  const izin = (k) => (Array.isArray(k) ? k.some((x) => yetkiler.has(x)) : yetkiler.has(k));
  req.izin = izin;
  res.locals.izin = izin;
  res.locals.yetkiler = yetkiler;
  next();
}

function yetkisizSayfa(res) {
  return res.status(403).render('hata', {
    baslik: 'Yetkiniz yok', kod: 403, mesaj: 'Bu sayfa ya da işlem için rolünüze yetki verilmemiş. Gerekirse Sistem Yöneticisine başvurunuz.'
  });
}

// Rota ara katmanı: verilen yetkilerden biri gerekir
const yetkiGerekli = (...kodlar) => (req, res, next) => (req.izin && req.izin(kodlar.flat()) ? next() : yetkisizSayfa(res));

function ilceKisitliMi(ben, ayar) {
  if (!ben || ben.rol === 'admin') return false;
  const rol = ayar.rolHaritasi[ben.rol];
  return !!(rol && rol.ilceKisitli && ben.ilceler && ben.ilceler.length);
}

function calisilanIlceler(ben, ayar) {
  return ilceKisitliMi(ben, ayar) ? ben.ilceler.slice() : ayar.ilceler.slice();
}

module.exports = { silebilirMi, kisiYetkileri, yetkiAraKatmani, yetkiGerekli, yetkisizSayfa, ilceKisitliMi, calisilanIlceler };
