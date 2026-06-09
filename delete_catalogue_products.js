const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const catalogue = await prisma.catalogue.findFirst({
    where: { catalogue: { contains: 'bulk', mode: 'insensitive' } }
  });

  if (!catalogue) {
    console.log('Catalogue not found.');
    return;
  }

  console.log(`Found catalogue: ${catalogue.catalogue} (ID: ${catalogue.catalogueId})`);

  const deleted = await prisma.product.deleteMany({
    where: { catalogueId: catalogue.catalogueId }
  });

  console.log(`Deleted ${deleted.count} products from the catalogue.`);
}

main().catch(e => {
  console.error(e);
}).finally(async () => {
  await prisma.$disconnect();
});
