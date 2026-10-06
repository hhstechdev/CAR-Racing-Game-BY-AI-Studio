import * as THREE from 'three';
import { CarId, CARS } from '../types/game';

export interface CarModelInstance {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  frontWheelGroups: THREE.Group[];
  taillights: THREE.Mesh[];
  exhaustFlames: THREE.Mesh[];
  nameplateSprite: THREE.Sprite;
  shadowMesh: THREE.Mesh;
  carId: CarId;
  updateVisuals: (speed: number, steerAngle: number, isBraking: boolean, isBoosting: boolean) => void;
  setName: (name: string, position?: number) => void;
}

export function createCarModel(
  carId: CarId,
  playerName: string = 'Racer',
  playerIndex: number = 0
): CarModelInstance {
  const config = CARS[carId] || CARS.starter;
  const group = new THREE.Group();

  // Subtle livery tint if multiple players use the same car
  const liveryTints = [config.color, '#38bdf8', '#fbbf24', '#f43f5e', '#a855f7', '#22c55e'];
  const basePaintColor = liveryTints[playerIndex % liveryTints.length];

  const bodyMat = new THREE.MeshStandardMaterial({
    color: basePaintColor,
    metalness: 0.85,
    roughness: 0.25,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: '#18181b',
    metalness: 0.7,
    roughness: 0.4,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#0f172a',
    metalness: 0.9,
    roughness: 0.1,
    transmission: 0.6,
    thickness: 0.5,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    metalness: 0.95,
    roughness: 0.2,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: '#171717',
    metalness: 0.1,
    roughness: 0.85,
  });

  // --- Car Body Variations ---
  if (carId === 'lamborghini') {
    // Ultra-low angular wedge supercar
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.44, 4.6), bodyMat);
    lowerBody.position.y = 0.44;
    group.add(lowerBody);

    // Sharp wedge nose
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.4, 4), bodyMat);
    nose.rotation.y = Math.PI / 4;
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 0.38, 2.7);
    group.add(nose);

    // Front hood air extractors / vents
    const ventL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.65), carbonMat);
    ventL.position.set(-0.45, 0.56, 1.75);
    group.add(ventL);
    const ventR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.65), carbonMat);
    ventR.position.set(0.45, 0.56, 1.75);
    group.add(ventR);

    // Golden Lamborghini Raging Bull Shield on nose tip
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      metalness: 0.9,
      roughness: 0.2,
      emissive: '#d97706',
      emissiveIntensity: 0.6,
    });
    const bullShield = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.16), goldMat);
    bullShield.position.set(0, 0.50, 2.58);
    bullShield.rotation.x = -0.25;
    group.add(bullShield);

    // Stealth cockpit canopy
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.48, 2.1), glassMat);
    cockpit.position.set(0, 0.80, -0.2);
    group.add(cockpit);

    // Roof air intake scoop
    const roofScoop = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.9), carbonMat);
    roofScoop.position.set(0, 1.10, -0.15);
    group.add(roofScoop);

    // Iconic dorsal aerodynamic shark fin (connecting roof scoop to rear wing)
    const sharkFin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.36, 1.6), carbonMat);
    sharkFin.position.set(0, 1.05, -1.2);
    group.add(sharkFin);

    // Front splitter with aggressive aerodynamic canards
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.08, 0.9), carbonMat);
    splitter.position.set(0, 0.22, 2.7);
    group.add(splitter);

    const canardL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 0.4), carbonMat);
    canardL.position.set(-1.1, 0.35, 2.38);
    canardL.rotation.z = -0.3;
    group.add(canardL);

    const canardR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 0.4), carbonMat);
    canardR.position.set(1.1, 0.35, 2.38);
    canardR.rotation.z = 0.3;
    group.add(canardR);

    // Side air intake scoops & side skirts
    const sideSkirtL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 2.6), carbonMat);
    sideSkirtL.position.set(-1.1, 0.22, 0);
    group.add(sideSkirtL);

    const sideSkirtR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 2.6), carbonMat);
    sideSkirtR.position.set(1.1, 0.22, 0);
    group.add(sideSkirtR);

    const intakeL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 1.1), carbonMat);
    intakeL.position.set(-1.05, 0.50, -0.5);
    group.add(intakeL);

    const intakeR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 1.1), carbonMat);
    intakeR.position.set(1.05, 0.50, -0.5);
    group.add(intakeR);

    // Massive GT Wing with endplates
    const wingSupportL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.4), carbonMat);
    wingSupportL.position.set(-0.7, 0.88, -2.1);
    group.add(wingSupportL);

    const wingSupportR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.4), carbonMat);
    wingSupportR.position.set(0.7, 0.88, -2.1);
    group.add(wingSupportR);

    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.08, 0.5), carbonMat);
    wingBlade.position.set(0, 1.15, -2.1);
    group.add(wingBlade);

    // Wing endplates
    const endplateL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.55), carbonMat);
    endplateL.position.set(-1.18, 1.15, -2.1);
    group.add(endplateL);

    const endplateR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.55), carbonMat);
    endplateR.position.set(1.18, 1.15, -2.1);
    group.add(endplateR);

    // Rear diffuser with vertical strakes
    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.15, 0.9), carbonMat);
    diffuser.position.set(0, 0.22, -2.35);
    group.add(diffuser);
  } else if (carId === 'bmw') {
    // Muscular touring car body with signature double kidney grille
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 4.4), bodyMat);
    mainBody.position.y = 0.55;
    group.add(mainBody);

    // Greenhouse cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 2.3), glassMat);
    cabin.position.set(0, 1.05, -0.2);
    group.add(cabin);

    // Flared front & rear wheel arches
    const archMat = bodyMat;
    const archFL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 1.1), archMat);
    archFL.position.set(-1.05, 0.55, 1.4);
    group.add(archFL);
    const archFR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 1.1), archMat);
    archFR.position.set(1.05, 0.55, 1.4);
    group.add(archFR);
    const archRL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 1.1), archMat);
    archRL.position.set(-1.05, 0.55, -1.4);
    group.add(archRL);
    const archRR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 1.1), archMat);
    archRR.position.set(1.05, 0.55, -1.4);
    group.add(archRR);

    // Front Kidney Grille
    const kidneyL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.1), carbonMat);
    kidneyL.position.set(-0.25, 0.55, 2.22);
    group.add(kidneyL);
    const kidneyR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.1), carbonMat);
    kidneyR.position.set(0.25, 0.55, 2.22);
    group.add(kidneyR);

    // Rear Touring Spoiler
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.4), carbonMat);
    spoiler.position.set(0, 1.05, -2.1);
    group.add(spoiler);
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.2), carbonMat);
    postL.position.set(-0.6, 0.9, -2.1);
    group.add(postL);
    const postR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.2), carbonMat);
    postR.position.set(0.6, 0.9, -2.1);
    group.add(postR);
  } else if (carId === 'ferrari') {
    // Flowing sculpted Italian hypercar
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.5, 4.6), bodyMat);
    mainBody.position.y = 0.5;
    group.add(mainBody);

    // Sloped nose with aerodynamic central scoop
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 1.2), bodyMat);
    nose.position.set(0, 0.38, 2.6);
    group.add(nose);

    // Teardrop hypercar cockpit
    const cabin = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.85, 2.4, 16), glassMat);
    cabin.rotation.x = Math.PI / 2;
    cabin.position.set(0, 0.88, -0.1);
    group.add(cabin);

    // Side air intakes
    const intakeL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 1.2), carbonMat);
    intakeL.position.set(-1.05, 0.52, -0.4);
    group.add(intakeL);
    const intakeR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 1.2), carbonMat);
    intakeR.position.set(1.05, 0.52, -0.4);
    group.add(intakeR);

    // Sculpted rear diffuser
    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.15, 0.8), carbonMat);
    diffuser.position.set(0, 0.26, -2.35);
    group.add(diffuser);

    // Integrated ducktail wing
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.1, 0.45), carbonMat);
    wing.position.set(0, 0.88, -2.25);
    group.add(wing);
  } else {
    // Starter Car: Apex GT Coupé
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 4.2), bodyMat);
    mainBody.position.y = 0.55;
    group.add(mainBody);

    // Sloped cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 2.1), glassMat);
    cabin.position.set(0, 1.0, -0.15);
    group.add(cabin);

    // Carbon roof panel
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.05, 1.8), carbonMat);
    roof.position.set(0, 1.26, -0.15);
    group.add(roof);

    // Front splitter
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.08, 0.6), carbonMat);
    splitter.position.set(0, 0.26, 2.2);
    group.add(splitter);

    // Rear spoiler
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.35), carbonMat);
    spoiler.position.set(0, 0.95, -2.05);
    group.add(spoiler);
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.15), carbonMat);
    postL.position.set(-0.55, 0.84, -2.05);
    group.add(postL);
    const postR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.15), carbonMat);
    postR.position.set(0.55, 0.84, -2.05);
    group.add(postR);
  }

  // --- Headlights ---
  const headlightZ = carId === 'lamborghini' ? 2.45 : 2.25;
  const headlightY = carId === 'lamborghini' ? 0.44 : 0.5;
  const headlightX = carId === 'lamborghini' ? 0.72 : 0.7;
  const headlightGeom = carId === 'lamborghini'
    ? new THREE.BoxGeometry(0.38, 0.09, 0.18)
    : new THREE.BoxGeometry(0.4, 0.15, 0.1);
  const headlightMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#e0f2fe',
    emissiveIntensity: 1.8,
    roughness: 0.1,
  });

  const headlightL = new THREE.Mesh(headlightGeom, headlightMat);
  headlightL.position.set(-headlightX, headlightY, headlightZ);
  if (carId === 'lamborghini') {
    headlightL.rotation.y = 0.2;
    headlightL.rotation.x = -0.15;
  }
  group.add(headlightL);

  const headlightR = new THREE.Mesh(headlightGeom, headlightMat);
  headlightR.position.set(headlightX, headlightY, headlightZ);
  if (carId === 'lamborghini') {
    headlightR.rotation.y = -0.2;
    headlightR.rotation.x = -0.15;
  }
  group.add(headlightR);

  if (carId === 'lamborghini') {
    // Iconic Lamborghini Y-shape LED daytime running light accents
    const yMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#0284c7',
      emissiveIntensity: 2.2,
    });
    const drlL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.1), yMat);
    drlL.position.set(-0.72, 0.47, 2.48);
    drlL.rotation.z = -0.3;
    group.add(drlL);

    const drlR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.1), yMat);
    drlR.position.set(0.72, 0.47, 2.48);
    drlR.rotation.z = 0.3;
    group.add(drlR);
  }

  // --- Taillights ---
  const taillights: THREE.Mesh[] = [];
  const taillightGeom = new THREE.BoxGeometry(0.45, 0.14, 0.1);
  const taillightMat = new THREE.MeshStandardMaterial({
    color: '#7f1d1d',
    emissive: '#dc2626',
    emissiveIntensity: 0.5,
    roughness: 0.2,
  });

  const taillightL = new THREE.Mesh(taillightGeom, taillightMat.clone());
  taillightL.position.set(-0.65, 0.55, -2.25);
  group.add(taillightL);
  taillights.push(taillightL);

  const taillightR = new THREE.Mesh(taillightGeom, taillightMat.clone());
  taillightR.position.set(0.65, 0.55, -2.25);
  group.add(taillightR);
  taillights.push(taillightR);

  // --- Exhaust Pipes & Nitro Flame Bursts ---
  const exhaustFlames: THREE.Mesh[] = [];
  const exhaustPositions = [-0.4, 0.4];

  exhaustPositions.forEach((xPos) => {
    // Pipe tip
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.3, 12),
      carbonMat
    );
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(xPos, 0.35, -2.3);
    group.add(pipe);

    // Nitro flame cone
    const flameMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.0,
    });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.8, 8), flameMat);
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(xPos, 0.35, -2.8);
    group.add(flame);
    exhaustFlames.push(flame);
  });

  // --- Wheels (Front steerable, all rollable) ---
  const wheels: THREE.Mesh[] = [];
  const frontWheelGroups: THREE.Group[] = [];

  const wheelPositions = [
    { x: -1.0, y: 0.38, z: 1.4, isFront: true },
    { x: 1.0, y: 0.38, z: 1.4, isFront: true },
    { x: -1.0, y: 0.38, z: -1.4, isFront: false },
    { x: 1.0, y: 0.38, z: -1.4, isFront: false },
  ];

  wheelPositions.forEach((wp) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(wp.x, wp.y, wp.z);

    // Wheel mesh
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.32, 18), tireMat);
    wheel.rotation.z = Math.PI / 2;

    // Rim hub
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.33, 10), rimMat);
    wheel.add(rim);

    // High performance brake caliper
    const caliperMat = new THREE.MeshStandardMaterial({
      color: carId === 'lamborghini' ? '#84cc16' : '#dc2626',
      metalness: 0.7,
      roughness: 0.3,
    });
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.1), caliperMat);
    caliper.position.set(wp.x > 0 ? 0.08 : -0.08, 0.14, 0);
    wheelGroup.add(caliper);

    wheelGroup.add(wheel);
    wheels.push(wheel);

    if (wp.isFront) {
      frontWheelGroups.push(wheelGroup);
    }

    group.add(wheelGroup);
  });

  // --- Soft Under-car Ground Shadow ---
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sCtx = shadowCanvas.getContext('2d')!;
  const gradient = sCtx.createRadialGradient(64, 64, 10, 64, 64, 60);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
  gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.3)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sCtx.fillStyle = gradient;
  sCtx.fillRect(0, 0, 128, 128);

  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 5.0),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
  );
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.03;
  group.add(shadowMesh);

  // --- Floating Nameplate Sprite ---
  const createNameTexture = (name: string, pos?: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;

    // Rounded tag background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(12, 12, 360, 72, 16);
    ctx.fill();

    // Border
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    // Position rank pill if provided
    let textX = 192;
    if (pos !== undefined) {
      ctx.fillStyle = pos === 1 ? '#eab308' : '#38bdf8';
      ctx.beginPath();
      ctx.roundRect(24, 24, 48, 48, 10);
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 26px "Chakra Petch", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`P${pos}`, 48, 48);

      textX = 220;
    }

    // Name text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.slice(0, 14), textX, 48);

    return new THREE.CanvasTexture(canvas);
  };

  const nameTexture = createNameTexture(playerName);
  const spriteMat = new THREE.SpriteMaterial({
    map: nameTexture,
    transparent: true,
    depthTest: false,
  });
  const nameplateSprite = new THREE.Sprite(spriteMat);
  nameplateSprite.scale.set(3.2, 0.8, 1);
  nameplateSprite.position.set(0, 2.3, 0);
  group.add(nameplateSprite);

  let lastName = playerName;
  let lastPos: number | undefined = undefined;

  const setName = (name: string, position?: number) => {
    if (name === lastName && position === lastPos) return;
    lastName = name;
    lastPos = position;

    const oldTex = nameplateSprite.material.map;
    const newTex = createNameTexture(name, position);
    nameplateSprite.material.map = newTex;
    nameplateSprite.material.needsUpdate = true;
    if (oldTex) {
      oldTex.dispose();
    }
  };

  // --- Visuals Update Loop ---
  const updateVisuals = (
    speed: number,
    steerAngle: number,
    isBraking: boolean,
    isBoosting: boolean
  ) => {
    // Steer front wheels
    frontWheelGroups.forEach((fg) => {
      fg.rotation.y = steerAngle * 0.7;
    });

    // Roll wheels based on speed
    const rollDelta = (speed * 0.05);
    wheels.forEach((w) => {
      w.rotation.x += rollDelta;
    });

    // Taillight glow on braking
    taillights.forEach((tl) => {
      const mat = tl.material as THREE.MeshStandardMaterial;
      if (isBraking) {
        mat.emissive.set('#ef4444');
        mat.emissiveIntensity = 2.5;
      } else {
        mat.emissive.set('#991b1b');
        mat.emissiveIntensity = 0.5;
      }
    });

    // Nitro exhaust flames
    exhaustFlames.forEach((flame) => {
      const mat = flame.material as THREE.MeshBasicMaterial;
      if (isBoosting) {
        mat.opacity = 0.85 + Math.random() * 0.15;
        flame.scale.set(
          0.9 + Math.random() * 0.3,
          1.0 + Math.random() * 0.5,
          0.9 + Math.random() * 0.3
        );
      } else {
        mat.opacity = 0.0;
      }
    });
  };

  return {
    group,
    wheels,
    frontWheelGroups,
    taillights,
    exhaustFlames,
    nameplateSprite,
    shadowMesh,
    carId,
    updateVisuals,
    setName,
  };
}
