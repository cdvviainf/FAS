-- CreateTable
CREATE TABLE "usuarios_avatar" (
    "usuarioId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "datos" BYTEA NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_avatar_pkey" PRIMARY KEY ("usuarioId")
);

-- AddForeignKey
ALTER TABLE "usuarios_avatar" ADD CONSTRAINT "usuarios_avatar_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
