
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js?v=6";

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const days = [
  { key:"monday", label:"Lunes" },
  { key:"tuesday", label:"Martes" },
  { key:"wednesday", label:"Miércoles" },
  { key:"thursday", label:"Jueves" },
  { key:"friday", label:"Viernes" },
  { key:"saturday", label:"Sábado" }, // sábado
];

let cache = {};
let selectedDay = "";
let currentCategory = "";
let currentSubcategory = "";
let currentLevel = "";

// Obtener el ID del documento según categoría, subcategoría y nivel
function getDocumentId() {
  if (currentLevel && currentSubcategory) {
    return `${currentCategory}-${currentSubcategory}-${currentLevel}`;
  } else if (currentSubcategory) {
    return `${currentCategory}-${currentSubcategory}`;
  }
  return currentCategory;
}

// Obtener nombre legible de categoría
function getCategoryDisplayName() {
  const names = {
    'clase-crossfit': 'Clase CrossFit',
    'crossfit-atletas': 'CrossFit Atletas',
    'musculacion': 'Musculación'
  };
  return names[currentCategory] || currentCategory;
}

// Obtener nombre legible de subcategoría
function getSubcategoryDisplayName() {
  const names = {
    'hipertrofia-hombres': 'Hipertrofia Hombres',
    'hipertrofia-mujeres': 'Hipertrofia Mujeres',
    'adaptacion': 'Adaptación',
    'full-body': 'Full Body',
    'piernas-gluteos': 'Piernas y Glúteos',
    'cardio-zona-media': 'Cardio y Zona Media',
  };
  return names[currentSubcategory] || currentSubcategory;
}

function setCurrentMonth(){
  const el=$("#currentMonth"); if(!el) return;
  const txt=new Intl.DateTimeFormat("es-AR",{month:"long",year:"numeric"}).format(new Date());
  el.textContent = txt.charAt(0).toUpperCase()+txt.slice(1);
}
// Obtener nombre legible de nivel
function getLevelDisplayName() {
  const names = {
    'nivel1': 'Nivel 1',
    'nivel2': 'Nivel 2', 
    'nivel3': 'Nivel 3'
  };
  return names[currentLevel] || currentLevel;
}

function setUIEnabled(on){
  $("#planTextarea").disabled = !on;
  $("#saveBtn").disabled      = !on;
}

function updateCategoryDisplay() {
  $("#categoryLabel").textContent = currentCategory ? getCategoryDisplayName() : "—";
  
  if (currentSubcategory) {
    $("#subcategoryLabel").style.display = "inline";
    $("#subcategoryText").textContent = getSubcategoryDisplayName();
    
    if (currentLevel) {
      $("#levelLabel").style.display = "inline";
      $("#levelText").textContent = getLevelDisplayName();
    } else {
      $("#levelLabel").style.display = "none";
    }
  } else {
    $("#subcategoryLabel").style.display = "none";
    $("#levelLabel").style.display = "none";
  }
}

function selectDay(dayKey){
  selectedDay = dayKey || "";
  $$("[data-day]").forEach(b=>b.classList.remove("tab-active"));
  if(dayKey) document.querySelector(`[data-day="${dayKey}"]`)?.classList.add("tab-active");
  $("#dayKey").value = dayKey || "";
  $("#dayLabel").textContent = dayKey ? (days.find(d=>d.key===dayKey)?.label||dayKey) : "—";
  if(!dayKey){ $("#planTextarea").value=""; setUIEnabled(false); return; }
  
  // Solo habilitar si hay categoría seleccionada
  if (!currentCategory) {
    $("#planTextarea").value = "";
    setUIEnabled(false);
    return;
  }
  
  $("#planTextarea").value = (cache[dayKey]||"").trim();
  setUIEnabled(true);
}

async function loadPlans(){
  if (!currentCategory) return;
  
  // Si es musculación, requiere subcategoría y nivel
  if (currentCategory === 'musculacion' && (!currentSubcategory || !currentLevel)) {
    cache = {};
    return;
  }
  
  const documentId = getDocumentId();
  const ref = doc(db,"plans", documentId);
  const snap = await getDoc(ref);
  cache = snap.exists()? snap.data() : {};
  console.log(`[admin] Loaded plans for ${documentId}:`, cache);
}

