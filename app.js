// ── COURSE DATA ──
// Load the full dataset from course-data.js, which should be included before this file.
const WARWICK_COURSES = window.WARWICK_COURSES || [];
let courseData = WARWICK_COURSES;

// First-run course import prompt. Separate from the main saved data so
// choosing "Skip" is remembered even if the user has not added modules yet.
const COURSE_ONBOARDING_KEY = 'gradetracker_course_onboarding_seen_v1';
// ── Colour presets ──
const COLOUR_PRESETS = [
  { name:'Warwick', hex:'#5B21B6', mid:'#7C3AED', light:'#A78BFA', bg:'#F5F3FF', border:'#DDD6FE' },
  { name:'Navy',    hex:'#1E3A8A', mid:'#2563EB', light:'#93C5FD', bg:'#EFF6FF', border:'#BFDBFE' },
  { name:'Teal',    hex:'#0F766E', mid:'#0D9488', light:'#5EEAD4', bg:'#F0FDFA', border:'#99F6E4' },
  { name:'Rose',    hex:'#9F1239', mid:'#E11D48', light:'#FDA4AF', bg:'#FFF1F2', border:'#FECDD3' },
  { name:'Slate',   hex:'#334155', mid:'#475569', light:'#94A3B8', bg:'#F8FAFC', border:'#E2E8F0' },
  { name:'Forest',  hex:'#14532D', mid:'#16A34A', light:'#86EFAC', bg:'#F0FDF4', border:'#BBF7D0' },
  { name:'Amber',   hex:'#92400E', mid:'#D97706', light:'#FCD34D', bg:'#FFFBEB', border:'#FDE68A' },
  { name:'Crimson', hex:'#7F1D1D', mid:'#DC2626', light:'#FCA5A5', bg:'#FEF2F2', border:'#FECACA' },
];

function makeId() { return '_' + Math.random().toString(36).slice(2, 9); }

const CATEGORIES = {
  'Exam':       { css:'cat-exam',  label:'📋 Exam' },
  'Coursework': { css:'cat-cw',    label:'📝 Coursework' },
  'Essays':     { css:'cat-essay', label:'📄 Essays' },
  'Class Test': { css:'cat-test',  label:'✏ Class Test' },
  'Other':      { css:'cat-other', label:'📦 Other' },
};

function catClass(cat)     { return (CATEGORIES[cat] || CATEGORIES['Other']).css; }
function catBadgeHtml(cat) { const cls = catClass(cat); const lbl = (CATEGORIES[cat] || {label:cat}).label; return `<span class="cat-badge ${cls}">${lbl}</span>`; }
function isExamCat(cat)    { return cat === 'Exam'; }

/**
 * Infer a category from a component name string.
 * Uses keyword matching in priority order.
 */
function inferCategory(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('centrally-timetabled examination') ||
      n.includes('take home examination') ||
      n.includes('take-home examination') ||
      n.includes('oral examination') ||
      n.includes('oral exam') ||
      n.includes('final exam') ||
      n.includes('online examination') ||
      n.includes('in-person examination') ||
      (n.includes('examination') && !n.includes('pre-examination'))) return 'Exam';
  if (n.includes('essay') || n.includes('dissertation') || n.includes('literature review') || n.includes('book chapter') || n.includes('article review')) return 'Essays';
  if (n.includes('test') || n.includes('quiz') || n.includes('mcq') || n.includes('multiple choice') || n.includes('in-class') || n.includes('class test')) return 'Class Test';
  if (n.includes('coursework') || n.includes('assignment') || n.includes('report') || n.includes('project') || n.includes('lab') || n.includes('portfolio') ||
      n.includes('presentation') || n.includes('poster') || n.includes('dissertation')) return 'Coursework';
  return 'Coursework';
}

function gradeColor(m) { if(m>=70)return'#059669'; if(m>=60)return'#2563EB'; if(m>=50)return'#D97706'; if(m>=40)return'#EA580C'; return'#DC2626'; }
function gradeClass(m) { if(m>=70)return'First'; if(m>=60)return'2:1'; if(m>=50)return'2:2'; if(m>=40)return'Third'; return'Fail'; }

function parseDate(s) {
  if (!s) return null;
  s = s.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2]-1, +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2]-1, +m[1]);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function fmtDate(s) {
  const d = parseDate(s);
  if (!d) return s || '—';
  return d.toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'});
}

function resolveCompDate(comp) {
  return parseDate(comp.date) || null;
}

const DEFAULT_TAB_NAMES = {
  dashboard: 'Dashboard',
  timetable: 'Timetable',
  modules: 'Modules',
  checklist: 'Exam Checklist',
  target: 'Target Grades'
};

const DEFAULT_DATA = {
  settings: {
    name:'', uni:'', dept:'', code:'',
    darkMode:false, compact:false, accentPreset:0, accentCustom:'',
    tabNames: JSON.parse(JSON.stringify(DEFAULT_TAB_NAMES))
  },
  years: [
    { id:'y1', label:'Year 1', acyr:'2025/26', modules:[], marks:{}, checklist:{} }
  ],
  activeYear: 'y1'
};

let APP = {};

function loadApp() {
  try {
    const s = localStorage.getItem('gradetracker_v7');
    if (s) { APP = JSON.parse(s); migrateData(); return; }
  } catch(e) {}
  APP = JSON.parse(JSON.stringify(DEFAULT_DATA));
  persist();
}

function migrateData() {
  if (!APP.settings.tabNames) APP.settings.tabNames = JSON.parse(JSON.stringify(DEFAULT_TAB_NAMES));
  if (!APP.years) return;
  APP.years.forEach(yr => {
    if (!yr.marks)     yr.marks     = {};
    if (!yr.checklist) yr.checklist = {};
    if (!yr.targetGrades) yr.targetGrades = {};
    const oldDates  = yr.dates  || {};
    (yr.modules || []).forEach(mod => {
      (mod.components || []).forEach(c => {
        if (oldDates[c.id] && !c.date)  c.date = oldDates[c.id];
        if (!c.time)     c.time     = '';
        if (!c.duration) c.duration = '';
        if (!c.location) c.location = '';
        if (!c.category) c.category = 'Coursework';
        if (c.category === 'Coursework & Essays') c.category = 'Coursework';
      });
    });
    delete yr.dates;
    delete yr.labels;
  });
}

function persist() { localStorage.setItem('gradetracker_v7', JSON.stringify(APP)); }
function saveAll()  { persist(); showToast('✓ Saved!'); }
function getYear(yid) { return APP.years.find(y => y.id === yid); }
function activeYear()  { return getYear(APP.activeYear); }
function totalCats(yr) { return yr.modules.reduce((s,m) => s+m.cats, 0); }

function modTotal(mod, marks) {
  let s=0;
  for (const c of mod.components) {
    const v = marks[c.id];
    if (v===''||v===undefined||v===null||isNaN(parseFloat(v))) return null;
    s += parseFloat(v) * (c.weight/100);
  }
  return mod.components.length>0 ? s : null;
}

function modPartial(mod, marks) {
  let s=0, any=false;
  for (const c of mod.components) {
    const v = marks[c.id];
    if (v!==''&&v!==undefined&&v!==null&&!isNaN(parseFloat(v))) { s+=parseFloat(v)*(c.weight/100); any=true; }
  }
  return any ? s : null;
}

function modEnteredWeight(mod, marks) {
  return mod.components.filter(c => { const v=marks[c.id]; return v!==''&&v!==undefined&&v!==null&&!isNaN(parseFloat(v)); }).reduce((s,c)=>s+c.weight,0);
}

function yearMark(yr) {
  const parts=[];
  yr.modules.forEach(m => { const t=modTotal(m,yr.marks); if(t!==null) parts.push({cats:m.cats,mark:t}); });
  if (!parts.length) return null;
  const tc=parts.reduce((s,p)=>s+p.cats,0);
  return parts.reduce((s,p)=>s+p.mark*p.cats,0)/tc;
}

function applyDarkMode(enabled) { document.documentElement.setAttribute('data-theme', enabled?'dark':'light'); }
function applyDensity(mode)     { document.documentElement.setAttribute('data-density', mode); }

function applyAccentColour(preset, customHex) {
  const root = document.documentElement;
  if (customHex) {
    root.style.setProperty('--accent',        customHex);
    root.style.setProperty('--accent-mid',    customHex);
    root.style.setProperty('--accent-light',  hexWithAlpha(customHex,0.6));
    root.style.setProperty('--accent-bg',     hexWithAlpha(customHex,0.08));
    root.style.setProperty('--accent-border', hexWithAlpha(customHex,0.25));
    root.style.setProperty('--cat-exam-color',  customHex);
    root.style.setProperty('--cat-exam-bg',     hexWithAlpha(customHex,0.08));
    root.style.setProperty('--cat-exam-border', hexWithAlpha(customHex,0.25));
  } else {
    const p = COLOUR_PRESETS[preset] || COLOUR_PRESETS[0];
    root.style.setProperty('--accent',        p.hex);
    root.style.setProperty('--accent-mid',    p.mid);
    root.style.setProperty('--accent-light',  p.light);
    root.style.setProperty('--accent-bg',     p.bg);
    root.style.setProperty('--accent-border', p.border);
    root.style.setProperty('--cat-exam-color',  p.mid);
    root.style.setProperty('--cat-exam-bg',     p.bg);
    root.style.setProperty('--cat-exam-border', p.border);
  }
}

function hexWithAlpha(hex, alpha) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function restoreAppearance() {
  const s = APP.settings;
  applyDarkMode(s.darkMode);
  applyDensity(s.compact?'compact':'normal');
  applyAccentColour(s.accentPreset||0, s.accentCustom||'');
}

function renderSwatches() {
  const container = document.getElementById('colourSwatches');
  if (!container) return;
  const activeIdx = APP.settings.accentPreset??0;
  const hasCustom = !!APP.settings.accentCustom;
  container.innerHTML = COLOUR_PRESETS.map((p,i) => `
    <div class="colour-swatch ${!hasCustom&&i===activeIdx?'selected':''}" style="background:${p.mid}" title="${p.name}" onclick="pickPreset(${i})"></div>
  `).join('');
}

