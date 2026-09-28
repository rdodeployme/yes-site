/* YES — language names (proposed). One file holds every First Nations word proposed for the product,
   what it was given to mean, which language the published dictionaries place it in, and where it would be used.
   Nothing here is shown to the public until the language custodians confirm the word and its use:
   the names appear only in preview mode (?names=on), and the public site keeps the English labels.
   Turning a word on for everyone is a change to CONFIRMED below, after written permission is on file. */
(function(){
  var Y=window.YES=window.YES||{};

  /* dictionary sources used for the check column:
     GYY: Gamilaraay, Yuwaalaraay & Yuwaalayaay Dictionary (Ash, Giacon, Lissarrague, 2003), online as Gaman (dnathan.com/gaman)
     WIR: Wiradjuri: Parkes Shire Council, Wiradjuri Ngurambang exhibition language page; NSW Department of Education Wiradjuri resource
     KAU: Kaurna: Kaurna Warra Pintyanthi (University of Adelaide), yarta = land, country, earth */
  Y.TERMS=[
    {k:'yawu',       word:'Yawu',        given:'yes',                          lang:'Gamilaraay / Yuwaalaraay', check:'Matches: yawu = yes (GYY).',                                            use:'The whole report: the Yawu Summary Report.',                        en:'YES Report',        named:'Yawu Report'},
    {k:'yindyamarra',word:'Yindyamarra', given:'overall score; the philosophy', lang:'Wiradjuri',                check:'Matches: yindyamarra = respect, be gentle, give honour, take responsibility (WIR). Permission for the name is held for the Yindyamarra draft; confirm it covers this use.', use:'The overall score and the ethos behind it.',                       en:'YES Score',         named:'Yindyamarra Score'},
    {k:'yarta',      word:'Yarta',       given:'country, land or earth; environmental sustainability; "know what happens next"', lang:'Kaurna', check:'Matches Kaurna: yarta = land, country, earth (KAU). Not a Gamilaraay or Wiradjuri word. Also written "Yrta" in the brief: treated as a typo.', use:'Environmental sustainability as a whole, and the roadmap: what happens next.', en:'Roadmap', named:'Yarta · Roadmap', exact:true},
    {k:'yaradha',    word:'Yaradha',     given:'today',                        lang:'Not found',                check:'Not in GYY. Gamilaraay for now or today is yilaadhu.',                  use:'The score now.',                                                    en:'Now',               named:'Yaradha · Now', exact:true},
    {k:'yilaalua',   word:'Yilaalua',    given:'future',                       lang:'Not found as given',       check:'Not in GYY as written. Gamilaraay yilaalu = long ago; yilaa = soon, directly. Check before use: the closest match means the opposite.', use:'The projected score and the estimate with YES help.',            en:'With YES help',     named:'Yilaalua · with YES help', exact:true},
    {k:'yurra',      word:'Yurra',       given:'solar, sun',                   lang:'Not found',                check:'Not in GYY. Gamilaraay for sun is yaraay; yuru is cloud.',              use:'The renewable energy score (planned module).'},
    {k:'yuuruu',     word:'Yuuruu',      given:'rainfall, stormwater',         lang:'Gamilaraay / Yuwaalaraay', check:'Matches: yuuruu = rain (GYY).',                                          use:'Rainfall and stormwater (planned module).'},
    {k:'yamarr',     word:'Yamarr',      given:'fish',                         lang:'Not found',                check:'Not in GYY.',                                                           use:'The waterways report (planned module).'},
    {k:'yuwalla',    word:'Yuwalla',     given:'tree',                         lang:'Not found',                check:'Not in GYY; yuwal = vegetable food. River red gum is yarraan.',        use:'Trees planted (planned module).'},
    {k:'yurrandaali',word:'Yurrandaali', given:'tree goanna; ongoing planting of vegetation', lang:'Gamilaraay / Yuwaalaraay', check:'Matches: yurrandaali = tree goanna, Varanus varius (GYY).', use:'The planting and vegetation program (planned module).'},
    {k:'yaraandhu',  word:'Yaraandhu',   given:'southern cross',               lang:'Not found',                check:'Not in GYY.',                                                           use:'Not assigned. Proposed: YES Benchmark, your position among peers.'}
  ];
  /* words the custodians have confirmed for public use, by key. Empty until permission is on file. */
  Y.TERMS_CONFIRMED=[];

  /* preview switch: ?names=on turns the proposed names on for this browser, ?names=off turns them off */
  var q=/[?&]names=(on|off)/.exec(location.search), on=false;
  try{
    if(q){ if(q[1]==='on') localStorage.setItem('yes-names','on'); else localStorage.removeItem('yes-names'); }
    on = localStorage.getItem('yes-names')==='on';
  }catch(e){ on = !!(q&&q[1]==='on'); }
  Y.namesOn=on;
  if(!on) return;

  var MAP=[];
  Y.TERMS.forEach(function(t){ if(t.en&&t.named) MAP.push([t.en,t.named,!!t.exact]); });
  MAP.push(['Your Environment Score','Yindyamarra Environmental Sustainability',false]);
  MAP.sort(function(a,b){ return b[0].length-a[0].length; });
  /* idempotent: a node that already carries the name is left alone; exact labels (Now, Roadmap) only swap when the node is that label */
  function swap(s){ var o=s; MAP.forEach(function(m){ if(o.indexOf(m[1])>=0||o.indexOf(m[0])<0) return; if(m[2]){ var re=new RegExp('^(\\s*)'+m[0]+'(\\s*(·.*)?)$'); if(!re.test(o)) return; o=o.replace(re,'$1'+m[1]+'$2'); } else o=o.split(m[0]).join(m[1]); }); return o; }
  function walk(root){
    var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null,false), n, list=[];
    while((n=w.nextNode())){ var p=n.parentNode; if(!p||/^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName)||(p.closest&&p.closest('.names-bar'))) continue; list.push(n); }
    list.forEach(function(t){ var v=swap(t.nodeValue); if(v!==t.nodeValue) t.nodeValue=v; });
    if(root.querySelectorAll) root.querySelectorAll('[aria-label],[title]').forEach(function(el){ ['aria-label','title'].forEach(function(a){ var v=el.getAttribute(a); if(v){ var s=swap(v); if(s!==v) el.setAttribute(a,s); } }); });
  }
  function bar(){
    if(document.querySelector('.names-bar')) return;
    var d=document.createElement('div'); d.className='names-bar';
    d.innerHTML='<b>Preview: proposed language names.</b> Not confirmed with the language custodians and not shown to the public. <a href="/language/">Glossary and status</a> · <a href="?names=off">Turn off</a>';
    d.style.cssText='position:sticky;top:0;z-index:1000;background:#4FC17A;color:#0B0B0B;font:500 13px/1.5 Inter,system-ui,sans-serif;padding:8px 16px;text-align:center';
    document.body.insertBefore(d,document.body.firstChild);
  }
  function run(){ walk(document.body); bar(); document.title=swap(document.title); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
  if(window.MutationObserver){
    var busy=false;
    function onMut(muts){ if(busy) return; busy=true; muts.forEach(function(m){ m.addedNodes.forEach(function(nd){ if(nd.nodeType===1) walk(nd); else if(nd.nodeType===3){ var v=swap(nd.nodeValue); if(v!==nd.nodeValue) nd.nodeValue=v; } }); if(m.type==='characterData'){ var v2=swap(m.target.nodeValue); if(v2!==m.target.nodeValue) m.target.nodeValue=v2; } }); busy=false; }
    function observe(){ new MutationObserver(onMut).observe(document.body,{childList:true,subtree:true,characterData:true}); }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',observe); else observe();
  }
})();
