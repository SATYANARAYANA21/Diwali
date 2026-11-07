import { useEffect, useRef } from "react";
import * as THREE from "three";

const BACKDROP = `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BACKDROP_FRAGMENT = `
  varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);
  }
  void main(){
    vec3 zenith=vec3(0.031,0.051,0.141);
    vec3 indigo=vec3(0.067,0.102,0.231);
    vec3 violet=vec3(0.188,0.125,0.310);
    float h=smoothstep(0.06,0.94,vUv.y);
    vec3 col=mix(violet,indigo,smoothstep(0.02,0.7,h));
    col=mix(col,zenith,smoothstep(0.4,1.0,h));
    float cloud=noise(vUv*vec2(8.0,5.0)+vec2(0.0,0.08))*0.55+noise(vUv*vec2(17.0,8.0))*0.25;
    float veil=smoothstep(0.1,0.9,cloud)*smoothstep(0.02,0.52,1.0-vUv.y)*0.12;
    col=mix(col,vec3(0.29,0.19,0.34),veil);
    float halo=exp(-length((vUv-vec2(0.5,0.27))*vec2(1.05,1.1))*3.1);
    col+=vec3(0.18,0.095,0.055)*halo*0.19;
    gl_FragColor=vec4(col,1.0);
  }
`;

const PARTICLE_VERTEX = `
  attribute float aAlpha;
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  varying float vAlpha;
  varying vec3 vColor;
  void main(){
    vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
    vAlpha=aAlpha*(0.76+0.24*sin(uTime*1.8+aPhase));
    vColor=color;
    gl_PointSize=aSize;
    gl_Position=projectionMatrix*mvPosition;
  }
`;

const PARTICLE_FRAGMENT = `
  varying float vAlpha;
  varying vec3 vColor;
  void main(){
    float d=length(gl_PointCoord-0.5);
    float core=1.0-smoothstep(0.03,0.5,d);
    float glow=exp(-d*7.0)*0.48;
    vec3 spark=vColor*(core*1.25+glow*1.35);
    gl_FragColor=vec4(spark, (core+glow)*vAlpha);
  }
