-- CreateEnum
CREATE TYPE "RouterStatus" AS ENUM ('UNKNOWN', 'ONLINE', 'OFFLINE');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "installationDate" TIMESTAMP(3),
ADD COLUMN     "odp" TEXT,
ADD COLUMN     "pppoeUsername" TEXT,
ADD COLUMN     "routerId" TEXT;

-- CreateTable
CREATE TABLE "Spk" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "workType" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'NEW',
    "customerId" TEXT,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Spk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "spkNumber" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Router" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "managementAddress" TEXT NOT NULL,
    "location" TEXT,
    "version" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "RouterStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Router_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Spk_number_key" ON "Spk"("number");

-- CreateIndex
CREATE INDEX "Spk_status_createdAt_idx" ON "Spk"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Spk_assigneeId_status_idx" ON "Spk"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Router_name_key" ON "Router"("name");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_routerId_fkey" FOREIGN KEY ("routerId") REFERENCES "Router"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spk" ADD CONSTRAINT "Spk_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spk" ADD CONSTRAINT "Spk_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
