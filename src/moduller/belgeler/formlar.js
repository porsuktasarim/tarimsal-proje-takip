// Uygulama talimatı formları (TAKE 2026/2 talimatından uyarlanmıştır):
//   EK-1 Hibe desteği başvuru formu         (başvuru başına)
//   EK-2 Hibe desteği sözleşmesi            (desteklenen başvuru başına)
//   EK-3 Kesin icmal                        (proje / ilçe)
//   EK-4 Teslim tutanağı                    (desteklenen başvuru başına)
//   EK-5 Arazi kontrol tutanağı             (saha kontrolü başına)
//   Arazi kontrol raporu                    (proje / ilçe, Excel listesi)
//   Asıl ve yedek liste                     (proje / ilçe; talimat md. 8/8)
// Her form core/belge.js belge modelini üretir; PDF, Word ve Excel aynı modelden çıkar.

const { sayi, tarih } = require('../../core/yardimcilar');
const { miktarHesabi, normsuzMu, fiyatBirimi } = require('../projeler/hesap');

const NOKTA = '……………………';
// Etiket-değer kutularında (EK-1 düzeni) kullanılan yardımcılar
const K = { kapali: true };
const deger = (metin, rs) => ({ metin: `: ${metin}`, satirBirlesik: rs });
const etiket = (metin, rs) => ({ metin, satirBirlesik: rs });
const n = (v, bos = NOKTA) => (v === undefined || v === null || v === '' ? bos : String(v));
const buyuk = (s) => String(s || '').toLocaleUpperCase('tr');
const kisaTarih = (t) => (t ? tarih(t) : '…../…../…...');
// Tamamı büyük harfle yazılmış adı metin içinde kullanmak için baş harfleri büyük yazar
const basHarfli = (s) => {
  const t = String(s || '').trim();
  if (!t || t !== buyuk(t)) return t;
  return t.toLocaleLowerCase('tr').replace(/(^|[\s(/-])(\S)/g, (_, a, b) => a + b.toLocaleUpperCase('tr'));
};

// hesap verilirse (başvuru formları) destek türü yalnızca o başvurunun kalemlerinden alınır
function ortak(proje, ayar, hesap) {
  const ba = proje.belgeAyarlari || {};
  // Destek türü kalem türlerinden (Tohum, Fidan…); Formlar bölümünde elle yazılırsa o geçer
  const kalemler = hesap && hesap.kalemler && hesap.kalemler.length ? hesap.kalemler.map((hk) => hk.kalem) : (proje.kalemler || []);
  const turler = [...new Set(kalemler.map((k) => String(k.tur || '').trim()).filter(Boolean))];
  const projeBasligi = /PROJES[İI]$/i.test(buyuk(proje.ad)) ? buyuk(proje.ad) : `${buyuk(proje.ad)} PROJESİ`;
  // Yıl ve dönem projeden: dönem adındaki yıl, yoksa başlangıç/bitiş tarihinin yılı
  const tarihYili = (t) => (t ? String(new Date(t).getFullYear()) : null);
  const yil = (String(proje.donem || '').match(/\d{4}/) || [])[0] || tarihYili(proje.baslangicTarihi) || tarihYili(proje.bitisTarihi) || String(new Date().getFullYear());
  const donemTuru = ba.donemTuru || (/güz/i.test(proje.donem || '') ? 'Güz' : (/bahar/i.test(proje.donem || '') ? 'Bahar' : ''));
  // Formlardaki program/kaynak adı: proje formundaki "Destek kaynağı" (eski kayıtlarda Formlar › program adı)
  const kaynak = String((proje.finansman && proje.finansman.destekKaynagi) || ba.programAdi || '').trim();
  const katki = proje.finansman && proje.finansman.ciftciKatkiOrani != null ? proje.finansman.ciftciKatkiOrani : null;
  return {
    ba,
    kaynak: basHarfli(kaynak),
    program: buyuk(kaynak),
    projeBasligi,
    destekTuru: ba.destekTuru || turler.join('/') || 'Tohum/Fide/Fidan',
    donemTuru,
    mudurluk: ba.mudurluk || ayar.kurum || 'İl Tarım ve Orman Müdürlüğü',
    il: ayar.il || 'İstanbul',
    yil,
    hibeOrani: katki != null ? 100 - katki : null,
    katkiOrani: katki,
    // Katkı payı hesabı: projede yazılmışsa o, yoksa Ayarlar › Genel'deki varsayılan
    hesap: ba.katkiHesabi ? { metin: ba.katkiHesabi } : (ayar.katkiHesabi && ayar.katkiHesabi.iban ? ayar.katkiHesabi : null),
    dekontKodu: ba.dekontKodu || proje.kisaAd || ''
  };
}

const ilceMudurlugu = (ilce) => (ilce ? `${ilce} İlçe Tarım ve Orman Müdürlüğü` : 'İl/İlçe Tarım ve Orman Müdürlüğü');
const adSoyadAyir = (adSoyad) => {
  const p = String(adSoyad || '').trim().split(/\s+/);
  return p.length > 1 ? { ad: p.slice(0, -1).join(' '), soyad: p[p.length - 1] } : { ad: p[0] || '', soyad: '' };
};
const bitkiTuru = (k) => (k ? `${k.urun}${k.cesit ? ' (' + k.cesit + ')' : ''}` : '');
const kalemBul = (proje, id) => proje.kalemler.find((k) => String(k._id) === String(id));
const miktarHucre = (v, birim) => (v == null ? '' : `${sayi(v)}${birim && birim !== 'da' ? ' ' + birim : ''}`);
const SULAMA = { kuru: 'Kuru', sulu: 'Sulu' };

// Arazi satırları: parseller; parsel girilmemişse kalem bazında talep
function araziSatirlari(talep, ciftci, proje, ayar, hesap) {
  if ((talep.satirlar || []).length) {
    return talep.satirlar.map((s) => {
      const k = kalemBul(proje, s.kalemId);
      // Girdi miktarı: kalemin teslim edilecek miktarı, parsellere alanları oranında bölünür
      const hk = k && hesap.kalemler.find((x) => String(x.kalem._id) === String(k._id));
      const kalemAlani = (talep.satirlar || []).filter((x) => String(x.kalemId) === String(s.kalemId)).reduce((t, x) => t + (x.miktar || 0), 0);
      let girdi;
      if (hk && hk.teslim != null && kalemAlani > 0) girdi = { v: Math.round((hk.teslim * (s.miktar || 0) * 100) / kalemAlani) / 100, b: hk.teslimBirimi };
      else {
        const m = k ? miktarHesabi(k, s.miktar, ayar, proje, null) : {};
        girdi = k && normsuzMu(k, ayar) ? { v: s.miktar, b: k.talepBirimi } : { v: m.ihtiyac, b: m.ihtiyacBirimi };
      }
      return { mahalle: s.mahalle || ciftci.mahalle || '', ilce: s.parselIlce || talep.ilce, ada: s.ada || '', parsel: s.parsel || '', kalem: k, miktar: s.miktar, birim: (k && k.talepBirimi) || 'da', sulama: s.sulama, araziDurumu: s.araziDurumu, girdi };
    });
  }
  return hesap.kalemler.map((hk) => ({
    mahalle: ciftci.mahalle || '', ilce: talep.ilce, ada: '', parsel: '', kalem: hk.kalem, miktar: hk.esasMiktari, birim: hk.talepBirimi,
    sulama: null, araziDurumu: null, girdi: { v: hk.teslim, b: hk.teslimBirimi }
  }));
}

// "800 kg tohum (Yulaf), 50 adet fidan (Ceviz)"
// Teslim miktarı içerik ve ambalajıyla: "520 kg (13 çuval)", "50.000 adet (1 torba)";
// ambalajsız kalemde yalnızca miktar: "5 adet"
function teslimIfadesi(hk) {
  const icerik = `${sayi(hk.teslim)} ${hk.teslimBirimi || ''}`.trim();
  const olcu = hk.kalem && hk.kalem.olcuBirimi;
  const ambalajli = hk.ambalaj && hk.miktar != null && olcu && String(olcu).toLocaleLowerCase('tr') !== String(hk.teslimBirimi || '').toLocaleLowerCase('tr');
  return ambalajli ? `${icerik} (${sayi(hk.miktar)} ${olcu})` : icerik;
}
function teslimMetni(hesap) {
  return hesap.kalemler.filter((hk) => hk.teslim != null)
    .map((hk) => `${teslimIfadesi(hk)} ${String(hk.kalem.tur || '').toLocaleLowerCase('tr')} (${bitkiTuru(hk.kalem)})`.replace(/\s+/g, ' '))
    .join(', ');
}
// Ürün bazında teslim edilecek miktarlar: "Yulaf: 520 kg (13 çuval)"
const urunToplamlari = (hesap) => hesap.kalemler.filter((hk) => hk.teslim != null)
  .map((hk) => `${bitkiTuru(hk.kalem)}: ${teslimIfadesi(hk)}`).join('\n');
// Satırlardaki alanların birim bazında toplamı: "25 da" ya da "25 da; 40 adet"
const alanToplami = (satirlar) => {
  const t = {};
  satirlar.forEach((s) => { if (s.miktar != null) t[s.birim] = (t[s.birim] || 0) + s.miktar; });
  return Object.entries(t).map(([b, v]) => miktarHucre(v, b === 'da' ? '' : b) + (b === 'da' && Object.keys(t).length > 1 ? ' da' : '')).join('; ');
};
const girdiHucre = (s) => (s.girdi && s.girdi.v != null ? `${sayi(s.girdi.v)} ${s.girdi.b || ''}`.trim() : '');
const teslimKisa = (hesap) => hesap.kalemler.filter((hk) => hk.teslim != null).map((hk) => `${sayi(hk.teslim)} ${hk.teslimBirimi || ''}`.trim()).join('; ');

// İmza bloğu: aynı unvanlı kişiler yan yana (satırda en çok 4), altında "İmza / Tarih"
const BOS_AD = '…………………';
function imzaBlogu(unvan, adlar, satirda = 4) {
  const liste = adlar.length ? adlar : [BOS_AD];
  const ogeler = [];
  for (let i = 0; i < liste.length; i += satirda) {
    const parca = liste.slice(i, i + satirda);
    ogeler.push({
      t: 'tablo', kenarsiz: true, hizalar: parca.map(() => 'orta'),
      satirlar: [parca.map(() => ({ metin: unvan, kalin: true, hiza: 'orta' })), parca.map((k) => ({ metin: k || BOS_AD, hiza: 'orta' })), parca.map(() => ({ metin: 'İmza / Tarih', hiza: 'orta' }))]
    });
  }
  return ogeler;
}
// İl proje uygulama komisyonu (talimat md. 4/e): üyeler üstte, başkan altta ortada
function komisyonImzalari(o) {
  const uyeler = (o.ba.komisyonUyeleri && o.ba.komisyonUyeleri.length) ? o.ba.komisyonUyeleri : [BOS_AD, BOS_AD, BOS_AD, BOS_AD];
  return [...imzaBlogu('Komisyon Üyesi', uyeler), { t: 'bosluk', yukseklik: 6 }, ...imzaBlogu('Komisyon Başkanı', [o.ba.komisyonBaskani || BOS_AD])];
}

// Kaynak girilmemişse üst başlık satırı çıkmaz
const programBasligi = (o) => (o.program ? [{ t: 'baslik', metin: o.program, boyut: 2 }] : []);

function ustBaslik(o, ek, satirlar) {
  return [
    { t: 'p', metin: ek, hiza: 'sag', kucuk: true },
    ...programBasligi(o),
    { t: 'baslik', metin: `${o.projeBasligi} KAPSAMINDA`, boyut: 3 },
    ...satirlar.map((m) => ({ t: 'baslik', metin: m, boyut: 2 }))
  ];
}

// ---------------------------------------------------------------------------
// EK-1 Başvuru formu
function ek1(v) {
  const { talep, ciftci, proje, ayar, hesap } = v;
  const o = ortak(proje, ayar, hesap);
  const kad = ciftci.cinsiyet === 'kadin' ? '(X)' : '(  )';
  const erk = ciftci.cinsiyet === 'erkek' ? '(X)' : '(  )';
  const satirlar = araziSatirlari(talep, ciftci, proje, ayar, hesap);
  return {
    ad: `EK-1 Başvuru formu — ${ciftci.adSoyad}`,
    formAdi: `Ek-1 ${o.destekTuru} Hibe Desteği Başvuru Formu`,
    ogeler: [
      ...ustBaslik(o, 'EK-1', [`${buyuk(o.destekTuru)} HİBE DESTEĞİ BAŞVURU FORMU`]),
      { t: 'bosluk', yukseklik: 4 },
      { t: 'baslik', metin: `${buyuk(ilceMudurlugu(talep.ilce))}NE`, boyut: 3 },
      { t: 'p', metin: 'Aşağıda bilgilerini vermiş olduğum kullanım hakkı tarafıma ait arazi için başvurumun kabulünü arz eder, proje kapsamında tarafıma sağlanacak olan hibe desteği karşılığında ekim/dikim ve her türlü teknik bakım işlemlerini zamanında yapacağımı, aksi takdirde aldığım desteği bila kaydı şart geri ödeyeceğimi taahhüt ederim.' },
      {
        // Yalnızca dış çerçeve; eşit iki yarı, her yarıda etiket ve ":" ile hizalı değer.
        // Sol: ad soyad (2 satır), T.C. (1), adres (6), telefon (1); sağ: cinsiyet, istihdam,
        // tarih ve kalan 7 satırlık imza alanı.
        t: 'tablo', cerceve: 'dis', dikeyHiza: 'ust', satirYuksekligi: 14, genislik: [1.3, 1.7, 1.4, 1.6],
        basliklar: [{ metin: 'Üreticinin', birlesik: 4 }],
        satirlar: (() => {
          const d = deger;
          const e = etiket;
          return [
            [e('Adı Soyadı', 2), d(ciftci.adSoyad, 2), 'Cinsiyeti', d(`${kad} Kadın   ${erk} Erkek`)],
            [K, K, 'İstihdam Ettiği Kişi Sayısı', d(n(ciftci.istihdam, '……'))],
            ['TC Kimlik Numarası', d(ciftci.tcKimlikNo), 'Tarih', d(kisaTarih((talep.basvuru && talep.basvuru.tarih) || talep.olusturulma))],
            [e('Adresi', 6), d(n([ciftci.adres, ciftci.mahalle, talep.ilce].filter(Boolean).join(', ')), 6), e('İmza', 7), d('', 7)],
            [K, K, K, K], [K, K, K, K], [K, K, K, K], [K, K, K, K], [K, K, K, K],
            ['Cep Telefonu', d(n(ciftci.telefon)), K, K]
          ];
        })()
      },
      { t: 'baslik', metin: 'Üretici Arazi Bilgileri Tablosu', boyut: 3 },
      {
        t: 'tablo', kucuk: true, genislik: [0.55, 1.5, 0.7, 0.7, 1.6, 1.2, 1.4, 0.95, 1.1, 1.2],
        hizalar: ['orta', 'sol', 'orta', 'orta', 'sol', 'sag', 'sag', 'orta', 'sag', 'sag'],
        basliklar: ['Sıra No', 'Köy/Mahalle', 'Ada No', 'Parsel No', 'Bitki Türü', 'Projeye Başvurulan Alan (da)', 'Tohum/Fide/Fidan Miktarı (Kg/Adet)', 'Sulama Durumu (Kuru/Sulu)', 'Aşı Yapılacak Ağaç Sayısı (Adet)*', 'Toplam Ekilmeyen Alan (da)**'],
        satirlar: (satirlar.length ? satirlar : [{}]).map((s, i) => [
          String(i + 1), s.mahalle || '', s.ada || '', s.parsel || '', bitkiTuru(s.kalem), miktarHucre(s.miktar, s.birim), girdiHucre(s), SULAMA[s.sulama] || '',
          s.kalem && /aşı/i.test(s.kalem.tur) ? miktarHucre(s.miktar, '') : '', i === 0 && talep.ekilmeyenAlan != null ? sayi(talep.ekilmeyenAlan) : ''
        ]),
        toplam: [{ metin: 'TOPLAM', birlesik: 5, hiza: 'orta' }, alanToplami(satirlar), { metin: urunToplamlari(hesap), hiza: 'sag' }, '',
          (() => { const a = satirlar.filter((s) => s.kalem && /aşı/i.test(s.kalem.tur)).reduce((t, s) => t + (s.miktar || 0), 0); return a ? sayi(a) : ''; })(),
          talep.ekilmeyenAlan != null ? sayi(talep.ekilmeyenAlan) : '']
      },
      { t: 'p', metin: '* Bu kısım sadece aşılama projelerinde doldurulacaktır.', kucuk: true, hiza: 'sol' },
      { t: 'p', metin: `** Bu kısma üreticinin ${o.yil} yılında toplam ekim yapmadığı/yapmayacağı alan (boş arazi miktarı) yazılacaktır.`, kucuk: true, hiza: 'sol' }
    ]
  };
}

// ---------------------------------------------------------------------------
// EK-2 Hibe desteği sözleşmesi
function ek2(v) {
  const { talep, ciftci, proje, ayar, hesap } = v;
  const o = ortak(proje, ayar, hesap);
  const mud = ilceMudurlugu(talep.ilce);
  const sec = v.secenekler || {};
  // Sözleşme tarihi çıktı alınırken girilir; girilmezse gün ve ay boş, yıl projeden
  const sozlesmeTarihi = sec.sozlesmeTarihi ? tarih(sec.sozlesmeTarihi) : `…../…../${o.yil}`;
  // İmza: ilçe müdürü (Formlar sayfasında ilçe için kayıtlı ya da çıktı alınırken yazılan)
  const yetkili = sec.yetkili || {};
  const imza = yetkili.ad ? `${yetkili.ad}\n${yetkili.unvan || 'İlçe Müdürü'}` : '……………………………\nİlçe Müdürü';
  const satirlar = araziSatirlari(talep, ciftci, proje, ayar, hesap);
  const adres = [ciftci.adres, ciftci.mahalle, talep.ilce, o.il].filter(Boolean).join(', ');
  const p = (metin) => ({ t: 'p', metin });
  const b = (metin) => ({ t: 'baslik', metin, boyut: 3, hiza: 'sol' });
  return {
    ad: `EK-2 Hibe desteği sözleşmesi — ${ciftci.adSoyad}`,
    formAdi: 'Ek-2 Hibe Desteği Sözleşmesi',
    ogeler: [
      { t: 'p', metin: 'EK-2', hiza: 'sag', kucuk: true },
      { t: 'baslik', metin: 'HİBE DESTEĞİ SÖZLEŞMESİ', boyut: 1 },
      p(`T.C. ${mud} ile ${n(adres)} adresinde mukim, ${ciftci.tcKimlikNo} T.C. No.lu ${ciftci.adSoyad} isimli üretici aşağıdaki hususlarda anlaşmışlardır:`),
      b('MADDE 1 – AMAÇ'),
      p(`1.1 Bu Sözleşmenin amacı; ${mud} tarafından yürütülen ve ${o.kaynak || NOKTA} kapsamında kaynak gönderilen ${proje.ad} ile ayni olarak ${o.destekTuru.toLocaleLowerCase('tr')} teminine esas hibe yapılmasıdır.`),
      p(`1.2 Üretici, Madde 3'de belirtilen arazilerde, belirtilen bitki tür ve çeşitlerinde, kendilerine teslim edilen ${o.destekTuru.toLocaleLowerCase('tr')} kullanmak suretiyle ${o.yil} Yılı ${o.donemTuru || 'Güz/Bahar'} döneminde tarımsal faaliyette bulunmayı kabul ve taahhüt eder.`),
      b('MADDE 2 – SÖZLEŞMENİN YÜRÜRLÜK TARİHİ VE SÜRESİ'),
      p('2.1 Bu Sözleşme her iki tarafça imzalandığı tarihte yürürlüğe girer ve ilgili ürünün ekiliş/dikilişine ait hasat bitiminde sona erer. Üretici, projenin uygulamasını zorlaştıracak veya geciktirecek her durum hakkında İl/İlçe Tarım ve Orman Müdürlüğünü derhal bilgilendirmekle mükelleftir.'),
      b('MADDE 3 – PROJENİN UYGULANMA BİÇİMİ'),
      p(`3.1 İl/İlçe Müdürlüğü, iş bu sözleşmeyi imzaladığı üreticiye belirtilen miktarda ${o.destekTuru.toLocaleLowerCase('tr')} % ${n(o.hibeOrani, '….')} hibe ile ayni olarak temin edilir ve üreticilere teslim edilir.`),
      p(`3.2 Üretici, teslim aldığı ${o.destekTuru.toLocaleLowerCase('tr')} zamanında ve tekniğine uygun olarak eker/diker, gerekli bakımlarını hasada kadar yapar.`),
      p('3.3 Üretici, üretim sürecinde İl/İlçe Müdürlüğü ilgili birimleri tarafından yapılacak her türlü kontrole, uygulamaların kayıt altına alınmasına izin verir ve izlenebilirliği tesis eder.'),
      p('3.4 Üreticiye ait proje kapsamındaki arazi ve girdi (tohum, fide, fidan vb.) bilgileri aşağıdaki şekilde belirlenmiştir.'),
      {
        t: 'tablo', kucuk: true, genislik: [0.6, 1.6, 0.8, 0.8, 1.6, 1.2, 1.6], hizalar: ['orta', 'sol', 'orta', 'orta', 'sol', 'sag', 'sag'],
        basliklar: ['Sıra No', 'Belde/Köy', 'Ada No', 'Parsel No', 'Bitki Türü', 'Ekim/Dikim Alanı (da)', 'Tohum/Fide/Fidan Miktarı (Kg/Adet)'],
        satirlar: satirlar.map((s, i) => [String(i + 1), s.mahalle, s.ada, s.parsel, bitkiTuru(s.kalem), miktarHucre(s.miktar, s.birim), girdiHucre(s)]),
        toplam: [{ metin: 'TOPLAM', birlesik: 5, hiza: 'orta' }, alanToplami(satirlar), { metin: urunToplamlari(hesap), hiza: 'sag' }]
      },
      b('MADDE 4 – MESULİYET'),
      p('4.1 Projenin uygulanması sırasında; üreticinin kendisine, çalışanlarına veya mülkiyetine gelen herhangi bir zarar dolayısı ile İl/İlçe Tarım ve Orman Müdürlüğü sorumlu tutulamaz, bu gibi zarar ile bağlantılı herhangi bir tazminat veya ödeme artışı talebini kabul etmez.'),
      p('4.2 Üretici, sebep olabileceği her türlü zarar konusunda, üçüncü taraflara karşı tek başına sorumlu olup kendisi, çalışanları, veya çalışanlardan sorumlu kişiler tarafından yapılan bir usulsüzlük veya üçüncü kişilerin haklarının çiğnenmesi nedeniyle ortaya çıkan tazminat talebi veya davalarla ilgili olarak, İl/İlçe Tarım ve Orman Müdürlüğü\'nü her türlü sorumluluktan muaf tutar.'),
      p('4.3 Üretici, arazinin mülkiyeti, ortaklık veya kiralama şartları, hisse durumu, tasarruf şekli gibi arazi kullanımına ilişkin her türlü sorumluluğun kendisinde olduğunu kabul ve taahhüt eder. Hissedarlar tarafından yapılacak bir itiraz vukuunda bu sözleşme kapsamında aldığı tüm ayni veya nakdi ödemeleri/desteklemeleri 6183 sayılı Amme Alacaklarının Tahsil Usulü Hakkındaki Kanun Hükümleri çerçevesinde geri ödemeyi taahhüt eder.'),
      p('4.4 Üretici; Proje kapsamında yapılan ödemelerden/ayni yardımlardan haksız yere yararlandığının tespit edilmesi veya hibe desteği sözleşmesinde belirtilen tohum/fide/fidanları ekip/dikmemesi, ekim/dikim sonrası gerekli bakımlarını gerçekleştirmemesi haksız yere yapılan ödeme sayılır ve İl/İlçe Tarım ve Orman Müdürlüğü\'nün yükleniciye yaptığı ödeme ve birim fiyat esas alınarak hibe teslim tarihinden tahsil tarihine kadar geçen süre için hesaplanacak yasal faizi ile birlikte 21/7/1953 tarihli ve 6183 sayılı Amme Alacaklarının Tahsil Usulü Hakkında Kanun hükümleri çerçevesinde geri alınır.'),
      b('MADDE 5 – SÖZLEŞMENİN FESHİ'),
      p('5.1 İl/İlçe Tarım ve Orman Müdürlüğü, aşağıdaki şartlardan biri veya birden fazlası oluşması durumunda herhangi bir tazminat ödemeksizin sözleşmeyi fesheder. Bu şartlar;'),
      p('a) Üretici üzerine düşen yükümlülüklerden herhangi birini yerine getirmemesi durumunda ve bu yükümlülüklere uyması gereği bir mektupla kendisine tebliğ edildikten sonra geçen on beş (15) gün içerisinde bunu yapmaması ve bunun için de geçerli bir gerekçe göstermemesi halinde,'),
      p('b) Sözleşme vasıtasıyla sağlanan her türlü ödemeler/hibelerden yararlanmak için yanlış ve eksik beyanda bulunulması,'),
      p('c) Arazi mülkiyetinin veya kullanım haklarının değişmesi halinde sözleşme feshedilir. Bu durumda Madde 4\'de belirtilen usul ve esaslar çerçevesinde yapılan ayni ödemeler/hibeler geri tahsil edilir. Ancak, İl/İlçe Tarım ve Orman Müdürlüğü tarafından uygun görülmesi durumunda, arazinin kullanım hakkına sahip yeni gerçek veya tüzel kişi, bu hibe desteği sözleşmesi çerçevesinde toplam sözleşme süresini tamamlayacağını, hibe desteği sözleşmesinde öngörülen tüm hususları yerine getireceğini taahhüt eder ve bu durum ek hibe desteği sözleşmesi ile taahhüt altına alınırsa geri tahsilat yapılmadan sözleşmeye esas uygulamalar sözleşme süresi bitimine tamamlanır.'),
      p('5.2 İl/İlçe Tarım ve Orman Müdürlüğü bu madde uyarınca sözleşmeyi feshetmeden önce, ihtiyati bir tedbir olarak önceden herhangi bir tebliğde bulunmaksızın ayni veya nakdi her türlü ödemeleri/yardımları/hibeleri askıya alabilir.'),
      b('MADDE 6 – TABİ OLUNAN YASA VE ANLAŞMAZLIKLARIN ÇÖZÜMÜ'),
      p(`6.1 Bu Sözleşme, T.C. Yasalarına tabidir. Yasal bir anlaşmazlık durumunda ${n(o.ba.mahkeme || o.il)} mahkemeleri ve/veya icra daireleri yetkilidir.`),
      p(`6.2 İş bu Sözleşme ${sozlesmeTarihi} tarihinde iki nüsha olarak hazırlanmış ve bir adedi İl/İlçe Tarım ve Orman Müdürlüğü'ne bir adedi üreticiye verilmiştir.`),
      { t: 'bosluk', yukseklik: 10 },
      {
        t: 'tablo', kenarsiz: true, genislik: [1, 1], hizalar: ['orta', 'orta'],
        satirlar: [
          [{ metin: 'Üretici', kalin: true, hiza: 'orta' }, { metin: mud, kalin: true, hiza: 'orta' }],
          [ciftci.adSoyad, imza],
          ['Tarih – İmza', 'Tarih – İmza']
        ]
      }
    ]
  };
}

// ---------------------------------------------------------------------------
// EK-3 Kesin icmal
function ek3(v) {
  const { satirlar, proje, ayar, ilce } = v;
  const o = ortak(proje, ayar, { kalemler: satirlar.flatMap((x) => x.hesap.kalemler) });
  const t = { alan: 0, islenmeyen: 0, nadas: 0, uygunOlmayan: 0, bedel: 0, destek: 0, girdi: {} };
  const satir = (s, i) => {
    const { talep, ciftci, hesap } = s;
    const as = adSoyadAyir(ciftci.adSoyad);
    const daSatirlari = (talep.satirlar || []).filter((x) => { const k = kalemBul(proje, x.kalemId); return k && (k.talepBirimi || 'da') === 'da'; });
    const alanTop = (d) => daSatirlari.filter((x) => x.araziDurumu === d).reduce((a, x) => a + (x.miktar || 0), 0);
    const sulu = daSatirlari.filter((x) => x.sulama === 'sulu').reduce((a, x) => a + x.miktar, 0);
    const kuru = daSatirlari.filter((x) => x.sulama === 'kuru').reduce((a, x) => a + x.miktar, 0);
    const alan = hesap.toplamAlan || 0;
    const r = { islenmeyen: alanTop('islenmeyen'), nadas: alanTop('nadas'), uygunOlmayan: alanTop('uygunOlmayan') };
    t.alan += alan; t.islenmeyen += r.islenmeyen; t.nadas += r.nadas; t.uygunOlmayan += r.uygunOlmayan;
    t.bedel += hesap.bedel || 0; t.destek += hesap.destek || 0;
    hesap.kalemler.forEach((hk) => { if (hk.teslim != null) t.girdi[hk.teslimBirimi || ''] = (t.girdi[hk.teslimBirimi || ''] || 0) + hk.teslim; });
    return [
      String(i + 1), `${o.il}/${talep.ilce}`, ciftci.tcKimlikNo, as.ad, as.soyad, ciftci.dogumTarihi ? tarih(ciftci.dogumTarihi) : '', ciftci.telefon || '',
      ciftci.cinsiyet === 'kadin' ? '1' : (ciftci.cinsiyet === 'erkek' ? '0' : ''), sayi(alan),
      sulu + kuru ? (sulu >= kuru ? '1' : '0') : '', r.islenmeyen ? sayi(r.islenmeyen) : '', r.nadas ? sayi(r.nadas) : '', r.uygunOlmayan ? sayi(r.uygunOlmayan) : '',
      ciftci.istihdam != null ? (ciftci.istihdam > 0 ? '1' : '0') : '', teslimKisa(hesap), sayi(hesap.bedel || 0, 2), sayi(hesap.destek || 0, 2)
    ];
  };
  const govde = satirlar.map(satir);
  return {
    ad: 'EK-3 Kesin icmal',
    formAdi: `Ek-3 Hibe ile Ayni Olarak ${o.destekTuru} Temin Edilen Üreticilere İlişkin Kesin İcmal`,
    yon: 'yatay',
    ogeler: [
      { t: 'p', metin: 'EK-3', hiza: 'sag', kucuk: true },
      ...programBasligi(o),
      { t: 'baslik', metin: `${o.projeBasligi} KAPSAMINDA`, boyut: 3 },
      { t: 'baslik', metin: `HİBE İLE AYNİ OLARAK ${buyuk(o.destekTuru)} TEMİN EDİLEN ÜRETİCİLERE İLİŞKİN KESİN İCMAL${ilce ? ' — ' + buyuk(ilce) : ''}`, boyut: 2 },
      {
        t: 'tablo', kucuk: true,
        genislik: [0.6, 1.2, 1.45, 1.1, 1.05, 1.25, 1.45, 0.8, 0.95, 0.8, 1.15, 1, 1.2, 0.95, 1.3, 1.2, 1.2],
        hizalar: ['orta', 'sol', 'orta', 'sol', 'sol', 'orta', 'orta', 'orta', 'sag', 'orta', 'sag', 'sag', 'sag', 'orta', 'sag', 'sag', 'sag'],
        basliklar: ['Sıra No', 'İli/İlçesi', 'Üretici TC Kimlik No', 'Üretici Adı', 'Üretici Soyadı', 'Doğum Tarihi', 'Cep Telefonu', 'Cinsiyet Kadın:1 Erkek:0', 'Proje Uygulama Alanı (da)', 'Sulama Durumu Sulu:1 Kuru:0', 'İşlenmeyen Arazilerde Ekiliş/Dikiliş Yapılan Alan (da)', 'Nadasta Ekiliş/Dikiliş Yapılan Alan (da)', 'İşlemeli Tarıma Uygun Olmayan Arazilerde Ekiliş/Dikiliş Yapılan Alan (da)', 'İstihdam Var:1 Yok:0', 'Teslim Edilen Girdi Miktarı/ Aşılanan Ağaç Sayısı (Kg, Adet)', 'Toplam Proje Tutarı (TL)', `%${n(o.hibeOrani, '....')} Hibe Desteği Tutarı (TL)`],
        satirlar: govde.length ? govde : [['1', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']],
        toplam: [{ metin: 'TOPLAM', birlesik: 8 }, sayi(t.alan), '', sayi(t.islenmeyen), sayi(t.nadas), sayi(t.uygunOlmayan), '', Object.entries(t.girdi).map(([b, x]) => `${sayi(x)} ${b}`).join('; '), sayi(t.bedel, 2), sayi(t.destek, 2)]
      },
      { t: 'p', metin: 'Yukarıdaki liste, başvurusu onaylanan, üretici katkı payını yatırarak hibe desteği sözleşmesi imzalayan ve proje kapsamında dağıtımı yapılan girdilerini teslim alan üreticileri göstermekte olup ödemeye esas icmaldir.', kucuk: true },
      { t: 'bosluk', yukseklik: 6 },
      ...komisyonImzalari(o)
    ]
  };
}

// ---------------------------------------------------------------------------
// EK-4 Teslim tutanağı
function ek4(v) {
  const { talep, ciftci, proje, ayar, hesap, teslimEden } = v;
  const o = ortak(proje, ayar, hesap);
  const u = talep.uygulama || {};
  return {
    ad: `EK-4 Teslim tutanağı — ${ciftci.adSoyad}`,
    formAdi: 'Ek-4 Teslim Tutanağı',
    ogeler: [
      { t: 'p', metin: 'EK-4', hiza: 'sag', kucuk: true },
      ...programBasligi(o),
      { t: 'baslik', metin: o.projeBasligi, boyut: 3 },
      { t: 'baslik', metin: 'TESLİM TUTANAĞI', boyut: 1 },
      { t: 'bosluk', yukseklik: 6 },
      { t: 'p', metin: `Proje başvuru formunda belirtmiş olduğum arazide kullanmak üzere ${teslimMetni(hesap) || '…. kg tohum / ….. adet fide / …… adet fidan / ….. adet aşılama işlemi'} teslim aldım. ${kisaTarih(u.teslimTarihi)}` },
      { t: 'bosluk', yukseklik: 6 },
      {
        // EK-1 düzeni, çerçevesiz: eşit iki yarı, ":" ile hizalı; ad soyad 2, imza 5 satır
        t: 'tablo', kenarsiz: true, dikeyHiza: 'ust', satirYuksekligi: 14, genislik: [1.1, 1.9, 1.1, 1.9],
        basliklar: [{ metin: 'Teslim Alan Üretici', birlesik: 2 }, { metin: 'Teslim Eden Yetkilinin', birlesik: 2 }],
        satirlar: [
          [etiket('Adı Soyadı', 2), deger(ciftci.adSoyad, 2), etiket('Adı Soyadı', 2), deger(n(u.teslimEdenAd || (teslimEden && teslimEden.adSoyad)), 2)],
          [K, K, K, K],
          ['TC Kimlik No', deger(ciftci.tcKimlikNo), 'Unvanı', deger(n(teslimEden && teslimEden.unvan))],
          ['Doğum Tarihi', deger(ciftci.dogumTarihi ? tarih(ciftci.dogumTarihi) : NOKTA), 'Görev Yeri', deger(ilceMudurlugu(talep.ilce))],
          [etiket('İmza', 5), deger('', 5), etiket('İmza', 5), deger('', 5)],
          [K, K, K, K], [K, K, K, K], [K, K, K, K], [K, K, K, K]
        ]
      }
    ]
  };
}

// ---------------------------------------------------------------------------
// EK-5 Arazi kontrol tutanağı (kontrol yoksa boş şablon)
function ek5(v) {
  const { talep, ciftci, proje, ayar, hesap, kontrol } = v;
  const o = ortak(proje, ayar, hesap);
  const k = kontrol || { parseller: [], kontrolEdenler: [] };
  const satirlar = araziSatirlari(talep, ciftci, proje, ayar, hesap);
  const parselBilgi = (i) => {
    const sat = (talep.satirlar || [])[i];
    return sat ? (k.parseller || []).find((p) => String(p.satirId) === String(sat._id)) : null;
  };
  const sec = (deger, evet, hayir) => (deger === true ? evet : (deger === false ? hayir : `${evet}/${hayir}`));
  const duz = (k.kontrolEdenler && k.kontrolEdenler.length ? k.kontrolEdenler : [{}, {}]).slice(0, 4);
  while (duz.length < 2) duz.push({});
  return {
    ad: `EK-5 Arazi kontrol tutanağı — ${ciftci.adSoyad}`,
    formAdi: `Ek-5 ${o.destekTuru} Hibe Desteğine Esas Arazi Kontrol Tutanağı`,
    ogeler: [
      ...ustBaslik(o, 'EK-5', [`${buyuk(o.destekTuru)} HİBE DESTEĞİNE ESAS ARAZİ KONTROL TUTANAĞI`]),
      {
        // EK-1 düzeni, çerçevesiz: eşit iki yarı, ":" ile hizalı
        t: 'tablo', kenarsiz: true, dikeyHiza: 'ust', satirYuksekligi: 14, genislik: [1.2, 1.8, 1.3, 1.7],
        basliklar: [{ metin: 'Üretici Bilgileri', birlesik: 4 }],
        satirlar: [
          [etiket('Adı Soyadı', 2), deger(ciftci.adSoyad, 2), 'İl/İlçe', deger(`${o.il}/${talep.ilce}`)],
          [K, K, etiket('Mahalle/Köy/Belde', 2), deger(n(ciftci.mahalle), 2)],
          ['T.C. Kimlik No', deger(ciftci.tcKimlikNo), K, K]
        ]
      },
      {
        t: 'tablo', kucuk: true, genislik: [0.6, 0.8, 0.8, 1.2, 1.2, 1.6, 1.6], hizalar: ['orta', 'orta', 'orta', 'sag', 'orta', 'sol', 'orta'],
        basliklar: ['Sıra No', 'Ada No', 'Parsel No', 'Ekim/Dikim/Aşılama Alanı (da)', 'Ekim/Dikim/Aşılama Tarihi', 'Bitki Türü', 'Görüşler (uygundur/uygun değildir)'],
        satirlar: satirlar.map((s, i) => {
          const pb = parselBilgi(i);
          return [String(i + 1), s.ada, s.parsel, miktarHucre(s.miktar, s.birim), pb && pb.ekimTarihi ? tarih(pb.ekimTarihi) : '', bitkiTuru(s.kalem), pb && pb.uygun != null ? (pb.uygun ? 'Uygundur' : 'Uygun değildir') : ''];
        })
      },
      { t: 'p', metin: `Yukarıda bilgileri bulunan üreticinin, mahallinde ${k.tarih ? tarih(k.tarih) + ' tarihinde ' : ''}yapılan kontrol sonucunda, ayni olarak kendisine teslim edilen ${o.destekTuru.toLocaleLowerCase('tr')};` },
      {
        t: 'liste', maddeler: [
          `Ekimini/dikimini, ekim/dikim normuna uygun olarak ${sec(k.normunaUygun, 'gerçekleştirdiği', 'gerçekleştirmediği')},`,
          `Ekimi/dikimi yapılan bitkisinin çıkışlarının %${n(k.cikisOrani, '....')} oranında gerçekleştiği${k.cikisOrani === 0 ? ' (hiç gerçekleşmediği)' : ''},`,
          `Aşılama yapılan meyve ağaçlarında / dikimi yapılan meyve fidanlarında tutma oranının %${n(k.tutmaOrani, '....')} oranında gerçekleştiği,`,
          `Meyve bahçesinde kültürel işlemlerin muntazam ${sec(k.kulturelIslemler, 'yapıldığı', 'yapılmadığı')},`,
          ...(k.ekTespit ? [k.ekTespit] : ['…………………………………………………………………………'])
        ]
      },
      { t: 'p', metin: 'tespit edilmiştir.' },
      ...(k.gorus ? [{ t: 'p', metin: `Görüşler: ${k.gorus}` }] : []),
      { t: 'bosluk', yukseklik: 6 },
      {
        sayfaSonu: true,   // elle doldurulacağı için sayfanın en altında
        // Çerçevesiz; her düzenleyen için etiket ve ":" ile hizalı değer, imzaya 3 satır
        t: 'tablo', kenarsiz: true, dikeyHiza: 'ust', satirYuksekligi: 14, kucuk: duz.length > 2,
        genislik: duz.flatMap(() => [0.9, 1.6]),
        basliklar: [{ metin: 'Düzenleyenler', birlesik: duz.length * 2 }],
        satirlar: [
          duz.flatMap((d) => ['Adı Soyadı', deger(n(d.ad))]),
          duz.flatMap((d) => ['Görevi', deger(n(d.gorev))]),
          duz.flatMap(() => ['Tarih', deger(kisaTarih(k.tarih))]),
          duz.flatMap(() => ['İmza', deger('')]),
          duz.flatMap(() => ['', '']),
          duz.flatMap(() => ['', ''])
        ]
      }
    ]
  };
}

// ---------------------------------------------------------------------------
// Arazi kontrol raporu (liste)
function kontrolRaporu(v) {
  const { satirlar, proje, ayar, ilce } = v;
  const kayitlar = [];
  satirlar.forEach((s) => (s.talep.kontroller || []).forEach((k) => kayitlar.push({ s, k })));
  kayitlar.sort((a, b) => new Date(a.k.tarih) - new Date(b.k.tarih));
  const kontrolEdilen = new Set(kayitlar.map((x) => String(x.s.talep._id))).size;
  const oran = satirlar.length ? Math.round((100 * kontrolEdilen) / satirlar.length) : 0;
  return {
    ad: 'Arazi kontrol raporu',
    formAdi: `${ortak(proje, ayar).destekTuru} Hibe Desteğine Esas Arazi Kontrol Raporu`,
    yon: 'yatay',
    ogeler: [
      { t: 'baslik', metin: `${buyuk(ortak(proje, ayar).destekTuru)} HİBE DESTEĞİNE ESAS ARAZİ KONTROL RAPORU`, boyut: 1 },
      { t: 'baslik', metin: `${proje.ad}${ilce ? ' — ' + ilce : ''}`, boyut: 3 },
      { t: 'p', metin: `Kontrol edilen üretici: ${kontrolEdilen} / ${satirlar.length} (%${oran}; talimat gereği asgari %50).`, hiza: 'sol', kucuk: true },
      {
        t: 'tablo', genislik: [0.5, 2.3, 1.5, 1.9, 1.3, 2, 1.2, 3.7], hizalar: ['orta', 'sol', 'orta', 'sol', 'orta', 'sol', 'orta', 'sol'],
        basliklar: ['Sıra No', 'Ad - Soyad', 'TC', 'İlçe/Köy/Mahalle', 'Ziyaret Tarihi', 'Proje Adı', 'Fotoğraf Eklendi Mi (Evet/Hayır)', 'Görüşler (Gelişim ve Çiftçi Memnuniyeti)'],
        satirlar: kayitlar.length ? kayitlar.map((x, i) => [
          String(i + 1), x.s.ciftci.adSoyad, x.s.ciftci.tcKimlikNo, [x.s.talep.ilce, x.s.ciftci.mahalle].filter(Boolean).join('/'), tarih(x.k.tarih), proje.kisaAd || proje.ad,
          (x.k.fotograflar || []).length ? 'Evet' : 'Hayır', [x.k.gorus, x.k.ekTespit].filter(Boolean).join(' — ')
        ]) : [['1', '', '', '', '', '', '', '']]
      }
    ]
  };
}

// ---------------------------------------------------------------------------
// Asıl ve yedek liste (ilçe bazında; talimat md. 8/8)
function asilYedek(v) {
  const { satirlar, proje, ayar, ilce, puanVar, ilceYetkilileri = [] } = v;
  const o = ortak(proje, ayar);
  const ilceler = [...new Set(satirlar.map((s) => s.talep.ilce))].sort((a, b) => a.localeCompare(b, 'tr'));
  const ogeler = [
    ...programBasligi(o),
    { t: 'baslik', metin: `${o.projeBasligi} ASIL VE YEDEK LİSTE${ilce ? ' — ' + buyuk(ilce) : ''}`, boyut: 2 }
  ];
  const basliklar = ['Sıra', 'Adı Soyadı', 'T.C. Kimlik No', 'Köy/Mahalle', 'Talep', 'Girdi Miktarı', 'Proje Tutarı (TL)', ...(puanVar ? ['Puan'] : [])];
  const satirYap = (s, i) => [String(i + 1), s.ciftci.adSoyad, s.ciftci.tcKimlikNo, s.ciftci.mahalle || '',
    s.hesap.kalemler.map((hk) => `${bitkiTuru(hk.kalem)}: ${sayi(hk.esasMiktari)} ${hk.talepBirimi}`).join('\n'), teslimKisa(s.hesap), sayi(s.hesap.bedel || 0, 2), ...(puanVar ? [s.deg && s.deg.puan != null ? sayi(s.deg.puan) : ''] : [])];
  const genislik = [0.5, 2, 1.4, 1.5, 2.6, 1.4, 1.3, ...(puanVar ? [0.7] : [])];
  const hizalar = ['orta', 'sol', 'orta', 'sol', 'sol', 'sag', 'sag', 'sag'];
  ilceler.forEach((ic) => {
    const asil = satirlar.filter((s) => s.talep.ilce === ic && ['desteklendi', 'teslim'].includes(s.talep.durum))
      .sort((a, b) => a.ciftci.adSoyad.localeCompare(b.ciftci.adSoyad, 'tr'));
    const yedek = satirlar.filter((s) => s.talep.ilce === ic && s.talep.durum === 'yedek')
      .sort((a, b) => ((b.deg && b.deg.puan) || 0) - ((a.deg && a.deg.puan) || 0));
    ogeler.push({ t: 'baslik', metin: `${ic} — Asıl liste (${asil.length})`, boyut: 3, hiza: 'sol' });
    ogeler.push({ t: 'tablo', kucuk: true, basliklar, genislik, hizalar, satirlar: asil.length ? asil.map(satirYap) : [['–', 'Asıl listede başvuru yok', '', '', '', '', '', ...(puanVar ? [''] : [])]] });
    ogeler.push({ t: 'baslik', metin: `${ic} — Yedek liste (${yedek.length})${puanVar ? ', puana göre' : ''}`, boyut: 3, hiza: 'sol' });
    ogeler.push({ t: 'tablo', kucuk: true, basliklar, genislik, hizalar, satirlar: yedek.length ? yedek.map(satirYap) : [['–', 'Yedek listede başvuru yok', '', '', '', '', '', ...(puanVar ? [''] : [])]] });
    // Listeyi ilçe proje uygulama birimi oluşturur (talimat md. 4/f, 8/8): teknik personel ve ilçe müdürü
    const y = ilceYetkilileri.find((x) => x.ilce === ic) || {};
    ogeler.push({ t: 'p', metin: `${ic} İlçe Proje Uygulama Birimi`, hiza: 'orta', kucuk: true });
    ogeler.push(...imzaBlogu('Teknik Personel', (y.birimUyeleri && y.birimUyeleri.length) ? y.birimUyeleri : [BOS_AD, BOS_AD]));
    ogeler.push(...imzaBlogu('İlçe Müdürü (Birim Başkanı)', [y.ad || BOS_AD]));
    ogeler.push({ t: 'bosluk', yukseklik: 10 });
  });
  // Nihai değerlendirme ve onay il proje uygulama komisyonunda
  ogeler.push({ t: 'p', metin: 'Yukarıdaki asıl ve yedek listeler İl Proje Uygulama Komisyonunca incelenerek onaylanmıştır.', kucuk: true });
  ogeler.push(...komisyonImzalari(o));
  return { ad: 'Asıl ve yedek liste', formAdi: 'Asıl ve Yedek Liste', yon: 'yatay', ogeler };
}

// ---------------------------------------------------------------------------
// Üretici katkı payı dilekçesi (ödeme için): bireysel ya da toplu (proje/ilçe)
const tl = (v) => (v == null ? '' : sayi(v, 2));
const hesapMetni = (o) => {
  const h = o.hesap;
  if (!h) return '……………………………………………… hesabına';
  if (h.metin) return `${h.metin} hesabına`;
  return `${[h.banka, h.alici ? h.alici + ' adına kayıtlı' : ''].filter(Boolean).join(' ')} ${h.iban} IBAN numaralı hesaba`.replace(/\s+/g, ' ').trim();
};
// Dekont açıklaması (il müdürlüğü yazısındaki kural): İlçe, Proje Kodu, Üretici, Miktar
const ambalajMiktari = (hesap) => hesap.kalemler.filter((hk) => hk.miktar != null)
  .map((hk) => `${sayi(hk.miktar)} ${String(hk.kalem.olcuBirimi || '').toLocaleLowerCase('tr')}`).join(' + ');
const dekontAciklamasi = (o, ilce, adSoyad, hesap) => [ilce, o.dekontKodu, adSoyad, ambalajMiktari(hesap)].filter(Boolean).join(', ');
const projeAdi = (proje) => (/projes[iİı]$/i.test(String(proje.ad).trim()) ? proje.ad : `${proje.ad} Projesi`);
const payBasliklari = (o) => [`Hibe Payı${o.hibeOrani != null ? ` (%${sayi(o.hibeOrani)})` : ''} (TL)`, `Üretici Payı${o.katkiOrani != null ? ` (%${sayi(o.katkiOrani)})` : ''} (TL)`];
const birimFiyatMetni = (hk) => (hk.kalem.birimFiyat != null ? `${tl(hk.kalem.birimFiyat)} TL/${hk.fiyatBirimi || fiyatBirimi(hk.kalem)}` : '');
const toplamlariAl = (liste) => liste.reduce((t, hk) => ({ bedel: t.bedel + (hk.bedel || 0), destek: t.destek + (hk.destek || 0), katki: t.katki + (hk.ciftciKatkisi || 0) }), { bedel: 0, destek: 0, katki: 0 });
// Dilekçenin altındaki ad, T.C., telefon ve imza kutusu (çerçevesiz, ":" ile hizalı); boşsa elle doldurulur
function imzaKutusu(baslik, kisi) {
  const k = kisi || {};
  return {
    t: 'tablo', kenarsiz: true, dikeyHiza: 'ust', satirYuksekligi: 14, genislik: [1.6, 1.4, 1.1, 1.9],
    satirlar: [
      [{ metin: 'EK:', kalin: true }, '', { metin: baslik, kalin: true, birlesik: 2, hiza: 'orta' }],
      ['1- Banka dekontu (1 adet)', '', 'Adı Soyadı', deger(k.adSoyad || '')],
      ['', '', 'T.C. Kimlik No', deger(k.tcKimlikNo || '')],
      ['', '', 'Telefon', deger(k.telefon || '')],
      ['', '', etiket('İmza', 3), deger('', 3)],
      ['', '', K, K], ['', '', K, K]
    ]
  };
}
function katkiBireysel(v) {
  const { talep, ciftci, proje, ayar, hesap } = v;
  const o = ortak(proje, ayar, hesap);
  const kalemler = hesap.kalemler.filter((hk) => hk.teslim != null || hk.bedel != null);
  const t = toplamlariAl(kalemler);
  const [hibeB, ureticiB] = payBasliklari(o);
  return {
    ad: `Katkı payı dilekçesi — ${ciftci.adSoyad}`,
    formAdi: 'Üretici Katkı Payı Dilekçesi',
    ogeler: [
      { t: 'p', metin: `…../…../${o.yil}`, hiza: 'sag' },
      { t: 'bosluk', yukseklik: 6 },
      { t: 'baslik', metin: `${buyuk(ilceMudurlugu(talep.ilce))}NE`, boyut: 3 },
      { t: 'bosluk', yukseklik: 4 },
      { t: 'p', metin: `Müdürlüğünüzce yürütülen ${projeAdi(proje)} kapsamında tarafıma hibe ile ayni olarak verilecek ${o.destekTuru.toLocaleLowerCase('tr')} için ödemem gereken ve aşağıda ayrıntısı bulunan üretici katkı payı tutarı olan ${tl(t.katki)} TL ${hesapMetni(o)} yatırılmış olup banka dekontu ekte sunulmuştur.` },
      { t: 'p', metin: 'Gereğini bilgilerinize arz ederim.' },
      { t: 'p', parcalar: [{ metin: 'Dekont açıklaması: ', kalin: true }, { metin: dekontAciklamasi(o, talep.ilce, ciftci.adSoyad, hesap) }], hiza: 'sol', kucuk: true },
      {
        t: 'tablo', kucuk: true, genislik: [1.7, 1.5, 1.2, 1.2, 1.2, 1.2], hizalar: ['sol', 'sag', 'sag', 'sag', 'sag', 'sag'],
        basliklar: ['Bitki Türü', 'Miktar', 'Birim Fiyat', 'Toplam Tutar (TL)', hibeB, ureticiB],
        satirlar: kalemler.map((hk) => [bitkiTuru(hk.kalem), hk.teslim != null ? teslimIfadesi(hk) : '', birimFiyatMetni(hk), tl(hk.bedel), tl(hk.destek), tl(hk.ciftciKatkisi)]),
        toplam: [{ metin: 'TOPLAM', birlesik: 3, hiza: 'orta' }, tl(t.bedel), tl(t.destek), tl(t.katki)]
      },
      { t: 'bosluk', yukseklik: 14 },
      imzaKutusu('Katkı Payını Ödeyen Üretici', ciftci)
    ]
  };
}
function katkiToplu(v) {
  const { satirlar, proje, ayar, ilce } = v;
  // Destek türü listedeki başvuruların kalemlerinden
  const o = ortak(proje, ayar, { kalemler: satirlar.flatMap((x) => x.hesap.kalemler) });
  const [hibeB, ureticiB] = payBasliklari(o);
  const genel = { bedel: 0, destek: 0, katki: 0 };
  const govde = satirlar.map((s, i) => {
    const kl = s.hesap.kalemler.filter((hk) => hk.teslim != null || hk.bedel != null);
    const t = toplamlariAl(kl);
    genel.bedel += t.bedel; genel.destek += t.destek; genel.katki += t.katki;
    return [String(i + 1), s.ciftci.adSoyad, s.ciftci.tcKimlikNo, [s.talep.ilce, s.ciftci.mahalle].filter(Boolean).join('/'),
      kl.map((hk) => bitkiTuru(hk.kalem)).join('\n'), kl.map((hk) => (hk.teslim != null ? teslimIfadesi(hk) : '')).join('\n'),
      kl.map(birimFiyatMetni).join('\n'), tl(t.bedel), tl(t.destek), tl(t.katki)];
  });
  const muhatap = ilce ? `${buyuk(ilceMudurlugu(ilce))}NE` : `${buyuk(o.mudurluk)}NE`;
  return {
    ad: 'Katkı payı dilekçesi (toplu)',
    formAdi: 'Üretici Katkı Payı Dilekçesi (Toplu)',
    yon: 'yatay',
    ogeler: [
      { t: 'p', metin: `…../…../${o.yil}`, hiza: 'sag' },
      { t: 'baslik', metin: muhatap, boyut: 3 },
      { t: 'p', metin: `Müdürlüğünüzce yürütülen ${projeAdi(proje)} kapsamında hibe ile ayni olarak ${o.destekTuru.toLocaleLowerCase('tr')} verilecek olan ve aşağıda listesi bulunan ${satirlar.length} üreticinin ödemesi gereken üretici katkı payları toplamı ${tl(genel.katki)} TL ${hesapMetni(o)} yatırılmış olup banka dekontu ekte sunulmuştur.` },
      { t: 'p', metin: 'Gereğini bilgilerinize arz ederim.' },
      {
        t: 'tablo', kucuk: true, genislik: [0.45, 1.7, 1.25, 1.5, 1.5, 1.5, 1.2, 1.2, 1.2, 1.2],
        hizalar: ['orta', 'sol', 'orta', 'sol', 'sol', 'sag', 'sag', 'sag', 'sag', 'sag'],
        basliklar: ['Sıra No', 'Adı Soyadı', 'T.C. Kimlik No', 'İlçe/Köy/Mahalle', 'Bitki Türü', 'Miktar', 'Birim Fiyat', 'Toplam Tutar (TL)', hibeB, ureticiB],
        satirlar: govde.length ? govde : [['1', '', '', '', '', '', '', '', '', '']],
        toplam: [{ metin: 'TOPLAM', birlesik: 7, hiza: 'orta' }, tl(genel.bedel), tl(genel.destek), tl(genel.katki)]
      },
      { t: 'bosluk', yukseklik: 10 },
      { ...imzaKutusu('Katkı Paylarını Yatıran', null), sayfaSonu: true }
    ]
  };
}

// ---------------------------------------------------------------------------
// Ortak: ilçe müdürü imzası, ambalaj sayıları
const ilceYetkilisiBul = (liste, ilce) => (liste || []).find((x) => x.ilce === ilce) || {};
const ilcelerOf = (satirlar) => [...new Set(satirlar.map((s) => s.talep.ilce))].sort((a, b) => a.localeCompare(b, 'tr'));
// Kalem bazında toplam ambalaj (torba/çuval) ve içerik miktarı
function kalemToplamlari(satirlar) {
  const t = {};
  satirlar.forEach((s) => s.hesap.kalemler.forEach((hk) => {
    const id = String(hk.kalem._id);
    if (!t[id]) t[id] = { kalem: hk.kalem, ambalaj: 0, icerik: 0, icerikBirimi: hk.teslimBirimi, uretici: 0, alan: 0, bedel: 0, destek: 0, katki: 0, ambalajli: !!hk.ambalaj };
    const x = t[id];
    x.ambalaj += hk.miktar || 0; x.icerik += hk.teslim || 0; x.uretici += 1; x.alan += hk.esasMiktari || 0;
    x.bedel += hk.bedel || 0; x.destek += hk.destek || 0; x.katki += hk.ciftciKatkisi || 0;
  }));
  return Object.values(t);
}
// Türkçe iyelik eki: tohum → tohumu, fidan → fidanı, fide → fidesi
function iyelik(kelime) {
  const k = String(kelime || '');
  const unluler = k.match(/[aıoueiöü]/gi);
  if (!unluler) return k;
  const son = unluler[unluler.length - 1].toLocaleLowerCase('tr');
  const ek = { a: 'ı', ı: 'ı', o: 'u', u: 'u', e: 'i', i: 'i', ö: 'ü', ü: 'ü' }[son];
  return /[aıoueiöü]$/i.test(k) ? `${k}s${ek}` : `${k}${ek}`;
}
const kalemMetni = (x) => {
  const olcu = String(x.kalem.olcuBirimi || '').toLocaleLowerCase('tr');
  const tur = String(x.kalem.tur || '').toLocaleLowerCase('tr');
  const icerik = x.ambalajli && x.icerikBirimi && x.icerikBirimi !== x.kalem.olcuBirimi ? ` (${sayi(x.icerik)} ${x.icerikBirimi})` : '';
  return `${sayi(x.ambalaj)} ${olcu} ${bitkiTuru(x.kalem)} ${iyelik(tur)}${icerik}`.replace(/\s+/g, ' ');
};
// Ambalajın (torba/çuval) birim fiyatı
const ambalajFiyati = (k) => {
  if (k.birimFiyat == null) return null;
  const fb = fiyatBirimi(k);
  if (String(fb).toLocaleLowerCase('tr') === String(k.olcuBirimi).toLocaleLowerCase('tr')) return k.birimFiyat;
  return k.ambalaj && k.ambalaj.miktar ? k.birimFiyat * k.ambalaj.miktar : null;
};

// ---------------------------------------------------------------------------
// İlçe teslim tutanağı: yüklenicinin il müdürlüğü adına ilçe müdürlüğüne teslim ettiği girdi
function ilceTeslim(v) {
  const { satirlar, proje, ayar, ilce, ilceYetkilileri } = v;
  const o = ortak(proje, ayar, { kalemler: satirlar.flatMap((x) => x.hesap.kalemler) });
  const sayfalar = (ilce ? [ilce] : ilcelerOf(satirlar)).map((ic) => {
    const ss = satirlar.filter((x) => x.talep.ilce === ic);
    const kalemler = kalemToplamlari(ss);
    const y = ilceYetkilisiBul(ilceYetkilileri, ic);
    return {
      ad: ic,
      ogeler: [
        { t: 'bosluk', yukseklik: 40 },
        { t: 'baslik', metin: 'TUTANAKTIR', boyut: 1 },
        { t: 'bosluk', yukseklik: 16 },
        { t: 'p', metin: `…../…../${o.yil} tarihinde ${o.ba.yuklenici || '……………………………………'} tarafından ${o.mudurluk} adına ${ilceMudurlugu(ic)}'ne ${kalemler.length ? kalemler.map(kalemMetni).join(', ') : '……… torba ……… tohumu'} teslim edilmiştir.` },
        { t: 'bosluk', yukseklik: 8 },
        {
          t: 'tablo', kucuk: true, genislik: [2.4, 1.2, 1.4, 1.1], hizalar: ['sol', 'sag', 'sag', 'sag'],
          basliklar: ['Bitki Türü', 'Ambalaj', 'İçerik', 'Üretici Sayısı'],
          satirlar: kalemler.map((x) => [bitkiTuru(x.kalem), `${sayi(x.ambalaj)} ${x.kalem.olcuBirimi || ''}`, x.ambalajli ? `${sayi(x.icerik)} ${x.icerikBirimi || ''}` : '', sayi(x.uretici)])
        },
        { t: 'bosluk', yukseklik: 30 },
        {
          t: 'tablo', kenarsiz: true, genislik: [1, 1], hizalar: ['orta', 'orta'],
          satirlar: [
            [{ metin: 'Teslim Eden', kalin: true, hiza: 'orta' }, { metin: 'Teslim Alan', kalin: true, hiza: 'orta' }],
            [o.ba.yuklenici || BOS_AD, y.ad || BOS_AD],
            ['Kaşe / İmza', `${y.unvan || 'İlçe Müdürü'}\nİmza`]
          ]
        }
      ]
    };
  });
  return { ad: 'İlçe teslim tutanağı', formAdi: 'İlçe Teslim Tutanağı', sayfalar };
}

// ---------------------------------------------------------------------------
// Katkı payı icmal listesi: çiftçi adına göre alfabetik (dekontlar bu sırayla dizilir)
function katkiIcmal(v) {
  const { satirlar, proje, ayar, ilce, ilceYetkilileri } = v;
  const o = ortak(proje, ayar, { kalemler: satirlar.flatMap((x) => x.hesap.kalemler) });
  const olculer = [...new Set(satirlar.flatMap((x) => x.hesap.kalemler.map((hk) => hk.kalem.olcuBirimi)).filter(Boolean))];
  const ambalajBasligi = `${olculer.length === 1 ? basHarfli(buyuk(olculer[0])) : 'Ambalaj'} (Adet)`;
  const sirali = satirlar.slice().sort((a, b) => a.ciftci.adSoyad.localeCompare(b.ciftci.adSoyad, 'tr'));
  const t = { alan: 0, ambalaj: 0, katki: 0 };
  const govde = sirali.map((x, i) => {
    const ambalaj = x.hesap.kalemler.reduce((a, hk) => a + (hk.miktar || 0), 0);
    const katki = x.hesap.kalemler.reduce((a, hk) => a + (hk.ciftciKatkisi || 0), 0);
    t.alan += x.hesap.toplamAlan || 0; t.ambalaj += ambalaj; t.katki += katki;
    return [String(i + 1), x.talep.ilce, x.ciftci.mahalle || '', x.ciftci.adSoyad, sayi(x.hesap.toplamAlan || 0, 2), sayi(ambalaj), tl(katki), dekontAciklamasi(o, x.talep.ilce, x.ciftci.adSoyad, x.hesap)];
  });
  const y = ilce ? ilceYetkilisiBul(ilceYetkilileri, ilce) : {};
  return {
    ad: 'Katkı payı icmal listesi',
    formAdi: 'Üretici Katkı Payı İcmal Listesi',
    yon: 'yatay',
    ogeler: [
      { t: 'baslik', metin: `${projeAdi(proje)}`, boyut: 2 },
      { t: 'baslik', metin: `ÜRETİCİ KATKI PAYI İCMAL LİSTESİ${ilce ? ' — ' + buyuk(ilce) : ''}`, boyut: 2 },
      { t: 'p', metin: 'Çiftçi adına göre alfabetik sıradadır; dekontlar bu listedeki sırayla dizilir.', hiza: 'sol', kucuk: true },
      {
        t: 'tablo', kucuk: true, genislik: [0.45, 1.1, 1.2, 1.8, 0.9, 0.8, 1.1, 2.6],
        hizalar: ['orta', 'sol', 'sol', 'sol', 'sag', 'sag', 'sag', 'sol'],
        basliklar: ['Sıra No', 'İlçe', 'Mahalle', 'Adı Soyadı', 'Ekilecek Alan (da)', ambalajBasligi, `Çiftçi Payı${o.katkiOrani != null ? ` (%${sayi(o.katkiOrani)})` : ''} (TL)`, 'Dekont Açıklaması'],
        satirlar: govde.length ? govde : [['1', '', '', '', '', '', '', '']],
        toplam: [{ metin: 'TOPLAM', birlesik: 4, hiza: 'orta' }, sayi(t.alan, 2), sayi(t.ambalaj), tl(t.katki), '']
      },
      { t: 'bosluk', yukseklik: 10 },
      { ...imzaBlogu(ilce ? 'İlçe Müdürü' : 'Düzenleyen', [y.ad || BOS_AD])[0], sayfaSonu: true }
    ]
  };
}

// ---------------------------------------------------------------------------
// Proje izleme formu (Bitkisel Üretim Genel Müdürlüğü şablonu): proje düzeyinde, izleme dönemi başına
function izleme(v) {
  const { satirlar, proje, ayar, secenekler = {} } = v;
  const o = ortak(proje, ayar, { kalemler: satirlar.flatMap((x) => x.hesap.kalemler) });
  const teslim = satirlar.filter((x) => x.talep.durum === 'teslim');
  const plan = kalemToplamlari(satirlar);
  const gercek = kalemToplamlari(teslim);
  const gercekBul = (k) => gercek.find((x) => String(x.kalem._id) === String(k._id)) || { ambalaj: 0, icerik: 0, alan: 0, uretici: 0, bedel: 0, destek: 0, katki: 0 };
  const top = (l, a) => l.reduce((t, x) => t + (x[a] || 0), 0);
  // Uygulama yerleri: ilçe: mahalle-mahalle
  const yerler = ilcelerOf(satirlar).map((ic) => `${ic}: ${[...new Set(satirlar.filter((x) => x.talep.ilce === ic).map((x) => x.ciftci.mahalle).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')).join('-')}`).join('; ');
  const sonTeslim = teslim.map((x) => x.talep.uygulama && x.talep.uygulama.teslimTarihi).filter(Boolean).sort().pop();
  const c = secenekler.cevaplar || {};
  const isaret = (k, deger) => ((c[k] && c[k].secim) === deger ? '(X)' : '(  )');
  const aciklama = (k) => (c[k] && c[k].aciklama ? `\n${c[k].aciklama}` : '');
  const evetHayir = (k, kismen) => `: ${isaret(k, 'evet')} Evet   ${kismen ? `${isaret(k, 'kismen')} Kısmen   ` : ''}${isaret(k, 'hayir')} Hayır   (Lütfen açıklayınız.)${aciklama(k)}`;
  const yurutenler = (secenekler.yurutenler || []).map((k) => [k.adSoyad, k.eposta, k.telefon].filter(Boolean).join(' – ')).join('\n');
  const tutar = (b, y) => `: ${tl(b)} TL (B)      ${tl(y)} TL (Y)`;
  const yuzde = (g, p) => (p ? `%${sayi((100 * g) / p, 1)}` : '');
  const ciktilar = [];
  plan.forEach((x) => {
    const g = gercekBul(x.kalem);
    ciktilar.push([`${bitkiTuru(x.kalem)} ekimi`, sayi(x.alan, 2), x.kalem.talepBirimi || 'da', sayi(g.alan, 2), yuzde(g.alan, x.alan)]);
    ciktilar.push([`${bitkiTuru(x.kalem)} ${String(x.kalem.tur || '').toLocaleLowerCase('tr')} dağıtımı`, sayi(x.ambalaj), x.kalem.olcuBirimi || '', sayi(g.ambalaj), yuzde(g.ambalaj, x.ambalaj)]);
  });
  ciktilar.push(['Desteklenen üretici', sayi(satirlar.length), 'kişi', sayi(teslim.length), yuzde(teslim.length, satirlar.length)]);
  const butce = plan.map((x) => {
    const g = gercekBul(x.kalem);
    const af = ambalajFiyati(x.kalem);
    return [bitkiTuru(x.kalem), sayi(x.ambalaj), x.kalem.olcuBirimi || '', tl(af), sonTeslim ? tarih(sonTeslim) : '', sayi(g.ambalaj), x.kalem.olcuBirimi || '', tl(af), tl(g.bedel), tl(g.destek), tl(g.katki)];
  });
  return {
    ad: 'Proje izleme formu',
    formAdi: 'Proje İzleme Formu',
    ogeler: [
      secenekler.logo && secenekler.logo.veri
        ? { t: 'resim', veri: secenekler.logo.veri, genislik: 42, yanMetin: secenekler.logo.yanMetin }
        : { t: 'p', parcalar: [{ metin: (secenekler.logo && secenekler.logo.yanMetin) || 'T.C. Tarım ve Orman Bakanlığı\nBitkisel Üretim Genel Müdürlüğü', kalin: true }], hiza: 'sol' },
      { t: 'baslik', metin: 'PROJE İZLEME FORMU *', boyut: 2 },
      { t: 'p', metin: '* İzleme faaliyeti, proje yürütücüleri tarafından proje süresince periyodik olarak gerçekleştirilecektir. İzleme formu en az aylık olarak düzenlenecek ve proje dosyasında muhafaza edilecektir.', kucuk: true },
      { t: 'baslik', metin: '1. İzlemeye Konu Proje Bilgileri', boyut: 3, hiza: 'sol' },
      {
        t: 'tablo', cerceve: 'dis', dikeyHiza: 'ust', genislik: [1.3, 2.7],
        satirlar: [
          ['İlin Adı', `: ${buyuk(o.il)}`],
          ['Projenin Adı', `: ${buyuk(projeAdi(proje))}`],
          ['Başlangıç ve Bitiş Tarihleri', `: ${proje.baslangicTarihi ? tarih(proje.baslangicTarihi) : '…'} - ${proje.bitisTarihi ? tarih(proje.bitisTarihi) : '…'}`],
          ['Proje Uygulama Yer(ler)i', `: ${yerler || '…'}`],
          ['İzleme Dönemi', `: ${secenekler.tarih ? tarih(secenekler.tarih) : '…../…../' + o.yil}`],
          ['Proje Bütçesi\n(B-Bakanlık, Y-Yerel Katkı)', tutar(top(plan, 'destek'), top(plan, 'katki'))],
          ['İzleme Dönemi Bütçe Gerçekleşmesi\n(B-Bakanlık, Y-Yerel Katkı)', tutar(top(gercek, 'destek'), top(gercek, 'katki'))],
          ['İzleme Faaliyetini Yürütenler', `: ${yurutenler || '…'}`]
        ]
      },
      { t: 'baslik', metin: '2. İzleme Dönemi Proje Faaliyetleri', boyut: 3, hiza: 'sol' },
      {
        t: 'tablo', cerceve: 'dis', dikeyHiza: 'ust', genislik: [1.5, 2.5],
        satirlar: [
          ['Faaliyetler planlandığı gibi yürütülüyor mu?', `: ${(c.s1 && c.s1.aciklama) || '……………………………………'}`],
          ['Çıktılar beklenildiği gibi gerçekleşiyor mu?', evetHayir('s2')],
          ['Beklenmedik bir durum var mı? Varsa proje revize edilmeli mi?', evetHayir('s3')],
          ['Faaliyetler için ihtiyaç duyulan girdiler planlanan bütçe çerçevesinde temin edildi mi?', evetHayir('s4')],
          ['Yerel katkı gerçekleşti mi?', evetHayir('s5', true)],
          ['Faaliyetler sonucunda istenen neticelere ulaşıldı mı?', `: ${(c.s6 && c.s6.aciklama) || '……………………………………'}`]
        ]
      },
      { t: 'baslik', metin: '3. İzleme Dönemi Faaliyet Çıktıları', boyut: 3, hiza: 'sol' },
      {
        t: 'tablo', kucuk: true, genislik: [2.4, 1, 1, 1, 0.8], hizalar: ['sol', 'sag', 'orta', 'sag', 'sag'],
        basliklar: ['Planlanan: Faaliyet Adı', 'Çıktı', 'Birimi (adet, dekar, ton, kg vb.)', 'Gerçekleşen: Çıktı Miktarı', 'Oran (%)'],
        satirlar: ciktilar
      },
      { t: 'baslik', metin: '4. İzleme Dönemi Proje Bütçesi', boyut: 3, hiza: 'sol' },
      {
        t: 'tablo', kucuk: true, genislik: [1.5, 0.75, 0.7, 0.9, 1.1, 0.75, 0.7, 0.9, 1, 1, 1],
        hizalar: ['sol', 'sag', 'orta', 'sag', 'orta', 'sag', 'orta', 'sag', 'sag', 'sag', 'sag'],
        basliklar: ['Planlanan: Girdi Adı', 'Miktarı', 'Birimi', 'Birim Maliyet (TL)', 'Gerçekleşen: Tarih', 'Miktarı', 'Birimi', 'Birim Maliyet (TL)', 'Toplam Maliyet (TL)', 'Bakanlık Katkısı (TL)', 'Yerel Katkı (TL)'],
        satirlar: butce,
        toplam: [{ metin: 'TOPLAM', birlesik: 8, hiza: 'orta' }, tl(top(gercek, 'bedel')), tl(top(gercek, 'destek')), tl(top(gercek, 'katki'))]
      },
      { t: 'p', metin: 'Planlanan değerler desteklenen başvurulardan, gerçekleşen değerler teslim edilen başvurulardan hesaplanmıştır.', kucuk: true, hiza: 'sol' },
      { t: 'bosluk', yukseklik: 4 },
      { t: 'p', metin: `Saha fotoğrafları (${secenekler.fotoSayisi != null && !Number.isNaN(secenekler.fotoSayisi) ? sayi(secenekler.fotoSayisi) : '…….'} adet) ektedir.`, hiza: 'sol' }
    ]
  };
}

// ---------------------------------------------------------------------------
// İl müdürlüğünden ilçelere çiftçi talepleri ve katkı payı ödemesi yazısı (taslak; EBYS'ye aktarılır)
function odemeYazisi(v) {
  const { satirlar, proje, ayar, secenekler = {} } = v;
  const o = ortak(proje, ayar, { kalemler: satirlar.flatMap((x) => x.hesap.kalemler) });
  const kalemler = kalemToplamlari(satirlar);
  const h = o.hesap || {};
  const ornekIlce = ilcelerOf(satirlar)[0] || 'İlçe';
  const ilk = kalemler[0];
  const olcu = ilk ? String(ilk.kalem.olcuBirimi || '').toLocaleLowerCase('tr') : 'torba';
  const fiyatlar = kalemler.map((x) => {
    const af = ambalajFiyati(x.kalem);
    return `${bitkiTuru(x.kalem)} için ${String(x.kalem.olcuBirimi || '').toLocaleLowerCase('tr')} fiyatı ${af != null ? tl(af) + ' TL (%100)' : '……… TL'} üzerinden toplam ${sayi(x.ambalaj)} ${String(x.kalem.olcuBirimi || '').toLocaleLowerCase('tr')}`;
  }).join('; ');
  const paylar = kalemler.map((x) => {
    const af = ambalajFiyati(x.kalem);
    const pay = af != null && o.katkiOrani != null ? (af * o.katkiOrani) / 100 : null;
    return { olcu: String(x.kalem.olcuBirimi || '').toLocaleLowerCase('tr'), tutar: pay != null ? tl(pay) + ' TL' : '……… TL', ad: bitkiTuru(x.kalem) };
  });
  // Tek kalemde: "torba başına %25 çiftçi katkısı olan 1.375 TL'nin"; birden çokta kalem kalem
  const katkilar = paylar.length === 1
    ? `${paylar[0].olcu} başına %${n(o.katkiOrani, '..')} çiftçi katkısı olan ${paylar[0].tutar}'nin`
    : `%${n(o.katkiOrani, '..')} çiftçi katkılarının (${paylar.map((p) => `${p.ad}: ${p.olcu} başına ${p.tutar}`).join('; ') || '………'})`;
  const hesapSatirlari = h.metin ? [`Hesap: ${h.metin}`] : [`Banka/Şube: ${h.banka || '…………………'}`, `Alıcı Adı: ${h.alici || '…………………'}`, `IBAN: ${h.iban || '…………………'}`];
  const ilceler = ilcelerOf(satirlar);
  const ek = ilceler.map((ic) => {
    const ss = satirlar.filter((x) => x.talep.ilce === ic).sort((a, b) => a.ciftci.adSoyad.localeCompare(b.ciftci.adSoyad, 'tr'));
    return [
      { t: 'baslik', metin: `${ic} (${ss.length} üretici)`, boyut: 3, hiza: 'sol' },
      {
        t: 'tablo', kucuk: true, genislik: [0.5, 2, 1.6, 1.1, 1.1, 1.3], hizalar: ['orta', 'sol', 'sol', 'sag', 'sag', 'sag'],
        basliklar: ['Sıra No', 'Adı Soyadı', 'Mahalle', 'Alan (da)', 'Ambalaj', 'Çiftçi Payı (TL)'],
        satirlar: ss.map((x, i) => [String(i + 1), x.ciftci.adSoyad, x.ciftci.mahalle || '', sayi(x.hesap.toplamAlan || 0, 2), ambalajMiktari(x.hesap), tl(x.hesap.kalemler.reduce((a, hk) => a + (hk.ciftciKatkisi || 0), 0))])
      }
    ];
  }).flat();
  return {
    ad: 'Katkı payı ödeme yazısı',
    formAdi: 'Çiftçi Talepleri ve Katkı Payı Ödemesi Yazısı',
    sayfalar: [{
      ad: 'Yazı',
      ogeler: [
        ...(secenekler.logo && secenekler.logo.veri ? [{ t: 'resim', veri: secenekler.logo.veri, genislik: 46 }] : []),
        { t: 'baslik', metin: `T.C.\n${buyuk(o.il)} VALİLİĞİ\n${o.mudurluk.replace(new RegExp('^' + o.il + '\\s*', 'i'), '')}`, boyut: 3 },
        {
          t: 'tablo', kenarsiz: true, genislik: [0.6, 3, 1], hizalar: ['sol', 'sol', 'sag'],
          satirlar: [
            ['Sayı', `: ${secenekler.sayi || '……………………'}`, secenekler.tarih ? tarih(secenekler.tarih) : `…../…../${o.yil}`],
            ['Konu', `: ${proje.kisaAd || proje.ad} - Çiftçi Talepleri ve Katkı Payı Ödemesi`, '']
          ]
        },
        { t: 'bosluk', yukseklik: 6 },
        { t: 'baslik', metin: 'DAĞITIM YERLERİNE', boyut: 3 },
        { t: 'p', metin: `${o.kaynak ? o.kaynak + ' kapsamında, ' : ''}"${projeAdi(proje)}" uygulanacaktır. Proje kapsamında ${fiyatlar} alımı gerçekleştirilecektir.` },
        { t: 'p', metin: `Ekte yer alan çiftçi listesi esas alınarak, ${katkilar} aşağıdaki hesaba aktarılması gerekmektedir.` },
        { t: 'liste', maddeler: hesapSatirlari },
        { t: 'p', parcalar: [{ metin: 'Dekont Açıklaması İçin Önemli Kural: ', kalin: true }, { metin: `Ödemeler esnasında banka dekontlarının açıklama kısmına uzun proje adı yazılmamalıdır. Bunun yerine sadece "${o.dekontKodu || '…'}" kodu kullanılarak, açıklama kısmı mutlak surette şu sırayla doldurulmalıdır: İlçe, Proje Kodu, Üretici, Miktar (Örnek: ${ornekIlce}, ${o.dekontKodu || '…'}, Ahmet Yılmaz, 1 ${olcu}).` }] },
        { t: 'p', parcalar: [{ metin: 'İlçe Müdürlüklerince Teslim Edilecek Evraklar: ', kalin: true }, { metin: 'Ödemelere ait dekontların İlçe Müdürlüğünüzce toplanarak aşağıda belirtilen formatta hazırlanması gerekmektedir.' }] },
        { t: 'liste', maddeler: ['İcmal Listeleri: Çiftçi adına göre alfabetik sırada listelenmiş Excel ve PDF (imzalı) formatında (Formlar › Katkı payı icmal listesi).', 'Dekontlar: İcmal listesindeki sıraya paralel olacak şekilde toplu olarak taranmış PDF formatında.'] },
        { t: 'p', metin: `Hazırlanan bu bilgi ve belgelerin en geç ${secenekler.sonTarih ? tarih(secenekler.sonTarih) : '…../…../' + o.yil} tarihi mesai bitimine kadar İl Müdürlüğümüze iletilmesi hususunda;` },
        { t: 'p', metin: 'Gereğini rica ederim.' },
        { t: 'bosluk', yukseklik: 10 },
        { t: 'tablo', kenarsiz: true, genislik: [2, 1.3], hizalar: ['sol', 'orta'], satirlar: [['', { metin: `${secenekler.imzaciAd || BOS_AD}\n${secenekler.imzaciUnvan || 'İl Müdürü a.\nİl Müdür Yardımcısı'}`, hiza: 'orta' }]] },
        { t: 'bosluk', yukseklik: 8 },
        { t: 'p', metin: `Ek: ${proje.kisaAd || proje.ad} Çiftçi Listesi (${satirlar.length} üretici)`, hiza: 'sol' },
        { t: 'bosluk', yukseklik: 6 },
        {
          t: 'tablo', kenarsiz: true, genislik: [1, 1], kucuk: true,
          satirlar: [
            [{ metin: 'Dağıtım:\nGereği:', kalin: true }, { metin: 'Bilgi:', kalin: true }],
            [ilceler.map((ic) => `${ic} İlçe Tarım ve Orman Müdürlüğüne`).join('\n') || '…', ['İdari ve Mali İşler Şube Müdürlüğüne', proje.birim ? `${proje.birim} Şube Müdürlüğüne` : ''].filter(Boolean).join('\n')]
          ]
        }
      ]
    }, {
      ad: 'Ek - Çiftçi listesi',
      ogeler: [
        { t: 'baslik', metin: `EK: ${buyuk(proje.kisaAd || proje.ad)} ÇİFTÇİ LİSTESİ`, boyut: 2 },
        ...ek
      ]
    }]
  };
}

const FORMLAR = {
  ek1: { kod: 'EK-1', ad: 'Hibe desteği başvuru formu', tekil: ek1, kapsam: 'basvuru' },
  ek2: { kod: 'EK-2', ad: 'Hibe desteği sözleşmesi', tekil: ek2, kapsam: 'desteklenen' },
  ek3: { kod: 'EK-3', ad: 'Kesin icmal', liste: ek3, kapsam: 'desteklenen' },
  ek4: { kod: 'EK-4', ad: 'Teslim tutanağı', tekil: ek4, kapsam: 'desteklenen' },
  ek5: { kod: 'EK-5', ad: 'Arazi kontrol tutanağı', tekil: ek5, kapsam: 'kontrol' },
  'kontrol-raporu': { kod: 'Kontrol raporu', ad: 'Tohum/fide hibe desteğine esas arazi kontrol raporu', liste: kontrolRaporu, kapsam: 'desteklenen' },
  'asil-yedek': { kod: 'Asıl/yedek', ad: 'Asıl ve yedek liste', liste: asilYedek, kapsam: 'karar' },
  katki: { kod: 'Katkı payı', ad: 'Üretici katkı payı dilekçesi', tekil: katkiBireysel, liste: katkiToplu, kapsam: 'desteklenen' },
  'katki-icmal': { kod: 'Katkı icmali', ad: 'Katkı payı icmal listesi (alfabetik, dekont sırası)', liste: katkiIcmal, kapsam: 'desteklenen' },
  'ilce-teslim': { kod: 'İlçe teslim', ad: 'Yükleniciden ilçeye teslim tutanağı', liste: ilceTeslim, kapsam: 'desteklenen' },
  izleme: { kod: 'İzleme', ad: 'Proje izleme formu (BÜGEM)', liste: izleme, kapsam: 'desteklenen', hazirla: true },
  'odeme-yazisi': { kod: 'Ödeme yazısı', ad: 'Çiftçi talepleri ve katkı payı ödemesi yazısı (il → ilçeler)', liste: odemeYazisi, kapsam: 'desteklenen', hazirla: true }
};

module.exports = { FORMLAR, ortak };
