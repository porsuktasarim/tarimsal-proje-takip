// Proje süreci: adımlar Ayarlar › Süreç'te tanımlanır (ayar.surecAdimlari).
//
// Her adımın bir sorumlu rolü vardır (Ayarlar › Roller). Roller yetkileriyle sıralanır: bir rolün
// yetkilerinin tamamı başka bir rolde de varsa o rol üsttedir. Sorumlu rol adımı "yapıldı" olarak
// işaretler; sorumlunun üstünde rol varsa adımı en üstteki rol onaylar (ör. Proje Yürütücüsü yapar,
// Proje Koordinatörü onaylar). En üstteki rol sorumluysa adım tek aşamalıdır.
// Onay, sorumlu kısmı bitmeden verilemez; onaylanmış adımı sorumlu geri alamaz. Kişi hem sorumlu hem
// onaylayan rolündeyse iki kısmı birlikte işaretler; projede sorumlu rolden kimse yoksa onaylayan
// ikisini de işaretler.
// Kişinin projenin ekibinde (koordinatör/yürütücü) olması gerekir; ekip atanmamışsa rolü uyan herkes
// işaretler. Projede koordinatör olarak atanan kişi bu projede "Proje Koordinatörü", yürütücü olarak
// atanan "Proje Yürütücüsü" rolünü de taşır. Sistem Yöneticisi her adımı işaretler.
// Alt adımları olan ana adım, tüm alt adımlar tamamlanınca tamamlanmış sayılır.
//
// Proje kaydı: proje.surec[kod] = { ilce: { tamam, tarih, kisiAd } (sorumlu kısmı, onaylı adımlarda),
//   il: { ... } (tek aşamalıda sorumlu, iki aşamalıda onay), notlar: [{ metin, kisiAd, tarih }] }

// Eski kayıtlar: il / ilce / il-ilce ya da yapan dizisi → sorumlu rol
const ESKI_SORUMLU = { il: 'koordinator', ilce: 'yurutucu', 'il-ilce': 'yurutucu' };
const sorumluRolu = (a) => (Array.isArray(a.yapan) && a.yapan.length ? a.yapan[0] : (ESKI_SORUMLU[a.sorumlu] || a.sorumlu || 'koordinator'));

// Rolün üstündeki en üst rol(ler): yetkileri bu rolün yetkilerini kapsayan ve kendisi başka bir
// rolce kapsanmayan roller (Sistem Yöneticisi hariç)
function enUstRoller(kod, ayar) {
  const roller = (ayar.roller || []).filter((r) => r.kod !== 'admin');
  const yetki = (r) => new Set(r.yetkiler || []);
  const kapsar = (ust, alt) => { const u = yetki(ust); const a = yetki(alt); return u.size > a.size && [...a].every((x) => u.has(x)); };
  const ben = roller.find((r) => r.kod === kod);
  if (!ben) return [];
  const ustler = roller.filter((r) => r.kod !== kod && kapsar(r, ben));
  return ustler.filter((r) => !ustler.some((x) => x.kod !== r.kod && kapsar(x, r))).map((r) => r.kod);
}

function adimNormal(a, ayar) {
  if (a._n) return a;
  const sorumlu = sorumluRolu(a);
  return { ...a, sorumlu, yapan: [sorumlu], onaylayan: ayar ? enUstRoller(sorumlu, ayar) : (sorumlu === 'yurutucu' ? ['koordinator'] : []), _n: true };
}
const rolAdlari = (kodlar, ayar) => (kodlar || []).map((k) => (ayar.rolHaritasi[k] || {}).ad || k);
const rolRengi = (kodlar, ayar) => ((ayar.rolHaritasi[(kodlar || [])[0]] || {}).renk || 'secondary');

// Proje sayfasında gösterilebilecek durum bilgileri (Ayarlar › Süreç'te adımlara bağlanır)
const VERILER = {
  metin: 'Proje metni',
  komisyon: 'Komisyon üyeleri',
  basvuru: 'Gönderilen başvurular',
  karar: 'Karar verilen başvurular (asıl/yedek liste)',
  'odeme-yazisi': 'Ödeme yazısı',
  dekont: 'Katkı payı işlenen üreticiler (icmal)',
  sozlesme: 'Sözleşme tarihi girilenler',
  'ilce-teslim': 'İlçe teslim tutanağı',
  teslim: 'Teslim edilenler (EK-4)',
  'kesin-icmal': 'Kesin icmal (EK-3)',
  kontrol: 'Arazi kontrolleri (%50)',
  izleme: 'İzleme raporları',
  kapanis: 'Proje durumu'
};

