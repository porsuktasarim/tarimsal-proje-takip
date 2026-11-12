const mongoose = require('mongoose');
const Ayar = require('../moduller/ayarlar/modeller/Ayar');

// Veri dönüşümleri (göçler). Uygulama açılırken sırayla çalışır; uygulanan son
// dönüşümün numarası ayarlar belgesinde (gocSurumu) tutulur, her biri bir kez
// çalışır. Doğrudan koleksiyon üzerinde çalışılır, böylece eski biçimli
// kayıtlar şema dönüşümüne takılmaz.

const gocler = [
  {
    no: 1,
    aciklama: 'Normlar { deger, birim } biçimine, çeşitler nesneye çevrilir; ölçü birimlerine torba ve çuval eklenir',
    async uygula(db, ayar) {
      const tanimBirimi = Object.fromEntries((ayar.normlar || []).map((n) => [n.kod, n.birim || '']));
      const cevir = (normlar) => {
        const sonuc = {};
        Object.entries(normlar || {}).forEach(([k, v]) => {
          if (typeof v === 'number') sonuc[k] = { deger: v, birim: tanimBirimi[k] || '' };
          else if (v && typeof v === 'object' && v.deger !== undefined) sonuc[k] = { deger: Number(v.deger), birim: v.birim || tanimBirimi[k] || '' };
        });
        return sonuc;
      };

      const urunler = db.collection('urunler');
      for await (const u of urunler.find({})) {
        const cesitler = (u.cesitler || []).map((c) => (typeof c === 'string'
          ? { ad: c, normlar: {} }
          : { ...c, normlar: cevir(c.normlar) }));
        await urunler.updateOne({ _id: u._id }, { $set: { normlar: cevir(u.normlar), cesitler } });
      }

      const projeler = db.collection('projeler');
      for await (const p of projeler.find({})) {
        const kalemler = (p.kalemler || []).map((k) => ({ ...k, normlar: cevir(k.normlar) }));
        await projeler.updateOne({ _id: p._id }, { $set: { kalemler } });
      }

      const olcu = ayar.olcuBirimleri || [];
      const yeni = olcu.slice();
      ['torba', 'çuval'].forEach((b) => { if (!yeni.includes(b)) yeni.push(b); });
      if (yeni.length !== olcu.length) await Ayar.updateOne({ _id: 'genel' }, { $set: { olcuBirimleri: yeni } });
    }
  }
  ,
  {
    no: 2,
    aciklama: 'Rollere yetki, renk ve ilçe kısıtı eklenir; Sistem Yöneticisi rolü oluşturulur',
    async uygula(db, ayar) {
      const { varsayilanlar } = require('../config/sabitler');
      const v = (kod) => varsayilanlar.roller.find((r) => r.kod === kod) || {};
      const mevcut = ayar.roller && ayar.roller.length ? ayar.roller : varsayilanlar.roller;
      const roller = mevcut.filter((r) => r.kod !== 'admin').map((r) => ({
        kod: r.kod,
        ad: r.ad,
        aciklama: r.aciklama,
        renk: r.renk || v(r.kod).renk || 'secondary',
        ilceKisitli: r.ilceKisitli !== undefined ? r.ilceKisitli : !!v(r.kod).ilceKisitli,
        yetkiler: Array.isArray(r.yetkiler) ? r.yetkiler : (v(r.kod).yetkiler || [])
      }));
      const admin = (ayar.roller || []).find((r) => r.kod === 'admin') || v('admin');
      await Ayar.updateOne({ _id: 'genel' }, { $set: { roller: [admin, ...roller] } });
    }
  },
  {
    no: 3,
    aciklama: '(kaldırıldı; 4. dönüşüme bakınız)',
    async uygula() {}
  },
  {
    no: 4,
    aciklama: '"Bin dane ağırlığı" normu kaldırılır; ekim normu birimleri ambalaj içeriğinin birimine eşitlenir',
    async uygula(db, ayar) {
      const BD = 'bin_dane_agirligi';
      const ekim = (ayar.normlar || []).find((n) => n.tip === 'ekim');
      const ekimKod = ekim ? ekim.kod : null;
      await Ayar.updateOne({ _id: 'genel' }, { $set: { normlar: (ayar.normlar || []).filter((n) => n.kod !== BD) } });

      const duzelt = (normlar, ambalaj) => {
        const n = { ...(normlar || {}) };
        delete n[BD];
        // Yalnızca birimi boş olanlar eşitlenir; uyuşmayanlar (ör. adet/da ile kg içerik) değerin
        // anlamı değişeceği için olduğu gibi bırakılır, proje sayfasında uyarı ile düzeltilir.
        if (ekimKod && n[ekimKod] && !n[ekimKod].birim && ambalaj && ambalaj.miktar > 0 && ambalaj.birim) {
          n[ekimKod] = { ...n[ekimKod], birim: `${ambalaj.birim}/da` };
        }
        return n;
      };
      const urunler = db.collection('urunler');
      for await (const u of urunler.find({})) {
        const cesitler = (u.cesitler || []).map((c) => ({ ...c, normlar: duzelt(c.normlar, c.ambalaj || u.ambalaj) }));
        await urunler.updateOne({ _id: u._id }, { $set: { normlar: duzelt(u.normlar, u.ambalaj), cesitler } });
      }
      const projeler = db.collection('projeler');
      for await (const p of projeler.find({})) {
        const kalemler = (p.kalemler || []).map((k) => ({ ...k, normlar: duzelt(k.normlar, k.ambalaj) }));
        await projeler.updateOne({ _id: p._id }, { $set: { kalemler } });
      }
    }
  }
];

async function gocleriUygula() {
  const db = mongoose.connection.db;
  for (const g of gocler) {
    const ayar = await Ayar.findById('genel').lean();
    if ((ayar.gocSurumu || 0) >= g.no) continue;
    await g.uygula(db, ayar);
    await Ayar.updateOne({ _id: 'genel' }, { $set: { gocSurumu: g.no } });
    console.log(`[göç] ${g.no}: ${g.aciklama}`);
  }
}

module.exports = { gocleriUygula };
