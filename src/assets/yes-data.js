/* YES Method — factor library v0.1 (DRAFT), calculation engine and the proposed YES Score.
   Single source of truth for the demo dashboard, the calculator, the certificate and the method page.
   Every factor carries its source and status. Nothing here is a marketing number.
   status: "reference" = published external source · "group" = Recycle Group / TMRC stated figure · "assumption" = YES working assumption, to be replaced · "pending" = no factor yet; carbon not claimed
*/
window.YES = window.YES || {};
(function(B){
  B.METHOD_VERSION = "v0.1 draft";
  B.SOURCES = {
    nsw2010: {id:"NSW DECCW 2010", title:"Environmental benefits of recycling", detail:"Department of Environment, Climate Change and Water NSW, June 2010 (DECCW 2010/58, ISBN 978 1 74232 530 9). Table 4: net benefit of recycling 1 tonne of waste material, tonnes CO₂-e, C&I/C&D pathway unless noted. Basis of the NSW EPA Recyculator.", url:"https://www.epa.nsw.gov.au/sites/default/files/100058-benefits-of-recycling.pdf"},
    rg: {id:"Recycle Group", title:"Recycle Group / The Mattress Recycling Company stated processing figures", detail:"Per 10,000 mattresses: ≈800 t in, ≈270 t steel out, 99% of that steel recovered. Shredded residual is 25% of original volume."},
    tmrc: {id:"TMRC", title:"The Mattress Recycling Company per-unit assumptions", detail:"Single 25 kg / 0.4 m³ · Double–Queen 66 kg / 0.8 m³ · King 78 kg / 1.1 m³. Steel-recovery percentages in this table (70–72%) conflict with the group's ≈30%-of-mass figure and are not used until reconciled."},
    big: {id:"YES assumption", title:"YES working assumption", detail:"Placeholder pending measured data from the Recycle Group weighbridge and processing records. Replaced before first customer certificate."}
  };

  // Steel is the anchor factor for mattresses, white goods and vehicles.
  var STEEL = {f:0.44, src:"nsw2010", status:"reference", note:"Steel, C&I/C&D. Conservative LCA net figure (includes collection and reprocessing impacts). worldsteel's gross figure of ≈1.5 t CO₂-e per tonne of scrap is higher; YES uses the conservative figure by default."};

  // Categories — order matches Richard's list.
  // unit: "count" or "t". kgUnit: kg per unit for count categories. m3t: uncompacted m³ per tonne (landfill volume avoided) — assumption unless stated.
  // path: default pathway fractions for a handover to Recycle Group (recycled / stored / landfilled). Actual pathway is recorded per handover.
  // steelFrac: fraction of mass that is recoverable steel (drives the steel factor). carbon: factor for the non-steel recycled fraction.
  B.CATS = [
    {k:"mattresses", name:"Mattresses", unit:"count", unitLabel:"mattresses", kgUnit:80, m3t:8.75, path:{rec:0.334, sto:0, lan:0.666}, steelFrac:0.3375, steelRecovery:0.99, carbon:null, carbonSrc:null, status:"group",
      notes:"80 kg average and ≈30% steel by mass from Recycle Group's stated figures; 99% of steel recovered. Foam and fibre residual is shredded and landfilled at 25% of original volume (trials under way). m³/t from 0.7 m³ per 80 kg mattress."},
    {k:"steel", name:"Steel", unit:"t", unitLabel:"tonnes", m3t:0.6, path:{rec:0.99, sto:0, lan:0.01}, steelFrac:1, steelRecovery:1, carbon:null, status:"reference", notes:"Scrap steel to electric-arc-furnace route. 1% process loss assumed."},
    {k:"aluminium", name:"Aluminium", unit:"t", unitLabel:"tonnes", m3t:1.2, path:{rec:0.99, sto:0, lan:0.01}, steelFrac:0, carbon:17.72, carbonSrc:"nsw2010", status:"reference", notes:"Aluminium scrap, C&I/C&D. The highest per-tonne benefit of any common stream."},
    {k:"timber_plain", name:"Plain timber", unit:"t", unitLabel:"tonnes", m3t:2.5, path:{rec:0.95, sto:0, lan:0.05}, steelFrac:0, carbon:1.35, carbonSrc:"nsw2010", status:"reference", notes:"Modelled on timber pallets/packaging (avoided structural pine, non-reusable to mulch). 5% contamination loss assumed."},
    {k:"timber_coloured", name:"Coloured / treated timber", unit:"t", unitLabel:"tonnes", m3t:2.5, path:{rec:0, sto:0.2, lan:0.8}, steelFrac:0, carbon:null, status:"pending", notes:"Painted, treated or engineered timber. No recycling pathway modelled yet; lands in Stored while a pathway is sought, otherwise Landfilled. No carbon claimed."},
    {k:"tyres", name:"Tyres", unit:"count", unitLabel:"tyres", kgUnit:9.5, m3t:6.0, path:{rec:0.97, sto:0, lan:0.03}, steelFrac:0, carbon:1.07, carbonSrc:"nsw2010", status:"reference", notes:"Rubber tyres, C&I/C&D (crumb substitutes synthetic rubber; bead steel recovered). 9.5 kg per passenger tyre is a YES assumption."},
    {k:"whitegoods", name:"White goods", unit:"count", unitLabel:"appliances", kgUnit:60, m3t:4.0, path:{rec:0.85, sto:0, lan:0.15}, steelFrac:0.75, steelRecovery:1, carbon:null, status:"assumption", notes:"60 kg per appliance and 75% steel by mass are YES assumptions. Non-steel fraction: no carbon claimed."},
    {k:"ewaste", name:"E-waste", unit:"t", unitLabel:"tonnes", m3t:3.0, path:{rec:0.85, sto:0.15, lan:0}, steelFrac:0, carbon:null, status:"pending", notes:"Recovered mass is counted; no carbon factor in the library yet (AS/NZS 5377 pathway via downstream partner)."},
    {k:"clothing", name:"Clothing & textiles", unit:"t", unitLabel:"tonnes", m3t:5.0, path:{rec:0.6, sto:0.4, lan:0}, steelFrac:0, carbon:null, status:"pending", notes:"Reuse via Recycle Warehouse counted as recovered; balance Stored awaiting a textile processor. No carbon claimed."},
    {k:"concrete", name:"Concrete, bricks & rubble", unit:"t", unitLabel:"tonnes", m3t:0.7, path:{rec:1, sto:0, lan:0}, steelFrac:0, carbon:0.02, carbonSrc:"nsw2010", status:"reference", notes:"Crushed and screened to aggregate. Low per-tonne benefit; large tonnages."},
    {k:"vehicles", name:"Vehicles", unit:"count", unitLabel:"vehicles", kgUnit:1200, m3t:3.0, path:{rec:0.7, sto:0, lan:0.3}, steelFrac:0.7, steelRecovery:1, carbon:null, status:"assumption", notes:"1,200 kg and 70% steel by mass are YES assumptions; shredder residue landfilled. Non-steel fraction: no carbon claimed."},
    {k:"greenwaste", name:"Green waste", unit:"t", unitLabel:"tonnes", m3t:4.0, path:{rec:1, sto:0, lan:0}, steelFrac:0, carbon:0.32, carbonSrc:"nsw2010", status:"reference", notes:"Garden organics, kerbside pathway, composted."},
    {k:"general", name:"General rubbish", unit:"t", unitLabel:"tonnes", m3t:4.0, path:{rec:0, sto:0, lan:1}, steelFrac:0, carbon:null, status:"reference", notes:"Residual waste to landfill. Counts against the customer. Volume shown is what went in, not what was avoided."}
  ];
  B.CAT = {}; B.CATS.forEach(function(c){B.CAT[c.k]=c;});
  B.STEEL = STEEL;
  B.EQUIV = {carT:4.16, carSrc:"nsw2010", carNote:"A family vehicle is assumed to emit 4.16 t CO₂-e over its lifetime (NSW DECCW 2010) — 'cars permanently retired'."};

  // ---- engine -------------------------------------------------------------
  // entries: [{k, qty, path?}] where qty is in the category's unit; path overrides default fractions.
  B.compute = function(entries){
    var tot = {inT:0, recT:0, stoT:0, lanT:0, steelT:0, co2:0, co2Known:0, volAvoided:0, volLandfilled:0, byCat:{}, pendingCats:[], units:{}, evMass:0};
    entries.forEach(function(e){
      var c = B.CAT[e.k]; if(!c) return;
      var qty = +e.qty || 0; if(qty<=0) return;
      var mass = c.unit==="count" ? qty*c.kgUnit/1000 : qty;   // tonnes
      var p = e.path || c.path;
      var rec = mass*p.rec, sto = mass*p.sto, lan = mass*p.lan;
      var steel = 0, co2 = 0;
      if(c.steelFrac>0){
        // steel is only credited on the recycled portion: a landfilled or stored load claims none
        steel = Math.min(mass*c.steelFrac*(c.steelRecovery||1), rec);
        co2 += steel*STEEL.f;
      }
      if(c.carbon!=null){
        co2 += (rec - steel)*c.carbon;
      } else if(c.status==="pending" && rec>0 && tot.pendingCats.indexOf(c.name)<0){
        tot.pendingCats.push(c.name);
      }
      var volLan = lan*c.m3t*(c.k==="mattresses"?0.25:1);  // mattress residual is shredded to 25% volume
      var vol = mass*c.m3t - volLan;     // m³ kept out of landfill = what would have gone in, less what did
      tot.inT+=mass; tot.recT+=rec; tot.stoT+=sto; tot.lanT+=lan; tot.steelT+=steel; tot.co2+=co2; tot.volAvoided+=vol; tot.volLandfilled+=volLan;
      tot.units[c.k]=(tot.units[c.k]||0)+qty;
      tot.evMass += mass*(e.ev!=null?e.ev:1);   // evidence grade weight, 1 = weighbridge docket / processor certificate
      var b = tot.byCat[c.k] || (tot.byCat[c.k]={k:c.k,name:c.name,qty:0,mass:0,rec:0,sto:0,lan:0,steel:0,co2:0,status:c.status});
      b.qty+=qty; b.mass+=mass; b.rec+=rec; b.sto+=sto; b.lan+=lan; b.steel+=steel; b.co2+=co2;
    });
    tot.recoveryRate = tot.inT>0 ? (tot.recT/tot.inT) : 0;
    tot.evidenceShare = tot.inT>0 ? (tot.evMass/tot.inT) : 0;
    tot.intensity = tot.inT>0 ? (tot.co2/tot.inT) : 0;   // t CO₂-e avoided per tonne handed over
    tot.cars = tot.co2/B.EQUIV.carT;
    tot.score = B.score(tot);
    return tot;
  };

  // ---- YES Score v0.1 (PROPOSED) --------------------------------------------
  // One number out of 100 per customer per period. Weights and the reference intensity are YES's own published method, versioned; not an accredited rating.
  B.SCORE = {weights:{recovery:60, carbon:25, evidence:15}, refIntensity:0.5, status:"proposed",
    note:"Material recovery rate 60% (recycled ÷ handed over) · Carbon performance 25% (t CO₂-e avoided per tonne handed over, indexed to a reference intensity of 0.5 t/t, capped at 100%) · Evidence quality 15% (mass-weighted share backed by weighbridge dockets or processor certificates). Stored is neutral; Landfilled counts against through the recovery rate."};
  B.score = function(t){
    var w=B.SCORE.weights;
    var rec = Math.max(0,Math.min(1,t.recoveryRate||0));
    var car = Math.max(0,Math.min(1,(t.intensity||0)/B.SCORE.refIntensity));
    var ev  = Math.max(0,Math.min(1,t.evidenceShare==null?1:t.evidenceShare));
    var parts = {recovery:rec*w.recovery, carbon:car*w.carbon, evidence:ev*w.evidence};
    var score = Math.round(parts.recovery+parts.carbon+parts.evidence);
    return {score:score, parts:parts, band: score>=80?"Leading":score>=60?"Strong":score>=40?"Developing":"Starting"};
  };

  // ---- demo dataset: Hepburn Shire Council (DEMO DATA — illustrative, not council data) ----
  B.DEMO = {
    customer:"Hepburn Shire Council", program:"Hard waste program · FY2026–27 to date", badge:"DEMO DATA · ILLUSTRATIVE",
    entries:[
      {k:"mattresses", qty:1000, ev:0.8}, {k:"steel", qty:40}, {k:"aluminium", qty:3.2}, {k:"timber_plain", qty:60}, {k:"timber_coloured", qty:25},
      {k:"tyres", qty:800, ev:0.8}, {k:"whitegoods", qty:600, ev:0.8}, {k:"ewaste", qty:12}, {k:"clothing", qty:8, ev:0.8}, {k:"concrete", qty:150},
      {k:"vehicles", qty:40, ev:0.8}, {k:"greenwaste", qty:220}, {k:"general", qty:180, ev:0.8}
    ],
    // monthly recovered tonnes, illustrative (the September hard-waste sweep is the spike)
    trend:[{m:"Oct",t:31},{m:"Nov",t:38},{m:"Dec",t:27},{m:"Jan",t:22},{m:"Feb",t:35},{m:"Mar",t:44},{m:"Apr",t:39},{m:"May",t:41},{m:"Jun",t:36},{m:"Jul",t:48},{m:"Aug",t:52},{m:"Sep",t:178}],
    ledger:[
      {d:"27 Sep", what:"Hard waste sweep · Clunes · day 7 · mattresses", k:"mattresses", qty:132, by:"YES · RO"},
      {d:"26 Sep", what:"Transfer station · scrap steel · weighbridge 4471", k:"steel", qty:6.4, by:"YES · RO"},
      {d:"25 Sep", what:"Hard waste sweep · Clunes · day 6 · white goods", k:"whitegoods", qty:88, by:"YES · RO"},
      {d:"24 Sep", what:"Transfer station · green waste · weighbridge 4462", k:"greenwaste", qty:18.2, by:"YES · RO"},
      {d:"23 Sep", what:"Hard waste sweep · Clunes · day 5 · tyres", k:"tyres", qty:140, by:"YES · RO"},
      {d:"22 Sep", what:"Depot clearance · aluminium · docket 1187", k:"aluminium", qty:0.9, by:"YES · RO"},
      {d:"22 Sep", what:"Hard waste sweep · Clunes · day 4 · general rubbish", k:"general", qty:14.5, by:"YES · RO"}
    ]
  };
})(window.YES);
