import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

const demoFollowers = Array.from({ length: 120 }, (_, i) => `@follower_${i + 1}`);

const teamPalette = [
  { name: "EMBER", color: "#fb7185" },
  { name: "AQUA", color: "#22d3ee" },
  { name: "LIME", color: "#84cc16" }
];

const state = {
  running: false,
  units: [],
  teams: [],
  activeEvent: "none",
  activeEventUntil: 0,
  nextEventAt: 0,
  eventBudget: 3,
  world: { radius: 48, bowlDepth: 14 },
  audioEnabled: true,
  trails: [],
  explosions: []
};

const appRoot = document.getElementById("appRoot");
const textarea = document.getElementById("followersInput");
const csvInput = document.getElementById("csvInput");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const useDemoBtn = document.getElementById("useDemo");
const backBtn = document.getElementById("backBtn");
const teamCountSelect = document.getElementById("teamCount");
const eventCountSelect = document.getElementById("eventCount");
const statusText = document.getElementById("statusText");
const eventText = document.getElementById("eventText");
const scoreboard = document.getElementById("scoreboard");
const arena3d = document.getElementById("arena3d");
const overlayLayer = document.getElementById("overlayLayer");

const scene = new THREE.Scene();
scene.background = new THREE.Color("#101a2b");
scene.fog = new THREE.Fog("#101a2b", 40, 145);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
arena3d.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(56, 16 / 9, 0.1, 500);
camera.position.set(0, 56, 74);
camera.lookAt(0, -8, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x1b2f45, 1.25));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.05);
dirLight.position.set(24, 52, 10);
scene.add(dirLight);

const bowlGeom = new THREE.SphereGeometry(60, 56, 40, 0, Math.PI * 2, 0, Math.PI / 2.05);
const bowlMat = new THREE.MeshStandardMaterial({ color: "#1a2b42", roughness: 0.92, metalness: 0.06, side: THREE.DoubleSide });
const bowl = new THREE.Mesh(bowlGeom, bowlMat);
bowl.rotation.x = Math.PI;
bowl.position.y = 46;
scene.add(bowl);

const lip = new THREE.Mesh(
  new THREE.TorusGeometry(state.world.radius + 1.2, 1.1, 20, 120),
  new THREE.MeshStandardMaterial({ color: "#314c6b", roughness: 0.35, metalness: 0.5 })
);
lip.rotation.x = Math.PI / 2;
lip.position.y = bowlHeightAt(state.world.radius) + 0.6;
scene.add(lip);

const baseGrid = new THREE.GridHelper(120, 34, 0x3c5678, 0x2a3f59);
baseGrid.position.y = -15;
scene.add(baseGrid);

function bowlHeightAt(radius) {
  const rr = Math.min(radius / state.world.radius, 1);
  return -state.world.bowlDepth * (1 - rr * rr);
}

function bowlSlopeFactor(radius) {
  const rr = Math.min(radius / state.world.radius, 1);
  return 1 - rr * rr;
}

function parseFollowers(raw) {
  return [...new Set(raw.split(/\r?\n|,|;/).map((name) => name.trim()).filter(Boolean).map((name) => (name.startsWith("@") ? name : `@${name}`)))];
}

function beep(freq = 340, duration = 0.06, gain = 0.04) {
  if (!state.audioEnabled) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!beep.ctx) beep.ctx = new AudioCtx();
  const audioCtx = beep.ctx;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = "triangle";
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + duration);
}

function createTeams(count) {
  return Array.from({ length: count }, (_, idx) => ({ id: idx, name: teamPalette[idx].name, color: teamPalette[idx].color, alive: 0 }));
}

function createBeybladeMesh(teamColor) {
  const group = new THREE.Group();

  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.6, 0.62, 20),
    new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.42, metalness: 0.4 })
  );
  group.add(shell);

  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.6, 0.74, 18),
    new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.35, metalness: 0.75 })
  );
  core.position.y = 0.2;
  group.add(core);

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.45, 12),
    new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.55, metalness: 0.35 })
  );
  tip.position.y = -0.54;
  group.add(tip);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.22, 0.09, 12, 42),
    new THREE.MeshBasicMaterial({ color: teamColor })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.1;
  group.add(ring);

  return group;
}

