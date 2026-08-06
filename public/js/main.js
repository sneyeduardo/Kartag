document.addEventListener("DOMContentLoaded", function() {
    
    const links = document.querySelectorAll('.nav-links a');
    const indicator = document.querySelector('.nav-indicator');
    let isClickScrolling = false;

    function moveIndicator(elemento) {
        const anchoElemento = elemento.offsetWidth;
        const posicionIzquierda = elemento.offsetLeft;

        indicator.style.width = `${anchoElemento}px`;
        indicator.style.left = `${posicionIzquierda}px`;
    }

    const activeLink = document.querySelector('.nav-links a.active');
    if (activeLink) {
        moveIndicator(activeLink);
    }

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
                setTimeout(() => {
                    isClickScrolling = false;
                }, 800);

            } else if (targetId === '#') {
                e.preventDefault();
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
    
    const track = document.getElementById('leaderboard-track');
    
    if (track) {
        const slides = Array.from(track.children);
        const dots = document.querySelectorAll('#carousel-dots .dot');
        
        let currentSlide = 0;
        
        
        const slideInterval = 6000; 

        function moveToSlide(index) {
            
            slides.forEach((slide, i) => {
                slide.classList.remove('active-slide');
                if(dots[i]) dots[i].classList.remove('active');
            });
            
           
            track.style.transform = `translateX(-${index * 100}%)`;
            slides[index].classList.add('active-slide');
            if(dots[index]) dots[index].classList.add('active');
            currentSlide = index;
        }
        moveToSlide(0);
        setInterval(() => {
            let nextSlide = (currentSlide + 1) % slides.length;
            moveToSlide(nextSlide);
        }, slideInterval);
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const counters = document.querySelectorAll('.counter');
    const textBoxes = document.querySelectorAll('.text-box p');
    const section = document.querySelector('.nosotros-section');
    const animateNumbers = () => {
        counters.forEach(counter => {
            const target = +counter.getAttribute('data-target'); 
            const duration = 2000; 
            
            let startTimestamp = null;
            
            const step = (timestamp) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                
               
                counter.innerHTML = "+" + Math.floor(progress * target);
                
                if (progress < 1) {
                    window.requestAnimationFrame(step);
                }
            };
            
            window.requestAnimationFrame(step);
        });
    };

    
    const animateTexts = () => {
        textBoxes.forEach((box, index) => {
            setTimeout(() => {
                box.classList.add('visible');
            }, index * 200); 
        });
    };

    
    const observerOptions = {
        root: null,
        threshold: 0.4 
    };

    const sectionObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            
            if (entry.isIntersecting) {
                animateNumbers(); 
                animateTexts();   
                observer.unobserve(entry.target); 
            }
        });
    }, observerOptions);

    
    if (section) {
        sectionObserver.observe(section);
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const accordionHeaders = document.querySelectorAll('.accordion-header');

    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            item.classList.toggle('active');
        });
    });
});

function mostrarHoraPais() {
    const reloj = document.getElementById("reloj");
    if (!reloj) return; 
    const fecha = new Date();
    const opciones = { 
        timeZone: 'America/Caracas', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: true 
    };
    const horaFormateada = fecha.toLocaleTimeString('es-VE', opciones);
    
    reloj.textContent = horaFormateada;
}

setInterval(mostrarHoraPais, 1000);
if (document.getElementById("reloj")) {
    mostrarHoraPais();
}

async function actualizarTablero() {
    const filas = document.querySelectorAll('.led-scoreboard .board-row');
    if (filas.length === 0) return; 
    
    try {
        
        const respuesta = await fetch('/api/tablero');
        const json = await respuesta.json();

        if (json.status === 'success') {
            const pilotos = json.data;
            
            pilotos.forEach((piloto, index) => {
                const fila = filas[index];
                
                if (fila) {
                    const posCell = fila.querySelector('.pos-cell'); 
                    const nameCell = fila.querySelector('.name-cell');
                    const lapCell = fila.querySelector('.lap-cell');
                    const timeCell = fila.querySelector('.time-cell');
                    const kartBadge = fila.querySelector('.kart-cell .kart-badge');
                    const bestCell = fila.querySelector('.best-cell');

                
                    if (posCell) posCell.textContent = index + 1;
                    if (nameCell) nameCell.textContent = piloto.nombre_piloto;
                    if (lapCell) lapCell.textContent = piloto.vueltas_completadas;
                    if (timeCell) timeCell.textContent = piloto.ultima_vuelta;
                    if (kartBadge) kartBadge.textContent = piloto.numero_kart;
                    if (bestCell) bestCell.textContent = piloto.mejor_vuelta;
                }
            });
        } else {
            console.error("Mensaje de la API:", json.mensaje);
        }
    } catch (error) {
        console.error("Error al obtener datos de telemetría:", error);
    }
}

if (document.querySelector('.led-scoreboard')) {
    actualizarTablero(); 
    setInterval(actualizarTablero, 2000); 
}
