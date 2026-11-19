/* ============================================
   ADG AUTOS - Script principal
   ============================================ */

/* ============================================
   CONFIGURACIÓN - EDITAR ESTOS VALORES
   ============================================ */
const CONFIG = {
    // Número de WhatsApp (sin +, sin espacios, sin guiones)
    whatsapp: '5493364529314',

    // URL pública de tu Google Sheets en formato CSV (Hoja: Stock)
    // Para obtenerla: Archivo > Compartir > Publicar en la web > Hoja1 > CSV
    sheetURL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8YoYe86ZN6ex3cUKNKKQptrGyFs-FP2NkSJL4dd23xQWgMN60_KxSNhW061Mmk8us4LD5BwYas5EV/pub?gid=0&single=true&output=csv',

    // URL pública de la pestaña "Config" del mismo Google Sheets (formato CSV)
    // Allí cargás: tasas vigentes, plazo máximo, anticipo mínimo, etc.
    // Si está vacío, se usan los valores hardcoded de FINANCIACION_DEFAULT
    sheetConfigURL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8YoYe86ZN6ex3cUKNKKQptrGyFs-FP2NkSJL4dd23xQWgMN60_KxSNhW061Mmk8us4LD5BwYas5EV/pub?gid=979011866&single=true&output=csv',

    // URL pública de la pestaña "Promos" (opcional - si no está, el carrusel no se muestra)
    // Columnas esperadas: id, nombre_promo, imagen_url, fecha_desde, fecha_hasta, activo
    // Una vez que crees la pestaña en Sheets, pegá acá la URL de publicación CSV
    sheetPromosURL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQDUo-SxSu9uSneNrB2IjTJwe3Tpd4LYctL6RkbQsfBU138-6RTomxrhBvRkkIImsQo_mCnRJESoxMN/pub?gid=1354930735&single=true&output=csv',

    // Valores por defecto (se usan hasta que publiques la pestaña Config de Sheets)
    financiacionDefault: {
        tna_prendario: 87.1,   // TNA % anual para créditos prendarios (usados)
        plazo_max_prendario: 60,
        anticipo_min: 20,      // % mínimo de anticipo
    },

    // Si la planilla falla, usar datos demo
    usarDemoSiFalla: true,

    // ID del Píxel de Meta (Administrador de eventos > Orígenes de datos > tu píxel).
    // Vacío = el píxel no se carga. Al completarlo, también lo toman las páginas de cada auto.
    metaPixelId: '2603231776861941',

    // API pública gratuita de precios de autos en Argentina (CCA + ACARA)
    // Se usa para la tasación del cliente (el precio va solo al WhatsApp de ADG)
    argAutosAPI: 'https://argautos.com/api/v1'
};

// Config runtime (se rellena desde Sheets o default)
let FINANCIACION = { ...CONFIG.financiacionDefault };

/* ============================================
   TRACKING DE EVENTOS (Google Analytics 4)
   ============================================
   Envía eventos personalizados a GA4 para medir conversiones.
   Los eventos se van a ver en Analytics > Informes > Interacción > Eventos.
   Si gtag no existe (navegador viejo o bloqueador de anuncios), no rompe nada. */
function trackEvent(nombre, params) {
    try {
        if (typeof gtag === 'function') {
            gtag('event', nombre, params || {});
        }
    } catch (e) { /* silencioso */ }
    trackPixel(nombre, params || {});
}

/* ============================================
   PÍXEL DE META (Facebook / Instagram)
   ============================================
   Se carga solo si CONFIG.metaPixelId tiene un ID. Traduce los eventos de la web
   a eventos estándar de Meta para poder medir anuncios y armar públicos:
     ver_auto → ViewContent · click_whatsapp → Contact · formularios y consultas → Lead */
const PIXEL_EVENTOS = {
    ver_auto: 'ViewContent',
    click_whatsapp: 'Contact',
    formulario_contacto: 'Lead',
    formulario_tasacion: 'Lead',
    consulta_simulacion: 'Lead',
    consulta_0km_generica: 'Lead',
    consulta_marca: 'Lead',
    consulta_otras_marcas: 'Lead'
};

function cargarPixel() {
    if (!CONFIG.metaPixelId || window.fbq) return;
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    fbq('init', CONFIG.metaPixelId);
    fbq('track', 'PageView');
}

function trackPixel(nombre, params) {
    try {
        const evento = PIXEL_EVENTOS[nombre];
        if (!evento || typeof fbq !== 'function') return;
        const datos = {};
        if (params.auto_id) {
            datos.content_ids = [String(params.auto_id)];
            datos.content_type = 'vehicle';
            const a = (typeof autos !== 'undefined') ? autos.find(x => x.id === params.auto_id) : null;
            if (a) {
                datos.content_name = `${a.marca} ${a.modelo} ${a.version}`.trim();
                if (a.precio && a.tipo !== '0km') { datos.value = a.precio; datos.currency = a.moneda === 'USD' ? 'USD' : 'ARS'; }
            }
        }
        if (params.origen) datos.content_category = params.origen;
        fbq('track', evento, datos);
    } catch (e) { /* silencioso */ }
}

cargarPixel();

/* ============================================
   DATOS DE DEMO (se usan hasta conectar Sheets)
   ============================================ */
const DATOS_DEMO = [
    {
        id: '001', marca: 'Chevrolet', modelo: 'Cruze', version: 'RS 5P',
        año: 2022, km: 31000, combustible: 'Nafta', transmision: 'Automática',
        color: 'Gris', precio_usd: 22500, tipo: 'usado', destacado: true,
        descripcion: 'Cruze RS 5 puertas impecable, único dueño, service oficial al día. Peritada y escaneada. Techo panorámico, llantas 17, tapizado cuero.',
        equipamiento: ['Techo panorámico', 'Llantas 17', 'Cuero', 'Climatizador bizona', 'CarPlay', 'Cámara retroceso', 'Sensores', 'Faros LED'],
        fotos: ['img/cruze-05.jpg', 'img/cruze-08.jpg', 'img/cruze-09.jpg', 'img/cruze-06.jpg', 'img/cruze-07.jpg', 'img/cruze-01.jpg', 'img/cruze-04.jpg', 'img/cruze-03.jpg', 'img/cruze-02.jpg'],
        disponible: true
    },
    {
        id: '002', marca: 'Toyota', modelo: 'Hilux', version: 'SRV 4x4',
        año: 2021, km: 68000, combustible: 'Diésel', transmision: 'Automática',
        color: 'Blanco', precio_usd: 32500, tipo: 'usado', destacado: true,
        descripcion: 'Hilux SRV 4x4 automática en excelente estado. Service Toyota al día.',
        equipamiento: ['4x4', 'Climatizador', 'Cuero', 'Llantas aleación', 'Sensores', 'Cámara'],
        fotos: ['https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1200&q=85'],
        disponible: true
    },
    {
        id: '003', marca: 'Volkswagen', modelo: 'Taos', version: 'Comfortline',
        año: 2026, km: 0, combustible: 'Nafta', transmision: 'Automática',
        color: 'Plata', precio_usd: 0, tipo: '0km', destacado: true,
        descripcion: 'Taos 0km disponible en varias versiones. Financiación oficial. Entrega de tu usado como parte de pago.',
        equipamiento: ['Todos los opcionales según versión', 'Financiación oficial'],
        fotos: ['https://images.unsplash.com/photo-1617469767053-d3b523a0b982?w=1200&q=85'],
        disponible: true
    },
    {
        id: '004', marca: 'Fiat', modelo: 'Cronos', version: 'Drive 1.3',
        año: 2020, km: 62000, combustible: 'Nafta', transmision: 'Manual',
        color: 'Rojo', precio_usd: 11200, tipo: 'usado', destacado: false,
        descripcion: 'Cronos Drive muy cuidado, servicios al día, ideal primer auto.',
        equipamiento: ['Aire acondicionado', 'Dirección asistida', 'Bluetooth'],
        fotos: ['https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=1200&q=85'],
        disponible: true
    },
    {
        id: '005', marca: 'Ford', modelo: 'Focus', version: 'Titanium Full',
        año: 2018, km: 89500, combustible: 'Nafta', transmision: 'Manual',
        color: 'Gris', precio_usd: 14800, tipo: 'usado', destacado: false,
        descripcion: 'Focus Titanium full, tapizado cuero, único dueño.',
        equipamiento: ['Cuero', 'Climatizador', 'Llantas 16', 'Control crucero', 'Bluetooth'],
        fotos: ['https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=1200&q=85'],
        disponible: true
    },
    {
        id: '006', marca: 'Peugeot', modelo: '208', version: 'Allure',
        año: 2026, km: 0, combustible: 'Nafta', transmision: 'Tiptronic',
        color: 'Blanco', precio_usd: 0, tipo: '0km', destacado: false,
        descripcion: 'Peugeot 208 Allure 0km, financiación disponible.',
        equipamiento: ['Climatizador', 'Pantalla táctil', 'Llantas', 'Sensores'],
        fotos: ['https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=1200&q=85'],
        disponible: true
    }
];