function pickPreset(idx) {
  APP.settings.accentPreset = idx; APP.settings.accentCustom = '';
  applyAccentColour(idx,''); renderSwatches();
  const picker = document.getElementById('cfg-customColour');
  if (picker) picker.value = COLOUR_PRESETS[idx].mid;
}

function applyCustomColour(hex) {
  APP.settings.accentCustom = hex;
  applyAccentColour(null, hex);
  document.querySelectorAll('.colour-swatch').forEach(s => s.classList.remove('selected'));
}

function renderHeader() {
  const s=APP.settings, yr=activeYear();
  document.getElementById('logoSub').textContent = s.uni || 'Your academic journey';
  const name = s.name ? `<span class="hl">${s.name}'s </span>` : '';
  const yearLabel = yr ? yr.label : '';
  const eyeParts = [s.uni, s.dept].filter(Boolean);
  document.getElementById('hdrEyebrow').textContent = eyeParts.length ? eyeParts.join(' · ') : 'Grade Tracker';
  
  const st = _yearSubtabs[yr?.id] || 'dashboard';
  let tabName = s.tabNames[st] || DEFAULT_TAB_NAMES[st];
  if(st === 'dashboard') tabName = yearLabel || 'Dashboard';
  
  document.getElementById('hdrTitle').innerHTML = `${name}${tabName}`;
}

let yeEditId = null;
function renderYearsNav() {
  const nav = document.getElementById('yearsNav');
  nav.innerHTML = '';
  APP.years.forEach(yr => {
    const btn = document.createElement('div');
    btn.className = 'year-tab-btn' + (yr.id===APP.activeYear?' active':'');
    btn.onclick = () => switchYear(yr.id);
    btn.setAttribute('aria-label', `${yr.label}`);

    const left = document.createElement('div');
    left.className = 'yr-left';
    const dot = document.createElement('span'); dot.className = 'yr-dot';
    const label = document.createElement('span'); label.className = 'yr-label'; label.textContent = yr.label;
    left.appendChild(dot); left.appendChild(label);

    const editBtn = document.createElement('button');
    editBtn.className = 'icon-btn btn-sm yr-edit-btn';
    editBtn.innerHTML = '✎';
    editBtn.title = 'Edit year';
    editBtn.onclick = (e) => { e.stopPropagation(); openYearEdit(yr.id); };

    btn.appendChild(left);
    btn.appendChild(editBtn);
    nav.appendChild(btn);
  });
  const addBtn = document.createElement('button');
  addBtn.className = 'add-year-btn';
  addBtn.innerHTML = '+ Add year';
  addBtn.onclick   = () => openYearEdit(null);
  nav.appendChild(addBtn);
}

let editingTabKey = null;
function openTabEdit(key) {
  editingTabKey = key;
  document.getElementById('te-key').value = key;
  document.getElementById('te-name').value = APP.settings.tabNames[key] || DEFAULT_TAB_NAMES[key];
  openOverlay('tabEditOverlay');
}

function saveTabEdit() {
  const key = document.getElementById('te-key').value;
  const name = document.getElementById('te-name').value.trim();
  if(!name) { showToast('Please enter a name'); return; }
  APP.settings.tabNames[key] = name;
  persist();
  closeOverlayDirect('tabEditOverlay');
  renderSidebarNav(APP.activeYear);
  renderHeader();
}

function renderSidebarNav(yid) {
  const nav = document.getElementById('sidebarNav');
  const st  = _yearSubtabs[yid] || 'dashboard';
  const names = APP.settings.tabNames;
  
  const tabs = [
    { id: 'dashboard', icon: '◈' },
    { id: 'timetable', icon: '◷' },
    { id: 'modules',   icon: '◫' },
    { id: 'checklist', icon: '☑' },
    { id: 'target',    icon: '🎯' },
  ];

  nav.innerHTML = tabs.map(t => `
    <div class="nav-btn ${st===t.id?'active':''}" onclick="switchSubtab('${yid}','${t.id}')">
      <div class="nav-btn-left">
        <span class="nav-icon">${t.icon}</span> <span class="nav-lbl">${names[t.id] || DEFAULT_TAB_NAMES[t.id]}</span>
      </div>
      <button class="icon-btn btn-sm nav-edit-btn" onclick="event.stopPropagation();openTabEdit('${t.id}')" title="Edit tab name">✎</button>
    </div>
  `).join('');
}

function switchYear(yid) {
  APP.activeYear = yid;
  renderYearsNav(); renderYearPanes(); renderSidebarNav(yid); renderHeader(); persist();
}

function openYearEdit(yid) {
  yeEditId = yid;
  const yr = yid ? getYear(yid) : null;
  document.getElementById('yearEditEyebrow').textContent = yid ? 'Edit year' : 'Add year';
  document.getElementById('yearEditTitle').textContent   = yid ? yr.label : 'New Academic Year';
  document.getElementById('ye-label').value = yr ? yr.label : '';
  document.getElementById('ye-acyr').value  = yr ? yr.acyr  : '';
  document.getElementById('deleteYearBtn').style.display = yid ? 'inline-flex' : 'none';
  openOverlay('yearEditOverlay');
}

function saveYearEdit() {
  const label = document.getElementById('ye-label').value.trim();
  const acyr  = document.getElementById('ye-acyr').value.trim();
  if (!label) { showToast('Please enter a label'); return; }
  if (yeEditId) {
    const yr = getYear(yeEditId); yr.label=label; yr.acyr=acyr;
  } else {
    const nid = makeId();
    APP.years.push({id:nid,label,acyr,modules:[],marks:{},checklist:{},targetGrades:{}});
    APP.activeYear = nid;
  }
  persist(); closeOverlayDirect('yearEditOverlay'); renderAll();
}

function deleteCurrentYear() {
  if (APP.years.length<=1) { showToast('Cannot delete the only year.'); return; }
  if (!confirm(`Delete "${getYear(yeEditId).label}" and ALL its data?`)) return;
  APP.years = APP.years.filter(y => y.id!==yeEditId);
  if (APP.activeYear===yeEditId) APP.activeYear = APP.years[0].id;
  persist(); closeOverlayDirect('yearEditOverlay'); renderAll();
}

let meYid=null, meModId=null;
function openModEdit(yid, modId) {
  meYid=yid; meModId=modId;
  const yr=getYear(yid), mod=modId?yr.modules.find(m=>m.id===modId):null;
  document.getElementById('modEditEyebrow').textContent = modId ? 'Edit module' : 'Add module';
  document.getElementById('modEditTitle').textContent   = modId ? mod.name : 'New Module';
  document.getElementById('me-code').value = mod ? mod.code : '';
  document.getElementById('me-name').value = mod ? mod.name : '';
  document.getElementById('me-cats').value = mod ? mod.cats : '';
  document.getElementById('deleteModBtn').style.display = modId ? 'inline-flex' : 'none';
  openOverlay('modEditOverlay');
}

function saveModEdit() {
  const code=document.getElementById('me-code').value.trim().toUpperCase();
  const name=document.getElementById('me-name').value.trim();
  const cats=parseInt(document.getElementById('me-cats').value)||0;
  if (!code||!name) { showToast('Fill in code and name'); return; }
  const yr=getYear(meYid);
  if (meModId) {
    const mod=yr.modules.find(m=>m.id===meModId); mod.code=code; mod.name=name; mod.cats=cats;
  } else {
    const nid=makeId();
    // Auto-populate components from module dict if available
    const dictEntry = ALL_MODULES_DICT[code];
    const components = [];
    if (dictEntry && dictEntry.components && dictEntry.components.length > 0) {
      dictEntry.components.forEach(c => {
        components.push({
          id: makeId(),
          name: c.name,
          weight: c.weight,
          category: inferCategory(c.name),
          date: '', time: '', duration: '', location: ''
        });
      });
    }
    yr.modules.push({id:nid, code, name, cats, components, url: dictEntry ? dictEntry.url : ''});
    if (!yr.checklist) yr.checklist={};
    if (!yr.targetGrades) yr.targetGrades={};
    yr.checklist[nid]={topics:[],done:{}};
  }
  persist(); closeOverlayDirect('modEditOverlay'); renderYearPane(meYid);
}

function deleteCurrentMod() {
  if (!confirm('Delete this module and all its components?')) return;
  const yr=getYear(meYid); yr.modules=yr.modules.filter(m=>m.id!==meModId);
  persist(); closeOverlayDirect('modEditOverlay'); renderYearPane(meYid);
}

let ceYid=null, ceModId=null, ceCompId=null;
function openCompEdit(yid, modId, compId) {
  ceYid=yid; ceModId=modId; ceCompId=compId;
  const yr=getYear(yid), mod=yr.modules.find(m=>m.id===modId);
  const comp=compId?mod.components.find(c=>c.id===compId):null;
  document.getElementById('compEditTitle').textContent = compId ? 'Edit Component' : 'Add Component';
  document.getElementById('ce-name').value     = comp ? comp.name     : '';
  document.getElementById('ce-weight').value   = comp ? comp.weight   : '';
  document.getElementById('ce-date').value     = comp ? (comp.date     || '') : '';
  document.getElementById('ce-time').value     = comp ? (comp.time     || '') : '';
  document.getElementById('ce-duration').value = comp ? (comp.duration || '') : '';
  document.getElementById('ce-location').value = comp ? (comp.location || '') : '';
  document.getElementById('ce-category').value = comp ? (comp.category || 'Coursework') : 'Coursework';
  document.getElementById('deleteCompBtn').style.display = compId ? 'inline-flex' : 'none';
  syncCatSelector(comp ? comp.category : 'Coursework');
  openOverlay('compEditOverlay');
}

function syncCatSelector(selectedCat) {
  document.querySelectorAll('#catSelector .cat-sel-btn').forEach(btn => {
    btn.className = 'cat-sel-btn';
    if (btn.dataset.cat===selectedCat) {
      if (selectedCat==='Exam') btn.classList.add('active-exam');
      else if (selectedCat==='Coursework') btn.classList.add('active-cw');
      else if (selectedCat==='Essays') btn.classList.add('active-essay');
      else if (selectedCat==='Class Test') btn.classList.add('active-test');
      else if (selectedCat==='Other') btn.classList.add('active-other');
    }
  });
}

