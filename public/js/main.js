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

// =========================================
// INICIALIZACIÓN PRINCIPAL DE LA PÁGINA
// =========================================
document.addEventListener("DOMContentLoaded", () => {
    
    // --- A. NAVBAR Y SCROLLSPY ---
    const links = document.querySelectorAll('.nav-links a');
    const indicator = document.querySelector('.nav-indicator');
    let isClickScrolling = false;

    function moveIndicator(elemento) {
        if (!indicator || !elemento) return;
        indicator.style.width = `${elemento.offsetWidth}px`;
        indicator.style.left = `${elemento.offsetLeft}px`;
    }

    const activeLink = document.querySelector('.nav-links a.active');
    if (activeLink) moveIndicator(activeLink);

    links.forEach(link => {
        link.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId && targetId.startsWith('#') && targetId !== '#') {
                e.preventDefault(); 
                isClickScrolling = true;
                
                links.forEach(l => l.classList.remove('active'));
                this.classList.add('active');
                moveIndicator(this);
                
                const targetSection = document.querySelector(targetId);
                if (targetSection) {
                    targetSection.scrollIntoView({ behavior: 'smooth' });
                }
                
                setTimeout(() => { isClickScrolling = false; }, 800);
            }
        });
    });

    window.addEventListener('scroll', () => {
        if (isClickScrolling) return; 

        let currentId = '';
        const sections = document.querySelectorAll('section[id]');
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (window.scrollY >= (sectionTop - 150)) {
                currentId = section.getAttribute('id');
            }
        });

        if (currentId) {
            links.forEach(link => {
                if (link.getAttribute('href') === `#${currentId}` && !link.classList.contains('active')) {
                    links.forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                    moveIndicator(link);
                }
            });
        }
    });

    // --- B. CARRUSEL PROMOCIONAL (WIDGET HERO) ---
    const promoTrack = document.getElementById('promo-track');
    if (promoTrack) {
        const slides = Array.from(promoTrack.children);
        const dots = document.querySelectorAll('#promo-dots .dot');
        let currentSlide = 0;
        const slideInterval = 5000; // Cambia cada 5 segundos

        function moveToSlide(index) {
            slides.forEach((slide, i) => {
                slide.classList.remove('active-slide');
                if(dots[i]) dots[i].classList.remove('active');
            });
            
            promoTrack.style.transform = `translateX(-${index * 100}%)`;
            slides[index].classList.add('active-slide');
            if(dots[index]) dots[index].classList.add('active');
            currentSlide = index;
        }

        // Hacer que los puntitos sean clicables
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => moveToSlide(index));
        });

        // Bucle automático
        setInterval(() => {
            let nextSlide = (currentSlide + 1) % slides.length;
            moveToSlide(nextSlide);
        }, slideInterval);
    }

    // --- C. ESTADÍSTICAS Y ANIMACIÓN DE TEXTOS (NOSOTROS) ---
    const counters = document.querySelectorAll('.counter');
    const textBoxes = document.querySelectorAll('.text-box p');
    const nosotrosSection = document.querySelector('.nosotros-section');

    const animateNumbers = () => {
        counters.forEach(counter => {
            const target = +counter.getAttribute('data-target'); 
            const duration = 2000; 
            let startTimestamp = null;
            
            const step = (timestamp) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                counter.innerHTML = "+" + Math.floor(progress * target);
                if (progress < 1) window.requestAnimationFrame(step);
            };
            window.requestAnimationFrame(step);
        });
    };

    const animateTexts = () => {
        textBoxes.forEach((box, index) => {
            setTimeout(() => { box.classList.add('visible'); }, index * 200); 
        });
    };

    if (nosotrosSection) {
        const sectionObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateNumbers(); 
                    animateTexts();   
                    observer.unobserve(entry.target); 
                }
            });
        }, { threshold: 0.4 });
        sectionObserver.observe(nosotrosSection);
    }

    // --- D. ANIMACIONES FLOTANTES AL HACER SCROLL ---
    const fadeElements = document.querySelectorAll('.fade-on-scroll');
    const fadeObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target); 
            }
        });
    }, { threshold: 0.15 });

    fadeElements.forEach(el => fadeObserver.observe(el));

    // --- E. ACORDEÓN DEL FOOTER ---
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            item.classList.toggle('active');
        });
    });

}); // FIN DEL DOMContentLoaded

