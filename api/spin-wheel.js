// 🎰 Spin Wheel API - Pay 1000 gold to spin for prizes
import { getUserOptimized, saveUserOptimized } from '../database.js';

const SPIN_COST = 1000; // Cost to spin in gold

// Wheel prizes with probabilities
const WHEEL_PRIZES = [
  { id: 'silver', name: 'Silver Pickaxe', type: 'pickaxe', value: 'silver', probability: 0.25 },
  { id: 'gold_pickaxe', name: 'Gold Pickaxe', type: 'pickaxe', value: 'gold', probability: 0.20 },
  { id: 'diamond', name: 'Diamond Pickaxe', type: 'pickaxe', value: 'diamond', probability: 0.10 },
  { id: 'netherite', name: 'Netherite Pickaxe', type: 'pickaxe', value: 'netherite', probability: 0.05 },
  { id: 'gold_100', name: '100 Gold', type: 'gold', value: 100, probability: 0.15 },
  { id: 'gold_500', name: '500 Gold', type: 'gold', value: 500, probability: 0.10 },
  { id: 'gold_1000', name: '1000 Gold', type: 'gold', value: 1000, probability: 0.08 },
  { id: 'gold_10000', name: '10000 Gold', type: 'gold', value: 10000, probability: 0.02 },
  { id: 'better_luck', name: 'Better Luck Next Time', type: 'nothing', value: null, probability: 0.04 },
  { id: 'retry', name: 'Free Retry', type: 'retry', value: null, probability: 0.01 }
];

// Mining power per pickaxe type (per minute)
const MINING_POWER = {
  silver: 1,
  gold: 10,
  diamond: 100,
  netherite: 1000
};

function selectPrize() {
  const random = Math.random();
  let cumulativeProbability = 0;
  
  for (const prize of WHEEL_PRIZES) {
    cumulativeProbability += prize.probability;
    if (random <= cumulativeProbability) {
      return prize;
    }
  }
  
  // Fallback to "Better Luck Next Time" if something goes wrong
  return WHEEL_PRIZES.find(p => p.id === 'better_luck');
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    console.log(`🎰 Spin wheel request from: ${address.slice(0, 8)}...`);

    // Get user data
    const user = await getUserOptimized(address, false);

    if (!user) {
      return res.status(400).json({ error: 'User not found. Please connect wallet.' });
    }

    if (!user.has_land) {
      return res.status(400).json({ error: 'You must own land to use the spin wheel!' });
    }

    // Calculate current gold
    const currentTime = Math.floor(Date.now() / 1000);
    const timeSinceCheckpoint = currentTime - (user.checkpoint_timestamp || currentTime);
    const goldPerSecond = (user.total_mining_power || 0) / 60;
    const goldMined = goldPerSecond * timeSinceCheckpoint;
    const totalGold = parseFloat(user.last_checkpoint_gold || 0) + goldMined;

    console.log(`💰 Current gold: ${totalGold.toFixed(2)}, Required: ${SPIN_COST}`);

    // Check if user has enough gold
    if (totalGold < SPIN_COST) {
      return res.status(400).json({ 
        error: `Insufficient gold! You have ${Math.floor(totalGold)} gold but need ${SPIN_COST} gold to spin.`,
        currentGold: Math.floor(totalGold),
        required: SPIN_COST
      });
    }

    // Select prize
    const prize = selectPrize();
    console.log(`🎁 Prize selected: ${prize.name} (${prize.type})`);

    // Deduct spin cost
    let newGold = totalGold - SPIN_COST;
    let newMiningPower = user.total_mining_power || 0;
    let inventory = {
      silver: user.silver_pickaxes || 0,
      gold: user.gold_pickaxes || 0,
      diamond: user.diamond_pickaxes || 0,
      netherite: user.netherite_pickaxes || 0
    };

    // Apply prize
    let prizeMessage = '';
    let refundGold = false;

    if (prize.type === 'pickaxe') {
      // Award pickaxe
      inventory[prize.value]++;
      newMiningPower += MINING_POWER[prize.value];
      prizeMessage = `🎉 You won a ${prize.name}!`;
      
      console.log(`⛏️ Awarded ${prize.name}, new inventory:`, inventory);
    } else if (prize.type === 'gold') {
      // Award gold
      newGold += prize.value;
      prizeMessage = `💰 You won ${prize.value} gold!`;
      
      console.log(`💰 Awarded ${prize.value} gold`);
    } else if (prize.type === 'retry') {
      // Free retry - refund the spin cost
      newGold += SPIN_COST;
      refundGold = true;
      prizeMessage = `🔄 Free Retry! Spin again for free!`;
      
      console.log(`🔄 Free retry awarded`);
    } else if (prize.type === 'nothing') {
      // Better luck next time
      prizeMessage = `😢 Better Luck Next Time!`;
      
      console.log(`💔 No prize awarded`);
    }

    // Update user data
    user.last_checkpoint_gold = newGold;
    user.checkpoint_timestamp = currentTime;
    user.last_activity = currentTime;
    user.total_mining_power = newMiningPower;
    user.silver_pickaxes = inventory.silver;
    user.gold_pickaxes = inventory.gold;
    user.diamond_pickaxes = inventory.diamond;
    user.netherite_pickaxes = inventory.netherite;

    // Save to database
    await saveUserOptimized(address, user);

    console.log(`✅ Spin completed for ${address.slice(0, 8)}:`, {
      prize: prize.name,
      goldBefore: totalGold.toFixed(2),
      goldAfter: newGold.toFixed(2),
      miningPower: newMiningPower
    });

    return res.status(200).json({
      success: true,
      prize: {
        id: prize.id,
        name: prize.name,
        type: prize.type,
        value: prize.value
      },
      message: prizeMessage,
      goldSpent: refundGold ? 0 : SPIN_COST,
      goldBefore: Math.floor(totalGold),
      goldAfter: Math.floor(newGold),
      newInventory: inventory,
      newMiningPower: newMiningPower,
      freeRetry: refundGold
    });

  } catch (error) {
    console.error('❌ Spin wheel error:', error);
    return res.status(500).json({
      error: 'Spin wheel failed',
      message: error.message
    });
  }
}
