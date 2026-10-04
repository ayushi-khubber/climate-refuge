const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const j=async(u,o)=>{const r=await fetch(u,o);if(!r.ok)throw new Error('HTTP '+r.status);return r.json()};
const dist=(a,b,c,d)=>{const r=Math.PI/180,x=(c-a)*r,y=(d-b)*r,h=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2;return 12742*Math.asin(Math.sqrt(h))};
let place=null,map,layer,hist=null,fac,facs=[];

document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#tabs button,.tab').forEach(e=>e.classList.remove('on'));
  b.classList.add('on');$('#'+b.dataset.tab).classList.add('on');
  if(b.dataset.tab==='respond'&&map)setTimeout(()=>map.invalidateSize(),50);
});

$('#searchForm').onsubmit=async e=>{
  e.preventDefault();const q=$('#q').value.trim();if(!q)return;
  try{
    const d=await j('https://geocoding-api.open-meteo.com/v1/search?count=1&name='+encodeURIComponent(q));
    if(!d.results)return alert('Place not found.');
    const r=d.results[0];setPlace({lat:r.latitude,lon:r.longitude,name:[r.name,r.admin1,r.country].filter(Boolean).join(', '),cc:r.country_code});
  }catch(err){alert('Search failed: '+err.message)}
};
$('#geo').onclick=()=>navigator.geolocation?navigator.geolocation.getCurrentPosition(
  p=>setPlace({lat:p.coords.latitude,lon:p.coords.longitude,name:'Your location',cc:''}),
  ()=>alert('Could not get location. Try searching instead.')):alert('Geolocation not supported.');

function setPlace(p){
  place=p;$('#placeName').textContent='📍 '+p.name;
  const GK={floods:'flood',wildfires:'wildfire',severeStorms:'cyclone',tempExtremes:'heat',earthquakes:'quake'};
  if(GK[p.cat]){$('#gsel').value=GK[p.cat];showG()}
  showO();
  const nums={US:'911',CA:'911',GB:'999',AU:'000',IN:'112'};
  $('#emnum').textContent=nums[p.cc]||'112 works in many countries; check locally.';
  loadWeather();loadAlerts();loadFacilities();loadHistory();
}

async function loadWeather(){
  $('#now').textContent='Loading…';
  try{
    const d=await j(`https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`);
    const c=d.current;
    $('#now').innerHTML=`<div class="row"><span>Temperature</span><b>${c.temperature_2m}°C</b></div><div class="row"><span>Humidity</span><b>${c.relative_humidity_2m}%</b></div><div class="row"><span>Wind / gusts</span><b>${c.wind_speed_10m} / ${c.wind_gusts_10m} km/h</b></div><div class="row"><span>Rain chance today</span><b>${d.daily.precipitation_probability_max[0]}%</b></div>`;
    $('#fc').innerHTML=d.daily.time.map((t,i)=>`<div class="row"><span>${t}</span><span>${d.daily.temperature_2m_min[i]}° – ${d.daily.temperature_2m_max[i]}°C</span><span>rain ${d.daily.precipitation_probability_max[i]}%</span></div>`).join('');
  }catch(e){$('#now').innerHTML='<span class="err">Weather unavailable ('+esc(e.message)+')</span>'}
}

