(function () {
  'use strict';

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
      return { olcuBirimi: urun.olcuBirimi, ambalaj: (c && c.ambalaj) || urun.ambalaj || null, normlar: normlar };
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

    var kalemGuncelle = function (blok, doldur) {
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
        var aMiktar = blok.querySelector('.ambalaj-miktar');
        var aBirim = blok.querySelector('.ambalaj-birim');
        if (doldurulabilir(aMiktar)) {
          yaz(aMiktar, e.ambalaj ? e.ambalaj.miktar : '');
          if (e.ambalaj) { seciliYap(aBirim, e.ambalaj.birim); aBirim.dataset.oto = '1'; }
        }
      }
      miktarIpucu(blok);
      if (doldur) fiyatBirimleri(blok);
    };

    // Toplam dağıtım boşsa hesaplanan değer ipucu olarak gösterilir.
    var miktarIpucu = function (blok) {
      var miktar = blok.querySelector('.kalem-miktar');
      var alan = parseFloat(blok.querySelector('.kalem-alan').value);
      var ekimCift = veri.ekimKod ? blok.querySelector('.norm-deger[data-norm="' + veri.ekimKod + '"]') : null;
      var ipucu = 'Hesaplanır';
      if (ekimCift) {
        var cift = ekimCift.closest('.norm-cifti');
        var norm = parseFloat(ekimCift.value !== '' ? ekimCift.value : ekimCift.placeholder);
        var birim = sonucBirimi(cift.querySelector('.norm-birim').value || cift.querySelector('.norm-birim').placeholder);
        var dagitim = blok.querySelector('.kalem-olcu').value;
        if (!isNaN(alan) && !isNaN(norm)) {
          var ihtiyac = alan * norm;
          var aMiktar = parseFloat(blok.querySelector('.ambalaj-miktar').value);
          var aBirim = blok.querySelector('.ambalaj-birim').value;
          if (anahtar(birim) === anahtar(dagitim)) ipucu = 'Hesap: ' + sayiYaz(ihtiyac);
          else if (!isNaN(aMiktar) && aMiktar > 0 && anahtar(aBirim) === anahtar(birim)) ipucu = 'Hesap: ' + sayiYaz(Math.ceil(ihtiyac / aMiktar));
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
      if (e.isTrusted && e.target.matches('.kalem-olcu, .ambalaj-birim')) e.target.dataset.oto = '0';
      if (e.isTrusted && e.target.matches('.kalem-fiyat-birimi')) e.target.dataset.elle = '1';
      if (e.target.matches('.kalem-tur, .kalem-urun, .kalem-cesit')) kalemGuncelle(b, true);
      else miktarIpucu(b);
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

    // Yeni parsel satırının ilçesi çiftçinin ilçesi olur
    tForm.addEventListener('satir-eklendi', function (e) {
      var s = e.detail.querySelector('.talep-parsel-ilce');
      if (s && ilceSec.value) s.value = ilceSec.value;
      ozetGuncelle();
    });

    var ozetGuncelle = function () {
      var alanlar = {};
      var toplamAlan = 0;
      tForm.querySelectorAll('tbody[data-satirlar] > tr').forEach(function (tr) {
        var k = tr.querySelector('.talep-kalem').value;
        var a = parseFloat(tr.querySelector('.talep-alan').value);
        if (!k || isNaN(a)) return;
        alanlar[k] = (alanlar[k] || 0) + a;
        toplamAlan += a;
      });
      var html = '';
      var bedel = 0, katki = 0, bedelVar = false;
      tv.kalemler.forEach(function (k) {
        var alan = alanlar[k._id];
        if (!alan) return;
        var satir = '<div class="mb-2"><div class="fw-medium">' + kacis(k.ad) + '</div><div class="small text-secondary">' + sy(alan) + ' da';
        if (k.ekim != null) {
          var ihtiyac = alan * k.ekim;
          var miktar = null, teslim = null, teslimBirimi = null;
          if (esit(k.ihtiyacBirimi, k.olcuBirimi)) { miktar = ihtiyac; teslim = ihtiyac; teslimBirimi = k.olcuBirimi; }
          else if (k.ambalaj && esit(k.ambalaj.birim, k.ihtiyacBirimi)) { miktar = Math.ceil(ihtiyac / k.ambalaj.miktar - 1e-9); teslim = miktar * k.ambalaj.miktar; teslimBirimi = k.ambalaj.birim; }
          satir += ' × ' + sy(k.ekim) + ' = ' + sy(ihtiyac) + ' ' + kacis(k.ihtiyacBirimi || '') + '</div>';
          if (miktar != null) {
            satir += '<div><strong>' + sy(miktar) + ' ' + kacis(k.olcuBirimi) + '</strong>' + (k.ambalaj && !esit(k.ambalaj.birim, k.olcuBirimi) ? ' <span class="text-secondary small">(' + sy(teslim) + ' ' + kacis(teslimBirimi) + ')</span>' : '') + '</div>';
            if (k.birimFiyat != null) {
              var b = esit(k.fiyatBirimi, k.olcuBirimi) ? miktar * k.birimFiyat : (esit(k.fiyatBirimi, teslimBirimi) ? teslim * k.birimFiyat : null);
              if (b != null) {
                bedel += b; bedelVar = true;
                var kk = tv.katkiOrani != null ? b * tv.katkiOrani / 100 : null;
                if (kk != null) katki += kk;
                satir += '<div class="small text-secondary">Bedel ' + tl(b) + (kk != null ? ' · çiftçi katkısı ' + tl(kk) : '') + '</div>';
              }
            }
          } else {
            satir += '<div class="small text-warning">Ambalaj içeriği tanımlı olmadığı için miktar hesaplanamadı</div>';
          }
        } else {
          satir += '</div><div class="small text-secondary">Ekim normu tanımlı değil</div>';
        }
        html += satir + '</div>';
      });
      if (!html) { ozetEl.innerHTML = '<div class="text-secondary">Parsel girildikçe hesaplanır.</div>'; return; }
      var uyari = '';
      if (tv.azamiAlan != null && toplamAlan > tv.azamiAlan) uyari = '<div class="alert alert-danger py-2 mb-2">Toplam alan azami sınırı (' + sy(tv.azamiAlan) + ' da) aşıyor.</div>';
      else if (tv.oncelikliAlan != null && toplamAlan > tv.oncelikliAlan) uyari = '<div class="alert alert-warning py-2 mb-2">Toplam alan öncelikli alan sınırının (' + sy(tv.oncelikliAlan) + ' da) üstünde.</div>';
      html = uyari + html + '<hr class="my-2"><div class="d-flex"><span>Toplam alan</span><strong class="ms-auto">' + sy(toplamAlan) + ' da</strong></div>';
      if (bedelVar) {
        html += '<div class="d-flex"><span>Bedel</span><strong class="ms-auto">' + tl(bedel) + '</strong></div>';
        if (tv.katkiOrani != null) html += '<div class="d-flex"><span>Çiftçi katkısı (%' + sy(tv.katkiOrani) + ')</span><strong class="ms-auto">' + tl(katki) + '</strong></div>';
      }
      ozetEl.innerHTML = html;
    };
    tForm.addEventListener('input', ozetGuncelle);
    tForm.addEventListener('change', ozetGuncelle);
    tForm.addEventListener('click', function (e) { if (e.target.closest('[data-satir-sil]')) setTimeout(ozetGuncelle, 0); });
    ozetGuncelle();
  }

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
