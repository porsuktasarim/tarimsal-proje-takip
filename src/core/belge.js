// Belge motoru: formlar bir kez, ortak bir belge modeliyle tanımlanır; aynı model
// PDF (pdfmake), Word (docx) ve Excel (exceljs) olarak üretilir.
//
// Belge modeli:
//   { ad, dosyaAdi, yon: 'dikey' | 'yatay', sayfalar: [ { ad?, ogeler: [ oge, ... ] } ] }
//   (tek sayfalık belgede sayfalar yerine doğrudan ogeler verilebilir)
// Öğeler:
//   { t: 'baslik', metin, boyut: 1|2|3, hiza? }                  ortalı kalın başlık
//   { t: 'p', metin | parcalar: [{ metin, kalin }], hiza?, kucuk? } paragraf ('iki' = iki yana yaslı)
//   { t: 'tablo', basliklar?, satirlar, genislik?, hizalar?, kenarsiz?, kucuk?, toplam? }
//       hücre: metin ya da { metin, kalin, hiza, birlesik (sütun sayısı) }
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
const parcalar = (o) => (o.parcalar || [{ metin: o.metin || '' }]);

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
      const sutun = Math.max(...[o.basliklar || [], ...(o.satirlar || [])].map((s) => s.reduce((t, h) => t + hucreBirlesik(h), 0)), 1);
      const hucre = (h, baslik, i) => {
        const b = hucreBirlesik(h);
        const c = {
          text: hucreMetni(h), bold: baslik || hucreKalin(h), colSpan: b > 1 ? b : undefined,
          alignment: PDF_HIZA[baslik ? 'orta' : hucreHiza(h, o.hizalar && o.hizalar[i])],
          fontSize: o.kucuk ? 7 : 9, fillColor: baslik ? '#eeeeee' : undefined
        };
        return c;
      };
      const satir = (s, baslik) => {
        const r = [];
        s.forEach((h, i) => { r.push(hucre(h, baslik, i)); for (let k = 1; k < hucreBirlesik(h); k += 1) r.push({}); });
        while (r.length < sutun) r.push({ text: '' });
        return r;
      };
      const govde = [];
      if (o.basliklar) govde.push(satir(o.basliklar, true));
      (o.satirlar || []).forEach((s) => govde.push(satir(s, false)));
      if (o.toplam) govde.push(satir(o.toplam.map((h) => (typeof h === 'object' ? { ...h, kalin: true } : { metin: h, kalin: true })), false));
      const toplamOran = (o.genislik || []).reduce((a, b) => a + b, 0);
      return {
        table: {
          headerRows: o.basliklar ? 1 : 0,
          widths: o.genislik && o.genislik.length === sutun ? o.genislik.map((g) => `${(100 * g) / toplamOran}%`) : Array(sutun).fill('*'),
          body: govde.length ? govde : [[{ text: '' }]]
        },
        layout: o.kenarsiz ? 'noBorders' : { hLineWidth: () => 0.5, vLineWidth: () => 0.5, paddingTop: () => 2, paddingBottom: () => 2 },
        margin: [0, 4, 0, 6]
      };
    }
    default:
      return { text: '' };
  }
}

