/* Yarta first-time tour: five stops on the customer dashboard, about a minute.
   - Starts by itself once per person on their first visit to the dashboard (remembered in this browser).
   - "Take the tour" in the portal menu replays it at any time.
   - A page can turn the automatic start off with window.YARTA_TOUR_AUTO = false (the Demo City sales page does).
   - Customer views only; never for the Yarta team. Reads the page, changes no figures and no saved data
     apart from its own "seen" note (localStorage key yarta-tour-v1). Load after portal.js. */
(function(){
  'use strict';
  var KEY='yarta-tour-v1', app=document.getElementById('app');
  if(!app || !window.YESPortal) return;
  var P=window.YESPortal;

  function phone(){ return window.innerWidth<1080; }
  var STOPS=[
    {sel:'.ct-hero', t:'Your Yarta Score',
     b:'One number out of 100 for how you are tracking across ten areas of environmental performance, with the change on a year ago and where your plan would take you.'},
    {sel:'.needs', t:'What needs you',
     b:'Anything waiting on you: figures to enter, a report ready to read. Start here each time you sign in.'},
    {sel:'#ten', t:'The ten parts of your score',
     b:'Each card is one area, scored out of 100. Click any card to see the figures behind it, the trend and what would lift it.'},
    {sel:'.pg-head a[href^="#/report/"]', alt:'.snav a[href="#/reports"]', t:'Your monthly report',
     b:'Each verified month becomes a report you can print or share. It carries an ID anyone can check, so its figures can’t be quietly changed.'},
    {sel:function(){ return phone() ? '.mtop .menu-btn' : '.snav a[href="#/entry"]'; }, t:'Enter your figures',
     b:function(){ return 'Once a month, enter your figures from your own records: bills, contractor reports, fuel cards. Yarta checks them before the report is issued.'+(phone()?' You’ll find it under Menu.':''); }}
  ];

  function store(){ try{ return JSON.parse(localStorage.getItem(KEY))||{}; }catch(e){ return {}; } }
  function mark(){ var u=uid(); if(!u) return; var s=store(); s[u]=new Date().toISOString().slice(0,10); try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch(e){} }
  function uid(){ var st=P.state||{}; return st.session ? st.session.user : null; }
  function isCustomer(){ var st=P.state||{}, s=st.session; if(!s) return false; var u=(st.users||[]).filter(function(x){ return x.id===s.user; })[0]; return !!(u && u.role==='customer'); }
  function onDashboard(){ return !app.hidden && !!app.querySelector('#ten') && /^#\/dashboard\b|^#?\/?$/.test(location.hash||''); }
  function visible(el){ if(!el) return false; var r=el.getBoundingClientRect(); return r.width>0 && r.height>0 && getComputedStyle(el).visibility!=='hidden'; }
  function val(x){ return typeof x==='function' ? x() : x; }
  function target(st){ var el=document.querySelector(val(st.sel)); if(!visible(el) && st.alt) el=document.querySelector(st.alt); return visible(el) ? el : null; }

  /* ---------------------------------------------------------------- the tour layer */
  var spot=null, card=null, i=0, raf=0, active=false, lastFocus=null, L=STOPS;
  function build(){
    spot=document.createElement('div'); spot.className='yt-spot'; spot.setAttribute('aria-hidden','true');
    card=document.createElement('div'); card.className='yt-card'; card.setAttribute('role','dialog'); card.setAttribute('aria-modal','false'); card.setAttribute('aria-labelledby','yt-t');
    document.body.appendChild(spot); document.body.appendChild(card);
    card.addEventListener('click', function(e){
      var b=e.target.closest('[data-yt]'); if(!b) return; var a=b.getAttribute('data-yt');
      if(a==='next') go(i+1); else if(a==='back') go(i-1); else end();
    });
  }
  function place(){
    if(!active) return; var st=L[i], el=target(st), pad=6, W=window.innerWidth, H=window.innerHeight;
    var cw=Math.min(360, W-24); card.style.width=cw+'px';
    var ch=card.offsetHeight;
    if(!el){ spot.style.display='none'; card.style.left=Math.round((W-cw)/2)+'px'; card.style.top=Math.round(Math.max(12,(H-ch)/2))+'px'; card.removeAttribute('data-side'); return; }
    var r=el.getBoundingClientRect();
    spot.style.display='block';
    spot.style.left=(r.left-pad)+'px'; spot.style.top=(r.top-pad)+'px'; spot.style.width=(r.width+pad*2)+'px'; spot.style.height=(r.height+pad*2)+'px';
    var below=H-r.bottom, above=r.top, top, side;
    if(below>=ch+24){ top=r.bottom+pad+12; side='below'; }
    else if(above>=ch+24){ top=r.top-pad-12-ch; side='above'; }
    else { top=Math.max(12, H-ch-12); side='over'; }
    top=Math.min(Math.max(12, top), Math.max(12, H-ch-12));
    var left=Math.min(Math.max(12, r.left), W-cw-12);
    card.style.left=Math.round(left)+'px'; card.style.top=Math.round(top)+'px'; card.setAttribute('data-side', side);
  }
  function loop(){ cancelAnimationFrame(raf); raf=requestAnimationFrame(function(){ place(); }); }
  function render(){
    var st=L[i], last=i===L.length-1;
    card.innerHTML='<p class="yt-k">Tour · '+(i+1)+' of '+L.length+'</p>'
      + '<h2 id="yt-t">'+st.t+'</h2><p class="yt-b">'+val(st.b)+'</p>'
      + (last?'<p class="yt-b yt-again">Replay this tour any time from <b>Take the tour</b> in the menu.</p>':'')
      + '<div class="yt-row"><button type="button" class="yt-skip" data-yt="skip">'+(last?'Close':'Skip tour')+'</button><span class="yt-sp"></span>'
      + (i>0?'<button type="button" class="yt-btn yt-ghost" data-yt="back">Back</button>':'')
      + '<button type="button" class="yt-btn" data-yt="'+(last?'skip':'next')+'">'+(last?'Done':'Next')+'</button></div>'
      + '<div class="yt-dots" aria-hidden="true">'+L.map(function(_,k){ return '<i'+(k===i?' class="on"':'')+'></i>'; }).join('')+'</div>';
  }
  function go(n){
    if(n<0) return; if(n>=L.length){ end(); return; }
    i=n; render();
    var el=target(L[i]);
    if(el){ var r=el.getBoundingClientRect(); if(r.top<80 || r.bottom>window.innerHeight-40) el.scrollIntoView({block:r.height>window.innerHeight*0.6?'start':'center', behavior:(phone()||matchMedia('(prefers-reduced-motion: reduce)').matches)?'auto':'smooth'}); }
    place(); setTimeout(place, 380); setTimeout(place, 800);
    var b=card.querySelector('[data-yt="next"],[data-yt="skip"].yt-btn'); if(b) b.focus({preventScroll:true});
  }
  function key(e){
    if(!active) return;
    if(e.key==='Escape'){ e.preventDefault(); end(); }
    else if(e.key==='ArrowRight'){ e.preventDefault(); go(i+1); }
    else if(e.key==='ArrowLeft'){ e.preventDefault(); go(i-1); }
  }
  function start(){
    if(active || !onDashboard()) return false;
    if(!spot) build();
    L=STOPS.filter(function(st,k){ return k===STOPS.length-1 || !!target(st); });
    active=true; lastFocus=document.activeElement; document.body.classList.add('yt-on');
    spot.style.display='block'; card.style.display='block';
    window.addEventListener('scroll', loop, true); window.addEventListener('resize', loop); document.addEventListener('keydown', key, true);
    go(0); mark(); return true;
  }
  function end(){
    if(!active) return; active=false; mark();
    spot.style.display='none'; card.style.display='none'; document.body.classList.remove('yt-on');
    window.removeEventListener('scroll', loop, true); window.removeEventListener('resize', loop); document.removeEventListener('keydown', key, true);
    if(lastFocus && lastFocus.focus && document.contains(lastFocus)) try{ lastFocus.focus({preventScroll:true}); }catch(e){}
  }

  /* ---------------------------------------------------------------- the menu item, and the first visit */
  var pending=false;
  function addMenu(){
    if(!isCustomer()) return;
    var nav=app.querySelector('.side .snav'); if(!nav || nav.querySelector('[data-tour-open]')) return;
    var a=document.createElement('a'); a.href='#/dashboard'; a.setAttribute('data-tour-open',''); a.className='yt-nav';
    a.innerHTML='<span>Take the tour</span>'; nav.appendChild(a);
  }
  function requestStart(){
    pending=true;
    var sc=app.querySelector('[data-act="side-close"]'); if(sc && phone()) sc.click();
    if(!/^#\/dashboard\b/.test(location.hash||'')) { location.hash='#/dashboard'; return; }
    setTimeout(function(){ if(pending && onDashboard()){ pending=false; window.scrollTo(0,0); start(); } }, 120);
  }
  document.addEventListener('click', function(e){ var a=e.target.closest('[data-tour-open]'); if(!a) return; e.preventDefault(); requestStart(); });

  function check(){
    addMenu();
    if(active && !onDashboard()){ end(); return; }
    if(!onDashboard() || !isCustomer() || active) return;
    if(pending){ pending=false; setTimeout(function(){ window.scrollTo(0,0); start(); }, 150); return; }
    if(window.YARTA_TOUR_AUTO===false) return;
    var u=uid(); if(!u || store()[u]) return;
    setTimeout(function(){ if(!active && onDashboard() && isCustomer() && !store()[uid()]) start(); }, 900);
  }
  var t=0; new MutationObserver(function(){ clearTimeout(t); t=setTimeout(check, 60); }).observe(app, {childList:true, subtree:true});
  window.addEventListener('hashchange', function(){ if(active) end(); });
  check();

  window.YartaTour={start:requestStart, end:end, reset:function(){ try{ localStorage.removeItem(KEY); }catch(e){} }};
})();
