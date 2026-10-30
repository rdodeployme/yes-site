/* Reporting Readiness Check
   Scores how ready an organisation is to report from the records it already holds, shows the result
   on the page, and (when the live backend is configured) saves the answers as a lead for Yarta.
   The lead is written with a single Firestore REST call: no SDK, no sign-in. backend/firestore.rules
   (validLead) accepts exactly these fields and nothing else; nobody outside Yarta can read one back. */
(function(){
'use strict';
var form=document.getElementById('rc-form'); if(!form) return;
var $=function(s,r){ return (r||document).querySelector(s); }, $$=function(s,r){ return [].slice.call((r||document).querySelectorAll(s)); };
var esc=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
var logo=document.querySelector('a.logo'); var BASE=((logo&&logo.getAttribute('href'))||'/').replace(/\/$/,'');
var url=function(p){ return BASE+p; };
var ARROW='<svg class="arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* The records Yarta works from. Core records carry twice the weight: they drive most of a first report. */
var RECORDS=[
  {k:'electricity', name:'Electricity bills', hint:'From your energy retailer, for every site', w:2, todo:'Ask your retailer for invoices or an account export covering every site.'},
  {k:'gas', name:'Gas bills', hint:'Only if a site uses gas', w:1, todo:'Gas retailer invoices for the sites that use gas.'},
  {k:'water', name:'Water bills', hint:'From your water utility, for every site', w:2, todo:'Water utility bills for every site; most utilities email them.'},
  {k:'waste', name:'Waste and recycling reports', hint:'From your waste contractor, ideally tonnes by stream', w:2, todo:'Ask your waste contractor for a monthly report in tonnes by stream, not just invoices.'},
  {k:'kerbside', name:'Kerbside collection data', hint:'Monthly tonnes from your collection contractor', w:2, only:'council', todo:'Your kerbside contractor’s monthly tonnage report, by bin.'},
  {k:'fuel', name:'Fuel purchases', hint:'Fuel card statements or fuel invoices for vehicles and plant', w:2, todo:'Fuel card statements from your card provider, or fuel invoices.'},
  {k:'vehicles', name:'Vehicle and plant list', hint:'Each vehicle’s type, fuel, and whether it is electric', w:2, todo:'A simple list from your fleet or asset register: vehicle, fuel type, electric or not.'},
  {k:'solar', name:'Solar generation', hint:'From the inverter or monitoring portal, if you have panels', w:1, todo:'Generation figures from your inverter or monitoring portal.'},
  {k:'travel', name:'Flights and travel', hint:'From your booking agency or card statements', w:1, todo:'A trip report from your travel agency, or card statements.'},
  {k:'procurement', name:'Purchasing data', hint:'Spend by supplier from your finance system', w:1, todo:'A spend-by-supplier report from your finance system, once a quarter.'}
];
var VAL={monthly:1, patchy:.5, unsure:.25, no:0};
var OPTS=[['monthly','Monthly'],['patchy','Patchy'],['no','No'],['unsure','Not sure'],['na','N/A']];

function sector(){ return (form.sector.value||''); }
function rows(){ var s=sector(); return RECORDS.filter(function(r){ return !r.only || r.only===s; }); }
function drawRecords(){
  var keep={}; $$('#rc-records input:checked').forEach(function(i){ keep[i.name.slice(4)]=i.value; });
  $('#rc-records').innerHTML=rows().map(function(r){
    return '<div class="rc-rec" data-rec="'+r.k+'"><div><p class="t">'+esc(r.name)+(r.w>1?'<span class="core">core</span>':'')+'</p><p class="h">'+esc(r.hint)+'</p></div>'
      + '<div class="seg" role="radiogroup" aria-label="'+esc(r.name)+'">'+OPTS.map(function(o){ return '<label><input type="radio" name="rec-'+r.k+'" value="'+o[0]+'"'+(keep[r.k]===o[0]?' checked':'')+'><span>'+o[1]+'</span></label>'; }).join('')+'</div></div>';
  }).join('');
}
function answers(){
  var g=function(n){ var el=form.querySelector('input[name="'+n+'"]:checked'); return el?el.value:''; };
  var recs={}; rows().forEach(function(r){ var v=g('rec-'+r.k); if(v) recs[r.k]=v; });
  return {
    org_name:(form.org_name.value||'').trim(), sector:sector(), state:form.state.value||'',
    employees:g('employees'), residents:sector()==='council'?g('residents'):'', sites:g('sites'),
    drivers:$$('input[name="drivers"]:checked',form).map(function(i){ return i.value; }),
    group:sector()==='council'?'':g('group'), timeline:g('timeline'), records:recs,
    approach:g('approach'), holder:g('holder'), baseline:g('baseline'),
    contact_name:(form.contact_name.value||'').trim(), contact_role:(form.contact_role.value||'').trim(),
    email:(form.email.value||'').trim().toLowerCase(), phone:(form.phone.value||'').trim(), notes:(form.notes.value||'').trim(),
    consent:!!form.consent.checked
  };
}
function score(recs){
  var num=0, den=0, n=0;
  rows().forEach(function(r){ var v=recs[r.k]; if(!v||v==='na') return; n++; den+=r.w; num+=r.w*(VAL[v]||0); });
  if(!den) return {pct:null, n:n};
  return {pct:Math.round(num/den*100), n:n};
}
function band(p){
  if(p==null) return {name:'Not enough answers', say:''};
  if(p>=75) return {name:'Ready to start', say:'You already hold most of what a first report needs, month by month. Onboarding is mostly Yarta entering it.'};
  if(p>=45) return {name:'Nearly ready', say:'Most of it is there. A few records need one request to a retailer or contractor before the first report.'};
  return {name:'Needs groundwork', say:'The first job is getting the records flowing. Yarta’s onboarding sets that up with you over four weeks.'};
}
function plan(a){
  var s=a.sector;
  if(s==='council'){
    if(a.residents==='50-100k'||a.residents==='100k+') return {amt:'On application', note:'Councils above 50,000 residents are priced on application.'};
    return {amt:'$1,999', unit:'a month', note:'Councils up to 50,000 residents.'};
  }
  if(s==='government'||s==='other'||!s) return {amt:'Let’s talk', note:'We price this kind of organisation with you.'};
  var t={'1-30':['$999','Up to 30 staff.'],'31-100':['$1,999','31 to 100 staff.'],'101-500':['$2,999','More than 100 staff.'],'500+':['$2,999','More than 100 staff.']}[a.employees];
  if(!t) return {amt:'From $999', unit:'a month', note:'Priced by staff numbers.'};
  return {amt:t[0], unit:'a month', note:t[1]};
}

/* live summary in the side panel */
function stepsDone(a){
  var d={1:!!(a.org_name&&a.sector), 2:!!(a.drivers.length||a.timeline), 3:rows().every(function(r){ return a.records[r.k]; }), 4:!!(a.approach||a.holder||a.baseline), 5:!!(a.contact_name&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email)&&a.consent)};
  return d;
}
function refresh(){
  var a=answers(), s=score(a.records), b=band(s.pct), d=stepsDone(a);
  $('#rc-score').innerHTML=s.pct==null?'<span class="na">Not started</span>':s.pct+'<small>%</small>';
  $('#rc-band').textContent=s.pct==null?'Answer step 3 to see it move.':b.name;
  $('#rc-bar').style.width=(s.pct||0)+'%';
  $$('#rc-progress li').forEach(function(li){ li.classList.toggle('done', !!d[li.getAttribute('data-p')]); });
}
function sectorChanged(){
  var council=sector()==='council';
  $$('[data-only="council"]').forEach(function(el){ el.hidden=!council; });
  $$('[data-not="council"]').forEach(function(el){ el.hidden=council; });
  drawRecords(); refresh();
}
form.addEventListener('change', function(e){ if(e.target.name==='sector') sectorChanged(); else { var row=e.target.closest&&e.target.closest('.rc-rec'); if(row) row.classList.remove('missing'); refresh(); } });
form.addEventListener('input', refresh);

/* ---------------------------------------------------------------- result */
function result(a, s, saved){
  var b=band(s.pct), p=plan(a);
  var have=rows().filter(function(r){ return a.records[r.k]==='monthly'; });
  var todo=rows().filter(function(r){ var v=a.records[r.k]; return v==='patchy'||v==='no'||v==='unsure'; }).sort(function(x,y){ return y.w-x.w; });
  var na=rows().filter(function(r){ return a.records[r.k]==='na'; });
  var climate=a.drivers.indexOf('climate')>=0 || ['1','2','3','unsure'].indexOf(a.group)>=0;
  var smap={government:'business',other:'business'}, ss=smap[a.sector]||a.sector, sample=['council','business','health','education','manufacturing','construction','retail','logistics'].indexOf(ss)>=0 ? '?sector='+ss : '';   // agencies and anything else use the business and offices question set
  var li=function(r,ok){ return '<li><span class="i '+(ok?'ok':'todo')+'" aria-hidden="true">'+(ok?'✓':'→')+'</span><span>'+esc(r.name)+(ok?'':'<small>'+esc(r.todo)+'</small>')+'</span></li>'; };
  return '<div class="rc-res-head"><div class="rc-ring" style="--p:'+(s.pct||0)+'"><div><span><b>'+(s.pct==null?'—':s.pct+'%')+'</b><small>records ready</small></span></div></div>'
    + '<div><p class="eyebrow">Your result</p><p class="rc-org">'+esc(a.org_name)+'</p><h2>'+esc(b.name)+'</h2><p>'+esc(b.say)+'</p></div></div>'
    + '<div class="rc-cols">'
    + '<div class="rc-card"><h3>You already hold</h3><p class="sub">Every month, for every site.</p>'+(have.length?'<ul>'+have.map(function(r){ return li(r,true); }).join('')+'</ul>':'<p class="sub">Nothing monthly yet. That is common, and it is where onboarding starts.</p>')+'</div>'
    + '<div class="rc-card"><h3>Sort these first</h3><p class="sub">Core records first. Each is usually one request.</p>'+(todo.length?'<ul>'+todo.map(function(r){ return li(r,false); }).join('')+'</ul>':'<p class="sub">Nothing. Every record you need comes in monthly.</p>')+'</div>'
    + '</div>'
    + '<div class="rc-card" style="margin-top:18px"><div class="rc-plan"><div><h3>The plan that fits</h3><p class="sub" style="margin:4px 0 0">'+esc(p.note)+' Annual subscription. The establishment fee is waived for Foundation Members who join in the first 12 months.</p></div><div class="amt">'+esc(p.amt)+(p.unit?'<small>'+esc(p.unit)+'</small>':'')+'</div></div></div>'
    + (climate?'<div class="rc-card" style="margin-top:18px"><h3>Mandatory climate reporting</h3><p class="sub" style="margin:4px 0 0">Your waste figure becomes part of Scope 3 and faces auditor review. <a class="link" href="'+url('/climate-reporting/')+'">Check your group and your first Scope 3 year</a>.</p></div>':'')
    + saved
    + '<div class="rc-next"><a class="btn btn-primary" href="'+url('/contact/')+'">Book a 30-minute walkthrough '+ARROW+'</a><a class="btn btn-ghost" href="'+url('/report/'+sample)+'">See a sample report for your sector</a><a class="btn btn-ghost" href="'+url('/checklist/')+'">What Yarta needs from you</a></div>'
    + '<p class="rc-how">How this is worked out: each record you hold monthly counts in full, patchy counts half, not sure a quarter, and core records count twice. Records marked N/A are left out'+(na.length?' ('+na.map(function(r){ return esc(r.name.toLowerCase()); }).join(', ')+')':'')+'. It measures how ready your records are, not your environmental performance.</p>';
}
function mailBody(a, s){
  var b=band(s.pct), lines=['Reporting Readiness Check','', 'Organisation: '+a.org_name, 'Type: '+a.sector+(a.state?' · '+a.state:''), 'Employees: '+(a.employees||'—')+(a.residents?' · residents '+a.residents:'')+(a.sites?' · sites '+a.sites:''), 'Why now: '+(a.drivers.join(', ')||'—'), 'Timeline: '+(a.timeline||'—'), '', 'Records ready: '+(s.pct==null?'—':s.pct+'%')+' ('+b.name+')'];
  rows().forEach(function(r){ lines.push('  '+r.name+': '+(a.records[r.k]||'—')); });
  lines.push('', 'Reporting today: '+(a.approach||'—')+' · records held by: '+(a.holder||'—')+' · baseline: '+(a.baseline||'—'), '', a.contact_name+(a.contact_role?' · '+a.contact_role:''), a.email+(a.phone?' · '+a.phone:''));
  if(a.notes) lines.push('', a.notes);
  return lines.join('\n');
}

/* ---------------------------------------------------------------- saving the lead */
function fsVal(v){
  if(v===null||v===undefined) return {nullValue:null};
  if(typeof v==='boolean') return {booleanValue:v};
  if(typeof v==='number') return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
  if(Array.isArray(v)) return {arrayValue:{values:v.map(fsVal)}};
  if(typeof v==='object'){ var f={}; for(var k in v) f[k]=fsVal(v[k]); return {mapValue:{fields:f}}; }
  return {stringValue:String(v)};
}
function saveLead(a, s){
  var C=window.YARTA_FIREBASE; if(!C||!C.projectId) return Promise.resolve(false);
  var id=''; var chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', r=new Uint8Array(20); crypto.getRandomValues(r); for(var i=0;i<20;i++) id+=chars[r[i]%chars.length];
  var lead={v:1, status:'new', source:'readiness', org_name:a.org_name, sector:a.sector, state:a.state, employees:a.employees, residents:a.residents, sites:a.sites,
    drivers:a.drivers, group:a.group, timeline:a.timeline, records:a.records, holder:a.holder, approach:a.approach, baseline:a.baseline,
    contact_name:a.contact_name, contact_role:a.contact_role, email:a.email, phone:a.phone, consent:true,
    score:s.pct==null?0:s.pct, band:band(s.pct).name, page:location.pathname.slice(0,200), notes:a.notes.slice(0,1000)};
  if(!lead.state) delete lead.state;
  var f={}; for(var k in lead) f[k]=fsVal(lead[k]);
  var db='projects/'+C.projectId+'/databases/(default)/documents';
  var host=C.emulators&&C.emulators.firestore ? 'http://'+C.emulators.firestore : 'https://firestore.googleapis.com';
  var body={writes:[{update:{name:db+'/leads/'+id, fields:f}, updateTransforms:[{fieldPath:'created', setToServerValue:'REQUEST_TIME'}], currentDocument:{exists:false}}]};
  return fetch(host+'/v1/'+db+':commit'+(C.emulators?'':'?key='+encodeURIComponent(C.apiKey)), {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)})
    .then(function(res){ if(!res.ok) throw new Error('HTTP '+res.status); return true; });
}