function pdfOlustur(belge) {
  const icerik = [];
  belge.sayfalar.forEach((s, i) => {
    s.ogeler.forEach((o, j) => {
      const p = pdfOge(o);
      if (i > 0 && j === 0) p.pageBreak = 'before';
      icerik.push(p);
    });
  });
  const tanim = {
    pageSize: 'A4',
    pageOrientation: belge.yon === 'yatay' ? 'landscape' : 'portrait',
    pageMargins: belge.yon === 'yatay' ? [28, 28, 28, 28] : [48, 40, 48, 40],
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
      const sutun = Math.max(...[o.basliklar || [], ...(o.satirlar || [])].map((s) => s.reduce((t, h) => t + hucreBirlesik(h), 0)), 1);
      const oranlar = o.genislik && o.genislik.length === sutun ? o.genislik : Array(sutun).fill(1);
      const top = oranlar.reduce((a, b) => a + b, 0);
      const genislikler = oranlar.map((g) => Math.round((sayfaGenisligi * g) / top));
      const kenar = o.kenarsiz
        ? { top: { style: docx.BorderStyle.NONE }, bottom: { style: docx.BorderStyle.NONE }, left: { style: docx.BorderStyle.NONE }, right: { style: docx.BorderStyle.NONE }, insideHorizontal: { style: docx.BorderStyle.NONE }, insideVertical: { style: docx.BorderStyle.NONE } }
        : undefined;
      const boyut = o.kucuk ? 15 : 18;
      const satir = (s, baslik) => {
        let i = 0;
        const hucreler = s.map((h) => {
          const b = hucreBirlesik(h);
          const w = genislikler.slice(i, i + b).reduce((a, x) => a + x, 0);
          const hiza = baslik ? 'orta' : hucreHiza(h, o.hizalar && o.hizalar[i]);
          i += b;
          return new docx.TableCell({
            columnSpan: b > 1 ? b : undefined,
            width: { size: w, type: docx.WidthType.DXA },
            shading: baslik ? { fill: 'EEEEEE' } : undefined,
            verticalAlign: docx.VerticalAlign.CENTER,
            children: hucreMetni(h).split('\n').map((satirMetni) => docxParagraf([{ metin: satirMetni }], { hiza, kalin: baslik || hucreKalin(h), boyut, once: 20, sonra: 20 }))
          });
        });
        while (i < sutun) { hucreler.push(new docx.TableCell({ width: { size: genislikler[i], type: docx.WidthType.DXA }, children: [docxParagraf([{ metin: '' }])] })); i += 1; }
        return new docx.TableRow({ tableHeader: baslik, children: hucreler });
      };
      const satirlar = [];
      if (o.basliklar) satirlar.push(satir(o.basliklar, true));
      (o.satirlar || []).forEach((s) => satirlar.push(satir(s, false)));
      if (o.toplam) satirlar.push(satir(o.toplam.map((h) => (typeof h === 'object' ? { ...h, kalin: true } : { metin: h, kalin: true })), false));
      if (!satirlar.length) return [];
      return [new docx.Table({ rows: satirlar, width: { size: sayfaGenisligi, type: docx.WidthType.DXA }, columnWidths: genislikler, borders: kenar }), docxParagraf([{ metin: '' }])];
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
    // Sütun sayısı ve genişlikleri en çok sütunlu tablodan
    const tablolar = s.ogeler.filter((o) => o.t === 'tablo');
    const enGenis = tablolar.reduce((en, o) => {
      const n = Math.max(...[o.basliklar || [], ...(o.satirlar || [])].map((r) => r.reduce((t, h) => t + hucreBirlesik(h), 0)), 1);
      return n > en.n ? { n, o } : en;
    }, { n: 6, o: null });
    const sutun = enGenis.n;
    const toplamGenislik = belge.yon === 'yatay' ? 190 : 110;
    const oranlar = enGenis.o && enGenis.o.genislik && enGenis.o.genislik.length === sutun ? enGenis.o.genislik : Array(sutun).fill(1);
    const top = oranlar.reduce((a, b) => a + b, 0);
    oranlar.forEach((g, i) => { ws.getColumn(i + 1).width = Math.max(4, (toplamGenislik * g) / top); });
    const ortalamaGenislik = toplamGenislik;

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
        const yaz = (satir, baslik, toplamSatiri) => {
          let c = 1;
          let enCokSatir = 1;
          satir.forEach((h, i) => {
            let b = hucreBirlesik(h);
            const sonHucre = i === satir.length - 1;
            if (sonHucre && c + b - 1 < sutun) b = sutun - c + 1;     // kalan sütunları son hücre kaplar
            if (b > 1) ws.mergeCells(r, c, r, c + b - 1);
            const hc = ws.getCell(r, c);
            const m = hucreMetni(h);
            const sayi = !baslik ? sayiyaCevir(m) : null;
            hc.value = sayi != null && Number.isFinite(sayi) ? sayi : m;
            if (sayi != null) hc.numFmt = m.includes(',') ? '#,##0.00' : '#,##0';
            hc.font = { name: 'Times New Roman', size: o.kucuk ? 8 : 10, bold: baslik || toplamSatiri || hucreKalin(h) };
            hc.alignment = { horizontal: XLSX_HIZA[baslik ? 'orta' : hucreHiza(h, o.hizalar && o.hizalar[i])], vertical: 'middle', wrapText: true };
            if (baslik) hc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
            if (!o.kenarsiz) for (let k = c; k < c + b; k += 1) ws.getCell(r, k).border = { top: ince, left: ince, bottom: ince, right: ince };
            const w = Array.from({ length: b }, (_, k) => ws.getColumn(c + k).width || 10).reduce((a, x) => a + x, 0);
            enCokSatir = Math.max(enCokSatir, Math.ceil(m.length / Math.max(4, w * 1.1)) + (m.match(/\n/g) || []).length);
            c += b;
          });
          ws.getRow(r).height = Math.max(15, enCokSatir * 13);
          r += 1;
        };
        if (o.basliklar) yaz(o.basliklar, true);
        (o.satirlar || []).forEach((satir) => yaz(satir, false));
        if (o.toplam) yaz(o.toplam, false, true);
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