function selectCat(btn) { document.getElementById('ce-category').value=btn.dataset.cat; syncCatSelector(btn.dataset.cat); }

function saveCompEdit() {
  const name     = document.getElementById('ce-name').value.trim();
  const category = document.getElementById('ce-category').value || 'Coursework';
  const weight   = parseFloat(document.getElementById('ce-weight').value) || 0;
  const date     = document.getElementById('ce-date').value.trim();
  const time     = document.getElementById('ce-time').value.trim();
  const duration = document.getElementById('ce-duration').value.trim();
  const location = document.getElementById('ce-location').value.trim();
  if (!name||!weight) { showToast('Fill in name and weight'); return; }
  const yr=getYear(ceYid), mod=yr.modules.find(m=>m.id===ceModId);
  if (ceCompId) {
    const comp=mod.components.find(c=>c.id===ceCompId);
    comp.name=name; comp.category=category; comp.weight=weight;
    comp.date=date; comp.time=time; comp.duration=duration; comp.location=location;
  } else {
    mod.components.push({id:makeId(),name,category,weight,date,time,duration,location});
  }
  persist(); closeOverlayDirect('compEditOverlay'); renderYearPane(ceYid);
}

function deleteCurrentComp() {
  if (!confirm('Delete this component?')) return;
  const yr=getYear(ceYid), mod=yr.modules.find(m=>m.id===ceModId);
  mod.components=mod.components.filter(c=>c.id!==ceCompId);
  persist(); closeOverlayDirect('compEditOverlay'); renderYearPane(ceYid);
}

function openEditSettings() {
  const s=APP.settings;
  document.getElementById('cfg-name').value    = s.name  || '';
  document.getElementById('cfg-uni').value     = s.uni   || '';
  document.getElementById('cfg-dept').value    = s.dept  || '';
  document.getElementById('cfg-code').value    = s.code  || '';
  document.getElementById('cfg-dark').checked  = !!s.darkMode;
  document.getElementById('cfg-compact').checked = !!s.compact;
  const activePreset = COLOUR_PRESETS[s.accentPreset||0];
  const picker = document.getElementById('cfg-customColour');
  if (picker) picker.value = s.accentCustom || activePreset.mid;
  renderSwatches();
  openOverlay('settingsOverlay');
}

function saveSettings() {
  const s=APP.settings;
  s.name   = document.getElementById('cfg-name').value.trim();
  s.uni    = document.getElementById('cfg-uni').value.trim();
  s.dept   = document.getElementById('cfg-dept').value.trim();
  s.code   = document.getElementById('cfg-code').value.trim();
  s.darkMode = document.getElementById('cfg-dark').checked;
  s.compact  = document.getElementById('cfg-compact').checked;
  persist(); restoreAppearance(); closeOverlayDirect('settingsOverlay'); renderHeader();
  showToast('Settings saved!');
}

