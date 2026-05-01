/**
 * main.js - Sistema de Gestión de Taller Central (Firebase Cloud v2.0)
 */

// 1. Importaciones de la versión 12.12.1
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-storage.js";

// 2. TUS credenciales exactas de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBDoCi9pfNP8pj3MAyfmDiHuqGHb9naPrA",
    authDomain: "elzuco-vault-73760.firebaseapp.com",
    databaseURL: "https://elzuco-vault-73760-default-rtdb.firebaseio.com",
    projectId: "elzuco-vault-73760",
    storageBucket: "elzuco-vault-73760.firebasestorage.app",
    messagingSenderId: "68119814899",
    appId: "1:68119814899:web:8b84cc9c2cb4ec46f6cd86",
    measurementId: "G-V0ZDJ4QZF5"
};

// 3. Inicializar los servicios de Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let registrosActuales = [];

// --- GESTIÓN DE AUTENTICACIÓN ---
const loginForm = document.getElementById('login-form');
const authContainer = document.getElementById('auth-container');

loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        window.showToast("✅ Acceso Concedido", "success");
    } catch (error) {
        window.showToast("❌ Credenciales incorrectas", "error");
    }
};

document.getElementById('btn-logout').onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    if (user) {
        authContainer.classList.add('hidden');
        initApp();
    } else {
        authContainer.classList.remove('hidden');
    }
});

// --- INICIALIZACIÓN DE LA APP ---
function initApp() {
    initTabs();
    initDatePickers();
    initModals();
    initFilters();
    setupEditableList('tipos');
    setupEditableList('marcas');
    document.getElementById("year").innerText = new Date().getFullYear();

    // Sincronización en Tiempo Real con Firestore
    const q = query(collection(db, "registros"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        registrosActuales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        loadRegistros();
    });
}

// --- NAVEGACIÓN Y PESTAÑAS ---
function initTabs() {
    const tabIngreso = document.getElementById('tab-ingreso');
    const tabRegistro = document.getElementById('tab-registro');
    const contentIngreso = document.getElementById('ingreso-tab');
    const contentRegistro = document.getElementById('registro-tab');

    tabIngreso.onclick = () => {
        contentIngreso.classList.replace('hidden', 'block');
        contentRegistro.classList.replace('block', 'hidden');
        tabIngreso.classList.add('bg-blue-600');
        tabRegistro.classList.remove('bg-blue-600');
    };

    tabRegistro.onclick = () => {
        contentRegistro.classList.replace('hidden', 'block');
        contentIngreso.classList.replace('block', 'hidden');
        tabRegistro.classList.add('bg-blue-600');
        tabIngreso.classList.remove('bg-blue-600');
        loadRegistros();
    };
}

