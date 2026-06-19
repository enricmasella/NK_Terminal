const WEATHER_API='https://wttr.in';

async function bgFetch(url,opts){
  const res=await chrome.runtime.sendMessage({type:'fetch',url,options:opts});
  if(!res)throw new Error('no response from background');
  if(!res.ok)throw new Error('HTTP-'+res.status);
  return res.body;
}

async function storageGet(keys){
  const r=await chrome.runtime.sendMessage({type:'storageGet',keys});
  return r||{};
}
async function storageSet(data){
  await chrome.runtime.sendMessage({type:'storageSet',data});
}

let weatherData=null,lat=null,lon=null,locationName='',history=[],hIdx=-1,clockInterval=null,clockEl=null;
const term=document.getElementById('term'),inp=document.getElementById('inp'),linksEl=document.getElementById('links');
const BUILTIN_VERSION = 1;
const DEFAULT_LINKS = [
  {label:'yt', display:'youtube', url:'https://youtube.com'},
  {label:'gh', display:'github', url:'https://github.com'},
  {label:'gm', display:'gmail', url:'https://mail.google.com'},
  {label:'cl', display:'claude', url:'https://claude.ai'},
  {label:'ge', display:'gemini', url:'https://gemini.google.com'},
  {label:'gpt', display:'chatgpt', url:'https://chatgpt.com'},
  {label:'dr', display:'drive', url:'https://drive.google.com'},
  {label:'doc', display:'google docs', url:'https://docs.google.com'},
];

const DEFAULT_SETTINGS = {
  theme:'dark', font:'courier', fontSize:16,
  greeting:'', showWeather:true, showSystem:true, hour12:true
};
let settings = {...DEFAULT_SETTINGS};
const SETTINGS_KEY = '_st';

function $(t,c){const d=document.createElement('div');d.className='l'+(c?' '+c:'');d.textContent=t;term.appendChild(d)}
async function $$(t,c,dl){const d=document.createElement('div');d.className='l'+(c?' '+c:'');term.appendChild(d);for(let i=0;i<t.length;i++){d.textContent=t.substring(0,i+1);await new Promise(r=>setTimeout(r,dl||12))}return d}
function sep(){$('\u2500'.repeat(50),'s')}
function scroll(){term.scrollTop=term.scrollHeight}
function greet(){if(settings.greeting)return settings.greeting;const h=new Date().getHours();if(h<6)return'it is late';if(h<12)return'good morning';if(h<18)return'good afternoon';if(h<22)return'good evening';return'it is late'}
function fd(d){return d.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
function ft(d){return d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:settings.hour12})}
function os(){const u=navigator.userAgent;if(u.includes('Windows'))return'Windows';if(u.includes('Mac'))return'macOS';if(u.includes('Linux'))return'Linux';return'Unknown'}
function browser(){const u=navigator.userAgent;if(u.includes('OPR')||u.includes('Opera'))return'Opera';if(u.includes('Edg'))return'Edge';if(u.includes('Chrome'))return'Chrome';if(u.includes('Firefox'))return'Firefox';if(u.includes('Safari'))return'Safari';return'Unknown'}
function ram(){const m=navigator.deviceMemory;return m?m+' GB':'?'}
function cores(){const c=navigator.hardwareConcurrency;return c?c+' cores':'?'}
function conn(){const c=navigator.connection;return c?c.effectiveType:'?'}
function p(fn){return new Promise(r=>fn(r))}
function openLink(url,name){
  $('  opening '+name+'...','d');
  scroll();
  try{
    chrome.tabs.create({url,active:true});
    setTimeout(()=>{$('  '+name+' opened successfully','r');scroll()},200);
  }catch(e){
    const w=window.open(url,'_blank');
    setTimeout(()=>{
      if(w)$('  '+name+' opened successfully','r');
      else $('  failed to open '+name,'d');
      scroll();
    },200);
  }
}
async function seedQuickLinks() {
  const data = await storageGet(['quickLinks', '_builtinVersion']);
  if (data._builtinVersion >= BUILTIN_VERSION) return;
  const existing = data.quickLinks || [];
  const seen = new Set(existing.map(l => l.label.toLowerCase()));
  for (const dl of DEFAULT_LINKS) {
    if (!seen.has(dl.label.toLowerCase())) {
      existing.push({ ...dl, builtin: true });
    }
  }
  await storageSet({ quickLinks: existing, _builtinVersion: BUILTIN_VERSION });
}

