/**
 * Catálogo y Recursos de Seminarios Académicos
 * IDEX SAM - Sistema de Validación de Certificados
 */

const ICONOS = {
    documento: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/>',
    grafico: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/>',
    barras: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2h-2a2 2 0 0 1-2-2z"/>',
    email: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"/>',
    presentacion: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 0 1-4-4V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v12a4 4 0 0 1-4 4zm0 0h12a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 0 1 2.828 0l2.829 2.829a2 2 0 0 1 0 2.828l-8.486 8.485M7 17h.01"/>',
    rayo: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>',
    seguridad: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>',
    codigo: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>'
};

const TAILWIND_COLORS = {
    sky: {
        badgeBg: 'bg-sky-100',
        badgeText: 'text-sky-700',
        badgeDot: 'bg-sky-500',
        iconBg: 'bg-sky-100',
        iconText: 'text-sky-600'
    },
    blue: {
        badgeBg: 'bg-blue-100',
        badgeText: 'text-blue-700',
        badgeDot: 'bg-blue-500',
        iconBg: 'bg-blue-100',
        iconText: 'text-blue-600'
    },
    indigo: {
        badgeBg: 'bg-indigo-100',
        badgeText: 'text-indigo-700',
        badgeDot: 'bg-indigo-500',
        iconBg: 'bg-indigo-100',
        iconText: 'text-indigo-600'
    },
    emerald: {
        badgeBg: 'bg-emerald-100',
        badgeText: 'text-emerald-700',
        badgeDot: 'bg-emerald-500',
        iconBg: 'bg-emerald-100',
        iconText: 'text-emerald-600'
    },
    violet: {
        badgeBg: 'bg-violet-100',
        badgeText: 'text-violet-700',
        badgeDot: 'bg-violet-500',
        iconBg: 'bg-violet-100',
        iconText: 'text-violet-600'
    },
    amber: {
        badgeBg: 'bg-amber-100',
        badgeText: 'text-amber-700',
        badgeDot: 'bg-amber-500',
        iconBg: 'bg-amber-100',
        iconText: 'text-amber-600'
    }
};

// Respaldo estático inicial (se sobrescribe dinámicamente desde data/seminarios.json)
let SEMINARIOS = [
    {
        id: "office-avanzado",
        tabLabel: "Office Avanzado",
        titulo: "Seminario de Office Avanzado",
        edicion: "",
        badgeColor: "sky",
        jsonFile: "data/certificados/certi_office_2026.json",
        horas: "120 Horas Académicas",
        creditos: "4 Créditos",
        modalidad: "Virtual — Google Meet y Facebook Live"
    },
    {
        id: "senatic-vii",
        tabLabel: "SENATIC VII",
        titulo: "Seminario Nacional en Tecnologías de Información y Comunicaciones",
        edicion: "Séptima Edición",
        badgeColor: "indigo",
        jsonFile: "data/certificados/certi_senatic_vii_2026.json",
        horas: "120 Horas Académicas",
        creditos: "4 Créditos",
        modalidad: "Virtual — Google Meet y Facebook Live"
    }
];
