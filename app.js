import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, updateDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-storage.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDEJP8rURTn0pYWy5iIfM87JmjXdRTZ15g",
    authDomain: "elzuco-vault-73760.firebaseapp.com",
    projectId: "elzuco-vault-73760",
    storageBucket: "elzuco-vault-73760.firebasestorage.app",
    messagingSenderId: "68119814899",
    appId: "1:68119814899:web:3ee8b0f0a145dcadf6cd86"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

let dbEjercicios = [];
let dbMaterias = [];
let isAdmin = false;
let materiaFiltro = 'Todas';

// --- Navegación Móvil ---
const btnToggle = document.getElementById('toggle-sidebar');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');

const toggleMenu = () => {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
};

btnToggle.addEventListener('click', toggleMenu);
overlay.addEventListener('click', toggleMenu);

// --- Seguridad y Control de Sesión ---
onAuthStateChanged(auth, (user) => {
    isAdmin = !!user;

    document.querySelectorAll('.admin-controls').forEach(el => el.classList.toggle('d-none', !isAdmin));
    document.getElementById('btnAdmin').classList.toggle('d-none', isAdmin);
    document.getElementById('btnLogout').classList.toggle('d-none', !isAdmin);

    if (!isAdmin) {
        const panelAdmin = document.getElementById('panelAdmin');
        if (panelAdmin && panelAdmin.classList.contains('show')) {
            const bsCollapse = bootstrap.Collapse.getInstance(panelAdmin) || new bootstrap.Collapse(panelAdmin, { toggle: false });
            bsCollapse.hide();
        }
        document.getElementById('uploadForm').reset();
        document.getElementById('formMateria').reset();
        document.getElementById('file-preview-container').innerHTML = '';
    }
    renderizarTodo();
});

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
        pdf: 'bi-file-earmark-pdf-fill text-danger',
        xlsx: 'bi-file-earmark-excel-fill text-success', xls: 'bi-file-earmark-excel-fill text-success', csv: 'bi-file-earmark-spreadsheet-fill text-success',
        dwg: 'bi-pencil-square text-warning', dxf: 'bi-pencil-square text-warning',
        zip: 'bi-file-zip-fill text-secondary', rar: 'bi-file-zip-fill text-secondary',
        png: 'bi-image-fill text-info', jpg: 'bi-image-fill text-info', jpeg: 'bi-image-fill text-info',
        py: 'bi-filetype-py text-dark', docx: 'bi-file-earmark-word-fill text-primary', doc: 'bi-file-earmark-word-fill text-primary'
    };
    return map[ext] || 'bi-file-earmark-fill text-muted';
}

function mostrarToast(msg, bg = "bg-dark") {
    const toast = document.getElementById('liveToast');
    document.getElementById('toastMsg').innerHTML = msg;
    toast.className = `toast align-items-center text-white border-0 shadow-lg ${bg}`;
    new bootstrap.Toast(toast).show();
}

// --- CRUD Materias ---
async function cargarMaterias() {
    const snap = await getDocs(collection(db, "materias"));
    dbMaterias = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    document.getElementById('menu-materias').innerHTML = dbMaterias.map(m => `
        <a class="nav-link" onclick="filtrar('${m.nombre}')"><i class="bi bi-chevron-right small me-2"></i> ${m.nombre}</a>
    `).join('');

    const opciones = dbMaterias.map(m => `<option>${m.nombre}</option>`).join('');
    document.getElementById('selectMat').innerHTML = opciones;

    const editMat = document.getElementById('editMat');
    if (editMat) editMat.innerHTML = opciones;

    document.getElementById('lista-materias-borrar').innerHTML = dbMaterias.map(m => `
        <div class="d-flex justify-content-between align-items-center mb-2 p-2 bg-light border rounded-3">
            <span class="small fw-bold">${m.nombre}</span>
            <button class="btn btn-sm text-danger p-0" onclick="borrarMateria('${m.id}')"><i class="bi bi-x-circle-fill"></i></button>
        </div>
    `).join('');
}

document.getElementById('formMateria').onsubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    await addDoc(collection(db, "materias"), { nombre: document.getElementById('nombreMat').value });
    e.target.reset();
    mostrarToast("<i class='bi bi-tag-fill me-2'></i>Materia agregada", "bg-success");
    cargarMaterias();
};

window.borrarMateria = async (id) => {
    if (confirm("¿Eliminar materia?")) {
        await deleteDoc(doc(db, "materias", id));
        cargarMaterias();
    }
};

