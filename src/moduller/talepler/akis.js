// Başvuru akışı: aşama geçişleri, değişiklikler ve geçmiş kaydı.
//
//   taslak ──gönder──▶ gonderildi ──teslim al──▶ incelemede ◀──gönder (not)── yurutucude
//                          │                        │  ▲                         ▲
//                          └──────geri gönder───────┼──┼─────────────────────────┘
//                                                   │  └── kararı geri al
//                                                   ▼
//                                desteklendi | yedek | desteklenmedi ──▶ teslim (desteklendi'den)
//
// - Yürütücü (talep.gir) taslağı düzenler, gönderir; geri gönderilen başvuruya yalnızca not
//   düşüp yeniden gönderir.
// - Değerlendirici (talep.degerlendir) teslim alır, değer değiştirir, not düşer, yürütücüye
//   geri gönderir ve karar verir.
// - Her işlem geçmişe yazılır; geçmiş ve notlar değiştirilmez, silinmez.

const { talepDurumlari } = require('../../config/sabitler');

const KARARLAR = ['desteklendi', 'yedek', 'desteklenmedi'];

const ISLEMLER = {
  gonder: {
    ad: 'Koordinatöre gönder', ikon: 'ti-send', renk: 'primary', tur: 'gonderme', yetki: 'talep.gir', ilce: true,
    kimden: ['taslak', 'yurutucude'],
    hedef: (t) => (t.durum === 'taslak' ? 'gonderildi' : 'incelemede'),
    notZorunlu: (t) => t.durum === 'yurutucude',
    notEtiket: 'Yürütücü görüşü'
  },
  teslimAl: { ad: 'Teslim al', ikon: 'ti-inbox', renk: 'primary', tur: 'teslim_alma', yetki: 'talep.degerlendir', kimden: ['gonderildi'], hedef: () => 'incelemede' },
  geriGonder: {
    ad: 'Yürütücüye gönder', ikon: 'ti-arrow-back-up', renk: 'orange', tur: 'geri_gonderme', yetki: 'talep.degerlendir',
    kimden: ['gonderildi', 'incelemede'], hedef: () => 'yurutucude', notZorunlu: () => true, notEtiket: 'Yürütücüden istenen'
  },
  desteklendi: { ad: 'Desteklensin', ikon: 'ti-circle-check', renk: 'green', tur: 'karar', yetki: 'talep.degerlendir', kimden: ['incelemede', 'yedek', 'desteklenmedi'], hedef: () => 'desteklendi', karar: true },
  yedek: { ad: 'Yedeğe al', ikon: 'ti-hourglass', renk: 'yellow', tur: 'karar', yetki: 'talep.degerlendir', kimden: ['incelemede', 'desteklendi', 'desteklenmedi'], hedef: () => 'yedek', karar: true },
  desteklenmedi: {
    ad: 'Desteklenmesin', ikon: 'ti-circle-x', renk: 'red', tur: 'karar', yetki: 'talep.degerlendir',
    kimden: ['incelemede', 'desteklendi', 'yedek'], hedef: () => 'desteklenmedi', karar: true, notZorunlu: () => true, notEtiket: 'Gerekçe'
  },
  kararGeriAl: {
    ad: 'Kararı geri al', ikon: 'ti-arrow-back', renk: 'secondary', tur: 'karar_geri_alma', yetki: 'talep.degerlendir',
    kimden: KARARLAR, hedef: () => 'incelemede', notZorunlu: () => true, notEtiket: 'Gerekçe'
  },
  teslimEt: { ad: 'Teslim edildi', ikon: 'ti-truck-delivery', renk: 'teal', tur: 'teslim', yetki: 'talep.degerlendir', kimden: ['desteklendi'], hedef: () => 'teslim' },
  teslimGeriAl: {
    ad: 'Teslimi geri al', ikon: 'ti-arrow-back', renk: 'secondary', tur: 'teslim_geri_alma', yetki: 'talep.degerlendir',
    kimden: ['teslim'], hedef: () => 'desteklendi', notZorunlu: () => true, notEtiket: 'Gerekçe'
  },
  not: { ad: 'Not ekle', ikon: 'ti-message-plus', renk: 'secondary', tur: 'not', yetki: ['talep.gir', 'talep.degerlendir'], ilce: 'gir', kimden: null, hedef: (t) => t.durum, notZorunlu: () => true, notEtiket: 'Not' }
};

