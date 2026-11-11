-- Contacto documental (Instructivo de Embarque v4)
ALTER TABLE "entidad_contactos" ADD COLUMN "esDocumental" BOOLEAN NOT NULL DEFAULT false;

-- Retrocompatibilidad: los contactos cuyo tipo dice "Documental/Documentos" quedan marcados.
UPDATE "entidad_contactos" SET "esDocumental" = true
WHERE "tipo" IS NOT NULL AND lower(translate("tipo", 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) LIKE '%document%';