function openOverlay(id)        { closeSidebar(); document.getElementById(id).classList.add('open'); }
function closeOverlay(id,e)     { if(e.target===document.getElementById(id)) document.getElementById(id).classList.remove('open'); }
function closeOverlayDirect(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('keydown', e => { if(e.key==='Escape') document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open')); });

function setSidebarOpen(open) {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const hamburger = document.querySelector('.hamburger');
  if (!sidebar || !overlay) return;
  sidebar.classList.toggle('open', open);
  overlay.classList.toggle('open', open);
  document.body.classList.toggle('sidebar-is-open', open);
  if (hamburger) hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function toggleSidebar(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const sidebar = document.getElementById('sidebar');
  const isOpen = sidebar && sidebar.classList.contains('open');
  setSidebarOpen(!isOpen);
}

function closeSidebar() {
  setSidebarOpen(false);
}

function shouldKeepSidebarOpenForClick(e) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar || !sidebar.classList.contains('open')) return true;

  const clickedSidebar = sidebar.contains(e.target);
  const clickedToggle = !!(e.target.closest && e.target.closest('.hamburger'));
  return clickedSidebar || clickedToggle;
}

document.addEventListener('pointerdown', e => {
  if (!shouldKeepSidebarOpenForClick(e)) closeSidebar();
}, true);

document.addEventListener('click', e => {
  if (!shouldKeepSidebarOpenForClick(e)) closeSidebar();
});

function renderAll() { renderHeader(); renderYearsNav(); renderYearPanes(); renderSidebarNav(APP.activeYear); }

function renderYearPanes() {
  const cont=document.getElementById('yearPanes'); cont.innerHTML='';
  APP.years.forEach(yr => {
    const pane=document.createElement('div');
    pane.className='year-pane'+(yr.id===APP.activeYear?' active':'');
    pane.id='pane-'+yr.id;
    pane.style.display=yr.id===APP.activeYear?'block':'none';
    cont.appendChild(pane);
    renderYearPane(yr.id);
  });
}

const _yearSubtabs={}, _ttFilterCat={}, _ttFilterTime={};

function renderYearPane(yid) {
  const yr=getYear(yid), pane=document.getElementById('pane-'+yid);
  if(!pane) return;
  const st=_yearSubtabs[yid]||'dashboard';
  pane.innerHTML=`
    <div class="subpane ${st==='dashboard'?'active':''}"  id="sp-${yid}-dashboard">${buildDashboard(yr)}</div>
    <div class="subpane ${st==='timetable'?'active':''}"  id="sp-${yid}-timetable">${buildTimetable(yr)}</div>
    <div class="subpane ${st==='modules'?'active':''}"    id="sp-${yid}-modules">${buildModules(yr)}</div>
    <div class="subpane ${st==='checklist'?'active':''}"  id="sp-${yid}-checklist">${buildChecklist(yr)}</div>
    <div class="subpane ${st==='target'?'active':''}"     id="sp-${yid}-target">${buildTarget(yr)}</div>
  `;
}

function switchSubtab(yid, st) {
  _yearSubtabs[yid]=st;
  document.querySelectorAll(`#pane-${yid} > .subpane`).forEach(p=>p.classList.remove('active'));
  const target=document.getElementById(`sp-${yid}-${st}`);
  if(target) target.classList.add('active');
  renderSidebarNav(yid);
  renderHeader();
  closeSidebar();
}

function buildDashboard(yr) {
  const noModules = !yr.modules || yr.modules.length === 0;

  const hint = `<div class="menu-hint">
    <span class="menu-hint-icon">☰</span>
    <span>Use the <strong>menu button</strong> or <strong>sidebar</strong> to navigate your views.</span>
  </div>`;

  if (noModules) {
    return hint + `
      <div class="empty-state" onclick="switchSubtabAndOpenModEdit('${yr.id}')">
        <div class="empty-state-icon">📚</div>
        <div class="empty-state-title">No modules yet</div>
        <div class="empty-state-sub">Add your first module to start tracking grades.<br>Click here or go to <strong>Modules</strong> in the menu.</div>
        <button class="empty-state-btn" onclick="event.stopPropagation();switchSubtab('${yr.id}','modules');openModEdit('${yr.id}',null)">+ Add your first module</button>
      </div>`;
  }

  const ym = yearMark(yr);
  let gradeHtml;
  if (ym!==null) {
    gradeHtml=`<div class="yr-grade-num">${ym.toFixed(1)}%</div><div class="yr-grade-cls">${gradeClass(ym)}</div>`;
  } else {
    gradeHtml=`<div class="yr-grade-num" style="color:var(--tx4)">—</div><div class="yr-grade-cls" style="color:var(--tx4)">No marks yet</div>`;
  }

  let pills='';
  yr.modules.forEach(m => {
    const t=modTotal(m,yr.marks), p=modPartial(m,yr.marks), ew=modEnteredWeight(m,yr.marks);
    let label;
    if (t!==null)      label=`<span class="ps">${t.toFixed(1)}%</span>`;
    else if (p!==null) label=`<span style="color:var(--tx2)">${p.toFixed(1)}/${ew}pt</span>`;
    else               label=`<span style="color:var(--tx4)">—</span>`;
    pills+=`<div class="yr-pill">${m.code} ${label}</div>`;
  });

  const today=new Date(); today.setHours(0,0,0,0);
  const upcoming=[];
  yr.modules.forEach(mod => {
    mod.components.forEach(c => {
      const d=resolveCompDate(c);
      const hasMark=yr.marks[c.id]!==''&&yr.marks[c.id]!==undefined&&yr.marks[c.id]!==null&&!isNaN(parseFloat(yr.marks[c.id]));
      if (d&&d>=today&&!hasMark) upcoming.push({mod,comp:c,date:d,days:Math.ceil((d-today)/86400000)});
    });
  });
  upcoming.sort((a,b)=>a.date-b.date);

  let upHtml='';
  if (!upcoming.length) {
    upHtml='<div style="font-family:var(--fm);font-size:11px;color:var(--tx4);font-style:italic">No upcoming dates — add dates to components in the Modules tab.</div>';
  } else {
    upcoming.slice(0,8).forEach(item => {
      const urgency=item.days<=7?'var(--red)':item.days<=14?'var(--am)':'var(--tx3)';
      upHtml+=`<div class="upcoming-row">
        <div style="display:flex;align-items:center;gap:8px;overflow:hidden;min-width:0">
          <span style="font-family:var(--fm);font-size:10px;color:var(--accent-mid);background:var(--accent-bg);padding:2px 7px;border-radius:6px;border:1px solid var(--accent-border);white-space:nowrap;flex-shrink:0">${item.mod.code}</span>
          ${catBadgeHtml(item.comp.category)}
          <span style="font-size:13px;color:var(--tx);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600">${item.mod.name} — ${item.comp.name}</span>
        </div>
        <div style="display:flex;align-items:center;gap:7px;flex-shrink:0">
          <span style="font-family:var(--fm);font-size:11px;color:var(--tx2);white-space:nowrap">${fmtDate(item.comp.date)}</span>
          <span style="font-family:var(--fm);font-size:11px;color:${urgency};font-weight:700;min-width:26px;text-align:right">${item.days===0?'Today!':item.days+'d'}</span>
        </div>
      </div>`;
    });
  }

  const completedCats=yr.modules.reduce((s,m)=>s+(modTotal(m,yr.marks)!==null?m.cats:0),0);
  return hint+`
    <div class="year-overview" data-label="${yr.label.toUpperCase()}">
      <div style="margin-bottom:4px;font-family:var(--fm);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--tx3)">${yr.label} Overall</div>
      <div style="display:flex;align-items:baseline;gap:14px;margin-bottom:8px">${gradeHtml}</div>
      <p style="font-size:12px;color:var(--tx3);font-family:var(--fm)">${ym!==null?`CATS-weighted · ${completedCats} of ${totalCats(yr)} CATS complete`:''}</p>
      <div class="yr-pills">${pills}</div>
    </div>
    <div class="upcoming-box">
      <div style="font-family:var(--fd);font-size:13px;font-weight:800;letter-spacing:.03em;color:var(--tx2);margin-bottom:12px">📅 Next Up</div>
      ${upHtml}
    </div>`;
}

function switchSubtabAndOpenModEdit(yid) {
  switchSubtab(yid, 'modules');
  openModEdit(yid, null);
}

function buildTimetable(yr) {
  const today=new Date(); today.setHours(0,0,0,0);
  const allItems=[];

  if (!yr.modules || !yr.modules.length) {
    return `<div class="tt-empty">No modules yet. Add modules and components to see your timetable here.</div>`;
  }

  yr.modules.forEach(mod => {
    mod.components.forEach(c => {
      const d=resolveCompDate(c);
      const hasMark=yr.marks[c.id]!==''&&yr.marks[c.id]!==undefined&&yr.marks[c.id]!==null&&!isNaN(parseFloat(yr.marks[c.id]));
      const daysUntil=d?Math.ceil((d-today)/86400000):null;
      allItems.push({mod,comp:c,date:d,mark:hasMark?parseFloat(yr.marks[c.id]):null,hasMark,daysUntil,isPast:d?d<today:false});
    });
  });

  const doneAll=allItems.filter(i=>i.hasMark).length;
  const upcoming=allItems.filter(i=>i.date&&i.daysUntil>=0&&!i.hasMark).length;
  const statsHtml=`<div class="tt-stats">
    <div class="tt-stat"><div class="tt-stat-lbl">Total Items</div><div class="tt-stat-val">${allItems.length}</div></div>
    <div class="tt-stat"><div class="tt-stat-lbl">Done</div><div class="tt-stat-val" style="color:var(--gn)">${doneAll}</div></div>
    <div class="tt-stat"><div class="tt-stat-lbl">Upcoming</div><div class="tt-stat-val" style="color:var(--accent-mid)">${upcoming}</div></div>
  </div>`;

  const noteHtml=`<div class="tt-note">ℹ <span>Click <strong>✎ Edit</strong> on any item to update date, time, venue, or results.</span></div>`;

  const fCat = _ttFilterCat[yr.id] || 'all';
  const fTime = _ttFilterTime[yr.id] || 'all';

  let items = allItems;
  if(fCat !== 'all') items = items.filter(i => i.comp.category === fCat);
  if(fTime === 'upcoming') items = items.filter(i => i.date && i.daysUntil >= 0 && !i.hasMark);
  else if(fTime === 'done') items = items.filter(i => i.hasMark);
  else if(fTime === 'undated') items = items.filter(i => !i.date);

  const filtersHtml = `
    <div class="tt-filters-group">
      <div class="tt-filters">
        <span class="tt-filters-lbl">Category</span>
        <button class="tt-flt ${fCat==='all'?'active':''}" onclick="setTTFilter('${yr.id}','cat','all')">All</button>
        <button class="tt-flt ${fCat==='Exam'?'active':''}" onclick="setTTFilter('${yr.id}','cat','Exam')">Exams</button>
        <button class="tt-flt ${fCat==='Coursework'?'active':''}" onclick="setTTFilter('${yr.id}','cat','Coursework')">Coursework</button>
        <button class="tt-flt ${fCat==='Essays'?'active':''}" onclick="setTTFilter('${yr.id}','cat','Essays')">Essays</button>
        <button class="tt-flt ${fCat==='Class Test'?'active':''}" onclick="setTTFilter('${yr.id}','cat','Class Test')">Tests</button>
        <button class="tt-flt ${fCat==='Other'?'active':''}" onclick="setTTFilter('${yr.id}','cat','Other')">Other</button>
      </div>
      <div class="tt-filters">
        <span class="tt-filters-lbl">Status</span>
        <button class="tt-flt ${fTime==='all'?'active':''}" onclick="setTTFilter('${yr.id}','time','all')">All</button>
        <button class="tt-flt ${fTime==='upcoming'?'active':''}" onclick="setTTFilter('${yr.id}','time','upcoming')">Upcoming</button>
        <button class="tt-flt ${fTime==='done'?'active':''}" onclick="setTTFilter('${yr.id}','time','done')">Done</button>
        <button class="tt-flt ${fTime==='undated'?'active':''}" onclick="setTTFilter('${yr.id}','time','undated')">No date</button>
      </div>
    </div>`;

  return `${statsHtml}${noteHtml}${filtersHtml}<div id="tt-list-wrap-${yr.id}">${buildTTList(items,yr)}</div>`;
}

function buildTTList(items, yr) {
  items.sort((a,b)=>{if(a.date&&b.date)return a.date-b.date;if(a.date)return-1;if(b.date)return 1;return 0;});
  if(!items.length) return '<div class="tt-empty">No assessments match this filter.</div>';
  const groups={};
  items.forEach(item=>{const key=item.date?item.date.toLocaleDateString('en-GB',{month:'long',year:'numeric'}):'No date set';if(!groups[key])groups[key]=[];groups[key].push(item);});
  let h='';
  for(const [month,gItems] of Object.entries(groups)){
    h+=`<div class="tt-grp"><div class="tt-grp-hdr"><span class="tt-month">${month}</span><span class="tt-line"></span><span class="tt-cnt">${gItems.length} item${gItems.length!==1?'s':''}</span></div>`;
    gItems.forEach(item=>{
      const sc=item.hasMark?'done':item.daysUntil!==null&&item.daysUntil<=7?'urgent':item.daysUntil!==null&&item.daysUntil<=14?'soon':'';
      const dateBlockHtml=item.date
        ?`<div class="tt-date"><div class="tt-day">${item.date.getDate()}</div><div class="tt-mon">${item.date.toLocaleDateString('en-GB',{month:'short'}).toUpperCase()}</div></div>`
        :`<div class="tt-date tt-tbd"><div class="tt-day">TBD</div><div class="tt-mon">—</div></div>`;
      let cdHtml=item.hasMark?`<span class="tt-cd">Marked ✓</span>`:'';
      if(!item.hasMark&&item.daysUntil!==null){const cls=item.daysUntil<=7?'urgent':item.daysUntil<=14?'soon':'';cdHtml=`<span class="tt-cd ${cls}">${item.daysUntil===0?'Today!':item.daysUntil<0?Math.abs(item.daysUntil)+'d ago':item.daysUntil+'d'}</span>`;}
      const markPill=item.hasMark?`<span class="tt-mark" style="color:${gradeColor(item.mark)};border-color:${gradeColor(item.mark)}44">${item.mark.toFixed(1)}% · ${gradeClass(item.mark)}</span>`:`<span class="tt-mark">—</span>`;
      let timeBadge='', locBadge='';
      if(item.comp.time) timeBadge=`<span class="tt-timebadge">⏰ ${item.comp.time}${item.comp.duration?' · '+item.comp.duration:''}</span>`;
      if(item.comp.location) locBadge=`<span class="tt-locbadge">📍 ${item.comp.location}</span>`;
      h+=`<div class="tt-item ${sc} clickable" onclick="openExamView('${yr.id}','${item.comp.id}')">
        ${dateBlockHtml}
        <div>
          <div class="tt-title">${item.mod.name} — ${item.comp.name}</div>
          <div class="tt-meta">
            <span class="tt-mod">${item.mod.code}</span>${catBadgeHtml(item.comp.category)}
            <span class="tt-wt">${item.comp.weight}% wt</span>${timeBadge}${locBadge}
          </div>
        </div>
        <div class="tt-right">
          ${markPill}${cdHtml}
          <button class="icon-btn btn-sm" title="Edit component" onclick="event.stopPropagation();openCompEdit('${yr.id}','${item.mod.id}','${item.comp.id}')">✎</button>
        </div>
      </div>`;
    });
    h+='</div>';
  }
  return h;
}

function setTTFilter(yid, type, val) {
  if (type === 'cat') _ttFilterCat[yid] = val;
  if (type === 'time') _ttFilterTime[yid] = val;
  const pane = document.getElementById(`sp-${yid}-timetable`);
  if(pane) pane.innerHTML = buildTimetable(getYear(yid));
}

function openExamView(yid, compId) {
  const yr=getYear(yid);
  let mod=null, comp=null;
  for(const m of yr.modules){const c=m.components.find(x=>x.id===compId);if(c){mod=m;comp=c;break;}}
  if(!comp) return;
  const today=new Date(); today.setHours(0,0,0,0);
  const mark=yr.marks[compId];
  const hasMark=mark!==''&&mark!==undefined&&mark!==null&&!isNaN(parseFloat(mark));
  const d=resolveCompDate(comp);
  document.getElementById('ev-modbadge').textContent=mod.code;
  document.getElementById('ev-catbadge').innerHTML=catBadgeHtml(comp.category);
  document.getElementById('ev-title').textContent=mod.name+' — '+comp.name;
  const cdVal=document.getElementById('ev-cd-val'), cdLbl=document.getElementById('ev-cd-lbl');
  if(hasMark){cdVal.textContent='Completed ✓';cdVal.className='modal-cd-val done';cdLbl.textContent='Status';}
  else if(d){const du=Math.ceil((d-today)/86400000),txt=du<0?Math.abs(du)+'d ago':du===0?'Today!':du+'d',cls=du<0?'done':du===0||du<=7?'urgent':du<=14?'soon':'';cdVal.textContent=txt;cdVal.className='modal-cd-val '+cls;cdLbl.textContent='Time until';}
  else{cdVal.textContent='Date TBD';cdVal.className='modal-cd-val';cdLbl.textContent='Schedule';}
  let grid='';
  if(comp.date)     grid+=`<div class="modal-det"><div class="modal-det-lbl">📅 Date</div><div class="modal-det-val hl">${fmtDate(comp.date)}</div></div>`;
  if(comp.time)     grid+=`<div class="modal-det"><div class="modal-det-lbl">⏰ Time</div><div class="modal-det-val hl">${comp.time}</div></div>`;
  if(comp.duration) grid+=`<div class="modal-det"><div class="modal-det-lbl">⏱ Duration</div><div class="modal-det-val">${comp.duration}</div></div>`;
  if(comp.location) grid+=`<div class="modal-det${!comp.duration?' full':''}"><div class="modal-det-lbl">📍 Venue</div><div class="modal-det-val" style="font-size:13px">${comp.location}</div></div>`;
  grid+=`<div class="modal-det"><div class="modal-det-lbl">⚖️ Weight</div><div class="modal-det-val">${comp.weight}% of module</div></div>`;
  grid+=`<div class="modal-det"><div class="modal-det-lbl">📚 CATS</div><div class="modal-det-val">${mod.cats} CATS</div></div>`;
  grid+=`<div class="modal-det full" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><div class="modal-det-lbl">Edit component</div><div style="font-size:12px;color:var(--tx3)">Date, time, venue, name, weight, category</div></div><button class="btn btn-ghost btn-sm" onclick="closeOverlayDirect('examViewOverlay');openCompEdit('${yid}','${mod.id}','${compId}')">✎ Edit</button></div>`;
  document.getElementById('ev-grid').innerHTML=grid;
  let markHtml='';
  if(hasMark){const mv=parseFloat(mark),col=gradeColor(mv);markHtml=`<div style="display:flex;align-items:center;gap:12px"><div class="modal-mark-big" style="color:${col}">${mv.toFixed(1)}%</div><div><div style="font-family:var(--fd);font-size:15px;font-weight:700;color:${col}">${gradeClass(mv)}</div><div style="font-family:var(--fm);font-size:10px;color:var(--tx3);margin-top:2px">${comp.weight}% weighted</div></div></div>`;}
  else{markHtml='<div style="font-family:var(--fm);font-size:12px;color:var(--tx4);font-style:italic">No mark entered yet. Add it in the Modules tab.</div>';}
  document.getElementById('ev-mark').innerHTML=markHtml;
  openOverlay('examViewOverlay');
}

function buildModules(yr) {
  let html=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
    <div class="sec-title" style="margin:0;padding:0;border:none;font-family:var(--fd);font-size:20px;font-weight:800;color:var(--tx)">Modules</div>
    <button class="btn btn-primary btn-sm" onclick="openModEdit('${yr.id}',null)">+ Add module</button>
  </div>`;

  if (!yr.modules || !yr.modules.length) {
    html+=`<div class="empty-state" onclick="openModEdit('${yr.id}',null)">
      <div class="empty-state-icon">📚</div>
      <div class="empty-state-title">No modules yet</div>
      <div class="empty-state-sub">Click to add your first module.</div>
      <button class="empty-state-btn" onclick="event.stopPropagation();openModEdit('${yr.id}',null)">+ Add module</button>
    </div>`;
    return html;
  }

  yr.modules.forEach(mod=>{
    const total=modTotal(mod,yr.marks), partial=modPartial(mod,yr.marks), ew=modEnteredWeight(mod,yr.marks);
    let pillTxt='—', pillStyle='';
    if(total!==null){pillTxt=total.toFixed(1)+'%';pillStyle=`color:${gradeColor(total)};background:${gradeColor(total)}18;border-color:${gradeColor(total)}44`;}
    else if(partial!==null){pillTxt=`${partial.toFixed(1)} / ${ew} pts`;pillStyle='color:var(--tx2);';}

    // Module URL link button (from Warwick catalogue)
    const modUrl = mod.url || (ALL_MODULES_DICT[mod.code] ? ALL_MODULES_DICT[mod.code].url : '');
    const urlBtn = modUrl
      ? `<a href="${modUrl}" target="_blank" rel="noopener" class="icon-btn mod-link-btn" title="Open Warwick module page" onclick="event.stopPropagation()" style="font-size:14px;text-decoration:none;display:inline-flex;align-items:center;margin-right:4px">🔗</a>`
      : '';

    let compRows='';
    mod.components.forEach(c=>{
      const mv=yr.marks[c.id]!==undefined?yr.marks[c.id]:'';
      const hasMark=mv!==''&&!isNaN(parseFloat(mv));
      const dateDisplay=c.date?fmtDate(c.date):'—';
      let statusHtml='';
      if(hasMark) statusHtml=`<span class="badge badge-ok">✓ Marked</span>`;
      else if(c.date) statusHtml=`<span class="badge badge-no" style="color:var(--tx3);border-color:var(--b2)">${dateDisplay}</span>`;
      else statusHtml=`<span class="badge badge-no">No date</span>`;
      const rowBg=hasMark?'background:rgba(5,150,105,.04)':'';
      compRows+=`<tr style="${rowBg}">
        <td style="color:var(--tx);font-weight:600">${c.name}</td>
        <td>${catBadgeHtml(c.category)}</td>
        <td style="font-family:var(--fm);font-size:12px;color:var(--accent-light)">${c.weight}%</td>
        <td><div style="display:flex;align-items:center;gap:5px">
          <input class="inp inp-num" type="number" min="0" max="100" placeholder="—" value="${mv}" onchange="onMark('${yr.id}','${c.id}',this)" />
          <span style="font-family:var(--fm);font-size:11px;color:var(--tx4)">/100</span>
        </div></td>
        <td style="font-family:var(--fm);font-size:11px;color:var(--tx3)">${c.date||'<span style="color:var(--tx4)">—</span>'}</td>
        <td>${statusHtml}</td>
        <td><button class="icon-btn" title="Edit component (date, time, venue, mark, name, weight)" onclick="openCompEdit('${yr.id}','${mod.id}','${c.id}')">✎</button></td>
      </tr>`;
    });

    let weightedHtml='';
    if(total!==null){weightedHtml=`<div class="mod-weighted"><span class="mod-wlbl">Module mark</span><span class="mod-wscore" style="color:${gradeColor(total)}">${total.toFixed(1)}% · ${gradeClass(total)}</span></div>`;}
    else if(partial!==null){const remaining=mod.components.length-mod.components.filter(c=>{const v=yr.marks[c.id];return v!==''&&v!==undefined&&v!==null&&!isNaN(parseFloat(v));}).length;weightedHtml=`<div class="mod-weighted"><span class="mod-wlbl">Points so far <span style="font-size:11px;color:var(--tx4)">(${remaining} remaining)</span></span><span class="mod-wscore" style="color:var(--tx2);font-size:14px">${partial.toFixed(1)} / ${ew} pts</span></div>`;}

    const modResetHtml=`<div class="mod-reset-row"><span class="mod-reset-lbl">Reset:</span>
      <button class="btn btn-ghost btn-sm" onclick="clearModScores('${yr.id}','${mod.id}')">Scores</button>
      <button class="btn btn-danger btn-sm" onclick="clearModAll('${yr.id}','${mod.id}')">All</button></div>`;

    // Assessment split badge (if available in dict)
    const dictEntry = ALL_MODULES_DICT[mod.code];
    const splitBadge = dictEntry && dictEntry.assessmentSplit
      ? `<span style="font-family:var(--fm);font-size:10px;color:var(--tx3);margin-left:6px;background:var(--bg2);padding:2px 6px;border-radius:4px;border:1px solid var(--b2)">${dictEntry.assessmentSplit}</span>`
      : '';

    html+=`<div class="card" id="modcard-${yr.id}-${mod.id}">
      <div class="mod-hdr" onclick="toggleCard('modcard-${yr.id}-${mod.id}')">
        <span class="mod-code">${mod.code}</span>
        <span class="mod-name">${mod.name}${splitBadge}</span>
        <span class="mod-pill" style="${pillStyle}">${pillTxt}</span>
        <span class="mod-cats">${mod.cats} CATS</span>
        ${urlBtn}
        <button class="icon-btn" onclick="event.stopPropagation();openModEdit('${yr.id}','${mod.id}')" title="Edit module" style="margin-right:4px">✎</button>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="mod-body" style="display:none">
        <table class="comp-tbl">
          <thead><tr><th>Component</th><th>Category</th><th>Wt</th><th>Your Mark</th><th>Date</th><th>Status</th><th></th></tr></thead>
          <tbody>${compRows}</tbody>
        </table>
        <button class="btn-add-dashed" onclick="openCompEdit('${yr.id}','${mod.id}',null)">+ Add component</button>
        ${weightedHtml}${modResetHtml}
      </div>
    </div>`;
  });

  html+=buildResetZone(yr);
  return html;
}

function buildTarget(yr) {
  if (!yr.targetGrades) yr.targetGrades = {};
  
  if (!yr.modules || !yr.modules.length) {
    return `<div class="tt-empty">No modules yet. Add modules to start exploring target grades.</div>`;
  }

  let html = `
    <div style="font-family:var(--fd);font-size:20px;font-weight:800;color:var(--tx);margin-bottom:8px">Target Grades Simulator</div>
    <div style="font-family:var(--fm);font-size:12px;color:var(--tx3);margin-bottom:24px;line-height:1.5">Set a target grade for your modules to see what average you need on your remaining, unmarked components.</div>
  `;

  yr.modules.forEach(mod => {
    const tg = yr.targetGrades[mod.id] || 70;
    const partial = modPartial(mod, yr.marks) || 0;
    const ew = modEnteredWeight(mod, yr.marks);
    const remW = 100 - ew;
    
    let calcHtml = '';
    if (remW <= 0) {
      calcHtml = `<div class="tg-result tg-done">Module fully graded. Final mark: <strong style="color:${gradeColor(partial)}">${partial.toFixed(1)}%</strong></div>`;
    } else {
      const requiredPoints = tg - partial;
      const requiredAvg = (requiredPoints / remW) * 100;
      if (requiredAvg <= 0) {
         calcHtml = `<div class="tg-result tg-ok">Target achieved! You need 0% on the remaining ${remW}% of the module.</div>`;
      } else if (requiredAvg > 100) {
         calcHtml = `<div class="tg-result tg-warn">Target impossible! You need ${requiredAvg.toFixed(1)}% on the remaining ${remW}% of the module.</div>`;
      } else {
         calcHtml = `<div class="tg-result">To get <strong>${tg}%</strong> overall, you need an average of <strong style="color:var(--accent-mid)">${requiredAvg.toFixed(1)}%</strong> on the remaining ${remW}% weight.</div>`;
      }
    }

    html += `
      <div class="card" style="padding:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:12px">
          <div>
            <div style="display:inline-block;font-family:var(--fm);font-size:11px;font-weight:600;color:var(--accent-mid);background:var(--accent-bg);padding:3px 8px;border-radius:6px;border:1px solid var(--accent-border);margin-bottom:6px">${mod.code}</div>
            <div style="font-family:var(--fd);font-size:15px;font-weight:700">${mod.name}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-family:var(--fm);font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">Target (%)</span>
            <input type="number" class="inp inp-num" style="width:72px;font-size:15px;font-weight:700" value="${tg}" min="0" max="100" onchange="updateTarget('${yr.id}','${mod.id}',this.value)" />
          </div>
        </div>
        <div style="font-family:var(--fm);font-size:12px;color:var(--tx4);margin-bottom:12px">Current marked total: ${partial.toFixed(1)} / ${ew} pts</div>
        ${calcHtml}
      </div>
    `;
  });

  return html;
}

function updateTarget(yid, mid, val) {
  const yr = getYear(yid);
  if(!yr.targetGrades) yr.targetGrades = {};
  let v = parseFloat(val);
  if(isNaN(v)) v = 70;
  yr.targetGrades[mid] = Math.min(100, Math.max(0, v));
  persist();
  const pane = document.getElementById(`sp-${yid}-target`);
  if(pane) pane.innerHTML = buildTarget(yr);
}


function buildResetZone(yr) {
  const modScoreBtns=yr.modules.map(m=>`<button class="btn btn-ghost btn-sm" onclick="clearModScores('${yr.id}','${m.id}')">${m.code}</button>`).join('');
  const modAllBtns=yr.modules.map(m=>`<button class="btn btn-danger btn-sm" onclick="clearModAll('${yr.id}','${m.id}')">${m.code}</button>`).join('');
  return `<div class="reset-zone">
    <div class="reset-zone-title">Reset Options — ${yr.label}</div>
    <div class="reset-group"><span class="reset-group-label">Clear all scores</span><div class="reset-btns"><button class="btn btn-ghost btn-sm" onclick="clearScores('${yr.id}')">All modules</button>${modScoreBtns}</div></div>
    <div class="reset-group" style="margin-bottom:0"><span class="reset-group-label" style="color:rgba(220,38,38,.7)">Clear scores (by module)</span><div class="reset-btns"><button class="btn btn-danger btn-sm" onclick="clearAll('${yr.id}')">All modules</button>${modAllBtns}</div></div>
  </div>
  <p class="save-note" style="margin-top:10px">Auto-saved to your browser on every change.</p>
  ${buildDangerZone()}`;
}

function buildDangerZone() {
  return `<div class="danger-zone">
    <div class="danger-zone-title">⚠ Danger zone</div>
    <div class="danger-zone-desc">These actions are <strong style="color:var(--red)">permanent and cannot be undone</strong>.</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-danger" onclick="hardResetAll()">🗑 Hard reset everything</button>
      <button class="btn btn-ghost btn-sm" onclick="exportData()" style="margin-left:auto">↓ Export backup</button>
      <button class="btn btn-ghost btn-sm" onclick="importData()">↑ Import backup</button>
    </div>
  </div>`;
}

function onMark(yid, compId, el) {
  const yr=getYear(yid), v=el.value.trim();
  yr.marks[compId]=v===''?'':Math.min(100,Math.max(0,parseFloat(v)));
  persist();
  const sp=document.getElementById(`sp-${yid}-modules`), dsp=document.getElementById(`sp-${yid}-dashboard`);
  const ttp=document.getElementById(`sp-${yid}-timetable`);
  const tgt=document.getElementById(`sp-${yid}-target`);
  const openCards=sp?[...sp.querySelectorAll('.card.open')].map(c=>c.id):[];
  if(sp)  sp.innerHTML=buildModules(yr);
  if(dsp) dsp.innerHTML=buildDashboard(yr);
  if(ttp) ttp.innerHTML=buildTimetable(yr);
  if(tgt) tgt.innerHTML=buildTarget(yr);
  restoreOpenCards(openCards,'.mod-body');
  renderHeader();
}

function clearScores(yid) { if(!confirm('Clear ALL scores?'))return;const yr=getYear(yid);yr.marks={};persist();renderYearPane(yid);showToast('Scores cleared.'); }
function clearAll(yid)    { if(!confirm('Clear ALL scores?'))return;const yr=getYear(yid);yr.marks={};persist();renderYearPane(yid);showToast('All cleared.'); }
function clearModScores(yid,mid) { if(!confirm('Clear scores for this module?'))return;const yr=getYear(yid),mod=yr.modules.find(m=>m.id===mid);mod.components.forEach(c=>{delete yr.marks[c.id];});persist();renderYearPane(yid);showToast(`${mod.code} scores cleared.`); }
function clearModAll(yid,mid)    { if(!confirm('Clear all scores for this module?'))return;const yr=getYear(yid),mod=yr.modules.find(m=>m.id===mid);mod.components.forEach(c=>{delete yr.marks[c.id];});persist();renderYearPane(yid);showToast(`${mod.code} cleared.`); }

function hardResetAll() {
  if(!confirm('⚠ HARD RESET: permanently delete ALL data?'))return;
  if(!confirm('Last chance — click OK to permanently delete everything.'))return;
  localStorage.removeItem('gradetracker_v7');
  localStorage.removeItem(COURSE_ONBOARDING_KEY);
  APP=JSON.parse(JSON.stringify(DEFAULT_DATA));
  persist(); renderAll(); showToast('Hard reset complete.');
}

function exportData() {
  const blob=new Blob([JSON.stringify(APP,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='grade-tracker-backup.json'; a.click();
  showToast('Backup downloaded!');
}

function importData() {
  const input=document.createElement('input'); input.type='file'; input.accept='.json';
  input.onchange=e=>{
    const file=e.target.files[0]; if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{const data=JSON.parse(ev.target.result);if(!data.years||!data.settings)throw new Error('Invalid format');if(!confirm('Import this backup? Current data will be replaced.'))return;APP=data;migrateData();persist();renderAll();restoreAppearance();showToast('Data imported!');}
      catch(err){alert('Could not import: '+err.message);}
    };
    reader.readAsText(file);
  };
  input.click();
}

let teYid=null, teModId=null;

function buildChecklist(yr) {
  if(!yr.checklist) yr.checklist={};
  let totalQ=0, totalDone=0;
  yr.modules.forEach(m=>{const cl=yr.checklist[m.id]||{topics:[],done:{}};totalQ+=cl.topics.length;totalDone+=cl.topics.filter((_,i)=>cl.done[i]).length;});
  const modsDone=yr.modules.filter(m=>{const cl=yr.checklist[m.id]||{topics:[],done:{}};return cl.topics.length>0&&cl.topics.every((_,i)=>cl.done[i]);}).length;
  const pct=totalQ>0?Math.round(totalDone/totalQ*100):0;

  if(!yr.modules||!yr.modules.length) {
    return `<div class="tt-empty">No modules yet. Add modules via the Modules tab first.</div>`;
  }

  const statsHtml=`<div class="cl-stats">
    <div class="cl-stat"><div class="cl-stat-lbl">Topics done</div><div class="cl-stat-val">${totalDone} <span style="font-size:15px;color:var(--tx4)">/ ${totalQ}</span></div></div>
    <div class="cl-stat"><div class="cl-stat-lbl">Progress</div><div class="cl-stat-val" style="color:var(--gn)">${pct}%</div></div>
    <div class="cl-stat"><div class="cl-stat-lbl">Modules done</div><div class="cl-stat-val">${modsDone} <span style="font-size:15px;color:var(--tx4)">/ ${yr.modules.length}</span></div></div>
  </div>`;

  const actHtml=`<div class="cl-actions">
    <button class="btn btn-ghost btn-sm" onclick="clExpandAll('${yr.id}')">Expand all</button>
    <button class="btn btn-ghost btn-sm" onclick="clCollapseAll('${yr.id}')">Collapse all</button>
    <button class="btn btn-danger btn-sm" onclick="clReset('${yr.id}')">Reset all progress</button>
  </div>`;

  let modHtml='';
  yr.modules.forEach(m=>{
    const cl=yr.checklist[m.id]||{topics:[],done:{}};
    const done=cl.topics.filter((_,i)=>cl.done[i]).length, total=cl.topics.length;
    const fpct=total>0?Math.round(done/total*100):0;
    let items='';
    cl.topics.forEach((topic,i)=>{const chk=!!cl.done[i];items+=`<div class="cl-item${chk?' chk':''}" onclick="clToggle('${yr.id}','${m.id}',${i})"><div class="cl-box"><svg class="cl-tick" viewBox="0 0 10 10" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1.5 5 4 7.5 8.5 2.5"/></svg></div><span class="cl-lbl">${topic||'Topic '+(i+1)}</span></div>`;});
    if(!items) items=`<div style="font-family:var(--fm);font-size:11px;color:var(--tx4);font-style:italic;padding:8px 0">No topics yet. Click ✎ to add some.</div>`;
    const modResetBtn=total>0?`<button class="btn btn-danger btn-sm" style="margin-top:10px" onclick="clResetMod('${yr.id}','${m.id}')">Reset ${m.code} progress</button>`:'';
    modHtml+=`<div class="card" id="clcard-${yr.id}-${m.id}">
      <div class="cl-mod-hdr" onclick="toggleCard('clcard-${yr.id}-${m.id}')">
        <span class="mod-code">${m.code}</span>
        <span class="mod-name">${m.name}</span>
        <span class="cl-count${done===total&&total>0?' done':''}">${done} / ${total}</span>
        <div class="cl-bar-wrap"><div class="cl-bar-fill" style="width:${fpct}%"></div></div>
        <button class="icon-btn btn-sm" onclick="event.stopPropagation();openTopicEdit('${yr.id}','${m.id}')" title="Edit topics" style="margin-right:4px">✎</button>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="cl-mod-body" style="display:none"><div class="cl-grid">${items}</div>${modResetBtn}</div>
    </div>`;
  });

  return statsHtml+actHtml+`<div>${modHtml}</div>`;
}

