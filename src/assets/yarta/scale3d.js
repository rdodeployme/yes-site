/* Yarta · "Your year, to scale" — 3D volume module.
   Plain script. Defines window.YartaScale = { supported, describe, mount }.
   Loads ../vendor/yarta-3d.js (three r170 + GLTFLoader + OrbitControls) lazily, only when mount() is called. */
(function () {
  'use strict';

  var SRC = (document.currentScript && document.currentScript.src) || '';
  var BASE = SRC ? SRC.replace(/[^\/]*(\?.*)?$/, '') : '';
  var VENDOR_URL = BASE + '../vendor/yarta-3d.js';
  var GLB_BASE = BASE + 'glb/';

  /* ---------- fixed conversions ---------- */
  var CONV = {
    gasM3PerT: 537,          // ideal gas, 15 °C, 101.325 kPa; 23.64 L/mol, CO₂ 44.01 g/mol
    landfillTPerM3: 0.8,     // in-place compacted density, mixed municipal waste (assumption, 0.7–1.0)
    poolM3: 2500             // Olympic pool 50 × 25 × 2 m
  };

  /* ---------- reference objects (real-world size, metres) ---------- */
  var REFS = [
    { key: 'person', name: 'Person',                  dim: 1.75, dimText: '1.75 m',        pri: 0, noun: 'height', as: 'as tall as', what: 'a person', pl: 'people', tall: true },
    { key: 'car',    name: 'Family car',              dim: 4.5,  dimText: '4.5 m',         pri: 1, noun: 'length', as: 'as long as', what: 'a family car',       glb: 'car.glb',   axis: 'x', rotY: 0 },
    { key: 'bus',    name: 'City bus',                dim: 12.5, dimText: '12.5 m',        pri: 2, noun: 'length', as: 'as long as', what: 'a city bus',         glb: 'bus.glb',   axis: 'z', rotY: Math.PI / 2 },
    { key: 'house',  name: 'Two-storey house',        dim: 12,   dimText: '12 m wide',     pri: 3, noun: 'width',  as: 'as wide as', what: 'a two-storey house', glb: 'house.glb', axis: 'x', rotY: 0 },
    { key: 'tower',  name: 'Ten-storey office',       dim: 35,   dimText: '35 m',          pri: 4, noun: 'height', as: 'as tall as', what: 'a ten-storey office', pl: 'ten-storey offices', tall: true, glb: 'tower.glb', axis: 'y', rotY: 0 },
    { key: 'oval',   name: 'Football oval',           dim: 165,  dimText: '165 × 135 m',   pri: 5, noun: 'width',  as: 'as wide as', what: 'a football oval' },
    { key: 'pool',   name: 'Olympic pool',            dim: 50,   dimText: '50 × 25 × 2 m', pri: 6, noun: 'length', as: 'as long as', what: 'an Olympic pool' },
    { key: 'truck',  name: 'Garbage truck',           dim: 9,    dimText: '9 m',           pri: 7, noun: 'length', as: 'as long as', what: 'a garbage truck',    glb: 'truck.glb', axis: 'z', rotY: Math.PI / 2 }
  ];
  var REF_BY_KEY = {};
  REFS.forEach(function (r) { REF_BY_KEY[r.key] = r; });

  /* ---------- number formatting (Australian English) ---------- */
  function sig3(n) {
    if (!isFinite(n) || n === 0) return 0;
    var p = Math.pow(10, 2 - Math.floor(Math.log10(Math.abs(n))));
    return Math.round(n * p) / p;
  }
  function fmtInt(n) {
    n = Math.round(n);
    var s = String(Math.abs(n)), out = '';
    while (s.length > 3) { out = ',' + s.slice(-3) + out; s = s.slice(0, -3); }
    return (n < 0 ? '-' : '') + s + out;
  }
  function fmtNum(n) {            // ≤ 3 significant figures, thousands separators
    var v = sig3(n);
    if (Math.abs(v) >= 1000) return fmtInt(v);
    return String(v);
  }
  function fmtVol(m3) {
    if (m3 >= 1e9) return fmtNum(m3 / 1e9) + ' billion m³';
    if (m3 >= 1e6) return fmtNum(m3 / 1e6) + ' million m³';
    return fmtNum(m3) + ' m³';
  }
  var WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  function timesWord(n) { return n <= 12 ? WORDS[n] : fmtInt(n); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- geometry of a figure ---------- */
  function volumeOf(fig) {
    var v = Number(fig.value) || 0;
    if (fig.kind === 'water') return v;                      // kL = m³
    if (fig.kind === 'landfill' || fig.kind === 'kept') return v / CONV.landfillTPerM3;
    return v * CONV.gasM3PerT;                               // gas
  }
  function sideOf(fig) { return Math.cbrt(volumeOf(fig)); }

  // Which references to show for a cube of side L. 3–5 spanning ≈ L/22 … 1.5 L; person always when L < 80.
  function pickRefs(L) {
    var lo = L / 22, hi = L * 1.5;
    var cands = REFS.filter(function (r) { return r.dim >= lo && r.dim <= hi && r.key !== 'truck'; });
    if (L < 80 && cands.indexOf(REF_BY_KEY.person) < 0) cands.push(REF_BY_KEY.person);
    var truck = REF_BY_KEY.truck;
    if (cands.length < 4 && truck.dim >= lo && truck.dim <= hi) cands.push(truck);
    cands.sort(function (a, b) { return a.pri - b.pri; });
    cands = cands.slice(0, 5);
    var bySize = REFS.slice().sort(function (a, b) { return a.dim - b.dim; });
    var i;
    if (cands.length < 3) {                                   // pad outward
      for (i = 0; i < bySize.length && cands.length < 3; i++) {
        if (bySize[i].dim > hi && cands.indexOf(bySize[i]) < 0) cands.push(bySize[i]);
      }
      for (i = bySize.length - 1; i >= 0 && cands.length < 3; i--) {
        if (bySize[i].dim < lo && cands.indexOf(bySize[i]) < 0) cands.push(bySize[i]);
      }
    }
    cands.sort(function (a, b) { return a.dim - b.dim; });
    return cands;
  }

  function compare(L, ref) {
    var r = L / ref.dim;
    if (r < 0.92) return 'almost ' + ref.as + ' ' + ref.what;
    if (r <= 1.12) return 'about ' + ref.as + ' ' + ref.what;
    if (r < 1.3) return ref.as.replace('as ', '').replace(/ as$/, '') + 'er than ' + ref.what;   // taller / wider / longer than
    if (r < 1.75) return 'one and a half times the ' + ref.noun + ' of ' + ref.what;
    if (r < 2.25) return 'twice the ' + ref.noun + ' of ' + ref.what;
    if (r < 2.75) return 'two and a half times the ' + ref.noun + ' of ' + ref.what;
    return timesWord(Math.round(r)) + ' times the ' + ref.noun + ' of ' + ref.what;
  }

  function leadFor(fig) {
    if (fig.lead) return fig.lead;
    var label = String(fig.label || '');
    var m;
    switch (fig.key) {
      case 'emissions': return 'A year of your emissions';
      case 'cut': m = /\bon\s+(.+)$/i.exec(label); return 'The emissions you cut' + (m ? ' against ' + m[1] : '');
      case 'landfill': return 'Your waste to landfill';
      case 'kept': return 'What you kept out of landfill';
      case 'water': return 'Your drinking water';
    }
    return 'Your ' + label.toLowerCase();
  }

  function poolCount(fig) { return Math.max(1, Math.round(volumeOf(fig) / CONV.poolM3)); }

  /* Plain-words sentence + basis for a figure. */
  function describe(fig) {
    if (!fig) return { sentence: '', basis: '' };
    var value = Number(fig.value) || 0, unit = fig.unit || '';
    var vol = volumeOf(fig), lead = leadFor(fig);
    var refsNote = ' Reference objects are drawn at the dimensions stated on their labels.';
    if (fig.kind === 'water') {
      var n = volumeOf(fig) / CONV.poolM3, N = poolCount(fig);
      var nText = (Math.abs(n - N) < 0.05 ? '' : 'about ') + fmtInt(N);
      return {
        sentence: lead + ' would fill ' + nText + ' Olympic pool' + (N === 1 ? '' : 's') + ' of 2,500 kL each.',
        basis: 'One kilolitre is exactly one cubic metre. An Olympic pool is 50 × 25 m at the minimum competition depth of 2 m, so it holds 2,500 m³. ' +
               fmtInt(value) + ' ' + unit + ' is ' + fmtVol(vol) + ' — ' + fmtNum(n) + ' pools' +
               (N > 400 ? ', drawn here with each slab standing for ten pools.' : ', each drawn here at full size.') + refsNote
      };
    }
    var L = sideOf(fig), refs = pickRefs(L), big = refs[refs.length - 1];
    var Ls = fmtNum(L);
    var sentence = lead + ' would fill a cube ' + Ls + ' m on each side — ' + compare(L, big) + '.';
    var basis;
    if (fig.kind === 'landfill' || fig.kind === 'kept') {
      basis = 'Waste is drawn at an in-place compacted density of 0.8 t per m³, the usual figure for mixed municipal waste once it has settled in a landfill cell. ' +
              'This is an assumption; the typical range is 0.7–1.0 t/m³. ' + fmtInt(value) + ' ' + unit + ' is ' + fmtVol(vol) + ' — a cube ' + Ls + ' m on each side.' + refsNote;
    } else {
      basis = 'Carbon dioxide equivalent is drawn as a gas at 15 °C and 101.325 kPa: 537 m³ per tonne (molar volume 23.64 L/mol, CO₂ 44.01 g/mol). ' +
              fmtInt(value) + ' ' + unit + ' is ' + fmtVol(vol) + ' — a cube ' + Ls + ' m on each side.' + refsNote;
    }
    return { sentence: sentence, basis: basis };
  }

  /* How many of a familiar tall thing the cube is high: only objects whose stated dimension is a height. */
  function yardFor(L) {
    var c = [REF_BY_KEY.tower, REF_BY_KEY.person], i;
    for (i = 0; i < c.length; i++) { var r = L / c[i].dim; if (r >= 1.8 && r <= 16.4) return { ref: c[i], n: Math.round(r), exact: Math.abs(r - Math.round(r)) < 0.08 }; }
    return null;
  }
  function yardText(L) { var y = yardFor(L); return y ? (y.exact ? '' : 'about ') + y.n + ' ' + y.ref.pl + ' high' : ''; }

  /* ---------- support check ---------- */
  function supported() {
    try {
      if (typeof window === 'undefined' || !window.WebGLRenderingContext) return false;
      var ua = navigator.userAgent || '';
      if (/MSIE|Trident\//.test(ua)) return false;
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return false;
      var lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      return true;
    } catch (e) { return false; }
  }

  var reduced = false;
  try { reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var threePromise = null;
  function loadThree() {
    if (!threePromise) {
      threePromise = import(VENDOR_URL).then(function (m) { return m; });
    }
    return threePromise;
  }

  var YartaScale = { supported: supported, describe: describe, conversions: CONV, references: REFS, pickRefs: pickRefs };
  window.YartaScale = YartaScale;

/* ==== PART 2 (scene) appended below ==== */

  /* =====================================================================
     SCENE
     ===================================================================== */
  var COL = { ink: 0x120E0B, ground: 0x1B1511, charcoal: 0x2E2620, graphite: 0x8F8880, slate: 0x7C8184, mist: 0xDDD3C6,
              paper: 0xF4F4F2, orange: 0xCF7A2E, orangeL: 0xE9A860, orangeD: 0xB8641F };
  /* each figure has its own colour, taken from the dashboard's category colours, so the five scenes are not one orange box */
  var TONE = {
    gas:      { edge: 0xCF7A2E, side: 0xCF7A2E, top: 0xE9A860, sideOp: 0.34, topOp: 0.42, css: '#CF7A2E', cssL: '#E9A860' },
    cut:      { edge: 0x7FB894, side: 0x2E6B4A, top: 0x7FB894, sideOp: 0.42, topOp: 0.46, css: '#5FA57D', cssL: '#9CCDB0' },
    landfill: { edge: 0xC4936B, side: 0x9A6A47, top: 0xC4936B, sideOp: 0.62, topOp: 0.78, css: '#C4936B', cssL: '#DDB796' },
    kept:     { edge: 0x7FB894, side: 0x2E6B4A, top: 0x7FB894, sideOp: 0.42, topOp: 0.46, css: '#5FA57D', cssL: '#9CCDB0' },
    water:    { edge: 0x6FB3D2, side: 0x2C6E8F, top: 0x6FB3D2, sideOp: 1, topOp: 0.9, css: '#6FB3D2', cssL: '#A5D2E6' }
  };
  function toneOf(fig) { return TONE[fig.key === 'cut' ? 'cut' : fig.kind] || TONE.gas; }
  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³' };

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function niceStep(span, minLines, maxLines) {
    var steps = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000], i;
    for (i = 0; i < steps.length; i++) { var n = span / steps[i]; if (n >= minLines && n <= maxLines) return steps[i]; }
    for (i = 0; i < steps.length; i++) { if (span / steps[i] <= maxLines) return steps[i]; }
    return steps[steps.length - 1];
  }

  function mount(host, data, opts) {
    opts = opts || {};
    if (!host || !supported()) return Promise.resolve(null);
    var T;
    return loadThree().then(function (three) {
      T = three;
      try { return buildScene(T, host, data, opts); }
      catch (e) { if (window.console) console.warn('YartaScale: scene failed', e); return null; }
    }, function (e) { if (window.console) console.warn('YartaScale: 3D bundle failed to load', e); return null; });
  }

  function buildScene(T, host, data, opts) {
    var isPhone = host.clientWidth < 700;
    var figures = (data && data.figures || []).slice();
    var current = null, destroyed = false, interacted = false;

    /* ---------- DOM ---------- */
    host.classList.add('sc-root');
    var canvas = el('canvas', 'sc-canvas'); canvas.tabIndex = 0; canvas.setAttribute('role', 'img');
    var gridNote = el('div', 'sc-grid');
    var labels = el('div', 'sc-labels');
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'sc-leaders');
    var ui = el('div', 'sc-ui');
    var pillRow = el('div', 'sc-pills');
    var resetBtn = el('button', 'sc-reset', 'Whole view');
    resetBtn.type = 'button';
    var closeBtn = el('button', 'sc-reset sc-close', 'Close up');
    closeBtn.type = 'button'; closeBtn.title = 'Fly in to the comparison objects beside the edge of your figure';
    var btns = el('div', 'sc-btns'); btns.appendChild(closeBtn); btns.appendChild(resetBtn);
    var hint = el('div', 'sc-hint', isPhone ? 'Drag to turn · pinch to zoom' : 'Drag to turn · scroll to zoom where you point · shift-drag to move');
    host.appendChild(canvas); host.appendChild(svg); host.appendChild(labels);
    if (opts.controls !== false) ui.appendChild(pillRow);
    ui.appendChild(btns); ui.appendChild(gridNote); host.appendChild(ui); host.appendChild(hint);

    /* ---------- renderer ---------- */
    var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));   // 2x doubles the fill cost for little visible gain on a dark scene
    renderer.setClearColor(COL.ink, 1);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.shadowMap.enabled = opts.shadows !== false;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;   // the light never moves: redraw the shadow map only when the scene changes, not on every camera frame
    renderer.shadowMap.needsUpdate = true;

    var scene = new T.Scene();
    scene.background = new T.Color(COL.ink);
    scene.fog = new T.Fog(COL.ink, 100, 1000);

    var camera = new T.PerspectiveCamera(35, 16 / 9, 0.5, 5000);
    camera.position.set(0, 40, 160);

    var controls = new T.OrbitControls(camera, canvas);
    controls.enablePan = true;                 // right-drag, shift-drag or two fingers moves across the scene
    controls.screenSpacePanning = false;       // panning slides along the ground, never under it
    // the wheel is handled below: it zooms towards the object under the pointer and never past it
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.6;
    controls.zoomSpeed = 0.7;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = Math.PI / 2 - 0.035;
    controls.autoRotate = !reduced && opts.autoRotate !== false;
    controls.autoRotateSpeed = 0.25;          // 0.25 rpm (2.0 = 30 s per orbit)

    /* ---------- lights ---------- */
    var hemi = new T.HemisphereLight(COL.mist, COL.ink, 0.55);
    scene.add(hemi);
    var key = new T.DirectionalLight(0xFFFFFF, 2.1);
    key.castShadow = true;
    key.shadow.mapSize.set(isPhone ? 1024 : 2048, isPhone ? 1024 : 2048);
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    if ('intensity' in key.shadow) key.shadow.intensity = 0.6;
    scene.add(key); scene.add(key.target);
    var fill = new T.DirectionalLight(0xFFFFFF, 0.35);
    scene.add(fill);

    /* ---------- materials ---------- */
    var matGround = new T.MeshStandardMaterial({ color: COL.ground, roughness: 1, metalness: 0 });
    var matGraphite = new T.MeshStandardMaterial({ color: COL.graphite, roughness: 0.9, metalness: 0, transparent: true, opacity: 1 });
    var matCharcoal = new T.MeshStandardMaterial({ color: COL.charcoal, roughness: 0.95, metalness: 0, transparent: true, opacity: 1 });
    var matPoolTop = new T.MeshStandardMaterial({ color: 0x6FB3D2, roughness: 0.6, metalness: 0, transparent: true, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    var matPoolSlab = new T.MeshStandardMaterial({ color: 0x3B5F70, roughness: 0.95, metalness: 0 });
    var matBand = new T.LineBasicMaterial({ color: COL.orange, transparent: true, opacity: 0, depthWrite: false });
    var matEdgeMist = new T.LineBasicMaterial({ color: COL.mist, transparent: true, opacity: 0.3 });
    var matEdgeOval = new T.LineBasicMaterial({ color: COL.mist, transparent: true, opacity: 0.55 });
    var matGridMinor = new T.LineBasicMaterial({ color: COL.mist, transparent: true, opacity: 0.11, depthWrite: false });
    var matGridMajor = new T.LineBasicMaterial({ color: COL.mist, transparent: true, opacity: 0.22, depthWrite: false });
    var matHeroEdge = new T.LineBasicMaterial({ color: COL.orange, transparent: true, opacity: 0.95 });
    var matHeroSide = new T.MeshStandardMaterial({ color: COL.orange, roughness: 1, metalness: 0, transparent: true, opacity: 0.35, depthWrite: false, side: T.FrontSide });
    var matHeroTop  = new T.MeshStandardMaterial({ color: COL.orangeL, roughness: 1, metalness: 0, transparent: true, opacity: 0.42, depthWrite: false });
    var hatch = makeHatchTexture(T);
    var matLandSide = new T.MeshStandardMaterial({ color: 0x9A6A47, roughness: 1, metalness: 0, transparent: true, opacity: 0.62, depthWrite: false });
    var matLandTop  = new T.MeshStandardMaterial({ color: 0xFFFFFF, map: hatch, roughness: 1, metalness: 0, transparent: true, opacity: 0.94, depthWrite: false });
    var matLandEdge = new T.LineBasicMaterial({ color: 0xDDB796, transparent: true, opacity: 0.9 });
    var contactTex = makeContactTexture(T);
    var matContact = new T.MeshBasicMaterial({ map: contactTex, transparent: true, opacity: 0.55, depthWrite: false, color: 0x000000 });
    var disposables = [matGround, matGraphite, matCharcoal, matPoolTop, matEdgeMist, matEdgeOval, matGridMinor, matGridMajor, matHeroEdge, matHeroSide, matHeroTop, hatch, matLandSide, matLandTop, matLandEdge, contactTex, matContact, matPoolSlab, matBand];

    /* ---------- ground + grid ---------- */
    var groundGroup = new T.Group(); scene.add(groundGroup);
    var ground = new T.Mesh(new T.PlaneGeometry(1, 1), matGround);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    groundGroup.add(ground);
    var gridMinor = null, gridMajor = null, gridStep = 0;
    function buildGrid(S, dist) {
      var span = 3.6 * S;                                  // approx. width in view
      var step = niceStep(span, 10, 40), major = step * 10;
      var ext = Math.ceil(1.3 * dist / major) * major;     // fog takes the rest
      ground.scale.set(ext * 8, ext * 8, 1);
      ground.position.y = -0.0008 * S;
      if (step === gridStep && gridMinor && Math.abs(gridMinor.userData.ext - ext) < 1e-6) return;
      gridStep = step; gridNote.textContent = 'Grid squares ' + fmtNum(step) + ' m';
      if (gridMinor) { groundGroup.remove(gridMinor); gridMinor.geometry.dispose(); }
      if (gridMajor) { groundGroup.remove(gridMajor); gridMajor.geometry.dispose(); }
      var minor = [], maj = [], v, isMajor;
      for (v = -ext; v <= ext + 1e-6; v += step) {
        isMajor = Math.abs(Math.round(v / major) * major - v) < 1e-6;
        var arr = isMajor ? maj : minor;
        arr.push(v, 0, -ext, v, 0, ext, -ext, 0, v, ext, 0, v);
      }
      gridMinor = lineSeg(minor, matGridMinor); gridMajor = lineSeg(maj, matGridMajor);
      gridMinor.userData.ext = ext;
      groundGroup.add(gridMinor); groundGroup.add(gridMajor);
    }
    function lineSeg(arr, mat) {
      var g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(arr, 3));
      var l = new T.LineSegments(g, mat); l.renderOrder = 1; return l;
    }

    /* ---------- hero (cube / pools) ---------- */
    var heroGroup = new T.Group(); scene.add(heroGroup);
    var contact = new T.Mesh(new T.PlaneGeometry(1, 1), matContact);
    contact.rotation.x = -Math.PI / 2; contact.renderOrder = 2; contact.visible = false;
    scene.add(contact);
    var cubeGeo = new T.BoxGeometry(1, 1, 1);
    var cubeEdgeGeo = new T.EdgesGeometry(cubeGeo);
    var cube = new T.Mesh(cubeGeo, [matHeroSide, matHeroSide, matHeroTop, matHeroSide, matHeroSide, matHeroSide]);
    cube.renderOrder = 10;
    var cubeEdges = new T.LineSegments(cubeEdgeGeo, matHeroEdge); cubeEdges.renderOrder = 11;
    cube.add(cubeEdges);
    heroGroup.add(cube);
    var poolsGroup = new T.Group(); heroGroup.add(poolsGroup);
    var bands = null;   // level lines up the cube, one per yardstick height
    function buildBands(L) {
      if (bands) { scene.remove(bands); bands.geometry.dispose(); bands = null; }
      var y = heroMode === 'cube' ? yardFor(L) : null; if (!y || y.n > 8) return;   // more than eight lines is clutter: the label still gives the count
      var a = [], h = L / 2, k, yy;
      for (k = 1; k <= y.n && k * y.ref.dim < L - 0.02 * L; k++) { yy = k * y.ref.dim; a.push(-h, yy, h, h, yy, h, h, yy, h, h, yy, -h, h, yy, -h, -h, yy, -h, -h, yy, -h, -h, yy, h); }
      if (!a.length) return;
      bands = lineSeg(a, matBand); bands.renderOrder = 12; scene.add(bands);
    }
    disposables.push(cubeGeo, cubeEdgeGeo);

    /* ---------- reference objects ---------- */
    var refObjs = {};             // key -> {group, w, d, h, mats:[], ready}
    var refsLayer = new T.Group(); scene.add(refsLayer);

    function finishRef(key, obj, axis, dim, rotY) {
      // strip materials, apply matte graphite, add edge lines, normalise size, sit on ground
      var mat = matGraphite.clone(); var edge = matEdgeMist.clone();
      var wrap = new T.Group(); var inner = new T.Group();
      inner.add(obj); inner.rotation.y = rotY || 0;
      obj.traverse(function (n) {
        if (n.isMesh) {
          if (n.material) disposeMat(n.material);
          n.material = mat; n.castShadow = true; n.receiveShadow = false;
          if (n.geometry && !n.geometry.userData.edged) {
            var eg = new T.EdgesGeometry(n.geometry, opts.edgeAngle || 40);
            var ls = new T.LineSegments(eg, edge); ls.renderOrder = 5;
            n.add(ls); n.geometry.userData.edged = true;
          }
        }
      });
      wrap.add(inner);
      var box = new T.Box3().setFromObject(inner);
      var size = new T.Vector3(); box.getSize(size);
      var cur = axis === 'x' ? size.x : axis === 'y' ? size.y : size.z;
      // trust the file: if the stated axis is not the longest, use the longest
      var longest = Math.max(size.x, size.y, size.z);
      if (axis !== 'y' && cur < longest * 0.98) cur = longest;
      var s = dim / (cur || 1);
      inner.scale.setScalar(s);
      box.setFromObject(inner); box.getSize(size);
      var c = new T.Vector3(); box.getCenter(c);
      inner.position.set(-c.x, -box.min.y, -c.z);
      refObjs[key] = { group: wrap, w: size.x, d: size.z, h: size.y, mats: [mat, edge], key: key };
      wrap.visible = false; refsLayer.add(wrap);
      disposables.push(mat, edge);
      return refObjs[key];
    }
    function disposeMat(m) { if (Array.isArray(m)) m.forEach(function (x) { x.dispose && x.dispose(); }); else if (m && m.dispose) m.dispose(); }

    function fallbackBox(r) {
      var w, h, d;
      switch (r.key) {
        case 'car': w = 4.5; h = 1.5; d = 1.8; break;
        case 'bus': w = 12.5; h = 3.2; d = 2.5; break;
        case 'truck': w = 9; h = 3.4; d = 2.5; break;
        case 'house': w = 12; h = 8; d = 10; break;
        case 'tower': w = 18; h = 35; d = 16; break;
        default: w = h = d = r.dim;
      }
      var g = new T.BoxGeometry(w, h, d); g.translate(0, h / 2, 0);
      var m = new T.Mesh(g, matGraphite); disposables.push(g);
      return finishRef(r.key, m, 'x', r.key === 'tower' ? 35 : w, 0);
    }

    function buildPerson() {
      var g = new T.Group();
      var body = new T.Mesh(new T.CapsuleGeometry(0.21, 0.95, 6, 14), matGraphite); body.position.y = 0.21 + 0.475;
      var head = new T.Mesh(new T.SphereGeometry(0.125, 18, 14), matGraphite); head.position.y = 1.4 + 0.125 + 0.04;
      g.add(body); g.add(head); disposables.push(body.geometry, head.geometry);
      var o = finishRef('person', g, 'y', 1.75, 0);
      // smooth primitives: drop the busy edge lines, keep silhouette only via lighting
      o.group.traverse(function (n) { if (n.isLineSegments) n.visible = false; });
      return o;
    }
    function buildPoolGeometry() {
      // returns {slab, top, edges} geometries for one pool, origin at centre of footprint on ground
      var slab = new T.BoxGeometry(50, 2, 25); slab.translate(0, 1, 0);
      var top = new T.PlaneGeometry(47.5, 22.5); top.rotateX(-Math.PI / 2); top.translate(0, 2.06, 0);
      var edges = new T.EdgesGeometry(slab);
      disposables.push(slab, top, edges);
      return { slab: slab, top: top, edges: edges };
    }
    var poolGeo = buildPoolGeometry();
    function buildPool() {
      var g = new T.Group();
      var slab = new T.Mesh(poolGeo.slab, matGraphite); slab.castShadow = true;
      var top = new T.Mesh(poolGeo.top, matPoolTop); top.renderOrder = 3;
      var ed = new T.LineSegments(poolGeo.edges, matEdgeOval); ed.renderOrder = 5;
      g.add(slab); g.add(top); g.add(ed);
      var o = finishRef('pool', g, 'x', 50, 0);
      // finishRef replaced materials; restore the water top + rim so the pool reads as a pool
      top.material = matPoolTop; ed.material = matEdgeOval; slab.material = matPoolSlab;
      return o;
    }
    function buildOval() {
      var g = new T.Group();
      var cyl = new T.CylinderGeometry(1, 1, 0.3, 128, 1, false); cyl.translate(0, 0.15, 0);
      var m = new T.Mesh(cyl, matCharcoal); m.scale.set(82.5, 1, 67.5); m.receiveShadow = true;
      var pts = [], i, n = 128;
      for (i = 0; i < n; i++) {
        var a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
        pts.push(Math.cos(a0) * 82.5, 0.31, Math.sin(a0) * 67.5, Math.cos(a1) * 82.5, 0.31, Math.sin(a1) * 67.5);
      }
      var outline = lineSeg(pts, matEdgeOval); outline.renderOrder = 5;
      g.add(m); g.add(outline); disposables.push(cyl);
      var o = finishRef('oval', g, 'x', 165, 0);
      m.material = matCharcoal; outline.material = matEdgeOval;
      o.group.traverse(function (n) { if (n.isLineSegments && n !== outline) n.visible = false; });
      return o;
    }

    var loader = new T.GLTFLoader();
    function loadRef(r) {
      return new Promise(function (resolve) {
        var done = false;
        var timer = setTimeout(function () { if (!done) { done = true; resolve(fallbackBox(r)); } }, 9000);
        loader.load(GLB_BASE + r.glb, function (gltf) {
          if (done) return; done = true; clearTimeout(timer);
          try { resolve(finishRef(r.key, gltf.scene, r.axis, r.dim, r.rotY)); }
          catch (e) { resolve(fallbackBox(r)); }
        }, undefined, function () { if (done) return; done = true; clearTimeout(timer); resolve(fallbackBox(r)); });
      });
    }
    var loadAll = Promise.all(REFS.filter(function (r) { return r.glb; }).map(loadRef)).then(function () {
      buildPerson(); buildPool(); buildOval();
    });

    /* ---------- state ---------- */
    var S = 50;                              // hero scale (cube side, or pools footprint)
    var comp = { minX: -25, maxX: 25, minZ: -25, maxZ: 25, maxY: 50 };
    var activeRefs = [];                      // [{ref, obj, x, z, w, h}]
    var heroAnchor = new T.Vector3();
    var heroKind = 'gas', heroMode = 'cube';
    var anim = null, camAnim = null, fitState = null;
    var AZ = 0.66;                            // default azimuth (rad), three-quarter view

    function layout(fig) {
      var vol = volumeOf(fig), L, refs, i;
      heroKind = fig.kind;
      // reset previous references
      activeRefs.forEach(function (a) { a.obj.group.visible = false; });
      activeRefs = [];
      poolsGroup.clear();
      if (fig.kind === 'water') {
        heroMode = 'pools'; cube.visible = false;
        var N = poolCount(fig), unit = 1;
        if (N > 400) { unit = 10; }
        var drawn = Math.max(1, Math.round(N / unit));
        var cols = Math.max(1, Math.round(Math.sqrt(drawn * 1.6))), rows = Math.ceil(drawn / cols);
        var gx = 50 * 1.18, gz = 25 * 1.3;
        var W = cols * gx - (gx - 50), D = rows * gz - (gz - 25);
        for (i = 0; i < drawn; i++) {
          var g = new T.Group();
          var slab = new T.Mesh(poolGeo.slab, matPoolSlab); slab.castShadow = true;
          var top = new T.Mesh(poolGeo.top, matPoolTop); top.renderOrder = 3;
          var ed = new T.LineSegments(poolGeo.edges, matEdgeMist); ed.renderOrder = 5;
          g.add(slab); g.add(top); g.add(ed);
          g.position.set(-W / 2 + 25 + (i % cols) * gx, 0, -D / 2 + 12.5 + Math.floor(i / cols) * gz);
          poolsGroup.add(g);
        }
        S = Math.max(W, D, 40);
        L = S;
        comp = { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2, maxY: Math.max(2, 0.08 * S) };
        heroAnchor.set(W / 2, 2, D / 2);
        poolsGroup.userData.W = W; poolsGroup.userData.D = D; poolsGroup.userData.unit = unit; poolsGroup.userData.N = N;
        refs = S > 120 ? [REF_BY_KEY.tower, REF_BY_KEY.bus] : [REF_BY_KEY.bus, REF_BY_KEY.person];
        refs.sort(function (a, b) { return a.dim - b.dim; });
        placeRow(refs, -W / 2, D / 2, Math.max(8, 0.04 * S));
        return;
      }
      heroMode = 'cube'; cube.visible = true;
      L = Math.cbrt(vol); S = L;
      refs = pickRefs(L);
      comp = { minX: -L / 2, maxX: L / 2, minZ: -L / 2, maxZ: L / 2, maxY: L };
      placeRow(refs, -L / 2, L / 2, Math.max(3, 0.05 * L));
    }

    // row of references to the left of x0, front edges aligned to zFront, small → large (left → right)
    function placeRow(refs, x0, zFront, gap) {
      var x = x0 - gap, i, maxH = 0;
      for (i = refs.length - 1; i >= 0; i--) {
        var r = refs[i], o = refObjs[r.key];
        if (!o) continue;
        var cx = x - o.w / 2, cz = zFront - o.d / 2;
        o.group.position.set(cx, 0, cz);
        o.group.visible = true;
        activeRefs.unshift({ ref: r, obj: o, x: cx, z: cz, w: o.w, h: o.h, d: o.d });
        x = cx - o.w / 2 - gap;
        if (o.h > maxH) maxH = o.h;
      }
      comp.minX = Math.min(comp.minX, x + gap);
      comp.maxY = Math.max(comp.maxY, maxH);
      comp.minZ = Math.min(comp.minZ, zFront - Math.max.apply(null, activeRefs.map(function (a) { return a.d; }).concat([0])));
    }

    /* ---------- camera fit ---------- */
    function fit() {
      var cx = (comp.minX + comp.maxX) / 2, cz = (comp.minZ + comp.maxZ) / 2;
      var target = new T.Vector3(heroMode === 'cube' ? cx * 0.55 : cx, heroMode === 'cube' ? 0.35 * S : 0.02 * S, heroMode === 'cube' ? cz * 0.5 : cz);
      // direction: height 0.6 S above ground at 2.6 S horizontal distance (slightly higher for flat pools)
      var dirY = heroMode === 'cube' ? (0.6 * S - target.y) : 0.55 * S;
      var dir = new T.Vector3(Math.sin(AZ) * 2.6 * S, dirY, Math.cos(AZ) * 2.6 * S).normalize();
      var corners = [], cubeTop = [];
      function boxCorners(x0, x1, y0, y1, z0, z1, into) {
        [x0, x1].forEach(function (x) { [y0, y1].forEach(function (y) { [z0, z1].forEach(function (z) { into.push(new T.Vector3(x, y, z)); }); }); });
      }
      if (heroMode === 'cube') { boxCorners(-S / 2, S / 2, 0, S, -S / 2, S / 2, corners); boxCorners(-S / 2, S / 2, S, S, -S / 2, S / 2, cubeTop); }
      else boxCorners(comp.minX, comp.maxX, 0, 2, comp.minZ, comp.maxZ, corners);
      activeRefs.forEach(function (a) { boxCorners(a.x - a.w / 2, a.x + a.w / 2, 0, a.h, a.z - a.d / 2, a.z + a.d / 2, corners); });
      var cam = camera.clone();
      var lo = (heroMode === 'cube' ? 1.6 : 0.3) * S, hi = 30 * S, dist = 2.6 * S, i, v = new T.Vector3();
      var topY = isPhone ? 0.80 : 0.84, sideX = isPhone ? 0.98 : 0.95, botY = -0.98;
      function ok(d) {
        cam.position.copy(target).addScaledVector(dir, d); cam.lookAt(target); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
        var j;
        for (j = 0; j < corners.length; j++) {
          v.copy(corners[j]).project(cam);
          if (v.z > 1 || v.x < -sideX || v.x > sideX || v.y > topY || v.y < botY) return false;
        }
        for (j = 0; j < cubeTop.length; j++) { v.copy(cubeTop[j]).project(cam); if (v.y > topY) return false; }
        return true;
      }
      cam.aspect = camera.aspect; cam.fov = camera.fov; cam.near = 0.01 * S; cam.far = 200 * S;
      for (i = 0; i < 22; i++) { dist = (lo + hi) / 2; if (ok(dist)) hi = dist; else lo = dist; }
      dist = Math.max(hi, (heroMode === 'cube' ? 1.9 : 0.45) * S);
      var pos = target.clone().addScaledVector(dir, dist);
      fitState = { target: target, pos: pos, dist: dist };
      return fitState;
    }

    /* The close-up: the comparison objects at a size you can read, with the near edge of the figure towering beside them.
       Frames the objects plus a slice of the figure's front-left corner up to about twice the tallest object. */
    function closeFit() {
      if (!activeRefs.length) return null;
      var minX = Infinity, maxH = 0, minZ = Infinity, maxZ = -Infinity, corners = [];
      activeRefs.forEach(function (a) { minX = Math.min(minX, a.x - a.w / 2); maxH = Math.max(maxH, a.h); minZ = Math.min(minZ, a.z - a.d / 2); maxZ = Math.max(maxZ, a.z + a.d / 2); });
      function box(x0, x1, y0, y1, z0, z1) { [x0, x1].forEach(function (x) { [y0, y1].forEach(function (y) { [z0, z1].forEach(function (z) { corners.push(new T.Vector3(x, y, z)); }); }); }); }
      activeRefs.forEach(function (a) { box(a.x - a.w / 2, a.x + a.w / 2, 0, a.h, a.z - a.d / 2, a.z + a.d / 2); });
      var rowW = -comp.minX - (heroMode === 'cube' ? S / 2 : poolsGroup.userData.W / 2), edgeX = heroMode === 'cube' ? -S / 2 : -poolsGroup.userData.W / 2;
      var sliceW = Math.max(maxH, Math.min(rowW * 0.35, heroMode === 'cube' ? S : 60)), sliceH = heroMode === 'cube' ? Math.min(S, maxH * 2.2) : 2;
      var frontZ = heroMode === 'cube' ? S / 2 : poolsGroup.userData.D / 2;
      box(edgeX, edgeX + sliceW, 0, sliceH, frontZ - Math.min(sliceW, 2 * maxH), frontZ);
      var bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
      corners.forEach(function (c) { bx0 = Math.min(bx0, c.x); bx1 = Math.max(bx1, c.x); bz0 = Math.min(bz0, c.z); bz1 = Math.max(bz1, c.z); });
      var target = new T.Vector3((bx0 + bx1) / 2, maxH * 0.42, (bz0 + bz1) / 2);
      var az = 0.42, dir = new T.Vector3(Math.sin(az), 0.32, Math.cos(az)).normalize();
      var cam = camera.clone(), v = new T.Vector3(), lo = maxH * 0.5, hi = Math.max(400, (bx1 - bx0) * 20), d, i;
      cam.aspect = camera.aspect; cam.fov = camera.fov; cam.near = 0.01; cam.far = hi * 4;
      function ok(dd) { cam.position.copy(target).addScaledVector(dir, dd); cam.lookAt(target); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
        for (var j = 0; j < corners.length; j++) { v.copy(corners[j]).project(cam); if (v.z > 1 || Math.abs(v.x) > (isPhone ? 0.94 : 0.88) || v.y > 0.66 || v.y < -0.8) return false; } return true; }
      for (i = 0; i < 24; i++) { d = (lo + hi) / 2; if (ok(d)) hi = d; else lo = d; }
      return { target: target, pos: target.clone().addScaledVector(dir, hi), dist: hi, close: true };
    }
    function zoomLimits() {
      var smallest = activeRefs.length ? Math.min.apply(null, activeRefs.map(function (a) { return Math.max(a.h, a.w * 0.5); })) : S * 0.2;
      controls.minDistance = Math.max(1.5, smallest * 1.4);
      controls.maxDistance = 1.7 * (fitState ? fitState.dist : 3 * S);   // well inside the fog, so zooming out never loses the scene
    }
    function applyFit(f, animate) {
      var whole = fitState && !f.close ? f : (fitState || f);
      zoomLimits();
      scene.fog.near = whole.dist * 1.6; scene.fog.far = whole.dist * 3.4;
      camera.near = Math.max(0.05, Math.min(f.dist, controls.minDistance) / 60); camera.far = whole.dist * 12; camera.updateProjectionMatrix();
      // key light + shadow frustum
      var ext = Math.max(comp.maxX - comp.minX, comp.maxZ - comp.minZ, comp.maxY) * 0.75;
      key.position.set(f.target.x - 1.1 * ext, 1.9 * ext, f.target.z + 0.9 * ext);
      key.target.position.set(f.target.x, 0, f.target.z); key.target.updateMatrixWorld();
      key.shadow.normalBias = Math.max(0.02, 0.0015 * ext); key.shadow.bias = -0.0004;
      var sc = key.shadow.camera; sc.left = -ext * 1.3; sc.right = ext * 1.3; sc.top = ext * 1.3; sc.bottom = -ext * 1.3; sc.near = 0.1 * ext; sc.far = 5 * ext; sc.updateProjectionMatrix();
      fill.position.set(f.target.x + ext, 0.6 * ext, f.target.z - ext);
      buildGrid(S, f.dist);
      if (animate && !reduced) {
        camAnim = { from: camera.position.clone(), to: f.pos, tFrom: controls.target.clone(), tTo: f.target, t0: performance.now(), dur: 900 };
      } else {
        camera.position.copy(f.pos); controls.target.copy(f.target); camAnim = null;
      }
      controls.update(); kick();
    }

    /* ---------- figure change ---------- */
    function setFigure(keyOrFig) {
      var fig = typeof keyOrFig === 'string' ? figures.filter(function (f) { return f.key === keyOrFig; })[0] : keyOrFig;
      if (!fig) return;
      var first = !current;
      current = fig;
      var prevS = S, prevMode = heroMode;
      layout(fig);
      // hero appearance
      var landfill = fig.kind === 'landfill', tone = toneOf(fig);
      cube.material = landfill ? [matLandSide, matLandSide, matLandTop, matLandSide, matLandSide, matLandSide]
                               : [matHeroSide, matHeroSide, matHeroTop, matHeroSide, matHeroSide, matHeroSide];
      cubeEdges.material = landfill ? matLandEdge : matHeroEdge;
      if (!landfill) { matHeroEdge.color.setHex(tone.edge); matHeroSide.color.setHex(tone.side); matHeroTop.color.setHex(tone.top); matHeroSide.opacity = tone.sideOp; matHeroTop.opacity = tone.topOp; }
      matBand.color.setHex(tone.top); matBand.opacity = 0; buildBands(S);
      host.style.setProperty('--sc-acc', tone.css); host.style.setProperty('--sc-acc-l', tone.cssL);
      canvas.setAttribute('aria-label', describe(fig).sentence + ' Arrow keys turn the view, plus and minus zoom, Home shows the whole view.');
      contact.visible = heroMode === 'cube';
      contact.scale.set(S * 1.9, S * 1.9, 1); contact.position.set(0, 0.002 * S, 0);
      // animate hero scale + ref fade
      var fromS = (first || prevMode !== heroMode) ? S * 0.001 : prevS;
      anim = { t0: performance.now(), dur: reduced ? 0 : 900, fromS: fromS, toS: S };
      activeRefs.forEach(function (a) { a.obj.mats.forEach(function (m) { m.opacity = 0; }); a.obj.group.position.x = a.x - Math.max(0.12 * S, 2); });
      poolsGroup.scale.setScalar(heroMode === 'pools' ? 0.001 : 1);
      closeBtn.classList.remove('on'); applyFit(fit(), !first);
      // pills + aria
      Array.prototype.forEach.call(pillRow.children, function (b) {
        var on = b.dataset.key === fig.key; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      rebuildLabels();
      kick();
    }

    function tickAnim(now) {
      var busy = false;
      if (anim) {
        var t = anim.dur ? Math.min(1, (now - anim.t0) / anim.dur) : 1, e = easeInOut(t);
        if (heroMode === 'cube') { var s = anim.fromS + (anim.toS - anim.fromS) * e; cube.scale.setScalar(s); cube.position.y = s / 2; }
        else { poolsGroup.scale.setScalar(0.001 + 0.999 * e); }
        var ro = Math.max(0, (t - 0.25) / 0.75), eo = easeInOut(ro);
        activeRefs.forEach(function (a) {
          a.obj.mats[0].opacity = eo; a.fade = eo;
          a.obj.group.position.x = a.x - (1 - eo) * Math.max(0.12 * S, 2);
        });
        matBand.opacity = 0.34 * eo;
        if (t >= 1) { anim = null; } else busy = true;
      }
      if (camAnim) {
        var tc = Math.min(1, (now - camAnim.t0) / camAnim.dur), ec = easeInOut(tc);
        camera.position.lerpVectors(camAnim.from, camAnim.to, ec);
        controls.target.lerpVectors(camAnim.tFrom, camAnim.tTo, ec);
        if (tc >= 1) camAnim = null; else busy = true;
      }
      return busy;
    }

    /* ---------- labels (HTML overlay) ---------- */
    var labelItems = [];       // {el, anchor:Vector3(fn), hero:bool, dim:number, line:SVGLine}
    function heroLabelHTML(fig) {
      var v = fmtInt(fig.value) + ' ' + (fig.unit || '');
      var sub;
      if (heroMode === 'pools') {
        var N = poolsGroup.userData.N, unit = poolsGroup.userData.unit;
        sub = fmtInt(N) + ' Olympic pools of 2,500 kL each' + (unit > 1 ? ' · each slab drawn here stands for ten pools' : '');
      } else {
        var yt = yardText(S); sub = 'a cube ' + fmtNum(S) + ' m on each side' + (yt ? ' · ' + yt : '');
      }
      return '<span class="sc-eyebrow">' + esc(fig.label).toUpperCase() + '</span>' +
             '<span class="sc-value">' + esc(v) + '</span>' +
             '<span class="sc-sub">' + esc(sub) + '</span>';
    }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    function rebuildLabels() {
      labels.innerHTML = ''; while (svg.firstChild) svg.removeChild(svg.firstChild); labelItems = [];
      if (!current) return;
      // hero
      var h = el('div', 'sc-label sc-hero', heroLabelHTML(current));
      labels.appendChild(h);
      var ln = document.createElementNS('http://www.w3.org/2000/svg', 'line'); ln.setAttribute('class', 'sc-lead'); svg.appendChild(ln);
      labelItems.push({ el: h, hero: true, line: ln, anchors: function () {
        if (heroMode === 'pools') { var Wp = poolsGroup.userData.W, Dp = poolsGroup.userData.D;
          return [{ p: new T.Vector3(Wp / 2, 2, Dp / 2), side: 'right' }, { p: new T.Vector3(Wp / 2, 2, -Dp / 2), side: 'right' }, { p: new T.Vector3(-Wp / 2, 2, -Dp / 2), side: 'above' }]; }
        var s = cube.scale.x;
        return [{ p: new T.Vector3(-s / 2, s, s / 2), side: 'left' }, { p: new T.Vector3(s / 2, s, -s / 2), side: 'right' }, { p: new T.Vector3(s / 2, s, -s / 2), side: 'aboveR' }, { p: new T.Vector3(-s / 2, s, s / 2), side: 'above' }];
      } });
      // references
      var maxRefs = isPhone ? 3 : 5;
      var list = activeRefs.slice();
      if (list.length > maxRefs) {
        var keep = [list[0], list[list.length - 1]];
        if (maxRefs > 2) keep.splice(1, 0, list[Math.floor(list.length / 2)]);
        list = keep;
      }
      if (isPhone && list.length > 2) list = [list[0], list[list.length - 1]];
      var ordered = []; if (list.length) { ordered.push(list[list.length - 1]); if (list.length > 1) ordered.push(list[0]); list.slice(1, -1).reverse().forEach(function (a) { ordered.push(a); }); }
      ordered.forEach(function (a) {
        var d = el('div', 'sc-label sc-ref', '<span class="sc-name">' + esc(a.ref.name) + '</span><span class="sc-dim">' + esc(a.ref.dimText) + '</span>');
        labels.appendChild(d);
        var l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line'); l2.setAttribute('class', 'sc-lead sc-lead-mist'); svg.appendChild(l2);
        labelItems.push({ el: d, hero: false, line: l2, a: a, anchor: function () {
          return new T.Vector3(a.obj.group.position.x, a.h, a.z - a.d / 2);   // top, back edge
        } });
      });
    }

    var W = 0, H = 0, pv = new T.Vector3();
    function updateLabels() {
      if (!labelItems.length) return;
      var heroRect = null, i, item, placed = [];
      for (i = 0; i < labelItems.length; i++) {
        item = labelItems[i];
        var bw, bh, lx, ly, x, y;
        if (item.hero) {
          if (item.shown !== true) { item.el.style.display = ''; item.shown = true; }
          if (!item.bw) { item.bw = item.el.offsetWidth; item.bh = item.el.offsetHeight; }
          bw = item.bw; bh = item.bh;
          var refRects = screenRects(), cands = item.anchors(), best = null, k;
          for (k = 0; k < cands.length; k++) {
            pv.copy(cands[k].p).project(camera);
            if (pv.z > 1) continue;
            x = (pv.x + 1) / 2 * W; y = (1 - pv.y) / 2 * H;
            var gx = isPhone ? 16 : 44, gy = isPhone ? 10 : 18;
            if (cands[k].side === 'left') { lx = x - bw - gx; ly = y - bh * 0.5 - gy; }
            else if (cands[k].side === 'right') { lx = x + gx; ly = y - bh * 0.5 - gy; }
            else if (cands[k].side === 'aboveR') { lx = x - bw * 0.7; ly = y - bh - 26; }
            else { lx = x - bw * 0.3; ly = y - bh - 26; }
            var inside = lx >= 12 && lx + bw <= W - 12 && ly >= 12 && ly + bh <= H - 64;
            var rect = { x: lx, y: ly, r: lx + bw, b: ly + bh }, clash = false, q;
            for (q = 0; q < refRects.length && !clash; q++) if (overlap(rect, refRects[q], 6)) clash = true;
            var score = (inside ? 0 : 10) + (clash ? 5 : 0) + k * 0.1;
            if (!best || score < best.score) best = { score: score, x: x, y: y, lx: lx, ly: ly, side: cands[k].side };
            if (score < 1) break;
          }
          if (!best) { item.el.style.display = 'none'; item.shown = false; item.line.style.display = 'none'; continue; }
          lx = best.lx; ly = best.ly; x = best.x; y = best.y;
          if (lx < 12) lx = 12; if (lx + bw > W - 12) lx = W - bw - 12; if (ly < 12) ly = 12; if (ly + bh > H - 64) ly = H - 64 - bh;
          heroRect = { x: lx, y: ly, r: lx + bw, b: ly + bh };
          item.el.style.transform = 'translate(' + Math.round(lx) + 'px,' + Math.round(ly) + 'px)';
          if (best.side === 'above' || best.side === 'aboveR') setLine(item.line, x, y, Math.max(lx + 6, Math.min(lx + bw - 6, x)), ly + bh);
          else setLine(item.line, x, y, lx + (lx + bw < x ? bw + 6 : -6), Math.max(ly + 2, Math.min(ly + bh - 2, y)));
        } else {
          var p = item.anchor(); pv.copy(p).project(camera);
          var behind = pv.z > 1; x = (pv.x + 1) / 2 * W; y = (1 - pv.y) / 2 * H;
          var off = behind || x < -40 || x > W + 40 || y < -40 || y > H + 40;
          if (off) { if (item.shown !== false) { item.el.style.display = 'none'; item.shown = false; } item.line.style.display = 'none'; continue; }
          if (!item.bw) { item.el.style.display = ''; item.shown = true; item.bw = item.el.offsetWidth; item.bh = item.el.offsetHeight; }
          bw = item.bw; bh = item.bh;
          lx = x - bw / 2; ly = y - bh - 14;
          if (lx < 8) lx = 8; if (lx + bw > W - 8) lx = W - bw - 8; if (ly < 8) ly = 8;
          var rect = { x: lx, y: ly, r: lx + bw, b: ly + bh };
          var hide = heroRect && overlap(rect, heroRect, 8);
          var j; for (j = 0; j < placed.length && !hide; j++) if (overlap(rect, placed[j], 4)) hide = true;
          if (hide) { if (item.shown !== false) { item.el.style.display = 'none'; item.shown = false; } item.line.style.display = 'none'; continue; }
          if (item.shown !== true) { item.el.style.display = ''; item.shown = true; }
          placed.push(rect);
          item.el.style.transform = 'translate(' + Math.round(lx) + 'px,' + Math.round(ly) + 'px)';
          setLine(item.line, x, y, Math.max(lx + 6, Math.min(lx + bw - 6, x)), ly + bh);
        }
      }
    }
    var cornerV = new T.Vector3();
    function screenRects() {            // 2D boxes of the visible reference objects
      var out = [];
      activeRefs.forEach(function (a) {
        var r = { x: Infinity, y: Infinity, r: -Infinity, b: -Infinity }, ok = true;
        [a.x - a.w / 2, a.x + a.w / 2].forEach(function (x) { [0, a.h].forEach(function (y) { [a.z - a.d / 2, a.z + a.d / 2].forEach(function (z) {
          cornerV.set(x, y, z).project(camera); if (cornerV.z > 1) ok = false;
          var sx = (cornerV.x + 1) / 2 * W, sy = (1 - cornerV.y) / 2 * H;
          if (sx < r.x) r.x = sx; if (sx > r.r) r.r = sx; if (sy < r.y) r.y = sy; if (sy > r.b) r.b = sy;
        }); }); });
        if (ok) out.push(r);
      });
      return out;
    }
    function overlap(a, b, pad) { return !(a.r + pad < b.x || a.x - pad > b.r || a.b + pad < b.y || a.y - pad > b.b); }
    function setLine(l, x1, y1, x2, y2) {
      l.style.display = ''; l.setAttribute('x1', x1.toFixed(1)); l.setAttribute('y1', y1.toFixed(1)); l.setAttribute('x2', x2.toFixed(1)); l.setAttribute('y2', y2.toFixed(1));
    }

    /* ---------- render loop (on demand) ---------- */
    var needsFrame = true, raf = 0, visible = true, ro = null, io = null;
    var shadowDirty = true, lastT = 0, spinFrom = 0, SPIN_MS = 24000, chained = false, slowN = 0, qLevel = 0;
    /* a machine that cannot keep up gets a lighter scene instead of a stuttering one: first native-resolution pixels off, then shadows off */
    function degrade() {
      qLevel++;
      if (qLevel === 1) { renderer.setPixelRatio(1); if (W && H) renderer.setSize(W, H, false); }
      else if (qLevel === 2) { key.castShadow = false; shadowDirty = true; }
    }
    /* One frame callback at a time, always. The camera controls fire a change event from inside the frame; if that scheduled a
       callback as well as the frame's own reschedule, every moving frame left two callbacks behind and the scene was drawn dozens
       of times per screen refresh. So a kick during a frame only notes that another frame is wanted. */
    var inFrame = false, lastTick = -1;
    function kickCam() { needsFrame = true; if (!raf && !inFrame && !destroyed) raf = requestAnimationFrame(frame); }
    function kick() { shadowDirty = true; kickCam(); }
    function frame(now) {
      raf = 0;
      if (destroyed || !visible) return;
      if (now === lastTick) return;                 // this refresh has already been drawn
      var spinning = controls.autoRotate && !interacted;
      if (spinning) {
        if (!spinFrom) spinFrom = now;
        // the idle spin is decoration: stop after one slow look around so an open page is not rendering forever
        if (now - spinFrom > SPIN_MS) { controls.autoRotate = false; spinning = false; }
      }
      lastTick = now; inFrame = true; needsFrame = false;
      var busy = false, moved = false;
      try {
        if (chained && lastT && qLevel < 2) { var gap = now - lastT; if (gap < 400) { if (gap > 42) slowN += 1; else if (slowN > 0) slowN -= 0.5; if (slowN > 14) { slowN = 0; degrade(); } } }
        var dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 1 / 60; lastT = now;
        busy = tickAnim(now);
        moved = controls.update(dt);
        if (busy || shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
        fadeEdges();
        renderer.render(scene, camera);
        updateLabels();
      } finally { inFrame = false; }
      chained = !!(busy || moved || needsFrame || spinning);
      if (chained && !raf) raf = requestAnimationFrame(frame);
    }
    /* Fine edge lines turn to grey static when an object is only a few pixels tall: draw them only once it is big enough to read. */
    var edgeV = new T.Vector3();
    function fadeEdges() {
      var k = H / (2 * Math.tan(camera.fov * Math.PI / 360)), i;
      for (i = 0; i < activeRefs.length; i++) {
        var a = activeRefs[i], d = edgeV.set(a.x, a.h / 2, a.z).distanceTo(camera.position), px = Math.max(a.h, a.w * 0.6) / Math.max(d, 1e-3) * k;
        a.obj.mats[1].opacity = 0.3 * (a.fade == null ? 1 : a.fade) * Math.max(0, Math.min(1, (px - 70) / 130));
      }
    }
    /* Keyboard: arrows turn, plus and minus zoom, Home resets. */
    canvas.addEventListener('keydown', function (e) {
      var k = e.key, off = camera.position.clone().sub(controls.target), sph = new T.Spherical().setFromVector3(off), used = true;
      if (k === 'ArrowLeft') sph.theta -= 0.14; else if (k === 'ArrowRight') sph.theta += 0.14;
      else if (k === 'ArrowUp') sph.phi = Math.max(controls.minPolarAngle, sph.phi - 0.09); else if (k === 'ArrowDown') sph.phi = Math.min(controls.maxPolarAngle, sph.phi + 0.09);
      else if (k === '+' || k === '=') sph.radius = Math.max(controls.minDistance, sph.radius * 0.85); else if (k === '-' || k === '_') sph.radius = Math.min(controls.maxDistance, sph.radius / 0.85);
      else if (k === 'Home' || k === '0') { resetBtn.click(); e.preventDefault(); return; }
      else used = false;
      if (!used) return;
      e.preventDefault(); camAnim = null;
      if (!interacted) { interacted = true; controls.autoRotate = false; hint.classList.add('off'); }
      camera.position.copy(controls.target).add(off.setFromSpherical(sph)); controls.update(); kick();
    });
    /* Wheel zoom towards what you point at. Camera and pivot are both scaled about the point under the pointer, so the view keeps
       its angle, closes in on that point geometrically and can never pass through it. */
    var ray = new T.Raycaster(), ndc = new T.Vector2(), groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0), hitV = new T.Vector3();
    function pointUnder(cx, cy) {
      var r = canvas.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      var objs = activeRefs.map(function (a) { return a.obj.group; }); if (heroMode === 'cube') objs.push(cube); else objs.push(poolsGroup);
      var hits = ray.intersectObjects(objs, true).filter(function (h) { return !h.object.isLineSegments && h.object.visible; });
      if (hits.length) return hits[0].point.clone();
      if (ray.ray.intersectPlane(groundPlane, hitV) && hitV.distanceTo(camera.position) < controls.maxDistance * 1.5) return hitV.clone();
      return ray.ray.at(camera.position.distanceTo(controls.target), new T.Vector3());
    }
    host.addEventListener('wheel', function (e) {
      if (e.target !== canvas) return;
      e.preventDefault(); e.stopPropagation();
      if (!interacted) { interacted = true; controls.autoRotate = false; hint.classList.add('off'); }
      camAnim = null; closeBtn.classList.remove('on');
      var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      var f = Math.exp(Math.max(-60, Math.min(60, dy)) * 0.0022 / Math.max(0.35, controls.zoomSpeed * 1.4));
      if (f < 1) {
        var P = pointUnder(e.clientX, e.clientY), dCam = camera.position.distanceTo(P);
        if (dCam * f < controls.minDistance * 0.5) f = Math.min(1, controls.minDistance * 0.5 / Math.max(dCam, 1e-6));
        camera.position.copy(P.clone().addScaledVector(camera.position.clone().sub(P), f));
        controls.target.copy(P.clone().addScaledVector(controls.target.clone().sub(P), f));
      } else {
        // zooming out backs away from the pivot and drifts it home, so scrolling out always returns to the whole view
        var off = camera.position.clone().sub(controls.target), d0 = off.length(), d1 = Math.min(controls.maxDistance, d0 * f);
        if (fitState) { var home = fitState.target, k = Math.min(1, (f - 1) * 1.6); controls.target.lerp(home, k); }
        camera.position.copy(controls.target).addScaledVector(off.normalize(), d1);
      }
      controls.update(); kick();
    }, { capture: true, passive: false });

    controls.addEventListener('change', function () {
      // panning and zooming to the cursor move the point the camera turns around; keep it over the scene
      var t = controls.target, m = Math.max(4, 0.15 * S);
      var cx = Math.min(comp.maxX + m, Math.max(comp.minX - m, t.x)), cz = Math.min(comp.maxZ + m, Math.max(comp.minZ - m, t.z)), cy = Math.min(comp.maxY, Math.max(0, t.y));
      if (cx !== t.x || cy !== t.y || cz !== t.z) { camera.position.x += cx - t.x; camera.position.y += cy - t.y; camera.position.z += cz - t.z; t.set(cx, cy, cz); }
      if (camera.position.y < 0.6) camera.position.y = 0.6;
      // inside the figure, its walls would fill the screen: keep only its outline
      var inside = heroMode === 'cube' && Math.abs(camera.position.x) < S / 2 && Math.abs(camera.position.z) < S / 2 && camera.position.y < S;
      if (cube.userData.inside !== inside) { cube.userData.inside = inside; [matHeroSide, matHeroTop, matLandSide, matLandTop].forEach(function (mm) { mm.visible = !inside; }); }
      kickCam();
    });
    controls.addEventListener('start', function () {
      if (!interacted) { interacted = true; controls.autoRotate = false; hint.classList.add('off'); }
      kick();
    });
    controls.addEventListener('end', kickCam);

    function resize() {
      W = host.clientWidth; H = host.clientHeight || Math.round(W * (W >= 700 ? 9 / 16 : 3 / 4));
      if (!W || !H) return;
      isPhone = W < 700;
      renderer.setSize(W, H, false);
      camera.aspect = W / H; camera.updateProjectionMatrix();
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);
      if (current) { fit(); zoomLimits(); rebuildLabels(); }
      kick();
    }
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { resize(); }); ro.observe(host); }
    else window.addEventListener('resize', resize);
    if (window.IntersectionObserver) {
      io = new IntersectionObserver(function (en) { visible = en.some(function (e) { return e.isIntersecting; }); if (visible) kick(); }, { threshold: 0.02 });
      io.observe(host);
    }

    /* ---------- UI ---------- */
    figures.forEach(function (f) {
      var b = el('button', 'sc-pill', esc(f.label)); b.type = 'button'; b.dataset.key = f.key;
      b.addEventListener('click', function () { setFigure(f.key); });
      pillRow.appendChild(b);
    });
    resetBtn.addEventListener('click', function () { if (!fitState) return; AZ = 0.66; closeBtn.classList.remove('on'); applyFit(fit(), true); });
    closeBtn.addEventListener('click', function () { var f = closeFit(); if (!f) return;
      if (!interacted) { interacted = true; controls.autoRotate = false; hint.classList.add('off'); }
      closeBtn.classList.add('on'); applyFit(f, true); });
    if (reduced) hint.classList.add('off');

    /* ---------- lifecycle ---------- */
    resize();
    var handle = {
      setFigure: function (k) { if (!destroyed) setFigure(k); },
      update: function (d) { if (destroyed) return; data = d || data; figures = (data.figures || []).slice(); pillRow.innerHTML = '';
        figures.forEach(function (f) { var b = el('button', 'sc-pill', esc(f.label)); b.type = 'button'; b.dataset.key = f.key; b.addEventListener('click', function () { setFigure(f.key); }); pillRow.appendChild(b); });
        var k = current && figures.some(function (f) { return f.key === current.key; }) ? current.key : (figures[0] && figures[0].key); current = null; if (k) setFigure(k); },
      resize: resize,
      describe: function (k) { var f = typeof k === 'string' ? figures.filter(function (x) { return x.key === k; })[0] : (k || current); return describe(f); },
      current: function () { return current; },
      isAnimating: function () { return !!(anim || camAnim); },
      _internals: opts.debug ? { renderer: renderer, scene: scene, camera: camera, controls: controls, key: key } : undefined,
      destroy: function () {
        destroyed = true; if (raf) cancelAnimationFrame(raf);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
        if (io) io.disconnect();
        controls.dispose();
        scene.traverse(function (n) { if (n.geometry) n.geometry.dispose(); });
        disposables.forEach(function (d) { if (d && d.dispose) d.dispose(); });
        renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {}
        host.innerHTML = ''; host.classList.remove('sc-root');
      }
    };

    return loadAll.then(function () {
      if (destroyed) return null;
      var start = (opts.figure && figures.some(function (f) { return f.key === opts.figure; })) ? opts.figure : (figures[0] && figures[0].key);
      if (start) setFigure(start);
      return handle;
    });
  }

  /* ---------- canvas textures ---------- */
  function makeHatchTexture(T) {
    var c = document.createElement('canvas'); c.width = c.height = 256; var g = c.getContext('2d');
    g.fillStyle = '#B5855F'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(58,38,24,0.5)'; g.lineWidth = 1.6;
    var i; for (i = -256; i < 512; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke(); }
    var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(6, 6); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  function makeContactTexture(T) {
    var c = document.createElement('canvas'); c.width = c.height = 256; var g = c.getContext('2d');
    var grd = g.createRadialGradient(128, 128, 20, 128, 128, 128);
    grd.addColorStop(0, 'rgba(0,0,0,0.9)'); grd.addColorStop(0.55, 'rgba(0,0,0,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }

  YartaScale.mount = mount;
})();