async function loadSettings(){
  const d=await storageGet([SETTINGS_KEY]);
  if(d[SETTINGS_KEY])settings={...DEFAULT_SETTINGS,...d[SETTINGS_KEY]};
}
async function saveSettings(){
  await storageSet({[SETTINGS_KEY]:settings});
}
function applySettings(){
  const b=document.body;
  b.className='theme-'+settings.theme;
  b.classList.add('font-'+settings.font);
  b.style.fontSize=settings.fontSize+'px';
  // Sync modal UI
  document.querySelectorAll('.theme-btn').forEach(el=>el.classList.toggle('active',el.dataset.theme===settings.theme));
  document.getElementById('set-font').value=settings.font;
  document.getElementById('set-size').value=settings.fontSize;
  document.getElementById('set-greeting').value=settings.greeting;
  document.getElementById('set-weather').checked=settings.showWeather;
  document.getElementById('set-system').checked=settings.showSystem;
  document.getElementById('set-hour12').checked=settings.hour12;
}

async function updateSysRows(){
  try{const m=await p(chrome.system.memory.getInfo);const t=m.capacity/1073741824,a=m.availableCapacity/1073741824,u=t-a;const e=document.querySelector('.mem');if(e)e.textContent='  memory      '+u.toFixed(1)+'/'+t.toFixed(1)+' GB ('+((u/t)*100).toFixed(0)+'%)'}
  catch(e){const el=document.querySelector('.mem');if(el)el.textContent='  memory      '+ram()}
  try{const c=await p(chrome.system.cpu.getInfo);const avg=c.processors.reduce((s,p)=>s+(1-p.usage.idle/p.usage.total),0)/c.processors.length;const e=document.querySelector('.cpu');if(e)e.textContent='  cpu         '+(avg*100).toFixed(1)+'%'}
  catch(e){}
}
function startSysMonitor(){
  clearInterval(window._sysInt);
  updateSysRows();
  window._sysInt = setInterval(updateSysRows, 2000);
}

/* IP geolocation — fires all 3 APIs in parallel, takes fastest valid result */
async function ipLoc(){
  const apis=[
    {url:'https://ip-api.com/json/?fields=lat,lon,city,region,country,zip',parse:d=>({lat:d.lat,lon:d.lon,city:[d.city,d.region].filter(Boolean).join(', ')+', '+d.country})},
    {url:'https://ipapi.co/json/',parse:d=>({lat:d.latitude,lon:d.longitude,city:d.city?d.city+', '+d.country:''})},
    {url:'https://ipinfo.io/json',parse:d=>{const [lat,lon]=d.loc.split(',');return{lat:parseFloat(lat),lon:parseFloat(lon),city:d.city?d.city+', '+d.region+', '+d.country:''}}}
  ];
  try {
    return await Promise.any(apis.map(api =>
      bgFetch(api.url).then(body => {
        const d=JSON.parse(body);
        const p=api.parse(d);
        if(p.lat!=null&&p.lon!=null) return p;
        throw new Error('invalid');
      })
    ));
  } catch {
    return null;
  }
}

async function setLocation(lat_,lon_,name){
  lat=lat_;lon=lon_;locationName=name||lat_.toFixed(4)+', '+lon_.toFixed(4);
  await storageSet({manualLocation:{lat,lon,name:locationName}});
  const es=document.querySelectorAll('.loc');
  if(es.length)es[0].textContent='  '+locationName;
  weatherData=null;
  await renderWeatherData();
  scroll();
}

const WCACHE_KEY='_wc',WCACHE_TTL=30*60*1000;

