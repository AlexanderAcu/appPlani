import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, doc, onSnapshot, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth, signInAnonymously, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import firebaseConfig from "./firebase-config.js?v=8";

console.log('APP-PUBLIC: Loading');

marked.setOptions({ gfm: true, breaks: true });

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

console.log('APP-PUBLIC: Firebase initialized');

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const days = [
  { key:"monday", label:"Lunes", dow:1 },
  { key:"tuesday", label:"Martes", dow:2 },
  { key:"wednesday", label:"Miercoles", dow:3 },
  { key:"thursday", label:"Jueves", dow:4 },
  { key:"friday", label:"Viernes", dow:5 },
  { key:"saturday", label:"Sabado", dow:6 }
];

let cache = {};
let currentCategory = "";
let currentSubcategory = "";
let currentLevel = "";

function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    categoria: urlParams.get('categoria') || 'clase-crossfit',
    subcategoria: urlParams.get('subcategoria') || null,
    nivel: urlParams.get('nivel') || null
  };
}

function getDocumentId() {
  const params = getUrlParams();
  currentCategory = params.categoria;
  currentSubcategory = params.subcategoria;
  currentLevel = params.nivel;
  
  if (currentLevel && currentSubcategory) {
    return currentCategory + "-" + currentSubcategory + "-" + currentLevel;
  } else if (currentSubcategory) {
    return currentCategory + "-" + currentSubcategory;
  }
  return currentCategory;
}

function getCategoryTitle() {
  const params = getUrlParams();
  const titles = {
    'crossfit-atletas': 'CrossFit Atletas',
    'clase-crossfit': 'Clase CrossFit',
    'musculacion': 'Musculacion'
  };
  
  const subcategoryTitles = {
    'hipertrofia-hombres': 'Hipertrofia Hombres',
    'hipertrofia-mujeres': 'Hipertrofia Mujeres',
    'adaptacion': 'Adaptacion',
    'full-body': 'Full Body',
    'piernas-gluteos': 'Piernas y Gluteos',
    'cardio-zona-media': 'Cardio y Zona Media'
  };

  const levelTitles = {
    'nivel1': 'Nivel 1',
    'nivel2': 'Nivel 2',
    'nivel3': 'Nivel 3'
  };
  
  let title = titles[params.categoria] || 'Planificaciones';
  if (params.subcategoria) {
    title += ' - ' + (subcategoryTitles[params.subcategoria] || params.subcategoria);
  }
  if (params.nivel) {
    title += ' - ' + (levelTitles[params.nivel] || params.nivel);
  }
  return title;
}

function setCurrentMonth() {
  const el = $("#currentMonth");
  if (!el) return;
  const txt = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date());
  el.textContent = txt.charAt(0).toUpperCase() + txt.slice(1);
}

function getTodayKey() {
  const g = new Date().getDay();
  const f = days.find(d => d.dow === g);
  return f ? f.key : "monday";
}

function renderDay(dayKey) {
  $$("[data-day]").forEach(b => b.classList.remove("tab-active"));
  document.querySelector('[data-day="' + dayKey + '"]')?.classList.add("tab-active");
  const md = (cache[dayKey] || "").trim();
  const html = md ? marked.parse(md) : '<p>No hay planificacion para este dia</p>';
  $("#studentContent").innerHTML = html;
}

