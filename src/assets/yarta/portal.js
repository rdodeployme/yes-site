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
var ui = { flash:null, flashT:null, loginTab:'customer', confirmSubmit:false, confirmReset:false, importPreview:null, bookSlot:null, confirmCancel:null };

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
  try{ var s=JSON.parse(localStorage.getItem(KEY)); if(s && s.v===3 && s.orgs && s.users){ s.bookings=s.bookings||[]; return s; } }catch(e){}
  var fresh = X.build(); persist(fresh); return fresh;
}
function persist(s){
  try{ localStorage.setItem(KEY, JSON.stringify(s||state)); return true; }
  catch(e){ flash('This browser would not save the change (storage is full or blocked).','err'); return false; }
}
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
function carried(o,k,id){ var rs=sorted(o); for(var i=rs.length-1;i>=0;i--){ if(rs[i].month<=k && rs[i].values && isNum(rs[i].values[id])) return +rs[i].values[id]; if(rs[i].month<=k && rs[i].values && rs[i].values[id]!=null && rs[i].values[id]!=='' && !isNum(rs[i].values[id]) && field(id) && (field(id).kind==='select'||field(id).kind==='text')) return rs[i].values[id]; } return null; }
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
  var col=o.color||'#4FC17A', txt=o.dark?'#FFFFFF':'#0B0B0B';
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
  return '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-hidden="true"><path d="'+d+'" fill="none" stroke="'+(o.color||'#1D7A43')+'" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>';
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
      ['#/ops/entry','Data entry','entry', entryQueue().length||''],
      ['#/ops','Verification','ops', queue().length||''],
      ['#/ops/bookings','Bookings','bookings', (state.bookings||[]).filter(function(b){ return b.status==='requested'; }).length||''],
      ['#/ops/customers','Customers','customers'],
      ['#/ops/factors','Factor library','factors'],
      ['#/ops/activity','Activity','activity'],
      ['grp','Viewing '+(o?o.profile.org_name:'')],
      ['#/dashboard','Dashboard','dashboard'],
      ['#/reports','Reports','reports'],
      ['#/roadmap','Roadmap and help','roadmap'],
      ['#/documents','Documents','documents'],
      ['#/organisation','Organisation','organisation'],
      ['#/data','Data and export','data']
    ] : [
      ['grp','Reporting'],
      ['#/dashboard','Dashboard','dashboard'],
      ['#/reports','Reports','reports'],
      ['#/roadmap','Roadmap and help','roadmap'],
      ['#/documents','Send documents','documents'],
      ['grp','Account'],
      ['#/organisation','Organisation','organisation'],
      ['#/data','Data and export','data']
    ];
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
  var accts = state.users.filter(function(u){ return ui.loginTab==='operator' ? u.role==='operator' : u.role==='customer'; });
  var list = accts.map(function(u){ var o=u.org?state.orgs[u.org]:null; return '<button class="acct" type="button" data-act="login" data-user="'+esc(u.id)+'"><span class="av">'+esc(initials(u.name))+'</span><span class="nm">'+esc(u.name)+'</span><span class="go" aria-hidden="true">→</span><span class="ds">'+esc(u.title)+(o?' · '+esc(o.profile.org_name):'')+'</span></button>'; }).join('');
  return '<div class="login"><div class="l"><div class="bg" aria-hidden="true"><video data-bgv muted loop playsinline preload="none" poster="../assets/video/silver-720.webp"><source data-src="../assets/video/silver-720.mp4" type="video/mp4"></video></div>'
   + '<a class="brand" href="../"><span class="mark silver" style="font-size:30px">Yarta</span><span class="full">Yindyamarra<br>Environmental Sustainability</span></a>'
   + '<div><p class="eyebrow">Customer portal</p><h1><span class="silver">Send the paperwork once a month.</span> Yarta does the rest.</h1><p class="lead" style="margin-top:20px;color:var(--silver-2)">Upload your bills, dockets and registers. Yarta enters every figure, grades the evidence and has a second analyst verify the month, then calculates the emissions, the rates, the trends and your Yindyamarra Environmental Score.</p></div>'
   + '<p class="small" style="color:var(--silver-4);max-width:52ch">Prototype with fictional demo organisations. There are no passwords here: in production each customer signs in with their own account, and Yarta staff sign in separately. Customers see their verified reports and send documents; Yarta staff enter and verify the figures.</p></div>'
   + '<div class="r"><div class="box"><p class="kicker">Sign in</p><h2 style="font-size:30px;margin:8px 0 18px">Choose a demo account</h2>'
   + '<div class="tabs" role="tablist" style="margin-bottom:18px"><button type="button" role="tab" data-act="ltab" data-tab="customer" aria-selected="'+(ui.loginTab==='customer')+'">Council or business</button><button type="button" role="tab" data-act="ltab" data-tab="operator" aria-selected="'+(ui.loginTab==='operator')+'">Yarta team</button></div>'
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
  var head = '<div class="pg-head"><div><p class="kicker">Dashboard</p><h1>'+esc(p.org_name)+'</h1><p class="pg-sub">'+esc(p.org_type)+' · '+esc(p.state)+(p.residents?' · '+fmt(p.residents)+' residents':'')+' · '+fmt(p.employees)+' FTE · baseline '+esc(p.baseline_fy)+'</p></div>'
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
    help='<section class="wyc no-print" aria-labelledby="wyc-h"><div class="wyc-top"><div><h2 class="sec-t" id="wyc-h">Where you could be</h2><p class="sec-s">Your score now, at your own targets, and an estimate with the recommended help done.</p></div><a class="btn btn-ghost btn-sm" href="#/roadmap" style="color:var(--ink)">See your roadmap</a></div>'+threeNums(P,m)
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
    + '<div style="margin-top:16px">'+stackBars(last13,{colors:['#0E4424','#1D7A43','#7FD6A0'],names:['Scope 1','Scope 2','Scope 3'],unit:'t CO₂-e',label:'Emissions by month',h:190})+'</div>'
    + '<p class="small muted" style="margin:10px 0 0">Avoided emissions from recycling, reported separately and never deducted: <b>'+fmt(R12.avoided_t,0)+' t CO₂-e</b> (modelled estimate). '+(R12.flights?'':'')+'Flights are recorded but not yet in the totals.</p></div>';
  // targets
  var tg = E.targets(S.months.length ? {months:S.months.slice(0,i+1), targets:T, baseline:S.baseline} : S);
  var targ = '<div class="panel"><h3>Targets and actuals</h3><p class="sec-s" style="margin-top:4px">Rolling 12 months to '+mLabel(m.month)+'. Targets are set on the Organisation page.</p>'
    + tg.map(function(t){ var a=t.actual, max=Math.max(100,t.target||0); return '<div style="margin-top:18px"><div style="display:flex;justify-content:space-between;gap:10px;font-size:14px"><b style="font-weight:600">'+esc(t.name)+'</b><span class="mono">'+(a==null?'—':fmt(a,1)+'%')+' <span class="muted">/ '+fmt(t.target,0)+'%</span></span></div><div class="tbar" aria-hidden="true"><i style="width:'+clamp((a||0)/max*100,0,100)+'%"></i><b style="left:'+clamp(t.target/max*100,0,100)+'%"></b></div></div>'; }).join('')
    + '<p class="small muted" style="margin:16px 0 0">The black mark is the target.'+(tg[0]&&tg[0].note?' Emissions: '+esc(tg[0].note.toLowerCase())+'.':'')+'</p></div>';
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
function progressOf(o,r){ var due=dueFields(o,r.month), v=r.values||{}; var req=due.filter(function(f){ return f.req; }); var got=req.filter(function(f){ return isNum(v[f.id]) || (f.kind!=='number'&&f.kind!=='count'&&f.kind!=='currency'&&f.kind!=='percent'&&v[f.id]); }); var all=due.filter(function(f){ return v[f.id]!==undefined && v[f.id]!==''; }); return {reqDue:req.length, req:got.length, due:due.length, all:all.length, missing:req.filter(function(f){ return got.indexOf(f)<0; })}; }
function nextStartable(o){ var rs=sorted(o); var last=rs[rs.length-1]; var nk = last ? E.addMonths(last.month,1) : E.addMonths(nowKey(),-1); if(nk>nowKey()) return null; if(rs.some(function(r){ return r.status==='draft'||r.status==='returned'; })) return null; return nk; }
function cmpVals(o,k,id){ var p=rec(o,E.addMonths(k,-1)), y=rec(o,E.addMonths(k,-12)); var f=field(id); var pv=p&&p.values?p.values[id]:null, yv=y&&y.values?y.values[id]:null; if(f&&f.freq==='S'){ pv=carried(o,E.addMonths(k,-1),id); yv=carried(o,E.addMonths(k,-12),id); } return {prev:isNum(pv)?+pv:null, ly:isNum(yv)?+yv:null, pk:E.addMonths(k,-1), yk:E.addMonths(k,-12)}; }
function warnFor(o,k,id,v){ if(!isNum(v)) return ''; v=+v; var c=cmpVals(o,k,id), f=field(id); if(f.kind==='percent' && (v<0||v>100)) return 'A percentage must be between 0 and 100.'; if(v<0) return 'Must be zero or more.'; var ref=c.ly!=null&&c.ly>0?c.ly:(c.prev!=null&&c.prev>0?c.prev:null); var refK=c.ly!=null&&c.ly>0?c.yk:c.pk; if(ref==null||f.freq==='S') return ''; var ch=(v-ref)/ref*100; if(Math.abs(ch)>35) return fmt(Math.abs(ch),0)+'% '+(ch>0?'higher':'lower')+' than '+mLabel(refK)+' ('+fmtF(f,ref)+' '+f.unit+'). Please check before submitting.'; return ''; }