/* Normalize wttr.in response into our internal format */
function normalizeWeather(raw){
  const c=raw.current_condition[0];
  const d=raw.weather?.[0];
  return {
    temp: +c.temp_C,
    feels: +c.FeelsLikeC,
    humidity: +c.humidity,
    wind: +c.windspeedKmph,
    uv: +c.uvIndex,
    condition: c.weatherDesc[0].value,
    precip: c.precipMM?+c.precipMM:null,
    daily: d?{
      max: +d.maxtempC,
      min: +d.mintempC,
      sunrise: d.astronomy[0].sunrise,
      sunset: d.astronomy[0].sunset,
      uv: +d.uvIndex
    }:null
  };
}

async function getWeatherCached(){
  const d=await storageGet([WCACHE_KEY]);
  const c=d[WCACHE_KEY];
  return (c&&Date.now()-c.ts<WCACHE_TTL)?c.data:null;
}

async function getWeatherFresh(){
  if(!lat||!lon)return null;
  const url=WEATHER_API+'/'+lat+','+lon+'?format=j1';
  try{
    const body=await bgFetch(url);
    const raw=JSON.parse(body);
    if(raw.error)return null;
    const data=normalizeWeather(raw);
    await storageSet({[WCACHE_KEY]:{data,ts:Date.now()}});
    return data;
  }catch(_){}
  return null;
}

function startClock(){
  if(clockInterval)return;
  function tick(){
    const now=new Date();
    const t=ft(now);
    clockEl=document.getElementById('tc');
    if(clockEl)clockEl.textContent='  time        '+t+' \u25cf';
  }
  tick();
  clockInterval=setInterval(tick,1000);
}

async function renderLinks(){
  const data=await storageGet(['quickLinks']);
  const links=data.quickLinks||[];
  linksEl.innerHTML='';
  if(!links.length){
    return;
  }
  let draggedIdx=null;
  for(let i=0;i<links.length;i++){
    const lk=links[i];
    const a=document.createElement('a');
    a.className='lk';
    a.textContent=lk.label;
    a.title=lk.url;
    a.href='#';
    a.draggable=true;
    a.dataset.idx=i;
    a.addEventListener('click',(e)=>{e.preventDefault();openLink(lk.url,lk.label)});
    a.addEventListener('dragstart',(e)=>{
      draggedIdx=i;
      a.classList.add('dragging');
      e.dataTransfer.effectAllowed='move';
      e.dataTransfer.setData('text/plain',i);
    });
    a.addEventListener('dragenter',(e)=>{
      e.preventDefault();
      if(i!==draggedIdx)a.classList.add('drag-over');
    });
    a.addEventListener('dragover',(e)=>{
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
      if(i!==draggedIdx)a.classList.add('drag-over');
    });
    a.addEventListener('dragleave',()=>{
      a.classList.remove('drag-over');
    });
    a.addEventListener('drop',async(e)=>{
      e.preventDefault();
      a.classList.remove('drag-over');
      const from=draggedIdx;
      if(from===null||from===i)return;
      const data=await storageGet(['quickLinks']);
      const items=data.quickLinks||[];
      const [item]=items.splice(from,1);
      items.splice(i,0,item);
      await storageSet({quickLinks:items});
      await renderLinks();
    });
    a.addEventListener('dragend',()=>{
      document.querySelectorAll('.lk').forEach(el=>el.classList.remove('dragging','drag-over'));
      draggedIdx=null;
    });
    linksEl.appendChild(a);
  }
}