form.addEventListener('submit', function(e){
  e.preventDefault();
  var a=answers(), err=$('#rc-err'), recErr=$('#rc-rec-err'); err.textContent=''; recErr.textContent='';
  var missing=rows().filter(function(r){ return !a.records[r.k]; });
  var problem='';
  if(!a.org_name) problem='Add your organisation’s name (step 1).';
  else if(!a.sector) problem='Choose the type of organisation (step 1).';
  else if(missing.length){ problem='Answer every record in step 3, or choose Not sure.'; recErr.textContent=missing.length+' still to answer.'; missing.forEach(function(r){ var row=$('[data-rec="'+r.k+'"]'); if(row) row.classList.add('missing'); }); }
  else if(!a.contact_name) problem='Add your name.';
  else if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email)) problem='Add a valid work email.';
  else if(!a.consent) problem='Tick the box so Yarta can email you about your result.';
  if(problem){ err.textContent=problem; if(missing.length&&!(!a.org_name||!a.sector)) $('#rc-records').scrollIntoView({behavior:'smooth',block:'center'}); return; }
  var s=score(a.records), out=$('#rc-result'), btn=$('#rc-go');
  var bot=form.website && form.website.value;
  btn.disabled=true;
  var show=function(saved){
    out.innerHTML=result(a, s, saved); out.hidden=false; btn.disabled=false;
    out.scrollIntoView({behavior:'smooth', block:'start'}); try{ out.focus({preventScroll:true}); }catch(x){}
  };
  var mail='mailto:'+form.getAttribute('data-to')+'?subject='+encodeURIComponent('Readiness Check · '+a.org_name)+'&body='+encodeURIComponent(mailBody(a,s));
  var offline='<div class="rc-saved"><b>Want Yarta to see this?</b>Nothing has been sent yet. <a class="link" href="'+mail+'">Email your result to Yarta</a> and we will reply with what happens next.</div>';
  if(bot){ show('<div class="rc-saved"><b>Thanks.</b>Your result is above.</div>'); return; }
  saveLead(a, s).then(function(ok){
    show(ok ? '<div class="rc-saved"><b>Saved. Yarta has your answers.</b>We will reply to '+esc(a.email)+' about your result and the next step. Nothing else happens until you say so.</div>' : offline);
  }).catch(function(){ show('<div class="rc-saved"><b>Your result is above, but it did not reach Yarta.</b><a class="link" href="'+mail+'">Email it to Yarta instead</a>.</div>'); });
});

sectorChanged();
})();
