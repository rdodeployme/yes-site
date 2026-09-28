/* Yarta recommendations and roadmap v0.1 (draft)
   Published rules that turn an organisation's verified figures into "Recommended for you" help,
   and three numbers: the score now, the score at the organisation's own targets, and an estimated
   score with the recommended work done. Also the month-by-month roadmap behind the estimate.
   Every effect below is an assumption for discussion, published on the method page.
   Depends on dictionary.js (YESD) and engine.js (YESE). Exposes window.YESR. */
window.YESR = window.YESR || {};
(function(R, D, E){
  R.VERSION = "v0.1 draft";
  R.RAMP = 6;       // months for a change to build up to its full effect
  R.HORIZON = 18;   // months projected after the latest month
  R.RECENT = 6;     // months after completed work before the same help is recommended again

  function pc(v){ return v==null||!isFinite(v) ? "—" : Number(v).toLocaleString("en-AU",{minimumFractionDigits:1,maximumFractionDigits:1})+"%"; }
  function f0(v){ return Number(Math.round(v)).toLocaleString("en-AU"); }
  function f1(v){ return Number(v).toLocaleString("en-AU",{minimumFractionDigits:1,maximumFractionDigits:1}); }
  function num(v){ v=+v; return isFinite(v)?v:0; }
  function cl(v){ return Math.max(0, Math.min(100, v)); }
  function chg(now, base){ return base>0 && now!=null ? (now-base)/base*100 : null; }
  function vs(c){ return c==null ? "" : (c<0 ? f1(-c)+"% below" : f1(c)+"% above")+" the same months of the baseline year"; }
  function list(a){ return a.length<2 ? a.join("") : a.slice(0,-1).join(", ")+" and "+a[a.length-1]; }
  function toward(v, goal, f){ return v<goal ? v + (goal-v)*f : v; }

  R.monthsBetween = function(a, b){ var p=E.parse(a), q=E.parse(b); return (q.y*12+q.m)-(p.y*12+p.m); };
  R.ramp = function(start, month){ if(!start) return 0; return Math.max(0, Math.min(1, (R.monthsBetween(start, month)+1)/R.RAMP)); };
  R.mean = function(S){ var v=[]; D.CATEGORIES.forEach(function(c){ if(S[c.k]!=null) v.push(S[c.k]); }); return v.length ? v.reduce(function(a,b){ return a+b; },0)/v.length : null; };

  R.PROVIDERS = {
    group:{label:"Recycle Group business", note:"Disclosed on your monthly report"},
    partner:{label:"Independent specialist", note:"Chosen by you; Yarta can introduce one"},
    yes:{label:"Yarta analyst", note:"Not the analysts who enter or verify your months"}
  };

  /* The ten services. trigger(c) returns {why} when the figures call for it; effect(x, f, c) applies the
     published assumption to the score measures at strength f (0 to 1). */
  R.SERVICES = [
    { k:"hardwaste", cat:"waste", moves:["waste","circular","carbon"], prov:"group",
      groupNames:"JUNK, The Mattress Recycling Company and Recycle Warehouse",
      title:function(p){ return p.org_type==="Council" ? "Hard-waste and bulky-item recovery program" : "Bulky-item clear-out and recovery"; },
      what:"Plan and run collections of mattresses, whitegoods, furniture and e-waste so more of them are recovered or reused instead of landfilled.",
      who:"JUNK collects. The Mattress Recycling Company processes mattresses. Recycle Warehouse rehomes furniture through charities.",
      modes:["On site","Online"], session:"90-minute planning session",
      rule:"Landfill diversion is below your target, and bulky items (mattresses, whitegoods, furniture or e-waste) appear in your waste figures.",
      effectText:"Landfill diversion up 3 percentage points and reuse up 0.5 points. Landfill emissions fall with the tonnes diverted.",
      trigger:function(c){
        var x=c.x, T=c.T; if(x.diversion_pct==null || x.diversion_pct>=T.target_diversion) return null;
        var mat=c.sum("mattress_n"), wg=c.sum("whitegoods_n"), fu=c.sum("furniture_t"), ew=c.sum("ewaste_t");
        if(!(mat+wg+fu+ew>0)) return null;
        var a=[]; if(mat) a.push(f0(mat)+" mattresses"); if(wg) a.push(f0(wg)+" whitegoods"); if(fu) a.push(f1(fu)+" t of furniture"); if(ew) a.push(f1(ew)+" t of e-waste");
        return {why:"Landfill diversion is "+pc(x.diversion_pct)+" over 12 months against your "+f0(T.target_diversion)+"% target, with "+f0(c.r12.landfill_t)+" t to landfill. Your figures also show "+list(a)+" recovered over the same months."};
      },
      effect:function(x,f){ if(x.diversion_pct!=null) x.diversion_pct=cl(x.diversion_pct+3*f); x.reuse_pct=cl((x.reuse_pct||0)+0.5*f); x.total=Math.max(0,x.total-0.03*f*(x.waste_t||0)*(x.landF||1.3)); }
    },
    { k:"contamination", cat:"waste", moves:["waste"], prov:"partner",
      title:function(p){ return p.org_type==="Council" ? "Kerbside contamination blitz" : "Bin contamination audit and staff training"; },
      what:"Bin audits, tagging and education so recycling and organics bins carry less contamination.",
      who:"Bin auditors and resident or staff educators.",
      modes:["On site"], session:"Scoping visit",
      rule:"Your latest bin audit shows contamination of 10% or more.",
      effectText:"Contamination down 4 percentage points, to no lower than 5%.",
      trigger:function(c){ var v=c.x.contam_pct; if(v==null || v<10) return null;
        return {why:"Your latest bin audit found "+pc(v)+" contamination. The Waste score gives this part full marks at 0% and none at 20% or more."}; },
      effect:function(x,f){ if(x.contam_pct!=null && x.contam_pct>5) x.contam_pct=Math.max(5, x.contam_pct-4*f); }
    },
    { k:"fleet", cat:"fleet", moves:["fleet","carbon"], prov:"partner",
      title:"Fleet transition plan",
      what:"A vehicle-by-vehicle replacement plan from your own kilometres and fuel data: which vehicles go electric or hybrid first, the charging you need and what it costs.",
      who:"Fleet and electric-vehicle advisers.",
      modes:["Online","On site"], session:"Two-hour planning session",
      rule:"Fleet electrification is below your target.",
      effectText:"Electric share up 8 percentage points and fuel use down 4% once the first stage is carried out. Fleet Scope 1 emissions fall in proportion.",
      trigger:function(c){ var x=c.x, T=c.T; if(!x.has.fleet || (x.ev_pct||0)>=T.target_fleet_ev) return null;
        return {why:"Fleet electrification is "+pc(x.ev_pct||0)+" against your "+f0(T.target_fleet_ev)+"% target. The fleet bought "+f0(x.fuel/1000)+" kL of fuel in the last 12 months"+(x.fuel_base>0&&c.cmp?", "+vs(chg(x.fuel,x.fuel_base)):"")+"."}; },
      effect:function(x,f){ x.ev_pct=cl((x.ev_pct||0)+8*f); x.fuel=x.fuel*(1-0.04*f); x.total=Math.max(0,x.total-0.04*f*(x.s1_fleet||0)); }
    },
    { k:"energy", cat:"energy", moves:["energy","carbon"], prov:"partner",
      title:"Energy and electrification audit",
      what:"A site-by-site audit of electricity and gas: lighting, heating and cooling, pools, solar, batteries, heat pumps and renewable supply contracts, with costed actions.",
      who:"Energy auditors, with solar, battery and heat-pump specialists.",
      modes:["On site","Online"], session:"Audit scoping session",
      rule:"Renewable electricity is below your target, or grid electricity is less than 5% below the baseline months.",
      effectText:"Renewable share up 10 percentage points and grid electricity down 5% once the actions are carried out. Scope 2 emissions fall in proportion.",
      trigger:function(c){ var x=c.x, T=c.T; if(!x.has.energy) return null; var gc=c.cmp?chg(x.grid,x.grid_base):null;
        if((x.renew_pct||0)>=T.target_renewable && !(gc!=null && gc>-5)) return null;
        var gen=c.sum("solar_gen_kwh"), ex=c.sum("solar_exp_kwh"), exShare=gen>0?ex/gen*100:0;
        return {why:"Renewable electricity is "+pc(x.renew_pct||0)+" over 12 months against your "+f0(T.target_renewable)+"% target. "+(gc==null?"Your baseline year ("+c.bfy+") is still being recorded, so grid electricity has no change to compare yet.":"Grid electricity is "+vs(gc)+".")+(exShare>10?" "+f0(exShare)+"% of the solar you generate is exported to the grid.":"")}; },
      effect:function(x,f){ x.renew_pct=cl((x.renew_pct||0)+10*f); x.grid=x.grid*(1-0.05*f); x.total=Math.max(0,x.total-0.05*f*(x.s2||0)); }
    },
    { k:"dumping", cat:"governance", moves:["governance"], prov:"group", only:["Council","Government agency"],
      groupNames:"JUNK",
      title:"Illegal dumping response",
      what:"Fast removal of dumped rubbish, with a prevention plan: hot-spot mapping, cameras, signage and amnesty days.",
      who:"JUNK removes dumped rubbish. Prevention is planned with your compliance team.",
      modes:["On site","Online"], session:"Hot-spot review",
      rule:"Fewer than 90% of environmental complaints and incidents closed, or 24 or more in 12 months and rising on the 12 months before.",
      effectText:"The share of complaints and incidents closed rises to 100%.",
      trigger:function(c){ var r=c.r12, cl0=c.x.closure, pv=c.sumPrev("complaints"), rising=pv!=null && r.complaints>=24 && r.complaints>pv*1.05;
        if(!(rising || (cl0!=null && cl0<90))) return null;
        return {why:f0(r.complaints)+" environmental complaints and incidents were received in the last 12 months"+(pv!=null?" ("+f0(pv)+" in the 12 months before)":"")+", and "+f0(cl0==null?100:cl0)+"% were closed. Where illegal dumping is a large share, fast removal closes them sooner."}; },
      effect:function(x,f){ x.closure=toward(x.closure==null?100:x.closure, 100, f); }
    },
    { k:"water", cat:"water", moves:["water"], prov:"partner",
      title:"Water efficiency and leak hunt",
      what:"A meter-by-meter review to find leaks and irrigation savings, and to use more rainwater, stormwater and recycled water.",
      who:"Water auditors, with leak-detection, stormwater and irrigation specialists.",
      modes:["On site"], session:"Site walk-through",
      rule:"Potable water is less than 5% below the baseline months, or alternative water is under 20% of all water used.",
      effectText:"Potable water down 8% and the alternative water share up 4 percentage points.",
      trigger:function(c){ var x=c.x; if(!x.has.water) return null; var wc=c.cmp?chg(x.potable,x.potable_base):null, alt=x.alt_pct||0;
        if(!((wc!=null && wc>-5) || alt<20)) return null;
        return {why:(wc==null?"":"Potable water is "+vs(wc)+". ")+"Alternative water (rainwater, stormwater and recycled water) is "+pc(alt)+" of all water used."}; },
      effect:function(x,f){ x.potable=x.potable*(1-0.08*f); x.alt_pct=cl((x.alt_pct||0)+4*f); }
    },
    { k:"evidence", cat:"governance", moves:["governance"], prov:"yes",
      title:function(p){ return p.org_type==="Business" ? "Auditor-ready Scope 3 review" : "Evidence upgrade session"; },
      what:"Swap estimates for primary documents: which bills, dockets and registers to send, and who in your organisation holds them. For businesses, a check that the Scope 3 categories you report are backed by evidence an auditor can follow.",
      who:"A Yarta analyst who does not enter or verify your months.",
      modes:["Online","On site"], session:"One-hour session",
      rule:"Any category graded C in the last three months, or less than 80% of figures backed by A or B evidence.",
      effectText:"Figures backed by A or B evidence, and data completeness, both rise to 100%.",
      trigger:function(c){ var cats={}, nC=0;
        c.rec3.forEach(function(m){ Object.keys(m.ev||{}).forEach(function(k){ if(m.ev[k]&&m.ev[k].grade==="C"){ cats[k]=1; nC++; } }); });
        var ev=c.x.evidence; if(!nC && !(ev!=null && ev<80)) return null;
        var names=Object.keys(cats).map(function(k){ return D.CAT[k]?D.CAT[k].short:k; });
        return {why:(nC?nC+" document"+(nC===1?" was":"s were")+" graded C (estimate or unsupported) in the last three months: "+list(names)+". ":"")+"Figures backed by A or B evidence: "+pc(ev)+"."}; },
      effect:function(x,f){ x.evidence=toward(x.evidence||0, 100, f); x.complete=toward(x.complete||0, 100, f); }
    },
    { k:"procurement", cat:"circular", moves:["circular"], prov:"partner",
      title:"Recycled-content procurement review",
      what:"Find the contracts where recycled-content products can replace virgin materials, such as road base, concrete, furniture, paper and bins, and set up take-back schemes.",
      who:"Procurement advisers, recycled-content suppliers and take-back schemes.",
      modes:["Online","On site"], session:"Contract review session",
      rule:"Recycled-content spend is under 20% of procurement spend over 12 months.",
      effectText:"Recycled-content share up 6 percentage points, and one more product stewardship program (to a maximum of three).",
      trigger:function(c){ var v=c.x.proc_pct; if(v==null || v>=20) return null;
        return {why:"Recycled-content spend is "+pc(v)+" of procurement spend over 12 months. The Circular Economy score gives this part full marks at 30%."}; },
      effect:function(x,f){ if(x.proc_pct!=null) x.proc_pct=cl(x.proc_pct+6*f); if((x.stew||0)<3) x.stew=Math.min(3,(x.stew||0)+f); }
    },
    { k:"planting", cat:"nature", moves:["nature","community"], prov:"partner",
      title:"Planting and habitat days",
      what:"Community planting and habitat restoration days, planned to close the gap to your targets.",
      who:"Local Landcare groups and Traditional Owner ranger programs, engaged and paid on their terms.",
      modes:["On site","Online"], session:"Planning session",
      rule:"Trees planted, hectares restored or program participants are under 90% of your target for the period.",
      effectText:"Trees planted and hectares restored reach your targets, and program participants rise 10%.",
      trigger:function(c){ var x=c.x, T=c.T, p=x.part||1, a=[];
        if(x.has.nature && x.trees<0.9*T.target_trees*p) a.push(f0(x.trees)+" trees planted against "+f0(T.target_trees*p));
        if(x.has.nature && x.native_ha<0.9*T.target_native_ha*p) a.push(f1(x.native_ha)+" ha restored against "+f1(T.target_native_ha*p)+" ha");
        if(x.has.community && x.participants<0.9*T.target_participants*p) a.push(f0(x.participants)+" program participants against "+f0(T.target_participants*p));
        if(!a.length) return null;
        return {why:"In the last "+(p<1?Math.round(p*12)+" months":"12 months")+": "+list(a)+"."}; },
      effect:function(x,f,c){ var T=c.T, p=x.part||1; if(x.has.nature){ x.trees=toward(x.trees, T.target_trees*p, f); x.native_ha=toward(x.native_ha, T.target_native_ha*p, f); } if(x.has.community) x.participants=x.participants*(1+0.10*f); }
    },
    { k:"grants", cat:null, moves:[], prov:"partner",
      title:"Grant application pack",
      what:"Match your recommended work to open state and federal funding rounds, and prepare the application with your verified Yarta figures as the evidence base.",
      who:"A grants writer.",
      modes:["Online"], session:"One-hour session",
      rule:"Two or more other recommendations apply.",
      effectText:"No direct change to the score. It can fund the other items.",
      trigger:function(c, n){ if(!(n>=2)) return null; return {why:n+" other recommendations apply to you. Verified Yarta figures give a funding application its evidence base."}; },
      effect:function(){}
    }
  ];
  R.byKey = {}; R.SERVICES.forEach(function(s){ R.byKey[s.k]=s; });
  R.title = function(s, p){ return typeof s.title==="function" ? s.title(p||{}) : s.title; };

  R.context = function(S, i, profile){
    var m=S.months[i], win=S.months.slice(Math.max(0,i-11), i+1);
    var prev=i>=23 ? S.months.slice(i-23, i-11) : [];
    return { m:m, i:i, S:S, T:S.targets, p:profile||S.profile||{}, x:m.x, r12:m.r12, win:win, rec3:S.months.slice(Math.max(0,i-2), i+1),
      // trend comparisons only mean something once the window reaches past the baseline year
      cmp:win.some(function(mm){ return E.fyOf(mm.month)!==S.baseline.fy; }), bfy:S.baseline.fy,
      sum:function(id){ return win.reduce(function(s,mm){ return s + num(mm.raw && mm.raw[id]); }, 0); },
      sumPrev:function(id){ return prev.length===12 ? prev.reduce(function(s,mm){ return s + num(mm.raw && mm.raw[id]); }, 0) : null; } };
  };

  /* What one item would change on its own, at full effect. */
  R.uplift = function(s, c){
    var x2=E.copyX(c.x); s.effect(x2, 1, c);
    var S1=E.scoreParts(c.x, c.T), S2=E.scoreParts(x2, c.T), cats={};
    (s.moves||[]).forEach(function(k){ if(S1[k]!=null && S2[k]!=null && Math.abs(S2[k]-S1[k])>=0.05) cats[k]=S2[k]-S1[k]; });
    return {cats:cats, overall:R.mean(S2)-R.mean(S1), emis:Math.max(0,(c.x.total||0)-(x2.total||0))};
  };

  /* Recommendations for month i, weakest category first; the grant pack last. */
  R.recommend = function(S, i, profile){
    if(!S.months[i] || !S.months[i].x) return [];
    var c=R.context(S, i, profile), out=[];
    function mk(s, t){ var cs=s.cat && c.m.scores[s.cat]!=null ? c.m.scores[s.cat] : null;
      return {k:s.k, s:s, title:R.title(s,c.p), why:t.why, uplift:R.uplift(s,c), prio:s.k==="grants" ? -1 : (cs==null ? 50 : 100-cs), catScore:cs}; }
    R.SERVICES.forEach(function(s){ if(s.k==="grants") return; if(s.only && s.only.indexOf(c.p.org_type)<0) return; var t=s.trigger(c); if(t) out.push(mk(s,t)); });
    out.sort(function(a,b){ return b.prio-a.prio || b.uplift.overall-a.uplift.overall; });
    var g=R.byKey.grants.trigger(c, out.length); if(g) out.push(mk(R.byKey.grants, g));
    return out;
  };

  function qStart(k){ var p=E.parse(k); return E.key(p.y, p.m-p.m%3); }
  var MS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  R.qLabel = function(q){ var p=E.parse(q); return MS[p.m]+"–"+MS[p.m+2]+" "+p.y; };

  /* Change in a category since completed work (a change, not a claim of cause). */
  R.since = function(S, b, i){
    var s=R.byKey[b.svc]; if(!s || !b.completedMonth) return null;
    var j=-1; S.months.forEach(function(m,ix){ if(m.month===b.completedMonth) j=ix; });
    if(j<0 || j>i) return null;
    var a=S.months[j], z=S.months[i], cat=s.cat;
    return {month:b.completedMonth, to:z.month, cat:cat, from:cat&&a.scores[cat]!=null?a.scores[cat]:null, now:cat&&z.scores[cat]!=null?z.scores[cat]:null, scoreFrom:a.score, scoreNow:z.score};
  };

  /* The roadmap for month i. opts: bookings (this organisation's), off (items switched off), anchor (first month work can start). */
  R.plan = function(S, i, profile, opts){
    opts=opts||{};
    var m=S.months[i]; if(!m || !m.x) return null;
    var c=R.context(S, i, profile), k=m.month, T=c.T, off=opts.off||{};
    var anchor=opts.anchor && opts.anchor>k ? opts.anchor : E.addMonths(k,1);
    var recs=R.recommend(S, i, profile);
    var live=(opts.bookings||[]).filter(function(b){ return b.status!=="cancelled"; });
    var done=live.filter(function(b){ return b.status==="completed" && b.completedMonth && b.completedMonth<=k && R.monthsBetween(b.completedMonth,k)<R.RECENT; });
    var doneK={}; done.forEach(function(b){ doneK[b.svc]=b; });
    var booked={}; live.forEach(function(b){ var open=b.status==="requested"||b.status==="confirmed"||(b.status==="completed"&&b.completedMonth&&b.completedMonth>k); if(open && !booked[b.svc]) booked[b.svc]=b; });
    var items=recs.filter(function(r){ return !doneK[r.k]; }).map(function(r){ return {k:r.k, s:r.s, title:r.title, why:r.why, uplift:r.uplift, prio:r.prio, catScore:r.catScore, booking:booked[r.k]||null, off:!!off[r.k]}; });
    Object.keys(booked).forEach(function(key){ if(doneK[key] || items.some(function(it){ return it.k===key; })) return; var s=R.byKey[key]; if(!s) return;
      items.push({k:key, s:s, title:R.title(s,c.p), why:"Booked by you. Your current figures do not call for it.", uplift:R.uplift(s,c), prio:0, catScore:null, booking:booked[key], off:!!off[key]}); });
    // start months: booked items in the month booked; the rest from the anchor, two a quarter, weakest category first
    var n=0;
    items.forEach(function(it){
      if(it.off){ it.start=null; return; }
      if(it.booking){ var bm=(it.booking.slot||"").slice(0,7); it.start=/^\d{4}-\d{2}$/.test(bm) ? (bm>k?bm:E.addMonths(k,1)) : anchor; return; }
      if(it.k==="grants"){ it.start=anchor; return; }
      it.start=E.addMonths(anchor, Math.floor(n/2)*3); n++;
    });
    var act=items.filter(function(it){ return !it.off && it.start; });
    var last=E.addMonths(k,R.HORIZON); act.forEach(function(it){ var full=E.addMonths(it.start,R.RAMP-1); if(full>last) last=full; });
    var H=Math.min(24, R.monthsBetween(k,last));
    var proj=[];
    for(var j=1;j<=H;j++){
      var mk=E.addMonths(k,j), x2=E.copyX(c.x);
      act.forEach(function(it){ var f=R.ramp(it.start, mk); if(f>0) it.s.effect(x2, f, c); });
      proj.push({month:mk, v:E.overall(E.scoreParts(x2,T))});
    }
    var xp=E.copyX(c.x); act.forEach(function(it){ it.s.effect(xp, 1, c); });
    var Sp=E.scoreParts(xp,T), at=E.atTarget(m,T);
    var qs=[], q=qStart(E.addMonths(k,1)), end=E.addMonths(k,H);
    while(q<=end){
      var qe=E.addMonths(q,2), em=qe<=end?qe:end;
      var pr=proj.filter(function(p){ return p.month===em; })[0];
      qs.push({q:q, label:R.qLabel(q), end:em,
        starts:act.filter(function(it){ return it.start>=q && it.start<=qe; }),
        full:act.filter(function(it){ var fm=E.addMonths(it.start,R.RAMP-1); return fm>=q && fm<=qe && it.k!=="grants"; }),
        score:pr?pr.v:null});
      q=E.addMonths(q,3);
    }
    var wt=c.x.waste_t||0, lfNow=c.x.diversion_pct!=null?wt*(1-c.x.diversion_pct/100):null, lfPot=xp.diversion_pct!=null?wt*(1-xp.diversion_pct/100):null;
    return {k:k, anchor:anchor, now:m.score, nowScores:m.scores, target:at.score, targetScores:at.scores, potential:E.overall(Sp), potScores:Sp,
      items:items, active:act, done:done.map(function(b){ return {b:b, s:R.byKey[b.svc], since:R.since(S,b,i)}; }),
      proj:proj, quarters:qs,
      emis:{now:c.x.total||0, pot:xp.total||0, cut:Math.max(0,(c.x.total||0)-(xp.total||0))},
      landfill:{now:lfNow, pot:lfPot, cut:lfNow!=null&&lfPot!=null?Math.max(0,lfNow-lfPot):0}};
  };

  /* Published on the method page and summarised on the report. */
  R.INDEPENDENCE = [
    {k:"Published rules", d:"The rules and assumptions are published in the Yarta method, and the same rules apply to every organisation."},
    {k:"Any provider", d:"You can use any provider. Recommendations, your score and the verification of your figures do not depend on who does the work."},
    {k:"Disclosure", d:"Work by a Recycle Group business (JUNK, The Mattress Recycling Company or Recycle Warehouse) is disclosed on your monthly report. Yarta is part of Recycle Group."},
    {k:"Only through the figures", d:"Completed work changes your score only through the figures Yarta enters and verifies in later months, like any other change."},
    {k:"Separate people", d:"A Yarta analyst who runs a paid session for you does not enter or verify your months."},
    {k:"Estimates", d:"The score with Yarta help and the projection are estimates. They are not a promise, a guarantee or a target."}
  ];
  R.NUMBERS = [
    {k:"now", name:"Now", how:"The Yindyamarra Environmental Score for the latest verified month."},
    {k:"target", name:"At your targets", how:"The same month's figures with each target in your profile treated as met: emissions reduction, renewable electricity, landfill diversion, fleet electrification, trees planted, hectares restored, land rehabilitated and program participants. Figures without a target stay as they are."},
    {k:"potential", name:"With Yarta help (estimate)", how:"The same month's figures with the assumed effect of every recommended item in your plan applied in full. Items you switch off are left out."}
  ];
  R.ROADMAP_RULES = "Booked items start in the month booked. The others start from next month, two a quarter, weakest category first. Each change builds up evenly over "+R.RAMP+" months, and everything else is held at the latest 12 months. Work completed in the last "+R.RECENT+" months is not recommended again; its effect shows in your verified figures.";
})(window.YESR, window.YESD, window.YESE);
