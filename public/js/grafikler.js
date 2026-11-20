/* Genel bakış grafikleri (ApexCharts). Veri: #grafik-verisi (genel-bakis/views/grafikler.ejs) */
(function () {
  'use strict';
  var kaynak = document.getElementById('grafik-verisi');
  if (!kaynak || typeof ApexCharts === 'undefined') return;
  var V = JSON.parse(kaynak.textContent);

  // Kategorik renkler sabit sırayla (renk körlüğü denetiminden geçmiş sıra):
  // 1 mavi, 2 turuncu, 3 su yeşili, 4 sarı
  var RENK = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];
  var css = function (ad, yedek) { var v = getComputedStyle(document.body).getPropertyValue(ad).trim(); return v || yedek; };
  var yazi = css('--tblr-body-color', '#1d273b');
  var soluk = css('--tblr-secondary', '#667382');
  var cizgi = css('--tblr-border-color', '#e6e7e9');
  var yuzey = css('--tblr-bg-surface', '#ffffff');

  var sayi = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });
  var kisa = new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 });
  var tl = function (v) { return sayi.format(Math.round(v || 0)) + ' TL'; };
  var tlKisa = function (v) { return kisa.format(v || 0) + ' TL'; };
  var da = function (v) { return sayi.format(v || 0) + ' da'; };
  var daKisa = function (v) { return kisa.format(v || 0) + ' da'; };

  var temel = function (tur, yukseklik) {
    return {
      chart: { type: tur, height: yukseklik, fontFamily: 'inherit', foreColor: soluk, toolbar: { show: false }, animations: { enabled: false }, parentHeightOffset: 0, zoom: { enabled: false } },
      grid: { borderColor: cizgi, strokeDashArray: 3, padding: { left: 4, right: 12 } },
      legend: { position: 'top', horizontalAlign: 'left', fontSize: '13px', labels: { colors: yazi }, markers: { size: 6, shape: 'circle' }, itemMargin: { horizontal: 10 } },
      dataLabels: { enabled: false },
      tooltip: { theme: document.body.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light' },
      states: { hover: { filter: { type: 'darken', value: 0.9 } } }
    };
  };

  // Gruplu yatay çubuk: her kategori için birden çok seri
  function yatayCubuk(el, kategoriler, seriler, tam, kisaBicim) {
    var n = kategoriler.length;
    var o = temel('bar', Math.max(220, n * seriler.length * 16 + n * 22 + 70));
    o.series = seriler.map(function (s) { return { name: s.ad, data: s.veri }; });
    o.colors = seriler.map(function (s, i) { return RENK[i]; });
    o.plotOptions = { bar: { horizontal: true, borderRadius: 4, borderRadiusApplication: 'end', barHeight: seriler.length > 1 ? '78%' : '55%' } };
    o.stroke = { show: true, width: 2, colors: [yuzey] };
    o.xaxis = { categories: kategoriler, labels: { formatter: kisaBicim }, axisBorder: { show: false }, axisTicks: { show: false } };
    o.yaxis = { labels: { maxWidth: 220, style: { colors: yazi } } };
    o.tooltip.shared = true; o.tooltip.intersect = false;
    o.tooltip.y = { formatter: tam };
    o.grid.xaxis = { lines: { show: true } }; o.grid.yaxis = { lines: { show: false } };
    new ApexCharts(el, o).render();
  }

  // Halka: paylar
  function halka(el, etiketler, degerler, renkler, tam) {
    var o = temel('donut', 280);
    o.series = degerler;
    o.labels = etiketler;
    o.colors = renkler;
    o.stroke = { width: 2, colors: [yuzey] };
    o.legend.position = 'bottom';
    o.legend.horizontalAlign = 'center';
    o.plotOptions = { pie: { donut: { size: '68%', labels: { show: true, name: { color: soluk }, value: { color: yazi, fontSize: '20px', fontWeight: 600, formatter: function (v) { return tam(Number(v)); } }, total: { show: true, label: 'Toplam', color: soluk, formatter: function (w) { return tam(w.globals.seriesTotals.reduce(function (a, b) { return a + b; }, 0)); } } } } } };
    o.dataLabels = { enabled: true, formatter: function (v) { return v >= 6 ? '%' + sayi.format(v) : ''; }, style: { fontSize: '11px', fontWeight: 500 }, dropShadow: { enabled: false } };
    o.tooltip.y = { formatter: tam };
    new ApexCharts(el, o).render();
  }

  var ciz = {
    subeButce: function (el) {
      yatayCubuk(el, V.subeler.map(function (s) { return s.ad; }), [
        { ad: 'Tahmini', veri: V.subeler.map(function (s) { return s.tahmini; }) },
        { ad: 'Talep edilen', veri: V.subeler.map(function (s) { return s.talep; }) },
        { ad: 'Desteklenen', veri: V.subeler.map(function (s) { return s.desteklenen; }) },
        { ad: 'Gerçekleşen', veri: V.subeler.map(function (s) { return s.gerceklesen; }) }
      ], tl, tlKisa);
    },
    subePay: function (el) {
      var s = V.subeler.filter(function (x) { return x.tahmini > 0; });
      // Dördü aşan şubeler "Diğer" altında toplanır (renk sırası sabit kalır)
      if (s.length > 4) {
        var diger = s.slice(3).reduce(function (a, x) { return a + x.tahmini; }, 0);
        s = s.slice(0, 3).concat([{ ad: 'Diğer (' + (V.subeler.length - 3) + ' şube)', tahmini: diger }]);
      }
      halka(el, s.map(function (x) { return x.ad; }), s.map(function (x) { return x.tahmini; }), RENK.slice(0, s.length), tl);
    },
    projeButce: function (el) {
      yatayCubuk(el, V.projeler.map(function (p) { return p.ad; }), [
        { ad: 'Tahmini', veri: V.projeler.map(function (p) { return p.tahmini; }) },
        { ad: 'Talep edilen', veri: V.projeler.map(function (p) { return p.talep; }) },
        { ad: 'Desteklenen', veri: V.projeler.map(function (p) { return p.desteklenen; }) },
        { ad: 'Gerçekleşen', veri: V.projeler.map(function (p) { return p.gerceklesen; }) }
      ], tl, tlKisa);
    },
    projeAlan: function (el) {
      yatayCubuk(el, V.projeler.map(function (p) { return p.ad; }), [
        { ad: 'Hedef', veri: V.projeler.map(function (p) { return p.hedefDekar; }) },
        { ad: 'Talep edilen', veri: V.projeler.map(function (p) { return p.talepDekar; }) },
        { ad: 'Desteklenen', veri: V.projeler.map(function (p) { return p.desteklenenDekar; }) },
        { ad: 'Teslim edilen', veri: V.projeler.map(function (p) { return p.gerceklesenDekar; }) }
      ], da, daKisa);
    },
    urunAlan: function (el) {
      yatayCubuk(el, V.urunler.map(function (u) { return u.ad; }), [
        { ad: 'Hedef', veri: V.urunler.map(function (u) { return u.hedef; }) },
        { ad: 'Talep edilen', veri: V.urunler.map(function (u) { return u.talep; }) },
        { ad: 'Desteklenen', veri: V.urunler.map(function (u) { return u.desteklenen; }) }
      ], da, daKisa);
    },
    ilceAlan: function (el) {
      yatayCubuk(el, V.ilceler.map(function (i) { return i.ad; }), [
        { ad: 'Talep edilen', veri: V.ilceler.map(function (i) { return i.talepDekar; }) },
        { ad: 'Desteklenen', veri: V.ilceler.map(function (i) { return i.desteklenenDekar; }) }
      ], da, daKisa);
    },
    asamalar: function (el) {
      // Aşama renkleri uygulamanın aşama rozetleriyle aynıdır (durum rengi)
      halka(el, V.asamalar.map(function (a) { return a.ad; }), V.asamalar.map(function (a) { return a.deger; }),
        V.asamalar.map(function (a) { return css('--tblr-' + a.renk, '#888'); }), function (v) { return sayi.format(v) + ' başvuru'; });
    },
    finansman: function (el) {
      halka(el, V.finansman.map(function (f) { return f.ad; }), V.finansman.map(function (f) { return f.deger; }), [RENK[0], RENK[1]], tl);
    },
    donemler: function (el) {
      var o = temel('bar', 260);
      o.series = [
        { name: 'Tahmini', data: V.donemler.map(function (d) { return d.tahmini; }) },
        { name: 'Desteklenen', data: V.donemler.map(function (d) { return d.desteklenen; }) }
      ];
      o.colors = [RENK[0], RENK[2]];
      o.plotOptions = { bar: { borderRadius: 4, borderRadiusApplication: 'end', columnWidth: '55%' } };
      o.stroke = { show: true, width: 2, colors: [yuzey] };
      o.xaxis = { categories: V.donemler.map(function (d) { return d.ad; }), axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: yazi } } };
      o.yaxis = { labels: { formatter: tlKisa } };
      o.tooltip.shared = true; o.tooltip.intersect = false; o.tooltip.y = { formatter: tl };
      new ApexCharts(el, o).render();
    }
  };

  document.querySelectorAll('[data-grafik]').forEach(function (el) {
    var f = ciz[el.getAttribute('data-grafik')];
    if (f) { el.style.minHeight = ''; f(el); }
  });
})();
