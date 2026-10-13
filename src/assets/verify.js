/* Check a Yarta report by its ID. On the public site the reports are the demo ones; in production the same check
   reads a public register of issued report IDs (organisation, month, score, verified and issued dates only). */
(function(){
  var E=window.YESE, X=window.YESDEMO, form=document.getElementById('vf-form'), inp=document.getElementById('vf-id'), out=document.getElementById('vf-out');
  if(!E || !X || !form) return;
  var MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  function mLabel(k){ var p=E.parse(k); return MONTHS[p.m]+' '+p.y; }
  function longDate(d){ if(!d) return ''; var t=new Date(String(d).length<=10?d+'T00:00:00':d); return isNaN(t)?String(d):t.toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'}); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  var index=null;
  function build(){ if(index) return index; index={}; var st=(window.YESPortal&&window.YESPortal.demoState)?window.YESPortal.demoState():X.build();
    Object.keys(st.orgs).forEach(function(id){ var o=st.orgs[id], S=E.series(o.records.slice().sort(function(a,b){ return a.month<b.month?-1:1; }), o.profile);
      S.months.forEach(function(m){ var r=o.records.filter(function(x){ return x.month===m.month; })[0]; if(!r) return;
        index[E.reportId(id, m.month, m.score, r.values)]={org:o.profile.org_name, month:m.month, score:m.score, band:m.band, status:r.status, verifiedAt:r.verifiedAt, issuedAt:r.issuedAt}; }); });
    return index; }
  function norm(v){ return String(v||'').toUpperCase().replace(/\s+/g,'').replace(/[–—]/g,'-'); }
  function check(v){
    var id=norm(v); out.hidden=false;
    if(!/^YR-\d{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(id)){ out.className='vf-out no'; out.innerHTML='<h2>That is not a Yarta report ID</h2><p>A report ID looks like YR-2607-3F9A-11C2: YR, the year and month, then two groups of four letters and numbers.</p>'; out.focus(); return; }
    var hit=build()[id];
    if(!hit){ out.className='vf-out no'; out.innerHTML='<h2>No Yarta report has this ID</h2><p>Check it was typed exactly as printed. If it still does not match, the report may have been changed after Yarta issued it. Contact Yarta at <a href="mailto:contact@yes.com.au">contact@yes.com.au</a> with the report attached.</p>'; out.focus(); return; }
    var issued=hit.status==='verified' && hit.issuedAt;
    out.className='vf-out '+(issued?'ok':'no');
    out.innerHTML='<h2>'+(issued?'Genuine, and unchanged since it was issued':'Matches a report that has not been issued')+'</h2>'
      + (issued?'':'<p>The figures for this month are still provisional or awaiting verification, so no report has been issued for it yet.</p>')
      + '<dl><dt>Organisation</dt><dd>'+esc(hit.org)+'</dd><dt>Month</dt><dd>'+esc(mLabel(hit.month))+'</dd><dt>Score</dt><dd>'+esc(hit.score)+' out of 100, '+esc(hit.band)+'</dd>'
      + (hit.verifiedAt?'<dt>Verified</dt><dd>'+esc(longDate(hit.verifiedAt))+', by a second Yarta analyst</dd>':'')+(hit.issuedAt?'<dt>Issued</dt><dd>'+esc(longDate(hit.issuedAt))+'</dd>':'')+'<dt>Report ID</dt><dd>'+esc(id)+'</dd></dl>';
    out.focus();
  }
  form.addEventListener('submit', function(e){ e.preventDefault(); check(inp.value); if(history.replaceState) history.replaceState(null,'','?id='+encodeURIComponent(norm(inp.value))); });
  var q=/[?&]id=([^&]+)/.exec(location.search); if(q){ inp.value=decodeURIComponent(q[1]); check(inp.value); }
})();