const eslesir = (liste, id) => (liste || []).some((x) => String((x && x._id) || x) === String(id));

// Süreç bağlamı: kişinin rolü, projenin ekibinde olup olmadığı, ekipteki kişilerin rolleri
// ekipRolleri: projenin koordinatör ve yürütücülerinin sistem rolleri (dizi)
function baglam(req, proje, ekipRolleri) {
  const ben = req.ben;
  const koor = (proje.koordinatorler || []).length;
  const yur = (proje.yurutuculer || []).length;
  const koordinatorde = !!ben && eslesir(proje.koordinatorler, ben._id);
  const yurutucude = !!ben && eslesir(proje.yurutuculer, ben._id);
  // Kişinin bu projedeki rolleri: sistem rolü + ekip görevinden gelen rol
  const roller = [ben && ben.rol, koordinatorde && 'koordinator', yurutucude && 'yurutucu'].filter(Boolean);
  const ekip = [...(ekipRolleri || []), ...(koor ? ['koordinator'] : []), ...(yur ? ['yurutucu'] : [])];
  return { admin: !!req.silebilir, rol: ben && ben.rol, roller, ekipte: koordinatorde || yurutucude, ekipVar: koor + yur > 0, ekipRolleri: ekip };
}
// Kişi verilen rollerden birine uyuyor mu (ve projede çalışıyor mu)
const uyar = (b, roller) => b.admin || (b.roller.some((r) => roller.includes(r)) && (b.ekipte || !b.ekipVar));
// Bir adımda kişinin yapabilecekleri
function adimYetkisi(a, b) {
  const n = adimNormal(a);
  const onayli = n.onaylayan.length > 0;
  const onaylar = onayli && uyar(b, n.onaylayan);
  // Projede yapan rollerden kimse yoksa onaylayan iki kısmı da işaretler
  const yapanYok = b.ekipVar && !n.yapan.some((r) => b.ekipRolleri.includes(r));
  const yapar = uyar(b, n.yapan) || (onaylar && yapanYok);
  return { yapar, onaylar, ikisi: yapar && onaylar, onayli };
}

// Kişinin bu projedeki rolü
function projeRolu(req, proje) {
  const ben = req.ben;
  const admin = !!req.silebilir;
  const koordinatorAtali = (proje.koordinatorler || []).length > 0;
  const yurutucuAtali = (proje.yurutuculer || []).length > 0;
  const koordinator = admin || (ben && eslesir(proje.koordinatorler, ben._id)) || (!koordinatorAtali && req.izin('proje.yonet'));
  const yurutucu = admin || (ben && eslesir(proje.yurutuculer, ben._id)) || (!!koordinator && !yurutucuAtali);
  return { koordinator: !!koordinator, yurutucu: !!yurutucu, ikisi: !!koordinator && !!yurutucu };
}

// Eski kayıt biçimi ({ tamam, tarih, kisiAd }) il kısmı sayılır
function kayitOku(surec, kod) {
  const k = (surec && surec[kod]) || {};
  if (k.tamam !== undefined && !k.il) return { il: { tamam: k.tamam, tarih: k.tarih, kisiAd: k.kisiAd }, ilce: {}, notlar: k.notlar || [] };
  return { il: k.il || {}, ilce: k.ilce || {}, notlar: k.notlar || [] };
}

// Şablonu ağaca çevirir: ana adımlar ve alt adımları
function agac(adimlar) {
  const ana = [];
  (adimlar || []).forEach((a) => {
    if (a.alt && ana.length) ana[ana.length - 1].altlar.push({ ...a, altlar: [] });
    else ana.push({ ...a, alt: false, altlar: [] });
  });
  return ana;
}

// Bir yaprak adımın durumu
function adimDurumu(a, k) {
  const ilceGerekli = adimNormal(a).onaylayan.length > 0;   // iki aşamalı: yapan (ilce kısmı) + onay (il kısmı)
  const sorumlu = ilceGerekli ? 'onayli' : 'tek';
  const tamam = !!k.il.tamam && (!ilceGerekli || !!k.ilce.tamam);
  let bekleyen = '';
  if (!tamam) bekleyen = ilceGerekli && !k.ilce.tamam ? 'ilce' : 'il';
  return { sorumlu, ilceGerekli, tamam, bekleyen };
}