async function savePlan(){
  if(!selectedDay){ toast("Elegí un día primero"); return; }
  if(!currentCategory){ toast("Elegí una categoría primero"); return; }
  if(currentCategory === 'musculacion' && !currentSubcategory){ 
    toast("Elegí una subcategoría de musculación primero"); return; 
  }
  if(currentCategory === 'musculacion' && !currentLevel){ 
    toast("Elegí un nivel de entrenamiento primero"); return; 
  }
  
  const pin = localStorage.getItem("cf_pin") || prompt("Ingresá tu PIN para guardar:");
  if(!pin){ toast("Guardado cancelado"); return; }
  localStorage.setItem("cf_pin", pin);

  try{
    const content = $("#planTextarea").value;
    const documentId = getDocumentId();
    const ref = doc(db,"plans", documentId);
    await setDoc(ref, { [selectedDay]: content, updatedAt: Date.now(), _pin: pin }, { merge:true });
    cache[selectedDay] = content;
    
    let categoryName = getCategoryDisplayName();
    if (currentSubcategory) {
      categoryName += ` - ${getSubcategoryDisplayName()}`;
    }
    if (currentLevel) {
      categoryName += ` - ${getLevelDisplayName()}`;
    }
    
    toast(`Guardado (${categoryName}) — ${days.find(d=>d.key===selectedDay)?.label||selectedDay}`);
  }catch(e){
    console.error("Error Firestore:", e);
    toast("Error al guardar en Firestore (PIN/reglas/config)");
  }
}

function toast(msg){
  const t=document.createElement("div");
  t.className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-sky-600 text-white px-4 py-2 rounded-xl shadow-lg";
  t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),1800);
}

document.addEventListener("DOMContentLoaded", async ()=>{
  setCurrentMonth();

  // Tabs
  const tabs=$("#tabs");
  (days).forEach(d=>{
    const b=document.createElement("button");
    b.className="tab"; b.textContent=d.label; b.dataset.day=d.key;
    b.addEventListener("click",()=>selectDay(d.key));
    tabs.appendChild(b);
  });
  
  // Event listeners para selects
  $("#categorySelect")?.addEventListener("change", async (e) => {
    currentCategory = e.target.value;
    $("#currentCategory").value = currentCategory;
    
    // Mostrar/ocultar subcategoría según la categoría
    const subcategoryContainer = $("#subcategoryContainer");
    const levelContainer = $("#levelContainer");
    
    if (currentCategory === 'musculacion') {
      subcategoryContainer.style.display = "flex";
      currentSubcategory = ""; // Reset subcategoría
      currentLevel = ""; // Reset nivel
      $("#subcategorySelect").value = "";
      $("#levelSelect").value = "";
      levelContainer.style.display = "none";
    } else {
      subcategoryContainer.style.display = "none";
      levelContainer.style.display = "none";
      currentSubcategory = "";
      currentLevel = "";
    }
    
    updateCategoryDisplay();
    cache = {}; // Limpiar cache
    selectDay(""); // Reset día seleccionado
    
    // Cargar planes si no es musculación
    if (currentCategory && currentCategory !== 'musculacion') {
      await loadPlans();
    }
  });
  
  $("#subcategorySelect")?.addEventListener("change", async (e) => {
    currentSubcategory = e.target.value;
    $("#currentSubcategory").value = currentSubcategory;
    
    // Mostrar/ocultar nivel según subcategoría
    const levelContainer = $("#levelContainer");
    if (currentSubcategory) {
      levelContainer.style.display = "flex";
      currentLevel = ""; // Reset nivel
      $("#levelSelect").value = "";
    } else {
      levelContainer.style.display = "none";
      currentLevel = "";
    }
    
    updateCategoryDisplay();
    cache = {};
    selectDay("");
  });
  
  $("#levelSelect")?.addEventListener("change", async (e) => {
    currentLevel = e.target.value;
    $("#currentLevel").value = currentLevel;
    updateCategoryDisplay();
    
    if (currentLevel) {
      await loadPlans();
      // Si había un día seleccionado, refrescar su contenido
      if (selectedDay) {
        selectDay(selectedDay);
      }
    } else {
      cache = {};
      selectDay("");
    }
  });
  
  $("#daySelect")?.addEventListener("change", e=> selectDay(e.target.value));

  // Inicializar estado
  selectDay("");
  updateCategoryDisplay();
  $("#saveBtn").addEventListener("click", savePlan);

  // Atajo Ctrl/Cmd+S para guardar
  document.addEventListener("keydown",(e)=>{
    const isSave=(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s";
    if(isSave){ e.preventDefault(); $("#saveBtn").click(); }
  });
});
