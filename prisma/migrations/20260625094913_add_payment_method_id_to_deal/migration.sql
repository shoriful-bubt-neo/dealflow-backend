-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "payment_method_id" INTEGER;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
