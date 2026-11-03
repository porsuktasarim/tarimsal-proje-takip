const sayi = (n, basamak = 0) => {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '–';
  return Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: basamak || 2 });
};

const tarih = (t) => {
  if (!t) return '–';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const inputTarih = (t) => {
  if (!t) return '';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

// Formdan gelen ondalıklı sayıları ("12,5" ya da "12.5") okur.
const sayiOku = (v) => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim().replace(/\./g, (m, i, str) => (str.includes(',') ? '' : m)).replace(',', '.');
  if (s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

// urlencoded form dizileri bazen nesne olarak gelir ({ '0': {...}, '1': {...} }).
const diziyeCevir = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return Object.keys(v).sort((a, b) => Number(a) - Number(b)).map((k) => v[k]);
};

module.exports = { sayi, tarih, inputTarih, sayiOku, diziyeCevir };