async function cmdLinks(subcmd,args){
  const data=await storageGet(['quickLinks']);
  const links=data.quickLinks||[];
  if(!subcmd||subcmd==='list'){
    if(!links.length){$('  no quick links','d')}
    else{
      $('  quick links ('+links.length+'):','h');
      for(let i=0;i<links.length;i++)$('  ['+(i+1)+'] '+links[i].label+' \u2192 '+links[i].url,'r');
    }
    scroll();
    return;
  }
  if(subcmd==='add'){
    if(args.length<2){$('  usage: link add <label> <url>','d');scroll();return}
    const label=args[0];
    let url=args[1];
    if(!url.startsWith('http://')&&!url.startsWith('https://'))url='https://'+url;
    links.push({label,url});
    await storageSet({quickLinks:links});
    $('  added quick link ['+label+'] \u2192 '+url,'r');
    await renderLinks();
    scroll();
    return;
  }
  if(subcmd==='remove'||subcmd==='rm'){
    const idx=parseInt(args[0])-1;
    if(isNaN(idx)||idx<0||idx>=links.length){$('  invalid index. use link list to see indices.','d');scroll();return}
    const removed=links.splice(idx,1);
    await storageSet({quickLinks:links});
    $('  removed quick link ['+removed[0].label+']','r');
    await renderLinks();
    scroll();
    return;
  }
  if(subcmd==='open'){
    const idx=parseInt(args[0])-1;
    if(isNaN(idx)||idx<0||idx>=links.length){$('  invalid index. use link list to see indices.','d');scroll();return}
    openLink(links[idx].url,links[idx].label);
    return;
  }
  if(subcmd==='move'){
    const from=parseInt(args[0])-1,to=parseInt(args[1])-1;
    if(isNaN(from)||isNaN(to)||from<0||from>=links.length||to<0||to>=links.length){$('  usage: link move <fromIdx> <toIdx>','d');scroll();return}
    const [item]=links.splice(from,1);
    links.splice(to,0,item);
    await storageSet({quickLinks:links});
    $('  moved ['+item.label+'] from ['+(from+1)+'] to ['+(to+1)+']','r');
    await renderLinks();
    scroll();
    return;
  }
  $('  unknown subcommand: '+subcmd,'d');
  $('  usage: link list | add <label> <url> | remove <idx> | open <idx> | move <fromIdx> <toIdx>','d');
  scroll();
}

async function render(){
  const now=new Date();
  const gr=settings.greeting||greet();
  $('NK_Terminal','h');
  $('','');
  await $$('  loaded at '+ft(now)+' \u00b7 '+fd(now),'d',8);
  $('','');
  await $$('> '+gr+'.','h',15);
  if(settings.showWeather){
    sep();
    $('> weather','h');
    $('  locating by IP...','d loc');
    $('  ','r w');
  }
  if(settings.showSystem){
    sep();
    $('> system','h');
    (()=>{const d=document.createElement('div');d.className='l r';d.id='tc';d.textContent='  time        '+ft(now);term.appendChild(d);clockEl=d})();
    $('  date        '+fd(now),'r');
    $('  platform    '+os(),'r plat');
    $('  browser     '+browser(),'r brw');
    $('  memory      ...','r mem');
    $('  cpu         ...','r cpu');
    $('  Cores       '+cores(),'r cores');
    $('  network     '+conn(),'r net');
    $('  language    '+navigator.language,'r lang');
  }
  sep();
  scroll();
}

async function renderWeatherData(){
  const ws=document.querySelectorAll('.w');
  if(!ws.length)return;
  const el=ws[0];
  if(!lat||!lon){
    const locEl=document.querySelector('.loc');
    if(locEl)locEl.textContent='  location unavailable';
    return;
  }
  const show = d => {
    let txt='  '+d.temp+'\u00b0C \u00b7 '+d.condition+'\n';
    txt+='  feels like '+d.feels+'\u00b0C \u00b7 wind '+d.wind+' km/h';
    if(d.humidity!=null)txt+=' \u00b7 humidity '+d.humidity+'%';
    if(d.precip!=null)txt+=' \u00b7 rain '+d.precip+' mm';
    if(d.daily){
      txt+=' \u00b7 L '+d.daily.min+'\u00b0 H '+d.daily.max+'\u00b0';
      if(d.daily.uv!=null)txt+=' \u00b7 UV '+d.daily.uv;
    }
    el.className='l r w';
    el.textContent=txt;
  };
  const cached=await getWeatherCached();
  if(cached&&!weatherData){
    weatherData=cached;
    show(cached);
    getWeatherFresh().then(d=>{if(d){weatherData=d;show(d)}});
    return;
  }
  if(!weatherData){
    el.className='l w fetching';
    el.textContent='  fetching weather...';
    const d=await getWeatherFresh();
    if(!d){el.className='l d w';el.textContent='  weather unavailable';return}
    weatherData=d;
  }
  show(weatherData);
  if(locationName){
    const ls=document.querySelectorAll('.loc');
    if(ls.length)ls[0].textContent='  '+locationName;
  }
}

