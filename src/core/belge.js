// Belge motoru: formlar bir kez, ortak bir belge modeliyle tanımlanır; aynı model
// PDF (pdfmake), Word (docx) ve Excel (exceljs) olarak üretilir.
//
// Belge modeli:
//   { ad, dosyaAdi, yon: 'dikey' | 'yatay', sayfalar: [ { ad?, ogeler: [ oge, ... ] } ] }
//   (tek sayfalık belgede sayfalar yerine doğrudan ogeler verilebilir)
// Öğeler:
//   { t: 'baslik', metin, boyut: 1|2|3, hiza? }                  ortalı kalın başlık
//   { t: 'p', metin | parcalar: [{ metin, kalin }], hiza?, kucuk? } paragraf ('iki' = iki yana yaslı)
//   { t: 'tablo', basliklar?, satirlar, genislik?, hizalar?, kenarsiz?, kucuk?, toplam?,
//     cerceve?: 'dis' (yalnızca dış çerçeve ve başlık altı çizgisi), dikeyHiza?: 'ust',
//     ayiricilar? (dış çerçevede, solunda dikey çizgi olacak mantıksal sütun sıraları),
//     satirYuksekligi? (her satırın en az yüksekliği, punto) }
//       hücre: metin ya da { metin, kalin, hiza, birlesik (sütun sayısı), satirBirlesik (satır sayısı) }
//       satirBirlesik ile kaplanan alt satırlardaki konumlara { kapali: true } yazılır.
// Tabloya sayfaSonu: true verilirse sayfanın en altına sabitlenir (elle doldurulacak imza blokları);
// üstteki içerik o alana taşarsa tablo sonraki sayfanın altına geçer. Excel'de sayfa olmadığından akışta kalır.
// Belge düzeyinde: altBilgi (sol alt bilgi metni); sağda her zaman "Sayfa #/#" yazılır.
//   { t: 'resim', veri: Buffer (png/jpeg), genislik (punto), yanMetin?: 'satır\nsatır' }  logo ve yanındaki kurum adı
//   { t: 'bosluk', yukseklik? }
//   { t: 'liste', maddeler: [metin] }

const ExcelJS = require('exceljs');
const docx = require('docx');
const PdfPrinter = require('pdfmake');
const vfs = require('pdfmake/build/vfs_fonts');

const hucreMetni = (h) => (h && typeof h === 'object' ? String(h.metin == null ? '' : h.metin) : String(h == null ? '' : h));
const hucreKalin = (h) => !!(h && typeof h === 'object' && h.kalin);
const hucreHiza = (h, varsayilan) => (h && typeof h === 'object' && h.hiza) || varsayilan || 'sol';
const hucreBirlesik = (h) => (h && typeof h === 'object' && h.birlesik) || 1;
const hucreSatirBirlesik = (h) => (h && typeof h === 'object' && h.satirBirlesik) || 1;
const kapaliMi = (h) => !!(h && typeof h === 'object' && h.kapali);
const parcalar = (o) => (o.parcalar || [{ metin: o.metin || '' }]);

