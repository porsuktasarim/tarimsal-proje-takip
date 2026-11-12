// İlçe kısıtları. Şifreli giriş olmadığı için bunlar güvenlik değil, iş
// kuralıdır: yürütücüler yalnızca sorumlu oldukları ilçelerin çiftçisini ve
// talebini girer. Koordinatör ve yöneticiler tüm ilçelerde çalışabilir.

function calisilanIlceler(ben, ayar) {
  if (ben && ben.rol === 'yurutucu' && ben.ilceler && ben.ilceler.length) return ben.ilceler.slice();
  return ayar.ilceler.slice();
}

function ilceKisitliMi(ben) {
  return !!(ben && ben.rol === 'yurutucu' && ben.ilceler && ben.ilceler.length);
}

module.exports = { calisilanIlceler, ilceKisitliMi };
