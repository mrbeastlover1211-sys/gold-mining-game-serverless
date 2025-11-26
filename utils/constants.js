// Environment variables are automatically available in Vercel

export const SOLANA_CLUSTER_URL = process.env.SOLANA_CLUSTER_URL || 'https://api.devnet.solana.com';
export const TREASURY_PUBLIC_KEY = process.env.TREASURY_PUBLIC_KEY || '';
export const TREASURY_SECRET_KEY = process.env.TREASURY_SECRET_KEY || '';
export const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
export let GOLD_PRICE_SOL = parseFloat(process.env.GOLD_PRICE_SOL || '0.000001');
export const MIN_SELL_GOLD = parseInt(process.env.MIN_SELL_GOLD || '10000', 10);

export const PICKAXES = {
  silver: { name: 'Silver', costSol: 0.001, ratePerSec: 1/60 },
  gold: { name: 'Gold', costSol: 0.001, ratePerSec: 10/60 },
  diamond: { name: 'Diamond', costSol: 0.001, ratePerSec: 100/60 },
  netherite: { name: 'Netherite', costSol: 0.001, ratePerSec: 1000/60 },
};