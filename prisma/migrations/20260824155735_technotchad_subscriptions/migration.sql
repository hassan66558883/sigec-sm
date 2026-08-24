-- CreateTable
CREATE TABLE "TechnoClient" (
    "id" TEXT NOT NULL,
    "clientCode" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "commercialName" TEXT,
    "clientType" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Tchad',
    "city" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "contactPerson" TEXT,
    "taxNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnoClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnoProduct" (
    "id" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT,
    "productType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnoProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnoProductModule" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "moduleCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TechnoProductModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnoSubscriptionPlan" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "billingPeriod" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "maxUsers" INTEGER,
    "maxSites" INTEGER,
    "maxModules" INTEGER,
    "setupFee" DOUBLE PRECISION DEFAULT 0,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnoSubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnoContract" (
    "id" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "contractTitle" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "contractAmount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "paymentTerms" TEXT,
    "renewalType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "documentUrl" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnoContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnoSubscription" (
    "id" TEXT NOT NULL,
    "subscriptionNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "contractId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "nextBillingDate" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "gracePeriodEnd" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "terminationReason" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnoSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnoSubscriptionModule" (
    "subscriptionId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "activationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expirationDate" TIMESTAMP(3),

    CONSTRAINT "TechnoSubscriptionModule_pkey" PRIMARY KEY ("subscriptionId","moduleId")
);

-- CreateTable
CREATE TABLE "TechnoSubscriptionUser" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "TechnoSubscriptionUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnoSubscriptionSite" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "siteCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnoSubscriptionSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnoLicense" (
    "id" TEXT NOT NULL,
    "licenseKey" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "licenseType" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUsers" INTEGER,
    "maxSites" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "activationToken" TEXT,
    "lastValidationAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnoLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnoSubscriptionRenewal" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "oldEndDate" TIMESTAMP(3) NOT NULL,
    "newStartDate" TIMESTAMP(3) NOT NULL,
    "newEndDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION,
    "renewedById" TEXT,
    "renewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnoSubscriptionRenewal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TechnoClient_clientCode_key" ON "TechnoClient"("clientCode");

-- CreateIndex
CREATE INDEX "TechnoClient_status_idx" ON "TechnoClient"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TechnoProduct_productCode_key" ON "TechnoProduct"("productCode");

-- CreateIndex
CREATE INDEX "TechnoProduct_status_idx" ON "TechnoProduct"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TechnoProductModule_productId_moduleCode_key" ON "TechnoProductModule"("productId", "moduleCode");

-- CreateIndex
CREATE UNIQUE INDEX "TechnoSubscriptionPlan_productId_planCode_key" ON "TechnoSubscriptionPlan"("productId", "planCode");

-- CreateIndex
CREATE UNIQUE INDEX "TechnoContract_contractNumber_key" ON "TechnoContract"("contractNumber");

-- CreateIndex
CREATE INDEX "TechnoContract_clientId_idx" ON "TechnoContract"("clientId");

-- CreateIndex
CREATE INDEX "TechnoContract_status_idx" ON "TechnoContract"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TechnoSubscription_subscriptionNumber_key" ON "TechnoSubscription"("subscriptionNumber");

-- CreateIndex
CREATE INDEX "TechnoSubscription_clientId_idx" ON "TechnoSubscription"("clientId");

-- CreateIndex
CREATE INDEX "TechnoSubscription_status_idx" ON "TechnoSubscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TechnoSubscriptionUser_subscriptionId_userId_key" ON "TechnoSubscriptionUser"("subscriptionId", "userId");

-- CreateIndex
CREATE INDEX "TechnoSubscriptionSite_subscriptionId_idx" ON "TechnoSubscriptionSite"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "TechnoLicense_licenseKey_key" ON "TechnoLicense"("licenseKey");

-- CreateIndex
CREATE UNIQUE INDEX "TechnoLicense_subscriptionId_key" ON "TechnoLicense"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "TechnoLicense_activationToken_key" ON "TechnoLicense"("activationToken");

-- CreateIndex
CREATE INDEX "TechnoLicense_clientId_idx" ON "TechnoLicense"("clientId");

-- CreateIndex
CREATE INDEX "TechnoLicense_status_idx" ON "TechnoLicense"("status");

-- CreateIndex
CREATE INDEX "TechnoSubscriptionRenewal_subscriptionId_idx" ON "TechnoSubscriptionRenewal"("subscriptionId");

-- AddForeignKey
ALTER TABLE "TechnoProductModule" ADD CONSTRAINT "TechnoProductModule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "TechnoProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnoSubscriptionPlan" ADD CONSTRAINT "TechnoSubscriptionPlan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "TechnoProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnoContract" ADD CONSTRAINT "TechnoContract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "TechnoClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnoContract" ADD CONSTRAINT "TechnoContract_productId_fkey" FOREIGN KEY ("productId") REFERENCES "TechnoProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnoSubscription" ADD CONSTRAINT "TechnoSubscription_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "TechnoClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnoSubscription" ADD CONSTRAINT "TechnoSubscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "TechnoProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnoSubscription" ADD CONSTRAINT "TechnoSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TechnoSubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnoSubscription" ADD CONSTRAINT "TechnoSubscription_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "TechnoContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnoSubscriptionModule" ADD CONSTRAINT "TechnoSubscriptionModule_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "TechnoSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnoSubscriptionModule" ADD CONSTRAINT "TechnoSubscriptionModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "TechnoProductModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnoSubscriptionUser" ADD CONSTRAINT "TechnoSubscriptionUser_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "TechnoSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnoSubscriptionUser" ADD CONSTRAINT "TechnoSubscriptionUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnoSubscriptionSite" ADD CONSTRAINT "TechnoSubscriptionSite_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "TechnoSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnoSubscriptionSite" ADD CONSTRAINT "TechnoSubscriptionSite_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "TechnoClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnoLicense" ADD CONSTRAINT "TechnoLicense_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "TechnoSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnoLicense" ADD CONSTRAINT "TechnoLicense_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "TechnoClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnoLicense" ADD CONSTRAINT "TechnoLicense_productId_fkey" FOREIGN KEY ("productId") REFERENCES "TechnoProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnoSubscriptionRenewal" ADD CONSTRAINT "TechnoSubscriptionRenewal_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "TechnoSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

