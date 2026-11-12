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

  // --- Proje formu: ürün kataloğu ile kalem doldurma ---
  var katalogEl = document.getElementById('urun-katalogu');
  if (katalogEl) {
    var veri = JSON.parse(katalogEl.textContent);
    var anahtar = function (s) { return String(s || '').trim().toLocaleLowerCase('tr').replace(/\s+/g, ' '); };
    var sayiYaz = function (n) { return Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 2 }); };

    var urunBul = function (tur, ad) {
      var k = anahtar(ad);
      if (!k) return null;
      for (var i = 0; i < veri.urunler.length; i++) {
        var u = veri.urunler[i];
        if (u.tur === tur && anahtar(u.ad) === k) return u;
      }
      return null;
    };

    var kalemGuncelle = function (blok, normlariDoldur) {
      var tur = blok.querySelector('.kalem-tur').value;
      var urunInput = blok.querySelector('.kalem-urun');
      var cesitInput = blok.querySelector('.kalem-cesit');
      var idInput = blok.querySelector('.kalem-urun-id');
      var durum = blok.querySelector('.kalem-durum');
      var turSira = veri.turler.indexOf(tur);
      urunInput.setAttribute('list', 'dl-urun-' + (turSira < 0 ? 0 : turSira));

      var urun = urunBul(tur, urunInput.value);
      idInput.value = urun ? urun._id : '';

      // Çeşit önerileri
      var dl = document.getElementById(cesitInput.getAttribute('list'));
      if (dl) {
        dl.innerHTML = '';
        (urun ? urun.cesitler : []).forEach(function (c) {
          var o = document.createElement('option');
          o.value = c;
          dl.appendChild(o);
        });
      }

      // Durum etiketi
      var etiket = '';
      if (urunInput.value.trim() && !urun) {
        etiket = '<span class="badge bg-yellow-lt"><i class="ti ti-sparkles me-1"></i>Yeni ürün · kaydedilince kataloğa eklenir</span>';
      } else if (urun && cesitInput.value.trim() && !urun.cesitler.some(function (c) { return anahtar(c) === anahtar(cesitInput.value); })) {
        etiket = '<span class="badge bg-yellow-lt"><i class="ti ti-sparkles me-1"></i>Yeni çeşit · kaydedilince kataloğa eklenir</span>';
      } else if (urun) {
        etiket = '<span class="text-secondary"><i class="ti ti-check me-1"></i>Katalogdan</span>';
      }
      durum.innerHTML = etiket;

      // Normlar: kataloğun varsayılanı yer tutucu olarak görünür; boş ya da
      // kendiliğinden doldurulmuş alanlar yeni ürün seçilince güncellenir.
      blok.querySelectorAll('.kalem-norm').forEach(function (inp) {
        var v = urun && urun.normlar ? urun.normlar[inp.getAttribute('data-norm')] : undefined;
        inp.placeholder = v != null ? String(v) : '';
        if (normlariDoldur && (inp.value === '' || inp.dataset.oto === '1')) {
          inp.value = v != null ? v : '';
          inp.dataset.oto = '1';
        }
      });

      if (normlariDoldur && urun) {
        var olcu = blok.querySelector('.kalem-olcu');
        if (Array.prototype.some.call(olcu.options, function (o) { return o.value === urun.olcuBirimi; })) olcu.value = urun.olcuBirimi;
      }

      miktarIpucu(blok);
    };

    // Toplam miktar boşsa alan × ekim normu ipucu olarak gösterilir.
    var miktarIpucu = function (blok) {
      var miktar = blok.querySelector('.kalem-miktar');
      var alan = parseFloat(blok.querySelector('.kalem-alan').value);
      var ekim = veri.ekimKod ? blok.querySelector('.kalem-norm[data-norm="' + veri.ekimKod + '"]') : null;
      var norm = ekim ? parseFloat(ekim.value !== '' ? ekim.value : ekim.placeholder) : NaN;
      miktar.placeholder = (!isNaN(alan) && !isNaN(norm)) ? 'Hesap: ' + sayiYaz(alan * norm) : 'Hesaplanır';
    };

    var form = document.getElementById('proje-formu');
    var blokOf = function (el) { return el.closest('.kalem-blok'); };

    form.addEventListener('change', function (e) {
      var b = blokOf(e.target);
      if (!b) return;
      if (e.target.matches('.kalem-tur, .kalem-urun')) kalemGuncelle(b, true);
    });
    form.addEventListener('input', function (e) {
      var b = blokOf(e.target);
      if (!b) return;
      if (e.target.matches('.kalem-norm')) e.target.dataset.oto = '0';
      if (e.target.matches('.kalem-urun, .kalem-cesit')) kalemGuncelle(b, false);
      if (e.target.matches('.kalem-alan, .kalem-norm')) miktarIpucu(b);
    });
    form.addEventListener('satir-eklendi', function (e) {
      if (e.detail && e.detail.classList.contains('kalem-blok')) kalemGuncelle(e.detail, false);
    });
    form.querySelectorAll('.kalem-blok').forEach(function (b) { kalemGuncelle(b, false); });
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
