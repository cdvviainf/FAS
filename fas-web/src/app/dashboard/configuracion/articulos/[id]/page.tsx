import PageContainer from '@/components/layout/page-container'
import { ArticuloDetalleClient } from '@/features/materiales/articulos/components/articulo-detalle-client'

export const metadata = {
  title: 'FAS — Detalle de Artículo',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const id = parseInt(params.id, 10)

  return (
    <PageContainer
      pageTitle='Detalle de Artículo'
      pageDescription='Saldos por bodega, recetas y documentos adjuntos.'
    >
      <ArticuloDetalleClient articuloId={id} />
    </PageContainer>
  )
}
