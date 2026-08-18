interface CampoDef {
  label: string
  valor: React.ReactNode
}

interface GrupoCamposProps {
  titulo: string
  campos: CampoDef[]
}

// Bloque titulado de pares label/valor en grilla de 2 columnas — cubre
// "Exportador", "Proveedor", "Tipo de compra", "Embarque", etc. del ejemplo
// real (Docs/AGROSAN 002 -OC5.pdf) sin un componente nuevo por sección.
export function GrupoCampos({ titulo, campos }: GrupoCamposProps) {
  return (
    <div className='doc-grupo'>
      <div className='doc-grupo-titulo'>{titulo}</div>
      <div className='doc-campos'>
        {campos.map((c, i) => (
          <div className='doc-campo' key={i}>
            <span className='doc-campo-label'>{c.label}</span>
            <span className='doc-campo-valor'>{c.valor}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
