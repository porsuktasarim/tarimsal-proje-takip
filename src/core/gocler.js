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
