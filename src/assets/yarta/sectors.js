/* Yarta sector profiles: what each kind of organisation reports on, the eco standards behind it,
   and the demo organisation that shows it. One file drives the sectors page, the demo picker and the sample report picker.
   Exposes window.YESS. Every "reports" line is a reporting scope, not a legal obligation, unless the standard says so. */
window.YESS = window.YESS || {};
(function(S){
  S.SECTORS = [
    { k:"council", name:"Councils", one:"Council", org:"demo-shire",
      who:"Local government: the kerbside service, transfer stations, depots, buildings, parks, pools, fleet and community programs.",
      reports:["Kerbside garbage, recycling and organics tonnes and contamination","Transfer station and hard-waste streams","Fleet fuel, kilometres and electrification","Buildings, pools and streetlighting electricity and gas","Potable and alternative water","Land rehabilitation, trees, habitat and weeds","Community programs and participation","Environmental complaints and incidents"],
      standards:["National Waste Policy Action Plan targets","State waste and resource recovery strategies","NGA factors for Scope 1, 2 and 3","Council's own climate and environment strategy targets"],
      per:"resident", dominant:["waste","fleet","energy","nature","community"] },
    { k:"business", name:"Business and offices", one:"Business", org:"demo-office",
      who:"Commercial organisations, professional services and head offices: tenancies, fleet, travel and the waste the building produces.",
      reports:["Office waste, paper, e-waste and organics","Tenancy electricity and gas, base-building share where metered","Fleet and business travel, including flights","Water where metered","Recycled-content procurement","Category 5 waste emissions for mandatory climate reporting"],
      standards:["Mandatory climate reporting (AASB S2) for reporting groups","NGA factors","National Waste Policy Action Plan targets","NABERS Energy and Waste ratings where held"],
      per:"employee", dominant:["energy","waste","fleet","circular","governance"] },
    { k:"health", name:"Hospitals and aged care", one:"Hospital", org:"demo-hospital",
      who:"Public and private hospitals, aged-care providers and health services: 24-hour buildings, clinical waste and heavy water and energy use.",
      reports:["Clinical and related waste, sharps and pharmaceutical waste (treated, not recovered)","General waste, cardboard, organics from kitchens, PVC and single-use recovery","Electricity, gas and steam per bed and per m²","Potable water per bed","Fleet, patient transport and staff travel","Recycled-content and reusable-product procurement"],
      standards:["State health sustainability frameworks and clinical waste guidelines","NGA factors","National Waste Policy Action Plan targets","Mandatory climate reporting for large private providers"],
      per:"bed", dominant:["energy","waste","water","carbon","circular"] },
    { k:"education", name:"Universities and schools", one:"University", org:"demo-uni",
      who:"Universities, TAFEs and school systems: campuses, laboratories, student housing, grounds and large communities.",
      reports:["Campus waste by stream, including labs, e-waste and furniture reuse","Electricity, gas and onsite solar per student and per m²","Water, including irrigation and alternative sources","Fleet, campus shuttles and staff travel","Trees, grounds and habitat","Student and staff participation in programs"],
      standards:["Institutional net-zero and sustainability commitments","NGA factors","National Waste Policy Action Plan targets","Sector benchmarking (Tertiary Education Facilities Management Association) where subscribed"],
      per:"student", dominant:["energy","waste","community","nature","water"] },
    { k:"manufacturing", name:"Manufacturing and industry", one:"Manufacturer", org:"demo-maker",
      who:"Factories, processors and industrial sites: process waste, packaging, energy intensity and water.",
      reports:["Process and packaging waste by stream: metals, plastics, film, timber pallets, cardboard","General waste and any treated waste","Electricity, gas and process fuel per unit produced","Water in, wastewater reused","Fleet, forklifts and freight","Recycled-content inputs and take-back programs"],
      standards:["NGA factors and NGER reporting thresholds","Packaging covenant (APCO) targets","National Waste Policy Action Plan targets","Mandatory climate reporting for reporting groups"],
      per:"employee", dominant:["waste","energy","carbon","circular","water"] },
    { k:"construction", name:"Construction and property", one:"Builder", org:"demo-builder",
      who:"Builders, developers and property managers: construction and demolition waste, soil, and the buildings they run.",
      reports:["Construction and demolition waste: concrete, rubble, soil, timber, plasterboard, metals","Mixed C&D waste to landfill","Site electricity, diesel plant and fleet","Water on site and in managed buildings","Recycled-content materials purchased","Land remediated and soil reused"],
      standards:["National Waste Policy Action Plan targets","Green Star and NABERS where rated","State C&D waste levies and recovery targets","NGA factors"],
      per:"employee", dominant:["waste","land","circular","fleet","energy"] },
    { k:"retail", name:"Retail and hospitality", one:"Retailer", org:"demo-retail",
      who:"Retail chains, supermarkets, hotels, venues and food businesses: packaging, food organics, refrigeration and many small sites.",
      reports:["Cardboard, soft plastics and packaging recovered","Food organics recovered and food waste avoided","Electricity per site, refrigeration and gas","Water per site","Delivery fleet","Single-use products eliminated and take-back programs"],
      standards:["National Food Waste Strategy (halve food waste by 2030)","Packaging covenant (APCO) targets","National Waste Policy Action Plan targets","NGA factors"],
      per:"site", dominant:["waste","circular","energy","water","governance"] },
    { k:"logistics", name:"Logistics and transport", one:"Transport operator", org:"demo-freight",
      who:"Freight, fleet and transport operators: fuel is the biggest number, then tyres, depots and workshop waste.",
      reports:["Diesel, petrol and alternative fuels; kilometres and litres per 100 km","Fleet electrification and charging","Tyres, batteries, oil and workshop waste","Depot electricity and water","Pallets, packaging and cardboard","Idling hours where telematics exist"],
      standards:["NGA factors and NGER thresholds","Mandatory climate reporting for reporting groups","National Waste Policy Action Plan targets","Heavy vehicle emission standards as they apply"],
      per:"vehicle", dominant:["fleet","carbon","waste","energy","governance"] }
  ];

  /* The 30-day onboarding, one list for the public Onboarding page and the tool's tracker. */
  S.ONBOARDING = [
    {k:"scope",        week:1, label:"Scope agreed",                     you:"Confirm which sites and which of the ten categories are in.",           us:"Agree the sites, the categories and the streams for your sector, and write them into the method sheet."},
    {k:"agreement",    week:1, label:"Customer agreement signed",        you:"Sign the agreement. Foundation Members: confirm the fee waiver.",       us:"Issue the agreement with the term, fees and privacy terms, and record the signature."},
    {k:"contacts",     week:1, label:"Contacts and data operator set",   you:"Name a reporting contact and a person for each site.",                  us:"Name your Yarta data operator, who enters your figures and answers for the month."},
    {k:"checklist",    week:1, label:"Data request sent",                you:"Read the checklist for your sector and tell us what does not exist.",   us:"Send the checklist: the documents, who usually holds them and how often."},
    {k:"baseline",     week:2, label:"Baseline year set",                you:"Send the twelve months of the baseline year, or as many as exist.",     us:"Choose the baseline financial year with you so year-on-year is real from day one."},
    {k:"targets",      week:2, label:"Targets agreed",                   you:"Tell us your own targets, or adopt the eco standards.",                 us:"Set each target against the eco standard: the standard is the floor, your target is the bar."},
    {k:"method",       week:2, label:"Method sheet issued",              you:"Read and acknowledge how each category will be counted.",               us:"Issue the method sheet: factors, the benchmark edition and how each category is scored."},
    {k:"firstmonth",   week:3, label:"First month entered",              you:"Send the first month's bills, statements and contractor reports.",      us:"Key every figure, attach the evidence and mark what does not exist as not reported."},
    {k:"baselinedata", week:3, label:"Baseline months entered",          you:"Answer the gap email for anything missing from the baseline.",          us:"Key the baseline months so the comparison against them is real."},
    {k:"verified",     week:3, label:"First month verified",             you:"Nothing. A second analyst checks the month.",                           us:"A second analyst checks every figure against its document and grades the evidence."},
    {k:"dashboard",    week:4, label:"Dashboard live",                   you:"Sign in and look at your score, your categories and your first roadmap.", us:"Switch on your dashboard with the first score and the first roadmap drafted."},
    {k:"gaps",         week:4, label:"Monthly gap email scheduled",      you:"Expect one email a month, on the 1st, listing what is still needed.",   us:"Queue the first gap email for the 1st of next month."},
    {k:"handover",     week:4, label:"Handover call held",               you:"Bring the people who will act on the roadmap.",                         us:"Walk through the report and the suggestions, and book any help you want."}
  ];

  /* Data request checklists: what a customer sends, who usually holds it, how often, and how the evidence grades. */
  var C = function(cat,item,holder,freq,ev){ return {cat:cat,item:item,holder:holder,freq:freq,evidence:ev}; };
  S.CHECKLIST_COMMON = [
    C("energy","Electricity bills for every meter and site","Facilities or finance","Monthly","A · retailer bill with kWh, and GreenPower or renewable share if bought"),
    C("energy","Solar generation and the share used on site","Facilities","Monthly","A · inverter or retailer export"),
    C("energy","Gas bills (GJ)","Facilities or finance","Monthly","A · retailer bill"),
    C("energy","Renewable certificates or PPA statements","Sustainability lead","Annual","A · certificate or statement"),
    C("fleet","Fuel-card statements: litres by fuel type","Fleet or finance","Monthly","A · card statement (litres, not dollars)"),
    C("fleet","Fleet register: vehicles by fuel and electric","Fleet","When it changes","B · reconciled register"),
    C("fleet","Kilometres travelled","Fleet or telematics","Monthly","B · telematics or odometer extract"),
    C("water","Water bills (kL)","Facilities or finance","Monthly or quarterly","A · utility bill"),
    C("water","Rainwater, recycled, stormwater and bore volumes","Facilities","Monthly","B · meter reads"),
    C("waste","Contractor reports: tonnes by stream, and landfill","Waste contractor","Monthly","B · contractor report; A if a docket or certificate"),
    C("waste","Bin audit contamination result","Waste lead","Annual or quarterly","B · audit report"),
    C("circular","Recycled-content share of procurement","Procurement","Annual","B · procurement extract"),
    C("circular","Reuse and stewardship programs","Sustainability lead","Annual","B · program register"),
    C("land","Land rehabilitated or remediated (ha)","Property or environment","When work is done","B · project record"),
    C("nature","Trees planted and native vegetation restored","Environment or parks","When work is done","B · planting record"),
    C("community","Environment program events and participants","Community team","Monthly or quarterly","B · program register"),
    C("governance","Environmental complaints and incidents: opened and closed","Compliance","Monthly","B · register extract"),
    C("governance","Site list: name, state, staff, floor area","Operations","Once, then when it changes","B · site register")
  ];
  S.CHECKLIST_EXTRA = {
    council:[C("waste","Kerbside tonnes by service: garbage, recycling, organics, glass","Waste contractor or the council's waste team","Monthly","A · weighbridge summary; B · contractor report"),
      C("waste","Transfer station and hard-waste tonnes by stream","Transfer station operator","Monthly","A · weighbridge records"),
      C("energy","Streetlighting, pools and community buildings electricity and gas","Facilities","Monthly","A · retailer bills"),
      C("water","Parks, sports grounds and pools water","Parks and open space","Monthly or quarterly","A · utility bills"),
      C("community","Residents serviced","Corporate planning","Annual","B · latest ABS or council estimate")],
    business:[C("energy","NABERS energy rating certificates, if held","Property or facilities","Annual","A · rating certificate"),
      C("energy","Tenancy-level electricity where the building is leased","Property manager","Monthly","A · landlord invoice or sub-meter read")],
    health:[C("waste","Clinical waste and sharps: kilograms treated","Waste contractor","Monthly","A · treatment certificate or docket"),
      C("waste","Food waste and food organics tonnes","Catering","Monthly","B · contractor report"),
      C("energy","Beds and occupied bed days","Finance or planning","Annual","B · annual return")],
    education:[C("energy","Campus electricity and gas by building","Campus facilities","Monthly","A · retailer bills"),
      C("community","Student load (EFTSL)","Planning office","Annual","B · annual return"),
      C("waste","Food organics from catering and residences","Catering","Monthly","B · contractor report")],
    manufacturing:[C("energy","Process gas and electricity by plant","Plant manager","Monthly","A · retailer bills"),
      C("waste","Scrap metal, pallets, film and used oil tonnes","Operations","Monthly","A · scrap dockets; B · contractor report"),
      C("circular","Recycled content in inputs","Procurement","Annual","B · supplier declarations")],
    construction:[C("waste","Project waste by material: bin tonnage from each docket","Site manager or waste contractor","Per project, monthly","A · disposal docket"),
      C("waste","Soil and spoil movements","Site manager","Per project","A · soil docket"),
      C("fleet","Site plant fuel","Site or fleet","Monthly","A · fuel statement")],
    retail:[C("waste","Cardboard baler dockets and soft-plastics take-back","Store operations","Monthly","A · baler docket; B · contractor report"),
      C("waste","Food waste, organics and food rescued","Store operations","Monthly","B · contractor or charity report"),
      C("circular","Packaging recycled content and recyclability","Merchandise or packaging","Annual","B · supplier data")],
    logistics:[C("fleet","Fuel-card litres by fuel type for every vehicle","Fleet","Monthly","A · card statement"),
      C("fleet","Kilometres and litres per 100 km by depot","Telematics","Monthly","B · telematics"),
      C("waste","Tyres, batteries and workshop oil","Workshop","Monthly","A · collector docket")]
  };
  S.checklist = function(k){ return S.CHECKLIST_COMMON.concat(S.CHECKLIST_EXTRA[k]||[]); };
  S.BY = {}; S.SECTORS.forEach(function(s){ S.BY[s.k]=s; });
  S.forOrg = function(orgId){ return S.SECTORS.filter(function(s){ return s.org===orgId; })[0] || null; };
})(window.YESS);
