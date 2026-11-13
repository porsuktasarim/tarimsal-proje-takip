(function () {
  'use strict';

  // --- Ekim normunun birimi ambalaj içeriğinin birimine bağlıdır ---
  // Proje kaleminde kalemin ambalajı; ürün formunda ürünün ambalajı, çeşitte
  // içerik girilmişse çeşidin ambalajı esas alınır (ör. 1 paket = 50.000 adet → adet/da).
  // Payda talep birimidir: tohumda da, fidanda adet, naylonda m² (ör. adet/da, adet/adet, m²/m²).
  var ekimBirimleriniEsitle = function () {
    var urunAmb = document.querySelector('#urun-ambalaj .ambalaj-birim');
    var urunTb = document.getElementById('urun-talep-birimi');
    document.querySelectorAll('[data-ekim-birim]').forEach(function (inp) {
      var blok = inp.closest('.kalem-blok');
      var birim = null;
      if (blok && blok.querySelector('.ambalaj-birim')) {
        var m = parseFloat(blok.querySelector('.ambalaj-miktar').value);
        if (!urunAmb || (!isNaN(m) && m > 0)) birim = blok.querySelector('.ambalaj-birim').value;
      }
      if (!birim && urunAmb) birim = urunAmb.value;
      var tbEl = (blok && blok.querySelector('.kalem-talep-birimi')) || urunTb;
      var tb = tbEl ? tbEl.value : 'da';
      if (birim) { inp.value = birim + '/' + tb; inp.placeholder = birim + '/' + tb; }
    });
  };
  document.addEventListener('change', function (e) { if (e.target.matches('.ambalaj-birim, .ambalaj-miktar, .talep-birimi')) ekimBirimleriniEsitle(); });
  document.addEventListener('input', function (e) { if (e.target.matches('.ambalaj-miktar')) ekimBirimleriniEsitle(); });
  document.addEventListener('satir-eklendi', ekimBirimleriniEsitle);

  // --- Ürün formu: normsuz türde (makine, ekipman) normlar gizlenir ---
  var urunTur = document.getElementById('urun-tur');
  if (urunTur) {
    var normsuzlar = JSON.parse(urunTur.getAttribute('data-normsuz-turler') || '[]');
    var urunNormlar = document.getElementById('urun-normlar');
    urunTur.addEventListener('change', function () { if (urunNormlar) urunNormlar.classList.toggle('d-none', normsuzlar.indexOf(urunTur.value) >= 0); });
  }

  // --- Tema değiştirme (açık / koyu) ---
  document.querySelectorAll('.tema-degistir').forEach(function (dugme) {
    dugme.addEventListener('click', function (e) {
      e.preventDefault();
      var kok = document.documentElement;
      var yeni = kok.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
      kok.setAttribute('data-bs-theme', yeni);
      try { localStorage.setItem('tpts-tema', yeni); } catch (err) { /* depolama kapalı olabilir */ }
    });
  });

  // --- Dinamik satırlar ---
  // [data-satirlar="ad"] kabının doğrudan çocukları satırdır (tablo için tbody,
  // blok listesi için div). <template id="ad-sablon"> klonlanır; şablondaki
  // __i__ satır sırasıyla, __u__ benzersiz bir kimlikle değiştirilir.
  var sayac = 0;

  function satirlar(kap) {
    return Array.prototype.filter.call(kap.children, function (el) { return el.tagName !== 'TEMPLATE'; });
  }

  function yenile(kap) {
    var ad = kap.getAttribute('data-satirlar');
    var desen = new RegExp('^' + ad + '\\[[^\\]]*\\]');
    satirlar(kap).forEach(function (satir, i) {
      satir.querySelectorAll('[name]').forEach(function (el) {
        if (desen.test(el.name)) el.name = el.name.replace(desen, ad + '[' + i + ']');
      });
      satir.querySelectorAll('[data-sira-deger]').forEach(function (el) { el.value = i; });
      satir.querySelectorAll('.satir-no').forEach(function (el) { el.textContent = i + 1; });
    });
    var bos = document.querySelector('[data-satir-bos="' + ad + '"]');
    if (bos) bos.classList.toggle('d-none', satirlar(kap).length > 0);
  }

  document.querySelectorAll('[data-satirlar]').forEach(function (kap) {
    var ad = kap.getAttribute('data-satirlar');
    var sablon = document.getElementById(ad + '-sablon');

    document.querySelectorAll('[data-satir-ekle="' + ad + '"]').forEach(function (ekle) {
      ekle.addEventListener('click', function () {
        if (!sablon) return;
        var i = satirlar(kap).length;
        var gecici = document.createElement(kap.tagName === 'TBODY' ? 'tbody' : 'div');
        gecici.innerHTML = sablon.innerHTML.replace(/__i__/g, i).replace(/__u__/g, 'y' + Date.now() + (sayac++));
        var yeni = gecici.firstElementChild;
        kap.appendChild(yeni);
        yenile(kap);
        kap.dispatchEvent(new CustomEvent('satir-eklendi', { detail: yeni, bubbles: true }));
        var ilk = yeni.querySelector('input:not([type=hidden]), select');
        if (ilk) ilk.focus();
      });
    });

    kap.addEventListener('click', function (e) {
      var sil = e.target.closest('[data-satir-sil]');
      if (!sil || sil.disabled) return;
      e.preventDefault();
      var satir = sil;
      while (satir && satir.parentElement !== kap) satir = satir.parentElement;
      if (satir) satir.remove();
      yenile(kap);
    });

    yenile(kap);
  });

  // --- İlçe seçimi ---
  var ilceTablosu = document.querySelector('[data-ilce-tablosu]');
  if (ilceTablosu) {
    var kutular = ilceTablosu.querySelectorAll('input.ilce-sec');
    var tumu = document.querySelector('[data-ilce-tumu]');
    var ilceSayac = document.querySelector('[data-ilce-sayac]');

    var ilceGuncelle = function () {
      var secili = 0;
      kutular.forEach(function (k) {
        var tr = k.closest('tr');
        tr.classList.toggle('secili-degil', !k.checked);
        tr.querySelectorAll('input[type="number"]').forEach(function (s) { s.disabled = !k.checked; });
        if (k.checked) secili++;
      });
      if (ilceSayac) ilceSayac.textContent = secili;
      if (tumu) {
        tumu.checked = secili === kutular.length;
        tumu.indeterminate = secili > 0 && secili < kutular.length;
      }
    };

    kutular.forEach(function (k) { k.addEventListener('change', ilceGuncelle); });
    if (tumu) {
      tumu.addEventListener('change', function () {
        kutular.forEach(function (k) { k.checked = tumu.checked; });
        ilceGuncelle();
      });
    }
    ilceGuncelle();
  }

  // --- Dağıtım birimi değişince ambalaj etiketleri ("1 torba =") güncellenir ---
  document.addEventListener('change', function (e) {
    if (!e.target.matches('.dagitim-birimi')) return;
    var kapsam = e.target.closest('[data-ambalaj-kapsam]') || document;
    var b = e.target.value;
    kapsam.querySelectorAll('.ambalaj-etiket').forEach(function (el) { el.textContent = '1 ' + b + ' ='; });
    kapsam.querySelectorAll('.ambalaj-etiket-birim').forEach(function (el) { el.textContent = b; });
  });

  // --- Proje formu: ürün kataloğu ile kalem doldurma ---
  var katalogEl = document.getElementById('urun-katalogu');
  if (katalogEl) {
    var veri = JSON.parse(katalogEl.textContent);
    var anahtar = function (s) { return String(s || '').trim().toLocaleLowerCase('tr').replace(/\s+/g, ' '); };
    var sayiYaz = function (n) { return Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 2 }); };
    var sonucBirimi = function (b) { return String(b || '').replace(/\s*\/\s*(da|dekar)\s*$/i, '').trim(); };

    var urunBul = function (tur, ad) {
      var k = anahtar(ad);
      if (!k) return null;
      for (var i = 0; i < veri.urunler.length; i++) {
        var u = veri.urunler[i];
        if (u.tur === tur && anahtar(u.ad) === k) return u;
      }
      return null;
    };
    var cesitBul = function (urun, ad) {
      var k = anahtar(ad);
      if (!urun || !k) return null;
      for (var i = 0; i < urun.cesitler.length; i++) if (anahtar(urun.cesitler[i].ad) === k) return urun.cesitler[i];
      return null;
    };
    // Ürün + çeşit katmanlarından etkin varsayılanlar
    var etkin = function (urun, cesitAd) {
      var c = cesitBul(urun, cesitAd);
      var normlar = {};
      Object.keys(urun.normlar || {}).forEach(function (k) { normlar[k] = urun.normlar[k]; });
      if (c) Object.keys(c.normlar || {}).forEach(function (k) { normlar[k] = c.normlar[k]; });
      return { talepBirimi: urun.talepBirimi || 'da', olcuBirimi: urun.olcuBirimi, ambalaj: (c && c.ambalaj) || urun.ambalaj || null, normlar: normlar };
    };

    // "oto" işaretli alanlar katalogdan doldurulmuştur; kullanıcı elle değiştirince işaret kalkar
    // ve sonraki ürün/çeşit seçimlerinde üzerine yazılmaz.
    var doldurulabilir = function (el) { return el.value === '' || el.dataset.oto === '1'; };
    var yaz = function (el, deger) { el.value = deger === undefined || deger === null ? '' : deger; el.dataset.oto = '1'; };
    var seciliYap = function (select, deger) {
      if (!deger) return;
      var var_ = Array.prototype.some.call(select.options, function (o) { return o.value === deger; });
      if (!var_) { var o = document.createElement('option'); o.textContent = deger; select.appendChild(o); }
      select.value = deger;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // Normsuz türde (makine, ekipman, malzeme) norm alanları gizlenir; ambalaj isteğe bağlıdır
    // ve içeriği talep birimindedir (1 top = 100 m²).
    var normsuzGuncelle = function (blok) {
      var normsuz = (veri.normsuzTurler || []).indexOf(blok.querySelector('.kalem-tur').value) >= 0;
      blok.classList.toggle('kalem-normsuz', normsuz);
      blok.querySelectorAll('.yalniz-normlu').forEach(function (el) { el.classList.toggle('d-none', normsuz); });
      blok.querySelectorAll('.yalniz-normsuz').forEach(function (el) { el.classList.toggle('d-none', !normsuz); });
      blok.querySelector('.kalem-ambalaj-etiket').classList.toggle('required', !normsuz);
      var aMiktar = blok.querySelector('.ambalaj-miktar');
      if (normsuz) aMiktar.removeAttribute('required'); else aMiktar.setAttribute('required', '');
      if (normsuz) {
        var aBirim = blok.querySelector('.ambalaj-birim');
        var tb = blok.querySelector('.kalem-talep-birimi').value;
        if (aBirim.value !== tb) seciliYap(aBirim, tb);
      }
      return normsuz;
    };

    var kalemGuncelle = function (blok, doldur) {
      normsuzGuncelle(blok);
      var tur = blok.querySelector('.kalem-tur').value;
      var urunInput = blok.querySelector('.kalem-urun');
      var cesitInput = blok.querySelector('.kalem-cesit');
      var turSira = veri.turler.indexOf(tur);
      urunInput.setAttribute('list', 'dl-urun-' + (turSira < 0 ? 0 : turSira));

      var urun = urunBul(tur, urunInput.value);
      blok.querySelector('.kalem-urun-id').value = urun ? urun._id : '';
      var cesit = cesitBul(urun, cesitInput.value);
      var e = urun ? etkin(urun, cesitInput.value) : null;

      // Çeşit önerileri
      var dl = document.getElementById(cesitInput.getAttribute('list'));
      if (dl) {
        dl.innerHTML = '';
        (urun ? urun.cesitler : []).forEach(function (c) {
          var o = document.createElement('option');
          o.value = c.ad;
          dl.appendChild(o);
        });
      }

      // Durum etiketi
      var durum = '';
      if (urunInput.value.trim() && !urun) {
        durum = '<span class="badge bg-yellow-lt"><i class="ti ti-sparkles me-1"></i>Yeni ürün · kaydedilince kataloğa eklenir</span>';
      } else if (urun && cesitInput.value.trim() && !cesit) {
        durum = '<span class="badge bg-yellow-lt"><i class="ti ti-sparkles me-1"></i>Yeni çeşit · kaydedilince kataloğa eklenir</span>';
      } else if (urun) {
        durum = '<span class="text-secondary"><i class="ti ti-check me-1"></i>Katalogdan' + (cesit && Object.keys(cesit.normlar || {}).length ? ' · çeşide özel normlar' : '') + '</span>';
      }
      blok.querySelector('.kalem-durum').innerHTML = durum;

      // Normlar: değer ve birim birlikte doldurulur.
      blok.querySelectorAll('.norm-cifti').forEach(function (cift) {
        var dEl = cift.querySelector('.norm-deger');
        var bEl = cift.querySelector('.norm-birim');
        var v = e ? e.normlar[dEl.getAttribute('data-norm')] : null;
        dEl.placeholder = v ? String(v.deger) : '';
        if (doldur && e && doldurulabilir(dEl)) {
          yaz(dEl, v ? v.deger : '');
          yaz(bEl, (v && v.birim) || bEl.getAttribute('data-varsayilan-birim'));
        }
      });

      if (doldur && e) {
        var olcu = blok.querySelector('.kalem-olcu');
        if (olcu.dataset.oto !== '0') { seciliYap(olcu, e.olcuBirimi); olcu.dataset.oto = '1'; }
        var tbSec = blok.querySelector('.kalem-talep-birimi');
        if (tbSec && tbSec.dataset.oto !== '0') { seciliYap(tbSec, e.talepBirimi); tbSec.dataset.oto = '1'; }
        var aMiktar = blok.querySelector('.ambalaj-miktar');
        var aBirim = blok.querySelector('.ambalaj-birim');
        if (doldurulabilir(aMiktar)) {
          yaz(aMiktar, e.ambalaj ? e.ambalaj.miktar : '');
          if (e.ambalaj) { seciliYap(aBirim, e.ambalaj.birim); aBirim.dataset.oto = '1'; }
        }
      }
      ekimBirimleriniEsitle();
      miktarIpucu(blok);
      if (doldur) fiyatBirimleri(blok);
    };

    // Toplam dağıtım boşsa hesaplanan değer ipucu olarak gösterilir.
    var miktarIpucu = function (blok) {
      var miktar = blok.querySelector('.kalem-miktar');
      var alan = parseFloat(blok.querySelector('.kalem-alan').value);
      var ekimCift = veri.ekimKod ? blok.querySelector('.norm-deger[data-norm="' + veri.ekimKod + '"]') : null;
      var ipucu = 'Hesaplanır';
      var olcuyeGore = blok.querySelector('.kalem-olcuye-gore');
      var yuvarla = function (v) { return olcuyeGore && olcuyeGore.checked ? v : Math.ceil(v - 1e-9); };
      if (blok.classList.contains('kalem-normsuz')) {
        var am = parseFloat(blok.querySelector('.ambalaj-miktar').value);
        if (!isNaN(alan)) ipucu = 'Hesap: ' + sayiYaz(!isNaN(am) && am > 0 ? yuvarla(alan / am) : alan) + ' ' + blok.querySelector('.kalem-olcu').value;
      } else if (ekimCift) {
        var cift = ekimCift.closest('.norm-cifti');
        var norm = parseFloat(ekimCift.value !== '' ? ekimCift.value : ekimCift.placeholder);
        var birim = sonucBirimi(cift.querySelector('.norm-birim').value || cift.querySelector('.norm-birim').placeholder);
        var dagitim = blok.querySelector('.kalem-olcu').value;
        if (!isNaN(alan) && !isNaN(norm)) {
          var ihtiyac = alan * norm;
          var aMiktar = parseFloat(blok.querySelector('.ambalaj-miktar').value);
          var aBirim = blok.querySelector('.ambalaj-birim').value;
          // Ekim normunun birimi ambalaj içeriğinin birimine bağlı olduğundan doğrudan bölünür
          if (!isNaN(aMiktar) && aMiktar > 0) ipucu = 'Hesap: ' + sayiYaz(yuvarla(ihtiyac / aMiktar)) + ' ' + dagitim;
          else if (isNaN(aMiktar) && anahtar(birim) === anahtar(dagitim)) ipucu = 'Hesap: ' + sayiYaz(ihtiyac);
          else ipucu = 'İhtiyaç ' + sayiYaz(ihtiyac) + ' ' + birim;
        }
      }
      miktar.placeholder = ipucu;
    };

    // Fiyat birimi seçenekleri: ambalaj içeriğinin birimi (TL/kg) ve dağıtım birimi (TL/çuval)
    var fiyatBirimleri = function (blok) {
      var sec = blok.querySelector('.kalem-fiyat-birimi');
      if (!sec) return;
      var olcu = blok.querySelector('.kalem-olcu').value;
      var aMiktar = parseFloat(blok.querySelector('.ambalaj-miktar').value);
      var aBirim = blok.querySelector('.ambalaj-birim').value;
      var secenekler = [];
      if (!isNaN(aMiktar) && aMiktar > 0) secenekler.push(aBirim);
      if (secenekler.indexOf(olcu) < 0) secenekler.push(olcu);
      // Elle seçilmemişse ambalaj içeriğinin birimi (TL/kg) varsayılır
      var onceki = sec.dataset.elle === '1' ? sec.value : null;
      sec.innerHTML = '';
      secenekler.forEach(function (b) { var o = document.createElement('option'); o.textContent = b; sec.appendChild(o); });
      sec.value = onceki && secenekler.indexOf(onceki) >= 0 ? onceki : secenekler[0];
    };

    var form = document.getElementById('proje-formu');
    var blokOf = function (el) { return el.closest('.kalem-blok'); };

    form.addEventListener('change', function (e) {
      var b = blokOf(e.target);
      if (!b) return;
      if (e.isTrusted && e.target.matches('.kalem-olcu, .ambalaj-birim, .kalem-talep-birimi')) e.target.dataset.oto = '0';
      if (e.isTrusted && e.target.matches('.kalem-fiyat-birimi')) e.target.dataset.elle = '1';
      if (e.target.matches('.kalem-tur, .kalem-urun, .kalem-cesit')) kalemGuncelle(b, true);
      else { if (e.target.matches('.kalem-talep-birimi')) normsuzGuncelle(b); miktarIpucu(b); }
      if (!e.target.matches('.kalem-fiyat-birimi')) fiyatBirimleri(b);
    });
    form.addEventListener('input', function (e) {
      var b = blokOf(e.target);
      if (!b) return;
      if (e.target.matches('.norm-deger, .norm-birim, .ambalaj-miktar')) {
        e.target.dataset.oto = '0';
        // Değer ya da birim elle değişince çift birlikte kilitlenir.
        var cift = e.target.closest('.norm-cifti');
        if (cift) cift.querySelectorAll('input').forEach(function (i) { i.dataset.oto = '0'; });
      }
      if (e.target.matches('.kalem-urun, .kalem-cesit')) kalemGuncelle(b, false);
      else miktarIpucu(b);
      if (e.target.matches('.ambalaj-miktar')) fiyatBirimleri(b);
    });
    form.addEventListener('satir-eklendi', function (e) {
      if (e.detail && e.detail.classList.contains('kalem-blok')) { kalemGuncelle(e.detail, false); fiyatBirimleri(e.detail); }
    });
    form.querySelectorAll('.kalem-blok').forEach(function (b) { kalemGuncelle(b, false); });
  }

  // --- Talep formu: T.C. sorgusu ve canlı özet ---
  var talepVeriEl = document.getElementById('talep-verisi');
  if (talepVeriEl) {
    var tv = JSON.parse(talepVeriEl.textContent);
    var tForm = document.getElementById('talep-formu');
    var tcInput = tForm.querySelector('[data-tc]');
    var tcDurum = tForm.querySelector('[data-tc-durum]');
    var ilceSec = tForm.querySelector('[data-ciftci-ilce]');
    var ozetEl = tForm.querySelector('[data-talep-ozet]');
    var sy = function (n) { return Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 2 }); };
    var tl = function (n) { return Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL'; };
    var esit = function (a, b) { return String(a || '').trim().toLocaleLowerCase('tr') === String(b || '').trim().toLocaleLowerCase('tr'); };
    var kacis = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

    var tcSorgula = function () {
      var tc = (tcInput.value || '').replace(/\D/g, '');
      if (tc.length !== 11) { tcDurum.textContent = ''; return; }
      fetch('/ciftciler/tc/' + tc).then(function (r) { return r.json(); }).then(function (c) {
        if (c.bulundu) {
          var ciftci = c.ciftci;
          ['adSoyad', 'telefon', 'mahalle', 'adres'].forEach(function (a) {
            var el = tForm.querySelector('[data-alan="' + a + '"]');
            if (el) el.value = ciftci[a] || '';
          });
          var cks = tForm.querySelector('[data-alan="cks"]');
          if (cks) cks.checked = !!ciftci.cks;
          tForm.querySelectorAll('[data-hayvan]').forEach(function (el) {
            var v = ciftci.hayvanlar ? ciftci.hayvanlar[el.getAttribute('data-hayvan')] : null;
            if (el.value === '') el.value = v != null ? v : '';
          });
          if (!Array.prototype.some.call(ilceSec.options, function (o) { return o.value === ciftci.ilce; })) {
            var o = document.createElement('option'); o.textContent = ciftci.ilce; ilceSec.appendChild(o);
          }
          ilceSec.value = ciftci.ilce;
          tcDurum.innerHTML = '<span class="text-green"><i class="ti ti-user-check"></i> Kayıtlı çiftçi: ' + kacis(ciftci.ilce) + '</span>';
        } else {
          tcDurum.innerHTML = c.gecerli ? '<span class="text-secondary"><i class="ti ti-user-plus"></i> Yeni çiftçi; kaydedilecek</span>'
            : '<span class="text-red"><i class="ti ti-alert-circle"></i> T.C. kimlik numarası geçersiz</span>';
        }
      }).catch(function () { tcDurum.textContent = ''; });
    };
    tcInput.addEventListener('change', tcSorgula);
    tcInput.addEventListener('input', function () { if (tcInput.value.replace(/\D/g, '').length === 11) tcSorgula(); });
    var sorguDugme = tForm.querySelector('[data-tc-sorgula]');
    if (sorguDugme) sorguDugme.addEventListener('click', tcSorgula);

    // Çiftçinin ilçesi seçilince ilçesi boş parsellere de yazılır
    ilceSec.addEventListener('change', function () {
      tForm.querySelectorAll('.talep-parsel-ilce').forEach(function (s) { if (!s.value && ilceSec.value) s.value = ilceSec.value; });
    });
    // Yeni parsel satırının ilçesi çiftçinin ilçesi olur
    tForm.addEventListener('satir-eklendi', function (e) {
      var s = e.detail.querySelector('.talep-parsel-ilce');
      if (s && ilceSec.value) s.value = ilceSec.value;
      ozetGuncelle();
    });

    // Bir kalemin verilen talep miktarı (da, adet, m²) için dağıtım miktarı ve bedeli
    var kalemHesap = function (k, m) {
      var r = { ihtiyac: null, miktar: null, teslim: null, teslimBirimi: null, bedel: null, katki: null, uyumsuz: false };
      if (k.ekim == null) return r;
      r.ihtiyac = m * k.ekim;
      if (k.ambalaj && esit(k.ambalaj.birim, k.ihtiyacBirimi)) {
        var bolum = r.ihtiyac / k.ambalaj.miktar;
        r.miktar = k.olcuyeGore ? bolum : Math.ceil(bolum - 1e-9); r.teslim = r.miktar * k.ambalaj.miktar; r.teslimBirimi = k.ambalaj.birim;
      } else if (!k.ambalaj && (k.normsuz || esit(k.ihtiyacBirimi, k.olcuBirimi))) {
        r.miktar = r.ihtiyac; r.teslim = r.ihtiyac; r.teslimBirimi = k.olcuBirimi;
      } else { r.uyumsuz = true; return r; }
      if (k.birimFiyat != null) {
        r.bedel = esit(k.fiyatBirimi, k.olcuBirimi) ? r.miktar * k.birimFiyat : (esit(k.fiyatBirimi, r.teslimBirimi) ? r.teslim * k.birimFiyat : null);
        if (r.bedel != null && tv.katkiOrani != null) r.katki = r.bedel * tv.katkiOrani / 100;
      }
      return r;
    };
    var hesapMetni = function (k, m, r) {
      var t = sy(m) + ' ' + kacis(k.talepBirimi);
      if (r.miktar == null) return t;
      t += ' → <strong>' + sy(r.miktar) + ' ' + kacis(k.olcuBirimi) + '</strong>';
      if (k.ambalaj && !esit(k.ambalaj.birim, k.olcuBirimi)) t += ' <span class="text-secondary">(' + sy(r.teslim) + ' ' + kacis(r.teslimBirimi) + ')</span>';
      if (r.bedel != null) t += '<div class="text-secondary">Bedel ' + tl(r.bedel) + (r.katki != null ? ' · katkı ' + tl(r.katki) : '') + '</div>';
      return t;
    };
    var birimMetni = function (o) {
      var p = Object.keys(o).map(function (b) { return sy(o[b]) + ' ' + kacis(b); });
      return p.length ? p.join(' · ') : '–';
    };

    var ozetGuncelle = function () {
      var kalemBul = function (id) { return tv.kalemler.filter(function (k) { return k._id === id; })[0]; };
      var parsel = {};
      tForm.querySelectorAll('tbody[data-satirlar] > tr').forEach(function (tr) {
        var id = tr.querySelector('.talep-kalem').value;
        var k = kalemBul(id);
        var be = tr.querySelector('.talep-satir-birim');
        if (be) be.textContent = k ? k.talepBirimi : '–';
        // m² ile sayılan kalemde en × boy girilirse miktar hesaplanır
        var eb = tr.querySelector('.talep-en-boy');
        if (eb) {
          eb.classList.toggle('d-none', !(k && k.talepBirimi === 'm²'));
          var en = parseFloat(tr.querySelector('.talep-en').value), boy = parseFloat(tr.querySelector('.talep-boy').value);
          if (k && k.talepBirimi === 'm²' && en > 0 && boy > 0 && eb.dataset.son !== en + 'x' + boy) {
            tr.querySelector('.talep-alan').value = Math.round(en * boy * 100) / 100; eb.dataset.son = en + 'x' + boy;
          }
        }
        var a = parseFloat(tr.querySelector('.talep-alan').value);
        if (!k || isNaN(a)) return;
        parsel[id] = (parsel[id] || 0) + a;
      });
      var talep = {};
      tForm.querySelectorAll('[data-talep-kalem]').forEach(function (tr) {
        var id = tr.getAttribute('data-talep-kalem');
        var k = kalemBul(id);
        var v = parseFloat(tr.querySelector('.talep-miktari').value);
        if (!isNaN(v) && v > 0) talep[id] = v;
        tr.querySelector('[data-parsel-toplam]').textContent = parsel[id] != null ? sy(parsel[id]) + ' ' + k.talepBirimi : '–';
        var f = tr.querySelector('[data-fark]');
        if (talep[id] != null && parsel[id] != null && Math.abs(parsel[id] - talep[id]) > 1e-9) {
          var d = parsel[id] - talep[id];
          f.innerHTML = '<span class="badge bg-yellow-lt">' + (d > 0 ? '+' : '') + sy(d) + ' ' + kacis(k.talepBirimi) + '</span>';
        } else if (talep[id] != null && parsel[id] == null) {
          f.innerHTML = '<span class="text-secondary small">parsel yok</span>';
        } else if (talep[id] != null) {
          f.innerHTML = '<span class="text-green"><i class="ti ti-check"></i></span>';
        } else f.textContent = '–';
      });

      var html = '';
      var toplamlar = {};
      var bedel = 0, katki = 0, bedelVar = false, parselBedel = 0, parselBedelVar = false, parselsizVar = false;
      tv.kalemler.forEach(function (k) {
        var tm = talep[k._id], pm = parsel[k._id];
        if (tm == null && pm == null) return;
        var esas = tm != null ? tm : pm;
        toplamlar[k.talepBirimi] = (toplamlar[k.talepBirimi] || 0) + esas;
        var satir = '<div class="mb-2"><div class="fw-medium">' + kacis(k.ad) + '</div>';
        if (k.ekim == null) {
          satir += '<div class="small text-secondary">' + sy(esas) + ' ' + kacis(k.talepBirimi) + ' · ekim normu tanımlı değil</div></div>';
          html += satir; return;
        }
        var rt = tm != null ? kalemHesap(k, tm) : null;
        var rp = pm != null ? kalemHesap(k, pm) : null;
        var re = rt || rp;
        if (re.uyumsuz) {
          html += satir + '<div class="small text-warning">Ekim normu ile ambalaj içeriğinin birimi uyuşmuyor; proje kalemi düzenlenip kaydedilmelidir</div></div>';
          return;
        }
        if (rt) satir += '<div class="small"><span class="badge bg-primary-lt me-1">Talep</span>' + hesapMetni(k, tm, rt) + '</div>';
        if (rp && (!rt || Math.abs(pm - tm) > 1e-9)) satir += '<div class="small mt-1"><span class="badge bg-secondary-lt me-1">Parsel</span>' + hesapMetni(k, pm, rp) + '</div>';
        else if (rp) satir += '<div class="small text-green mt-1"><i class="ti ti-check"></i> Parseller talebe eşit</div>';
        if (re.bedel != null) { bedel += re.bedel; bedelVar = true; if (re.katki != null) katki += re.katki; }
        if (rp && rp.bedel != null) { parselBedel += rp.bedel; parselBedelVar = true; }
        if (!rp) parselsizVar = true;
        html += satir + '</div>';
      });
      if (!html) { ozetEl.innerHTML = '<div class="text-secondary">Talep ve parseller girildikçe hesaplanır.</div>'; return; }
      var dekar = toplamlar.da || 0;
      var uyari = '';
      if (tv.azamiAlan != null && dekar > tv.azamiAlan) uyari = '<div class="alert alert-danger py-2 mb-2">Toplam alan azami sınırı (' + sy(tv.azamiAlan) + ' da) aşıyor.</div>';
      else if (tv.oncelikliAlan != null && dekar > tv.oncelikliAlan) uyari = '<div class="alert alert-warning py-2 mb-2">Toplam alan öncelikli alan sınırının (' + sy(tv.oncelikliAlan) + ' da) üstünde.</div>';
      html = uyari + html + '<hr class="my-2"><div class="d-flex"><span>Toplam talep</span><strong class="ms-auto text-end">' + birimMetni(toplamlar) + '</strong></div>';
      if (bedelVar) {
        html += '<div class="d-flex"><span>Bedel</span><strong class="ms-auto">' + tl(bedel) + '</strong></div>';
        if (tv.katkiOrani != null) html += '<div class="d-flex"><span>Çiftçi katkısı (%' + sy(tv.katkiOrani) + ')</span><strong class="ms-auto">' + tl(katki) + '</strong></div>';
        if (parselBedelVar && !parselsizVar && Math.abs(parselBedel - bedel) > 0.005) html += '<div class="d-flex small text-secondary"><span>Parsellere göre bedel</span><span class="ms-auto">' + tl(parselBedel) + '</span></div>';
      }
      ozetEl.innerHTML = html;
    };
    tForm.addEventListener('input', ozetGuncelle);
    tForm.addEventListener('change', ozetGuncelle);
    tForm.addEventListener('click', function (e) { if (e.target.closest('[data-satir-sil]')) setTimeout(ozetGuncelle, 0); });
    ozetGuncelle();
  }

  ekimBirimleriniEsitle();

  // --- Silme yalnızca Sistem Yöneticisinde: kayıtlı satırların kaldır düğmeleri kapatılır ---
  document.querySelectorAll('[data-silme-kapali] [data-satir-sil]').forEach(function (d) {
    d.disabled = true;
    d.title = 'Silme yalnızca Sistem Yöneticisi tarafından yapılır';
  });

  // --- Proje formu: değerlendirme formülleri ---
  var sonIfade = null;
  document.addEventListener('focusin', function (e) { if (e.target.matches('.formul-ifade')) sonIfade = e.target; });
  document.addEventListener('click', function (e) {
    var d = e.target.closest('[data-degisken]');
    if (!d) return;
    var hedef = sonIfade || document.querySelector('.formul-ifade');
    if (!hedef) return;
    var ad = d.getAttribute('data-degisken');
    var bas = hedef.selectionStart != null ? hedef.selectionStart : hedef.value.length;
    var son = hedef.selectionEnd != null ? hedef.selectionEnd : bas;
    hedef.value = hedef.value.slice(0, bas) + ad + hedef.value.slice(son);
    hedef.focus();
    hedef.setSelectionRange(bas + ad.length, bas + ad.length);
  });
  var kodUret = function (s) {
    return String(s || '').trim().toLocaleLowerCase('tr').replace(/\s+/g, ' ')
      .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  };
  document.addEventListener('input', function (e) {
    if (!e.target.matches('.formul-ad')) return;
    var k = e.target.parentNode.querySelector('.formul-kod');
    if (k) k.textContent = kodUret(e.target.value);
  });
  // Puan tek formülde olur
  document.addEventListener('change', function (e) {
    if (!e.target.matches('.formul-puan') || !e.target.checked) return;
    document.querySelectorAll('.formul-puan').forEach(function (c) { if (c !== e.target) c.checked = false; });
  });

  // --- Değerlendirme sayfası: pencere, seçim, sıralama ---
  var panel = document.getElementById('panel-penceresi');
  if (panel) {
    panel.addEventListener('show.bs.modal', function (e) {
      var d = e.relatedTarget;
      var icerik = panel.querySelector('[data-panel-icerik]');
      icerik.innerHTML = '<div class="text-secondary">Yükleniyor…</div>';
      if (!d) return;
      fetch(d.getAttribute('data-panel'), { headers: { 'X-Requested-With': 'fetch' } })
        .then(function (r) { return r.text(); })
        .then(function (h) { icerik.innerHTML = h; })
        .catch(function () { icerik.innerHTML = '<div class="text-danger">Yüklenemedi.</div>'; });
    });
  }
  var toplu = document.getElementById('toplu-formu');
  if (toplu) {
    var seciliGuncelle = function () {
      var n = toplu.querySelectorAll('[data-secim]:checked').length;
      toplu.querySelector('[data-secili-sayi]').textContent = n;
      toplu.querySelectorAll('[data-toplu-dugme]').forEach(function (b) { b.disabled = n === 0; });
    };
    toplu.addEventListener('change', function (e) {
      if (e.target.matches('[data-tumunu-sec]')) toplu.querySelectorAll('[data-secim]').forEach(function (c) { c.checked = e.target.checked; });
      seciliGuncelle();
    });
    seciliGuncelle();
  }
  document.querySelectorAll('table[data-siralanabilir]').forEach(function (tablo) {
    tablo.querySelectorAll('th[data-sirala]').forEach(function (th) {
      th.classList.add('siralanabilir');
      th.addEventListener('click', function () {
        var sutun = Array.prototype.indexOf.call(th.parentNode.children, th);
        var sayi = th.getAttribute('data-sirala') === 'sayi';
        var yon = th.dataset.yon === 'artan' ? 'azalan' : 'artan';
        tablo.querySelectorAll('th[data-sirala]').forEach(function (x) { delete x.dataset.yon; });
        th.dataset.yon = yon;
        var govde = tablo.tBodies[0];
        var satirlar = Array.prototype.slice.call(govde.rows);
        var deger = function (tr) {
          var td = tr.cells[sutun];
          var v = td ? (td.getAttribute('data-deger') || td.textContent.trim()) : '';
          return sayi ? (v === '' ? -Infinity : parseFloat(v)) : v;
        };
        satirlar.sort(function (a, b) {
          var x = deger(a), z = deger(b);
          var c = sayi ? x - z : String(x).localeCompare(String(z), 'tr');
          return yon === 'artan' ? c : -c;
        });
        satirlar.forEach(function (tr) { govde.appendChild(tr); });
      });
    });
  });

  // --- Başvuru akışı: not/gerekçe zorunlu işlemler ---
  document.addEventListener('submit', function (e) {
    var f = e.target;
    var not = f.querySelector('textarea[name="not"]');
    if (f.matches('[data-islem-formu]')) {
      var d = e.submitter;
      if (d && d.hasAttribute('data-not-zorunlu') && not && !not.value.trim()) {
        e.preventDefault();
        not.classList.add('is-invalid');
        not.placeholder = d.getAttribute('data-not-zorunlu') + ' yazılmalıdır';
        not.focus();
      }
    }
    if (f.matches('[data-degistir-formu]') && not && !not.value.trim()) {
      var dusen = Array.prototype.some.call(f.querySelectorAll('[data-onceki]'), function (i) {
        var v = parseFloat(i.value); return (isNaN(v) ? 0 : v) < parseFloat(i.getAttribute('data-onceki'));
      });
      if (dusen) { e.preventDefault(); not.classList.add('is-invalid'); not.placeholder = 'Miktar düşürülürken gerekçe yazılmalıdır'; not.focus(); }
    }
  });

  // --- Silme onayı ---
  document.querySelectorAll('form[data-onay]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      if (!window.confirm(f.getAttribute('data-onay'))) e.preventDefault();
    });
  });
  document.querySelectorAll('[data-onay-dugme]').forEach(function (d) {
    d.addEventListener('click', function (e) {
      if (!window.confirm(d.getAttribute('data-onay-dugme'))) e.preventDefault();
    });
  });
})();