function createUnits(followers, teamCount) {
  const teams = createTeams(teamCount);
  const units = followers.map((name, i) => {
    const team = i % teamCount;
    const angle = Math.random() * Math.PI * 2;
    const radius = 9 + Math.random() * 20;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const mesh = createBeybladeMesh(teamPalette[team].color);
    mesh.position.set(x, bowlHeightAt(radius) + 0.9, z);
    scene.add(mesh);

    return {
      id: i,
      name,
      team,
      x,
      z,
      vx: (Math.random() - 0.5) * 0.2,
      vz: (Math.random() - 0.5) * 0.2,
      hp: 100,
      maxHp: 100,
      spin: 0,
      spinSpeed: 0.6 + Math.random() * 0.3,
      radius: 1.55,
      dead: false,
      mesh,
      tagEl: null,
      knockbackCooldown: 0
    };
  });

  teams.forEach((team) => {
    team.alive = units.filter((u) => u.team === team.id).length;
  });

  return { units, teams };
}

function clearUnits() {
  for (const unit of state.units) {
    if (unit.mesh) scene.remove(unit.mesh);
    if (unit.tagEl && unit.tagEl.parentNode) unit.tagEl.parentNode.removeChild(unit.tagEl);
  }
  for (const trail of state.trails) {
    scene.remove(trail.line);
    trail.line.geometry.dispose();
    trail.line.material.dispose();
  }
  for (const ex of state.explosions) {
    scene.remove(ex.points);
    ex.points.geometry.dispose();
    ex.points.material.dispose();
  }
}

function onResize() {
  const rect = arena3d.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", onResize);
onResize();

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

function aliveTeams() {
  return state.teams.filter((team) => team.alive > 0);
}

function chooseEvent() {
  const options = ["Launch Burst", "Armor Mode", "Magnet Pull"];
  return options[Math.floor(Math.random() * options.length)];
}

function applyEvent(name, now) {
  state.activeEvent = name;
  state.activeEventUntil = now + 3800;
  eventText.textContent = `Event: ${name}`;
  beep(540, 0.11, 0.06);
}

function eventEffect(unit) {
  if (state.activeEvent === "Launch Burst") return { speedBoost: 1.25, damageBoost: 1.2, friction: 0.992 };
  if (state.activeEvent === "Armor Mode") return { speedBoost: 0.95, damageBoost: 0.7, friction: 0.986 };
  if (state.activeEvent === "Magnet Pull") {
    const centerPull = 0.012;
    unit.vx += (0 - unit.x) * centerPull * 0.01;
    unit.vz += (0 - unit.z) * centerPull * 0.01;
    return { speedBoost: 1.05, damageBoost: 1, friction: 0.989 };
  }
  return { speedBoost: 1, damageBoost: 1, friction: 0.988 };
}

function updateScoreboard() {
  scoreboard.innerHTML = state.teams.map((team) => `<span class="team"><span class="dot" style="background:${team.color}"></span>${team.name}: ${team.alive}</span>`).join("");
}

function ensureTag(unit) {
  if (unit.tagEl) return unit.tagEl;
  const tag = document.createElement("div");
  tag.className = "unit-tag";
  tag.innerHTML = `<div class="hpbar"><div class="hpfill"></div></div><div>${unit.name}</div>`;
  overlayLayer.appendChild(tag);
  unit.tagEl = tag;
  return tag;
}

function updateTag(unit) {
  const v = new THREE.Vector3(unit.x, bowlHeightAt(Math.hypot(unit.x, unit.z)) + 3.4, unit.z).project(camera);
  const rect = overlayLayer.getBoundingClientRect();
  const x = ((v.x + 1) * 0.5) * rect.width;
  const y = ((-v.y + 1) * 0.5) * rect.height;
  const tag = ensureTag(unit);

  if (v.z > -1 && v.z < 1 && !unit.dead) {
    tag.style.display = "block";
    tag.style.left = `${x}px`;
    tag.style.top = `${y}px`;
    const fill = tag.querySelector(".hpfill");
    const hpRatio = Math.max(0, unit.hp / unit.maxHp);
    fill.style.width = `${hpRatio * 100}%`;
    fill.style.background = hpRatio > 0.45 ? "#34d399" : hpRatio > 0.2 ? "#fbbf24" : "#ef4444";
  } else {
    tag.style.display = "none";
  }
}

function addTrail(unit) {
  const from = new THREE.Vector3(unit.x, bowlHeightAt(Math.hypot(unit.x, unit.z)) + 0.7, unit.z);
  const to = from.clone().add(new THREE.Vector3(-unit.vx * 16, 0, -unit.vz * 16));
  const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
  const material = new THREE.LineBasicMaterial({ color: teamPalette[unit.team].color, transparent: true, opacity: 0.8 });
  const line = new THREE.Line(geometry, material);
  scene.add(line);
  state.trails.push({ line, t: performance.now() });
}

function addExplosion(unit) {
  const count = 26;
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = unit.x;
    positions[i * 3 + 1] = bowlHeightAt(Math.hypot(unit.x, unit.z)) + 1;
    positions[i * 3 + 2] = unit.z;
    velocities.push(new THREE.Vector3((Math.random() - 0.5) * 0.38, Math.random() * 0.3, (Math.random() - 0.5) * 0.38));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const m = new THREE.PointsMaterial({ color: teamPalette[unit.team].color, size: 0.42, transparent: true, opacity: 0.95 });
  const points = new THREE.Points(g, m);
  scene.add(points);
  state.explosions.push({ points, velocities, t: performance.now() });
}

function resolveCollisions(damageBoost) {
  for (let i = 0; i < state.units.length; i += 1) {
    const a = state.units[i];
    if (a.dead) continue;
    for (let j = i + 1; j < state.units.length; j += 1) {
      const b = state.units[j];
      if (b.dead) continue;

      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz) || 0.0001;
      const minD = a.radius + b.radius;
      if (d >= minD) continue;

      const nx = dx / d;
      const nz = dz / d;
      const overlap = minD - d;

      a.x -= nx * overlap * 0.5;
      a.z -= nz * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.z += nz * overlap * 0.5;

      const relVx = b.vx - a.vx;
      const relVz = b.vz - a.vz;
      const relAlongNormal = relVx * nx + relVz * nz;
      const impulse = -relAlongNormal * 0.7;

      a.vx -= impulse * nx;
      a.vz -= impulse * nz;
      b.vx += impulse * nx;
      b.vz += impulse * nz;

      if (a.team !== b.team) {
        const impact = Math.min(14, (Math.abs(relAlongNormal) + 0.4) * 8) * damageBoost;
        a.hp -= impact;
        b.hp -= impact;
        a.knockbackCooldown = 10;
        b.knockbackCooldown = 10;
        addTrail(a);
        addTrail(b);
        if (Math.random() < 0.18) beep(220 + Math.random() * 130, 0.035, 0.018);
      }
    }
  }
}