/* ============================================
   ESTADO GLOBAL
   ============================================ */
let autos = [];
let autosFiltrados = [];
let filtroActual = 'todos';
let currentCarouselIndex = 0;
let currentModalCar = null;
// id → { slug } de las páginas propias de cada auto (/autos/<slug>/), generadas por GitHub Actions
let paginasAutos = {};
let currentModalImageIndex = 0;

/* ============================================
   PARSER DE CSV (Google Sheets publicado)
   ============================================ */

// Normaliza links de Google Drive a formato directo para <img>
// Acepta cualquiera de estos formatos y los pasa al que funciona:
//   https://drive.google.com/file/d/ABC123/view?usp=sharing
//   https://drive.google.com/open?id=ABC123
//   https://drive.google.com/uc?export=view&id=ABC123
//   ABC123  (solo el ID)
// Si es un link externo (Unsplash, Imgur, etc), lo deja como está.
function normalizarUrlFoto(url) {
    if (!url || typeof url !== 'string') return '';
    url = url.trim();
    if (!url) return '';

    // Si NO es de Drive, lo dejo como está
    if (!url.includes('drive.google.com') && !url.match(/^[a-zA-Z0-9_-]{20,}$/)) {
        return url;
    }

    // Extraer el ID de Drive
    let id = '';

    // Formato: https://drive.google.com/file/d/ID/view...
    let m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m) id = m[1];

    // Formato: ...?id=ID  o ...&id=ID
    if (!id) {
        m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (m) id = m[1];
    }

    // Formato: solo el ID suelto
    if (!id && url.match(/^[a-zA-Z0-9_-]{20,}$/)) id = url;

    if (!id) return url; // si no pudo extraer, devolver original

    // Convertir a formato que funciona para <img src>
    // Uso el endpoint "thumbnail" que soporta mucho más tráfico que /uc?export=view
    // y no tiene los problemas de CORS ni rate limiting del endpoint antiguo
    return `https://lh3.googleusercontent.com/d/${id}=w2000`;
}

function parsearCSV(texto) {
    const lineas = [];
    let lineaActual = [];
    let campoActual = '';
    let dentroDeComillas = false;

    for (let i = 0; i < texto.length; i++) {
        const c = texto[i];
        const siguiente = texto[i + 1];

        if (c === '"') {
            if (dentroDeComillas && siguiente === '"') {
                campoActual += '"';
                i++;
            } else {
                dentroDeComillas = !dentroDeComillas;
            }
        } else if (c === ',' && !dentroDeComillas) {
            lineaActual.push(campoActual);
            campoActual = '';
        } else if ((c === '\n' || c === '\r') && !dentroDeComillas) {
            if (campoActual !== '' || lineaActual.length > 0) {
                lineaActual.push(campoActual);
                lineas.push(lineaActual);
                lineaActual = [];
                campoActual = '';
            }
            if (c === '\r' && siguiente === '\n') i++;
        } else {
            campoActual += c;
        }
    }

    if (campoActual !== '' || lineaActual.length > 0) {
        lineaActual.push(campoActual);
        lineas.push(lineaActual);
    }

    if (lineas.length < 2) return [];

    // Normalizar headers: minúscula, sin tildes, sin espacios extra
    // Esto tolera que Agustín escriba "Año", "año", "ANIO" o "anio" — todo matchea
    const normHeader = (h) => (h || '').toString().trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const headers = lineas[0].map(normHeader);

    // Mapeo de posibles nombres alternativos → nombre canónico
    // Así la planilla funciona aunque el header esté en español con tildes o sin
    const headerAlias = {
        'ano': 'año', 'anio': 'año', 'year': 'año',
        'transmision': 'transmision', 'transmisión': 'transmision'
    };
    const headersCanon = headers.map(h => headerAlias[h] || h);

    const resultado = [];

    for (let i = 1; i < lineas.length; i++) {
        const fila = lineas[i];
        if (fila.length === 1 && fila[0] === '') continue;

        const obj = {};
        headersCanon.forEach((h, idx) => {
            obj[h] = (fila[idx] || '').trim();
        });

        // Saltar filas sin ID
        if (!obj.id) continue;

        const fotos = [obj.foto_1, obj.foto_2, obj.foto_3, obj.foto_4, obj.foto_5, obj.foto_6, obj.foto_7, obj.foto_8, obj.foto_9]
            .filter(f => f && f.trim() && !f.includes('PEGAR_ID'))
            .map(normalizarUrlFoto);

        // Parser de precio tolerante a cualquier variante razonable del nombre de columna.
        // Acepta: precio_ars, precio_arg, precio_pesos, precio$, precio_$, precio, precioars, etc.
        // Prioridad: las variantes en ARS (pesos) primero, después USD, después "precio" genérico.
        let precio = 0;
        let moneda = 'ARS';

        const aliasARS = ['precio_ars', 'precio_arg', 'precio_ar', 'precio_pesos', 'precio_$', 'precio$', 'precioars', 'precioarg'];
        const aliasUSD = ['precio_usd', 'precio_dolar', 'precio_dolares', 'preciousd', 'precio_u$s'];

        // Probar variantes en ARS primero
        for (const alias of aliasARS) {
            if (obj[alias] !== undefined && obj[alias] !== '') {
                precio = parseFloat(obj[alias]) || 0;
                moneda = 'ARS';
                break;
            }
        }
        // Si no encontró ARS, probar USD
        if (precio === 0) {
            for (const alias of aliasUSD) {
                if (obj[alias] !== undefined && obj[alias] !== '') {
                    precio = parseFloat(obj[alias]) || 0;
                    moneda = 'USD';
                    break;
                }
            }
        }
        // Fallback: columna "precio" genérica (asume ARS)
        if (precio === 0 && obj.precio !== undefined && obj.precio !== '') {
            precio = parseFloat(obj.precio) || 0;
            moneda = 'ARS';
        }

        resultado.push({
            id: obj.id,
            marca: obj.marca || '',
            modelo: obj.modelo || '',
            version: obj.version || '',
            año: parseInt(obj['año']) || 0,
            km: parseInt(obj.km) || 0,
            combustible: obj.combustible || '',
            transmision: obj.transmision || '',
            color: obj.color || '',
            precio: precio,
            moneda: moneda,
            // Compatibilidad con código viejo
            precio_usd: moneda === 'USD' ? precio : 0,
            tipo: (obj.tipo || 'usado').toLowerCase(),
            destacado: (obj.destacado || '').toUpperCase() === 'SI',
            descripcion: obj.descripcion || '',
            equipamiento: (obj.equipamiento || '').split(';').map(s => s.trim()).filter(Boolean),
            fotos: fotos,
            disponible: (obj.disponible || 'SI').toUpperCase() === 'SI'
        });
    }

    return resultado.filter(a => a.disponible);
}

/* ============================================
   CARGA DE DATOS
   ============================================ */
