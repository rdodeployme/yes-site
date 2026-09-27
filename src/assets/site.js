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
    var off=0, cols={recovery:'#166534',carbon:'#4FC17A',evidence:'#8EDDAA'};
    ['recovery','carbon','evidence'].forEach(function(k){var len=sweep*((sc.parts[k]||0)/100);C+='<circle class="ga-'+k+'" cx="85" cy="85" r="70" fill="none" stroke="'+cols[k]+'" stroke-width="14" stroke-dasharray="'+len+' 440" stroke-dashoffset="'+(-off)+'" transform="rotate(135 85 85)" style="transition:stroke-dasharray .9s cubic-bezier(.2,.7,.2,1),stroke-dashoffset .9s cubic-bezier(.2,.7,.2,1)"/>';off+=len;});
    C+='</svg><div class="gv"><b>'+sc.score+'</b><small>of 100</small></div>';
    el.innerHTML=C; el.setAttribute('role','img'); el.setAttribute('aria-label','YES Score '+sc.score+' of 100, '+sc.band);
  };
  window.YES.gaugeUpdate=function(el,sc){var sweep=330,off=0;['recovery','carbon','evidence'].forEach(function(k){var c=el.querySelector('.ga-'+k);var len=sweep*((sc.parts[k]||0)/100);if(c){c.setAttribute('stroke-dasharray',len+' 440');c.setAttribute('stroke-dashoffset',-off);}off+=len;});var b=el.querySelector('.gv b');if(b)b.textContent=sc.score;};

  // toast
  var toastT;
  window.YES.toast=function(msg){var t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('show');},2600);};

  // close mobile nav on link click
  document.querySelectorAll('.nav-links a').forEach(function(a){a.addEventListener('click',function(){document.querySelector('.nav-links').classList.remove('open');});});
})();
