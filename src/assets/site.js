/* YES — shared site behaviour */
(function(){
  // reveal on scroll
  var els=document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(en){en.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{rootMargin:'0px 0px -8% 0px'});
    els.forEach(function(el){io.observe(el);});
  } else { els.forEach(function(el){el.classList.add('in');}); }

  // animated counters: <span data-count="1234" data-dec="1" data-suffix="t">
  function fmt(n,dec){return n.toLocaleString('en-AU',{minimumFractionDigits:dec,maximumFractionDigits:dec});}
  window.YES=window.YES||{};
  window.YES.fmt=fmt;
  window.YES.count=function(el,to,dec,dur){
    dec=dec||0;dur=dur||1100;
    var from=parseFloat(el.getAttribute('data-from')||'0');var t0=null;var suf=el.getAttribute('data-suffix')||'';var pre=el.getAttribute('data-prefix')||'';
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){el.textContent=pre+fmt(to,dec)+suf;el.setAttribute('data-from',to);return;}
    function step(ts){if(!t0)t0=ts;var p=Math.min(1,(ts-t0)/dur);var e=1-Math.pow(1-p,3);el.textContent=pre+fmt(from+(to-from)*e,dec)+suf;if(p<1)requestAnimationFrame(step);else el.setAttribute('data-from',to);}
    requestAnimationFrame(step);
  };
  var counters=document.querySelectorAll('[data-count]');
  if('IntersectionObserver' in window){
    var io2=new IntersectionObserver(function(en){en.forEach(function(e){if(e.isIntersecting){var el=e.target;window.YES.count(el,parseFloat(el.getAttribute('data-count')),parseInt(el.getAttribute('data-dec')||'0',10));io2.unobserve(el);}});},{threshold:.4});
    counters.forEach(function(el){io2.observe(el);});
  } else { counters.forEach(function(el){el.textContent=fmt(parseFloat(el.getAttribute('data-count')),parseInt(el.getAttribute('data-dec')||'0',10));}); }

  // bar fills: <div class="fill" data-w="72">
  var fills=document.querySelectorAll('[data-w]');
  if('IntersectionObserver' in window){
    var io3=new IntersectionObserver(function(en){en.forEach(function(e){if(e.isIntersecting){e.target.style.width=e.target.getAttribute('data-w')+'%';io3.unobserve(e.target);}});},{threshold:.2});
    fills.forEach(function(el){io3.observe(el);});
  } else { fills.forEach(function(el){el.style.width=el.getAttribute('data-w')+'%';}); }

  // score gauge: YES.gauge(el, scoreObj, size) — el is an empty div.gauge
  window.YES.gauge=function(el,sc,size){
    if(!el) return; if(size) el.style.setProperty('--gs',size+'px');
    var sweep=330, C='<svg viewBox="0 0 170 170" aria-hidden="true">'
      +'<circle cx="85" cy="85" r="70" fill="none" stroke="#2A2C2A" stroke-width="14" stroke-dasharray="330 440" transform="rotate(135 85 85)"/>';
    var off=0, cols={recovery:'#B8641F',carbon:'#E9A860',evidence:'#F2C894'};
    ['recovery','carbon','evidence'].forEach(function(k){var len=sweep*((sc.parts[k]||0)/100);C+='<circle class="ga-'+k+'" cx="85" cy="85" r="70" fill="none" stroke="'+cols[k]+'" stroke-width="14" stroke-dasharray="'+len+' 440" stroke-dashoffset="'+(-off)+'" transform="rotate(135 85 85)" style="transition:stroke-dasharray .9s cubic-bezier(.2,.7,.2,1),stroke-dashoffset .9s cubic-bezier(.2,.7,.2,1)"/>';off+=len;});
    C+='</svg><div class="gv"><b>'+sc.score+'</b><small>of 100</small></div>';
    el.innerHTML=C; el.setAttribute('role','img'); el.setAttribute('aria-label','YES Score '+sc.score+' of 100, '+sc.band);
  };
  window.YES.gaugeUpdate=function(el,sc){var sweep=330,off=0;['recovery','carbon','evidence'].forEach(function(k){var c=el.querySelector('.ga-'+k);var len=sweep*((sc.parts[k]||0)/100);if(c){c.setAttribute('stroke-dasharray',len+' 440');c.setAttribute('stroke-dashoffset',-off);}off+=len;});var b=el.querySelector('.gv b');if(b)b.textContent=sc.score;};

  // two emissions figures, never netted. YES.emPair(t, o) returns the markup for Figure A (Scope 3 Category 5 inventory)
  // beside Figure B (avoided emissions, estimate). Wording comes from YES.CLAIMS so every page says the same thing.
  // t = YES.compute() result · o = {rows:4, foot:true, cmp:true, delta:{a:n, b:n}, compact:false}
  window.YES.emPair=function(t,o){
    var Y=window.YES; o=o||{};
    function n(v){return fmt(v,Math.abs(v)<100?1:0);}
    function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');}
    function src(k){return (Y.SOURCES&&Y.SOURCES[k]&&Y.SOURCES[k].id)||k;}
    function dl(rows){return '<dl>'+rows.map(function(r){return '<dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd>';}).join('')+'</dl>';}
    function delta(v){ if(v==null||Math.abs(v)<0.05) return '<p class="em-d">&nbsp;</p>'; return '<p class="em-d'+(v<0?' neg':'')+'">'+(v>0?'+':'−')+n(Math.abs(v))+' t this handover</p>'; }
    var empty=!(t&&t.inT>0), d=o.delta||{};
    var aRows=empty?[['Nothing entered yet','—']]:[
      ['Processing · supplier-specific · illustrative',n(t.cat5Proc)],
      t.km>0?['Transport · '+fmt(t.km,0)+' km · illustrative',n(t.cat5Tr)]:['Transport · not included','—'],
      ['Landfilled · '+fmt(t.lanT,t.lanT<10?1:0)+' t × NGA factors',n(t.cat5Lan)]];
    var a='<div class="em a"><div class="em-k"><span><span class="fig">A</span>Inventory</span><span>Scope 3 · Category 5</span></div>'
      +'<div class="em-t">Waste generated in operations</div>'
      +'<div class="em-v">'+n(empty?0:t.cat5)+'<span class="u">t CO₂-e</span></div>'+(o.delta?delta(d.a):'')+dl(aRows)
      +(!empty&&t.interimT>0?(o.compact?'<p class="em-f">Interim C&amp;I factor on '+fmt(t.interimT,1)+' t of residual: composition audit pending.</p>':'<p class="em-f">Interim mixed C&amp;I landfill factor on '+fmt(t.interimT,1)+' t of processing residual until a composition audit.</p>'):'')
      +(!empty&&o.cmp!==false?(o.compact?'<p class="em-c">All '+fmt(t.inT,t.inT<10?1:0)+' t to landfill: <b>'+n(t.baseline)+' t CO₂-e</b> · comparison only</p>':'<p class="em-c">Had all '+fmt(t.inT,t.inT<10?1:0)+' t gone to landfill: <b>'+n(t.baseline)+' t CO₂-e</b>. A comparison for context, not an inventory figure.</p>'):'')
      +'</div>';
    var rows=[];
    if(!empty){
      var sf=(Y.STEEL&&Y.STEEL.f)||0.44;
      if(t.steelT>0) rows.push({l:'Steel · '+fmt(t.steelT,1)+' t × '+sf,v:t.steelT*sf});
      Object.keys(t.byCat).forEach(function(k){var b=t.byCat[k],c=Y.CAT[k]; var ns=b.avoided-b.steel*sf; if(c&&c.carbon!=null&&ns>0.005) rows.push({l:b.name+' · '+fmt(b.rec-b.steel,1)+' t × '+c.carbon,v:ns});});
      rows.sort(function(x,y){return y.v-x.v;});
      var max=o.rows||4;
      if(rows.length>max){var rest=rows.slice(max-1).reduce(function(s,r){return s+r.v;},0); rows=rows.slice(0,max-1); rows.push({l:'Other streams',v:rest});}
    }
    var bRows=rows.length?rows.map(function(r){return [r.l,n(r.v)];}):[[empty?'Nothing entered yet':'No stream with a factor','—']];
    var b='<div class="em b"><div class="em-k"><span><span class="fig">B</span>Estimate</span><span>Reported separately</span></div>'
      +'<div class="em-t">Avoided emissions</div>'
      +'<div class="em-v">'+n(empty?0:t.avoided)+'<span class="u">t CO₂-e</span></div>'+(o.delta?delta(d.b):'')+dl(bRows)
      +(o.compact?'<p class="em-f">'+src('nsw2010')+' life-cycle factors, flagged 2010. Not deducted from A. Not an offset or a carbon-neutral claim.</p>':'<p class="em-f">Modelled with '+src('nsw2010')+' life-cycle factors (flagged 2010, due for refresh). Not deducted from A. Not an offset and not a carbon-neutral claim.</p>')
      +(!empty&&t.pendingCats&&t.pendingCats.length?'<p class="em-f">No estimate for '+esc(t.pendingCats.join(', '))+(o.compact?' (no factor yet).':': no factor in the library yet.')+'</p>':'')
      +'</div>';
    var foot=o.foot===false?'':'<div class="em-foot"><b>Two figures, never netted.</b> A is calculated for your inventory: Scope 3, Category 5, subject to your reporting boundary. B is a modelled estimate reported beside it, never deducted from it.</div>';
    return '<div class="em-pair" role="group" aria-label="Emissions: Scope 3 Category 5 inventory and avoided emissions, reported separately">'+a+b+foot+'</div>';
  };

  // toast
  var toastT;
  window.YES.toast=function(msg){var t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('show');},2600);};

  // close mobile nav on link click
  document.querySelectorAll('.nav-links a').forEach(function(a){a.addEventListener('click',function(){document.querySelector('.nav-links').classList.remove('open');});});

  // ambient video: poster first; the loop loads only on wider screens, without reduced motion or data saver, and only while on screen
  (function(){
    var vids=[].slice.call(document.querySelectorAll('video[data-bgv]'));
    if(!vids.length) return;
    var rm=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
    var conn=navigator.connection||{};
    function allowed(){return !rm.matches&&!conn.saveData&&window.innerWidth>=720;}
    function play(v){var p=v.play();if(p&&p.catch)p.catch(function(){});}
    function start(v){
      if(!v.getAttribute('data-on')){
        v.setAttribute('data-on','1');
        [].forEach.call(v.querySelectorAll('source[data-src]'),function(s){s.src=s.getAttribute('data-src');});
        v.addEventListener('playing',function(){v.classList.add('is-on');},{once:true});
        v.load();
      }
      play(v);
    }
    vids.forEach(function(v){v.muted=true;v.defaultMuted=true;v.playsInline=true;});
    if(!('IntersectionObserver' in window)){ if(allowed()) vids.forEach(start); return; }
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){var v=e.target; v._in=e.isIntersecting; if(e.isIntersecting){ if(allowed()) start(v); } else if(!v.paused) v.pause();});
    },{rootMargin:'160px 0px'});
    vids.forEach(function(v){io.observe(v);});
    if(rm.addEventListener) rm.addEventListener('change',function(){ if(rm.matches) vids.forEach(function(v){v.pause();}); });
    document.addEventListener('visibilitychange',function(){
      vids.forEach(function(v){ if(document.hidden){ if(!v.paused) v.pause(); } else if(v._in&&allowed()) start(v); });
    });
  })();
})();