// Lee qué autos ya tienen página propia. Si falla (o el auto es nuevo y todavía
// no se generó su página), los links usan el formato viejo /?auto=ID, que sigue funcionando.
async function cargarPaginasAutos() {
    try {
        const res = await fetch('/autos/manifest.json', { cache: 'no-cache' });
        if (!res.ok) return;
        const data = await res.json();
        paginasAutos = (data && data.autos) || {};
    } catch (e) { /* sin páginas: se usa /?auto=ID */ }
}

// Link para compartir un auto: su página propia si existe, si no /?auto=ID
function urlAuto(auto) {
    const p = paginasAutos[auto.id];
    if (p && p.slug) return `${window.location.origin}/autos/${p.slug}/`;
    return `${window.location.origin}/?auto=${encodeURIComponent(auto.id)}`;
}

async function cargarAutos() {
    if (!CONFIG.sheetURL) {
        console.log('No hay sheetURL configurada. Usando datos demo.');
        autos = DATOS_DEMO;
        return;
    }

    try {
        const res = await fetch(CONFIG.sheetURL);
        if (!res.ok) throw new Error('No se pudo cargar la planilla');
        const texto = await res.text();
        const parsed = parsearCSV(texto);
        if (parsed.length === 0) throw new Error('Planilla vacía o mal formateada');
        autos = parsed;
        console.log(`✓ Cargados ${autos.length} autos desde Google Sheets`);
    } catch (err) {
        console.error('Error cargando stock:', err);
        // Detectar si es error de CORS (típico cuando se abre el HTML local con file://)
        const esCORS = err.message && (
            err.message.includes('Failed to fetch') ||
            err.message.includes('NetworkError') ||
            err.message.includes('CORS')
        );
        if (esCORS && window.location.protocol === 'file:') {
            console.warn('⚠️ Estás abriendo el HTML directamente (file://). Google Sheets bloquea esto por seguridad. Subí el sitio a Netlify para que funcione.');
        }
        if (CONFIG.usarDemoSiFalla) {
            autos = DATOS_DEMO;
        } else {
            mostrarError();
        }
    }
}

function mostrarError() {
    const html = '<div class="error-state"><i class="fas fa-exclamation-triangle"></i><br>No pudimos cargar el stock. Intentá de nuevo en unos minutos.</div>';
    document.getElementById('destacadosTrack').innerHTML = html;
    document.getElementById('catalogGrid').innerHTML = html;
}

/* ============================================
   RENDERIZADO DE CARDS
   ============================================ */
function fotoPrincipal(auto) {
    if (auto.fotos && auto.fotos.length > 0) return auto.fotos[0];
    return 'https://via.placeholder.com/800x600/f5f5f5/8a8a8a?text=Sin+foto';
}

function formatearPrecio(precio, tipo, moneda) {
    // Los 0km siempre muestran "Consultar precio" (incluso si tienen precio cargado)
    // Esto es porque los precios de 0km varían con bonificaciones y planes del mes,
    // y es más conveniente que el cliente consulte para la cotización vigente.
    if (tipo === '0km') {
        return 'Consultar<small>Financiación disponible</small>';
    }
    if (!precio || precio === 0) {
        return 'Consultar<small>Peritada</small>';
    }
    const simbolo = moneda === 'USD' ? 'USD' : '$';
    const valor = precio.toLocaleString('es-AR');
    return `${simbolo} ${valor}<small>Peritada</small>`;
}

function formatearKm(km) {
    if (km === 0) return '0 km';
    return `${km.toLocaleString('es-AR')} km`;
}

function renderCard(auto) {
    const esNuevo = auto.tipo === '0km';
    return `
        <div class="car-card" onclick="abrirModal('${auto.id}')">
            <div class="car-image">
                <span class="car-badge ${esNuevo ? 'new' : ''}">${esNuevo ? '0km' : 'Usado'}</span>
                ${auto.destacado ? '<span class="car-badge destacado"><i class="fas fa-star"></i></span>' : ''}
                <img src="${fotoPrincipal(auto)}" alt="${auto.marca} ${auto.modelo}" loading="lazy"
                     onerror="this.src='https://via.placeholder.com/800x600/f5f5f5/8a8a8a?text=Sin+foto'">
            </div>
            <div class="car-info">
                <h3 class="car-title"><a href="${urlAuto(auto)}" onclick="event.preventDefault()">${auto.marca} ${auto.modelo}</a></h3>
                <p class="car-subtitle">${auto.version} / ${auto.transmision} / ${auto.combustible}</p>
                <div class="car-specs">
                    <span class="car-spec"><i class="far fa-calendar"></i> ${auto.año}</span>
                    <span class="car-spec"><i class="fas fa-tachometer-alt"></i> ${formatearKm(auto.km)}</span>
                    <span class="car-spec"><i class="fas fa-gas-pump"></i> ${auto.combustible}</span>
                </div>
                <div class="car-footer">
                    <div class="car-price">${formatearPrecio(auto.precio || auto.precio_usd, auto.tipo, auto.moneda || 'USD')}</div>
                    <button class="car-btn" onclick="event.stopPropagation(); abrirModal('${auto.id}')">Ver más</button>
                </div>
            </div>
        </div>
    `;
}

/* ============================================
   DESTACADOS
   ============================================ */
function renderDestacados() {
    const destacados = autos.filter(a => a.destacado);
    const lista = destacados.length > 0 ? destacados : autos.slice(0, 6);
    const track = document.getElementById('destacadosTrack');

    if (lista.length === 0) {
        track.innerHTML = '<div class="empty-state"><i class="fas fa-car"></i><p>Estamos renovando el stock. Consultá por WhatsApp.</p></div>';
        return;
    }

    track.innerHTML = lista.map(renderCard).join('');
    setupCarousel();
}

function setupCarousel() {
    const track = document.getElementById('destacadosTrack');
    const cards = track.children;
    const dotsContainer = document.getElementById('carouselDots');

    if (cards.length === 0) return;

    function getCardsPerView() {
        if (window.innerWidth <= 640) return 1;
        if (window.innerWidth <= 968) return 2;
        return 3;
    }

    function totalSlides() {
        return Math.max(0, cards.length - getCardsPerView());
    }

    function update() {
        const cardWidth = cards[0].offsetWidth + 24;
        track.style.transform = `translateX(${-currentCarouselIndex * cardWidth}px)`;
        document.querySelectorAll('#carouselDots .carousel-dot').forEach((d, i) => {
            d.classList.toggle('active', i === currentCarouselIndex);
        });
        document.getElementById('prevBtn').disabled = currentCarouselIndex === 0;
        document.getElementById('nextBtn').disabled = currentCarouselIndex >= totalSlides();
    }

    function createDots() {
        dotsContainer.innerHTML = '';
        const slides = totalSlides() + 1;
        for (let i = 0; i < slides; i++) {
            const dot = document.createElement('button');
            dot.className = 'carousel-dot';
            if (i === currentCarouselIndex) dot.classList.add('active');
            dot.onclick = () => { currentCarouselIndex = i; update(); };
            dotsContainer.appendChild(dot);
        }
    }

    document.getElementById('prevBtn').onclick = () => {
        currentCarouselIndex = Math.max(0, currentCarouselIndex - 1);
        update();
    };
    document.getElementById('nextBtn').onclick = () => {
        currentCarouselIndex = Math.min(totalSlides(), currentCarouselIndex + 1);
        update();
    };

    window.addEventListener('resize', () => {
        currentCarouselIndex = 0;
        createDots();
        update();
    });

    createDots();
    update();
}

/* ============================================
   CATÁLOGO + FILTROS
   ============================================ */
function poblarSelectorMarcas() {
    const marcas = [...new Set(autos.map(a => a.marca))].sort();
    const select = document.getElementById('f-marca');
    select.innerHTML = '<option value="">Todas</option>' +
        marcas.map(m => `<option value="${m}">${m}</option>`).join('');
}

