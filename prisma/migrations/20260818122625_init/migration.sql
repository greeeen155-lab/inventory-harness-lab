-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '개',
    "expiryAlertDays" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Location" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastReflectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lot_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Movement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "productId" INTEGER NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "quantity" INTEGER NOT NULL,
    "fromLocationId" INTEGER,
    "toLocationId" INTEGER,
    "transferId" INTEGER,
    "popupId" INTEGER,
    "reversalOfId" INTEGER,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Movement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Movement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Movement_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Movement_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Movement_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Movement_popupId_fkey" FOREIGN KEY ("popupId") REFERENCES "Popup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Movement_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "Movement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fromLocationId" INTEGER NOT NULL,
    "toLocationId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "note" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" DATETIME,
    "sentById" INTEGER NOT NULL,
    "receivedById" INTEGER,
    CONSTRAINT "Transfer_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transfer_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transfer_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transfer_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransferLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "transferId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "sentQty" INTEGER NOT NULL,
    "receivedQty" INTEGER,
    CONSTRAINT "TransferLine_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransferLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Popup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREP',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "locationId" INTEGER NOT NULL,
    "sourceLocationId" INTEGER NOT NULL,
    "settledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Popup_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Popup_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PopupPlan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "popupId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "plannedQty" INTEGER NOT NULL,
    CONSTRAINT "PopupPlan_popupId_fkey" FOREIGN KEY ("popupId") REFERENCES "Popup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PopupPlan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Lot_locationId_expiryDate_idx" ON "Lot"("locationId", "expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_productId_locationId_expiryDate_key" ON "Lot"("productId", "locationId", "expiryDate");

-- CreateIndex
CREATE INDEX "Movement_createdAt_idx" ON "Movement"("createdAt");

-- CreateIndex
CREATE INDEX "Movement_productId_createdAt_idx" ON "Movement"("productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Popup_locationId_key" ON "Popup"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "PopupPlan_popupId_productId_key" ON "PopupPlan"("popupId", "productId");