const TUR_ADLARI = {
  olusturma: 'Başvuru girildi', gonderme: 'Gönderildi', teslim_alma: 'Teslim alındı', degisiklik: 'Değer değiştirildi',
  not: 'Not', geri_gonderme: 'Yürütücüye gönderildi', karar: 'Karar', karar_geri_alma: 'Karar geri alındı',
  teslim: 'Teslim edildi', teslim_geri_alma: 'Teslim geri alındı', duzenleme: 'Başvuru formu düzenlendi'
};

const metin = (v) => (v === undefined || v === null ? '' : String(v).trim());

function kisiBilgisi(ben, ayar) {
  if (!ben) return {};
  return { kisi: ben._id, kisiAd: ben.adSoyad, rolAd: (ayar.rolAdlari && ayar.rolAdlari[ben.rol]) || ben.rol };
}

// İlçe kısıtlı yürütücü yalnızca kendi ilçesinin başvurusunda işlem yapar.
function ilceUygunMu(talep, ben, kisitli) {
  return !kisitli || (ben && (ben.ilceler || []).includes(talep.ilce));
}

// İşlemin bu kişi ve bu başvuru için yapılabilirliği; yapılamıyorsa gerekçe metni
function engel(kod, talep, { izin, ben, kisitli }) {
  const t = ISLEMLER[kod];
  if (!t) return 'Tanınmayan işlem.';
  if (t.kimden && !t.kimden.includes(talep.durum)) return `"${talepDurumlari[talep.durum].ad}" aşamasındaki başvuruda "${t.ad}" yapılamaz.`;
  const yetkiler = [].concat(t.yetki);
  if (!yetkiler.some((y) => izin(y))) return 'Bu işlem için yetkiniz yok.';
  // Not: değerlendirici her ilçede, yürütücü yalnızca kendi ilçesinde
  const ilceGerek = t.ilce === true || (t.ilce === 'gir' && !izin('talep.degerlendir'));
  if (ilceGerek && !ilceUygunMu(talep, ben, kisitli)) return `${talep.ilce} ilçesinin başvurusunda işlem yapma yetkiniz yok.`;
  return null;
}

function kullanilabilirIslemler(talep, baglam) {
  return Object.keys(ISLEMLER)
    .filter((k) => !engel(k, talep, baglam))
    .map((k) => {
      const t = ISLEMLER[k];
      return { kod: k, ad: t.ad, ikon: t.ikon, renk: t.renk, notZorunlu: t.notZorunlu ? t.notZorunlu(talep) : false, notEtiket: t.notEtiket || 'Not', karar: !!t.karar };
    });
}

// Başvuru verisinin (talep miktarları, hayvanlar) geçerli hâli
const anlik = (talep) => ({
  talepKalemleri: (talep.talepKalemleri || []).map((x) => ({ kalemId: String(x.kalemId), miktar: x.miktar })),
  hayvanlar: { ...(talep.hayvanlar || {}) }
});