function aplicarFiltros() {
    const texto = (document.getElementById('f-texto').value || '').toLowerCase().trim();
    const tipo = document.getElementById('f-tipo').value;
    const marca = document.getElementById('f-marca').value;
    const anio = parseInt(document.getElementById('f-anio').value) || 0;
    const precioMax = parseInt(document.getElementById('f-precio').value) || 0;

    autosFiltrados = autos.filter(a => {
        // Filtro por tab activo
        if (filtroActual !== 'todos' && a.tipo !== filtroActual) return false;

        // Filtro por tipo (selector)
        if (tipo && a.tipo !== tipo) return false;

        // Filtro por marca
        if (marca && a.marca !== marca) return false;

        // Filtro por año
        if (anio && a.año < anio) return false;

        // Filtro por precio (solo aplica si hay precio cargado)
        // Asume que los precios del filtro están en la misma moneda que el auto
        // (si manejás en ARS, el filtro está en ARS; si manejás en USD, ajustá los valores)
        const precioAuto = a.precio || a.precio_usd || 0;
        if (precioMax && precioAuto > 0 && precioAuto > precioMax) return false;

        // Filtro por texto libre
        if (texto) {
            const hay = `${a.marca} ${a.modelo} ${a.version} ${a.color} ${a.combustible}`.toLowerCase();
            if (!hay.includes(texto)) return false;
        }

        return true;
    });

    // Al aplicar filtros, colapsar de nuevo (así si filtra y quedan más de 6, vuelve a mostrar "Ver más")
    catalogoExpandido = false;
    renderCatalogo();
}

const CATALOGO_AUTOS_INICIALES = 6;
let catalogoExpandido = false;

function renderCatalogo() {
    const grid = document.getElementById('catalogGrid');
    const counter = document.getElementById('catalogCounter');

    if (autosFiltrados.length === 0) {
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>No encontramos autos con esos filtros.<br>Probá con otros filtros o consultanos por WhatsApp.</p></div>';
        counter.textContent = '0 unidades';
        // Ocultar botón si no hay autos
        const btnVerMas = document.getElementById('btnVerMas');
        if (btnVerMas) btnVerMas.style.display = 'none';
        return;
    }

    // Decidir cuántos mostrar: si está colapsado y hay más que el mínimo, mostrar solo los primeros
    const mostrarTodos = catalogoExpandido || autosFiltrados.length <= CATALOGO_AUTOS_INICIALES;
    const autosAMostrar = mostrarTodos ? autosFiltrados : autosFiltrados.slice(0, CATALOGO_AUTOS_INICIALES);

    grid.innerHTML = autosAMostrar.map(renderCard).join('');
    counter.textContent = `${autosFiltrados.length} ${autosFiltrados.length === 1 ? 'unidad' : 'unidades'}`;

    // Mostrar/ocultar botón "Ver más"
    const btnVerMas = document.getElementById('btnVerMas');
    if (btnVerMas) {
        if (mostrarTodos) {
            btnVerMas.style.display = 'none';
        } else {
            const restantes = autosFiltrados.length - CATALOGO_AUTOS_INICIALES;
            btnVerMas.style.display = 'inline-flex';
            btnVerMas.innerHTML = `<i class="fas fa-chevron-down"></i> Ver ${restantes} ${restantes === 1 ? 'auto más' : 'autos más'}`;
        }
    }
}

