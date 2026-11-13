// Contactos documentales de una Entidad (2026-11-11/12): los marcados
// `esDocumental` o, por compatibilidad, con "Documental/Documentos…" en el
// tipo (texto libre, sin tildes ni mayúsculas). Los usan el Instructivo de
// Embarque y la Proforma (Exportador, Consignatario, Notify).
export interface ContactoDocumental {
  nombre: string
  telefono: string | null
  email: string | null
}

export function esContactoDocumental(c: { tipo?: string | null; esDocumental?: boolean | null }): boolean {
  if (c.esDocumental) return true
  if (!c.tipo) return false
  return c.tipo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes('document')
}

export function contactosDocumentales(
  contactos: { nombre: string; telefono: string | null; email: string | null; tipo?: string | null; esDocumental?: boolean | null }[] | undefined,
): ContactoDocumental[] {
  return (contactos ?? [])
    .filter(esContactoDocumental)
    .map((c) => ({ nombre: c.nombre, telefono: c.telefono ?? null, email: c.email ?? null }))
}
