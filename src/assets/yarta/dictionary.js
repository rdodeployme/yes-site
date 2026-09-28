/* Yarta Data Dictionary v0.1 (draft)
   Every field a customer reports, and every figure Yarta calculates from them.
   Collect operational data once; Yarta calculates everything else.

   freq: M monthly · Q quarterly (reported in Sep, Dec, Mar, Jun) · A annual (reported in June) · S static (confirm when it changes)
   type: input = entered by Yarta from the customer’s source documents · calc = calculated by Yarta, never typed
   req:  true = mandatory for a complete month · false = optional
   kind: number · count · currency · percent · text · select
   score: which Yarta category score the field feeds
*/
window.YESD = window.YESD || {};
(function(D){
  D.VERSION = "v0.1 draft";

  D.CATEGORIES = [
    {k:"energy",     name:"Energy & Renewables",       short:"Energy",      what:"Electricity, solar, batteries, gas and efficiency"},
    {k:"fleet",      name:"Fleet & Transport",         short:"Fleet",       what:"Fuels, vehicles, electric transition, kilometres and business travel"},
    {k:"carbon",     name:"Carbon & Emissions",        short:"Carbon",      what:"Operational emissions calculated from everything else, and reductions"},
    {k:"water",      name:"Water",                     short:"Water",       what:"Consumption, reuse, harvesting and efficiency"},
    {k:"waste",      name:"Waste & Resource Recovery", short:"Waste",       what:"Recycling, landfill, materials and contamination"},
    {k:"circular",   name:"Circular Economy",          short:"Circularity", what:"Reuse, recycled-content procurement and product stewardship"},
    {k:"land",       name:"Land & Soil",               short:"Land",        what:"Rehabilitation, remediation and soil reuse"},
    {k:"nature",     name:"Biodiversity & Nature",     short:"Nature",      what:"Vegetation, habitat, wetlands and trees"},
    {k:"community",  name:"Community & Participation", short:"Community",   what:"Programs, engagement and education"},
    {k:"governance", name:"Governance & Improvement",  short:"Governance",  what:"Projects, investment, data quality and progress"}
  ];
  D.CAT = {}; D.CATEGORIES.forEach(function(c){ D.CAT[c.k]=c; });

  D.FREQ = {M:"Monthly", Q:"Quarterly", A:"Annual", S:"Static"};
  D.STATES = [["VIC","Victoria"],["NSW","New South Wales"],["ACT","Australian Capital Territory"],["QLD","Queensland"],["SA","South Australia"],["WA","Western Australia (SWIS)"],["TAS","Tasmania"],["NT","Northern Territory"]];

  // Organisation profile: static details used for intensities, baselines and targets.
  D.PROFILE = [
    {id:"org_name", name:"Organisation name", kind:"text", req:true, def:"Legal or trading name shown on reports."},
    {id:"org_type", name:"Organisation type", kind:"select", options:["Council","Business","Government agency","Other"], req:true, def:"Sets default factors, e.g. the mixed-waste landfill factor."},
    {id:"sector", name:"Sector", kind:"select", options:["council","business","health","education","manufacturing","construction","retail","logistics"], req:false, def:"Selects the sector profile: which streams are expected and which intensity the report leads with."},
    {id:"beds", name:"Beds", kind:"count", unit:"beds", req:false, def:"Hospitals and aged care only. Used for per-bed intensities."},
    {id:"students", name:"Students (EFTSL)", kind:"count", unit:"students", req:false, def:"Education only. Used for per-student intensities."},
    {id:"vehicles", name:"Vehicles operated", kind:"count", unit:"vehicles", req:false, def:"Transport operators. Used for per-vehicle intensities."},
    {id:"sites", name:"Sites operated", kind:"count", unit:"sites", req:false, def:"Retail and multi-site operators. Used for per-site intensities."},
    {id:"state", name:"State or territory", kind:"select", options:D.STATES.map(function(s){return s[0];}), req:true, def:"Selects the grid electricity emission factor."},
    {id:"residents", name:"Residents serviced", kind:"count", unit:"people", req:false, def:"Councils only. Used for per-resident intensities."},
    {id:"employees", name:"Employees (FTE)", kind:"count", unit:"FTE", req:true, def:"Full-time equivalent staff, used for per-employee intensities."},
    {id:"floor_area", name:"Building floor area", kind:"number", unit:"m²", req:false, def:"Gross floor area of occupied buildings, used for energy intensity per m²."},
    {id:"facilities", name:"Facilities", kind:"count", unit:"sites", req:false, def:"Number of buildings and facilities, used for water per facility."},
    {id:"baseline_fy", name:"Baseline financial year", kind:"text", req:true, def:"The year performance is compared against, e.g. 2024–25."},
    {id:"target_emissions", name:"Emissions reduction target", kind:"percent", unit:"% by 2030", req:false, def:"Target reduction in total emissions against the baseline."},
    {id:"target_renewable", name:"Renewable electricity target", kind:"percent", unit:"%", req:false, def:"Target share of electricity from renewable sources."},
    {id:"target_diversion", name:"Landfill diversion target", kind:"percent", unit:"%", req:false, def:"Target share of waste diverted from landfill."},
    {id:"target_fleet_ev", name:"Fleet electrification target", kind:"percent", unit:"%", req:false, def:"Target share of the fleet that is electric."},
    {id:"target_trees", name:"Trees planted per year (target)", kind:"count", unit:"trees", req:false, def:"Annual tree-planting target used for the Nature score."},
    {id:"target_rehab_ha", name:"Land rehabilitated per year (target)", kind:"number", unit:"ha", req:false, def:"Annual rehabilitation target used for the Land score."},
    {id:"target_native_ha", name:"Native vegetation, habitat and wetland restored per year (target)", kind:"number", unit:"ha", req:false, def:"Annual restoration target used for the Nature score."},
    {id:"target_participants", name:"Program participants per year (target)", kind:"count", unit:"people", req:false, def:"Annual participation target used for the Community score."}
  ];

  function F(id,name,cat,unit,freq,req,kind,src,def,extra){ var f={id:id,name:name,cat:cat,unit:unit,freq:freq,req:req,kind:kind,type:"input",src:src,def:def,score:[cat]}; if(extra){ for(var k in extra) f[k]=extra[k]; } return f; }
  function C(id,name,cat,unit,calc,def,extra){ var f={id:id,name:name,cat:cat,unit:unit,freq:"M",req:false,kind:"number",type:"calc",src:"Calculated by Yarta",calc:calc,def:def,score:[cat]}; if(extra){ for(var k in extra) f[k]=extra[k]; } return f; }

  D.FIELDS = [
    // ---- Fleet & Transport -------------------------------------------------------
    F("diesel_l","Diesel purchased","fleet","L","M",true,"number","Fuel card statements or bulk fuel invoices","Litres of diesel purchased for vehicles, plant and equipment in the month.",{score:["fleet","carbon"]}),
    F("petrol_l","Petrol purchased","fleet","L","M",true,"number","Fuel card statements","Litres of petrol (including E10) purchased in the month.",{score:["fleet","carbon"]}),
    F("lpg_l","LPG purchased","fleet","L","M",false,"number","Fuel invoices","Litres of LPG purchased for vehicles, forklifts or plant.",{score:["fleet","carbon"]}),
    F("biodiesel_l","Biodiesel or renewable diesel used","fleet","L","M",false,"number","Fuel invoices","Litres of biodiesel or renewable diesel used (the fossil share of blends goes in Diesel).",{score:["fleet","carbon"]}),
    F("other_fuel","Other fuels used","fleet","type and quantity","M",false,"text","Fuel invoices","Any other fuel, with its type and quantity. Recorded; not converted to emissions until a factor is set."),
    F("fleet_km","Total fleet kilometres travelled","fleet","km","M",true,"number","Odometer readings, telematics or fuel card data","Kilometres travelled by all fleet vehicles in the month."),
    F("veh_diesel","Diesel passenger vehicles","fleet","vehicles","S",true,"count","Fleet register","Number of diesel passenger vehicles in the fleet."),
    F("veh_petrol","Petrol passenger vehicles","fleet","vehicles","S",true,"count","Fleet register","Number of petrol passenger vehicles in the fleet."),
    F("veh_hybrid","Hybrid vehicles","fleet","vehicles","S",true,"count","Fleet register","Number of hybrid (non plug-in) vehicles."),
    F("veh_phev","Plug-in hybrid vehicles","fleet","vehicles","S",true,"count","Fleet register","Number of plug-in hybrid vehicles."),
    F("veh_bev","Battery electric vehicles","fleet","vehicles","S",true,"count","Fleet register","Number of battery electric passenger vehicles."),
    F("trucks_diesel","Diesel trucks","fleet","vehicles","S",true,"count","Fleet register","Number of diesel trucks, including waste and fire vehicles."),
    F("trucks_electric","Electric trucks","fleet","vehicles","S",true,"count","Fleet register","Number of electric trucks."),
    F("plant_count","Heavy plant and machinery","fleet","items","S",false,"count","Plant register","Number of heavy plant items (graders, loaders, mowers, excavators)."),
    F("plant_fuel","Heavy plant main fuel type","fleet","type","S",false,"select","Plant register","Main fuel used by heavy plant.",{options:["Diesel","Petrol","Electric","Mixed"]}),
    F("flights_dom","Domestic flights","fleet","trips","M",false,"count","Travel booking system","Domestic one-way flight trips taken for work. Recorded; emissions factor pending.",{score:["fleet"]}),
    F("flights_int","International flights","fleet","trips","M",false,"count","Travel booking system","International one-way flight trips taken for work. Recorded; emissions factor pending.",{score:["fleet"]}),
    F("ev_public_points","Public EV charging points operated","fleet","points","S",false,"count","Asset register","Public EV charging points operated by the organisation."),
    F("ev_public_kwh","Public EV charging supplied","fleet","kWh","M",false,"number","Charger management platform","Electricity supplied through public charging points in the month."),
    F("ev_staff_points","Staff EV charging points","fleet","points","S",false,"count","Asset register","Charging points for fleet and staff vehicles."),
    F("ev_staff_kwh","Staff and fleet EV charging supplied","fleet","kWh","M",false,"number","Charger management platform or sub-meter","Electricity supplied to fleet and staff vehicles in the month."),
    F("idle_hours","Fleet idling hours","fleet","hours","M",false,"number","Telematics","Engine idling hours, where telematics are available."),
    F("veh_retired","Vehicles retired","fleet","vehicles","Q",false,"count","Fleet register","Vehicles retired from the fleet in the quarter."),
    F("veh_cleaner","Cleaner replacements introduced","fleet","vehicles","Q",false,"count","Fleet register","Replacement vehicles that are electric, plug-in hybrid or hybrid."),
    C("fleet_eff","Fleet fuel efficiency","fleet","L/100 km","(diesel + petrol + LPG + biodiesel) ÷ fleet km × 100","Litres of fuel per 100 km across the fleet."),
    C("fleet_ev_pct","Fleet electrification","fleet","%","(battery electric vehicles + electric trucks + ½ × plug-in hybrids) ÷ all vehicles × 100","Share of the fleet that is electric."),

    // ---- Energy & Renewables -------------------------------------------------------
    F("grid_kwh","Grid electricity consumed","energy","kWh","M",true,"number","Electricity retailer bills or NMI interval data","All grid electricity consumed across buildings, facilities and streetlighting.",{score:["energy","carbon"]}),
    F("renew_kwh","Renewable electricity purchased","energy","kWh","M",false,"number","GreenPower or power purchase agreement statements","Grid electricity matched by accredited renewable purchases."),
    F("solar_gen_kwh","Onsite solar generation","energy","kWh","M",false,"number","Inverter monitoring","Total solar generated on the organisation's buildings."),
    F("solar_use_kwh","Solar consumed onsite","energy","kWh","M",false,"number","Inverter monitoring","Solar generation used onsite (generation less export)."),
    F("solar_exp_kwh","Solar exported to grid","energy","kWh","M",false,"number","Retailer bills (feed-in)","Solar generation exported to the grid."),
    F("solar_kw","Installed solar capacity","energy","kW","S",false,"number","Asset register","Total installed solar capacity."),
    F("solar_sites","Buildings with solar","energy","buildings","S",false,"count","Asset register","Number of buildings with solar installed."),
    F("battery_kwh","Battery storage capacity","energy","kWh","S",false,"number","Asset register","Total installed battery storage."),
    F("battery_cycled","Battery energy cycled","energy","kWh","M",false,"number","Battery monitoring","Energy discharged from batteries in the month."),
    F("gas_gj","Natural gas consumed","energy","GJ","M",true,"number","Gas retailer bills","Natural gas consumed (convert MJ ÷ 1,000).",{score:["energy","carbon"]}),
    F("peak_kw","Peak electricity demand","energy","kW","M",false,"number","Retailer bills or interval data","Highest demand in the month across metered sites."),
    F("gas_to_elec","Buildings converted from gas to electric","energy","buildings","Q",false,"count","Project register","Buildings fully converted from gas to electric in the quarter."),
    F("led_conversions","LED lighting conversions completed","energy","projects","Q",false,"count","Project register","Building lighting upgrades to LED completed in the quarter."),
    F("street_kwh","Streetlighting electricity","energy","kWh","M",false,"number","Streetlighting bills (unmetered supply)","Electricity for streetlighting. Included in grid electricity above as well."),
    F("street_led_pct","Streetlights converted to LED","energy","%","A",false,"percent","Streetlighting asset register","Share of streetlights that are LED."),
    F("ee_projects","Energy-efficiency projects completed","energy","projects","Q",false,"count","Project register","Energy-efficiency projects completed in the quarter."),
    F("ee_saved_kwh","Estimated energy saved","energy","kWh/yr","Q",false,"number","Project business cases or measurement","Estimated annual energy saving from projects completed in the quarter."),
    C("renew_pct","Renewable electricity share","energy","%","(renewable purchased + solar consumed onsite) ÷ (grid electricity + solar consumed onsite) × 100","Share of electricity from renewable sources."),
    C("elec_per_fte","Electricity per employee","energy","kWh/FTE","grid electricity ÷ employees","Monthly electricity intensity per employee."),
    C("elec_per_m2","Electricity per m²","energy","kWh/m²","grid electricity ÷ floor area","Monthly electricity intensity per square metre."),

    // ---- Water -----------------------------------------------------------------------
    F("potable_kl","Potable water consumed","water","kL","M",true,"number","Water utility bills","Mains water consumed across all sites."),
    F("recycled_kl","Recycled water consumed","water","kL","M",false,"number","Recycled water bills","Class A or B recycled water used (e.g. irrigation)."),
    F("rain_kl","Rainwater harvested","water","kL","M",false,"number","Tank meters or estimate","Rainwater collected and used."),
    F("storm_kl","Stormwater captured and reused","water","kL","M",false,"number","Stormwater harvesting meters","Stormwater captured and reused."),
    F("ground_kl","Groundwater used","water","kL","M",false,"number","Bore meters","Groundwater extracted, where relevant."),
    F("waste_water_kl","Wastewater reused","water","kL","M",false,"number","Treatment plant records","Wastewater treated and reused."),
    F("leaks_fixed","Major water leaks repaired","water","leaks","Q",false,"count","Maintenance records","Major leaks identified and repaired in the quarter."),
    C("alt_water_pct","Alternative water share","water","%","(recycled + rainwater + stormwater + wastewater reused) ÷ all water used × 100","Share of water from non-potable sources."),
    C("water_per_fte","Water per employee","water","kL/FTE","potable water ÷ employees","Monthly potable water per employee."),
    C("water_per_site","Water per facility","water","kL/site","potable water ÷ facilities","Monthly potable water per facility."),
    C("water_per_res","Water per resident serviced","water","L/resident","potable water × 1,000 ÷ residents","Monthly potable water per resident serviced (councils)."),

    // ---- Waste & Resource Recovery --------------------------------------------------
    F("waste_total_t","Total waste generated","waste","t","M",true,"number","Contractor reports and weighbridge dockets","All waste generated in the month. For councils this includes the kerbside service (garbage, recycling, organics, glass) and transfer stations as well as council operations."),
    F("landfill_t","General waste to landfill","waste","t","M",true,"number","Landfill dockets","Waste sent to landfill, including kerbside garbage for councils.",{score:["waste","carbon"]}),
    F("recycling_t","Commingled recycling recovered","waste","t","M",true,"number","Contractor reports or processor certificates","Commingled recycling sent to a licensed reprocessor."),
    F("organics_t","Organics recovered","waste","t","M",false,"number","Processor certificates","Food and garden organics (FOGO) recovered."),
    F("green_t","Green waste recovered","waste","t","M",false,"number","Processor certificates","Garden and green waste recovered."),
    F("food_t","Food waste recovered","waste","t","M",false,"number","Processor certificates","Food waste recovered separately."),
    F("paper_t","Cardboard and paper recovered","waste","t","M",false,"number","Processor certificates","Cardboard and paper sent to reprocessing."),
    F("glass_t","Glass recovered","waste","t","M",false,"number","Processor certificates","Glass sent to reprocessing."),
    F("steel_t","Steel recovered","waste","t","M",false,"number","Weighbridge dockets","Ferrous metal sent to a licensed metal reprocessor."),
    F("alu_t","Aluminium and non-ferrous metals recovered","waste","t","M",false,"number","Weighbridge dockets","Aluminium, copper and other non-ferrous metals recovered."),
    F("timber_t","Plain timber recovered","waste","t","M",false,"number","Weighbridge dockets","Untreated timber recovered."),
    F("timber_treated_t","Painted or treated timber recovered","waste","t","M",false,"number","Weighbridge dockets","Painted, treated or engineered timber recovered."),
    F("concrete_t","Concrete recovered","waste","t","M",false,"number","Weighbridge dockets","Concrete crushed for reuse."),
    F("rubble_t","Bricks and rubble recovered","waste","t","M",false,"number","Weighbridge dockets","Bricks and rubble recovered."),
    F("soil_t","Soil recovered or reused","waste","t","M",false,"number","Weighbridge dockets or project records","Clean soil reused rather than landfilled."),
    F("plaster_t","Plasterboard recovered","waste","t","M",false,"number","Weighbridge dockets","Plasterboard recovered."),
    F("mattress_n","Mattresses recovered","waste","units","M",false,"count","Processor certificates","Mattresses sent for processing (tonnes are calculated at 80 kg each unless weighed)."),
    F("tyres_n","Tyres recovered","waste","units","M",false,"count","Tyre recycler dockets","Tyres sent to an accredited tyre recycler."),
    F("ewaste_t","E-waste recovered","waste","t","M",false,"number","AS/NZS 5377 processor certificates","Electronic waste recovered."),
    F("whitegoods_n","Whitegoods recovered","waste","units","M",false,"count","Processor dockets","Whitegoods recovered (degassed where required)."),
    F("batteries_kg","Batteries recovered","waste","kg","M",false,"number","Processor dockets","Batteries of all types recovered."),
    F("textiles_t","Textiles and clothing recovered","waste","t","M",false,"number","Processor or charity dockets","Textiles and clothing reused or recycled."),
    F("furniture_t","Furniture reused or recovered","waste","t","M",false,"number","Reuse outlet records","Furniture reused or recovered."),
    F("film_t","Soft plastics and film recovered","waste","t","M",false,"number","Processor certificates","Soft plastics, shrink film and packaging film sent to a reprocessor.",{sectors:["manufacturing","retail","logistics"]}),
    F("pallets_n","Timber pallets reused or recovered","waste","units","M",false,"count","Pallet supplier or processor dockets","Pallets returned, repaired or chipped (tonnes are calculated at 20 kg each).",{sectors:["manufacturing","logistics","retail","construction"]}),
    F("oil_l","Used oil recovered","waste","L","M",false,"number","Oil collector dockets","Used engine and hydraulic oil collected for re-refining.",{sectors:["logistics","manufacturing","council"]}),
    F("clinical_t","Clinical and related waste","waste","t","M",false,"number","Clinical waste contractor reports","Clinical, cytotoxic and related waste sent for treatment. Counted in total waste; neither recovered nor landfilled.",{sectors:["health"]}),
    F("sharps_kg","Sharps and pharmaceutical waste","waste","kg","M",false,"number","Clinical waste contractor reports","Sharps and pharmaceutical waste sent for treatment.",{sectors:["health"]}),
    F("food_avoided_t","Food waste avoided","waste","t","M",false,"number","Food rescue partner records","Edible food redirected to food rescue rather than disposed of.",{sectors:["retail","health","education"]}),
    F("problem_kg","Problem wastes recovered","waste","kg","M",false,"number","Drop-off facility records","Paint, gas bottles, aerosols and similar problem wastes recovered."),
    F("contam_pct","Waste contamination rate","waste","%","Q",false,"percent","Bin audits or contractor reports","Share of recycling streams rejected as contaminated."),
    C("treated_t","Total treated","waste","t","clinical and related waste + sharps and pharmaceutical waste","Waste sent for treatment: counted in the total, not as recovered and not as landfill.",{sectors:["health"]}),
    C("recovered_t","Total recovered","waste","t","sum of every recovered stream (mattresses at 80 kg, tyres at 9.5 kg, whitegoods at 60 kg, pallets at 20 kg, oil at 0.9 kg per litre)","All material recovered in the month."),
    C("recovery_pct","Resource recovery rate","waste","%","total recovered ÷ total waste generated × 100","Share of waste recovered for reuse or recycling."),
    C("diversion_pct","Landfill diversion rate","waste","%","(total waste − landfill) ÷ total waste × 100","Share of waste kept out of landfill."),
    C("reuse_pct","Reuse rate","waste","%","furniture reused ÷ total waste × 100","Share of waste reused rather than recycled."),
    C("waste_per_res","Waste per resident","waste","kg/resident","total waste × 1,000 ÷ residents","Monthly waste per resident serviced (councils)."),
    C("waste_per_fte","Waste per employee","waste","kg/FTE","total waste × 1,000 ÷ employees","Monthly waste per employee."),

    // ---- Circular Economy ------------------------------------------------------------
    F("proc_total","Total procurement spend","circular","$","Q",false,"currency","Finance system","Total goods and services spend in the quarter, used to calculate the recycled-content share."),
    F("proc_recycled","Recycled-content procurement spend","circular","$","Q",false,"currency","Finance system","Spend on products containing recycled materials."),
    F("recycled_products","Products with recycled content purchased","circular","items","Q",false,"count","Purchasing records","Number or quantity of recycled-content products purchased."),
    F("proc_local","Local procurement spend","circular","$","Q",false,"currency","Finance system","Local spend, where the sustainability policy includes locality."),
    F("single_use","Single-use products eliminated or reduced","circular","categories","A",false,"count","Policy register","Categories of single-use products eliminated or reduced."),
    F("stewardship","Product stewardship or take-back programs","circular","programs","S",false,"count","Program register","Take-back or stewardship programs the organisation operates or joins."),
    C("proc_recycled_pct","Recycled-content procurement share","circular","%","recycled-content spend ÷ total spend × 100","Share of spend on recycled-content products."),

    // ---- Land & Soil -----------------------------------------------------------------
    F("rehab_ha","Land rehabilitated","land","ha","Q",false,"number","Project records","Land rehabilitated in the quarter."),
    F("remediated_ha","Contaminated land remediated","land","ha","Q",false,"number","EPA or project records","Contaminated land remediated in the quarter."),
    F("remediated_t","Contaminated material treated","land","t","Q",false,"number","EPA or project records","Tonnes of contaminated material treated."),
    F("soil_rehab_t","Soil reused in rehabilitation","land","t","Q",false,"number","Project records","Soil reused in rehabilitation projects."),

    // ---- Biodiversity & Nature -------------------------------------------------------
    F("trees","Trees planted","nature","trees","M",false,"count","Planting records","Trees planted in the month."),
    F("native_veg_ha","Native vegetation planted or restored","nature","ha","Q",false,"number","Project records","Native vegetation planted or restored."),
    F("habitat_projects","Habitat restoration projects","nature","projects","Q",false,"count","Project register","Habitat restoration projects active in the quarter."),
    F("habitat_ha","Habitat restored","nature","ha","Q",false,"number","Project records","Area covered by habitat restoration projects."),
    F("wetland_ha","Wetland restored or protected","nature","ha","Q",false,"number","Project records","Wetland restored or protected."),
    F("weeds_ha","Weed management undertaken","nature","ha","Q",false,"number","Works records","Area of weed management."),
    F("monitoring_sites","Biodiversity monitoring sites","nature","sites","Q",false,"count","Monitoring program","Sites monitored in the quarter."),
    F("monitoring_species","Species monitored","nature","species","Q",false,"count","Monitoring program","Species monitored in the quarter."),
    F("protected_ha","Native habitat created or protected","nature","ha","A",false,"number","Land management records","Native habitat created or placed under protection."),

    // ---- Community & Participation ----------------------------------------------------
    F("events","Environmental education and community events","community","events","M",false,"count","Events calendar","Environmental education sessions, workshops and community events held."),
    F("participants","Community participants","community","people","M",false,"count","Event registrations","People who took part in environmental programs and events."),

    // ---- Governance & Improvement ------------------------------------------------------
    F("complaints","Environmental complaints and incidents","governance","cases","M",false,"count","Complaints and incident register","Environmental complaints or incidents received."),
    F("complaints_closed","Complaints and incidents closed","governance","cases","M",false,"count","Complaints and incident register","Environmental complaints or incidents closed in the month."),
    F("improve_projects","Environmental improvement projects completed","governance","projects","Q",false,"count","Project register","Improvement projects completed, with their measured benefit recorded in the notes."),
    F("env_invest","Environmental investment","governance","$","M",false,"currency","Finance system","Spend on sustainability, recycling, renewable energy, restoration and improvement."),
    C("data_complete_pct","Data completeness","governance","%","mandatory fields supplied ÷ mandatory fields due × 100","How complete the month's submission is."),
    C("evidence_pct","Evidence share","governance","%","fields backed by an attached document ÷ fields supplied × 100","How much of the month is backed by evidence."),

    // ---- Carbon & Emissions (all calculated) ----------------------------------------
    C("scope1_t","Scope 1 emissions","carbon","t CO₂-e","diesel, petrol, LPG and biodiesel × transport fuel factors + natural gas × 51.53 kg CO₂-e per GJ","Direct emissions from fuel burned in the fleet, plant and buildings."),
    C("scope2_t","Scope 2 emissions","carbon","t CO₂-e","grid electricity × the state's location-based factor","Indirect emissions from grid electricity."),
    C("scope3_t","Scope 3 emissions (reported categories)","carbon","t CO₂-e","waste to landfill × landfill factor + upstream fuel and electricity factors","Waste to landfill and upstream fuel and electricity. Flights are recorded but not yet converted."),
    C("total_t","Total operational emissions","carbon","t CO₂-e","Scope 1 + Scope 2 + Scope 3 (reported categories)","Total emissions for the month."),
    C("avoided_t","Avoided emissions (estimate, reported separately)","carbon","t CO₂-e","recovered steel, aluminium, timber, green waste, concrete and tyres × NSW DECCW 2010 factors","Modelled estimate of emissions avoided by recycling. Never deducted from the total and never an offset."),
    C("emis_per_res","Emissions per resident","carbon","kg CO₂-e/resident","total emissions × 1,000 ÷ residents","Monthly emissions per resident serviced (councils)."),
    C("emis_per_fte","Emissions per employee","carbon","t CO₂-e/FTE","total emissions ÷ employees","Monthly emissions per employee.")
  ];
  D.FIELD = {}; D.FIELDS.forEach(function(f){ D.FIELD[f.id]=f; });
  D.INPUTS = D.FIELDS.filter(function(f){ return f.type==="input"; });
  D.CALCS = D.FIELDS.filter(function(f){ return f.type==="calc"; });

  // Which frequencies are due in a given month (0 = Jan … 11 = Dec). Financial year ends in June.
  D.due = function(month, isFirstMonth){
    var q = (month===2||month===5||month===8||month===11);
    var a = (month===5);
    return D.INPUTS.filter(function(f){
      if(f.freq==="M") return true;
      if(f.freq==="Q") return q;
      if(f.freq==="A") return a;
      if(f.freq==="S") return !!isFirstMonth;   // static fields: set once, then confirm when they change
      return false;
    });
  };
})(window.YESD);