function wDetail(d,loc){
  const c=d;
  $('  weather for '+loc,'h');
  $('  condition     '+c.condition,'r');
  $('  temperature   '+c.temp+'\u00b0C (feels '+c.feels+'\u00b0C)','r');
  if(c.humidity!=null)$('  humidity      '+c.humidity+'%','r');
  if(c.wind!=null)$('  wind speed    '+c.wind+' km/h','r');
  if(c.precip!=null)$('  rain          '+c.precip+' mm','r');
  if(c.daily){
    if(c.daily.min!=null)$('  low / high    '+c.daily.min+'\u00b0C / '+c.daily.max+'\u00b0C','r');
    if(c.daily.sunrise)$('  sunrise       '+c.daily.sunrise,'r');
    if(c.daily.sunset)$('  sunset        '+c.daily.sunset,'r');
    if(c.uv!=null)$('  UV index      '+c.uv,'r');
  }
}

async function showWeatherDetail(){
  if(!lat||!lon){
    $('  no location data \u2014 type "weather" to fetch','d');
    scroll();
    return;
  }
  const loc=locationName||lat.toFixed(2)+', '+lon.toFixed(2);
  let dd=weatherData||await getWeatherCached();
  if(dd){
    wDetail(dd,loc);
    if(!weatherData)$('  (cached)','d');
    scroll();
  }else{
    $('  fetching weather...','d');
    scroll();
  }
  const d=await getWeatherFresh();
  if(d){
    weatherData=d;
    if(dd)return;
    wDetail(d,loc);
    scroll();
  }else if(!dd){
    $('  weather unavailable','d');scroll();
  }
}

