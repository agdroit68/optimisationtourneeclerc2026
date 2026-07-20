/* =====================================================
   Optimiseur de tournée — significations d'actes
   Version GitHub Pages
   Modes :
   - Gratuit : géocodage OpenStreetMap (Nominatim) + optimisation TSP locale
   - Google  : clé API → itinéraire optimisé par Google Directions, carte, km/durées réels
   ===================================================== */

/* ================= ÉTAT ================= */
let stops = [];
let nextId = 1;
let gKey = '';
let gReady = false;
let mapObj = null, dirRenderer = null;
let startPresets = { etude:'', domicile:'', autre:'' };
let activePreset = 'etude';
const PRESET_HINTS = {
  etude: "Adresse de l'étude — ex. 12 avenue …, 68100 Mulhouse",
  domicile: 'Adresse de ton domicile',
  autre: 'Toute autre adresse de départ'
};
const $ = id => document.getElementById(id);

/* ================= PERSISTANCE (localStorage) ================= */
function saveState(){
  try{
    startPresets[activePreset] = $('startAddr').value;
    localStorage.setItem('tournee-state', JSON.stringify({
      stops, nextId, startPresets, activePreset,
      roundTrip: $('roundTrip').checked, gKey
    }));
  }catch(e){ console.error('save', e); }
}
function loadState(){
  try{
    const raw = localStorage.getItem('tournee-state');
    if(raw){
      const s = JSON.parse(raw);
      stops = s.stops || [];
      nextId = s.nextId || 1;
      startPresets = s.startPresets || { etude:'', domicile:'', autre:'' };
      activePreset = s.activePreset || 'etude';
      $('roundTrip').checked = s.roundTrip !== false;
      gKey = s.gKey || '';
      if(gKey) $('gKey').value = gKey;
    }
  }catch(e){ /* première utilisation */ }
  renderPresets();
  renderStops();
  if(gKey) tryLoadGoogle();
  else setMode(false);
}

/* ================= MODE ================= */
function setMode(live){
  const b = $('modeBadge');
  b.classList.toggle('live', live);
  $('modeTxt').textContent = live ? 'Connecté à Google Maps' : 'Mode gratuit (OpenStreetMap)';
  const ks = $('keyState');
  if(gKey){
    ks.className = 'keystate ' + (live ? 'ok' : 'ko');
    ks.textContent = live ? '✓ Clé Google active — calculs faits par Google Maps'
                          : '✗ Clé enregistrée mais Google injoignable — vérifie la clé et les API activées';
  } else { ks.className='keystate'; ks.textContent=''; }
}

/* ============ CHARGEMENT SDK GOOGLE MAPS ============ */
function tryLoadGoogle(){
  if(gReady){ setMode(true); return Promise.resolve(true); }
  return new Promise((resolve)=>{
    window.__gmReady = ()=>{ gReady = true; setMode(true); resolve(true); };
    const s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(gKey)
          + '&language=fr&region=FR&loading=async&callback=__gmReady';
    s.onerror = ()=>{ setMode(false); resolve(false); };
    setTimeout(()=>{ if(!gReady){ setMode(false); resolve(false); } }, 6000);
    document.head.appendChild(s);
  });
}

$('btnSaveKey').onclick = async ()=>{
  gKey = $('gKey').value.trim();
  saveState();
  if(gKey){
    $('keyState').className='keystate'; $('keyState').textContent='Vérification de la clé Google…';
    await tryLoadGoogle();
  } else setMode(false);
};
$('btnDelKey').onclick = ()=>{
  gKey=''; $('gKey').value='';
  gReady=false; setMode(false); saveState();
};

/* ================= LISTE ================= */
function renderStops(){
  const list = $('stopList');
  $('count').textContent = stops.length;
  if(!stops.length){
    list.innerHTML = '<div class="empty">Aucune adresse pour le moment.</div>';
    return;
  }
  list.innerHTML = stops.map((s,i)=>`
    <div class="stop">
      <div class="dot">${i+1}</div>
      <div class="addr">${escapeHtml(s.text)}</div>
      <button class="del" data-id="${s.id}" aria-label="Supprimer cette adresse">×</button>
    </div>`).join('');
  list.querySelectorAll('.del').forEach(b=>{
    b.onclick = ()=>{ stops = stops.filter(s=>s.id != b.dataset.id); renderStops(); saveState(); };
  });
}
function escapeHtml(t){ const d=document.createElement('div'); d.textContent=t; return d.innerHTML; }
function addAddresses(raw){
  raw.split('\n').map(l=>l.trim()).filter(l=>l.length>3).forEach(l=>stops.push({id:nextId++, text:l}));
  renderStops(); saveState();
}
$('btnAdd').onclick = ()=>{
  const v = $('addrInput').value.trim();
  if(!v) return;
  addAddresses(v); $('addrInput').value='';
};
$('btnClear').onclick = ()=>{
  if(stops.length && confirm('Vider toutes les adresses ?')){
    stops=[]; renderStops(); saveState();
    $('resultCard').classList.add('hidden');
  }
};

