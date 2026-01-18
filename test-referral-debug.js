// Quick test to see what's happening
console.log('Testing referral flow...');

// Simulate the flow
const existingUser = {
  address: 'test',
  has_land: false,
  last_checkpoint_gold: 0  // This might be missing!
};

const updatedUser = {
  ...existingUser,
  has_land: true,
  land_purchase_date: Date.now()
};

console.log('existingUser:', existingUser);
console.log('updatedUser before bonus:', updatedUser);

// Add bonus
const currentGold = parseFloat(updatedUser.last_checkpoint_gold || 0);
updatedUser.last_checkpoint_gold = currentGold + 1000;

console.log('updatedUser after bonus:', updatedUser);
console.log('Gold value:', updatedUser.last_checkpoint_gold);