// Proje sayfası için tam görünüm: ağaç, her adımın kaydı ve durumu, sayaçlar
function gorunum(proje, ayar, b) {
  const ana = agac(ayar.surecAdimlari.map((a) => adimNormal(a, ayar)));
  let toplam = 0;
  let biten = 0;
  const isle = (a) => {
    const k = kayitOku(proje.surec, a.kod);
    const d = adimDurumu(a, k);
    toplam += 1; if (d.tamam) biten += 1;
    return {
      ...a, kayit: k, durum: d, yetki: b ? adimYetkisi(a, b) : {},
      yapanAd: rolAdlari(a.yapan, ayar).join(', '), onaylayanAd: rolAdlari(a.onaylayan, ayar).join(', '), renk: rolRengi(a.yapan, ayar)
    };
  };
  const adimlar = ana.map((a) => {
    if (!a.altlar.length) return isle(a);
    const altlar = a.altlar.map(isle);
    const k = kayitOku(proje.surec, a.kod);
    return { ...a, altlar, kayit: k, durum: { tamam: altlar.every((x) => x.durum.tamam), ust: true, biten: altlar.filter((x) => x.durum.tamam).length } };
  });
  return { adimlar, toplam, biten };
}

// Sistemdeki verilerden durum bilgisi: { veri: { metin, tamamGibi, bag } }
function ipuclari(proje, talepler) {
  const p = String(proje._id);
  const say = (f) => talepler.filter(f).length;
  const destek = talepler.filter((t) => ['desteklendi', 'teslim'].includes(t.durum));
  const kararli = say((t) => ['desteklendi', 'teslim', 'yedek', 'desteklenmedi'].includes(t.durum));
  const gonderilen = say((t) => t.durum !== 'taslak');
  const teslim = say((t) => t.durum === 'teslim');
  const sozlesme = destek.filter((t) => t.uygulama && t.uygulama.sozlesmeTarihi).length;
  const katki = destek.filter((t) => t.uygulama && t.uygulama.katkiPayiTarihi).length;
  const kontrollu = destek.filter((t) => (t.kontroller || []).length).length;
  const oran = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const izlemeler = (proje.izlemeler || []).filter((x) => !(x.pasif && x.pasif.durum === 'pasif'));
  const sonIzleme = izlemeler.map((x) => x.tarih).filter(Boolean).sort().pop();
  const ba = proje.belgeAyarlari || {};
  const metinVar = (proje.belgeler || []).length > 0;
  return {
    metin: { metin: metinVar ? 'Yüklü' : 'Yüklenmedi', tamamGibi: metinVar, bag: `/projeler/${p}#proje-metni` },
    komisyon: { metin: (ba.komisyonUyeleri || []).length ? `${ba.komisyonUyeleri.length} üye${ba.komisyonBaskani ? ', başkan girildi' : ''}` : 'Üyeler girilmedi', tamamGibi: !!(ba.komisyonUyeleri || []).length, bag: `/projeler/${p}/duzenle#formlar` },
    basvuru: { metin: `${gonderilen} başvuru gönderildi`, tamamGibi: gonderilen > 0, bag: `/talepler?proje=${p}` },
    karar: { metin: `${kararli}/${gonderilen} başvuruda karar`, tamamGibi: gonderilen > 0 && kararli === gonderilen, bag: `/belgeler/asil-yedek?proje=${p}&bicim=pdf` },
    'odeme-yazisi': { metin: `${destek.length} üretici`, bag: `/belgeler/hazirla/odeme-yazisi?proje=${p}` },
    dekont: { metin: `${katki}/${destek.length} üreticinin katkı payı işlendi`, tamamGibi: destek.length > 0 && katki === destek.length, bag: `/belgeler/katki-icmal?proje=${p}&bicim=xlsx` },
    sozlesme: { metin: `${sozlesme}/${destek.length} sözleşme tarihi girildi`, tamamGibi: destek.length > 0 && sozlesme === destek.length, bag: `/belgeler?proje=${p}` },
    'ilce-teslim': { metin: 'İlçe başına tutanak', bag: `/belgeler/ilce-teslim?proje=${p}&bicim=pdf` },
    teslim: { metin: `${teslim}/${destek.length} üreticiye teslim edildi`, tamamGibi: destek.length > 0 && teslim === destek.length, bag: `/belgeler?proje=${p}` },
    'kesin-icmal': { metin: `${teslim} üretici`, bag: `/belgeler/ek3?proje=${p}&bicim=pdf` },
    kontrol: { metin: `${kontrollu}/${destek.length} üretici kontrol edildi (%${oran(kontrollu, destek.length)})`, tamamGibi: destek.length > 0 && oran(kontrollu, destek.length) >= 50, bag: `/belgeler/kontrol-raporu?proje=${p}&bicim=pdf` },
    izleme: { metin: izlemeler.length ? `${izlemeler.length} rapor, son: ${new Date(sonIzleme).toLocaleDateString('tr-TR')}` : 'Rapor yok', bag: `/belgeler/hazirla/izleme?proje=${p}` },
    kapanis: { metin: proje.durum === 'tamamlandi' ? 'Proje durumu: tamamlandı' : '', tamamGibi: proje.durum === 'tamamlandi' }
  };
}