function clToggle(yid,mid,idx){const yr=getYear(yid);if(!yr.checklist)yr.checklist={};if(!yr.checklist[mid])yr.checklist[mid]={topics:[],done:{}};yr.checklist[mid].done[idx]=!yr.checklist[mid].done[idx];persist();const sp=document.getElementById(`sp-${yid}-checklist`);const openCards=sp?[...sp.querySelectorAll('.card.open')].map(c=>c.id):[];if(sp)sp.innerHTML=buildChecklist(yr);restoreOpenCards(openCards,'.cl-mod-body');}
function clExpandAll(yid){document.querySelectorAll(`#sp-${yid}-checklist .card`).forEach(c=>{c.classList.add('open');const body=c.querySelector('.cl-mod-body');if(body)body.style.display='block';const chev=c.querySelector('.chevron');if(chev)chev.style.transform='rotate(180deg)';});}
function clCollapseAll(yid){document.querySelectorAll(`#sp-${yid}-checklist .card`).forEach(c=>{c.classList.remove('open');const body=c.querySelector('.cl-mod-body');if(body)body.style.display='none';const chev=c.querySelector('.chevron');if(chev)chev.style.transform='';});}
function clReset(yid){if(!confirm('Reset ALL checklist progress?'))return;const yr=getYear(yid);if(yr.checklist)Object.values(yr.checklist).forEach(cl=>{cl.done={};});persist();const sp=document.getElementById(`sp-${yid}-checklist`);if(sp)sp.innerHTML=buildChecklist(yr);showToast('Checklist reset.');}
function clResetMod(yid,mid){const yr=getYear(yid),mod=yr.modules.find(m=>m.id===mid);if(!confirm(`Reset checklist progress for ${mod.code}?`))return;if(yr.checklist&&yr.checklist[mid])yr.checklist[mid].done={};persist();const sp=document.getElementById(`sp-${yid}-checklist`);const openCards=sp?[...sp.querySelectorAll('.card.open')].map(c=>c.id):[];if(sp)sp.innerHTML=buildChecklist(yr);restoreOpenCards(openCards,'.cl-mod-body');showToast(`${mod.code} checklist reset.`);}

