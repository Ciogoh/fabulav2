-- CreateTable
CREATE TABLE "LandingContent" (
    "id" TEXT NOT NULL,
    "abstractEn" TEXT NOT NULL,
    "abstractIt" TEXT NOT NULL,
    "abstractDe" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingContent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LandingContent" ADD CONSTRAINT "LandingContent_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

