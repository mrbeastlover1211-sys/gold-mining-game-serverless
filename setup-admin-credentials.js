#!/usr/bin/env node

/**
 * Setup Admin Credentials for Secure Admin Panel
 * 
 * This script generates secure credentials for your admin panel.
 * Run this once to set up your admin access.
 */

import crypto from 'crypto';
import readline from 'readline';
import fs from 'fs';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

async function setup() {
  console.log('\n🔐 Secure Admin Panel Setup\n');
  console.log('This will generate credentials for your admin panel.');
  console.log('Store these values in your Vercel environment variables.\n');

  // Get username
  const username = await question('Enter admin username (default: admin): ') || 'admin';

  // Get password
  let password = '';
  let passwordConfirm = '';
  
  do {
    password = await question('\nEnter admin password (min 12 characters): ');
    
    if (password.length < 12) {
      console.log('❌ Password must be at least 12 characters long!');
      continue;
    }
    
    passwordConfirm = await question('Confirm password: ');
    
    if (password !== passwordConfirm) {
      console.log('❌ Passwords do not match! Try again.');
    }
  } while (password !== passwordConfirm || password.length < 12);

  // Generate salt and hash
  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);

  console.log('\n✅ Credentials generated successfully!\n');
  console.log('═'.repeat(80));
  console.log('\n📋 ADD THESE TO YOUR VERCEL ENVIRONMENT VARIABLES:\n');
  console.log('═'.repeat(80));
  console.log('\nVariable Name: ADMIN_USERNAME');
  console.log(`Value: ${username}`);
  console.log('\n─'.repeat(80));
  console.log('\nVariable Name: ADMIN_PASSWORD_HASH');
  console.log(`Value: ${passwordHash}`);
  console.log('\n─'.repeat(80));
  console.log('\nVariable Name: ADMIN_SALT');
  console.log(`Value: ${salt}`);
  console.log('\n─'.repeat(80));
  console.log('\nVariable Name: FRONTEND_URL');
  console.log(`Value: https://your-domain.vercel.app`);
  console.log('\n═'.repeat(80));

  console.log('\n📝 SETUP INSTRUCTIONS:\n');
  console.log('1. Go to your Vercel project dashboard');
  console.log('2. Navigate to Settings → Environment Variables');
  console.log('3. Add each variable above with its corresponding value');
  console.log('4. Redeploy your application');
  console.log('5. Access your admin panel at: https://your-domain.vercel.app/admin-secure.html');
  console.log('\n⚠️  IMPORTANT: Keep these credentials secure and never commit them to git!\n');

  // Optional: Save to .env.local for local development
  const saveLocal = await question('\nSave to .env.local for local development? (y/n): ');
  
  if (saveLocal.toLowerCase() === 'y') {
    const envContent = `
# Admin Panel Credentials (DO NOT COMMIT TO GIT)
ADMIN_USERNAME=${username}
ADMIN_PASSWORD_HASH=${passwordHash}
ADMIN_SALT=${salt}
FRONTEND_URL=http://localhost:3000
`;
    
    fs.appendFileSync('.env.local', envContent);
    console.log('\n✅ Credentials saved to .env.local');
    console.log('⚠️  Make sure .env.local is in your .gitignore!\n');
  }

  rl.close();
}

// Run setup
setup().catch(error => {
  console.error('\n❌ Setup failed:', error);
  rl.close();
  process.exit(1);
});