function restoreOpenCards(openCardIds, bodySelector) {
  openCardIds.forEach(id=>{const card=document.getElementById(id);if(!card)return;card.classList.add('open');const body=card.querySelector(bodySelector);if(body)body.style.display='block';const chev=card.querySelector('.chevron');if(chev)chev.style.transform='rotate(180deg)';});
}

function openTopicEdit(yid,mid){
  teYid=yid; teModId=mid;
  const yr=getYear(yid),mod=yr.modules.find(m=>m.id===mid);
  if(!yr.checklist) yr.checklist={};
  if(!yr.checklist[mid]) yr.checklist[mid]={topics:[],done:{}};
  document.getElementById('topicEditEyebrow').textContent=mod.code;
  document.getElementById('topicEditModName').textContent=mod.name;
  document.getElementById('topicTextarea').value=yr.checklist[mid].topics.join('\n');
  openOverlay('topicEditOverlay');
}

function saveTopics(){
  const yr=getYear(teYid);
  const topics=document.getElementById('topicTextarea').value.split('\n').map(s=>s.trim()).filter(Boolean);
  if(!yr.checklist) yr.checklist={};
  if(!yr.checklist[teModId]) yr.checklist[teModId]={topics:[],done:{}};
  yr.checklist[teModId].topics=topics;
  persist(); closeOverlayDirect('topicEditOverlay');
  const sp=document.getElementById(`sp-${teYid}-checklist`);
  if(sp) sp.innerHTML=buildChecklist(yr);
  showToast('Topics saved!');
}

