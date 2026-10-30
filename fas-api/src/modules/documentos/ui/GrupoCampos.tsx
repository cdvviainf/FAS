interface CampoDef {
  label: string
  valor: React.ReactNode
}

interface GrupoCamposProps {
  titulo: string
  campos: CampoDef[]
  // Opcional: si se entrega, los campos se reparten en DOS columnas bajo un
  // único título (`campos` a la izquierda, `camposCol2` a la derecha). Útil para
  // bloques largos como "Transporte" sin apilar todo en una sola columna.
  camposCol2?: CampoDef[]
}

function Campos({ campos }: { campos: CampoDef[] }) {
  return (
    <div className='doc-campos'>
      {campos.map((c, i) => (
        <div className='doc-campo' key={i}>
          <span className='doc-campo-label'>{c.label}</span>
          <span className='doc-campo-valor'>{c.valor}</span>
        </div>
      ))}
    </div>
  )
}

// Bloque titulado de pares label/valor — cubre "Exportador", "Proveedor",
// "Tipo de compra", "Embarque", etc. del ejemplo real sin un componente nuevo
// por sección. Con `camposCol2`, reparte en dos columnas bajo el mismo título.
export function GrupoCampos({ titulo, campos, camposCol2 }: GrupoCamposProps) {
  return (
    <div className='doc-grupo'>
      <div className='doc-grupo-titulo'>{titulo}</div>
      {camposCol2 ? (
        <div className='doc-fila-grupos'>
          <Campos campos={campos} />
          <Campos campos={camposCol2} />
        </div>
      ) : (
        <Campos campos={campos} />
      )}
    </div>
  )
}