async function handle(cmd){
  const t=cmd.trim();
  if(!t)return;
  $('$ '+t,'p');
  history.push(t);
  hIdx=history.length;
  const l=t.toLowerCase().split(/\s+/);
  const main=l[0];
  const args=l.slice(1);

  if(main==='clear'||main==='cls'){
    term.innerHTML='';
    clockEl=null;
    clearInterval(window._sysInt);
    await render();
    startClock();
    startSysMonitor();
    if(lat!==null&&lon!==null){
      const es=document.querySelectorAll('.loc');
      if(es.length)es[0].textContent='  '+locationName;
    }
    scroll();
    return;
  }

  if(main==='help'||main==='?'){
    $('  help          show this help','d');
    $('  clear         clear screen','d');
    $('  weather       detailed weather info','d');
    $('  location      set location: location <name> or <lat, lon>','d');
    $('  time          show live clock','d');
    $('  date          show current date','d');
    $('  sysinfo       system/hardware information','d');
    $('  link          quick links management','d');
    $('  link list     show all quick links','d');
    $('  link add      add a quick link: link add <label> <url>','d');
    $('  link remove   remove by index: link remove <idx>','d');
    $('  link open     open by index: link open <idx>','d');
    $('  link move     reorder: link move <fromIdx> <toIdx>','d');
    $('  search        open URL or search Google: search <query>','d');
    scroll();
    return;
  }

  if(main==='weather'){
    if(!lat||!lon){
      $('  locating...','d');
      const ip=await ipLoc();
      if(ip){lat=ip.lat;lon=ip.lon;locationName=ip.city;$('  '+locationName,'d')}
      else{$('  could not determine location','d');scroll();return}
    }
    await showWeatherDetail();
    scroll();
    return;
  }

  if(main==='time'){
    const now=new Date();
    $('  '+ft(now),'r');
    scroll();
    return;
  }

  if(main==='date'){
    const now=new Date();
    $('  '+fd(now),'r');
    scroll();
    return;
  }

  if(main==='sysinfo'){
    startSysMonitor();
    try{const c=await p(chrome.system.cpu.getInfo);const e=document.querySelector('.cores');if(e)e.textContent='  Cores       '+c.numOfProcessors+' ('+c.modelName.replace(/\s+/g,' ').trim()+')'}
    catch(e){}
    try{const d=await p(chrome.system.storage.getInfo);if(d.length){const s=d[0],t=s.capacity/1073741824,a=s.availableCapacity/1073741824;let e=document.querySelector('.stor');if(!e){e=document.createElement('div');e.className='l r stor';document.querySelector('.net').after(e)}e.textContent='  storage     '+t.toFixed(1)+' GB ('+(t-a).toFixed(1)+' GB used, '+a.toFixed(1)+' GB free)'}}
    catch(e){}
    const ne=document.querySelector('.net');if(ne)ne.textContent='  network     '+conn()+' ('+(navigator.connection?.downlink||'?')+' Mbps)';
    const le=document.querySelector('.lang');if(le)le.textContent='  language    '+navigator.language+(navigator.languages?', '+navigator.languages.join(', '):'');
    if(lat!==null&&lon!==null){let e=document.querySelector('.crd');if(!e){e=document.createElement('div');e.className='l d crd';term.appendChild(e)}e.textContent='  coords      '+lat.toFixed(4)+', '+lon.toFixed(4)}
    scroll();
    return;
  }

  if(main==='location'&&args.length){
    const q=args.join(' ').replace(/\s*,\s*/g,' ').replace(/\s+/g,' ').trim();
    const coordMatch=q.match(/^(-?\d+\.?\d*)\s*[,; ]\s*(-?\d+\.?\d*)$/);
    if(coordMatch){
      const la=parseFloat(coordMatch[1]),lo=parseFloat(coordMatch[2]);
      $('  setting location to '+la.toFixed(4)+', '+lo.toFixed(4),'d');
      await setLocation(la,lo,'');
    }else{
      const searchTerm=q.split(/[,; ]/)[0];
      $('  geocoding "'+searchTerm+'"...','d');scroll();
      try{
        const body=await bgFetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(searchTerm)+'&count=1&language=en&format=json');
        const d=JSON.parse(body);
        if(d.results&&d.results[0]){
          const r=d.results[0];
          const name=[r.name,r.admin1,r.county,r.country].filter(Boolean).join(', ');
          $('  found: '+name,'r');scroll();
          await setLocation(r.latitude,r.longitude,name);
        }else $('  location not found','d');
      }catch(e){$('  geocoding failed','d')}
    }
    scroll();
    return;
  }

  if(main==='link'){
    await cmdLinks(args[0],args.slice(1));
    scroll();
    return;
  }

  if(main){
    const data=await storageGet(['quickLinks']);
    const links=data.quickLinks||[];
    for(const lk of links){
      if(main===lk.label.toLowerCase()){openLink(lk.url,lk.display||lk.label);return}
    }
  }

  if(main==='search'&&args.length){
    let q=args.join(' ');
    let url;
    if(/^https?:\/\//i.test(q))url=q;
    else if(/[\w-]+\.[\w-]+/.test(q)&&!/[ ?]/.test(q))url='https://'+q;
    else url='https://www.google.com/search?q='+encodeURIComponent(q);
    openLink(url,'search');
    return;
  }

}

function focusInp(){
  try{inp.focus({preventScroll:true})}catch(e){}
}

function stealFocus(){
  (function raf(){
    if(document.activeElement!==inp){
      try{inp.focus({preventScroll:true})}catch(_){}
      requestAnimationFrame(raf);
    }
  })();
}

document.addEventListener('keydown',e=>{
  if(e.target===inp)return;
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  inp.focus({preventScroll:true});
  if(e.key.length===1){
    const s=inp.selectionStart,v=inp.value;
    inp.value=v.slice(0,s)+e.key+v.slice(inp.selectionEnd);
    inp.setSelectionRange(s+1,s+1);
  }else if(e.key==='Backspace'){
    const s=inp.selectionStart;
    if(s>0){inp.value=inp.value.slice(0,s-1)+inp.value.slice(inp.selectionEnd||s);inp.setSelectionRange(s-1,s-1);}
  }
  requestAnimationFrame(()=>inp.focus({preventScroll:true}));
},true);

