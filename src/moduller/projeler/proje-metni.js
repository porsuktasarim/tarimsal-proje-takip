// Proje metni (PDF / Word): yükleme yetkisi, dosya denetimi ve kayıt.
//
// - Yalnızca Sistem Yöneticisi ve projenin koordinatörü yükler. Projede koordinatör
//   atanmamışsa "Proje Koordinatörü" rolündeki kişiler yükleyebilir.
// - Kabul edilen biçimler: PDF ve Word (.docx). Eski .doc biçimi tarayıcıda
//   gösterilemediği için kabul edilmez; .docx ya da PDF olarak kaydedilmelidir.
// - Değerlendirme, proje metni yüklenmeden yapılamaz (metinVarMi).

const multer = require('multer');
const path = require('path');
const dosyalar = require('../../core/dosyalar');

const AZAMI_BOYUT = 30 * 1024 * 1024;
const yukleyici = multer({ storage: multer.memoryStorage(), limits: { fileSize: AZAMI_BOYUT, files: 1 } });

// Proje formu çok parçalı (dosyalı) gönderildiğinde gövdeyi ve dosyayı okur; boyut
// aşımında hatayı req.dosyaHatasi olarak bırakır, isteği düşürmez.
function formYukleyici(req, res, next) {
  yukleyici.single('projeMetni')(req, res, (e) => {
    if (e) req.dosyaHatasi = e.code === 'LIMIT_FILE_SIZE' ? 'Proje metni en fazla 30 MB olabilir.' : `Dosya okunamadı: ${e.message}`;
    next();
  });
}

const metinVarMi = (proje) => !!(proje && proje.belgeler && proje.belgeler.length);

function yukleyebilirMi(ben, proje, adminVar) {
  if (!adminVar) return true;                                   // ilk kurulum
  if (!ben) return false;
  if (ben.rol === 'admin') return true;
  const koordinatorler = (proje && proje.koordinatorler) || [];
  if (koordinatorler.length) return koordinatorler.some((k) => String(k._id || k) === String(ben._id));
  return ben.rol === 'koordinator';
}

// Dosyanın türü: uzantı ve ilk baytlarla denetlenir
function turBul(dosya) {
  const uzanti = path.extname(dosya.originalname || '').toLowerCase();
  const bas = dosya.buffer.subarray(0, 4).toString('latin1');
  if (uzanti === '.pdf' && bas.startsWith('%PDF')) return 'pdf';
  if (uzanti === '.docx' && bas.startsWith('PK')) return 'docx';
  return null;
}

// Dosyayı kaydeder ve projeye yeni sürüm olarak ekler (projeyi kaydetmez). Hata metni ya da null döner.
async function ekle(proje, dosya, ben) {
  if (!dosya || !dosya.buffer || !dosya.buffer.length) return 'Dosya seçilmelidir.';
  const ad = Buffer.from(dosya.originalname || 'proje', 'latin1').toString('utf8');
  if (/\.doc$/i.test(ad)) return 'Eski Word (.doc) biçimi tarayıcıda gösterilemez; dosya Word\'de .docx ya da PDF olarak kaydedilip yüklenmelidir.';
  const tur = turBul(dosya);
  if (!tur) return 'Yalnızca PDF ve Word (.docx) dosyaları yüklenebilir.';
  const icerikTuru = tur === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const dosyaId = await dosyalar.kaydet(dosya.buffer, ad, icerikTuru, { tur: 'proje-metni', projeId: String(proje._id) });
  proje.belgeler.push({
    dosyaId, ad, tur, boyut: dosya.buffer.length,
    yukleyen: ben ? ben._id : undefined, yukleyenAd: ben ? ben.adSoyad : undefined, tarih: new Date()
  });
  return null;
}

module.exports = { formYukleyici, yukleyici, metinVarMi, yukleyebilirMi, ekle, AZAMI_BOYUT };
