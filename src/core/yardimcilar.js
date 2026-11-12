const sayi = (n, basamak = 2) => {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '–';
  return Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: basamak });
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

const tarihOku = (v) => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

// Formdan gelen ondalıklı sayıları ("12,5", "1.250,5" ya da "12.5") okur.
const sayiOku = (v) => {
  if (v === undefined || v === null) return undefined;
  let s = String(v).trim();
  if (s === '') return undefined;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

// urlencoded form dizileri bazen nesne olarak gelir ({ '0': {...}, '1': {...} }).
const diziyeCevir = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v !== 'object') return [v];
  return Object.keys(v).sort((a, b) => Number(a) - Number(b)).map((k) => v[k]);
};

// Türkçe büyük/küçük harf duyarsız karşılaştırma anahtarı
const anahtar = (s) => String(s || '').trim().toLocaleLowerCase('tr').replace(/\s+/g, ' ');

// "Yeşil ot verimi" -> "yesil_ot_verimi"
const kodUret = (s) => anahtar(s)
  .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'norm';

// "kg/da" -> "kg": normun dekar ile çarpımından çıkan sonucun birimi
const sonucBirimi = (birim) => String(birim || '').replace(/\s*\/\s*(da|dekar)\s*$/i, '').trim() || '';

// Büyük kg değerlerini ton olarak da gösterir.
const miktar = (deger, birim) => {
  if (deger === null || deger === undefined || Number.isNaN(Number(deger))) return '–';
  if (birim === 'kg' && Math.abs(deger) >= 10000) return `${sayi(deger / 1000, 1)} ton`;
  return `${sayi(deger)}${birim ? ' ' + birim : ''}`;
};

// Mongoose Map ya da düz nesneden değer okur.
const mapDeger = (m, k) => {
  if (!m) return undefined;
  if (typeof m.get === 'function') return m.get(k);
  return m[k];
};

module.exports = {
  sayi, tarih, inputTarih, tarihOku, sayiOku, diziyeCevir, anahtar, kodUret, sonucBirimi, miktar, mapDeger
};