// =========================================
// 3. FUNCIONES GLOBALES (RELOJ Y TELEMETRÍA)
// =========================================
function mostrarHoraPais() {
    const reloj = document.getElementById("reloj");
    if (!reloj) return; 
    const opciones = { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
    reloj.textContent = new Date().toLocaleTimeString('es-VE', opciones);
}

setInterval(mostrarHoraPais, 1000);
if (document.getElementById("reloj")) mostrarHoraPais();

async function actualizarTablero() {
    const filas = document.querySelectorAll('.led-scoreboard .board-row');
    if (filas.length === 0) return; 
    
    try {
        const respuesta = await fetch('/api/tablero');
        const json = await respuesta.json();

        if (json.status === 'success') {
            json.data.forEach((piloto, index) => {
                const fila = filas[index];
                if (fila) {
                    const selectors = {
                        '.pos-cell': index + 1,
                        '.name-cell': piloto.nombre_piloto,
                        '.lap-cell': piloto.vueltas_completadas,
                        '.time-cell': piloto.ultima_vuelta,
                        '.kart-cell .kart-badge': piloto.numero_kart,
                        '.best-cell': piloto.mejor_vuelta
                    };
                    
                    for (const [selector, value] of Object.entries(selectors)) {
                        const el = fila.querySelector(selector);
                        if (el) el.textContent = value;
                    }
                }
            });
        }
    } catch (error) {
        console.error("Error al obtener datos de telemetría:", error);
    }
}

if (document.querySelector('.led-scoreboard')) {
    actualizarTablero(); 
    setInterval(actualizarTablero, 2000); 
}
// =========================================
// ACTUALIZACIÓN DINÁMICA: TOP 3 PILOTOS (VITRINA)
// =========================================
async function actualizarMiniTablero() {
    // Seleccionamos las 3 filas del carrusel promocional
    const filasTop = document.querySelectorAll('.mini-leaderboard .leaderboard-item');
    if (filasTop.length === 0) return; 
    
    try {
        // Hacemos la petición a tu API de Node.js (MariaDB)
        const respuesta = await fetch('http://localhost:3000/api/top-pilotos');
        const json = await respuesta.json();

        if (json.status === 'success') {
            const topPilotos = json.data;
            
            topPilotos.forEach((piloto, index) => {
                const fila = filasTop[index];
                
                if (fila) {
                    // Seleccionamos los elementos de esta fila específica
                    const nameCell = fila.querySelector('.driver-name');
                    const pointsCell = fila.querySelector('.points');
                    const photoImg = fila.querySelector('.driver-photo');

                    // Añadimos una pequeña animación de desvanecimiento para el cambio de datos
                    fila.style.opacity = '0';
                    
                    setTimeout(() => {
                        // Inyectamos los datos de MariaDB al HTML
                        if (nameCell) nameCell.textContent = piloto.nombre_piloto;
                        
                        // Formateamos el tiempo agregando la 's' de segundos
                        if (pointsCell) pointsCell.textContent = piloto.mejor_tiempo + 's';
                        
                        // Actualizamos la foto del piloto
                        if (photoImg && piloto.foto_url) photoImg.src = piloto.foto_url;

                        // Devolvemos la visibilidad a la fila
                        fila.style.transition = 'opacity 0.5s ease';
                        fila.style.opacity = '1';
                    }, 300); // 300ms de retraso para el efecto visual
                }
            });
        }
    } catch (error) {
        console.error("Error al obtener el Top 3 de pilotos:", error);
    }
}

// Ejecutar la función apenas cargue la página
if (document.querySelector('.mini-leaderboard')) {
    actualizarMiniTablero(); 
    
    // Que se actualice cada 1 minuto (60000 ms) para mantener los récords frescos
    setInterval(actualizarMiniTablero, 60000); 
}