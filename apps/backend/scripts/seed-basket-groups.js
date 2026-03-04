#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const prisma = require('../src/utils/prisma');

function parseCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split(',').map((cell) => cell.trim()));
  return { headers, rows };
}

async function main() {
  const csvPath = path.resolve('../../old-software/basket/basket.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error(`basket.csv not found at ${csvPath}`);
  }

  const { headers, rows } = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  if (!headers.length) {
    throw new Error('basket.csv is empty or invalid');
  }

  for (let col = 0; col < headers.length; col++) {
    const groupName = headers[col];
    const symbols = rows
      .map((r) => (r[col] || '').trim())
      .filter((value) => value.length > 0);

    const existing = await prisma.basketGroup.findFirst({
      where: {
        name: groupName,
        isSystem: true,
        ownerId: null,
      },
      select: { id: true },
    });

    const group = existing
      ? await prisma.basketGroup.update({
        where: { id: existing.id },
        data: {
          description: `Seeded from basket.csv (${groupName})`,
          isSystem: true,
          ownerId: null,
        },
        select: { id: true },
      })
      : await prisma.basketGroup.create({
        data: {
          name: groupName,
          description: `Seeded from basket.csv (${groupName})`,
          isSystem: true,
          ownerId: null,
        },
        select: { id: true },
      });

    await prisma.basketGroupSymbol.deleteMany({
      where: { basketGroupId: group.id },
    });

    if (symbols.length > 0) {
      await prisma.basketGroupSymbol.createMany({
        data: symbols.map((symbol, idx) => ({
          basketGroupId: group.id,
          symbol: symbol.toUpperCase(),
          position: idx + 1,
        })),
      });
    }

    console.log(`Seeded basket group "${groupName}" with ${symbols.length} symbols`);
  }
}

main()
  .catch((error) => {
    console.error('Failed to seed basket groups:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
