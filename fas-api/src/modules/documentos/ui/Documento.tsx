import { printCss } from './print-css.js'

interface DocumentoProps {
  titulo: string
  paginaOpts: { formato: 'A4' | 'Letter'; orientacion: 'portrait' | 'landscape'; margen: string }
  // Etapa 4 §8: "los documentos no emitidos salen con marca BORRADOR
  // diagonal. Las reimpresiones llevan COPIA y la fecha de reimpresión" —
  // evita que un preview o una reimpresión circulen como el documento
  // oficial. `marcaAguaFecha` solo aplica a COPIA (ya formateada, fmt.fecha).
  marcaAgua?: 'BORRADOR' | 'COPIA'
  marcaAguaFecha?: string
  piePagina: string
  children: React.ReactNode
}

// Envoltorio de documento HTML completo — TODAS las plantillas lo usan
// (Etapa 4 §5: "componentes compartidos... un ajuste de marca se hace una
// vez"). No hay <link>/<script> externos a propósito: el render no debe
// tocar la red (§6 "el render no toca la red: más rápido, funciona sin
// internet y es determinista").
export function Documento({ titulo, paginaOpts, marcaAgua, marcaAguaFecha, piePagina, children }: DocumentoProps) {
  return (
    <html lang='es-CL'>
      <head>
        <meta charSet='utf-8' />
        <title>{titulo}</title>
        <style dangerouslySetInnerHTML={{ __html: printCss(paginaOpts) }} />
      </head>
      <body>
        {marcaAgua && (
          <div className='doc-marca-agua'>
            {marcaAgua}
            {marcaAguaFecha && <div className='doc-marca-agua-fecha'>{marcaAguaFecha}</div>}
          </div>
        )}
        {children}
        <div className='doc-footer-empresa'>{piePagina}</div>
      </body>
    </html>
  )
}
