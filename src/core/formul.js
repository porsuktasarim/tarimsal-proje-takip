// Proje değerlendirme formülleri için küçük, güvenli ifade çözümleyicisi.
// eval kullanılmaz; yalnızca aşağıdaki öğeler tanınır:
//
//   sayılar        12   3.5   3,5 (rakamlar arasındaki virgül ondalıktır)
//   değişkenler    buyukbas, yulaf_talep, kuru_ot, ot_ihtiyaci ...
//   işlemler       + - * / % ^ ve parantez
//   karşılaştırma  < <= > >= == != (doğruysa 1, değilse 0)
//   mantık         ve, veya, değil  (&&, ||, ! de olur)
//   işlevler       min(a; b; ...)  max(...)  yuvarla(x; basamak)  yukari(x)  asagi(x)
//                  mutlak(x)  karekok(x)  eger(koşul; doğruysa; yanlışsa)
//
// İşlev bağımsız değişkenleri ";" ile ayrılır ("," rakamlar arasında değilse o da olur).

const IKILI = {
  '||': [1, (a, b) => (a || b ? 1 : 0)],
  '&&': [2, (a, b) => (a && b ? 1 : 0)],
  '==': [3, (a, b) => (Math.abs(a - b) < 1e-9 ? 1 : 0)],
  '!=': [3, (a, b) => (Math.abs(a - b) >= 1e-9 ? 1 : 0)],
  '<': [4, (a, b) => (a < b ? 1 : 0)],
  '<=': [4, (a, b) => (a <= b + 1e-9 ? 1 : 0)],
  '>': [4, (a, b) => (a > b ? 1 : 0)],
  '>=': [4, (a, b) => (a >= b - 1e-9 ? 1 : 0)],
  '+': [5, (a, b) => a + b],
  '-': [5, (a, b) => a - b],
  '*': [6, (a, b) => a * b],
  '/': [6, (a, b) => a / b],
  '%': [6, (a, b) => a % b],
  '^': [8, (a, b) => a ** b]
};

const ISLEVLER = {
  min: (...a) => Math.min(...a),
  max: (...a) => Math.max(...a),
  yuvarla: (x, b = 0) => { const k = 10 ** b; return Math.round(x * k) / k; },
  yukari: (x) => Math.ceil(x - 1e-9),
  asagi: (x) => Math.floor(x + 1e-9),
  mutlak: (x) => Math.abs(x),
  karekok: (x) => Math.sqrt(x),
  eger: (k, a, b = 0) => (k ? a : b)
};
const ESLER = { round: 'yuvarla', ceil: 'yukari', floor: 'asagi', abs: 'mutlak', sqrt: 'karekok', if: 'eger', eğer: 'eger', yukarı: 'yukari', aşağı: 'asagi', karekök: 'karekok' };
const KELIMELER = { ve: '&&', veya: '||', and: '&&', or: '||', değil: '!', degil: '!', not: '!' };

class FormulHatasi extends Error {}

function parcala(metin) {
  const s = String(metin || '');
  const p = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i += 1; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && (/[0-9.]/.test(s[j]) || (s[j] === ',' && /[0-9]/.test(s[j - 1] || '') && /[0-9]/.test(s[j + 1] || '') && !/[a-zçğıöşü_]/i.test(s[j - 2] || '')))) j += 1;
      const n = Number(s.slice(i, j).replace(',', '.'));
      if (!Number.isFinite(n)) throw new FormulHatasi(`Sayı okunamadı: ${s.slice(i, j)}`);
      p.push({ t: 'sayi', v: n });
      i = j;
      continue;
    }
    if (/[a-zA-ZçğıöşüÇĞİÖŞÜ_]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z0-9çğıöşüÇĞİÖŞÜ_]/.test(s[j])) j += 1;
      const ad = s.slice(i, j).toLocaleLowerCase('tr');
      if (KELIMELER[ad]) p.push({ t: 'op', v: KELIMELER[ad] }); else p.push({ t: 'ad', v: ad });
      i = j;
      continue;
    }
    const iki = s.slice(i, i + 2);
    if (['<=', '>=', '==', '!=', '&&', '||'].includes(iki)) { p.push({ t: 'op', v: iki }); i += 2; continue; }
    if ('+-*/%^<>!'.includes(c)) { p.push({ t: 'op', v: c }); i += 1; continue; }
    if (c === '=') { p.push({ t: 'op', v: '==' }); i += 1; continue; }
    if (c === '(' || c === ')') { p.push({ t: c }); i += 1; continue; }
    if (c === ';' || c === ',') { p.push({ t: ';' }); i += 1; continue; }
    throw new FormulHatasi(`Tanınmayan karakter: "${c}"`);
  }
  return p;
}