`;

type BurstParticle = { vx: number; vy: number; vz: number; drag: number; phase: number };
type BurstPoolItem = { mesh: THREE.InstancedMesh; material: THREE.MeshBasicMaterial; positions: Float32Array; data: BurstParticle[]; started: number; active: boolean; count: number };
type Rocket = { line: THREE.Line; geometry: THREE.BufferGeometry; points: Float32Array; active: boolean; age: number; duration: number; sx: number; sy: number; ex: number; ey: number; hue: number };

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export function DiwaliEnvironment() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
    } catch {
      canvas.classList.add("environment-canvas--fallback");
      return undefined;
    }
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-9, 9, 5.6, -5.6, 0.1, 60);
    camera.position.set(0, 0, 20);
    const clock = new THREE.Clock();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    let mobile = window.innerWidth < 700 || isCoarse;

    const backdropMaterial = new THREE.ShaderMaterial({ vertexShader: BACKDROP, fragmentShader: BACKDROP_FRAGMENT, depthWrite: false });
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), backdropMaterial);
    backdrop.position.z = -12;
    scene.add(backdrop);

    const starCount = mobile ? 560 : 1120;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starAlpha = new Float32Array(starCount);
    const starSize = new Float32Array(starCount);
    const starPhase = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = rand(-9, 9);
      starPositions[i * 3 + 1] = rand(-5.5, 5.5);
      starPositions[i * 3 + 2] = rand(-4, -1);
      const warm = Math.random() > 0.84;
      const color = new THREE.Color(warm ? "#ffd88a" : Math.random() > 0.8 ? "#c9c3ee" : "#d6e0ff");
      color.toArray(starColors, i * 3);
      starAlpha[i] = rand(0.22, 0.83);
      starSize[i] = rand(1.0, 2.35);
      starPhase[i] = rand(0, Math.PI * 2);
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
    starGeometry.setAttribute("aAlpha", new THREE.BufferAttribute(starAlpha, 1));
    starGeometry.setAttribute("aSize", new THREE.BufferAttribute(starSize, 1));
    starGeometry.setAttribute("aPhase", new THREE.BufferAttribute(starPhase, 1));
    const starMaterial = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERTEX, fragmentShader: PARTICLE_FRAGMENT,
      uniforms: { uTime: { value: 0 } }, vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    stars.position.z = -4;
    scene.add(stars);

    const driftCount = mobile ? 48 : 92;
    const driftGeometry = new THREE.BufferGeometry();
    const driftPositions = new Float32Array(driftCount * 3);
    const driftColors = new Float32Array(driftCount * 3);
    const driftAlpha = new Float32Array(driftCount);
    const driftSize = new Float32Array(driftCount);
    const driftPhase = new Float32Array(driftCount);
    for (let i = 0; i < driftCount; i++) {
      driftPositions[i * 3] = rand(-9, 9);
      driftPositions[i * 3 + 1] = rand(-5.4, 5.4);
      driftPositions[i * 3 + 2] = rand(-1.5, 0.5);
      new THREE.Color(Math.random() > 0.6 ? "#ffd88a" : "#d6ad60").toArray(driftColors, i * 3);
      driftAlpha[i] = rand(0.12, 0.42);
      driftSize[i] = rand(1.4, 3.0);
      driftPhase[i] = rand(0, Math.PI * 2);
    }
    driftGeometry.setAttribute("position", new THREE.BufferAttribute(driftPositions, 3));
    driftGeometry.setAttribute("color", new THREE.BufferAttribute(driftColors, 3));
    driftGeometry.setAttribute("aAlpha", new THREE.BufferAttribute(driftAlpha, 1));
    driftGeometry.setAttribute("aSize", new THREE.BufferAttribute(driftSize, 1));
    driftGeometry.setAttribute("aPhase", new THREE.BufferAttribute(driftPhase, 1));
    const driftMaterial = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERTEX, fragmentShader: PARTICLE_FRAGMENT,
      uniforms: { uTime: { value: 0 } }, vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const drift = new THREE.Points(driftGeometry, driftMaterial);
    drift.position.z = -1.4;
    scene.add(drift);

    const burstSlots = mobile ? 3 : 5;
    const burstCapacity = 116;
    const sparkGeometry = new THREE.SphereGeometry(0.038, 6, 4);
    const burstPool: BurstPoolItem[] = [];
    for (let slot = 0; slot < burstSlots; slot++) {
      const material = new THREE.MeshBasicMaterial({
        color: "#ffffff", transparent: true, opacity: 0.92,
        blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
      });
      const mesh = new THREE.InstancedMesh(sparkGeometry, material, burstCapacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.position.z = -1.8;
      scene.add(mesh);
      const positions = new Float32Array(burstCapacity * 3);
      burstPool.push({ mesh, material, positions, data: [], started: -100, active: false, count: 0 });
    }
    const particleTransform = new THREE.Object3D();

    const rocketPool: Rocket[] = [];
    const rocketCapacity = 14;
    for (let i = 0; i < 3; i++) {
      const geometry = new THREE.BufferGeometry();
      const points = new Float32Array(rocketCapacity * 3);
      geometry.setAttribute("position", new THREE.BufferAttribute(points, 3).setUsage(THREE.DynamicDrawUsage));
      const material = new THREE.LineBasicMaterial({ color: "#ffd88a", transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
      const line = new THREE.Line(geometry, material);
      line.frustumCulled = false;
      line.visible = false;
      line.position.z = -1.8;
      scene.add(line);
      rocketPool.push({ line, geometry, points, active: false, age: 0, duration: 1, sx: 0, sy: 0, ex: 0, ey: 0, hue: 0 });
    }

    const lamps: Array<{ group: THREE.Group; flame: THREE.Mesh; core: THREE.Mesh; light: THREE.PointLight; phase: number }> = [];
    function createDiya(xSide: number, scale: number) {
      const group = new THREE.Group();
      group.scale.setScalar(scale);
      group.position.set(xSide, -4.65, -1.2);
      const bowlMaterial = new THREE.MeshStandardMaterial({ color: "#9a5728", metalness: 0.74, roughness: 0.27, emissive: "#301106", emissiveIntensity: 0.55 });
      const goldMaterial = new THREE.MeshStandardMaterial({ color: "#d6ad60", metalness: 0.83, roughness: 0.23, emissive: "#6a3911", emissiveIntensity: 0.28 });
      const oilMaterial = new THREE.MeshBasicMaterial({ color: "#ffb34c" });
      const flameMaterial = new THREE.MeshBasicMaterial({ color: "#ff8c32", transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
      const coreMaterial = new THREE.MeshBasicMaterial({ color: "#ffe6a4", transparent: true, opacity: 0.86, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
      const profile = [new THREE.Vector2(0, 0), new THREE.Vector2(0.1, 0.01), new THREE.Vector2(0.22, 0.04), new THREE.Vector2(0.37, 0.11), new THREE.Vector2(0.49, 0.22), new THREE.Vector2(0.47, 0.26), new THREE.Vector2(0.4, 0.22), new THREE.Vector2(0.3, 0.16), new THREE.Vector2(0.16, 0.11), new THREE.Vector2(0, 0.1)];
      const bowl = new THREE.Mesh(new THREE.LatheGeometry(profile, 40), bowlMaterial);
      bowl.position.y = 0.02;
      group.add(bowl);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.024, 8, 52), goldMaterial);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.24;
      group.add(rim);
      const oil = new THREE.Mesh(new THREE.CircleGeometry(0.25, 32), oilMaterial);
      oil.rotation.x = -Math.PI / 2;
      oil.position.set(0.02, 0.185, 0);
      group.add(oil);
      const flameShape = new THREE.Shape();
      flameShape.moveTo(0, 0); flameShape.bezierCurveTo(-0.22, 0.25, -0.05, 0.62, 0.02, 0.86);
      flameShape.bezierCurveTo(0.25, 0.55, 0.18, 0.31, 0, 0); flameShape.closePath();
      const flame = new THREE.Mesh(new THREE.ShapeGeometry(flameShape, 16), flameMaterial);
      flame.position.set(0.08, 0.2, 0.02);
      const core = new THREE.Mesh(new THREE.ShapeGeometry(flameShape, 16), coreMaterial);
      core.scale.set(0.42, 0.57, 1);
      core.position.set(0.08, 0.2, 0.03);
      group.add(flame, core);
      const light = new THREE.PointLight("#ff9a42", 1.3, 4.8, 1.7);
      light.position.set(0.08, 0.74, 0.35);
      group.add(light);
      scene.add(group);
      lamps.push({ group, flame, core, light, phase: rand(0, Math.PI * 2) });
    }
    createDiya(-7.2, 0.86);
    createDiya(7.2, 0.86);
    createDiya(0, 0.62);

    function launchRocket(width: number, height: number) {
      const rocket = rocketPool.find((item) => !item.active);
      if (!rocket) return;
      const side = Math.random() > 0.5 ? 1 : -1;
      const edgeX = width * rand(0.30, 0.44);
      rocket.sx = side * edgeX;
      rocket.sy = -height * 0.51;
      rocket.ex = mobile
        ? side * width * rand(0.29, 0.37) + rand(-0.12, 0.12)
        : side * width * rand(0.36, 0.44) + rand(-0.35, 0.35);
      // Break above the paper frame so the burst stays in clear sky rather
      // than flashing behind the isolated letter.
      rocket.ey = mobile ? rand(height * 0.48, height * 0.55) : rand(height * 0.44, height * 0.52);
      rocket.duration = rand(0.92, 1.35);
      rocket.hue = [0.105, 0.78, 0.94][Math.floor(Math.random() * 3)];
      rocket.age = 0;
      rocket.active = true;
      rocket.line.visible = true;
      const material = rocket.line.material as THREE.LineBasicMaterial;
      material.color.setHSL(rocket.hue, 0.78, 0.68);
    }

    function explode(x: number, y: number, time: number, hue: number) {
      const burst = burstPool.find((item) => !item.active) ?? burstPool.reduce((oldest, item) => item.started < oldest.started ? item : oldest);
      const count = mobile ? 58 : Math.floor(rand(78, 112));
      const color = new THREE.Color().setHSL(hue, hue < 0.17 ? 0.7 : 0.67, hue < 0.17 ? 0.7 : 0.66);
      burst.material.color.copy(color);
      burst.data = [];
      for (let i = 0; i < burstCapacity; i++) {
        const active = i < count;
        const theta = rand(0, Math.PI * 2);
        const u = rand(-1, 1);
        const ring = Math.sqrt(1 - u * u);
        const speed = rand(1.4, 3.15) * (Math.random() > 0.84 ? 1.25 : 1);
        burst.positions[i * 3] = x;
        burst.positions[i * 3 + 1] = y;
        burst.positions[i * 3 + 2] = -1.9;
        burst.data.push({ vx: Math.cos(theta) * ring * speed, vy: u * speed, vz: Math.sin(theta) * ring * speed * 0.28, drag: rand(0.975, 0.991), phase: rand(0, 6.28) });
        if (active && Math.random() > 0.86) burst.positions[i * 3 + 2] = -1.7;
      }
      burst.mesh.count = count;
      burst.mesh.visible = true;
      burst.material.opacity = 0.92;
      burst.active = true;
      burst.started = time;
    }

    let nextLaunch = reducedMotion ? 3 : 1.15;
    let elapsed = 0;
    let raf = 0;
    let lastWidth = 18;
    let lastHeight = 11.2;
    let disposed = false;

    const placeSideLamps = () => {
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      const pxPerWorld = viewH / lastHeight;
      const paper = document.querySelector<HTMLElement>(".paper-shell")?.getBoundingClientRect();
      const footer = document.querySelector<HTMLElement>(".colophon")?.getBoundingClientRect();
      if (!paper || paper.width <= 0 || paper.height <= 0) return;

      const leftGutter = Math.max(0, paper.left);
      const rightGutter = Math.max(0, viewW - paper.right);
      const lampWidth = 1.12 * 0.86 * pxPerWorld;
      const safeInset = 12;
      let leftPx: number;
      let rightPx: number;
      let centerY: number;

      if (leftGutter >= lampWidth + safeInset * 2 && rightGutter >= lampWidth + safeInset * 2) {
        // The renderer scissors out the paper rectangle, so use its side gutters
        // only when each diya fits completely outside that isolated iframe.
        leftPx = leftGutter / 2;
        rightPx = paper.right + rightGutter / 2;
        centerY = paper.top + paper.height * 0.72;
      } else {
        // On narrow screens, the iframe fills the width. Place both lamps in the
        // clear band below it, above the safe-area-aware colophon.
        const footerTop = footer?.top ?? viewH - Math.max(24, safeInset);
        const availableTop = Math.min(viewH - safeInset, footerTop) - safeInset;
        const bandTop = Math.min(availableTop, paper.bottom + safeInset);
        centerY = bandTop + Math.max(0, availableTop - bandTop) / 2;
        leftPx = Math.max(lampWidth / 2 + safeInset, viewW * 0.22);
        rightPx = Math.min(viewW - lampWidth / 2 - safeInset, viewW * 0.78);
      }

      const toWorldX = (px: number) => (px - viewW / 2) / pxPerWorld;
      const toWorldY = (px: number) => (viewH / 2 - px) / pxPerWorld;
      lamps[0].group.position.set(toWorldX(leftPx), toWorldY(centerY), -1.2);
      lamps[1].group.position.set(toWorldX(rightPx), toWorldY(centerY), -1.2);
    };

    const resize = () => {
      const widthPx = window.innerWidth;
      const heightPx = window.innerHeight;
      const aspect = widthPx / Math.max(1, heightPx);
      mobile = widthPx < 700 || isCoarse;
      lastHeight = 12.2;
      lastWidth = lastHeight * aspect;
      camera.left = -lastWidth / 2; camera.right = lastWidth / 2;
      camera.top = lastHeight / 2; camera.bottom = -lastHeight / 2;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.35 : 1.7));
      renderer.setSize(widthPx, heightPx, false);
      backdrop.scale.set(lastWidth, lastHeight, 1);
      lamps.forEach((lamp, index) => {
        if (index === 2) { lamp.group.visible = aspect > 0.8; return; }
        lamp.group.visible = true;
      });
      placeSideLamps();
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else { clock.getDelta(); raf = requestAnimationFrame(frame); }
    };
    document.addEventListener("visibilitychange", onVisibility);

    function frame() {
      if (disposed || document.hidden) return;
      const dt = Math.min(clock.getDelta(), 0.04);
      elapsed += dt;
      starMaterial.uniforms.uTime.value = elapsed;
      driftMaterial.uniforms.uTime.value = elapsed * 0.7;

      if (!reducedMotion && elapsed >= nextLaunch) {
        launchRocket(lastWidth, lastHeight);
        nextLaunch = elapsed + rand(mobile ? 2.9 : 2.3, mobile ? 5.1 : 4.6);
      }

      for (const rocket of rocketPool) {
        if (!rocket.active) continue;
        rocket.age += dt;
        const t = Math.min(rocket.age / rocket.duration, 1);
        const curve = t * t * (3 - 2 * t);
        const headX = THREE.MathUtils.lerp(rocket.sx, rocket.ex, t);
        const headY = THREE.MathUtils.lerp(rocket.sy, rocket.ey, curve);
        for (let i = 0; i < rocketCapacity; i++) {
          const trailT = Math.max(0, t - ((rocketCapacity - 1 - i) / rocketCapacity) * 0.11);
          const eased = trailT * trailT * (3 - 2 * trailT);
          rocket.points[i * 3] = THREE.MathUtils.lerp(rocket.sx, rocket.ex, trailT) + Math.sin(elapsed * 15 + i) * 0.018;
          rocket.points[i * 3 + 1] = THREE.MathUtils.lerp(rocket.sy, rocket.ey, eased);
          rocket.points[i * 3 + 2] = -2.1;
        }
        (rocket.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
        (rocket.line.material as THREE.LineBasicMaterial).opacity = 0.78 * (1 - Math.max(0, t - 0.72) / 0.28);
        void headX; void headY;
        if (rocket.age >= rocket.duration) {
          explode(rocket.ex, rocket.ey, elapsed, rocket.hue);
          rocket.active = false;
          rocket.line.visible = false;
        }
      }

      for (const burst of burstPool) {
        if (!burst.active) continue;
        const age = elapsed - burst.started;
        for (let i = 0; i < burst.count; i++) {
          const p = burst.data[i];
          const k = i * 3;
          p.vx *= p.drag; p.vy = p.vy * p.drag - dt * 1.45; p.vz *= p.drag;
          burst.positions[k] += p.vx * dt;
          burst.positions[k + 1] += p.vy * dt;
          burst.positions[k + 2] += p.vz * dt;
          const life = Math.max(0, 1 - age / (p.vy > 0.2 ? 4.4 : 4.0));
          particleTransform.position.set(burst.positions[k], burst.positions[k + 1], burst.positions[k + 2]);
          particleTransform.scale.setScalar(life * 3.0);
          particleTransform.updateMatrix();
          burst.mesh.setMatrixAt(i, particleTransform.matrix);
        }
        burst.mesh.instanceMatrix.needsUpdate = true;
        burst.material.opacity = 0.92 * Math.max(0, 1 - age / 4.8);
        if (age > 4.8) { burst.active = false; burst.mesh.visible = false; burst.mesh.count = 0; }
      }

      const driftAttr = driftGeometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < driftCount; i++) {
        const y = driftPositions[i * 3 + 1] + dt * (0.035 + (i % 5) * 0.005);
        driftPositions[i * 3 + 1] = y > lastHeight * 0.56 ? -lastHeight * 0.55 : y;
        driftPositions[i * 3] += Math.sin(elapsed * 0.23 + driftPhase[i]) * dt * 0.018;
      }
      driftAttr.needsUpdate = true;
      for (const lamp of lamps) {
        const flicker = 0.94 + 0.06 * Math.sin(elapsed * 8 + lamp.phase) + 0.035 * Math.sin(elapsed * 17 + lamp.phase * 3);
        lamp.flame.scale.set(1 + 0.045 * Math.sin(elapsed * 11 + lamp.phase), flicker, 1);
        lamp.core.scale.set(0.42, 0.57 * flicker, 1);
        lamp.light.intensity = 1.05 + flicker * 0.32;
      }
      (stars.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;
      const letter = document.querySelector<HTMLElement>(".paper-shell")?.getBoundingClientRect();
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      placeSideLamps();
      renderer.setViewport(0, 0, viewW, viewH);
      renderer.setScissorTest(true);
      if (letter && letter.width > 0 && letter.height > 0) {
        const top = THREE.MathUtils.clamp(letter.top, 0, viewH);
        const bottom = THREE.MathUtils.clamp(letter.bottom, 0, viewH);
        const left = THREE.MathUtils.clamp(letter.left, 0, viewW);
        const right = THREE.MathUtils.clamp(letter.right, 0, viewW);
        const regions: Array<[number, number, number, number]> = [
          [0, viewH - top, viewW, top],
          [0, 0, viewW, viewH - bottom],
          [0, 0, left, viewH],
          [right, 0, viewW - right, viewH],
        ];
        for (const [x, y, width, height] of regions) {
          if (width <= 0 || height <= 0) continue;
          renderer.setScissor(x, y, width, height);
          renderer.render(scene, camera);
        }
      } else {
        renderer.setScissor(0, 0, viewW, viewH);
        renderer.render(scene, camera);
      }
      renderer.setScissorTest(false);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="environment-canvas" aria-hidden="true" />;
}