/* ============ POINT DE DÉPART (presets) ============ */
function renderPresets(){
  document.querySelectorAll('.preset').forEach(b=>{
    const p = b.dataset.preset;
    b.classList.toggle('active', p===activePreset);
    b.classList.toggle('filled', !!startPresets[p]);
    b.setAttribute('aria-selected', p===activePreset ? 'true' : 'false');
  });
  $('startAddr').value = startPresets[activePreset] || '';
  $('startAddr').placeholder = PRESET_HINTS[activePreset];
}
document.querySelectorAll('.preset').forEach(b=>{
  b.onclick = ()=>{
    startPresets[activePreset] = $('startAddr').value;
    activePreset = b.dataset.preset;
    renderPresets();
    saveState();
    if(!startPresets[activePreset]) $('startAddr').focus();
  };
});

/* =====================================================
   OPTIMISATION — MODE GOOGLE (Directions API)
   ===================================================== */
function gRoute(req){
  return new Promise((res,rej)=>{
    new google.maps.DirectionsService().route(req,(r,status)=>{
      if(status==='OK') res(r);
      else rej(new Error('Google Directions : '+status));
    });
  });
}
function gGeocode(addr){
  return new Promise((res,rej)=>{
    new google.maps.Geocoder().geocode({address:addr, region:'FR'},(r,status)=>{
      if(status==='OK' && r[0]) res(r[0].geometry.location);
      else rej(new Error('adresse introuvable : « '+addr+' »'));
    });
  });
}
async function optimizeWithGoogle(startAddr, roundTrip){
  if(stops.length > 25) throw new Error('Google Maps accepte 25 étapes maximum par calcul — divise la tournée en deux listes.');

  let destination, waypointStops;
  if(roundTrip){
    destination = startAddr;
    waypointStops = stops.map(s=>s.text);
  } else {
    // Tournée ouverte : la destination doit être un arrêt. On prend le plus éloigné du départ.
    const startLoc = await gGeocode(startAddr);
    let farIdx=0, farD=-1;
    for(let i=0;i<stops.length;i++){
      const loc = await gGeocode(stops[i].text);
      const d = Math.hypot(loc.lat()-startLoc.lat(), loc.lng()-startLoc.lng());
      if(d>farD){ farD=d; farIdx=i; }
    }
    destination = stops[farIdx].text;
    waypointStops = stops.filter((_,i)=>i!==farIdx).map(s=>s.text);
  }

  const result = await gRoute({
    origin: startAddr,
    destination,
    waypoints: waypointStops.map(w=>({location:w, stopover:true})),
    optimizeWaypoints: true,
    travelMode: google.maps.TravelMode.DRIVING
  });

  const route = result.routes[0];
  const ordered = route.waypoint_order.map(i=>waypointStops[i]);
  const orderedStops = roundTrip ? ordered : [...ordered, destination];

  let meters=0, seconds=0;
  route.legs.forEach(l=>{ meters+=l.distance.value; seconds+=l.duration.value; });
  const legInfos = route.legs.map(l=>({km:l.distance.value/1000, min:Math.round(l.duration.value/60)}));

  $('map').style.display='block';
  if(!mapObj){
    mapObj = new google.maps.Map($('map'),{
      disableDefaultUI:true, zoomControl:true,
      styles:[{featureType:'poi',stylers:[{visibility:'off'}]}]
    });
    dirRenderer = new google.maps.DirectionsRenderer({
      map:mapObj,
      polylineOptions:{strokeColor:'#14594a',strokeWeight:5,strokeOpacity:.85}
    });
  }
  dirRenderer.setDirections(result);

  return { orderedStops, km:meters/1000, durMin:Math.round(seconds/60), legInfos, engine:'google' };
}

