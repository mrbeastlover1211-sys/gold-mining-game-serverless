// 🎰 PREMIUM SPIN WHEEL DESIGN - Inspired by best GitHub libraries
// Based on Winwheel.js and Vegas-style casino wheels

class PremiumSpinWheel {
  constructor(canvasId, prizes) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.prizes = prizes;
    this.rotation = 0;
    this.isSpinning = false;
    this.segments = prizes.length;
    this.anglePerSegment = (2 * Math.PI) / this.segments;
    
    // Premium styling
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height / 2;
    this.outerRadius = (this.canvas.width / 2) - 20;
    this.innerRadius = 40;
    
    this.init();
  }
  
  init() {
    this.draw();
    this.addInteractivity();
  }
  
  draw() {
    const ctx = this.ctx;
    const centerX = this.centerX;
    const centerY = this.centerY;
    
    // Clear canvas
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw outer glow
    ctx.save();
    ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(centerX, centerY, this.outerRadius + 5, 0, 2 * Math.PI);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.restore();
    
    // Draw segments
    for (let i = 0; i < this.segments; i++) {
      const startAngle = this.rotation + (i * this.anglePerSegment) - Math.PI / 2;
      const endAngle = startAngle + this.anglePerSegment;
      
      // Gradient for each segment
      const gradient = ctx.createRadialGradient(
        centerX, centerY, this.innerRadius,
        centerX, centerY, this.outerRadius
      );
      
      const prize = this.prizes[i];
      
      // Color based on rarity
      if (prize.rarity === 'legendary') {
        gradient.addColorStop(0, '#8B00FF');
        gradient.addColorStop(1, '#FF00FF');
      } else if (prize.rarity === 'epic') {
        gradient.addColorStop(0, '#0080FF');
        gradient.addColorStop(1, '#00FFFF');
      } else if (prize.rarity === 'rare') {
        gradient.addColorStop(0, '#FF8C00');
        gradient.addColorStop(1, '#FFD700');
      } else if (prize.rarity === 'gold') {
        gradient.addColorStop(0, '#2E7D32');
        gradient.addColorStop(1, '#66BB6A');
      } else if (prize.rarity === 'special') {
        gradient.addColorStop(0, '#1565C0');
        gradient.addColorStop(1, '#42A5F5');
      } else {
        gradient.addColorStop(0, '#757575');
        gradient.addColorStop(1, '#BDBDBD');
      }
      
      // Draw segment
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, this.outerRadius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Segment border
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Add shine effect
      ctx.save();
      ctx.clip();
      const shineGradient = ctx.createRadialGradient(
        centerX - this.outerRadius * 0.3,
        centerY - this.outerRadius * 0.3,
        0,
        centerX,
        centerY,
        this.outerRadius
      );
      shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      shineGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
      shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = shineGradient;
      ctx.fill();
      ctx.restore();
      
      // Draw text and emoji
      this.drawPrizeText(ctx, centerX, centerY, startAngle, prize);
    }
    
    // Draw center hub with 3D effect
    this.drawCenterHub(ctx, centerX, centerY);
    
    // Draw decorative pins
    this.drawPins(ctx, centerX, centerY);
  }
  
  drawPrizeText(ctx, centerX, centerY, startAngle, prize) {
    ctx.save();
    
    // Calculate text position
    const angle = startAngle + this.anglePerSegment / 2;
    const textRadius = this.outerRadius * 0.75;
    const x = centerX + Math.cos(angle) * textRadius;
    const y = centerY + Math.sin(angle) * textRadius;
    
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    
    // Draw emoji
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Text shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    ctx.fillStyle = '#000';
    ctx.fillText(prize.emoji, 0, -15);
    
    // Draw prize name
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#FFF';
    ctx.fillText(prize.shortName, 0, 15);
    
    ctx.restore();
  }
  
  drawCenterHub(ctx, centerX, centerY) {
    // Outer ring shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(centerX, centerY, this.innerRadius + 10, 0, 2 * Math.PI);
    ctx.fillStyle = '#2C2C2C';
    ctx.fill();
    ctx.restore();
    
    // Main hub with gradient
    const hubGradient = ctx.createRadialGradient(
      centerX - 10, centerY - 10, 0,
      centerX, centerY, this.innerRadius
    );
    hubGradient.addColorStop(0, '#FFD700');
    hubGradient.addColorStop(0.7, '#FFA500');
    hubGradient.addColorStop(1, '#FF8C00');
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, this.innerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = hubGradient;
    ctx.fill();
    
    // Hub border
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Inner shine
    ctx.beginPath();
    ctx.arc(centerX - 10, centerY - 10, this.innerRadius * 0.4, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fill();
    
    // Center text
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.fillText('SPIN', centerX, centerY);
  }
  
  drawPins(ctx, centerX, centerY) {
    const pinCount = this.segments;
    const pinRadius = 6;
    
    for (let i = 0; i < pinCount; i++) {
      const angle = this.rotation + (i * this.anglePerSegment) - Math.PI / 2;
      const x = centerX + Math.cos(angle) * (this.outerRadius - 5);
      const y = centerY + Math.sin(angle) * (this.outerRadius - 5);
      
      // Pin shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 5;
      
      // Pin gradient
      const pinGradient = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, pinRadius);
      pinGradient.addColorStop(0, '#FFD700');
      pinGradient.addColorStop(1, '#B8860B');
      
      ctx.beginPath();
      ctx.arc(x, y, pinRadius, 0, 2 * Math.PI);
      ctx.fillStyle = pinGradient;
      ctx.fill();
      
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }
  
  addInteractivity() {
    // Add hover effect
    this.canvas.style.cursor = 'pointer';
  }
  
  spinTo(targetIndex, duration = 4000) {
    if (this.isSpinning) return;
    
    this.isSpinning = true;
    const startTime = Date.now();
    const startRotation = this.rotation;
    
    // Calculate target rotation
    const spins = 5; // Number of full rotations
    const targetAngle = (targetIndex * this.anglePerSegment);
    const totalRotation = (spins * 2 * Math.PI) + (2 * Math.PI - targetAngle) + startRotation;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      this.rotation = startRotation + (totalRotation - startRotation) * easeOut;
      this.draw();
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.rotation = totalRotation % (2 * Math.PI);
        this.isSpinning = false;
        this.onSpinComplete && this.onSpinComplete();
      }
    };
    
    animate();
  }
}

// Export for use
window.PremiumSpinWheel = PremiumSpinWheel;