function expandirCatalogo() {
    catalogoExpandido = true;
    renderCatalogo();
    // Tracking
    trackEvent('catalogo_ver_mas', { total_mostrado: autosFiltrados.length });
    // Scroll suave al primer auto nuevo (el que antes estaba oculto)
    setTimeout(() => {
        const grid = document.getElementById('catalogGrid');
        const cards = grid.querySelectorAll('.car-card');
        if (cards[CATALOGO_AUTOS_INICIALES]) {
            cards[CATALOGO_AUTOS_INICIALES].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
}

function scrollToCatalogo() {
    document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' });
}

/* ============================================
   MODAL DETALLE DEL AUTO
   ============================================ */
function abrirModal(id) {
    const auto = autos.find(a => a.id === id);
    if (!auto) return;

    currentModalCar = auto;
    currentModalImageIndex = 0;

    // Tracking: usuario abre ficha detallada de un auto
    trackEvent('ver_auto', {
        auto_id: id,
        auto_marca: auto.marca,
        auto_modelo: auto.modelo,
        auto_tipo: auto.tipo
    });

    const esNuevo = auto.tipo === '0km';
    const fotos = auto.fotos.length > 0 ? auto.fotos : ['https://via.placeholder.com/800x600/f5f5f5/8a8a8a?text=Sin+foto'];

    const precioValor = auto.precio || auto.precio_usd || 0;
    const monedaSimbolo = (auto.moneda === 'USD') ? 'USD' : '$';
    // Los 0km siempre muestran "Consultar precio"
    const precio = esNuevo
        ? 'Consultar precio'
        : (precioValor > 0
            ? `${monedaSimbolo} ${precioValor.toLocaleString('es-AR')}`
            : 'Consultar precio');

    const html = `
        <div class="modal-body">
            <div class="modal-gallery">
                <div class="modal-main-image">
                    <img id="modalMainImg" src="${fotos[0]}" alt="${auto.marca} ${auto.modelo}"
                         onerror="this.src='https://via.placeholder.com/800x600/f5f5f5/8a8a8a?text=Sin+foto'">
                </div>
                ${fotos.length > 1 ? `
                    <button class="modal-gallery-arrow prev" onclick="cambiarImagenModal(-1)"><i class="fas fa-chevron-left"></i></button>
                    <button class="modal-gallery-arrow next" onclick="cambiarImagenModal(1)"><i class="fas fa-chevron-right"></i></button>
                    <div class="modal-thumbs">
                        ${fotos.map((f, i) => `
                            <div class="modal-thumb ${i === 0 ? 'active' : ''}" onclick="setImagenModal(${i})">
                                <img src="${f}" alt="Foto ${i + 1}" onerror="this.src='https://via.placeholder.com/80x60/f5f5f5/8a8a8a?text=-'">
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            <div class="modal-info">
                <div class="modal-badges">
                    <span class="modal-badge ${esNuevo ? 'new' : ''}">${esNuevo ? '0km' : 'Usado'}</span>
                    <span class="modal-badge"><i class="fas fa-clipboard-check"></i> Peritada</span>
                    <span class="modal-badge"><i class="fas fa-microchip"></i> Escaneada</span>
                </div>
                <h2 class="modal-title">${auto.marca} ${auto.modelo}</h2>
                <p class="modal-subtitle">${auto.version}</p>
                <div class="modal-price">${precio}</div>

                <div class="modal-specs">
                    <div class="modal-spec"><span class="modal-spec-label">Año</span><span class="modal-spec-value">${auto.año}</span></div>
                    <div class="modal-spec"><span class="modal-spec-label">Kilometraje</span><span class="modal-spec-value">${formatearKm(auto.km)}</span></div>
                    <div class="modal-spec"><span class="modal-spec-label">Combustible</span><span class="modal-spec-value">${auto.combustible}</span></div>
                    <div class="modal-spec"><span class="modal-spec-label">Transmisión</span><span class="modal-spec-value">${auto.transmision}</span></div>
                    ${auto.color ? `<div class="modal-spec"><span class="modal-spec-label">Color</span><span class="modal-spec-value">${auto.color}</span></div>` : ''}
                </div>

                ${auto.descripcion ? `
                    <div class="modal-description">
                        <h3>Descripción</h3>
                        <p>${auto.descripcion}</p>
                    </div>
                ` : ''}

                ${auto.equipamiento && auto.equipamiento.length > 0 ? `
                    <div class="modal-equipment">
                        <h3>Equipamiento destacado</h3>
                        <div class="modal-equipment-grid">
                            ${auto.equipamiento.map(e => `
                                <div class="modal-equipment-item"><i class="fas fa-check"></i> ${e}</div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="modal-actions">
                    <a href="${linkConsultarWA(auto)}" target="_blank" class="btn btn-dark">
                        <i class="fab fa-whatsapp"></i> Consultar por WhatsApp
                    </a>
                    <button class="btn btn-dark" onclick="usarSimulador(${precioValor}, '${auto.moneda || 'USD'}')">
                        <i class="fas fa-calculator"></i> Simular crédito
                    </button>
                    <button class="btn btn-dark" onclick="compartirAuto('${auto.id}')">
                        <i class="fas fa-share-alt"></i> Compartir
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('carModal').classList.add('active');
    document.body.style.overflow = 'hidden';

    // Actualizar URL para que sea compartible
    const url = new URL(window.location);
    url.searchParams.set('auto', auto.id);
    window.history.replaceState({}, '', url);
}

function cerrarModal() {
    document.getElementById('carModal').classList.remove('active');
    document.body.style.overflow = '';
    currentModalCar = null;

    const url = new URL(window.location);
    url.searchParams.delete('auto');
    window.history.replaceState({}, '', url);
}

function cambiarImagenModal(delta) {
    if (!currentModalCar) return;
    const fotos = currentModalCar.fotos;
    currentModalImageIndex = (currentModalImageIndex + delta + fotos.length) % fotos.length;
    setImagenModal(currentModalImageIndex);
}

function setImagenModal(idx) {
    if (!currentModalCar) return;
    currentModalImageIndex = idx;
    document.getElementById('modalMainImg').src = currentModalCar.fotos[idx];
    document.querySelectorAll('.modal-thumb').forEach((t, i) => {
        t.classList.toggle('active', i === idx);
    });
}

function linkConsultarWA(auto) {
    const anio = auto.tipo === '0km' ? '0km' : auto.año;
    const mensaje = `Hola! Me interesa el ${auto.marca} ${auto.modelo} ${auto.version} ${anio} que vi en la web: ${urlAuto(auto)}`;
    return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}

function compartirAuto(id) {
    const auto = autos.find(a => a.id === id);
    if (!auto) return;
    const url = urlAuto(auto);
    trackEvent('compartir_auto', { auto_id: id });

    if (navigator.share) {
        navigator.share({
            title: `${auto.marca} ${auto.modelo} - ADG Autos`,
            text: `Mirá este ${auto.marca} ${auto.modelo} en ADG Autos`,
            url: url
        }).catch(() => {});
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url)
            .then(() => mostrarAviso('Link copiado'))
            .catch(() => window.prompt('Copiá el link:', url));
    } else {
        window.prompt('Copiá el link:', url);
    }
}

// Aviso chico abajo de la pantalla (reemplaza a alert, que bloquea la página)
function mostrarAviso(texto) {
    let el = document.getElementById('avisoFlotante');
    if (!el) {
        el = document.createElement('div');
        el.id = 'avisoFlotante';
        el.setAttribute('role', 'status');
        el.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#0a0a0a;color:#fff;' +
            'padding:12px 20px;border-radius:8px;font-size:.9rem;font-weight:600;z-index:3000;max-width:90vw;text-align:center;' +
            'box-shadow:0 8px 30px rgba(0,0,0,.25);transition:opacity .3s;opacity:0;pointer-events:none';
        document.body.appendChild(el);
    }
    el.textContent = texto;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 3200);
}

function usarSimulador(precio, moneda) {
    // Si el precio viene en pesos, lo cargamos directo en el simulador
    if (precio > 0 && moneda === 'ARS') {
        const inputPrecio = document.getElementById('sim-precio');
        const inputCapital = document.getElementById('sim-capital');
        if (inputPrecio) inputPrecio.value = formatearNumeroMiles(precio);
        // Sugerir capital a financiar = 65% del precio (máximo permitido)
        if (inputCapital) inputCapital.value = formatearNumeroMiles(Math.round(precio * 0.65));
        calcularSimulacion();
        // Activar la pestaña de usados (que es la que tiene el simulador)
        if (typeof cambiarSimTab === 'function') cambiarSimTab('usado');
    }
    cerrarModal();
    setTimeout(() => {
        document.getElementById('simulador').scrollIntoView({ behavior: 'smooth' });
    }, 300);
}

// Cerrar modal con ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentModalCar) cerrarModal();
    if (e.key === 'ArrowLeft' && currentModalCar) cambiarImagenModal(-1);
    if (e.key === 'ArrowRight' && currentModalCar) cambiarImagenModal(1);
});

// Cerrar modal al click en overlay
document.getElementById('carModal').addEventListener('click', (e) => {
    if (e.target.id === 'carModal') cerrarModal();
});

/* ============================================
   SIMULADOR DE CRÉDITO
   ============================================ */

// Carga la configuración de financiación desde Google Sheets (pestaña Config)
async function cargarConfigFinanciacion() {
    if (!CONFIG.sheetConfigURL) {
        console.log('Sin sheetConfigURL, usando valores por defecto');
        return;
    }
    try {
        const res = await fetch(CONFIG.sheetConfigURL);
        if (!res.ok) throw new Error('No se pudo cargar config');
        const texto = await res.text();
        const lineas = texto.split(/\r?\n/);
        lineas.forEach(linea => {
            const [claveRaw, valorRaw] = linea.split(',').map(s => (s || '').trim().replace(/^"|"$/g, ''));
            if (!claveRaw || !valorRaw) return;
            // Normalizar clave (por si viene con mayúsculas o espacios)
            const clave = claveRaw.toLowerCase().trim();
            // Saltear encabezado si el cliente escribió "clave,valor"
            if (clave === 'clave' || clave === 'key') return;
            // Valor: convertir coma decimal española a punto (87,1 → 87.1)
            const valorLimpio = valorRaw.replace(/\s/g, '').replace(',', '.');
            if (FINANCIACION.hasOwnProperty(clave)) {
                const num = parseFloat(valorLimpio);
                if (!isNaN(num)) FINANCIACION[clave] = num;
            }
        });
        console.log('Config de financiación actualizada:', FINANCIACION);
        // Refrescar el display de la TNA
        const tnaDisplay = document.getElementById('sim-tna-display');
        if (tnaDisplay) {
            tnaDisplay.innerHTML = `TNA de referencia: <strong>${FINANCIACION.tna_prendario.toString().replace('.', ',')}%</strong>`;
        }
        // Recalcular el simulador por si cambió la tasa
        if (typeof calcularSimulacion === 'function') calcularSimulacion();
    } catch (err) {
        console.warn('No se pudo leer config desde Sheets, usando default:', err);
    }
}

/* ============================================
   CARRUSEL DE PROMOS MENSUALES
   ============================================ */
let promosData = [];
let promoActualIndex = 0;
let promoIntervalId = null;
const PROMO_DURACION = 3500; // 3.5 segundos por promo

// Parsea una fecha en varios formatos (DD/MM/YYYY, YYYY-MM-DD, etc.)
function parsearFechaPromo(str) {
    if (!str) return null;
    const s = str.toString().trim();
    if (!s) return null;
    // Formato DD/MM/YYYY o DD-MM-YYYY
    const matchDMY = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (matchDMY) {
        let [, d, m, y] = matchDMY;
        if (y.length === 2) y = '20' + y;
        return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }
    // Formato YYYY-MM-DD (estándar ISO)
    const matchISO = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (matchISO) {
        const [, y, m, d] = matchISO;
        return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }
    // Fallback al parser del navegador
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

async function cargarPromos() {
    const section = document.getElementById('promos-section');
    if (!section) return;

    // Si no hay URL de promos configurada, ocultar toda la sección
    if (!CONFIG.sheetPromosURL) {
        section.style.display = 'none';
        return;
    }

    try {
        const res = await fetch(CONFIG.sheetPromosURL);
        if (!res.ok) throw new Error('No se pudo cargar promos');
        const texto = await res.text();
        const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lineas.length < 2) {
            section.style.display = 'none';
            return;
        }

        // Parseo simple del CSV con tolerancia a comillas
        const parsearLinea = (linea) => {
            const celdas = [];
            let actual = '';
            let dentroComillas = false;
            for (let i = 0; i < linea.length; i++) {
                const c = linea[i];
                if (c === '"') { dentroComillas = !dentroComillas; continue; }
                if (c === ',' && !dentroComillas) { celdas.push(actual.trim()); actual = ''; continue; }
                actual += c;
            }
            celdas.push(actual.trim());
            return celdas;
        };

        const headers = parsearLinea(lineas[0]).map(h => h.toLowerCase().trim());
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        promosData = [];
        for (let i = 1; i < lineas.length; i++) {
            const celdas = parsearLinea(lineas[i]);
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = celdas[idx] || ''; });

            // Filtros de validación
            const activo = (obj.activo || '').toString().toUpperCase();
            if (activo === 'NO' || activo === 'N' || activo === 'FALSE') continue;

            const imagenUrl = normalizarUrlFoto(obj.imagen_url || obj.imagen || '');
            if (!imagenUrl) continue;

            const fechaDesde = parsearFechaPromo(obj.fecha_desde);
            const fechaHasta = parsearFechaPromo(obj.fecha_hasta);
            // Si tiene fecha_desde futura, no mostrarla aún
            if (fechaDesde && fechaDesde > hoy) continue;
            // Si tiene fecha_hasta pasada, no mostrarla
            if (fechaHasta && fechaHasta < hoy) continue;

            promosData.push({
                id: obj.id || '',
                nombre: obj.nombre_promo || obj.nombre || 'Promo',
                imagen: imagenUrl
            });
        }

        if (promosData.length === 0) {
            section.style.display = 'none';
            return;
        }

        renderizarPromos();
    } catch (err) {
        console.warn('No se pudo cargar promos:', err);
        section.style.display = 'none';
    }
}

function renderizarPromos() {
    const track = document.getElementById('promos-track');
    const dots = document.getElementById('promos-dots');
    if (!track) return;

    // Si hay 1 sola promo: no mostrar controles ni rotación
    track.innerHTML = promosData.map((p, idx) => `
        <div class="promo-slide ${idx === 0 ? 'active' : ''}" data-index="${idx}">
            <a href="${armarLinkWAPromo(p.nombre)}" target="_blank" rel="noopener" aria-label="Consultar por ${p.nombre}">
                <img src="${p.imagen}" alt="${p.nombre}" loading="lazy">
            </a>
        </div>
    `).join('');

    if (promosData.length > 1) {
        dots.innerHTML = promosData.map((_, idx) =>
            `<button class="promo-dot ${idx === 0 ? 'active' : ''}" data-index="${idx}" aria-label="Ir a promo ${idx + 1}"></button>`
        ).join('');
        dots.querySelectorAll('.promo-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                irAPromo(parseInt(dot.dataset.index));
            });
        });
        iniciarRotacionPromos();
    } else {
        dots.innerHTML = '';
        document.querySelector('.promos-controls')?.style.setProperty('display', 'none');
    }
}

function irAPromo(index) {
    if (index === promoActualIndex || index < 0 || index >= promosData.length) return;
    const slides = document.querySelectorAll('.promo-slide');
    const dots = document.querySelectorAll('.promo-dot');
    slides[promoActualIndex]?.classList.remove('active');
    dots[promoActualIndex]?.classList.remove('active');
    slides[index]?.classList.add('active');
    dots[index]?.classList.add('active');
    promoActualIndex = index;
}

function promoSiguiente() {
    const next = (promoActualIndex + 1) % promosData.length;
    irAPromo(next);
}

function promoAnterior() {
    const prev = (promoActualIndex - 1 + promosData.length) % promosData.length;
    irAPromo(prev);
}

function iniciarRotacionPromos() {
    detenerRotacionPromos();
    promoIntervalId = setInterval(promoSiguiente, PROMO_DURACION);
}

function detenerRotacionPromos() {
    if (promoIntervalId) {
        clearInterval(promoIntervalId);
        promoIntervalId = null;
    }
}

function armarLinkWAPromo(nombrePromo) {
    const mensaje = `Hola! Me interesa la promoción "${nombrePromo}" que vi en la web.`;
    return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}

function formatearPesos(monto) {
    return '$ ' + Math.round(monto).toLocaleString('es-AR');
}

// Cambiar entre tabs Usados / 0km
function cambiarSimTab(tab) {
    document.querySelectorAll('.sim-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.sim-tab[data-tab="${tab}"]`).classList.add('active');
    document.getElementById('sim-tab-usado').style.display = (tab === 'usado') ? 'grid' : 'none';
    document.getElementById('sim-tab-cero').style.display = (tab === 'cero') ? 'flex' : 'none';
}

// Parsea un número escrito con puntos de miles (ej: "10.500.000" -> 10500000)
function parsearNumeroFormateado(valor) {
    if (!valor) return 0;
    // Quitar todo lo que no sea dígito
    const limpio = valor.toString().replace(/[^\d]/g, '');
    return parseInt(limpio) || 0;
}

// Formatea un número agregando puntos de miles (10500000 -> "10.500.000")
function formatearNumeroMiles(numero) {
    if (!numero || isNaN(numero)) return '';
    return Math.round(numero).toLocaleString('es-AR');
}

function calcularSimulacion() {
    const precio = parsearNumeroFormateado(document.getElementById('sim-precio').value);
    let capital = parsearNumeroFormateado(document.getElementById('sim-capital').value);
    const plazo = parseInt(document.getElementById('sim-plazo').value) || 24;
    const tasaAnual = FINANCIACION.tna_prendario;

    // Validación: el capital a financiar no puede superar el 65% del precio
    const capitalMaximo = precio * 0.65;
    const hint = document.getElementById('sim-capital-hint');
    const inputCapital = document.getElementById('sim-capital');

    if (capital > capitalMaximo && precio > 0) {
        // Ajustar automáticamente al máximo permitido
        capital = capitalMaximo;
        inputCapital.value = formatearNumeroMiles(capitalMaximo);
        if (hint) {
            hint.textContent = `Ajustado al máximo permitido: $ ${formatearNumeroMiles(capitalMaximo)}`;
            hint.style.color = '#c53030';
        }
    } else {
        if (hint) {
            hint.textContent = `Hasta el 65% del vehículo · Máx: $ ${formatearNumeroMiles(capitalMaximo)}`;
            hint.style.color = '';
        }
    }

    document.getElementById('sim-tna-display').innerHTML =
        `TNA de referencia: <strong>${tasaAnual.toString().replace('.', ',')}%</strong>`;

    // Fórmula de cuota francesa: C = M * [i(1+i)^n] / [(1+i)^n - 1]
    const tasaMensual = (tasaAnual / 100) / 12;
    let cuota = 0;
    if (tasaMensual > 0 && capital > 0) {
        const factor = Math.pow(1 + tasaMensual, plazo);
        cuota = capital * (tasaMensual * factor) / (factor - 1);
    }

    document.getElementById('res-precio').textContent = formatearPesos(precio);
    document.getElementById('res-monto').textContent = formatearPesos(capital);
    document.getElementById('res-cuota').textContent = formatearPesos(cuota);
}

function consultarSimulacion() {
    const precio = parsearNumeroFormateado(document.getElementById('sim-precio').value);
    const capital = parsearNumeroFormateado(document.getElementById('sim-capital').value);
    const plazo = document.getElementById('sim-plazo').value;
    const cuota = document.getElementById('res-cuota').textContent;

    const mensaje =
        `Hola! Quiero consultar por una financiación prendaria:%0A%0A` +
        `• Precio del auto: ${formatearPesos(precio)}%0A` +
        `• Capital a financiar: ${formatearPesos(capital)}%0A` +
        `• Plazo: ${plazo} meses%0A` +
        `• Cuota estimada: ${cuota}`;

    trackEvent('consulta_simulacion', {
        precio: precio,
        capital: capital,
        plazo: parseInt(plazo) || 0
    });

    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${mensaje}`, '_blank');
}

// Auto-formatea el input mientras el usuario escribe (agrega puntos de miles)
function autoFormatearInput(input) {
    input.addEventListener('input', (e) => {
        const cursorPos = e.target.selectionStart;
        const valorAntes = e.target.value;
        const numero = parsearNumeroFormateado(valorAntes);
        const formateado = numero > 0 ? formatearNumeroMiles(numero) : '';
        e.target.value = formateado;
        // Reajustar posición del cursor (el formato puede haber agregado puntos)
        const diff = formateado.length - valorAntes.length;
        const nuevaPos = Math.max(0, cursorPos + diff);
        e.target.setSelectionRange(nuevaPos, nuevaPos);
        calcularSimulacion();
    });
}

function consultarFinanciacion0km(e) {
    if (e) e.preventDefault();
    trackEvent('consulta_0km_generica');
    const mensaje =
        `Hola! Quiero consultar por la financiación de un 0km.%0A%0A` +
        `Modelo de interés: %0A` +
        `Forma de pago en mente (anticipo / plan / parte de pago): `;
    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${mensaje}`, '_blank');
}

// Click en una marca específica (Toyota, Ford, etc.) → WhatsApp pre-armado con esa marca
function consultarMarca(e, marca) {
    if (e) e.preventDefault();
    trackEvent('consulta_marca', { marca: marca });
    const mensaje =
        `Hola! Quiero consultar por un ${marca} 0km.%0A%0A` +
        `Modelo de interés: %0A` +
        `Forma de pago (anticipo / plan / parte de pago): `;
    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${mensaje}`, '_blank');
}

// Click en "Otras marcas" → WhatsApp pre-armado para que el cliente escriba la marca
function consultarOtrasMarcas(e) {
    if (e) e.preventDefault();
    trackEvent('consulta_otras_marcas');
    const mensaje =
        `Hola! Quiero consultar por un 0km.%0A%0A` +
        `Marca de interés: %0A` +
        `Modelo: %0A` +
        `Forma de pago (anticipo / plan / parte de pago): `;
    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${mensaje}`, '_blank');
}

/* ============================================
   FORMULARIOS
   ============================================ */
function enviarContacto(e) {
    e.preventDefault();
    const nombre = document.getElementById('nombre').value;
    const telefono = document.getElementById('telefono').value;
    const auto = document.getElementById('auto').value || 'sin especificar';
    const mensaje = document.getElementById('mensaje').value || 'Quería hacer una consulta';

    trackEvent('formulario_contacto', { auto_interes: auto });

    const texto = `Hola! Soy ${nombre}.%0A` +
                  `Teléfono: ${telefono}%0A` +
                  `Auto de interés: ${auto}%0A%0A${mensaje}`;

    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${texto}`, '_blank');
}

/* ============================================
   TASACIÓN - busca precio de referencia en ACARA/CCA
   (el precio va SOLO al WhatsApp de ADG, el cliente no lo ve)
   ============================================ */

// Normaliza strings para comparar (saca tildes, pasa a minúscula, quita espacios extra)
function normalizar(s) {
    return (s || '')
        .toString()
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Busca el mejor match en una lista de objetos {id, name} según un término
function matchMejor(lista, termino) {
    const t = normalizar(termino);
    if (!t || !lista || !lista.length) return null;

    // 1. Match exacto
    let match = lista.find(x => normalizar(x.name) === t);
    if (match) return match;

    // 2. Match que empieza igual
    match = lista.find(x => normalizar(x.name).startsWith(t));
    if (match) return match;

    // 3. Match que contiene
    match = lista.find(x => normalizar(x.name).includes(t));
    if (match) return match;

    // 4. Al revés: término contiene el nombre
    match = lista.find(x => t.includes(normalizar(x.name)) && normalizar(x.name).length > 2);
    return match;
}

// Consulta el precio de referencia en argautos.com
// Devuelve null si no encuentra o si la API falla
async function buscarPrecioReferencia(marca, modelo, version, anio) {
    try {
        // 1. Buscar la marca
        const brandsRes = await fetch(`${CONFIG.argAutosAPI}/brands`);
        if (!brandsRes.ok) throw new Error('No se pudieron cargar las marcas');
        const brandsJson = await brandsRes.json();
        const brands = Array.isArray(brandsJson) ? brandsJson : (brandsJson.data || brandsJson.brands || []);

        const brandMatch = matchMejor(brands, marca);
        if (!brandMatch) return { error: 'Marca no encontrada', marca };

        // 2. Buscar modelos de esa marca
        const modelsRes = await fetch(`${CONFIG.argAutosAPI}/brands/${brandMatch.id}/models`);
        if (!modelsRes.ok) throw new Error('No se pudieron cargar los modelos');
        const modelsJson = await modelsRes.json();
        const models = Array.isArray(modelsJson) ? modelsJson : (modelsJson.data || modelsJson.models || []);

        const modelMatch = matchMejor(models, modelo);
        if (!modelMatch) return { error: 'Modelo no encontrado', marca: brandMatch.name };

        // 3. Buscar versiones del modelo
        const versionsRes = await fetch(`${CONFIG.argAutosAPI}/models/${modelMatch.id}/versions`);
        if (!versionsRes.ok) throw new Error('No se pudieron cargar las versiones');
        const versionsJson = await versionsRes.json();
        const versions = Array.isArray(versionsJson) ? versionsJson : (versionsJson.data || versionsJson.versions || []);

        // Si el cliente no cargó versión o no matchea, tomar la primera disponible
        let versionMatch = version ? matchMejor(versions, version) : null;
        if (!versionMatch && versions.length > 0) versionMatch = versions[0];
        if (!versionMatch) return { error: 'Sin versiones disponibles', marca: brandMatch.name, modelo: modelMatch.name };

        // 4. Buscar valuación en ARS para el año
        const valRes = await fetch(`${CONFIG.argAutosAPI}/versions/${versionMatch.id}/valuations?currency=ars`);
        if (!valRes.ok) throw new Error('No se pudieron cargar las valuaciones');
        const valJson = await valRes.json();
        const valuations = Array.isArray(valJson) ? valJson : (valJson.data || valJson.valuations || []);

        // Buscar valuación del año exacto, o el más cercano
        let valuacion = valuations.find(v => parseInt(v.year) === parseInt(anio));
        if (!valuacion && valuations.length > 0) {
            // Si no hay exacta, buscar la más cercana
            const valuaciones_ordenadas = valuations.slice().sort((a, b) =>
                Math.abs(parseInt(a.year) - anio) - Math.abs(parseInt(b.year) - anio)
            );
            valuacion = valuaciones_ordenadas[0];
        }

        if (!valuacion) return { error: 'Sin valuación para ese año', marca: brandMatch.name, modelo: modelMatch.name, version: versionMatch.name };

        return {
            ok: true,
            marca: brandMatch.name,
            modelo: modelMatch.name,
            version: versionMatch.name,
            anio: valuacion.year,
            precio: valuacion.price || valuacion.value || valuacion.amount,
            currency: valuacion.currency || 'ARS',
            anio_consultado: anio
        };

    } catch (err) {
        console.warn('Error consultando argautos.com:', err);
        return { error: err.message || 'Error de conexión' };
    }
}

async function enviarTasacion(e) {
    e.preventDefault();

    const btn = e.target.querySelector('button[type="submit"]');
    const textoOriginal = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparando tu tasación...';

    const datos = {
        nombre: document.getElementById('tas-nombre').value,
        telefono: document.getElementById('tas-telefono').value,
        marca: document.getElementById('tas-marca').value,
        modelo: document.getElementById('tas-modelo').value,
        version: document.getElementById('tas-version').value || '-',
        anio: document.getElementById('tas-anio').value,
        km: document.getElementById('tas-km').value,
        combustible: document.getElementById('tas-combustible').value,
        transmision: document.getElementById('tas-transmision').value,
        estado: document.getElementById('tas-estado').value,
        service: document.getElementById('tas-service').value,
        papeles: document.getElementById('tas-papeles').value,
        comentarios: document.getElementById('tas-comentarios').value || 'sin comentarios'
    };

    // Consultar precio de referencia (silencioso, no bloquea al cliente si falla)
    let bloqueReferencia = '';
    try {
        const ref = await buscarPrecioReferencia(datos.marca, datos.modelo, datos.version, datos.anio);
        if (ref && ref.ok && ref.precio) {
            const precioFormateado = '$ ' + parseInt(ref.precio).toLocaleString('es-AR');
            bloqueReferencia =
                `%0A%0A*🔒 Referencia interna (solo ADG)*%0A` +
                `• ${ref.marca} ${ref.modelo} ${ref.version}%0A` +
                `• Año: ${ref.anio}${ref.anio_consultado != ref.anio ? ' (cliente pidió ' + ref.anio_consultado + ')' : ''}%0A` +
                `• CCA/ACARA: ${precioFormateado}%0A` +
                `• Fuente: argautos.com`;
        } else if (ref && ref.error) {
            bloqueReferencia =
                `%0A%0A*🔒 Referencia interna (solo ADG)*%0A` +
                `• No se encontró match automático%0A` +
                `• Motivo: ${ref.error}%0A` +
                `• Buscar manualmente en acara.org.ar`;
        }
    } catch (err) {
        // Silencioso, no mostrar al cliente
        console.warn('Error obteniendo referencia:', err);
    }

    const texto =
        `*Solicitud de tasación*%0A%0A` +
        `*Contacto*%0A` +
        `• Nombre: ${datos.nombre}%0A` +
        `• Teléfono: ${datos.telefono}%0A%0A` +
        `*Vehículo*%0A` +
        `• ${datos.marca} ${datos.modelo} ${datos.version}%0A` +
        `• Año: ${datos.anio}%0A` +
        `• Km: ${datos.km}%0A` +
        `• ${datos.combustible} / ${datos.transmision}%0A%0A` +
        `*Estado*%0A` +
        `• Estado general: ${datos.estado}%0A` +
        `• Service al día: ${datos.service}%0A` +
        `• Papeles al día: ${datos.papeles}%0A%0A` +
        `*Comentarios*%0A${datos.comentarios}` +
        bloqueReferencia;

    btn.disabled = false;
    btn.innerHTML = textoOriginal;

    trackEvent('formulario_tasacion', {
        marca: datos.marca,
        modelo: datos.modelo,
        anio: datos.anio
    });

    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${texto}`, '_blank');
}

/* ============================================
   NAVBAR + MOBILE MENU
   ============================================ */
const navbar = document.getElementById('navbar');
const menuBtn = document.getElementById('menuBtn');
const navLinks = document.getElementById('navLinks');

window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
});

menuBtn.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    const icon = menuBtn.querySelector('i');
    icon.classList.toggle('fa-bars');
    icon.classList.toggle('fa-times');
});