async function loadAlerts(){
  $('#alerts').textContent='Loading…';
  const items=[];
  const [eo,us]=await Promise.allSettled([
    j('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=200'),
    j('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson')]);
  if(eo.status==='fulfilled')eo.value.events.forEach(ev=>{
    const g=ev.geometry[ev.geometry.length-1];if(g.type!=='Point')return;
    items.push({t:ev.title,k:ev.categories[0].title,lat:g.coordinates[1],lon:g.coordinates[0],src:'NASA EONET'});});
  if(us.status==='fulfilled')us.value.features.forEach(f=>items.push({t:f.properties.title,k:'Earthquake',lat:f.geometry.coordinates[1],lon:f.geometry.coordinates[0],src:'USGS'}));
  items.forEach(i=>i.d=dist(place.lat,place.lon,i.lat,i.lon));
  const near=items.filter(i=>i.d<=500).sort((a,b)=>a.d-b.d);
  $('#alerts').innerHTML=near.length?near.map(i=>`<div class="row"><span>${esc(i.t)}<br><small>${esc(i.k)} · ${i.src}</small></span><b>${Math.round(i.d)} km</b></div>`).join(''):'No tracked hazard events within 500 km right now. (Absence of an alert does not mean safety.)';
  drawMap(near,[]);
}

async function loadFacilities(){
  $('#facilities').textContent='Loading…';facs=[];drawFac();
  const q=`[out:json][timeout:20];nwr["amenity"~"hospital|clinic"](around:15000,${place.lat},${place.lon});out center 40;`;
  try{
    const d=await j('https://overpass-api.de/api/interpreter',{method:'POST',body:'data='+encodeURIComponent(q)});
    const f=d.elements.map(e=>({n:e.tags.name||'(unnamed '+e.tags.amenity+')',lat:e.lat||e.center.lat,lon:e.lon||e.center.lon,ph:e.tags.phone||e.tags['contact:phone']||''}))
      .map(x=>({...x,d:dist(place.lat,place.lon,x.lat,x.lon)})).sort((a,b)=>a.d-b.d).slice(0,10);
    $('#facilities').innerHTML=f.length?f.map(x=>`<div class="row"><span>${esc(x.n)}<br><small>${esc(x.ph)}</small></span><b>${x.d.toFixed(1)} km</b></div>`).join(''):'None found in OpenStreetMap within 15 km.';
    facs=f;drawFac();
  }catch(e){$('#facilities').innerHTML='<span class="err">Facility lookup unavailable ('+esc(e.message)+'). Try again shortly.</span>'}
}

function drawMap(hz){
  if(!map){map=L.map('map');L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map)}
  map.setView([place.lat,place.lon],8);
  layer&&layer.remove();layer=L.layerGroup().addTo(map);
  L.circleMarker([place.lat,place.lon],{color:'#1f3a2e'}).addTo(layer).bindPopup('You');
  hz.forEach(i=>L.circleMarker([i.lat,i.lon],{color:'#c8553d'}).addTo(layer).bindPopup(esc(i.t)));drawFac();
}

async function loadHistory(){
  $('#chart').textContent='Loading…';hist=null;
  const y=new Date().getFullYear();
  try{
    const d=(await j(`https://archive-api.open-meteo.com/v1/archive?latitude=${place.lat}&longitude=${place.lon}&start_date=${y-10}-01-01&end_date=${y-1}-12-31&daily=temperature_2m_max,precipitation_sum,wind_speed_10m_max&timezone=auto`)).daily;
    hist={};d.time.forEach((t,i)=>{const k=t.slice(0,4);const h=hist[k]??={heat:-99,rain:0,wind:0};
      h.heat=Math.max(h.heat,d.temperature_2m_max[i]??-99);h.rain+=d.precipitation_sum[i]||0;h.wind=Math.max(h.wind,d.wind_speed_10m_max[i]||0)});
    drawChart();
  }catch(e){$('#chart').innerHTML='<span class="err">Historical data unavailable ('+esc(e.message)+')</span>'}
}
$('#focus').onchange=drawChart;
function drawChart(){
  if(!hist)return;
  const f=$('#focus').value,key={heat:'heat',rain:'rain',wind:'wind',drought:'rain'}[f];
  const unit={heat:'°C peak',rain:'mm per year',wind:'km/h peak gust-day',drought:'mm per year'}[f];
  const ys=Object.keys(hist),v=ys.map(k=>hist[k][key]),m=Math.max(...v)||1;
  $('#chartTitle').innerHTML=`${{heat:'Peak temperature',rain:'Annual precipitation',wind:'Peak wind',drought:'Annual precipitation (low years suggest drought)'}[f]} <span class="tag hist">HISTORICAL</span>`;
  $('#chart').innerHTML=`<svg viewBox="0 0 600 220" width="100%">${v.map((x,i)=>{const h=x/m*150;return `<rect x="${20+i*57}" y="${180-h}" width="40" height="${h}" fill="#1f3a2e"/><text x="${40+i*57}" y="${174-h}" text-anchor="middle">${Math.round(x)}</text><text x="${40+i*57}" y="200" text-anchor="middle">${ys[i]}</text>`}).join('')}</svg><small>Unit: ${unit}. Source: Open-Meteo archive (ERA5 reanalysis).</small>`;
}

