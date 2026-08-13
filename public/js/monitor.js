
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

// 1. PANTALLA DE CARGA (PRELOADER)
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

// CRONÓMETRO Y CONTROL DE CARRERA (7 MINUTOS)
let intervaloCarrera;
let tiempoRestante = 7 * 60; // 7 minutos expresados en segundos

async function arrancarCarrera() {
    const btn = document.getElementById('btn-iniciar');
    const reloj = document.getElementById('reloj-carrera');

    try {
        // 1. Disparamos el endpoint para que MariaDB registre que empezó
        const respuesta = await fetch('/api/iniciar-carrera', { method: 'POST' });
        const json = await respuesta.json();

        if (json.status === 'success') {
            // 2. Bloqueamos el botón y cambiamos su aspecto
            btn.disabled = true;
            btn.innerText = "🏁 CARRERA EN CURSO...";
            btn.style.backgroundColor = "#555555";
            reloj.style.color = "#f8931f"; // El reloj se pone naranja

            // 3. Reiniciamos el tiempo a 7 minutos (420 segundos)
            tiempoRestante = 7 * 60;
            clearInterval(intervaloCarrera);
            
            // 4. Forzamos la actualización visual inmediata de los cuadros de abajo
            if (typeof actualizarListasPits === "function") actualizarListasPits();
            if (typeof actualizarMonitor === "function") actualizarMonitor();

            // 5. Arrancamos el descuento de 1 segundo a la vez
            intervaloCarrera = setInterval(procesarReloj, 1000);
        }
    } catch (error) {
        console.error("Error al arrancar la carrera:", error);
    }
}

async function procesarReloj() {
    const reloj = document.getElementById('reloj-carrera');
    const btn = document.getElementById('btn-iniciar');

    // CUANDO SE ACABA EL TIEMPO (LLEGA A CERO)
    if (tiempoRestante <= 0) {
        clearInterval(intervaloCarrera);
        reloj.innerText = "00:00";
        reloj.style.color = "#ffffff"; // Vuelve a blanco
        
        // Restauramos el botón
        btn.disabled = false;
        btn.innerText = "🟢 INICIAR CARRERA";
        btn.style.backgroundColor = "#b87333";

        // Avisamos a la base de datos que la carrera terminó automáticamente
        await fetch('/api/finalizar-carrera', { method: 'POST' });
        
        // Actualizamos los cuadros (los pilotos pasarán de "En Pista" a "Salientes")
        if (typeof actualizarListasPits === "function") actualizarListasPits();
        if (typeof actualizarMonitor === "function") actualizarMonitor();
        return;
    }

    // SI AÚN HAY TIEMPO, SEGUIMOS CONTANDO
    tiempoRestante--;
    
    // Cálculos matemáticos para mostrar el formato MM:SS
    const minutos = Math.floor(tiempoRestante / 60);
    const segundos = tiempoRestante % 60;
    
    // El "padStart" asegura que siempre haya 2 dígitos (ej: 06:09 en vez de 6:9)
    reloj.innerText = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
}