window.addEventListener('focus',()=>{focusInp();setTimeout(focusInp,150);setTimeout(focusInp,500);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)focusInp()});
document.addEventListener('mousedown',focusInp);

async function init(){
  await loadSettings(); applySettings();
  stealFocus();
  await render();
  stealFocus();
  startClock();
  await renderLinks();
  startSysMonitor();
  const saved=await storageGet(['manualLocation', 'ipCache']);
  setTimeout(async()=>{
    const es=document.querySelectorAll('.loc');
    if(saved.manualLocation){
      const m=saved.manualLocation;
      lat=m.lat;lon=m.lon;locationName=m.name||'';
      if(es.length)es[0].textContent='  '+locationName;
    }else if(saved.ipCache&&Date.now()-saved.ipCache.ts<3600000){
      const c=saved.ipCache;
      lat=c.lat;lon=c.lon;locationName=c.city||'';
      if(es.length)es[0].textContent='  '+(locationName||lat.toFixed(2)+', '+lon.toFixed(2));
    }else{
      if(es.length)es[0].textContent='  locating by IP...';
      const ip=await ipLoc();
      if(ip){
        lat=ip.lat;lon=ip.lon;
        locationName=ip.city||'';
        if(es.length)es[0].textContent='  '+(locationName||lat.toFixed(2)+', '+lon.toFixed(2));
        await storageSet({ipCache:{lat,lon,city:locationName,ts:Date.now()}});
      }else{
        if(es.length)es[0].textContent='  location unavailable';
      }
    }
    await renderWeatherData();
    scroll();
    await seedQuickLinks();
    await renderLinks();
  },100);
  setInterval(async()=>{if(lat&&lon){const d=await getWeatherFresh();if(d)weatherData=d}},10*60*1000);
  inp.addEventListener('keydown',async e=>{
    if(e.key==='Enter'){const v=inp.value;inp.value='';await handle(v);focusInp()}
    else if(e.key==='ArrowUp'){e.preventDefault();if(history.length>0){hIdx=Math.max(0,hIdx-1);inp.value=history[hIdx]}}
    else if(e.key==='ArrowDown'){e.preventDefault();if(hIdx<history.length-1){hIdx++;inp.value=history[hIdx]}else{hIdx=history.length;inp.value=''}}
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&overlay.classList.contains('open'))overlay.classList.remove('open');
  });
}

/* ── Settings gear & modal ── */
function setupSettingsUI(){
  const gear=document.getElementById('gear');
  const overlay=document.getElementById('settings-overlay');
  const closeBtn=document.getElementById('settings-close');
  if(!gear||!overlay)return;
  gear.addEventListener('click',()=>overlay.classList.toggle('open'));
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.classList.remove('open')});
  if(closeBtn)closeBtn.addEventListener('click',()=>overlay.classList.remove('open'));

  // Theme buttons
  document.querySelectorAll('.theme-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      settings.theme=btn.dataset.theme;
      applySettings();
      saveSettings();
    });
  });

  // Selects & inputs
  const on = (id,fn) => {
    const el=document.getElementById(id);
    if(el)el.addEventListener('change',fn);
  };
  on('set-font',()=>{settings.font=document.getElementById('set-font').value;applySettings();saveSettings()});
  on('set-size',()=>{settings.fontSize=+document.getElementById('set-size').value;applySettings();saveSettings()});
  on('set-weather',()=>{settings.showWeather=document.getElementById('set-weather').checked;saveSettings()});
  on('set-system',()=>{settings.showSystem=document.getElementById('set-system').checked;saveSettings()});
  on('set-hour12',()=>{settings.hour12=document.getElementById('set-hour12').checked;applySettings();saveSettings()});

  const gr=document.getElementById('set-greeting');
  if(gr){
    gr.addEventListener('change',()=>{settings.greeting=gr.value.trim();saveSettings()});
    gr.addEventListener('keydown',e=>{if(e.key==='Enter'){settings.greeting=gr.value.trim();saveSettings();overlay.classList.remove('open')}});
  }
}

init();
setupSettingsUI();