const G={
flood:{before:['Know your evacuation route and nearest higher ground.','Keep documents and a go-bag ready (see the Prepare tab).','Move valuables and electrical items upstairs.'],
 during:['Move to higher ground immediately.','Never walk or drive through floodwater.','Avoid contact with floodwater; it may be contaminated.'],
 after:['Do not return until officials say it is safe.','Use only water confirmed safe to drink.','Photograph damage for insurance, then dry out the building quickly to limit mold.']},
heat:{before:['Find your local heat-action plan and nearby cooling spaces.','Prepare fans, shade and light clothing.','Ask a pharmacist whether your medicines raise heat risk.'],
 during:['Drink water regularly, even if not thirsty.','Stay in shade or cool buildings in the afternoon.','Check on elderly neighbors, children, and pets.'],
 after:['Rehydrate and rest; watch for headache, nausea or dizziness.','Check on vulnerable neighbors again.','Get medical help for confusion, fainting or a very high body temperature.']},
cyclone:{before:['Know your evacuation zone and shelter location.','Secure outdoor objects and stock 3 days of supplies.','Charge phones and power banks.'],
 during:['Follow official evacuation orders.','Stay away from windows; shelter in an interior room.','Wait for official all-clear: the eye can be calm.'],
 after:['Stay away from downed power lines and floodwater.','Run generators outdoors only, away from windows (carbon monoxide).','Avoid damaged buildings and check on neighbors.']},
wildfire:{before:['Know two exit routes and a meeting point.','Clear dry vegetation near your home.','Keep a go-bag by the door; keep N95 masks if you can.'],
 during:['Evacuate early if told to.','Close windows; limit smoke exposure.','Know two exit routes.'],
 after:['Return only when officials say it is safe.','Watch for hot spots, ash and damaged trees.','Wear an N95 mask and gloves when cleaning up ash.']},
quake:{before:['Secure heavy furniture to walls.','Know the safe spots in each room.','Keep shoes and a torch near your bed.'],
 during:['Drop, cover, and hold on.','Stay away from windows and heavy furniture.','Expect aftershocks.'],
 after:['Check yourself and others for injuries; give first aid.','Leave damaged buildings; expect aftershocks.','If you smell gas, leave and avoid switches or flames. Near the coast, move inland after strong shaking.']}};
const showG=()=>{const g=G[$('#gsel').value];$('#guide').innerHTML=[['Before',g.before],['During',g.during],['After',g.after]].map(([t,a])=>`<h4>${t}</h4><ul>${a.map(x=>`<li>${x}</li>`).join('')}</ul>`).join('')};
$('#gsel').onchange=showG;showG();