// İşaretleme / işaret kaldırma. taraf: 'ilce' (yapan kısmı, iki aşamalı adımda) | 'il' (tek aşamalıda
// yapan, iki aşamalıda onay). Hata metni ya da null döner.
function isaretle(proje, ayar, b, kod, taraf, deger, ek) {
  const ham = (ayar.surecAdimlari || []).find((x) => x.kod === kod);
  if (!ham) return 'Adım bulunamadı.';
  const ana = agac(ayar.surecAdimlari).find((x) => x.kod === kod);
  if (ana && ana.altlar.length) return 'Bu adım alt adımları tamamlanınca kendiliğinden tamamlanır.';
  const a = adimNormal(ham, ayar);
  const y = adimYetkisi(a, b);
  const k = kayitOku(proje.surec, kod);
  const d = adimDurumu(a, k);
  const zaman = ek.tarih || new Date();
  const kim = ek.kisiAd;
  const adlar = (l) => rolAdlari(l, ayar).join(', ');
  if (taraf === 'ilce') {
    if (!d.ilceGerekli) return 'Bu adım tek aşamalıdır.';
    if (!y.yapar) return `Bu kısmı ${adlar(a.yapan)} işaretler.`;
    if (!deger && k.il.tamam && !y.ikisi) return 'Adım onaylandığı için önce onayın kaldırılması gerekir.';
    k.ilce = deger ? { tamam: true, tarih: zaman, kisiAd: kim } : {};
    if (!deger && y.ikisi) k.il = {};
  } else if (!d.ilceGerekli) {
    if (!y.yapar) return `Bu adımı ${adlar(a.yapan)} işaretler.`;
    k.il = deger ? { tamam: true, tarih: zaman, kisiAd: kim } : {};
  } else {
    if (!y.onaylar) return `Bu adımı ${adlar(a.onaylayan)} onaylar.`;
    if (deger && !k.ilce.tamam) {
      if (!y.ikisi) return `${adlar(a.yapan)} kendi kısmını tamamlamadan bu adım onaylanamaz.`;
      k.ilce = { tamam: true, tarih: zaman, kisiAd: kim };   // hem yapan hem onaylayan: iki kısım birlikte
    }
    k.il = deger ? { tamam: true, tarih: zaman, kisiAd: kim } : {};
  }
  if (ek.not) k.notlar = [...k.notlar, { metin: ek.not, kisiAd: kim, tarih: new Date() }];
  proje.surec = { ...(proje.surec || {}), [kod]: k };
  return null;
}

// Not: adımda yapan ya da onaylayan olan, ya da projenin ekibindeki herkes
function notYazabilirMi(ayar, b, kod) {
  if (b.admin || b.ekipte) return true;
  const a = (ayar.surecAdimlari || []).find((x) => x.kod === kod);
  if (!a) return false;
  const y = adimYetkisi(adimNormal(a, ayar), b);
  return y.yapar || y.onaylar;
}

function notEkle(proje, kod, metin, kisiAd) {
  const k = kayitOku(proje.surec, kod);
  k.notlar = [...k.notlar, { metin, kisiAd, tarih: new Date() }];
  proje.surec = { ...(proje.surec || {}), [kod]: k };
}

module.exports = { VERILER, projeRolu, baglam, adimNormal, enUstRoller, adimYetkisi, gorunum, ipuclari, isaretle, notEkle, notYazabilirMi, agac, eslesir, rolAdlari };
