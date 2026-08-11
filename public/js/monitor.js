
function togglePantallaCompleta() {
    const contenedorTablero = document.getElementById('contenedor-tablero');
    const icono = document.getElementById('icono-expandir');
    contenedorTablero.classList.toggle('fullscreen-mode');
    if (contenedorTablero.classList.contains('fullscreen-mode')) {
        icono.classList.remove('fa-expand');
        icono.classList.add('fa-compress'); 
    } else {
        icono.classList.remove('fa-compress');
        icono.classList.add('fa-expand'); 
    }
}

async function actualizarListasPits() {
    try {
        const respuesta = await fetch('/api/monitor-pits');
        const datos = await respuesta.json();
        
        if(datos.status === 'success') {
            renderizarLista('lista-salientes', datos.salientes);
            renderizarLista('lista-actual', datos.en_pista);
            renderizarLista('lista-proximos', datos.proximos);
        } else {
            console.error("Error desde el servidor:", datos.mensaje);
        }

    } catch (error) {
        console.error("Error al obtener los datos de pits:", error);
    }
}

function renderizarLista(idElemento, arrayPilotos) {
    const lista = document.getElementById(idElemento);
    lista.innerHTML = ''; // Limpiamos la lista

    if (arrayPilotos.length === 0) {
        lista.innerHTML = '<li class="loading">Ningún piloto en esta fase</li>';
        return;
    }

    arrayPilotos.forEach(piloto => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>👤 ${piloto.alias}</span> 
            <span>🏎️ Kart: ${piloto.kart}</span>
        `;
        lista.appendChild(li);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    actualizarListasPits();
    setInterval(actualizarListasPits, 5000);
});
document.addEventListener('keydown', function(event) {
    if (event.key === "Escape" || event.key === "Esc") {
        const contenedorTablero = document.getElementById('contenedor-tablero');
        const icono = document.getElementById('icono-expandir');
        
        if (contenedorTablero && contenedorTablero.classList.contains('fullscreen-mode')) {
            contenedorTablero.classList.remove('fullscreen-mode');
            icono.classList.remove('fa-compress');
            icono.classList.add('fa-expand');
        }
    }
});




// =========================================
// 1. PANTALLA DE CARGA (PRELOADER)
// =========================================
const minLoadingTime = 3000; // 3 segundos garantizados
const startTime = Date.now();

window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    if (!preloader) return;

    const elapsedTime = Date.now() - startTime;
    const timeToWait = Math.max(0, minLoadingTime - elapsedTime);

    setTimeout(() => {
        preloader.style.opacity = '0';
        setTimeout(() => {
            preloader.style.visibility = 'hidden';
        }, 800); 
    }, timeToWait);
});