// --- CARGA DE DATOS Y ESTADÍSTICAS ---
function loadRegistros() {
    const tableBody = document.getElementById('registros-tabla');
    const totalEl = document.getElementById('total-general');
    if (!tableBody) return;

    const hoy = new Date().toISOString().split('T')[0];
    const mesActual = hoy.substring(0, 7);

    // Estadísticas
    const pendientes = registrosActuales.filter(r => r.estado === 'sin-reparar').length;
    const reparadosHoy = registrosActuales.filter(r => r.estado === 'reparado' && r.fechaEntrega === hoy).length;
    const entregadosMes = registrosActuales.filter(r => r.estado === 'entregado' && (r.fechaEntrega || '').startsWith(mesActual)).length;

    if (document.getElementById('stat-pendientes')) document.getElementById('stat-pendientes').innerText = pendientes;
    if (document.getElementById('stat-reparados')) document.getElementById('stat-reparados').innerText = reparadosHoy;
    if (document.getElementById('stat-entregados')) document.getElementById('stat-entregados').innerText = entregadosMes;

    // Filtros
    const filtrados = filterRegistros(registrosActuales);
    let sumaTotal = 0;

    tableBody.innerHTML = filtrados.map(reg => {
        if (reg.estado === 'entregado') sumaTotal += parseFloat(reg.precioReal || 0);

        const codigoUnico = `TC-${reg.id.substring(0, 4).toUpperCase()}`;

        return `
        <tr class="hover:bg-slate-50 border-b transition-colors">
            <td class="py-4 px-3">
                <span class="text-[10px] font-black text-blue-600 bg-blue-50 px-1 rounded">${codigoUnico}</span><br>
                <strong>${reg.tipo}</strong><br><span class="text-[9px] text-slate-400 uppercase">${reg.marca}</span>
            </td>
            <td class="py-4 px-3">
            ${reg.nombreCliente}<br>
            <span class="text-blue-500 font-bold text-[10px] uppercase">${reg.ciudad || 'Cuenca'}</span><br>
            <span class="text-slate-500 font-bold text-[10px]"><i class="fas fa-phone mr-1"></i>${reg.telefonoCliente || 'N/A'}</span>
            </td>
            <td class="py-4 px-3 text-[10px]">ING: ${reg.fechaIngreso}${reg.fechaEntrega ? `<br><span class="text-green-600 font-bold">ENT: ${reg.fechaEntrega}</span>` : ''}</td>
            <td class="py-4 px-3 font-mono text-blue-600 font-bold">
                <div onclick="window.editarPrecio('${reg.id}', '${reg.precioReal}')" class="cursor-pointer hover:bg-blue-50 p-1 rounded">
                    $${parseFloat(reg.precioReal || 0).toFixed(2)}
                </div>
            </td>
            <td class="py-4 px-3">${getEstadoBadge(reg.estado)}</td>
            <td class="py-4 px-3 text-center">
                <div class="flex justify-center gap-2">
                    <button onclick="window.reimprimirTicket('${reg.id}')" class="text-slate-400 hover:text-blue-600"><i class="fas fa-print"></i></button>
                    <button onclick="window.mostrarDetalles('${reg.id}')" class="text-slate-400 hover:text-indigo-600"><i class="fas fa-eye"></i></button>
                    <button onclick="window.abrirModalEstado('${reg.id}', '${reg.estado}')" class="text-slate-400 hover:text-green-600"><i class="fas fa-sync-alt"></i></button>
                </div>
            </td>
            <td class="py-4 px-3 text-center">
                ${reg.foto ? `<img src="${reg.foto}" class="h-10 w-10 rounded-lg object-cover mx-auto cursor-pointer border" onclick="window.open('${reg.foto}', '_blank')">` : '<i class="fas fa-camera text-slate-200"></i>'}
            </td>
        </tr>`;
    }).join('');

    if (totalEl) totalEl.innerText = `$${sumaTotal.toFixed(2)}`;
}