/* =====================================================
   OPTIMISATION — MODE GRATUIT (OpenStreetMap / Nominatim)
   ===================================================== */
const sleep = ms => new Promise(r=>setTimeout(r,ms));

async function nominatimGeocode(addr){
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=fr&q='
            + encodeURIComponent(addr);
  const r = await fetch(url, {headers:{'Accept-Language':'fr'}});
  if(!r.ok) throw new Error('service de localisation indisponible ('+r.status+')');
  const j = await r.json();
  if(!j.length) throw new Error('adresse introuvable : « '+addr+' » — ajoute le code postal et la ville');
  return { lat:parseFloat(j[0].lat), lng:parseFloat(j[0].lon) };
}

async function geocodeAllFree(addresses, onProgress){
  const pts=[];
  for(let i=0;i<addresses.length;i++){
    onProgress(i+1, addresses.length);
    pts.push(await nominatimGeocode(addresses[i]));
    if(i<addresses.length-1) await sleep(1100); // politesse Nominatim : 1 requête/seconde max
  }
  return pts;
}

function haversine(a,b){
  const R=6371, toRad=d=>d*Math.PI/180;
  const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng);
  const h=Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
function solveTSP(points, roundTrip){
  const n=points.length;
  const D=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>haversine(points[i],points[j])));
  let order=[0]; const used=new Set([0]);
  while(order.length<n){
    const last=order[order.length-1];
    let best=-1,bd=Infinity;
    for(let j=0;j<n;j++) if(!used.has(j)&&D[last][j]<bd){bd=D[last][j];best=j;}
    order.push(best); used.add(best);
  }
  const tourLen=o=>{
    let t=0;
    for(let i=0;i<o.length-1;i++) t+=D[o[i]][o[i+1]];
    if(roundTrip) t+=D[o[o.length-1]][o[0]];
    return t;
  };
  let improved=true, guard=0;
  while(improved&&guard++<60){
    improved=false;
    for(let i=1;i<order.length-1;i++) for(let k=i+1;k<order.length;k++){
      const cand=[...order.slice(0,i),...order.slice(i,k+1).reverse(),...order.slice(k+1)];
      if(tourLen(cand)<tourLen(order)-1e-6){order=cand;improved=true;}
    }
  }
  return {order, km:tourLen(order)};
}
async function optimizeFree(startAddr, roundTrip, statusEl){
  const addresses=[startAddr, ...stops.map(s=>s.text)];
  const pts = await geocodeAllFree(addresses, (i,n)=>{
    statusEl.textContent = 'Localisation des adresses… '+i+' / '+n;
  });
  statusEl.textContent = 'Optimisation de l\'ordre de passage…';
  const {order, km} = solveTSP(pts, roundTrip);
  return {
    orderedStops: order.slice(1).map(idx=>stops[idx-1].text),
    km, durMin:null, legInfos:null, engine:'free'
  };
}

/* ============ LIENS DE NAVIGATION GOOGLE MAPS ============ */
// Limite URL : origin + 9 waypoints + destination = 11 points par segment
function buildMapsLinks(orderedAddresses, roundTrip, startAddr){
  const pts=[startAddr, ...orderedAddresses];
  if(roundTrip) pts.push(startAddr);
  const links=[]; let i=0;
  while(i<pts.length-1){
    const end=Math.min(i+10, pts.length-1);
    let url='https://www.google.com/maps/dir/?api=1'
      +'&origin='+encodeURIComponent(pts[i])
      +'&destination='+encodeURIComponent(pts[end])
      +'&travelmode=driving';
    const wps=pts.slice(i+1,end);
    if(wps.length) url+='&waypoints='+wps.map(encodeURIComponent).join('%7C');
    links.push(url); i=end;
  }
  return links;
}

/* ============ ACTION PRINCIPALE ============ */
$('btnOptimize').onclick = async ()=>{
  const st=$('optStatus');
  const startAddr=$('startAddr').value.trim();
  if(!startAddr){ st.className='status err'; st.textContent='Indique le point de départ.'; return; }
  if(stops.length<2){ st.className='status err'; st.textContent='Ajoute au moins 2 adresses.'; return; }

  const btn=$('btnOptimize'), oldHtml=btn.innerHTML;
  btn.disabled=true; btn.innerHTML='<div class="spinner"></div> Calcul…';
  saveState();

  const roundTrip=$('roundTrip').checked;
  try{
    let res;
    if(gKey && (gReady || await tryLoadGoogle())){
      st.className='status info'; st.textContent='Google Maps calcule l\'itinéraire optimal…';
      res = await optimizeWithGoogle(startAddr, roundTrip);
    } else {
      st.className='status info';
      res = await optimizeFree(startAddr, roundTrip, st);
      $('map').style.display='none';
    }
    renderResult(startAddr, res, roundTrip);
    st.className='status';
  }catch(err){
    st.className='status err'; st.textContent='Erreur : '+err.message;
  }finally{
    btn.disabled=false; btn.innerHTML=oldHtml;
  }
};