function docOpenBtn(d){ return d.key ? '<button class="btn btn-ghost btn-sm" type="button" data-act="ev-open" data-key="'+esc(d.key)+'" style="color:var(--ink)">Open</button>' : '<span class="small muted">demo, not stored</span>'; }
function inboxList(r,opts){
  opts=opts||{}; var docs=(r.inbox||[]).slice().sort(function(a,b){ return a.at<b.at?-1:1; });
  if(!docs.length) return '<p class="sec-s" style="margin:6px 0 0">No documents yet.</p>';
  return '<div class="tbl-wrap" style="margin-top:10px"><table class="tbl compact"><thead><tr><th>Document</th><th>About</th><th>Sent</th><th>By</th><th></th></tr></thead><tbody>'
    + docs.map(function(d){ return '<tr><td><b style="font-weight:600">'+esc(d.name)+'</b>'+(d.size?'<div class="small muted">'+fmt(Math.max(1,d.size/1024),0)+' KB</div>':'')+'</td><td>'+esc(d.cat&&D.CAT[d.cat]?D.CAT[d.cat].short:'Not sure')+'</td><td>'+longDate(d.at)+'</td><td>'+esc(d.by||'')+'</td><td>'+docOpenBtn(d)+'</td></tr>'; }).join('')
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
  var cur=q.c && D.CAT[q.c] ? q.c : null;
  if(!cur){ cur = (cats.filter(function(c){ return pr.missing.some(function(f){ return f.cat===c.k; }); })[0]||cats[0]).k; }
  var catNav = cats.map(function(c){ var fs=due.filter(function(f){ return f.cat===c.k; }); var rq=fs.filter(function(f){ return f.req; }); var ok=rq.filter(function(f){ return isNum(r.values[f.id]); }).length; var done = rq.length ? ok===rq.length : fs.some(function(f){ return r.values[f.id]!==undefined&&r.values[f.id]!==''; }); return '<a href="'+base+'?c='+c.k+'" aria-current="'+(c.k===cur)+'"><span>'+esc(c.short)+'</span><span class="c'+(done?' ok':'')+'" data-cc="'+c.k+'">'+(rq.length?ok+'/'+rq.length:(done?'✓':fs.length))+'</span></a>'; }).join('');
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
  var body = head + returned + docsPanel + '<div class="subm"><nav class="catnav" aria-label="Categories">'+catNav+'</nav><div><div class="panel"><h2 class="sec-t">'+esc(D.CAT[cur].name)+'</h2><p class="sec-s">'+esc(D.CAT[cur].what)+'</p>'+form+evBox+'</div>'+submitBox+'</div><aside class="calc"><div class="panel-dark" id="calc">'+calcPanel(o,r,k)+'</div></aside></div>';
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
    + '<div class="panel"><h3>Upload</h3><div class="inline-form" style="margin-top:14px"><div class="field"><label for="up-m">Month</label><select id="up-m">'+opts+'</select></div><div class="field"><label for="up-c">What is it about?</label><select id="up-c">'+cats+'</select></div><label class="btn btn-primary">Choose files<input type="file" data-act="inbox-file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls,.doc,.docx,.txt" style="display:none"></label></div><p class="small muted" style="margin:12px 0 0">PDF, images, spreadsheets or documents, up to 15 MB each. In this prototype files stay in this browser.</p></div>'
    + '<h2 class="sec-t" style="margin-top:28px">Sent so far</h2>'+(list||'<div class="empty">Nothing sent yet.</div>')+(withDocsAll.length>3?'<p class="small muted" style="margin-top:14px">Showing the latest three months. Every earlier document is kept with its month.</p>':'');
  return shell('documents', body);
}

