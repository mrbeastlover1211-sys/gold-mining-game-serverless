// 🎨 Random Background System - Cloudflare R2 + 10-Minute Lock
// Supports: Images (jpg, webp), Videos (mp4)
// Features: Loads from Cloudflare R2 CDN, caches background for 10 minutes

// ⚡ Cloudflare R2 Base URL
const R2_BASE_URL = 'https://pub-3d73d3cda1a544bf8d88469606cc1865.r2.dev/backgrounds';

// ⏰ Background lock duration (10 minutes in milliseconds)
const BACKGROUND_LOCK_DURATION = 10 * 60 * 1000; // 10 minutes

// 🎬 Available backgrounds (loaded from Cloudflare R2)
const backgrounds = [
  // Videos (mp4) - Large files, perfect for R2
  { type: 'video', filename: 'blue-lake-minecraft.1920x1080.mp4' },
  { type: 'video', filename: 'cherry-leaves.1920x1080.mp4' },
  { type: 'video', filename: 'fancy-center-minecraft.3840x2160.mp4' },
  { type: 'video', filename: 'minecraft-dog.3840x2160.mp4' },
  { type: 'video', filename: 'minecraft-house.3840x2160.mp4' },
  { type: 'video', filename: 'minecraft-rainy-landscape.1920x1080.mp4' },
  { type: 'video', filename: 'minecraft-sunset2.3840x2160.mp4' },
  { type: 'video', filename: 'portal-in-minecraft.3840x2160.mp4' },
  { type: 'video', filename: 'raindrops-minecraft.1920x1080.mp4' },
  
  // Images (jpg, webp)
  { type: 'image', filename: 'beautiful-minecraft-wooden-mansion-izpd9ai80etyb2kk.jpg' },
  { type: 'image', filename: 'minecraft-1106252_1920.jpg' },
  { type: 'image', filename: 'wp15148770-minecraft-sunrise-wallpapers.webp' },
  { type: 'image', filename: 'wp15148789-minecraft-sunrise-wallpapers.webp' },
  { type: 'image', filename: 'wp15148791-minecraft-sunrise-wallpapers.webp' },
  { type: 'image', filename: 'wp15148793-minecraft-sunrise-wallpapers.webp' },
  { type: 'image', filename: 'wp15225188-cave-minecraft-wallpapers.webp' },
  { type: 'image', filename: 'wp15225216-cave-minecraft-wallpapers.webp' },
];

// 🔒 Get cached background or pick new one (10-minute lock)
function getBackgroundWithLock() {
  const CACHE_KEY = 'goldmining_background';
  const cached = localStorage.getItem(CACHE_KEY);
  
  if (cached) {
    try {
      const { index, timestamp } = JSON.parse(cached);
      const elapsed = Date.now() - timestamp;
      
      // If less than 10 minutes, use cached background
      if (elapsed < BACKGROUND_LOCK_DURATION) {
        const remainingMins = Math.ceil((BACKGROUND_LOCK_DURATION - elapsed) / 60000);
        console.log(`🔒 Using cached background (${remainingMins} min until change)`);
        return backgrounds[index];
      }
    } catch (e) {
      console.warn('⚠️ Invalid background cache, picking new one');
    }
  }
  
  // Pick new random background
  const randomIndex = Math.floor(Math.random() * backgrounds.length);
  
  // Save to localStorage with timestamp
  localStorage.setItem(CACHE_KEY, JSON.stringify({
    index: randomIndex,
    timestamp: Date.now()
  }));
  
  console.log(`🎲 New background selected (locked for 10 minutes)`);
  return backgrounds[randomIndex];
}

function setRandomBackground() {
  // Get background (cached or new)
  const selected = getBackgroundWithLock();
  
  // Build full URL from Cloudflare R2
  const fullUrl = `${R2_BASE_URL}/${selected.filename}`;
  
  console.log(`🎨 Loading background from R2: ${fullUrl}`);
  
  // Remove any existing background video or overlay
  const existingVideo = document.getElementById('background-video');
  const existingOverlay = document.getElementById('background-overlay');
  if (existingVideo) existingVideo.remove();
  if (existingOverlay) existingOverlay.remove();
  
  if (selected.type === 'video') {
    // Create video background
    const video = document.createElement('video');
    video.id = 'background-video';
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.src = fullUrl;
    
    // Style the video
    video.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: -2;
    `;
    
    // Add dark overlay for better text readability
    const overlay = document.createElement('div');
    overlay.id = 'background-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      z-index: -1;
    `;
    
    document.body.appendChild(video);
    document.body.appendChild(overlay);
    
    // Remove the static background image
    document.body.style.backgroundImage = 'none';
    
    console.log('✅ Video background loaded');
  } else {
    // Set image background
    document.body.style.backgroundImage = `url('${fullUrl}')`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
    
    // Add dark overlay for better text readability
    const overlay = document.createElement('div');
    overlay.id = 'background-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      z-index: -1;
      pointer-events: none;
    `;
    
    document.body.appendChild(overlay);
    
    console.log('✅ Image background loaded');
  }
}

// Load random background when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setRandomBackground);
} else {
  setRandomBackground();
}
