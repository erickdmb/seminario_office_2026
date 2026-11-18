/**
 * Lógica principal del Sistema de Validación de Certificados
 * IDEX SAM — Historial Académico, Catálogo y Detalles con Ponentes
 */

/* =========================================================================
   ESTADO Y CACHÉ
========================================================================= */
const cacheLocal = {};
const intentosCarga = new Set();
let usaApiServerless = true;
const mapaCertificadosActivos = new Map();

/* =========================================================================
   INICIALIZACIÓN DEL CATÁLOGO DINÁMICO (data/seminarios.json)
========================================================================= */
async function inicializarCatalogo() {
    try {
        const res = await fetch('data/seminarios.json');
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                SEMINARIOS = data.map(sem => {
                    if (sem.temario && Array.isArray(sem.temario)) {
                        sem.temario.forEach(t => {
                            if (!t.iconPath && t.icono && typeof ICONOS !== 'undefined' && ICONOS[t.icono]) {
                                t.iconPath = ICONOS[t.icono];
                            }
                        });
                    }
                    return sem;
                });
            }
        }
    } catch (e) {
        console.warn('Uso de catálogo estático de respaldo:', e);
    }
}

/* =========================================================================
   UTILIDADES
========================================================================= */
function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));
}

function sanitizarEntrada(valor) {
    return String(valor || '').trim();
}

function normalizarDni(valor) {
    return String(valor || '').replace(/\D/g, '').slice(0, 8);
}

function obtenerColorClasses(color) {
    if (typeof TAILWIND_COLORS !== 'undefined' && TAILWIND_COLORS[color]) {
        return TAILWIND_COLORS[color];
    }
    return {
        badgeBg: 'bg-slate-100',
        badgeText: 'text-slate-700',
        badgeDot: 'bg-slate-500',
        iconBg: 'bg-slate-100',
        iconText: 'text-slate-600'
    };
}

function obtenerSeminario(id) {
    return SEMINARIOS.find(s => s.id === id);
}

function nombreCompletoSeminario(sem) {
    return sem.edicion ? `${sem.titulo} — ${sem.edicion}` : sem.titulo;
}

/* =========================================================================
   CARGA DE PADRONES LOCALES (DESDE data/certificados/)
========================================================================= */
function construirIndices(certificados) {
    const indiceDni = new Map();
    const indiceCodigo = new Map();

    for (const reg of certificados) {
        if (!reg) continue;
        const dni = normalizarDni(reg.dni);
        if (dni) {
            if (!indiceDni.has(dni)) indiceDni.set(dni, []);
            indiceDni.get(dni).push(reg);
        }

        const cod = sanitizarEntrada(reg.codigo).toLowerCase();
        if (cod) {
            if (!indiceCodigo.has(cod)) indiceCodigo.set(cod, []);
            indiceCodigo.get(cod).push(reg);
        }
    }

    return { indiceDni, indiceCodigo };
}

async function cargarPadronesLocales() {
    await Promise.all(SEMINARIOS.map(async sem => {
        if (sem.activo === false) return;
        if (intentosCarga.has(sem.id)) return;
        intentosCarga.add(sem.id);
        try {
            let archivo = sem.jsonFile || `data/certificados/${sem.id}.json`;
            let res = await fetch(archivo);
            if (!res.ok) {
                const altPath = `data/certificados/${archivo.split('/').pop()}`;
                res = await fetch(altPath);
            }
            if (!res.ok) return;
            const data = await res.json();
            const { indiceDni, indiceCodigo } = construirIndices(data);
            cacheLocal[sem.id] = { data, indiceDni, indiceCodigo };
        } catch (_) {
            /* Fallo silencioso de carga individual */
        }
    }));
    actualizarTotalRegistros();
}

function actualizarTotalRegistros() {
    const totalEl = document.getElementById('totalRegistros');
    if (!totalEl) return;

    let total = 0;
    let seminariosConDatos = 0;

    SEMINARIOS.forEach(sem => {
        if (cacheLocal[sem.id] && Array.isArray(cacheLocal[sem.id].data)) {
            total += cacheLocal[sem.id].data.length;
            if (cacheLocal[sem.id].data.length > 0) seminariosConDatos++;
        }
    });

    if (seminariosConDatos === 0) {
        totalEl.textContent = 'Padrón oficial disponible';
    } else {
        const txt = total === 1 ? 'registro oficial' : 'registros certificados';
        totalEl.textContent = `${total} ${txt}`;
    }
}

