/* Yarta demo data v0.1: fictional organisations for the unlisted prototype.
   Seeded, so every visitor sees the same numbers. None of these organisations is real.
   Depends on dictionary.js (window.YESD) and engine.js (window.YESE). Exposes window.YESDEMO. */
window.YESDEMO = window.YESDEMO || {};
(function(X, D, E){
  X.VERSION = "v0.1 draft";

  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  function r1(x){ return Math.round(x*10)/10; }
  function r0(x){ return Math.round(x); }
  function r2(x){ return Math.round(x*100)/100; }

  /* Seasonal shape by calendar month (0 = Jan). */
  var SOLAR = [150,130,112,85,62,50,55,72,95,120,138,150];         // kWh per kW installed, Victorian coast
  var HEAT  = [0.92,0.93,0.96,1.02,1.10,1.18,1.20,1.16,1.06,0.99,0.94,0.93]; // electricity
  var GAS   = [0.45,0.48,0.62,0.88,1.18,1.45,1.52,1.40,1.12,0.84,0.60,0.48];  // gas, with pools heated all year
  var WATER = [1.38,1.30,1.12,0.90,0.76,0.70,0.70,0.74,0.86,1.02,1.20,1.34];
  var WORKS = [1.10,1.08,1.04,0.98,0.94,0.90,0.90,0.94,1.00,1.06,1.10,1.02];  // road and parks works
  var GREEN = [0.86,0.80,0.84,0.98,1.02,0.86,0.80,0.90,1.10,1.30,1.34,1.10];
  var TREES = [0.15,0.10,0.20,0.60,1.40,2.10,2.40,2.20,1.60,0.60,0.20,0.10];
  var PEOPLE= [0.55,0.80,0.95,0.90,0.95,1.55,0.85,0.95,1.05,1.10,1.60,0.60];  // June: World Environment Day; Nov: National Recycling Week

  /* Step changes: value of a static field from a month onward. */
  function stepVal(steps, k){ var v=steps[0][1]; steps.forEach(function(s){ if(k>=s[0]) v=s[1]; }); return v; }

  /* Build a council-like organisation. sc scales volumes; start/end are month keys; seed fixes the noise. */
  function build(opt){
    var rnd = mulberry32(opt.seed);
    function n(sd){ return 1 + (rnd()*2-1)*sd; }  // multiplicative noise
    var sc = opt.scale, recs = [], k = opt.start, idx = 0;
    var fleetSteps = opt.fleet;
    while(k <= opt.end){
      var p = E.parse(k), m = p.m, t = idx/12;           // t = years since start
      var fy25 = k >= "2025-07", fy26 = k >= "2026-07";
      var v = {};
      // ---- fleet (static composition carried as step changes)
      var F = stepVal(fleetSteps, k);
      if(idx===0 || fleetSteps.some(function(s){ return s[0]===k; })){
        v.veh_diesel=F.vd; v.veh_petrol=F.vp; v.veh_hybrid=F.vh; v.veh_phev=F.vphev; v.veh_bev=F.vbev;
        v.trucks_diesel=F.td; v.trucks_electric=F.te; v.plant_count=F.plant; v.plant_fuel="Diesel";
        v.ev_public_points=F.evp; v.ev_staff_points=F.evs; v.solar_kw=F.solar; v.solar_sites=F.solarSites; v.battery_kwh=F.batt;
        v.stewardship=F.stew;
      }
      var decline = Math.pow(1-opt.fuelDecline, t);
      v.diesel_l = r0(38400*sc*WORKS[m]*decline*n(.05));
      v.petrol_l = r0(9600*sc*Math.pow(1-opt.petrolDecline,t)*n(.06));
      v.lpg_l = r0(420*sc*n(.2));
      v.biodiesel_l = fy25 ? r0(1600*sc*n(.15)) : 0;
      v.fleet_km = r0(182000*sc*WORKS[m]*Math.pow(0.99,t)*n(.04));
      v.flights_dom = Math.max(0, r0(9*sc*n(.45)));
      v.flights_int = (m===4||m===9) && rnd()<0.6 ? 1 : 0;
      v.ev_public_kwh = r0(F.evp*520*(1+t*0.35)*n(.12));
      v.ev_staff_kwh = r0((F.vbev+F.vphev*0.5+F.te*6)*175*n(.1));
      v.idle_hours = k>="2025-01" ? r0(1180*sc*Math.pow(0.86,t)*n(.08)) : "";
      if(m%3===2){ v.veh_retired = r0(2+rnd()*4); v.veh_cleaner = Math.min(v.veh_retired, r0(v.veh_retired*(0.5+t*0.2))); }
      // ---- energy
      var gridBase = 640000*sc*HEAT[m]*Math.pow(1-opt.elecDecline,t);
      var solarGen = F.solar*SOLAR[m]*n(.08);
      v.solar_gen_kwh = r0(solarGen);
      v.solar_use_kwh = r0(solarGen*0.86);
      v.solar_exp_kwh = r0(solarGen*0.14);
      v.grid_kwh = r0((gridBase - solarGen*0.86)*n(.03));
      var renShare = k<"2025-01" ? 0.20 : k<"2025-07" ? 0.45 : k<"2026-07" ? 0.65 : 0.80;
      v.renew_kwh = r0(v.grid_kwh*renShare);
      v.battery_cycled = F.batt>0 ? r0(F.batt*14*n(.1)) : "";
      v.gas_gj = r1(760*sc*GAS[m]*Math.pow(1-opt.gasDecline,t)*n(.05));
      v.peak_kw = r0(1460*sc*HEAT[m]*n(.03));
      v.street_kwh = r0(176000*sc*Math.pow(0.93,t)*n(.02));
      if(m===5) v.street_led_pct = r0(Math.min(96, 58 + t*14));
      if(m%3===2){ v.gas_to_elec = rnd()<0.35+t*0.1 ? 1 : 0; v.led_conversions = r0(1+rnd()*3); v.ee_projects = r0(1+rnd()*3); v.ee_saved_kwh = r0((18000+rnd()*42000)*sc); }
      // ---- water
      var wd = Math.pow(1-opt.waterDecline,t);
      v.potable_kl = r0(19500*sc*WATER[m]*wd*n(.05));
      v.recycled_kl = r0((2600+t*900)*sc*WATER[m]*n(.08));
      v.rain_kl = r0(520*sc*(1.6-WATER[m]*0.7)*n(.2));
      v.storm_kl = fy25 ? r0(1800*sc*(1.5-WATER[m]*0.6)*n(.15)) : 0;
      v.ground_kl = 0; v.waste_water_kl = 0;
      if(m%3===2) v.leaks_fixed = r0(2+rnd()*4);
      // ---- waste (municipal service: kerbside, transfer station and council operations)
      var fogo = fy25 ? 1 : 0;
      v.landfill_t = r1((1640 - fogo*230 - t*40)*sc*n(.04));
      v.recycling_t = r1(565*sc*n(.05));
      v.organics_t = r1((455 + fogo*300)*sc*n(.05));
      v.green_t = r1(255*sc*GREEN[m]*n(.08));
      v.food_t = r1(2.2*sc*n(.3));
      v.paper_t = r1(41*sc*n(.08));
      v.glass_t = r1((62 + fogo*78)*sc*n(.08));
      v.steel_t = r1(46*sc*n(.1));
      v.alu_t = r1(4.1*sc*n(.15));
      v.timber_t = r1(58*sc*n(.12));
      v.timber_treated_t = r1(24*sc*n(.15));
      v.concrete_t = r1(176*sc*WORKS[m]*n(.2));
      v.rubble_t = r1(88*sc*n(.2));
      v.soil_t = r1(118*sc*WORKS[m]*n(.25));
      v.plaster_t = r1(7.8*sc*n(.2));
      v.mattress_n = r0(372*sc*n(.08));
      v.tyres_n = r0(248*sc*n(.12));
      v.ewaste_t = r1(9.2*sc*n(.15));
      v.whitegoods_n = r0(138*sc*n(.1));
      v.batteries_kg = r0(610*sc*n(.15));
      v.textiles_t = r1((11 + t*2)*sc*n(.12));
      v.furniture_t = r1((9 + t*4)*sc*n(.15));
      v.problem_kg = r0(1780*sc*n(.2));
      if(m%3===2) v.contam_pct = r1(Math.max(6, 14.2 - t*2.8 + (rnd()*2-1)));
      // ---- circular (quarterly spend)
      if(m%3===2){
        v.proc_total = r0(16200000*sc*n(.08));
        v.proc_recycled = r0(v.proc_total*(0.058 + t*0.03)*n(.08));
        v.recycled_products = r0((42 + t*38)*n(.1));
        v.proc_local = r0(v.proc_total*0.37*n(.05));
      }
      if(m===5) v.single_use = r0(3 + t*1.2);
      // ---- land and nature
      if(m%3===2){
        v.rehab_ha = r2((1.4 + t*0.5)*sc*n(.25));
        v.remediated_ha = rnd()<0.4 ? r2(0.3*sc*n(.3)) : 0;
        v.remediated_t = v.remediated_ha>0 ? r0(v.remediated_ha*900) : 0;
        v.soil_rehab_t = r0((90 + t*60)*sc*n(.3));
        v.native_veg_ha = r2((1.1 + t*0.45)*sc*n(.25));
        v.habitat_projects = r0(3 + t*1.2);
        v.habitat_ha = r2((2.2 + t*0.9)*sc*n(.2));
        v.wetland_ha = rnd()<0.5 ? r2(0.8*sc*n(.3)) : 0;
        v.weeds_ha = r0(36*sc*n(.25));
        v.monitoring_sites = r0(8 + t*2);
        v.monitoring_species = r0(34 + t*9);
      }
      if(m===5) v.protected_ha = r1((12 + t*6)*sc);
      v.trees = r0((190 + t*55)*sc*TREES[m]*n(.2));
      // ---- community and governance
      v.events = Math.max(1, r0((4.2 + t*0.9)*PEOPLE[m]*n(.25)));
      v.participants = r0((255 + t*70)*sc*PEOPLE[m]*n(.15));
      v.complaints = r0((5.5 - t*0.8)*n(.4));
      v.complaints_closed = Math.max(0, v.complaints - (rnd()<0.3?1:0));
      if(m%3===2) v.improve_projects = r0(2 + t*0.8 + rnd()*2);
      v.env_invest = r0((310000 + t*120000)*sc*n(.3));

      // ---- sector shape: multipliers, fields the sector does not report, and sector-specific streams
      if(opt.mix){ Object.keys(opt.mix).forEach(function(id){ if(typeof v[id]==="number") v[id] = (id.slice(-2)==="_n"||id==="trees"||id==="participants"||id==="events"||id==="complaints"||id==="complaints_closed"||id.slice(-3)==="_kg") ? r0(v[id]*opt.mix[id]) : r1(v[id]*opt.mix[id]); }); }
      if(opt.omit){ opt.omit.forEach(function(id){ v[id] = ""; }); }
      if(opt.extra){ opt.extra(v, {m:m, t:t, sc:sc, n:n, rnd:rnd, r0:r0, r1:r1, k:k}); }
      var mo = E.month(v, opt.profile);
      v.waste_total_t = r1(mo.recovered_t + (mo.landfill_t||0) + (mo.treated_t||0) + 22*sc*(opt.mix&&opt.mix.landfill_t!=null?opt.mix.landfill_t:1)*n(.3));  // small unrecorded residual

      // evidence grades per category: stronger documents as the program matures
      var ev = {};
      var G = function(a,b){ var x=rnd(); return x<a?"A":x<a+b?"B":"C"; };
      var mat = Math.min(1, t/1.5);
      [["fleet",.55,.35,"Fuel card statement"],["energy",.7,.25,"Retailer bills"],["water",.65,.3,"Water utility bills"],["waste",.5,.4,"Weighbridge dockets"],
       ["circular",.25,.5,"Finance system extract"],["land",.2,.5,"Project records"],["nature",.15,.45,"Planting records"],["community",.1,.45,"Event registrations"],["governance",.3,.5,"Complaints register extract"]]
       .forEach(function(c){ ev[c[0]] = {grade:G(c[1]+mat*0.25,c[2]), name:c[3]+" "+E.label(k)+".pdf", demo:true}; });
      recs.push({month:k, values:v, evidence:ev, status:"verified"});
      k = E.addMonths(k,1); idx++;
    }
    return recs;
  }

  function isoDay(k, day){ var p=E.parse(k); var nx=E.parse(E.addMonths(k,1)); return nx.y+"-"+(nx.m<9?"0":"")+(nx.m+1)+"-"+(day<10?"0":"")+day; }

  var ENTRY = "Morgan Lee", VERIFY = "Chris Walker";
  function finish(recs, opt){
    // statuses: verified up to verifiedTo; later months entered by Yarta and waiting for a second analyst to verify
    recs.forEach(function(r){
      r.enteredAt = isoDay(r.month, 9); r.enteredBy = ENTRY; r.submittedAt = r.enteredAt;
      if(r.month <= opt.verifiedTo){ r.status="verified"; r.verifiedAt = isoDay(r.month, 16); r.verifiedBy = VERIFY; }
      else { r.status="submitted"; delete r.verifiedAt; Object.keys(r.evidence).forEach(function(c){ r.evidence[c].grade = null; r.evidence[c].pending = true; }); }
      r.inbox = Object.keys(r.evidence).map(function(c){ return {name:r.evidence[c].name, cat:c, at:isoDay(r.month, 4), by:opt.contact, demo:true}; });
    });
    if(opt.draft){
      // the month Yarta is keying now: the customer's documents are in, fuel and energy are entered, the rest is still to do
      var last = recs[recs.length-1];
      var dk = E.addMonths(last.month,1);
      var dv = {};
      opt.draftFields.forEach(function(id){ if(last.values[id]!==undefined && last.values[id]!=="") dv[id] = last.values[id]; });
      if(dv.diesel_l) dv.diesel_l = Math.round(dv.diesel_l*1.03);
      if(dv.grid_kwh) dv.grid_kwh = Math.round(dv.grid_kwh*0.93);
      var lab = E.label(dk);
      var docs = [["fleet","Fuel card statement "+lab+".pdf"],["energy","Electricity retailer bills "+lab+".pdf"],["energy","Gas bill "+lab+".pdf"],["water","Water utility bill "+lab+".pdf"],["waste","Weighbridge dockets "+lab+".xlsx"],["community","Event registrations "+lab+".csv"]];
      recs.push({month:dk, values:dv, evidence:{fleet:{name:docs[0][1], pending:true, grade:null, demo:true}, energy:{name:docs[1][1], pending:true, grade:null, demo:true}}, status:"draft", enteredBy:ENTRY,
        inbox:docs.map(function(d,i){ return {name:d[1], cat:d[0], at:isoDay(dk, 3+i), by:opt.contact, demo:true}; })});
    }
    return recs;
  }

  var steps = [
    ["2024-07",{vd:48,vp:62,vh:14,vphev:2,vbev:4,td:38,te:0,plant:64,evp:4,evs:6,solar:480,solarSites:14,batt:0,stew:2}],
    ["2025-02",{vd:48,vp:58,vh:16,vphev:2,vbev:8,td:38,te:0,plant:64,evp:4,evs:8,solar:480,solarSites:14,batt:0,stew:2}],
    ["2025-10",{vd:46,vp:52,vh:16,vphev:4,vbev:14,td:38,te:0,plant:63,evp:6,evs:12,solar:720,solarSites:19,batt:0,stew:3}],
    ["2026-03",{vd:46,vp:46,vh:17,vphev:4,vbev:20,td:37,te:1,plant:63,evp:8,evs:16,solar:720,solarSites:19,batt:200,stew:3}],
    ["2026-07",{vd:45,vp:42,vh:18,vphev:4,vbev:24,td:37,te:1,plant:62,evp:8,evs:16,solar:760,solarSites:20,batt:200,stew:3}]
  ];

  X.ORGS = [
    {id:"demo-shire", profile:{org_name:"Demo Shire Council", org_type:"Council", state:"VIC", residents:48000, employees:420, floor_area:38000, facilities:26, baseline_fy:"2024–25",
      target_emissions:40, target_renewable:80, target_diversion:70, target_fleet_ev:30, target_trees:3500, target_rehab_ha:12, target_participants:5000, target_native_ha:16},
     gen:{seed:20240701, scale:1, start:"2024-07", end:"2026-08", verifiedTo:"2026-07", draft:false, contact:"Alex Morgan", fuelDecline:.06, petrolDecline:.12, elecDecline:.05, gasDecline:.12, waterDecline:.04, fleet:steps,
          draftFields:[]}},
    {id:"demo-coastal", profile:{org_name:"Demo Coastal Council", org_type:"Council", state:"NSW", residents:92000, employees:760, floor_area:61000, facilities:41, baseline_fy:"2025–26",
      target_emissions:35, target_renewable:70, target_diversion:65, target_fleet_ev:25, target_trees:6000, target_rehab_ha:20, target_participants:9000, target_native_ha:28},
     gen:{seed:20250701, scale:1.8, start:"2025-07", end:"2026-07", verifiedTo:"2026-06", draft:true, contact:"Sam Nguyen", fuelDecline:.04, petrolDecline:.08, elecDecline:.03, gasDecline:.06, waterDecline:.03,
          fleet:[["2025-07",{vd:80,vp:120,vh:30,vphev:6,vbev:12,td:70,te:0,plant:110,evp:6,evs:10,solar:900,solarSites:24,batt:0,stew:2}],["2026-01",{vd:78,vp:112,vh:34,vphev:6,vbev:22,td:69,te:1,plant:110,evp:10,evs:18,solar:900,solarSites:24,batt:0,stew:2}]],
          draftFields:["diesel_l","petrol_l","lpg_l","biodiesel_l","fleet_km","grid_kwh","renew_kwh","solar_gen_kwh","solar_use_kwh","solar_exp_kwh","gas_gj"]}},
    {id:"demo-freight", profile:{org_name:"Demo Freight Co.", org_type:"Business", state:"QLD", residents:0, employees:180, floor_area:22000, facilities:4, baseline_fy:"2025–26",
      target_emissions:25, target_renewable:50, target_diversion:75, target_fleet_ev:15, target_trees:400, target_rehab_ha:2, target_participants:900, target_native_ha:4},
     gen:{seed:20260101, scale:0.35, start:"2026-01", end:"2026-08", verifiedTo:"2026-06", draft:false, contact:"Jordan Blake", fuelDecline:.03, petrolDecline:.05, elecDecline:.02, gasDecline:.02, waterDecline:.02,
          fleet:[["2026-01",{vd:6,vp:8,vh:2,vphev:0,vbev:1,td:42,te:2,plant:12,evp:0,evs:4,solar:300,solarSites:2,batt:0,stew:1}]],
          draftFields:[]}}
  ];

  /* fields councils report that other sectors do not */
  var NOT_COUNCIL = ["street_kwh","street_led_pct","problem_kg","contam_pct","weeds_ha","monitoring_sites","monitoring_species","protected_ha","ev_public_points","ev_public_kwh"];
  var NO_NATURE = ["trees","native_veg_ha","habitat_projects","habitat_ha","wetland_ha","weeds_ha","monitoring_sites","monitoring_species","protected_ha"];
  var NO_LAND = ["rehab_ha","remediated_ha","remediated_t","soil_rehab_t"];
  var NO_CD = ["concrete_t","rubble_t","soil_t","plaster_t"];
  function fleet1(f){ return [["2025-07",f]]; }
  X.ORGS.push(
    {id:"demo-office", profile:{org_name:"Demo Advisory Group", org_type:"Business", sector:"business", state:"NSW", residents:0, employees:650, floor_area:9500, facilities:3, sites:3, baseline_fy:"2025–26",
      target_emissions:30, target_renewable:100, target_diversion:80, target_fleet_ev:50, target_trees:0, target_rehab_ha:0, target_participants:1200, target_native_ha:0},
     gen:{seed:20250711, scale:0.4, start:"2025-07", end:"2026-08", verifiedTo:"2026-07", draft:false, contact:"Priya Raman", fuelDecline:.08, petrolDecline:.15, elecDecline:.06, gasDecline:.2, waterDecline:.03,
          fleet:fleet1({vd:2,vp:6,vh:8,vphev:2,vbev:6,td:0,te:0,plant:0,evp:0,evs:6,solar:120,solarSites:1,batt:0,stew:2}),
          mix:{diesel_l:.05, petrol_l:.25, lpg_l:0, biodiesel_l:0, fleet_km:.12, flights_dom:4, idle_hours:0, grid_kwh:.35, gas_gj:.15, peak_kw:.3, potable_kl:.05, recycled_kl:0, rain_kl:.1, storm_kl:0,
               landfill_t:.05, recycling_t:.06, organics_t:.02, green_t:0, food_t:3, paper_t:.6, glass_t:.03, steel_t:.01, alu_t:.05, timber_t:0, timber_treated_t:0, mattress_n:0, tyres_n:0, ewaste_t:.5, whitegoods_n:.02, batteries_kg:.15, textiles_t:.05, furniture_t:.4,
               participants:.35, events:.5, complaints:.15, env_invest:.3, proc_total:.6, proc_recycled:.8},
          omit:NOT_COUNCIL.concat(NO_NATURE, NO_LAND, NO_CD), draftFields:[]}},
    {id:"demo-hospital", profile:{org_name:"Demo Health Network", org_type:"Business", sector:"health", state:"VIC", residents:0, employees:3200, beds:420, floor_area:78000, facilities:6, baseline_fy:"2024–25",
      target_emissions:30, target_renewable:100, target_diversion:60, target_fleet_ev:40, target_trees:400, target_rehab_ha:0, target_participants:2500, target_native_ha:2},
     gen:{seed:20240715, scale:1.2, start:"2024-07", end:"2026-08", verifiedTo:"2026-07", draft:false, contact:"Dr Lena Okafor", fuelDecline:.05, petrolDecline:.1, elecDecline:.04, gasDecline:.08, waterDecline:.03,
          fleet:fleet1({vd:14,vp:30,vh:22,vphev:4,vbev:10,td:2,te:0,plant:0,evp:0,evs:10,solar:600,solarSites:3,batt:0,stew:3}),
          mix:{diesel_l:.12, petrol_l:.35, lpg_l:0, biodiesel_l:0, fleet_km:.3, flights_dom:2, idle_hours:0, grid_kwh:2.4, gas_gj:3.2, peak_kw:2, potable_kl:1.6, recycled_kl:.2, rain_kl:.3, storm_kl:0,
               landfill_t:.55, recycling_t:.35, organics_t:.12, green_t:.05, food_t:6, paper_t:1.1, glass_t:.1, steel_t:.15, alu_t:.2, timber_t:.05, timber_treated_t:.02, mattress_n:.15, tyres_n:0, ewaste_t:1.2, whitegoods_n:.1, batteries_kg:.6, textiles_t:.3, furniture_t:.5,
               trees:.06, native_veg_ha:.05, habitat_projects:.2, habitat_ha:.05, wetland_ha:0, participants:.45, events:.7, complaints:.3, env_invest:.8, proc_total:1.4, proc_recycled:1.2},
          omit:NOT_COUNCIL.concat(NO_LAND, NO_CD),
          extra:function(v,c){ v.clinical_t=c.r1(31*c.sc*(1+c.m%2*0.04)*c.n(.06)); v.sharps_kg=c.r0(760*c.sc*c.n(.1)); v.food_avoided_t=c.r1((0.9+c.t*0.6)*c.sc*c.n(.2)); },
          draftFields:[]}},
    {id:"demo-uni", profile:{org_name:"Demo University", org_type:"Other", sector:"education", state:"QLD", residents:0, employees:2400, students:28000, floor_area:210000, facilities:48, baseline_fy:"2024–25",
      target_emissions:50, target_renewable:100, target_diversion:75, target_fleet_ev:50, target_trees:4000, target_rehab_ha:4, target_participants:22000, target_native_ha:12},
     gen:{seed:20240722, scale:1.6, start:"2024-07", end:"2026-08", verifiedTo:"2026-07", draft:false, contact:"Tom Whitaker", fuelDecline:.07, petrolDecline:.12, elecDecline:.06, gasDecline:.15, waterDecline:.05,
          fleet:[["2024-07",{vd:8,vp:26,vh:18,vphev:6,vbev:12,td:3,te:0,plant:6,evp:6,evs:20,solar:2400,solarSites:22,batt:500,stew:3}],["2026-01",{vd:6,vp:20,vh:18,vphev:6,vbev:22,td:3,te:1,plant:6,evp:10,evs:30,solar:3100,solarSites:27,batt:500,stew:4}]],
          mix:{diesel_l:.14, petrol_l:.3, lpg_l:.1, biodiesel_l:0, fleet_km:.3, flights_dom:6, flights_int:1, idle_hours:0, grid_kwh:2.1, gas_gj:1.1, peak_kw:1.8, street_kwh:.3, potable_kl:1.3, recycled_kl:1.6, rain_kl:1.2, storm_kl:.8,
               landfill_t:.6, recycling_t:.7, organics_t:.3, green_t:.6, food_t:5, paper_t:1.6, glass_t:.3, steel_t:.2, alu_t:.3, timber_t:.2, timber_treated_t:.1, mattress_n:.2, tyres_n:.05, ewaste_t:2.2, whitegoods_n:.15, batteries_kg:.8, textiles_t:.4, furniture_t:2.2,
               trees:.6, native_veg_ha:.4, habitat_projects:.5, habitat_ha:.5, wetland_ha:.3, rehab_ha:.2, remediated_ha:0, remediated_t:0, soil_rehab_t:.1, participants:2.6, events:1.6, complaints:.3, env_invest:1.6, proc_total:1.5, proc_recycled:1.3},
          omit:["street_led_pct","problem_kg","contam_pct","weeds_ha","protected_ha","ev_public_points","ev_public_kwh"].concat(NO_CD),
          extra:function(v,c){ v.food_avoided_t=c.r1((0.6+c.t*0.5)*c.sc*c.n(.25)); },
          draftFields:[]}},
    {id:"demo-maker", profile:{org_name:"Demo Metal Works", org_type:"Business", sector:"manufacturing", state:"SA", residents:0, employees:340, floor_area:41000, facilities:2, sites:2, baseline_fy:"2024–25",
      target_emissions:35, target_renewable:80, target_diversion:85, target_fleet_ev:30, target_trees:0, target_rehab_ha:0, target_participants:400, target_native_ha:0},
     gen:{seed:20240729, scale:0.55, start:"2024-07", end:"2026-08", verifiedTo:"2026-07", draft:false, contact:"Marco Bellini", fuelDecline:.05, petrolDecline:.1, elecDecline:.05, gasDecline:.06, waterDecline:.04,
          fleet:fleet1({vd:6,vp:5,vh:2,vphev:0,vbev:2,td:8,te:0,plant:9,evp:0,evs:2,solar:900,solarSites:1,batt:0,stew:2}),
          mix:{diesel_l:.3, petrol_l:.15, lpg_l:6, biodiesel_l:0, fleet_km:.25, flights_dom:1.5, idle_hours:.5, grid_kwh:1.9, gas_gj:2.6, peak_kw:2.2, potable_kl:.55, recycled_kl:0, rain_kl:.4, storm_kl:0,
               landfill_t:.5, recycling_t:.15, organics_t:.03, green_t:0, food_t:.5, paper_t:1.3, glass_t:.02, steel_t:7, alu_t:3.5, timber_t:.6, timber_treated_t:.2, mattress_n:0, tyres_n:.1, ewaste_t:.4, whitegoods_n:0, batteries_kg:.5, textiles_t:.05, furniture_t:.1,
               participants:.15, events:.3, complaints:.4, env_invest:.7, proc_total:.9, proc_recycled:1.4},
          omit:NOT_COUNCIL.concat(NO_NATURE, NO_LAND, NO_CD),
          extra:function(v,c){ v.film_t=c.r1(4.2*c.sc*c.n(.15)); v.pallets_n=c.r0(1180*c.sc*c.n(.12)); v.oil_l=c.r0(640*c.sc*c.n(.2)); v.waste_water_kl=c.r0(420*c.sc*c.n(.15)); },
          draftFields:[]}},
    {id:"demo-builder", profile:{org_name:"Demo Build Group", org_type:"Business", sector:"construction", state:"WA", residents:0, employees:520, floor_area:6000, facilities:9, sites:9, baseline_fy:"2025–26",
      target_emissions:30, target_renewable:60, target_diversion:90, target_fleet_ev:20, target_trees:600, target_rehab_ha:14, target_participants:300, target_native_ha:5},
     gen:{seed:20250705, scale:0.9, start:"2025-07", end:"2026-08", verifiedTo:"2026-07", draft:false, contact:"Kate Lindqvist", fuelDecline:.03, petrolDecline:.06, elecDecline:.02, gasDecline:.02, waterDecline:.02,
          fleet:fleet1({vd:42,vp:18,vh:6,vphev:2,vbev:4,td:22,te:0,plant:38,evp:0,evs:4,solar:80,solarSites:1,batt:0,stew:1}),
          mix:{diesel_l:1.4, petrol_l:.5, lpg_l:.3, biodiesel_l:.5, fleet_km:1.2, flights_dom:1, idle_hours:1.6, grid_kwh:.22, gas_gj:.04, peak_kw:.2, potable_kl:.3, recycled_kl:.2, rain_kl:.6, storm_kl:0,
               landfill_t:1.2, recycling_t:.25, organics_t:.02, green_t:.3, food_t:.2, paper_t:.3, glass_t:.05, steel_t:1.6, alu_t:.6, timber_t:2.6, timber_treated_t:2.2, concrete_t:3.2, rubble_t:3, soil_t:4.2, plaster_t:3.4, mattress_n:0, tyres_n:.3, ewaste_t:.1, whitegoods_n:.05, batteries_kg:.3, textiles_t:0, furniture_t:.1,
               rehab_ha:1.6, remediated_ha:2.5, remediated_t:2.5, soil_rehab_t:2.4, trees:.15, native_veg_ha:.25, habitat_projects:.3, habitat_ha:.2, wetland_ha:.2, participants:.06, events:.2, complaints:.8, env_invest:.5, proc_total:1.8, proc_recycled:1.5},
          omit:NOT_COUNCIL,
          extra:function(v,c){ v.pallets_n=c.r0(420*c.sc*c.n(.2)); },
          draftFields:[]}},
    {id:"demo-retail", profile:{org_name:"Demo Grocers", org_type:"Business", sector:"retail", state:"NSW", residents:0, employees:1900, floor_area:52000, facilities:38, sites:38, baseline_fy:"2024–25",
      target_emissions:40, target_renewable:100, target_diversion:80, target_fleet_ev:40, target_trees:0, target_rehab_ha:0, target_participants:1600, target_native_ha:0},
     gen:{seed:20240708, scale:1.1, start:"2024-07", end:"2026-08", verifiedTo:"2026-07", draft:false, contact:"Hannah Park", fuelDecline:.06, petrolDecline:.1, elecDecline:.05, gasDecline:.1, waterDecline:.03,
          fleet:fleet1({vd:12,vp:10,vh:8,vphev:2,vbev:6,td:16,te:2,plant:0,evp:0,evs:8,solar:1400,solarSites:12,batt:200,stew:4}),
          mix:{diesel_l:.35, petrol_l:.2, lpg_l:.4, biodiesel_l:0, fleet_km:.4, flights_dom:.5, idle_hours:.3, grid_kwh:2.3, gas_gj:.3, peak_kw:2.4, potable_kl:.4, recycled_kl:0, rain_kl:.2, storm_kl:0,
               landfill_t:.7, recycling_t:.45, organics_t:.8, green_t:0, food_t:24, paper_t:4.2, glass_t:.2, steel_t:.1, alu_t:.15, timber_t:.3, timber_treated_t:0, mattress_n:0, tyres_n:0, ewaste_t:.3, whitegoods_n:.3, batteries_kg:1.2, textiles_t:.2, furniture_t:.2,
               participants:.3, events:.5, complaints:.4, env_invest:.9, proc_total:2.4, proc_recycled:1.6},
          omit:NOT_COUNCIL.concat(NO_NATURE, NO_LAND, NO_CD),
          extra:function(v,c){ v.film_t=c.r1(6.8*c.sc*c.n(.12)); v.pallets_n=c.r0(2600*c.sc*c.n(.1)); v.food_avoided_t=c.r1((9+c.t*5)*c.sc*c.n(.15)); },
          draftFields:[]}}
  );
  /* the freight operator gets its sector shape too */
  (function(){ var f=X.ORGS.filter(function(o){ return o.id==="demo-freight"; })[0]; f.profile.sector="logistics"; f.profile.vehicles=60;
    f.gen.mix={grid_kwh:.25, gas_gj:.05, potable_kl:.08, organics_t:.02, green_t:0, paper_t:.4, glass_t:.02, concrete_t:0, rubble_t:0, soil_t:0, plaster_t:0, mattress_n:0, whitegoods_n:.02, tyres_n:3.2, batteries_kg:2.2, textiles_t:0, furniture_t:.05, landfill_t:.3, recycling_t:.15, participants:.1, events:.2, trees:.02, diesel_l:2.6, fleet_km:3.4, idle_hours:2.2};
    f.gen.omit=NOT_COUNCIL.concat(NO_NATURE, NO_LAND);
    f.gen.extra=function(v,c){ v.oil_l=c.r0(2400*c.sc*c.n(.15)); v.pallets_n=c.r0(1500*c.sc*c.n(.15)); };
  })();
  /* councils carry the sector key too */
  X.ORGS.forEach(function(o){ if(o.profile.org_type==="Council") o.profile.sector="council"; });

  X.USERS = [
    {id:"u-alex", name:"Alex Morgan", title:"Sustainability Coordinator", email:"alex.morgan@demo-shire.example", role:"customer", org:"demo-shire"},
    {id:"u-sam", name:"Sam Nguyen", title:"Fleet and Facilities Manager", email:"sam.nguyen@demo-coastal.example", role:"customer", org:"demo-coastal"},
    {id:"u-jordan", name:"Jordan Blake", title:"Operations Lead", email:"jordan.blake@demo-freight.example", role:"customer", org:"demo-freight"},
    {id:"u-priya", name:"Priya Raman", title:"Head of Sustainability", email:"priya.raman@demo-advisory.example", role:"customer", org:"demo-office"},
    {id:"u-lena", name:"Dr Lena Okafor", title:"Director, Environmental Sustainability", email:"lena.okafor@demo-health.example", role:"customer", org:"demo-hospital"},
    {id:"u-tom", name:"Tom Whitaker", title:"Campus Sustainability Manager", email:"tom.whitaker@demo-uni.example", role:"customer", org:"demo-uni"},
    {id:"u-marco", name:"Marco Bellini", title:"Operations Manager", email:"marco.bellini@demo-metalworks.example", role:"customer", org:"demo-maker"},
    {id:"u-kate", name:"Kate Lindqvist", title:"HSEQ Manager", email:"kate.lindqvist@demo-build.example", role:"customer", org:"demo-builder"},
    {id:"u-hannah", name:"Hannah Park", title:"Sustainability Lead", email:"hannah.park@demo-grocers.example", role:"customer", org:"demo-retail"},
    {id:"u-entry", name:"Morgan Lee", title:"Data analyst · enters the figures", email:"morgan.lee@yes.example", role:"operator", org:null, home:"#/ops/entry"},
    {id:"u-verify", name:"Chris Walker", title:"Verification lead · checks and verifies", email:"chris.walker@yes.example", role:"operator", org:null, home:"#/ops"}
  ];

  /* Help booked from the roadmap. Demo Shire ran a hard-waste program in March 2026 and has a fleet session booked;
     Demo Coastal has asked for a contamination blitz. */
  X.BOOKINGS = [
    {id:"bk-demo-1", org:"demo-shire", svc:"hardwaste", status:"completed", slot:"2026-03-12T09:00", other:false, mode:"On site", location:"Demo Shire depot",
     contact:"Alex Morgan", email:"alex.morgan@demo-shire.example", notes:"Hard-waste collection week, including the mattresses and whitegoods stockpiled at the depot.", share:true,
     month:"2026-01", group:true, createdAt:"2026-02-20T00:00:00.000Z", createdBy:"Alex Morgan", confirmedBy:"Chris Walker", completedMonth:"2026-03", completedBy:"Chris Walker", demo:true},
    {id:"bk-demo-2", org:"demo-shire", svc:"fleet", status:"confirmed", slot:"2026-10-14T13:30", other:false, mode:"Online", location:"",
     contact:"Alex Morgan", email:"alex.morgan@demo-shire.example", notes:"Please include the vehicles due for replacement in 2027.", share:true,
     month:"2026-07", group:false, createdAt:"2026-09-02T00:00:00.000Z", createdBy:"Alex Morgan", confirmedBy:"Chris Walker", demo:true},
    {id:"bk-demo-3", org:"demo-coastal", svc:"contamination", status:"requested", slot:"2026-10-07T09:00", other:false, mode:"On site", location:"Demo Coastal Council transfer station",
     contact:"Sam Nguyen", email:"sam.nguyen@demo-coastal.example", notes:"Start with the streets that had the new glass bins.", share:true,
     month:"2026-06", group:false, createdAt:"2026-09-18T00:00:00.000Z", createdBy:"Sam Nguyen", demo:true}
  ];

  X.build = function(){
    var orgs = {};
    X.ORGS.forEach(function(o){
      var g = o.gen; g.profile = o.profile;
      var recs = finish(build(g), g);
      orgs[o.id] = {id:o.id, profile:JSON.parse(JSON.stringify(o.profile)), records:recs, demo:true};
    });
    Object.keys(orgs).forEach(function(id){ orgs[id].plan = {off:{}}; });
    return {v:4, created:new Date().toISOString(), orgs:orgs, users:X.USERS.slice(), session:null, audit:[], bookings:JSON.parse(JSON.stringify(X.BOOKINGS))};
  };
})(window.YESDEMO, window.YESD, window.YESE);
