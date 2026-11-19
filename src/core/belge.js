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
const BICIMLER = {
  pdf: { uzanti: 'pdf', tur: 'application/pdf', olustur: pdfOlustur },
  docx: { uzanti: 'docx', tur: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', olustur: docxOlustur },
  xlsx: { uzanti: 'xlsx', tur: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', olustur: xlsxOlustur }
};

async function olustur(belge, bicim) {
  const b = BICIMLER[bicim] || BICIMLER.pdf;
  // Tek sayfalık belgeler doğrudan "ogeler" ile verilebilir
  if (!belge.sayfalar) belge = { ...belge, sayfalar: [{ ad: belge.sayfaAdi, ogeler: belge.ogeler || [] }] };
  return { icerik: await b.olustur(belge), tur: b.tur, uzanti: b.uzanti };
}

module.exports = { olustur, BICIMLER };