function renderResult(startAddr, res, roundTrip){
  const {orderedStops, km, durMin, legInfos, engine} = res;
  $('resultCard').classList.remove('hidden');
  $('totKm').textContent = (engine==='google' ? km.toFixed(1) : '≈ '+km.toFixed(1));
  $('totStops').textContent = orderedStops.length;
  if(durMin!=null){
    $('durBox').style.display='';
    $('totDur').textContent = durMin>=60 ? Math.floor(durMin/60)+' h '+String(durMin%60).padStart(2,'0') : durMin+' min';
  } else { $('durBox').style.display='none'; }

  $('resultSub').textContent = engine==='google'
    ? 'Ordre calculé par Google Maps sur les routes réelles'
    : 'Ordre optimisé (localisation OpenStreetMap, distances à vol d\'oiseau)';

  const startLabel = {etude:'Départ — étude', domicile:'Départ — domicile', autre:'Départ'}[activePreset] || 'Départ';
  let html = `<div class="leg"><div class="num terminus">D</div><div class="body"><div class="a">${escapeHtml(startAddr)}</div><div class="d">${startLabel}</div></div></div>`;
  orderedStops.forEach((a,i)=>{
    let detail = 'Signification n°'+(i+1);
    if(legInfos && legInfos[i]) detail += ' · <b>'+legInfos[i].km.toFixed(1)+' km · '+legInfos[i].min+' min</b> depuis l\'arrêt précédent';
    html += `<div class="leg"><div class="num">${i+1}</div><div class="body"><div class="a">${escapeHtml(a)}</div><div class="d">${detail}</div></div></div>`;
  });
  if(roundTrip){
    let detail = {etude:'Retour à l\'étude', domicile:'Retour au domicile', autre:'Retour au point de départ'}[activePreset] || 'Retour au point de départ';
    if(legInfos && legInfos[orderedStops.length]) detail += ' · <b>'+legInfos[orderedStops.length].km.toFixed(1)+' km · '+legInfos[orderedStops.length].min+' min</b>';
    html += `<div class="leg"><div class="num terminus">A</div><div class="body"><div class="a">${escapeHtml(startAddr)}</div><div class="d">${detail}</div></div></div>`;
  }
  $('manifest').innerHTML = html;

  const links = buildMapsLinks(orderedStops, roundTrip, startAddr);
  const mb=$('mapsButtons'); mb.innerHTML='';
  links.forEach((url,i)=>{
    if(links.length>1){
      const lab=document.createElement('div');
      lab.className='seg-label';
      lab.textContent='Segment '+(i+1)+' / '+links.length;
      mb.appendChild(lab);
    }
    const b=document.createElement('button');
    b.className = i===0 ? 'btn-go' : 'btn-maps';
    b.style.marginTop='10px';
    b.textContent = links.length>1
      ? '🧭 Lancer le segment '+(i+1)+' dans Google Maps'
      : '🧭 Lancer la navigation dans Google Maps';
    b.onclick=()=>window.open(url,'_blank');
    mb.appendChild(b);
  });

  $('resultNote').textContent = engine==='google'
    ? (links.length>1
        ? 'Google Maps limite la navigation à 11 points par trajet : la tournée est découpée en segments qui s\'enchaînent — lance le segment suivant une fois le précédent terminé.'
        : 'Kilométrage et durée calculés par Google Maps sur les routes réelles.')
    : 'Ordre calculé sur les positions OpenStreetMap — fiable pour l\'ordre de passage ; Google Maps fait ensuite la navigation exacte. Ajoute une clé Google (menu ⚙) pour des km et durées calculés par Google.';

  $('resultCard').scrollIntoView({behavior:'smooth'});
}

/* ============ INIT ============ */
$('startAddr').addEventListener('change', saveState);
$('roundTrip').addEventListener('change', saveState);
loadState();
