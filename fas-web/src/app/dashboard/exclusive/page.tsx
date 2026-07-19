'use client';

import PageContainer from '@/components/layout/page-container';

export default function ExclusivePage() {
  return (
    <PageContainer
      pageTitle='Exclusive'
      pageDescription='Área exclusiva'
    >
      <div className='bg-muted rounded-lg p-6 text-center text-sm'>
        Funcionalidad no disponible en esta versión.
      </div>
    </PageContainer>
  );
}
