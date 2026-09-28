/* YES Method v1.0 (draft): factor library, calculation engine and the proposed YES Score.
   Single source of truth for the demo dashboard, the calculator, the report and the method page.

   Two numbers, never netted (GHG Protocol Scope 3 Technical Guidance, Category 5):
     Figure A · Scope 3 Category 5 inventory = processing (supplier-specific) + transport (optional) + landfilled tonnes × NGA landfill factor
     Figure B · Avoided emissions = recovered tonnes × NSW DECCW 2010 life-cycle factor. Reported separately; never deducted from Figure A; not an offset.
     Figure C · Landfill comparison = the same tonnes had they all been landfilled, at the same NGA factors. Context only.

   status: "reference" = published external source · "group" = Recycle Group / TMRC stated figure
           "assumption" = YES working assumption, to be replaced · "illustrative" = derived placeholder, replaced by metered data before the first report
           "pending" = no avoided-emissions factor yet; none claimed
*/
window.YES = window.YES || {};
(function(B){
  B.METHOD_VERSION = "v1.0 draft";
  B.SOURCES = {
    nsw2010: {id:"NSW DECCW 2010", title:"Environmental benefits of recycling", detail:"Department of Environment, Climate Change and Water NSW, June 2010 (DECCW 2010/58, ISBN 978 1 74232 530 9). Table 4: net benefit of recycling 1 tonne of waste material, tonnes CO₂-e, C&I/C&D pathway unless noted. Used for avoided emissions only. Every factor from this source is flagged 2010 and is due for refresh.", url:"https://www.epa.nsw.gov.au/sites/default/files/100058-benefits-of-recycling.pdf"},
    nga: {id:"NGA landfill factors", title:"National Greenhouse Accounts landfill emission factors", detail:"DCCEEW National Greenhouse Accounts (NGA) solid-waste landfill factors, t CO₂-e per tonne landfilled, as reproduced in the Commonwealth Emissions Reporting Framework 2024–25 (Department of Finance, 30 June 2025). Used for the Category 5 inventory. Each report cites the NGA edition current at its reporting date.", url:"https://www.finance.gov.au/sites/default/files/2025-06/emissions-reporting-framework.pdf"},
    ghgp: {id:"GHG Protocol", title:"Technical Guidance for Calculating Scope 3 Emissions, Chapter 5 (Category 5: Waste generated in operations)", detail:"Waste-type-specific method: tonnes by waste type and treatment × waste-type-specific factor; supplier-specific where the processor meters its fuel and electricity. Avoided emissions from recycling are not included in, or deducted from, the Scope 3 inventory and may be reported separately.", url:"https://ghgprotocol.org/sites/default/files/2022-12/Ch5_GHGP_Tech.pdf"},
    rgops: {id:"RG operations (illustrative)", title:"Recycle Group processing and transport: illustrative working values", detail:"Processing: about 1,200 L diesel a day (two shredders plus loaders) at about 2.7 kg CO₂-e per litre, over 44 to 109 t processed a day, gives 0.03 to 0.07 t CO₂-e per tonne; 0.05 is used. Transport: 0.15 kg CO₂-e per tonne-km, rigid truck. Both are replaced by metered fuel and electricity records and fleet fuel data before the first customer report."},
    rg: {id:"Recycle Group", title:"Recycle Group / The Mattress Recycling Company stated processing figures", detail:"Per 10,000 mattresses: about 800 t in and about 270 t steel out; 99% of that steel recovered (stated plant yield, to be evidenced by a dated yield study). Shredded residual is 25% of original volume."},
    tmrc: {id:"TMRC", title:"The Mattress Recycling Company per-unit assumptions", detail:"Single 25 kg / 0.4 m³ · Double–Queen 66 kg / 0.8 m³ · King 78 kg / 1.1 m³. Steel-recovery percentages in this table (70–72%) conflict with the group's figure of about 30% of mass and are not used until reconciled."},
    big: {id:"YES assumption", title:"YES working assumption", detail:"Placeholder pending measured data from the Recycle Group weighbridge and processing records. Replaced before the first customer report."}
  };

  /* ---- Figure A inputs ------------------------------------------------------ */
  B.NGA = {
    src:"nga",
    edition:"NGA landfill factors as reproduced in the Commonwealth Emissions Reporting Framework 2024–25",
    f:{food:2.1, paper:3.3, garden:1.6, wood:0.7, textiles:2.0, sludge:0.4, nappies:2.0, rubber:3.3, inert:0, msw:1.6, ci:1.3, cd:0.2},
    label:{food:"Food", paper:"Paper and cardboard", garden:"Garden and green", wood:"Wood", textiles:"Textiles", sludge:"Sludge", nappies:"Nappies", rubber:"Rubber and leather", inert:"Inert (concrete, metal, plastics, glass)", msw:"Municipal solid waste, mixed", ci:"Commercial and industrial, mixed", cd:"Construction and demolition, mixed"}
  };
  B.PROC = {f:0.05, src:"rgops", status:"illustrative", note:"Processor's Scope 1 and 2 emissions for receiving, sorting, shredding and baling, per tonne handled. Supplier-specific method. Illustrative until metered."};
  B.TRANSPORT = {f:0.00015, src:"rgops", status:"illustrative", note:"0.15 kg CO₂-e per tonne-km, rigid truck. Included when the transport is performed or paid for on the customer's behalf. Illustrative until fleet fuel data replaces it."};

  /* ---- Figure B input: steel ------------------------------------------------ */
  var STEEL = {f:0.44, src:"nsw2010", status:"reference", note:"Steel, C&I/C&D. Conservative net life-cycle figure (includes collection and reprocessing impacts). worldsteel's gross figure of about 1.5 t CO₂-e per tonne of scrap is higher; YES uses the conservative figure."};

  /* lanType = NGA landfill factor applied to any landfilled fraction (Figure A) and to the landfill comparison (Figure C).
     interim = mixed-stream factor used until a composition audit of the residual gives a waste-type-specific one. */
  B.CATS = [
    {k:"mattresses", name:"Mattresses", unit:"count", unitLabel:"mattresses", kgUnit:80, m3t:8.75, path:{rec:0.334, sto:0, lan:0.666}, steelFrac:0.3375, steelRecovery:0.99, carbon:null, carbonSrc:null, lanType:"ci", interim:true, status:"group", notes:"80 kg average and about a third steel by mass, from Recycle Group's stated figures. Steel recovery 99% is the stated plant yield; each report prints the measured yield with its study date. Foam and fibre residual is shredded and landfilled at 25% of original volume (recovery trials under way); its landfill factor is the interim C&I figure until a composition audit. m³/t from 0.7 m³ per 80 kg mattress."},
    {k:"steel", name:"Steel", unit:"t", unitLabel:"tonnes", m3t:0.6, path:{rec:0.99, sto:0, lan:0.01}, steelFrac:1, steelRecovery:1, carbon:null, lanType:"inert", status:"reference", notes:"Scrap steel to the electric-arc-furnace route. 1% process loss assumed."},
    {k:"aluminium", name:"Aluminium", unit:"t", unitLabel:"tonnes", m3t:1.2, path:{rec:0.99, sto:0, lan:0.01}, steelFrac:0, carbon:17.72, carbonSrc:"nsw2010", lanType:"inert", status:"reference", notes:"Aluminium scrap, C&I/C&D. The highest per-tonne avoided-emissions factor of any common stream, and the one most sensitive to the age of the 2010 study."},
    {k:"timber_plain", name:"Plain timber", unit:"t", unitLabel:"tonnes", m3t:2.5, path:{rec:0.95, sto:0, lan:0.05}, steelFrac:0, carbon:1.35, carbonSrc:"nsw2010", lanType:"wood", status:"reference", notes:"Modelled on timber pallets and packaging (avoided structural pine, non-reusable to mulch). 5% contamination loss assumed."},
    {k:"timber_coloured", name:"Coloured / treated timber", unit:"t", unitLabel:"tonnes", m3t:2.5, path:{rec:0, sto:0.2, lan:0.8}, steelFrac:0, carbon:null, lanType:"wood", status:"pending", notes:"Painted, treated or engineered timber. No recycling pathway modelled yet: Stored while a pathway is sought, otherwise Landfilled. No avoided emissions claimed."},
    {k:"tyres", name:"Tyres", unit:"count", unitLabel:"tyres", kgUnit:9.5, m3t:6.0, path:{rec:0.97, sto:0, lan:0.03}, steelFrac:0, carbon:1.07, carbonSrc:"nsw2010", lanType:"rubber", status:"reference", notes:"Rubber tyres, C&I/C&D (crumb substitutes synthetic rubber; bead steel recovered). 9.5 kg per passenger tyre is a YES assumption."},
    {k:"whitegoods", name:"White goods", unit:"count", unitLabel:"appliances", kgUnit:60, m3t:4.0, path:{rec:0.85, sto:0, lan:0.15}, steelFrac:0.75, steelRecovery:1, carbon:null, lanType:"ci", interim:true, status:"assumption", notes:"60 kg per appliance and 75% steel by mass are YES assumptions. Non-steel fraction: no avoided emissions claimed; residual at the interim C&I factor."},
    {k:"ewaste", name:"E-waste", unit:"t", unitLabel:"tonnes", m3t:3.0, path:{rec:0.85, sto:0.15, lan:0}, steelFrac:0, carbon:null, lanType:"inert", status:"pending", notes:"Recovered mass is counted; no avoided-emissions factor in the library yet (AS/NZS 5377 pathway via a downstream partner). E-waste is banned from landfill in Victoria."},
    {k:"clothing", name:"Clothing & textiles", unit:"t", unitLabel:"tonnes", m3t:5.0, path:{rec:0.6, sto:0.4, lan:0}, steelFrac:0, carbon:null, lanType:"textiles", status:"pending", notes:"Reuse via Recycle Warehouse counted as recycled; balance Stored awaiting a textile processor. No avoided emissions claimed."},
    {k:"concrete", name:"Concrete, bricks & rubble", unit:"t", unitLabel:"tonnes", m3t:0.7, path:{rec:1, sto:0, lan:0}, steelFrac:0, carbon:0.02, carbonSrc:"nsw2010", lanType:"inert", status:"reference", notes:"Crushed and screened to aggregate. Low per-tonne factor; large tonnages."},
    {k:"vehicles", name:"Vehicles", unit:"count", unitLabel:"vehicles", kgUnit:1200, m3t:3.0, path:{rec:0.7, sto:0, lan:0.3}, steelFrac:0.7, steelRecovery:1, carbon:null, lanType:"ci", interim:true, status:"assumption", notes:"1,200 kg and 70% steel by mass are YES assumptions; shredder residue landfilled at the interim C&I factor. Non-steel fraction: no avoided emissions claimed."},
    {k:"greenwaste", name:"Green waste", unit:"t", unitLabel:"tonnes", m3t:4.0, path:{rec:1, sto:0, lan:0}, steelFrac:0, carbon:0.32, carbonSrc:"nsw2010", lanType:"garden", status:"reference", notes:"Garden organics, kerbside pathway, composted."},
    {k:"general", name:"General rubbish", unit:"t", unitLabel:"tonnes", m3t:4.0, path:{rec:0, sto:0, lan:1}, steelFrac:0, carbon:null, lanType:"msw", lanTypeBusiness:"ci", status:"reference", notes:"Residual waste to landfill. Counts against the customer. NGA mixed municipal factor for councils, mixed C&I for business. Volume shown is what went in, not what was avoided."}
  ];
  B.CAT = {}; B.CATS.forEach(function(c){B.CAT[c.k]=c;});
  B.STEEL = STEEL;
  B.EQUIV = {carT:4.16, carSrc:"nsw2010", carNote:"NSW DECCW 2010 indicator: a family vehicle is assumed to emit 4.16 t CO₂-e over its lifetime ('cars permanently retired'). Applied to the avoided-emissions estimate to show scale. It is not a claim that cars were removed from the road."};

  B.lanType = function(c, opts){ return (opts && opts.sector==="business" && c.lanTypeBusiness) || c.lanType || "ci"; };
  B.lanFactor = function(c, opts){ var f = B.NGA.f[B.lanType(c, opts)]; return f==null ? B.NGA.f.ci : f; };

  /* entries: [{k, qty, path?, ev?, sup?, km?}]
       sup:false = material the customer reports that YES/Recycle Group did not handle: no processing or transport attributed; landfilled share still at NGA.
     opts: {km: one-way distance to the processor for handled material (0 = transport excluded), sector: "council" | "business"} */
  B.compute = function(entries, opts){
    opts = opts || {};
    var km0 = +opts.km || 0;
    var tot = {inT:0, recT:0, stoT:0, lanT:0, steelT:0, avoided:0, co2:0, cat5:0, cat5Proc:0, cat5Tr:0, cat5Lan:0, baseline:0, interimT:0, volAvoided:0, volLandfilled:0, byCat:{}, pendingCats:[], units:{}, evMass:0, km:km0, sector:opts.sector||"council"};
    entries.forEach(function(e){
      var c = B.CAT[e.k]; if(!c) return;
      var qty = +e.qty || 0; if(qty<=0) return;
      var mass = c.unit==="count" ? qty*c.kgUnit/1000 : qty;
      var p = e.path || c.path;
      var rec = mass*p.rec, sto = mass*p.sto, lan = mass*p.lan;
      // Figure B: avoided emissions. Steel is credited only on the recycled portion: a landfilled or stored load claims none.
      var steel = 0, av = 0;
      if(c.steelFrac>0){
        steel = Math.min(mass*c.steelFrac*(c.steelRecovery||1), rec);
        av += steel*STEEL.f;
      }
      if(c.carbon!=null){ av += (rec - steel)*c.carbon; }
      else if(c.status==="pending" && rec>0 && tot.pendingCats.indexOf(c.name)<0){ tot.pendingCats.push(c.name); }
      // Figure A: Category 5 inventory
      var handled = e.sup !== false;
      var lanF = B.lanFactor(c, opts);
      var proc = handled ? mass*B.PROC.f : 0;
      var km = e.km!=null ? (+e.km||0) : (handled ? km0 : 0);
      var tr = km>0 ? mass*km*B.TRANSPORT.f : 0;
      var lanE = lan*lanF;
      var cat5 = proc + tr + lanE;
      // Figure C: landfill comparison
      var base = mass*lanF;
      var volLan = lan*c.m3t*(c.k==="mattresses"?0.25:1);
      var vol = mass*c.m3t - volLan;
      tot.inT+=mass; tot.recT+=rec; tot.stoT+=sto; tot.lanT+=lan; tot.steelT+=steel; tot.avoided+=av;
      tot.cat5+=cat5; tot.cat5Proc+=proc; tot.cat5Tr+=tr; tot.cat5Lan+=lanE; tot.baseline+=base;
      if(c.interim && lan>0) tot.interimT+=lan;
      tot.volAvoided+=vol; tot.volLandfilled+=volLan;
      tot.units[c.k]=(tot.units[c.k]||0)+qty;
      tot.evMass += mass*(e.ev!=null?e.ev:1);
      var b = tot.byCat[c.k] || (tot.byCat[c.k]={k:c.k,name:c.name,qty:0,mass:0,rec:0,sto:0,lan:0,steel:0,co2:0,avoided:0,cat5:0,baseline:0,status:c.status});
      b.qty+=qty; b.mass+=mass; b.rec+=rec; b.sto+=sto; b.lan+=lan; b.steel+=steel; b.co2+=av; b.avoided+=av; b.cat5+=cat5; b.baseline+=base;
    });
    tot.co2 = tot.avoided;   // legacy alias: co2 always means the avoided-emissions estimate (Figure B)
    tot.recoveryRate = tot.inT>0 ? (tot.recT/tot.inT) : 0;
    tot.evidenceShare = tot.inT>0 ? (tot.evMass/tot.inT) : 0;
    tot.intensity = tot.inT>0 ? (tot.avoided/tot.inT) : 0;
    tot.cat5Intensity = tot.inT>0 ? (tot.cat5/tot.inT) : 0;
    tot.belowBaseline = tot.baseline - tot.cat5;   // can be negative for metal-only loads (inert in landfill); context only
    tot.cars = tot.avoided/B.EQUIV.carT;
    tot.score = B.score(tot);
    return tot;
  };

  B.SCORE = {version:"v0.1", status:"proposed", weights:{recovery:60, carbon:25, evidence:15}, refIntensity:0.5,
    disclaimer:"Self-declared under the published YES Method. Not an accredited rating, certification or third-party verification.",
    note:"Material recovery rate 60% (recycled ÷ handed over) · Carbon performance 25% (estimated avoided emissions per tonne handed over, indexed to a reference intensity of 0.5 t/t, capped at 100%) · Evidence quality 15% (mass-weighted share backed by weighbridge dockets or processor certificates). Stored is neutral; Landfilled counts against through the recovery rate. The Category 5 inventory is never adjusted by the score."};
  B.score = function(t){
    var w=B.SCORE.weights;
    var rec = Math.max(0,Math.min(1,t.recoveryRate||0));
    var car = Math.max(0,Math.min(1,(t.intensity||0)/B.SCORE.refIntensity));
    var ev  = Math.max(0,Math.min(1,t.evidenceShare==null?1:t.evidenceShare));
    var parts = {recovery:rec*w.recovery, carbon:car*w.carbon, evidence:ev*w.evidence};
    var score = Math.round(parts.recovery+parts.carbon+parts.evidence);
    return {score:score, parts:parts, band: score>=80?"Leading":score>=60?"Strong":score>=40?"Developing":"Starting"};
  };

  /* One wording for every surface (from the claims register). Pages read these instead of writing their own. */
  B.CLAIMS = {
    cat5:"Scope 3 Category 5 (waste generated in operations). GHG Protocol waste-type-specific method, supplier-specific where metered. NGA landfill factors.",
    avoided:"Estimated avoided emissions: a modelled estimate using NSW DECCW 2010 life-cycle factors. Reported separately from the inventory. Not deducted from it, not an offset and not a carbon-neutral claim.",
    baseline:"Landfill comparison: the same tonnes had they all gone to landfill, at the same NGA factors. Context only, not an inventory figure.",
    score:"Self-declared under the published YES Method. Not an accredited rating, certification or third-party verification.",
    steel:"Recycle Group's stated plant yield. Each report prints the measured yield with its site and study date.",
    recycled:"Recycled means baled or sorted material delivered to a licensed reprocessor, with a receiving docket. Stored material is reported separately and is not counted as recycled.",
    issuer:"Issued by Recycle Group as the processing operator. Not independently assured."
  };

  /* The worked example used on every page and in the method specification: 1,000 mattresses, 120 km to the processor. */
  B.EXAMPLE = {entries:[{k:"mattresses", qty:1000}], km:120, label:"1,000 mattresses · 120 km to the processor"};

  /* ---- Targets, potential and recommended help (proposed, YES Method v1.0 draft) -------------------------------
     Three numbers on the dashboard and the report: the YES Score now, the score at the 2030 targets, and an
     estimate with the recommended help done, plus the roadmap behind the estimate. Recommendations come from the
     published rules below: the same figures give the same recommendations, any provider can do the work, and work by
     a Recycle Group business is disclosed. Every effect is an assumption for discussion, applied to the handover
     entries and recalculated by B.compute, so the estimate uses the same engine as the score. */
  B.TARGETS = [
    {k:"recovery", v:0.8, name:"Resource recovery rate 80%", src:"National Waste Policy Action Plan (2024): 80% average resource recovery rate from all waste streams by 2030"},
    {k:"evidence", v:1, name:"Every tonne on Grade A evidence", src:"YES standard for a report: a weighbridge docket or processor certificate behind every tonne"}
  ];
  B.atTargets = function(t){
    var x = {recoveryRate:Math.max(t.recoveryRate||0, B.TARGETS[0].v), intensity:t.intensity||0, evidenceShare:Math.max(t.evidenceShare==null?1:t.evidenceShare, B.TARGETS[1].v)};
    return B.score(x);
  };
  B.rawScore = function(sc){ return sc.parts.recovery + sc.parts.carbon + sc.parts.evidence; };

  // month keys, "2026-09"
  var MS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  B.mkey = function(y,m){ return y+"-"+(m<9?"0":"")+(m+1); };
  B.mparse = function(k){ var p=k.split("-"); return {y:+p[0], m:+p[1]-1}; };
  B.addMonths = function(k,n){ var p=B.mparse(k), t=p.y*12+p.m+n; return B.mkey(Math.floor(t/12), t%12); };
  B.monthsBetween = function(a,b){ var p=B.mparse(a), q=B.mparse(b); return (q.y*12+q.m)-(p.y*12+p.m); };
  B.mlabel = function(k){ var p=B.mparse(k); return MS[p.m]+" "+p.y; };
  B.mshort = function(k){ var p=B.mparse(k); return MS[p.m]+" "+String(p.y).slice(2); };
  B.qLabel = function(q){ var p=B.mparse(q); return MS[p.m]+"–"+MS[p.m+2]+" "+p.y; };
  B.HELP_RAMP = 6;      // months for a change to build up to full effect
  B.HELP_HORIZON = 18;  // months projected

  function f0(v){ return Math.round(v).toLocaleString("en-AU"); }
  function f1(v){ return (+v).toLocaleString("en-AU",{minimumFractionDigits:1,maximumFractionDigits:1}); }
  function pc(v){ return f1(v*100)+"%"; }
  function list(a){ return a.length<2 ? a.join("") : a.slice(0,-1).join(", ")+" and "+a[a.length-1]; }
  function pathOf(e){ var p=e.path||(B.CAT[e.k]&&B.CAT[e.k].path)||{rec:0,sto:0,lan:1}; return {rec:p.rec, sto:p.sto, lan:p.lan}; }
  B.cloneEntries = function(E){ return E.map(function(e){ var c={}; for(var k in e) c[k]=e[k]; if(e.path) c.path={rec:e.path.rec,sto:e.path.sto,lan:e.path.lan}; return c; }); };

  B.PROVIDERS = {
    group:{label:"Recycle Group business", note:"Disclosed on your report"},
    partner:{label:"Independent specialist", note:"Chosen by you; YES can introduce one"},
    yes:{label:"YES analyst", note:"Not the operators who enter or verify your handovers"}
  };

  /* trigger(c) returns {why} when the figures call for it (c = {t, entries, opts}); apply(entries, f) changes the entries at strength f (0 to 1). */
  B.HELP = [
    { k:"hardwaste", title:"Booked hard-waste collections", area:"Landfill", prov:"group", groupNames:"JUNK",
      what:"Residents book a pick-up instead of piling hard waste on the kerb, so items arrive intact and sorted and more of them are recovered.",
      who:"JUNK runs the booked collections and sorts at pick-up.",
      modes:["On site","Online"], session:"90-minute planning session",
      rule:"General rubbish to landfill is 5% or more of the tonnes handed over.",
      effectText:"A quarter of general rubbish is sorted out and recovered. No avoided emissions are claimed for it, because its mix is unknown.",
      trigger:function(c){ var g=c.t.byCat.general; if(!g||!(g.lan>0)||g.lan/c.t.inT<0.05) return null;
        return {why:f0(g.lan)+" t of general rubbish went to landfill: "+pc(g.lan/c.t.inT)+" of everything handed over, and "+pc(g.lan/c.t.lanT)+" of all landfilled tonnes."}; },
      apply:function(E,f){ E.forEach(function(e){ if(e.k!=="general") return; var p=pathOf(e), mv=p.lan*0.25*f; e.path={rec:p.rec+mv, sto:p.sto, lan:p.lan-mv}; }); }
    },
    { k:"stored", title:"Clear stored stock", area:"Stored", prov:"partner",
      what:"Move stored clothing, textiles and e-waste on to reuse and licensed recycling, so those tonnes count as recovered.",
      who:"A textile processor and an AS/NZS 5377 e-waste recycler, arranged through Recycle Group.",
      modes:["On site","Online"], session:"Stock review",
      rule:"Clothing, textiles or e-waste are held as Stored.",
      effectText:"Stored clothing, textiles and e-waste are reused or recycled. Treated timber stays stored until it has a pathway.",
      trigger:function(c){ var a=[], tot=0; ["clothing","ewaste"].forEach(function(k){ var b=c.t.byCat[k]; if(b&&b.sto>0.05){ a.push((k==="clothing"?"clothing and textiles ":"e-waste ")+f1(b.sto)+" t"); tot+=b.sto; } });
        if(tot<0.5) return null; return {why:f1(tot)+" t is held as Stored: "+list(a)+". Stored counts as neither recycled nor landfilled until it moves."}; },
      apply:function(E,f){ E.forEach(function(e){ if(e.k!=="clothing"&&e.k!=="ewaste") return; var p=pathOf(e), mv=p.sto*f; e.path={rec:p.rec+mv, sto:p.sto-mv, lan:p.lan}; }); }
    },
    { k:"evidence", title:"Docket every load", area:"Evidence", prov:"yes",
      what:"Set up weighbridge dockets or processor certificates for the streams still on count sheets, so every tonne is on Grade A evidence.",
      who:"A YES analyst who does not enter or verify your handovers.",
      modes:["Online","On site"], session:"One-hour session",
      rule:"Less than 95% of tonnes is backed by a weighbridge docket or processor certificate.",
      effectText:"Every tonne is backed by a docket or certificate: evidence share 100%.",
      trigger:function(c){ if(!(c.t.evidenceShare<0.95)) return null; var names=[];
        c.entries.forEach(function(e){ if(e.ev!=null&&e.ev<1&&B.CAT[e.k]&&!e.gap){ var n=B.CAT[e.k].name.toLowerCase(); if(names.indexOf(n)<0) names.push(n); } });
        return {why:pc(c.t.evidenceShare)+" of tonnes is backed by a weighbridge docket or processor certificate."+(names.length?" Partly on count sheets: "+list(names)+".":"")}; },
      apply:function(E,f){ E.forEach(function(e){ var v=e.ev==null?1:e.ev; e.ev=v+(1-v)*f; }); }
    },
    { k:"residual", title:"Residual composition audit", area:"Inventory", prov:"partner",
      what:"Sample the landfilled residual from mattresses, white goods and vehicles so its landfill factor is measured, not the interim mixed figure.",
      who:"An independent waste auditor, working with YES.",
      modes:["On site"], session:"Scoping visit",
      rule:"Landfilled residual is reported at the interim mixed commercial and industrial factor.",
      effectText:"No change to the score. Your Category 5 inventory uses a measured factor for the residual instead of the interim one, which may move it up or down.",
      trigger:function(c){ if(!(c.t.interimT>1)) return null; return {why:f1(c.t.interimT)+" t of landfilled residual is reported at the interim mixed C&I factor ("+B.NGA.f.ci+" t CO₂-e per t) until an audit measures its composition."}; },
      apply:function(){}
    },
    { k:"scope3", title:"Auditor-ready Category 5 pack", area:"Inventory", prov:"yes", only:"business",
      what:"Your Category 5 figure, factors, evidence and ledger in the order an auditor asks for them, ready for your climate report.",
      who:"A YES analyst who does not enter or verify your handovers.",
      modes:["Online"], session:"One-hour session",
      rule:"Business customers, who report Scope 3 under mandatory climate reporting.",
      effectText:"No change to the score. Prepares your Category 5 figure for an auditor's review.",
      trigger:function(c){ if(c.opts.sector!=="business") return null; return {why:"Scope 3 is reported from each company's second year under mandatory climate reporting, and an auditor reviews it."}; },
      apply:function(){}
    },
    { k:"grants", title:"Grant application pack", area:"Funding", prov:"partner",
      what:"Match the recommended work to open state and federal funding rounds, with your YES figures as the evidence base.",
      who:"A grants writer.",
      modes:["Online"], session:"One-hour session",
      rule:"Two or more other recommendations apply.",
      effectText:"No direct change to the score. It can fund the other items.",
      trigger:function(c,n){ if(!(n>=2)) return null; return {why:n+" other recommendations apply to you. YES figures give a funding application its evidence base."}; },
      apply:function(){}
    }
  ];
  B.HELP_BY = {}; B.HELP.forEach(function(h){ B.HELP_BY[h.k]=h; });

  /* What one item changes on its own, at full effect: points on the score and on each part, and tonnes. */
  B.helpUplift = function(h, entries, opts, t0){
    var E2=B.cloneEntries(entries); h.apply(E2,1);
    var t=B.compute(E2,opts), a=t0.score, b=t.score;
    return {score:B.rawScore(b)-B.rawScore(a), recovery:b.parts.recovery-a.parts.recovery, carbon:b.parts.carbon-a.parts.carbon, evidence:b.parts.evidence-a.parts.evidence,
      recPts:(t.recoveryRate-t0.recoveryRate)*100, lanT:t0.lanT-t.lanT, cat5:t0.cat5-t.cat5};
  };
  /* Recommendations, biggest estimated change first; items with no score change after; the grant pack last. */
  B.helpFor = function(entries, opts){
    opts=opts||{}; var t=B.compute(entries,opts), c={t:t, entries:entries, opts:opts}, out=[];
    B.HELP.forEach(function(h){ if(h.k==="grants") return; if(h.only && h.only!==(opts.sector||"council")) return; var r=h.trigger(c); if(r) out.push({k:h.k, h:h, title:h.title, why:r.why, up:B.helpUplift(h,entries,opts,t)}); });
    out.sort(function(x,y){ return y.up.score-x.up.score; });
    var g=B.HELP_BY.grants.trigger(c,out.length); if(g) out.push({k:"grants", h:B.HELP_BY.grants, title:B.HELP_BY.grants.title, why:g.why, up:B.helpUplift(B.HELP_BY.grants,entries,opts,t)});
    return out;
  };
  /* The roadmap. cfg: {now:"2026-09", bookings:[], off:{key:true}} */
  B.helpPlan = function(entries, opts, cfg){
    opts=opts||{}; cfg=cfg||{};
    var now=cfg.now, t=B.compute(entries,opts), at=B.atTargets(t), recs=B.helpFor(entries,opts), off=cfg.off||{};
    var live=(cfg.bookings||[]).filter(function(b){ return b.status!=="cancelled"; });
    var booked={}; live.forEach(function(b){ if((b.status==="requested"||b.status==="confirmed") && !booked[b.svc]) booked[b.svc]=b; });
    var done={}; live.forEach(function(b){ if(b.status==="completed" && b.doneMonth && B.monthsBetween(b.doneMonth,now)<6) done[b.svc]=b; });
    var items=recs.filter(function(r){ return !done[r.k]; }).map(function(r){ return {k:r.k, h:r.h, title:r.title, why:r.why, up:r.up, booking:booked[r.k]||null, off:!!off[r.k]}; });
    var anchor=B.addMonths(now,1), n=0;
    items.forEach(function(it){
      if(it.off){ it.start=null; return; }
      if(it.booking && it.booking.slot){ var bm=it.booking.slot.slice(0,7); it.start=bm>now?bm:anchor; return; }
      if(it.k==="grants"){ it.start=anchor; return; }
      it.start=B.addMonths(anchor, Math.floor(n/2)*3); n++;
    });
    var act=items.filter(function(it){ return it.start; });
    function ramp(start,m){ return Math.max(0,Math.min(1,(B.monthsBetween(start,m)+1)/B.HELP_RAMP)); }
    var last=B.addMonths(now,B.HELP_HORIZON); act.forEach(function(it){ var full=B.addMonths(it.start,B.HELP_RAMP-1); if(full>last) last=full; });
    var H=Math.min(24,B.monthsBetween(now,last)), proj=[];
    for(var j=1;j<=H;j++){ var mk=B.addMonths(now,j), E2=B.cloneEntries(entries); act.forEach(function(it){ var f=ramp(it.start,mk); if(f>0) it.h.apply(E2,f); }); proj.push({month:mk, v:B.compute(E2,opts).score.score}); }
    var Ep=B.cloneEntries(entries); act.forEach(function(it){ it.h.apply(Ep,1); }); var tp=B.compute(Ep,opts);
    var qs=[], q=(function(k){ var p=B.mparse(k); return B.mkey(p.y,p.m-p.m%3); })(anchor), end=B.addMonths(now,H);
    while(q<=end){ var qe=B.addMonths(q,2), em=qe<=end?qe:end, pr=proj.filter(function(p){ return p.month===em; })[0];
      qs.push({q:q, label:B.qLabel(q), end:em, starts:act.filter(function(it){ return it.start>=q&&it.start<=qe; }), full:act.filter(function(it){ var fm=B.addMonths(it.start,B.HELP_RAMP-1); return fm>=q&&fm<=qe&&it.k!=="grants"; }), score:pr?pr.v:null});
      q=B.addMonths(q,3); }
    return {now:now, t:t, score:t.score, target:at, potential:tp.score, tp:tp, items:items, active:act, done:Object.keys(done).map(function(k){ return done[k]; }), proj:proj, quarters:qs,
      recPts:(tp.recoveryRate-t.recoveryRate)*100, lanCut:Math.max(0,t.lanT-tp.lanT), cat5Cut:t.cat5-tp.cat5};
  };
  B.HELP_RULES = "Booked items start in the month booked. The others start from next month, two a quarter, biggest estimated change first. Each change builds up evenly over "+B.HELP_RAMP+" months, and every other stream is held at its current level. Work completed in the last six months is not recommended again.";
  B.INDEPENDENCE = [
    {k:"Published rules", d:"The rules and assumptions are published in the YES Method, and the same rules apply to every customer."},
    {k:"Any provider", d:"You can use any provider. Recommendations, your YES Score and the verification of your handovers do not depend on who does the work."},
    {k:"Disclosure", d:"Work by a Recycle Group business, such as JUNK, is disclosed on your report. YES is a Recycle Group business."},
    {k:"Only through the ledger", d:"Completed work changes your score only through the handovers YES enters and verifies afterwards, like any other change."},
    {k:"Separate people", d:"A YES analyst who runs a paid session for you does not enter or verify your handovers."},
    {k:"Estimates", d:"The score with YES help and the projection are estimates. They are not a promise, a guarantee or a target."}
  ];

  B.DEMO = {
    customer:"Hepburn Shire Council", program:"Hard waste program · FY2026–27 to date", badge:"DEMO DATA · ILLUSTRATIVE", km:120, sector:"council", now:"2026-09",
    bookings:[
      {id:"bk-demo-1", svc:"hardwaste", status:"confirmed", slot:"2026-10-14T09:00", mode:"On site", location:"Hepburn Shire depot, Creswick", contact:"Council waste officer (demo)", email:"waste@hepburn.example", notes:"Plan the next hard waste sweep as booked collections.", share:true, demo:true}
    ],
    entries:[
      {k:"mattresses", qty:1000, ev:0.8}, {k:"steel", qty:40}, {k:"aluminium", qty:3.2}, {k:"timber_plain", qty:60}, {k:"timber_coloured", qty:25},
      {k:"tyres", qty:800, ev:0.8}, {k:"whitegoods", qty:600, ev:0.8}, {k:"ewaste", qty:12}, {k:"clothing", qty:8, ev:0.8}, {k:"concrete", qty:150},
      {k:"vehicles", qty:40, ev:0.8}, {k:"greenwaste", qty:220}, {k:"general", qty:180, ev:0.8}
    ],
    trend:[{m:"Oct",t:31},{m:"Nov",t:38},{m:"Dec",t:27},{m:"Jan",t:22},{m:"Feb",t:35},{m:"Mar",t:44},{m:"Apr",t:39},{m:"May",t:41},{m:"Jun",t:36},{m:"Jul",t:48},{m:"Aug",t:52},{m:"Sep",t:178}],
    ledger:[ {d:"27 Sep", what:"Hard waste sweep · Clunes · day 7 · mattresses", k:"mattresses", qty:132, by:"YES · RO"}, {d:"26 Sep", what:"Transfer station · scrap steel · weighbridge 4471", k:"steel", qty:6.4, by:"YES · RO"}, {d:"25 Sep", what:"Hard waste sweep · Clunes · day 6 · white goods", k:"whitegoods", qty:88, by:"YES · RO"}, {d:"24 Sep", what:"Transfer station · green waste · weighbridge 4462", k:"greenwaste", qty:18.2, by:"YES · RO"}, {d:"23 Sep", what:"Hard waste sweep · Clunes · day 5 · tyres", k:"tyres", qty:140, by:"YES · RO"}, {d:"22 Sep", what:"Depot clearance · aluminium · docket 1187", k:"aluminium", qty:0.9, by:"YES · RO"}, {d:"22 Sep", what:"Hard waste sweep · Clunes · day 4 · general rubbish", k:"general", qty:14.5, by:"YES · RO"} ]
  };
})(window.YES);
