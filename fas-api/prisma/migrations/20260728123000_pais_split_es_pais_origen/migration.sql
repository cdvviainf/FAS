/*
  Warnings:

  - `esPaisOrigen` (booleano único, sobrecargado para dos usos distintos:
    validación RUT/comunas chilenas y filtro de puertos R9) se separa en dos
    campos independientes: `esPaisNacional` y `puedeSerOrigen`.
  - Antes de eliminar la columna vieja, se copia su valor a ambas columnas
    nuevas para preservar el comportamiento actual (ver QAS de esta sesión).

*/
-- AlterTable: agregar columnas nuevas ANTES de tocar la vieja, para poder
-- usar "paises"."esPaisOrigen" como fuente del backfill.
ALTER TABLE "paises" ADD COLUMN     "esPaisNacional" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "paises" ADD COLUMN     "puedeSerOrigen" BOOLEAN NOT NULL DEFAULT false;

-- DataMigration: preserva el comportamiento actual — el país marcado como
-- esPaisOrigen hereda ambos roles nuevos.
UPDATE "paises" SET "esPaisNacional" = "esPaisOrigen", "puedeSerOrigen" = "esPaisOrigen";

-- DropColumn
ALTER TABLE "paises" DROP COLUMN "esPaisOrigen";
