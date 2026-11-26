/* Council trial accounts: Hume City Council, City of Monash and Hobsons Bay City Council.
   Each council gets its own branded account with SAMPLE figures (from the same seeded demo engine as the
   other demo organisations), sized to its population, and one trial login. Nothing here is the council's data:
   every account name carries "Trial · sample figures" so a printed or forwarded report can't be mistaken for real.
   Load after demo-data.js, sectors.js and demo-city.js, and before portal.js.

   Add-only:
   - Appends three organisations and three trial logins to window.YESDEMO. Nothing else in demo-data.js changes.
   - A browser that already holds a saved demo gets any missing trial council added to it. No other organisation,
     person, booking or setting is changed, and the storage key and version stay the same.
   - Direct link per council: /portal/?trial=hume | monash | hobsons-bay signs the visitor in to that council's trial.
   - YESDEMO.resetTrial('hume') puts one trial council back to its starting state in this browser, nothing else.
   - Does nothing to stored data in live mode (a Firebase project configured). */
(function(X, S){
  if(!X || !X.ORGS || !X.USERS) return;
  var KEY = 'yes-es-portal-v3';
  var LABEL = ' · Trial (sample figures)';

  /* residents: Hume and Hobsons Bay ABS 2025 (go-to-market doc, 26 Nov 2026); Monash from the council market map.
     Employees, floor area, facilities and every monthly figure are sample values, not the council's. */
  var TRIALS = [
    {key:'hume', id:'trial-hume', name:'Hume City Council', residents:278885, employees:1322, floor_area:150000, facilities:110, scale:5.8, seed:20241101,
      user:{id:'u-trial-hume', name:'Hume trial login', email:'trial@hume-trial.example'}},
    {key:'monash', id:'trial-monash', name:'City of Monash', residents:190397, employees:1100, floor_area:120000, facilities:90, scale:4.0, seed:20241102,
      user:{id:'u-trial-monash', name:'Monash trial login', email:'trial@monash-trial.example'}},
    {key:'hobsons-bay', id:'trial-hobsons-bay', name:'Hobsons Bay City Council', residents:97031, employees:700, floor_area:70000, facilities:50, scale:2.0, seed:20241103,
      user:{id:'u-trial-hobsons-bay', name:'Hobsons Bay trial login', email:'trial@hobsons-bay-trial.example'}}
  ];
  var IDS = TRIALS.map(function(t){ return t.id; });
  if(X.ORGS.some(function(o){ return IDS.indexOf(o.id)>=0; })) return;   /* loaded twice: no-op */

  /* sample fleet, scaled from Demo City's (scale 2.3) to each council's size */
  var FLEET = [
    ["2024-07",{vd:96,vp:128,vh:30,vphev:4,vbev:8,td:82,te:0,plant:130,evp:8,evs:12,solar:1100,solarSites:26,batt:0,stew:3}],
    ["2025-09",{vd:92,vp:112,vh:34,vphev:6,vbev:22,td:81,te:1,plant:128,evp:12,evs:20,solar:1450,solarSites:31,batt:250,stew:3}],
    ["2026-05",{vd:90,vp:98,vh:36,vphev:6,vbev:34,td:80,te:2,plant:128,evp:16,evs:26,solar:1600,solarSites:33,batt:250,stew:4}]];
  function fleetFor(sc){ var f=sc/2.3; return FLEET.map(function(st){ var o={}; Object.keys(st[1]).forEach(function(k){ o[k]= k==='stew' ? st[1][k] : Math.round(st[1][k]*f); }); return [st[0], o]; }); }

  TRIALS.forEach(function(t){
    X.ORGS.push({id:t.id,
      profile:{org_name:t.name+LABEL, org_type:"Council", sector:"council", state:"VIC", residents:t.residents, employees:t.employees, floor_area:t.floor_area, facilities:t.facilities, baseline_fy:"2024–25",
        target_emissions:40, target_renewable:80, target_diversion:75, target_fleet_ev:30, target_trees:Math.round(t.scale*3500), target_rehab_ha:Math.round(t.scale*10), target_participants:Math.round(t.scale*5000), target_native_ha:Math.round(t.scale*12),
        boundary:"Operational control", scope2_contract:"Accredited GreenPower or certified renewable contract",
        demo_note:"Trial account. Every figure is a sample, not "+t.name+"'s data. Send one month of your records and Yarta will replace these with your own verified figures."},
      gen:{seed:t.seed, scale:t.scale, start:"2024-07", end:"2026-10", verifiedTo:"2026-10", draft:false, contact:t.user.name,
        fuelDecline:.05, petrolDecline:.10, elecDecline:.04, gasDecline:.08, waterDecline:.03,
        renew:[["2000-01",0.2],["2025-07",0.45],["2026-07",0.6]],
        fleet:fleetFor(t.scale),
        draftFields:[]}});
    X.USERS.push({id:t.user.id, name:t.user.name, title:"Trial login · "+t.name, email:t.user.email, role:"customer", org:t.id});
  });

  function stamp(o){
    if(!o) return o;
    o.records.forEach(function(r){ if(r.status==='verified' && !r.issuedAt){ var p=r.month.split('-'), y=+p[0], m=+p[1]; if(m===12){ y++; m=1; } else m++; r.issuedAt=y+'-'+(m<10?'0':'')+m+'-20'; r.issuedBy='Yarta team'; } });
    if(!o.onboarding){ var done={}; ((S&&S.ONBOARDING)||[]).forEach(function(st){ done[st.k]={at:'2026-11-26', by:'Yarta team'}; }); o.onboarding={start:'2026-11-26', done:done, notes:[]}; }
    if(!o.subscription) o.subscription={status:'pilot', foundation:false, start:'2026-11-26', termMonths:3, monthlyOverride:'', estFee:0, estStatus:'waived', notes:'Trial account (sample figures)'};
    if(!o.plan) o.plan={off:{}};
    return o;
  }
  var build0 = X.build;
  X.build = function(){ var s = build0.apply(this, arguments); IDS.forEach(function(id){ stamp(s.orgs[id]); }); return s; };

  function live(){ return !!(window.YARTA_FIREBASE || (window.YARTA_LIVE && window.YARTA_LIVE.enabled)); }
  function read(){ try{ var s=JSON.parse(localStorage.getItem(KEY)); return (s && s.v===6 && s.orgs && s.users) ? s : null; }catch(e){ return null; } }
  function write(s){ try{ localStorage.setItem(KEY, JSON.stringify(s)); return true; }catch(e){ return false; } }
  function addOne(s, id){
    s.orgs[id] = stamp(build0().orgs[id]);
    X.USERS.forEach(function(u){ if(u.org===id && !s.users.some(function(x){ return x.id===u.id; })) s.users.push(JSON.parse(JSON.stringify(u))); });
  }

  /* a saved demo from before the trials existed: add whichever are missing, change nothing else */
  if(!live()){ var saved = read(); if(saved){ var changed=false; IDS.forEach(function(id){ if(!saved.orgs[id]){ addOne(saved, id); changed=true; } }); if(changed) write(saved); } }

  /* Put one trial council back to how it started, in this browser only. */
  X.resetTrial = function(key){
    if(live()) return false;
    var t = TRIALS.filter(function(x){ return x.key===key || x.id===key; })[0]; if(!t) return false;
    var s = read(); if(!s) return true;
    s.users = s.users.filter(function(u){ return u.org!==t.id || u.id===t.user.id; });
    if(s.session && !s.users.some(function(u){ return u.id===s.session.user; })) s.session=null;
    addOne(s, t.id);
    ['bookings','outbox','audit','gapLog'].forEach(function(k){ if(s[k]) s[k] = s[k].filter(function(x){ return x.org!==t.id; }); });
    if(s.seen) delete s.seen[t.user.id];
    return write(s);
  };
  X.TRIALS = TRIALS.map(function(t){ return {key:t.key, id:t.id, name:t.name}; });

  /* /portal/?trial=hume — sign the visitor straight in to that council's trial */
  try{
    var want = new URLSearchParams(location.search).get('trial');
    var tr = want && TRIALS.filter(function(x){ return x.key===want; })[0];
    if(tr && !live() && /\/portal\/?$/.test(location.pathname)){
      var go = function(){ var P=window.YESPortal; if(P && P.signInAs) P.signInAs(tr.id, '#/dashboard'); };
      if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', go); else setTimeout(go, 0);
    }
  }catch(e){}
})(window.YESDEMO, window.YESS);
