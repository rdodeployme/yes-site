/* YES Method v1.0 (draft): factor library, calculation engine and the proposed YES Score.
   Single source of truth for the demo dashboard, the calculator, the certificate and the method page.

   Two numbers, never netted (GHG Protocol Scope 3 Technical Guidance, Category 5):
     Figure A · Scope 3 Category 5 inventory = processing (supplier-specific) + transport (optional) + landfilled tonnes × NGA landfill factor
     Figure B · Avoided emissions = recovered tonnes × NSW DECCW 2010 life-cycle factor. Reported separately; never deducted from Figure A; not an offset.
     Figure C · Landfill comparison = the same tonnes had they all been landfilled, at the same NGA factors. Context only.

   status: "reference" = published external source · "group" = Recycle Group / TMRC stated figure
           "assumption" = YES working assumption, to be replaced · "illustrative" = derived placeholder, replaced by metered data before the first certificate
           "pending" = no avoided-emissions factor yet; none claimed
*/
window.YES = window.YES || {};
(function(B){
  B.METHOD_VERSION = "v1.0 draft";
  B.SOURCES = {
    nsw2010: {id:"NSW DECCW 2010", title:"Environmental benefits of recycling", detail:"Department of Environment, Climate Change and Water NSW, June 2010 (DECCW 2010/58, ISBN 978 1 74232 530 9). Table 4: net benefit of recycling 1 tonne of waste material, tonnes CO₂-e, C&I/C&D pathway unless noted. Used for avoided emissions only. Every factor from this source is flagged 2010 and is due for refresh.", url:"https://www.epa.nsw.gov.au/sites/default/files/100058-benefits-of-recycling.pdf"},
    nga: {id:"NGA landfill factors", title:"National Greenhouse Accounts landfill emission factors", detail:"DCCEEW National Greenhouse Accounts (NGA) solid-waste landfill factors, t CO₂-e per tonne landfilled, as reproduced in the Commonwealth Emissions Reporting Framework 2024–25 (Department of Finance, 30 June 2025). Used for the Category 5 inventory. Each certificate cites the NGA edition current at its reporting date.", url:"https://www.finance.gov.au/sites/default/files/2025-06/emissions-reporting-framework.pdf"},
    ghgp: {id:"GHG Protocol", title:"Technical Guidance for Calculating Scope 3 Emissions, Chapter 5 (Category 5: Waste generated in operations)", detail:"Waste-type-specific method: tonnes by waste type and treatment × waste-type-specific factor; supplier-specific where the processor meters its fuel and electricity. Avoided emissions from recycling are not included in, or deducted from, the Scope 3 inventory and may be reported separately.", url:"https://ghgprotocol.org/sites/default/files/2022-12/Ch5_GHGP_Tech.pdf"},
    rgops: {id:"RG operations (illustrative)", title:"Recycle Group processing and transport: illustrative working values", detail:"Processing: about 1,200 L diesel a day (two shredders plus loaders) at about 2.7 kg CO₂-e per litre, over 44 to 109 t processed a day, gives 0.03 to 0.07 t CO₂-e per tonne; 0.05 is used. Transport: 0.15 kg CO₂-e per tonne-km, rigid truck. Both are replaced by metered fuel and electricity records and fleet fuel data before the first customer certificate."},
    rg: {id:"Recycle Group", title:"Recycle Group / The Mattress Recycling Company stated processing figures", detail:"Per 10,000 mattresses: about 800 t in and about 270 t steel out; 99% of that steel recovered (stated plant yield, to be evidenced by a dated yield study). Shredded residual is 25% of original volume."},
    tmrc: {id:"TMRC", title:"The Mattress Recycling Company per-unit assumptions", detail:"Single 25 kg / 0.4 m³ · Double–Queen 66 kg / 0.8 m³ · King 78 kg / 1.1 m³. Steel-recovery percentages in this table (70–72%) conflict with the group's figure of about 30% of mass and are not used until reconciled."},
    big: {id:"YES assumption", title:"YES working assumption", detail:"Placeholder pending measured data from the Recycle Group weighbridge and processing records. Replaced before the first customer certificate."}
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
    {k:"mattresses", name:"Mattresses", unit:"count", unitLabel:"mattresses", kgUnit:80, m3t:8.75, path:{rec:0.334, sto:0, lan:0.666}, steelFrac:0.3375, steelRecovery:0.99, carbon:null, carbonSrc:null, lanType:"ci", interim:true, status:"group", notes:"80 kg average and about a third steel by mass, from Recycle Group's stated figures. Steel recovery 99% is the stated plant yield; each certificate prints the measured yield with its study date. Foam and fibre residual is shredded and landfilled at 25% of original volume (recovery trials under way); its landfill factor is the interim C&I figure until a composition audit. m³/t from 0.7 m³ per 80 kg mattress."},
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
    steel:"Recycle Group's stated plant yield. Each certificate prints the measured yield with its site and study date.",
    recycled:"Recycled means baled or sorted material delivered to a licensed reprocessor, with a receiving docket. Stored material is reported separately and is not counted as recycled.",
    issuer:"Issued by Recycle Group as the processing operator. Not independently assured."
  };

  /* The worked example used on every page and in the method specification: 1,000 mattresses, 120 km to the processor. */
  B.EXAMPLE = {entries:[{k:"mattresses", qty:1000}], km:120, label:"1,000 mattresses · 120 km to the processor"};

  B.DEMO = {
    customer:"Hepburn Shire Council", program:"Hard waste program · FY2026–27 to date", badge:"DEMO DATA · ILLUSTRATIVE", km:120, sector:"council",
    entries:[
      {k:"mattresses", qty:1000, ev:0.8}, {k:"steel", qty:40}, {k:"aluminium", qty:3.2}, {k:"timber_plain", qty:60}, {k:"timber_coloured", qty:25},
      {k:"tyres", qty:800, ev:0.8}, {k:"whitegoods", qty:600, ev:0.8}, {k:"ewaste", qty:12}, {k:"clothing", qty:8, ev:0.8}, {k:"concrete", qty:150},
      {k:"vehicles", qty:40, ev:0.8}, {k:"greenwaste", qty:220}, {k:"general", qty:180, ev:0.8}
    ],
    trend:[{m:"Oct",t:31},{m:"Nov",t:38},{m:"Dec",t:27},{m:"Jan",t:22},{m:"Feb",t:35},{m:"Mar",t:44},{m:"Apr",t:39},{m:"May",t:41},{m:"Jun",t:36},{m:"Jul",t:48},{m:"Aug",t:52},{m:"Sep",t:178}],
    ledger:[ {d:"27 Sep", what:"Hard waste sweep · Clunes · day 7 · mattresses", k:"mattresses", qty:132, by:"YES · RO"}, {d:"26 Sep", what:"Transfer station · scrap steel · weighbridge 4471", k:"steel", qty:6.4, by:"YES · RO"}, {d:"25 Sep", what:"Hard waste sweep · Clunes · day 6 · white goods", k:"whitegoods", qty:88, by:"YES · RO"}, {d:"24 Sep", what:"Transfer station · green waste · weighbridge 4462", k:"greenwaste", qty:18.2, by:"YES · RO"}, {d:"23 Sep", what:"Hard waste sweep · Clunes · day 5 · tyres", k:"tyres", qty:140, by:"YES · RO"}, {d:"22 Sep", what:"Depot clearance · aluminium · docket 1187", k:"aluminium", qty:0.9, by:"YES · RO"}, {d:"22 Sep", what:"Hard waste sweep · Clunes · day 4 · general rubbish", k:"general", qty:14.5, by:"YES · RO"} ]
  };
})(window.YES);
