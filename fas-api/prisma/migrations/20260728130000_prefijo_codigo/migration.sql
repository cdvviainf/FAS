-- CreateTable
CREATE TABLE "prefijos_codigo" (
    "id" SERIAL NOT NULL,
    "modelo" TEXT NOT NULL,
    "prefijo" TEXT NOT NULL,
    "digitos" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "prefijos_codigo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: único solo entre filas activas (no representable en el DSL de
-- Prisma) — permite recrear un prefijo para el mismo modelo tras un soft
-- delete, sin perder la protección contra duplicados concurrentes
-- (FAS-PMQ-R1-006).
CREATE UNIQUE INDEX "prefijos_codigo_modelo_activo_key" ON "prefijos_codigo"("modelo") WHERE "eliminadoEn" IS NULL;