// Resmin türü ve piksel boyutu (PNG ve JPEG başlığından)
function resimBilgisi(b) {
  if (!b || b.length < 24) return null;
  if (b[0] === 0x89 && b[1] === 0x50) return { tur: 'png', en: b.readUInt32BE(16), boy: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xff) { i += 1; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { tur: 'jpg', boy: b.readUInt16BE(i + 5), en: b.readUInt16BE(i + 7) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}
// Resmin punto cinsinden boyutu (genişlik verilir, yükseklik orantılı)
function resimBoyutu(o) {
  const bilgi = resimBilgisi(o.veri) || { en: 1, boy: 1 };
  const en = o.genislik || 60;
  return { bilgi, en, boy: Math.round((en * bilgi.boy) / Math.max(1, bilgi.en)) };
}
const kalinYap = (h) => (h && typeof h === 'object' ? { ...h, kalin: !h.kapali } : { metin: h, kalin: true });

// Tablonun satırlarını üç biçim için ortak düzene çevirir: her hücrenin mantıksal sütunu (li),
// kapladığı sütun (b) ve satır (rs) sayısı. Satırın son hücresi kalan sütunları kaplar.
function tabloDuzeni(o) {
  const ham = [];
  if (o.basliklar) ham.push({ tur: 'baslik', hucreler: o.basliklar });
  (o.satirlar || []).forEach((x) => ham.push({ tur: 'govde', hucreler: x }));
  if (o.toplam) ham.push({ tur: 'toplam', hucreler: o.toplam.map(kalinYap) });
  const n = Math.max(1, ...ham.map((x) => x.hucreler.reduce((t, h) => t + hucreBirlesik(h), 0)));
  const satirlar = ham.map((x) => {
    let li = 0;
    const hucreler = x.hucreler.map((h, i) => {
      let b = hucreBirlesik(h);
      if (i === x.hucreler.length - 1 && li + b < n) b = n - li;
      b = Math.max(1, Math.min(b, n - li));
      const z = { h, li, b, rs: hucreSatirBirlesik(h), kapali: kapaliMi(h) };
      li += b;
      return z;
    });
    return { tur: x.tur, hucreler, eksik: n - li };
  });
  return { n, satirlar };
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------
const yaziTipi = (ad) => Buffer.from(vfs[ad] || (vfs.pdfMake && vfs.pdfMake.vfs[ad]), 'base64');
const yazici = new PdfPrinter({
  Roboto: {
    normal: yaziTipi('Roboto-Regular.ttf'),
    bold: yaziTipi('Roboto-Medium.ttf'),
    italics: yaziTipi('Roboto-Italic.ttf'),
    bolditalics: yaziTipi('Roboto-MediumItalic.ttf')
  }
});
const PDF_HIZA = { sol: 'left', orta: 'center', sag: 'right', iki: 'justify' };

function pdfOge(o) {
  switch (o.t) {
    case 'baslik':
      return { text: o.metin, bold: true, alignment: PDF_HIZA[o.hiza || 'orta'], fontSize: [0, 13, 11.5, 10.5][o.boyut || 2], margin: [0, 2, 0, 2] };
    case 'p':
      return { text: parcalar(o).map((x) => ({ text: x.metin, bold: !!x.kalin })), alignment: PDF_HIZA[o.hiza || 'iki'], fontSize: o.kucuk ? 8 : 10, margin: [0, 3, 0, 3], lineHeight: 1.15 };
    case 'liste':
      return { ul: o.maddeler, fontSize: 10, margin: [6, 2, 0, 4] };
    case 'bosluk':
      return { text: ' ', margin: [0, 0, 0, o.yukseklik || 8] };
    case 'resim': {
      const { bilgi, en } = resimBoyutu(o);
      if (!bilgi || !o.veri) return { text: o.yanMetin || '', bold: true, fontSize: 9 };
      const img = { image: `data:image/${bilgi.tur === 'jpg' ? 'jpeg' : 'png'};base64,${o.veri.toString('base64')}`, width: en };
      if (!o.yanMetin) return { ...img, alignment: PDF_HIZA[o.hiza || 'sol'], margin: [0, 0, 0, 4] };
      return { columns: [{ ...img, width: en }, { text: o.yanMetin, bold: true, fontSize: 9, margin: [6, 4, 0, 0], color: '#333333' }], columnGap: 4, margin: [0, 0, 0, 6] };
    }
    case 'tablo': {
      const { n: sutun, satirlar } = tabloDuzeni(o);
      const govde = satirlar.map((x) => {
        const baslik = x.tur === 'baslik';
        const r = [];
        x.hucreler.forEach((z) => {
          if (z.kapali) { for (let k = 0; k < z.b; k += 1) r.push({}); return; }
          r.push({
            text: hucreMetni(z.h), bold: baslik || hucreKalin(z.h),
            colSpan: z.b > 1 ? z.b : undefined, rowSpan: z.rs > 1 ? z.rs : undefined,
            alignment: PDF_HIZA[baslik ? 'orta' : hucreHiza(z.h, o.hizalar && o.hizalar[z.li])],
            fontSize: o.kucuk ? 7 : 9, fillColor: baslik && !o.kenarsiz ? '#eeeeee' : undefined
          });
          for (let k = 1; k < z.b; k += 1) r.push({});
        });
        for (let k = 0; k < x.eksik; k += 1) r.push({ text: '' });
        return r;
      });
      const toplamOran = (o.genislik || []).reduce((a, b) => a + b, 0);
      const baslikSatiri = o.basliklar ? 1 : 0;
      let layout = { hLineWidth: () => 0.5, vLineWidth: () => 0.5, paddingTop: () => 2, paddingBottom: () => 2 };
      if (o.kenarsiz) layout = 'noBorders';
      else if (o.cerceve === 'dis') {
        layout = {
          hLineWidth: (i, node) => (i === 0 || i === node.table.body.length || (baslikSatiri && i === baslikSatiri) ? 0.5 : 0),
          vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length || (o.ayiricilar || []).includes(i) ? 0.5 : 0),
          paddingTop: () => 2, paddingBottom: () => 2
        };
      }
      return {
        table: {
          headerRows: baslikSatiri,
          widths: o.genislik && o.genislik.length === sutun ? o.genislik.map((g) => `${(100 * g) / toplamOran}%`) : Array(sutun).fill('*'),
          heights: o.satirYuksekligi ? (i) => (i < baslikSatiri ? undefined : o.satirYuksekligi) : undefined,
          body: govde.length ? govde : [[{ text: '' }]]
        },
        layout,
        margin: [0, 4, 0, 6]
      };
    }
    default:
      return { text: '' };
  }
}

// Sayfa sonuna sabitlenecek tablonun yüksekliği (punto): satır başına en az yükseklik + iç boşluk
function pdfTabloYuksekligi(o) {
  const satir = (o.satirlar || []).length + (o.toplam ? 1 : 0);
  const yazi = o.kucuk ? 7 : 9;
  return (o.basliklar ? yazi * 1.25 + 6 : 0) + satir * (Math.max(o.satirYuksekligi || 0, yazi * 1.25) + 4) + 10;
}

function pdfOlustur(belge) {
  const yatay = belge.yon === 'yatay';
  const kenar = yatay ? [28, 28, 28, 40] : [48, 40, 48, 48];
  const sayfaYuksekligi = yatay ? 595.28 : 841.89;
  const sayfaGenisligi = (yatay ? 841.89 : 595.28) - kenar[0] - kenar[2];
  const icerik = [];
  belge.sayfalar.forEach((s, i) => {
    s.ogeler.forEach((o, j) => {
      const p = pdfOge(o);
      if (o.sayfaSonu) {
        // Yer tutucu akışta alanı ayırır (sığmazsa sonraki sayfaya geçer), tablo o sayfanın altına yerleşir
        const h = pdfTabloYuksekligi(o);
        const yer = { canvas: [{ type: 'rect', x: 0, y: 0, w: 1, h, lineColor: '#ffffff' }] };
        if (i > 0 && j === 0) yer.pageBreak = 'before';
        icerik.push(yer);
        p.margin = [0, 0, 0, 0];
        p.absolutePosition = { x: kenar[0], y: sayfaYuksekligi - kenar[3] - h };
        icerik.push({ stack: [p], width: sayfaGenisligi, absolutePosition: p.absolutePosition });
        delete p.absolutePosition;
        return;
      }
      if (i > 0 && j === 0) p.pageBreak = 'before';
      icerik.push(p);
    });
  });
  const tanim = {
    pageSize: 'A4',
    pageOrientation: belge.yon === 'yatay' ? 'landscape' : 'portrait',
    pageMargins: kenar,
    footer: (sayfa, toplam) => ({
      columns: [
        { text: belge.altBilgi || '', alignment: 'left' },
        { text: `Sayfa ${sayfa}/${toplam}`, alignment: 'right', width: 70 }
      ],
      fontSize: 7.5, color: '#444444',
      margin: belge.yon === 'yatay' ? [28, 14, 28, 0] : [48, 18, 48, 0]
    }),
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    info: { title: belge.ad, creator: 'Tarımsal Proje Takip Sistemi' },
    content: icerik
  };
  return new Promise((coz, reddet) => {
    const pdf = yazici.createPdfKitDocument(tanim);
    const parca = [];
    pdf.on('data', (d) => parca.push(d));
    pdf.on('end', () => coz(Buffer.concat(parca)));
    pdf.on('error', reddet);
    pdf.end();
  });
}

// ---------------------------------------------------------------------------
// Word
// ---------------------------------------------------------------------------
const DOCX_HIZA = { sol: docx.AlignmentType.LEFT, orta: docx.AlignmentType.CENTER, sag: docx.AlignmentType.RIGHT, iki: docx.AlignmentType.JUSTIFIED };
const YAZI = 'Times New Roman';

function docxParagraf(metinler, ayar = {}) {
  return new docx.Paragraph({
    alignment: DOCX_HIZA[ayar.hiza || 'sol'],
    spacing: { before: ayar.once || 40, after: ayar.sonra || 40 },
    children: metinler.flatMap((x) => String(x.metin == null ? '' : x.metin).split('\n').map((parca, i) =>
      new docx.TextRun({ text: parca, break: i > 0 ? 1 : 0, bold: !!x.kalin || !!ayar.kalin, font: YAZI, size: ayar.boyut || 22 })))
  });
}

function docxOge(o, sayfaGenisligi) {
  switch (o.t) {
    case 'baslik':
      return [docxParagraf([{ metin: o.metin }], { hiza: o.hiza || 'orta', kalin: true, boyut: [0, 26, 23, 21][o.boyut || 2] })];
    case 'p':
      return [docxParagraf(parcalar(o), { hiza: o.hiza || 'iki', boyut: o.kucuk ? 16 : 22, once: 60, sonra: 60 })];
    case 'liste':
      return o.maddeler.map((m) => docxParagraf([{ metin: `• ${m}` }], { hiza: 'iki' }));
    case 'bosluk':
      return [docxParagraf([{ metin: '' }], { sonra: (o.yukseklik || 8) * 15 })];
    case 'resim': {
      const { bilgi, en, boy } = resimBoyutu(o);
      if (!o.veri || !resimBilgisi(o.veri)) return o.yanMetin ? [docxParagraf([{ metin: o.yanMetin, kalin: true }], { boyut: 18 })] : [];
      // punto → piksel (96 dpi)
      const resim = new docx.ImageRun({ type: bilgi.tur, data: o.veri, transformation: { width: Math.round(en * 4 / 3), height: Math.round(boy * 4 / 3) } });
      if (!o.yanMetin) return [new docx.Paragraph({ alignment: DOCX_HIZA[o.hiza || 'sol'], children: [resim] })];
      const YOK = { style: docx.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
      const ilk = Math.round(en * 20 + 200);
      return [new docx.Table({
        width: { size: sayfaGenisligi, type: docx.WidthType.DXA }, columnWidths: [ilk, sayfaGenisligi - ilk],
        borders: { top: YOK, bottom: YOK, left: YOK, right: YOK, insideHorizontal: YOK, insideVertical: YOK },
        rows: [new docx.TableRow({ children: [
          new docx.TableCell({ width: { size: ilk, type: docx.WidthType.DXA }, children: [new docx.Paragraph({ children: [resim] })] }),
          new docx.TableCell({ width: { size: sayfaGenisligi - ilk, type: docx.WidthType.DXA }, verticalAlign: docx.VerticalAlign.CENTER, children: o.yanMetin.split('\n').map((m) => docxParagraf([{ metin: m, kalin: true }], { boyut: 18, once: 0, sonra: 0 })) })
        ] })]
      }), docxParagraf([{ metin: '' }], { once: 0, sonra: 40 })];
    }
    case 'tablo': {
      const { n: sutun, satirlar: duzen } = tabloDuzeni(o);
      const oranlar = o.genislik && o.genislik.length === sutun ? o.genislik : Array(sutun).fill(1);
      const top = oranlar.reduce((a, b) => a + b, 0);
      const genislikler = oranlar.map((g) => Math.round((sayfaGenisligi * g) / top));
      const YOK = { style: docx.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
      const CIZGI = { style: docx.BorderStyle.SINGLE, size: 4, color: '000000' };
      let kenar;
      if (o.kenarsiz) kenar = { top: YOK, bottom: YOK, left: YOK, right: YOK, insideHorizontal: YOK, insideVertical: YOK };
      else if (o.cerceve === 'dis') kenar = { top: CIZGI, bottom: CIZGI, left: CIZGI, right: CIZGI, insideHorizontal: YOK, insideVertical: YOK };
      const boyut = o.kucuk ? 15 : 18;
      const satirlar = duzen.map((x) => {
        const baslik = x.tur === 'baslik';
        const hucreler = [];
        x.hucreler.forEach((z) => {
          if (z.kapali) return;                       // satır birleştirmesinin devamını docx kendisi ekler
          const w = genislikler.slice(z.li, z.li + z.b).reduce((a, v) => a + v, 0);
          const hiza = baslik ? 'orta' : hucreHiza(z.h, o.hizalar && o.hizalar[z.li]);
          hucreler.push(new docx.TableCell({
            columnSpan: z.b > 1 ? z.b : undefined,
            rowSpan: z.rs > 1 ? z.rs : undefined,
            width: { size: w, type: docx.WidthType.DXA },
            shading: baslik && !o.kenarsiz ? { fill: 'EEEEEE' } : undefined,
            borders: o.cerceve === 'dis' && (baslik || (o.ayiricilar || []).includes(z.li))
              ? { ...(baslik ? { bottom: CIZGI } : {}), ...((o.ayiricilar || []).includes(z.li) ? { left: CIZGI } : {}) } : undefined,
            verticalAlign: o.dikeyHiza === 'ust' && !baslik ? docx.VerticalAlign.TOP : docx.VerticalAlign.CENTER,
            children: hucreMetni(z.h).split('\n').map((satirMetni) => docxParagraf([{ metin: satirMetni }], { hiza, kalin: baslik || hucreKalin(z.h), boyut, once: 20, sonra: 20 }))
          }));
        });
        let i = sutun - x.eksik;
        while (i < sutun) { hucreler.push(new docx.TableCell({ width: { size: genislikler[i], type: docx.WidthType.DXA }, children: [docxParagraf([{ metin: '' }])] })); i += 1; }
        return new docx.TableRow({
          tableHeader: baslik, children: hucreler,
          height: o.satirYuksekligi && !baslik ? { value: Math.round(o.satirYuksekligi * 20), rule: docx.HeightRule.ATLEAST } : undefined
        });
      });
      if (!satirlar.length) return [];
      const yuzen = o.sayfaSonu ? {
        float: {
          horizontalAnchor: docx.TableAnchorType.MARGIN, verticalAnchor: docx.TableAnchorType.MARGIN,
          relativeVerticalPosition: docx.RelativeVerticalPosition.BOTTOM, overlap: docx.OverlapType.NEVER
        }
      } : {};
      return [new docx.Table({ rows: satirlar, width: { size: sayfaGenisligi, type: docx.WidthType.DXA }, columnWidths: genislikler, borders: kenar, ...yuzen }), docxParagraf([{ metin: '' }])];
    }
    default:
      return [];
  }
}

async function docxOlustur(belge) {
  const yatay = belge.yon === 'yatay';
  // A4: 11906 × 16838 twip; kenar boşlukları 1134 (2 cm) / yatayda 850
  const kenar = yatay ? 850 : 1134;
  const genislik = (yatay ? 16838 : 11906) - 2 * kenar;
  const doc = new docx.Document({
    creator: 'Tarımsal Proje Takip Sistemi',
    title: belge.ad,
    styles: { default: { document: { run: { font: YAZI, size: 22 } } } },
    sections: belge.sayfalar.map((s) => ({
      properties: {
        page: {
          size: { orientation: yatay ? docx.PageOrientation.LANDSCAPE : docx.PageOrientation.PORTRAIT, width: 11906, height: 16838 },
          margin: { top: kenar, bottom: kenar, left: kenar, right: kenar }
        }
      },
      footers: {
        default: new docx.Footer({
          children: [new docx.Paragraph({
            tabStops: [{ type: docx.TabStopType.RIGHT, position: genislik }],
            children: [
              new docx.TextRun({ text: belge.altBilgi || '', font: YAZI, size: 16, color: '444444' }),
              new docx.TextRun({ children: [new docx.Tab(), 'Sayfa ', docx.PageNumber.CURRENT, '/', docx.PageNumber.TOTAL_PAGES], font: YAZI, size: 16, color: '444444' })
            ]
          })]
        })
      },
      children: s.ogeler.flatMap((o) => docxOge(o, genislik))
    }))
  });
  return docx.Packer.toBuffer(doc);
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------
// Excel'de sayı olarak yazılacak hücreler: yalnızca Türkçe biçimli sayılar (1.234,5).
// T.C. kimlik no, telefon, tarih (17.05.1980), sıfırla başlayan kodlar metin kalır.
function sayiyaCevir(m) {
  if (!/^-?(\d{1,3}(\.\d{3})*|\d{1,6})(,\d+)?$/.test(m)) return null;
  if (/^-?0\d/.test(m)) return null;
  return Number(m.replace(/\./g, '').replace(',', '.'));
}
const IZGARA_DIKEY = 40;
const IZGARA_YATAY = 60;
// Oranları toplamı "toplam" olan tam sayılara böler (en büyük kalan yöntemi, her sütun en az 1)
function izgaraPaylari(oranlar, toplam) {
  const n = oranlar.length;
  if (n >= toplam) return oranlar.map(() => 1);
  const top = oranlar.reduce((a, b) => a + b, 0) || n;
  const ham = oranlar.map((g) => ((g || 0) / top) * (toplam - n));
  const pay = ham.map((x) => 1 + Math.floor(x));
  let kalan = toplam - pay.reduce((a, b) => a + b, 0);
  ham.map((x, i) => ({ i, k: x - Math.floor(x) })).sort((a, b) => b.k - a.k).forEach(({ i }) => { if (kalan > 0) { pay[i] += 1; kalan -= 1; } });
  return pay;
}
const XLSX_HIZA = { sol: 'left', orta: 'center', sag: 'right', iki: 'justify' };
const ince = { style: 'thin', color: { argb: 'FF999999' } };

function sayfaAdi(ad, kullanilan) {
  let a = String(ad || 'Sayfa').replace(/[\\/*?:[\]]/g, ' ').slice(0, 28).trim() || 'Sayfa';
  let n = 2;
  const temel = a;
  while (kullanilan.has(a.toLocaleLowerCase('tr'))) a = `${temel.slice(0, 25)} ${n++}`;
  kullanilan.add(a.toLocaleLowerCase('tr'));
  return a;
}

async function xlsxOlustur(belge) {
  const kitap = new ExcelJS.Workbook();
  kitap.creator = 'Tarımsal Proje Takip Sistemi';
  const kullanilan = new Set();
  belge.sayfalar.forEach((s, si) => {
    const ws = kitap.addWorksheet(sayfaAdi(s.ad || (belge.sayfalar.length > 1 ? `${si + 1}` : belge.ad), kullanilan), {
      pageSetup: { paperSize: 9, orientation: belge.yon === 'yatay' ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }
    });
    // Izgara: tüm sütunlar eşit genişlikte; her tablo sütunu, genişlik oranına göre
    // birden çok ızgara sütununu birleştirerek kaplar (ör. sıra 1, ilçe 6, T.C. 4 sütun).
    // Böylece aynı sayfadaki farklı sütunlu tablolar ve imza blokları birbirini bozmaz.
    const sutun = belge.yon === 'yatay' ? IZGARA_YATAY : IZGARA_DIKEY;
    const toplamGenislik = belge.yon === 'yatay' ? 190 : 110;
    const izgaraGenisligi = toplamGenislik / sutun;
    for (let i = 1; i <= sutun; i += 1) ws.getColumn(i).width = izgaraGenisligi;
    const ortalamaGenislik = toplamGenislik;
    // Alt bilgi: solda belge bilgisi, sağda "Sayfa #/#"
    const kacis = (m) => String(m || '').replace(/&/g, '&&');
    ws.headerFooter.oddFooter = `&L&"Times New Roman,Regular"&8${kacis(belge.altBilgi)}&R&"Times New Roman,Regular"&8Sayfa &P/&N`;

    let r = 1;
    const birlesikSatir = (metin, stil) => {
      ws.mergeCells(r, 1, r, sutun);
      const c = ws.getCell(r, 1);
      c.value = metin;
      c.font = { name: 'Times New Roman', size: stil.boyut || 11, bold: !!stil.kalin };
      c.alignment = { horizontal: XLSX_HIZA[stil.hiza || 'sol'], vertical: 'top', wrapText: true };
      const satirSayisi = Math.max(1, Math.ceil(String(metin).length / (ortalamaGenislik * 1.05)) + (String(metin).match(/\n/g) || []).length);
      ws.getRow(r).height = Math.max(15, satirSayisi * (stil.boyut || 11) * 1.35);
      r += 1;
    };
    s.ogeler.forEach((o) => {
      if (o.t === 'baslik') birlesikSatir(o.metin, { kalin: true, hiza: o.hiza || 'orta', boyut: [0, 13, 12, 11][o.boyut || 2] });
      else if (o.t === 'p') birlesikSatir(parcalar(o).map((x) => x.metin).join(''), { hiza: o.hiza || 'iki', boyut: o.kucuk ? 8 : 10 });
      else if (o.t === 'liste') o.maddeler.forEach((m) => birlesikSatir(`• ${m}`, { boyut: 10 }));
      else if (o.t === 'bosluk') { r += 1; }
      else if (o.t === 'resim') {
        const { bilgi, en, boy } = resimBoyutu(o);
        const satirSayisi = Math.max(2, Math.ceil((boy * 4 / 3) / 20));
        if (o.veri && resimBilgisi(o.veri)) {
          const id = kitap.addImage({ buffer: o.veri, extension: bilgi.tur === 'jpg' ? 'jpeg' : 'png' });
          ws.addImage(id, { tl: { col: 0.1, row: r - 1 + 0.1 }, ext: { width: Math.round(en * 4 / 3), height: Math.round(boy * 4 / 3) } });
        }
        if (o.yanMetin) {
          const bas = Math.min(sutun - 1, Math.ceil((en * 4 / 3) / (izgaraGenisligi * 7)) + 2);
          ws.mergeCells(r, bas, r + satirSayisi - 1, sutun);
          const c = ws.getCell(r, bas);
          c.value = o.yanMetin;
          c.font = { name: 'Times New Roman', size: 10, bold: true };
          c.alignment = { vertical: 'middle', wrapText: true };
        }
        for (let k = 0; k < satirSayisi; k += 1) ws.getRow(r + k).height = 20;
        r += satirSayisi;
      }
      else if (o.t === 'tablo') {
        const { n, satirlar: duzen } = tabloDuzeni(o);
        const oranlar = o.genislik && o.genislik.length === n ? o.genislik : Array(n).fill(1);
        const bas = [0];
        izgaraPaylari(oranlar, sutun).forEach((x) => bas.push(bas[bas.length - 1] + x));
        const ilkSatir = r;
        const yerlesim = [];
        duzen.forEach((x) => {
          const baslik = x.tur === 'baslik';
          const toplamSatiri = x.tur === 'toplam';
          let enCokSatir = 1;
          x.hucreler.forEach((z) => {
            if (z.kapali) return;
            const c = bas[z.li] + 1;
            const son = bas[z.li + z.b];
            const alt = r + z.rs - 1;
            if (son > c || alt > r) ws.mergeCells(r, c, alt, son);
            yerlesim.push({ ust: r, alt, c, sag: son, baslik });
            const hc = ws.getCell(r, c);
            const m = hucreMetni(z.h);
            const sayi = !baslik ? sayiyaCevir(m) : null;
            hc.value = sayi != null && Number.isFinite(sayi) ? sayi : m;
            if (sayi != null) hc.numFmt = m.includes(',') ? '#,##0.00' : '#,##0';
            hc.font = { name: 'Times New Roman', size: o.kucuk ? 8 : 10, bold: baslik || toplamSatiri || hucreKalin(z.h) };
            hc.alignment = {
              horizontal: XLSX_HIZA[baslik ? 'orta' : hucreHiza(z.h, o.hizalar && o.hizalar[z.li])],
              vertical: o.dikeyHiza === 'ust' && !baslik ? 'top' : 'middle', wrapText: true
            };
            if (baslik && !o.kenarsiz) hc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
            if (!o.kenarsiz && !o.cerceve) {
              for (let rr = r; rr <= alt; rr += 1) for (let k = c; k <= son; k += 1) ws.getCell(rr, k).border = { top: ince, left: ince, bottom: ince, right: ince };
            }
            if (z.rs === 1) {
              const w = (son - c + 1) * izgaraGenisligi * (o.kucuk ? 1.25 : 1);
              const satirlar = m.split('\n').reduce((t, parca) => t + Math.max(1, Math.ceil(parca.length / Math.max(3, w * 1.05))), 0);
              enCokSatir = Math.max(enCokSatir, satirlar);
            }
          });
          const enAz = o.satirYuksekligi && !baslik ? o.satirYuksekligi + 2 : 15;
          ws.getRow(r).height = Math.max(enAz, enCokSatir * (o.kucuk ? 11 : 13));
          r += 1;
        });
        // Yalnızca dış çerçeve (ve başlık altı, ayırıcı çizgiler). exceljs'te birleşik hücrenin
        // tüm hücreleri ana hücrenin biçimini paylaştığından kenarlar yerleşime göre bir kerede verilir.
        if (o.cerceve === 'dis' && !o.kenarsiz && r > ilkSatir) {
          const son = r - 1;
          yerlesim.forEach(({ ust, alt, c, sag, baslik }) => {
            const kenar = {};
            if (ust === ilkSatir) kenar.top = ince;
            if (alt === son || baslik) kenar.bottom = ince;
            if (c === 1 || (!baslik && (o.ayiricilar || []).some((li) => bas[li] + 1 === c))) kenar.left = ince;
            if (sag === sutun) kenar.right = ince;
            if (Object.keys(kenar).length) ws.getCell(ust, c).border = kenar;
          });
        }
        r += 1;
      }
    });
  });
  return Buffer.from(await kitap.xlsx.writeBuffer());
}

// ---------------------------------------------------------------------------
// HTML: tarayıcıda düzenlenip yazdırılan önizleme (metinler tıklanarak değiştirilir)
// ---------------------------------------------------------------------------
const kac = (m) => String(m == null ? '' : m).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const satirKir = (m) => kac(m).replace(/\n/g, '<br>');
const HTML_HIZA = { sol: 'left', orta: 'center', sag: 'right', iki: 'justify' };

function htmlOge(o) {
  switch (o.t) {
    case 'baslik':
      return `<div class="b b${o.boyut || 2}" style="text-align:${HTML_HIZA[o.hiza || 'orta']}">${satirKir(o.metin)}</div>`;
    case 'p':
      return `<p class="${o.kucuk ? 'k' : ''}" style="text-align:${HTML_HIZA[o.hiza || 'iki']}">${parcalar(o).map((x) => (x.kalin ? `<b>${satirKir(x.metin)}</b>` : satirKir(x.metin))).join('')}</p>`;
    case 'liste':
      return `<ul>${o.maddeler.map((m) => `<li>${satirKir(m)}</li>`).join('')}</ul>`;
    case 'bosluk':
      return `<div style="height:${o.yukseklik || 8}pt"></div>`;
    case 'resim': {
      const { bilgi, en } = resimBoyutu(o);
      const img = o.veri && resimBilgisi(o.veri) ? `<img src="data:image/${bilgi.tur === 'jpg' ? 'jpeg' : 'png'};base64,${o.veri.toString('base64')}" style="width:${en}pt">` : '';
      return `<div class="logo">${img}${o.yanMetin ? `<div>${satirKir(o.yanMetin)}</div>` : ''}</div>`;
    }
    case 'tablo': {
      const { n, satirlar } = tabloDuzeni(o);
      const oranlar = o.genislik && o.genislik.length === n ? o.genislik : Array(n).fill(1);
      const top = oranlar.reduce((a, b) => a + b, 0);
      const sinif = ['t', o.kenarsiz ? 'kenarsiz' : '', o.cerceve === 'dis' ? 'dis' : '', o.kucuk ? 'k' : ''].join(' ');
      const ayirici = new Set(o.ayiricilar || []);
      const govde = satirlar.map((x) => {
        const baslik = x.tur === 'baslik';
        const etiket = baslik ? 'th' : 'td';
        const hucreler = x.hucreler.filter((z) => !z.kapali).map((z) => {
          const stil = [`text-align:${HTML_HIZA[baslik ? 'orta' : hucreHiza(z.h, o.hizalar && o.hizalar[z.li])]}`];
          if (o.dikeyHiza === 'ust' && !baslik) stil.push('vertical-align:top');
          if (hucreKalin(z.h) || x.tur === 'toplam') stil.push('font-weight:bold');
          if (ayirici.has(z.li)) stil.push('border-left:0.5pt solid #000');
          return `<${etiket}${z.b > 1 ? ` colspan="${z.b}"` : ''}${z.rs > 1 ? ` rowspan="${z.rs}"` : ''} style="${stil.join(';')}">${satirKir(hucreMetni(z.h))}</${etiket}>`;
        }).join('');
        return `<tr${o.satirYuksekligi && !baslik ? ` style="height:${o.satirYuksekligi + 4}pt"` : ''}>${hucreler}${'<td></td>'.repeat(x.eksik)}</tr>`;
      }).join('');
      return `<table class="${sinif}${o.sayfaSonu ? ' sayfa-sonu' : ''}"><colgroup>${oranlar.map((g) => `<col style="width:${((100 * g) / top).toFixed(2)}%">`).join('')}</colgroup>${govde}</table>`;
    }
    default:
      return '';
  }
}

function htmlOlustur(belge) {
  const yatay = belge.yon === 'yatay';
  // CSS içeriği için kaçış (HTML varlıkları <style> içinde çözülmez)
  const alt = String(belge.altBilgi || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/</g, '\\3c ');
  const sayfalar = belge.sayfalar.map((s) => `<section class="sayfa">${s.ogeler.map(htmlOge).join('\n')}</section>`).join('\n');
  const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${kac(belge.ad || 'Belge')}</title>
<style>
  @page { size: A4 ${yatay ? 'landscape' : 'portrait'}; margin: ${yatay ? '10mm 10mm 14mm' : '14mm 17mm 17mm'};
    @bottom-left { content: "${alt}"; font: 7.5pt 'Times New Roman', serif; color: #444; }
    @bottom-right { content: "Sayfa " counter(page) "/" counter(pages); font: 7.5pt 'Times New Roman', serif; color: #444; } }
  :root { color-scheme: light; }
  body { margin: 0; background: #e9ecef; font: 10.5pt/1.3 'Times New Roman', serif; color: #000; }
  .arac { position: sticky; top: 0; z-index: 5; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; padding: 10px 16px;
    background: #1f2937; color: #fff; font: 14px system-ui, sans-serif; }
  .arac b { font-weight: 600; }
  .arac button { font: inherit; padding: 6px 14px; border: 0; border-radius: 6px; background: #16a34a; color: #fff; cursor: pointer; }
  .arac button.ikincil { background: #4b5563; }
  .arac .ipucu { opacity: .85; }
  .kagit { box-sizing: border-box; width: ${yatay ? '297mm' : '210mm'}; max-width: calc(100vw - 32px); margin: 16px auto; padding: ${yatay ? '10mm' : '14mm 17mm'}; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,.15); }
  .kagit[contenteditable="true"]:focus { outline: none; }
  .kagit [contenteditable] *:hover { outline: 1px dashed #93c5fd; }
  .sayfa + .sayfa { break-before: page; margin-top: 24px; padding-top: 24px; border-top: 1px dashed #bbb; }
  .b { font-weight: bold; margin: 2pt 0; } .b1 { font-size: 13pt; } .b2 { font-size: 11.5pt; } .b3 { font-size: 10.5pt; }
  p { margin: 3pt 0; } .k { font-size: 8.5pt; }
  ul { margin: 2pt 0 4pt 14pt; padding: 0; }
  table.t { width: 100%; border-collapse: collapse; margin: 4pt 0 6pt; table-layout: fixed; }
  table.t td, table.t th { border: 0.5pt solid #000; padding: 2pt 3pt; font-size: 9.5pt; vertical-align: middle; word-wrap: break-word; white-space: pre-wrap; }
  table.t th { background: #eee; }
  table.t.k td, table.t.k th { font-size: 7.5pt; }
  table.kenarsiz td, table.kenarsiz th { border: 0; background: none; }
  table.dis { border: 0.5pt solid #000; } table.dis td, table.dis th { border: 0; } table.dis th { border-bottom: 0.5pt solid #000; }
  .logo { display: flex; align-items: center; gap: 8pt; font-weight: bold; font-size: 9pt; margin-bottom: 6pt; }
  @media print {
    body { background: #fff; } .arac { display: none; }
    .kagit { width: auto; max-width: none; margin: 0; padding: 0; box-shadow: none; }
    .kagit [contenteditable] *:hover { outline: none; }
    .sayfa + .sayfa { margin-top: 0; padding-top: 0; border-top: 0; }
    table.sayfa-sonu { break-inside: avoid; }
  }
</style></head>
<body>
<div class="arac"><b>${kac(belge.formAdi || belge.ad || 'Belge')}</b>
  <span class="ipucu">Düzenlemek için metnin üzerine tıklayın. Değişiklikler yalnızca bu çıktıya yansır, kaydedilmez.</span>
  <span style="flex:1"></span>
  <button type="button" onclick="window.print()">Yazdır / PDF olarak kaydet</button>
  <button type="button" class="ikincil" onclick="location.reload()">Değişiklikleri geri al</button>
</div>
<div class="kagit" contenteditable="true" spellcheck="false">
${sayfalar}
</div>
</body></html>`;
  return Promise.resolve(Buffer.from(html, 'utf8'));
}

// ---------------------------------------------------------------------------
const BICIMLER = {
  pdf: { uzanti: 'pdf', tur: 'application/pdf', olustur: pdfOlustur },
  docx: { uzanti: 'docx', tur: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', olustur: docxOlustur },
  xlsx: { uzanti: 'xlsx', tur: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', olustur: xlsxOlustur },
  html: { uzanti: 'html', tur: 'text/html; charset=utf-8', olustur: htmlOlustur }
};

async function olustur(belge, bicim) {
  const b = BICIMLER[bicim] || BICIMLER.pdf;
  // Tek sayfalık belgeler doğrudan "ogeler" ile verilebilir
  if (!belge.sayfalar) belge = { ...belge, sayfalar: [{ ad: belge.sayfaAdi, ogeler: belge.ogeler || [] }] };
  return { icerik: await b.olustur(belge), tur: b.tur, uzanti: b.uzanti };
}

module.exports = { olustur, BICIMLER };