function updateEffects(now) {
  state.trails = state.trails.filter((trail) => {
    const age = now - trail.t;
    if (age > 170) {
      scene.remove(trail.line);
      trail.line.geometry.dispose();
      trail.line.material.dispose();
      return false;
    }
    trail.line.material.opacity = 1 - age / 170;
    return true;
  });

  state.explosions = state.explosions.filter((ex) => {
    const age = now - ex.t;
    const pos = ex.points.geometry.attributes.position;
    for (let i = 0; i < ex.velocities.length; i += 1) {
      const vel = ex.velocities[i];
      pos.array[i * 3] += vel.x;
      pos.array[i * 3 + 1] += vel.y;
      pos.array[i * 3 + 2] += vel.z;
      vel.y -= 0.008;
    }
    pos.needsUpdate = true;
    ex.points.material.opacity = Math.max(0, 1 - age / 700);
    if (age > 700) {
      scene.remove(ex.points);
      ex.points.geometry.dispose();
      ex.points.material.dispose();
      return false;
    }
    return true;
  });
}

function eliminate(unit, reason = "exploded") {
  if (unit.dead) return;
  unit.dead = true;
  unit.mesh.visible = false;
  state.teams[unit.team].alive -= 1;
  if (unit.tagEl) unit.tagEl.style.display = "none";
  if (reason === "exploded") addExplosion(unit);
}

