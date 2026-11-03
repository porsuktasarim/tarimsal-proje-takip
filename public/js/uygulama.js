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
  // <table data-satirlar="kalemler"> içindeki <template> klonlanır; şablondaki
  // __i__ ifadesi satır sırasıyla değiştirilir.
  function siraNumaralariniYenile(tablo) {
    var ad = tablo.getAttribute('data-satirlar');
    tablo.querySelectorAll('tbody tr').forEach(function (tr, i) {
      tr.querySelectorAll('[name]').forEach(function (el) {
        el.name = el.name.replace(new RegExp('^' + ad + '\\[\\d+\\]'), ad + '[' + i + ']');
      });
      var no = tr.querySelector('.satir-no');
      if (no) no.textContent = i + 1;
    });
    var bos = tablo.parentElement.querySelector('.satir-bos');
    if (bos) bos.classList.toggle('d-none', tablo.querySelectorAll('tbody tr').length > 0);
  }

  document.querySelectorAll('table[data-satirlar]').forEach(function (tablo) {
    var ad = tablo.getAttribute('data-satirlar');
    var sablon = document.getElementById(ad + '-sablon');
    var ekle = document.querySelector('[data-satir-ekle="' + ad + '"]');

    if (ekle && sablon) {
      ekle.addEventListener('click', function () {
        var i = tablo.querySelectorAll('tbody tr').length;
        var kap = document.createElement('tbody');
        kap.innerHTML = sablon.innerHTML.replace(/__i__/g, i);
        var tr = kap.firstElementChild;
        tablo.querySelector('tbody').appendChild(tr);
        siraNumaralariniYenile(tablo);
        var ilk = tr.querySelector('input, select');
        if (ilk) ilk.focus();
      });
    }

    tablo.addEventListener('click', function (e) {
      var sil = e.target.closest('[data-satir-sil]');
      if (!sil) return;
      e.preventDefault();
      sil.closest('tr').remove();
      siraNumaralariniYenile(tablo);
    });

    siraNumaralariniYenile(tablo);
  });

  // --- İlçe seçimi ---
  var ilceTablosu = document.querySelector('[data-ilce-tablosu]');
  if (ilceTablosu) {
    var kutular = ilceTablosu.querySelectorAll('input.ilce-sec');
    var tumu = document.querySelector('[data-ilce-tumu]');
    var sayac = document.querySelector('[data-ilce-sayac]');

    var guncelle = function () {
      var secili = 0;
      kutular.forEach(function (k) {
        var tr = k.closest('tr');
        tr.classList.toggle('secili-degil', !k.checked);
        tr.querySelectorAll('input[type="number"]').forEach(function (s) { s.disabled = !k.checked; });
        if (k.checked) secili++;
      });
      if (sayac) sayac.textContent = secili;
      if (tumu) {
        tumu.checked = secili === kutular.length;
        tumu.indeterminate = secili > 0 && secili < kutular.length;
      }
    };

    kutular.forEach(function (k) { k.addEventListener('change', guncelle); });
    if (tumu) {
      tumu.addEventListener('change', function () {
        kutular.forEach(function (k) { k.checked = tumu.checked; });
        guncelle();
      });
    }
    guncelle();
  }

  // --- Silme onayı ---
  document.querySelectorAll('form[data-onay]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      if (!window.confirm(f.getAttribute('data-onay'))) e.preventDefault();
    });
  });
})();
