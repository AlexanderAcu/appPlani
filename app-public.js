// app-public.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, doc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import firebaseConfig from "./firebase-config.js?v=8"; // export default

marked.setOptions({ gfm: true, breaks: true });

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const days = [
  { key:"monday", label:"Lunes", dow:1 },
  { key:"tuesday", label:"Martes", dow:2 },
  { key:"wednesday", label:"Miércoles", dow:3 },
  { key:"thursday", label:"Jueves", dow:4 },
  { key:"friday", label:"Viernes", dow:5 },
  { key:"saturday", label:"Sábado", dow:6 }, // sábado
];

let cache = {};
let currentCategory = "";
let currentSubcategory = "";
let currentLevel = "";

// Obtener parámetros de la URL
function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    categoria: urlParams.get('categoria') || 'clase-crossfit', // default
    subcategoria: urlParams.get('subcategoria') || null,
    nivel: urlParams.get('nivel') || null
  };
}

// Generar ID del documento basado en categoría, subcategoría y nivel
function getDocumentId() {
  const params = getUrlParams();
  currentCategory = params.categoria;
  currentSubcategory = params.subcategoria;
  currentLevel = params.nivel;
  
  if (currentLevel && currentSubcategory) {
    return `${currentCategory}-${currentSubcategory}-${currentLevel}`;
  } else if (currentSubcategory) {
    return `${currentCategory}-${currentSubcategory}`;
  }
  return currentCategory;
}

// Obtener título para mostrar en la página
function getCategoryTitle() {
  const params = getUrlParams();
  const titles = {
    'crossfit-atletas': 'CrossFit Atletas',
    'clase-crossfit': 'Clase CrossFit',
    'musculacion': 'Musculación'
  };
  
  const subcategoryTitles = {
    'hipertrofia-hombres': 'Hipertrofia Hombres',
    'hipertrofia-mujeres': 'Hipertrofia Mujeres',
    'adaptacion': 'Adaptación',
    'full-body': 'Full Body',
    'piernas-gluteos': 'Piernas y Glúteos',
    'cardio-zona-media': 'Cardio y Zona Media',
  };

  const levelTitles = {
    'nivel1': 'Nivel 1',
    'nivel2': 'Nivel 2',
    'nivel3': 'Nivel 3'
  };
  
  let title = titles[params.categoria] || 'Planificaciones';
  if (params.subcategoria) {
    title += ` - ${subcategoryTitles[params.subcategoria] || params.subcategoria}`;
  }
  if (params.nivel) {
    title += ` - ${levelTitles[params.nivel] || params.nivel}`;
  }
  return title;
}

function setCurrentMonth(){
  const el=$("#currentMonth"); if(!el) return;
  const txt=new Intl.DateTimeFormat("es-AR",{month:"long",year:"numeric"}).format(new Date());
  el.textContent = txt.charAt(0).toUpperCase()+txt.slice(1);
}

function getTodayKey(){
  const g=new Date().getDay();
  const f=days.find(d=>d.dow===g);
  return f? f.key : "monday";
}
function resaltarPalabras(texto) {
  const palabras = [
    "Activación",
    "Activación Específica",
    "Bloque De Fuerza",
    "Gimnásticos",
    "Gimnástico",
    "Bloque De Levantamiento",
    "Accesorios",
    "WOD",
    "WOD 1",
    "WOD 2",
    "Acondicionamiento",
    "Nota:",
    "Amrap",
    "AMRAP",
    "EMOM",
    "For time",
    "Descanso",
  ];
  palabras.forEach(palabra => {
    const regex = new RegExp(palabra, "gi");
    texto = texto.replace(regex, match =>
      `<b style="text-transform:uppercase; text-decoration:underline;">${match}</b>`
    );
  });
  return texto;
}
function renderDay(dayKey){
  $$("[data-day]").forEach(b=>b.classList.remove("tab-active"));
  document.querySelector(`[data-day="${dayKey}"]`)?.classList.add("tab-active");
  const md=(cache[dayKey]||"").trim();
  const html = md ? resaltarPalabras(marked.parse(md))
                  : `<p class="text-slate-500">Todavía no hay planificación cargada para <b>${days.find(d=>d.key===dayKey)?.label||dayKey}</b>.</p>`;
  $("#studentContent").innerHTML = html;
}