// --- CRUD Ejercicios ---
async function cargarEjercicios() {
    const q = query(collection(db, "ejercicios"), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    dbEjercicios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarTarjetas(materiaFiltro);
}

document.getElementById('uploadForm').onsubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
        mostrarToast("No tienes permisos", "bg-danger");
        return;
    }
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.innerHTML = "<span class='spinner-border spinner-border-sm me-2'></span>Subiendo...";

    try {
        const archivos = document.getElementById('archivosSubidos').files;
        const procesados = [];
        for (let file of archivos) {
            const path = `vault/${Date.now()}_${file.name}`;
            const sRef = ref(storage, path);
            await uploadBytes(sRef, file);
            procesados.push({ nombre: file.name, url: await getDownloadURL(sRef), storagePath: path });
        }
        await addDoc(collection(db, "ejercicios"), {
            titulo: document.getElementById('tit').value,
            materia: document.getElementById('selectMat').value,
            descripcion: document.getElementById('desc').value,
            fecha: new Date().toLocaleDateString('es-ES'),
            timestamp: Date.now(),
            archivos: procesados
        });
        e.target.reset();
        document.getElementById('file-preview-container').innerHTML = '';
        bootstrap.Collapse.getInstance(document.getElementById('panelAdmin')).hide();
        mostrarToast("<i class='bi bi-cloud-check-fill me-2'></i>Publicado exitosamente", "bg-success");
        cargarEjercicios();
    } catch (err) {
        mostrarToast("Error al subir", "bg-danger");
    } finally {
        btn.disabled = false; btn.innerText = "Subir a la Nube";
    }
};

window.eliminarEjercicio = async (id) => {
    if (!confirm("¿Eliminar registro permanentemente?")) return;
    const item = dbEjercicios.find(x => x.id === id);
    for (let f of item.archivos) await deleteObject(ref(storage, f.storagePath)).catch(() => { });
    await deleteDoc(doc(db, "ejercicios", id));
    mostrarToast("<i class='bi bi-trash-fill me-2'></i>Registro eliminado", "bg-danger");
    cargarEjercicios();
};

window.prepararEdicion = (id) => {
    const item = dbEjercicios.find(x => x.id === id);
    if (!item) return;
    document.getElementById('editId').value = item.id;
    document.getElementById('editTit').value = item.titulo;
    document.getElementById('editMat').value = item.materia;
    document.getElementById('editDesc').value = item.descripcion;
    new bootstrap.Modal(document.getElementById('editModal')).show();
};

document.getElementById('editForm').onsubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    const id = document.getElementById('editId').value;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    try {
        await updateDoc(doc(db, "ejercicios", id), {
            titulo: document.getElementById('editTit').value,
            materia: document.getElementById('editMat').value,
            descripcion: document.getElementById('editDesc').value
        });
        bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
        mostrarToast("<i class='bi bi-pencil-square me-2'></i>Actualizado", "bg-success");
        cargarEjercicios();
    } catch (err) { mostrarToast("Error al actualizar", "bg-danger"); }
    finally { btn.disabled = false; }
};

// ============================================================================
// NUEVO: VISOR INTEGRADO DE ARCHIVOS EN LA MISMA PÁGINA
// ============================================================================
window.abrirVisor = function (url, nombre) {
    const ext = nombre.split('.').pop().toLowerCase();
    const titulo = document.getElementById('visorTitulo');
    const contenido = document.getElementById('visorContenido');
    const btnDescargar = document.getElementById('btnDescargarVisor');

    // Configurar Modal
    titulo.innerHTML = `<i class="bi ${getFileIcon(nombre)} me-2"></i> ${nombre}`;
    btnDescargar.href = url;

    // Configurar el visor según el tipo de archivo
    let html = '';

    // 1. Visor de Imágenes
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
        html = `<div class="d-flex align-items-center justify-content-center h-100 p-3">
                    <img src="${url}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px;">
                </div>`;
    }
    // 2. Visor de Documentos de Office (Usando Google Docs Viewer)
    else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
        const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
        html = `<iframe src="${viewerUrl}" width="100%" height="100%" frameborder="0"></iframe>`;
    }
    // 3. Visor de PDF y Archivos de Código
    else if (['pdf', 'py', 'js', 'html', 'css', 'json', 'txt'].includes(ext)) {
        html = `<iframe src="${url}" width="100%" height="100%" frameborder="0" style="background: white;"></iframe>`;
    }
    // 4. Formatos NO compatibles web (ZIP, DWG, RAR...)
    else {
        html = `
        <div class="d-flex flex-column align-items-center justify-content-center h-100 text-center p-5">
            <i class="bi ${getFileIcon(nombre)} display-1 text-muted mb-4 opacity-50"></i>
            <h4 class="fw-bold text-dark mb-2">Vista previa no disponible</h4>
            <p class="text-muted mb-4">El formato de este archivo (.${ext.toUpperCase()}) no se puede previsualizar directamente en el navegador.</p>
            <a href="${url}" target="_blank" download class="btn btn-accent rounded-pill px-5 py-2 fw-bold">
                <i class="bi bi-cloud-arrow-down-fill me-2"></i>Descargar Archivo Seguro
            </a>
        </div>`;
    }

    contenido.innerHTML = html;
    new bootstrap.Modal(document.getElementById('visorModal')).show();
};