document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        const icon = menuBtn.querySelector('i');
        icon.classList.add('fa-bars');
        icon.classList.remove('fa-times');
    });
});

/* ============================================
   FILTROS DE CATÁLOGO (TABS)
   ============================================ */
document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        filtroActual = tab.getAttribute('data-filter');
        aplicarFiltros();
    });
});

// Filtros reactivos (se aplican al cambiar)
['f-texto', 'f-tipo', 'f-marca', 'f-anio', 'f-precio'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', aplicarFiltros);
        el.addEventListener('change', aplicarFiltros);
    }
});

/* ============================================
   SIMULADOR - listeners
   ============================================ */
// Inputs de texto (precio y capital) con auto-formato de miles
['sim-precio', 'sim-capital'].forEach(id => {
    const el = document.getElementById(id);
    if (el) autoFormatearInput(el);
});
// Select de plazo con listener normal
const simPlazoEl = document.getElementById('sim-plazo');
if (simPlazoEl) simPlazoEl.addEventListener('change', calcularSimulacion);

/* ============================================
   CARRUSEL DE TESTIMONIOS
   ============================================ */
const testimonialsTrack = document.getElementById('testimonialsTrack');
const testimonialsDots = document.getElementById('testimonialsDots');
const testimonialCards = testimonialsTrack.children;
let testimonialIndex = 0;