function toggleCard(id){
  const card=document.getElementById(id);if(!card)return;
  const isOpen=card.classList.contains('open');
  card.classList.toggle('open',!isOpen);
  const chev=card.querySelector('.chevron');if(chev)chev.style.transform=!isOpen?'rotate(180deg)':'';
  const body=card.querySelector('.mod-body,.cl-mod-body');if(body)body.style.display=!isOpen?'block':'none';
}

function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200);}

// ── Course Picker ──
let cpSelectedDept = null, cpSelectedCourse = null, cpCurrentStep = 0;

// ALL_MODULES_DICT: keyed by module code (uppercase).
// Each entry: { name, cats, url, assessmentSplit, components: [{name, weight}] }
const ALL_MODULES_DICT = {};

function buildModuleDict() {
  if (!courseData || courseData.length === 0) return;
  courseData.forEach(c => {
    if (c.years) {
      Object.values(c.years).forEach(yr => {
        if (yr.core) {
          yr.core.forEach(m => {
            const code = m.code.toUpperCase();
            // Only set once per code (first occurrence wins, they're the same module)
            if (!ALL_MODULES_DICT[code]) {
              const asm = m.assessment || {};
              const components = [];
              if (asm.ok && asm.components && asm.components.length > 0) {
                asm.components.forEach(comp => {
                  components.push({ name: comp.name, weight: comp.weighting });
                });
              }
              ALL_MODULES_DICT[code] = {
                name: m.name,
                cats: m.credits,
                url: asm.url || '',
                assessmentSplit: asm.assessmentSplit || '',
                components,
              };
            }
          });
        }
      });
    }
  });
}

function populateDatalists() {
  let codesHtml = '';
  let namesHtml = '';
  Object.keys(ALL_MODULES_DICT).forEach(code => {
    codesHtml += `<option value="${code}">`;
    namesHtml += `<option value="${ALL_MODULES_DICT[code].name}">`;
  });
  const cl = document.getElementById('module-codes-list');
  const nl = document.getElementById('module-names-list');
  if (cl) cl.innerHTML = codesHtml;
  if (nl) nl.innerHTML = namesHtml;
}

function setupAutoFill() {
  const codeInp = document.getElementById('me-code');
  const nameInp = document.getElementById('me-name');
  const catsInp = document.getElementById('me-cats');

  if (codeInp && nameInp && catsInp) {
    codeInp.addEventListener('input', (e) => {
      const code = e.target.value.trim().toUpperCase();
      const entry = ALL_MODULES_DICT[code];
      if (entry) {
        nameInp.value = entry.name;
        catsInp.value = entry.cats;
      }
    });

    nameInp.addEventListener('input', (e) => {
      const name = e.target.value.trim().toLowerCase();
      const foundCode = Object.keys(ALL_MODULES_DICT).find(k => ALL_MODULES_DICT[k].name.toLowerCase() === name);
      if (foundCode) {
        codeInp.value = foundCode;
        catsInp.value = ALL_MODULES_DICT[foundCode].cats;
      }
    });
  }

  const compNameInp = document.getElementById('ce-name');
  if (compNameInp) {
    compNameInp.addEventListener('input', (e) => {
      const cat = inferCategory(e.target.value);
      const btn = document.querySelector(`.cat-sel-btn[data-cat="${cat}"]`);
      if (btn) selectCat(btn);
    });
  }
}

function cpGetDepts() {
  return [...new Set(courseData.map(c => c.department))].filter(Boolean).sort();
}

function cpGetCourses(dept) {
  return courseData.filter(c => c.department === dept).sort((a,b) => a.course.localeCompare(b.course));
}

function cpGetCoreModules(courseObj) {
  const result = [];
  const years = courseObj.years || {};
  const yearOrder = ['Year 1','Year 2','Year 3','Year 4','Year 5','Intermediate Year','Final Year'];
  const populatedKeys = Object.keys(years).filter(k => years[k].core && years[k].core.length > 0);
  
  populatedKeys.sort((a,b) => yearOrder.indexOf(a) - yearOrder.indexOf(b));
  
  populatedKeys.forEach(yr => {
    const mods = years[yr].core || [];
    if (mods.length) result.push({ yearLabel: yr, modules: mods });
  });
  return result;
}

function cpShowOnboarding(firstRun = false) {
  cpCurrentStep = 0;
  cpSelectedDept = null;
  cpSelectedCourse = null;
  document.getElementById('cpTitle').textContent = firstRun ? 'Set up your course' : 'Import a course';
  document.getElementById('cpSub').textContent = firstRun
    ? 'Import your core modules to set up the website, or continue manually.'
    : 'Import core modules automatically, or continue setting things up manually.';
  cpGoStep(0);
  openOverlay('coursePickerOverlay');
}

function cpGoStep(step) {
  [0,1,2,3].forEach(i => {
    const el = document.getElementById(`cp-step-${i}`);
    if (el) el.style.display = i === step ? 'block' : 'none';
  });
  cpCurrentStep = step;
  if (step === 1) cpRenderDepts();
  if (step === 2) cpRenderCourses();
  if (step === 3) cpRenderPreview();
}

function cpStartCourse() {
  closeSidebar();
  cpGoStep(1);
}

