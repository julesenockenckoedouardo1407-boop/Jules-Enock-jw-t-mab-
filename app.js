(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const hitsEl = document.getElementById("hits");
  const shotsEl = document.getElementById("shots");
  const messageEl = document.getElementById("message");
  const resetBtn = document.getElementById("resetBtn");

  const TAU = Math.PI * 2;
  const MAX_SPEED = 11;
  const FRICTION = 0.985;
  const STOP_SPEED = 0.06;
  const MARBLE_R = 13;

  let W = 0, H = 0, dpr = 1;
  let score = 0, hits = 0, shots = 0;
  let marbles = [];
  let shooter = null;
  let dragging = false;
  let pointer = { x: 0, y: 0 };
  let aim = { x: 0, y: 0 };
  let lastTime = performance.now();

  const colors = ["#ffca28", "#ef5350", "#ab47bc", "#42a5f5", "#66bb6a", "#ff7043"];

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(280, rect.width);
    H = Math.max(280, rect.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    resetGame();
  }

  function makeMarble(x, y, r, color, type = "target") {
    return { x, y, vx: 0, vy: 0, r, color, type, alive: true, hit: false };
  }

  function resetGame() {
    score = 0; hits = 0; shots = 0;
    marbles = [];
    shooter = makeMarble(W / 2, H - Math.max(42, H * .11), MARBLE_R + 2, "#2196f3", "shooter");

    const cx = W / 2, cy = H * .43;
    const ringR = Math.min(W, H) * .22;
    const count = 11;

    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      const radius = ringR * (0.68 + ((i * 37) % 30) / 100);
      marbles.push(makeMarble(
        cx + Math.cos(a) * radius,
        cy + Math.sin(a) * radius,
        MARBLE_R,
        colors[i % colors.length]
      ));
    }

    updateHud();
    messageEl.textContent = "Pare? Fè yon pichenèt 👆";
  }

  function updateHud() {
    scoreEl.textContent = score;
    hitsEl.textContent = hits;
    shotsEl.textContent = shots;
  }

  function posFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function allStopped() {
    return !marbles.some(m => Math.hypot(m.vx, m.vy) > STOP_SPEED);
  }

  canvas.addEventListener("pointerdown", e => {
    if (!allStopped()) return;
    const p = posFromEvent(e);
    if (distance(p, shooter) < shooter.r * 2.2) {
      dragging = true;
      pointer = p;
      aim = p;
      canvas.setPointerCapture(e.pointerId);
      messageEl.textContent = "Rale dèyè epi lage 🎯";
    }
  });

  canvas.addEventListener("pointermove", e => {
    if (!dragging) return;
    pointer = posFromEvent(e);
    aim = pointer;
  });

  canvas.addEventListener("pointerup", e => {
    if (!dragging) return;
    dragging = false;
    pointer = posFromEvent(e);

    const dx = shooter.x - pointer.x;
    const dy = shooter.y - pointer.y;
    const len = Math.hypot(dx, dy);

    if (len < 8) {
      messageEl.textContent = "Rale mab la pi lwen pou tire.";
      return;
    }

    const power = Math.min(MAX_SPEED, len * 0.075);
    shooter.vx = (dx / len) * power;
    shooter.vy = (dy / len) * power;
    shots++;
    updateHud();
    messageEl.textContent = "Bèl pichenèt! 🟠";
  });

  resetBtn.addEventListener("click", resetGame);
  window.addEventListener("resize", resize);

  function moveBall(m, dt) {
    if (!m.alive) return;
    m.x += m.vx * dt;
    m.y += m.vy * dt;

    const left = m.r, right = W - m.r, top = m.r, bottom = H - m.r;
    if (m.x < left) { m.x = left; m.vx *= -0.82; }
    if (m.x > right) { m.x = right; m.vx *= -0.82; }
    if (m.y < top) { m.y = top; m.vy *= -0.82; }
    if (m.y > bottom) { m.y = bottom; m.vy *= -0.82; }

    const friction = Math.pow(FRICTION, dt);
    m.vx *= friction;
    m.vy *= friction;
    if (Math.hypot(m.vx, m.vy) < STOP_SPEED) m.vx = m.vy = 0;
  }

  function collide(a, b) {
    if (!a.alive || !b.alive) return;
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const minDist = a.r + b.r;
    if (!dist || dist >= minDist) return;

    const nx = dx / dist, ny = dy / dist;
    const overlap = minDist - dist;
    a.x -= nx * overlap * .5;
    a.y -= ny * overlap * .5;
    b.x += nx * overlap * .5;
    b.y += ny * overlap * .5;

    const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
    const rel = rvx * nx + rvy * ny;
    if (rel > 0) return;

    const impulse = -rel * 0.9;
    a.vx -= impulse * nx; a.vy -= impulse * ny;
    b.vx += impulse * nx; b.vy += impulse * ny;

    if (a.type === "shooter" && b.type === "target" && !b.hit) {
      b.hit = true;
      hits++;
      score += 10;
      updateHud();
      setTimeout(() => {
        b.alive = false;
      }, 80);
    } else if (b.type === "shooter" && a.type === "target" && !a.hit) {
      a.hit = true;
      hits++;
      score += 10;
      updateHud();
      setTimeout(() => {
        a.alive = false;
      }, 80);
    }
  }

  function update(dt) {
    const step = Math.min(dt, 2);
    if (shooter) moveBall(shooter, step);
    marbles.forEach(m => moveBall(m, step));

    for (const m of marbles) collide(shooter, m);
    for (let i = 0; i < marbles.length; i++) {
      for (let j = i + 1; j < marbles.length; j++) collide(marbles[i], marbles[j]);
    }

    if (marbles.every(m => !m.alive)) {
      messageEl.textContent = "Bravo! Tout mab yo frape 🎉";
    }
  }

  function drawCircle(m) {
    if (!m.alive) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(m.x + 3, m.y + 4, m.r, 0, TAU);
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.fill();

    const grad = ctx.createRadialGradient(
      m.x - m.r * .35, m.y - m.r * .4, 1,
      m.x, m.y, m.r
    );
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(.18, m.color);
    grad.addColorStop(1, m.color);
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, TAU);
    ctx.fillStyle = grad;
    ctx.fill();

    if (m.type === "shooter") {
      ctx.strokeStyle = "rgba(255,255,255,.9)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawAim() {
    if (!dragging || !shooter) return;
    const dx = shooter.x - pointer.x, dy = shooter.y - pointer.y;
    const len = Math.hypot(dx, dy);
    if (!len) return;

    const ux = dx / len, uy = dy / len;
    const line = Math.min(len, 140);

    ctx.save();
    ctx.setLineDash([7, 7]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,.75)";
    ctx.beginPath();
    ctx.moveTo(shooter.x, shooter.y);
    ctx.lineTo(shooter.x + ux * line, shooter.y + uy * line);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, 6, 0, TAU);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Tèks­tire jwèt la.
    ctx.fillStyle = "#0e6655";
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.arc((i * 113) % W, (i * 79) % H, 2 + (i % 3), 0, TAU);
      ctx.fillStyle = "rgba(255,248,231,.08)";
      ctx.fill();
    }

    marbles.forEach(drawCircle);
    drawCircle(shooter);
    drawAim();
  }

  function loop(now) {
    const dt = (now - lastTime) / 16.6667;
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  resize();
  requestAnimationFrame(loop);
})();
