const fs = require('fs');
const path = require('path');

// Cargar padrones en memoria para respuesta ultra rápida
let padronesCache = null;
let catalogoCache = null;

function sanitizarTexto(val) {
    return String(val || '').trim();
}

function normalizarDni(val) {
    return sanitizarTexto(val).replace(/\D/g, '').slice(0, 8);
}

function obtenerCatalogoSeminarios() {
    if (catalogoCache) return catalogoCache;

    const baseDir = process.cwd();
    const configPath = path.join(baseDir, 'data', 'seminarios.json');

    if (fs.existsSync(configPath)) {
        try {
            let contenido = fs.readFileSync(configPath, 'utf8');
            if (contenido.charCodeAt(0) === 0xFEFF) contenido = contenido.slice(1);
            catalogoCache = JSON.parse(contenido);
            return catalogoCache;
        } catch (e) {
            console.error('Error al leer data/seminarios.json:', e);
        }
    }

    // Configuración por defecto de respaldo
    catalogoCache = [
        { id: 'office-avanzado', jsonFile: 'data/certificados/certi_office_2026.json' },
        { id: 'senatic-vii', jsonFile: 'data/certificados/certi_senatic_vii_2026.json' }
    ];
    return catalogoCache;
}

function cargarPadrones() {
    if (padronesCache) return padronesCache;

    const baseDir = process.cwd();
    const seminarios = obtenerCatalogoSeminarios();
    padronesCache = {};

    for (const sem of seminarios) {
        if (sem.activo === false) continue;

        try {
            const archivo = sem.jsonFile || `${sem.id}.json`;
            let filePath = path.join(baseDir, archivo);

            if (!fs.existsSync(filePath)) {
                filePath = path.join(baseDir, 'data', 'certificados', path.basename(archivo));
            }
            if (!fs.existsSync(filePath)) {
                filePath = path.join(baseDir, path.basename(archivo));
            }

            if (fs.existsSync(filePath)) {
                let contenido = fs.readFileSync(filePath, 'utf8');
                if (contenido.charCodeAt(0) === 0xFEFF) contenido = contenido.slice(1);
                padronesCache[sem.id] = JSON.parse(contenido);
            } else {
                console.warn(`No se encontró el archivo de padrón para ${sem.id} en ${filePath}`);
                padronesCache[sem.id] = [];
            }
        } catch (e) {
            console.error(`Error cargando padrón de ${sem.id}:`, e);
            padronesCache[sem.id] = [];
        }
    }

    return padronesCache;
}

module.exports = function handler(req, res) {
    // Cabeceras CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const q = sanitizarTexto(req.query.q || req.query.dni || req.query.codigo);
    if (!q) {
        return res.status(400).json({ error: 'Parámetro de búsqueda requerido' });
    }

    const dniQuery = normalizarDni(q);
    const codigoQuery = q.toLowerCase();

    const padrones = cargarPadrones();
    const resultados = [];

    for (const [seminarioId, lista] of Object.entries(padrones)) {
        const coincidencias = lista.filter(item => {
            const dniItem = normalizarDni(item.dni);
            const codigoItem = sanitizarTexto(item.codigo).toLowerCase();
            return (dniQuery && dniItem === dniQuery) || (codigoItem && codigoItem === codigoQuery);
        });

        if (coincidencias.length > 0) {
            resultados.push({
                seminarioId,
                registros: coincidencias
            });
        }
    }

    return res.status(200).json({
        encontrado: resultados.length > 0,
        query: q,
        grupos: resultados
    });
};
