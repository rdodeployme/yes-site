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
  S.BY = {}; S.SECTORS.forEach(function(s){ S.BY[s.k]=s; });
  S.forOrg = function(orgId){ return S.SECTORS.filter(function(s){ return s.org===orgId; })[0] || null; };
})(window.YESS);
