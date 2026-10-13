/* Yarta customer views: the Overview and the ten category pages.
   What a council or business reads first: the score and emissions against their target, where the emissions
   come from, the four levers they can pull, what changed, and what to do next. Every figure here is computed
   from the same verified series (engine.js), so the Overview, the category pages and the report never disagree.
   portal.js calls YARTA_VIEWS.dashboard(q, api) and YARTA_VIEWS.category(cat, q, api). */
(function(){
'use strict';
var V = window.YARTA_VIEWS = window.YARTA_VIEWS || {};
var A, E, D, R;   // set from the api on every render

/* Chart colours (validated with the dataviz checks, 13 Oct 2026): orange marks the share that is going the right
   way (renewable, recovered, electric, alternative water) and the actual line; steel marks the share to reduce.
   #CF7A2E vs #5F6467: normal-vision ΔE 21.6, CVD ΔE 15.9, both ≥3:1 on white. Scope ramp passes the ordinal checks. */
var C = { good:'#CF7A2E', rest:'#5F6467', ink:'#0B0B0B', bench:'#8A4A14', s1:'#8A4A14', s2:'#C06A22', s3:'#E39A4F' };
var TARGET_YEAR_END = '2030-06';
var TCO2 = '<span class="nw">t CO₂-e</span>';   // never breaks at the hyphen
function nu(v, unit, dp){ return '<span class="nw">'+fmt(v,dp||0)+' '+unit+'</span>'; }   // a number and its unit, never split   // "by 2030": the end of the 2029–30 financial year

/* ------------------------------------------------------------------ small helpers */
function num(x){ x=+x; return isFinite(x)?x:0; }
function pos(x){ x=+x; return isFinite(x)&&x>0?x:0; }
function esc(s){ return A.esc(s); }
function fmt(n,dp){ return A.fmt(n,dp); }
function clamp(x,a,b){ return Math.max(a,Math.min(b,x)); }
function pctChg(now, base){ return base>0 && now!=null ? (now-base)/base*100 : null; }
function sum(list, fn){ return list.reduce(function(s,x){ return s+num(fn(x)); },0); }
function monthsBetween(a,b){ var p=E.parse(a), q=E.parse(b); return (q.y-p.y)*12+(q.m-p.m); }
function win(S,i){ return S.months.slice(Math.max(0,i-11), i+1); }
/* the same calendar months in the baseline year (the engine's rule): a missing month falls back to the baseline average */
function baseSum(S, w, fn){
  var by=S.baseline.byCal||{}, all=[]; for(var k in by) all.push(by[k]);
  var avg = all.length ? sum(all,fn)/all.length : 0;
  return w.reduce(function(s,x){ var b=by[E.parse(x.month).m]; return s + (b ? num(fn(b)) : avg); },0);
}
function phone(){ return window.innerWidth<700; }
function cw(w){ return phone()?Math.min(w,380):w; }
/* axis: clean steps (1, 2, 2.5, 5 × 10^k), the tightest top with at most maxN intervals */
function axis(max, maxN){ maxN=maxN||4; if(!(max>0)) return {top:1,step:0.5}; var best=null, p0=Math.floor(Math.log10(max/maxN))-1;
  for(var e=p0;e<=p0+2;e++){ [1,2,2.5,5].forEach(function(f){ var st=f*Math.pow(10,e), n=Math.ceil(max/st-1e-9); if(n<1||n>maxN) return; n=Math.max(2,n); var t=n*st; if(!best||t<best.top-1e-9||(Math.abs(t-best.top)<1e-9&&n<best.n)) best={top:t,step:st,n:n}; }); }
  return best||{top:max,step:max/2}; }
/* how much data the 12-month window holds: a new client has fewer than 12 months */
function span(r){ return r && r.n<12 ? r.n+' month'+(r.n===1?'':'s') : '12 months'; }
function spct(v, dp){ dp=dp==null?1:dp; var a=Math.abs(v); return a<Math.pow(10,-dp)/2 ? fmt(0,dp)+'%' : (v>0?'+':'−')+fmt(a,dp)+'%'; }
function compact(v){ var a=Math.abs(v), k=function(d,u){ var x=v/d; return fmt(x, Math.abs(x)>=10||x%1===0?0:1)+u; }; return a>=1e6?k(1e6,'M'):a>=1000?k(1e3,'k'):fmt(v, a<10&&v%1?1:0); }
function sig(v){ var a=Math.abs(v); return a>=100?fmt(v,0):a>=10?fmt(v,1):fmt(v,2); }
function dir(ch, lowerBetter){ if(ch==null||Math.abs(ch)<0.5) return {w:'about the same as', cls:'flat', good:null}; var up=ch>0; return {w:(up?'up ':'down ')+fmt(Math.abs(ch),Math.abs(ch)<10?1:0)+'% on', cls:up?'up':'down', good: lowerBetter ? !up : up}; }
function arrow(ch, lowerBetter){ return A.delta(ch,{lowerBetter:!!lowerBetter,dp:Math.abs(ch||0)<10?1:0,unit:'%'}); }
function chipScore(m,k){ var v=m.scores[k]; return v==null?'':'<span class="ov-cs" title="'+esc(D.CAT[k].name)+' score">'+Math.round(v)+'</span>'; }
function tLab(t,std){ return num(t)>std ? 'Your target' : 'Standard'; }
/* which months of the baseline year have figures, up to month k */
function baseCover(S, k){ var e=baseFyEnd(S); if(!e) return null; var st=E.addMonths(e,-11), by=S.baseline.byCal||{}, miss=[], have=0;
  for(var j=0;j<12;j++){ var mk=E.addMonths(st,j); if(mk>k) break; var b=by[E.parse(mk).m]; if(b && b.month===mk) have++; else miss.push(mk); }
  return {have:have, miss:miss, done:k>=e}; }
function monthRange(list){ if(!list.length) return ''; var a=list[0], b=list[list.length-1];
  if(monthsBetween(a,b)!==list.length-1) return list.length+' months';
  if(a===b) return A.mLabel(a); var la=A.mLabel(a), lb=A.mLabel(b); return E.parse(a).y===E.parse(b).y ? la.replace(/\s+\d{4}$/,'')+' to '+lb : la+' to '+lb; }
function inBaseYear(S,i){ var e=baseFyEnd(S); return !!(e && S.months[i].month<=e); }
function baseFyEnd(S){ var fy=S.baseline&&S.baseline.fy; if(!fy) return null; var y=+String(fy).split(/[–-]/)[0]; return isFinite(y)? (y+1)+'-06' : null; }

/* one tooltip for every chart: marks carry data-tip; keyboard focus shows the same text */
var tipEl=null;
function tip(){ if(tipEl) return tipEl; tipEl=document.createElement('div'); tipEl.className='ov-tip'; tipEl.setAttribute('role','tooltip'); document.body.appendChild(tipEl);
  function show(t, x, y){ tipEl.textContent=t; tipEl.style.display='block'; var r=tipEl.getBoundingClientRect(); var L=Math.min(window.innerWidth-r.width-8, Math.max(8, x-r.width/2)); var T=y-r.height-12; if(T<8) T=y+18; tipEl.style.left=L+'px'; tipEl.style.top=T+'px'; }
  document.addEventListener('pointermove', function(e){ var t=e.target.closest&&e.target.closest('[data-tip]'); if(!t){ tipEl.style.display='none'; return; } show(t.getAttribute('data-tip'), e.clientX, e.clientY); });
  document.addEventListener('focusin', function(e){ var t=e.target.closest&&e.target.closest('[data-tip]'); if(!t) return; var r=t.getBoundingClientRect(); show(t.getAttribute('data-tip'), r.left+r.width/2, r.top); });
  document.addEventListener('focusout', function(){ tipEl.style.display='none'; });
  window.addEventListener('scroll', function(){ tipEl.style.display='none'; }, {passive:true});
  return tipEl; }

/* ------------------------------------------------------------------ charts */
/* Columns: one or two stacked parts per month, single axis, 2px surface gap between parts, 4px rounded top. */
function columns(rows, o){
  o=o||{}; var W=cw(o.w||640), H=phone()?Math.max(o.h||170,190):(o.h||170), pl=o.pl!=null?o.pl:40, pr=8, pt=10, pb=24, n=rows.length; if(!n) return '';
  if(phone() && o.labelEvery===1) o.labelEvery=3;
  var tot=rows.map(function(r){ return r.parts.reduce(function(a,b){ return a+pos(b); },0); });
  var ax=axis(Math.max.apply(null,tot.concat([0]))||1, (o.h||170)>=200?5:4), top=ax.top, y=function(v){ return pt+(H-pt-pb)*(1-v/top); };
  if(pl>0){ var longest=0; for(var q=0;q<=ax.n;q++){ longest=Math.max(longest, String(o.axisFmt?o.axisFmt(ax.step*q):compact(ax.step*q)).length); } pl=Math.max(pl, Math.ceil(longest*6.8+12)); }
  var band=(W-pl-pr)/n, bw=Math.min(o.maxBar||24, band*0.66);
  var s='<svg class="ov-chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(o.label||'Chart')+'">';
  for(var tk=0; tk<=ax.n; tk++){ var v=ax.step*tk; s+='<line class="g" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(v).toFixed(1)+'" y2="'+y(v).toFixed(1)+'"/>'; if(pl>0) s+='<text x="'+(pl-6)+'" y="'+(y(v)+4).toFixed(1)+'" text-anchor="end">'+(o.axisFmt?o.axisFmt(v):compact(v))+'</text>'; }
  rows.forEach(function(r,i){
    var x=pl+i*band+(band-bw)/2, acc=0, parts=r.parts.map(pos), last=parts.length-1; while(last>0 && !parts[last]) last--;
    var tipT=r.tip || (r.label+' · '+r.parts.map(function(v,j){ return (o.names?o.names[j]+' ':'')+(o.fmt?o.fmt(pos(v)):sig(pos(v))+(o.unit?' '+o.unit:'')); }).join(' · '));
    parts.forEach(function(v,j){ if(!v) return; var y1=y(acc+v), y0=y(acc), h=Math.max(1,y0-y1);
      var col=(o.colors||[C.rest])[j];
      // the top segment gets the 4px rounded end; every segment below it leaves a 2px surface gap above itself
      s+= j===last ? '<path d="'+bar(x,y1,bw,h)+'" fill="'+col+'"/>' : (h>2.5 ? '<rect x="'+x.toFixed(1)+'" y="'+(y1+2).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+(h-2).toFixed(1)+'" fill="'+col+'"/>' : '');
      acc+=v; });
    s+='<rect class="hit" x="'+(pl+i*band).toFixed(1)+'" y="'+pt+'" width="'+band.toFixed(1)+'" height="'+(H-pt-pb)+'" data-tip="'+esc(tipT)+'" tabindex="-1"/>';
    var lab = o.labelEvery ? (i%o.labelEvery===0||i===n-1) : (i===0||i===n-1||(n>8&&i===Math.floor((n-1)/2)));
    if(lab) s+='<text x="'+(x+bw/2).toFixed(1)+'" y="'+(H-7)+'" text-anchor="middle">'+esc(r.label)+'</text>';
  });
  return s+'</svg>';
}
/* Line: one series on a fixed 0–100 scale, end dot and label, a hover band per month. */
function line(pts, o){
  o=o||{}; var W=phone()?380:(o.w||880), H=phone()?230:(o.h||210), pl=34, pr=40, pt=12, pb=24, n=pts.length; if(!n) return '';
  var x=function(j){ return pl+(n<2?0:(W-pl-pr)*j/(n-1)); }, y=function(v){ return pt+(H-pt-pb)*(1-v/100); };
  var s='<svg class="ov-chart ov-line" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(o.label||'Score by month')+'">';
  [0,25,50,75,100].forEach(function(t){ s+='<line class="g" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(t)+'" y2="'+y(t)+'"/><text x="'+(pl-6)+'" y="'+(y(t)+4)+'" text-anchor="end">'+t+'</text>'; });
  var d='', pen=false; pts.forEach(function(p,j){ if(p.v==null){ pen=false; return; } d+=(pen?'L':'M')+x(j).toFixed(1)+' '+y(p.v).toFixed(1); pen=true; });
  s+='<path class="ln" d="'+d+'" stroke="'+(o.color||C.good)+'"/>';
  var every=Math.max(1,Math.ceil(n/(phone()?4:8)));
  pts.forEach(function(p,j){ if(j===n-1 || (j%every===0 && n-1-j>=every)) s+='<text x="'+x(j).toFixed(1)+'" y="'+(H-6)+'" text-anchor="'+(j===0?'start':j===n-1?'end':'middle')+'">'+esc(p.label)+'</text>'; });
  var L=null; for(var j=n-1;j>=0;j--){ if(pts[j].v!=null){ L=j; break; } }
  if(L!=null){ s+='<circle class="end" cx="'+x(L).toFixed(1)+'" cy="'+y(pts[L].v).toFixed(1)+'" r="5" fill="'+(o.color||C.good)+'"/><text class="lab" x="'+(x(L)+9).toFixed(1)+'" y="'+(y(pts[L].v)+4).toFixed(1)+'">'+pts[L].v+'</text>'; }
  var bw=n<2?W-pl-pr:(W-pl-pr)/(n-1);
  pts.forEach(function(p,j){ s+='<rect class="hit" x="'+(x(j)-bw/2).toFixed(1)+'" y="'+pt+'" width="'+bw.toFixed(1)+'" height="'+(H-pt-pb)+'" data-tip="'+esc(p.label+': '+(p.v==null?'not scored':p.v+' out of 100')+(p.prov?' (provisional)':''))+'"/>'; });
  return s+'</svg>';
}
/* Quarters: sums of quarterly fields for the last n financial-year quarters that ended by month k */
function quarters(S, k, ids, n){
  var p=E.parse(k), y=p.y, m=p.m; while([2,5,8,11].indexOf(m)<0){ m--; if(m<0){ m=11; y--; } }
  var end=E.key(y,m), out=[];
  for(var q=n-1;q>=0;q--){ var qe=E.addMonths(end,-3*q), qs=E.addMonths(qe,-2), sums=ids.map(function(){ return 0; }), any=false;
    S.months.forEach(function(x){ if(x.month>=qs && x.month<=qe) ids.forEach(function(id,j){ var v=(x.raw||{})[id]; if(v!==undefined && v!=='' && isFinite(+v)){ sums[j]+=+v; any=true; } }); });
    out.push({label:A.mShort(qs).slice(0,3)+'–'+A.mShort(qe), sums:sums, any:any}); }
  return out;
}
/* Progress against an agreed annual target (land, nature, community) */
function progress(rows){
  return '<div class="ov-prog">'+rows.map(function(r){ var max=Math.max(r.target||0, r.actual||0)*1.08||1, pc=r.target>0?r.actual/r.target*100:null;
    return '<div class="ov-prog-r"><div class="ov-prog-h"><span class="nm">'+esc(r.name)+'</span><span class="vl"><b>'+r.fmt(r.actual)+'</b> of '+r.fmt(r.target)+' '+esc(r.unit)+(pc!=null?' <span class="pc">'+fmt(pc,0)+'%</span>':'')+'</span></div>'
      + '<div class="ov-prog-t" role="img" aria-label="'+esc(r.name+': '+r.fmt(r.actual)+' of '+r.fmt(r.target)+' '+r.unit)+'"><i style="width:'+clamp(r.actual/max*100,0,100)+'%"></i>'+(r.target>0?'<b style="left:'+clamp(r.target/max*100,0,100)+'%" data-tip="'+esc('Agreed target '+r.fmt(r.target)+' '+r.unit+' a year')+'"></b>':'')+'</div></div>'; }).join('')
    + '<div class="ov-bul-l"><span><i class="k-a"></i>Last '+esc(CUR_SPAN)+'</span><span><i class="k-t"></i>Agreed annual target</span></div></div>';
}
function money(v){ return '$'+compact(v).replace(/^-/,'−'); }
function bar(x,y,w,h){ var r=Math.min(4,w/2,h); return 'M'+x.toFixed(1)+' '+(y+h).toFixed(1)+'V'+(y+r).toFixed(1)+'Q'+x.toFixed(1)+' '+y.toFixed(1)+' '+(x+r).toFixed(1)+' '+y.toFixed(1)+'H'+(x+w-r).toFixed(1)+'Q'+(x+w).toFixed(1)+' '+y.toFixed(1)+' '+(x+w).toFixed(1)+' '+(y+r).toFixed(1)+'V'+(y+h).toFixed(1)+'Z'; }

/* Emissions against the path to the target: % change on the same months of the baseline year, one axis. */
function trajectory(S, i, T, o){
  o=o||{}; var ph=phone() && !o.fixed, W=ph?380:(o.w||720), H=ph?300:(o.h||250), pl=ph?40:46, pr=ph?78:96, pt=16, pb=28, pins=o.pins||[];
  if(pins.length){ pb=58; H+=30; }
  var start=S.months[0].month, end=TARGET_YEAR_END; if(S.months[i].month>end) end=S.months[i].month;
  var span=Math.max(1,monthsBetween(start,end));
  var bEnd=baseFyEnd(S)||S.months[Math.min(11,S.months.length-1)].month, tgt=num(T.target_emissions);
  var pts=[]; for(var j=0;j<=i;j++){ var r=S.months[j].r12; if(r && r.base.total_t>0) pts.push({k:S.months[j].month, v:(r.total_t/r.base.total_t-1)*100, prov:S.months[j].status!=='verified'}); }
  if(!pts.length) return '';
  var lo=Math.min(-tgt, Math.min.apply(null,pts.map(function(p){ return p.v; }))), hi=Math.max(0, Math.max.apply(null,pts.map(function(p){ return p.v; })));
  var step = (hi-lo)>45?20:10, yMin=Math.floor((lo-2)/step)*step, yMax=Math.max(step/2, Math.ceil((hi+2)/step)*step);
  var x=function(k){ return pl+(W-pl-pr)*monthsBetween(start,k)/span; }, y=function(v){ return pt+(H-pt-pb)*(yMax-v)/(yMax-yMin); };
  var s='<svg class="ov-chart ov-traj" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Emissions against the path to the target">';
  // baseline year
  var b0=E.addMonths(bEnd,-11); if(b0<start) b0=start; s+='<rect class="bz" x="'+x(b0).toFixed(1)+'" y="'+pt+'" width="'+Math.max(0,x(bEnd)-x(b0)+ (W-pl-pr)/span).toFixed(1)+'" height="'+(H-pt-pb)+'"/><text class="bzt" x="'+(x(b0)+6).toFixed(1)+'" y="'+(H-pb-8)+'">Baseline '+esc(S.baseline.fy||'')+'</text>';
  for(var t=yMax;t>=yMin;t-=step){ s+='<line class="g'+(t===0?' z':'')+'" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(t).toFixed(1)+'" y2="'+y(t).toFixed(1)+'"/><text x="'+(pl-8)+'" y="'+(y(t)+4).toFixed(1)+'" text-anchor="end">'+(t>0?'+':t<0?'−':'')+Math.abs(t)+'%</text>'; }
  // years along the bottom
  var y0=E.parse(start).y; for(var yr=y0+1; yr<=E.parse(end).y; yr++){ var k=yr+'-01'; if(k<start||k>end) continue; if(ph && (yr-y0)%2===0 && yr!==E.parse(end).y) continue; s+='<text x="'+x(k).toFixed(1)+'" y="'+(H-pb+20)+'" text-anchor="middle">'+(ph?"'"+String(yr).slice(2):yr)+'</text>'; }
  // the plan: numbered steps on a rail under the years, in the order they start
  if(pins.length){ var ry=H-14, used={}; s+='<line class="rail" x1="'+x(S.months[i].month).toFixed(1)+'" x2="'+x(end).toFixed(1)+'" y1="'+ry+'" y2="'+ry+'"/>';
    pins.forEach(function(pn){ var px=x(pn.k), lab=String(pn.n), bw=Math.max(20, lab.length*7+12);
      s+='<g class="pin" data-tip="'+esc(pn.tip||'')+'"><rect x="'+(px-bw/2).toFixed(1)+'" y="'+(ry-10)+'" width="'+bw+'" height="20" rx="10"/><text x="'+px.toFixed(1)+'" y="'+(ry+4)+'" text-anchor="middle">'+esc(lab)+'</text></g>'; }); }
  // the path to the target (a threshold, so dashed)
  if(tgt>0){ s+='<path class="path" d="M'+x(bEnd).toFixed(1)+' '+y(0).toFixed(1)+'L'+x(TARGET_YEAR_END).toFixed(1)+' '+y(-tgt).toFixed(1)+'"/><circle class="tg" cx="'+x(TARGET_YEAR_END).toFixed(1)+'" cy="'+y(-tgt).toFixed(1)+'" r="4"/><text class="lab" x="'+(x(TARGET_YEAR_END)+9).toFixed(1)+'" y="'+(y(-tgt)+4).toFixed(1)+'">Target −'+fmt(tgt,0)+'%</text>'; }
  // actual
  var d=''; pts.forEach(function(p,j){ d+=(j?'L':'M')+x(p.k).toFixed(1)+' '+y(p.v).toFixed(1); });
  s+='<path class="act" d="'+d+'"/>';
  var L=pts[pts.length-1]; s+='<circle class="end" cx="'+x(L.k).toFixed(1)+'" cy="'+y(L.v).toFixed(1)+'" r="5"/>';
  if(L.k>bEnd){ var above = !(tgt>0) || L.v>=pathAt(L.k,bEnd,tgt), ly=y(L.v)+(above?-10:18); ly=clamp(ly, pt+12, H-pb-6);
    s+='<text class="lab strong" x="'+(x(L.k)+8).toFixed(1)+'" y="'+ly.toFixed(1)+'">'+spct(L.v)+'</text>'; }
  // hover: one band per month with data
  var band=(W-pl-pr)/span;
  pts.forEach(function(p){ var pv=pathAt(p.k, bEnd, tgt); s+='<rect class="hit" x="'+(x(p.k)-band/2).toFixed(1)+'" y="'+pt+'" width="'+Math.max(4,band).toFixed(1)+'" height="'+(H-pt-pb)+'" data-tip="'+esc(A.mLabel(p.k)+': '+(p.k<=bEnd?'in the baseline year, '+(S.baseline.fy||''):spct(p.v)+' on the same months of '+(S.baseline.fy||'the baseline year')+(tgt>0?' · path '+spct(pv):''))+(p.prov?' (provisional)':''))+'"/>'; });
  return s+'</svg>';
}
function pathAt(k, bEnd, tgt){ if(!(tgt>0) || k<=bEnd) return 0; var a=monthsBetween(bEnd,k), b=monthsBetween(bEnd,TARGET_YEAR_END); return -tgt*Math.min(1,a/b); }

/* Emissions status against the path */
function onTrack(S, i, T){
  var m=S.months[i], r=m.r12, tgt=num(T.target_emissions); if(!(r.base.total_t>0)) return null;
  var red=(1-r.total_t/r.base.total_t)*100, bEnd=baseFyEnd(S), path=-pathAt(m.month,bEnd||m.month,tgt);
  var yrsLeft=Math.max(0, monthsBetween(m.month, TARGET_YEAR_END)/12), gap=tgt-red;
  var inBase = bEnd && m.month<=bEnd;
  return { red:red, path:path, gap:red-path, tgt:tgt, yrsLeft:yrsLeft, pace: yrsLeft>0 ? gap/yrsLeft : null, inBase:inBase,
           state: inBase ? 'base' : red>=path-0.5 ? 'on' : red>=path-3 ? 'close' : 'behind' };
}

/* Bullet: actual, the target (or standard), the published benchmark */
function bullet(a, t, b, o){
  o=o||{}; var max=o.max||100; var w=function(v){ return clamp((v||0)/max*100,0,100); };
  return '<div class="ov-bul" role="img" aria-label="'+esc((o.what||'Actual')+' '+(a==null?'not reported':fmt(a,1)+'%')+(t!=null?', target '+fmt(t,0)+'%':'')+(b?', industry '+fmt(b.v,0)+'%':''))+'">'
    + '<i style="width:'+w(a)+'%"></i>'+(t!=null?'<b style="left:'+w(t)+'%" data-tip="'+esc(o.tName||'Target')+' '+fmt(t,0)+'%"></b>':'')+(b?'<s style="left:'+w(b.v)+'%" data-tip="Industry '+fmt(b.v,0)+'%: '+esc(b.label)+'"></s>':'')+'</div>'
    + '<div class="ov-bul-l"><span><i class="k-a"></i>You '+(a==null?'—':fmt(a,1)+'%')+'</span>'+(t!=null?'<span><i class="k-t"></i>'+esc(o.tName||'Target')+' '+fmt(t,0)+'%</span>':'')+(b?'<span><i class="k-b"></i>Industry '+fmt(b.v,0)+'%</span>':'')+'</div>';
}

/* ------------------------------------------------------------------ emissions by source */
var SRC = [
  {k:'elec', name:'Electricity', scope:2, cat:'energy', fn:function(x){ return x.scope2_t; }, what:'Grid electricity, location-based'},
  {k:'fleet', name:'Fleet fuel', scope:1, cat:'fleet', fn:function(x){ return x.scope1_fleet; }, what:'Diesel, petrol, LPG and biodiesel burned in your vehicles and plant'},
  {k:'gas', name:'Gas', scope:1, cat:'energy', fn:function(x){ return x.scope1_gas; }, what:'Natural gas burned on site'},
  {k:'landfill', name:'Waste to landfill', scope:3, cat:'waste', fn:function(x){ return x.scope3_waste; }, what:'Methane from your general waste breaking down in landfill'},
  {k:'upstream', name:'Fuel and electricity supply chain', scope:3, cat:'carbon', fn:function(x){ return x.scope3_upstream; }, what:'Extracting, processing and transmitting the fuel and electricity you buy'}
];
function sources(S,i){
  var w=win(S,i), tot=sum(w,function(x){ return x.total_t; });
  return SRC.map(function(s){ var v=sum(w,s.fn), b=baseSum(S,w,s.fn); return {s:s, v:v, b:b, share:tot>0?v/tot*100:0, ch:pctChg(v,b)}; }).filter(function(r){ return r.v>0.05; }).sort(function(a,b){ return b.v-a.v; });
}
function sourceList(rows, o){
  o=o||{}; var max=rows.length?rows[0].v:1;
  return '<div class="ov-src'+(o.inB?' no-ch':'')+'">'+rows.map(function(r){
    return (o.static?'<div class="ov-src-r">':'<a class="ov-src-r" href="#/category/'+r.s.cat+(o.m?'?m='+o.m:'')+'" data-tip="'+esc(r.s.what)+'">')+'<span class="nm">'+esc(r.s.name)+'<span class="sc">Scope '+r.s.scope+'</span></span>'
      + '<span class="tr"><i style="width:'+clamp(r.v/max*100,1.5,100)+'%"></i></span>'
      + '<span class="vl"><b>'+fmt(r.v,0)+'</b> t<span class="sh">'+fmt(r.share,0)+'%</span></span>'
      + (o.inB?'':'<span class="ch">'+(r.ch==null?'<span class="muted">—</span>':arrow(r.ch,true))+'</span>')+(o.static?'</div>':'</a>'); }).join('')+'</div>';
}

/* ------------------------------------------------------------------ what changed (rule-based, from the figures) */
function changes(S,i,o){
  var m=S.months[i], r=m.r12, prev=S.months[i-12]||null, out=[];
  var add=function(score,good,text,href){ if(score>0) out.push({score:score,good:good,text:text,href:href}); };
  var mb=r.base;
  var e=pctChg(r.total_t, mb.total_t); if(e!=null && Math.abs(e)>=1){ var dt=r.total_t-mb.total_t;
    var src=sources(S,i).filter(function(x){ return x.b>0; }).sort(function(a,b){ return Math.abs(b.v-b.b)-Math.abs(a.v-a.b); })[0];
    var by = src && Math.abs(src.v-src.b)>=Math.abs(dt)*0.35 ? ' The biggest mover is '+src.s.name.toLowerCase()+', '+(src.v<src.b?'down ':'up ')+nu(Math.abs(src.v-src.b),'t CO₂-e')+'.' : '';
    add(Math.abs(e)*2, e<0, 'Emissions are <b>'+(e<0?'down ':'up ')+fmt(Math.abs(e),1)+'%</b> on the same months of the baseline year: '+nu(Math.abs(dt),'t CO₂-e')+' '+(e<0?'less':'more')+' over '+span(r)+'.'+by, '#/category/carbon'); }
  if(prev && prev.r12 && r.renew_pct!=null && prev.r12.renew_pct!=null){ var dp=r.renew_pct-prev.r12.renew_pct; if(Math.abs(dp)>=1) add(Math.abs(dp)*1.4, dp>0, 'Renewable electricity is <b>'+fmt(r.renew_pct,0)+'%</b> of what you use, '+(dp>0?'up ':'down ')+fmt(Math.abs(dp),0)+' points on a year ago.', '#/category/energy'); }
  var g=pctChg(r.grid_kwh, mb.grid_kwh); if(g!=null && Math.abs(g)>=2) add(Math.abs(g), g<0, 'Grid electricity use is <b>'+(g<0?'down ':'up ')+fmt(Math.abs(g),1)+'%</b> ('+fmt(Math.abs(r.grid_kwh-mb.grid_kwh)/1000,0)+' MWh) on the baseline months.', '#/category/energy');
  var f=pctChg(r.fuel_l, mb.fuel_l); if(f!=null && Math.abs(f)>=2) add(Math.abs(f), f<0, 'Fleet fuel is <b>'+(f<0?'down ':'up ')+fmt(Math.abs(f),1)+'%</b> ('+fmt(Math.abs(r.fuel_l-mb.fuel_l)/1000,0)+' kL) on the baseline months.', '#/category/fleet');
  if(prev && m.fleet_ev_pct!=null && prev.fleet_ev_pct!=null){ var ev=evCount(m.values), evp=evCount(prev.values), dv=ev-evp; if(dv) add(Math.abs(m.fleet_ev_pct-prev.fleet_ev_pct)*1.6+2, dv>0, '<b>'+Math.abs(dv)+(dv>0?' more':' fewer')+' electric vehicle'+(Math.abs(dv)===1?'':'s')+'</b> than a year ago: '+fmt(m.fleet_ev_pct,0)+'% of the fleet is now electric.', '#/category/fleet'); }
  var wt=pctChg(r.potable_kl, mb.potable_kl); if(wt!=null && Math.abs(wt)>=2) add(Math.abs(wt), wt<0, 'Drinking water use is <b>'+(wt<0?'down ':'up ')+fmt(Math.abs(wt),1)+'%</b> ('+fmt(Math.abs(r.potable_kl-mb.potable_kl),0)+' kL) on the baseline months.', '#/category/water');
  var lf=pctChg(r.landfill_t, mb.landfill_t); if(lf!=null && Math.abs(lf)>=2) add(Math.abs(lf)*1.2, lf<0, 'Waste to landfill is <b>'+(lf<0?'down ':'up ')+fmt(Math.abs(lf),1)+'%</b> ('+fmt(Math.abs(r.landfill_t-mb.landfill_t),0)+' tonnes) on the baseline months.', '#/category/waste');
  if(prev && prev.r12 && r.diversion_pct!=null && prev.r12.diversion_pct!=null){ var dd=r.diversion_pct-prev.r12.diversion_pct; if(Math.abs(dd)>=1) add(Math.abs(dd)*1.4, dd>0, 'Landfill diversion is <b>'+fmt(r.diversion_pct,0)+'%</b>, '+(dd>0?'up ':'down ')+fmt(Math.abs(dd),0)+' points on a year ago.', '#/category/waste'); }
  // the biggest category score moves
  var mv=D.CATEGORIES.map(function(c){ return {c:c, d:m.cat_yoy[c.k]}; }).filter(function(x){ return x.d!=null && Math.abs(x.d)>=5; }).sort(function(a,b){ return Math.abs(b.d)-Math.abs(a.d); });
  if(mv[0]) add(Math.abs(mv[0].d)*0.6, mv[0].d>0, '<b>'+esc(mv[0].c.name)+'</b> moved '+(mv[0].d>0?'up ':'down ')+Math.round(Math.abs(mv[0].d))+' points on a year ago, the biggest move of the ten.', '#/category/'+mv[0].c.k);
  out.sort(function(a,b){ return b.score-a.score; });
  var top=out.slice(0,5);
  // always show the most important thing going the wrong way, if there is one
  var bad=out.filter(function(x){ return x.good===false; })[0]; if(bad && top.indexOf(bad)<0) top[top.length-1]=bad;
  return top;
}
function evCount(v){ return pos(v.veh_bev)+pos(v.trucks_electric)+pos(v.veh_phev); }

/* ------------------------------------------------------------------ the four levers */
function levers(S,i,o){
  var m=S.months[i], r=m.r12, T=S.targets, w=win(S,i), BM=A.benchFor(o.profile)||{}, ml=function(x){ return A.mShort(x.month); };
  var L=[], inB=inBaseYear(S,i), n=span(r), BY='<span class="muted">Baseline year</span> · ';
  var onB=function(ch,lb){ return ch==null?'<span class="muted">no baseline</span>':arrow(ch,lb)+' on the baseline months'; };
  if(m.scores.energy!=null){ var g=pctChg(r.grid_kwh,r.base.grid_kwh), mwh=nu(r.grid_kwh/1000,'MWh');
    L.push({k:'energy', name:'Energy', big:r.renew_pct==null?'—':fmt(r.renew_pct,0)+'%', what:'of your electricity is renewable',
      sub: inB ? BY+mwh+' of grid electricity over '+n : 'Grid electricity '+onB(g,true)+' · '+mwh+' over '+n,
      bul:bullet(r.renew_pct, Math.max(num(T.target_renewable),E.STANDARDS.renewable), BM.renewable, {what:'Renewable electricity', tName:tLab(T.target_renewable,E.STANDARDS.renewable)}),
      chart:columns(w.map(function(x){ var all=pos(x.elec_all_kwh), rn=Math.min(all,pos(x.renew_kwh)); return {label:ml(x), parts:[(all-rn)/1000, rn/1000]}; }),{names:['Not renewable','Renewable'],colors:[C.rest,C.good],unit:'MWh',label:'Electricity by month, MWh',h:150}),
      key:[['Not renewable',C.rest],['Renewable',C.good]], unit:'MWh'}); }
  if(m.scores.fleet!=null){ var fch=pctChg(r.fuel_l,r.base.fuel_l), kl=nu(r.fuel_l/1000,'kL',r.fuel_l<1e4?1:0);
    L.push({k:'fleet', name:'Fleet', big:m.fleet_ev_pct==null?'—':fmt(m.fleet_ev_pct,0)+'%', what:'of the fleet is electric',
      sub: inB ? BY+kl+' of fuel over '+n+' · '+fmt(m.fleet_n,0)+' vehicles' : 'Fuel '+onB(fch,true)+' · '+kl+' over '+n+' · '+fmt(m.fleet_n,0)+' vehicles',
      bul:bullet(m.fleet_ev_pct, num(T.target_fleet_ev)||null, BM.fleet, {what:'Fleet electrification', tName:'Your target'}),
      chart:columns(w.map(function(x){ var v=x.values||{}; return {label:ml(x), parts:[(pos(v.diesel_l)+pos(v.petrol_l)+pos(v.lpg_l))/1000, pos(v.biodiesel_l)/1000]}; }),{names:['Diesel, petrol and LPG','Biodiesel'],colors:[C.rest,C.good],unit:'kL',label:'Fuel by month, kL',h:150}),
      key:[['Diesel, petrol and LPG',C.rest]].concat(sum(w,function(x){ return (x.values||{}).biodiesel_l; })>0?[['Biodiesel',C.good]]:[]), unit:'kL'}); }
  if(m.scores.water!=null){ var wc=pctChg(r.potable_kl,r.base.potable_kl), alt=r.alt_water_pct==null?'no rain, storm or recycled water reported':fmt(r.alt_water_pct,0)+'% from rain, storm or recycled water';
    L.push({k:'water', name:'Water', big:fmt(r.potable_kl,0)+'<small> kL</small>', what:'of drinking water over '+n,
      sub: inB ? BY+alt : onB(wc,true)+' · '+alt,
      bul:bullet(r.alt_water_pct, null, null, {what:'Alternative water share', max:100}),
      chart:columns(w.map(function(x){ var v=x.raw||{}; var a2=pos(v.recycled_kl)+pos(v.rain_kl)+pos(v.storm_kl)+pos(v.waste_water_kl); return {label:ml(x), parts:[pos(v.potable_kl), a2]}; }),{names:['Drinking water','Rain, storm or recycled'],colors:[C.rest,C.good],unit:'kL',label:'Water by month, kL',h:150}),
      key:[['Drinking water',C.rest],['Rain, storm or recycled',C.good]], altLabel:true, unit:'kL'}); }
  if(m.scores.waste!=null){ var lch=pctChg(r.landfill_t,r.base.landfill_t), wt=nu(r.waste_total_t,'t')+' of waste over '+n;
    L.push({k:'waste', name:'Waste', big:r.diversion_pct==null?'—':fmt(r.diversion_pct,0)+'%', what:'kept out of landfill',
      sub: inB ? BY+wt : 'Landfill '+onB(lch,true)+' · '+wt,
      bul:bullet(r.diversion_pct, Math.max(num(T.target_diversion),E.STANDARDS.diversion), BM.diversion, {what:'Landfill diversion', tName:tLab(T.target_diversion,E.STANDARDS.diversion)}),
      chart:columns(w.map(function(x){ return {label:ml(x), parts:[pos(x.landfill_t), pos(x.waste_total_t)-pos(x.landfill_t)]}; }),{names:['To landfill','Recovered or treated'],colors:[C.rest,C.good],unit:'t',label:'Waste by month, tonnes',h:150}),
      key:[['To landfill',C.rest],['Recovered or treated',C.good]], unit:'t'}); }
  L.forEach(function(l){ l.span=n; });
  return L;
}
function leverCard(l, m, month){
  return '<article class="ov-lev"><header><h3><a href="#/category/'+l.k+'?m='+month+'">'+esc(l.name)+'</a></h3>'+chipScore(m,l.k)+'</header>'
    + '<div class="ov-val"><b>'+l.big+'</b><span>'+esc(l.what)+'</span></div>'
    + '<p class="ov-s">'+l.sub+'</p>'
    + (l.altLabel ? '<p class="mini-k">Share from rain, storm or recycled water</p>' : '')
    + l.bul
    + '<div class="mini">'+l.chart+'</div>'
    + '<div class="ov-key">'+l.key.map(function(k){ return '<span><i style="background:'+k[1]+'"></i>'+esc(k[0])+'</span>'; }).join('')+'<span class="r">'+esc(l.unit)+' · last '+esc(l.span)+'</span></div>'
    + '<a class="more" href="#/category/'+l.k+'?m='+month+'">'+esc(l.name)+' in detail <span aria-hidden="true">→</span></a></article>';
}

/* ------------------------------------------------------------------ data confidence */
function confidence(o, m){
  var r=A.rec(o,m.month)||{}, ev=r.evidence||{}, grades=Object.keys(ev).map(function(k){ return ev[k]&&ev[k].grade; });
  var cs=grades.filter(function(g){ return g==='C'; }).length, comp=num(m.complete_pct), evp=num(m.evidence_pct);
  var g = comp>=99 && evp>=95 && !cs ? 'A' : comp>=90 && evp>=75 ? 'B' : 'C';
  var why = 'Required figures supplied '+fmt(comp,0)+'% · figures backed by evidence '+fmt(evp,0)+'%'+(cs?' · '+cs+' categor'+(cs===1?'y':'ies')+' graded C':'');
  return {g:g, why:why};
}

function doKey(it){ var cat=it.s.cat?D.CAT[it.s.cat].short:'Funding', up=A.upText(it.uplift); if(!up) return esc(cat)+' · '+esc(it.s.effectText||''); var k=up.indexOf(esc(cat)+' ')===0 ? up : esc(cat)+' · '+up; return k.split(' · ').map(function(x,j){ return '<span class="nw">'+(j?'· ':'')+x+'</span>'; }).join(' '); }

/* the emissions headline: one wording for the Overview and the report */
function emisParts(S, i, o){
  o=o||{}; var m=S.months[i], r=m.r12, T=S.targets, month=m.month, st=onTrack(S,i,T);
  var eTot=r.total_t, eCh=pctChg(eTot,r.base.total_t), pill='';
  if(st){ pill = st.state==='base' ? '<span class="ov-pill">Baseline year, to '+A.mLabel(baseFyEnd(S))+'</span>'
      : st.state==='on' ? '<span class="ov-pill good">On track for −'+fmt(st.tgt,0)+'% by 2030</span>'
      : st.state==='close' ? '<span class="ov-pill">Just behind the path to −'+fmt(st.tgt,0)+'%</span>'
      : '<span class="ov-pill bad">Behind the path to −'+fmt(st.tgt,0)+'% by 2030</span>'; }
  var paceTxt = '';
  if(st && !st.inBase){
    paceTxt = Math.abs(st.gap)<0.5 ? 'On the straight-line path. ' : st.gap>0 ? fmt(st.gap,1)+' points ahead of the straight-line path. ' : fmt(Math.abs(st.gap),1)+' points behind the straight-line path. ';
    paceTxt += st.red>=st.tgt ? 'The target is already met; hold it.' : st.pace!=null ? 'To reach −'+fmt(st.tgt,0)+'% by 2030, cut about '+fmt(Math.max(0,st.pace),1)+'% of your baseline emissions each year from here.' : '';
  }
  var head='<div class="ov-emis-h"><div><p class="ov-l">Emissions · '+(r.n<12?span(r)+' to '+A.mLabel(month):'rolling 12 months')+'</p><div class="ov-hero">'+fmt(eTot,0)+'<span class="u">t CO₂-e</span></div>'
    + '<p class="ov-s">'+(st&&st.inBase?'<span class="muted">Your baseline year</span>':eCh==null?'':arrow(eCh,true)+' on the same months of '+esc(S.baseline.fy))+' · <span class="nw">Scope 1: '+fmt(r.scope1_t,0)+' t</span> · <span class="nw">Scope 2: '+fmt(r.scope2_t,0)+' t</span> · <span class="nw">Scope 3: '+fmt(r.scope3_t,0)+' t</span></p></div>'+pill+'</div>'
    + (st && !st.inBase ? '<p class="ov-pace">'+paceTxt+'</p>' : st && st.inBase ? '<p class="ov-pace">Everything is compared with your baseline year, '+esc(S.baseline.fy)+'. The path to your target of −'+fmt(st.tgt,0)+'% by 2030 starts when it ends.</p>' : '')
  ;
  var chart='<div class="ov-traj-w">'+trajectory(S,i,T,o.traj)+'</div>'
    + '<div class="ov-key"><span><i class="ln"></i>Your emissions'+(o.shortKey?'':', % change on the baseline months')+'</span><span><i class="ln dash"></i>Straight-line path to your target</span></div>';
  return {head:head, chart:chart, st:st};

}

/* the report's page 1: the same emissions headline and sources, sized for A4 */
V.reportEmissions = function(S, i, api){
  A=api; E=api.E; D=api.D; R=api.R;
  var m=S.months[i], r=m.r12, ep=emisParts(S,i,{traj:{fixed:!phone(),w:640,h:165}, shortKey:true}), inB=inBaseYear(S,i);
  return '<div class="rp-emis"><div class="rp-emis-l">'+ep.head+ep.chart+'</div>'
    + '<div class="rp-emis-r"><p class="ov-l">Where they come from</p>'+sourceList(sources(S,i),{static:true, inB:inB})
    + '<p class="rp-emis-f">'+(inB?'Shares of your baseline year. ':'Change on the same months of '+esc(S.baseline.fy)+'. ')+'Avoided by recycling, never deducted: '+nu(r.avoided_t,'t CO₂-e')+'.</p></div></div>';
};

/* ------------------------------------------------------------------ the Overview's opening (chosen 14 Oct 2026 from concepts A, B and C):
   the road to 2030 with the plan on it, then what the figures amount to drawn to scale; the ten-part score closes the page. */
function you(p){ return p.org_name; }
/* the biggest emission source that makes a sensible yardstick for an amount of CO2-e (between under one and 30 years of it) */
function yardstick(S, i, amount){
  var w=win(S,i), n=w.length||1, list=[["your fleet's fuel",function(x){ return x.scope1_fleet; }],['your grid electricity',function(x){ return x.scope2_t; }],['the gas you burn',function(x){ return x.scope1_gas; }]];
  for(var j=0;j<list.length;j++){ var perYear=sum(w,list[j][1])*12/n; if(perYear>0){ var yrs=amount/perYear; if(yrs>=0.5 && yrs<=30) return {name:list[j][0], years:yrs, perYear:perYear}; } }
  return null;
}
function blocks(n, cls){ var full=Math.floor(n), part=n-full, h=''; for(var k=0;k<full&&k<30;k++) h+='<i></i>'; if(part>0.05 && full<30) h+='<i class="part"><b style="width:'+Math.round(part*100)+'%"></b></i>'; return '<div class="cx-blocks '+(cls||'')+'" aria-hidden="true">'+h+'</div>'; }
function waffle(pct){ var on=Math.round(clamp(pct||0,0,100)), h=''; for(var k=0;k<100;k++) h+='<i'+(k<on?' class="on"':'')+'></i>'; return '<div class="cx-waffle" aria-hidden="true">'+h+'</div>'; }
function pools(n){ var unit=n>150?10:1, c=Math.round(n/unit), h=''; for(var k=0;k<Math.min(c,150);k++) h+='<i></i>'; return {html:'<div class="cx-pools" aria-hidden="true">'+h+'</div>', unit:unit}; }

/* What the figures amount to, drawn against things people can picture: their own fleet-years, a 100-square grid, Olympic pools */
function scaleFacts(S, i, o){
  var m=S.months[i], r=m.r12, p=o.profile, inB=inBaseYear(S,i), fy=S.baseline.fy, dt=r.total_t-r.base.total_t, facts=[];
  if(!inB && Math.abs(dt)>=1){ var ys=yardstick(S,i,Math.abs(dt));
    facts.push({big:nu(Math.abs(dt),'t CO₂-e'), what:(dt<0?'less':'more')+' than the same months of '+fy, scale: ys ? blocks(ys.years) + '<p class="cx-key">Each block is a year of emissions from '+esc(ys.name)+' ('+nu(ys.perYear,'t')+'). '+(dt<0?'The cut':'The rise')+' equals '+fmt(ys.years,1)+' of them.</p>' : ''}); }
  if(inB && r.total_t>0){ var ys2=yardstick(S,i,r.total_t);
    facts.push({big:nu(r.total_t,'t CO₂-e'), what:'in '+(r.n<12?'your first '+span(r):'your baseline year')+', the figure every later month is measured against', scale: ys2 ? blocks(Math.min(ys2.years,30)) + '<p class="cx-key">Each block is a year of emissions from '+esc(ys2.name)+'.</p>' : ''}); }
  if(r.diversion_pct!=null){ var kept=r.waste_total_t-r.landfill_t, per=num(p.residents)>0?{n:num(p.residents),l:'resident'}:num(p.employees)>0?{n:num(p.employees),l:'employee'}:null;
    facts.push({big:nu(kept,'t'), what:'of waste kept out of landfill'+(per?', '+(kept*1000/per.n>=1000?nu(kept/per.n,'t',1):nu(kept*1000/per.n,'kg'))+' for every '+per.l:''), scale: waffle(r.diversion_pct)+'<p class="cx-key">'+fmt(r.diversion_pct,0)+' of every 100 tonnes you threw away was recovered. The eco standard is 80.</p>'}); }
  if(r.potable_kl>0){ var pn=r.potable_kl/2500, pg=pools(pn);
    facts.push({big:fmt(pn,pn<10?1:0)+' Olympic pools', what:'of drinking water ('+nu(r.potable_kl,'kL')+')'+(r.alt_water_pct>=1?'. Another '+fmt(r.alt_water_pct,0)+'% of what you used came from rain, storm or recycled water':''), scale: pg.html+'<p class="cx-key">Each mark is '+(pg.unit===1?'one pool':pg.unit+' pools')+' of 2,500 kL.</p>'}); }
  if(!facts.length) return '';
  return '<section class="cx cx-a"><h2 class="sec-t">What it amounts to</h2><p class="sec-s">'+(r.n<12?'The '+span(r)+' to ':'Rolling 12 months to ')+A.mLabel(m.month)+', verified by Yarta.'+(inB?'':' Comparisons use the same calendar months of '+esc(fy)+'.')+'</p>'
    + '<div class="cx-facts">'+facts.map(function(f){ return '<div class="cx-fact"><p class="cx-big">'+f.big+'</p><p class="cx-what">'+f.what+'</p>'+f.scale+'</div>'; }).join('')+'</div></section>';
}

/* The ten parts: the score is the average of the categories reported, so show them as columns with the average as a line across them */
function tenParts(S, i, o){
  var m=S.months[i], r=m.r12, T=S.targets, st=onTrack(S,i,T), ly=S.months[i-12]||null, month=m.month;
  var cats=D.CATEGORIES.map(function(c){ return {c:c, v:m.scores[c.k], was:ly&&ly.scores?ly.scores[c.k]:null, d:m.cat_yoy[c.k]}; });
  var scored=cats.filter(function(x){ return x.v!=null; }).sort(function(a,b){ return b.v-a.v; });
  var hi=scored.slice(0,2), lo=scored.slice(-2).reverse();
  var link=function(x){ return '<a href="#/category/'+x.c.k+'?m='+month+'">'+esc(x.c.short)+' '+Math.round(x.v)+'</a>'; };
  var eCh=pctChg(r.total_t,r.base.total_t);
  var cols=cats.map(function(x){ var v=x.v;
    return '<a class="cx-col'+(v==null?' na':'')+'" href="#/category/'+x.c.k+'?m='+month+'" style="--v:'+(v==null?0:Math.round(v))+';--w:'+(x.was==null?-1:Math.round(x.was))+'" data-tip="'+esc(x.c.name+': '+(v==null?'not reported':Math.round(v)+' out of 100'+(x.d!=null?', '+(x.d>=0?'+':'−')+Math.round(Math.abs(x.d))+' on a year ago':'')))+'">'
      + '<span class="bar"><i></i>'+(x.was!=null&&v!=null?'<s></s>':'')+'</span><span class="val">'+(v==null?'—':Math.round(v))+'</span><span class="nm">'+esc(x.c.short)+'</span><span class="dl">'+(v==null?'Not reported':x.d==null?'':A.delta(x.d))+'</span></a>'; }).join('');
  return '<section class="cx cx-b" id="ten"><div class="cx-b-head"><div><h2 class="cx-b-t">Your score of '+m.score+', in its '+m.scored+' parts</h2>'
    + '<p class="cx-b-yoy">'+(m.yoy!=null?(m.yoy>=0?'Up ':'Down ')+Math.round(Math.abs(m.yoy))+' on '+A.mLabel(ly.month)+'. ':'Year-on-year change shows after 12 months. ')+'The score is the average of the categories you report, each out of 100.</p></div>'
    + '<div class="cx-b-side"><p><span class="lbl">Lifting your score</span>'+hi.map(link).join(', ')+'</p><p><span class="lbl">Holding it back</span>'+lo.map(link).join(', ')+'</p></div></div>'
    + '<div class="cx-sky" style="--s:'+m.score+'">'+cols+'</div>'
    + '<div class="cx-b-key"><span><i class="k-bar"></i>Category score, out of 100</span>'+(ly?'<span><i class="k-was"></i>A year ago</span>':'')+'<span><i class="k-line"></i>Your score, '+m.score+': the average</span></div></section>';
}

/* The opening: emissions against the road to 2030, the score beside it, and the plan's steps on the same timeline */
function heroRoad(S, i, o){
  var m=S.months[i], r=m.r12, T=S.targets, st=onTrack(S,i,T), month=m.month, P=A.planFor(o,S,i);
  var head, sub;
  if(!st){ head='Your emissions'; sub=''; }
  else if(st.inBase){ head='Baseline year, to '+A.mLabel(baseFyEnd(S)); sub='Your target is −'+fmt(st.tgt,0)+'% by 2030. The path starts when this year ends: every later month is measured against it.'; }
  else { head = st.state==='on' ? 'On track for −'+fmt(st.tgt,0)+'% by 2030' : st.state==='close' ? 'Just behind the path to −'+fmt(st.tgt,0)+'%' : 'Behind the path to −'+fmt(st.tgt,0)+'% by 2030';
    sub = 'You have cut '+fmt(Math.max(0,st.red),1)+'% on '+esc(S.baseline.fy)+'. '+(st.red>=st.tgt?'The target is already met; the job now is to hold it.':'Reaching the target takes about '+fmt(Math.max(0,st.pace),1)+'% of your baseline emissions each year, for '+fmt(st.yrsLeft,1)+' more years.'); }
  var steps=P?P.active.filter(function(it){ return it.k!=='grants' && it.start; }).sort(function(a,b){ return a.start<b.start?-1:a.start>b.start?1:0; }).slice(0,6):[];
  var qOf=function(k){ return k.slice(0,5)+('0'+(Math.floor((+k.slice(5)-1)/3)*3+1)).slice(-2); }, byQ={}, order=[];
  steps.forEach(function(it,j){ var q=qOf(it.start); if(!byQ[q]){ byQ[q]=[]; order.push(q); } byQ[q].push({n:j+1, t:it.title}); });
  var pins=phone()?[]:order.map(function(q){ var g=byQ[q], a=g[0].n, b=g[g.length-1].n; return {k:E.addMonths(q,1), n:a===b?a:a+'–'+b, tip:R.qLabel(q)+': '+g.map(function(x){ return x.n+'. '+x.t; }).join('; ')}; });
  var stepList=steps.map(function(it,j){ var q=it.start.slice(0,5)+('0'+(Math.floor((+it.start.slice(5)-1)/3)*3+1)).slice(-2);
    return '<li><span class="n">'+(j+1)+'</span><span class="when">'+esc(R.qLabel(q))+'</span><a href="#/improvements/'+it.s.k+'">'+esc(it.title)+'</a><span class="eff">'+doKey(it)+'</span>'+(it.booking?A.bookingChip(it.booking):'<a class="btn btn-primary btn-sm bk" href="#/improvements/'+it.s.k+'">Book</a>')+'</li>'; }).join('');
  var eCh=pctChg(r.total_t,r.base.total_t);
  var scoreBox='<a class="cx-score" href="#ten" aria-label="Your score, in its parts">'+A.ring(m.score,124,true)+'<span><b>'+esc(m.band)+'</b>'+(m.yoy!=null?(m.yoy>=0?'Up ':'Down ')+Math.round(Math.abs(m.yoy))+' on a year ago':'Change shows after 12 months')+'<br>'+m.scored+' of 10 categories scored</span></a>';
  var numbers='<p class="cx-c-nums"><b>'+nu(r.total_t,'t CO₂-e')+'</b> '+(r.n<12?'in the '+span(r)+' to '+A.mLabel(month):'over the last 12 months')+(eCh!=null&&!(st&&st.inBase)?', '+arrow(eCh,true)+' on '+esc(S.baseline.fy):'')+'. <span class="nw">Scope 1: '+fmt(r.scope1_t,0)+' t</span> · <span class="nw">Scope 2: '+fmt(r.scope2_t,0)+' t</span> · <span class="nw">Scope 3: '+fmt(r.scope3_t,0)+' t</span></p>';
  return '<section class="cx cx-c"><div class="cx-c-top"><div class="cx-c-head"><h2>'+head+'</h2><p>'+sub+'</p>'+numbers+'</div>'+scoreBox+'</div>'
    + '<div class="cx-c-road">'+trajectory(S,i,T,{w:1040,h:270,pins:pins})+'</div>'
    + '<div class="cx-c-key ov-key"><span><i class="ln"></i>Your emissions, % change on '+esc(S.baseline.fy)+'</span><span><i class="ln dash"></i>Straight-line path to your target</span>'+(pins.length?'<span><i class="k-pin"></i>When each step of your plan starts</span>':'')+'</div>'
    + (stepList?'<h3 class="cx-c-plan">Your plan</h3><ol class="cx-steps">'+stepList+'</ol><p class="cx-foot">In the order the steps start. The effects are estimates from the published rules'+(P&&P.potential!=null?'; with every step done, the score could reach '+P.potential:'')+'. You can use any provider. <a class="link" href="#/roadmap">The full roadmap</a></p>':'')
    + '</section>';
}

/* The brief: the client's own verified figures behind one step of the plan, as the provider receives them */
V.brief = function(S, i, key, api){
  A=api; E=api.E; D=api.D; R=api.R; CUR_SPAN=span(S.months[i].r12);
  var pl=(R.PLAN||{})[key]; if(!pl) return '';
  var rows=pl.needs.map(function(id){ var f=D.FIELD[id]; if(!f) return ''; var fg=fieldFigure(S,i,f); if(!fg || fg.r12==null) return '';
    var u=f.kind==='currency'?'':(f.unit||''), per=fg.latest?'As at '+A.mShort(fg.asAt):'Last '+CUR_SPAN;
    return '<tr><td>'+esc(f.name)+'</td><td class="num" data-l="'+esc(per)+'">'+fval(f,fg.r12)+(u?'<span class="pu"> '+esc(u)+'</span>':'')+'</td><td class="un">'+esc(u)+'</td><td class="small muted per">'+esc(per)+'</td></tr>'; }).join('');
  return rows ? '<div class="ov-fig brief"><div class="tbl-wrap"><table class="tbl compact brief"><tbody>'+rows+'</tbody></table></div></div>' : '';
};

/* ------------------------------------------------------------------ the Overview */
V.dashboard = function(q, api){
  A=api; E=api.E; D=api.D; R=api.R; tip();
  var o=A.org(), S=A.seriesOf(o), m=A.monthOf(S,q.m), p=o.profile;
  if(!m) return A.shell('dashboard','<div class="pg-head"><div><p class="kicker">Overview</p><h1>'+esc(p.org_name)+'</h1></div></div>'+A.banner(o)+'<div class="empty">'+(A.isOp()?'No month has been verified or entered yet. <a class="link" href="#/ops/entry">Open data entry</a>.':'Your first verified month will appear here. <a class="link" href="#/documents">Send your documents</a> and Yarta will enter them.')+'</div>');
  var i=A.idxOf(S,m.month), r=m.r12, T=S.targets, month=m.month;
  var opts=S.months.slice().reverse().map(function(x){ return '<option value="'+x.month+'"'+(x.month===month?' selected':'')+'>'+A.mLabel(x.month)+(x.status!=='verified'?' · provisional':'')+'</option>'; }).join('');
  var sec=(window.YESS&&p.sector&&window.YESS.BY[p.sector])?window.YESS.BY[p.sector].one:p.org_type;
  var head='<div class="pg-head"><div><p class="kicker">Overview · '+A.mLabel(month)+'</p><h1>'+esc(p.org_name)+'</h1><p class="pg-sub">'+[esc(sec), esc(p.state)].concat(p.residents?[fmt(p.residents)+' residents']:[]).concat([fmt(p.employees)+' FTE', 'baseline '+esc(p.baseline_fy)]).map(function(x,j){ return '<span class="nw">'+(j?'· ':'')+x+'</span>'; }).join(' ')+'</p></div>'
    + '<div class="pg-actions"><label class="vh" for="dm">Month</label><select id="dm" data-act="dash-month">'+opts+'</select><a class="btn btn-ink btn-sm" href="#/report/'+month+'">Monthly report</a></div></div>';

  // 1. the score and emissions against target
  var cf=confidence(o,m), st=onTrack(S,i,T);
  var yoy=m.yoy!=null?A.delta(m.yoy)+' <span class="muted">on '+A.mLabel(S.months[i-12].month)+'</span>':'<span class="muted">Year-on-year change after 12 months</span>';
  var score='<section class="panel-dark ov-score"><p class="ov-l">Yindyamarra Environmental Score</p>'+A.ring(m.score,150)
    + '<div class="band">'+esc(m.band)+'</div><div class="yoy">'+yoy+'</div>'
    + '<dl><dt>Status</dt><dd>'+A.statusChip(m.status)+'</dd><dt>Categories</dt><dd>'+m.scored+' of 10 scored</dd><dt>Data confidence</dt><dd><span class="ov-conf g-'+cf.g+'" data-tip="'+esc(cf.why)+'" tabindex="0">'+cf.g+'</span></dd></dl>'
    + '<p class="ov-fine">Self-declared under the published Yarta method; not an accredited rating.</p></section>';
  var ep=emisParts(S,i), emis='<section class="panel ov-emis">'+ep.head+ep.chart+'</section>';

  // 2. where the emissions come from
  var srcRows=sources(S,i), inB=inBaseYear(S,i), winT=(r.n<12?'The '+span(r)+' to ':'Rolling 12 months to ')+A.mLabel(month);
  var srcP='<section class="panel ov-srcp"><div class="ov-h"><div><h2 class="sec-t">Where your emissions come from</h2><p class="sec-s">'+winT+(inB?', your baseline year. Changes against it show from '+A.mLabel(E.addMonths(baseFyEnd(S),1))+'.':'. The arrow is the change on the same months of the baseline year.')+'</p></div><a class="btn btn-ghost btn-sm" href="#/category/carbon?m='+month+'" style="color:var(--ink)">Emissions in detail</a></div>'
    + sourceList(srcRows,{m:month, inB:inB})
    + '<p class="ov-fine">Avoided emissions from your recycling, reported separately and never deducted: <b>'+nu(r.avoided_t,'t CO₂-e')+'</b> (modelled estimate).'+(sum(win(S,i),function(x){ return x.flights; })>0?' Flights are recorded but not yet in the totals.':'')+'</p></section>';

  // 3. the four levers
  var lv=levers(S,i,o);
  var levP='<section class="ov-levs"><div class="ov-h"><div><h2 class="sec-t">Your four levers</h2><p class="sec-s">What moves your emissions and your score. Orange is the share going the right way.</p></div></div><div class="ov-lev-g">'+lv.map(function(l){ return leverCard(l,m,month); }).join('')+'</div></section>';

  // 4. what changed, and what to do next
  var ch=inB?[]:changes(S,i,o), cov=baseCover(S,month), gapNote='';
  if(cov && cov.miss.length){ gapNote='<p class="ov-gap"><b>Your baseline year has '+cov.have+' of 12 months'+(cov.done?'':' so far')+'.</b> Months without figures use the average of the months you have, so '+(A.isOp()?'figures for ':'bills and dockets for ')+monthRange(cov.miss)+' would make every comparison more accurate.'+(A.isOp()?'':' <a class="link" href="#/documents">Send documents</a>')+'</p>'; }
  var chP='<section class="panel ov-chg"><h2 class="sec-t">What changed</h2><p class="sec-s">The biggest movements in your figures. '+winT+'.</p>'
    + (inB?'<p class="muted">'+A.mLabel(month)+' is in your baseline year ('+esc(S.baseline.fy)+'). From '+A.mLabel(E.addMonths(baseFyEnd(S),1))+', this shows what moved against it, in plain words with the numbers.</p>':ch.length?'<ul>'+ch.map(function(c){ return '<li class="'+(c.good===false?'bad':c.good?'good':'')+'"><span class="mk" aria-hidden="true">'+(c.good===false?'!':'✓')+'</span><span>'+c.text+' <a class="link" href="'+c.href+'?m='+month+'">See why</a></span></li>'; }).join('')+'</ul>'+(ch.length<3?'<p class="muted ov-quiet">Everything else is within a percent or two of the baseline.</p>':''):'<p class="muted">Nothing moved by more than a percent or two. Changes show here as your figures move.</p>')+gapNote+'</section>';
  var P=A.planFor(o,S,i), nx='';
  if(P){ var items=P.items.filter(function(it){ return it.k!=='grants' && !it.off; }).slice(0,3), extra=[];
    if(P.emis.cut>=1) extra.push('about '+nu(P.emis.cut,'t CO₂-e')+' a year less');
    nx='<section class="panel ov-next"><h2 class="sec-t">Do next</h2><p class="sec-s">From your figures, by the published rules. You can use any provider.</p>'
      + (items.length?'<ol>'+items.map(function(it){ var b=it.booking; return '<li><a href="#/improvements/'+it.s.k+'"><span class="t">'+esc(it.title)+'</span><span class="k">'+doKey(it)+'</span></a>'+(b?A.bookingChip(b):'<a class="btn btn-primary btn-sm" href="#/improvements/'+it.s.k+'">Book</a>')+'</li>'; }).join('')+'</ol>':'<p class="muted">Nothing recommended right now: every rule is met.</p>')
      + (P.potential!=null?'<p class="ov-fine">With the recommended items done, the score could reach <b>'+P.potential+'</b> (estimate'+(extra.length?', '+extra.join(', '):'')+'). At the eco standards it would be '+P.target+'.</p>':'')+'<a class="ov-more" href="#/roadmap">Your roadmap <span aria-hidden="true">→</span></a></section>'; }

  // 5. all ten categories, compact
  var cats='<section class="panel ov-cats"><div class="ov-h"><div><h2 class="sec-t">All ten categories</h2><p class="sec-s">Scores out of 100, from '+(r.n<12?'the '+span(r)+' of figures so far':'rolling 12-month figures')+'. Change is against the same month last year.</p></div></div><div class="ov-cat-l">'
    + D.CATEGORIES.map(function(c){ var v=m.scores[c.k];
      return '<a class="ov-cat-r" href="#/category/'+c.k+'?m='+month+'"><span class="nm">'+esc(c.name)+(m.prov[c.k]?' <span class="prov" data-tip="Provisional until 12 months of data">P</span>':'')+'</span>'
        + (v==null?'<span class="na">Not reported</span>':'<span class="tr"><i style="width:'+clamp(v,1,100)+'%"></i></span><span class="v">'+Math.round(v)+'</span><span class="d">'+A.delta(m.cat_yoy[c.k])+'</span>')+'</a>'; }).join('')+'</div></section>';

  return A.shell('dashboard', head + A.banner(o) + heroRoad(S,i,o) + scaleFacts(S,i,o) + srcP + levP + chP + tenParts(S,i,o));
};

/* ------------------------------------------------------------------ category pages */
/* per-field 12-month figure: flows sum; registers, quarterly and percentages take the latest value */
function fieldFigure(S, i, f){
  var w=win(S,i), flow=f.freq!=='S' && f.kind!=='percent' && !STATE.test(f.id);
  var val=function(x){ var v=(x.values||{})[f.id]; return v===undefined||v===''?null:+v; };
  var have=w.filter(function(x){ return val(x)!=null && isFinite(val(x)); });
  if(!have.length) return null;
  var last=have[have.length-1], now=val(S.months[i]);
  if(flow){ var tot=sum(have,val), b=baseSum(S,w,function(x){ return +(x.values||{})[f.id]||0; }); return {month:now, r12:tot, base:b>0?b:null, ch:pctChg(tot,b), latest:false}; }
  return {month:now, r12:val(last), base:null, ch:null, latest:true, asAt:last.month};
}
var UNITS_T = {mattress_n:'mattress', tyres_n:'tyre', whitegoods_n:'whitegood', pallets_n:'pallet', oil_l:'oil_l'};
function wasteStreams(S,i){
  var w=win(S,i), U=E.FACTORS.unit, rows=[];
  D.FIELDS.filter(function(f){ return f.cat==='waste' && f.type==='input' && f.id!=='waste_total_t' && f.id!=='contam_pct'; }).forEach(function(f){
    var t=sum(w,function(x){ var v=pos((x.values||{})[f.id]); if(f.unit==='kg') return v/1000; if(UNITS_T[f.id]) return v*U[UNITS_T[f.id]]; if(f.unit==='t') return v; return 0; });
    if(t>0) rows.push({id:f.id, name:f.name.replace(/ recovered$| reused or recovered$| recovered or reused$/,''), t:t, landfill:f.id==='landfill_t', treated:f.id==='clinical_t'||f.id==='sharps_kg', units:UNITS_T[f.id]?sum(w,function(x){ return pos((x.values||{})[f.id]); }):null, unitName:f.unit});
  });
  return rows.sort(function(a,b){ return (b.landfill-a.landfill) || (b.t-a.t); });
}
function streamList(rows){
  var max=Math.max.apply(null,rows.map(function(r){ return r.t; }).concat([1])), tot=sum(rows,function(r){ return r.t; });
  var show=rows.slice(0,12), rest=rows.slice(12), restT=sum(rest,function(r){ return r.t; });
  if(rest.length) show.push({name:rest.length+' smaller streams', t:restT, other:true});
  return '<div class="ov-src ov-str">'+show.map(function(r){ var col=r.landfill?C.rest:r.treated?C.ink:C.good;
    return '<div class="ov-src-r" data-tip="'+esc(r.name+': '+sig(r.t)+' t'+(r.units?' ('+fmt(r.units,0)+' '+r.unitName+')':'')+', '+fmt(r.t/tot*100,1)+'% of all waste')+'"><span class="nm">'+esc(r.name)+(r.landfill?'<span class="sc">landfill</span>':r.treated?'<span class="sc">treated</span>':'')+'</span><span class="tr"><i style="width:'+clamp(r.t/max*100,1.2,100)+'%;background:'+col+'"></i></span><span class="vl"><b>'+sig(r.t)+'</b> t<span class="sh">'+fmt(r.t/tot*100,r.t/tot*100<1?1:0)+'%</span></span></div>'; }).join('')+'</div>';
}
function tile(label, value, unit, sub){ return '<div class="ov-tile"><p class="ov-l">'+esc(label)+'</p><div class="v">'+value+(unit?'<span class="u">'+esc(unit)+'</span>':'')+'</div>'+(sub?'<p class="ov-s">'+sub+'</p>':'')+'</div>'; }
var CUR_INBASE=false, CUR_SPAN='12 months';
function cap(t){ return t.charAt(0).toUpperCase()+t.slice(1); }
function vs(ch, lowerBetter){ return CUR_INBASE?'<span class="muted">Baseline year</span>':ch==null?'':arrow(ch,lowerBetter)+' on the baseline months'; }

V.category = function(cat, q, api){
  A=api; E=api.E; D=api.D; R=api.R; tip();
  var o=A.org(), S=A.seriesOf(o), m=A.monthOf(S,q.m), c=D.CAT[cat]; if(!c||!m) return null;
  var i=A.idxOf(S,m.month), r=m.r12, T=S.targets, w=win(S,i), month=m.month, BM=A.benchFor(o.profile)||{}, ml=function(x){ return A.mShort(x.month); };
  CUR_INBASE=inBaseYear(S,i); CUR_SPAN=span(r);
  var v=m.scores[cat], how=(E.SCORE_METHOD.filter(function(x){ return x.k===cat; })[0]||{}).how||'';
  var head='<div class="pg-head"><div><p class="kicker"><a class="link" href="#/dashboard?m='+month+'">Overview</a> · '+A.mLabel(month)+'</p><h1>'+esc(c.name).replace(/ (\S+)$/,'\u00a0$1')+'</h1><p class="pg-sub">'+esc(c.what||'')+'</p></div>'
    + '<div class="pg-actions"><label class="vh" for="cm">Month</label><select id="cm" data-act="cat-month" data-cat="'+cat+'">'+S.months.slice().reverse().map(function(x){ return '<option value="'+x.month+'"'+(x.month===month?' selected':'')+'>'+A.mLabel(x.month)+(x.status!=='verified'?' · provisional':'')+'</option>'; }).join('')+'</select></div></div>';
  var scoreP='<section class="panel-dark ov-cscore">'+A.ring(v==null?null:Math.round(v),120)+'<div><p class="ov-l">'+esc(c.short)+' score</p><div class="band">'+(v==null?'Not reported':esc(E.band(v)))+'</div><div class="yoy">'+(m.cat_yoy[cat]!=null?A.delta(m.cat_yoy[cat])+' <span class="muted">on a year ago</span>':'<span class="muted">Change after 12 months</span>')+'</div></div>'
    + (how?'<p class="how"><b>How it is scored.</b> '+esc(how)+(['land','nature','community'].indexOf(cat)>=0?' Targets for this category are agreed with Yarta at onboarding.':'')+'</p>':'')+'</section>';
  var tiles='', main='', extra='';
  var sc=function(k,lb){ return pctChg(r[k], r.base[k]); };
  if(cat==='energy'){ var gas=sum(w,function(x){ return x.gas_gj; }), gasB=baseSum(S,w,function(x){ return x.gas_gj; });
    tiles=tile('Renewable share', r.renew_pct==null?'—':fmt(r.renew_pct,1)+'%','', (num(T.target_renewable)>E.STANDARDS.renewable?'Your target '+fmt(T.target_renewable,0):'Standard '+E.STANDARDS.renewable)+'% by 2030'+(BM.renewable?' · industry '+fmt(BM.renewable.v,0)+'%':''))
      + tile('Grid electricity', fmt(r.grid_kwh/1000,0),'MWh', vs(sc('grid_kwh'),true))
      + tile('Gas', fmt(gas,0),'GJ', vs(pctChg(gas,gasB),true))
      + tile('Per employee', fmt(r.grid_kwh/Math.max(1,num(o.profile.employees)),0),'kWh', 'Grid electricity over '+span(r)+' ÷ '+fmt(o.profile.employees,0)+' FTE');
    main=chartPanel('Electricity by month','Renewable includes GreenPower and power purchase agreements, and solar used on site.', columns(w.map(function(x){ var all=pos(x.elec_all_kwh), rn=Math.min(all,pos(x.renew_kwh)); return {label:ml(x), parts:[(all-rn)/1000, rn/1000]}; }),{names:['Not renewable','Renewable'],colors:[C.rest,C.good],unit:'MWh',label:'Electricity by month',w:880,h:230,labelEvery:1}), [['Not renewable',C.rest],['Renewable',C.good]])
      + '<section class="panel"><h2 class="sec-t">Against the standard</h2>'+bullet(r.renew_pct, Math.max(num(T.target_renewable),E.STANDARDS.renewable), BM.renewable, {what:'Renewable electricity',tName:tLab(T.target_renewable,E.STANDARDS.renewable)})+(BM.renewable?'<p class="ov-fine">Industry: '+esc(BM.renewable.label)+'.'+(BM.renewable.note?' '+esc(BM.renewable.note):'')+'</p>':'')+'</section>';
  } else if(cat==='fleet'){ var vv=m.values||{}, ev=evCount(vv);
    tiles=tile('Electric share', m.fleet_ev_pct==null?'—':fmt(m.fleet_ev_pct,1)+'%','', 'Your target '+fmt(T.target_fleet_ev,0)+'%'+(BM.fleet?' · industry '+fmt(BM.fleet.v,0)+'%':''))
      + tile('Fuel', fmt(r.fuel_l/1000,0),'kL', vs(sc('fuel_l'),true))
      + tile('Vehicles', fmt(m.fleet_n,0),'', fmt(pos(vv.veh_bev)+pos(vv.trucks_electric),0)+' battery electric · '+fmt(pos(vv.veh_phev),0)+' plug-in hybrid')
      + tile('Fuel per 100 km', m.fleet_eff==null?'—':fmt(m.fleet_eff,1),'L', 'Across the fleet, '+A.mLabel(month));
    var fl=[['Battery electric',pos(vv.veh_bev)+pos(vv.trucks_electric),C.good],['Plug-in hybrid',pos(vv.veh_phev),C.s3],['Hybrid',pos(vv.veh_hybrid),'#A7ACAF'],['Petrol',pos(vv.veh_petrol),'#7C8184'],['Diesel',pos(vv.veh_diesel)+pos(vv.trucks_diesel),C.rest]].filter(function(x){ return x[1]>0; }), fn=sum(fl,function(x){ return x[1]; })||1;
    var hasBio=sum(w,function(x){ return (x.values||{}).biodiesel_l; })>0;
    main=chartPanel('Fuel by month','Kilolitres bought, from fuel cards and invoices. Hover a column for the split by fuel.', columns(w.map(function(x){ var v2=x.values||{}, d=pos(v2.diesel_l), pe=pos(v2.petrol_l), lp=pos(v2.lpg_l), bi=pos(v2.biodiesel_l);
        return {label:ml(x), parts:[(d+pe+lp)/1000, bi/1000], tip:A.mLabel(x.month)+' · diesel '+sig(d/1000)+' kL · petrol '+sig(pe/1000)+' kL'+(lp?' · LPG '+sig(lp/1000)+' kL':'')+(bi?' · biodiesel '+sig(bi/1000)+' kL':'')}; }),{names:['Diesel, petrol and LPG','Biodiesel'],colors:[C.rest,C.good],unit:'kL',label:'Fuel by month, kL',w:880,h:230,labelEvery:1}), [['Diesel, petrol and LPG',C.rest]].concat(hasBio?[['Biodiesel and renewable diesel',C.good]]:[]))
      + '<section class="panel"><h2 class="sec-t">The fleet, '+A.mLabel(month)+'</h2><p class="sec-s">'+fmt(m.fleet_n,0)+' vehicles. Plug-in hybrids count as half electric.</p><div class="ov-comp">'+fl.map(function(x){ return '<i style="width:'+(x[1]/fn*100)+'%;background:'+x[2]+'" data-tip="'+esc(x[0]+': '+fmt(x[1],0))+'"></i>'; }).join('')+'</div><div class="ov-key">'+fl.map(function(x){ return '<span><i style="background:'+x[2]+'"></i>'+esc(x[0])+' · '+fmt(x[1],0)+'</span>'; }).join('')+'</div>'
      + '<div style="margin-top:20px">'+bullet(m.fleet_ev_pct, num(T.target_fleet_ev)||null, BM.fleet, {what:'Fleet electrification',tName:'Your target'})+'</div>'+(BM.fleet?'<p class="ov-fine">Industry: '+esc(BM.fleet.label)+'.'+(BM.fleet.note?' '+esc(BM.fleet.note):'')+'</p>':'')+'</section>';
    void ev;
  } else if(cat==='carbon'){ var st=onTrack(S,i,T);
    tiles=tile('Total', fmt(r.total_t,0),'t CO₂-e', vs(sc('total_t'),true))
      + tile('Scope 1', fmt(r.scope1_t,0),'t', vs(sc('scope1_t'),true)+' · fuel and gas burned')
      + tile('Scope 2', fmt(r.scope2_t,0),'t', vs(sc('scope2_t'),true)+' · electricity')
      + tile('Scope 3', fmt(r.scope3_t,0),'t', vs(sc('scope3_t'),true)+' · landfill and supply chain');
    main='<section class="panel ov-emis"><div class="ov-emis-h"><div><h2 class="sec-t">Against the path to your target</h2><p class="sec-s">% change on the same months of '+esc(S.baseline.fy)+'. Your target: −'+fmt(T.target_emissions,0)+'% by 2030.</p></div>'+(st&&!st.inBase?'<span class="ov-pill '+(st.state==='on'?'good':st.state==='behind'?'bad':'')+'">'+(st.state==='on'?'On track':st.state==='close'?'Just behind':'Behind the path')+'</span>':'')+'</div><div class="ov-traj-w">'+trajectory(S,i,T,{w:880,h:280})+'</div><div class="ov-key"><span><i class="ln"></i>Your emissions</span><span><i class="ln dash"></i>Straight-line path to your target</span></div></section>'
      + chartPanel('Emissions by month, by scope','Tonnes CO₂‑e. Scope 3 covers waste to landfill and the supply chain of your fuel and electricity.', columns(w.map(function(x){ return {label:ml(x), parts:[x.scope1_t, x.scope2_t, x.scope3_t]}; }),{names:['Scope 1','Scope 2','Scope 3'],colors:[C.s1,C.s2,C.s3],unit:'t',label:'Emissions by month',w:880,h:230,labelEvery:1}), [['Scope 1',C.s1],['Scope 2',C.s2],['Scope 3',C.s3]])
      + '<section class="panel ov-srcp"><h2 class="sec-t">By source</h2><p class="sec-s">'+(CUR_INBASE?esc(cap(span(r)))+', your baseline year.':'Rolling 12 months. The arrow is the change on the baseline months.')+'</p>'+sourceList(sources(S,i),{m:month,inB:CUR_INBASE})+'<p class="ov-fine">Per resident: '+(num(o.profile.residents)>0?fmt(r.total_t*1000/num(o.profile.residents),0)+' kg':'—')+' · per employee: '+fmt(r.total_t/Math.max(1,num(o.profile.employees)),1)+' t. Avoided emissions from recycling (separate, never deducted): '+nu(r.avoided_t,'t')+'. Factors: '+esc(E.FACTORS.edition)+'.</p></section>';
  } else if(cat==='water'){ var alt=sum(w,function(x){ var v2=x.raw||{}; return pos(v2.recycled_kl)+pos(v2.rain_kl)+pos(v2.storm_kl)+pos(v2.waste_water_kl); });
    tiles=tile('Drinking water', fmt(r.potable_kl,0),'kL', vs(sc('potable_kl'),true))
      + tile('Alternative water', fmt(alt,0),'kL', (r.alt_water_pct==null?'—':fmt(r.alt_water_pct,1)+'%')+' of all water used')
      + tile('Per employee', fmt(r.potable_kl/Math.max(1,num(o.profile.employees)),1),'kL', 'Drinking water over '+span(r))
      + (num(o.profile.residents)>0?tile('Per resident', fmt(r.potable_kl*1000/num(o.profile.residents),0),'L', 'Council operations only'):'');
    main=chartPanel('Water by month','Kilolitres. Alternative water is rain, stormwater and recycled water.', columns(w.map(function(x){ var v2=x.raw||{}; return {label:ml(x), parts:[pos(v2.potable_kl), pos(v2.recycled_kl)+pos(v2.rain_kl)+pos(v2.storm_kl)+pos(v2.waste_water_kl)]}; }),{names:['Drinking water','Alternative water'],colors:[C.rest,C.good],unit:'kL',label:'Water by month',w:880,h:230,labelEvery:1}), [['Drinking water',C.rest],['Alternative water',C.good]]);
  } else if(cat==='waste'){ var streams=wasteStreams(S,i), recT=r.waste_total_t-r.landfill_t;
    tiles=tile('Kept out of landfill', r.diversion_pct==null?'—':fmt(r.diversion_pct,1)+'%','', (num(T.target_diversion)>E.STANDARDS.diversion?'Your target '+fmt(T.target_diversion,0):'Standard '+E.STANDARDS.diversion)+'% by 2030'+(BM.diversion?' · industry '+fmt(BM.diversion.v,0)+'%':''))
      + tile('All waste', fmt(r.waste_total_t,0),'t', vs(sc('waste_total_t'),true)+(num(o.profile.residents)>0?' · '+nu(r.waste_total_t*1000/num(o.profile.residents),'kg')+' per resident':''))
      + tile('To landfill', fmt(r.landfill_t,0),'t', vs(sc('landfill_t'),true))
      + tile('Recovered or treated', fmt(recT,0),'t', 'Recovery rate '+(r.recovery_pct==null?'—':fmt(r.recovery_pct,1)+'%')+(r.treated_t>0?' · '+fmt(r.treated_t,0)+' t treated':''));
    main='<section class="panel"><div class="ov-h"><div><h2 class="sec-t">Where your waste goes</h2><p class="sec-s">Tonnes over the last '+span(r)+', by stream. Counted items (mattresses, tyres, whitegoods) are converted at the published unit weights.</p></div></div>'+streamList(streams)+'<div class="ov-key"><span><i style="background:'+C.rest+'"></i>To landfill</span><span><i style="background:'+C.good+'"></i>Recovered</span>'+(streams.some(function(x){ return x.treated; })?'<span><i style="background:'+C.ink+'"></i>Treated</span>':'')+'</div></section>'
      + chartPanel('Waste by month','Tonnes.', columns(w.map(function(x){ return {label:ml(x), parts:[pos(x.landfill_t), pos(x.waste_total_t)-pos(x.landfill_t)]}; }),{names:['To landfill','Recovered or treated'],colors:[C.rest,C.good],unit:'t',label:'Waste by month',w:880,h:230,labelEvery:1}), [['To landfill',C.rest],['Recovered or treated',C.good]])
      + '<section class="panel"><h2 class="sec-t">Against the standard</h2>'+bullet(r.diversion_pct, Math.max(num(T.target_diversion),E.STANDARDS.diversion), BM.diversion, {what:'Landfill diversion',tName:tLab(T.target_diversion,E.STANDARDS.diversion)})+(BM.diversion?'<p class="ov-fine">Industry: '+esc(BM.diversion.label)+'.</p>':'')+'<p class="ov-fine">Avoided emissions from recycling (separate, never deducted): <b>'+nu(r.avoided_t,'t CO₂-e')+'</b> over 12 months, modelled.</p></section>';
  } else if(cat==='circular'){
    var Q=quarters(S,month,['proc_total','proc_recycled','proc_local'],4).filter(function(q){ return q.any; }), lastQ=Q[Q.length-1];
    var p12=sum(w,function(x){ return (x.raw||{}).proc_local; }), stew=pos((m.values||{}).stewardship);
    tiles=tile('Recycled-content buying', r.proc_recycled_pct==null?'—':fmt(r.proc_recycled_pct,1)+'%','', 'Of procurement spend over '+span(r)+' · 30% scores full marks')
      + tile('Reuse rate', r.reuse_pct==null?'—':fmt(r.reuse_pct,r.reuse_pct<1?2:1)+'%','', 'Furniture and items reused, of all waste · 10% scores full marks')
      + (r.proc_total>0&&p12>0?tile('Spent locally', fmt(p12/r.proc_total*100,0)+'%','', money(p12)+' of '+money(r.proc_total)+' over '+span(r)):'')
      + tile('Stewardship programs', fmt(stew,0),'', 'Product stewardship or take-back · three or more scores full marks');
    if(Q.length){ main=chartPanel('Procurement spend by quarter','Recycled-content buying against everything else bought, from your finance system.', columns(Q.map(function(q){ var t=q.sums[0], rc=Math.min(t,q.sums[1]); return {label:q.label, parts:[t-rc, rc], tip:q.label+' · recycled content '+money(rc)+' of '+money(t)+(t>0?' ('+fmt(rc/t*100,1)+'%)':'')}; }),{names:['Everything else','Recycled content'],colors:[C.rest,C.good],label:'Procurement spend by quarter',w:880,h:230,labelEvery:1,maxBar:40,axisFmt:money}), [['Everything else',C.rest],['Recycled content',C.good]], 'Last 4 quarters'); }
  } else if(cat==='land'){
    var Q2=quarters(S,month,['rehab_ha','remediated_ha','soil_rehab_t','remediated_t'],4).filter(function(q){ return q.any; });
    var soil=sum(w,function(x){ return (x.raw||{}).soil_rehab_t; }), trt=sum(w,function(x){ return (x.raw||{}).remediated_t; });
    tiles=tile('Rehabilitated or remediated', fmt(r.rehab_ha,1),'ha', 'Over '+span(r)+' · agreed target '+fmt(T.target_rehab_ha,0)+' ha a year')
      + tile('Soil reused', fmt(soil,0),'t', 'In rehabilitation, over '+span(r))
      + (trt>0?tile('Contaminated material treated', fmt(trt,0),'t', 'Over '+span(r)):'');
    main='<section class="panel"><h2 class="sec-t">Against the agreed target</h2><p class="sec-s">Land is scored against the annual target agreed with Yarta at onboarding.</p>'+progress([{name:'Land rehabilitated or remediated', actual:r.rehab_ha, target:num(T.target_rehab_ha), unit:'ha', fmt:function(v){ return fmt(v,1); }}])+'</section>'
      + (Q2.length?chartPanel('Hectares rehabilitated or remediated, by quarter','From project and EPA records.', columns(Q2.map(function(q){ return {label:q.label, parts:[q.sums[0]+q.sums[1]], tip:q.label+' · rehabilitated '+sig(q.sums[0])+' ha · remediated '+sig(q.sums[1])+' ha'}; }),{names:['Hectares'],colors:[C.good],unit:'ha',label:'Hectares by quarter',w:880,h:230,labelEvery:1,maxBar:40}), null, 'Last 4 quarters'):'');
  } else if(cat==='nature'){
    var Q3=quarters(S,month,['native_veg_ha','habitat_ha','wetland_ha'],4).filter(function(q){ return q.any; });
    tiles=tile('Trees planted', fmt(r.trees,0),'', 'Over '+span(r)+' · agreed target '+fmt(T.target_trees,0)+' a year')
      + tile('Native vegetation, habitat and wetland', fmt(r.native_ha,1),'ha', 'Restored over '+span(r)+' · agreed target '+fmt(T.target_native_ha,0)+' ha');
    main='<section class="panel"><h2 class="sec-t">Against the agreed targets</h2><p class="sec-s">Nature is scored against the annual targets agreed with Yarta at onboarding, half each.</p>'+progress([
        {name:'Trees planted', actual:r.trees, target:num(T.target_trees), unit:'trees', fmt:function(v){ return fmt(v,0); }},
        {name:'Native vegetation, habitat and wetland restored', actual:r.native_ha, target:num(T.target_native_ha), unit:'ha', fmt:function(v){ return fmt(v,1); }}])+'</section>'
      + chartPanel('Trees planted by month','From planting records.', columns(w.map(function(x){ return {label:ml(x), parts:[pos((x.raw||{}).trees)]}; }),{names:['Trees'],colors:[C.good],unit:'trees',label:'Trees planted by month',w:880,h:220,labelEvery:1}), null)
      + (Q3.length?chartPanel('Hectares restored by quarter','Native vegetation, habitat and wetland, from project records.', columns(Q3.map(function(q){ return {label:q.label, parts:[q.sums[0]+q.sums[1]+q.sums[2]], tip:q.label+' · native vegetation '+sig(q.sums[0])+' ha · habitat '+sig(q.sums[1])+' ha · wetland '+sig(q.sums[2])+' ha'}; }),{names:['Hectares'],colors:[C.good],unit:'ha',label:'Hectares restored by quarter',w:880,h:220,labelEvery:1,maxBar:40}), null, 'Last 4 quarters'):'');
  } else if(cat==='community'){
    var evn=sum(w,function(x){ return (x.raw||{}).events; });
    tiles=tile('Program participants', fmt(r.participants,0),'', 'Over '+span(r)+' · agreed target '+fmt(T.target_participants,0)+' a year')
      + tile('Events and programs', fmt(evn,0),'', 'Education and community events over '+span(r)+(evn>0?' · '+fmt(r.participants/evn,0)+' people each on average':''));
    main='<section class="panel"><h2 class="sec-t">Against the agreed target</h2><p class="sec-s">Community is scored against the annual target agreed with Yarta at onboarding.</p>'+progress([{name:'Program participants', actual:r.participants, target:num(T.target_participants), unit:'people', fmt:function(v){ return fmt(v,0); }}])+'</section>'
      + chartPanel('Participants by month','People at environmental education and community events, from event registrations.', columns(w.map(function(x){ return {label:ml(x), parts:[pos((x.raw||{}).participants)]}; }),{names:['Participants'],colors:[C.good],unit:'people',label:'Participants by month',w:880,h:220,labelEvery:1}), null);
  } else if(cat==='governance'){
    var cf=confidence(o,m), inv=sum(w,function(x){ return (x.raw||{}).env_invest; }), prj=sum(w,function(x){ return (x.raw||{}).improve_projects; });
    tiles=tile('Data confidence', cf.g,'', esc(cf.why))
      + tile('Complaints and incidents closed', fmt(r.closure_pct,0)+'%','', fmt(r.closed,0)+' of '+fmt(r.complaints,0)+' over '+span(r))
      + (inv>0?tile('Environmental investment', money(inv),'', 'Over '+span(r)+', from your finance system'):'')
      + (prj>0?tile('Improvement projects completed', fmt(prj,0),'', 'Over '+span(r)):'');
  }
  var scoreHist=S.months.slice(Math.max(0,i-23),i+1).map(function(x){ return {label:A.mShort(x.month), v:x.scores[cat]==null?null:Math.round(x.scores[cat]), prov:x.status!=='verified'}; });
  var hist='<section class="panel"><h2 class="sec-t">'+esc(c.short)+' score by month</h2><p class="sec-s">Out of 100, from rolling 12-month figures.</p>'+line(scoreHist,{label:c.short+' score by month'})+'</section>';
  return A.shell('category', head + '<div class="ov-cat-top">'+scoreP+'<div class="ov-tiles">'+tiles+'</div></div>' + main + extra + hist + figuresTable(S,i,cat));
};
function chartPanel(title, sub, svg, key, note){ return '<section class="panel"><h2 class="sec-t">'+esc(title)+'</h2>'+(sub?'<p class="sec-s">'+esc(sub)+'</p>':'')+'<div class="ov-big">'+svg+'</div><div class="ov-key">'+(key&&key.length>1?key.map(function(k){ return '<span><i style="background:'+k[1]+'"></i>'+esc(k[0])+'</span>'; }).join(''):'')+'<span class="r">'+esc(note||('Last '+CUR_SPAN))+' · hover a column for its figures</span></div></section>'; }

/* the figures, as a customer reads them: names, this month, 12 months, against the baseline. No codes, no empty rows. */
function figuresTable(S,i,cat){
  var rows=[], calc=[], M=A.mShort(S.months[i].month), N=cap(CUR_SPAN);
  D.FIELDS.filter(function(f){ return f.cat===cat; }).forEach(function(f){
    if(f.type==='calc'){ return; }
    var fg=fieldFigure(S,i,f); if(!fg) return;
    var u=f.kind==='currency'?'':(f.unit||'');
    rows.push('<tr><td>'+esc(f.name)+'<div class="fs">'+esc(f.src||'')+'</div></td><td class="num" data-l="'+esc(M)+'">'+fval(f,fg.month)+(fg.month==null||!u?'':'<span class="pu"> '+esc(u)+'</span>')+'</td><td class="num" data-l="'+esc(fg.latest?'Latest':N)+'">'+fval(f,fg.r12)+(fg.r12==null||!u?'':'<span class="pu"> '+esc(u)+'</span>')+(fg.latest&&fg.asAt?'<div class="fs">as at '+A.mShort(fg.asAt)+'</div>':'')+'</td><td class="un">'+esc(u)+'</td>'+(CUR_INBASE?'':'<td class="num" data-l="vs baseline">'+chgCell(f,fg.ch)+'</td>')+'</tr>');
  });
  D.FIELDS.filter(function(f){ return f.cat===cat && f.type==='calc'; }).forEach(function(f){
    var mv=S.months[i][f.id]; if(mv==null || !isFinite(mv)) return;
    calc.push('<tr><td>'+esc(f.name)+'<div class="fs">'+esc(f.calc||'')+'</div></td><td class="num" data-l="'+esc(M)+'">'+sig(mv)+'<span class="pu"> '+esc(f.unit||'')+'</span></td><td class="un">'+esc(f.unit||'')+'</td></tr>');
  });
  if(!rows.length && !calc.length) return '';
  return '<section class="panel ov-fig"><h2 class="sec-t">The figures</h2><p class="sec-s">From your documents, entered and verified by Yarta. '+esc(cap(CUR_SPAN))+' is a total for monthly figures and the latest value for registers.'+(CUR_INBASE?' Changes against the baseline year show once it ends.':' The arrow compares that total with the same months of the baseline year.')+'</p>'
    + (rows.length?'<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Figure</th><th class="num">'+esc(M)+'</th><th class="num">'+esc(cap(CUR_SPAN))+'</th><th>Unit</th>'+(CUR_INBASE?'':'<th class="num">vs baseline</th>')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>':'')
    + (calc.length?'<h3 class="ov-sub">Calculated by Yarta, '+esc(M)+'</h3><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Figure and how it is calculated</th><th class="num">Value</th><th>Unit</th></tr></thead><tbody>'+calc.join('')+'</tbody></table></div>':'')
    + '</section>';
}
function fval(f, v){ if(v==null || !isFinite(v)) return '—'; if(f.kind==='count') return fmt(v,0); if(f.kind==='currency') return '$'+fmt(v,0); if(f.kind==='percent') return fmt(v,1); return sig(v); }
/* which way is good for each figure; recovered streams and activity measures are neutral */
/* quarterly figures that describe a state at the quarter's end, not an amount in it */
var STATE=/^(habitat_projects|monitoring_sites|monitoring_species)$/;
var LOWER=/^(diesel_l|petrol_l|lpg_l|idle_hours|flights_dom|flights_int|grid_kwh|gas_gj|peak_kw|street_kwh|potable_kl|ground_kl|waste_total_t|landfill_t|clinical_t|sharps_kg|contam_pct|complaints|veh_diesel|veh_petrol|trucks_diesel)$/;
var NEUTRAL=/^(veh_retired|fleet_km|solar_exp_kwh|proc_total|complaints_closed|plant_count|recycling_t|organics_t|green_t|food_t|paper_t|glass_t|steel_t|alu_t|timber_t|timber_treated_t|concrete_t|rubble_t|soil_t|plaster_t|mattress_n|tyres_n|ewaste_t|whitegoods_n|batteries_kg|textiles_t|film_t|pallets_n|oil_l|problem_kg)$/;
function chgCell(f, ch){ if(ch==null) return '<span class="muted">—</span>'; if(NEUTRAL.test(f.id)){ var a=Math.abs(ch); return '<span class="delta flat" title="Neither better nor worse on its own">'+(ch>0.5?'▲':ch<-0.5?'▼':'■')+' '+(a<0.05?'0.0':(ch>0?'+':'−')+fmt(a,a<10?1:0))+'%</span>'; } return arrow(ch, LOWER.test(f.id)); }
})();