function fieldRow(o,r,k,f,editable,dueIds){
  var raw=r.values[f.id], isS=f.freq==='S', carriedV=isS?carried(o,E.addMonths(k,-1),f.id):null;
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
  var v=withCarry(o,k,r.values||{}); var m=E.month(v,o.profile);
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
function vReports(){
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
var RB=window.REPORT_BRAND||{mark:'<span class="mark">Yarta</span>', full:'Yindyamarra Environmental Sustainability', score:'Yindyamarra Environmental Score', title:'Environmental<br>Sustainability Report'};
function sheetCover(o,S,i,PL,k,nP,provTxt){
  var m=S.months[i], R12=m.r12, B=R12.base||{}, p=o.profile, T=S.targets, ly=S.months[i-12]||null;
  if(inBaselineFY(S,p,k)) B={};
  var tg=E.targets({months:S.months.slice(0,i+1), targets:T, baseline:S.baseline});
  var divT=Math.max(0,(R12.waste_total_t||0)-(R12.landfill_t||0)), divB=Math.max(0,(B.waste_total_t||0)-(B.landfill_t||0));
  var per = (p.org_type==='Council'&&p.residents>0) ? {n:p.residents,l:'resident'} : (p.employees>0 ? {n:p.employees,l:'employee'} : null);
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
  if(R12.participants>0) scale.push({ic:'people', v:fmt(R12.participants,0)+' people', t:'took part in environment programs'});
  var scaleH=scale.slice(0,5).map(function(x){ return '<div class="rp-sc">'+rpIco(x.ic)+'<div><b>'+x.v+'</b> '+esc(x.t)+'</div></div>'; }).join('') || '<p class="rp-p muted">No figures yet.</p>';
  var subs=D.CATEGORIES.map(function(c){ var v=m.scores[c.k]; return '<div class="rp-sub"><span>'+esc(c.name)+(m.prov[c.k]?' <span class="muted">(P)</span>':'')+'</span><span class="v">'+(v==null?'—':Math.round(v))+'</span><span class="d">'+(v==null?'<span class="muted small">not reported</span>':delta(m.cat_yoy[c.k]))+'</span><div class="bar"><i style="width:'+(v||0)+'%"></i></div></div>'; }).join('');
  var tgH=tg.map(function(t){ var w=(t.actual==null||!(t.target>0))?0:Math.max(0,Math.min(100,t.actual/t.target*100)); var met=t.actual!=null&&t.actual>=t.target; return '<div class="rp-tg'+(met?' met':'')+'"><span class="n">'+esc(t.name)+'</span><span class="r">'+(t.actual==null?'—':pct(t.actual,0))+' <span class="muted">of '+pct(t.target,0)+'</span></span><div class="bar"><i style="width:'+w.toFixed(0)+'%"></i></div></div>'; }).join('');
  var photo = p.country_photo ? ' style="background-image:linear-gradient(90deg,rgba(11,40,24,.96) 0%,rgba(11,40,24,.78) 55%,rgba(11,40,24,.35) 100%),url('+esc(p.country_photo)+')"' : '';
  var wyc = PL ? '<div class="rp-wyc"><div><span class="k">Now</span><b>'+(PL.now==null?'—':PL.now)+'</b></div><div><span class="k">At your targets</span><b>'+(PL.target==null?'—':PL.target)+'</b></div><div class="hl"><span class="k">With Yarta help</span><b>'+(PL.potential==null?'—':PL.potential)+'</b><span class="s">estimate · plan on page '+nP+'</span></div></div>' : '';
  return '<section class="rp-sheet rp-cover">'
    + '<div class="rp-band"'+photo+'><div class="rp-band-l"><div class="rp-brand">'+RB.mark+'<span class="full">'+RB.full+'</span></div>'
    + '<div class="rp-ethos">Measure. Understand. Report. Improve.</div><h1 class="rp-big">'+RB.title+'</h1><p class="rp-tag">Where '+esc(p.org_name)+' stands, verified figure by figure, and the ways to improve.</p></div>'
    + '<div class="rp-band-r"><div class="rp-kv light"><span>Organisation</span><b>'+esc(p.org_name)+'</b><span>Month</span><b>'+mLabel(k)+'</b><span>Status</span><b>'+esc(provTxt)+'</b><span>Issued</span><b>'+longDate(new Date())+'</b></div>'+(p.traditional_owners?'<div class="rp-country">On '+esc(p.traditional_owners)+' Country</div>':'')+'</div></div>'
    + (p.country_photo?'<div class="rp-photo-credit">Photo: '+esc(p.country_photo_credit||'supplied by the organisation and approved by Traditional Owners')+'</div>':'')
    + '<div class="rp-score">'+ring(m.score,150,true)+'<div class="rp-score-t"><p class="kicker">'+RB.score+' · '+esc(mLabel(k))+'</p><div class="band">'+esc(m.band)+'</div><div class="rp-score-d">'+(m.yoy==null?'':'<span>'+delta(m.yoy,{unit:' pts'})+' year on year'+(ly?' ('+esc(mLabel(ly.month))+')':'')+'</span>')+(m.mom==null?'':'<span>'+delta(m.mom,{unit:' pts'})+' month on month</span>')+'<span>'+m.scored+' of 10 categories scored</span></div></div>'+wyc+'</div>'
    + '<div class="rp-cards">'+cardsH+'</div>'
    + '<div class="rp-cols"><div><div class="rp-h">Category scores · change on last year</div><div class="rp-subs one">'+subs+'</div></div>'
    + '<div><div class="rp-h">At real-world scale · rolling '+win+'</div><div class="rp-scale">'+scaleH+'</div><div class="rp-h">Progress towards targets · rolling '+win+'</div><div class="rp-tgs">'+tgH+'</div></div></div>'
    + '<div class="rp-foot">Headline figures are rolling '+win+' totals; the change is against the same calendar months of the baseline year'+(inBaselineFY(S,p,k)?' ('+esc(S.baseline.fy||p.baseline_fy)+' is the baseline year, so there is no earlier year to compare with yet)':'')+'. (P) provisional: a target-based category with less than 12 months of data. The score is self-declared under the published Yarta method v0.1 (draft); it is not an accredited rating, certification or offset. Page 1 of '+nP+'.</div></section>';
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
  var sheet1 = sheetCover(o,S,i,PL,k,nP,provTxt);
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
    + '<div class="tn"><span class="k">At your targets</span><b>'+(P.target==null?'—':P.target)+'</b><span class="s">If every target in your profile were met</span></div>'
    + '<div class="tn hl"><span class="k">With Yarta help · estimate</span><b>'+(P.potential==null?'—':P.potential)+'</b><span class="s">'+n+' recommended item'+(n===1?'':'s')+(extra.length?' · '+extra.join(' · '):'')+'</span></div>'
    + '</div>';
}
function roadChart(S,i,P,o){
  o=o||{}; var phone=!o.print && window.innerWidth<700;
  var a=S.months.slice(Math.max(0,i-11),i+1).map(function(x){ return {label:mShort(x.month), v:x.score, prov:x.status!=='verified'}; });
  var pr=P.proj.map(function(p){ return {label:mShort(p.month), v:p.v}; });
  return lineChart(a.concat(pr),{split:a.length-1, refs:P.target!=null?[{v:P.target,label:'At your targets · '+P.target}]:[], label:'Score by month, with the projection', w:phone?420:720, h:phone?300:(o.h||230), dark:o.dark, maxLabels:phone?5:(o.maxLabels||10)});
}
function recCard(it){
  var s=it.s, pv=provOf(s), b=it.booking, up=upText(it.uplift);
  return '<article class="rec'+(s.prov==='group'?' grp':'')+'">'
    + '<p class="k">'+esc(s.cat?D.CAT[s.cat].name:'Funding')+'</p>'
    + '<h3>'+esc(it.title)+'</h3>'
    + '<p class="why">'+esc(it.why)+'</p>'
    + '<dl class="rec-dl"><dt>Estimated change</dt><dd>'+(up||esc(s.effectText))+'</dd><dt>Who</dt><dd>'+esc(pv.label)+(s.prov==='group'?' · disclosed on your report':'')+'</dd></dl>'
    + '<div class="rec-f">'+(b?bookingChip(b)+'<span class="small muted">'+esc(slotLabel(b.slot,b.other))+'</span>':'<a class="btn btn-primary btn-sm" href="#/book/'+s.k+'">Book a session</a>')+'</div>'
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
  var head='<div class="pg-head"><div><p class="kicker">Roadmap and help</p><h1>Your roadmap</h1><p class="pg-sub">Your score now, the score at your own targets, and an estimate with the recommended help done. Based on your figures to '+mLabel(m.month)+(m.status!=='verified'?' (provisional: awaiting verification)':'')+'. The rules and assumptions are published in the <a class="link" href="../method/#help">method</a>.</p></div><div class="pg-actions"><a class="btn btn-ink btn-sm" href="#/report/'+m.month+'">Report with roadmap</a></div></div>';
  var top='<section class="panel-dark rm-top">'+threeNums(P,m,'dark')+'<div class="rm-chart">'+roadChart(S,i,P,{dark:true})+'</div><p class="rm-leg"><span class="lg-i"><span class="lg-l solid"></span>Your score by month</span><span class="lg-i"><span class="lg-l dash"></span>Projected with the plan below (estimate)</span><span class="lg-i"><span class="lg-l dot"></span>At your targets</span></p></section>';
  var rows=P.items.map(function(it){
    var s=it.s, b=it.booking, pv=provOf(s);
    var st = b ? bookingChip(b)+'<div class="small muted">'+esc(slotLabel(b.slot,b.other))+'</div>' : '<a class="btn btn-primary btn-sm" href="#/book/'+s.k+'">Book a session</a>';
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
  var body='<div class="pg-head"><div><p class="kicker"><a class="link" href="#/roadmap">Roadmap and help</a> · Book</p><h1>'+esc(title)+'</h1><p class="pg-sub">'+esc(s.what)+'</p></div></div>'
    + (open?'<div class="banner grey"><span>You already have a '+esc(BK_L[open.status].toLowerCase())+' booking for this: <b>'+esc(slotLabel(open.slot,open.other))+'</b>.</span><a class="btn btn-ghost btn-sm" href="#/roadmap" style="color:var(--ink)">See it</a></div>':'')
    + '<div class="row2 w73 book"><div class="panel"><h3>Choose a time</h3><p class="sec-s" style="margin-top:4px">'+esc(s.session)+'. The next ten business days, in your local time.</p>'
    + '<div class="slots" role="group" aria-label="Available times">'+grid+'<div class="sday"><div class="sd">Other</div><button type="button" class="slot" data-act="slot" data-slot="other" aria-pressed="false">Another time</button></div></div>'
    + '<div class="stack" style="margin-top:24px">'
    + '<fieldset class="field"><legend class="lbl">Format</legend><div class="pill-row">'+s.modes.map(function(md,ix){ return '<label class="radio"><input type="radio" name="bk-mode" value="'+esc(md)+'"'+(ix===0?' checked':'')+'> '+esc(md)+'</label>'; }).join('')+'</div></fieldset>'
    + '<div class="field"><label for="bk-loc">Where, for an on-site session</label><input type="text" id="bk-loc" value="'+esc(o.profile.org_name)+'"></div>'
    + '<div class="row2"><div class="field"><label for="bk-name">Contact name</label><input type="text" id="bk-name" value="'+esc(contact.name||'')+'" autocomplete="name"></div><div class="field"><label for="bk-email">Contact email</label><input type="email" id="bk-email" value="'+esc(contact.email||'')+'" autocomplete="email"></div></div>'
    + '<div class="field"><label for="bk-notes">Notes</label><textarea id="bk-notes" rows="3" placeholder="Anything the specialist should know, or a time that suits you if none above does."></textarea></div>'
    + '<label class="check"><input type="checkbox" id="bk-share" checked> <span>Share the Yarta figures behind this recommendation with the provider, so they arrive prepared.</span></label>'
    + '<div class="note-box grey">Prototype: nothing is sent. In production, Yarta would confirm the time with you by email.</div>'
    + '<div class="btn-row"><button class="btn btn-primary" type="button" data-act="book-submit" data-svc="'+s.k+'">Request this booking</button><a class="btn btn-ghost" href="#/roadmap" style="color:var(--ink)">Back to the roadmap</a></div>'
    + '</div></div>'
    + '<aside class="panel bk-side"><h3>Why it is recommended</h3><p class="small" style="margin-top:8px">'+esc(r?r.why:'Your current figures do not call for this, but you can still book it.')+'</p>'
    + '<dl class="rec-dl" style="margin-top:14px"><dt>Estimated change</dt><dd>'+(r?(upText(r.uplift)||esc(s.effectText)):'—')+'</dd></dl><p class="small muted" style="margin:8px 0 0">Assumed effect: '+esc(s.effectText)+'</p>'
    + '<h3 style="margin-top:22px">Who delivers it</h3><p class="small" style="margin-top:8px">'+esc(s.who)+'</p>'+(s.prov==='group'?'<p class="small muted">'+esc(s.groupNames)+(s.groupNames.indexOf(' and ')>0?' are':' is')+' part of Recycle Group, like Yarta. Disclosed on your monthly report.</p>':s.prov==='partner'?'<p class="small muted">Independent specialist: chosen by you, and Yarta can introduce one.</p>':'')
    + '<p class="small muted" style="margin-top:10px">You can use any provider. Your score and the verification of your figures do not depend on who does the work.</p></aside></div>';
  return shell('roadmap', body);
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
      + '<td>'+esc(slotLabel(b.slot,b.other))+'<div class="small muted">'+esc(b.mode||'')+(b.location?' · '+esc(b.location):'')+'</div></td><td>'+bookingChip(b)+'</td><td><div class="pill-row">'+acts+'</div></td></tr>'; }).join('');
  var body='<div class="pg-head"><div><p class="kicker">Yarta team</p><h1>Bookings</h1><p class="pg-sub">Help requested from customers\' roadmaps. Confirm the time with the customer and the provider, then mark it done when the work is complete so the customer can follow the change in later months. Work by a Recycle Group business (●) is disclosed on the customer\'s report.</p></div></div>'
    + (rows?'<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Organisation</th><th>Help</th><th>When</th><th>Status</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty">No bookings yet.</div>');
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
    + '<div class="rp-h">Score by month, and projected with the plan</div>'+roadChart(S,i,P,{h:190,print:true})+'<p class="rp-leg"><span class="lg-i"><span class="lg-l solid"></span>Your score by month</span><span class="lg-i"><span class="lg-l dash"></span>Projected with the plan (estimate)</span><span class="lg-i"><span class="lg-l dot"></span>At your targets</span></p>'
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
    var input = f.kind==='select' ? '<select id="p-'+f.id+'" data-pf="'+f.id+'"'+(ro?' disabled':'')+'>'+f.options.map(function(op){ return '<option'+(String(v)===op?' selected':'')+'>'+esc(op)+'</option>'; }).join('')+'</select>'
      : f.id==='baseline_fy' ? '<select id="p-'+f.id+'" data-pf="'+f.id+'"'+(ro?' disabled':'')+'>'+fyOptions(o).map(function(fy){ return '<option'+(String(v)===fy?' selected':'')+'>'+fy+'</option>'; }).join('')+'</select>'
      : f.kind==='text' ? '<input type="text" id="p-'+f.id+'" data-pf="'+f.id+'" value="'+esc(v)+'"'+(ro?' disabled':'')+'>'
      : '<div class="in-unit"><input type="number" step="any" min="0" id="p-'+f.id+'" data-pf="'+f.id+'" value="'+esc(v)+'"'+(ro?' disabled':'')+'>'+(f.unit?'<span class="u">'+esc(f.unit)+'</span>':'')+'</div>';
    return '<div class="field"><label for="p-'+f.id+'">'+esc(f.name)+(f.req?' <span class="req">*</span>':'')+'</label>'+input+'<span class="hint">'+esc(f.def)+'</span></div>';
  });
  var users=state.users.filter(function(u){ return u.org===o.id; }).map(function(u){ return '<tr><td>'+esc(u.name)+'</td><td>'+esc(u.title)+'</td><td class="mono small">'+esc(u.email)+'</td></tr>'; }).join('');
  var body='<div class="pg-head"><div><p class="kicker">Organisation</p><h1>'+esc(p.org_name)+'</h1><p class="pg-sub">Details used for intensities, the baseline and targets. Changing them recalculates every month.'+(ro?' Yarta keeps these up to date: to change anything, email <a class="link" href="mailto:contact@yes.com.au">contact@yes.com.au</a>.':'')+'</p></div>'+(ro?'':'<div class="pg-actions"><button class="btn btn-primary btn-sm" type="button" data-act="save-profile">Save changes</button></div>')+'</div>'
    + '<div class="row2"><div class="panel"><h3>Profile</h3><div class="stack" style="margin-top:16px">'+fields.slice(0,8).join('')+'</div></div><div class="panel"><h3>Targets</h3><div class="stack" style="margin-top:16px">'+fields.slice(8).join('')+'</div></div></div>'
    + '<h2 class="sec-t" style="margin-top:28px">People with access</h2><p class="sec-s">In production each person has their own sign-in. Demo accounts only here.</p><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Name</th><th>Role</th><th>Email</th></tr></thead><tbody>'+(users||'<tr><td colspan="3" class="muted">No demo users for this organisation.</td></tr>')+'</tbody></table></div>';
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
    return '<tr><td><b>'+esc(o.profile.org_name)+'</b><div class="small muted">'+esc(o.profile.org_type)+' · '+esc(o.profile.state)+'</div></td><td class="num">'+o.records.length+'</td><td>'+(last?mLabel(last.month)+' '+statusChip(last.status):'—')+'</td><td class="num"><b>'+(m&&m.score!=null?m.score:'—')+'</b></td><td>'+(m?esc(m.band):'—')+'</td><td class="num">'+(m&&m.yoy!=null?sgn(m.yoy):'—')+'</td><td class="num">'+waiting+'</td><td><div class="pill-row"><button class="btn btn-ghost btn-sm" type="button" data-act="view-org" data-org="'+id+'" style="color:var(--ink)">Dashboard</button>'+(openMonths(o).length?'<a class="btn btn-primary btn-sm" href="#/entry/'+id+'/'+openMonths(o)[openMonths(o).length-1].month+'">Enter figures</a>':'')+'</div></td></tr>'; }).join('');
  var body='<div class="pg-head"><div><p class="kicker">Yarta team</p><h1>Customers</h1><p class="pg-sub">Fictional demo organisations.</p></div></div><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Organisation</th><th class="r">Months</th><th>Latest month</th><th class="r">Score</th><th>Band</th><th class="r">Year on year</th><th class="r">Waiting</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>';
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
    + '<div class="panel" style="margin-top:16px"><h3>Documents from '+esc(o.profile.org_name)+'</h3>'+inboxList(r)+'</div>' + sections + decision;
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
function vNotFound(){ return shell('', '<div class="empty">That page does not exist. <a class="link" href="#/dashboard">Back to the dashboard</a>.</div>'); }

