interface LineaTotal {
  etiqueta: string
  valor: React.ReactNode
}

interface BloqueTotalesProps {
  lineas: LineaTotal[]
  neto?: LineaTotal
}

export function BloqueTotales({ lineas, neto }: BloqueTotalesProps) {
  return (
    <div className='doc-totales'>
      {lineas.map((l, i) => (
        <div className='doc-totales-linea' key={i}>
          <span>{l.etiqueta}</span>
          <span className='doc-num'>{l.valor}</span>
        </div>
      ))}
      {neto && (
        <div className='doc-totales-neto'>
          <span>{neto.etiqueta}</span>
          <span className='doc-num'>{neto.valor}</span>
        </div>
      )}
    </div>
  )
}