function updateUnits(now) {
  if (state.eventBudget > 0 && now > state.nextEventAt) {
    applyEvent(chooseEvent(), now);
    state.eventBudget -= 1;
    state.nextEventAt = now + 9800 + Math.random() * 2100;
  }

  if (state.activeEvent !== "none" && now > state.activeEventUntil) {
    state.activeEvent = "none";
    eventText.textContent = "Event: none";
  }

  for (const unit of state.units) {
    if (unit.dead) continue;

    const fx = eventEffect(unit);

    unit.knockbackCooldown = Math.max(0, unit.knockbackCooldown - 1);

    const r = Math.hypot(unit.x, unit.z);
    const nx = r > 0.0001 ? unit.x / r : 0;
    const nz = r > 0.0001 ? unit.z / r : 0;

    const slope = bowlSlopeFactor(r);
    unit.vx += -nx * slope * 0.025;
    unit.vz += -nz * slope * 0.025;

    const wobble = (Math.random() - 0.5) * 0.004;
    unit.vx += wobble;
    unit.vz -= wobble;

    unit.vx *= fx.friction;
    unit.vz *= fx.friction;

    const speedCap = 0.65 * fx.speedBoost;
    const spd = Math.hypot(unit.vx, unit.vz);
    if (spd > speedCap) {
      unit.vx = (unit.vx / spd) * speedCap;
      unit.vz = (unit.vz / spd) * speedCap;
    }

    unit.x += unit.vx;
    unit.z += unit.vz;

    const nr = Math.hypot(unit.x, unit.z);
    if (nr > state.world.radius + 2.2) {
      eliminate(unit, "ringout");
      continue;
    }

    const y = bowlHeightAt(nr) + 0.9;
    unit.mesh.position.set(unit.x, y, unit.z);

    unit.spin += unit.spinSpeed * (1 + Math.hypot(unit.vx, unit.vz) * 1.8);
    unit.mesh.rotation.y = unit.spin;
    unit.mesh.rotation.x = -unit.vz * 0.8;
    unit.mesh.rotation.z = unit.vx * 0.8;

    const decay = 0.013 + (1 - bowlSlopeFactor(nr)) * 0.012;
    unit.hp -= decay;

    if (unit.hp <= 0) {
      eliminate(unit, "exploded");
    }
  }

  resolveCollisions(state.activeEvent === "Armor Mode" ? 0.65 : state.activeEvent === "Launch Burst" ? 1.2 : 1);
}

function updateFrame(now) {
  if (state.running) {
    updateUnits(now);
    updateEffects(now);

    for (const unit of state.units) {
      if (!unit.dead) updateTag(unit);
    }

    updateScoreboard();

    const remaining = aliveTeams();
    if (remaining.length <= 1) {
      state.running = false;
      const winner = remaining[0]?.name ?? "No one";
      statusText.textContent = `${winner} wins • ring-outs and explosions decided it`;
      eventText.textContent = "Event: done";
      backBtn.classList.remove("hidden");
      beep(730, 0.2, 0.07);
    } else {
      statusText.textContent = `Beyblade bowl battle live • ${remaining.length} teams remaining`;
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(updateFrame);
}
requestAnimationFrame(updateFrame);

function enterRecordingMode() {
  appRoot.classList.add("recording");
  backBtn.classList.remove("hidden");
}

function exitRecordingMode() {
  appRoot.classList.remove("recording");
  backBtn.classList.add("hidden");
}

function startBattle() {
  const followers = parseFollowers(textarea.value);
  if (followers.length < 20) {
    statusText.textContent = "Add at least 20 followers for a cleaner battle.";
    beep(180, 0.08, 0.05);
    return;
  }

  clearUnits();
  overlayLayer.innerHTML = "";

  const teamCount = Number(teamCountSelect.value);
  const eventCount = Number(eventCountSelect.value);
  const { units, teams } = createUnits(followers, teamCount);

  state.units = units;
  state.teams = teams;
  state.running = true;
  state.eventBudget = eventCount;
  state.activeEvent = "none";
  state.nextEventAt = performance.now() + 4500;
  state.activeEventUntil = 0;
  state.trails = [];
  state.explosions = [];

  enterRecordingMode();
  statusText.textContent = `Battle started • ${followers.length} beyblades launched`;
  eventText.textContent = "Event: none";
  updateScoreboard();
}

function resetBattle() {
  state.running = false;
  clearUnits();
  overlayLayer.innerHTML = "";
  state.units = [];
  state.teams = [];
  state.trails = [];
  state.explosions = [];
  statusText.textContent = "Waiting to start…";
  eventText.textContent = "Event: none";
  scoreboard.innerHTML = "";
  exitRecordingMode();
}

csvInput.addEventListener("change", async (e) => {
  const [file] = e.target.files;
  if (!file) return;
  textarea.value = await file.text();
});

useDemoBtn.addEventListener("click", () => {
  textarea.value = demoFollowers.join("\n");
});

startBtn.addEventListener("click", startBattle);
resetBtn.addEventListener("click", resetBattle);
backBtn.addEventListener("click", resetBattle);
