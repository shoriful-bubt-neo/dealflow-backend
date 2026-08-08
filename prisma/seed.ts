import "dotenv/config";
import prisma from "../src/config/prisma.js";

const V1_CONTENT = `Buyer sends funds into escrow. Seller delivers the item or service as agreed. Admin releases payment to the seller only after delivery confirmation (or per dispute resolution). Both parties must act in good faith. Fraud, misrepresentation, or abuse may result in account suspension and forfeiture per platform policy. All disputes are mediated by Secure Deals BD admin. By accepting, you agree to these deal terms for this transaction.`;

async function main() {
  await prisma.agreementTemplate.upsert({
    where: { version: "1.0.0" },
    update: {
      title: "Deal Terms",
      content: V1_CONTENT,
      isActive: true,
    },
    create: {
      version: "1.0.0",
      title: "Deal Terms",
      content: V1_CONTENT,
      isActive: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
