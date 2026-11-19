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
// - Rolü "proje kısıtlı" olan kişiler yalnızca koordinatörü ya da yürütücüsü
//   oldukları projeleri (ve bu projelerin başvurularını, formlarını) görür.
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

function projeKisitliMi(ben, ayar) {
  if (!ben || ben.rol === 'admin') return false;
  const rol = ayar.rolHaritasi[ben.rol];
  return !!(rol && rol.projeKisitli);
}

// İstek başına kişinin erişebildiği projeler: null = tümü, yoksa proje kimlikleri (metin)
async function projeErisimi(req, res, next) {
  try {
    req.erisilenProjeler = null;
    if (projeKisitliMi(req.ben, res.locals.ayar)) {
      const mongoose = require('mongoose');
      const projeler = await mongoose.model('Proje').find({ $or: [{ koordinatorler: req.ben._id }, { yurutuculer: req.ben._id }] }).select('_id').lean();
      req.erisilenProjeler = projeler.map((p) => String(p._id));
    }
    res.locals.erisilenProjeler = req.erisilenProjeler;
    res.locals.projeKisitli = !!req.erisilenProjeler;
    next();
  } catch (e) { next(e); }
}

// Sorgu filtresi: { _id: { $in: [...] } } ya da talepler için alan = 'projeId'
const projeFiltresi = (req, alan = '_id') => (req.erisilenProjeler ? { [alan]: { $in: req.erisilenProjeler } } : {});
const projeErisebilirMi = (req, id) => !req.erisilenProjeler || req.erisilenProjeler.includes(String((id && id._id) || id));
const projeErisimYok = (res) => res.status(403).render('hata', {
  baslik: 'Yetkiniz yok', kod: 403, mesaj: 'Bu proje size atanmamış. Rolünüz yalnızca koordinatörü ya da yürütücüsü olduğunuz projeleri görür.'
});

module.exports = { projeKisitliMi, projeErisimi, projeFiltresi, projeErisebilirMi, projeErisimYok, silebilirMi, kisiYetkileri, yetkiAraKatmani, yetkiGerekli, yetkisizSayfa, ilceKisitliMi, calisilanIlceler };