// Act & Give (links go to each organization's official site)
const ORGS=[
 {n:'IFRC (Red Cross / Red Crescent)',url:'https://www.ifrc.org',focus:'relief',tags:['floods','severeStorms','earthquakes','wildfires'],best:'Fast response through local volunteers',how:'Supports national societies already on the ground, including pre-positioned relief and early funding.'},
 {n:'MSF (Doctors Without Borders)',url:'https://www.msf.org',focus:'medical',tags:['earthquakes','floods'],best:'Medical care in crises',how:'Funds clinics, surgery and outbreak response. Unrestricted gifts are preferred.'},
 {n:'WFP',url:'https://www.wfp.org',focus:'food',tags:['drought','floods','severeStorms'],best:'Food security and slow-onset crises',how:'Funds food and cash assistance and logistics.'},
 {n:'UNHCR',url:'https://www.unhcr.org',focus:'displacement',tags:[],best:'Long-term displacement',how:'Shelter, protection and legal support.'},
 {n:'IOM',url:'https://www.iom.int',focus:'displacement',tags:['floods','severeStorms','drought'],best:'Disaster displacement and camp coordination',how:'Runs displacement tracking and site management.'},
 {n:'ICRC',url:'https://www.icrc.org',focus:'relief',tags:[],best:'Conflict zones',how:'Neutral humanitarian access, family reunification, medical aid.'},
 {n:'Oxfam',url:'https://www.oxfam.org',focus:'relief',tags:['drought','floods'],best:'Water, sanitation and long-term resilience',how:'Water systems, cash support and advocacy.'}];
const vet=n=>'https://www.charitynavigator.org/search?q='+encodeURIComponent(n);
const showO=()=>{
  const f=$('#ofocus').value,cat=place&&place.cat;
  const list=ORGS.filter(o=>f==='all'||o.focus===f).sort((a,b)=>b.tags.includes(cat)-a.tags.includes(cat));
  $('#orgs').innerHTML=list.map(o=>{const rel=o.tags.includes(cat);
    return `<div class="card ${rel?'good':''}"><h3>${o.n}</h3>${rel?'<span class="tag live">Relevant to the area you checked</span>':''}<p><b>Best for:</b> ${o.best}</p><p><b>What a gift does:</b> ${o.how}</p><a target="_blank" rel="noopener" href="${o.url}">Official site →</a><a target="_blank" rel="noopener" href="${vet(o.n)}">Check rating →</a></div>`}).join('')};
$('#ofocus').onchange=showO;showO();