window.renderizarTarjetas = (filtro = materiaFiltro, busqueda = '') => {
    materiaFiltro = filtro;
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    const term = busqueda.toLowerCase();

    const filtrados = dbEjercicios.filter(i =>
        (filtro === 'Todas' || i.materia === filtro) &&
        (i.titulo.toLowerCase().includes(term) || i.descripcion.toLowerCase().includes(term))
    );

    if (filtrados.length === 0) {
        grid.innerHTML = `<div class="col-12 text-center py-5 mt-4"><i class="bi bi-folder2-open display-1 text-muted opacity-25"></i><h5 class="text-muted mt-3 fw-bold">Sin resultados en esta categoría</h5></div>`;
        return;
    }

    filtrados.forEach(i => {
        const bgClass = "bg-light text-dark border";

        // MODIFICADO: Ahora los botones llaman a la función abrirVisor() en lugar de redirigir
        const links = i.archivos.map(f => `
            <a onclick="abrirVisor('${f.url}', '${f.nombre}')" class="badge-archivo" style="cursor: pointer;" title="Previsualizar ${f.nombre}">
                <i class="bi ${getFileIcon(f.nombre)} me-2"></i> ${f.nombre}
            </a>
        `).join('');

        grid.innerHTML += `
        <div class="col-12 col-md-6 col-xxl-4">
            <div class="card exercise-card-pro h-100 p-4">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <span class="badge ${bgClass} rounded-pill px-3 py-2 shadow-sm">${i.materia}</span>
                    ${isAdmin ? `
                        <div>
                            <button class="btn btn-sm btn-outline-primary border-0 me-1" onclick="prepararEdicion('${i.id}')" title="Editar"><i class="bi bi-pencil-square"></i></button>
                            <button class="btn btn-sm btn-outline-danger border-0" onclick="eliminarEjercicio('${i.id}')" title="Borrar"><i class="bi bi-trash3-fill"></i></button>
                        </div>
                    ` : ''}
                </div>
                <h5 class="fw-bold text-dark mb-2">${i.titulo}</h5>
                <p class="text-muted small mb-4 flex-grow-1" style="line-height:1.6">${i.descripcion}</p>
                <div class="mb-3 d-flex flex-wrap">${links}</div>
                <div class="mt-auto pt-3 border-top d-flex justify-content-between align-items-center small text-muted">
                    <span class="fw-medium"><i class="bi bi-calendar2-event me-2"></i>${i.fecha}</span>
                    <span class="fw-bold text-dark"><i class="bi bi-person-circle me-1"></i> Elzuco_ing</span>
                </div>
            </div>
        </div>`;
    });
};

// --- Interacción ---
window.filtrar = (m) => {
    if (window.innerWidth < 992) toggleMenu();
    document.querySelectorAll('.nav-link').forEach(n => n.classList.toggle('active', n.innerText.includes(m)));
    renderizarTarjetas(m);
};

window.login = async () => {
    const btn = document.getElementById('btnIngresar');
    btn.innerHTML = "<span class='spinner-border spinner-border-sm me-2'></span>Verificando...";
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('pass').value);
        bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
        mostrarToast("<i class='bi bi-shield-lock-fill me-2'></i>Ingreso Autorizado", "bg-success");
    } catch {
        mostrarToast("<i class='bi bi-x-circle-fill me-2'></i>Credenciales incorrectas", "bg-danger");
    } finally {
        btn.innerHTML = "Ingresar";
    }
};

window.logout = async () => {
    await signOut(auth);
    mostrarToast("<i class='bi bi-power me-2'></i>Sesión cerrada de forma segura", "bg-dark");
};

function renderizarTodo() { cargarMaterias(); cargarEjercicios(); }
document.getElementById('searchInput').oninput = (e) => renderizarTarjetas(materiaFiltro, e.target.value);

document.getElementById('archivosSubidos').onchange = function () {
    const files = Array.from(this.files);
    document.getElementById('file-preview-container').innerHTML = files.map(f => `
        <div class="d-flex justify-content-between align-items-center p-2 bg-light border rounded mb-2 shadow-sm">
            <span class="small fw-semibold text-dark text-truncate" style="max-width: 80%;"><i class="bi ${getFileIcon(f.name)} fs-5 me-2"></i> ${f.name}</span>
            <span class="badge bg-secondary bg-opacity-10 text-secondary border">${(f.size / 1024).toFixed(1)} KB</span>
        </div>
    `).join('');
};

document.addEventListener("DOMContentLoaded", renderizarTodo);