/* Yarta customer portal prototype v0.1 (unlisted draft)
   A working static app: demo sign-in, monthly entry of raw figures, evidence, Yarta calculations,
   the Yindyamarra Environmental Score, printable monthly reports, export and import, and a Yarta
   operator view for review and verification, recommended help with bookings, and a roadmap with
   the score now, at the organisation's targets and with Yarta help. All data stays in this browser
   (localStorage for figures and bookings, IndexedDB for evidence files).
   Depends on dictionary.js, engine.js, demo-data.js and recommend.js. */
(function(){
'use strict';
var D = window.YESD, E = window.YESE, X = window.YESDEMO, R = window.YESR;
var KEY = 'yes-es-portal-v3';
var app = document.getElementById('app');
var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var SITE = null; /* site id in play during entry; null = the whole organisation */
var ui = { imp:null, impFile:null, flash:null, flashT:null, loginTab:'customer', confirmSubmit:false, confirmReset:false, importPreview:null, bookSlot:null, confirmCancel:null };

/* ------------------------------------------------------------------ utilities */
function $(s,r){ return (r||document).querySelector(s); }
function $$(s,r){ return [].slice.call((r||document).querySelectorAll(s)); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function isNum(x){ return x!==null && x!=='' && x!==undefined && isFinite(+x); }
function fmt(n,dp){ if(n==null||!isFinite(n)) return '—'; dp=dp||0; return Number(n).toLocaleString('en-AU',{minimumFractionDigits:dp,maximumFractionDigits:dp}); }
function auto(n){ if(n==null||!isFinite(n)) return '—'; var a=Math.abs(n); return fmt(n, a>=100?0:a>=10?1:2); }
function fmtF(f,v){ if(v==null||!isFinite(v)) return '—'; if(f && (f.kind==='count'||f.kind==='currency')) return fmt(v,0); if(+v===0) return '0'; return auto(v); }
function pct(n,dp){ return n==null||!isFinite(n) ? '—' : fmt(n,dp==null?0:dp)+'%'; }
function sgn(n,dp){ if(n==null||!isFinite(n)) return '—'; var s=fmt(Math.abs(n),dp||0); return (n>0?'+':n<0?'−':'±')+s; }
function delta(n,opts){ opts=opts||{}; if(n==null||!isFinite(n)) return '<span class="delta flat">—</span>'; var good = opts.lowerBetter ? n<0 : n>0; var cls = Math.abs(n)<0.5 ? 'flat' : good ? 'up' : 'down'; var arrow = n>0.5?'▲':n<-0.5?'▼':'■'; return '<span class="delta '+cls+'">'+arrow+' '+sgn(n,opts.dp||0)+(opts.unit||'')+'</span>'; }
function mLabel(k){ var p=E.parse(k); return MONTHS[p.m]+' '+p.y; }
function mShort(k){ var p=E.parse(k); return MONTHS[p.m].slice(0,3)+' '+String(p.y).slice(2); }
function dueDate(k){ var p=E.parse(E.addMonths(k,1)); return new Date(p.y,p.m,15); }
function longDate(d){ if(!d) return '—'; if(typeof d==='string') d=new Date(d.length<=10?d+'T00:00:00':d); return d.toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'}); }
function nowKey(){ var t=new Date(); return E.key(t.getFullYear(), t.getMonth()); }
function isoNow(){ return new Date().toISOString(); }
function initials(n){ return String(n||'').split(/\s+/).map(function(w){return w.charAt(0);}).slice(0,2).join('').toUpperCase(); }
function clamp(x,a,b){ return Math.max(a,Math.min(b,x)); }
function catName(k){ return D.CAT[k] ? D.CAT[k].name : k; }
function field(id){ return D.FIELD[id] || (D.PROFILE.filter(function(f){return f.id===id;})[0]); }

/* ------------------------------------------------------------------ store */
function load(){
  try{ var s=JSON.parse(localStorage.getItem(KEY)); if(s && s.v===4 && s.orgs && s.users){ s.bookings=s.bookings||[]; seedOps(s); return s; } }catch(e){}
  var fresh = X.build(); seedOps(fresh); persist(fresh); return fresh;
}
function persist(s){
  try{ localStorage.setItem(KEY, JSON.stringify(s||state)); return true; }
  catch(e){ flash('This browser would not save the change (storage is full or blocked).','err'); return false; }
}
function seedOps(s){ seedOps2(s); if(!s.providers) s.providers=defaultProviders(); if(!s.gapLog) s.gapLog=[]; if(!s.opsSeeded){ s.opsSeeded=true; Object.keys(s.orgs).forEach(function(id){ var vs=s.orgs[id].records.filter(function(r){ return r.status==='verified'; }).sort(function(a,b){ return a.month<b.month?-1:1; }); vs.forEach(function(r){ if(!r.issuedAt){ var q=E.parse(E.addMonths(r.month,1)); r.issuedAt=new Date(q.y,q.m,20).toISOString().slice(0,10); r.issuedBy='Chris Walker'; } }); }); } var opsU=s.users.filter(function(u){ return u.role==='operator'; }); Object.keys(s.orgs).forEach(function(id,i){ var p=s.orgs[id].profile; if(!p.operator && opsU.length) p.operator=opsU[i%opsU.length].id; }); }
var state = load();
function save(){ return persist(state); }
function me(){ return state.session ? state.users.filter(function(u){ return u.id===state.session.user; })[0] : null; }
function isOp(){ var u=me(); return !!(u && u.role==='operator'); }
function ctxOrgId(){ var u=me(); if(!u) return null; return u.role==='operator' ? (state.session.viewOrg||'demo-shire') : u.org; }
function org(id){ return state.orgs[id||ctxOrgId()]; }
function rec(o,k){ return o.records.filter(function(r){ return r.month===k; })[0]; }
function sorted(o){ return o.records.slice().sort(function(a,b){ return a.month<b.month?-1:1; }); }
function log(action, detail, orgId){ var u=me(); state.audit=state.audit||[]; state.audit.unshift({at:isoNow(), by:u?u.name:'', role:u?u.role:'', org:orgId||ctxOrgId(), action:action, detail:detail||''}); state.audit=state.audit.slice(0,400); }
function flash(m,t){ ui.flash={m:m,t:t||'ok'}; clearTimeout(ui.flashT); ui.flashT=setTimeout(function(){ ui.flash=null; var f=$('.flash'); if(f) f.remove(); },3200); var f=$('.flash'); if(f) f.remove(); var el=document.createElement('div'); el.className='flash'+(t==='err'?' err':''); el.setAttribute('role','status'); el.textContent=m; document.body.appendChild(el); }

/* series: customers see verified months only; the Yarta team also sees months entered and waiting for verification (provisional) */
function seriesOf(o){ var op=isOp(); return E.series(o.records.filter(function(r){ return r.status==='verified' || (op && r.status==='submitted'); }), o.profile); }
function monthOf(S,k){ var ms=S.months; if(!ms.length) return null; if(!k) return ms[ms.length-1]; for(var i=0;i<ms.length;i++) if(ms[i].month===k) return ms[i]; return ms[ms.length-1]; }
function idxOf(S,k){ for(var i=0;i<S.months.length;i++) if(S.months[i].month===k) return i; return -1; }

/* carried-forward value of a static field as at month k (latest record at or before k that set it) */
function carried(o,k,id){ var rs=sorted(o); for(var i=rs.length-1;i>=0;i--){ if(rs[i].month<=k && rv(rs[i]) && isNum(rv(rs[i])[id])) return +rv(rs[i])[id]; if(rs[i].month<=k && rv(rs[i]) && rv(rs[i])[id]!=null && rv(rs[i])[id]!=='' && !isNum(rv(rs[i])[id]) && field(id) && (field(id).kind==='select'||field(id).kind==='text')) return rv(rs[i])[id]; } return null; }
/* values for a month with static fields filled from the register */
function withCarry(o,k,vals){ var v={}; for(var key in vals) v[key]=vals[key]; D.INPUTS.forEach(function(f){ if(f.freq==='S' && (v[f.id]===undefined||v[f.id]==='')){ var c=carried(o,k,f.id); if(c!=null) v[f.id]=c; } }); return v; }

/* ------------------------------------------------------------------ evidence files (IndexedDB) */
var dbp=null;
function idb(){ if(dbp) return dbp; dbp=new Promise(function(res,rej){ if(!window.indexedDB){ rej('no idb'); return; } var q=indexedDB.open('yes-es-evidence',1); q.onupgradeneeded=function(){ q.result.createObjectStore('files'); }; q.onsuccess=function(){ res(q.result); }; q.onerror=function(){ rej(q.error); }; }); return dbp; }
function idbDo(mode,fn){ return idb().then(function(db){ return new Promise(function(res,rej){ var tx=db.transaction('files',mode); var st=tx.objectStore('files'); var r=fn(st); tx.oncomplete=function(){ res(r && r.result); }; tx.onerror=function(){ rej(tx.error); }; }); }); }
function putFile(key,file){ return idbDo('readwrite',function(st){ return st.put(file,key); }); }
function getFile(key){ return idbDo('readonly',function(st){ return st.get(key); }); }
function delFile(key){ return idbDo('readwrite',function(st){ return st.delete(key); }); }
function clearFiles(){ return idbDo('readwrite',function(st){ return st.clear(); }).catch(function(){}); }
function evKey(orgId,k,cat){ return orgId+'/'+k+'/'+cat; }

/* ------------------------------------------------------------------ routing */
function parseHash(){ var h=location.hash.replace(/^#\/?/,''); var q={}; var i=h.indexOf('?'); if(i>=0){ h.slice(i+1).split('&').forEach(function(p){ var kv=p.split('='); if(kv[0]) q[decodeURIComponent(kv[0])]=decodeURIComponent(kv[1]||''); }); h=h.slice(0,i); } return {parts:h.split('/').filter(Boolean), q:q}; }
function go(h){ if(location.hash===h) render(); else location.hash=h; }
window.addEventListener('hashchange', function(){ ui.confirmSubmit=false; ui.confirmReset=false; ui.confirmCancel=null; ui.bookSlot=null; render(); window.scrollTo(0,0); });

/* ------------------------------------------------------------------ small SVG charts */
function lineChart(pts,o){
  o=o||{}; var W=o.w||720, H=o.h||220, pl=34, pr=10, pt=12, pb=26;
  var min=o.min!=null?o.min:0, max=o.max!=null?o.max:100;
  var n=pts.length; if(!n) return '';
  var split=o.split!=null?Math.min(o.split,n-1):n-1;   // points after split are a projection, drawn dashed
  var x=function(i){ return pl + (n===1?0:(i*(W-pl-pr)/(n-1))); };
  var y=function(v){ return pt + (H-pt-pb)*(1-(v-min)/(max-min||1)); };
  var s='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(o.label||'Chart')+'">';
  if(o.band && o.band[1]>=o.band[0]){ var bx0=x(o.band[0])-(n>1?(W-pl-pr)/(n-1)/2:6), bx1=x(o.band[1])+(n>1?(W-pl-pr)/(n-1)/2:6); s+='<rect class="base" x="'+Math.max(pl,bx0)+'" y="'+pt+'" width="'+(Math.min(W-pr,bx1)-Math.max(pl,bx0))+'" height="'+(H-pt-pb)+'"/>'; if(o.bandLabel) s+='<text x="'+(Math.max(pl,bx0)+6)+'" y="'+(pt+13)+'">'+esc(o.bandLabel)+'</text>'; }
  (o.ticks||[0,25,50,75,100]).forEach(function(t){ s+='<line class="grid" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(t)+'" y2="'+y(t)+'"/><text x="'+(pl-8)+'" y="'+(y(t)+4)+'" text-anchor="end">'+t+'</text>'; });
  (o.refs||[]).forEach(function(r){ if(r.v==null) return; s+='<line class="ref" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(r.v).toFixed(1)+'" y2="'+y(r.v).toFixed(1)+'"/><text class="ref-t" x="'+(pl+6)+'" y="'+(y(r.v)-6).toFixed(1)+'">'+esc(r.label)+'</text>'; });
  var step=Math.ceil(n/(o.maxLabels||9));
  pts.forEach(function(p,i){ if(i%step===0||i===n-1) s+='<text x="'+x(i)+'" y="'+(H-6)+'" text-anchor="middle">'+esc(p.label)+'</text>'; });
  var col=o.color||'#E9A860', txt=o.dark?'#FFFFFF':'#0B0B0B';
  function path(from,to){ var d='', started=false; for(var i=from;i<=to;i++){ var p=pts[i]; if(p.v==null){ started=false; continue; } d+=(started?'L':'M')+x(i).toFixed(1)+' '+y(p.v).toFixed(1); started=true; } return d; }
  s+='<path d="'+path(0,split)+'" fill="none" stroke="'+col+'" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';
  if(split<n-1){
    s+='<line class="now" x1="'+x(split).toFixed(1)+'" x2="'+x(split).toFixed(1)+'" y1="'+pt+'" y2="'+(H-pb)+'"/><text x="'+(x(split)+6).toFixed(1)+'" y="'+(H-pb-8)+'">Projected</text>';
    s+='<path class="proj" d="'+path(split,n-1)+'" fill="none" stroke="'+col+'" stroke-width="2.4" stroke-dasharray="6 5" stroke-linejoin="round" stroke-linecap="round"/>';
    var lp=pts[n-1]; if(lp.v!=null) s+='<circle cx="'+x(n-1)+'" cy="'+y(lp.v)+'" r="4.5" fill="'+(o.dark?'#0D0E0E':'#FFFFFF')+'" stroke="'+col+'" stroke-width="2"><title>'+esc(lp.label+': '+fmt(lp.v,0)+' (projected estimate)')+'</title></circle><text x="'+(x(n-1)-8)+'" y="'+(y(lp.v)-10)+'" text-anchor="end" style="font-weight:600;fill:'+txt+'">'+fmt(lp.v,0)+'</text>';
  }
  pts.forEach(function(p,i){ if(p.v==null||i>split) return; var last=i===split; s+='<circle cx="'+x(i)+'" cy="'+y(p.v)+'" r="'+(last?5:2.6)+'" fill="'+(p.prov?(o.dark?'#0D0E0E':'#FFFFFF'):col)+'" stroke="'+col+'" stroke-width="'+(p.prov?1.8:0)+'"><title>'+esc(p.label+': '+fmt(p.v,0)+(p.prov?' (provisional)':''))+'</title></circle>'; if(last) s+='<text x="'+(x(i)-8)+'" y="'+(y(p.v)-10)+'" text-anchor="end" style="font-weight:600;fill:'+txt+'">'+fmt(p.v,0)+'</text>'; });
  return s+'</svg>';
}
function spark(vals,o){
  o=o||{}; var W=160,H=30; var xs=vals.filter(function(v){return v!=null;}); if(xs.length<2) return '<svg viewBox="0 0 160 30" aria-hidden="true"></svg>';
  var min=o.min!=null?o.min:Math.min.apply(null,xs), max=o.max!=null?o.max:Math.max.apply(null,xs); if(max-min<1){ max+=0.5; min-=0.5; }
  var n=vals.length, d='', st=false;
  vals.forEach(function(v,i){ if(v==null){ st=false; return; } var x=i*(W-4)/(n-1)+2, y=2+(H-4)*(1-(v-min)/(max-min)); d+=(st?'L':'M')+x.toFixed(1)+' '+y.toFixed(1); st=true; });
  return '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-hidden="true"><path d="'+d+'" fill="none" stroke="'+(o.color||'#CF7A2E')+'" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>';
}
function stackBars(rows,o){
  o=o||{}; var W=o.w||720,H=o.h||200,pl=44,pr=8,pt=10,pb=26; var n=rows.length; if(!n) return '';
  var max=0; rows.forEach(function(r){ var t=r.parts.reduce(function(a,b){return a+(b||0);},0); if(t>max) max=t; }); if(!max) max=1;
  var nice=Math.pow(10,Math.floor(Math.log10(max))); var top=Math.ceil(max/nice)*nice; if(top/nice<=2) top=Math.ceil(max/(nice/2))*(nice/2);
  var bw=(W-pl-pr)/n*0.62, gap=(W-pl-pr)/n;
  var y=function(v){ return pt+(H-pt-pb)*(1-v/top); };
  var s='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(o.label||'Chart')+'">';
  [0,0.5,1].forEach(function(f){ var v=top*f; s+='<line class="grid" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(v)+'" y2="'+y(v)+'"/><text x="'+(pl-6)+'" y="'+(y(v)+4)+'" text-anchor="end">'+(v>=10000?fmt(v/1000,0)+'k':fmt(v,0))+'</text>'; });
  rows.forEach(function(r,i){ var x=pl+i*gap+(gap-bw)/2, acc=0; r.parts.forEach(function(v,j){ v=v||0; if(v<=0) return; var y0=y(acc), y1=y(acc+v); s+='<rect x="'+x.toFixed(1)+'" y="'+y1.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(0.5,y0-y1).toFixed(1)+'" fill="'+o.colors[j]+'"><title>'+esc(r.label+' · '+(o.names?o.names[j]+': ':'')+auto(v)+(o.unit?' '+o.unit:''))+'</title></rect>'; acc+=v; }); if(i%Math.ceil(n/13)===0||i===n-1) s+='<text x="'+(x+bw/2)+'" y="'+(H-7)+'" text-anchor="middle">'+esc(r.label)+'</text>'; });
  return s+'</svg>';
}
function ring(v,size,light){ return '<div class="score-ring'+(light?' light':'')+'" style="--v:'+(v==null?0:v)+';--size:'+(size||170)+'px"><div class="in"><div class="v">'+(v==null?'—':v)+'</div><div class="of">out of 100</div></div></div>'; }
function statusChip(st){ var L={verified:'Verified',submitted:'Awaiting verification',draft:'Being entered',returned:'Returned to data entry'}; return '<span class="st st-'+esc(st)+'">'+(L[st]||esc(st))+'</span>'; }

/* ------------------------------------------------------------------ shell */
function openMonths(o){ return sorted(o).filter(function(r){ return r.status==='draft'||r.status==='returned'; }); }
function entryQueue(){ var q=[]; Object.keys(state.orgs).forEach(function(id){ state.orgs[id].records.forEach(function(r){ if(r.status==='draft'||r.status==='returned') q.push({org:id, rec:r}); }); }); return q.sort(function(a,b){ return a.rec.month<b.rec.month?-1:1; }); }
function queue(){ var q=[]; Object.keys(state.orgs).forEach(function(id){ state.orgs[id].records.forEach(function(r){ if(r.status==='submitted') q.push({org:id, rec:r}); }); }); return q.sort(function(a,b){ return a.rec.month<b.rec.month?-1:1; }); }

function shell(active, body){
  var u=me(), o=org(), op=isOp();
  var links = op ? [
      ['grp','Yarta team'],
      ['#/ops/home','Today','home'],
      ['#/ops/gaps','Gap emails','gaps'],
      ['#/ops/entry','Data entry','entry', entryQueue().length||''],
      ['#/ops','Verification','ops', queue().length||''],
      ['#/ops/reports','Reports to issue','issue', reportsToIssue().length||''],
      ['#/ops/bookings','Bookings','bookings', (state.bookings||[]).filter(function(b){ return b.status==='requested'; }).length||''],
      ['#/ops/providers','Providers','providers'],
      ['#/ops/import','Import','import'],
      ['#/ops/onboarding','Onboarding','onboarding'],
      ['#/ops/customers','Customers','customers'],
      ['#/ops/accounts','Accounts','accounts'],
      ['#/ops/service','Service','service'],
      ['#/ops/outbox','Outbox','outbox', (state.outbox||[]).filter(function(m){ return m.status==='queued'; }).length||''],
      ['#/ops/sop','Analyst manual','sop'],
      ['#/ops/guides','Field guide','guides'],
      ['#/ops/factors','Factor library','factors'],
      ['#/ops/activity','Activity','activity'],
      ['grp','Customer view · '+(o?o.profile.org_name:'')],
      ['#/dashboard','Dashboard','dashboard'],
      ['#/reports','Reports','reports'],
      ['#/roadmap','Roadmap','roadmap'],
      ['#/improvements','Improvements','improve'],
      ['#/documents','Documents','documents'],
      ['#/organisation','Organisation','organisation'],
      ['#/data','Data and export','data']
    ] : [
      ['grp','Reporting'],
      ['#/dashboard','Dashboard','dashboard'],
      ['#/reports','Reports','reports'],
      ['#/roadmap','Roadmap','roadmap'],
      ['#/improvements','Improvements','improve'],
      ['#/documents','Send documents','documents'],
      ['#/checklist','What to send','checklist'],
      ['grp','Account'],
      ['#/organisation','Organisation','organisation'],
      ['#/data','Data and export','data']
    ];
  if(multisite(o)){ var ri=links.map(function(l){ return l[2]; }).indexOf('reports'); links.splice(ri+1,0,['#/sites','Sites','sites']); }
  var nav = links.map(function(l){ if(l[0]==='grp') return '<div class="grp">'+esc(l[1])+'</div>'; return '<a href="'+l[0]+'"'+(l[2]===active?' aria-current="page"':'')+'><span>'+esc(l[1])+'</span>'+(l[3]?'<span class="cnt">'+l[3]+'</span>':'')+'</a>'; }).join('');
  return '<div class="mtop"><a class="brand" href="#/dashboard"><span class="mark silver">Yarta</span></a><span class="o">'+esc(o?o.profile.org_name:'')+'</span><button class="menu-btn" type="button" data-act="side-open" style="display:block">MENU</button></div>'
   + '<div class="app"><aside class="side" id="side" aria-label="Portal navigation">'
   + '<button class="menu-btn side-close" type="button" data-act="side-close">CLOSE</button>'
   + '<a class="brand" href="../"><span class="mark silver">Yarta</span><span class="full">Yindyamarra<br>Environmental Sustainability</span></a>'
   + '<div class="who"><div class="o">'+esc(op?'Yarta operator':(o?o.profile.org_name:''))+'</div><div class="u">'+esc(u.name)+' · '+esc(u.title)+'</div><div class="role"><span class="chip">'+(op?'Yarta team':'Customer')+'</span></div></div>'
   + '<nav class="snav">'+nav+'</nav>'
   + '<div class="foot">Prototype. Your data stays in this browser.<br><button class="btn btn-ghost btn-sm" type="button" data-act="signout" style="color:var(--silver-2)">Sign out</button></div>'
   + '</aside><main class="main" id="main"><div class="content">'
   + (op && ['dashboard','reports','roadmap','documents','organisation','category','report','data'].indexOf(active)>=0 ? '<div class="banner grey no-print"><span>Viewing <b>'+esc(o.profile.org_name)+'</b> as the Yarta team. The customer sees verified months only; months waiting for verification show here as provisional.</span><a class="btn btn-ghost btn-sm" href="#/ops/customers">Switch customer</a></div>' : '')
   + body + '</div></main></div>';
}

/* ------------------------------------------------------------------ login */
function vLogin(){
  if(window.YESPORTAL_CLIENT) ui.loginTab='customer';
  var accts = state.users.filter(function(u){ return ui.loginTab==='operator' ? u.role==='operator' : u.role==='customer'; });
  var list = accts.map(function(u){ var o=u.org?state.orgs[u.org]:null; return '<button class="acct" type="button" data-act="login" data-user="'+esc(u.id)+'"><span class="av">'+esc(initials(u.name))+'</span><span class="nm">'+esc(u.name)+'</span><span class="go" aria-hidden="true">→</span><span class="ds">'+esc(u.title)+(o?' · '+esc(o.profile.org_name):'')+'</span></button>'; }).join('');
  return '<div class="login"><div class="l"><div class="bg" aria-hidden="true"><video data-bgv muted loop playsinline preload="none" poster="../assets/video/aisle-720.webp"><source data-src="../assets/video/aisle-720.mp4" type="video/mp4"></video></div>'
   + '<a class="brand" href="../"><span class="mark silver" style="font-size:30px">Yarta</span><span class="full">Yindyamarra<br>Environmental Sustainability</span></a>'
   + '<div><p class="eyebrow">Customer portal</p><h1><span class="silver">Send the paperwork once a month.</span> Yarta does the rest.</h1><p class="lead" style="margin-top:20px;color:var(--silver-2)">Upload your bills, statements and registers. Yarta enters every figure, grades the evidence and has a second analyst verify the month, then calculates the emissions, the rates, the trends and your Yindyamarra Environmental Score.</p></div>'
   + '<p class="small" style="color:var(--silver-4);max-width:52ch">Prototype with fictional demo organisations. There are no passwords here: in production each customer signs in with their own account, and Yarta staff sign in separately. Customers see their verified reports and send documents; Yarta staff enter and verify the figures.</p></div>'
   + '<div class="r"><div class="box"><p class="kicker">Sign in</p><h2 style="font-size:30px;margin:8px 0 18px">Choose a demo account</h2>'
   + ''+(window.YESPORTAL_CLIENT?'':'<div class="tabs" role="tablist" style="margin-bottom:18px"><button type="button" role="tab" data-act="ltab" data-tab="customer" aria-selected="'+(ui.loginTab==='customer')+'">Council or business</button><button type="button" role="tab" data-act="ltab" data-tab="operator" aria-selected="'+(ui.loginTab==='operator')+'">Yarta team</button></div>')
   + list
   + '<p class="small muted" style="margin-top:22px">Everything you enter stays in this browser. <button class="link" type="button" data-act="reset-demo" style="background:none;border:0;padding:0;font:inherit;cursor:pointer">Reset the demo data</button></p>'
   + '</div></div></div>';
}

/* ------------------------------------------------------------------ dashboard */
function vDashboard(q){
  var o=org(), S=seriesOf(o), m=monthOf(S,q.m);
  if(!m) return shell('dashboard','<div class="pg-head"><div><h1>'+esc(o.profile.org_name)+'</h1></div></div><div class="empty">'+(isOp()?'No month has been verified or entered yet. <a class="link" href="#/ops/entry">Open data entry</a>.':'Your first verified month will appear here. <a class="link" href="#/documents">Send your documents</a> and Yarta will enter them.')+'</div>');
  var i=idxOf(S,m.month), R12=m.r12, T=S.targets, p=o.profile;
  var opts = S.months.slice().reverse().map(function(x){ return '<option value="'+x.month+'"'+(x.month===m.month?' selected':'')+'>'+mLabel(x.month)+(x.status!=='verified'?' · provisional':'')+'</option>'; }).join('');
  var head = '<div class="pg-head"><div><p class="kicker">Dashboard</p><h1>'+esc(p.org_name)+'</h1><p class="pg-sub">'+esc((window.YESS&&p.sector&&window.YESS.BY[p.sector])?window.YESS.BY[p.sector].one:p.org_type)+' · '+esc(p.state)+(p.residents?' · '+fmt(p.residents)+' residents':'')+' · '+fmt(p.employees)+' FTE · baseline '+esc(p.baseline_fy)+'</p></div>'
    + '<div class="pg-actions"><label class="vh" for="dm">Month</label><select id="dm" data-act="dash-month">'+opts+'</select><a class="btn btn-ink btn-sm" href="#/report/'+m.month+'">Monthly report</a></div></div>';
  // where the next month stands
  var banner='';
  var pend=sorted(o).filter(function(r){ return r.status!=='verified'; });
  if(isOp()){
    var om=openMonths(o);
    if(om.length){ var r0=om[om.length-1], prog=progressOf(o,r0); banner='<div class="banner no-print"><span><b>'+mLabel(r0.month)+' is open for data entry.</b> '+prog.req+' of '+prog.reqDue+' required figures entered · '+((r0.inbox||[]).length)+' documents from the customer'+(r0.status==='returned'?' · <b>returned by verification with a note</b>':'')+'</span><a class="btn btn-primary btn-sm" href="#/entry/'+o.id+'/'+r0.month+'">Enter figures</a></div>'; }
  } else {
    var lastP=pend[pend.length-1];
    if(lastP && lastP.status==='submitted') banner='<div class="banner grey no-print"><span><b>'+mLabel(lastP.month)+' is entered and with Yarta for verification.</b> Its report appears here once a second analyst has verified it.</span><a class="btn btn-ghost btn-sm" href="#/documents" style="color:var(--ink)">Send documents</a></div>';
    else if(lastP) banner='<div class="banner grey no-print"><span><b>Yarta is entering '+mLabel(lastP.month)+'</b> from the '+((lastP.inbox||[]).length)+' document'+(((lastP.inbox||[]).length)===1?'':'s')+' you sent.</span><a class="btn btn-ghost btn-sm" href="#/documents" style="color:var(--ink)">Send documents</a></div>';
    var rsAll=sorted(o), dueK=rsAll.length?E.addMonths(rsAll[rsAll.length-1].month,1):E.addMonths(nowKey(),-1); if(dueK<=nowKey() && !rec(o,dueK)) banner+='<div class="banner no-print"><span><b>Documents for '+mLabel(dueK)+' are due '+longDate(dueDate(dueK))+'.</b> Fuel card statements, energy and water bills, waste dockets and registers.</span><a class="btn btn-primary btn-sm" href="#/documents">Send documents</a></div>';
  }
  // hero
  var yoyTxt = m.yoy!=null ? delta(m.yoy)+' <span>on '+mLabel(S.months[i-12].month)+'</span>' : '<span class="muted">Year-on-year change after 12 months</span>';
  var momTxt = m.mom!=null ? delta(m.mom)+' <span>on '+mLabel(S.months[i-1].month)+'</span>' : '';
  var stTxt = m.status==='verified' ? 'Verified by Yarta'+(rec(o,m.month).verifiedAt?' on '+longDate(rec(o,m.month).verifiedAt):'') : 'Provisional: awaiting Yarta verification';
  var basePts = S.months.map(function(x){ return {label:mShort(x.month), v:x.score, prov:x.status!=='verified'}; });
  var bIdx=[]; S.months.forEach(function(x,j){ if(E.fyOf(x.month)===S.baseline.fy) bIdx.push(j); });
  var hero = '<section class="panel-dark"><div class="dhero"><div class="dh-score">'+ring(m.score,176)+'<div class="dh-meta"><div class="lbl">Yindyamarra Environmental Score · '+mLabel(m.month)+'</div><div class="band">'+esc(m.band)+'</div>'
    + '<div class="dl"><span>Year on year</span><b>'+yoyTxt+'</b><span>Month on month</span><b>'+(momTxt||'—')+'</b><span>Status</span><b>'+statusChip(m.status)+'</b><span>Coverage</span><b>'+m.scored+' of 10 categories</b></div>'
    + '<p class="small" style="color:var(--silver-5);margin:14px 0 0;max-width:40ch">'+esc(stTxt)+'. Self-declared under the published Yarta method; not an accredited rating.</p></div></div>'
    + '<div class="dh-chart">'+lineChart(basePts,{dark:true,label:'Score by month',band:bIdx.length?[bIdx[0],bIdx[bIdx.length-1]]:null,bandLabel:bIdx.length?'Baseline '+S.baseline.fy:'',h:230})+'</div></div></section>';
  // where you could be, and recommended help
  var P=planFor(o,S,i), help='';
  if(P){
    var top3=P.items.filter(function(it){ return it.k!=='grants' && !it.off; }).slice(0,3);
    help='<section class="wyc no-print" aria-labelledby="wyc-h"><div class="wyc-top"><div><h2 class="sec-t" id="wyc-h">Where you could be</h2><p class="sec-s">Your score now, at the eco standards, and an estimate with the recommended help done.</p></div><a class="btn btn-ghost btn-sm" href="#/roadmap" style="color:var(--ink)">See your roadmap</a></div>'+threeNums(P,m)
      + (top3.length?'<h2 class="sec-t" style="margin-top:26px">Recommended for you</h2><p class="sec-s">From your figures to '+mLabel(m.month)+', by the published rules. You can use any provider.</p><div class="recs">'+top3.map(recCard).join('')+'</div>':'')+'</section>';
  }
  // tiles
  var tiles = '<section><h2 class="sec-t" style="margin-top:28px">Ten categories</h2><p class="sec-s">Rolling 12 months to '+mLabel(m.month)+'. Change is against the same month last year. Select a category for its figures.</p><div class="tiles">'
    + D.CATEGORIES.map(function(c){ var v=m.scores[c.k]; var hist=S.months.slice(Math.max(0,i-12),i+1).map(function(x){ return x.scores[c.k]; }); return '<a class="tile" href="#/category/'+c.k+'?m='+m.month+'"><div class="n">'+esc(c.short)+'</div>'+(v==null?'<div class="v na">Not reported</div>':'<div class="v">'+Math.round(v)+' '+delta(m.cat_yoy[c.k])+'</div>'+spark(hist,{min:0,max:100}))+(m.prov[c.k]?'<span class="prov" title="Provisional until 12 months of data">P</span>':'')+'</a>'; }).join('')
    + '</div></section>';
  // emissions
  var tot=R12.total_t, base=R12.base.total_t, chg=base>0?(tot-base)/base*100:null;
  var s1=R12.scope1_t/tot*100, s2=R12.scope2_t/tot*100, s3=R12.scope3_t/tot*100;
  var last13=S.months.slice(Math.max(0,i-12),i+1).map(function(x){ return {label:mShort(x.month), parts:[x.scope1_t,x.scope2_t,x.scope3_t]}; });
  var emis = '<div class="panel"><div class="metric"><div class="k">Operational emissions · rolling 12 months</div><div class="v">'+fmt(tot,0)+'<span class="u">t CO₂-e</span></div><div class="s">'+(chg!=null?delta(chg,{lowerBetter:true,dp:1,unit:'%'})+' against the same months of the baseline year':'')+'</div></div>'
    + '<div class="split-bar" aria-hidden="true"><i class="s1" style="width:'+s1+'%"></i><i class="s2" style="width:'+s2+'%"></i><i class="s3" style="width:'+s3+'%"></i></div>'
    + '<div class="legend"><span><i class="s1"></i>Scope 1 · '+fmt(R12.scope1_t,0)+' t</span><span><i class="s2"></i>Scope 2 · '+fmt(R12.scope2_t,0)+' t</span><span><i class="s3"></i>Scope 3 (reported categories) · '+fmt(R12.scope3_t,0)+' t</span></div>'
    + '<div style="margin-top:16px">'+stackBars(last13,{colors:['#8A4A14','#CF7A2E','#F2C894'],names:['Scope 1','Scope 2','Scope 3'],unit:'t CO₂-e',label:'Emissions by month',h:190})+'</div>'
    + '<p class="small muted" style="margin:10px 0 0">Avoided emissions from recycling, reported separately and never deducted: <b>'+fmt(R12.avoided_t,0)+' t CO₂-e</b> (modelled estimate). '+(R12.flights?'':'')+'Flights are recorded but not yet in the totals.</p></div>';
  // targets
  var tg = E.targets(S.months.length ? {months:S.months.slice(0,i+1), targets:T, baseline:S.baseline} : S);
  var BMd=benchFor(o.profile);
  var targ = '<div class="panel"><h3>Eco standards, benchmarks and actuals</h3><p class="sec-s" style="margin-top:4px">Rolling 12 months to '+mLabel(m.month)+'. Targets are set on the Organisation page.</p>'
    + tg.map(function(t){ var a=t.actual, max=Math.max(100,t.target||0), b=BMd&&BMd[t.k]; return '<div style="margin-top:18px"><div style="display:flex;justify-content:space-between;gap:10px;font-size:14px"><b style="font-weight:600">'+esc(t.name)+'</b><span class="mono">'+(a==null?'—':fmt(a,1)+'%')+' <span class="muted">/ '+fmt(t.target,0)+'%</span></span></div><div class="tbar" aria-hidden="true"><i style="width:'+clamp((a||0)/max*100,0,100)+'%"></i><b style="left:'+clamp(t.target/max*100,0,100)+'%"></b>'+(b?'<s class="bm" style="left:'+clamp(b.v/max*100,0,100)+'%"></s>':'')+'</div>'+(b?'<p class="small muted" style="margin:6px 0 0">Industry benchmark '+fmt(b.v,0)+'%: '+esc(b.label)+'.</p>':'')+'</div>'; }).join('')
    + '<p class="small muted" style="margin:16px 0 0">The black mark is the eco standard or your target, whichever is higher. The dark orange mark is the published industry benchmark for your sector; no other organisation\'s data is used.'+(tg[0]&&tg[0].note?' Emissions: '+esc(tg[0].note.toLowerCase())+'.':'')+'</p></div>';
  // key metrics
  function mc(k,v,u,s){ return '<div class="panel metric"><div class="k">'+k+'</div><div class="v">'+v+(u?'<span class="u">'+u+'</span>':'')+'</div><div class="s">'+s+'</div></div>'; }
  var fuelChg = R12.base.fuel_l>0 ? (R12.fuel_l-R12.base.fuel_l)/R12.base.fuel_l*100 : null;
  var elecChg = R12.base.grid_kwh>0 ? (R12.grid_kwh-R12.base.grid_kwh)/R12.base.grid_kwh*100 : null;
  var watChg = R12.base.potable_kl>0 ? (R12.potable_kl-R12.base.potable_kl)/R12.base.potable_kl*100 : null;
  var metrics = '<section><h2 class="sec-t" style="margin-top:28px">Key figures</h2><p class="sec-s">Rolling 12 months to '+mLabel(m.month)+', calculated by Yarta from the figures you entered.</p><div class="row3">'
    + mc('Renewable electricity',pct(R12.renew_pct,1),'','Target '+fmt(T.target_renewable,0)+'% · purchased renewables and solar used on site')
    + mc('Fleet electrification',pct(m.fleet_ev_pct,1),'',fmt(m.fleet_n,0)+' vehicles · target '+fmt(T.target_fleet_ev,0)+'%')
    + mc('Landfill diversion',pct(R12.diversion_pct,1),'','Recovery rate '+pct(R12.recovery_pct,1)+' · target '+fmt(T.target_diversion,0)+'%')
    + mc('Fuel purchased',fmt(R12.fuel_l/1000,0),'kL',delta(fuelChg,{lowerBetter:true,dp:1,unit:'%'})+' on the baseline months')
    + mc('Grid electricity',fmt(R12.grid_kwh/1000,0),'MWh',delta(elecChg,{lowerBetter:true,dp:1,unit:'%'})+' on the baseline months')
    + mc('Potable water',fmt(R12.potable_kl,0),'kL',delta(watChg,{lowerBetter:true,dp:1,unit:'%'})+' · alternative water '+pct(R12.alt_water_pct,1))
    + mc('Trees planted',fmt(R12.trees,0),'','Target '+fmt(T.target_trees,0)+' a year')
    + mc('Habitat restored',fmt(R12.native_ha,1),'ha','Native vegetation, habitat and wetland · target '+fmt(T.target_native_ha,0)+' ha')
    + mc('Program participants',fmt(R12.participants,0),'','Target '+fmt(T.target_participants,0)+' a year')
    + '</div></section>';
  // fleet
  var v=m.values, fleet=[['Diesel cars',v.veh_diesel,'lg-ice'],['Petrol cars',v.veh_petrol,'lg-petrol'],['Hybrids',v.veh_hybrid,'lg-hyb'],['Plug-in hybrids',v.veh_phev,'lg-phev'],['Battery electric',v.veh_bev,'lg-bev'],['Diesel trucks',v.trucks_diesel,'lg-truck'],['Electric trucks',v.trucks_electric,'lg-etruck']];
  var fn=fleet.reduce(function(a,f){ return a+(+f[1]||0); },0)||1;
  var fuelRows=S.months.slice(Math.max(0,i-12),i+1).map(function(x){ return {label:mShort(x.month), parts:[+x.values.diesel_l||0,+x.values.petrol_l||0,(+x.values.lpg_l||0)+(+x.values.biodiesel_l||0)]}; });
  var fleetP = '<div class="panel"><h3>Fleet</h3><p class="sec-s" style="margin-top:4px">Register as at '+mLabel(m.month)+'. Plug-in hybrids count as half electric.</p>'
    + '<div class="split-bar" style="height:22px;border-radius:6px" aria-hidden="true">'+fleet.map(function(f){ return (+f[1]||0)>0?'<i class="'+f[2]+'" style="width:'+((+f[1])/fn*100)+'%" title="'+esc(f[0])+': '+f[1]+'"></i>':''; }).join('')+'</div>'
    + '<div class="legend">'+fleet.map(function(f){ return '<span><i class="'+f[2]+'"></i>'+esc(f[0])+' · '+fmt(+f[1]||0)+'</span>'; }).join('')+'</div>'
    + '<div style="margin-top:18px">'+stackBars(fuelRows,{colors:['#2A2A2A','#8E9396','#C4C8CA'],names:['Diesel','Petrol','LPG and biodiesel'],unit:'L',label:'Fuel purchased by month',h:170})+'</div>'
    + '<div class="legend"><span><i class="lg-diesel"></i>Diesel</span><span><i class="lg-petrol"></i>Petrol</span><span><i class="lg-other"></i>LPG and biodiesel</span></div></div>';
  // quality
  var r=rec(o,m.month), ev=r.evidence||{};
  var qual = '<div class="panel"><h3>Data quality · '+mLabel(m.month)+'</h3><dl class="kv" style="margin-top:14px"><dt>Required figures supplied</dt><dd>'+pct(m.complete_pct,0)+'</dd><dt>Figures backed by evidence</dt><dd>'+pct(m.evidence_pct,0)+'</dd><dt>Entered by Yarta</dt><dd>'+longDate(r.enteredAt||r.submittedAt)+'</dd><dt>Verified by Yarta</dt><dd>'+(r.verifiedAt?longDate(r.verifiedAt):'Not yet')+'</dd></dl>'
    + '<div class="pill-row" style="margin-top:16px">'+D.CATEGORIES.filter(function(c){ return c.k!=='carbon'; }).map(function(c){ var e=ev[c.k]; var g=e&&e.grade?e.grade:(e?'…':'—'); return '<span class="chip" title="'+esc(e?(e.name||''):'No evidence attached')+'"><span class="grade '+(e&&e.grade?e.grade:'none')+'" style="width:20px;height:20px;font-size:11px">'+g+'</span>'+esc(c.short)+'</span>'; }).join('')+'</div>'
    + '<p class="small muted" style="margin:12px 0 0">Evidence grades: A primary document (bill, docket, certificate) · B system extract or reconciled record · C estimate or unsupported · … awaiting Yarta.</p></div>';
  return shell('dashboard', head + banner + hero + help + tiles + '<div class="row2" style="margin-top:28px">'+emis+targ+'</div>' + metrics + '<div class="row2" style="margin-top:22px">'+fleetP+qual+'</div>');
}

/* ------------------------------------------------------------------ category detail */
var CALCMAP = {data_complete_pct:'complete_pct'};
function vCategory(cat,q){
  var o=org(), S=seriesOf(o), m=monthOf(S,q.m); var c=D.CAT[cat]; if(!c||!m) return vNotFound();
  var i=idxOf(S,m.month), prev=S.months[i-1]||null, ly=S.months[i-12]||null;
  var pts=S.months.map(function(x){ return {label:mShort(x.month), v:x.scores[cat]==null?null:Math.round(x.scores[cat]), prov:x.status!=='verified'||!!x.prov[cat]}; });
  var how=(E.SCORE_METHOD.filter(function(h){ return h.k===cat; })[0]||{}).how||'';
  var inputs=D.INPUTS.filter(function(f){ return f.cat===cat; });
  var calcs=D.CALCS.filter(function(f){ return f.cat===cat; });
  function val(mm,f){ if(!mm) return null; var x=mm.values[f.id]; return isNum(x)?+x:(x||null); }
  function row(f){ var a=val(m,f), b=val(prev,f), c2=val(ly,f); var ch=(isNum(a)&&isNum(c2)&&+c2>0)?(a-c2)/c2*100:null; var flag=ch!=null&&Math.abs(ch)>35; return '<tr'+(flag?' class="flag"':'')+'><td><b style="font-weight:600">'+esc(f.name)+'</b><div class="id">'+esc(f.id)+' · '+D.FREQ[f.freq]+(f.req?' · required':'')+'</div></td><td class="num">'+(isNum(a)?fmtF(f,a):(a?esc(a):'—'))+'</td><td>'+esc(f.unit)+'</td><td class="num">'+(isNum(b)?fmtF(f,b):'—')+'</td><td class="num">'+(isNum(c2)?fmtF(f,c2):'—')+'</td><td class="num">'+(ch==null?'—':sgn(ch,1)+'%')+'</td></tr>'; }
  function crow(f){ var k=CALCMAP[f.id]||f.id; var a=m[k], b=prev?prev[k]:null, c2=ly?ly[k]:null; return '<tr><td><b style="font-weight:600">'+esc(f.name)+'</b><div class="id">'+esc(f.calc)+'</div></td><td class="num">'+auto(a)+'</td><td>'+esc(f.unit)+'</td><td class="num">'+auto(b)+'</td><td class="num">'+auto(c2)+'</td><td></td></tr>'; }
  var th='<thead><tr><th>Figure</th><th class="r">'+mShort(m.month)+'</th><th>Unit</th><th class="r">'+(prev?mShort(prev.month):'Last month')+'</th><th class="r">'+(ly?mShort(ly.month):'Last year')+'</th><th class="r">Change on last year</th></tr></thead>';
  var body='<div class="pg-head"><div><p class="kicker"><a class="link" href="#/dashboard?m='+m.month+'">Dashboard</a> · Category</p><h1>'+esc(c.name)+'</h1><p class="pg-sub">'+esc(c.what)+'</p></div><div class="pg-actions"><span class="chip">'+mLabel(m.month)+'</span></div></div>'
    + '<div class="row2 w37"><div class="panel-dark"><div class="dh-meta"><div class="lbl">Category score</div></div>'+ring(m.scores[cat]==null?null:Math.round(m.scores[cat]),150)+'<div class="dh-meta" style="margin-top:16px"><div class="dl"><span>Year on year</span><b>'+delta(m.cat_yoy[cat])+'</b><span>Band</span><b>'+esc(E.band(m.scores[cat]==null?null:Math.round(m.scores[cat])))+'</b></div></div>'+(m.prov[cat]?'<p class="small" style="color:var(--silver-4);margin:14px 0 0">Provisional until 12 months of data.</p>':'')+'</div>'
    + '<div class="panel"><h3>Score by month</h3><p class="sec-s" style="margin-top:4px">How it is scored: '+esc(how)+'</p>'+lineChart(pts,{label:c.name+' score by month',h:200})+'</div></div>'
    + (inputs.length?'<h2 class="sec-t" style="margin-top:28px">Figures entered</h2><p class="sec-s">Rows more than 35% away from the same month last year are shaded for a second look.</p><div class="tbl-wrap"><table class="tbl compact">'+th+'<tbody>'+inputs.map(row).join('')+'</tbody></table></div>':'')
    + (calcs.length?'<h2 class="sec-t" style="margin-top:28px">Calculated by Yarta</h2><p class="sec-s">Never typed. Recalculated whenever a figure changes.</p><div class="tbl-wrap"><table class="tbl compact">'+th+'<tbody>'+calcs.map(crow).join('')+'</tbody></table></div>':'');
  return shell('category', body);
}

/* ------------------------------------------------------------------ submit */
function isFirst(o,k){ var rs=sorted(o); return !rs.length || rs[0].month===k; }
function dueFields(o,k){ var p=E.parse(k); return D.due(p.m, isFirst(o,k)); }
function progressOf(o,r){ var due=dueFields(o,r.month), v=r.values||{}; var decl=r.declared||{}; var req=due.filter(function(f){ return f.req && !decl[f.cat]; }); var got=req.filter(function(f){ return isNum(v[f.id]) || (f.kind!=='number'&&f.kind!=='count'&&f.kind!=='currency'&&f.kind!=='percent'&&v[f.id]); }); var all=due.filter(function(f){ return v[f.id]!==undefined && v[f.id]!==''; }); return {reqDue:req.length, req:got.length, due:due.length, all:all.length, missing:req.filter(function(f){ return got.indexOf(f)<0; })}; }
function nextStartable(o){ var rs=sorted(o); var last=rs[rs.length-1]; var nk = last ? E.addMonths(last.month,1) : E.addMonths(nowKey(),-1); if(nk>nowKey()) return null; if(rs.some(function(r){ return r.status==='draft'||r.status==='returned'; })) return null; return nk; }
function cmpVals(o,k,id){ var p=rec(o,E.addMonths(k,-1)), y=rec(o,E.addMonths(k,-12)); var f=field(id); var pv=p?rv(p)[id]:null, yv=y?rv(y)[id]:null; if(f&&f.freq==='S'){ pv=carried(o,E.addMonths(k,-1),id); yv=carried(o,E.addMonths(k,-12),id); } return {prev:isNum(pv)?+pv:null, ly:isNum(yv)?+yv:null, pk:E.addMonths(k,-1), yk:E.addMonths(k,-12)}; }
function warnFor(o,k,id,v){ if(!isNum(v)) return ''; v=+v; var c=cmpVals(o,k,id), f=field(id); if(f.kind==='percent' && (v<0||v>100)) return 'A percentage must be between 0 and 100.'; if(v<0) return 'Must be zero or more.'; var ref=c.ly!=null&&c.ly>0?c.ly:(c.prev!=null&&c.prev>0?c.prev:null); var refK=c.ly!=null&&c.ly>0?c.yk:c.pk; if(ref==null||f.freq==='S') return ''; var ch=(v-ref)/ref*100; if(Math.abs(ch)>35) return fmt(Math.abs(ch),0)+'% '+(ch>0?'higher':'lower')+' than '+mLabel(refK)+' ('+fmtF(f,ref)+' '+f.unit+'). Please check before submitting.'; return ''; }

function docOpenBtn(d){ return d.key ? '<button class="btn btn-ghost btn-sm" type="button" data-act="ev-open" data-key="'+esc(d.key)+'" style="color:var(--ink)">Open</button>' : '<span class="small muted">demo, not stored</span>'; }
function inboxList(r,opts){
  opts=opts||{}; var docs=(r.inbox||[]).slice().sort(function(a,b){ return a.at<b.at?-1:1; });
  if(!docs.length) return '<p class="sec-s" style="margin:6px 0 0">No documents yet.</p>';
  return '<div class="tbl-wrap" style="margin-top:10px"><table class="tbl compact"><thead><tr><th>Document</th><th>About</th><th>Sent</th><th>By</th><th></th></tr></thead><tbody>'
    + docs.map(function(d){ return '<tr><td><b style="font-weight:600">'+esc(d.name)+'</b>'+(d.size?'<div class="small muted">'+fmt(Math.max(1,d.size/1024),0)+' KB</div>':'')+'</td><td>'+esc(d.cat&&D.CAT[d.cat]?D.CAT[d.cat].short:'Not sure')+(d.siteName?' · '+esc(d.siteName):'')+'</td><td>'+longDate(d.at)+'</td><td>'+esc(d.by||'')+'</td><td>'+docOpenBtn(d)+'</td></tr>'; }).join('')
    + '</tbody></table></div>';
}

/* Yarta data entry: every open month across customers */
function vEntryQueue(){
  var q=entryQueue();
  var starts=Object.keys(state.orgs).map(function(id){ var o=state.orgs[id], ns=nextStartable(o); return ns?{org:id,month:ns}:null; }).filter(Boolean);
  function tr(x){ var o=state.orgs[x.org], r=x.rec, pr=progressOf(o,r); return '<tr><td><b>'+esc(o.profile.org_name)+'</b><div class="small muted">'+esc(o.profile.org_type)+' · '+esc(o.profile.state)+'</div></td><td>'+mLabel(r.month)+'</td><td>'+statusChip(r.status)+'</td><td class="num">'+((r.inbox||[]).length)+'</td><td class="num">'+pr.req+' / '+pr.reqDue+'</td><td>'+longDate(dueDate(r.month))+'</td><td><a class="btn btn-primary btn-sm" href="#/entry/'+x.org+'/'+r.month+'">Enter figures</a></td></tr>'; }
  var sent=[]; Object.keys(state.orgs).forEach(function(id){ state.orgs[id].records.forEach(function(r){ if(r.status==='submitted') sent.push({org:id,rec:r}); }); });
  var body='<div class="pg-head"><div><p class="kicker">Yarta team</p><h1>Data entry</h1><p class="pg-sub">Customers send their bills, dockets and registers. Yarta keys every figure from them, attaches the evidence and sends the month to a second analyst to verify. Documents are due by the 15th of the following month.</p></div></div>'
    + (q.length?'<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Organisation</th><th>Month</th><th>Status</th><th class="r">Documents</th><th class="r">Required figures</th><th>Documents due</th><th></th></tr></thead><tbody>'+q.map(tr).join('')+'</tbody></table></div>':'<div class="empty">No months are open for data entry.</div>')
    + (starts.length?'<h2 class="sec-t" style="margin-top:28px">Start a month</h2><p class="sec-s">Open the next month for a customer when their documents arrive by email or they upload them.</p><div class="pill-row">'+starts.map(function(x){ return '<button class="btn btn-ghost btn-sm" type="button" data-act="start-month" data-org="'+x.org+'" data-month="'+x.month+'" style="color:var(--ink)">'+esc(state.orgs[x.org].profile.org_name)+' · '+mLabel(x.month)+'</button>'; }).join('')+'</div>':'')
    + (sent.length?'<h2 class="sec-t" style="margin-top:28px">With verification</h2><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Organisation</th><th>Month</th><th>Entered by</th><th>Entered</th></tr></thead><tbody>'+sent.map(function(x){ return '<tr><td>'+esc(state.orgs[x.org].profile.org_name)+'</td><td>'+mLabel(x.rec.month)+'</td><td>'+esc(x.rec.enteredBy||'')+'</td><td>'+longDate(x.rec.enteredAt||x.rec.submittedAt)+'</td></tr>'; }).join('')+'</tbody></table></div>':'');
  return shell('entry', body);
}

function vSubmit(k,q){
  var o=org(), r=rec(o,k); if(!r) return vNotFound();
  var editable = isOp() && (r.status==='draft'||r.status==='returned');
  var due=dueFields(o,k), dueIds={}; due.forEach(function(f){ dueIds[f.id]=1; });
  var cats=D.CATEGORIES.filter(function(c){ return c.k!=='carbon'; });
  var pr=progressOf(o,r);
  var base='#/entry/'+o.id+'/'+k;
  SITE = multisite(o) ? currentSite(o) : null; var vv = SITE ? svals(r,SITE) : r.values;
  var cur=q.c && D.CAT[q.c] ? q.c : null;
  if(!cur){ cur = (cats.filter(function(c){ return pr.missing.some(function(f){ return f.cat===c.k; }); })[0]||cats[0]).k; }
  var catNav = cats.map(function(c){ var fs=due.filter(function(f){ return f.cat===c.k; }); var rq=fs.filter(function(f){ return f.req; }); var ok=rq.filter(function(f){ return isNum(vv[f.id]); }).length; var done = rq.length ? ok===rq.length : fs.some(function(f){ return vv[f.id]!==undefined&&vv[f.id]!==''; }); return '<a href="'+base+'?c='+c.k+(SITE?'&s='+SITE:'')+'" aria-current="'+(c.k===cur)+'"><span>'+esc(c.short)+'</span><span class="c'+(done?' ok':'')+'" data-cc="'+c.k+'">'+(rq.length?ok+'/'+rq.length:(done?'✓':fs.length))+'</span></a>'; }).join('');
  // field groups for the current category
  var inCat=D.INPUTS.filter(function(f){ return f.cat===cur; });
  var groups=[['M','This month'],['Q','This quarter'],['A','This year'],['S','Registers · confirm or update when something changes']];
  var form = groups.map(function(g){
    var fs=inCat.filter(function(f){ return f.freq===g[0] && (g[0]==='S' || dueIds[f.id]); });
    if(!fs.length) return '';
    return '<div class="fgroup"><h4>'+esc(g[1])+'</h4>'+fs.map(function(f){ return fieldRow(o,r,k,f,editable,dueIds); }).join('')+'</div>';
  }).join('');
  if(!form) form='<p class="sec-s">Nothing in this category is due for '+mLabel(k)+'. Quarterly figures are reported in September, December, March and June; annual figures in June.</p>';
  var ev=(r.evidence||{})[cur];
  var catDocs=(r.inbox||[]).filter(function(d){ return !d.cat || d.cat===cur; });
  var pick = editable && (r.inbox||[]).length ? '<select class="gsel" data-act="ev-pick" data-cat="'+cur+'" aria-label="Use a document the customer sent"><option value="">Use a customer document…</option>'+(r.inbox||[]).map(function(d,i){ return '<option value="'+i+'"'+(catDocs.indexOf(d)>=0?'':' ')+'>'+esc(d.name)+'</option>'; }).join('')+'</select>' : '';
  var evBox = '<div class="ev" data-drop="'+cur+'"><div class="t">'+(ev?'<b>'+esc(ev.name)+'</b>'+(ev.size?fmt(Math.max(1,ev.size/1024),0)+' KB · ':'')+(ev.grade?'Graded '+esc(ev.grade):'Grade given at verification'):'<b>Evidence for '+esc(D.CAT[cur].name)+'</b>Attach the bill, docket, statement or register extract behind these figures, or pick one the customer sent.')+'</div>'
    + (editable?'<div class="btn-row">'+pick+'<label class="btn btn-ghost btn-sm" style="color:var(--ink)">'+(ev?'Replace file':'Attach file')+'<input type="file" data-act="ev-file" data-cat="'+cur+'" accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls,.doc,.docx,.txt"></label>'+(ev?'<button class="btn btn-ghost btn-sm" type="button" data-act="ev-remove" data-cat="'+cur+'" style="color:var(--ink)">Remove</button>':'')+'</div>':(ev&&!ev.demo?'<button class="btn btn-ghost btn-sm" type="button" data-act="ev-open" data-key="'+esc(ev.key||evKey(o.id,k,cur))+'" style="color:var(--ink)">Open file</button>':''))
    + '</div>';
  var returned = r.status==='returned' && r.notes && r.notes.length ? '<div class="note-box" style="margin-bottom:16px"><b>Returned by '+esc(r.notes[r.notes.length-1].by||'verification')+' on '+longDate(r.notes[r.notes.length-1].at)+':</b> '+esc(r.notes[r.notes.length-1].text)+'</div>' : '';
  var docsPanel = '<div class="panel" style="margin-bottom:18px"><h3>Documents from '+esc(o.profile.org_name)+'</h3>'+inboxList(r)+'</div>';
  var head='<div class="pg-head"><div><p class="kicker"><a class="link" href="#/ops/entry">Data entry</a> · '+statusChip(r.status)+'</p><h1>'+esc(o.profile.org_name)+' · '+mLabel(k)+'</h1><p class="pg-sub">Documents due '+longDate(dueDate(k))+(r.enteredAt&&r.status!=='draft'?' · entered '+longDate(r.enteredAt)+(r.enteredBy?' by '+esc(r.enteredBy):''):'')+(r.verifiedAt?' · verified '+longDate(r.verifiedAt)+(r.verifiedBy?' by '+esc(r.verifiedBy):''):'')+'</p></div>'
    + '<div class="pg-actions" style="min-width:260px;display:block"><div class="small"><b id="prog-t">'+pr.req+' of '+pr.reqDue+'</b> required figures entered</div><div class="progress"><i id="prog-b" style="width:'+(pr.reqDue?pr.req/pr.reqDue*100:0)+'%"></i></div><div class="small muted" style="margin-top:6px" id="saved">'+(editable?'Saved in this browser as you type':'Read-only')+'</div></div></div>';
  var submitBox='';
  if(editable){
    var miss=pr.missing;
    submitBox = '<div class="panel" style="margin-top:22px" id="submit-box">'+(ui.confirmSubmit
      ? '<h3>Send '+mLabel(k)+' for verification</h3>'+(miss.length?'<p class="sec-s" style="margin-top:6px">'+miss.length+' required figure'+(miss.length>1?'s are':' is')+' still missing:</p><ul class="missing">'+miss.slice(0,12).map(function(f){ return '<li><a class="link" href="'+base+'?c='+f.cat+'">'+esc(f.name)+'</a> <span class="muted">('+esc(D.CAT[f.cat].short)+')</span></li>'; }).join('')+(miss.length>12?'<li>and '+(miss.length-12)+' more</li>':'')+'</ul>':'<p class="sec-s" style="margin-top:6px">All '+pr.reqDue+' required figures are in. Evidence attached for '+Object.keys(r.evidence||{}).length+' of '+cats.length+' categories.</p><label style="display:flex;gap:10px;align-items:flex-start;font-size:14.5px;margin:12px 0 16px"><input type="checkbox" id="attest" style="margin-top:4px"> <span>I entered these figures from the customer\'s documents and attached the evidence for each category. A different analyst will verify them.</span></label><div class="btn-row"><button class="btn btn-primary" type="button" data-act="submit-month" data-month="'+k+'">Send for verification</button><button class="btn btn-ghost" type="button" data-act="submit-cancel" style="color:var(--ink)">Not yet</button></div>')
      : '<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center"><div><h3>Finished keying?</h3><p class="sec-s" style="margin:6px 0 0">A second analyst checks every figure against the documents, grades the evidence and verifies the month. The customer sees '+mLabel(k)+' once it is verified.</p></div><button class="btn btn-primary" type="button" data-act="submit-ask">Check and send</button></div>')+'</div>';
  }
  var body = head + returned + docsPanel + siteTabs(o,r,base,SITE) + '<div class="subm"><nav class="catnav" aria-label="Categories">'+catNav+'</nav><div><div class="panel"><h2 class="sec-t">'+esc(D.CAT[cur].name)+'</h2><p class="sec-s">'+esc(D.CAT[cur].what)+'</p>'+declBox(o,r,k,cur,editable)+form+evBox+'</div>'+submitBox+'</div><aside class="calc"><div class="panel-dark" id="calc">'+calcPanel(o,r,k)+'</div></aside></div>';
  return shell('entry', body);
}

/* customer: send documents to Yarta */
function vDocuments(){
  var o=org(), now=nowKey();
  var rsD=sorted(o), nextK=rsD.length?E.addMonths(rsD[rsD.length-1].month,1):E.addMonths(now,-1), openD=rsD.filter(function(r){ return r.status==='draft'||r.status==='returned'; });
  var first = openD.length ? openD[openD.length-1].month : (nextK<=now ? nextK : E.addMonths(now,-1));
  var months=[first]; [now, E.addMonths(now,-1), E.addMonths(now,-2), E.addMonths(now,-3)].forEach(function(k){ if(months.indexOf(k)<0) months.push(k); });
  var opts=months.map(function(k){ var r=rec(o,k); return '<option value="'+k+'">'+mLabel(k)+(r&&r.status==='verified'?' · already verified':r&&r.status==='submitted'?' · already entered':'')+'</option>'; }).join('');
  var cats='<option value="">Not sure</option>'+D.CATEGORIES.filter(function(c){ return c.k!=='carbon'; }).map(function(c){ return '<option value="'+c.k+'">'+esc(c.name)+'</option>'; }).join('');
  var withDocsAll=sorted(o).slice().reverse().filter(function(r){ return (r.inbox||[]).length; }), withDocs=withDocsAll.slice(0,3);
  var list=withDocs.map(function(r){ var st=r.status==='verified'?'Entered and verified by Yarta':r.status==='submitted'?'Entered by Yarta, awaiting verification':'With Yarta for entry'; return '<div class="panel" style="margin-top:14px"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:center"><h3>'+mLabel(r.month)+'</h3>'+statusChip(r.status)+'</div><p class="sec-s" style="margin:6px 0 0">'+st+'</p>'+inboxList(r)+'</div>'; }).join('');
  var intro = isOp() ? 'Documents '+esc(o.profile.org_name)+' has sent. Upload anything that arrived by email so it sits with the month for data entry.' : 'Send the month\'s bills, dockets, statements and registers. Yarta enters every figure from them; you never key numbers yourself. Documents are due by the 15th of the following month. You can also email them to <a class="link" href="mailto:contact@yes.com.au">contact@yes.com.au</a>.';
  var body='<div class="pg-head"><div><p class="kicker">Documents</p><h1>'+(isOp()?'Customer documents':'Send documents')+'</h1><p class="pg-sub">'+intro+'</p></div></div>'
    + '<div class="panel"><h3>Upload</h3><div class="inline-form" style="margin-top:14px"><div class="field"><label for="up-m">Month</label><select id="up-m">'+opts+'</select></div><div class="field"><label for="up-c">What is it about?</label><select id="up-c">'+cats+'</select></div>'+siteSel(o)+'<label class="btn btn-primary">Choose files<input type="file" data-act="inbox-file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls,.doc,.docx,.txt" style="display:none"></label></div><p class="small muted" style="margin:12px 0 0">PDF, images, spreadsheets or documents, up to 15 MB each. In this prototype files stay in this browser.</p></div>'
    + (isOp()?'':declarePanel(o,months.filter(function(k){ var r=rec(o,k); return !r||r.status==='draft'||r.status==='returned'; })))
    + '<p class="small" style="margin-top:14px"><a class="link" href="#/checklist">What to send: the checklist for your sector</a></p><h2 class="sec-t" style="margin-top:28px">Sent so far</h2>'+(list||'<div class="empty">Nothing sent yet.</div>')+(withDocsAll.length>3?'<p class="small muted" style="margin-top:14px">Showing the latest three months. Every earlier document is kept with its month.</p>':'');
  return shell('documents', body);
}

function fieldRow(o,r,k,f,editable,dueIds){
  var raw=(SITE?svals(r,SITE):r.values)[f.id], isS=f.freq==='S', carriedV=isS?carried(o,E.addMonths(k,-1),f.id):null;
  var shown = raw!==undefined&&raw!=='' ? raw : (isS&&carriedV!=null?carriedV:'');
  var c=cmpVals(o,k,f.id), w=editable?warnFor(o,k,f.id,raw):'';
  var hint = isS ? (carriedV!=null?'Register value carried from earlier months. Change it only if it changed in '+mLabel(k)+'.':'Set once; confirm when it changes.') : [c.prev!=null?mShort(c.pk)+': '+fmtF(f,c.prev)+' '+f.unit:'', c.ly!=null?mShort(c.yk)+': '+fmtF(f,c.ly)+' '+f.unit:''].filter(Boolean).join(' · ');
  var input;
  if(f.kind==='select'){ input='<select id="f-'+f.id+'" data-field="'+f.id+'"'+(editable?'':' disabled')+'><option value="">Select</option>'+(f.options||[]).map(function(op){ return '<option'+(String(shown)===op?' selected':'')+'>'+esc(op)+'</option>'; }).join('')+'</select>'; }
  else if(f.kind==='text'){ input='<input type="text" id="f-'+f.id+'" data-field="'+f.id+'" value="'+esc(shown)+'"'+(editable?'':' disabled')+' placeholder="Type and quantity">'; }
  else { input='<div class="in-unit"><input type="number" inputmode="decimal" step="any" min="0"'+(f.kind==='percent'?' max="100"':'')+' id="f-'+f.id+'" data-field="'+f.id+'" value="'+esc(shown)+'"'+(editable?'':' disabled')+(w?' class="bad"':'')+'><span class="u">'+esc(f.unit)+'</span></div>'; }
  return '<div class="frow'+(editable?'':' locked')+'"><div><label class="fl" for="f-'+f.id+'">'+esc(f.name)+(f.req&&(!isS||dueIds[f.id])?' <span class="req" title="Required">*</span>':'')+'</label><div class="fd">'+esc(f.def)+'</div><div class="fs">'+esc(f.src)+'</div></div><div>'+input+'<div class="fh">'+esc(hint)+'</div><div class="warn" data-warn="'+f.id+'">'+esc(w)+'</div></div></div>';
}

function calcPanel(o,r,k){
  var v=withCarry(o,k,(SITE?svals(r,SITE):r.values)||{}); var m=E.month(v,o.profile);
  function ln(l,val){ return '<div class="ln"><span>'+l+'</span><b>'+val+'</b></div>'; }
  var prev=null; var S=seriesOf(o); var pm=monthOf(S,E.addMonths(k,-1)); if(pm&&pm.month===E.addMonths(k,-1)) prev=pm;
  return '<p class="kicker">Yarta calculates · '+mShort(k)+'</p><div class="big">'+fmt(m.total_t,1)+'</div><div class="small" style="color:var(--silver-4)">t CO₂-e this month'+(prev?' · '+mShort(prev.month)+': '+fmt(prev.total_t,1):'')+'</div><div style="margin-top:14px">'
    + ln('Scope 1 · fuel and gas',fmt(m.scope1_t,1)+' t')
    + ln('Scope 2 · grid electricity',fmt(m.scope2_t,1)+' t')
    + ln('Scope 3 · landfill and upstream',fmt(m.scope3_t,1)+' t')
    + ln('Renewable electricity',pct(m.renew_pct,1))
    + ln('Fleet electrification',pct(m.fleet_ev_pct,1))
    + ln('Fuel efficiency',m.fleet_eff==null?'—':fmt(m.fleet_eff,1)+' L/100 km')
    + ln('Landfill diversion',pct(m.diversion_pct,1))
    + ln('Resource recovery',pct(m.recovery_pct,1))
    + ln('Alternative water',pct(m.alt_water_pct,1))
    + ln('Avoided emissions (separate)',fmt(m.avoided_t,1)+' t')
    + '</div><p class="cap">National Greenhouse Accounts Factors 2024, '+esc(o.profile.state)+' electricity. Flights recorded, not yet in totals. Avoided emissions are a modelled estimate, never deducted.</p>';
}

/* ------------------------------------------------------------------ reports */
function vReports(){ var h=vReports0(); return h.replace(/<\/div><\/main><\/div>$/, periodPanel()+'</div></main></div>'); }
function vReports0(){
  var o=org(), S=seriesOf(o);
  var rows=S.months.slice().reverse().map(function(m){ var r=rec(o,m.month); return '<tr><td><a class="rowlink" href="#/report/'+m.month+'">'+mLabel(m.month)+'</a></td><td>'+statusChip(m.status)+'</td><td class="num"><b>'+(m.score==null?'—':m.score)+'</b></td><td>'+esc(m.band)+'</td><td class="num">'+(m.yoy==null?'—':sgn(m.yoy))+'</td><td class="num">'+fmt(m.total_t,0)+'</td><td class="num">'+pct(m.complete_pct)+'</td><td class="num">'+pct(m.evidence_pct)+'</td><td><a class="btn btn-ghost btn-sm" style="color:var(--ink)" href="#/report/'+m.month+'">Open</a></td></tr>'; }).join('');
  var body='<div class="pg-head"><div><p class="kicker">Reports</p><h1>Monthly reports</h1><p class="pg-sub">One report a month: the Yindyamarra Environmental Score, ten category scores, the direction of travel and the figures behind them. Print or save any report as a PDF.</p></div></div>'
    + '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Month</th><th>Status</th><th class="r">Score</th><th>Band</th><th class="r">Year on year</th><th class="r">Emissions t CO₂-e</th><th class="r">Complete</th><th class="r">Evidence</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  return shell('reports', body);
}

/* ------------------------------------------------------------------ report page 1: the cover
   Measure and understand: the score, where you could be, four headline figures, the ten categories,
   the figures at real-world scale and progress towards targets. The ethos runs across the top of every page:
   measure, understand, report, improve. */
var RP_STEPS=[['measure','Measure'],['understand','Understand'],['report','Report'],['improve','Improve']];
function rpSteps(on){ return '<div class="rp-steps" aria-label="Measure, understand, report, improve">'+RP_STEPS.map(function(x){ return '<span'+(on.indexOf(x[0])>=0?' class="on"':'')+'>'+x[1]+'</span>'; }).join('<i></i>')+'</div>'; }
var RP_ICON={
  waste:'<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>',
  carbon:'<svg viewBox="0 0 24 24"><path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 11.6 3.3 3.3 0 0 0 7 18z"/></svg>',
  energy:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
  water:'<svg viewBox="0 0 24 24"><path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/></svg>',
  leaf:'<svg viewBox="0 0 24 24"><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l8-8"/></svg>',
  people:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19a6 6 0 0 1 12 0M14 19a4.5 4.5 0 0 1 7 0"/></svg>',
  pool:'<svg viewBox="0 0 24 24"><path d="M3 15c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0M3 19c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0M8 12V5a2 2 0 0 1 4 0M13 12V5a2 2 0 0 1 4 0"/></svg>',
  scale:'<svg viewBox="0 0 24 24"><path d="M12 3v18M4 7h16M6 7l-3 7a3.5 3.5 0 0 0 7 0L7 7M18 7l-3 7a3.5 3.5 0 0 0 7 0l-3-7M8 21h8"/></svg>'
};
function rpIco(k){ return '<span class="rp-ico">'+(RP_ICON[k]||'')+'</span>'; }
/* change against the same calendar months of the baseline year */
function rpChg(cur,base,lowerBetter){
  if(cur==null||base==null||!(base>0)) return '<span class="rp-chg flat">baseline year</span>';
  var c=(cur-base)/base*100, good=lowerBetter?c<0:c>0, cls=Math.abs(c)<0.5?'flat':good?'good':'bad';
  return '<span class="rp-chg '+cls+'">'+(c>0.5?'▲':c<-0.5?'▼':'■')+' '+sgn(c,0)+'%</span><span class="rp-vs">vs baseline months</span>';
}
/* true while the report month still sits inside the baseline financial year (July to June): there is nothing earlier to compare with */
function inBaselineFY(S,p,k){ var fy=String(S.baseline.fy||p.baseline_fy||''), y0=parseInt(fy.slice(0,4),10); if(!y0) return false; var d=E.parse(k), n=d.y*12+d.m; return n>=y0*12+6 && n<=(y0+1)*12+5; }
/* the brand on the report cover: a page can override window.REPORT_BRAND before portal.js loads */
/* industry benchmarks: published figures for the organisation's sector, never other customers' data (benchmarks.js) */
function benchFor(p){ return (window.YESB && p) ? window.YESB.forSector(p.sector||'business') : null; }
function benchTable(p,tg,BM){
  if(!BM) return '';
  var Bx=window.YESB, rows='', codes={}, n=0;
  function code(c){ if(!codes[c]){ n++; codes[c]=n; } return codes[c]; }
  tg.forEach(function(t){ var b=BM[t.k]; if(!b) return; rows+='<tr><td>'+esc(t.name)+'</td><td class="num">'+(t.actual==null?'—':pct(t.actual,0))+'</td><td class="num">'+pct(b.v,0)+'</td><td class="small">'+esc(b.label)+' <span class="muted">['+code(b.src)+']</span></td></tr>'; });
  BM.extra.slice(0,4).forEach(function(x){ rows+='<tr><td>'+esc(x.k)+'</td><td class="num muted">—</td><td class="num">'+esc(x.v)+'</td><td class="small">'+esc(x.label)+' <span class="muted">['+code(x.src)+']</span></td></tr>'; });
  var srcs=Object.keys(codes).sort(function(a,b){ return codes[a]-codes[b]; }).map(function(c){ return '['+codes[c]+'] '+esc(Bx.src(c)); }).join(' · ');
  return '<div class="rp-h">Industry benchmarks · published figures for your sector</div><div class="rp-tw"><table class="tbl compact"><thead><tr><th>Figure</th><th class="r">You</th><th class="r">Benchmark</th><th>What the benchmark is</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
    + '<p class="rp-bmnote">'+esc(BM.edition)+'. '+(BM.none?esc(BM.none)+' ':'')+'Benchmarks come from public sources only; Yarta never pools customer data. Sources: '+srcs+'.</p>';
}
var RB=window.REPORT_BRAND||{mark:'<span class="mark">Yarta</span>', full:'Yindyamarra Environmental Sustainability', score:'Yindyamarra Environmental Score', title:'Environmental<br>Sustainability Report'};
function sheetCover(o,S,i,PL,k,nP,provTxt,issuedTxt){
  var m=S.months[i], R12=m.r12, B=R12.base||{}, p=o.profile, T=S.targets, ly=S.months[i-12]||null;
  if(inBaselineFY(S,p,k)) B={};
  var tg=E.targets({months:S.months.slice(0,i+1), targets:T, baseline:S.baseline});
  var divT=Math.max(0,(R12.waste_total_t||0)-(R12.landfill_t||0)), divB=Math.max(0,(B.waste_total_t||0)-(B.landfill_t||0));
  var per = p.beds>0 ? {n:p.beds,l:'bed'} : p.students>0 ? {n:p.students,l:'student'} : p.vehicles>0 ? {n:p.vehicles,l:'vehicle'} : (p.org_type==='Council'&&p.residents>0) ? {n:p.residents,l:'resident'} : p.sites>1 ? {n:p.sites,l:'site'} : (p.employees>0 ? {n:p.employees,l:'employee'} : null);
  var sectorName = (window.YESS && p.sector && window.YESS.BY[p.sector]) ? window.YESS.BY[p.sector].one : '';
  var win = R12.n<12 ? R12.n+' months' : '12 months';
  var cards=[
    {ic:'waste',  k:'Waste & Resource Recovery', v:fmt(divT,0), u:'tonnes diverted from landfill', s:'Diversion '+pct(R12.diversion_pct,0)+' · target '+pct(T.target_diversion,0), c:rpChg(divT,divB,false)},
    {ic:'carbon', k:'Carbon & Emissions', v:fmt(R12.total_t,0), u:'t CO₂-e operational emissions', s:'Scope 1, 2 and 3 · '+fmt(R12.avoided_t,0)+' t avoided, reported separately', c:rpChg(R12.total_t,B.total_t,true)},
    {ic:'energy', k:'Energy & Renewables', v:fmt((R12.grid_kwh||0)/1000,0), u:'MWh of grid electricity', s:'Renewable '+pct(R12.renew_pct,0)+' of use · target '+pct(T.target_renewable,0), c:rpChg(R12.grid_kwh,B.grid_kwh,true)},
    {ic:'water',  k:'Water', v:fmt(R12.potable_kl,0), u:'kL of drinking water used', s:'Alternative water '+pct(R12.alt_water_pct,0)+' of all water', c:rpChg(R12.potable_kl,B.potable_kl,true)}
  ];
  var cardsH=cards.map(function(c){ return '<div class="rp-card">'+rpIco(c.ic)+'<div class="rp-card-k">'+esc(c.k)+'</div><div class="rp-card-v">'+c.v+'</div><div class="rp-card-u">'+esc(c.u)+'</div><div class="rp-card-c">'+c.c+'</div><div class="rp-card-s">'+esc(c.s)+'</div></div>'; }).join('');
  /* real-world scale: the organisation's own figures against things people can picture; the only external factor is the volume of an Olympic pool */
  var scale=[];
  if(per && divT>0) scale.push({ic:'scale', v:fmt(divT*1000/per.n,0)+' kg', t:'of waste diverted from landfill for every '+per.l});
  if(R12.potable_kl>0){ var pools=R12.potable_kl/2500; scale.push({ic:'pool', v:fmt(pools,pools<10?1:0), t:'Olympic swimming pools of drinking water (2,500 kL each)'}); }
  if(B.total_t>0 && R12.total_t!=null){ var d=B.total_t-R12.total_t; scale.push({ic:'carbon', v:fmt(Math.abs(d),0)+' t CO₂-e', t:(d>=0?'less':'more')+' than the same months of the baseline year ('+esc(S.baseline.fy||p.baseline_fy)+')'}); }
  if(R12.trees>0||R12.native_ha>0) scale.push({ic:'leaf', v:fmt(R12.trees,0)+' trees', t:'planted, and '+fmt(R12.native_ha,1)+' ha of native vegetation, habitat or wetland restored'});
  if(per && R12.total_t>0) scale.push({ic:'carbon', v:fmt(R12.total_t*1000/per.n,0)+' kg CO₂-e', t:'of operational emissions for every '+per.l});
  if(R12.participants>0) scale.push({ic:'people', v:fmt(R12.participants,0)+' people', t:'took part in environment programs'});
  if(m.r12.n && R12.treated_t>0) scale.push({ic:'scale', v:fmt(R12.treated_t,0)+' t', t:'of clinical and related waste sent for treatment, counted in the total but never as recovered'});
  var scaleH=scale.slice(0,6).map(function(x){ return '<div class="rp-sc">'+rpIco(x.ic)+'<div><b>'+x.v+'</b> '+esc(x.t)+'</div></div>'; }).join('') || '<p class="rp-p muted">No figures yet.</p>';
  var subs=D.CATEGORIES.map(function(c){ var v=m.scores[c.k]; return '<div class="rp-sub"><span>'+esc(c.name)+(m.prov[c.k]?' <span class="muted">(P)</span>':'')+'</span><span class="v">'+(v==null?'—':Math.round(v))+'</span><span class="d">'+(v==null?'<span class="muted small">not reported</span>':delta(m.cat_yoy[c.k]))+'</span><div class="bar"><i style="width:'+(v||0)+'%"></i></div></div>'; }).join('');
  var BM=benchFor(p);
  var tgH=tg.map(function(t){ var w=(t.actual==null||!(t.target>0))?0:Math.max(0,Math.min(100,t.actual/t.target*100)); var met=t.actual!=null&&t.actual>=t.target; var b=BM&&BM[t.k]; var bw=(b&&t.target>0)?Math.max(0,Math.min(100,b.v/t.target*100)):null; return '<div class="rp-tg'+(met?' met':'')+'"><span class="n">'+esc(t.name)+(b?' <span class="muted">· industry '+pct(b.v,0)+'</span>':'')+'</span><span class="r">'+(t.actual==null?'—':pct(t.actual,0))+' <span class="muted">of '+pct(t.target,0)+'</span></span><div class="bar"><i style="width:'+w.toFixed(0)+'%"></i>'+(bw==null?'':'<b class="bm" style="left:'+bw.toFixed(0)+'%" title="Industry benchmark"></b>')+'</div></div>'; }).join('');
  var photo = p.country_photo ? ' style="background-image:linear-gradient(90deg,rgba(11,40,24,.96) 0%,rgba(11,40,24,.78) 55%,rgba(11,40,24,.35) 100%),url('+esc(p.country_photo)+')"' : '';
  var wyc = PL ? '<div class="rp-wyc"><div><span class="k">Now</span><b>'+(PL.now==null?'—':PL.now)+'</b></div><div><span class="k">At the eco standards</span><b>'+(PL.target==null?'—':PL.target)+'</b></div><div class="hl"><span class="k">With Yarta help</span><b>'+(PL.potential==null?'—':PL.potential)+'</b><span class="s">estimate · plan on page '+nP+'</span></div></div>' : '';
  return '<section class="rp-sheet rp-cover">'
    + '<div class="rp-band"'+photo+'><div class="rp-band-l"><div class="rp-brand">'+RB.mark+'<span class="full">'+RB.full+'</span></div>'
    + '<div class="rp-ethos">Measure. Understand. Report. Improve.</div><h1 class="rp-big">'+RB.title+'</h1><p class="rp-tag">Where '+esc(p.org_name)+' stands, verified figure by figure, and the ways to improve.</p></div>'
    + '<div class="rp-band-r"><div class="rp-kv light"><span>Organisation</span><b>'+esc(p.org_name)+'</b>'+(sectorName?'<span>Sector</span><b>'+esc(sectorName)+'</b>':'')+'<span>Month</span><b>'+mLabel(k)+'</b><span>Status</span><b>'+esc(provTxt)+'</b><span>Issued</span><b>'+(issuedTxt||longDate(new Date()))+'</b></div>'+(p.traditional_owners?'<div class="rp-country">On '+esc(p.traditional_owners)+' Country</div>':'')+'</div></div>'
    + (p.country_photo?'<div class="rp-photo-credit">Photo: '+esc(p.country_photo_credit||'supplied by the organisation and approved by Traditional Owners')+'</div>':'')
    + '<div class="rp-score">'+ring(m.score,150,true)+'<div class="rp-score-t"><p class="kicker">'+RB.score+' · '+esc(mLabel(k))+'</p><div class="band">'+esc(m.band)+'</div><div class="rp-score-d">'+(m.yoy==null?'':'<span>'+delta(m.yoy,{unit:' pts'})+' year on year'+(ly?' ('+esc(mLabel(ly.month))+')':'')+'</span>')+(m.mom==null?'':'<span>'+delta(m.mom,{unit:' pts'})+' month on month</span>')+'<span>'+m.scored+' of 10 categories scored</span></div></div>'+wyc+'</div>'
    + '<div class="rp-cards">'+cardsH+'</div>'
    + '<div class="rp-cols"><div><div class="rp-h">Category scores · change on last year</div><div class="rp-subs one">'+subs+'</div></div>'
    + '<div><div class="rp-h">At real-world scale · rolling '+win+'</div><div class="rp-scale">'+scaleH+'</div><div class="rp-h">Progress towards the eco standards · rolling '+win+'</div><div class="rp-tgs">'+tgH+'</div>'+(BM?'<p class="rp-bmnote">The mark on each bar is the published industry benchmark; figures and sources are on page 2. No other organisation\'s data is used.</p>':'')+'</div></div>'
    + '<div class="rp-foot">Headline figures are rolling '+win+' totals; the change is against the same calendar months of the baseline year'+(inBaselineFY(S,p,k)?' ('+esc(S.baseline.fy||p.baseline_fy)+' is the baseline year, so there is no earlier year to compare with yet)':'')+'. (P) provisional: a target-based category with less than 12 months of data.'+(operatorOf(o)?' Your Yarta data operator: '+esc(operatorOf(o).name)+'.':'')+' The score is self-declared under the published Yarta method v0.1 (draft); it is not an accredited rating, certification or offset. Page 1 of '+nP+'.</div></section>';
}

function vReport(k){
  var o=org(), S=seriesOf(o), m=monthOf(S,k); if(!m||m.month!==k) return vNotFound();
  var body='<div class="pg-head no-print"><div><p class="kicker"><a class="link" href="#/reports">Reports</a></p><h1>'+mLabel(k)+'</h1></div><div class="pg-actions"><button class="btn btn-ink btn-sm" type="button" data-act="print">Print or save as PDF</button><button class="btn btn-ghost btn-sm" type="button" data-act="csv-month" data-month="'+k+'" style="color:var(--ink)">Download figures (CSV)</button></div></div>'
    + '<div class="report">'+reportSheets(o,S,k)+'</div>';
  return shell('report', body);
}
/* the three A4 sheets of a monthly report, as HTML; also used by the standalone sample report page */
function reportSheets(o,S,k){
  var m=monthOf(S,k); if(!m||m.month!==k) return '';
  var i=idxOf(S,k), R12=m.r12, p=o.profile, r=rec(o,k), T=S.targets;
  var PL=planFor(o,S,i), nP=PL?3:2;
  var ly=S.months[i-12]||null, pm=S.months[i-1]||null;
  var pts=S.months.slice(Math.max(0,i-12),i+1).map(function(x){ return {label:mShort(x.month), v:x.score, prov:x.status!=='verified'}; });
  var provTxt = m.status==='verified' ? 'Verified by Yarta on '+longDate(r.verifiedAt) : 'Provisional · awaiting Yarta verification';
  var tg=E.targets({months:S.months.slice(0,i+1), targets:T, baseline:S.baseline});
  var subs=D.CATEGORIES.map(function(c){ var v=m.scores[c.k]; return '<div class="rp-sub"><span>'+esc(c.name)+(m.prov[c.k]?' <span class="muted">(P)</span>':'')+'</span><span class="v">'+(v==null?'—':Math.round(v))+'</span><span class="d">'+(v==null?'<span class="muted small">not reported</span>':delta(m.cat_yoy[c.k]))+'</span><div class="bar"><i style="width:'+(v||0)+'%"></i></div></div>'; }).join('');
  function kvrow(l,a,u,note){ return '<tr><td>'+esc(l)+'</td><td class="num">'+a+'</td><td>'+esc(u||'')+'</td><td class="small muted">'+(note||'')+'</td></tr>'; }
  var v=m.values;
  var issuedTxt = r.issuedAt ? longDate(r.issuedAt) : (r.status==='verified' ? 'Verified, not yet issued' : 'Draft');
  var sheet1 = sheetCover(o,S,i,PL,k,nP,provTxt,issuedTxt), BM2=benchFor(p);
  var sheet2 = '<section class="rp-sheet"><div class="rp-head"><div><div class="rp-title" style="font-size:22px">'+esc(p.org_name)+' · '+mLabel(k)+'</div>'+rpSteps(['understand'])+'</div><div class="rp-kv"><span>Report</span><b>Figures behind the score</b></div></div>'
    + '<div class="rp-h" style="margin-top:0">Emissions · t CO₂-e</div><div class="rp-tw"><table class="tbl compact"><thead><tr><th></th><th class="r">'+mShort(k)+'</th><th class="r">Rolling 12 months</th><th class="r">Baseline months</th></tr></thead><tbody>'
    + [['Scope 1 · fuel and gas','scope1_t'],['Scope 2 · grid electricity','scope2_t'],['Scope 3 · landfill and upstream','scope3_t'],['Total operational emissions','total_t']].map(function(x){ return '<tr><td>'+x[0]+'</td><td class="num">'+fmt(m[x[1]],1)+'</td><td class="num">'+fmt(R12[x[1]],0)+'</td><td class="num">'+fmt(R12.base[x[1]],0)+'</td></tr>'; }).join('')
    + '<tr><td>Avoided emissions · reported separately, never deducted</td><td class="num">'+fmt(m.avoided_t,1)+'</td><td class="num">'+fmt(R12.avoided_t,0)+'</td><td></td></tr></tbody></table></div>'
    + '<div class="rp-h">Key figures</div><div class="rp-tw"><table class="tbl compact"><thead><tr><th>Figure</th><th class="r">'+mShort(k)+'</th><th>Unit</th><th>Note</th></tr></thead><tbody>'
    + kvrow('Diesel purchased',fmt(v.diesel_l),'L') + kvrow('Petrol purchased',fmt(v.petrol_l),'L') + kvrow('Fleet kilometres',fmt(v.fleet_km),'km',m.fleet_eff==null?'':fmt(m.fleet_eff,1)+' L/100 km')
    + kvrow('Fleet electrification',pct(m.fleet_ev_pct,1),'',fmt(m.fleet_n)+' vehicles; plug-in hybrids count as half')
    + kvrow('Flights',fmt(m.flights),'trips','Recorded; emissions factor pending')
    + kvrow('Grid electricity',fmt(v.grid_kwh),'kWh') + kvrow('Renewable electricity',pct(m.renew_pct,1),'',pct(R12.renew_pct,1)+' over 12 months') + kvrow('Natural gas',fmt(v.gas_gj,1),'GJ')
    + kvrow('Potable water',fmt(v.potable_kl),'kL','Alternative water '+pct(m.alt_water_pct,1))
    + kvrow('Total waste',fmt(v.waste_total_t,1),'t','Landfill '+fmt(v.landfill_t,1)+' t') + kvrow('Landfill diversion',pct(m.diversion_pct,1),'','Recovery '+pct(m.recovery_pct,1))
    + kvrow('Trees planted',fmt(v.trees),'trees') + kvrow('Program participants',fmt(v.participants),'people')
    + '</tbody></table></div>'
    + benchTable(p,tg,BM2)
    + '<div class="rp-h">Data quality and evidence</div><div class="rp-tw"><table class="tbl compact"><tbody><tr><td>Required figures supplied</td><td class="num">'+pct(m.complete_pct)+'</td></tr><tr><td>Figures backed by evidence</td><td class="num">'+pct(m.evidence_pct)+'</td></tr><tr><td>Evidence grades</td><td>'+D.CATEGORIES.filter(function(c){return c.k!=='carbon';}).map(function(c){ var e=(r.evidence||{})[c.k]; return esc(c.short)+' '+(e?(e.grade||'…'):'—'); }).join(' · ')+'</td></tr></tbody></table></div>'
    + '<div class="rp-foot">Method: emissions use the National Greenhouse Accounts Factors 2024 (DCCEEW), location-based electricity for '+esc(p.state)+'. Scope 3 covers waste to landfill and upstream fuel and electricity only. Flights are recorded but not yet converted. Avoided emissions use NSW DECCW (2010) factors, flagged as dated, and are never netted against emissions. Comparisons with the baseline use the same calendar months of '+esc(S.baseline.fy||p.baseline_fy)+'. Figures are entered by Yarta from the organisation\'s source documents and verified by a second Yarta analyst. Full method: yes.com.au/method. Page 2 of '+nP+'.</div></section>';
  return sheet1+sheet2+(PL?sheet3(o,S,i,PL,k):'');
}

/* ------------------------------------------------------------------ recommended help, roadmap and bookings */
function orgBookings(id){ return (state.bookings||[]).filter(function(b){ return b.org===id; }); }
function bkById(id){ return (state.bookings||[]).filter(function(b){ return b.id===id; })[0]; }
/* work can start the month after the report month, and never before next month */
function anchorFor(k){ var a=E.addMonths(k,1), b=E.addMonths(nowKey(),1); return a>b?a:b; }
function planFor(o,S,i){ if(!R || i<0 || !S.months[i]) return null; o.plan=o.plan||{off:{}}; return R.plan(S,i,o.profile,{bookings:orgBookings(o.id), off:o.plan.off||{}, anchor:anchorFor(S.months[i].month)}); }
var BK_L={requested:'Requested',confirmed:'Confirmed',completed:'Done',cancelled:'Cancelled'};
function bookingChip(b){ return '<span class="st st-bk-'+esc(b.status)+'">'+(BK_L[b.status]||esc(b.status))+'</span>'; }
var DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function pad2(n){ return (n<10?'0':'')+n; }
function slotDate(v){ if(!v) return null; var p=v.split('T'), d=p[0].split('-'), t=(p[1]||'09:00').split(':'); return new Date(+d[0],+d[1]-1,+d[2],+t[0],+t[1]); }
function timeLabel(d){ var h=d.getHours(), mi=d.getMinutes(); return (h%12||12)+':'+pad2(mi)+' '+(h<12?'am':'pm'); }
function slotLabel(v,other){ if(!v) return other?'Time to be arranged':'—'; var d=slotDate(v); return DOW[d.getDay()]+' '+d.getDate()+' '+MONTHS[d.getMonth()].slice(0,3)+' '+d.getFullYear()+', '+timeLabel(d); }
function provOf(s){ return (R&&R.PROVIDERS[s.prov])||{label:'',note:''}; }
function upText(u){ if(!u) return ''; var parts=Object.keys(u.cats).sort(function(a,b){ return u.cats[b]-u.cats[a]; }).slice(0,2).map(function(k){ var v=u.cats[k]; return esc(D.CAT[k].short)+' '+sgn(v,Math.abs(v)<1?1:0); }); if(u.overall>=0.05) parts.push('Score '+sgn(u.overall,1)); return parts.join(' · '); }
function grpDot(s){ return s.prov==='group'?' <span class="grp-dot" title="Delivered by a Recycle Group business">●</span>':''; }
function itemName(it){ return esc(it.title)+grpDot(it.s); }
function quarterRows(P){ return P.quarters.filter(function(q,ix){ return q.starts.length||q.full.length||ix===P.quarters.length-1; }); }

function threeNums(P,m,cls){
  var n=P.active.filter(function(it){ return it.k!=='grants'; }).length, extra=[];
  if(P.emis.cut>=1) extra.push('about '+fmt(P.emis.cut,0)+' t CO₂-e a year less');
  if(P.landfill.cut>=1) extra.push(fmt(P.landfill.cut,0)+' t a year less to landfill');
  return '<div class="three'+(cls?' '+cls:'')+'">'
    + '<div class="tn"><span class="k">Now</span><b>'+(P.now==null?'—':P.now)+'</b><span class="s">'+esc(E.band(P.now))+' · '+esc(mLabel(m.month))+'</span></div>'
    + '<div class="tn"><span class="k">At the eco standards</span><b>'+(P.target==null?'—':P.target)+'</b><span class="s">The published standards, or your target where it is tighter</span></div>'
    + '<div class="tn hl"><span class="k">With Yarta help · estimate</span><b>'+(P.potential==null?'—':P.potential)+'</b><span class="s">'+n+' recommended item'+(n===1?'':'s')+(extra.length?' · '+extra.join(' · '):'')+'</span></div>'
    + '</div>';
}
function roadChart(S,i,P,o){
  o=o||{}; var phone=!o.print && window.innerWidth<700;
  var a=S.months.slice(Math.max(0,i-11),i+1).map(function(x){ return {label:mShort(x.month), v:x.score, prov:x.status!=='verified'}; });
  var pr=P.proj.map(function(p){ return {label:mShort(p.month), v:p.v}; });
  return lineChart(a.concat(pr),{split:a.length-1, refs:P.target!=null?[{v:P.target,label:'At the eco standards · '+P.target}]:[], label:'Score by month, with the projection', w:phone?420:720, h:phone?300:(o.h||230), dark:o.dark, maxLabels:phone?5:(o.maxLabels||10)});
}
function recCard(it){
  var s=it.s, pv=provOf(s), b=it.booking, up=upText(it.uplift);
  return '<article class="rec'+(s.prov==='group'?' grp':'')+'">'
    + '<p class="k">'+esc(s.cat?D.CAT[s.cat].name:'Funding')+'</p>'
    + '<h3>'+esc(it.title)+'</h3>'
    + '<p class="why">'+esc(it.why)+'</p>'
    + '<dl class="rec-dl"><dt>Estimated change</dt><dd>'+(up||esc(s.effectText))+'</dd><dt>Who</dt><dd>'+esc(pv.label)+(s.prov==='group'?' · disclosed on your report':'')+'</dd></dl>'
    + '<div class="rec-f">'+(b?bookingChip(b)+'<span class="small muted">'+esc(slotLabel(b.slot,b.other))+'</span>':'<a class="btn btn-primary btn-sm" href="#/improvements/'+s.k+'">Details and booking</a>')+'</div>'
    + '</article>';
}
function sinceText(S,b,i){
  var sn=R.since(S,b,i);
  if(sn && sn.from!=null && sn.now!=null) return esc(D.CAT[sn.cat].short)+' '+fmt(sn.from,0)+' → '+fmt(sn.now,0)+' ('+sgn(Math.round(sn.now)-Math.round(sn.from))+') since '+mShort(sn.month);
  return 'Shows as the months after '+(b.completedMonth?mShort(b.completedMonth):'the work')+' are verified';
}
function bookingRow(b,o,S,i){
  var s=R.byKey[b.svc]; if(!s) return '';
  var since = b.status==='completed' ? sinceText(S,b,i) : '—';
  var act = (b.status==='requested'||b.status==='confirmed') ? (ui.confirmCancel===b.id
      ? '<div class="pill-row"><button class="btn btn-ink btn-sm" type="button" data-act="bk-cancel-go" data-id="'+esc(b.id)+'">Yes, cancel</button><button class="btn btn-ghost btn-sm" type="button" data-act="bk-cancel-no" style="color:var(--ink)">Keep</button></div>'
      : '<button class="btn btn-ghost btn-sm" type="button" data-act="bk-cancel" data-id="'+esc(b.id)+'" style="color:var(--ink)">Cancel</button>') : '';
  return '<tr><td><b>'+esc(R.title(s,o.profile))+'</b>'+grpDot(s)+'<div class="small muted">'+esc(provOf(s).label)+(b.mode?' · '+esc(b.mode):'')+'</div></td><td>'+esc(b.status==='completed'&&b.completedMonth?'Done '+mLabel(b.completedMonth):slotLabel(b.slot,b.other))+'</td><td>'+bookingChip(b)+'</td><td class="small">'+since+'</td><td>'+act+'</td></tr>';
}

function vRoadmap(){
  var o=org(), S=seriesOf(o), m=monthOf(S);
  if(!m || !R) return shell('roadmap','<div class="pg-head"><div><p class="kicker">Roadmap and help</p><h1>Your roadmap</h1></div></div><div class="empty">Your roadmap appears once your first month is verified.</div>');
  var i=idxOf(S,m.month), P=planFor(o,S,i);
  var head='<div class="pg-head"><div><p class="kicker">Roadmap and help</p><h1>Your roadmap</h1><p class="pg-sub">Your score now, the score at the eco standards, and an estimate with the recommended help done. Based on your figures to '+mLabel(m.month)+(m.status!=='verified'?' (provisional: awaiting verification)':'')+'. The rules and assumptions are published in the <a class="link" href="../method/#help">method</a>.</p></div><div class="pg-actions"><a class="btn btn-ink btn-sm" href="#/report/'+m.month+'">Report with roadmap</a></div></div>';
  var top='<section class="panel-dark rm-top">'+threeNums(P,m,'dark')+'<div class="rm-chart">'+roadChart(S,i,P,{dark:true})+'</div><p class="rm-leg"><span class="lg-i"><span class="lg-l solid"></span>Your score by month</span><span class="lg-i"><span class="lg-l dash"></span>Projected with the plan below (estimate)</span><span class="lg-i"><span class="lg-l dot"></span>At the eco standards</span></p></section>';
  var rows=P.items.map(function(it){
    var s=it.s, b=it.booking, pv=provOf(s);
    var st = b ? bookingChip(b)+'<div class="small muted">'+esc(slotLabel(b.slot,b.other))+'</div>' : '<a class="btn btn-primary btn-sm" href="#/improvements/'+s.k+'">Details and booking</a>';
    return '<tr'+(it.off?' class="off"':'')+'><td class="tg"><label class="tgl" title="'+(b?'Booked items stay in the plan':'Include in the plan')+'"><input type="checkbox" data-act="plan-toggle" data-svc="'+s.k+'"'+(it.off?'':' checked')+(b?' disabled':'')+'><span class="vh">Include '+esc(it.title)+' in the plan</span></label></td>'
      + '<td><b>'+itemName(it)+'</b><div class="small muted">'+esc(pv.label)+' · '+esc(s.session)+'</div><div class="small why">'+esc(it.why)+'</div></td>'
      + '<td class="small">'+(upText(it.uplift)||esc(s.effectText))+'</td>'
      + '<td>'+(it.start?mShort(it.start):'<span class="muted">Not in plan</span>')+'</td>'
      + '<td>'+st+'</td></tr>';
  }).join('');
  var plan='<h2 class="sec-t" style="margin-top:28px">Recommended help</h2><p class="sec-s">Weakest category first. Untick an item to see the estimate without it. The estimated change is for each item on its own, once it has taken full effect.</p>'
    + (rows?'<div class="tbl-wrap"><table class="tbl compact plan"><thead><tr><th><span class="vh">Include</span></th><th>Help</th><th>Estimated change</th><th>Starts</th><th>Booking</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty">Nothing is recommended from your current figures.</div>');
  var qrows=quarterRows(P).map(function(q){ return '<tr><td><b>'+esc(q.label)+'</b></td><td>'+(q.starts.length?q.starts.map(function(it){ return itemName(it)+(it.booking?' <span class="muted small">('+(it.booking.status==='requested'?'requested':'booked')+')</span>':''); }).join('<br>'):'<span class="muted">—</span>')+'</td><td>'+(q.full.length?q.full.map(itemName).join('<br>'):'<span class="muted">—</span>')+'</td><td class="num"><b>'+(q.score==null?'—':q.score)+'</b></td></tr>'; }).join('');
  var qs='<h2 class="sec-t" style="margin-top:28px">Plan by quarter</h2><p class="sec-s">'+esc(R.ROADMAP_RULES)+'</p>'+(P.active.length?'<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Quarter</th><th>Starts</th><th>Full effect</th><th class="r">Projected score</th></tr></thead><tbody>'+qrows+'</tbody></table></div>':'<div class="empty">Nothing in the plan. Tick an item above to add it.</div>');
  var bl=orgBookings(o.id).slice().sort(function(a,b){ return (b.slot||b.createdAt||'')<(a.slot||a.createdAt||'')?-1:1; });
  var bk='<h2 class="sec-t" style="margin-top:28px">Your bookings and progress</h2>'+(bl.length?'<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Help</th><th>When</th><th>Status</th><th>Since then</th><th></th></tr></thead><tbody>'+bl.map(function(b){ return bookingRow(b,o,S,i); }).join('')+'</tbody></table></div><p class="small muted" style="margin-top:10px">Since then: the change in the category score from the month the work was done to your latest month. Other changes affect it too, so it does not show that the work caused it.</p>':'<div class="empty">No help booked yet.</div>');
  var ind='<div class="panel" style="margin-top:28px"><h3>How the recommendations stay independent</h3><ul class="plain">'+R.INDEPENDENCE.map(function(t){ return '<li><b>'+esc(t.k)+'.</b> '+esc(t.d)+'</li>'; }).join('')+'</ul></div>';
  return shell('roadmap', head+top+plan+qs+bk+ind);
}

function nextSlots(){ var out=[], d=new Date(); d.setHours(0,0,0,0); while(out.length<20){ d.setDate(d.getDate()+1); var w=d.getDay(); if(w===0||w===6) continue; var ds=d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); out.push(ds+'T09:00'); out.push(ds+'T13:30'); } return out; }
function slotTaken(v,svc,orgId){ return (state.bookings||[]).some(function(b){ return b.status!=='cancelled' && b.slot===v && (b.svc===svc || b.org===orgId); }); }
function vBook(key){
  var o=org(), s=R&&R.byKey[key]; if(!s) return vNotFound();
  var S=seriesOf(o), m=monthOf(S), i=m?idxOf(S,m.month):-1, r=m?R.recommend(S,i,o.profile).filter(function(x){ return x.k===key; })[0]:null;
  var u=me(), contact=u.role==='customer'?u:(state.users.filter(function(x){ return x.org===o.id; })[0]||{name:'',email:''});
  var open=orgBookings(o.id).filter(function(b){ return b.svc===key && (b.status==='requested'||b.status==='confirmed'); })[0];
  var slots=nextSlots().filter(function(v){ return !slotTaken(v,key,o.id); }), byDay={}, days=[];
  slots.forEach(function(v){ var d=v.slice(0,10); if(!byDay[d]){ byDay[d]=[]; days.push(d); } byDay[d].push(v); });
  var grid=days.map(function(d){ var dt=slotDate(d+'T09:00'); return '<div class="sday"><div class="sd">'+DOW[dt.getDay()]+' '+dt.getDate()+' '+MONTHS[dt.getMonth()].slice(0,3)+'</div>'+byDay[d].map(function(v){ return '<button type="button" class="slot" data-act="slot" data-slot="'+v+'" aria-pressed="false">'+timeLabel(slotDate(v))+'</button>'; }).join('')+'</div>'; }).join('');
  var pv=provOf(s), title=R.title(s,o.profile);
  var body='<div class="pg-head"><div><p class="kicker"><a class="link" href="#/improvements">Improvements</a> · '+esc(s.cat?D.CAT[s.cat].name:'Funding')+'</p><h1>'+esc(title)+'</h1><p class="pg-sub">'+esc(s.what)+'</p></div></div>'
    + (open?'<div class="banner grey"><span>You already have a '+esc(BK_L[open.status].toLowerCase())+' booking for this: <b>'+esc(slotLabel(open.slot,open.other))+'</b>.</span><a class="btn btn-ghost btn-sm" href="#/improvements" style="color:var(--ink)">See it</a></div>':'')
        + '<section class="panel imp-detail"><div class="imp-top"><div><p class="k">Estimated change</p><p class="imp-num">'+(r&&r.uplift&&r.uplift.overall>=0.05?'Score '+sgn(r.uplift.overall,1):(r?esc(upText(r.uplift)||s.effectText):'—'))+'</p>'+(r&&r.uplift&&r.uplift.overall>=0.05&&m?'<p class="small muted">from '+fmt(m.score,0)+' to about '+fmt(Math.min(100,m.score+r.uplift.overall),0)+', on its own, once it has taken full effect</p>':'<p class="small muted">Once it has taken full effect</p>')+'</div><div><p class="k">Why it is recommended</p><p>'+esc(r?r.why:'Your current figures do not call for this, but you can still book it.')+'</p></div></div>'
    + '<div class="imp-cols"><div><h3>What is involved</h3><p class="small">'+esc(s.what)+'</p><p class="small muted">'+esc(s.session)+'</p></div><div><h3>Who delivers it</h3><p class="small">'+esc(s.who)+'</p>'+(s.prov==='group'?'<p class="small muted">'+esc(s.groupNames)+(s.groupNames.indexOf(' and ')>0?' are':' is')+' part of Recycle Group, like Yarta. Disclosed on your monthly report.</p>':'')+'</div><div><h3>The estimate</h3><p class="small">Assumed effect: '+esc(s.effectText)+'</p><p class="small muted">You can use any provider. Your score and the verification of your figures do not depend on who does the work.</p></div></div></section>'
    + '<h2 class="sec-t" style="margin-top:28px">Book the relevant expert</h2>'
+ '<div class="book"><div class="panel"><h3>Choose a time</h3><p class="sec-s" style="margin-top:4px">'+esc(s.session)+'. The next ten business days, in your local time.</p>'
    + '<div class="slots" role="group" aria-label="Available times">'+grid+'<div class="sday"><div class="sd">Other</div><button type="button" class="slot" data-act="slot" data-slot="other" aria-pressed="false">Another time</button></div></div>'
    + '<div class="stack" style="margin-top:24px">'
    + '<fieldset class="field"><legend class="lbl">Format</legend><div class="pill-row">'+s.modes.map(function(md,ix){ return '<label class="radio"><input type="radio" name="bk-mode" value="'+esc(md)+'"'+(ix===0?' checked':'')+'> '+esc(md)+'</label>'; }).join('')+'</div></fieldset>'
    + '<div class="field"><label for="bk-loc">Where, for an on-site session</label><input type="text" id="bk-loc" value="'+esc(o.profile.org_name)+'"></div>'
    + '<div class="row2"><div class="field"><label for="bk-name">Contact name</label><input type="text" id="bk-name" value="'+esc(contact.name||'')+'" autocomplete="name"></div><div class="field"><label for="bk-email">Contact email</label><input type="email" id="bk-email" value="'+esc(contact.email||'')+'" autocomplete="email"></div></div>'
    + '<div class="field"><label for="bk-notes">Notes</label><textarea id="bk-notes" rows="3" placeholder="Anything the specialist should know, or a time that suits you if none above does."></textarea></div>'
    + '<label class="check"><input type="checkbox" id="bk-share" checked> <span>Share the Yarta figures behind this recommendation with the provider, so they arrive prepared.</span></label>'
    + '<div class="note-box grey">Prototype: nothing is sent. In production, Yarta would confirm the time with you by email.</div>'
    + '<div class="btn-row"><button class="btn btn-primary" type="button" data-act="book-submit" data-svc="'+s.k+'">Request this booking</button><a class="btn btn-ghost" href="#/improvements" style="color:var(--ink)">Back to improvements</a></div>'
    + '</div></div>'
    + '</div>';
  return shell('improve', body);
}

function vImprove(){
  var o=org(), S=seriesOf(o), m=monthOf(S);
  if(!m || !R) return shell('improve','<div class="pg-head"><div><p class="kicker">Improvements</p><h1>Improvements</h1></div></div><div class="empty">Suggested improvements appear once your first month is verified.</div>');
  var i=idxOf(S,m.month), P=planFor(o,S,i);
  var items=P.items.slice().sort(function(a,b){ return ((b.uplift&&b.uplift.overall)||0)-((a.uplift&&a.uplift.overall)||0); });
  var head='<div class="pg-head"><div><p class="kicker">Improvements</p><h1>What would lift your score</h1><p class="pg-sub">Suggestions from your verified figures to '+mLabel(m.month)+(m.status!=='verified'?' (provisional: awaiting verification)':'')+', biggest estimated change first. Open one to see what is involved, then book the relevant expert.</p></div></div>';
  var cards=items.map(function(it){
    var s=it.s, b=it.booking, pv=provOf(s), ov=it.uplift&&it.uplift.overall>=0.05?it.uplift.overall:null;
    return '<a class="imp-card'+(s.prov==='group'?' grp':'')+'" href="#/improvements/'+s.k+'">'
      + '<span class="imp-n"><b>'+(ov!=null?sgn(ov,1):'—')+'</b><small>'+(ov!=null?'score':'see detail')+'</small></span>'
      + '<span class="imp-b"><span class="k">'+esc(s.cat?D.CAT[s.cat].name:'Funding')+'</span><span class="imp-t">'+itemName(it)+'</span><span class="small muted">'+esc(upText(it.uplift)||s.effectText)+' · '+esc(pv.label)+'</span></span>'
      + '<span class="imp-s">'+(b?bookingChip(b):'<span class="btn btn-primary btn-sm">Details and booking</span>')+'</span></a>';
  }).join('');
  var bl=orgBookings(o.id).slice().sort(function(a,b){ return (b.slot||b.createdAt||'')<(a.slot||a.createdAt||'')?-1:1; });
  var bk=bl.length?'<h2 class="sec-t" style="margin-top:28px">Your bookings</h2><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Help</th><th>When</th><th>Status</th><th>Since then</th><th></th></tr></thead><tbody>'+bl.map(function(b){ return bookingRow(b,o,S,i); }).join('')+'</tbody></table></div>':'';
  return shell('improve', head+'<section class="panel-dark rm-top">'+threeNums(P,m,'dark')+'</section><h2 class="sec-t" style="margin-top:28px">Suggested improvements</h2><p class="sec-s">The estimated change is for each item on its own, once it has taken full effect. You can use any provider.</p>'+(cards?'<div class="imp-list">'+cards+'</div>':'<div class="empty">Nothing is suggested from your current figures.</div>')+bk);
}

/* the figures behind an open booking, from the customer's verified months, when none were saved with it */
function liveWhy(b){ if(!(b.status==='requested'||b.status==='confirmed')) return ''; var o=state.orgs[b.org]; if(!o) return ''; var S=E.series(o.records.filter(function(r){ return r.status==='verified'; }), o.profile), i=S.months.length-1; if(i<0) return ''; var r=R.recommend(S,i,o.profile).filter(function(x){ return x.k===b.svc; })[0]; return r?r.why:''; }
function vBookings(){
  var order={requested:0,confirmed:1,completed:2,cancelled:3};
  var bs=(state.bookings||[]).slice().sort(function(a,b){ return (order[a.status]-order[b.status]) || ((a.slot||'')<(b.slot||'')?-1:1); });
  var rows=bs.map(function(b){ var o=state.orgs[b.org], s=R&&R.byKey[b.svc]; if(!o||!s) return ''; var acts='';
    if(b.status==='requested') acts='<button class="btn btn-primary btn-sm" type="button" data-act="bk-confirm" data-id="'+esc(b.id)+'">Confirm</button><button class="btn btn-ghost btn-sm" type="button" data-act="bk-cancel-op" data-id="'+esc(b.id)+'" style="color:var(--ink)">Cancel</button>';
    else if(b.status==='confirmed') acts='<button class="btn btn-ink btn-sm" type="button" data-act="bk-done" data-id="'+esc(b.id)+'">Mark done</button><button class="btn btn-ghost btn-sm" type="button" data-act="bk-cancel-op" data-id="'+esc(b.id)+'" style="color:var(--ink)">Cancel</button>';
    else if(b.status==='completed') acts='<span class="small muted">Done '+(b.completedMonth?mLabel(b.completedMonth):'')+'</span>';
    return '<tr><td><b>'+esc(o.profile.org_name)+'</b><div class="small muted">'+esc(b.contact||'')+(b.email?' · '+esc(b.email):'')+'</div></td>'
      + '<td><b>'+esc(R.title(s,o.profile))+'</b>'+grpDot(s)+'<div class="small muted">'+esc(provOf(s).label)+'</div>'+(b.notes?'<div class="small">'+esc(b.notes)+'</div>':'')+(b.share&&(b.why||liveWhy(b))?'<div class="small muted">Figures shared: '+esc(b.why||liveWhy(b))+'</div>':'')+'</td>'
      + '<td>'+esc(slotLabel(b.slot,b.other))+'<div class="small muted">'+esc(b.mode||'')+(b.location?' · '+esc(b.location):'')+'</div></td><td>'+(b.provider&&provById(b.provider)?'<b style="font-weight:600">'+esc(provById(b.provider).name)+'</b><div class="small muted">'+(b.introducedAt?'Introduced '+longDate(b.introducedAt):'Not yet introduced')+'</div>':(s.prov==='yes'?'<span class="small muted">Yarta analyst</span>':'<span class="small" style="color:var(--red)">No provider</span>'))+'</td><td>'+bookingChip(b)+'</td><td><div class="pill-row">'+acts+(s.prov!=='yes'&&b.status!=='cancelled'&&b.status!=='completed'?'<a class="btn btn-ghost btn-sm" href="#/ops/introduce/'+esc(b.id)+'" style="color:var(--ink)">'+(b.provider?'Introduction':'Assign provider')+'</a>':'')+'</div></td></tr>'; }).join('');
  var body='<div class="pg-head"><div><p class="kicker">Yarta team</p><h1>Bookings</h1><p class="pg-sub">Help requested from customers\' roadmaps. Confirm the time with the customer and the provider, then mark it done when the work is complete so the customer can follow the change in later months. Work by a Recycle Group business (●) is disclosed on the customer\'s report.</p></div></div>'
    + (rows?'<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Organisation</th><th>Help</th><th>When</th><th>Provider</th><th>Status</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty">No bookings yet.</div>');
  return shell('bookings', body);
}

/* report page 3: the roadmap */
function sheet3(o,S,i,P,k){
  var p=o.profile, m=S.months[i];
  var qrows=quarterRows(P).map(function(q){ return '<tr><td>'+esc(q.label)+'</td><td>'+(q.starts.length?q.starts.map(function(it){ return itemName(it)+(it.booking?' <span class="muted">('+(it.booking.status==='requested'?'requested':'booked')+')</span>':''); }).join(' · '):'<span class="muted">No new starts</span>')+'</td><td class="num">'+(q.score==null?'—':q.score)+'</td></tr>'; }).join('');
  var bl=orgBookings(o.id).filter(function(b){ return b.status!=='cancelled' && R.byKey[b.svc]; });
  var prog=bl.map(function(b){ var s=R.byKey[b.svc]; return '<tr><td>'+itemName({title:R.title(s,p), s:s})+'</td><td>'+esc(BK_L[b.status])+'</td><td>'+esc(b.status==='completed'&&b.completedMonth?mLabel(b.completedMonth):slotLabel(b.slot,b.other))+'</td><td>'+(b.status==='completed'?sinceText(S,b,i):'—')+'</td></tr>'; }).join('');
  var names={}; P.items.concat(bl.map(function(b){ return {s:R.byKey[b.svc]}; })).forEach(function(it){ if(it.s && it.s.prov==='group') names[it.s.groupNames]=1; });
  var nm=Object.keys(names);
  var disc = nm.length ? 'Items marked ● are delivered by a Recycle Group business ('+nm.join('; ')+'). Yarta is part of Recycle Group. You can use any provider; your score and its verification do not depend on who does the work.' : 'No item in this plan is delivered by a Recycle Group business. Yarta is part of Recycle Group.';
  return '<section class="rp-sheet rp-road"><div class="rp-head"><div><div class="rp-title" style="font-size:22px">'+esc(p.org_name)+' · '+mLabel(k)+'</div>'+rpSteps(['improve'])+'</div><div class="rp-kv"><span>Report</span><b>Roadmap</b></div></div>'
    + threeNums(P,m,'rp')
    + '<div class="rp-h">Score by month, and projected with the plan</div>'+roadChart(S,i,P,{h:190,print:true})+'<p class="rp-leg"><span class="lg-i"><span class="lg-l solid"></span>Your score by month</span><span class="lg-i"><span class="lg-l dash"></span>Projected with the plan (estimate)</span><span class="lg-i"><span class="lg-l dot"></span>At the eco standards</span></p>'
    + '<div class="rp-h">Plan by quarter</div>'+(P.active.length?'<div class="rp-tw"><table class="tbl compact"><thead><tr><th>Quarter</th><th>Starts (each builds up over '+R.RAMP+' months)</th><th class="r">Projected score at quarter end</th></tr></thead><tbody>'+qrows+'</tbody></table></div>':'<p class="rp-p">No help is in the plan.</p>')
    + '<div class="rp-h">Progress so far</div>'+(prog?'<div class="rp-tw"><table class="tbl compact"><thead><tr><th>Help</th><th>Status</th><th>When</th><th>Change since</th></tr></thead><tbody>'+prog+'</tbody></table></div>':'<p class="rp-p">No help booked yet.</p>')
    + '<div class="rp-h">Disclosures and assumptions</div><p class="rp-p">'+esc(disc)+' The projection and the score with Yarta help are estimates from the published assumptions; they are not a promise or a guarantee. A change since completed work is a change in the figures, not proof that the work caused it.</p>'
    + '<div class="rp-foot">'+esc(R.ROADMAP_RULES)+' Rules and assumptions: yes.com.au/method. Page 3 of 3.</div></section>';
}

/* ------------------------------------------------------------------ organisation */
function vOrganisation(){
  var o=org(), p=o.profile, ro=!isOp();
  var fields=D.PROFILE.map(function(f){
    var v=p[f.id]!=null?p[f.id]:'';
    var input = f.kind==='select' ? '<select id="p-'+f.id+'" data-pf="'+f.id+'"'+(roF(f)?' disabled':'')+'>'+f.options.map(function(op){ return '<option'+(String(v)===op?' selected':'')+'>'+esc(op)+'</option>'; }).join('')+'</select>'
      : f.id==='baseline_fy' ? '<select id="p-'+f.id+'" data-pf="'+f.id+'"'+(roF(f)?' disabled':'')+'>'+fyOptions(o).map(function(fy){ return '<option'+(String(v)===fy?' selected':'')+'>'+fy+'</option>'; }).join('')+'</select>'
      : f.kind==='text' ? '<input type="text" id="p-'+f.id+'" data-pf="'+f.id+'" value="'+esc(v)+'"'+(roF(f)?' disabled':'')+'>'
      : '<div class="in-unit"><input type="number" step="any" min="0" id="p-'+f.id+'" data-pf="'+f.id+'" value="'+esc(v)+'"'+(roF(f)?' disabled':'')+'>'+(f.unit?'<span class="u">'+esc(f.unit)+'</span>':'')+'</div>';
    return '<div class="field"><label for="p-'+f.id+'">'+esc(f.name)+(f.req?' <span class="req">*</span>':'')+'</label>'+input+'<span class="hint">'+esc(f.def)+'</span></div>';
  });
  var users=state.users.filter(function(u){ return u.org===o.id; }).map(function(u){ return '<tr><td>'+esc(u.name)+'</td><td>'+esc(u.title)+'</td><td class="mono small">'+esc(u.email)+'</td></tr>'; }).join('');
  var body='<div class="pg-head"><div><p class="kicker">Organisation</p><h1>'+esc(p.org_name)+'</h1><p class="pg-sub">Details used for intensities, the baseline and targets. Changing them recalculates every month.'+(ro?' Yarta keeps these up to date: to change anything other than your targets, email <a class="link" href="mailto:contact@yes.com.au">contact@yes.com.au</a>.':'')+'</p></div>'+('<div class="pg-actions"><button class="btn btn-primary btn-sm" type="button" data-act="save-profile">Save changes</button></div>')+'</div>'
    + '<div class="row2"><div class="panel"><h3>Profile</h3><div class="stack" style="margin-top:16px">'+fields.slice(0,8).join('')+'</div></div><div class="panel"><h3>Targets</h3>'+(ro?'<p class="sec-s" style="margin-top:6px">These are yours. Set your own; the eco standard stays the floor, so the higher of the two is what the report measures against.</p>':'')+'<div class="stack" style="margin-top:16px">'+fields.slice(8).join('')+'</div></div></div>'
    + '<h2 class="sec-t" style="margin-top:28px">Your Yarta data operator</h2><p class="sec-s">'+(operatorOf(o)?esc(operatorOf(o).name)+' · '+esc(operatorOf(o).title)+' · <a class="link" href="mailto:'+esc(operatorOf(o).email)+'">'+esc(operatorOf(o).email)+'</a>. Enters your figures, sends the monthly gap email and answers for the month.':'Not yet assigned.')+'</p><h2 class="sec-t" style="margin-top:28px">People with access</h2><p class="sec-s">In production each person has their own sign-in. Demo accounts only here.</p><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Name</th><th>Role</th><th>Email</th></tr></thead><tbody>'+(users||'<tr><td colspan="3" class="muted">No demo users for this organisation.</td></tr>')+'</tbody></table></div>';
  return shell('organisation', body);
}
function fyOptions(o){ var set={}; sorted(o).forEach(function(r){ set[E.fyOf(r.month)]=1; }); var a=Object.keys(set).sort(); if(o.profile.baseline_fy && a.indexOf(o.profile.baseline_fy)<0) a.unshift(o.profile.baseline_fy); return a; }

/* ------------------------------------------------------------------ data and export */
function csvCell(x){ x=x==null?'':String(x); return /[",\n]/.test(x)?'"'+x.replace(/"/g,'""')+'"':x; }
function download(name,text,type){ var b=new Blob([text],{type:type||'text/plain'}); var a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },500); }
function longRows(o,months){ var out=[['org_id','month','status','field_id','field_name','category','value','unit','frequency']]; sorted(o).forEach(function(r){ if(months && months.indexOf(r.month)<0) return; Object.keys(r.values||{}).forEach(function(id){ var f=field(id); if(!f) return; out.push([o.id,r.month,r.status,id,f.name,D.CAT[f.cat]?D.CAT[f.cat].name:'',r.values[id],f.unit||'',D.FREQ[f.freq]||'']); }); }); return out.map(function(r){ return r.map(csvCell).join(','); }).join('\n'); }
function parseCSV(t){ var rows=[],row=[],cell='',q=false; for(var i=0;i<t.length;i++){ var ch=t[i]; if(q){ if(ch==='"'){ if(t[i+1]==='"'){ cell+='"'; i++; } else q=false; } else cell+=ch; } else if(ch==='"') q=true; else if(ch===','){ row.push(cell); cell=''; } else if(ch==='\n'||ch==='\r'){ if(ch==='\r'&&t[i+1]==='\n') i++; row.push(cell); rows.push(row); row=[]; cell=''; } else cell+=ch; } if(cell!==''||row.length){ row.push(cell); rows.push(row); } return rows.filter(function(r){ return r.length>1||r[0]!==''; }); }
function vData(){
  var o=org(), n=o.records.length, ev=0; o.records.forEach(function(r){ ev+=Object.keys(r.evidence||{}).length; });
  var pv=ui.importPreview;
  var body='<div class="pg-head"><div><p class="kicker">Data and export</p><h1>Your data</h1><p class="pg-sub">Download everything, bring figures in from a spreadsheet, or start the demo again. In this prototype the data lives only in this browser.</p></div></div>'
    + '<div class="row2"><div class="panel"><h3>Download</h3><p class="sec-s" style="margin-top:6px">'+n+' months · '+ev+' evidence records.</p><div class="stack" style="margin-top:8px">'
    + '<button class="btn btn-ink" type="button" data-act="csv-all">Monthly figures (CSV, one row per figure)</button>'
    + '<button class="btn btn-ghost" type="button" data-act="carbon-csv" style="color:var(--ink)">Carbon table by scope (CSV: activity, quantity, factor, source, evidence)</button>'
    + '<button class="btn btn-ghost" type="button" data-act="json-all" style="color:var(--ink)">Everything for this organisation (JSON)</button>'
    + '<button class="btn btn-ghost" type="button" data-act="csv-dict" style="color:var(--ink)">The Yarta data dictionary (CSV)</button></div></div>'
    + (isOp()?'<div class="panel"><h3>Import figures</h3><p class="sec-s" style="margin-top:6px">A CSV in the same shape as the download (month, field_id, value), or a JSON export. Figures go into draft months only; submitted and verified months are never overwritten.</p>'
    + '<label class="btn btn-ghost" style="color:var(--ink)">Choose a CSV or JSON file<input type="file" data-act="import-file" accept=".csv,.json,text/csv,application/json" style="display:none"></label>'
    + (pv?'<div class="callout" style="margin-top:14px"><b>'+esc(pv.name)+'</b>: '+pv.ok+' figures across '+pv.months.length+' month'+(pv.months.length===1?'':'s')+' ready'+(pv.skip?' · '+pv.skip+' skipped (locked months or unknown fields)':'')+'.<div class="btn-row" style="margin-top:12px"><button class="btn btn-primary btn-sm" type="button" data-act="import-go">Import into drafts</button><button class="btn btn-ghost btn-sm" type="button" data-act="import-cancel" style="color:var(--ink)">Cancel</button></div></div>':'')
    + '</div>':'<div class="panel"><h3>Your figures are entered by Yarta</h3><p class="sec-s" style="margin-top:6px">Send your documents and Yarta keys every figure. Download everything here whenever you need it: for your annual report, an auditor or your own systems.</p><a class="btn btn-ink" href="#/documents">Send documents</a></div>')+'</div>'
    + '<div class="panel" style="margin-top:22px"><h3>Start the demo again</h3><p class="sec-s" style="margin-top:6px">Replaces everything in this browser with the original demo organisations and removes attached files.</p>'
    + (ui.confirmReset?'<div class="btn-row"><button class="btn btn-ink" type="button" data-act="reset-go">Yes, reset the demo</button><button class="btn btn-ghost" type="button" data-act="reset-cancel" style="color:var(--ink)">Keep my changes</button></div>':'<button class="btn btn-ghost" type="button" data-act="reset-ask" style="color:var(--ink)">Reset demo data</button>')+'</div>';
  return shell('data', body);
}

/* ------------------------------------------------------------------ Yarta operator */
function flagsFor(o,r){ var n=0; Object.keys(r.values||{}).forEach(function(id){ var f=field(id); if(!f||f.freq==='S'||!isNum(r.values[id])) return; if(warnFor(o,r.month,id,r.values[id])) n++; }); return n; }
function vQueue(){
  var q=queue(), ret=[]; Object.keys(state.orgs).forEach(function(id){ state.orgs[id].records.forEach(function(r){ if(r.status==='returned') ret.push({org:id,rec:r}); }); });
  function tr(x){ var o=state.orgs[x.org], r=x.rec, pr=progressOf(o,r), ev=Object.keys(r.evidence||{}).length; return '<tr><td><b>'+esc(o.profile.org_name)+'</b><div class="small muted">'+esc(o.profile.org_type)+' · '+esc(o.profile.state)+'</div></td><td>'+mLabel(r.month)+'</td><td>'+longDate(r.submittedAt)+'</td><td class="num">'+pr.req+' / '+pr.reqDue+'</td><td class="num">'+ev+' / 9</td><td class="num">'+flagsFor(o,r)+'</td><td>'+esc(r.enteredBy||'')+'</td><td><a class="btn btn-primary btn-sm" href="#/ops/review/'+x.org+'/'+r.month+'">Review</a></td></tr>'; }
  var body='<div class="pg-head"><div><p class="kicker">Yarta team</p><h1>Verification</h1><p class="pg-sub">Months entered by Yarta and waiting for a second analyst. Check every figure against its document, grade the evidence, then verify the month or return it to data entry with a note. Nobody verifies a month they entered.</p></div></div>'
    + (q.length?'<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Organisation</th><th>Month</th><th>Entered</th><th class="r">Required</th><th class="r">Evidence</th><th class="r">Flags</th><th>Entered by</th><th></th></tr></thead><tbody>'+q.map(tr).join('')+'</tbody></table></div>':'<div class="empty">Nothing waiting. Every entered month has been verified.</div>')
    + (ret.length?'<h2 class="sec-t" style="margin-top:28px">Returned to data entry</h2><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Organisation</th><th>Month</th><th>Note</th></tr></thead><tbody>'+ret.map(function(x){ var n=(x.rec.notes||[]).slice(-1)[0]; return '<tr><td>'+esc(state.orgs[x.org].profile.org_name)+'</td><td>'+mLabel(x.rec.month)+'</td><td class="small">'+esc(n?n.text:'')+'</td></tr>'; }).join('')+'</tbody></table></div>':'');
  return shell('ops', body);
}
function vCustomers(){
  var rows=Object.keys(state.orgs).map(function(id){ var o=state.orgs[id], S=seriesOf(o), m=monthOf(S), rs=sorted(o), last=rs[rs.length-1]; var waiting=o.records.filter(function(r){ return r.status==='submitted'; }).length;
    return '<tr><td><b>'+esc(o.profile.org_name)+'</b><div class="small muted">'+esc(o.profile.org_type)+' · '+esc(o.profile.state)+'</div></td><td><select class="opsel" data-act="set-operator" data-org="'+id+'" aria-label="Data operator">'+ops().map(function(u){ return '<option value="'+esc(u.id)+'"'+(o.profile.operator===u.id?' selected':'')+'>'+esc(u.name)+'</option>'; }).join('')+'</select></td><td class="num">'+o.records.length+'</td><td>'+(last?mLabel(last.month)+' '+statusChip(last.status):'—')+'</td><td class="num"><b>'+(m&&m.score!=null?m.score:'—')+'</b></td><td>'+(m?esc(m.band):'—')+'</td><td class="num">'+(m&&m.yoy!=null?sgn(m.yoy):'—')+'</td><td class="num">'+waiting+'</td><td><div class="pill-row"><button class="btn btn-ghost btn-sm" type="button" data-act="view-org" data-org="'+id+'" style="color:var(--ink)">Dashboard</button>'+(openMonths(o).length?'<a class="btn btn-primary btn-sm" href="#/entry/'+id+'/'+openMonths(o)[openMonths(o).length-1].month+'">Enter figures</a>':'')+'</div></td></tr>'; }).join('');
  var body='<div class="pg-head"><div><p class="kicker">Yarta team</p><h1>Customers</h1><p class="pg-sub">Every customer, its named Yarta data operator and where its latest month sits. Demo organisations are fictional.</p></div><div class="pg-actions"><a class="btn btn-ink btn-sm" href="#/ops/customers/new">New customer</a></div></div><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Organisation</th><th>Data operator</th><th class="r">Months</th><th>Latest month</th><th class="r">Score</th><th>Band</th><th class="r">Year on year</th><th class="r">Waiting</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  return shell('customers', body);
}
function vReview(orgId,k){
  var o=state.orgs[orgId]; if(!o) return vNotFound(); var r=rec(o,k); if(!r) return vNotFound();
  var pr=progressOf(o,r), cats=D.CATEGORIES.filter(function(c){ return c.k!=='carbon'; });
  var v=withCarry(o,k,r.values||{}), calc=E.month(v,o.profile);
  var sections=cats.map(function(c){
    var fs=D.INPUTS.filter(function(f){ return f.cat===c.k && r.values[f.id]!==undefined && r.values[f.id]!==''; });
    var ev=(r.evidence||{})[c.k];
    var rows=fs.map(function(f){ var cv=cmpVals(o,k,f.id), a=r.values[f.id], w=f.freq==='S'?'':warnFor(o,k,f.id,a); return '<tr'+(w?' class="flag"':'')+'><td>'+esc(f.name)+'<div class="id">'+esc(f.id)+'</div>'+(w?'<div class="small" style="color:var(--red)">'+esc(w)+'</div>':'')+'</td><td class="num"><b>'+(isNum(a)?fmtF(f,+a):esc(a))+'</b></td><td>'+esc(f.unit)+'</td><td class="num">'+(cv.prev==null?'—':fmtF(f,cv.prev))+'</td><td class="num">'+(cv.ly==null?'—':fmtF(f,cv.ly))+'</td></tr>'; }).join('');
    var gsel = ev ? '<label class="small">Grade <select class="gsel" data-grade="'+c.k+'"'+(r.status!=='submitted'?' disabled':'')+'><option value="">…</option><option'+(ev.grade==='A'?' selected':'')+'>A</option><option'+(ev.grade==='B'?' selected':'')+'>B</option><option'+(ev.grade==='C'?' selected':'')+'>C</option></select></label>' : '<span class="small muted">No evidence attached</span>';
    return '<div class="panel" style="margin-top:16px"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:center"><h3>'+esc(c.name)+'</h3><div class="pill-row" style="align-items:center">'+(ev?'<span class="chip">'+esc(ev.name||'Document')+(ev.demo?' · demo, not stored':'')+'</span>'+(!ev.demo?'<button class="btn btn-ghost btn-sm" type="button" data-act="ev-open" data-key="'+esc(ev.key||evKey(orgId,k,c.k))+'" style="color:var(--ink)">Open</button>':''):'')+gsel+'</div></div>'
      + (fs.length?'<div class="tbl-wrap" style="margin-top:12px"><table class="tbl compact"><thead><tr><th>Figure</th><th class="r">'+mShort(k)+'</th><th>Unit</th><th class="r">'+mShort(E.addMonths(k,-1))+'</th><th class="r">'+mShort(E.addMonths(k,-12))+'</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p class="sec-s" style="margin-top:8px">No figures entered in this category.</p>')+'</div>';
  }).join('');
  var canAct = r.status==='submitted', mine = !!(r.enteredBy && r.enteredBy===me().name);
  var decision = canAct ? '<div class="panel" style="margin-top:22px"><h3>Decision</h3><p class="sec-s" style="margin-top:6px">Verify once every attached document has a grade. Return the month to data entry if a figure needs correcting; your note goes with it. The customer sees the month once it is verified.</p><div class="field" style="margin:12px 0 14px"><label for="rv-note">Note to data entry (required to return)</label><textarea id="rv-note" rows="3" placeholder="For example: diesel is 40% above August last year. Please recheck the fuel card statement."></textarea></div>'+(mine?'<div class="note-box" style="margin-bottom:12px">You entered this month, so a different analyst must verify it. Sign in as another Yarta team member to verify.</div>':'')+'<div class="btn-row"><button class="btn btn-primary'+(mine?' is-disabled':'')+'" type="button" data-act="verify" data-org="'+orgId+'" data-month="'+k+'"'+(mine?' aria-disabled="true"':'')+'>Verify '+mShort(k)+'</button><button class="btn btn-ghost" type="button" data-act="return" data-org="'+orgId+'" data-month="'+k+'" style="color:var(--ink)">Return to data entry</button></div></div>'
    : '<div class="banner grey" style="margin-top:22px"><span>This month is '+esc(r.status)+'. '+(r.verifiedAt?'Verified '+longDate(r.verifiedAt)+(r.verifiedBy?' by '+esc(r.verifiedBy):'')+'.':'')+'</span></div>';
  var body='<div class="pg-head"><div><p class="kicker"><a class="link" href="#/ops">Review queue</a> · '+statusChip(r.status)+'</p><h1>'+esc(o.profile.org_name)+' · '+mLabel(k)+'</h1><p class="pg-sub">Entered '+longDate(r.enteredAt||r.submittedAt)+(r.enteredBy?' by '+esc(r.enteredBy):'')+' · '+pr.req+' of '+pr.reqDue+' required figures · '+flagsFor(o,r)+' figures flagged for a second look</p></div></div>'
    + '<div class="row3"><div class="panel metric"><div class="k">Emissions this month</div><div class="v">'+fmt(calc.total_t,1)+'<span class="u">t CO₂-e</span></div><div class="s">Scope 1 '+fmt(calc.scope1_t,1)+' · Scope 2 '+fmt(calc.scope2_t,1)+' · Scope 3 '+fmt(calc.scope3_t,1)+'</div></div><div class="panel metric"><div class="k">Renewable · fleet electric</div><div class="v">'+pct(calc.renew_pct)+'<span class="u">·</span> '+pct(calc.fleet_ev_pct)+'</div><div class="s">Grid '+fmt(calc.grid_kwh)+' kWh</div></div><div class="panel metric"><div class="k">Landfill diversion</div><div class="v">'+pct(calc.diversion_pct,1)+'</div><div class="s">'+fmt(calc.waste_total_t,1)+' t total · '+fmt(calc.landfill_t,1)+' t landfill</div></div></div>'
    + '<div class="panel" style="margin-top:16px"><h3>Documents from '+esc(o.profile.org_name)+'</h3>'+inboxList(r)+'</div>' + declList(r) + sections + decision;
  return shell('ops', body);
}
function vFactors(){
  var F=E.FACTORS;
  var el=Object.keys(F.elec).map(function(s){ return '<tr><td>'+s+'</td><td class="num">'+F.elec[s].s2.toFixed(2)+'</td><td class="num">'+F.elec[s].s3.toFixed(2)+'</td><td class="num">'+(F.gas.s3[s]!=null?F.gas.s3[s].toFixed(1):'—')+'</td></tr>'; }).join('');
  var fu=Object.keys(F.fuel).map(function(k){ var f=F.fuel[k]; return '<tr><td>'+k.charAt(0).toUpperCase()+k.slice(1)+'</td><td class="num">'+f.gj+'</td><td class="num">'+f.s1+'</td><td class="num">'+f.s3+'</td></tr>'; }).join('');
  var av=Object.keys(F.avoided).map(function(k){ return '<tr><td>'+k+'</td><td class="num">'+F.avoided[k]+'</td></tr>'; }).join('');
  var body='<div class="pg-head"><div><p class="kicker">Yarta team</p><h1>Factor library</h1><p class="pg-sub">'+esc(F.edition)+'. Changing a factor is a method change: it is versioned and every affected month is recalculated.</p></div></div>'
    + '<div class="row2"><div class="panel"><h3>Electricity and gas by state</h3><div class="tbl-wrap" style="margin-top:12px"><table class="tbl compact"><thead><tr><th>State</th><th class="r">Scope 2 kg/kWh</th><th class="r">Scope 3 kg/kWh</th><th class="r">Gas Scope 3 kg/GJ</th></tr></thead><tbody>'+el+'</tbody></table></div><p class="small muted" style="margin:10px 0 0">Natural gas Scope 1: '+F.gas.s1+' kg CO₂-e per GJ. Location-based electricity.</p></div>'
    + '<div class="panel"><h3>Transport fuels</h3><div class="tbl-wrap" style="margin-top:12px"><table class="tbl compact"><thead><tr><th>Fuel</th><th class="r">GJ per kL</th><th class="r">Scope 1 kg/GJ</th><th class="r">Scope 3 kg/GJ</th></tr></thead><tbody>'+fu+'</tbody></table></div><h3 style="margin-top:22px">Landfill · t CO₂-e per t</h3><p class="small" style="margin-top:8px">Council (mixed municipal) '+F.landfill.Council+' · Business, government and other (commercial and industrial) '+F.landfill.Business+'</p></div></div>'
    + '<div class="row2" style="margin-top:22px"><div class="panel"><h3>Avoided emissions · t CO₂-e per t recycled</h3><p class="small muted" style="margin-top:6px">NSW DECCW (2010). Flagged as dated; reported separately and never deducted.</p><div class="tbl-wrap" style="margin-top:10px"><table class="tbl compact"><tbody>'+av+'</tbody></table></div></div>'
    + '<div class="panel"><h3>Unit weights · tonnes per item</h3><p class="small muted" style="margin-top:6px">Defaults until items are weighed.</p><div class="tbl-wrap" style="margin-top:10px"><table class="tbl compact"><tbody><tr><td>Mattress</td><td class="num">'+F.unit.mattress+'</td></tr><tr><td>Tyre</td><td class="num">'+F.unit.tyre+'</td></tr><tr><td>Whitegood</td><td class="num">'+F.unit.whitegood+'</td></tr></tbody></table></div><h3 style="margin-top:22px">Pending</h3><p class="small" style="margin-top:8px">Flights: trips are recorded; a distance-based factor is not yet adopted, so flights are not in the totals.</p></div></div>';
  return shell('factors', body);
}
function vActivity(){
  var rows=(state.audit||[]).slice(0,120).map(function(a){ return '<tr><td class="small mono">'+esc(new Date(a.at).toLocaleString('en-AU'))+'</td><td>'+esc(a.by)+'</td><td>'+esc(a.org&&state.orgs[a.org]?state.orgs[a.org].profile.org_name:'')+'</td><td>'+esc(a.action)+'</td><td class="small">'+esc(a.detail)+'</td></tr>'; }).join('');
  var body='<div class="pg-head"><div><p class="kicker">Yarta team</p><h1>Activity</h1><p class="pg-sub">Every submission, verification, return and profile change made in this browser.</p></div></div>'
    + (rows?'<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>When</th><th>Who</th><th>Organisation</th><th>Action</th><th>Detail</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty">No activity yet in this browser. Submit or verify a month and it will appear here.</div>');
  return shell('activity', body);
}
/* ------------------------------------------------------------------ Yarta team: the operations tool (prototype)
   Adds, on top of entry and verification: a Today workbench, the monthly gap email, reports to issue,
   the provider directory with accreditation checks, provider introductions for bookings, a named data
   operator per customer, and new-customer onboarding. State shape is flat so it maps to collections later:
   orgs, users, bookings, providers, gapLog, audit. */
function today(){ return new Date().toISOString().slice(0,10); }
function ops(){ return state.users.filter(function(u){ return u.role==='operator'; }); }
function opById(id){ return state.users.filter(function(u){ return u.id===id; })[0]; }
function operatorOf(o){ return o && o.profile && o.profile.operator ? opById(o.profile.operator) : null; }
function contactsOf(o){ return state.users.filter(function(u){ return u.role==='customer' && u.org===o.id; }); }
function copyText(s){ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(s).then(function(){ flash('Copied.'); },function(){ flash('Could not copy. Select the text and copy it.','err'); }); } else flash('Select the text and copy it.','err'); }
function mailto(to,subject,body){ return 'mailto:'+encodeURIComponent(to)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body); }

/* --- providers: who Yarta introduces, and the accreditation each must hold --- */
var ACCRED = {
  hardwaste:'Environment protection licence or registration for the activity in that state; processor certificates per stream',
  contamination:'Bin audit practitioners working to the state waste authority audit method',
  fleet:'Fleet and EV advisers working from the organisation\'s own kilometres and fuel data; charging by licensed electricians',
  energy:'Energy audits to AS/NZS 3598; solar and battery installers accredited under the Clean Energy Council scheme (Solar Accreditation Australia); electrical work by licensed electricians',
  dumping:'Environment protection licence or registration for collection in that state',
  water:'Licensed plumbers for works; water auditors working to the utility\'s efficiency program',
  evidence:'Yarta analysts, not the analysts who enter or verify the customer\'s months',
  procurement:'Procurement advisers; recycled-content claims backed by supplier certificates',
  planting:'Landcare groups, accredited bush regenerators, Traditional Owner ranger programs engaged on their terms',
  grants:'Grants writers using the verified Yarta figures as the evidence base'
};
function defaultProviders(){
  var d=today();
  function P(id,name,svc,kind,acc,lic,exp,contact,email){ return {id:id,name:name,svc:svc,kind:kind,accreditation:acc,licence:lic,expiry:exp,checkedAt:d,checkedBy:'Demo seed',contact:contact,email:email,phone:'',notes:'Fictional demo provider.',demo:true}; }
  return [
    P('pv-rg-collect','Recycle Group collections (demo)',['hardwaste','dumping'],'group','EPA licence for waste collection and transfer; processor certificates per stream','EPA-DEMO-0001','2027-06-30','Operations desk','collections@demo-recyclegroup.example'),
    P('pv-solar','Demo Solar & Storage',['energy'],'partner','Clean Energy Council accredited installer (Solar Accreditation Australia); licensed electrical contractor','SAA-DEMO-2211','2027-03-31','Sam Ortiz','sam@demo-solar.example'),
    P('pv-audit','Demo Energy Audits',['energy'],'partner','Energy audits to AS/NZS 3598 (Type 2)','—','2027-12-31','Ana Petrov','ana@demo-audits.example'),
    P('pv-fleet','Demo Fleet Advisory',['fleet'],'partner','Fleet transition adviser; charging installed by licensed electricians','—','2026-11-30','Lee Zhang','lee@demo-fleet.example'),
    P('pv-water','Demo Water Services',['water'],'partner','Licensed plumbing contractor; leak detection and irrigation','PL-DEMO-77812','2027-01-31','Jo Barker','jo@demo-water.example'),
    P('pv-bins','Demo Bin Audits',['contamination'],'partner','Kerbside bin audit practitioners (state audit method)','—','2026-10-15','Rae Singh','rae@demo-binaudits.example'),
    P('pv-land','Demo Landcare Network',['planting'],'partner','Accredited bush regeneration; works with Traditional Owner ranger programs','—','2027-06-30','Kim Doyle','kim@demo-landcare.example'),
    P('pv-proc','Demo Procurement Advisory',['procurement'],'partner','Recycled-content procurement; supplier certificate verification','—','2027-06-30','Pat Nguyen','pat@demo-procure.example'),
    P('pv-grants','Demo Grants Partners',['grants'],'partner','Grants writing; uses verified Yarta figures only','—','2027-06-30','Alex Kaur','alex@demo-grants.example')
  ];
}
function providersFor(svc){ return (state.providers||[]).filter(function(p){ return p.svc.indexOf(svc)>=0; }); }
function provById(id){ return (state.providers||[]).filter(function(p){ return p.id===id; })[0]; }
function provStatus(p){ var d=today(); if(!p.expiry) return {k:'unknown',l:'No expiry recorded'}; if(p.expiry<d) return {k:'lapsed',l:'Lapsed '+longDate(p.expiry)}; if(p.expiry<=addDays(new Date(),90).toISOString().slice(0,10)) return {k:'expiring',l:'Expires '+longDate(p.expiry)}; return {k:'ok',l:'Current to '+longDate(p.expiry)}; }
function provChip(p){ var s=provStatus(p); var cls={ok:'st-verified',expiring:'st-submitted',lapsed:'st-returned',unknown:'st-draft'}[s.k]; return '<span class="st '+cls+'">'+esc(s.l)+'</span>'; }

/* --- the month in play for a customer, and what is still missing --- */
function monthInPlay(o){ var open=openMonths(o); if(open.length) return {k:open[0].month, r:open[0], started:true}; var nk=nextStartable(o); return nk?{k:nk, r:null, started:false}:null; }
function reportsToIssue(){ var out=[]; Object.keys(state.orgs).forEach(function(id){ state.orgs[id].records.forEach(function(r){ if(r.status==='verified' && !r.issuedAt) out.push({org:id,rec:r}); }); }); return out.sort(function(a,b){ return a.rec.month<b.rec.month?-1:1; }); }

/* --- views --- */
function vOpsHome(){
  var u=me(), d=today();
  var entry=entryQueue(), ver=queue(), issue=reportsToIssue(), bks=(state.bookings||[]).filter(function(b){ return b.status==='requested'; });
  var confirmedNoProv=(state.bookings||[]).filter(function(b){ return b.status==='confirmed' && !b.provider && R.byKey[b.svc] && R.byKey[b.svc].prov!=='yes'; });
  var gaps=[]; Object.keys(state.orgs).forEach(function(id){ var g=gapsFor(state.orgs[id]); if(g) gaps.push({org:id,g:g}); });
  var gapsDue=gaps.filter(function(x){ return x.g.dueNow; });
  var docsDue=gaps.filter(function(x){ return x.g.need.length && x.g.due>=new Date() && x.g.due<=addDays(new Date(),7); });
  var exp=(state.providers||[]).filter(function(p){ var s=provStatus(p); return s.k==='expiring'||s.k==='lapsed'; });
  var mine=Object.keys(state.orgs).filter(function(id){ return state.orgs[id].profile.operator===u.id; });
  function card(n,l,href,sub,tone){ return '<a class="panel metric ops-card'+(n?' on':'')+(tone?' '+tone:'')+'" href="'+href+'"><div class="k">'+esc(l)+'</div><div class="v">'+n+'</div><div class="s">'+esc(sub)+'</div></a>'; }
  var body='<div class="pg-head"><div><p class="kicker">Yarta team · '+esc(longDate(new Date()))+'</p><h1>Today</h1><p class="pg-sub">Everything the six promises need, in the order the month runs: documents in, figures entered, month verified, report issued, gap email out, help introduced.</p></div></div>'
    + '<div class="ops-grid">'
    + card(gapsDue.length,'Gap emails to send','#/ops/gaps','Months past the 1st with required figures missing and no email sent', gapsDue.length?'warn':'')
    + card(docsDue.length,'Documents due this week','#/ops/gaps','Customers whose records are due by the 15th')
    + card(entry.length,'Months to enter','#/ops/entry','Open for data entry, or returned by verification')
    + card(ver.length,'Awaiting verification','#/ops','Entered, waiting for a second analyst', ver.length?'warn':'')
    + card(issue.length,'Reports to issue','#/ops/reports','Verified months whose report has not been issued', issue.length?'warn':'')
    + card(bks.length,'Bookings to confirm','#/ops/bookings','Help requested from a roadmap')
    + card(confirmedNoProv.length,'Introductions to make','#/ops/bookings','Confirmed bookings with no accredited provider assigned', confirmedNoProv.length?'warn':'')
    + card(exp.length,'Provider checks','#/ops/providers','Accreditations lapsed or expiring within 90 days', exp.length?'warn':'')
    + card((state.outbox||[]).filter(function(m){ return m.status==='queued'; }).length,'Outbox','#/ops/outbox','Emails queued, waiting to be sent')
    + card(Object.keys(state.orgs).reduce(function(a,id){ var ob=state.orgs[id]; return a+(ob.onboarding?onbProgress(ob).overdue.length:0); },0),'Onboarding steps overdue','#/ops/onboarding','Steps whose week has ended', Object.keys(state.orgs).some(function(id){ return state.orgs[id].onboarding && onbProgress(state.orgs[id]).overdue.length; })?'warn':'')
    + '</div>'
    + '<h2 class="sec-t" style="margin-top:28px">My customers</h2><p class="sec-s">Organisations where '+esc(u.name)+' is the named data operator.</p>'
    + (mine.length?'<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Organisation</th><th>Month in play</th><th class="r">Required figures</th><th>Documents due</th><th>Gap email</th><th></th></tr></thead><tbody>'
      + mine.map(function(id){ var o=state.orgs[id], g=gapsFor(o); return '<tr><td><b>'+esc(o.profile.org_name)+'</b></td><td>'+(g?mLabel(g.month)+(g.started?' '+statusChip(g.rec.status):' <span class="st st-draft">Not started</span>'):'<span class="muted">Up to date</span>')+'</td><td class="num">'+(g?g.have.length+' / '+(g.have.length+g.need.length):'—')+'</td><td>'+(g?longDate(g.due):'—')+'</td><td>'+(g?(g.lastSent?'Sent '+longDate(g.lastSent.at):(g.dueNow?'<span class="st st-returned">Due</span>':'Not yet')):'—')+'</td><td>'+(g?'<a class="btn btn-ghost btn-sm" href="#/ops/gaps/'+id+'" style="color:var(--ink)">Open</a>':'')+'</td></tr>'; }).join('')
      + '</tbody></table></div>':'<div class="empty">No customers are assigned to you yet. Assign an operator on the <a class="link" href="#/ops/customers">Customers</a> page.</div>');
  return shell('home', body);
}

function vIssue(){
  var list=reportsToIssue();
  var rows=list.map(function(x){ var o=state.orgs[x.org], r=x.rec; return '<tr><td><b>'+esc(o.profile.org_name)+'</b></td><td>'+mLabel(r.month)+'</td><td>'+longDate(r.verifiedAt)+(r.verifiedBy?' · '+esc(r.verifiedBy):'')+'</td><td><div class="pill-row"><button class="btn btn-ghost btn-sm" type="button" data-act="view-report" data-org="'+x.org+'" data-month="'+r.month+'" style="color:var(--ink)">Preview</button><button class="btn btn-primary btn-sm" type="button" data-act="issue-report" data-org="'+x.org+'" data-month="'+r.month+'">Issue report</button></div></td></tr>'; }).join('');
  var issued=[]; Object.keys(state.orgs).forEach(function(id){ state.orgs[id].records.forEach(function(r){ if(r.issuedAt) issued.push({org:id,rec:r}); }); }); issued.sort(function(a,b){ return a.rec.issuedAt<b.rec.issuedAt?1:-1; });
  var body='<div class="pg-head"><div><p class="kicker">Yarta team</p><h1>Reports to issue</h1><p class="pg-sub">A verified month becomes a Yarta Report when it is issued: the issue date is printed on page 1, the customer is told, and the report is fixed. Issuing is the last check that the month reads right.</p></div></div>'
    + (rows?'<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Organisation</th><th>Month</th><th>Verified</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty">Nothing to issue. Every verified month has its report.</div>')
    + (issued.length?'<h2 class="sec-t" style="margin-top:28px">Issued</h2><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Organisation</th><th>Month</th><th>Issued</th><th>By</th></tr></thead><tbody>'+issued.slice(0,40).map(function(x){ return '<tr><td>'+esc(state.orgs[x.org].profile.org_name)+'</td><td>'+mLabel(x.rec.month)+'</td><td>'+longDate(x.rec.issuedAt)+'</td><td>'+esc(x.rec.issuedBy||'')+'</td></tr>'; }).join('')+'</tbody></table></div>':'');
  return shell('issue', body);
}

function vProviders(editId){
  var ps=(state.providers||[]).slice().sort(function(a,b){ return a.name<b.name?-1:1; });
  var ed=editId==='new'?{id:'',name:'',svc:[],kind:'partner',accreditation:'',licence:'',expiry:'',contact:'',email:'',phone:'',notes:''}:(editId?provById(editId):null);
  var rows=ps.map(function(p){ var n=(state.bookings||[]).filter(function(b){ return b.provider===p.id; }).length; return '<tr><td><b>'+esc(p.name)+'</b>'+(p.kind==='group'?' <span class="grp-dot" title="Recycle Group business">●</span>':'')+'<div class="small muted">'+esc(p.contact||'')+(p.email?' · '+esc(p.email):'')+'</div></td><td>'+p.svc.map(function(k){ var s=R.byKey[k]; return '<span class="chip">'+esc(s?R.title(s,{}):k)+'</span>'; }).join(' ')+'</td><td class="small">'+esc(p.accreditation)+(p.licence&&p.licence!=='—'?'<div class="muted">'+esc(p.licence)+'</div>':'')+'</td><td>'+provChip(p)+'<div class="small muted">Checked '+longDate(p.checkedAt)+(p.checkedBy?' · '+esc(p.checkedBy):'')+'</div></td><td class="num">'+n+'</td><td><div class="pill-row"><button class="btn btn-ghost btn-sm" type="button" data-act="prov-check" data-id="'+esc(p.id)+'" style="color:var(--ink)">Checked today</button><a class="btn btn-ghost btn-sm" href="#/ops/providers/'+esc(p.id)+'" style="color:var(--ink)">Edit</a></div></td></tr>'; }).join('');
  var svcOpts=R.SERVICES.map(function(s){ return '<label class="small" style="display:inline-flex;gap:6px;align-items:center;margin:0 12px 6px 0"><input type="checkbox" data-psvc="'+esc(s.k)+'"'+(ed&&ed.svc.indexOf(s.k)>=0?' checked':'')+'> '+esc(R.title(s,{}))+'</label>'; }).join('');
  var form = ed ? '<div class="panel" style="margin-top:22px" id="prov-form"><h3>'+(ed.id?'Edit provider':'New provider')+'</h3><p class="sec-s" style="margin-top:6px">Every provider Yarta introduces holds the licence or accreditation the work requires. Record what was checked, the number, and when it expires.</p>'
      + '<div class="row2" style="margin-top:12px"><div class="stack"><div class="field"><label for="pv-name">Provider name</label><input type="text" id="pv-name" value="'+esc(ed.name)+'"></div>'
      + '<div class="field"><label>Kind</label><select id="pv-kind"><option value="partner"'+(ed.kind==='partner'?' selected':'')+'>Independent specialist</option><option value="group"'+(ed.kind==='group'?' selected':'')+'>Recycle Group business (disclosed on the report)</option></select></div>'
      + '<div class="field"><label>Kinds of help</label><div>'+svcOpts+'</div></div>'
      + '<div class="field"><label for="pv-acc">Accreditation or licence held</label><textarea id="pv-acc" style="min-height:70px">'+esc(ed.accreditation)+'</textarea><span class="hint">'+esc(ed.svc.length?ACCRED[ed.svc[0]]||'':'What the Yarta Method requires for this kind of help.')+'</span></div></div>'
      + '<div class="stack"><div class="field"><label for="pv-lic">Licence or accreditation number</label><input type="text" id="pv-lic" value="'+esc(ed.licence)+'"></div>'
      + '<div class="field"><label for="pv-exp">Expiry</label><input type="date" id="pv-exp" value="'+esc(ed.expiry)+'"></div>'
      + '<div class="field"><label for="pv-contact">Contact</label><input type="text" id="pv-contact" value="'+esc(ed.contact)+'"></div>'
      + '<div class="field"><label for="pv-email">Email</label><input type="email" id="pv-email" value="'+esc(ed.email)+'"></div>'
      + '<div class="field"><label for="pv-phone">Phone</label><input type="text" id="pv-phone" value="'+esc(ed.phone)+'"></div>'
      + '<div class="field"><label for="pv-notes">Notes</label><textarea id="pv-notes" style="min-height:60px">'+esc(ed.notes)+'</textarea></div></div></div>'
      + '<div class="pill-row" style="margin-top:12px"><button class="btn btn-primary btn-sm" type="button" data-act="prov-save" data-id="'+esc(ed.id)+'">Save provider</button><a class="btn btn-ghost btn-sm" href="#/ops/providers" style="color:var(--ink)">Cancel</a>'+(ed.id?'<button class="btn btn-ghost btn-sm" type="button" data-act="prov-remove" data-id="'+esc(ed.id)+'" style="color:var(--red)">Remove</button>':'')+'</div></div>' : '';
  var body='<div class="pg-head"><div><p class="kicker">Yarta team</p><h1>Providers</h1><p class="pg-sub">Who Yarta introduces when a customer books a suggestion, and the accreditation each one holds. A provider whose accreditation has lapsed cannot be assigned to a booking.</p></div><div class="pg-actions"><a class="btn btn-ink btn-sm" href="#/ops/providers/new">Add a provider</a></div></div>'
    + '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Provider</th><th>Kinds of help</th><th>Accreditation</th><th>Status</th><th class="r">Bookings</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="6" class="muted">No providers yet.</td></tr>')+'</tbody></table></div>'
    + form
    + '<div class="panel" style="margin-top:22px"><h3>What the method requires, by kind of help</h3><div class="tbl-wrap" style="margin-top:10px"><table class="tbl compact"><tbody>'+Object.keys(ACCRED).map(function(k){ var s=R.byKey[k]; return '<tr><td style="white-space:nowrap"><b>'+esc(s?R.title(s,{}):k)+'</b></td><td class="small">'+esc(ACCRED[k])+'</td></tr>'; }).join('')+'</tbody></table></div></div>';
  return shell('providers', body);
}

function introEmail(b){
  var o=state.orgs[b.org], s=R.byKey[b.svc], p=provById(b.provider), op=operatorOf(o)||me();
  var title=R.title(s,o.profile);
  var subject='Introduction · '+o.profile.org_name+' and '+(p?p.name:'provider')+' · '+title;
  var body='Hi '+(b.contact?b.contact.split(' ')[0]:'there')+(p&&p.contact?' and '+p.contact.split(' ')[0]:'')+',\n\n'
    + 'Introducing you to each other for the work '+o.profile.org_name+' booked from its Yarta roadmap: '+title+'.\n\n'
    + (p?p.name+' holds '+p.accreditation+(p.licence&&p.licence!=='—'?' ('+p.licence+')':'')+', checked by Yarta on '+longDate(p.checkedAt)+'.\n\n':'')
    + 'Requested time: '+slotLabel(b.slot,b.other)+(b.mode?' · '+b.mode:'')+(b.location?' · '+b.location:'')+'.\n'
    + (b.notes?'Notes from '+o.profile.org_name+': '+b.notes+'\n':'')
    + (b.share&&b.why?'Figures shared with the provider, with the customer\'s permission: '+b.why+'\n':'')
    + '\nThe contract for the work is between '+o.profile.org_name+' and '+(p?p.name:'the provider')+'; Yarta is not a party to it and charges nothing for the introduction. When the work is done, tell us and the next Yarta Report will show the change'+(p&&p.kind==='group'?' and disclose that a Recycle Group business did the work':'')+'.\n\n'
    + 'Thanks,\n'+op.name+'\nYarta\n'+op.email;
  var to=[b.email, p?p.email:''].filter(Boolean).join(',');
  return {to:to, subject:subject, body:body};
}
function vIntroduce(id){
  var b=bkById(id); if(!b) return vNotFound(); var o=state.orgs[b.org], s=R.byKey[b.svc]; if(!o||!s) return vNotFound();
  var cands=providersFor(b.svc);
  var sel='<select id="in-prov"><option value="">Choose a provider…</option>'+cands.map(function(p){ var st=provStatus(p); return '<option value="'+esc(p.id)+'"'+(b.provider===p.id?' selected':'')+(st.k==='lapsed'?' disabled':'')+'>'+esc(p.name)+' · '+esc(st.l)+'</option>'; }).join('')+'</select>';
  var em=b.provider?introEmail(b):null;
  var body='<div class="pg-head"><div><p class="kicker"><a class="link" href="#/ops/bookings">Bookings</a> · '+bookingChip(b)+'</p><h1>'+esc(o.profile.org_name)+' · '+esc(R.title(s,o.profile))+'</h1><p class="pg-sub">'+esc(slotLabel(b.slot,b.other))+(b.mode?' · '+esc(b.mode):'')+' · contact '+esc(b.contact||'')+(b.email?' &lt;'+esc(b.email)+'&gt;':'')+(b.introducedAt?' · introduced '+longDate(b.introducedAt)+' by '+esc(b.introducedBy||''):'')+'</p></div></div>'
    + '<div class="row2"><div class="panel"><h3>Provider</h3><p class="sec-s" style="margin-top:6px">Required for this kind of help: '+esc(ACCRED[b.svc]||'')+'</p><div class="field" style="margin-top:12px"><label for="in-prov">Assign</label>'+sel+'</div>'
    + (cands.length?'':'<p class="small" style="color:var(--red)">No provider offers this kind of help yet. <a class="link" href="#/ops/providers/new">Add one</a>.</p>')
    + '<div class="pill-row" style="margin-top:12px"><button class="btn btn-ink btn-sm" type="button" data-act="in-assign" data-id="'+esc(b.id)+'">Assign provider</button></div>'
    + (b.provider?'<div class="callout" style="margin-top:14px"><b>'+esc(provById(b.provider).name)+'</b><br><span class="small">'+esc(provById(b.provider).accreditation)+'</span><br>'+provChip(provById(b.provider))+'</div>':'')+'</div>'
    + '<div class="panel"><h3>Introduction</h3>'+(em?'<p class="sec-s" style="margin-top:6px">To '+esc(em.to)+'</p><div class="field" style="margin-top:12px"><label>Subject</label><input type="text" id="in-subj" value="'+esc(em.subject)+'"></div><div class="field"><label>Body</label><textarea id="in-body" style="min-height:320px;font-family:var(--font-mono);font-size:12.5px;line-height:1.5">'+esc(em.body)+'</textarea></div>'
      + '<div class="pill-row" style="margin-top:12px"><button class="btn btn-primary btn-sm" type="button" data-act="in-sent" data-id="'+esc(b.id)+'">Mark as introduced</button><a class="btn btn-ghost btn-sm" style="color:var(--ink)" href="'+mailto(em.to,em.subject,em.body)+'">Open in mail</a><button class="btn btn-ghost btn-sm" type="button" data-act="in-copy" style="color:var(--ink)">Copy</button></div>':'<p class="sec-s" style="margin-top:6px">Assign a provider to draft the introduction.</p>')+'</div></div>';
  return shell('bookings', body);
}

function vNewCustomer(){
  var sectors=(window.YESS?window.YESS.SECTORS:[]);
  var body='<div class="pg-head"><div><p class="kicker"><a class="link" href="#/ops/customers">Customers</a></p><h1>New customer</h1><p class="pg-sub">Enough to open the first month. Targets and the rest of the profile are set on the Organisation page after onboarding week 2.</p></div></div>'
    + '<div class="panel"><div class="row2"><div class="stack">'
    + '<div class="field"><label for="nc-name">Organisation name <span class="req">*</span></label><input type="text" id="nc-name"></div>'
    + '<div class="field"><label for="nc-type">Organisation type</label><select id="nc-type"><option>Council</option><option>Business</option><option>Government agency</option><option>Other</option></select></div>'
    + '<div class="field"><label for="nc-sector">Sector</label><select id="nc-sector">'+sectors.map(function(s){ return '<option value="'+esc(s.k)+'">'+esc(s.name)+'</option>'; }).join('')+'</select></div>'
    + '<div class="field"><label for="nc-state">State or territory</label><select id="nc-state">'+D.STATES.map(function(s){ return '<option>'+esc(s[0])+'</option>'; }).join('')+'</select></div>'
    + '<div class="field"><label for="nc-emp">Employees (FTE) <span class="req">*</span></label><input type="number" id="nc-emp" min="1"></div>'
    + '<div class="field"><label for="nc-res">Residents serviced (councils)</label><input type="number" id="nc-res" min="0"></div>'
    + '<div class="field"><label for="nc-sites">Sites operated</label><input type="number" id="nc-sites" min="0"></div></div>'
    + '<div class="stack"><div class="field"><label for="nc-fy">Baseline financial year</label><input type="text" id="nc-fy" value="'+esc(E.fyOf(E.addMonths(nowKey(),-12)))+'"><span class="hint">The year the first twelve months are compared against.</span></div>'
    + '<div class="field"><label for="nc-cname">Customer contact name <span class="req">*</span></label><input type="text" id="nc-cname"></div>'
    + '<div class="field"><label for="nc-ctitle">Contact role</label><input type="text" id="nc-ctitle" placeholder="Sustainability lead"></div>'
    + '<div class="field"><label for="nc-cemail">Contact email <span class="req">*</span></label><input type="email" id="nc-cemail"></div>'
    + '<div class="field"><label for="nc-op">Named Yarta data operator</label><select id="nc-op">'+ops().map(function(u){ return '<option value="'+esc(u.id)+'"'+(u.id===me().id?' selected':'')+'>'+esc(u.name)+'</option>'; }).join('')+'</select></div>'
    + '<div class="field"><label for="nc-first">First reporting month</label><input type="month" id="nc-first" value="'+esc(E.addMonths(nowKey(),-1))+'"></div></div></div>'
    + '<div class="pill-row" style="margin-top:14px"><button class="btn btn-primary" type="button" data-act="nc-create">Create customer and open the first month</button><a class="btn btn-ghost" href="#/ops/customers" style="color:var(--ink)">Cancel</a></div></div>';
  return shell('customers', body);
}
function createCustomer(){
  var name=($('#nc-name').value||'').trim(), emp=+($('#nc-emp').value||0), cname=($('#nc-cname').value||'').trim(), cemail=($('#nc-cemail').value||'').trim();
  if(!name){ flash('Add the organisation name.','err'); return; } if(!(emp>0)){ flash('Add the number of employees.','err'); return; }
  if(!cname||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cemail)){ flash('Add a contact name and a valid email.','err'); return; }
  var id='org-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,24)+'-'+Date.now().toString(36).slice(-4);
  var sector=$('#nc-sector').value, sec=window.YESS&&window.YESS.BY[sector];
  var profile={org_name:name, org_type:$('#nc-type').value, sector:sector, state:$('#nc-state').value, employees:emp, residents:+($('#nc-res').value||0)||'', sites:+($('#nc-sites').value||0)||'', baseline_fy:($('#nc-fy').value||'').trim(), operator:$('#nc-op').value,
    target_emissions:43, target_renewable:E.STANDARDS.renewable, target_diversion:E.STANDARDS.diversion, target_fleet_ev:30, target_trees:'', target_rehab_ha:'', target_native_ha:'', target_participants:''};
  var first=($('#nc-first').value||E.addMonths(nowKey(),-1)); if(first>nowKey()) first=nowKey();
  state.orgs[id]={id:id, profile:profile, records:[{month:first, values:{}, evidence:{}, status:'draft', inbox:[], openedAt:isoNow(), openedBy:me().name}], plan:{off:{}}};
  state.users.push({id:'u-'+id, name:cname, title:($('#nc-ctitle').value||'').trim()||'Customer contact', email:cemail, role:'customer', org:id});
  log('Customer created',name+' · '+(sec?sec.name:sector)+' · first month '+mLabel(first),id); save();
  flash(name+' created. First month open for data entry.'); state.session.viewOrg=id; save(); go('#/ops/gaps/'+id);
}

/* ------------------------------------------------------------------ operations systems, layer 2 (prototype)
   Outbox · declarations · sites · onboarding · accounts · service measures · import mappings.
   Nothing here needs a connection: anything that would send is queued in state.outbox for a later integration. */
function hashStr(str){ var h=2166136261; for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0)/4294967296; }
function r3(x){ return Math.round(x*1000)/1000; }
function daysBetween(a,b){ if(!a||!b) return null; var x=new Date(a.length<=10?a+'T00:00:00':a), y=new Date(b.length<=10?b+'T00:00:00':b); return Math.round((y-x)/864e5); }

/* --- outbox: every email Yarta would send, queued for a later integration --- */
function queueMail(kind,orgId,to,subject,body,ref){
  state.outbox=state.outbox||[];
  var u=me();
  state.outbox.unshift({id:'mx-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5), at:isoNow(), by:u?u.name:'System', kind:kind, org:orgId||'', to:to||'', subject:subject||'', body:body||'', status:'queued', ref:ref||''});
  state.outbox=state.outbox.slice(0,600);
}
var MAIL_KIND={gap:'Gap email',introduction:'Introduction',issued:'Report issued',returned:'Month returned',onboarding:'Onboarding',other:'Other'};
function customerEmails(o){ return contactsOf(o).map(function(u){ return u.email; }).filter(Boolean).join(','); }

/* --- sites --- */
function multisite(o){ return !!(o && o.sites && o.sites.length); }
function siteById(o,id){ return (o.sites||[]).filter(function(s){ return s.id===id; })[0]; }
function rv(r){ if(!SITE) return r.values||{}; return (r.sites&&r.sites[SITE]&&r.sites[SITE].values)||{}; }
function svals(r,sid){ if(!sid) return r.values; r.sites=r.sites||{}; r.sites[sid]=r.sites[sid]||{values:{}}; return r.sites[sid].values; }
function aggregateInto(o,r){
  if(!multisite(o)||!r.sites) return;
  var out={};
  D.INPUTS.forEach(function(f){
    var vs=[]; o.sites.forEach(function(s){ var sv=r.sites[s.id]&&r.sites[s.id].values; if(sv && sv[f.id]!==undefined && sv[f.id]!=='') vs.push(sv[f.id]); });
    if(!vs.length) return;
    if(f.kind==='select'||f.kind==='text') out[f.id]=vs[0];
    else if(f.kind==='percent') out[f.id]=r3(vs.reduce(function(a,b){ return a+(+b); },0)/vs.length);
    else out[f.id]=r3(vs.reduce(function(a,b){ return a+(+b); },0));
  });
  r.values=out;
}
function siteOrg(o,sid){
  var s=siteById(o,sid); if(!s) return null;
  var p={}; for(var k in o.profile) p[k]=o.profile[k];
  p.org_name=o.profile.org_name+' · '+s.name; if(s.state) p.state=s.state;
  if(+s.employees>0) p.employees=+s.employees; p.floor_area=s.floor_area||''; p.sites=''; p.facilities=1; p.residents='';
  return {id:o.id+'#'+sid, profile:p, plan:{off:{}}, site:s, records:o.records.map(function(r){ return {month:r.month, status:r.status, values:(r.sites&&r.sites[sid]&&r.sites[sid].values)||{}, evidence:r.evidence||{}, inbox:[], issuedAt:r.issuedAt, verifiedAt:r.verifiedAt, verifiedBy:r.verifiedBy, enteredAt:r.enteredAt, enteredBy:r.enteredBy}; })};
}
function splitSites(o,defs){
  o.sites=defs.map(function(d,i){ return {id:'s'+(i+1), name:d.name, kind:d.kind, state:d.state||o.profile.state, employees:d.employees, floor_area:d.floor_area||'', contact:d.contact, email:d.email, cats:d.cats, active:true}; });
  o.records.forEach(function(r){
    r.sites={}; o.sites.forEach(function(s){ r.sites[s.id]={values:{}}; });
    Object.keys(r.values||{}).forEach(function(id){
      var f=field(id), v=r.values[id]; if(!f) return;
      if(f.kind==='select'||f.kind==='text'){ r.sites[o.sites[0].id].values[id]=v; return; }
      if(f.kind==='percent'||!isNum(v)){ o.sites.forEach(function(s){ r.sites[s.id].values[id]=v; }); return; }
      var w=o.sites.map(function(s,i){ return defs[i].share*(1+0.3*(hashStr(id+s.id+r.month)-0.5)); }), sum=w.reduce(function(a,b){ return a+b; },0);
      var left=+v, isCount=f.kind==='count'||f.kind==='currency';
      o.sites.forEach(function(s,i){ var x; if(i===o.sites.length-1) x=left; else { x=+v*w[i]/sum; x=isCount?Math.round(x):r3(x); left-=x; } r.sites[s.id].values[id]=isCount?Math.round(x):r3(x); });
    });
    aggregateInto(o,r);
  });
}
function siteProgress(o,r,s){
  var due=dueFields(o,r.month).filter(function(f){ return f.req && (!s.cats||s.cats.indexOf(f.cat)>=0) && !(r.declared&&r.declared[f.cat]); }), sv=(r.sites&&r.sites[s.id]&&r.sites[s.id].values)||{};
  var got=due.filter(function(f){ return isNum(sv[f.id]) || (f.kind!=='number'&&f.kind!=='count'&&f.kind!=='currency'&&f.kind!=='percent'&&sv[f.id]); });
  return {req:got.length, reqDue:due.length, missing:due.filter(function(f){ return got.indexOf(f)<0; })};
}

/* --- declarations: "this record does not exist" --- */
function declaredCats(r){ return (r&&r.declared)||{}; }
function declare(o,k,cat,note){
  var r=rec(o,k), u=me();
  if(!r){ r={month:k, values:{}, evidence:{}, status:'draft', inbox:[]}; o.records.push(r); }
  if(r.status==='verified'||r.status==='submitted'){ flash('That month is already with verification. Ask Yarta to reopen it.','err'); return false; }
  r.declared=r.declared||{}; r.declared[cat]={by:u.name, role:u.role, at:isoNow(), note:note||''};
  log('Category declared not reported',D.CAT[cat].name+' · '+mLabel(k)+(note?' · '+note:''),o.id); save(); return true;
}

/* --- onboarding tracker (steps live in sectors.js so the public page and the tool share one list) --- */
function onbSteps(){ return (window.YESS&&window.YESS.ONBOARDING)||[]; }
function onbInit(start){ return {start:start||today(), done:{}, notes:[]}; }
function onbProgress(o){
  var st=onbSteps(), ob=o.onboarding||onbInit(), done=st.filter(function(s){ return ob.done[s.k]; }).length;
  var weeks=[1,2,3,4].map(function(w){ var ws=st.filter(function(s){ return s.week===w; }); return {w:w, total:ws.length, done:ws.filter(function(s){ return ob.done[s.k]; }).length, due:addDays(ob.start,7*w)}; });
  var overdue=st.filter(function(s){ return !ob.done[s.k] && addDays(ob.start,7*s.week).toISOString().slice(0,10)<today(); });
  return {done:done, total:st.length, pct:st.length?Math.round(done/st.length*100):0, weeks:weeks, overdue:overdue, live:done===st.length, day:Math.max(0,daysBetween(ob.start,today()))};
}
function addDays(d,n){ var x=new Date(typeof d==='string'?(d.length<=10?d+'T00:00:00':d):d); x.setDate(x.getDate()+n); return x; }

/* --- accounts --- */
function priceFor(p){
  if(p.org_type==='Council'){ var r=+p.residents||0; return r<=50000?{tier:'Council up to 50,000 residents',monthly:1999}:{tier:'Council over 50,000 residents',monthly:null}; }
  var e=+p.employees||0; if(e<=30) return {tier:'Business up to 30 staff',monthly:999}; if(e<=100) return {tier:'Business 31 to 100 staff',monthly:1999}; return {tier:'Business over 100 staff',monthly:2999};
}
function subOf(o){ return o.subscription||{status:'none'}; }
function monthlyOf(o){ var s=subOf(o); if(s.monthlyOverride!=null&&s.monthlyOverride!=='') return +s.monthlyOverride; var pf=priceFor(o.profile); return pf.monthly; }
function renewalOf(o){ var s=subOf(o); if(!s.start) return null; var d=new Date(s.start+'T00:00:00'); d.setMonth(d.getMonth()+(+s.termMonths||12)); return d.toISOString().slice(0,10); }

/* --- import mappings --- */
function defaultMat(){
  return {'cardboard':'paper_t','paper':'paper_t','paper and cardboard':'paper_t','glass':'glass_t','steel':'steel_t','scrap metal':'steel_t','metal':'steel_t','aluminium':'alu_t','aluminum':'alu_t','timber':'timber_t','wood':'timber_t','treated timber':'timber_treated_t','green waste':'green_t','garden organics':'green_t','vegetation':'green_t','food organics':'food_t','food waste':'food_t','organics':'organics_t','fogo':'organics_t','concrete':'concrete_t','bricks':'rubble_t','rubble':'rubble_t','soil':'soil_t','plasterboard':'plaster_t','e-waste':'ewaste_t','ewaste':'ewaste_t','electronics':'ewaste_t','mattress':'mattress_n','mattresses':'mattress_n','tyres':'tyres_n','tires':'tyres_n','whitegoods':'whitegoods_n','white goods':'whitegoods_n','furniture':'furniture_t','textiles':'textiles_t','clothing':'textiles_t','batteries':'batteries_kg','problem waste':'problem_kg','soft plastics':'film_t','plastic film':'film_t','pallets':'pallets_n','waste oil':'oil_l','used oil':'oil_l','comingled':'recycling_t','commingled':'recycling_t','mixed recycling':'recycling_t','recycling':'recycling_t','general waste':'landfill_t','landfill':'landfill_t','residual':'landfill_t','garbage':'landfill_t','mixed waste':'landfill_t','clinical waste':'clinical_t','sharps':'sharps_kg'};
}
function defaultImportMaps(){
  return {
    'Group weighbridge (Recycle Group)':{kind:'group', grade:'A', source:'Weighbridge docket, Recycle Group', cols:{}, mat:defaultMat(), unit:'kg', note:'Net weight per docket. Map the export\'s columns once; the mapping is remembered.'},
    'Contractor service log':{kind:'contractor', grade:'B', source:'Contractor report', cols:{}, mat:defaultMat(), unit:'kg', note:'Any waste or recycling contractor\'s monthly export. Save one mapping per contractor.'}
  };
}

/* --- seeds for demo data --- */
function seedOps2(s){
  if(s.ops2) return; s.ops2=true;
  s.outbox=s.outbox||[]; s.importMaps=s.importMaps||defaultImportMaps(); s.guideNotes=s.guideNotes||[];
  var steps=onbSteps(), t0=today();
  Object.keys(s.orgs).forEach(function(id,i){
    var o=s.orgs[id], start=addDays(t0,-(300+i*11)).toISOString().slice(0,10), done={};
    steps.forEach(function(st){ done[st.k]={at:start,by:'Yarta team'}; });
    o.onboarding={start:start, done:done, notes:[]};
    if(id==='demo-freight'){ var st2=addDays(t0,-16).toISOString().slice(0,10); done={}; steps.forEach(function(x){ if(x.week<=2||x.k==='firstmonth') done[x.k]={at:st2,by:'Morgan Lee'}; }); o.onboarding={start:st2, done:done, notes:[]}; }
    var found=(id==='demo-shire'||id==='demo-coastal'||id==='demo-office');
    o.subscription={status:id==='demo-freight'?'pilot':'active', foundation:found, start:addDays(t0,-(240-i*9)).toISOString().slice(0,10), termMonths:12, monthlyOverride:'', estFee:found?0:8000, estStatus:found?'waived':'paid', notes:found?'Foundation Member':''};
  });
  if(s.orgs['demo-retail'] && !s.orgs['demo-retail'].sites) splitSites(s.orgs['demo-retail'],[
    {name:'Head office', kind:'Head office', share:.08, employees:220, floor_area:6200, contact:'Hannah Park', email:'hannah.park@demo-grocers.example', cats:['energy','water','waste','governance','circular','community']},
    {name:'Distribution centre', kind:'Distribution centre', share:.24, employees:310, floor_area:24000, contact:'Ravi Menon', email:'ravi.menon@demo-grocers.example', cats:['energy','fleet','water','waste']},
    {name:'Stores · Metro', kind:'Store', share:.30, employees:640, floor_area:9800, contact:'Store operations', email:'stores.metro@demo-grocers.example', cats:['energy','water','waste']},
    {name:'Stores · Regional', kind:'Store', share:.22, employees:480, floor_area:7200, contact:'Store operations', email:'stores.regional@demo-grocers.example', cats:['energy','water','waste']},
    {name:'Stores · Coastal', kind:'Store', share:.16, employees:250, floor_area:4800, contact:'Store operations', email:'stores.coastal@demo-grocers.example', cats:['energy','water','waste']}]);
  if(s.orgs['demo-freight'] && !s.orgs['demo-freight'].sites) splitSites(s.orgs['demo-freight'],[
    {name:'Depot · Brisbane', kind:'Depot', share:.36, employees:70, floor_area:9000, contact:'Jordan Blake', email:'jordan.blake@demo-freight.example', cats:['energy','fleet','water','waste']},
    {name:'Depot · Gold Coast', kind:'Depot', share:.27, employees:48, floor_area:6000, contact:'Depot manager', email:'goldcoast@demo-freight.example', cats:['energy','fleet','water','waste']},
    {name:'Depot · Toowoomba', kind:'Depot', share:.22, employees:36, floor_area:4500, contact:'Depot manager', email:'toowoomba@demo-freight.example', cats:['energy','fleet','water','waste']},
    {name:'Head office', kind:'Head office', share:.15, employees:26, floor_area:2500, contact:'Jordan Blake', email:'jordan.blake@demo-freight.example', cats:['energy','water','waste','governance']}]);
}
/* ------------------------------------------------------------------ outbox */
function vOutbox(){
  var all=state.outbox||[], tab=parseHash().q.t||'queued', list=all.filter(function(m){ return tab==='all'||m.status===tab; });
  var nq=all.filter(function(m){ return m.status==='queued'; }).length;
  var tabs=[['queued','Queued ('+nq+')'],['sent','Sent'],['all','All']].map(function(t){ return '<a class="btn btn-sm '+(tab===t[0]?'btn-ink':'btn-ghost')+'" href="#/ops/outbox?t='+t[0]+'"'+(tab===t[0]?'':' style="color:var(--ink)"')+'>'+t[1]+'</a>'; }).join('');
  var rows=list.slice(0,80).map(function(m){ var o=m.org&&state.orgs[m.org];
    return '<tr><td class="small mono">'+esc(new Date(m.at).toLocaleString('en-AU'))+'</td><td>'+esc(MAIL_KIND[m.kind]||m.kind)+'</td><td>'+esc(o?o.profile.org_name:'')+'</td><td><details><summary style="cursor:pointer"><b style="font-weight:600">'+esc(m.subject)+'</b><div class="small muted">To '+esc(m.to||'no address on file')+' · queued by '+esc(m.by)+'</div></summary><pre class="mailbody">'+esc(m.body)+'</pre></details></td><td>'+(m.status==='queued'?'<span class="st st-submitted">Queued</span>':'<span class="st st-verified">Sent '+esc(m.sentAt?longDate(m.sentAt):'')+'</span>')+'</td><td><div class="pill-row">'+(m.status==='queued'?'<button class="btn btn-ghost btn-sm" type="button" data-act="mx-sent" data-id="'+esc(m.id)+'" style="color:var(--ink)">Mark sent</button>':'')+'<button class="btn btn-ghost btn-sm" type="button" data-act="mx-copy" data-id="'+esc(m.id)+'" style="color:var(--ink)">Copy</button></div></td></tr>'; }).join('');
  var body='<div class="pg-head"><div><p class="kicker">Yarta team</p><h1>Outbox</h1><p class="pg-sub">Every email Yarta would send is queued here: gap emails, introductions, "report issued" notices and returned months. Nothing leaves this browser. In production a scheduled function reads this queue, sends each message and marks it sent, so the export below is the integration contract.</p></div><div class="pg-actions"><button class="btn btn-ink btn-sm" type="button" data-act="mx-export">Export queue (JSON)</button></div></div>'
    + '<div class="pill-row" style="margin-bottom:14px">'+tabs+'</div>'
    + (rows?'<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Queued</th><th>Kind</th><th>Organisation</th><th>Message</th><th>Status</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty">Nothing here.</div>');
  return shell('outbox', body);
}

/* ------------------------------------------------------------------ onboarding */
function vOnboarding(orgId){
  var st=onbSteps();
  if(!orgId){
    var rows=Object.keys(state.orgs).map(function(id){ var o=state.orgs[id], p=onbProgress(o), ob=o.onboarding; if(!ob) return '';
      return '<tr><td><b>'+esc(o.profile.org_name)+'</b><div class="small muted">Started '+longDate(ob.start)+' · '+esc((operatorOf(o)||{}).name||'No operator')+'</div></td><td>'+(p.live?'<span class="st st-verified">Live</span>':'<span class="st st-submitted">Day '+p.day+' of 30</span>')+'</td><td style="min-width:180px"><div class="progress"><i style="width:'+p.pct+'%"></i></div><div class="small muted">'+p.done+' of '+p.total+' steps</div></td><td class="num">'+(p.overdue.length?'<span style="color:var(--red)">'+p.overdue.length+' overdue</span>':'—')+'</td><td><a class="btn btn-primary btn-sm" href="#/ops/onboarding/'+id+'">Open</a></td></tr>'; }).join('');
    return shell('onboarding','<div class="pg-head"><div><p class="kicker">Yarta team</p><h1>Onboarding</h1><p class="pg-sub">The 30-day plan for every customer: the same thirteen steps as the public Onboarding page. Each step has a week; a step is overdue when its week has ended.</p></div></div><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Organisation</th><th>Status</th><th>Progress</th><th class="r">Overdue</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>');
  }
  var o=state.orgs[orgId]; if(!o) return vNotFound(); o.onboarding=o.onboarding||onbInit(); var ob=o.onboarding, p=onbProgress(o);
  var weeks=[1,2,3,4].map(function(w){ var wp=p.weeks[w-1];
    return '<div class="panel" style="margin-top:16px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><h3>Week '+w+'</h3><span class="small muted">Due '+longDate(wp.due)+' · '+wp.done+' of '+wp.total+'</span></div><div class="stack" style="margin-top:12px">'
      + st.filter(function(s){ return s.week===w; }).map(function(s){ var d=ob.done[s.k], late=!d && addDays(ob.start,7*w).toISOString().slice(0,10)<today();
        return '<div class="onb-row'+(d?' done':'')+'"><button class="onb-tick" type="button" data-act="onb-toggle" data-org="'+orgId+'" data-k="'+s.k+'" aria-pressed="'+(d?'true':'false')+'" aria-label="Mark '+esc(s.label)+(d?' not done':' done')+'">'+(d?'✓':'')+'</button><div><b>'+esc(s.label)+'</b>'+(late?' <span class="st st-returned">Overdue</span>':'')+'<div class="small"><span class="muted">Customer:</span> '+esc(s.you)+'</div><div class="small"><span class="muted">Yarta:</span> '+esc(s.us)+'</div>'+(d?'<div class="small muted">Done '+longDate(d.at)+' by '+esc(d.by)+'</div>':'')+'</div></div>'; }).join('')+'</div></div>'; }).join('');
  var body='<div class="pg-head"><div><p class="kicker"><a class="link" href="#/ops/onboarding">Onboarding</a></p><h1>'+esc(o.profile.org_name)+'</h1><p class="pg-sub">Started '+longDate(ob.start)+' · '+(p.live?'live':'day '+p.day+' of 30')+' · '+p.done+' of '+p.total+' steps · data operator '+esc((operatorOf(o)||{}).name||'not assigned')+'</p></div><div class="pg-actions"><a class="btn btn-ink btn-sm" href="#/ops/checklist/'+orgId+'">Data request checklist</a></div></div>'
    + '<div class="progress" style="margin-bottom:6px"><i style="width:'+p.pct+'%"></i></div>'+weeks;
  return shell('onboarding', body);
}

/* ------------------------------------------------------------------ data request checklist for one customer */
function checklistHtml(secKey){
  var S=window.YESS, items=S.checklist(secKey), cats={}; items.forEach(function(x){ (cats[x.cat]=cats[x.cat]||[]).push(x); });
  return Object.keys(cats).map(function(c){ return '<h4 style="margin:18px 0 6px">'+esc(D.CAT[c]?D.CAT[c].name:c)+'</h4><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>What to send</th><th>Who usually holds it</th><th>How often</th><th>Evidence grade</th></tr></thead><tbody>'+cats[c].map(function(x){ return '<tr><td>'+esc(x.item)+'</td><td>'+esc(x.holder)+'</td><td>'+esc(x.freq)+'</td><td class="small">'+esc(x.evidence)+'</td></tr>'; }).join('')+'</tbody></table></div>'; }).join('');
}
function vChecklist(orgId){
  var o=orgId?state.orgs[orgId]:org(); if(!o) return vNotFound(); var sec=window.YESS.BY[o.profile.sector]||window.YESS.BY.business;
  var body='<div class="pg-head"><div><p class="kicker">'+(isOp()?'<a class="link" href="#/ops/onboarding/'+o.id+'">Onboarding</a>':'Documents')+'</p><h1>What to send Yarta</h1><p class="pg-sub">For '+esc(o.profile.org_name)+' ('+esc(sec.name)+'). The documents Yarta enters your figures from, who usually holds them and how often they are due. If a record does not exist, say so and the category is marked not reported: it is left out of the score, never guessed.</p></div><div class="pg-actions no-print"><button class="btn btn-ink btn-sm" type="button" data-act="print">Print</button></div></div>'
    + '<div class="panel">'+checklistHtml(sec.k)+'</div>';
  return shell(isOp()?'onboarding':'documents', body);
}

/* ------------------------------------------------------------------ accounts */
function vAccounts(orgId){
  var ids=Object.keys(state.orgs), mrr=0, active=0, found=0, ren=[];
  var rows=ids.map(function(id){ var o=state.orgs[id], s=subOf(o), pf=priceFor(o.profile), m=monthlyOf(o), rn=renewalOf(o);
    if(s.status==='active'){ active++; if(m) mrr+=m; } if(s.foundation) found++;
    if(rn && (s.status==='active'||s.status==='pilot') && rn<=addDays(new Date(),90).toISOString().slice(0,10)) ren.push(o.profile.org_name+' ('+longDate(rn)+')');
    return '<tr><td><b>'+esc(o.profile.org_name)+'</b><div class="small muted">'+esc(pf.tier)+'</div></td><td><span class="st st-'+(s.status==='active'?'verified':s.status==='pilot'?'submitted':'draft')+'">'+esc(s.status||'none')+'</span>'+(s.foundation?' <span class="chip">Foundation</span>':'')+'</td><td class="num">'+(m?'$'+fmt(m,0):'<span class="muted">On application</span>')+'</td><td>'+(s.estStatus==='waived'?'Waived':s.estStatus==='paid'?'Paid $'+fmt(s.estFee,0):s.estStatus==='invoiced'?'Invoiced $'+fmt(s.estFee,0):'Not yet invoiced')+'</td><td>'+(s.start?longDate(s.start):'—')+'</td><td>'+(rn?longDate(rn):'—')+'</td><td><a class="btn btn-ghost btn-sm" href="#/ops/accounts/'+id+'" style="color:var(--ink)">Edit</a></td></tr>'; }).join('');
  var edit='';
  if(orgId && state.orgs[orgId]){ var o2=state.orgs[orgId], s2=subOf(o2); var pf2=priceFor(o2.profile);
    edit='<div class="panel" style="margin-top:22px"><h3>'+esc(o2.profile.org_name)+'</h3><p class="sec-s" style="margin-top:6px">List price for this size: '+(pf2.monthly?'$'+fmt(pf2.monthly,0)+' a month':'on application')+' · '+esc(pf2.tier)+'. Annual subscription, priced by the month.</p><div class="row2" style="margin-top:12px"><div class="stack">'
      +'<div class="field"><label for="ac-status">Status</label><select id="ac-status">'+['active','pilot','ended','none'].map(function(x){ return '<option'+(s2.status===x?' selected':'')+'>'+x+'</option>'; }).join('')+'</select></div>'
      +'<div class="field"><label for="ac-start">Switch-on date</label><input type="date" id="ac-start" value="'+esc(s2.start||'')+'"></div>'
      +'<div class="field"><label for="ac-term">Term (months)</label><input type="number" id="ac-term" value="'+esc(s2.termMonths||12)+'" min="1"><span class="hint">Contract term is unconfirmed; 12 months is the working assumption.</span></div>'
      +'<div class="field"><label for="ac-mo">Monthly fee override ($)</label><input type="number" id="ac-mo" value="'+esc(s2.monthlyOverride||'')+'" min="0" placeholder="List price"></div></div><div class="stack">'
      +'<div class="field"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ac-found"'+(s2.foundation?' checked':'')+'> Foundation Member (establishment fee waived)</label></div>'
      +'<div class="field"><label for="ac-fee">Establishment fee ($)</label><input type="number" id="ac-fee" value="'+esc(s2.estFee||0)+'" min="0"><span class="hint">Normally $5,000 to $15,000.</span></div>'
      +'<div class="field"><label for="ac-est">Establishment fee status</label><select id="ac-est">'+['waived','not invoiced','invoiced','paid'].map(function(x){ return '<option value="'+(x==='not invoiced'?'':x)+'"'+((s2.estStatus||'')===(x==='not invoiced'?'':x)?' selected':'')+'>'+x+'</option>'; }).join('')+'</select></div>'
      +'<div class="field"><label for="ac-notes">Notes</label><textarea id="ac-notes" style="min-height:60px">'+esc(s2.notes||'')+'</textarea></div></div></div><div class="pill-row" style="margin-top:12px"><button class="btn btn-primary btn-sm" type="button" data-act="ac-save" data-org="'+orgId+'">Save</button><a class="btn btn-ghost btn-sm" href="#/ops/accounts" style="color:var(--ink)">Cancel</a></div></div>'; }
  var body='<div class="pg-head"><div><p class="kicker">Yarta team</p><h1>Accounts</h1><p class="pg-sub">Who is subscribed, at what tier, when the term ends and where the establishment fee stands. Prices are the list prices on the pricing page. Demo organisations are fictional, so the totals below are illustrative.</p></div></div>'
    + '<div class="ops-grid">'
    + '<div class="panel metric"><div class="k">Monthly recurring (list)</div><div class="v">$'+fmt(mrr,0)+'</div><div class="s">Active subscriptions with a list price</div></div>'
    + '<div class="panel metric"><div class="k">Annualised</div><div class="v">$'+fmt(mrr*12,0)+'</div><div class="s">Monthly recurring × 12</div></div>'
    + '<div class="panel metric"><div class="k">Active · Foundation</div><div class="v">'+active+' · '+found+'</div><div class="s">Establishment fee waived for Foundation Members</div></div>'
    + '<div class="panel metric"><div class="k">Renewals in 90 days</div><div class="v">'+ren.length+'</div><div class="s">'+esc(ren.join('; ')||'None')+'</div></div></div>'
    + '<div class="tbl-wrap" style="margin-top:22px"><table class="tbl compact"><thead><tr><th>Organisation</th><th>Status</th><th class="r">Monthly</th><th>Establishment fee</th><th>Switched on</th><th>Term ends</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>'+edit;
  return shell('accounts', body);
}

/* ------------------------------------------------------------------ service measures */
function vService(){
  var rows=[], sums={dv:[],ve:[],de:[]};
  Object.keys(state.orgs).forEach(function(id){ var o=state.orgs[id]; sorted(o).slice(-6).forEach(function(r){
    var docs=(r.inbox||[]).map(function(d){ return d.at; }).sort()[0], last=(r.inbox||[]).map(function(d){ return d.at; }).sort().slice(-1)[0];
    var dv=daysBetween(last,r.verifiedAt), ve=daysBetween(r.verifiedAt,r.issuedAt), de=daysBetween(last,r.enteredAt);
    if(dv!=null) sums.dv.push(dv); if(ve!=null) sums.ve.push(ve); if(de!=null) sums.de.push(de);
    rows.push({o:o,r:r,docs:last,dv:dv,ve:ve,de:de});
  }); });
  rows.sort(function(a,b){ return a.r.month<b.r.month?1:-1; });
  function avg(a){ return a.length?Math.round(a.reduce(function(x,y){ return x+y; },0)/a.length*10)/10:null; }
  var T={dv:10, ve:3};
  var over=rows.filter(function(x){ return (x.dv!=null&&x.dv>T.dv)||(x.ve!=null&&x.ve>T.ve); }).length;
  var open=[]; Object.keys(state.orgs).forEach(function(id){ state.orgs[id].records.forEach(function(r){ if(r.status==='draft'||r.status==='returned'||r.status==='submitted') open.push({o:state.orgs[id],r:r}); }); });
  var late=open.filter(function(x){ return dueDate(x.r.month)<new Date() && x.r.status!=='verified'; }).length;
  var body='<div class="pg-head"><div><p class="kicker">Yarta team</p><h1>Service</h1><p class="pg-sub">How fast a month moves through Yarta: documents received, entered, verified, issued. The targets are working proposals and need confirmation: documents to verified within '+T.dv+' days, verified to issued within '+T.ve+' days. Every figure comes from the timestamps the tool already records.</p></div></div>'
    + '<div class="ops-grid">'
    + '<div class="panel metric"><div class="k">Documents to entered</div><div class="v">'+(avg(sums.de)==null?'—':avg(sums.de))+'<span class="u"> days</span></div><div class="s">Average, last six months per customer</div></div>'
    + '<div class="panel metric"><div class="k">Documents to verified</div><div class="v">'+(avg(sums.dv)==null?'—':avg(sums.dv))+'<span class="u"> days</span></div><div class="s">Target '+T.dv+' days</div></div>'
    + '<div class="panel metric"><div class="k">Verified to issued</div><div class="v">'+(avg(sums.ve)==null?'—':avg(sums.ve))+'<span class="u"> days</span></div><div class="s">Target '+T.ve+' days</div></div>'
    + '<div class="panel metric'+(over||late?' ops-card warn':'')+'"><div class="k">Outside target · past due</div><div class="v">'+over+' · '+late+'</div><div class="s">Months over target · open months past the 15th</div></div></div>'
    + '<div class="tbl-wrap" style="margin-top:22px"><table class="tbl compact"><thead><tr><th>Organisation</th><th>Month</th><th>Last document</th><th class="r">To entered</th><th class="r">To verified</th><th class="r">Verified to issued</th><th>Status</th></tr></thead><tbody>'
    + rows.slice(0,40).map(function(x){ function c(v,t){ return v==null?'<span class="muted">—</span>':'<span'+(t&&v>t?' style="color:var(--red);font-weight:600"':'')+'>'+v+'</span>'; }
      return '<tr><td>'+esc(x.o.profile.org_name)+'</td><td>'+mLabel(x.r.month)+'</td><td>'+(x.docs?longDate(x.docs):'—')+'</td><td class="num">'+c(x.de)+'</td><td class="num">'+c(x.dv,T.dv)+'</td><td class="num">'+c(x.ve,T.ve)+'</td><td>'+statusChip(x.r.status)+(x.r.issuedAt?' <span class="chip">Issued</span>':'')+'</td></tr>'; }).join('')
    + '</tbody></table></div>';
  return shell('service', body);
}

/* ------------------------------------------------------------------ analyst manual */
function vSop(){
  function sec(n,t,html){ return '<div class="panel" style="margin-top:16px" id="sop-'+n+'"><p class="kicker">'+n+'</p><h3>'+t+'</h3><div class="sop">'+html+'</div></div>'; }
  var body='<div class="pg-head"><div><p class="kicker">Yarta team</p><h1>Analyst manual</h1><p class="pg-sub">How a month is run, start to finish. The rules come from the Yarta Method; this is the procedure. If something here and the method disagree, the method wins and this page is wrong.</p></div><div class="pg-actions no-print"><button class="btn btn-ink btn-sm" type="button" data-act="print">Print</button></div></div>'
  + sec('01','The rhythm of a month','<ul><li><b>1st:</b> gap emails go out for the month just ended (Gap emails page). Customers who have sent everything get none.</li><li><b>1st to 15th:</b> documents arrive by email or upload. Open the month, key the figures, attach the evidence.</li><li><b>15th:</b> documents due. Chase what is missing (a second gap email, by phone for councils). After the 15th a missing category is <i>declared not reported</i> with the customer\'s word for it, not guessed.</li><li><b>By the 25th:</b> entered and sent for verification.</li><li><b>Verification:</b> a different analyst checks it within ten days of the last document arriving.</li><li><b>Issue:</b> within three days of verification, on the Reports to issue page.</li></ul>')
  + sec('02','Opening a month','<ol><li>Today shows customers whose next month can be opened. Open it from the Gap emails page or Data entry.</li><li>Check the customer\'s documents (Customer documents). Tag each to a category and, for multi-site customers, to a site.</li><li>Check the register fields first (vehicles, floor area, sites). If something changed this month, update the register; otherwise leave it, and the last value carries forward.</li></ol>')
  + sec('03','Entering figures','<ul><li><b>Raw numbers only.</b> Litres, kWh, GJ, kL, tonnes, counts. Never type a percentage the customer calculated; the only percentages entered are measured ones, such as a bin audit\'s contamination rate.</li><li><b>Read the unit on the bill.</b> Gas is often MJ (÷1,000 for GJ) or kWh (×0.0036 for GJ). Water is kL, sometimes ML (×1,000). Fuel is litres, not dollars. See the field guide.</li><li><b>Sum, do not average.</b> Several meters or bills in a month are added.</li><li><b>Sites:</b> enter each figure under the site that incurred it. The organisation total is calculated; never edit it.</li><li><b>Waste in bins or cubic metres:</b> convert only with the method\'s unit weights, and note it in the evidence description. The evidence then grades B or C, not A.</li><li><b>Never estimate silently.</b> If a number is an estimate, the evidence grade says so. If it does not exist, declare the category not reported.</li><li><b>Flags:</b> a figure more than 35% different from last year or last month is flagged. Check the document again before you accept it. A real change stays; a typo does not.</li></ul>')
  + sec('04','Grading evidence','<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Grade</th><th>What it is</th><th>Examples</th><th>Check</th></tr></thead><tbody><tr><td><b>A</b></td><td>A primary document</td><td>Retailer bill, fuel-card statement, weighbridge docket, processor certificate, water bill</td><td>Customer name, site, period and the total on the document match what you keyed</td></tr><tr><td><b>B</b></td><td>A system extract or a reconciled internal record</td><td>Contractor report, telematics export, fleet register, planting register, program register</td><td>The report covers the whole month and the whole site; totals reconcile to the lines</td></tr><tr><td><b>C</b></td><td>An estimate or a figure without a document yet</td><td>A stated number by email, an estimate from bin lifts</td><td>Say how it was estimated; ask for the document; it lowers the Governance evidence share until it arrives</td></tr></tbody></table></div><p class="small">The grader of a month is the verifier, not the person who entered it. The entering analyst can suggest a grade in the evidence note.</p>')
  + sec('05','Verifying a month','<ol><li>Open the month in Verification. It shows every figure beside last month and last year.</li><li>Open each document and check the figure on the screen against the figure on the document. A total, a unit, a period, a site.</li><li>Look at every flag. Either it is real (leave it and note why) or it is wrong (return it).</li><li>Check declared categories: who declared them and what they said.</li><li>Grade every attached document. The month cannot be verified with an ungraded document.</li><li>Verify, or return with a note. <b>Nobody verifies a month they entered.</b></li></ol>')
  + sec('06','Returning a month','<p>Return a month when a figure disagrees with its document, a document is missing for a figure that must be evidenced, a unit is wrong, or a site is wrong. Write the note so the person entering can fix it without asking you: <i>which figure, what the document says, what is keyed</i>. A returned month goes back to the analyst who entered it, and they are told through the Outbox.</p>')
  + sec('07','"Not reported" declarations','<p>A customer or analyst can declare that a category has no record for the month: nothing to send, the meter does not exist, the program did not run. A declaration names who said it and when. The category is left out of the score and marked <i>not reported</i> on the report, and its required figures no longer block the month. Do not declare on a customer\'s behalf without their word in writing (an email reply is enough; attach it as the evidence). Never use a declaration to avoid a difficult document.</p>')
  + sec('08','Sites','<p>Customers with more than one site have a register of sites. Entry is by site; the organisation total is the sum. Each site has its own score and report. A site that does not report a category (a head office has no fleet) says so in its site profile, and the gap email does not ask for it. A new site starts empty; do not back-fill it from the total.</p>')
  + sec('09','Issuing a report','<p>A verified month is not a report until it is issued. Preview it. Read page 1 as the customer will: is the score plausible against last month, are the four headline figures right, does the roadmap say something a person could act on? Issue it. The customer is told through the Outbox. If a customer later finds an error, reopen the month from Reports to issue (Issued), correct it, verify it again with a different analyst, and issue it again. The report notes that it replaces an earlier version. Corrections we make are free.</p>')
  + sec('10','Providers and introductions','<p>Only introduce a provider whose accreditation is current on the Providers page. Check the number against the register (Clean Energy Council, the state licensing register, the EPA licence). Record the date you checked. Introduce by email from the Bookings page once the customer has confirmed the time. The contract is between the customer and the provider; Yarta is not a party and takes no fee.</p>')
  + sec('11','Import files','<p>For a contractor or weighbridge export, use Import. Map the columns once per contractor; the mapping is saved. Check the unmatched-material list before importing, and read the preview totals against the contractor\'s own summary. An import replaces the values it covers for that month and site; it does not add to them. Imported evidence is graded by the verifier like any other document.</p>')
  + sec('12','What analysts never do','<ul><li>Verify a month they entered.</li><li>Guess a figure, or copy last month\'s number forward for a monthly field.</li><li>Show one customer another\'s data, or a benchmark built from customer data.</li><li>Tell a customer their score is accredited, certified or verified by a third party.</li><li>Present avoided emissions as an offset, or deduct them from the inventory.</li><li>Edit a verified or issued month without reopening it.</li><li>Send a customer\'s document to a provider without the customer agreeing.</li></ul>');
  return shell('sop', body);
}

/* ------------------------------------------------------------------ field guide: reading bills and reports */
function vGuides(){
  var notes=state.guideNotes||[];
  var conv='<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>You see</th><th>Yarta needs</th><th>Do this</th></tr></thead><tbody>'
    +[['Gas in MJ','GJ','÷ 1,000'],['Gas in kWh','GJ','× 0.0036'],['Gas in therms or m³','GJ','Ask the retailer for the energy content; do not guess'],['Electricity in MWh','kWh','× 1,000'],['Water in ML','kL','× 1,000'],['Water in litres','kL','÷ 1,000'],['Fuel in dollars','Litres','Ask for the litres; the dollar amount is not evidence'],['Waste in kg','t','÷ 1,000'],['Waste in bins or lifts','t','Only with the method\'s unit weights; grade B or C, and say so'],['Waste in m³','t','Only with the method\'s density table; grade B or C'],['Tyres, mattresses, whitegoods','Count','Enter the count; Yarta applies the unit weight']].map(function(x){ return '<tr><td>'+x[0]+'</td><td>'+x[1]+'</td><td>'+x[2]+'</td></tr>'; }).join('')+'</tbody></table></div>';
  function doc(t,where,pit){ return '<div class="panel" style="margin-top:14px"><h3>'+t+'</h3><p class="small"><b>Where to look:</b> '+where+'</p><p class="small"><b>Common traps:</b> '+pit+'</p></div>'; }
  var noteRows=notes.map(function(n,i){ return '<tr><td><b>'+esc(n.who)+'</b></td><td>'+esc(n.type)+'</td><td class="small">'+esc(n.note)+'</td><td class="small muted">'+esc(n.by)+' · '+longDate(n.at)+'</td><td><button class="btn btn-ghost btn-sm" type="button" data-act="gd-del" data-i="'+i+'" style="color:var(--ink)">Remove</button></td></tr>'; }).join('');
  var body='<div class="pg-head"><div><p class="kicker">Yarta team</p><h1>Field guide</h1><p class="pg-sub">Reading the documents customers send. The general guide is below; retailer- and contractor-specific notes are added by analysts as they learn where each one puts the number. Nothing is written here about a specific retailer\'s layout until an analyst has seen it.</p></div></div>'
    + '<div class="panel"><h3>Units and conversions</h3>'+conv+'</div>'
    + doc('Electricity bill','The usage summary: total kWh for the period, split by peak, off-peak and shoulder (add them). Solar export or feed-in is separate from consumption. GreenPower or renewable share is usually a line under the charges or in the plan name.','Two meters on one bill. A bill period that straddles two months (split by days only if the customer has no monthly data). Demand charges are not usage. Estimated reads are flagged on the bill; note them.')
    + doc('Gas bill','Total usage for the period, in MJ or GJ, sometimes with a heating value. Sum all meters.','MJ read as GJ (a factor of 1,000). Standing charges are not usage.')
    + doc('Fuel-card statement','Litres by product for each card or vehicle over the month. Fuel type matters (diesel, petrol, LPG, biodiesel) because the factors differ.','Dollar totals. Cards that include convenience-store purchases. Reimbursed fuel outside the card.')
    + doc('Water bill','Usage in kL for the period, split by potable, recycled and sewage where shown. Sewage and trade-waste charges are not water use.','Quarterly bills spanning months. ML vs kL. Separate meters for irrigation.')
    + doc('Waste or recycling contractor report','Tonnes by stream for the month, and general waste to landfill separately. Bin lifts with weights if that is all there is.','Reports in bins or lifts, not tonnes. Contamination rejected at the facility (counts against recovery). Comingled shown as recycled when part is rejected.')
    + doc('Weighbridge docket or summary','Net weight (gross less tare), material, date, customer. The summary total should equal the sum of the dockets.','Gross weights. Two loads on one docket. A material code, not a name.')
    + '<div class="panel" style="margin-top:14px"><h3>Notes from analysts</h3><p class="sec-s" style="margin-top:6px">Retailer, contractor or council specifics: where the number is, what the traps are. Add a note the first time you learn one.</p>'
    + (noteRows?'<div class="tbl-wrap" style="margin-top:12px"><table class="tbl compact"><thead><tr><th>Who</th><th>Document</th><th>Note</th><th>Added</th><th></th></tr></thead><tbody>'+noteRows+'</tbody></table></div>':'<p class="sec-s" style="margin-top:10px">No notes yet.</p>')
    + '<div class="row2" style="margin-top:14px"><div class="field"><label for="gd-who">Retailer, contractor or council</label><input type="text" id="gd-who"></div><div class="field"><label for="gd-type">Document</label><select id="gd-type"><option>Electricity bill</option><option>Gas bill</option><option>Fuel-card statement</option><option>Water bill</option><option>Contractor report</option><option>Weighbridge docket</option><option>Other</option></select></div></div><div class="field"><label for="gd-note">What you learned</label><textarea id="gd-note" style="min-height:70px"></textarea></div><button class="btn btn-primary btn-sm" type="button" data-act="gd-add">Add note</button></div>';
  return shell('guides', body);
}
/* ------------------------------------------------------------------ sites */
var SITE_KINDS=['Head office','Store','Depot','Distribution centre','Plant','Campus','Facility','Other'];
function vSites(editId){
  var o=org(), op=isOp(); if(!multisite(o) && !op) return vNotFound();
  var body;
  if(!multisite(o)){
    body='<div class="pg-head"><div><p class="kicker">Sites</p><h1>'+esc(o.profile.org_name)+'</h1><p class="pg-sub">This customer is reported as one organisation. Start tracking by site to enter figures per site, send one gap email per site and issue a report for each site alongside the organisation report.</p></div></div>'
      +'<div class="panel">'+siteForm(o,{id:'',name:'',kind:'Facility',state:o.profile.state,employees:'',floor_area:'',contact:'',email:'',cats:['energy','water','waste']},true)+'</div>';
    return shell('sites', body);
  }
  var S=seriesOf(o), last=S.months.length?S.months[S.months.length-1].month:null;
  var rows=o.sites.map(function(s){ var so=siteOrg(o,s.id), Ss=seriesOf(so), m=Ss.months.length?Ss.months[Ss.months.length-1]:null;
    return '<tr'+(s.active===false?' style="opacity:.55"':'')+'><td><b>'+esc(s.name)+'</b><div class="small muted">'+esc(s.kind)+' · '+esc(s.state||o.profile.state)+(s.contact?' · '+esc(s.contact):'')+'</div></td><td class="small">'+(s.cats||[]).map(function(c){ return esc(D.CAT[c]?D.CAT[c].short:c); }).join(', ')+'</td><td class="num"><b>'+(m&&m.score!=null?m.score:'—')+'</b></td><td class="num">'+(m?fmt(m.r12.total_t,0):'—')+'</td><td class="num">'+(m?fmt(m.r12.grid_kwh/1000,0):'—')+'</td><td class="num">'+(m&&m.r12.diversion_pct!=null?pct(m.r12.diversion_pct,0):'—')+'</td><td><div class="pill-row">'+(m?'<a class="btn btn-ghost btn-sm" href="#/sitereport/'+s.id+'/'+m.month+'" style="color:var(--ink)">Site report</a>':'')+(op?'<a class="btn btn-ghost btn-sm" href="#/sites/'+s.id+'" style="color:var(--ink)">Edit</a>':'')+'</div></td></tr>'; }).join('');
  var ed=editId==='new'?{id:'',name:'',kind:'Store',state:o.profile.state,employees:'',floor_area:'',contact:'',email:'',cats:['energy','water','waste']}:(editId?siteById(o,editId):null);
  body='<div class="pg-head"><div><p class="kicker">Sites</p><h1>'+esc(o.profile.org_name)+'</h1><p class="pg-sub">Each site has its own figures, score and report. The organisation report is the sum of the sites'+(last?' (latest month '+mLabel(last)+')':'')+'. Emissions and electricity are the rolling 12 months.</p></div>'+(op?'<div class="pg-actions"><a class="btn btn-ink btn-sm" href="#/sites/new">Add a site</a></div>':'')+'</div>'
    +'<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Site</th><th>Reports on</th><th class="r">Score</th><th class="r">t CO₂-e</th><th class="r">MWh grid</th><th class="r">Diversion</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>'
    +(op&&ed?'<div class="panel" style="margin-top:22px">'+siteForm(o,ed,false)+'</div>':'');
  return shell('sites', body);
}
function siteForm(o,s,first){
  var cats=D.CATEGORIES.filter(function(c){ return c.k!=='carbon'; });
  return '<h3>'+(s.id?'Edit site':first?'Start tracking by site':'New site')+'</h3>'+(first?'<p class="sec-s" style="margin-top:6px">Existing figures move to a site called "Whole organisation so far". Add the first real site below and enter new months by site.</p>':'')
   +'<div class="row2" style="margin-top:12px"><div class="stack"><div class="field"><label for="st-name">Site name</label><input type="text" id="st-name" value="'+esc(s.name)+'"></div>'
   +'<div class="field"><label for="st-kind">Kind</label><select id="st-kind">'+SITE_KINDS.map(function(k){ return '<option'+(s.kind===k?' selected':'')+'>'+k+'</option>'; }).join('')+'</select></div>'
   +'<div class="field"><label for="st-state">State or territory</label><select id="st-state">'+D.STATES.map(function(x){ return '<option'+(s.state===x[0]?' selected':'')+'>'+esc(x[0])+'</option>'; }).join('')+'</select></div>'
   +'<div class="field"><label for="st-emp">Employees (FTE)</label><input type="number" id="st-emp" min="0" value="'+esc(s.employees)+'"></div>'
   +'<div class="field"><label for="st-area">Floor area (m²)</label><input type="number" id="st-area" min="0" value="'+esc(s.floor_area)+'"></div></div>'
   +'<div class="stack"><div class="field"><label for="st-contact">Site contact</label><input type="text" id="st-contact" value="'+esc(s.contact)+'"></div>'
   +'<div class="field"><label for="st-email">Contact email (the gap email for this site goes here)</label><input type="email" id="st-email" value="'+esc(s.email)+'"></div>'
   +'<div class="field"><label>Categories this site reports on</label><div>'+cats.map(function(c){ return '<label class="small" style="display:inline-flex;gap:6px;align-items:center;margin:0 12px 6px 0"><input type="checkbox" data-scat="'+c.k+'"'+((s.cats||[]).indexOf(c.k)>=0?' checked':'')+'> '+esc(c.short)+'</label>'; }).join('')+'</div><span class="hint">A category a site does not report on is not asked for in its gap email.</span></div></div></div>'
   +'<div class="pill-row" style="margin-top:12px"><button class="btn btn-primary btn-sm" type="button" data-act="site-save" data-id="'+esc(s.id)+'" data-first="'+(first?'1':'')+'">Save site</button>'+(first?'':'<a class="btn btn-ghost btn-sm" href="#/sites" style="color:var(--ink)">Cancel</a>')+(s.id&&s.id!=='s1'&&!first?'<button class="btn btn-ghost btn-sm" type="button" data-act="site-toggle" data-id="'+esc(s.id)+'" style="color:var(--ink)">'+(s.active===false?'Reactivate':'Retire')+'</button>':'')+'</div>';
}
function vSiteReport(sid,k){
  var o=org(), so=siteOrg(o,sid); if(!so) return vNotFound();
  var S=seriesOf(so), m=monthOf(S,k); if(!m) return vNotFound();
  var body='<div class="pg-head no-print"><div><p class="kicker"><a class="link" href="#/sites">Sites</a></p><h1>'+esc(so.site.name)+' · '+mLabel(m.month)+'</h1><p class="pg-sub">The same three-page report, for one site. The organisation report is the sum of its sites.</p></div><div class="pg-actions"><button class="btn btn-ink btn-sm" type="button" data-act="print">Print or save as PDF</button></div></div>'
    + '<div class="report">'+reportSheets(so,S,m.month)+'</div>';
  return shell('sites', body);
}
/* entry: the site tabs above the category form */
function siteTabs(o,r,base,cur){
  if(!multisite(o)) return '';
  return '<div class="site-tabs" role="tablist" aria-label="Site">'+o.sites.filter(function(s){ return s.active!==false; }).map(function(s){ var p=siteProgress(o,r,s);
    return '<a role="tab" href="'+base+'?s='+s.id+(parseHash().q.c?'&c='+parseHash().q.c:'')+'" aria-selected="'+(s.id===cur)+'"><b>'+esc(s.name)+'</b><span class="c'+(p.reqDue&&p.req===p.reqDue?' ok':'')+'">'+p.req+'/'+p.reqDue+'</span></a>'; }).join('')+'</div>';
}

/* ------------------------------------------------------------------ declarations, customer side */
function declarePanel(o,editableMonths){
  var cats=D.CATEGORIES.filter(function(c){ return c.k!=='carbon'; });
  var decl=[]; sorted(o).forEach(function(r){ Object.keys(declaredCats(r)).forEach(function(c){ decl.push({r:r,c:c,d:r.declared[c]}); }); });
  decl.reverse();
  var mopts=editableMonths.map(function(k){ return '<option value="'+k+'">'+mLabel(k)+'</option>'; }).join('');
  return '<div class="panel" style="margin-top:18px"><h3>Nothing to send for a category?</h3><p class="sec-s" style="margin-top:6px">If a record does not exist for a month (no gas meter, no planting this month, no fleet), say so here. Yarta marks the category <b>not reported</b> for that month: it is left out of the score, never guessed, and nobody chases you for it.</p>'
    + '<div class="inline-form" style="margin-top:12px"><div class="field"><label for="dc-m">Month</label><select id="dc-m">'+mopts+'</select></div><div class="field"><label for="dc-c">Category</label><select id="dc-c">'+cats.map(function(c){ return '<option value="'+c.k+'">'+esc(c.name)+'</option>'; }).join('')+'</select></div><div class="field" style="flex:1"><label for="dc-n">Anything we should know? (optional)</label><input type="text" id="dc-n" placeholder="e.g. no gas connection at this site"></div><button class="btn btn-primary" type="button" data-act="declare" data-org="'+o.id+'">Declare not reported</button></div>'
    + (decl.length?'<div class="tbl-wrap" style="margin-top:14px"><table class="tbl compact"><thead><tr><th>Month</th><th>Category</th><th>Said by</th><th>Note</th><th></th></tr></thead><tbody>'+decl.slice(0,12).map(function(x){ return '<tr><td>'+mLabel(x.r.month)+'</td><td>'+esc(D.CAT[x.c].name)+'</td><td>'+esc(x.d.by)+'<div class="small muted">'+longDate(x.d.at)+'</div></td><td class="small">'+esc(x.d.note||'')+'</td><td>'+((x.r.status==='draft'||x.r.status==='returned')?'<button class="btn btn-ghost btn-sm" type="button" data-act="undeclare" data-org="'+o.id+'" data-month="'+x.r.month+'" data-cat="'+x.c+'" style="color:var(--ink)">Undo</button>':'<span class="small muted">Locked</span>')+'</td></tr>'; }).join('')+'</tbody></table></div>':'')
    + '</div>';
}

/* ------------------------------------------------------------------ quarterly and annual reports */
function fyStartYear(k){ var p=E.parse(k); return p.m>=6?p.y:p.y-1; }
function periodsOf(S){
  var by={}, fys={}; S.months.forEach(function(m){ var fy=fyStartYear(m.month), p=E.parse(m.month), q=Math.floor(((p.m+6)%12)/3)+1; var fid='FY'+fy+'-'+String(fy+1).slice(2); (fys[fid]=fys[fid]||{id:fid,label:'Financial year '+fy+'–'+String(fy+1).slice(2),months:[],fy:fy}).months.push(m); var qid=fid+'-Q'+q; (by[qid]=by[qid]||{id:qid,label:'Q'+q+' FY'+fy+'–'+String(fy+1).slice(2),months:[],q:q,fy:fy}).months.push(m); });
  var out=Object.keys(by).map(function(k){ return by[k]; }).concat(Object.keys(fys).map(function(k){ return fys[k]; }));
  out.forEach(function(pr){ var n=pr.q?3:12; pr.complete=pr.months.length===n; pr.provisional=pr.months.some(function(m){ return m.status!=='verified'; }); pr.end=pr.months[pr.months.length-1].month; pr.start=pr.months[0].month; });
  return out.sort(function(a,b){ return a.end<b.end?1:a.end>b.end?-1:(a.q?1:0)-(b.q?1:0); });
}
function sumOf(ms,k){ return ms.reduce(function(a,m){ return a+(m[k]||0); },0); }
function pctOf(a,b){ return b>0?a/b*100:null; }
function periodFigures(ms){
  var wt=sumOf(ms,'waste_total_t'), lf=sumOf(ms,'landfill_t'), rn=sumOf(ms,'renew_kwh'), ea=sumOf(ms,'elec_all_kwh'), pk=sumOf(ms,'potable_kl');
  return {s1:sumOf(ms,'scope1_t'), s2:sumOf(ms,'scope2_t'), s3:sumOf(ms,'scope3_t'), tot:sumOf(ms,'total_t'), av:sumOf(ms,'avoided_t'), kwh:sumOf(ms,'grid_kwh'), ren:pctOf(rn,ea), gas:sumOf(ms,'gas_gj'), fuel:sumOf(ms,'fuel_l'), pot:pk, wt:wt, lf:lf, div:pctOf(wt-lf,wt), trees:ms.reduce(function(a,m){ return a+(+((m.values||{}).trees)||0); },0), part:ms.reduce(function(a,m){ return a+(+((m.values||{}).participants)||0); },0)};
}
function periodSheet(o,S,per){
  var ms=per.months, last=ms[ms.length-1], p=o.profile, cur=periodFigures(ms);
  var prevKeys=ms.map(function(m){ return E.addMonths(m.month,-12); }), pm=prevKeys.map(function(k){ return S.months.filter(function(x){ return x.month===k; })[0]; }).filter(Boolean), pv=pm.length===ms.length?periodFigures(pm):null;
  var bs=ms.map(function(m){ return S.baseline&&S.baseline.byCal?S.baseline.byCal[E.parse(m.month).m]:null; }).filter(Boolean), bv=bs.length===ms.length?periodFigures(bs):null;
  function row(l,a,u,b,c,lower,dp){ dp=dp||0; return '<tr><td>'+l+'</td><td class="num"><b>'+(a==null?'—':fmt(a,dp))+'</b></td><td>'+u+'</td><td class="num">'+(b==null?'—':fmt(b,dp))+'</td><td class="num">'+(a==null||b==null?'—':rpChg(a,b,lower))+'</td><td class="num">'+(c==null?'—':fmt(c,dp))+'</td></tr>'; }
  var ly=S.months.filter(function(x){ return x.month===E.addMonths(last.month,-12); })[0];
  var cats=D.CATEGORIES.map(function(c){ var v=last.scores[c.k], v0=ly?ly.scores[c.k]:null; return '<div class="rp-sub"><span>'+esc(c.name)+'</span><span class="v">'+(v==null?'—':Math.round(v))+'</span><span class="d">'+(v==null?'<span class="muted small">not reported</span>':delta(v0==null?null:v-v0))+'</span><div class="bar"><i style="width:'+(v||0)+'%"></i></div></div>'; }).join('');
  var issued=ms.filter(function(m){ var r=rec(o,m.month); return r&&r.issuedAt; }).length;
  var declared=[]; ms.forEach(function(m){ var r=rec(o,m.month); Object.keys(declaredCats(r)).forEach(function(c){ declared.push(D.CAT[c].short+' '+mShort(m.month)); }); });
  return '<section class="rp-sheet rp-cover"><div class="rp-band"><div class="rp-band-l"><div class="rp-brand">'+RB.mark+'<span class="full">'+RB.full+'</span></div><div class="rp-ethos">Measure. Understand. Report. Improve.</div><h1 class="rp-big">'+(per.q?'Quarterly':'Annual')+'<br>Sustainability Report</h1><p class="rp-tag">'+esc(p.org_name)+' · '+esc(per.label)+'</p></div>'
    + '<div class="rp-band-r"><div class="rp-kv light"><span>Organisation</span><b>'+esc(p.org_name)+'</b><span>Period</span><b>'+mLabel(per.start)+' to '+mLabel(per.end)+'</b><span>Built from</span><b>'+ms.length+' monthly report'+(ms.length===1?'':'s')+' ('+issued+' issued)</b><span>Status</span><b>'+(per.complete?'Complete':'Part period')+(per.provisional?' · provisional':' · verified')+'</b></div></div></div>'
    + '<div class="rp-score">'+ring(last.score,150,true)+'<div class="rp-score-t"><p class="kicker">'+RB.score+' · at '+esc(mLabel(last.month))+'</p><div class="band">'+esc(last.band)+'</div><div class="rp-score-d">'+(ly&&last.score!=null&&ly.score!=null?'<span>'+delta(last.score-ly.score,{unit:' pts'})+' on '+esc(mLabel(ly.month))+'</span>':'')+'</div></div></div>'
    + '<div class="rp-cols"><div><div class="rp-h">Category scores at the end of the period</div><div class="rp-subs one">'+cats+'</div></div><div><div class="rp-h">The period in figures</div><div class="rp-tw"><table class="tbl compact"><thead><tr><th></th><th class="r">Period</th><th></th><th class="r">Last year</th><th class="r">Change</th><th class="r">Baseline</th></tr></thead><tbody>'
    + row('Scope 1 emissions',cur.s1,'t CO₂-e',pv&&pv.s1,bv&&bv.s1,true)+row('Scope 2 emissions',cur.s2,'t CO₂-e',pv&&pv.s2,bv&&bv.s2,true)+row('Scope 3 emissions',cur.s3,'t CO₂-e',pv&&pv.s3,bv&&bv.s3,true)+row('Total emissions',cur.tot,'t CO₂-e',pv&&pv.tot,bv&&bv.tot,true)
    + row('Avoided (separate)',cur.av,'t CO₂-e',pv&&pv.av,null,false)+row('Grid electricity',cur.kwh/1000,'MWh',pv&&pv.kwh/1000,bv&&bv.kwh/1000,true)+row('Renewable share',cur.ren,'%',pv&&pv.ren,null,false,1)
    + row('Natural gas',cur.gas,'GJ',pv&&pv.gas,bv&&bv.gas,true)+row('Fuel',cur.fuel,'L',pv&&pv.fuel,bv&&bv.fuel,true)+row('Drinking water',cur.pot,'kL',pv&&pv.pot,bv&&bv.pot,true)
    + row('Waste generated',cur.wt,'t',pv&&pv.wt,bv&&bv.wt,true)+row('To landfill',cur.lf,'t',pv&&pv.lf,bv&&bv.lf,true)+row('Landfill diversion',cur.div,'%',pv&&pv.div,null,false,1)
    + row('Trees planted',cur.trees,'trees',pv&&pv.trees,null,false)+row('Program participants',cur.part,'people',pv&&pv.part,null,false)
    + '</tbody></table></div></div></div>'
    + '<div class="rp-foot">Sums of the monthly figures in the period, compared with the same months a year earlier and with the same calendar months of the baseline year ('+esc((S.baseline&&S.baseline.fy)||p.baseline_fy||'')+'). Scores are the rolling 12-month scores at the last month. '+(declared.length?'Not reported (declared by the customer): '+esc(declared.join(', '))+'. ':'')+'The score is self-declared under the published Yarta Method. Avoided emissions are an estimate, reported separately and never deducted. Method '+esc(E.VERSION)+'.'+(operatorOf(o)?' Your Yarta data operator: '+esc(operatorOf(o).name)+'.':'')+'</div></section>';
}
function vPeriod(id){
  var o=org(), S=seriesOf(o), per=periodsOf(S).filter(function(x){ return x.id===id; })[0]; if(!per) return vNotFound();
  var body='<div class="pg-head no-print"><div><p class="kicker"><a class="link" href="#/reports">Reports</a></p><h1>'+esc(per.label)+'</h1><p class="pg-sub">'+(per.q?'A quarterly':'An annual')+' summary built from the monthly reports. It carries no new figures: everything on it is in the months it is built from.</p></div><div class="pg-actions"><button class="btn btn-ink btn-sm" type="button" data-act="print">Print or save as PDF</button></div></div>'
    +'<div class="report">'+periodSheet(o,S,per)+'</div>';
  return shell('reports', body);
}
function periodPanel(){
  var o=org(), S=seriesOf(o), ps=periodsOf(S); if(!ps.length) return '';
  function li(pr){ return '<a class="btn btn-sm btn-ghost" style="color:var(--ink)" href="#/period/'+pr.id+'">'+esc(pr.label)+(pr.complete?'':' · to date')+'</a>'; }
  return '<div class="panel" style="margin-top:22px"><h3>Quarterly and annual</h3><p class="sec-s" style="margin-top:6px">Roll-ups of the monthly reports, on the financial year (July to June).</p><div class="pill-row" style="margin-top:10px">'+ps.filter(function(x){ return !x.q; }).slice(0,3).map(li).join('')+'</div><div class="pill-row" style="margin-top:8px">'+ps.filter(function(x){ return x.q; }).slice(0,6).map(li).join('')+'</div></div>';
}

/* ------------------------------------------------------------------ carbon table by scope, for an assurance reader */
function carbonLines(values,p,siteName,ev,month,orgName){
  var F=E.FACTORS, st=F.elec[p.state]?p.state:'VIC', el=F.elec[st], out=[], src=F.edition, ed='NGA Factors 2024';
  function n(x){ x=+x; return isFinite(x)&&x>0?x:0; }
  function evOf(cat){ var e=ev&&ev[cat]; return e?[cat,e.name||'',e.grade||'pending']:[cat,'','none']; }
  function add(scope,source,activity,qty,unit,conv,factor,funit,tco2,cat){ if(!qty) return; var e=evOf(cat); out.push([orgName,siteName||'All sites',month,scope,source,activity,r3(qty),unit,conv,factor,funit,src,ed,r3(tco2),e[0],e[1],e[2]]); }
  [['diesel','diesel_l','Diesel'],['petrol','petrol_l','Petrol'],['lpg','lpg_l','LPG'],['biodiesel','biodiesel_l','Biodiesel']].forEach(function(f){
    var q=n(values[f[1]]), fu=F.fuel[f[0]]; add('Scope 1','Stationary and transport fuel',f[2]+' purchased',q,'L',fu.gj+' GJ/kL',fu.s1,'kg CO₂-e/GJ',q*fu.gj*fu.s1/1e6,'fleet');
    if(f[0]!=='biodiesel') add('Scope 3','Upstream fuel (well to tank)',f[2]+' purchased',q,'L',fu.gj+' GJ/kL',fu.s3,'kg CO₂-e/GJ',q*fu.gj*fu.s3/1e6,'fleet'); });
  add('Scope 1','Natural gas','Natural gas',n(values.gas_gj),'GJ','',F.gas.s1,'kg CO₂-e/GJ',n(values.gas_gj)*F.gas.s1/1000,'energy');
  add('Scope 2','Purchased electricity (location-based, '+st+')','Grid electricity',n(values.grid_kwh),'kWh','',el.s2,'kg CO₂-e/kWh',n(values.grid_kwh)*el.s2/1000,'energy');
  add('Scope 3','Upstream electricity (transmission and distribution losses)','Grid electricity',n(values.grid_kwh),'kWh','',el.s3,'kg CO₂-e/kWh',n(values.grid_kwh)*el.s3/1000,'energy');
  add('Scope 3','Upstream natural gas','Natural gas',n(values.gas_gj),'GJ','',F.gas.s3[st]||4,'kg CO₂-e/GJ',n(values.gas_gj)*(F.gas.s3[st]||4)/1000,'energy');
  var lf=F.landfill[p.org_type]||1.3; add('Scope 3','Waste generated in operations (Category 5)','Waste to landfill',n(values.landfill_t),'t','',lf,'t CO₂-e/t',n(values.landfill_t)*lf,'waste');
  [['steel_t','Steel recycled',F.avoided.steel],['alu_t','Aluminium recycled',F.avoided.alu],['timber_t','Timber recycled',F.avoided.timber],['green_t','Green waste recycled',F.avoided.green],['concrete_t','Concrete recycled',F.avoided.concrete]].forEach(function(a){ var q=n(values[a[0]]); if(q) out.push([orgName,siteName||'All sites',month,'Avoided (reported separately, never deducted)','Modelled avoided emissions',a[1],r3(q),'t','',a[2],'t CO₂-e/t','NSW DECCW 2010','2010',r3(q*a[2]),'waste',(ev&&ev.waste&&ev.waste.name)||'',(ev&&ev.waste&&ev.waste.grade)||'none']); });
  return out;
}
function carbonRows(o,fy){
  var head=['organisation','site','month','scope','source','activity','quantity','unit','conversion','factor','factor_unit','factor_source','factor_edition','emissions_t_co2e','evidence_category','evidence_document','evidence_grade'], rows=[head];
  var S=seriesOf(o);
  S.months.forEach(function(m){ if(fy&&E.fyOf(m.month)!==fy) return; var r=rec(o,m.month);
    if(multisite(o)){ o.sites.forEach(function(s){ var sv=(r.sites&&r.sites[s.id]&&r.sites[s.id].values)||{}; var p={}; for(var k in o.profile) p[k]=o.profile[k]; if(s.state) p.state=s.state; carbonLines(sv,p,s.name,m.ev,m.month,o.profile.org_name).forEach(function(x){ rows.push(x); }); }); }
    else carbonLines(m.values,o.profile,'',m.ev,m.month,o.profile.org_name).forEach(function(x){ rows.push(x); }); });
  return rows;
}
/* --- gaps: what is still missing for the month in play, by category and (for multi-site customers) by site --- */
function gapsFor(o){
  var mp=monthInPlay(o); if(!mp) return null;
  var decl=declaredCats(mp.r), r=mp.r, v=(r&&r.values)||{};
  var reqDue=dueFields(o,mp.k).filter(function(f){ return f.req && !decl[f.cat]; });
  function filled(f,vals){ return isNum(vals[f.id]) || (f.kind!=='number'&&f.kind!=='count'&&f.kind!=='currency'&&f.kind!=='percent'&&vals[f.id]); }
  var bySite=null, need, have;
  if(multisite(o)){
    bySite=o.sites.filter(function(s){ return s.active!==false; }).map(function(s){
      var sv=(r&&r.sites&&r.sites[s.id]&&r.sites[s.id].values)||{}, fs=reqDue.filter(function(f){ return !s.cats||s.cats.indexOf(f.cat)>=0; });
      var miss=fs.filter(function(f){ return !filled(f,sv); }), byCat={}; miss.forEach(function(f){ (byCat[f.cat]=byCat[f.cat]||[]).push(f); });
      return {site:s, need:miss, have:fs.length-miss.length, total:fs.length, byCat:byCat};
    });
    var seen={}; need=[]; bySite.forEach(function(b){ b.need.forEach(function(f){ if(!seen[f.id]){ seen[f.id]=1; need.push(f); } }); });
    have=reqDue.filter(function(f){ return !seen[f.id]; });
  } else { need=reqDue.filter(function(f){ return !filled(f,v); }); have=reqDue.filter(function(f){ return filled(f,v); }); }
  var byCat={}; need.forEach(function(f){ (byCat[f.cat]=byCat[f.cat]||[]).push(f); });
  var docs=(r&&r.inbox)||[], sent=(state.gapLog||[]).filter(function(g){ return g.org===o.id && g.month===mp.k; });
  var nx=E.parse(E.addMonths(mp.k,1)), askFrom=new Date(nx.y,nx.m,1);
  return {month:mp.k, started:mp.started, rec:r, have:have, need:need, byCat:byCat, bySite:bySite, declared:Object.keys(decl), docs:docs, due:dueDate(mp.k), askFrom:askFrom, sent:sent, lastSent:sent.length?sent[sent.length-1]:null, dueNow:new Date()>=askFrom && need.length>0 && !sent.length};
}
function gapEmail(o,g,part){
  var s=part&&part.site, c=s&&s.email?{name:s.contact||'there',email:s.email}:contactsOf(o)[0], op=operatorOf(o)||me(), bc=part?part.byCat:g.byCat;
  var lines=Object.keys(bc).map(function(k){ var c2=D.CAT[k]; return '• '+(c2?c2.name:k)+': '+bc[k].map(function(f){ return f.name+(f.src?' ('+f.src+')':''); }).join('; '); });
  var haveN=part?part.have:g.have.length, allN=part?part.total:(g.have.length+g.need.length), nd=part?part.need.length:g.need.length;
  var subject='Yarta · '+o.profile.org_name+(s?' · '+s.name:'')+' · '+mLabel(g.month)+': what we still need';
  var body='Hi '+(c&&c.name?c.name.split(' ')[0]:'there')+',\n\n'
    + 'Thanks for the '+mLabel(g.month)+' records so far'+(g.docs.length?' ('+g.docs.length+' document'+(g.docs.length===1?'':'s')+' received for the organisation)':'')+'. '+(s?'For '+s.name+' we':'We')+' have '+haveN+' of '+allN+' required figures.\n\n'
    + (nd?'To close the month we still need:\n'+lines.join('\n')+'\n\n':'Nothing further is needed for this site.\n\n')
    + 'Reply to this email with the documents attached, or upload them in the portal. If a record does not exist, use "Nothing to send for a category" in the portal (Send documents) or reply and say so: the category is marked "not reported" and left out of the score rather than guessed.\n\n'
    + (g.declared.length?'Already marked not reported for '+mLabel(g.month)+': '+g.declared.map(function(k){ return D.CAT[k].name; }).join(', ')+'.\n\n':'')
    + 'Documents are due by '+longDate(g.due)+'. Once they are in, we enter the figures, a second analyst verifies the month, and your dashboard and report update.\n\n'
    + 'Thanks,\n'+op.name+'\nYarta · your data operator\n'+op.email;
  return {to:c?c.email:'', subject:subject, body:body};
}
function gapPanel(o,g,part){
  var key=part?part.site.id:'org', em=gapEmail(o,g,part), nd=(part?part.need:g.need).length;
  var already=g.sent.filter(function(x){ return (x.site||'org')===key; }).slice(-1)[0];
  return '<div class="panel" style="margin-top:16px"><h3>'+(part?esc(part.site.name):'Email')+'</h3><p class="sec-s" style="margin-top:6px">To '+(em.to?esc(em.to):'<span style="color:var(--red)">no customer contact on file</span>')+' · '+(nd?nd+' figure'+(nd===1?'':'s')+' still needed':'nothing needed')+(already?' · queued '+longDate(already.at)+' by '+esc(already.by):'')+'</p>'
    +'<div class="field" style="margin-top:10px"><label>Subject</label><input type="text" id="gap-subj-'+key+'" value="'+esc(em.subject)+'"></div><div class="field"><label>Body</label><textarea id="gap-body-'+key+'" style="min-height:'+(part?'240':'340')+'px;font-family:var(--font-mono);font-size:12.5px;line-height:1.5">'+esc(em.body)+'</textarea></div>'
    +'<div class="pill-row" style="margin-top:12px"><button class="btn btn-primary btn-sm" type="button" data-act="gap-sent" data-org="'+o.id+'" data-month="'+g.month+'" data-key="'+key+'" data-to="'+esc(em.to)+'">Queue to send</button><a class="btn btn-ghost btn-sm" style="color:var(--ink)" href="'+mailto(em.to,em.subject,em.body)+'">Open in mail</a><button class="btn btn-ghost btn-sm" type="button" data-act="gap-copy" data-key="'+key+'" style="color:var(--ink)">Copy</button></div></div>';
}
function vGaps(orgId){
  if(orgId){ var o=state.orgs[orgId]; if(!o) return vNotFound(); var g=gapsFor(o); var body;
    if(!g){ body='<div class="pg-head"><div><p class="kicker"><a class="link" href="#/ops/gaps">Gap emails</a></p><h1>'+esc(o.profile.org_name)+'</h1></div></div><div class="empty">Every month is entered. Nothing to ask for.</div>'; return shell('gaps',body); }
    var needRows=Object.keys(g.byCat).map(function(k){ return '<tr><td><b>'+esc(D.CAT[k]?D.CAT[k].name:k)+'</b></td><td>'+g.byCat[k].map(function(f){ return esc(f.name)+(f.src?' <span class="muted small">· '+esc(f.src)+'</span>':''); }).join('<br>')+'</td></tr>'; }).join('');
    body='<div class="pg-head"><div><p class="kicker"><a class="link" href="#/ops/gaps">Gap emails</a> · '+mLabel(g.month)+'</p><h1>'+esc(o.profile.org_name)+'</h1><p class="pg-sub">'+g.have.length+' of '+(g.have.length+g.need.length)+' required figures in · '+g.docs.length+' document'+(g.docs.length===1?'':'s')+' received · due '+longDate(g.due)+(g.declared.length?' · not reported: '+g.declared.map(function(k){ return esc(D.CAT[k].short); }).join(', '):'')+(g.lastSent?' · last email queued '+longDate(g.lastSent.at)+' by '+esc(g.lastSent.by):' · no email queued yet')+'</p></div>'
      +'<div class="pg-actions">'+(g.started?'<a class="btn btn-ink btn-sm" href="#/entry/'+orgId+'/'+g.month+'">Enter figures</a>':'<button class="btn btn-ink btn-sm" type="button" data-act="start-month" data-org="'+orgId+'" data-month="'+g.month+'">Open the month</button>')+'</div></div>'
      +'<div class="panel"><h3>Still needed</h3>'+(needRows?'<div class="tbl-wrap" style="margin-top:12px"><table class="tbl compact"><thead><tr><th>Category</th><th>Figures and the document that carries them</th></tr></thead><tbody>'+needRows+'</tbody></table></div>':'<p class="sec-s" style="margin-top:8px">Nothing. Every required figure is in.</p>')
      +'<h3 style="margin-top:22px">Documents received</h3>'+(g.rec?inboxList(g.rec):'<p class="sec-s" style="margin:6px 0 0">None yet. The month has not been opened.</p>')+'</div>'
      +(g.bySite?g.bySite.map(function(b){ return gapPanel(o,g,b); }).join(''):gapPanel(o,g,null))
      +'<p class="small muted" style="margin:14px 0 0">Queued emails wait in the <a class="link" href="#/ops/outbox">Outbox</a>. In production they go out automatically on the 1st of the month after the reporting month, with a reminder on the 10th, and every send is logged.</p>';
    return shell('gaps', body);
  }
  var rows=Object.keys(state.orgs).map(function(id){ var o2=state.orgs[id], g2=gapsFor(o2); if(!g2) return ''; return '<tr'+(g2.dueNow?' class="flag"':'')+'><td><b>'+esc(o2.profile.org_name)+'</b><div class="small muted">'+esc((operatorOf(o2)||{}).name||'No operator')+(g2.bySite?' · '+g2.bySite.length+' sites':'')+'</div></td><td>'+mLabel(g2.month)+(g2.started?' '+statusChip(g2.rec.status):' <span class="st st-draft">Not started</span>')+'</td><td class="num">'+g2.have.length+' / '+(g2.have.length+g2.need.length)+'</td><td class="num">'+g2.docs.length+'</td><td>'+longDate(g2.due)+'</td><td>'+(g2.lastSent?'Queued '+longDate(g2.lastSent.at):(g2.dueNow?'<span class="st st-returned">Due now</span>':'<span class="muted">From '+longDate(g2.askFrom)+'</span>'))+'</td><td><a class="btn btn-primary btn-sm" href="#/ops/gaps/'+id+'">Open</a></td></tr>'; }).join('');
  var body2='<div class="pg-head"><div><p class="kicker">Yarta team</p><h1>Gap emails</h1><p class="pg-sub">Once a month, for every customer (and every site of a multi-site customer), the email that lists what Yarta still needs for the reporting month. It goes out from the 1st of the following month; documents are due by the 15th. Categories a customer has declared not reported are left out.</p></div></div>'
    + (rows?'<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Organisation</th><th>Month in play</th><th class="r">Required in</th><th class="r">Documents</th><th>Due</th><th>Email</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty">Every customer is up to date.</div>');
  return shell('gaps', body2);
}

/* ------------------------------------------------------------------ import: group weighbridge and contractor exports */
var MN3=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
function pad2(n){ return (n<10?'0':'')+n; }
function parseMonth(s){
  s=String(s||'').trim(); var m;
  if((m=s.match(/^(\d{4})[-\/](\d{1,2})/))) return m[1]+'-'+pad2(+m[2]);
  if((m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/))){ var y=+m[3]; if(y<100) y+=2000; return y+'-'+pad2(+m[2]); }
  if((m=s.match(/(\d{1,2})?\s*([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})/))){ var i=MN3.indexOf(m[2].toLowerCase()); if(i>=0) return m[3]+'-'+pad2(i+1); }
  return null;
}
function convertQty(q,unit,target){
  var u=String(unit||'').trim().toLowerCase().replace(/\./g,''), M={'kg':'kg','kgs':'kg','kilogram':'kg','kilograms':'kg','t':'t','tonne':'t','tonnes':'t','ton':'t','tons':'t','l':'L','litre':'L','litres':'L','liter':'L','liters':'L','kl':'kL','count':'n','each':'n','ea':'n','units':'n','unit':'n','no':'n'}, k=M[u];
  if(k===undefined) return null;
  if(target==='units') return k==='n'?q:null;
  if(target==='t') return k==='t'?q:k==='kg'?q/1000:null;
  if(target==='kg') return k==='kg'?q:k==='t'?q*1000:null;
  if(target==='L') return k==='L'?q:k==='kL'?q*1000:null;
  return null;
}
function guessCols(headers){
  function find(res){ for(var i=0;i<headers.length;i++){ for(var j=0;j<res.length;j++){ if(res[j].test(headers[i])) return i; } } return -1; }
  return {date:find([/^date$/i,/date/i,/day/i]), material:find([/material/i,/waste.?stream/i,/stream/i,/product/i,/type/i]), qty:find([/net/i,/weight/i,/quantity/i,/qty/i,/tonnes?/i]), unit:find([/^unit/i,/uom/i]), site:find([/site/i,/depot/i,/location/i,/store/i]), ref:find([/docket/i,/ticket/i,/ref/i,/reference/i])};
}
function buildImportPreview(im){
  var o=state.orgs[im.orgId], map=state.importMaps[im.tpl]||{mat:{}}, mat={}, k;
  for(k in map.mat) mat[k]=map.mat[k]; for(k in (im.matAdd||{})) mat[k]=im.matAdd[k];
  var c=im.cols, agg={}, unmatched={}, unsite={}, bad={date:0,qty:0,unit:0}, used=0;
  im.rows.forEach(function(row){
    var mo=parseMonth(row[c.date]); if(!mo){ bad.date++; return; }
    var material=String(row[c.material]||'').trim(); if(!material) return;
    var fid=mat[material.toLowerCase()]; if(!fid){ unmatched[material]=(unmatched[material]||0)+1; return; }
    var f=D.FIELD[fid], q=+String(row[c.qty]||'').replace(/[, ]/g,''); if(!isFinite(q)){ bad.qty++; return; }
    var unit=(c.unit>=0&&row[c.unit])?row[c.unit]:im.unit, conv=convertQty(q,unit,f.unit); if(conv==null){ bad.unit++; return; }
    var sid=null; if(multisite(o)){ if(c.site>=0){ var sn=String(row[c.site]||'').trim().toLowerCase(), site=o.sites.filter(function(s){ return s.name.toLowerCase()===sn; })[0]; if(!site){ unsite[row[c.site]||'(blank)']=(unsite[row[c.site]||'(blank)']||0)+1; return; } sid=site.id; } else sid=o.sites[0].id; }
    var key=mo+'|'+(sid||'')+'|'+fid; var a=agg[key]=agg[key]||{month:mo,site:sid,field:fid,value:0,n:0,refs:[]}; a.value+=conv; a.n++; if(c.ref>=0&&row[c.ref]&&a.refs.length<3) a.refs.push(row[c.ref]); used++;
  });
  var list=Object.keys(agg).map(function(k2){ var a=agg[k2], f=D.FIELD[a.field]; a.value=(f.kind==='count')?Math.round(a.value):r3(a.value); return a; }).sort(function(a,b){ return a.month<b.month?-1:a.month>b.month?1:(a.site||'')<(b.site||'')?-1:a.field<b.field?-1:1; });
  return {list:list, unmatched:unmatched, unsite:unsite, bad:bad, used:used, total:im.rows.length, months:Object.keys(list.reduce(function(m,a){ m[a.month]=1; return m; },{})).sort()};
}
function vImport(){
  var im=ui.imp||null, maps=state.importMaps||{}, names=Object.keys(maps);
  var orgOpts=Object.keys(state.orgs).map(function(id){ return '<option value="'+id+'"'+(im&&im.orgId===id?' selected':'')+'>'+esc(state.orgs[id].profile.org_name)+'</option>'; }).join('');
  var tplOpts=names.map(function(n){ return '<option'+(im&&im.tpl===n?' selected':'')+'>'+esc(n)+'</option>'; }).join('');
  var body='<div class="pg-head"><div><p class="kicker">Yarta team</p><h1>Import</h1><p class="pg-sub">Bring in a month of tonnages from the group\'s weighbridge or a contractor\'s export instead of keying it. Map the columns once per source; the mapping is remembered. The file becomes the evidence, and the verifier grades it like any other document. An import replaces the values it covers for that month and site.</p></div><div class="pg-actions"><button class="btn btn-ghost btn-sm" type="button" data-act="imp-blank" style="color:var(--ink)">Blank template (CSV)</button></div></div>'
    + '<div class="panel"><h3>1 · Choose the customer, the source and the file</h3><div class="inline-form" style="margin-top:12px"><div class="field"><label for="im-org">Customer</label><select id="im-org">'+orgOpts+'</select></div><div class="field"><label for="im-tpl">Source mapping</label><select id="im-tpl" data-act="imp-tpl">'+tplOpts+'</select></div><label class="btn btn-primary">Choose a CSV<input type="file" data-act="imp-file" accept=".csv,text/csv" style="display:none"></label></div>'
    + '<p class="small muted" style="margin:10px 0 0">'+esc((maps[im?im.tpl:names[0]]||{}).note||'')+' Evidence grade proposed for this source: '+esc((maps[im?im.tpl:names[0]]||{}).grade||'')+'.</p></div>';
  if(im && im.headers){
    function colSel(id,label,req){ return '<div class="field"><label for="'+id+'">'+label+(req?' <span class="req">*</span>':'')+'</label><select id="'+id+'"><option value="-1">'+(req?'Choose…':'None')+'</option>'+im.headers.map(function(h,i){ return '<option value="'+i+'"'+(im.cols[id.replace('cm-','')]===i?' selected':'')+'>'+esc(h)+'</option>'; }).join('')+'</select></div>'; }
    body+='<div class="panel" style="margin-top:16px"><h3>2 · Map the columns</h3><p class="sec-s" style="margin-top:6px">'+esc(im.name)+' · '+im.rows.length+' rows.</p><div class="row2" style="margin-top:12px"><div class="stack">'+colSel('cm-date','Date',1)+colSel('cm-material','Material or stream',1)+colSel('cm-qty','Quantity',1)+'</div><div class="stack">'+colSel('cm-unit','Unit column (if any)')+colSel('cm-site','Site column (if any)')+colSel('cm-ref','Docket or reference (if any)')
      +'<div class="field"><label for="cm-defunit">Unit when there is no unit column</label><select id="cm-defunit">'+['kg','t','count','L'].map(function(u){ return '<option'+(im.unit===u?' selected':'')+'>'+u+'</option>'; }).join('')+'</select></div></div></div><div class="pill-row" style="margin-top:12px"><button class="btn btn-primary btn-sm" type="button" data-act="imp-preview">Preview</button></div></div>';
  }
  if(im && im.preview){
    var pv=im.preview, o=state.orgs[im.orgId], fieldOpts='<option value="">Leave out</option>'+D.INPUTS.filter(function(f){ return f.cat==='waste'||f.cat==='circular'; }).map(function(f){ return '<option value="'+f.id+'">'+esc(f.name)+' ('+esc(f.unit)+')</option>'; }).join('');
    var um=Object.keys(pv.unmatched).map(function(mn){ return '<tr><td>'+esc(mn)+'</td><td class="num">'+pv.unmatched[mn]+'</td><td><select data-act="imp-map" data-mat="'+esc(mn)+'" class="gsel">'+fieldOpts+'</select></td></tr>'; }).join('');
    var locked=pv.months.filter(function(mo){ var r=rec(o,mo); return r && (r.status==='verified'||r.status==='submitted'); });
    body+='<div class="panel" style="margin-top:16px"><h3>3 · Check the preview</h3><p class="sec-s" style="margin-top:6px">'+pv.used+' of '+pv.total+' rows used across '+pv.months.length+' month'+(pv.months.length===1?'':'s')+'. '+(pv.bad.date?pv.bad.date+' with an unreadable date. ':'')+(pv.bad.qty?pv.bad.qty+' with an unreadable quantity. ':'')+(pv.bad.unit?pv.bad.unit+' with a unit that does not fit the material. ':'')+(locked.length?'<b>Locked months that will be skipped: '+locked.map(mLabel).join(', ')+'.</b>':'')+'</p>'
      + (um?'<h4 style="margin:16px 0 6px">Materials Yarta does not recognise</h4><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Material in the file</th><th class="r">Rows</th><th>Counts as</th></tr></thead><tbody>'+um+'</tbody></table></div>':'')
      + (Object.keys(pv.unsite).length?'<h4 style="margin:16px 0 6px;color:var(--red)">Sites not matched (rows skipped)</h4><p class="small">'+Object.keys(pv.unsite).map(function(s2){ return esc(s2)+' ('+pv.unsite[s2]+')'; }).join(', ')+'. Site names must match the customer\'s site register.</p>':'')
      + '<div class="tbl-wrap" style="margin-top:14px"><table class="tbl compact"><thead><tr><th>Month</th>'+(multisite(o)?'<th>Site</th>':'')+'<th>Figure</th><th class="r">Value</th><th>Unit</th><th class="r">Rows</th><th>References</th></tr></thead><tbody>'+pv.list.slice(0,120).map(function(a){ var f=D.FIELD[a.field]; return '<tr><td>'+mLabel(a.month)+'</td>'+(multisite(o)?'<td>'+esc((siteById(o,a.site)||{}).name||'')+'</td>':'')+'<td>'+esc(f.name)+'</td><td class="num"><b>'+fmt(a.value,f.kind==='count'?0:2)+'</b></td><td>'+esc(f.unit)+'</td><td class="num">'+a.n+'</td><td class="small muted">'+esc(a.refs.join(', '))+'</td></tr>'; }).join('')+'</tbody></table></div>'
      + '<div class="field" style="margin-top:14px;max-width:360px"><label for="im-save">Save this mapping as</label><input type="text" id="im-save" value="'+esc(im.tpl)+'"><span class="hint">Saves the column choices and the materials you have matched, so next month is one click.</span></div>'
      + '<div class="pill-row" style="margin-top:12px"><button class="btn btn-primary" type="button" data-act="imp-go"'+(pv.list.length?'':' disabled')+'>Import into draft months</button><button class="btn btn-ghost" type="button" data-act="imp-save-map" style="color:var(--ink)">Save mapping only</button><button class="btn btn-ghost" type="button" data-act="imp-cancel" style="color:var(--ink)">Cancel</button></div></div>';
  }
  return shell('import', body);
}
function importApply(){
  var im=ui.imp; if(!im||!im.preview) return; var o=state.orgs[im.orgId], pv=im.preview, map=state.importMaps[im.tpl]||{}, skipped=[], done=0, cats={};
  var byMonth={}; pv.list.forEach(function(a){ (byMonth[a.month]=byMonth[a.month]||[]).push(a); });
  Object.keys(byMonth).sort().forEach(function(mo){
    var r=rec(o,mo);
    if(!r){ r={month:mo, values:{}, evidence:{}, status:'draft', inbox:[]}; o.records.push(r); }
    if(r.status==='verified'||r.status==='submitted'){ skipped.push(mLabel(mo)); return; }
    byMonth[mo].forEach(function(a){ var tv=multisite(o)&&a.site?svals(r,a.site):r.values; tv[a.field]=a.value; cats[mo+'|'+D.FIELD[a.field].cat]=[mo,D.FIELD[a.field].cat]; done++; });
    aggregateInto(o,r);
    r.imports=r.imports||[]; r.imports.push({name:im.name, at:isoNow(), by:me().name, rows:byMonth[mo].reduce(function(s,a){ return s+a.n; },0), mapping:im.tpl});
  });
  Object.keys(cats).forEach(function(ck){ var mo=cats[ck][0], cat=cats[ck][1], r=rec(o,mo); if(!r||r.status==='verified'||r.status==='submitted') return; var key=evKey(o.id,mo,cat); if(ui.impFile) putFile(key,ui.impFile);
    r.evidence=r.evidence||{}; r.evidence[cat]={name:im.name, size:ui.impFile?ui.impFile.size:0, type:'text/csv', at:isoNow(), pending:true, grade:null, key:key, imported:true, suggestedGrade:map.grade||'', note:'Imported from '+im.name+' with the "'+im.tpl+'" mapping.'}; });
  log('Import applied',im.name+' · '+done+' figures'+(skipped.length?' · skipped locked: '+skipped.join(', '):''),o.id); save();
  flash(done+' figures imported into '+Object.keys(byMonth).length+' month'+(Object.keys(byMonth).length===1?'':'s')+(skipped.length?'. Skipped locked: '+skipped.join(', '):'')+'.'); ui.imp=null; ui.impFile=null; render();
}

function currentSite(o){ var q=parseHash().q; if(!multisite(o)) return null; if(q.s && siteById(o,q.s)) return q.s; var a=o.sites.filter(function(x){ return x.active!==false; })[0]; return a?a.id:o.sites[0].id; }
function roF(f){ return !isOp() && f.id.indexOf('target_')!==0; }
function siteSel(o){ return multisite(o) ? '<div class="field"><label for="up-s">Site</label><select id="up-s"><option value="">Whole organisation</option>'+o.sites.filter(function(s){ return s.active!==false; }).map(function(s){ return '<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>'; }).join('')+'</select></div>' : ''; }
function declBox(o,r,k,cur,editable){
  var d=declaredCats(r)[cur];
  if(d) return '<div class="note-box" style="margin:10px 0"><b>Declared not reported</b> by '+esc(d.by)+' on '+longDate(d.at)+(d.note?': '+esc(d.note):'')+'. Its required figures no longer block the month.'+(editable?' <button class="btn btn-ghost btn-sm" type="button" data-act="undeclare-ops" data-cat="'+cur+'" style="color:var(--ink)">Undo</button>':'')+'</div>';
  if(!editable) return '';
  return '<details style="margin:8px 0"><summary class="small" style="cursor:pointer">The customer says there is no record for this category</summary><div class="inline-form" style="margin-top:8px"><div class="field" style="flex:1"><label for="dcl-note">What they said, and where (email date, call)</label><input type="text" id="dcl-note"></div><button class="btn btn-ghost btn-sm" type="button" data-act="declare-ops" data-cat="'+cur+'" style="color:var(--ink)">Declare not reported</button></div></details>';
}
function declList(r){ var ks=Object.keys(declaredCats(r)); if(!ks.length) return ''; return '<div class="panel" style="margin-top:16px"><h3>Declared not reported</h3><div class="tbl-wrap" style="margin-top:10px"><table class="tbl compact"><thead><tr><th>Category</th><th>Said by</th><th>When</th><th>Note</th></tr></thead><tbody>'+ks.map(function(c){ var d=r.declared[c]; return '<tr><td>'+esc(D.CAT[c].name)+'</td><td>'+esc(d.by)+' ('+esc(d.role||'')+')</td><td>'+longDate(d.at)+'</td><td class="small">'+esc(d.note||'')+'</td></tr>'; }).join('')+'</tbody></table></div><p class="small muted" style="margin:10px 0 0">Check that the customer\'s word is on file before verifying. The category is left out of the score.</p></div>'; }
function impLoad(file){
  var rd=new FileReader(); rd.onload=function(){
    var rows; try{ rows=parseCSV(String(rd.result||'')); }catch(e){ flash('That file could not be read.','err'); return; }
    rows=rows.filter(function(r){ return r.some(function(c){ return String(c).trim()!==''; }); });
    if(rows.length<2){ flash('The file has no rows.','err'); return; }
    var headers=rows.shift().map(function(h){ return String(h).trim(); }), tpl=($('#im-tpl')||{}).value||Object.keys(state.importMaps)[0], map=state.importMaps[tpl]||{}, cols=guessCols(headers), cn=map.colNames||{};
    ['date','material','qty','unit','site','ref'].forEach(function(k){ if(cn[k]){ var ix=headers.indexOf(cn[k]); if(ix>=0) cols[k]=ix; } });
    ui.imp={orgId:($('#im-org')||{}).value||Object.keys(state.orgs)[0], tpl:tpl, name:file.name, headers:headers, rows:rows, cols:cols, unit:map.unit||'kg', matAdd:{}, preview:null}; ui.impFile=file; render();
  }; rd.readAsText(file);
}
function impBlank(){ download('yarta-import-template.csv','date,site,material,quantity,unit,reference\n2026-09-03,Head office,Cardboard,1250,kg,DK-10233\n2026-09-03,Head office,General waste,3400,kg,DK-10234\n2026-09-10,Distribution centre,Steel,820,kg,DK-10301\n','text/csv'); }

function vNotFound(){ return shell('', '<div class="empty">That page does not exist. <a class="link" href="#/dashboard">Back to the dashboard</a>.</div>'); }

/* ------------------------------------------------------------------ render */
function render(){
  var appEl=document.getElementById('app'); if(!appEl || appEl.hidden) return; /* pages that only use the engine (the sample report) keep #app hidden */
  SITE=null; var h=parseHash(), P=h.parts, q=h.q, html;
  var u=me();
  if(u && window.YESPORTAL_CLIENT && isOp()){ state.session=null; save(); u=null; }   /* the client portal never shows the team's screens */
  if(!u){ html=vLogin(); }
  else if(!P.length){ go(isOp()?(u.home||'#/ops'):'#/dashboard'); return; }
  else {
    var a=P[0];
    if(a==='dashboard') html=vDashboard(q);
    else if(a==='category') html=vCategory(P[1],q);
    else if(a==='submit'){ go(isOp()?'#/ops/entry':'#/dashboard'); return; }
    else if(a==='entry' && isOp()){ if(P[1] && state.orgs[P[1]] && state.session.viewOrg!==P[1]){ state.session.viewOrg=P[1]; save(); } html=P[2]?vSubmit(P[2],q):vEntryQueue(); }
    else if(a==='documents') html=vDocuments();
    else if(a==='sites') html=vSites(P[1]);
    else if(a==='sitereport') html=vSiteReport(P[1],P[2]);
    else if(a==='period') html=vPeriod(P[1]);
    else if(a==='checklist') html=vChecklist();
    else if(a==='reports') html=vReports();
    else if(a==='roadmap') html=vRoadmap();
    else if(a==='book') html=vBook(P[1]);
    else if(a==='improvements') html=P[1]?vBook(P[1]):vImprove();
    else if(a==='report') html=vReport(P[1]);
    else if(a==='organisation') html=vOrganisation();
    else if(a==='data') html=vData();
    else if(a==='ops' && isOp()){ html = !P[1] ? vQueue() : P[1]==='home' ? vOpsHome() : P[1]==='outbox' ? vOutbox() : P[1]==='onboarding' ? vOnboarding(P[2]) : P[1]==='accounts' ? vAccounts(P[2]) : P[1]==='service' ? vService() : P[1]==='sop' ? vSop() : P[1]==='guides' ? vGuides() : P[1]==='import' ? vImport() : P[1]==='checklist' ? vChecklist(P[2]) : P[1]==='gaps' ? vGaps(P[2]) : P[1]==='reports' ? vIssue() : P[1]==='providers' ? vProviders(P[2]) : P[1]==='introduce' ? vIntroduce(P[2]) : (P[1]==='customers' && P[2]==='new') ? vNewCustomer() : P[1]==='entry' ? vEntryQueue() : P[1]==='customers' ? vCustomers() : P[1]==='review' ? vReview(P[2],P[3]) : P[1]==='factors' ? vFactors() : P[1]==='activity' ? vActivity() : P[1]==='bookings' ? vBookings() : vNotFound(); }
    else html=vNotFound();
  }
  app.innerHTML=html;
  document.title = (u?(isOp()?'Yarta team':org().profile.org_name)+' · ':'')+'Yarta portal (prototype)';
  bindMedia();
}
function bindMedia(){ // ambient video on the sign-in screen
  var rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches, conn=navigator.connection||{};
  $$('video[data-bgv]',app).forEach(function(v){ v.muted=true; if(rm||conn.saveData||window.innerWidth<720) return; $$('source[data-src]',v).forEach(function(s){ s.src=s.getAttribute('data-src'); }); v.load(); var p=v.play(); if(p&&p.catch) p.catch(function(){}); });
}

/* ------------------------------------------------------------------ events */
var saveT=null;
function scheduleSave(){ clearTimeout(saveT); var s=$('#saved'); if(s) s.textContent='Saving…'; saveT=setTimeout(function(){ if(save()){ var s2=$('#saved'); if(s2) s2.textContent='Saved in this browser · '+new Date().toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'}); } },350); }
function currentSubmit(){ var h=parseHash(); if(h.parts[0]!=='entry'||!h.parts[2]) return null; var o=state.orgs[h.parts[1]]; if(!o) return null; var r=rec(o,h.parts[2]); return r?{o:o,r:r,k:h.parts[2]}:null; }

app.addEventListener('input', function(e){
  var t=e.target;
  if(t.hasAttribute('data-field')){
    var c=currentSubmit(); if(!c) return; var id=t.getAttribute('data-field'), f=field(id);
    var val=t.value; SITE=currentSite(c.o); var tv=SITE?svals(c.r,SITE):c.r.values;
    if(f.kind==='text'||f.kind==='select'){ if(val==='') delete tv[id]; else tv[id]=val; }
    else { if(val===''||!isFinite(+val)) delete tv[id]; else tv[id]=+val; }
    if(f.freq==='S'){ var prevC=carried(c.o,E.addMonths(c.k,-1),id); if(tv[id]!=null && prevC!=null && +tv[id]===prevC) delete tv[id]; }
    if(SITE) aggregateInto(c.o,c.r);
    var w=warnFor(c.o,c.k,id,tv[id]); var wEl=$('[data-warn="'+id+'"]'); if(wEl) wEl.textContent=w; t.classList.toggle('bad',!!w);
    var pr=progressOf(c.o,c.r); var pt=$('#prog-t'), pb=$('#prog-b'); if(pt) pt.textContent=pr.req+' of '+pr.reqDue; if(pb) pb.style.width=(pr.reqDue?pr.req/pr.reqDue*100:0)+'%';
    var cc=$('[data-cc="'+f.cat+'"]'); if(cc){ var due=dueFields(c.o,c.k).filter(function(x){ return x.cat===f.cat; }); var rq=due.filter(function(x){ return x.req; }); var ok=rq.filter(function(x){ return isNum(c.r.values[x.id]); }).length; cc.textContent=rq.length?ok+'/'+rq.length:'✓'; cc.classList.toggle('ok', rq.length?ok===rq.length:true); }
    var cp=$('#calc'); if(cp) cp.innerHTML=calcPanel(c.o,c.r,c.k);
    SITE=null; scheduleSave();
  }
});
app.addEventListener('change', function(e){
  var t=e.target, act=t.getAttribute('data-act');
  if(act==='dash-month'){ go('#/dashboard?m='+t.value); }
  else if(act==='imp-file' && t.files && t.files[0]){ impLoad(t.files[0]); }
  else if(act==='imp-tpl'){ if(ui.imp){ ui.imp.tpl=t.value; var mp=state.importMaps[t.value]||{}; ui.imp.unit=mp.unit||ui.imp.unit; var cn2=mp.colNames||{}; ['date','material','qty','unit','site','ref'].forEach(function(k){ if(cn2[k]){ var ix=ui.imp.headers.indexOf(cn2[k]); if(ix>=0) ui.imp.cols[k]=ix; } }); ui.imp.preview=null; render(); } }
  else if(act==='imp-map'){ if(ui.imp){ var mkey=t.getAttribute('data-mat').toLowerCase(); ui.imp.matAdd=ui.imp.matAdd||{}; if(t.value) ui.imp.matAdd[mkey]=t.value; else delete ui.imp.matAdd[mkey]; ui.imp.preview=buildImportPreview(ui.imp); render(); } }
  else if(act==='set-operator'){ var so=state.orgs[t.getAttribute('data-org')]; if(so){ so.profile.operator=t.value; log('Data operator assigned',(opById(t.value)||{}).name||'',so.id); save(); flash('Operator assigned.'); } }
  else if(act==='plan-toggle'){ var po=org(); po.plan=po.plan||{off:{}}; po.plan.off=po.plan.off||{}; var sv=t.getAttribute('data-svc'); if(t.checked) delete po.plan.off[sv]; else po.plan.off[sv]=true; save(); render(); }
  else if(act==='ev-file' && t.files && t.files[0]){ attach(t.getAttribute('data-cat'), t.files[0]); }
  else if(act==='import-file' && t.files && t.files[0]){ previewImport(t.files[0]); }
  else if(act==='ev-pick' && t.value!==''){ var c3=currentSubmit(); if(!c3) return; var d=(c3.r.inbox||[])[+t.value]; if(!d) return; c3.r.evidence=c3.r.evidence||{}; c3.r.evidence[t.getAttribute('data-cat')]={name:d.name,size:d.size,type:d.type,at:isoNow(),pending:true,grade:null,key:d.key,demo:!d.key}; save(); render(); }
  else if(act==='inbox-file' && t.files && t.files.length){ sendDocs([].slice.call(t.files)); }
  else if(t.hasAttribute('data-grade')){ var h=parseHash(), o=state.orgs[h.parts[2]], r=rec(o,h.parts[3]); var cat=t.getAttribute('data-grade'); if(r&&r.evidence&&r.evidence[cat]){ r.evidence[cat].grade=t.value||null; if(t.value) r.evidence[cat].pending=false; else r.evidence[cat].pending=true; save(); } }
});
function attach(cat,file){
  var c=currentSubmit(); if(!c) return;
  if(file.size>15*1024*1024){ flash('That file is over 15 MB. Attach a smaller copy.','err'); return; }
  var key=evKey(c.o.id,c.k,cat);
  putFile(key,file).then(function(){ c.r.evidence=c.r.evidence||{}; c.r.evidence[cat]={name:file.name,size:file.size,type:file.type,at:isoNow(),pending:true,grade:null,key:key}; save(); log('Evidence attached',D.CAT[cat].name+' · '+file.name+' · '+mLabel(c.k)); save(); render(); flash('Attached '+file.name); })
    .catch(function(){ flash('This browser would not store the file.','err'); });
}
app.addEventListener('dragover', function(e){ var z=e.target.closest&&e.target.closest('[data-drop]'); if(z){ e.preventDefault(); z.classList.add('drag'); } });
app.addEventListener('dragleave', function(e){ var z=e.target.closest&&e.target.closest('[data-drop]'); if(z) z.classList.remove('drag'); });
app.addEventListener('drop', function(e){ var z=e.target.closest&&e.target.closest('[data-drop]'); if(!z) return; e.preventDefault(); z.classList.remove('drag'); var c=currentSubmit(); if(!c||!isOp()||!(c.r.status==='draft'||c.r.status==='returned')) return; var f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]; if(f) attach(z.getAttribute('data-drop'),f); });

function sendDocs(files){
  var o=org(), k=($('#up-m')||{}).value||E.addMonths(nowKey(),-1), cat=($('#up-c')||{}).value||'';
  var big=files.filter(function(f){ return f.size>15*1024*1024; }); if(big.length){ flash(big[0].name+' is over 15 MB. Send a smaller copy.','err'); return; }
  var r=rec(o,k); var created=false; if(!r){ r={month:k, values:{}, evidence:{}, status:'draft', inbox:[]}; o.records.push(r); created=true; } r.inbox=r.inbox||[];
  var jobs=files.map(function(f,i){ var key='inbox/'+o.id+'/'+k+'/'+Date.now()+'-'+i; return putFile(key,f).then(function(){ r.inbox.push({site:($('#up-s')||{}).value||'', siteName:($('#up-s')&&$('#up-s').value?$('#up-s').selectedOptions[0].text:''), key:key,name:f.name,size:f.size,type:f.type,cat:cat,at:isoNow(),by:me().name}); }); });
  Promise.all(jobs).then(function(){ log('Documents received',files.length+' for '+mLabel(k)+(created?' · month opened for data entry':''),o.id); save(); render(); flash(files.length+' document'+(files.length===1?'':'s')+' sent to Yarta for '+mLabel(k)+'.'); }).catch(function(){ flash('This browser would not store the files.','err'); });
}
function previewImport(file){
  var rd=new FileReader(); rd.onload=function(){
    var o=org(), text=String(rd.result||''), items=[], skip=0;
    try{
      if(/\.json$/i.test(file.name)||/^\s*\{/.test(text)){ var j=JSON.parse(text); (j.records||[]).forEach(function(r){ Object.keys(r.values||{}).forEach(function(id){ items.push([r.month,id,r.values[id]]); }); }); }
      else { var rows=parseCSV(text); var hd=rows.shift().map(function(h){ return h.trim().toLowerCase(); }); var im=hd.indexOf('month'), ii=hd.indexOf('field_id'), iv=hd.indexOf('value'); if(im<0||ii<0||iv<0) throw new Error('The CSV needs month, field_id and value columns.'); rows.forEach(function(r){ items.push([r[im],r[ii],r[iv]]); }); }
    }catch(err){ flash(err.message||'That file could not be read.','err'); return; }
    var ok=[], months={};
    items.forEach(function(it){ var k=String(it[0]).trim(), id=String(it[1]).trim(), f=D.FIELD[id]; if(!/^\d{4}-\d{2}$/.test(k)||!f||f.type!=='input'){ skip++; return; } var r=rec(o,k); if(r && (r.status==='submitted'||r.status==='verified')){ skip++; return; } if(k>nowKey()){ skip++; return; } ok.push([k,id,it[2]]); months[k]=1; });
    ui.importPreview={name:file.name, items:ok, ok:ok.length, skip:skip, months:Object.keys(months).sort()};
    render();
  };
  rd.readAsText(file);
}

function bkDesc(b){ var s=R&&R.byKey[b.svc], o=state.orgs[b.org]; return (o?o.profile.org_name+' · ':'')+(s?R.title(s,o?o.profile:{}):b.svc)+' · '+slotLabel(b.slot,b.other); }
function bookSubmit(key){
  var o=org(), s=R&&R.byKey[key]; if(!s) return;
  var sl=ui.bookSlot; if(!sl){ flash('Choose a time, or Another time.','err'); var g=$('.slots'); if(g) g.scrollIntoView({block:'center'}); return; }
  var mode=($('input[name="bk-mode"]:checked')||{}).value||s.modes[0];
  var name=($('#bk-name').value||'').trim(), email=($('#bk-email').value||'').trim(), notes=($('#bk-notes').value||'').trim(), loc=($('#bk-loc').value||'').trim(), share=!!($('#bk-share')||{}).checked;
  if(!name){ flash('Add a contact name.','err'); $('#bk-name').focus(); return; }
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ flash('Add a valid contact email.','err'); $('#bk-email').focus(); return; }
  if(sl==='other' && !notes){ flash('Say in the notes which time suits you.','err'); $('#bk-notes').focus(); return; }
  if(sl!=='other' && slotTaken(sl,key,o.id)){ flash('That time has just been taken. Choose another.','err'); return; }
  var S=seriesOf(o), m=monthOf(S), i=m?idxOf(S,m.month):-1, r=m?R.recommend(S,i,o.profile).filter(function(x){ return x.k===key; })[0]:null;
  var b={id:'bk-'+Date.now().toString(36), org:o.id, svc:key, status:'requested', slot:sl==='other'?null:sl, other:sl==='other', mode:mode, location:mode==='On site'?loc:'', contact:name, email:email, notes:notes, share:share, why:share&&r?r.why:'', month:m?m.month:null, group:s.prov==='group', createdAt:isoNow(), createdBy:me().name};
  state.bookings=state.bookings||[]; state.bookings.push(b);
  log('Help requested',bkDesc(b),o.id); save(); ui.bookSlot=null;
  flash('Requested: '+R.title(s,o.profile)+'.'); go('#/improvements');
}

document.addEventListener('click', function(e){
  var t=e.target.closest ? e.target.closest('[data-act]') : null; if(!t) return;
  var act=t.getAttribute('data-act'), o;
  if(t.tagName==='INPUT'||t.tagName==='SELECT') return;
  switch(act){
    case 'login': state.session={user:t.getAttribute('data-user')}; if(isOp()) state.session.viewOrg='demo-shire'; save(); go(isOp()?(me().home||'#/ops'):'#/dashboard'); break;
    case 'ltab': ui.loginTab=t.getAttribute('data-tab'); render(); break;
    case 'signout': state.session=null; ui.loginTab='customer'; save(); go('#/'); render(); break;
    case 'side-open': $('#side').classList.add('open'); break;
    case 'side-close': $('#side').classList.remove('open'); break;
    case 'reset-demo': case 'reset-go': var sess=state.session; state=X.build(); if(act==='reset-go') state.session=sess; save(); clearFiles(); ui.confirmReset=false; ui.importPreview=null; flash('Demo data reset.'); render(); break;
    case 'reset-ask': ui.confirmReset=true; render(); break;
    case 'reset-cancel': ui.confirmReset=false; render(); break;
    case 'view-org': state.session.viewOrg=t.getAttribute('data-org'); save(); go('#/dashboard'); break;
    case 'print': window.print(); break;
    case 'start-month': o=state.orgs[t.getAttribute('data-org')]||org(); var nk=t.getAttribute('data-month'); if(!rec(o,nk)){ o.records.push({month:nk, values:{}, evidence:{}, status:'draft', inbox:[], enteredBy:me().name}); log('Month opened for data entry',mLabel(nk),o.id); save(); } go('#/entry/'+o.id+'/'+nk); break;
    case 'submit-ask': ui.confirmSubmit=true; render(); var sb=$('#submit-box'); if(sb) sb.scrollIntoView({block:'center'}); break;
    case 'submit-cancel': ui.confirmSubmit=false; render(); break;
    case 'submit-month': var c=currentSubmit(); if(!c) return; var pr=progressOf(c.o,c.r); if(pr.missing.length){ flash('Some required figures are still missing.','err'); return; } if(!$('#attest')||!$('#attest').checked){ flash('Please tick the confirmation first.','err'); return; } c.r.status='submitted'; c.r.submittedAt=isoNow().slice(0,10); c.r.enteredAt=c.r.submittedAt; c.r.enteredBy=me().name; Object.keys(c.r.evidence||{}).forEach(function(cat){ if(!c.r.evidence[cat].grade) c.r.evidence[cat].pending=true; }); log('Month entered and sent for verification',mLabel(c.k)+' · '+pr.req+' required figures',c.o.id); save(); ui.confirmSubmit=false; flash(c.o.profile.org_name+' · '+mLabel(c.k)+' sent for verification.'); go('#/ops/entry'); break;
    case 'ev-remove': var c2=currentSubmit(); if(!c2) return; var cat=t.getAttribute('data-cat'), ek=evKey(c2.o.id,c2.k,cat), cur2=c2.r.evidence[cat]; if(cur2 && cur2.key===ek) delFile(ek).catch(function(){}); delete c2.r.evidence[cat]; save(); render(); break;
    case 'ev-open': getFile(t.getAttribute('data-key')).then(function(f){ if(!f){ flash('That file is not stored in this browser.','err'); return; } var u=URL.createObjectURL(f); window.open(u,'_blank'); setTimeout(function(){ URL.revokeObjectURL(u); },60000); }).catch(function(){ flash('That file is not stored in this browser.','err'); }); break;
    case 'save-profile': o=org(); var errs=[]; $$('[data-pf]').forEach(function(el){ var id=el.getAttribute('data-pf'), f=field(id), v=el.value; if(!isOp() && id.indexOf('target_')!==0) return; if(f.kind==='number'||f.kind==='count'||f.kind==='percent'){ if(v===''){ if(f.req) errs.push(f.name); else delete o.profile[id]; } else if(!isFinite(+v)||+v<0){ errs.push(f.name); } else o.profile[id]=+v; } else { if(v===''&&f.req) errs.push(f.name); else o.profile[id]=v; } }); if(errs.length){ flash('Check: '+errs.join(', '),'err'); return; } log('Profile updated',''); save(); flash('Saved. Every month has been recalculated.'); render(); break;
    case 'csv-all': o=org(); download(o.id+'-monthly-figures.csv', longRows(o), 'text/csv'); break;
    case 'csv-month': o=org(); var mk=t.getAttribute('data-month'); download(o.id+'-'+mk+'.csv', longRows(o,[mk]), 'text/csv'); break;
    case 'json-all': o=org(); download(o.id+'-yes-export.json', JSON.stringify({exported:isoNow(), method:E.VERSION, dictionary:D.VERSION, profile:o.profile, records:o.records},null,2), 'application/json'); break;
    case 'csv-dict': var rows=[['id','name','category','type','unit','frequency','mandatory','kind','source','definition','calculation','scores']].concat(D.FIELDS.map(function(f){ return [f.id,f.name,D.CAT[f.cat].name,f.type==='calc'?'Calculated by Yarta':'Entered by customer',f.unit,D.FREQ[f.freq],f.type==='calc'?'n/a':(f.req?'yes':'no'),f.kind,f.src,f.def,f.calc||'',(f.score||[]).map(function(s){ return D.CAT[s]?D.CAT[s].name:s; }).join('; ')]; })); download('yes-data-dictionary.csv', rows.map(function(r){ return r.map(csvCell).join(','); }).join('\n'), 'text/csv'); break;
    case 'import-cancel': ui.importPreview=null; render(); break;
    case 'import-go': o=org(); var pv=ui.importPreview; if(!pv) return; pv.items.forEach(function(it){ var r=rec(o,it[0]); if(!r){ r={month:it[0],values:{},evidence:{},status:'draft'}; o.records.push(r); } if(r.status==='submitted'||r.status==='verified') return; var f=D.FIELD[it[1]]; var v=it[2]; if(f.kind==='text'||f.kind==='select'){ if(v!=='') r.values[it[1]]=v; } else if(v!==''&&isFinite(+v)) r.values[it[1]]=+v; }); log('Figures imported',pv.ok+' figures from '+pv.name); save(); ui.importPreview=null; flash('Imported '+pv.ok+' figures into months open for data entry.'); go('#/ops/entry'); break;
    case 'verify': var ov=state.orgs[t.getAttribute('data-org')], rv=rec(ov,t.getAttribute('data-month')); if(rv.enteredBy && rv.enteredBy===me().name){ flash('You entered this month, so a different analyst must verify it.','err'); return; } var ungraded=Object.keys(rv.evidence||{}).filter(function(cat){ return !rv.evidence[cat].grade; }); if(ungraded.length){ flash('Grade every attached document first ('+ungraded.map(function(c){ return D.CAT[c].short; }).join(', ')+').','err'); return; } rv.status='verified'; rv.verifiedAt=isoNow().slice(0,10); rv.verifiedBy=me().name; var note=($('#rv-note')||{}).value; if(note){ rv.notes=rv.notes||[]; rv.notes.push({by:me().name,at:isoNow(),text:note}); } log('Month verified',mLabel(rv.month),ov.id); save(); flash(ov.profile.org_name+' · '+mLabel(rv.month)+' verified.'); go('#/ops'); break;
    case 'slot': ui.bookSlot=t.getAttribute('data-slot'); $$('.slot',app).forEach(function(x){ x.setAttribute('aria-pressed', x===t?'true':'false'); }); break;
    case 'book-submit': bookSubmit(t.getAttribute('data-svc')); break;
    case 'bk-confirm': var bc=bkById(t.getAttribute('data-id')); if(!bc) return; bc.status='confirmed'; bc.confirmedAt=isoNow(); bc.confirmedBy=me().name; log('Booking confirmed',bkDesc(bc),bc.org); save(); flash('Confirmed: '+bkDesc(bc)+'.'); render(); break;
    case 'bk-done': var bd=bkById(t.getAttribute('data-id')); if(!bd) return; var sm=bd.slot?bd.slot.slice(0,7):nowKey(); bd.status='completed'; bd.completedMonth=sm<=nowKey()?sm:nowKey(); bd.completedAt=isoNow(); bd.completedBy=me().name; log('Help marked done',bkDesc(bd)+' · '+mLabel(bd.completedMonth),bd.org); save(); flash('Marked done. The change shows as later months are verified.'); render(); break;
    case 'bk-cancel-op': case 'bk-cancel-go': var bx=bkById(t.getAttribute('data-id')); if(!bx) return; bx.status='cancelled'; bx.cancelledAt=isoNow(); bx.cancelledBy=me().name; ui.confirmCancel=null; log('Booking cancelled',bkDesc(bx),bx.org); save(); flash('Booking cancelled.'); render(); break;
    case 'bk-cancel': ui.confirmCancel=t.getAttribute('data-id'); render(); break;
    case 'bk-cancel-no': ui.confirmCancel=null; render(); break;
    case 'in-copy': copyText('Subject: '+($('#in-subj')||{}).value+'\n\n'+($('#in-body')||{}).value); break;
    case 'view-report': state.session.viewOrg=t.getAttribute('data-org'); save(); go('#/report/'+t.getAttribute('data-month')); break;
    case 'issue-report': var io=state.orgs[t.getAttribute('data-org')], ir=rec(io,t.getAttribute('data-month')); if(!ir||ir.status!=='verified') return; ir.issuedAt=isoNow().slice(0,10); ir.issuedBy=me().name; log('Report issued',mLabel(ir.month),io.id); queueMail('issued',io.id,customerEmails(io),'Your Yarta Report for '+mLabel(ir.month)+' is ready','Hi,\n\nYour Yarta Report for '+io.profile.org_name+' · '+mLabel(ir.month)+' has been issued. Sign in to read it, print it or save it as a PDF, and to see the roadmap and what to do next.\n\nThe score is self-declared under the published Yarta Method; the report states the method version and the benchmark edition it was calculated under.\n\nThanks,\n'+((operatorOf(io)||me()).name)+'\nYarta',ir.month); save(); flash(io.profile.org_name+' · '+mLabel(ir.month)+' report issued.'); render(); break;
    case 'prov-check': var pc=provById(t.getAttribute('data-id')); if(!pc) return; pc.checkedAt=today(); pc.checkedBy=me().name; log('Provider accreditation checked',pc.name,null); save(); flash(pc.name+' marked as checked today.'); render(); break;
    case 'prov-save': var pid=t.getAttribute('data-id'), pv2=pid?provById(pid):null; var pn=($('#pv-name').value||'').trim(); if(!pn){ flash('Add the provider name.','err'); return; } var svcs=$$('[data-psvc]').filter(function(x){ return x.checked; }).map(function(x){ return x.getAttribute('data-psvc'); }); if(!svcs.length){ flash('Tick at least one kind of help.','err'); return; } var acc=($('#pv-acc').value||'').trim(); if(!acc){ flash('Record the accreditation or licence held.','err'); return; } if(!pv2){ pv2={id:'pv-'+Date.now().toString(36), checkedAt:today(), checkedBy:me().name}; state.providers.push(pv2); } pv2.name=pn; pv2.kind=$('#pv-kind').value; pv2.svc=svcs; pv2.accreditation=acc; pv2.licence=($('#pv-lic').value||'').trim(); pv2.expiry=$('#pv-exp').value||''; pv2.contact=($('#pv-contact').value||'').trim(); pv2.email=($('#pv-email').value||'').trim(); pv2.phone=($('#pv-phone').value||'').trim(); pv2.notes=($('#pv-notes').value||'').trim(); pv2.demo=false; log(pid?'Provider updated':'Provider added',pn,null); save(); flash('Saved '+pn+'.'); go('#/ops/providers'); break;
    case 'prov-remove': var prid=t.getAttribute('data-id'); if((state.bookings||[]).some(function(b){ return b.provider===prid && b.status!=='cancelled'; })){ flash('This provider is assigned to a booking. Reassign it first.','err'); return; } state.providers=(state.providers||[]).filter(function(x){ return x.id!==prid; }); log('Provider removed',prid,null); save(); go('#/ops/providers'); break;
    case 'in-assign': var ib=bkById(t.getAttribute('data-id')); if(!ib) return; var ipv=$('#in-prov').value; if(!ipv){ flash('Choose a provider.','err'); return; } var ipp=provById(ipv); if(provStatus(ipp).k==='lapsed'){ flash('That provider\'s accreditation has lapsed.','err'); return; } ib.provider=ipv; log('Provider assigned',ipp.name+' · '+bkDesc(ib),ib.org); save(); flash(ipp.name+' assigned.'); render(); break;
    case 'in-sent': var sb2=bkById(t.getAttribute('data-id')); if(!sb2||!sb2.provider) return; sb2.introducedAt=isoNow(); sb2.introducedBy=me().name; if(sb2.status==='requested'){ sb2.status='confirmed'; sb2.confirmedAt=isoNow(); sb2.confirmedBy=me().name; } log('Provider introduced',provById(sb2.provider).name+' · '+bkDesc(sb2),sb2.org); queueMail('introduction',sb2.org,introEmail(sb2).to,($('#in-subj')||{}).value||introEmail(sb2).subject,($('#in-body')||{}).value||introEmail(sb2).body,sb2.id); save(); flash('Marked as introduced.'); render(); break;
    case 'set-operator': var so=state.orgs[t.getAttribute('data-org')]; if(!so) return; so.profile.operator=t.getAttribute('data-op'); log('Data operator assigned',(opById(so.profile.operator)||{}).name||'',so.id); save(); render(); break;
    case 'nc-create': createCustomer(); break;
    case 'gap-sent': var gso=state.orgs[t.getAttribute('data-org')], gmo=t.getAttribute('data-month'), gk2=t.getAttribute('data-key'), gsubj=($('#gap-subj-'+gk2)||{}).value||'', gbody=($('#gap-body-'+gk2)||{}).value||''; state.gapLog=state.gapLog||[]; state.gapLog.push({org:gso.id, month:gmo, site:gk2==='org'?'':gk2, at:isoNow(), by:me().name, subject:gsubj}); queueMail('gap',gso.id,t.getAttribute('data-to'),gsubj,gbody,gmo+(gk2==='org'?'':'/'+gk2)); log('Gap email queued',mLabel(gmo)+(gk2==='org'?'':' · '+(siteById(gso,gk2)||{}).name),gso.id); save(); flash('Queued in the outbox.'); render(); break;
    case 'gap-copy': var gk3=t.getAttribute('data-key'); copyText('Subject: '+($('#gap-subj-'+gk3)||{}).value+'\n\n'+($('#gap-body-'+gk3)||{}).value); break;
    case 'mx-sent': var mx=(state.outbox||[]).filter(function(m){ return m.id===t.getAttribute('data-id'); })[0]; if(mx){ mx.status='sent'; mx.sentAt=isoNow().slice(0,10); mx.sentBy=me().name; save(); render(); } break;
    case 'mx-copy': var mx2=(state.outbox||[]).filter(function(m){ return m.id===t.getAttribute('data-id'); })[0]; if(mx2) copyText('To: '+mx2.to+'\nSubject: '+mx2.subject+'\n\n'+mx2.body); break;
    case 'mx-export': download('yarta-outbox-queue.json', JSON.stringify({exported:isoNow(), messages:(state.outbox||[]).filter(function(m){ return m.status==='queued'; })},null,2), 'application/json'); break;
    case 'onb-toggle': var oo=state.orgs[t.getAttribute('data-org')], ok2=t.getAttribute('data-k'); oo.onboarding=oo.onboarding||onbInit(); if(oo.onboarding.done[ok2]) delete oo.onboarding.done[ok2]; else oo.onboarding.done[ok2]={at:today(),by:me().name}; log('Onboarding step '+(oo.onboarding.done[ok2]?'done':'reopened'),(onbSteps().filter(function(x){ return x.k===ok2; })[0]||{}).label||ok2,oo.id); save(); render(); break;
    case 'ac-save': var ao=state.orgs[t.getAttribute('data-org')]; ao.subscription={status:$('#ac-status').value, foundation:$('#ac-found').checked, start:$('#ac-start').value, termMonths:+$('#ac-term').value||12, monthlyOverride:$('#ac-mo').value, estFee:+$('#ac-fee').value||0, estStatus:$('#ac-est').value, notes:$('#ac-notes').value}; log('Account updated',ao.profile.org_name,ao.id); save(); flash('Saved.'); go('#/ops/accounts'); break;
    case 'gd-add': var gw=($('#gd-who').value||'').trim(), gn=($('#gd-note').value||'').trim(); if(!gw||!gn){ flash('Add who it is about and what you learned.','err'); return; } state.guideNotes=state.guideNotes||[]; state.guideNotes.unshift({who:gw,type:$('#gd-type').value,note:gn,by:me().name,at:isoNow()}); save(); render(); break;
    case 'gd-del': state.guideNotes.splice(+t.getAttribute('data-i'),1); save(); render(); break;
    case 'site-save': o=org(); var sfirst=t.getAttribute('data-first')==='1', sid=t.getAttribute('data-id'), sname=($('#st-name').value||'').trim(); if(!sname){ flash('Add the site name.','err'); return; }
      var scats=$$('[data-scat]').filter(function(x){ return x.checked; }).map(function(x){ return x.getAttribute('data-scat'); }); if(!scats.length){ flash('Tick at least one category the site reports on.','err'); return; }
      if(sfirst){ o.sites=[{id:'s1',name:'Whole organisation so far',kind:'Other',state:o.profile.state,employees:o.profile.employees||'',floor_area:o.profile.floor_area||'',contact:'',email:'',cats:D.CATEGORIES.filter(function(c){ return c.k!=='carbon'; }).map(function(c){ return c.k; }),active:true}]; o.records.forEach(function(r){ r.sites={s1:{values:JSON.parse(JSON.stringify(r.values||{}))}}; }); }
      var sobj=sid?siteById(o,sid):null; if(!sobj){ var n2=o.sites.length+1; while(siteById(o,'s'+n2)) n2++; sobj={id:'s'+n2,active:true}; o.sites.push(sobj); }
      sobj.name=sname; sobj.kind=$('#st-kind').value; sobj.state=$('#st-state').value; sobj.employees=+$('#st-emp').value||''; sobj.floor_area=+$('#st-area').value||''; sobj.contact=($('#st-contact').value||'').trim(); sobj.email=($('#st-email').value||'').trim(); sobj.cats=scats;
      log(sid?'Site updated':'Site added',sname,o.id); save(); flash('Saved '+sname+'.'); go('#/sites'); break;
    case 'site-toggle': o=org(); var st3=siteById(o,t.getAttribute('data-id')); if(st3){ st3.active=st3.active===false; log(st3.active?'Site reactivated':'Site retired',st3.name,o.id); save(); go('#/sites'); } break;
    case 'declare': o=state.orgs[t.getAttribute('data-org')]||org(); if(declare(o,$('#dc-m').value,$('#dc-c').value,($('#dc-n').value||'').trim())){ flash('Marked not reported. Yarta will not ask for it.'); render(); } break;
    case 'undeclare': o=state.orgs[t.getAttribute('data-org')]||org(); var ur=rec(o,t.getAttribute('data-month')); if(ur&&ur.declared&&(ur.status==='draft'||ur.status==='returned')){ delete ur.declared[t.getAttribute('data-cat')]; log('Declaration withdrawn',D.CAT[t.getAttribute('data-cat')].name+' · '+mLabel(ur.month),o.id); save(); render(); } break;
    case 'declare-ops': var dc=currentSubmit(); if(!dc) return; var dnote=($('#dcl-note')||{}).value||''; if(!dnote.trim()){ flash('Record what the customer said and where, so the verifier can check it.','err'); return; } if(declare(dc.o,dc.k,t.getAttribute('data-cat'),dnote.trim())){ flash('Declared not reported.'); render(); } break;
    case 'undeclare-ops': var du=currentSubmit(); if(!du) return; if(du.r.declared) delete du.r.declared[t.getAttribute('data-cat')]; log('Declaration withdrawn',D.CAT[t.getAttribute('data-cat')].name+' · '+mLabel(du.k),du.o.id); save(); render(); break;
    case 'carbon-csv': o=org(); var crow=carbonRows(o); download(o.id+'-carbon-by-scope.csv', crow.map(function(r){ return r.map(csvCell).join(','); }).join('\n'), 'text/csv'); break;
    case 'imp-blank': impBlank(); break;
    case 'imp-preview': var im=ui.imp; if(!im) return; im.orgId=$('#im-org').value; ['date','material','qty','unit','site','ref'].forEach(function(k){ var el=$('#cm-'+k); im.cols[k]=el?+el.value:-1; }); im.unit=$('#cm-defunit').value; if(im.cols.date<0||im.cols.material<0||im.cols.qty<0){ flash('Choose the date, material and quantity columns.','err'); return; } im.preview=buildImportPreview(im); render(); break;
    case 'imp-save-map': var im2=ui.imp; if(!im2) return; var mn2=($('#im-save')||{}).value||im2.tpl; mn2=mn2.trim()||im2.tpl; var base=state.importMaps[im2.tpl]||{}; var cn={}; ['date','material','qty','unit','site','ref'].forEach(function(k){ if(im2.cols[k]>=0) cn[k]=im2.headers[im2.cols[k]]; }); var mm={}, k3; for(k3 in (base.mat||{})) mm[k3]=base.mat[k3]; for(k3 in (im2.matAdd||{})) mm[k3]=im2.matAdd[k3]; state.importMaps[mn2]={kind:base.kind||'contractor', grade:base.grade||'B', source:base.source||'Contractor report', note:base.note||'', unit:im2.unit, colNames:cn, mat:mm}; im2.tpl=mn2; im2.matAdd={}; save(); flash('Mapping saved as "'+mn2+'".'); render(); break;
    case 'imp-go': importApply(); break;
    case 'imp-cancel': ui.imp=null; ui.impFile=null; render(); break;
    case 'return': var or=state.orgs[t.getAttribute('data-org')], rr=rec(or,t.getAttribute('data-month')); var nt=($('#rv-note')||{}).value; if(!nt||!nt.trim()){ flash('Add a note so data entry knows what to fix.','err'); var ta=$('#rv-note'); if(ta) ta.focus(); return; } rr.status='returned'; rr.notes=rr.notes||[]; rr.notes.push({by:me().name,at:isoNow(),text:nt.trim()}); log('Month returned to data entry',mLabel(rr.month)+' · '+nt.trim(),or.id); var ea=state.users.filter(function(x){ return x.name===rr.enteredBy; })[0]; queueMail('returned',or.id,ea?ea.email:'','Returned: '+or.profile.org_name+' · '+mLabel(rr.month),'The verifier returned '+or.profile.org_name+' · '+mLabel(rr.month)+' to data entry.\n\n'+nt.trim()+'\n\nOpen the month in Data entry, fix it and send it for verification again.\n\n'+me().name,rr.month); save(); flash('Returned to data entry with your note.'); go('#/ops'); break;
  }
});

/* for pages that embed a report outside the app (the Yarta sample on the Yarta site) */
window.YESPortal={reportSheets:reportSheets, org:org, seriesOf:seriesOf, mLabel:mLabel, state:state,
  currentOrgId:ctxOrgId,
  /* sign in as the customer of an organisation (the public demo and the sample report use this) */
  signInAsOperator:function(userId, hash){ var u=state.users.filter(function(x){ return x.role==='operator' && x.id===userId; })[0]; if(!u) return false; state.session={user:u.id, viewOrg:(state.session&&state.session.viewOrg)||'demo-shire'}; ui.loginTab='operator'; save(); if(location.hash===(hash||'#/ops/home')) render(); else location.hash=hash||'#/ops/home'; return true; },
  signInAs:function(orgId, hash){ var u=state.users.filter(function(x){ return x.role==='customer' && x.org===orgId; })[0]; if(!u) return false; state.session={user:u.id}; ui.loginTab='customer'; save(); if(hash!==false){ if(location.hash===(hash||'#/dashboard')) render(); else location.hash=hash||'#/dashboard'; } return true; }
};
render();
})();
