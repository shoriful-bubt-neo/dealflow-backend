/*
  Warnings:

  - A unique constraint covering the columns `[payment_method_id,min_amount,version]` on the table `service_charge_configs` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "service_charge_configs_payment_method_id_version_key";

-- AlterTable
ALTER TABLE "service_charge_configs" ADD COLUMN     "max_amount" DECIMAL(18,2),
ADD COLUMN     "min_amount" DECIMAL(18,2) NOT NULL DEFAULT 0.00;

-- CreateIndex
CREATE UNIQUE INDEX "service_charge_configs_payment_method_id_min_amount_version_key" ON "service_charge_configs"("payment_method_id", "min_amount", "version");
