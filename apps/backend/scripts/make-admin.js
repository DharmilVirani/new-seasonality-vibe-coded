/**
 * Make a user an admin
 * Usage: node scripts/make-admin.js <email>
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function makeAdmin(email) {
  if (!email) {
    console.log('Usage: node scripts/make-admin.js <email>');
    process.exit(1);
  }

  try {
    const user = await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { 
        role: 'admin',
        subscriptionTier: 'enterprise',
        subscriptionExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
    });

    console.log(`✅ User ${user.email} is now an admin with enterprise subscription`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Tier: ${user.subscriptionTier}`);
  } catch (error) {
    if (error.code === 'P2025') {
      console.error(`❌ User with email "${email}" not found`);
    } else {
      console.error('Error:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

makeAdmin(process.argv[2]);
