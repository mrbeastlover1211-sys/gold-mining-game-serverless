#!/usr/bin/env node

/**
 * Simple Admin Credential Generator
 * Run: node generate-admin-credentials.js <username> <password>
 * Example: node generate-admin-credentials.js admin MySecurePass123!
 */

import crypto from 'crypto';

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

// Get username and password from command line args
const username = process.argv[2] || 'admin';
const password = process.argv[3];

if (!password) {
  console.error('\n❌ Error: Password is required!\n');
  console.log('Usage: node generate-admin-credentials.js <username> <password>\n');
  console.log('Example:');
  console.log('  node generate-admin-credentials.js admin MySecureP@ssword123!\n');
  console.log('Password requirements:');
  console.log('  - Minimum 12 characters');
  console.log('  - Mix of uppercase, lowercase, numbers, symbols (recommended)\n');
  process.exit(1);
}

if (password.length < 12) {
  console.error('\n❌ Error: Password must be at least 12 characters long!\n');
  process.exit(1);
}

console.log('\n🔐 Generating Secure Admin Credentials...\n');

// Generate salt and hash
const salt = generateSalt();
const passwordHash = hashPassword(password, salt);

console.log('✅ Credentials generated successfully!\n');
console.log('═'.repeat(80));
console.log('\n📋 ADD THESE TO YOUR VERCEL ENVIRONMENT VARIABLES:\n');
console.log('═'.repeat(80));
console.log('\n1. Variable Name: ADMIN_USERNAME');
console.log(`   Value: ${username}`);
console.log('\n' + '─'.repeat(80));
console.log('\n2. Variable Name: ADMIN_PASSWORD_HASH');
console.log(`   Value: ${passwordHash}`);
console.log('\n' + '─'.repeat(80));
console.log('\n3. Variable Name: ADMIN_SALT');
console.log(`   Value: ${salt}`);
console.log('\n' + '─'.repeat(80));
console.log('\n4. Variable Name: FRONTEND_URL');
console.log(`   Value: https://gold-mining-game-serverless.vercel.app`);
console.log('\n═'.repeat(80));

console.log('\n📝 NEXT STEPS:\n');
console.log('1. Copy the 4 variables above');
console.log('2. Go to: https://vercel.com/dashboard');
console.log('3. Select your project: gold-mining-game-serverless');
console.log('4. Go to Settings → Environment Variables');
console.log('5. Add each variable with its value');
console.log('6. Redeploy: vercel --prod\n');

console.log('⚠️  SECURITY REMINDER:');
console.log('  - Never commit these values to git');
console.log('  - Keep these credentials secure');
console.log('  - Only share with trusted administrators\n');

// Save to .env.local for local testing
import fs from 'fs';

try {
  const envContent = `
# Admin Panel Credentials (DO NOT COMMIT TO GIT)
# Generated: ${new Date().toISOString()}
ADMIN_USERNAME=${username}
ADMIN_PASSWORD_HASH=${passwordHash}
ADMIN_SALT=${salt}
FRONTEND_URL=http://localhost:3000
`;

  fs.appendFileSync('.env.local', envContent);
  console.log('✅ Also saved to .env.local for local development\n');
  console.log('⚠️  Make sure .env.local is in your .gitignore!\n');
} catch (error) {
  console.log('ℹ️  Could not save to .env.local (this is optional)\n');
}

console.log('🎉 Setup complete! Ready to deploy.\n');