async function initPublicApp() {
  const titleElement = document.querySelector('.title');
  if (titleElement) {
    titleElement.textContent = getCategoryTitle();
  }

  const tabs = $("#tabs");
  tabs.innerHTML = "";
  days.forEach((d, i) => {
    const b = document.createElement("button");
    b.className = "tab" + (i === 0 ? " tab-active" : "");
    b.textContent = d.label;
    b.dataset.day = d.key;
    b.addEventListener("click", () => renderDay(d.key));
    tabs.appendChild(b);
  });

  const documentId = getDocumentId();
  const ref = doc(db, "plans", documentId);
  console.log('Loading plan:', documentId);
  
  const snap0 = await getDoc(ref);
  cache = snap0.exists() ? snap0.data() : {};
  console.log('Plan data:', cache);
  renderDay(getTodayKey());

  onSnapshot(ref, (snap) => {
    cache = snap.exists() ? snap.data() : {};
    const active = document.querySelector(".tab.tab-active")?.dataset.day || getTodayKey();
    renderDay(active);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log('APP-PUBLIC: DOMContentLoaded');
  setCurrentMonth();

  // Solo ejecutar si estamos en index.html (que tiene el login)
  const loginOverlay = document.getElementById('loginPublicOverlay');
  const dniInput = document.getElementById('dniPublicInput');
  const dniBtn = document.getElementById('dniPublicBtn');
  const dniCancel = document.getElementById('dniPublicCancel');
  const dniMsg = document.getElementById('dniPublicMsg');
  const logoutPublicBtn = document.getElementById('logoutPublicBtn');

  // Si no están los elementos de login, probablemente estamos en planificaciones.html
  // En ese caso, solo mostrar el contenido si ya está autenticado
  if (!loginOverlay || !dniBtn) {
    console.log('APP-PUBLIC: No login elements found, checking for existing auth');
    const stored = localStorage.getItem('dniAuth');
    if (stored) {
      console.log('APP-PUBLIC: User already authenticated, loading plan');
      try {
        await signInAnonymously(auth);
        const ref = doc(db, 'allowed', stored);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          initPublicApp();
        } else {
          console.warn('APP-PUBLIC: DNI not found in allowed list');
          localStorage.removeItem('dniAuth');
        }
      } catch (e) {
        console.error('APP-PUBLIC: Error restoring auth:', e);
      }
    } else {
      console.log('APP-PUBLIC: No auth found, redirecting to home');
      window.location.href = 'index.html';
    }
    return;
  }

  function showPublicMsg(msg) {
    dniMsg.textContent = msg;
    dniMsg.style.display = msg ? 'block' : 'none';
  }

  async function checkDNI(dni) {
    try {
      console.log('CHECK DNI:', dni);
      const ref = doc(db, 'allowed', dni);
      const snap = await getDoc(ref);
      console.log('DNI EXISTS:', snap.exists());
      return snap.exists();
    } catch (e) {
      console.error('ERROR checkDNI:', e.message);
      return false;
    }
  }

  function enablePublic(yes) {
    if (yes) {
      loginOverlay.style.display = 'none';
      logoutPublicBtn.style.display = 'inline-block';
    } else {
      loginOverlay.style.display = 'flex';
      logoutPublicBtn.style.display = 'none';
    }
  }

  dniBtn.addEventListener('click', async () => {
    const dni = dniInput.value.trim();
    showPublicMsg('');
    
    if (!dni || dni.length === 0) {
      console.log('DNI input empty');
      showPublicMsg('Por favor ingrese un DNI');
      return;
    }
    
    console.log('Starting login with DNI:', dni);
    dniBtn.disabled = true;
    dniBtn.textContent = 'Verificando...';
    showPublicMsg('Verificando...');
    
    try {
      console.log('LOGIN: Signing in anonymously');
      await signInAnonymously(auth);
      console.log('LOGIN: Checking DNI availability');
      const ok = await checkDNI(dni);
      
      if (ok) {
        console.log('LOGIN: DNI authorized, storing and enabling public');
        localStorage.setItem('dniAuth', dni);
        showPublicMsg('Acceso concedido! Cargando...');
        enablePublic(true);
        await initPublicApp();
      } else {
        console.log('LOGIN: DNI not authorized');
        await signOut(auth);
        showPublicMsg('DNI incorrecto. No esta autorizado para acceder.');
      }
    } catch (err) {
      console.error('LOGIN ERROR:', err.code, err.message);
      showPublicMsg('Error de conexion: ' + err.message);
    } finally {
      dniBtn.disabled = false;
      dniBtn.textContent = 'Entrar';
    }
  });

  dniCancel.addEventListener('click', () => {
    dniInput.value = '';
    showPublicMsg('');
  });

  logoutPublicBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
    } catch (e) { }
    localStorage.removeItem('dniAuth');
    enablePublic(false);
  });

  const stored = localStorage.getItem('dniAuth');
  if (stored) {
    try {
      await signInAnonymously(auth);
      const ok = await checkDNI(stored);
      if (ok) {
        enablePublic(true);
        initPublicApp();
      } else {
        localStorage.removeItem('dniAuth');
        enablePublic(false);
      }
    } catch (e) {
      console.error(e);
      enablePublic(false);
    }
  } else {
    enablePublic(false);
  }
});
