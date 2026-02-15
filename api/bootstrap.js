// 🚀 Bootstrap API - Single request to load initial user state
// Combines: status + land status + referral stats + referral link

import { getUserOptimized, sql } from '../database.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'address required' });

    // Always fetch fresh (truth-critical state)
    const user = await getUserOptimized(address, false);

    // Deterministic referral link (no need for extra API)
    const referralLink = `https://www.thegoldmining.com/?ref=${address}`;

    if (!user) {
      return res.json({
        success: true,
        address,
        referralLink,
        status: {
          address,
          inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 },
          totalRate: 0,
          gold: '0.00000',
          hasLand: false,
          checkpoint: {
            total_mining_power: 0,
            checkpoint_timestamp: Math.floor(Date.now() / 1000),
            last_checkpoint_gold: 0
          }
        },
        landStatus: { hasLand: false, landPurchaseDate: null },
        referralStatus: {
          total_referrals: 0,
          completed_referrals: 0,
          total_gold_earned: 0
        }
      });
    }

    const inventory = {
      silver: user.silver_pickaxes || 0,
      gold: user.gold_pickaxes || 0,
      diamond: user.diamond_pickaxes || 0,
      netherite: user.netherite_pickaxes || 0
    };

    const currentTime = Math.floor(Date.now() / 1000);
    const checkpointTime = user.checkpoint_timestamp || currentTime;
    const timeSinceCheckpoint = currentTime - checkpointTime;
    const miningPower = user.total_mining_power || 0;
    const goldPerSecond = miningPower / 60;
    const goldMined = goldPerSecond * timeSinceCheckpoint;
    const baseGold = parseFloat(user.last_checkpoint_gold || 0);
    const currentGold = baseGold + goldMined;
    const safeGold = isFinite(currentGold) ? currentGold : 0;

    const totalRate = inventory.silver * 1 +
      inventory.gold * 10 +
      inventory.diamond * 100 +
      inventory.netherite * 1000;

    // Lightweight referral stats (fast)
    const referrerStats = await sql`
      SELECT 
        COUNT(*) as total_referrals,
        COUNT(*) as completed_referrals,
        COALESCE(SUM(reward_amount), 0) as total_gold_earned
      FROM referrals 
      WHERE referrer_address = ${address}
        AND status IN ('completed', 'active')
    `;

    const stats = referrerStats[0] || { total_referrals: 0, completed_referrals: 0, total_gold_earned: 0 };

    return res.json({
      success: true,
      address,
      referralLink,
      status: {
        address,
        inventory,
        totalRate,
        gold: safeGold.toFixed(5),
        hasLand: user.has_land || false,
        checkpoint: {
          total_mining_power: user.total_mining_power || 0,
          checkpoint_timestamp: user.checkpoint_timestamp || currentTime,
          last_checkpoint_gold: user.last_checkpoint_gold || 0
        }
      },
      landStatus: {
        hasLand: user.has_land || false,
        landPurchaseDate: user.land_purchase_date || null
      },
      referralStatus: {
        total_referrals: parseInt(stats.total_referrals),
        completed_referrals: parseInt(stats.completed_referrals),
        total_gold_earned: parseFloat(stats.total_gold_earned)
      }
    });
  } catch (e) {
    console.error('❌ Bootstrap API error:', e);
    return res.status(500).json({ error: 'Bootstrap API error', details: e.message });
  }
}
