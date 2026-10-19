/* Yarta site map · window.YartaMap
   A calm, matte map of an organisation's own sites, each sized by its share of a chosen metric.
   Plain script, no modules. Loads Leaflet 1.9.4 (vendored at ../vendor/) and sitemap.css itself,
   resolved relative to this file so it works under a base path such as /yes-site/.

   YartaMap.mount(el, opts) -> Promise<{update(sites, metric), select(id), fit(), setMetric(key), destroy()}>
*/
(function () {
  'use strict';
  if (window.YartaMap) return;

  /* ---------- where this file lives ---------- */
  var SRC = (document.currentScript && document.currentScript.src) || (function () {
    var s = document.querySelectorAll('script[src]');
    for (var i = s.length - 1; i >= 0; i--) if (/yarta\/sitemap\.js/.test(s[i].src)) return s[i].src;
    return location.href;
  })();
  function rel(p) { try { return new URL(p, SRC).href; } catch (e) { return p; } }
  var URLS = { js: rel('../vendor/leaflet.js'), css: rel('../vendor/leaflet.css'), own: rel('sitemap.css') };

  /* ---------- constants ---------- */
  var ORANGE = '#CF7A2E', INK = '#0B0B0B', PAPER = '#F4F4F2', MIST = '#D6D8D3', SLATE = '#7C8184';
  var R_MIN = 7, R_MAX = 34, R_EMPTY = 5;
  var BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  var CARTO = 'https://{s}.basemaps.cartocdn.com/{style}/{z}/{x}/{y}{r}.png';
  var ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &middot; &copy; <a href="https://carto.com/attribution/" target="_blank" rel="noopener">CARTO</a>';
  var DEFAULT_METRICS = [
    { key: 'emissions', label: 't CO₂-e', unit: 't', name: 'Emissions', noun: 'emissions' },
    { key: 'electricity', label: 'MWh grid', unit: 'MWh', name: 'Electricity', noun: 'grid electricity' },
    { key: 'water', label: 'kL water', unit: 'kL', name: 'Water', noun: 'water' },
    { key: 'waste', label: 't waste', unit: 't', name: 'Waste', noun: 'waste' }
  ];
  var NAMES = { emissions: ['Emissions', 'emissions'], electricity: ['Electricity', 'grid electricity'], water: ['Water', 'water'], waste: ['Waste', 'waste'] };

  /* ---------- loader (once per page) ---------- */
  var cssP = {};
  function addCss(href, key) {
    if (cssP[key]) return cssP[key];
    var l = document.querySelector('link[data-ym="' + key + '"]')
      || (key === 'own' && document.querySelector('link[href*="yarta/sitemap.css"]'))
      || (key === 'leaflet' && document.querySelector('link[href*="leaflet.css"]'));
    cssP[key] = new Promise(function (res) {
      if (l) { if (l.sheet) return res(); }
      else { l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-ym', key); document.head.appendChild(l); }
      l.addEventListener('load', function () { res(); });
      l.addEventListener('error', function () { res(); });
      setTimeout(res, 4000); // never block the map on a slow stylesheet
    });
    return cssP[key];
  }
  var leafletP = null;
  function loadLeaflet() {
    var css = Promise.all([addCss(URLS.css, 'leaflet'), addCss(URLS.own, 'own')]);
    if (window.L && window.L.version) return css.then(function () { return window.L; });
    if (leafletP) return leafletP;
    leafletP = css.then(function () { return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = URLS.js; s.async = true;
      s.onload = function () { window.L ? res(window.L) : rej(new Error('Leaflet did not initialise')); };
      s.onerror = function () { leafletP = null; rej(new Error('Leaflet could not be loaded from ' + URLS.js)); };
      document.head.appendChild(s);
    }); });
    return leafletP;
  }

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : (v != null && v !== '' && isFinite(+v) ? +v : null); }
  function fmt(v) { return v.toLocaleString('en-AU', { maximumFractionDigits: v < 10 ? 1 : 0 }); }
  function share(v, total) {
    if (!total || !v) return null;
    var p = v / total * 100;
    return p < 1 ? '<1%' : Math.round(p) + '%';
  }
  function normMetrics(list) {
    return (list && list.length ? list : DEFAULT_METRICS).map(function (m) {
      var n = NAMES[m.key] || [m.key.charAt(0).toUpperCase() + m.key.slice(1), m.key];
      return { key: m.key, label: m.label || m.unit || m.key, unit: m.unit || '', name: m.name || n[0], noun: m.noun || n[1] };
    });
  }
  function validSites(sites) {
    return (sites || []).filter(function (s) { return s && num(s.lat) != null && num(s.lng) != null && Math.abs(s.lat) <= 90 && Math.abs(s.lng) <= 180; });
  }

  /* ---------- mount ---------- */
  function mount(el, opts) {
    if (!el) return Promise.reject(new Error('YartaMap.mount needs an element'));
    opts = opts || {};
    var root = document.createElement('div');
    var theme = opts.theme === 'dark' ? 'dark' : 'paper';
    root.className = 'ym-root ym-' + theme + (opts.compact ? ' ym-compact' : '');
    root.innerHTML = '<div class="ym-map" role="region" aria-label="Map of your sites"></div>'
      + '<div class="ym-empty" hidden><div><p class="ym-eyebrow">Site map</p><p class="ym-empty-t">No site locations yet</p><p class="ym-empty-s">Add an address to each site and it will appear here, sized by its share of your footprint.</p></div></div>';
    el.appendChild(root);

    return loadLeaflet().then(function (L) { return build(L, el, root, opts, theme); }, function (err) {
      var e = root.querySelector('.ym-empty'); e.hidden = false;
      e.querySelector('.ym-empty-t').textContent = 'The map could not load';
      e.querySelector('.ym-empty-s').textContent = 'Your site list below is unaffected. Refresh the page to try again.';
      throw err;
    });
  }

  function build(L, el, root, opts, theme) {
    var metrics = normMetrics(opts.metrics);
    var state = {
      sites: [], metric: opts.metric || metrics[0].key, selected: null, hovered: null,
      markers: {}, labels: [], halo: null, order: [], fitted: false, destroyed: false
    };
    var compact = !!opts.compact;
    var mapEl = root.querySelector('.ym-map');
    var emptyEl = root.querySelector('.ym-empty');

    var map = L.map(mapEl, {
      zoomControl: false, attributionControl: false, scrollWheelZoom: !compact,
      worldCopyJump: false, minZoom: 3, maxZoom: 18, zoomSnap: 0.25, zoomDelta: 1, wheelPxPerZoomLevel: 90,
      preferCanvas: false, keyboard: true
    }).setView([-27.5, 134], 4);

    /* tiles: Esri's keyless canvas basemaps by default (grey, no place names; the street map when labels are wanted);
       CARTO when the host passes tileSource:'carto' with a tileKey (CARTO rasters need a key since Sep 2026); or tiles:false */
    if (opts.tiles !== false) {
      var url, lopts = { maxZoom: 19, attribution: opts.tileAttribution || ATTR, errorTileUrl: BLANK, crossOrigin: false, className: 'ym-tiles' };
      if (opts.tileUrl) { url = opts.tileUrl; lopts.subdomains = opts.subdomains || 'abc'; }
      else if (opts.tileSource === 'carto') {
        var style = (theme === 'dark' ? 'dark' : 'light') + (opts.labels ? '_all' : '_nolabels');
        url = CARTO.replace('{style}', style); lopts.subdomains = 'abcd'; lopts.maxZoom = 20;
      } else {
        url = opts.labels
          ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
          : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_' + (theme === 'dark' ? 'Dark' : 'Light') + '_Gray_Base/MapServer/tile/{z}/{y}/{x}';
        lopts.maxZoom = opts.labels ? 19 : 16;
        lopts.attribution = opts.tileAttribution || 'Tiles &copy; Esri &middot; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
      }
      if (opts.tileKey) url += (url.indexOf('?') < 0 ? '?' : '&') + 'key=' + encodeURIComponent(opts.tileKey);
      L.tileLayer(url, lopts).addTo(map);
    }
    L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(map);
    if (opts.tiles === false && opts.tileAttribution) map.attributionControl.addAttribution(opts.tileAttribution);

    /* controls */
    var Pills = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: function () {
        var d = L.DomUtil.create('div', 'ym-pills');
        d.setAttribute('role', 'group'); d.setAttribute('aria-label', 'Size sites by');
        d.innerHTML = metrics.map(function (m) {
          return '<button type="button" class="ym-pill" data-k="' + esc(m.key) + '" aria-pressed="false" title="Size sites by ' + esc(m.label) + '">' + esc(m.name) + '</button>';
        }).join('');
        L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d);
        L.DomEvent.on(d, 'click', function (e) {
          var b = e.target.closest ? e.target.closest('.ym-pill') : null;
          if (b) handle.setMetric(b.getAttribute('data-k'));
        });
        return d;
      }
    });
    var Fit = L.Control.extend({
      options: { position: 'bottomleft' },
      onAdd: function () {
        var b = L.DomUtil.create('button', 'ym-fit');
        b.type = 'button';
        b.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M1.5 5.5v-4h4M10.5 1.5h4v4M14.5 10.5v4h-4M5.5 14.5h-4v-4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg><span>Fit all</span>';
        b.title = 'Show every site';
        L.DomEvent.disableClickPropagation(b);
        L.DomEvent.on(b, 'click', function () { handle.fit(); });
        return b;
      }
    });
    var pillsCtl = null;
    if (!compact) { pillsCtl = new Pills(); pillsCtl.addTo(map); }
    L.control.zoom({ position: 'topright', zoomInTitle: 'Zoom in', zoomOutTitle: 'Zoom out' }).addTo(map);
    new Fit().addTo(map);
    if (!compact) L.control.scale({ position: 'bottomleft', metric: true, imperial: false, maxWidth: 96 }).addTo(map);

    /* size awareness */
    function narrow() { return root.clientWidth < 560; }
    function syncNarrow() { root.classList.toggle('ym-narrow', narrow()); }
    syncNarrow();
    var raf = 0, ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          if (state.destroyed) return;
          syncNarrow(); map.invalidateSize({ pan: false });
          if (state.autoFit) handle.fit(true); else placeLabels();
        });
      });
      ro.observe(root);
    }
    /* keep re-fitting on resize until the person moves the map themselves */
    map.on('dragstart', function () { state.autoFit = false; });
    map.on('zoomstart', function () { if (!state.fitting) state.autoFit = false; });

    /* ---------- drawing ---------- */
    function metricDef() { for (var i = 0; i < metrics.length; i++) if (metrics[i].key === state.metric) return metrics[i]; return metrics[0]; }
    function ringColour() { return theme === 'dark' ? PAPER : INK; }
    function emptyColour() { return theme === 'dark' ? MIST : SLATE; }

    function baseStyle(m) {
      var dim = state.selected && state.selected !== m.site.id;
      if (!m.v) return { radius: R_EMPTY, color: emptyColour(), weight: 1.25, opacity: dim ? 0.45 : 0.9, fill: true, fillColor: theme === 'dark' ? '#2A2A2A' : PAPER, fillOpacity: dim ? 0.3 : 0.6 };
      var on = state.hovered === m.site.id || state.selected === m.site.id;
      return {
        radius: m.r, color: ringColour(), weight: on ? 2.5 : 1.5,
        opacity: on ? 1 : (dim ? 0.45 : (theme === 'dark' ? 0.9 : 0.85)),
        fill: true, fillColor: ORANGE, fillOpacity: on ? 1 : (dim ? 0.45 : 0.78)
      };
    }

    function tipHtml(m, total, md) {
      var s = m.site, sc = num(s.score);
      var val = m.v
        ? '<div class="ym-tip-v"><b>' + fmt(m.v) + '</b> <span>' + esc(md.label) + '</span></div>'
          + '<div class="ym-tip-s">' + share(m.v, total) + ' of your ' + esc(md.noun) + '</div>'
        : '<div class="ym-tip-s ym-tip-na">Does not report ' + esc(md.noun) + '</div>';
      var kind = s.kind && String(s.kind).toLowerCase() !== String(s.name).toLowerCase() ? s.kind : 'Site';
      return '<div class="ym-tip-k">' + esc(kind) + '</div>'
        + '<div class="ym-tip-n">' + esc(s.name) + '</div>' + val
        + '<div class="ym-tip-sc">' + (sc != null ? 'Score <b>' + Math.round(sc) + '</b>' : 'No score yet') + '</div>';
    }

    /* flip the tooltip so it stays inside the map: above by default, below near the top edge,
       to the side near the left or right edge */
    function aimTip(tip, layer, r) {
      var el = tip.getElement && tip.getElement(); if (!el) return;
      var p = map.latLngToContainerPoint(layer.getLatLng()), size = map.getSize();
      var w = el.offsetWidth || 200, h = el.offsetHeight || 110, g = r + 6, dir = 'top';
      if (p.y - g - h < 8) dir = 'bottom';
      if (p.x - w / 2 < 8) dir = 'right';
      else if (p.x + w / 2 > size.x - 8) dir = 'left';
      if ((dir === 'right' || dir === 'left') && (p.y - h / 2 < 8 || p.y + h / 2 > size.y - 8)) {
        // corner: keep vertical placement and accept a sideways nudge instead
        dir = p.y - g - h < 8 ? 'bottom' : 'top';
      }
      var off = { top: [0, -g], bottom: [0, g], left: [-g, 0], right: [g, 0] }[dir];
      tip.options.direction = dir; tip.options.offset = L.point(off);
      tip.update();
      // horizontal clamp for top/bottom tooltips in narrow maps
      if (dir === 'top' || dir === 'bottom') {
        var left = p.x - w / 2, shift = left < 8 ? 8 - left : (left + w > size.x - 8 ? size.x - 8 - left - w : 0);
        if (shift) { tip.options.offset = L.point(off[0] + shift, off[1]); tip.update(); }
      }
    }

    function clearLayers() {
      Object.keys(state.markers).forEach(function (id) { map.removeLayer(state.markers[id].layer); });
      state.labels.forEach(function (l) { map.removeLayer(l); });
      if (state.halo) map.removeLayer(state.halo);
      state.markers = {}; state.labels = []; state.halo = null; state.order = [];
    }

    function restack() {
      state.order.forEach(function (m) { m.layer.bringToFront(); });
      if (state.halo) state.halo.bringToFront();
    }

    function draw() {
      clearLayers();
      var md = metricDef(), key = md.key;
      var list = state.sites.map(function (s) {
        var v = num(s.values && s.values[key]);
        return { site: s, v: v && v > 0 ? v : 0 };
      });
      var max = 0, total = 0;
      list.forEach(function (m) { if (m.v > max) max = m.v; total += m.v; });
      list.forEach(function (m) { m.r = m.v ? Math.max(R_MIN, R_MAX * Math.sqrt(m.v / max)) : R_EMPTY; });
      // largest underneath, smallest on top, so small sites stay clickable
      list.sort(function (a, b) { return b.v - a.v; });
      state.order = list;

      list.forEach(function (m) {
        var s = m.site;
        var layer = L.circleMarker([+s.lat, +s.lng], baseStyle(m));
        layer.bindTooltip(tipHtml(m, total, md), { className: 'ym-tip', direction: 'top', offset: [0, -(m.r + 4)], opacity: 1 });
        layer.on('tooltipopen', function (e) { aimTip(e.tooltip, layer, m.r); });
        layer.on('mouseover', function () { state.hovered = s.id; layer.setStyle(baseStyle(m)); layer.bringToFront(); if (state.halo) state.halo.bringToFront(); });
        layer.on('mouseout', function () { if (state.hovered === s.id) state.hovered = null; layer.setStyle(baseStyle(m)); restack(); });
        layer.on('click', function (e) { if (e && e.originalEvent) L.DomEvent.stopPropagation(e); choose(s.id); });
        layer.addTo(map);
        var p = layer.getElement && layer.getElement();
        if (p) {
          p.setAttribute('data-ym-id', s.id);
          p.setAttribute('tabindex', '0'); p.setAttribute('role', 'button');
          p.setAttribute('aria-label', s.name + (m.v ? ', ' + fmt(m.v) + ' ' + md.label + ', ' + share(m.v, total) + ' of your ' + md.noun : ''));
          p.addEventListener('focus', function () { layer.openTooltip(); });
          p.addEventListener('blur', function () { layer.closeTooltip(); });
          p.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); choose(s.id); } });
        }
        m.layer = layer;
        state.markers[s.id] = m;
      });

      if (!compact) {
        list.filter(function (m) { return m.v > 0; }).slice(0, 3).forEach(function (m) {
          var icon = L.divIcon({ className: 'ym-lbl', iconSize: [0, 0], html: '<span>' + esc(m.site.name) + '</span>' });
          var lm = L.marker([+m.site.lat, +m.site.lng], { icon: icon, interactive: false, keyboard: false }).addTo(map);
          lm._ym = m;
          state.labels.push(lm);
        });
        placeLabels();
      }

      if (pillsCtl) {
        var bs = pillsCtl.getContainer().querySelectorAll('.ym-pill');
        for (var i = 0; i < bs.length; i++) {
          var on = bs[i].getAttribute('data-k') === key;
          bs[i].classList.toggle('is-on', on); bs[i].setAttribute('aria-pressed', on ? 'true' : 'false');
        }
      }
      paintSelection();
    }

    /* put each permanent label on the side (right, left, below, above) that collides least
       with other markers, earlier labels and the map edge */
    function placeLabels() {
      if (!state.labels.length) return;
      var size = map.getSize(), placed = [];
      var circles = state.order.map(function (m) { var p = map.latLngToContainerPoint(m.layer.getLatLng()); return { x: p.x, y: p.y, r: m.r, id: m.site.id }; });
      function hitCircle(rc, c) {
        var nx = Math.max(rc.x1, Math.min(c.x, rc.x2)), ny = Math.max(rc.y1, Math.min(c.y, rc.y2));
        var dx = c.x - nx, dy = c.y - ny, rr = c.r + 2;
        return dx * dx + dy * dy < rr * rr ? 1 : 0;
      }
      function overlap(a, b) {
        var w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1), h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
        return w > 0 && h > 0 ? w * h : 0;
      }
      state.labels.forEach(function (lm) {
        var m = lm._ym, el = lm.getElement && lm.getElement(), span = el && el.firstChild;
        if (!span) return;
        var p = map.latLngToContainerPoint(m.layer.getLatLng());
        var w = span.offsetWidth || 90, h = span.offsetHeight || 17, g = m.r + 5;
        var opts4 = [
          { k: 'r', x1: p.x + g, y1: p.y - h / 2 },
          { k: 'l', x1: p.x - g - w, y1: p.y - h / 2 },
          { k: 'b', x1: p.x - w / 2, y1: p.y + g - 1 },
          { k: 't', x1: p.x - w / 2, y1: p.y - g - h + 1 }
        ];
        var best = null;
        opts4.forEach(function (o, i) {
          o.x2 = o.x1 + w; o.y2 = o.y1 + h;
          var cost = i * 0.5;
          circles.forEach(function (c) { if (c.id !== m.site.id) cost += hitCircle(o, c) * 40; });
          placed.forEach(function (r) { cost += overlap(o, r) * 2; });
          var out = Math.max(0, -o.x1) + Math.max(0, o.x2 - size.x) + Math.max(0, 44 - o.y1) + Math.max(0, o.y2 - (size.y - 40));
          cost += out * 3;
          if (!best || cost < best.cost) { best = o; best.cost = cost; }
        });
        span.style.left = Math.round(best.x1 - p.x) + 'px';
        span.style.top = Math.round(best.y1 - p.y) + 'px';
        placed.push(best);
      });
    }
    map.on('zoomend moveend resize', placeLabels);

    function paintSelection() {
      if (state.halo) { map.removeLayer(state.halo); state.halo = null; }
      Object.keys(state.markers).forEach(function (id) { var m = state.markers[id]; m.layer.setStyle(baseStyle(m)); });
      root.classList.toggle('ym-has-sel', !!state.selected);
      var m = state.selected && state.markers[state.selected];
      if (m) {
        state.halo = L.circleMarker(m.layer.getLatLng(), {
          radius: m.r + 5, color: ORANGE, weight: 3, opacity: 1, fill: false, interactive: false
        }).addTo(map);
        var p = m.layer.getElement && m.layer.getElement(); if (p) p.setAttribute('aria-pressed', 'true');
      }
      restack();
    }

    function choose(id) {
      handle.select(id);
      if (typeof opts.onSelect === 'function') { try { opts.onSelect(id); } catch (e) { setTimeout(function () { throw e; }); } }
    }

    function showEmpty(on) { emptyEl.hidden = !on; root.classList.toggle('ym-is-empty', on); }

    /* ---------- public handle ---------- */
    var handle = {
      update: function (sites, metric) {
        if (state.destroyed) return handle;
        var before = state.sites.map(function (s) { return s.id; }).join('|');
        state.sites = validSites(sites);
        if (metric && metrics.some(function (m) { return m.key === metric; })) state.metric = metric;
        if (state.selected && !state.sites.some(function (s) { return s.id === state.selected; })) state.selected = null;
        showEmpty(!state.sites.length);
        draw();
        var after = state.sites.map(function (s) { return s.id; }).join('|');
        if (!state.fitted || before !== after) handle.fit();
        return handle;
      },
      setMetric: function (key) {
        if (state.destroyed || !metrics.some(function (m) { return m.key === key; })) return handle;
        state.metric = key; draw(); return handle;
      },
      select: function (id) {
        if (state.destroyed) return handle;
        state.selected = id != null && state.markers[id] ? id : null;
        paintSelection();
        var m = state.selected && state.markers[state.selected];
        if (m && !map.getBounds().pad(-0.1).contains(m.layer.getLatLng())) map.panTo(m.layer.getLatLng());
        return handle;
      },
      fit: function (quiet) {
        if (state.destroyed || !state.sites.length) return handle;
        var b = L.latLngBounds(state.sites.map(function (s) { return [+s.lat, +s.lng]; }));
        var p = narrow() ? 20 : 40, top = compact ? p : p + (narrow() ? 30 : 34);
        state.fitting = true;
        map.fitBounds(b, { paddingTopLeft: [p, top], paddingBottomRight: [p, p], maxZoom: 14, animate: state.fitted && quiet !== true });
        setTimeout(function () { state.fitting = false; }, 450);
        state.fitted = true; state.autoFit = true;
        return handle;
      },
      destroy: function () {
        if (state.destroyed) return;
        state.destroyed = true;
        cancelAnimationFrame(raf);
        if (ro) ro.disconnect();
        try { map.off(); map.remove(); } catch (e) { /* already gone */ }
        if (root.parentNode) root.parentNode.removeChild(root);
      },
      get map() { return map; }
    };

    handle.update(opts.sites || [], state.metric);
    return handle;
  }

  window.YartaMap = { mount: mount, version: '1.0.0' };
})();