/* ------------------------------------------------------------------ render */
function render(){
  var h=parseHash(), P=h.parts, q=h.q, html;
  var u=me();
  if(!u){ html=vLogin(); }
  else if(!P.length){ go(isOp()?(u.home||'#/ops'):'#/dashboard'); return; }
  else {
    var a=P[0];
    if(a==='dashboard') html=vDashboard(q);
    else if(a==='category') html=vCategory(P[1],q);
    else if(a==='submit'){ go(isOp()?'#/ops/entry':'#/dashboard'); return; }
    else if(a==='entry' && isOp()){ if(P[1] && state.orgs[P[1]] && state.session.viewOrg!==P[1]){ state.session.viewOrg=P[1]; save(); } html=P[2]?vSubmit(P[2],q):vEntryQueue(); }
    else if(a==='documents') html=vDocuments();
    else if(a==='reports') html=vReports();
    else if(a==='roadmap') html=vRoadmap();
    else if(a==='book') html=vBook(P[1]);
    else if(a==='report') html=vReport(P[1]);
    else if(a==='organisation') html=vOrganisation();
    else if(a==='data') html=vData();
    else if(a==='ops' && isOp()){ html = !P[1] ? vQueue() : P[1]==='entry' ? vEntryQueue() : P[1]==='customers' ? vCustomers() : P[1]==='review' ? vReview(P[2],P[3]) : P[1]==='factors' ? vFactors() : P[1]==='activity' ? vActivity() : P[1]==='bookings' ? vBookings() : vNotFound(); }
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
    var val=t.value;
    if(f.kind==='text'||f.kind==='select'){ if(val==='') delete c.r.values[id]; else c.r.values[id]=val; }
    else { if(val===''||!isFinite(+val)) delete c.r.values[id]; else c.r.values[id]=+val; }
    if(f.freq==='S'){ var prevC=carried(c.o,E.addMonths(c.k,-1),id); if(c.r.values[id]!=null && prevC!=null && +c.r.values[id]===prevC) delete c.r.values[id]; }
    var w=warnFor(c.o,c.k,id,c.r.values[id]); var wEl=$('[data-warn="'+id+'"]'); if(wEl) wEl.textContent=w; t.classList.toggle('bad',!!w);
    var pr=progressOf(c.o,c.r); var pt=$('#prog-t'), pb=$('#prog-b'); if(pt) pt.textContent=pr.req+' of '+pr.reqDue; if(pb) pb.style.width=(pr.reqDue?pr.req/pr.reqDue*100:0)+'%';
    var cc=$('[data-cc="'+f.cat+'"]'); if(cc){ var due=dueFields(c.o,c.k).filter(function(x){ return x.cat===f.cat; }); var rq=due.filter(function(x){ return x.req; }); var ok=rq.filter(function(x){ return isNum(c.r.values[x.id]); }).length; cc.textContent=rq.length?ok+'/'+rq.length:'✓'; cc.classList.toggle('ok', rq.length?ok===rq.length:true); }
    var cp=$('#calc'); if(cp) cp.innerHTML=calcPanel(c.o,c.r,c.k);
    scheduleSave();
  }
});
app.addEventListener('change', function(e){
  var t=e.target, act=t.getAttribute('data-act');
  if(act==='dash-month'){ go('#/dashboard?m='+t.value); }
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
  var jobs=files.map(function(f,i){ var key='inbox/'+o.id+'/'+k+'/'+Date.now()+'-'+i; return putFile(key,f).then(function(){ r.inbox.push({key:key,name:f.name,size:f.size,type:f.type,cat:cat,at:isoNow(),by:me().name}); }); });
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
  flash('Requested: '+R.title(s,o.profile)+'.'); go('#/roadmap');
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
    case 'save-profile': o=org(); var errs=[]; $$('[data-pf]').forEach(function(el){ var id=el.getAttribute('data-pf'), f=field(id), v=el.value; if(f.kind==='number'||f.kind==='count'||f.kind==='percent'){ if(v===''){ if(f.req) errs.push(f.name); else delete o.profile[id]; } else if(!isFinite(+v)||+v<0){ errs.push(f.name); } else o.profile[id]=+v; } else { if(v===''&&f.req) errs.push(f.name); else o.profile[id]=v; } }); if(errs.length){ flash('Check: '+errs.join(', '),'err'); return; } log('Profile updated',''); save(); flash('Saved. Every month has been recalculated.'); render(); break;
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
    case 'return': var or=state.orgs[t.getAttribute('data-org')], rr=rec(or,t.getAttribute('data-month')); var nt=($('#rv-note')||{}).value; if(!nt||!nt.trim()){ flash('Add a note so data entry knows what to fix.','err'); var ta=$('#rv-note'); if(ta) ta.focus(); return; } rr.status='returned'; rr.notes=rr.notes||[]; rr.notes.push({by:me().name,at:isoNow(),text:nt.trim()}); log('Month returned to data entry',mLabel(rr.month)+' · '+nt.trim(),or.id); save(); flash('Returned to data entry with your note.'); go('#/ops'); break;
  }
});

/* for pages that embed a report outside the app (the Yarta sample on the Yarta site) */
window.YESPortal={reportSheets:reportSheets, org:org, seriesOf:seriesOf, mLabel:mLabel};
render();
})();
