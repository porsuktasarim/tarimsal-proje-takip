// Yüklenen dosyaların MongoDB GridFS'te saklanması. Dosyalar veritabanıyla birlikte
// (aynı Docker biriminde) durur; ayrı bir klasör ya da birim gerekmez.

const mongoose = require('mongoose');

const KOVA = 'dosyalar';
const kova = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: KOVA });

// Buffer'ı kaydeder, dosya kimliğini döner
function kaydet(icerik, ad, icerikTuru, ust = {}) {
  return new Promise((coz, reddet) => {
    const akis = kova().openUploadStream(ad, { metadata: { ...ust, icerikTuru } });
    akis.on('error', reddet);
    akis.on('finish', () => coz(akis.id));
    akis.end(icerik);
  });
}

async function bilgi(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const d = await kova().find({ _id: new mongoose.Types.ObjectId(String(id)) }).toArray();
  return d[0] || null;
}

function okumaAkisi(id) {
  return kova().openDownloadStream(new mongoose.Types.ObjectId(String(id)));
}

async function oku(id) {
  const parcalar = [];
  for await (const p of okumaAkisi(id)) parcalar.push(p);
  return Buffer.concat(parcalar);
}

async function sil(id) {
  try { await kova().delete(new mongoose.Types.ObjectId(String(id))); } catch (e) { /* zaten yok */ }
}

module.exports = { kaydet, bilgi, okumaAkisi, oku, sil };