let evs=[],shown=[],map2,l2;
const ICON={wildfires:'🔥',severeStorms:'🌀',floods:'🌊',volcanoes:'🌋',earthquakes:'📳',drought:'🏜️',landslides:'⛰️',seaLakeIce:'🧊',snow:'❄️',tempExtremes:'🌡️',dustHaze:'🌫️'};
const ago=d=>{const h=(Date.now()-new Date(d))/36e5;return h<1?'just now':h<48?Math.round(h)+' h ago':Math.round(h/24)+' days ago'};
async function loadFeed(){
  $('#feedStatus').textContent=' Updating…';
  const [eo,us]=await Promise.allSettled([
    j('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=150'),
    j('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson')]);
  evs=[];
  if(eo.status==='fulfilled')eo.value.events.forEach(e=>{try{
    const g=e.geometry[e.geometry.length-1],c=g.type==='Point'?g.coordinates:g.coordinates[0][0];
    evs.push({t:e.title,cat:e.categories[0].id,date:g.date,lat:c[1],lon:c[0],mag:g.magnitudeValue?g.magnitudeValue+' '+(g.magnitudeUnit||''):'',links:e.sources.map(s=>[s.id,s.url])});
  }catch{}});
  if(us.status==='fulfilled')us.value.features.forEach(f=>evs.push({t:f.properties.title,cat:'earthquakes',date:f.properties.time,lat:f.geometry.coordinates[1],lon:f.geometry.coordinates[0],mag:'M'+f.properties.mag,links:[['USGS',f.properties.url]]}));
  const sel=$('#fcat'),cur=sel.value;
  sel.innerHTML='<option value="all">All</option>'+[...new Set(evs.map(e=>e.cat))].map(c=>`<option ${c===cur?'selected':''} value="${esc(c)}">${esc(c)}</option>`).join('');
  $('#feedStatus').textContent=evs.length?' Updated '+new Date().toLocaleTimeString():' Feed unavailable — try again shortly.';
  renderFeed();
}
function renderFeed(){
  const f=$('#fcat').value;
  shown=evs.filter(e=>f==='all'||e.cat===f).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,30);
  $('#feedList').innerHTML=shown.map((e,i)=>{
    const lk=e.links.filter(l=>/^https?:/.test(l[1])).map(l=>`<a target="_blank" rel="noopener" href="${esc(l[1])}">${esc(l[0])}</a>`).join('');
    const rw='https://reliefweb.int/updates?search='+encodeURIComponent(e.t.split(',')[0]);
    return `<div class="card"><span class="tag">${ICON[e.cat]||'•'} ${esc(e.cat)}</span> <small>${ago(e.date)}</small><h3>${esc(e.t)}</h3>${e.mag?`<p>Size: ${esc(e.mag)}</p>`:''}<p><b>Official reporting:</b><br>${lk}<a target="_blank" rel="noopener" href="${rw}">ReliefWeb</a><a target="_blank" rel="noopener" href="https://www.gdacs.org">GDACS</a></p><button data-i="${i}">Check this area →</button></div>`}).join('')||'No events.';
  if(!map2){map2=L.map('map2').setView([20,0],2);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map2)}
  l2&&l2.remove();l2=L.layerGroup().addTo(map2);
  shown.forEach(e=>L.circleMarker([e.lat,e.lon],{color:'#c8553d'}).addTo(l2).bindPopup(esc(e.t)));
}
$('#fcat').onchange=renderFeed;
$('#feedList').onclick=e=>{const b=e.target.closest('button');if(!b)return;const v=shown[b.dataset.i];
  setPlace({lat:v.lat,lon:v.lon,name:v.t,cc:'',cat:v.cat});document.querySelector('[data-tab=respond]').click()};
document.querySelector('[data-tab=feed]').addEventListener('click',()=>setTimeout(()=>map2&&map2.invalidateSize(),50));
loadFeed();setInterval(loadFeed,600000);

const CK=['Water: 3 litres per person per day for 3 days','Non-perishable food for 3 days','Phone + power bank','Copies of ID in a waterproof bag','Medications and first-aid kit','Torch and spare batteries','Cash in small notes','Warm clothing / blanket','Family meeting point agreed','Emergency contacts written on paper'];
let st={};try{st=JSON.parse(localStorage.getItem('cr_ck')||'{}')}catch{}
$('#ck').innerHTML=CK.map((c,i)=>`<label><input type="checkbox" data-k="${i}" ${st[i]?'checked':''}> ${c}</label>`).join('');
$('#ck').onchange=e=>{st[e.target.dataset.k]=e.target.checked;try{localStorage.setItem('cr_ck',JSON.stringify(st))}catch{}};
try{$('#notes').value=localStorage.getItem('cr_notes')||''}catch{}
$('#notes').oninput=e=>{try{localStorage.setItem('cr_notes',e.target.value)}catch{}};

function drawFac(){
  if(!map)return;
  fac&&fac.remove();fac=L.layerGroup().addTo(map);
  facs.forEach(x=>L.marker([x.lat,x.lon]).addTo(fac).bindPopup(esc(x.n)));
}

$('#vform').onsubmit=e=>{
  e.preventDefault();const n=$('#vq').value.trim();if(!n)return;const q=encodeURIComponent(n);
  $('#vres').innerHTML=`<p><a target="_blank" rel="noopener" href="https://www.charitynavigator.org/search?q=${q}">Charity Navigator</a><a target="_blank" rel="noopener" href="https://www.charitywatch.org">CharityWatch</a><a target="_blank" rel="noopener" href="https://duckduckgo.com/?q=${q}+charity+scam+OR+complaints">Search for complaints</a></p>`;
};
