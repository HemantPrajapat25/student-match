/**
 * particles.js — Canvas star field with mouse-repel antigravity effect
 */

const STAR_COUNT = 220;
const REPEL_RADIUS = 110;
const REPEL_STRENGTH = 3.5;

let canvas, ctx, stars = [], animId, mouse = { x: -9999, y: -9999 };

/**
 * Initialize and start the canvas particle star field.
 * @param {string} canvasId - ID of the <canvas> element
 */
export function initParticles(canvasId = 'particle-canvas') {
  canvas = document.getElementById(canvasId);
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  resize();
  spawnStars();
  bindEvents();
  loop();
}

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

function spawnStars() {
  stars = Array.from({ length: STAR_COUNT }, () => makeStar());
}

function makeStar(y = null) {
  return {
    x:   Math.random() * (canvas?.width  ?? 1920),
    y:   y !== null ? y : Math.random() * (canvas?.height ?? 1080),
    size: 0.5 + Math.random() * 2,
    speed: 0.15 + Math.random() * 0.5,
    opacity: 0.3 + Math.random() * 0.7,
    vx: 0,
    vy: 0,
    hue: Math.random() < 0.1 ? 220 : 0, // some blue tinted
  };
}

function bindEvents() {
  window.addEventListener('resize', () => {
    resize();
    spawnStars();
  });

  // Track mouse for repel effect
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener('mouseleave', () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });
}

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const star of stars) {
    // ── Repel from mouse ──
    const dx   = star.x - mouse.x;
    const dy   = star.y - mouse.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < REPEL_RADIUS) {
      const force  = (1 - dist / REPEL_RADIUS) * REPEL_STRENGTH;
      star.vx += (dx / dist) * force;
      star.vy += (dy / dist) * force;
    }

    // Friction (damp velocity)
    star.vx *= 0.92;
    star.vy *= 0.92;

    // Apply velocity + natural drift downward
    star.x += star.vx;
    star.y += star.speed + star.vy;

    // Wrap horizontally
    if (star.x < 0)             star.x = canvas.width;
    if (star.x > canvas.width)  star.x = 0;

    // Reset to top when exits bottom
    if (star.y > canvas.height) {
      Object.assign(star, makeStar(0));
    }

    // ── Draw star ──
    ctx.save();
    ctx.globalAlpha = star.opacity;
    if (star.hue) {
      ctx.fillStyle = `hsl(${star.hue}, 80%, 70%)`;
    } else {
      ctx.fillStyle = '#ffffff';
    }
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  animId = requestAnimationFrame(loop);
}

/**
 * Stop the animation loop.
 */
export function stopParticles() {
  if (animId) cancelAnimationFrame(animId);
}
