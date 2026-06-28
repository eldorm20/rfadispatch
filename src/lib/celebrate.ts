/* Celebration effects ported from the original board: canvas confetti + WebAudio
   cash-register / fanfare sounds. All self-contained — no assets, no deps. */

let audioCtx: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (audioCtx) return audioCtx;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AC();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

/** Quick metallic "cha-ching" for a booked load (TV mode). */
export function playCashRegister() {
  const c = ctx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const bell = (freq: number, when: number, dur: number, vol: number) => {
    [1, 2, 2.4, 3.2].forEach((mult, i) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * mult;
      const v = vol / (1 + i * 0.9);
      g.gain.setValueAtTime(0.0001, c.currentTime + when);
      g.gain.exponentialRampToValueAtTime(v, c.currentTime + when + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + dur);
      osc.connect(g);
      g.connect(c.destination);
      osc.start(c.currentTime + when);
      osc.stop(c.currentTime + when + dur + 0.05);
    });
  };
  bell(1568, 0.0, 0.18, 0.18);
  bell(2349, 0.09, 0.55, 0.22);
}

/** Triumphant 4-note rise when the goal is hit. */
export function playFanfare() {
  const c = ctx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const notes = [
    { f: 523.25, t: 0.0, d: 0.16 },
    { f: 659.25, t: 0.1, d: 0.16 },
    { f: 783.99, t: 0.2, d: 0.2 },
    { f: 1046.5, t: 0.32, d: 0.55 },
  ];
  notes.forEach((n) => {
    [1, 2].forEach((mult, i) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = i === 0 ? "triangle" : "sine";
      osc.frequency.value = n.f * mult;
      const v = 0.18 / (i + 1);
      g.gain.setValueAtTime(0.0001, c.currentTime + n.t);
      g.gain.exponentialRampToValueAtTime(v, c.currentTime + n.t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + n.t + n.d);
      osc.connect(g);
      g.connect(c.destination);
      osc.start(c.currentTime + n.t);
      osc.stop(c.currentTime + n.t + n.d + 0.05);
    });
  });
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
}

/** Burst of confetti from the upper third of the screen. */
export function fireConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;z-index:9999;pointer-events:none;";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const g = canvas.getContext("2d");
  if (!g) {
    canvas.remove();
    return;
  }
  const colors = ["#4ade80", "#22c55e", "#2dd4bf", "#facc15", "#fb923c", "#ffffff"];
  const parts: Particle[] = [];
  for (let i = 0; i < 180; i++) {
    parts.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 280,
      y: canvas.height * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 18 - 6,
      g: 0.45,
      size: 7 + Math.random() * 7,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.35,
    });
  }
  let frames = 0;
  function frame() {
    if (!g) return;
    g.clearRect(0, 0, canvas.width, canvas.height);
    parts.forEach((p) => {
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = p.color;
      g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      g.restore();
    });
    frames++;
    if (frames < 160) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
