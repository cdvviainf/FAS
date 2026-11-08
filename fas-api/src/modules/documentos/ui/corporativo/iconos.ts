// Íconos SVG inline de la OC v3 (2026-11-06). Trazo simple (stroke) en el
// color actual — sin red ni fuentes de íconos externas: el render de
// Playwright no toca la red (Etapa 4 §6).
const svg = (cuerpo: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${cuerpo}</svg>`

export const ICONOS = {
  documento: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6M9 9h2"/>'),
  monedas: svg('<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v4c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 10v4c0 1.7 3.1 3 7 3s7-1.3 7-3v-4"/><path d="M5 14v4c0 1.7 3.1 3 7 3s7-1.3 7-3v-4"/>'),
  caja: svg('<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>'),
  calendario: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M7 14h2M11 14h2M15 14h2M7 18h2M11 18h2"/>'),
  factura: svg('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>'),
  comentario: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 21 12z"/>'),
  medalla: svg('<circle cx="12" cy="9" r="6"/><path d="M12 6l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5L11 8z"/><path d="M8.5 14L7 21l5-3 5 3-1.5-7"/>'),
  hoja: svg('<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19l8-8"/>'),
  barco: svg('<path d="M3 17l2 4h14l2-4-9-3z"/><path d="M6 15V9h12v6"/><path d="M9 9V5h6v4"/><path d="M12 9v5"/>'),
  aceptacion: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 14l2 2 4-4"/>'),
  edificio: svg('<path d="M3 21h18"/><path d="M5 21V8l7-4 7 4v13"/><path d="M9 21v-6h6v6"/><path d="M9 10h.01M15 10h.01"/>'),
  persona: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),
  globo: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/>'),
  tarjeta: svg('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>'),
  pin: svg('<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>'),
  ancla: svg('<circle cx="12" cy="5" r="2"/><path d="M12 7v14"/><path d="M5 13a7 7 0 0 0 14 0"/><path d="M8 11h8"/>'),
  escudo: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'),
  camion: svg('<path d="M3 6h11v10H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>'),
  alerta: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>'),
} as const

export type NombreIcono = keyof typeof ICONOS
