// Proje süreci: adımlar Ayarlar › Süreç'te tanımlanır (ayar.surecAdimlari).
//
// Sorumluluk:
//   il       koordinatörün işi; koordinatör işaretler
//   ilce     yürütücünün (ilçe) işi; yürütücü "yapıldı" der, koordinatör onaylar
//   il-ilce  ikisinin de işi; önce yürütücü kendi kısmını, sonra koordinatör kendi kısmını işaretler
// Koordinatör, yürütücü kısmı tamamlanmadan onaylayamaz. Kişi hem koordinatör hem yürütücüyse
// (ya da projeye yürütücü atanmamışsa) iki kısmı birlikte işaretleyebilir.
// Alt adımları olan ana adım, tüm alt adımlar tamamlanınca tamamlanmış sayılır.
//
// Proje kaydı: proje.surec[kod] = { ilce: { tamam, tarih, kisiAd }, il: { ... }, notlar: [{ metin, kisiAd, tarih }] }

const SORUMLULAR = {
  il: { ad: 'İl', uzun: 'Koordinatör (il)', renk: 'blue' },
  ilce: { ad: 'İlçe', uzun: 'Yürütücü (ilçe); koordinatör onaylar', renk: 'green' },
  'il-ilce': { ad: 'İl-İlçe', uzun: 'Yürütücü ve koordinatör (önce ilçe, sonra il)', renk: 'purple' }
};

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
  const sorumlu = SORUMLULAR[a.sorumlu] ? a.sorumlu : 'il';
  const ilceGerekli = sorumlu !== 'il';
  const tamam = !!k.il.tamam && (!ilceGerekli || !!k.ilce.tamam);
  let bekleyen = '';
  if (!tamam) bekleyen = ilceGerekli && !k.ilce.tamam ? 'ilce' : 'il';
  return { sorumlu, ilceGerekli, tamam, bekleyen };
}

// Proje sayfası için tam görünüm: ağaç, her adımın kaydı ve durumu, sayaçlar
function gorunum(proje, ayar) {
  const ana = agac(ayar.surecAdimlari);
  let toplam = 0;
  let biten = 0;
  const isle = (a) => {
    const k = kayitOku(proje.surec, a.kod);
    const d = adimDurumu(a, k);
    toplam += 1; if (d.tamam) biten += 1;
    return { ...a, kayit: k, durum: d };
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

// İşaretleme / işaret kaldırma. taraf: 'il' | 'ilce'. Hata metni ya da null döner.
function isaretle(proje, ayar, rol, kod, taraf, deger, ek) {
  const a = (ayar.surecAdimlari || []).find((x) => x.kod === kod);
  if (!a) return 'Adım bulunamadı.';
  const ana = agac(ayar.surecAdimlari).find((x) => x.kod === kod);
  if (ana && ana.altlar.length) return 'Bu adım alt adımları tamamlanınca kendiliğinden tamamlanır.';
  const k = kayitOku(proje.surec, kod);
  const d = adimDurumu(a, k);
  const zaman = ek.tarih || new Date();
  const kim = ek.kisiAd;
  if (taraf === 'ilce') {
    if (!d.ilceGerekli) return 'Bu adım koordinatörün işidir.';
    if (!rol.yurutucu) return 'Bu kısmı projenin yürütücüsü işaretler.';
    if (!deger && k.il.tamam && !rol.ikisi) return 'Koordinatör onayladığı için önce onayın kaldırılması gerekir.';
    k.ilce = deger ? { tamam: true, tarih: zaman, kisiAd: kim } : {};
    if (!deger && rol.ikisi) k.il = {};
  } else {
    if (!rol.koordinator) return 'Bu kısmı projenin koordinatörü işaretler.';
    if (deger && d.ilceGerekli && !k.ilce.tamam) {
      if (!rol.ikisi) return 'Yürütücü kendi kısmını tamamlamadan bu adım onaylanamaz.';
      k.ilce = { tamam: true, tarih: zaman, kisiAd: kim };   // hem yürütücü hem koordinatör: iki kısım birlikte
    }
    k.il = deger ? { tamam: true, tarih: zaman, kisiAd: kim } : {};
  }
  if (ek.not) k.notlar = [...k.notlar, { metin: ek.not, kisiAd: kim, tarih: new Date() }];
  proje.surec = { ...(proje.surec || {}), [kod]: k };
  return null;
}

function notEkle(proje, kod, metin, kisiAd) {
  const k = kayitOku(proje.surec, kod);
  k.notlar = [...k.notlar, { metin, kisiAd, tarih: new Date() }];
  proje.surec = { ...(proje.surec || {}), [kod]: k };
}

module.exports = { SORUMLULAR, VERILER, projeRolu, gorunum, ipuclari, isaretle, notEkle, agac, eslesir };
