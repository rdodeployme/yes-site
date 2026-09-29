/* Yarta industry benchmarks, v0.1.
   Published figures only, from public sources, never from other Yarta customers. Each figure carries its source and the
   period it covers, and the report prints both. Where a sector has no published figure for a metric, the row says so.
   Sources checked 29 September 2026. */
(function(){
  var B = window.YESB = {};
  B.EDITION = 'Benchmarks v0.1 · sources checked 29 September 2026';
  B.SRC = {
    nwr:   {n:'National Waste and Resource Recovery Report 2024, DCCEEW (2022–23 data)', u:'https://www.dcceew.gov.au/environment/protection/waste/publications/national-waste-resource-recovery-reporting'},
    nswlg: {n:'NSW EPA, Local Government Waste Data Survey 2024–25 (all 128 councils)', u:'https://www.epa.nsw.gov.au/Your-environment/Recycling-and-reuse/warr-strategy/Performance-against-strategy/local-government-waste-data-survey-2024-25'},
    nswsoe:{n:'NSW State of the Environment 2024, waste and recycling (2022–23 data)', u:'https://www.soe.epa.nsw.gov.au/all-themes/people-and-industry/waste-and-recycling-2024'},
    svic:  {n:'Sustainability Victoria, Local Government Waste Services Report 2019–20', u:'https://assets.sustainability.vic.gov.au/susvic/Report-Waste-Local-Government-Waste-Services-Report-2019-20.pdf'},
    cec:   {n:'Clean Energy Council, Clean Energy Australia 2026 (2025 data)', u:'https://cleanenergycouncil.org.au/news-resources/clean-energy-australia-report-2026'},
    ntc:   {n:'National Transport Commission, light vehicle emissions intensity in Australia (2024 data)', u:'https://www.ntc.gov.au/light-vehicle-emissions-intensity-australia'},
    apco:  {n:'APCO, Australian Packaging Consumption and Recovery Data 2023–24', u:'https://apco.org.au/news/20YOl00000WKxMkMAL'}
  };
  /* Matched benchmarks: the same metric the report measures, so the two can sit on one bar. */
  var RENEW = {v:43, unit:'%', label:'Renewable share of Australia\'s electricity, 2025', src:'cec', note:'The grid average. Buying GreenPower or a renewable PPA lifts an organisation above it.'};
  var FLEET = {v:13, unit:'%', label:'Battery-electric share of new light vehicles registered in Australia, 2024', src:'ntc', note:'New registrations, not the whole fleet on the road, so a fleet buying at the market rate sits here.'};
  var CI    = {v:51, unit:'%', label:'Commercial and industrial waste recovered, NSW, 2022–23', src:'nswsoe'};
  var MSW   = {v:41, unit:'%', label:'Municipal waste recycled across all NSW councils, 2024–25', src:'nswlg'};
  var CD    = {v:81, unit:'%', label:'Construction and demolition waste recovered, Australia, 2022–23', src:'nwr'};
  /* Related published figures: printed on page 2 for context; not on the bars because the report does not measure the same thing. */
  var X_NATIONAL = {k:'National resource recovery rate', v:'66%', label:'All streams, Australia, 2022–23', src:'nwr'};
  var X_PLASTIC  = {k:'Plastics recovery rate', v:'12.5%', label:'Australia, 2022–23', src:'nwr'};
  var X_METALS   = {k:'Metals recovery rate', v:'90%', label:'Australia, 2022–23', src:'nwr'};
  var X_ORG      = {k:'Organics recovery rate', v:'62%', label:'Australia, 2022–23', src:'nwr'};
  var X_PAPER    = {k:'Paper and cardboard recovery rate', v:'56%', label:'Australia, 2022–23', src:'nwr'};
  var X_PKG_RC   = {k:'Average recycled content in packaging', v:'44%', label:'Australia, 2023–24', src:'apco'};
  var X_PKG_RRC  = {k:'Packaging that is reusable, recyclable or compostable', v:'86%', label:'Australia, 2023–24', src:'apco'};
  var X_PKG_PL   = {k:'Plastic packaging recycling rate', v:'20%', label:'Australia, 2023–24', src:'apco'};
  var X_TYRES    = {k:'End-of-life tyre recovery rate', v:'56%', label:'Australia, 2022–23, mostly energy recovery', src:'nwr'};
  var X_GLASS    = {k:'Glass recovery rate', v:'61%', label:'Australia, 2022–23', src:'nwr'};
  var X_BD       = {k:'Building and demolition materials recovered', v:'84%', label:'Australia, 2022–23', src:'nwr'};

  B.SECTORS = {
    council: { diversion:MSW, renewable:RENEW, fleet:FLEET, extra:[
      {k:'Kerbside recycling contamination', v:'9.9%', label:'Victorian councils, 2019–20, excluding councils affected by the SKM closure', src:'svic'},
      {k:'Yellow-bin material recycled', v:'90%', label:'NSW councils, 2024–25', src:'nswlg'},
      {k:'Municipal waste per person', v:'512 kg', label:'Australia, 2022–23', src:'nwr'},
      {k:'Households with a kerbside organics service', v:'73%', label:'NSW, 2024–25', src:'nswlg'},
      X_NATIONAL ]},
    business: { diversion:CI, renewable:RENEW, fleet:FLEET, extra:[ X_PAPER, X_NATIONAL, X_PKG_RC ],
      none:'Office energy: NABERS Energy ratings are mandatory for offices over 1,000 m², but no published national average intensity; a NABERS rating is the benchmark for a building.' },
    health: { diversion:CI, renewable:RENEW, fleet:FLEET, extra:[ X_NATIONAL, X_ORG ],
      none:'Hospital energy and water: NABERS rates Victorian public hospitals per occupied bed day; the averages are not published, so the report compares each hospital with its own baseline and target.' },
    education: { diversion:CI, renewable:RENEW, fleet:FLEET, extra:[ X_NATIONAL, X_PAPER ],
      none:'Campus energy and water: the TEFMA benchmark survey holds the sector figures for members; they are not published, so the report compares each campus with its own baseline and target.' },
    manufacturing: { diversion:CI, renewable:RENEW, fleet:FLEET, extra:[ X_METALS, X_PLASTIC, X_PKG_RC, X_NATIONAL ] },
    construction: { diversion:CD, renewable:RENEW, fleet:FLEET, extra:[ X_BD, X_METALS, X_NATIONAL ] },
    retail: { diversion:CI, renewable:RENEW, fleet:FLEET, extra:[ X_PKG_RRC, X_PKG_PL, X_PKG_RC, X_ORG, X_GLASS ] },
    logistics: { diversion:CI, renewable:RENEW, fleet:FLEET, extra:[ X_TYRES, X_NATIONAL ] }
  };
  B.forSector = function(k){
    var s = B.SECTORS[k] || B.SECTORS.business;
    return { diversion:s.diversion, renewable:s.renewable, fleet:s.fleet, emissions:null, extra:s.extra||[], none:s.none||'', edition:B.EDITION };
  };
  B.src = function(code){ return (B.SRC[code]||{}).n || ''; };
  /* the short list of sources used by one sector, in order of first use */
  B.sources = function(k){
    var s=B.forSector(k), seen={}, out=[];
    ['diversion','renewable','fleet'].forEach(function(x){ if(s[x]&&!seen[s[x].src]){ seen[s[x].src]=1; out.push(B.SRC[s[x].src]); } });
    s.extra.forEach(function(x){ if(!seen[x.src]){ seen[x.src]=1; out.push(B.SRC[x.src]); } });
    return out;
  };
})();