document.addEventListener("DOMContentLoaded", async ()=>{
  console.log("[public] projectId:", firebaseConfig.projectId);
  setCurrentMonth();
  
  // Actualizar título de la página
  const titleElement = document.querySelector('.title');
  if (titleElement) {
    titleElement.textContent = getCategoryTitle();
  }
  
  // Agregar botón de volver si no estamos en la página principal
  const params = getUrlParams();
  if (params.categoria !== 'clase-crossfit' || params.subcategoria || params.nivel) {
    const header = document.querySelector('header .container');
    if (header && !header.querySelector('.back-link')) {
      const backLink = document.createElement('a');
      
      // Determinar la URL de retorno
      if (params.nivel && params.subcategoria) {
        backLink.href = `niveles.html?categoria=${params.categoria}&subcategoria=${params.subcategoria}`;
        backLink.textContent = '← Volver a Niveles';
      } else if (params.subcategoria) {
        backLink.href = 'musculacion.html';
        backLink.textContent = '← Volver a Musculación';
      } else {
        backLink.href = 'index.html';
        backLink.textContent = '← Volver al inicio';
      }
      
      backLink.className = 'btn-secondary back-link text-sm sm:text-base';
      
      // Texto responsive
      const fullText = backLink.textContent;
      const shortText = fullText.replace('Volver a ', '← ').replace('Volver al ', '← ');
      backLink.innerHTML = `
        <span class="hidden sm:inline">${fullText}</span>
        <span class="sm:hidden">${shortText}</span>
      `;
      
      header.appendChild(backLink);
    }
  }

  // Tabs
  const tabs=$("#tabs"); tabs.innerHTML="";
  days.forEach((d,i)=>{
    const b=document.createElement("button");
    b.className=`tab${i===0?" tab-active":""}`; b.textContent=d.label; b.dataset.day=d.key;
    b.addEventListener("click",()=>renderDay(d.key));
    tabs.appendChild(b);
  });

  // Primera lectura + realtime con el documento correcto
  const documentId = getDocumentId();
  const ref = doc(db,"plans", documentId);
  console.log("[public] Using document ID:", documentId);
  
  const snap0 = await getDoc(ref);
  cache = snap0.exists()? snap0.data() : {};
  console.log("[public] first getDoc:", cache);
  renderDay(getTodayKey());

  onSnapshot(ref, (snap)=>{
    cache = snap.exists()? snap.data() : {};
    console.log("[public] onSnapshot:", cache);
    const active = document.querySelector(".tab.tab-active")?.dataset.day || getTodayKey();
    renderDay(active);
  }, (err)=>{
    console.error("[public] onSnapshot error:", err);
  });

  // MODAL YOUTUBE
  const modalEjercicio = document.getElementById('modalEjercicio');
  const btnBuscarEjercicio = document.getElementById('buscarEjercicioBtn');
  const btnCerrarModal = modalEjercicio.querySelector('.close-modal');
  const btnBuscarVideo = document.getElementById('btnBuscarVideo');
  const inputEjercicio = document.getElementById('inputEjercicio');
  const videoResult = document.getElementById('videoResult');

  btnBuscarEjercicio.addEventListener('click', () => {
    modalEjercicio.classList.add('active');
    inputEjercicio.value = '';
    videoResult.innerHTML = '';
    inputEjercicio.focus();
  });
  btnCerrarModal.addEventListener('click', () => {
    modalEjercicio.classList.remove('active');
    videoResult.innerHTML = '';
  });
  modalEjercicio.addEventListener('click', (e) => {
    if (e.target === modalEjercicio) {
      modalEjercicio.classList.remove('active');
      videoResult.innerHTML = '';
    }
  });

  btnBuscarVideo.addEventListener('click', async () => {
    const query = inputEjercicio.value.trim();
    if (!query) return;
    videoResult.innerHTML = '<p>Buscando videos...</p>';
    // API YouTube Data v3
    const apiKey = 'AIzaSyDYBhaDEo1Cgnr8Uh-l2cyoA7_roGOozJg';
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=3&q=${encodeURIComponent(query)}&key=${apiKey}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        // Muestra miniaturas y títulos para elegir
        videoResult.innerHTML = data.items.map((item, idx) => {
          const videoId = item.id.videoId;
          const title = item.snippet.title;
          const thumb = item.snippet.thumbnails.medium.url;
          return `
            <div class="video-choice" style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;">
              <img src="${thumb}" alt="${title}" style="width:120px;border-radius:8px;cursor:pointer;" data-video="${videoId}">
              <button class="btn-primary select-video" data-video="${videoId}" style="margin:0;">Ver</button>
              <span style="flex:1;">${title}</span>
            </div>
          `;
        }).join('');
        //seleccionar video
        videoResult.querySelectorAll('.select-video, img[data-video]').forEach(el => {
          el.addEventListener('click', e => {
            const vid = el.getAttribute('data-video');
            videoResult.innerHTML = `<iframe width="100%" height="250" src="https://www.youtube.com/embed/${vid}" frameborder="0" allowfullscreen></iframe>`;
          });
        });
      } else {
        videoResult.innerHTML = '<p>No se encontró ningún video para ese ejercicio.</p>';
      }
    } catch (err) {
      videoResult.innerHTML = '<p>Error al buscar el video.</p>';
    }
  });
  inputEjercicio.addEventListener('keydown', e => {
    if (e.key === 'Enter') btnBuscarVideo.click();
  });
  //FIN MODAL YOUTUBE

  // CALCULADORA DE PORCENTAJE
  const modalCalculadora = document.getElementById('modalCalculadora');
  const btnAbrirCalculadora = document.getElementById('abrirCalculadoraBtn');
  const btnCerrarCalculadora = modalCalculadora.querySelector('.close-modal');
  const btnCalcularPorcentaje = document.getElementById('btnCalcularPorcentaje');
  const inputPesoMax = document.getElementById('inputPesoMax');
  const inputPorcentaje = document.getElementById('inputPorcentaje');
  const resultadoPorcentaje = document.getElementById('resultadoPorcentaje');

  btnAbrirCalculadora.addEventListener('click', () => {
    modalCalculadora.classList.add('active');
    inputPesoMax.value = '';
    inputPorcentaje.value = '';
    resultadoPorcentaje.textContent = '';
    inputPesoMax.focus();
  });
  btnCerrarCalculadora.addEventListener('click', () => {
    modalCalculadora.classList.remove('active');
  });
  modalCalculadora.addEventListener('click', (e) => {
    if (e.target === modalCalculadora) modalCalculadora.classList.remove('active');
  });
  btnCalcularPorcentaje.addEventListener('click', () => {
    const peso = parseFloat(inputPesoMax.value);
    const porc = parseFloat(inputPorcentaje.value);
    if (isNaN(peso) || isNaN(porc) || peso <= 0 || porc <= 0 || porc > 100) {
      resultadoPorcentaje.textContent = 'Por favor, ingresa valores válidos.';
      return;
    }
    const resultado = (peso * porc / 100).toFixed(2);
    resultadoPorcentaje.textContent = `El peso a usar es: ${resultado} kg`;
  });
  // FIN CALCULADORA DE PORCENTAJE
});