// --- GUARDAR NUEVO REGISTRO ---
document.getElementById('form-ingreso').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.submitter;
    btn.disabled = true;
    window.showToast("⏳ Subiendo a la nube...", "success");

    const telefono = document.getElementById('telefono-cliente').value.trim();
    if (telefono.length !== 10) {
        window.showToast("⚠️ El teléfono debe tener 10 dígitos", "error");
        btn.disabled = false;
        return;
    }

    const file = document.getElementById('foto-aparato').files[0];
    let fotoUrl = "";

    try {
        if (file) {
            const storageRef = ref(storage, `fotos/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            fotoUrl = await getDownloadURL(storageRef);
        }

        const nuevoRegistro = {
            tipo: document.getElementById('tipo-aparato').value,
            marca: document.getElementById('marca-aparato').value,
            serie: document.getElementById('serie-equipo').value.trim(),
            accesorios: document.getElementById('accesorios-equipo').value.trim(),
            ciudad: document.getElementById('ciudad-cliente').value,
            precioReal: document.getElementById('precio-real').value,
            fechaIngreso: document.getElementById('fecha-ingreso').value,
            nombreCliente: document.getElementById('nombre-cliente').value,
            telefonoCliente: telefono,
            descripcion: document.getElementById('descripcion-problema').value,
            estado: 'sin-reparar',
            foto: fotoUrl,
            timestamp: new Date()
        };

        const docRef = await addDoc(collection(db, "registros"), nuevoRegistro);
        nuevoRegistro.id = docRef.id;

        window.showToast("✅ Registro Guardado", "success");
        window.generarTicketPDF(nuevoRegistro);
        e.target.reset();
        document.getElementById('tab-registro').click();
    } catch (err) {
        console.error(err);
        window.showToast("❌ Error al guardar", "error");
    } finally {
        btn.disabled = false;
    }
};

// --- ACTUALIZAR ESTADOS Y PRECIOS ---
document.getElementById('btn-guardar-estado').onclick = async () => {
    const id = document.getElementById('registro-id').value;
    const estado = document.getElementById('select-estado').value;
    const docRef = doc(db, "registros", id);
    const updates = { estado: estado };

    if (estado === 'entregado' || estado === 'reparado') {
        updates.fechaEntrega = new Date().toISOString().split('T')[0];
    }

    try {
        await updateDoc(docRef, updates);
        window.showToast("✅ Estado Actualizado", "success");
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    } catch (e) {
        window.showToast("❌ Error al actualizar", "error");
    }
};

window.editarPrecio = async (id, actual) => {
    const nuevo = prompt("Modificar precio final ($):", actual);
    if (nuevo !== null && nuevo !== actual) {
        const docRef = doc(db, "registros", id);
        try {
            await updateDoc(docRef, { precioReal: nuevo });
            window.showToast("✅ Precio modificado", "success");
        } catch (error) {
            window.showToast("❌ Error al modificar", "error");
        }
    }
};

// --- FUNCIONES GLOBALES DE UI ---
window.abrirModalEstado = (id, actual) => {
    document.getElementById('registro-id').value = id;
    document.getElementById('select-estado').value = actual;
    document.getElementById('modal-estado').style.display = 'flex';
};

window.mostrarDetalles = (id) => {
    const r = registrosActuales.find(i => i.id === id);
    if (!r) return;
    document.getElementById('detalle-tipo').innerText = r.tipo;
    document.getElementById('detalle-marca').innerText = r.marca;
    document.getElementById('detalle-serie').innerText = r.serie || 'N/A';
    document.getElementById('detalle-cliente').innerText = r.nombreCliente;
    document.getElementById('detalle-descripcion').innerText = r.descripcion;
    const imgC = document.getElementById('detalle-imagen-container');
    if (r.foto) {
        document.getElementById('detalle-foto').src = r.foto;
        imgC.classList.remove('hidden');
    } else {
        imgC.classList.add('hidden');
    }
    document.getElementById('modal-detalles').style.display = 'flex';
    if (document.getElementById('detalle-accesorios')) {
        document.getElementById('detalle-accesorios').innerText = r.accesorios || 'Ninguno';
    }
};

window.reimprimirTicket = (id) => {
    const reg = registrosActuales.find(r => r.id === id);
    if (reg) window.generarTicketPDF(reg);
};

window.generarTicketPDF = (reg) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: [80, 180] });
    const uid = `TC-${reg.id.substring(0, 4).toUpperCase()}`;

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 80, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("TALLER CENTRAL", 40, 12, { align: "center" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("SERVICIO TÉCNICO ESPECIALIZADO", 40, 18, { align: "center" });
    doc.text("Cuenca - ECUADOR", 40, 22, { align: "center" });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`ORDEN: ${uid}`, 40, 35, { align: "center" });
    doc.line(10, 37, 70, 37);

    doc.setFontSize(8);
    doc.text("DATOS DEL CLIENTE", 10, 45);
    doc.setFont("helvetica", "normal");
    doc.text(`Cliente: ${reg.nombreCliente.toUpperCase()}`, 10, 50);
    doc.text(`Teléfono: ${reg.telefonoCliente}`, 10, 55);
    doc.text(`Ciudad: ${reg.ciudad || 'Cuenca'}`, 10, 60);

    doc.setFont("helvetica", "bold");
    doc.text("ESPECIFICACIONES", 10, 70);
    doc.setLineWidth(0.1);
    doc.line(10, 71, 70, 71);
    doc.setFont("helvetica", "normal");
    doc.text(`Equipo: ${reg.tipo}`, 10, 76);
    doc.text(`Marca: ${reg.marca}`, 10, 81);
    doc.text(`S/N: ${reg.serie}`, 10, 86);
    doc.text(`Accesorios: ${reg.accesorios || 'Ninguno'}`, 10, 91);

    doc.setFont("helvetica", "bold");
    doc.setFillColor(241, 245, 249);
    doc.rect(10, 98, 60, 20, 'F');
    doc.text("DIAGNÓSTICO:", 12, 103);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    const desc = doc.splitTextToSize(reg.descripcion, 55);
    doc.text(desc, 12, 108);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`COSTO: $${parseFloat(reg.precioReal).toFixed(2)}`, 40, 130, { align: "center" });

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("__________________________", 40, 150, { align: "center" });
    doc.text("FIRMA DEL CLIENTE", 40, 154, { align: "center" });

    doc.setFontSize(6);
    const legal = doc.splitTextToSize("Nota: Equipos no retirados después de 60 días se considerarán abandonados.", 60);
    doc.text(legal, 40, 165, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.text("¡GRACIAS POR SU CONFIANZA!", 40, 175, { align: "center" });

    doc.save(`Ticket_${uid}.pdf`);
};

window.showToast = (m, t) => {
    const el = document.getElementById('toast');
    if (!el) return;
    el.innerText = m;
    el.className = `toast show ${t === 'success' ? 'bg-slate-900' : 'bg-red-600'} text-white p-4 rounded-xl fixed top-5 right-5 z-[100] shadow-lg`;
    setTimeout(() => el.classList.remove('show'), 3000);
};

// --- UTILIDADES SECUNDARIAS ---
function filterRegistros(regs) {
    const s = document.getElementById('search-input')?.value.toLowerCase() || '';
    const e = document.getElementById('filtro-estado')?.value || '';
    return regs.filter(r => (r.nombreCliente.toLowerCase().includes(s) || r.tipo.toLowerCase().includes(s)) && (!e || r.estado === e));
}

function getEstadoBadge(e) {
    const st = { 'sin-reparar': 'bg-red-100 text-red-700', 'reparado': 'bg-amber-100 text-amber-700', 'entregado': 'bg-green-100 text-green-700' };
    const tx = { 'sin-reparar': 'PENDIENTE', 'reparado': 'LISTO', 'entregado': 'ENTREGADO' };
    return `<span class="px-2 py-1 rounded-lg text-[9px] font-bold ${st[e] || 'bg-slate-100'}">${tx[e] || e}</span>`;
}

function setupEditableList(type) {
    const btn = document.getElementById(`btn-agregar-${type}`);
    const input = document.getElementById(`nueva-${type === 'tipos' ? 'tipo' : 'marca'}`);
    const select = document.getElementById(type === 'tipos' ? 'tipo-aparato' : 'marca-aparato');

    if (btn) {
        btn.onclick = () => {
            const val = input.value.trim();
            if (val) {
                select.add(new Option(val, val));
                input.value = '';
                window.showToast(`✅ ${val} agregado`, "success");
            }
        };
    }
}

function initDatePickers() {
    flatpickr('#fecha-ingreso', { locale: 'es', dateFormat: 'Y-m-d', defaultDate: 'today' });
    flatpickr('#filtro-fecha', { locale: 'es', dateFormat: 'Y-m-d', onChange: () => loadRegistros() });
}

function initModals() {
    document.getElementById('btn-editar-tipos').onclick = () => document.getElementById('modal-tipos').style.display = 'flex';
    document.getElementById('btn-editar-marcas').onclick = () => document.getElementById('modal-marcas').style.display = 'flex';
    document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'));
}

function initFilters() {
    ['search-input', 'filtro-estado'].forEach(id => document.getElementById(id)?.addEventListener('input', () => loadRegistros()));
}