/* =========================================================================
   MENSAJES DE ERROR Y ESTADO
========================================================================= */
function mostrarError(mensaje) {
    const el = document.getElementById('mensajeError');
    const input = document.getElementById('inputBusqueda');
    if (!el) return;
    el.querySelector('span').textContent = mensaje;
    el.classList.remove('hidden');
    if (input) {
        input.setAttribute('aria-invalid', 'true');
        input.classList.add('border-rose-400', 'focus:ring-rose-200');
    }
}

function limpiarError() {
    const el = document.getElementById('mensajeError');
    const input = document.getElementById('inputBusqueda');
    if (el) el.classList.add('hidden');
    if (input) {
        input.removeAttribute('aria-invalid');
        input.classList.remove('border-rose-400', 'focus:ring-rose-200');
    }
}

function limpiarResultados() {
    const contenedor = document.getElementById('contenedorResultado');
    if (contenedor) {
        contenedor.classList.add('hidden');
        contenedor.innerHTML = '';
    }
}

/* =========================================================================
   COMPARTIR / DESCARGAR EN PDF
========================================================================= */
async function copiarEnlaceVerificacion(valor, botonId) {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('q', valor);

    try {
        await navigator.clipboard.writeText(url.toString());
        const btn = document.getElementById(botonId);
        if (btn) {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = `
                <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                <span class="text-emerald-700 font-bold">¡Enlace Copiado!</span>
            `;
            setTimeout(() => {
                btn.innerHTML = originalHtml;
            }, 2500);
        }
    } catch (_) {
        prompt('Copie el siguiente enlace de verificación:', url.toString());
    }
}