for (let i = 0; i < testimonialCards.length; i++) {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot';
    if (i === 0) dot.classList.add('active');
    dot.onclick = () => goToTestimonial(i);
    testimonialsDots.appendChild(dot);
}

function goToTestimonial(index) {
    testimonialIndex = index;
    testimonialsTrack.style.transform = `translateX(-${index * 100}%)`;
    document.querySelectorAll('#testimonialsDots .carousel-dot').forEach((d, i) => {
        d.classList.toggle('active', i === index);
    });
}

setInterval(() => {
    testimonialIndex = (testimonialIndex + 1) % testimonialCards.length;
    goToTestimonial(testimonialIndex);
}, 6000);

/* ============================================
   FADE-IN AL SCROLL
   ============================================ */
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
    });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

/* ============================================
   INICIALIZACIÓN
   ============================================ */
async function init() {
    // Cargar config de financiación, stock y promos en paralelo
    await Promise.all([
        cargarConfigFinanciacion(),
        cargarAutos(),
        cargarPromos(),
        cargarPaginasAutos()
    ]);
    poblarSelectorMarcas();
    autosFiltrados = [...autos];
    renderDestacados();
    renderCatalogo();
    calcularSimulacion();

    // Listeners del carrusel de promos: pausar al hover, reanudar al salir
    const promosWrapper = document.getElementById('promos-wrapper');
    if (promosWrapper) {
        promosWrapper.addEventListener('mouseenter', detenerRotacionPromos);
        promosWrapper.addEventListener('mouseleave', () => {
            if (promosData.length > 1) iniciarRotacionPromos();
        });
        // En touch devices, el hover no aplica. Pausamos cuando tocan y reanudamos al soltar.
        promosWrapper.addEventListener('touchstart', detenerRotacionPromos, { passive: true });
        promosWrapper.addEventListener('touchend', () => {
            if (promosData.length > 1) iniciarRotacionPromos();
        });
    }

    // Listener del botón "Ver más" del catálogo
    const btnVerMas = document.getElementById('btnVerMas');
    if (btnVerMas) {
        btnVerMas.addEventListener('click', expandirCatalogo);
    }

    // Flechas del carrusel (si existen)
    document.getElementById('promoPrevBtn')?.addEventListener('click', () => {
        detenerRotacionPromos();
        promoAnterior();
        if (promosData.length > 1) iniciarRotacionPromos();
    });
    document.getElementById('promoNextBtn')?.addEventListener('click', () => {
        detenerRotacionPromos();
        promoSiguiente();
        if (promosData.length > 1) iniciarRotacionPromos();
    });

    // Si viene un ?auto=XXX en la URL, abrir ese modal directo
    const params = new URLSearchParams(window.location.search);
    const autoId = params.get('auto');
    if (autoId) {
        if (autos.some(a => a.id === autoId)) {
            setTimeout(() => abrirModal(autoId), 500);
        } else {
            // Link viejo a un auto que ya se vendió
            const url = new URL(window.location);
            url.searchParams.delete('auto');
            window.history.replaceState({}, '', url);
            mostrarAviso('Esa unidad ya no está disponible. Te mostramos el stock actual.');
            setTimeout(scrollToCatalogo, 600);
        }
    }

    // Viene desde la página de un auto con "Simular crédito": /?simular=PRECIO#simulador
    const simular = parseInt(params.get('simular'), 10);
    if (simular > 0) {
        usarSimulador(simular, 'ARS');
        const url = new URL(window.location);
        url.searchParams.delete('simular');
        window.history.replaceState({}, '', url);
    }
}

init();

/* ============================================
   TRACKING GLOBAL: clicks a WhatsApp (botón flotante, links de autos, etc)
   Los clicks que ya están trackeados por sus funciones específicas también disparan
   este evento, lo cual está bien (nos permite tener un conteo total de clicks a WA).
   ============================================ */
document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href*="wa.me/"], a[href*="whatsapp.com"]');
    if (link) {
        // Categorizar el origen del click según dónde está el link
        let origen = 'otro';
        if (link.classList.contains('whatsapp-float')) origen = 'boton_flotante';
        else if (link.closest('.modal-overlay')) origen = 'modal_auto';
        else if (link.closest('.car-card')) origen = 'card_auto';
        else if (link.closest('nav')) origen = 'navbar';
        else if (link.closest('.contact')) origen = 'contacto';

        trackEvent('click_whatsapp', { origen: origen });
    }
});
