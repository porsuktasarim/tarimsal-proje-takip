// Koordinatörün süreç listesi: TAKE uygulama talimatı ve il müdürlüğü yazışmalarına göre
// bir projenin başından sonuna adımları. Her adım elle işaretlenir (tarih, not, kim);
// yanında sistemdeki verilerden çıkan durum ipucu ve ilgili form bağlantısı gösterilir.

const ADIMLAR = [
  { kod: 'metin', ad: 'Proje metni yüklendi', aciklama: 'Değerlendirme için zorunludur.' },
  { kod: 'komisyon', ad: 'İl proje uygulama komisyonu oluşturuldu', aciklama: 'İl müdürünün onayıyla (talimat md. 4/e); üyeler proje formunun Formlar bölümüne yazılır.' },
  { kod: 'basvuru', ad: 'Üretici başvuruları alındı (EK-1)', aciklama: 'İlçe müdürlüklerince başvuru formları toplanır.' },
  { kod: 'karar', ad: 'Başvurular değerlendirildi; asıl ve yedek listeler onaylandı', aciklama: 'İlçe proje uygulama birimi listeleri hazırlar, il komisyonu onaylar.' },
  { kod: 'odeme-yazisi', ad: 'Çiftçi talepleri ve katkı payı ödemesi yazısı ilçelere gönderildi', aciklama: 'Torba fiyatı, katkı payı, hesap, dekont kuralı ve son tarih.' },
  { kod: 'dekont', ad: 'Katkı payı dekontları ve icmal listeleri ilçelerden alındı', aciklama: 'Alfabetik icmal (Excel ve imzalı PDF) ve aynı sırada taranmış dekontlar.' },
  { kod: 'sozlesme', ad: 'Hibe desteği sözleşmeleri imzalandı (EK-2)' },
  { kod: 'ilce-teslim', ad: 'Girdi yükleniciden ilçelere teslim edildi', aciklama: 'İlçe teslim tutanakları.' },
  { kod: 'teslim', ad: 'Girdi üreticilere teslim edildi (EK-4)' },
  { kod: 'kontrol', ad: 'Arazi kontrolleri yapıldı (EK-5, kontrol raporu)', aciklama: 'Üreticilerin en az %50\'si kontrol edilir.' },
  { kod: 'izleme', ad: 'Proje izleme formları düzenlendi', aciklama: 'En az ayda bir; imzalı taramalar yüklenir.' },
  { kod: 'kesin-icmal', ad: 'Kesin icmal (EK-3) düzenlendi ve gönderildi', aciklama: 'Ödemeye esas icmal; komisyon imzalı.' },
  { kod: 'kapanis', ad: 'Proje tamamlandı; sonuç raporu hazırlandı' }
];

// Sistemdeki verilerden durum ipuçları: { kod: { metin, tamamGibi, bag } }
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
  const izlemeler = proje.izlemeler || [];
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
    kontrol: { metin: `${kontrollu}/${destek.length} üretici kontrol edildi (%${oran(kontrollu, destek.length)})`, tamamGibi: destek.length > 0 && oran(kontrollu, destek.length) >= 50, bag: `/belgeler/kontrol-raporu?proje=${p}&bicim=pdf` },
    izleme: { metin: izlemeler.length ? `${izlemeler.length} rapor, son: ${new Date(sonIzleme).toLocaleDateString('tr-TR')}` : 'Rapor yok', bag: `/belgeler/hazirla/izleme?proje=${p}` },
    'kesin-icmal': { metin: `${destek.length} üretici`, bag: `/belgeler/ek3?proje=${p}&bicim=pdf` },
    kapanis: { metin: proje.durum === 'tamamlandi' ? 'Proje durumu: tamamlandı' : '', tamamGibi: proje.durum === 'tamamlandi' }
  };
}

module.exports = { ADIMLAR, ipuclari };