// İşlemi uygular (kaydetmez). { hata } ya da { tamam: true }
function uygula(talep, kod, { not, ben, ayar, izin, kisitli }) {
  const e = engel(kod, talep, { izin, ben, kisitli });
  if (e) return { hata: e };
  const t = ISLEMLER[kod];
  const n = metin(not);
  if (t.notZorunlu && t.notZorunlu(talep) && !n) return { hata: `${t.notEtiket || 'Not'} yazılmalıdır.` };
  const onceki = talep.durum;
  const yeni = t.hedef(talep);
  if (kod === 'gonder' && onceki === 'taslak' && !(talep.basvuru && talep.basvuru.tarih)) {
    talep.basvuru = { tarih: new Date(), ...anlik(talep) };
  }
  talep.durum = yeni;
  if (t.karar) talep.karar = { sonuc: yeni, gerekce: n || undefined, tarih: new Date(), kisiAd: ben ? ben.adSoyad : undefined };
  if (kod === 'kararGeriAl') talep.karar = undefined;
  talep.gecmis.push({ ...kisiBilgisi(ben, ayar), tur: t.tur, onceki: onceki !== yeni ? onceki : undefined, durum: yeni, not: n || undefined });
  return { tamam: true };
}

// Değer farkları: talep edilen miktarlar ve hayvan sayıları
function farklar(eski, yeni, proje, ayar) {
  const sonuc = [];
  const em = new Map((eski.talepKalemleri || []).map((x) => [String(x.kalemId), x.miktar]));
  const ym = new Map((yeni.talepKalemleri || []).map((x) => [String(x.kalemId), x.miktar]));
  proje.kalemler.forEach((k) => {
    const id = String(k._id);
    const a = em.has(id) ? em.get(id) : null;
    const b = ym.has(id) ? ym.get(id) : null;
    if ((a || 0) !== (b || 0)) sonuc.push({ alan: `talep:${id}`, ad: k.urun + (k.cesit ? ' · ' + k.cesit : ''), eski: a, yeni: b, birim: k.talepBirimi || 'da' });
  });
  (ayar.hayvanTurleri || []).forEach((h) => {
    const a = eski.hayvanlar && eski.hayvanlar[h.kod] != null ? eski.hayvanlar[h.kod] : null;
    const b = yeni.hayvanlar && yeni.hayvanlar[h.kod] != null ? yeni.hayvanlar[h.kod] : null;
    if ((a || 0) !== (b || 0)) sonuc.push({ alan: `hayvan:${h.kod}`, ad: h.ad, eski: a, yeni: b, birim: h.birim });
  });
  return sonuc;
}

// Değerlendirmede değer değişikliği. Eski değerler geçmişte kalır, yenisi geçerli olur.
// Miktar düşürülüyorsa gerekçe zorunludur.
function degistir(talep, proje, { talepKalemleri, hayvanlar, not }, { ben, ayar, izin }) {
  if (!izin('talep.degerlendir')) return { hata: 'Bu işlem için yetkiniz yok.' };
  if (talep.durum !== 'incelemede') return { hata: 'Değerler yalnızca incelemedeki başvuruda değiştirilebilir; önce başvuru teslim alınmalıdır.' };
  const eski = anlik(talep);
  const yeni = { talepKalemleri: talepKalemleri.filter((x) => x.miktar > 0), hayvanlar };
  const d = farklar(eski, yeni, proje, ayar);
  const n = metin(not);
  if (!d.length && !n) return { hata: 'Değişiklik yapılmadı.' };
  if (d.some((x) => x.alan.startsWith('talep:') && (x.yeni || 0) < (x.eski || 0)) && !n) {
    return { hata: 'Talep edilen miktar düşürülürken gerekçe yazılmalıdır.' };
  }
  if (!yeni.talepKalemleri.length && !(talep.satirlar || []).length) return { hata: 'En az bir kalem için miktar kalmalıdır.' };
  talep.talepKalemleri = yeni.talepKalemleri;
  talep.hayvanlar = yeni.hayvanlar;
  talep.markModified('hayvanlar');
  talep.gecmis.push({ ...kisiBilgisi(ben, ayar), tur: d.length ? 'degisiklik' : 'not', durum: talep.durum, not: n || undefined, degisiklikler: d });
  return { tamam: true, farklar: d };
}

module.exports = { ISLEMLER, TUR_ADLARI, KARARLAR, engel, kullanilabilirIslemler, uygula, degistir, farklar, anlik, kisiBilgisi };
