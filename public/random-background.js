// 🎨 Random Background System - Changes on every refresh
// Supports: Images (jpg, webp), Videos (mp4), and Animated GIFs

const backgrounds = [
  // Videos (mp4)
  { type: 'video', src: '../image/blue-lake-minecraft.1920x1080.mp4' },
  { type: 'video', src: '../image/cherry-leaves.1920x1080.mp4' },
  { type: 'video', src: '../image/fancy-center-minecraft.3840x2160.mp4' },
  { type: 'video', src: '../image/minecraft-dog.3840x2160.mp4' },
  { type: 'video', src: '../image/minecraft-house.3840x2160.mp4' },
  { type: 'video', src: '../image/minecraft-rainy-landscape.1920x1080.mp4' },
  { type: 'video', src: '../image/minecraft-sunset2.3840x2160.mp4' },
  { type: 'video', src: '../image/portal-in-minecraft.3840x2160.mp4' },
  { type: 'video', src: '../image/raindrops-minecraft.1920x1080.mp4' },
  
  // Images (jpg, webp)
  { type: 'image', src: '../image/beautiful-minecraft-wooden-mansion-izpd9ai80etyb2kk.jpg' },
  { type: 'image', src: '../image/minecraft-1106252_1920.jpg' },
  { type: 'image', src: '../image/wp15148770-minecraft-sunrise-wallpapers.webp' },
  { type: 'image', src: '../image/wp15148789-minecraft-sunrise-wallpapers.webp' },
  { type: 'image', src: '../image/wp15148791-minecraft-sunrise-wallpapers.webp' },
  { type: 'image', src: '../image/wp15148793-minecraft-sunrise-wallpapers.webp' },
  { type: 'image', src: '../image/wp15225188-cave-minecraft-wallpapers.webp' },
  { type: 'image', src: '../image/wp15225216-cave-minecraft-wallpapers.webp' },
];

function setRandomBackground() {
  // Pick a random background
  const randomIndex = Math.floor(Math.random() * backgrounds.length);
  const selected = backgrounds[randomIndex];
  
  console.log(`🎨 Loading random background: ${selected.src}`);
  
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
    video.src = selected.src;
    
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
    document.body.style.backgroundImage = `url('${selected.src}')`;
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
