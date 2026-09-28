/* YES calculation engine v0.1 (draft)
   Customers supply raw numbers; YES calculates emissions, intensities, rates, trends and scores.
   Depends on dictionary.js (window.YESD). Exposes window.YESE.
*/
window.YESE = window.YESE || {};
(function(E, D){
  E.VERSION = "v0.1 draft";

  /* Factors. Emissions: DCCEEW National Greenhouse Accounts Factors 2024, as reproduced in the
     Commonwealth Emissions Reporting Framework 2024–25 (Department of Finance, 30 June 2025).
     Avoided emissions: NSW DECCW 2010, Environmental benefits of recycling, Table 4 (flagged 2010). */
  E.FACTORS = {
    edition: "National Greenhouse Accounts Factors 2024 (DCCEEW), as reproduced in the Commonwealth Emissions Reporting Framework 2024–25",
    elec: { // kg CO2-e per kWh, location-based
      VIC:{s2:0.77,s3:0.09}, NSW:{s2:0.66,s3:0.04}, ACT:{s2:0.66,s3:0.04}, QLD:{s2:0.74,s3:0.10},
      SA:{s2:0.23,s3:0.05}, WA:{s2:0.51,s3:0.06}, TAS:{s2:0.15,s3:0.03}, NT:{s2:0.56,s3:0.07}
    },
    fuel: { // energy content GJ/kL; scope 1 and scope 3 kg CO2-e per GJ
      diesel:{gj:38.6, s1:70.5, s3:17.3, note:"Scope 1 is 70.41–70.50 kg/GJ by vehicle type; 70.5 used."},
      petrol:{gj:34.2, s1:67.62, s3:17.2},
      lpg:{gj:26.2, s1:61.00, s3:20.2},
      biodiesel:{gj:34.6, s1:2.50, s3:0}
    },
    gas:{s1:51.53, s3:{VIC:4.0, TAS:4.0, NSW:13.1, ACT:13.1, QLD:8.8, SA:10.7, WA:4.1, NT:4.0}}, // kg CO2-e per GJ (metro)
    landfill:{Council:1.6, Business:1.3, "Government agency":1.3, Other:1.3}, // t CO2-e per t: MSW 1.6, C&I 1.3
    avoided:{steel:0.44, alu:17.72, timber:1.35, green:0.32, concrete:0.02, tyres:1.07}, // t CO2-e per t recycled
    unit:{mattress:0.080, tyre:0.0095, whitegood:0.060} // tonnes per unit
  };
  E.DEFAULT_TARGETS = {target_emissions:30, target_renewable:50, target_diversion:70, target_fleet_ev:30, target_trees:2000, target_rehab_ha:10, target_participants:3000, target_native_ha:6};

  E.CLAIMS = {
    score:"Self-declared under the published YES method. Not an accredited rating, certification or third-party verification.",
    avoided:"Avoided emissions are a modelled estimate (NSW DECCW 2010 factors), reported separately. Never deducted from your emissions and never an offset.",
    flights:"Flights are recorded; their emissions factor is pending, so they are not yet in the totals."
  };

  function num(x){ x=+x; return isFinite(x)&&x>0?x:0; }
  function clamp(x){ return Math.max(0,Math.min(100,x)); }
  function has(v,k){ return v[k]!==undefined && v[k]!==null && v[k]!=="" && isFinite(+v[k]); }

  // month keys: "2026-08"
  E.key = function(y,m){ return y+"-"+(m<9?"0":"")+(m+1); };
  E.parse = function(k){ var p=k.split("-"); return {y:+p[0], m:+p[1]-1}; };
  E.addMonths = function(k,n){ var p=E.parse(k); var t=p.y*12+p.m+n; return E.key(Math.floor(t/12), t%12); };
  E.label = function(k){ var p=E.parse(k); return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][p.m]+" "+p.y; };
  E.fyOf = function(k){ var p=E.parse(k); var s=p.m>=6?p.y:p.y-1; return s+"–"+String(s+1).slice(2); };

  /* One month: v = values (static fields already carried forward), p = profile. */
  E.month = function(v, p){
    p = p||{};
    var st = E.FACTORS.elec[p.state] ? p.state : "VIC";
    var el = E.FACTORS.elec[st], F = E.FACTORS.fuel, U = E.FACTORS.unit, A = E.FACTORS.avoided;
    var o = {};
    // emissions
    var fuelS1 = (num(v.diesel_l)*F.diesel.gj*F.diesel.s1 + num(v.petrol_l)*F.petrol.gj*F.petrol.s1 + num(v.lpg_l)*F.lpg.gj*F.lpg.s1 + num(v.biodiesel_l)*F.biodiesel.gj*F.biodiesel.s1)/1e6;
    var gasS1 = num(v.gas_gj)*E.FACTORS.gas.s1/1000;
    o.scope1_fleet = fuelS1; o.scope1_gas = gasS1;
    o.scope1_t = fuelS1 + gasS1;
    o.scope2_t = num(v.grid_kwh)*el.s2/1000;
    var landF = E.FACTORS.landfill[p.org_type] || 1.3;
    o.scope3_waste = num(v.landfill_t)*landF;
    o.scope3_upstream = (num(v.diesel_l)*F.diesel.gj*F.diesel.s3 + num(v.petrol_l)*F.petrol.gj*F.petrol.s3 + num(v.lpg_l)*F.lpg.gj*F.lpg.s3)/1e6
                      + num(v.gas_gj)*(E.FACTORS.gas.s3[st]||4)/1000 + num(v.grid_kwh)*el.s3/1000;
    o.scope3_t = o.scope3_waste + o.scope3_upstream;
    o.total_t = o.scope1_t + o.scope2_t + o.scope3_t;
    o.flights = num(v.flights_dom) + num(v.flights_int);
    // waste
    o.recovered_t = num(v.recycling_t)+num(v.organics_t)+num(v.green_t)+num(v.food_t)+num(v.paper_t)+num(v.glass_t)+num(v.steel_t)+num(v.alu_t)
      +num(v.timber_t)+num(v.timber_treated_t)+num(v.concrete_t)+num(v.rubble_t)+num(v.soil_t)+num(v.plaster_t)
      +num(v.mattress_n)*U.mattress+num(v.tyres_n)*U.tyre+num(v.ewaste_t)+num(v.whitegoods_n)*U.whitegood
      +num(v.batteries_kg)/1000+num(v.textiles_t)+num(v.furniture_t)+num(v.problem_kg)/1000;
    o.landfill_t = num(v.landfill_t);
    o.waste_total_t = num(v.waste_total_t) || (o.recovered_t + o.landfill_t);
    o.recovery_pct = o.waste_total_t>0 ? Math.min(100, o.recovered_t/o.waste_total_t*100) : null;
    o.diversion_pct = o.waste_total_t>0 ? clamp((o.waste_total_t-o.landfill_t)/o.waste_total_t*100) : null;
    o.reuse_pct = o.waste_total_t>0 ? num(v.furniture_t)/o.waste_total_t*100 : null;
    o.avoided_t = num(v.steel_t)*A.steel + num(v.alu_t)*A.alu + num(v.timber_t)*A.timber + num(v.green_t)*A.green + num(v.concrete_t)*A.concrete + num(v.tyres_n)*U.tyre*A.tyres;
    // energy
    var renew = num(v.renew_kwh)+num(v.solar_use_kwh), elecAll = num(v.grid_kwh)+num(v.solar_use_kwh);
    o.renew_kwh = renew; o.elec_all_kwh = elecAll;
    o.renew_pct = elecAll>0 ? Math.min(100, renew/elecAll*100) : null;
    o.grid_kwh = num(v.grid_kwh); o.gas_gj = num(v.gas_gj);
    o.elec_per_fte = num(p.employees)>0 ? o.grid_kwh/num(p.employees) : null;
    o.elec_per_m2 = num(p.floor_area)>0 ? o.grid_kwh/num(p.floor_area) : null;
    // fleet
    var bev=num(v.veh_bev), phev=num(v.veh_phev), etr=num(v.trucks_electric);
    var fleet = num(v.veh_diesel)+num(v.veh_petrol)+num(v.veh_hybrid)+phev+bev+num(v.trucks_diesel)+etr;
    o.fleet_n = fleet;
    o.fleet_ev_pct = fleet>0 ? (bev+etr+0.5*phev)/fleet*100 : null;
    o.fuel_l = num(v.diesel_l)+num(v.petrol_l)+num(v.lpg_l)+num(v.biodiesel_l);
    o.fleet_eff = num(v.fleet_km)>0 ? o.fuel_l/num(v.fleet_km)*100 : null;
    // water
    var alt = num(v.recycled_kl)+num(v.rain_kl)+num(v.storm_kl)+num(v.waste_water_kl);
    var allW = num(v.potable_kl)+alt+num(v.ground_kl);
    o.potable_kl = num(v.potable_kl);
    o.alt_water_pct = allW>0 ? alt/allW*100 : null;
    o.water_per_fte = num(p.employees)>0 ? o.potable_kl/num(p.employees) : null;
    o.water_per_site = num(p.facilities)>0 ? o.potable_kl/num(p.facilities) : null;
    o.water_per_res = num(p.residents)>0 ? o.potable_kl*1000/num(p.residents) : null;
    // per-person intensities
    o.waste_per_res = num(p.residents)>0 ? o.waste_total_t*1000/num(p.residents) : null;
    o.waste_per_fte = num(p.employees)>0 ? o.waste_total_t*1000/num(p.employees) : null;
    o.emis_per_res = num(p.residents)>0 ? o.total_t*1000/num(p.residents) : null;
    o.emis_per_fte = num(p.employees)>0 ? o.total_t/num(p.employees) : null;
    // circular
    o.proc_recycled_pct = num(v.proc_total)>0 ? num(v.proc_recycled)/num(v.proc_total)*100 : null;
    return o;
  };

  /* Governance for a month: completeness of mandatory fields due, and evidence share. */
  E.quality = function(rec, isFirst){
    var p = E.parse(rec.month);
    var due = D.due(p.m, isFirst);
    var reqDue = due.filter(function(f){return f.req;});
    var v = rec.values||{};
    var supplied = due.filter(function(f){ return has(v,f.id) || (f.kind==="text"&&v[f.id]); });
    var reqSupplied = reqDue.filter(function(f){ return has(v,f.id); });
    var ev = rec.evidence||{};
    // graded A or B counts as evidenced; a document attached but not yet graded by YES counts provisionally
    var evidenced = supplied.filter(function(f){ var e=ev[f.cat]; return e && (e.grade==="A"||e.grade==="B"||(!e.grade&&(e.pending||e.name))); });
    var pending = supplied.filter(function(f){ var e=ev[f.cat]; return e && !e.grade && (e.pending||e.name); });
    return {
      complete_pct: reqDue.length ? reqSupplied.length/reqDue.length*100 : 100,
      evidence_pct: supplied.length ? evidenced.length/supplied.length*100 : 0,
      pending_pct: supplied.length ? pending.length/supplied.length*100 : 0,
      supplied: supplied.length, due: due.length, reqDue: reqDue.length, reqSupplied: reqSupplied.length,
      missing: reqDue.filter(function(f){ return !has(v,f.id); }).map(function(f){ return f.id; })
    };
  };

  function trend(now, base, band){ if(!(base>0) || now==null) return 50; var ch=(now-base)/base; return clamp(50 - ch/band*50); }
  E.band = function(s){ return s==null?"—":s>=80?"Leading":s>=65?"Strong":s>=50?"Developing":"Starting"; };
  /* Category scores from one set of rolling 12-month measures. The monthly series, the score at target
     and the potential score all go through this one function, so they can never disagree. */
  E.scoreParts = function(x, T){
    var h = x.has||{}, S = {};
    S.energy = h.energy ? 0.6*clamp(x.renew_pct||0) + 0.4*trend(x.grid, x.grid_base, 0.20) : null;
    S.fleet = h.fleet ? 0.6*clamp((x.ev_pct||0)/50*100) + 0.4*trend(x.fuel, x.fuel_base, 0.20) : null;
    S.carbon = h.carbon ? trend(x.total, x.total_base, 0.30) : null;
    S.water = h.water ? 0.5*clamp((x.alt_pct||0)/50*100) + 0.5*trend(x.potable, x.potable_base, 0.20) : null;
    S.waste = x.diversion_pct==null ? null : 0.7*x.diversion_pct + 0.3*clamp(100-(x.contam_pct==null?10:x.contam_pct)*5);
    S.circular = h.circular ? 0.5*clamp((x.proc_pct||0)/30*100) + 0.3*clamp((x.reuse_pct||0)/10*100) + 0.2*clamp((x.stew||0)/3*100) : null;
    S.land = h.land ? clamp(x.rehab_ha/(T.target_rehab_ha*x.part)*100) : null;
    S.nature = h.nature ? 0.5*clamp(x.trees/(T.target_trees*x.part)*100) + 0.5*clamp(x.native_ha/(T.target_native_ha*x.part)*100) : null;
    S.community = h.community ? clamp(x.participants/(T.target_participants*x.part)*100) : null;
    S.governance = 0.5*(x.complete||0) + 0.3*(x.evidence||0) + 0.2*(x.closure==null?100:x.closure);
    return S;
  };
  E.overall = function(S){ var v=[]; D.CATEGORIES.forEach(function(c){ if(S[c.k]!=null) v.push(S[c.k]); }); return v.length ? Math.round(v.reduce(function(a,b){return a+b;},0)/v.length) : null; };
  E.copyX = function(x){ var y={}; for(var k in x) y[k]=x[k]; y.has={}; for(var h in (x.has||{})) y.has[h]=x.has[h]; return y; };

  /* The score if every target in the profile were met today. Measures without a target stay as they are. */
  E.atTarget = function(m, T){
    var x = E.copyX(m.x), p = x.part||1;
    if(x.has.energy) x.renew_pct = Math.max(x.renew_pct||0, T.target_renewable);
    if(x.has.fleet) x.ev_pct = Math.max(x.ev_pct||0, T.target_fleet_ev);
    if(x.diversion_pct!=null) x.diversion_pct = Math.max(x.diversion_pct, T.target_diversion);
    if(x.has.carbon && x.total_base>0) x.total = Math.min(x.total, x.total_base*(1 - T.target_emissions/100));
    if(x.has.land) x.rehab_ha = Math.max(x.rehab_ha, T.target_rehab_ha*p);
    if(x.has.nature){ x.trees = Math.max(x.trees, T.target_trees*p); x.native_ha = Math.max(x.native_ha, T.target_native_ha*p); }
    if(x.has.community) x.participants = Math.max(x.participants, T.target_participants*p);
    var S = E.scoreParts(x, T); return {scores:S, score:E.overall(S), x:x};
  };

  function sumK(list,k){ return list.reduce(function(s,x){ return s + (x[k]||0); },0); }
  function avgK(list,k){ var xs=list.filter(function(x){return x[k]!=null;}); return xs.length? xs.reduce(function(s,x){return s+x[k];},0)/xs.length : null; }

  /* The full series: records = [{month:"2025-07", values:{}, evidence:{cat:{grade,file,name}}, status:"submitted"|"draft"|"verified"}],
     sorted or not. Static fields carry forward from the latest month that set them. */
  E.series = function(records, profile){
    profile = profile||{};
    var T = {}; for(var k in E.DEFAULT_TARGETS){ T[k] = num(profile[k]) || E.DEFAULT_TARGETS[k]; }
    var recs = records.slice().sort(function(a,b){ return a.month<b.month?-1:1; });
    var carry = {}, out = [];
    recs.forEach(function(r, i){
      var v = {}; var rv = r.values||{};
      D.INPUTS.forEach(function(f){ if(f.freq==="S"){ if(has(rv,f.id)||(f.kind!=="number"&&f.kind!=="count"&&rv[f.id])) carry[f.id]=rv[f.id]; if(carry[f.id]!==undefined) v[f.id]=carry[f.id]; } else if(rv[f.id]!==undefined) v[f.id]=rv[f.id]; });
      var m = E.month(v, profile);
      m.month = r.month; m.values = v; m.status = r.status||"draft";
      var q = E.quality(r, i===0); m.complete_pct=q.complete_pct; m.evidence_pct=q.evidence_pct; m.q=q;
      m.raw = rv; m.ev = r.evidence||{};
      out.push(m);
    });
    // baseline: months in the baseline financial year, kept by calendar month so comparisons are seasonal
    var bfy = (profile.baseline_fy||"").replace("-", "–");
    var base = out.filter(function(m){ return E.fyOf(m.month)===bfy; });
    if(!base.length) base = out.slice(0,12);
    var byCal = {}; base.forEach(function(m){ byCal[E.parse(m.month).m] = m; });
    var B = { months: base.length, fy: base.length ? E.fyOf(base[0].month) : null, byCal: byCal };
    ["total_t","scope1_t","scope2_t","scope3_t","grid_kwh","fuel_l","potable_kl","waste_total_t","landfill_t","gas_gj"].forEach(function(k){ B[k] = avgK(base,k); });
    // the baseline for any run of months: the same calendar months in the baseline year, or its monthly average where one is missing
    function baseFor(w, k){ var s=0; w.forEach(function(x){ var b=byCal[E.parse(x.month).m]; s += (b && b[k]!=null) ? b[k] : (B[k]||0); }); return s; }
    // rolling 12-month windows and scores
    out.forEach(function(m, i){
      var w = out.slice(Math.max(0,i-11), i+1);
      var R = {
        n: w.length,
        total_t: sumK(w,"total_t"), scope1_t: sumK(w,"scope1_t"), scope2_t: sumK(w,"scope2_t"), scope3_t: sumK(w,"scope3_t"), avoided_t: sumK(w,"avoided_t"),
        grid_kwh: sumK(w,"grid_kwh"), renew_kwh: sumK(w,"renew_kwh"), elec_all_kwh: sumK(w,"elec_all_kwh"), gas_gj: sumK(w,"gas_gj"),
        fuel_l: sumK(w,"fuel_l"), potable_kl: sumK(w,"potable_kl"),
        waste_total_t: sumK(w,"waste_total_t"), landfill_t: sumK(w,"landfill_t"), recovered_t: sumK(w,"recovered_t"),
        trees: w.reduce(function(s,x){return s+num(x.raw.trees);},0),
        native_ha: w.reduce(function(s,x){return s+num(x.raw.native_veg_ha)+num(x.raw.habitat_ha)+num(x.raw.wetland_ha);},0),
        rehab_ha: w.reduce(function(s,x){return s+num(x.raw.rehab_ha)+num(x.raw.remediated_ha);},0),
        participants: w.reduce(function(s,x){return s+num(x.raw.participants);},0),
        complaints: w.reduce(function(s,x){return s+num(x.raw.complaints);},0),
        closed: w.reduce(function(s,x){return s+num(x.raw.complaints_closed);},0),
        furniture_t: w.reduce(function(s,x){return s+num(x.raw.furniture_t);},0),
        proc_total: w.reduce(function(s,x){return s+num(x.raw.proc_total);},0),
        proc_recycled: w.reduce(function(s,x){return s+num(x.raw.proc_recycled);},0),
        alt_kl: w.reduce(function(s,x){var r=x.raw;return s+num(r.recycled_kl)+num(r.rain_kl)+num(r.storm_kl)+num(r.waste_water_kl);},0),
        all_kl: w.reduce(function(s,x){var r=x.raw;return s+num(r.potable_kl)+num(r.recycled_kl)+num(r.rain_kl)+num(r.storm_kl)+num(r.waste_water_kl)+num(r.ground_kl);},0)
      };
      var lastContam = null; for(var j=i;j>=0;j--){ if(has(out[j].raw,"contam_pct")){ lastContam=+out[j].raw.contam_pct; break; } }
      R.renew_pct = R.elec_all_kwh>0 ? R.renew_kwh/R.elec_all_kwh*100 : null;
      R.diversion_pct = R.waste_total_t>0 ? clamp((R.waste_total_t-R.landfill_t)/R.waste_total_t*100) : null;
      R.recovery_pct = R.waste_total_t>0 ? Math.min(100,R.recovered_t/R.waste_total_t*100) : null;
      R.reuse_pct = R.waste_total_t>0 ? R.furniture_t/R.waste_total_t*100 : null;
      R.alt_water_pct = R.all_kl>0 ? R.alt_kl/R.all_kl*100 : null;
      R.proc_recycled_pct = R.proc_total>0 ? R.proc_recycled/R.proc_total*100 : null;
      R.contam_pct = lastContam;
      R.closure_pct = R.complaints>0 ? Math.min(100,R.closed/R.complaints*100) : 100;
      R.base = {}; ["total_t","scope1_t","scope2_t","scope3_t","grid_kwh","fuel_l","potable_kl","waste_total_t","landfill_t"].forEach(function(k){ R.base[k] = baseFor(w,k); });
      var part = R.n/12; // share of a year in the window: targets are pro-rated until 12 months exist
      m.r12 = R;
      function any(ids){ return w.some(function(x){ return ids.some(function(id){ return has(x.raw,id) || has(x.values,id); }); }); }
      var stew = null; for(var s2=i;s2>=0;s2--){ if(has(out[s2].values,"stewardship")){ stew=+out[s2].values.stewardship; break; } }
      var recent = out.slice(Math.max(0,i-2), i+1);
      // the measures the score is built from: kept on the month so the score at target and the potential score use the same inputs
      var x = {
        part: part,
        has: { energy:any(["grid_kwh"]), fleet:any(["diesel_l","petrol_l","veh_petrol","veh_diesel"]), carbon:R.total_t>0, water:any(["potable_kl"]),
               circular:(any(["proc_total","furniture_t"]) || stew!=null), land:any(["rehab_ha","remediated_ha"]), nature:any(["trees","native_veg_ha","habitat_ha","wetland_ha"]), community:any(["participants"]) },
        renew_pct:R.renew_pct, grid:R.grid_kwh, grid_base:baseFor(w,"grid_kwh"),
        ev_pct:m.fleet_ev_pct, fuel:R.fuel_l, fuel_base:baseFor(w,"fuel_l"),
        total:R.total_t, total_base:baseFor(w,"total_t"),
        alt_pct:R.alt_water_pct, potable:R.potable_kl, potable_base:baseFor(w,"potable_kl"),
        diversion_pct:R.diversion_pct, contam_pct:lastContam,
        proc_pct:R.proc_recycled_pct, reuse_pct:R.reuse_pct, stew:stew,
        rehab_ha:R.rehab_ha, trees:R.trees, native_ha:R.native_ha, participants:R.participants,
        complete:avgK(recent,"complete_pct"), evidence:avgK(recent,"evidence_pct"), closure:R.closure_pct,
        s1_fleet:sumK(w,"scope1_fleet"), s2:R.scope2_t, waste_t:R.waste_total_t, landF:(E.FACTORS.landfill[profile.org_type]||1.3)
      };
      m.x = x;
      var S = E.scoreParts(x, T), P = {};
      // provisional: target-based scores before a full year of data, and any month not yet verified by YES
      if(R.n<12){ ["land","nature","community"].forEach(function(c){ if(S[c]!=null) P[c]=true; }); }
      var vals = []; D.CATEGORIES.forEach(function(c){ if(S[c.k]!=null) vals.push(S[c.k]); });
      m.scores = S; m.prov = P; m.scored = vals.length;
      m.score = vals.length ? Math.round(vals.reduce(function(a,b){return a+b;},0)/vals.length) : null;
      m.provisional = m.status!=="verified" || Object.keys(P).length>0;
      m.band = E.band(m.score);
    });
    // direction of travel
    out.forEach(function(m, i){
      var prev = out[i-12] || null;
      m.yoy = prev && prev.score!=null && m.score!=null ? m.score - prev.score : null;
      var p1 = out[i-1]||null;
      m.mom = p1 && p1.score!=null && m.score!=null ? m.score - p1.score : null;
      m.cat_yoy = {}; D.CATEGORIES.forEach(function(c){ m.cat_yoy[c.k] = prev && prev.scores && prev.scores[c.k]!=null && m.scores[c.k]!=null ? m.scores[c.k]-prev.scores[c.k] : null; });
    });
    return {months: out, baseline: B, targets: T, profile: profile};
  };

  // Targets versus actuals for the latest month.
  E.targets = function(S){
    var m = S.months[S.months.length-1]; if(!m) return [];
    var T = S.targets, R = m.r12;
    var red = R.base.total_t>0 ? (1 - R.total_t/R.base.total_t)*100 : null;
    return [
      {k:"emissions", name:"Emissions reduction vs baseline", actual:red, target:T.target_emissions, unit:"%", note:"Rolling 12 months against the baseline year; target by 2030"},
      {k:"renewable", name:"Renewable electricity", actual:R.renew_pct, target:T.target_renewable, unit:"%"},
      {k:"diversion", name:"Landfill diversion", actual:R.diversion_pct, target:T.target_diversion, unit:"%"},
      {k:"fleet", name:"Fleet electrification", actual:m.fleet_ev_pct, target:T.target_fleet_ev, unit:"%"}
    ];
  };

  E.SCORE_METHOD = [
    {k:"energy", how:"60% renewable electricity share (rolling 12 months) + 40% grid electricity use against the baseline (20% lower scores full marks, 20% higher scores none)."},
    {k:"fleet", how:"60% fleet electrification (50% electric scores full marks) + 40% fuel use against the baseline (±20%)."},
    {k:"carbon", how:"Total operational emissions over the last 12 months against the baseline year (30% lower scores full marks, 30% higher scores none)."},
    {k:"water", how:"50% alternative water share (50% scores full marks) + 50% potable water use against the baseline (±20%)."},
    {k:"waste", how:"70% landfill diversion rate + 30% contamination (0% scores full marks, 20% or more scores none)."},
    {k:"circular", how:"50% recycled-content procurement share (30% scores full marks) + 30% reuse rate (10% scores full marks) + 20% stewardship programs (three or more scores full marks)."},
    {k:"land", how:"Hectares rehabilitated or remediated in the last 12 months against the annual target."},
    {k:"nature", how:"50% trees planted against the annual target + 50% hectares of native vegetation, habitat and wetland restored against the annual target."},
    {k:"community", how:"Program participants in the last 12 months against the annual target."},
    {k:"governance", how:"50% data completeness + 30% evidence share (last three months) + 20% complaints and incidents closed."}
  ];
})(window.YESE, window.YESD);