// Öncelik tırmanmalı çözümleme; sonuç bir sözdizim ağacıdır.
function cozumle(metin) {
  const p = parcala(metin);
  if (!p.length) throw new FormulHatasi('Formül boş.');
  let i = 0;
  const bak = () => p[i];
  const al = () => p[i++];

  function birli() {
    const t = bak();
    if (!t) throw new FormulHatasi('Formül eksik bitiyor.');
    if (t.t === 'op' && (t.v === '-' || t.v === '+' || t.v === '!')) { al(); return { tur: 'birli', op: t.v, a: ifade(7) }; }
    if (t.t === 'sayi') { al(); return { tur: 'sayi', v: t.v }; }
    if (t.t === '(') {
      al();
      const d = ifade(0);
      if (!bak() || bak().t !== ')') throw new FormulHatasi('Kapanmayan parantez.');
      al();
      return d;
    }
    if (t.t === 'ad') {
      al();
      if (bak() && bak().t === '(') {
        al();
        const ad = ESLER[t.v] || t.v;
        if (!ISLEVLER[ad]) throw new FormulHatasi(`Tanınmayan işlev: ${t.v}`);
        const argumanlar = [];
        if (bak() && bak().t !== ')') {
          argumanlar.push(ifade(0));
          while (bak() && bak().t === ';') { al(); argumanlar.push(ifade(0)); }
        }
        if (!bak() || bak().t !== ')') throw new FormulHatasi(`${t.v}( kapanmıyor.`);
        al();
        if (!argumanlar.length) throw new FormulHatasi(`${t.v}() en az bir değer ister.`);
        return { tur: 'islev', ad, argumanlar };
      }
      return { tur: 'degisken', ad: t.v };
    }
    throw new FormulHatasi(`Beklenmeyen öğe: ${t.v || t.t}`);
  }

  function ifade(enAz) {
    let sol = birli();
    for (;;) {
      const t = bak();
      if (!t || t.t !== 'op' || !IKILI[t.v]) break;
      const [oncelik] = IKILI[t.v];
      if (oncelik < enAz) break;
      al();
      const sag = ifade(t.v === '^' ? oncelik : oncelik + 1);
      sol = { tur: 'ikili', op: t.v, a: sol, b: sag };
    }
    return sol;
  }

  const agac = ifade(0);
  if (i < p.length) throw new FormulHatasi(`Fazladan öğe: ${p[i].v || p[i].t}`);
  return agac;
}

function degiskenleri(agac, kume = new Set()) {
  if (!agac) return kume;
  if (agac.tur === 'degisken') kume.add(agac.ad);
  ['a', 'b'].forEach((k) => agac[k] && degiskenleri(agac[k], kume));
  (agac.argumanlar || []).forEach((x) => degiskenleri(x, kume));
  return kume;
}

function hesapla(agac, degerler) {
  switch (agac.tur) {
    case 'sayi': return agac.v;
    case 'degisken': {
      const v = degerler[agac.ad];
      if (v === undefined) throw new FormulHatasi(`Tanımsız değişken: ${agac.ad}`);
      return v == null ? 0 : Number(v);
    }
    case 'birli': {
      const a = hesapla(agac.a, degerler);
      if (agac.op === '-') return -a;
      if (agac.op === '!') return a ? 0 : 1;
      return a;
    }
    case 'ikili': return IKILI[agac.op][1](hesapla(agac.a, degerler), hesapla(agac.b, degerler));
    case 'islev': return ISLEVLER[agac.ad](...agac.argumanlar.map((x) => hesapla(x, degerler)));
    default: throw new FormulHatasi('Formül çözülemedi.');
  }
}

// Formülü denetler: sözdizimi ve bilinmeyen değişkenler. Hata yoksa null döner.
function denetle(metin, bilinenler) {
  try {
    const agac = cozumle(metin);
    const bilinmeyen = [...degiskenleri(agac)].filter((d) => !bilinenler.has(d));
    if (bilinmeyen.length) return `Tanımsız değişken: ${bilinmeyen.join(', ')}`;
    return null;
  } catch (e) {
    if (e instanceof FormulHatasi) return e.message;
    throw e;
  }
}

// Formülün değeri; hata ya da tanımsız sonuçta { deger: null, hata }
function degerlendir(metin, degerler) {
  try {
    const v = hesapla(cozumle(metin), degerler);
    if (!Number.isFinite(v)) return { deger: null, hata: 'Tanımsız sonuç (sıfıra bölme?)' };
    return { deger: v, hata: null };
  } catch (e) {
    if (e instanceof FormulHatasi) return { deger: null, hata: e.message };
    throw e;
  }
}

module.exports = { cozumle, denetle, degerlendir, degiskenleri, FormulHatasi, ISLEVLER };