function crearElementoCertificadoPdf(alumno, sem) {
    const nombreCompleto = nombreCompletoSeminario(sem);
    const fechaActual = new Date().toLocaleDateString('es-PE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const urlVerificacion = `${window.location.origin}${window.location.pathname}?q=${encodeURIComponent(alumno.codigo || alumno.dni)}`;

    const el = document.createElement('div');
    el.id = 'certificado-pdf-temp';
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.top = '0';
    el.style.width = '780px';
    el.style.backgroundColor = '#ffffff';
    el.style.color = '#0f172a';
    el.style.fontFamily = "'Inter', Arial, sans-serif";
    el.style.padding = '36px 40px';
    el.style.boxSizing = 'border-box';
    el.style.border = '10px solid #064e3b';
    el.style.outline = '3px solid #10b981';

    let temarioHtml = '';
    if (sem.temario && sem.temario.length > 0) {
        const items = sem.temario.map((item, idx) => `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 10px; margin-bottom: 6px; box-sizing: border-box;">
                <div style="font-size: 9px; font-weight: 700; color: #0284c7; text-transform: uppercase;">Módulo ${idx + 1}: ${escapeHtml(item.area)}</div>
                <div style="font-size: 11px; font-weight: 600; color: #1e293b; line-height: 1.25; margin-top: 1px;">${escapeHtml(item.titulo)}</div>
                <div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">Ponente: <strong style="color: #334155;">${escapeHtml(item.ponente)}</strong></div>
            </div>
        `).join('');

        temarioHtml = `
            <div style="margin-top: 18px; border-top: 2px solid #e2e8f0; padding-top: 12px;">
                <div style="font-size: 10.5px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                    Módulos Académicos Acreditados:
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    ${items}
                </div>
            </div>
        `;
    }

    el.innerHTML = `
        <div style="border-bottom: 2px solid #064e3b; padding-bottom: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <img src="logo_sam.png" alt="IDEX SAM" style="height: 52px; object-fit: contain;">
                <div style="text-align: right;">
                    <div style="display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 9999px; text-transform: uppercase;">
                        ✓ Certificación Oficial Verificada
                    </div>
                    <div style="font-size: 9px; color: #64748b; margin-top: 3px;">Padrón Oficial de Certificados Digitales</div>
                </div>
            </div>
            <div style="text-align: center;">
                <h1 style="font-size: 17px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: -0.2px;">
                    Constancia Oficial de Validación de Certificado
                </h1>
                <p style="font-size: 10.5px; color: #64748b; margin: 3px 0 0 0; font-weight: 500;">
                    Instituto de Educación Superior IDEX SAM — Registro Nacional
                </p>
            </div>
        </div>

        <div style="padding: 20px 0 10px 0; text-align: center;">
            <p style="font-size: 11px; color: #64748b; margin: 0; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">
                Por cuanto, se deja constancia oficial que:
            </p>
            <h2 style="font-size: 22px; font-weight: 900; color: #064e3b; margin: 8px 0 4px 0; text-transform: uppercase; letter-spacing: -0.3px;">
                ${escapeHtml(alumno.nombre)}
            </h2>
            <p style="font-size: 12.5px; color: #334155; font-weight: 600; margin: 0;">
                Identificado(a) con DNI N° <span style="font-family: monospace; font-size: 13.5px; color: #0f172a; font-weight: 700;">${escapeHtml(alumno.dni)}</span>
            </p>
            <p style="font-size: 11.5px; color: #475569; margin: 10px 0 0 0;">
                Ha cumplido y acreditado satisfactoriamente en calidad de <strong>${escapeHtml(alumno.condicion || 'Participante')}</strong> en:
            </p>
            <h3 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 5px 0 0 0;">
                ${escapeHtml(nombreCompleto)}
            </h3>
        </div>

        <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 10px; padding: 12px 16px; margin-top: 12px;">
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center;">
                <div>
                    <span style="display: block; font-size: 8.5px; font-weight: 700; color: #047857; text-transform: uppercase;">Código Oficial</span>
                    <strong style="font-family: monospace; font-size: 10.5px; color: #064e3b;">${escapeHtml(alumno.codigo)}</strong>
                </div>
                <div>
                    <span style="display: block; font-size: 8.5px; font-weight: 700; color: #047857; text-transform: uppercase;">Carga Horaria</span>
                    <strong style="font-size: 10.5px; color: #064e3b;">${escapeHtml(sem.horas)}</strong>
                </div>
                <div>
                    <span style="display: block; font-size: 8.5px; font-weight: 700; color: #047857; text-transform: uppercase;">Acreditación</span>
                    <strong style="font-size: 10.5px; color: #064e3b;">${escapeHtml(sem.creditos)}</strong>
                </div>
                <div>
                    <span style="display: block; font-size: 8.5px; font-weight: 700; color: #047857; text-transform: uppercase;">Modalidad</span>
                    <strong style="font-size: 9.5px; color: #064e3b;">${escapeHtml(sem.modalidad)}</strong>
                </div>
            </div>
        </div>

        ${temarioHtml}

        <div style="margin-top: 20px; border-top: 2px solid #e2e8f0; padding-top: 12px; display: flex; align-items: center; justify-content: space-between; font-size: 9.5px; color: #64748b;">
            <div>
                <div><strong>Fecha de emisión:</strong> ${fechaActual}</div>
                <div style="margin-top: 2px;"><strong>Enlace de validación:</strong> ${urlVerificacion}</div>
            </div>
            <div style="text-align: right;">
                <div style="font-weight: 700; color: #0f172a;">IDEX SAM — Certificación Oficial</div>
                <div style="font-size: 8.5px; color: #059669; font-weight: 600;">Documento Válido con Firma y Sello Digital</div>
            </div>
        </div>
    `;

    document.body.appendChild(el);
    return el;
}

async function descargarCertificadoPdf(semId, index) {
    const clave = `${semId}-${index}`;
    const info = mapaCertificadosActivos.get(clave);
    if (!info) return;

    const { alumno, sem } = info;
    const btnId = `btn-pdf-${semId}-${index}`;
    const btn = document.getElementById(btnId);

    const urlDirecta = alumno.url_pdf || alumno.pdf;
    if (urlDirecta) {
        window.open(urlDirecta, '_blank');
        return;
    }

    let originalHtml = '';
    if (btn) {
        originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `
            <svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <span>Generando PDF...</span>
        `;
    }

    try {
        if (typeof html2pdf === 'undefined') {
            throw new Error('La biblioteca html2pdf no está cargada');
        }

        const elTemp = crearElementoCertificadoPdf(alumno, sem);

        const nombreLimpio = String(alumno.codigo || alumno.dni || 'certificado')
            .replace(/[^a-zA-Z0-9_-]/g, '_');

        const opciones = {
            margin: [8, 8, 8, 8],
            filename: `Certificado_${nombreLimpio}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2.2,
                useCORS: true,
                logging: false,
                windowWidth: 780
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        await html2pdf().set(opciones).from(elTemp).save();

        if (elTemp && elTemp.parentNode) {
            elTemp.parentNode.removeChild(elTemp);
        }
    } catch (err) {
        console.error('Error al generar PDF:', err);
        alert('No se pudo generar la descarga del PDF automáticamente. Por favor intente nuevamente.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }
}

/* =========================================================================
   INTERACTIVIDAD: TOGGLE DE DETALLES CON HORAS Y PONENTES
========================================================================= */
window.toggleDetallesCertificado = function(semId, index) {
    const panel = document.getElementById(`panel-detalles-${semId}-${index}`);
    const btnTxt = document.getElementById(`txt-toggle-${semId}-${index}`);
    const btnIcon = document.getElementById(`icon-toggle-${semId}-${index}`);
    if (!panel) return;

    const estaOculto = panel.classList.contains('hidden');
    if (estaOculto) {
        panel.classList.remove('hidden');
        if (btnTxt) btnTxt.textContent = 'Ocultar Detalles';
        if (btnIcon) btnIcon.style.transform = 'rotate(180deg)';
    } else {
        panel.classList.add('hidden');
        if (btnTxt) btnTxt.textContent = 'Ver Más Detalles (Horas y Ponentes)';
        if (btnIcon) btnIcon.style.transform = 'rotate(0deg)';
    }
};

/* =========================================================================
   HISTORIAL ACADÉMICO CONSOLIDADO Y FILTROS
========================================================================= */
window.filtrarPorSeminario = function(idFiltro) {
    const grupos = document.querySelectorAll('.grupo-seminario');
    const botones = document.querySelectorAll('.btn-filtro-sem');

    botones.forEach(btn => {
        if (btn.dataset.filtro === idFiltro) {
            btn.classList.add('bg-slate-900', 'text-white', 'shadow-sm');
            btn.classList.remove('bg-white', 'text-slate-700', 'border-slate-200');
        } else {
            btn.classList.remove('bg-slate-900', 'text-white', 'shadow-sm');
            btn.classList.add('bg-white', 'text-slate-700', 'border-slate-200');
        }
    });

    grupos.forEach(g => {
        if (idFiltro === 'todos' || g.dataset.semId === idFiltro) {
            g.classList.remove('hidden');
        } else {
            g.classList.add('hidden');
        }
    });
};

window.consultarDniDesdeCodigo = function(dni) {
    const input = document.getElementById('inputBusqueda');
    if (input) {
        input.value = dni;
        verificarCertificado();
    }
};

/* =========================================================================
   RENDERIZADO DE COMPONENTES
========================================================================= */
function renderTarjeta(alumno, index, total, sem, nombre) {
    const safeNombre = escapeHtml(alumno.nombre);
    const safeDni = escapeHtml(alumno.dni);
    const safeCodigo = escapeHtml(alumno.codigo);
    const safeCondicion = escapeHtml(alumno.condicion || 'Participante');
    const safeSemNombre = escapeHtml(nombre);
    const botonId = `btn-copiar-${sem.id}-${index}`;
    const btnPdfId = `btn-pdf-${sem.id}-${index}`;

    mapaCertificadosActivos.set(`${sem.id}-${index}`, { alumno, sem });

    // Renderizar tarjetas de los ponentes para la sección de más detalles
    const itemsPonentesHtml = (sem.temario && sem.temario.length > 0)
        ? sem.temario.map((item, idx) => {
            const colorStyles = obtenerColorClasses(item.color);
            return `
                <div class="bg-white rounded-xl p-3 border border-emerald-100/90 shadow-2xs flex items-start gap-2.5 hover:border-emerald-300 transition-colors">
                    <div class="w-8 h-8 rounded-lg ${colorStyles.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg class="w-4 h-4 ${colorStyles.iconText}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            ${item.iconPath || (typeof ICONOS !== 'undefined' ? ICONOS.documento : '')}
                        </svg>
                    </div>
                    <div class="min-w-0 flex-1">
                        <span class="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block">
                            Módulo ${idx + 1}: <span class="${colorStyles.badgeText}">${escapeHtml(item.area)}</span>
                        </span>
                        <p class="text-xs font-semibold text-slate-900 leading-snug mt-0.5">${escapeHtml(item.titulo)}</p>
                        <div class="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md inline-flex border border-emerald-100">
                            <span class="text-emerald-700 font-bold">Ponente:</span>
                            <span class="text-slate-900 font-semibold">${escapeHtml(item.ponente)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('')
        : `<div class="col-span-2 text-xs text-slate-400 italic py-3 text-center">Temario y ponentes en proceso de actualización oficial.</div>`;

    return `
        <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 sm:p-7 shadow-sm mb-4 tarjeta-certificado transition-all hover:shadow-md">
            <div class="flex items-start gap-4">
                <div class="flex-shrink-0 mt-1">
                    <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <svg class="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                        </svg>
                    </div>
                </div>
                <div class="space-y-4 w-full">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <span class="inline-block bg-emerald-200 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-bold tracking-wide uppercase mb-1.5">
                                ${total > 1 ? `Certificado ${index + 1} de ${total} ✓` : 'Certificado Verificado Oficial ✓'}
                            </span>
                            <h3 class="text-xl sm:text-2xl font-bold text-slate-950">${safeNombre}</h3>
                            <p class="text-sm text-slate-600 font-medium mt-0.5">DNI: <strong class="text-slate-800">${safeDni}</strong></p>
                            <p class="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
                                Código de Certificado: <code class="font-mono font-bold bg-white px-2 py-0.5 rounded border border-emerald-200 text-emerald-900">${safeCodigo}</code>
                            </p>
                        </div>

                        <!-- Botones de acción rápida -->
                        <div class="flex items-center gap-2 self-start sm:self-center mt-2 sm:mt-0 flex-wrap">
                            <!-- Descargar PDF -->
                            <button id="${btnPdfId}" onclick="descargarCertificadoPdf('${sem.id}', ${index})"
                                class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow transition-all cursor-pointer"
                                title="Descargar Constancia Oficial en formato PDF">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                </svg>
                                <span>Descargar PDF</span>
                            </button>

                            <!-- Copiar Enlace -->
                            <button id="${botonId}" onclick="copiarEnlaceVerificacion('${safeCodigo || safeDni}', '${botonId}')"
                                class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors shadow-sm cursor-pointer"
                                title="Copiar enlace para verificación por QR">
                                <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                </svg>
                                <span>Copiar Enlace</span>
                            </button>
                        </div>
                    </div>

                    <!-- Datos esenciales -->
                    <div class="border-t border-emerald-200/70 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-sm">
                        <div class="bg-white/70 rounded-xl p-2.5 border border-emerald-100">
                            <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Evento</span>
                            <span class="font-semibold text-slate-800 text-xs sm:text-sm truncate block" title="${safeSemNombre}">${safeSemNombre}</span>
                        </div>
                        <div class="bg-white/70 rounded-xl p-2.5 border border-emerald-100">
                            <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Carga Horaria</span>
                            <span class="font-bold text-slate-900 text-xs sm:text-sm">${escapeHtml(sem.horas)}</span>
                        </div>
                        <div class="bg-white/70 rounded-xl p-2.5 border border-emerald-100">
                            <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Condición</span>
                            <span class="font-semibold text-slate-800 capitalize text-xs sm:text-sm">${safeCondicion}</span>
                        </div>
                        <div class="bg-white/70 rounded-xl p-2.5 border border-emerald-100">
                            <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Acreditación</span>
                            <span class="font-bold text-slate-900 text-xs sm:text-sm">${escapeHtml(sem.creditos)}</span>
                        </div>
                    </div>

                    <!-- Botón para ver más detalles interactivo (Horas y Ponentes) -->
                    <div class="pt-2 flex items-center justify-between">
                        <button type="button" onclick="toggleDetallesCertificado('${sem.id}', ${index})" id="btn-toggle-${sem.id}-${index}"
                            class="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/70 shadow-xs transition-all cursor-pointer">
                            <svg class="w-4 h-4 text-emerald-600 transition-transform duration-200" id="icon-toggle-${sem.id}-${index}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                            </svg>
                            <span id="txt-toggle-${sem.id}-${index}">Ver Más Detalles (Horas y Ponentes)</span>
                        </button>
                    </div>

                    <!-- PANEL DESPLEGABLE CON LAS HORAS Y LOS PONENTES -->
                    <div id="panel-detalles-${sem.id}-${index}" class="hidden mt-3 pt-4 border-t border-emerald-200/80 transition-all duration-300">
                        <!-- Cuadro de Horas y Modalidad -->
                        <div class="bg-white/90 rounded-xl p-4 border border-emerald-200 shadow-2xs mb-4">
                            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-3">
                                <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
                                </svg>
                                Desglose Oficial de Horas y Modalidad
                            </h4>
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                                <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                    <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Horas Académicas</span>
                                    <span class="font-bold text-emerald-700 text-sm">${escapeHtml(sem.horas)}</span>
                                </div>
                                <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                    <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Créditos Oficiales</span>
                                    <span class="font-bold text-slate-900 text-sm">${escapeHtml(sem.creditos)}</span>
                                </div>
                                <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                    <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Plataforma y Modalidad</span>
                                    <span class="font-semibold text-slate-800 text-xs">${escapeHtml(sem.modalidad)}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Cuadro de Ponentes y Módulos -->
                        <div class="bg-white/90 rounded-xl p-4 border border-emerald-200 shadow-2xs">
                            <div class="flex items-center justify-between mb-3">
                                <h4 class="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                    <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                                    </svg>
                                    Plana Docente y Ponentes Oficiales
                                </h4>
                                <span class="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                    ${(sem.temario && sem.temario.length) || 0} Conferencias
                                </span>
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                ${itemsPonentesHtml}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    `;
}

function renderGrupoSeminario(sem, registros) {
    const nombre = nombreCompletoSeminario(sem);
    const colorStyles = obtenerColorClasses(sem.badgeColor);
    const tarjetas = registros
        .map((alumno, index) => renderTarjeta(alumno, index, registros.length, sem, nombre))
        .join('');

    return `
        <div class="grupo-seminario mb-8 last:mb-0 transition-all duration-300" data-sem-id="${sem.id}">
            <div class="flex items-center gap-2 mb-3 flex-wrap">
                <span class="inline-flex items-center gap-1.5 ${colorStyles.badgeBg} ${colorStyles.badgeText} text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                    <span class="w-1.5 h-1.5 rounded-full ${colorStyles.badgeDot}"></span>
                    ${escapeHtml(sem.tabLabel)}
                </span>
                <span class="text-xs text-slate-400 font-medium">${escapeHtml(nombre)}</span>
            </div>
            ${tarjetas}
        </div>
    `;
}

function renderResultados(grupos, consultaOriginal) {
    const totalCerts = grupos.reduce((n, g) => n + g.registros.length, 0);
    const totalSems = grupos.length;

    const primerAlumno = grupos[0].registros[0];
    const safeNombre = escapeHtml(primerAlumno.nombre);
    const safeDni = escapeHtml(primerAlumno.dni);

    let totalHoras = 0;
    let totalCreditos = 0;
    grupos.forEach(g => {
        g.registros.forEach(() => {
            const h = g.sem.horasNumericas || parseInt(String(g.sem.horas).replace(/\D/g, ''), 10) || 0;
            const c = g.sem.creditosNumericos || parseInt(String(g.sem.creditos).replace(/\D/g, ''), 10) || 0;
            totalHoras += h;
            totalCreditos += c;
        });
    });

    const esBusquedaPorCodigo = !/^\d{8}$/.test(sanitizarEntrada(consultaOriginal));

    let avisoCodigo = '';
    if (esBusquedaPorCodigo && totalCerts > 1) {
        avisoCodigo = `
            <div class="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs text-emerald-800 flex items-center justify-between">
                <span>Mostrando certificado correspondiente al código ingresado.</span>
                <button onclick="consultarDniDesdeCodigo('${safeDni}')" class="font-bold underline hover:text-emerald-950 cursor-pointer">
                    Ver historial completo (${totalCerts} certificaciones)
                </button>
            </div>
        `;
    }

    let barraFiltros = '';
    if (totalSems > 1) {
        const chips = grupos.map(g => `
            <button onclick="filtrarPorSeminario('${g.sem.id}')" data-filtro="${g.sem.id}"
                class="btn-filtro-sem px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all cursor-pointer">
                ${escapeHtml(g.sem.tabLabel)} (${g.registros.length})
            </button>
        `).join('');

        barraFiltros = `
            <div class="mb-5 flex items-center gap-2 flex-wrap">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Filtrar:</span>
                <button onclick="filtrarPorSeminario('todos')" data-filtro="todos"
                    class="btn-filtro-sem px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white shadow-sm transition-all cursor-pointer">
                    Todos (${totalCerts})
                </button>
                ${chips}
            </div>
        `;
    }

    // Tarjeta Principal: Perfil e Historial Académico Consolidado
    const fichaHistorial = `
        <div class="mb-6 bg-slate-900 text-white rounded-2xl p-6 sm:p-7 shadow-lg border border-slate-800">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                <div class="flex items-center gap-3.5">
                    <div class="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                        <svg class="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                    </div>
                    <div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="inline-block bg-emerald-400/20 text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                Historial Académico Oficial
                            </span>
                            <span class="text-xs text-slate-400">IDEX SAM</span>
                        </div>
                        <h3 class="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1">${safeNombre}</h3>
                        <p class="text-xs text-slate-300 mt-0.5">DNI N° <span class="font-mono font-bold text-emerald-400">${safeDni}</span></p>
                    </div>
                </div>

                <button id="btn-copiar-historial" onclick="copiarEnlaceVerificacion('${safeDni}', 'btn-copiar-historial')"
                    class="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors shadow cursor-pointer"
                    title="Copiar enlace directo al historial de este participante">
                    <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                    </svg>
                    <span>Compartir Historial</span>
                </button>
            </div>

            <!-- Métricas Consolidadas -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
                <div class="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
                    <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Certificaciones</span>
                    <span class="text-lg font-bold text-emerald-400">${totalCerts}</span>
                    <span class="text-[10px] text-slate-400 block">${totalCerts === 1 ? 'Acreditada' : 'Acreditadas'}</span>
                </div>
                <div class="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
                    <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Carga Acumulada</span>
                    <span class="text-lg font-bold text-white">${totalHoras}</span>
                    <span class="text-[10px] text-slate-400 block">Horas Académicas</span>
                </div>
                <div class="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
                    <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Créditos Totales</span>
                    <span class="text-lg font-bold text-white">${totalCreditos}</span>
                    <span class="text-[10px] text-slate-400 block">Créditos Aprobados</span>
                </div>
                <div class="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
                    <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Eventos</span>
                    <span class="text-lg font-bold text-white">${totalSems}</span>
                    <span class="text-[10px] text-slate-400 block">Seminarios</span>
                </div>
            </div>
        </div>
    `;

    return avisoCodigo + fichaHistorial + barraFiltros + grupos.map(g => renderGrupoSeminario(g.sem, g.registros)).join('');
}

function renderNoEncontrado(query) {
    const safeQuery = escapeHtml(query);
    return `
        <div class="bg-rose-50 border border-rose-200 rounded-2xl p-6 sm:p-7 shadow-md">
            <div class="flex items-start gap-4">
                <div class="flex-shrink-0 mt-1">
                    <div class="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                        <svg class="w-6 h-6 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
                        </svg>
                    </div>
                </div>
                <div>
                    <span class="inline-block bg-rose-200 text-rose-800 text-xs px-2.5 py-1 rounded-full font-bold tracking-wide uppercase mb-2">
                        Registro No Encontrado
                    </span>
                    <h3 class="text-lg font-bold text-slate-950 mb-1">Sin coincidencias oficiales</h3>
                    <p class="text-sm text-slate-600 leading-relaxed">
                        El término <span class="font-bold text-rose-700 font-mono bg-rose-100 px-1.5 py-0.5 rounded">${safeQuery}</span> no figura registrado en los padrones de certificados oficiales vigentes.
                    </p>
                    <div class="mt-3 text-xs text-slate-500 space-y-1">
                        <p>• Si buscó por <strong>DNI</strong>, verifique que los 8 dígitos sean correctos.</p>
                        <p>• Si buscó por <strong>Código</strong>, verifique mayúsculas y guiones (ej. <code>IDEXSAM-2026-DPW-S1-001</code>).</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderError() {
    return `
        <div class="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-md">
            <div class="flex items-start gap-4">
                <div class="flex-shrink-0 mt-0.5">
                    <svg class="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                </div>
                <div>
                    <p class="font-bold text-amber-800 text-sm">No se pudo acceder a los registros en este momento</p>
                    <p class="text-xs text-amber-700 mt-1">Por favor compruebe su conexión o intente nuevamente en unos instantes.</p>
                </div>
            </div>
        </div>
    `;
}

/* =========================================================================
   BÚSQUEDA Y VERIFICACIÓN
========================================================================= */
async function buscarPorApi(query) {
    const res = await fetch(`/api/verificar?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
    const data = await res.json();

    if (!data.encontrado || !Array.isArray(data.grupos)) {
        return [];
    }

    const grupos = [];
    for (const g of data.grupos) {
        const sem = obtenerSeminario(g.seminarioId);
        if (sem) {
            grupos.push({ sem, registros: g.registros });
        }
    }
    return grupos;
}

function buscarEnCacheLocal(query) {
    const queryDni = normalizarDni(query);
    const queryCodigo = sanitizarEntrada(query).toLowerCase();
    const grupos = [];

    for (const sem of SEMINARIOS) {
        if (sem.activo === false) continue;
        const semCache = cacheLocal[sem.id];
        if (!semCache) continue;

        let coincidencias = [];
        if (queryDni && /^\d{8}$/.test(queryDni) && semCache.indiceDni.has(queryDni)) {
            coincidencias = semCache.indiceDni.get(queryDni);
        } else if (semCache.indiceCodigo.has(queryCodigo)) {
            coincidencias = semCache.indiceCodigo.get(queryCodigo);
        }

        if (coincidencias && coincidencias.length > 0) {
            grupos.push({ sem, registros: coincidencias });
        }
    }

    return grupos;
}

async function verificarCertificado() {
    const input = document.getElementById('inputBusqueda');
    const valorOriginal = sanitizarEntrada(input ? input.value : '');
    const contenedor = document.getElementById('contenedorResultado');

    limpiarError();

    if (!valorOriginal) {
        mostrarError('Ingrese su número de DNI (8 dígitos) o el Código de Certificado.');
        if (input) input.focus();
        return;
    }

    const soloNumeros = /^\d+$/.test(valorOriginal);
    if (soloNumeros && valorOriginal.length !== 8) {
        mostrarError('El DNI ingresado debe tener exactamente 8 dígitos.');
        if (input) input.focus();
        return;
    }

    if (!soloNumeros && valorOriginal.length < 5) {
        mostrarError('El código de certificado ingresado es demasiado corto.');
        if (input) input.focus();
        return;
    }

    try {
        contenedor.classList.remove('hidden');
        contenedor.innerHTML = `
            <div class="flex justify-center items-center py-10" role="status">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                <span class="ml-3 text-sm font-medium text-slate-600">Consultando registros oficiales...</span>
            </div>
        `;
        contenedor.style.opacity = '1';
        contenedor.style.transform = 'scale(1)';

        let grupos = [];

        if (usaApiServerless) {
            try {
                grupos = await buscarPorApi(valorOriginal);
            } catch (_) {
                usaApiServerless = false;
                await cargarPadronesLocales();
                grupos = buscarEnCacheLocal(valorOriginal);
            }
        } else {
            if (Object.keys(cacheLocal).length === 0) {
                await cargarPadronesLocales();
            }
            grupos = buscarEnCacheLocal(valorOriginal);
        }

        await new Promise(r => setTimeout(r, 200));

        if (grupos.length > 0) {
            contenedor.innerHTML = renderResultados(grupos, valorOriginal);
        } else {
            contenedor.innerHTML = renderNoEncontrado(valorOriginal);
        }
    } catch (err) {
        console.error('Error al verificar:', err);
        contenedor.innerHTML = renderError();
    }
}

/* =========================================================================
   INICIALIZACIÓN Y EVENTOS
========================================================================= */
document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('formBusqueda');
    const input = document.getElementById('inputBusqueda');

    // Cargar catálogo centralizado de seminarios
    await inicializarCatalogo();

    // Manejar envío accesible con formulario
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            verificarCertificado();
        });
    }

    // Limpiar errores mientras el usuario escribe
    if (input) {
        input.addEventListener('input', () => {
            limpiarError();
        });
    }

    // Precargar padrones para el conteo global
    cargarPadronesLocales();

    // Soporte para lectura de parámetros en URL (QR Codes)
    const urlParams = new URLSearchParams(window.location.search);
    const parametroBusqueda = urlParams.get('q') || urlParams.get('dni') || urlParams.get('codigo');

    if (parametroBusqueda && input) {
        input.value = parametroBusqueda;
        setTimeout(() => {
            verificarCertificado();
        }, 150);
    }
});