function cpRenderDepts() {
  const grid = document.getElementById('cp-dept-grid');
  if (!courseData || courseData.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1; padding:30px; text-align:center; color:var(--red); background:var(--redbg); border-radius:var(--r-md);"><b>⚠️ Course data missing!</b><br>Please make sure you created <code>data.js</code> and pasted your JSON into it as instructed.</div>';
    return;
  }
  const depts = cpGetDepts();
  grid.innerHTML = depts.map(d => {
    const safeD = d.replace(/"/g, '&quot;');
    return `<button class="cp-card ${cpSelectedDept===d?'selected':''}" data-val="${safeD}" onclick="cpPickDept(this.dataset.val)">
      <div class="cp-card-title">${d}</div>
      <div class="cp-card-sub">${cpGetCourses(d).length} course${cpGetCourses(d).length!==1?'s':''}</div>
    </button>`;
  }).join('');
}

function cpFilterDepts(q) {
  const grid = document.getElementById('cp-dept-grid');
  const depts = cpGetDepts().filter(d => d.toLowerCase().includes(q.toLowerCase()));
  grid.innerHTML = depts.length ? depts.map(d => {
    const safeD = d.replace(/"/g, '&quot;');
    return `<button class="cp-card ${cpSelectedDept===d?'selected':''}" data-val="${safeD}" onclick="cpPickDept(this.dataset.val)">
      <div class="cp-card-title">${d}</div>
      <div class="cp-card-sub">${cpGetCourses(d).length} course${cpGetCourses(d).length!==1?'s':''}</div>
    </button>`;
  }).join('') : '<div style="font-family:var(--fm);font-size:12px;color:var(--tx4);padding:12px 0">No departments match your search.</div>';
}

function cpPickDept(dept) {
  cpSelectedDept = dept;
  cpSelectedCourse = null;
  document.getElementById('cp-dept-search').value = '';
  cpGoStep(2);
}

function cpRenderCourses() {
  document.getElementById('cp-dept-label').textContent = cpSelectedDept;
  const grid = document.getElementById('cp-course-grid');
  const courses = cpGetCourses(cpSelectedDept);
  grid.innerHTML = courses.map(c => {
    const safeC = c.course.replace(/"/g, '&quot;');
    return `<button class="cp-card ${cpSelectedCourse&&cpSelectedCourse.course===c.course?'selected':''}" data-val="${safeC}" onclick="cpPickCourse(this.dataset.val)">
      <div class="cp-card-title">${c.course}</div>
      <div class="cp-card-sub">${c.qualification}</div>
      <div class="cp-card-sub" style="margin-top:2px">${c.duration}</div>
    </button>`;
  }).join('');
}

function cpFilterCourses(q) {
  const grid = document.getElementById('cp-course-grid');
  const courses = cpGetCourses(cpSelectedDept).filter(c => c.course.toLowerCase().includes(q.toLowerCase()));
  grid.innerHTML = courses.length ? courses.map(c => {
    const safeC = c.course.replace(/"/g, '&quot;');
    return `<button class="cp-card ${cpSelectedCourse&&cpSelectedCourse.course===c.course?'selected':''}" data-val="${safeC}" onclick="cpPickCourse(this.dataset.val)">
      <div class="cp-card-title">${c.course}</div>
      <div class="cp-card-sub">${c.qualification}</div>
      <div class="cp-card-sub" style="margin-top:2px">${c.duration}</div>
    </button>`;
  }).join('') : '<div style="font-family:var(--fm);font-size:12px;color:var(--tx4);padding:12px 0">No courses match your search.</div>';
}

function cpPickCourse(courseName) {
  cpSelectedCourse = courseData.find(c => c.course === courseName);
  document.getElementById('cp-course-search').value = '';
  cpGoStep(3);
}

function cpRenderPreview() {
  if (!cpSelectedCourse) return;
  const c = cpSelectedCourse;
  const yearMods = cpGetCoreModules(c);
  const totalMods = yearMods.reduce((s,y) => s + y.modules.length, 0);
  const totalWithAssessments = yearMods.reduce((s,y) => s + y.modules.filter(m => m.assessment && m.assessment.ok && m.assessment.components && m.assessment.components.length > 0).length, 0);

  document.getElementById('cp-preview-header').innerHTML = `
    <div class="cp-preview-header-title">${c.course}</div>
    <div class="cp-preview-header-meta">${c.department} · ${c.qualification} · ${c.duration}</div>
    <div style="margin-top:8px;font-family:var(--fm);font-size:10px;color:var(--accent-mid)">${totalMods} core module${totalMods!==1?'s':''} across ${yearMods.length} year${yearMods.length!==1?'s':''} · ${totalWithAssessments} with full assessment data</div>
  `;

  let listHtml = '';
  if (!yearMods.length) {
    listHtml = '<div style="font-family:var(--fm);font-size:12px;color:var(--tx4);padding:8px 0;font-style:italic">No core modules with credits found in the dataset. You can add modules manually after importing.</div>';
  } else {
    yearMods.forEach(ym => {
      listHtml += `<div class="cp-preview-yr">${ym.yearLabel}</div>`;
      ym.modules.forEach(m => {
        const asm = m.assessment || {};
        const hasComponents = asm.ok && asm.components && asm.components.length > 0;
        const splitBadge = asm.assessmentSplit
          ? `<span style="font-family:var(--fm);font-size:9px;color:var(--tx3);background:var(--bg2);padding:1px 5px;border-radius:3px;border:1px solid var(--b2);margin-left:4px">${asm.assessmentSplit}</span>`
          : '';
        const urlLink = asm.url
          ? `<a href="${asm.url}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="font-size:10px;color:var(--accent-mid);text-decoration:none;margin-left:4px" title="Open module page">🔗</a>`
          : '';
        listHtml += `<div class="cp-preview-mod">
          <span class="cp-preview-code">${m.code}</span>
          <span class="cp-preview-name">${m.name}${splitBadge}${urlLink}</span>
          <span class="cp-preview-cats">${(m.credits !== null && !isNaN(m.credits)) ? m.credits : 15} CATS</span>
          <span class="cp-preview-type">Core</span>
        </div>`;
        // Show assessment components breakdown if available
        if (hasComponents) {
          listHtml += `<div style="padding:0 0 6px 0;margin-left:0">`;
          asm.components.forEach(comp => {
            const cat = inferCategory(comp.name);
            listHtml += `<div style="display:flex;align-items:center;gap:6px;padding:2px 0 2px 16px;font-family:var(--fm);font-size:10px;color:var(--tx3)">
              ${catBadgeHtml(cat)}
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${comp.name}</span>
              <span style="color:var(--accent-mid);font-weight:600;flex-shrink:0">${comp.weighting}%</span>
            </div>`;
          });
          listHtml += `</div>`;
        }
      });
    });
  }
  document.getElementById('cp-preview-list').innerHTML = listHtml;
}

function markCourseOnboardingSeen() {
  localStorage.setItem(COURSE_ONBOARDING_KEY, '1');
}

function cpConfirm() {
  if (!cpSelectedCourse) return;
  const c = cpSelectedCourse;
  
  APP.settings.uni  = APP.settings.uni  || 'University of Warwick';
  APP.settings.dept = APP.settings.dept || c.department;
  APP.settings.code = APP.settings.code || c.course;

  const populatedKeys = Object.keys(c.years || {}).filter(k => c.years[k].core && c.years[k].core.length > 0);
  const yearOrder = ['Year 1','Year 2','Year 3','Year 4','Year 5','Intermediate Year','Final Year'];
  populatedKeys.sort((a,b) => yearOrder.indexOf(a) - yearOrder.indexOf(b));

  let durationYears = 3;
  if (c.duration) {
    const m = c.duration.match(/(\d+)\s*years?/i);
    if (m) {
      durationYears = parseInt(m[1]);
    } else {
      const dLow = c.duration.toLowerCase();
      if (dLow.includes('four') || dLow.includes('4')) durationYears = 4;
      else if (dLow.includes('five') || dLow.includes('5')) durationYears = 5;
      else if (dLow.includes('two') || dLow.includes('2')) durationYears = 2;
      else if (dLow.includes('one') || dLow.includes('1')) durationYears = 1;
    }
  }

  const numYears = Math.max(durationYears, populatedKeys.length, 1);

  APP.years = [];
  const currentCalYear = new Date().getFullYear();

  for (let i = 1; i <= numYears; i++) {
    const yid = makeId();
    const acStart = currentCalYear + (i - 1) - 1;
    APP.years.push({
      id: yid,
      label: `Year ${i}`,
      acyr: `${acStart}/${String(acStart+1).slice(-2)}`,
      modules: [],
      marks: {},
      checklist: {},
      targetGrades: {}
    });
  }
  APP.activeYear = APP.years[0].id;

  // Distribute populated years — importing full components from assessment data
  populatedKeys.forEach(yrKey => {
    let targetIdx = 0;
    if (yrKey.startsWith('Year')) {
       targetIdx = parseInt(yrKey.replace('Year ', '')) - 1;
    } else if (yrKey === 'Intermediate Year') {
       targetIdx = numYears > 3 ? 2 : 1; 
    } else if (yrKey === 'Final Year') {
       targetIdx = numYears - 1;
    }
    
    if (targetIdx < 0) targetIdx = 0;
    if (targetIdx >= numYears) targetIdx = numYears - 1;

    const appYear = APP.years[targetIdx];
    const mods = c.years[yrKey].core || [];
    
    mods.forEach(m => {
      if (appYear.modules.find(existing => existing.code === m.code)) return;
      const nid = makeId();
      const safeCats = (m.credits !== null && !isNaN(m.credits)) ? m.credits : 15;

      // Build components from assessment data
      const components = [];
      const asm = m.assessment || {};
      if (asm.ok && asm.components && asm.components.length > 0) {
        asm.components.forEach(comp => {
          components.push({
            id: makeId(),
            name: comp.name,
            weight: comp.weighting,
            category: inferCategory(comp.name),
            date: '', time: '', duration: '', location: ''
          });
        });
      }

      appYear.modules.push({
        id: nid,
        code: m.code,
        name: m.name,
        cats: safeCats,
        components,
        url: asm.url || '',
      });

      if (!appYear.checklist) appYear.checklist = {};
      appYear.checklist[nid] = { topics: [], done: {} };
    });
  });

  markCourseOnboardingSeen();
  persist();
  closeOverlayDirect('coursePickerOverlay');
  restoreAppearance();
  renderAll();
  showToast(`✓ ${cpSelectedCourse.course} imported!`);
}

function cpSkip() {
  closeSidebar();
  markCourseOnboardingSeen();
  persist();
  closeOverlayDirect('coursePickerOverlay');
  renderAll();
}

// ── Boot ──
buildModuleDict();
populateDatalists();
setupAutoFill();
loadApp();
restoreAppearance();
renderAll();

(function showCourseImportOnFirstVisit() {
  const hasSeenCourseOnboarding = localStorage.getItem(COURSE_ONBOARDING_KEY) === '1';
  const hasModules = APP.years.some(y => y.modules && y.modules.length > 0);
  const hasSettings = APP.settings.name || APP.settings.uni || APP.settings.dept;

  // Show the course import as the first thing on a brand-new website visit.
  if (!hasSeenCourseOnboarding && !hasModules && !hasSettings) {
    setTimeout(() => cpShowOnboarding(true), 300);
  }
})();