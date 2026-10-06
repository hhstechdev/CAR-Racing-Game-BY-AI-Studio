import * as THREE from 'three';

export interface Checkpoint {
  id: number;
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3;
  width: number;
  t: number; // 0 to 1 along spline
}

export interface BoostPickupItem {
  id: number;
  position: THREE.Vector3;
  mesh: THREE.Group;
  active: boolean;
  collectedAt: number;
}

export class Circuit {
  public scene: THREE.Group;
  public curve: THREE.CatmullRomCurve3;
  public checkpoints: Checkpoint[] = [];
  public boostPickups: BoostPickupItem[] = [];
  public trackWidth = 18;
  public length = 0;

  // Grid slots positions & rotations for starting grid
  public gridSlots: { position: THREE.Vector3; rotation: number }[] = [];

  // Starting lights meshes
  public startLights: THREE.Mesh[] = [];

  constructor() {
    this.scene = new THREE.Group();
    this.curve = this.createTrackCurve();
    this.length = this.curve.getLength();
    this.generateTrackMesh();
    this.generateCurbs();
    this.generateStartFinishGantry();
    this.generateStartingGrid();
    this.generateGrandstands();
    this.generatePitBuilding();
    this.generateBarriers();
    this.generateTracksideProps();
    this.generateCheckpoints();
    this.generateBoostPickups();
    this.generateGroundAndEnvironment();
  }

  private createTrackCurve(): THREE.CatmullRomCurve3 {
    // 16 key circuit nodes forming an authentic motorsport Grand Prix layout
    const points = [
      new THREE.Vector3(0, 0, 0),        // 0: Start/Finish line (main straight)
      new THREE.Vector3(0, 0, 140),      // 1: Main straight mid
      new THREE.Vector3(0, 0, 260),      // 2: Main straight end (braking zone)
      new THREE.Vector3(35, 0, 320),     // 3: Turn 1 right kink
      new THREE.Vector3(90, 0, 340),     // 4: Turn 2 chicane exit
      new THREE.Vector3(180, 0, 320),    // 5: Sweeping fast Turn 3
      new THREE.Vector3(260, 0, 240),    // 6: Approaching hairpin
      new THREE.Vector3(280, 0, 160),    // 7: Hairpin apex
      new THREE.Vector3(250, 0, 80),     // 8: Hairpin exit
      new THREE.Vector3(180, 0, 30),     // 9: Back straight entry
      new THREE.Vector3(140, 0, -80),    // 10: Esses 1 (Turn 5)
      new THREE.Vector3(80, 0, -140),    // 11: Esses 2 (Turn 6)
      new THREE.Vector3(20, 0, -200),    // 12: High-speed Turn 7
      new THREE.Vector3(-80, 0, -230),   // 13: Banked Turn 8 entry
      new THREE.Vector3(-150, 0, -180),  // 14: Banked Turn 8 apex
      new THREE.Vector3(-140, 0, -80),   // 15: Final sector straight
      new THREE.Vector3(-100, 0, -10),   // 16: Final chicane
      new THREE.Vector3(-40, 0, -20),    // 17: Onto main straight
    ];

    return new THREE.CatmullRomCurve3(points, true, 'centripetal');
  }

  private generateTrackMesh() {
    const numSegments = 300;
    const halfWidth = this.trackWidth / 2;

    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= numSegments; i++) {
      const t = i / numSegments;
      const point = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      // Left vertex
      const left = new THREE.Vector3().copy(point).addScaledVector(normal, halfWidth);
      positions.push(left.x, 0.05, left.z);
      normals.push(0, 1, 0);
      uvs.push(0, t * 80);

      // Center vertex (for centerline texture if needed)
      positions.push(point.x, 0.05, point.z);
      normals.push(0, 1, 0);
      uvs.push(0.5, t * 80);

      // Right vertex
      const right = new THREE.Vector3().copy(point).addScaledVector(normal, -halfWidth);
      positions.push(right.x, 0.05, right.z);
      normals.push(0, 1, 0);
      uvs.push(1, t * 80);

      if (i < numSegments) {
        const row1 = i * 3;
        const row2 = (i + 1) * 3;

        // Left quad
        indices.push(row1, row2, row1 + 1);
        indices.push(row1 + 1, row2, row2 + 1);

        // Right quad
        indices.push(row1 + 1, row2 + 1, row1 + 2);
        indices.push(row1 + 2, row2 + 1, row2 + 2);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    // Procedural asphalt canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1c1f24';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle asphalt grain
    for (let j = 0; j < 6000; j++) {
      const g = Math.floor(25 + Math.random() * 20);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    // Outer white boundary lines
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(14, 0, 8, 512);
    ctx.fillRect(490, 0, 8, 512);

    // Dashed center line
    ctx.fillStyle = '#cbd5e1';
    for (let y = 0; y < 512; y += 48) {
      ctx.fillRect(252, y, 8, 28);
    }

    const asphaltTexture = new THREE.CanvasTexture(canvas);
    asphaltTexture.wrapS = THREE.RepeatWrapping;
    asphaltTexture.wrapT = THREE.RepeatWrapping;
    asphaltTexture.repeat.set(1, 40);

    const trackMaterial = new THREE.MeshStandardMaterial({
      map: asphaltTexture,
      roughness: 0.85,
      metalness: 0.1,
    });

    const trackMesh = new THREE.Mesh(geometry, trackMaterial);
    trackMesh.receiveShadow = true;
    this.scene.add(trackMesh);
  }

  private generateCurbs() {
    // Red & white rumble strips along corner segments
    const curbSegments = 240;
    const halfWidth = this.trackWidth / 2;
    const curbWidth = 1.6;

    const curbCanvas = document.createElement('canvas');
    curbCanvas.width = 128;
    curbCanvas.height = 128;
    const ctx = curbCanvas.getContext('2d')!;
    ctx.fillStyle = '#dc2626'; // Red
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = '#f8fafc'; // White
    ctx.fillRect(0, 64, 128, 64);

    const curbTex = new THREE.CanvasTexture(curbCanvas);
    curbTex.wrapS = THREE.RepeatWrapping;
    curbTex.wrapT = THREE.RepeatWrapping;
    curbTex.repeat.set(1, 30);

    const curbMaterial = new THREE.MeshStandardMaterial({
      map: curbTex,
      roughness: 0.6,
      metalness: 0.05,
    });

    const createCurbMesh = (isLeft: boolean) => {
      const geom = new THREE.BufferGeometry();
      const pos: number[] = [];
      const norm: number[] = [];
      const uvs: number[] = [];
      const idx: number[] = [];

      for (let i = 0; i <= curbSegments; i++) {
        const t = i / curbSegments;
        const point = this.curve.getPointAt(t);
        const tangent = this.curve.getTangentAt(t).normalize();
        const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

        const offsetMult = isLeft ? 1 : -1;
        const innerPoint = new THREE.Vector3().copy(point).addScaledVector(normal, offsetMult * halfWidth);
        const outerPoint = new THREE.Vector3().copy(innerPoint).addScaledVector(normal, offsetMult * curbWidth);

        pos.push(innerPoint.x, 0.08, innerPoint.z);
        pos.push(outerPoint.x, 0.22, outerPoint.z);
        norm.push(0, 1, 0, 0, 1, 0);
        uvs.push(0, t * 40, 1, t * 40);

        if (i < curbSegments) {
          const r1 = i * 2;
          const r2 = (i + 1) * 2;
          idx.push(r1, r2, r1 + 1);
          idx.push(r1 + 1, r2, r2 + 1);
        }
      }

      geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geom.setIndex(idx);

      return new THREE.Mesh(geom, curbMaterial);
    };

    const leftCurbs = createCurbMesh(true);
    const rightCurbs = createCurbMesh(false);
    this.scene.add(leftCurbs);
    this.scene.add(rightCurbs);
  }

  private generateStartFinishGantry() {
    const gantryGroup = new THREE.Group();

    // Overhead truss beam
    const trussWidth = this.trackWidth + 6;
    const trussHeight = 8.5;

    // Left and Right pillar posts
    const pillarGeom = new THREE.CylinderGeometry(0.4, 0.5, trussHeight, 8);
    const metalMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.8, roughness: 0.3 });
    const darkMat = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.9, roughness: 0.2 });

    const leftPillar = new THREE.Mesh(pillarGeom, metalMat);
    leftPillar.position.set(-trussWidth / 2, trussHeight / 2, 0);
    gantryGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeom, metalMat);
    rightPillar.position.set(trussWidth / 2, trussHeight / 2, 0);
    gantryGroup.add(rightPillar);

    // Cross beam
    const beamGeom = new THREE.BoxGeometry(trussWidth + 1, 1.2, 1.8);
    const beam = new THREE.Mesh(beamGeom, darkMat);
    beam.position.set(0, trussHeight, 0);
    gantryGroup.add(beam);

    // Gantry LED Board with Grand Prix branding
    const boardCanvas = document.createElement('canvas');
    boardCanvas.width = 512;
    boardCanvas.height = 128;
    const bCtx = boardCanvas.getContext('2d')!;
    bCtx.fillStyle = '#050505';
    bCtx.fillRect(0, 0, 512, 128);
    bCtx.fillStyle = '#eab308';
    bCtx.font = 'bold 36px "Chakra Petch", sans-serif';
    bCtx.textAlign = 'center';
    bCtx.fillText('APEX GRAND PRIX CIRCUIT', 256, 52);
    bCtx.fillStyle = '#38bdf8';
    bCtx.font = '600 24px "Plus Jakarta Sans", sans-serif';
    bCtx.fillText('START / FINISH', 256, 92);

    const boardTex = new THREE.CanvasTexture(boardCanvas);
    const boardMat = new THREE.MeshBasicMaterial({ map: boardTex });
    const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.2), boardMat);
    boardMesh.position.set(0, trussHeight, 0.95);
    gantryGroup.add(boardMesh);

    // 5 Start lights
    const lightSpacing = 1.4;
    const lightStartX = -((5 - 1) * lightSpacing) / 2;
    this.startLights = [];

    for (let i = 0; i < 5; i++) {
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1.2, 0.4),
        new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.8 })
      );
      housing.position.set(lightStartX + i * lightSpacing, trussHeight - 1.4, 0.8);
      gantryGroup.add(housing);

      const lamp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.1, 16),
        new THREE.MeshStandardMaterial({
          color: '#331111',
          emissive: '#110000',
          roughness: 0.2,
        })
      );
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(lightStartX + i * lightSpacing, trussHeight - 1.4, 1.0);
      gantryGroup.add(lamp);
      this.startLights.push(lamp);
    }

    // Start/Finish Line Checkerboard on the track
    const checkCanvas = document.createElement('canvas');
    checkCanvas.width = 256;
    checkCanvas.height = 64;
    const cCtx = checkCanvas.getContext('2d')!;
    const size = 16;
    for (let x = 0; x < 256; x += size) {
      for (let y = 0; y < 64; y += size) {
        cCtx.fillStyle = ((x / size) + (y / size)) % 2 === 0 ? '#ffffff' : '#111111';
        cCtx.fillRect(x, y, size, size);
      }
    }
    const checkTex = new THREE.CanvasTexture(checkCanvas);
    const finishLineMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(this.trackWidth, 3.5),
      new THREE.MeshStandardMaterial({ map: checkTex, roughness: 0.8 })
    );
    finishLineMesh.rotation.x = -Math.PI / 2;
    finishLineMesh.position.set(0, 0.08, 0);
    gantryGroup.add(finishLineMesh);

    // Place gantry at start of spline (t=0)
    const startPoint = this.curve.getPointAt(0);
    const tangent = this.curve.getTangentAt(0).normalize();
    gantryGroup.position.copy(startPoint);
    gantryGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

    this.scene.add(gantryGroup);
  }

  public updateStartLights(activeCount: number, isGreen: boolean) {
    this.startLights.forEach((light, idx) => {
      const mat = light.material as THREE.MeshStandardMaterial;
      if (isGreen) {
        mat.color.set('#22c55e');
        mat.emissive.set('#16a34a');
        mat.emissiveIntensity = 2.0;
      } else if (idx < activeCount) {
        mat.color.set('#ef4444');
        mat.emissive.set('#dc2626');
        mat.emissiveIntensity = 2.0;
      } else {
        mat.color.set('#291010');
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0.0;
      }
    });
  }

  private generateStartingGrid() {
    this.gridSlots = [];
    const numSlots = 8;
    const startT = 0.015; // slightly ahead or behind start line
    const slotSpacing = 0.008;

    for (let i = 0; i < numSlots; i++) {
      const t = (startT + i * slotSpacing) % 1.0;
      const point = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      // Alternate left and right side of track (staggered pole position)
      const sideOffset = i % 2 === 0 ? 3.5 : -3.5;
      const slotPos = new THREE.Vector3().copy(point).addScaledVector(normal, sideOffset);
      slotPos.y = 0.06;

      const angle = Math.atan2(tangent.x, tangent.z);
      this.gridSlots.push({
        position: slotPos,
        rotation: angle,
      });

      // Paint grid box on the ground
      const boxMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 5.5),
        new THREE.MeshBasicMaterial({
          color: '#cbd5e1',
          wireframe: true,
        })
      );
      boxMesh.rotation.x = -Math.PI / 2;
      boxMesh.rotation.z = angle;
      boxMesh.position.copy(slotPos);
      this.scene.add(boxMesh);
    }
  }

  private generateGrandstands() {
    // Grandstand on right side of main straight
    const grandstand = new THREE.Group();
    const rows = 12;
    const width = 120;

    for (let r = 0; r < rows; r++) {
      const stepGeom = new THREE.BoxGeometry(width, 0.8, 1.2);
      const stepMat = new THREE.MeshStandardMaterial({
        color: r % 2 === 0 ? '#1e293b' : '#334155',
        roughness: 0.7,
      });
      const step = new THREE.Mesh(stepGeom, stepMat);
      step.position.set(0, r * 0.75 + 0.4, r * 1.1);
      grandstand.add(step);
    }

    // Canopy roof over grandstand
    const roofGeom = new THREE.BoxGeometry(width + 4, 0.4, rows * 1.4);
    const roofMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.3, metalness: 0.4 });
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.set(0, rows * 0.85 + 4, rows * 0.6);
    roof.rotation.x = 0.1;
    grandstand.add(roof);

    // Support pillars
    for (let p = -50; p <= 50; p += 25) {
      const colGeom = new THREE.CylinderGeometry(0.35, 0.35, 14, 8);
      const col = new THREE.Mesh(colGeom, roofMat);
      col.position.set(p, 7, rows * 1.15);
      grandstand.add(col);
    }

    grandstand.position.set(24, 0, 80);
    grandstand.rotation.y = Math.PI;
    this.scene.add(grandstand);

    // Second grandstand on outer chicane
    const grandstand2 = grandstand.clone();
    grandstand2.position.set(130, 0, 360);
    grandstand2.rotation.y = Math.PI * 0.75;
    this.scene.add(grandstand2);
  }

  private generatePitBuilding() {
    const pitBuilding = new THREE.Group();

    // Main 2-story paddock structure along main straight
    const buildingGeom = new THREE.BoxGeometry(110, 8, 14);
    const buildingMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4, metalness: 0.6 });
    const building = new THREE.Mesh(buildingGeom, buildingMat);
    building.position.set(0, 4, 0);
    pitBuilding.add(building);

    // Garage bay doors
    for (let g = -45; g <= 45; g += 15) {
      const doorGeom = new THREE.BoxGeometry(9, 4.5, 0.3);
      const doorMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.8, roughness: 0.2 });
      const door = new THREE.Mesh(doorGeom, doorMat);
      door.position.set(g, 2.3, 7.1);
      pitBuilding.add(door);

      // Pit wall barrier
      const pitWallGeom = new THREE.BoxGeometry(11, 1.2, 0.6);
      const wallMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.5 });
      const wall = new THREE.Mesh(pitWallGeom, wallMat);
      wall.position.set(g, 0.6, 12);
      pitBuilding.add(wall);
    }

    pitBuilding.position.set(-25, 0, 80);
    this.scene.add(pitBuilding);
  }

  private generateBarriers() {
    // Realistic physical racing barriers: concrete base + corrugated Armco steel beams
    const numSegments = 320;
    const outerDistance = this.trackWidth / 2 + 1.6; // 9.6m (matches physics collision threshold exactly)
    const barrierHeight = 1.05;

    // Authentic motorsport barrier canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Concrete base
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 0, 1024, 128);

    // Galvanized Armco steel corrugation bands
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, 28, 1024, 40);
    ctx.fillRect(0, 78, 1024, 40);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 44, 1024, 8);
    ctx.fillRect(0, 94, 1024, 8);

    // Red and White reflective caution chevrons on top
    const chevronW = 32;
    for (let x = 0; x < 1024; x += chevronW) {
      ctx.fillStyle = ((x / chevronW) % 2 === 0) ? '#dc2626' : '#f8fafc';
      ctx.fillRect(x, 0, chevronW, 24);
    }

    // Racing sponsors stamped along the steel wall
    const sponsors = ['APEX MOTORSPORT', 'PIRELLI RACING', 'BREMBO BRAKES', 'MICHELIN PILOT', 'MOTUL GP', 'SHELL V-POWER'];
    ctx.font = 'bold 22px "Chakra Petch", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    sponsors.forEach((sp, idx) => {
      const spX = 90 + idx * 165;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(spX - 70, 48, 140, 36);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(sp, spX, 66);
    });

    const barrierTex = new THREE.CanvasTexture(canvas);
    barrierTex.wrapS = THREE.RepeatWrapping;
    barrierTex.wrapT = THREE.ClampToEdgeWrapping;
    barrierTex.repeat.set(40, 1);

    const barrierMat = new THREE.MeshStandardMaterial({
      map: barrierTex,
      metalness: 0.8,
      roughness: 0.35,
      side: THREE.DoubleSide,
    });

    const createContinuousBarrierMesh = (isLeft: boolean) => {
      const geom = new THREE.BufferGeometry();
      const pos: number[] = [];
      const norm: number[] = [];
      const uvs: number[] = [];
      const idx: number[] = [];

      const offsetMult = isLeft ? 1 : -1;

      for (let i = 0; i <= numSegments; i++) {
        const t = (i / numSegments) % 1.0;
        const point = this.curve.getPointAt(t);
        const tangent = this.curve.getTangentAt(t).normalize();
        const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

        const basePoint = new THREE.Vector3().copy(point).addScaledVector(normal, offsetMult * outerDistance);

        // Bottom vertex
        pos.push(basePoint.x, 0.05, basePoint.z);
        // Top vertex
        pos.push(basePoint.x, barrierHeight, basePoint.z);

        norm.push(normal.x * -offsetMult, 0, normal.z * -offsetMult);
        norm.push(normal.x * -offsetMult, 0, normal.z * -offsetMult);

        uvs.push(i / 4, 0);
        uvs.push(i / 4, 1);

        if (i < numSegments) {
          const r1 = i * 2;
          const r2 = (i + 1) * 2;
          idx.push(r1, r2, r1 + 1);
          idx.push(r1 + 1, r2, r2 + 1);
        }
      }

      geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geom.setIndex(idx);

      return new THREE.Mesh(geom, barrierMat);
    };

    const leftBarrier = createContinuousBarrierMesh(true);
    const rightBarrier = createContinuousBarrierMesh(false);
    this.scene.add(leftBarrier);
    this.scene.add(rightBarrier);

    // Heavy-duty steel support posts with amber hazard reflectors
    const postGeom = new THREE.CylinderGeometry(0.14, 0.14, 1.3, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.9, roughness: 0.25 });

    const postStep = 4;
    for (let i = 0; i < numSegments; i += postStep) {
      const t = i / numSegments;
      const point = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      // Left post
      const leftPostPos = new THREE.Vector3().copy(point).addScaledVector(normal, outerDistance + 0.08);
      const leftPost = new THREE.Mesh(postGeom, postMat);
      leftPost.position.set(leftPostPos.x, 0.65, leftPostPos.z);
      this.scene.add(leftPost);

      // Right post
      const rightPostPos = new THREE.Vector3().copy(point).addScaledVector(normal, -outerDistance - 0.08);
      const rightPost = new THREE.Mesh(postGeom, postMat);
      rightPost.position.set(rightPostPos.x, 0.65, rightPostPos.z);
      this.scene.add(rightPost);
    }

    // 3D Tire Wall Bundles placed at key high-speed braking runoff zones
    const tireWallZones = [0.12, 0.42, 0.68, 0.88];
    const tireGeom = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
    const tireMatRed = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.8 });
    const tireMatWhite = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.8 });

    tireWallZones.forEach((tz) => {
      for (let s = -3; s <= 3; s++) {
        const t = (tz + s * 0.006 + 1.0) % 1.0;
        const pt = this.curve.getPointAt(t);
        const tg = this.curve.getTangentAt(t).normalize();
        const norm = new THREE.Vector3().crossVectors(tg, new THREE.Vector3(0, 1, 0)).normalize();

        const tirePos = new THREE.Vector3().copy(pt).addScaledVector(norm, outerDistance - 0.4);

        // Stack of 3 tires
        for (let layer = 0; layer < 3; layer++) {
          const mat = (layer + Math.abs(s)) % 2 === 0 ? tireMatRed : tireMatWhite;
          const tire = new THREE.Mesh(tireGeom, mat);
          tire.position.set(tirePos.x, 0.18 + layer * 0.35, tirePos.z);
          tire.rotation.y = Math.random() * Math.PI;
          this.scene.add(tire);
        }
      }
    });

    // Brake Distance Marker Boards (150M, 100M, 50M) before main braking zones
    const brakingZones = [0.10, 0.38, 0.86];
    const markerDistances = [
      { offset: -0.022, text: '150' },
      { offset: -0.014, text: '100' },
      { offset: -0.007, text: '50' },
    ];

    brakingZones.forEach((bz) => {
      markerDistances.forEach((md) => {
        const t = (bz + md.offset + 1.0) % 1.0;
        const pt = this.curve.getPointAt(t);
        const tg = this.curve.getTangentAt(t).normalize();
        const norm = new THREE.Vector3().crossVectors(tg, new THREE.Vector3(0, 1, 0)).normalize();

        const boardPos = new THREE.Vector3().copy(pt).addScaledVector(norm, outerDistance - 0.1);
        boardPos.y = 0.85;

        const mCanvas = document.createElement('canvas');
        mCanvas.width = 128;
        mCanvas.height = 128;
        const mCtx = mCanvas.getContext('2d')!;
        mCtx.fillStyle = '#0f172a';
        mCtx.fillRect(0, 0, 128, 128);
        mCtx.lineWidth = 8;
        mCtx.strokeStyle = '#38bdf8';
        mCtx.strokeRect(4, 4, 120, 120);
        mCtx.fillStyle = '#f8fafc';
        mCtx.font = 'bold 52px "Chakra Petch", sans-serif';
        mCtx.textAlign = 'center';
        mCtx.textBaseline = 'middle';
        mCtx.fillText(md.text, 64, 58);
        mCtx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
        mCtx.fillStyle = '#38bdf8';
        mCtx.fillText('METERS', 64, 98);

        const mTex = new THREE.CanvasTexture(mCanvas);
        const mMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1.2, 1.2),
          new THREE.MeshBasicMaterial({ map: mTex, side: THREE.DoubleSide })
        );
        mMesh.position.copy(boardPos);
        mMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg);
        this.scene.add(mMesh);
      });
    });
  }

  private generateTracksideProps() {
    // Floodlight masts for professional night / dusk motorsport ambience
    const numLights = 10;
    for (let i = 0; i < numLights; i++) {
      const t = (i / numLights + 0.05) % 1.0;
      const point = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      const mastPos = new THREE.Vector3().copy(point).addScaledVector(normal, this.trackWidth / 2 + 8);
      mastPos.y = 0;

      const mastGroup = new THREE.Group();
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.5, 18, 8),
        new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.8, roughness: 0.3 })
      );
      pole.position.y = 9;
      mastGroup.add(pole);

      const lampHead = new THREE.Mesh(
        new THREE.BoxGeometry(3, 1, 1.5),
        new THREE.MeshStandardMaterial({ color: '#f8fafc', emissive: '#fef08a', emissiveIntensity: 0.8 })
      );
      lampHead.position.set(0, 18, 0);
      mastGroup.add(lampHead);

      // Spot light
      const spot = new THREE.SpotLight(0xfef08a, 40, 60, Math.PI / 4, 0.4);
      spot.position.set(0, 18, 0);
      spot.target.position.copy(point);
      mastGroup.add(spot);
      mastGroup.add(spot.target);

      mastGroup.position.copy(mastPos);
      this.scene.add(mastGroup);
    }
  }

  private generateCheckpoints() {
    this.checkpoints = [];
    const count = 18;

    for (let i = 0; i < count; i++) {
      const t = i / count;
      const pos = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      this.checkpoints.push({
        id: i,
        position: pos,
        tangent,
        normal,
        width: this.trackWidth,
        t,
      });
    }
  }

  private generateBoostPickups() {
    this.boostPickups = [];
    // Place 8 boost canisters strategically along straights and corner exits
    const boostIndices = [0.08, 0.22, 0.35, 0.48, 0.62, 0.74, 0.86, 0.94];

    boostIndices.forEach((t, index) => {
      const point = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      // Place along ideal racing line (slightly off-center)
      const offset = (index % 2 === 0 ? 1 : -1) * 3.5;
      const pos = new THREE.Vector3().copy(point).addScaledVector(normal, offset);
      pos.y = 1.2;

      const group = new THREE.Group();

      // Glowing blue boost canister
      const bottleGeom = new THREE.CylinderGeometry(0.35, 0.35, 1.2, 12);
      const bottleMat = new THREE.MeshStandardMaterial({
        color: '#0284c7',
        emissive: '#38bdf8',
        emissiveIntensity: 1.2,
        roughness: 0.2,
        metalness: 0.8,
      });
      const bottle = new THREE.Mesh(bottleGeom, bottleMat);
      group.add(bottle);

      // Rotating energy ring
      const ringGeom = new THREE.TorusGeometry(0.7, 0.08, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: '#7dd3fc', wireframe: true });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);

      group.position.copy(pos);
      this.scene.add(group);

      this.boostPickups.push({
        id: index,
        position: pos,
        mesh: group,
        active: true,
        collectedAt: 0,
      });
    });
  }

  private generateGroundAndEnvironment() {
    // 1. Vast grass & asphalt verge terrain
    const groundGeom = new THREE.PlaneGeometry(1400, 1400, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: '#1e3a1e', // Dark lush grass
      roughness: 0.95,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 2. Immersive 3D Sky Dome
    const skyGeom = new THREE.SphereGeometry(680, 32, 24);
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 512;
    skyCanvas.height = 512;
    const sCtx = skyCanvas.getContext('2d')!;
    const skyGrad = sCtx.createLinearGradient(0, 0, 0, 512);
    skyGrad.addColorStop(0, '#090d24');    // Deep sapphire zenith
    skyGrad.addColorStop(0.35, '#151e44'); // Royal dusk
    skyGrad.addColorStop(0.65, '#2a3160'); // Twilight purple
    skyGrad.addColorStop(0.85, '#9a3412'); // Deep amber sunset line
    skyGrad.addColorStop(0.95, '#ea580c'); // Radiant golden horizon
    skyGrad.addColorStop(1.0, '#431407');  // Warm terrain haze
    sCtx.fillStyle = skyGrad;
    sCtx.fillRect(0, 0, 512, 512);

    const skyTex = new THREE.CanvasTexture(skyCanvas);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const skyDome = new THREE.Mesh(skyGeom, skyMat);
    this.scene.add(skyDome);

    // 3. Glowing Celestial Sun with Corona Ring
    const sunGroup = new THREE.Group();
    const sunGeom = new THREE.SphereGeometry(18, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: '#fed7aa' });
    const sunMesh = new THREE.Mesh(sunGeom, sunMat);
    sunGroup.add(sunMesh);

    const coronaGeom = new THREE.RingGeometry(20, 38, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: '#f97316',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const coronaMesh = new THREE.Mesh(coronaGeom, coronaMat);
    sunGroup.add(coronaMesh);

    sunGroup.position.set(180, 220, 380);
    sunGroup.lookAt(0, 0, 0);
    this.scene.add(sunGroup);

    // 4. Low-Poly 3D Clouds drifting in the sky
    const cloudCount = 26;
    const cloudMat = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.9,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
    });
    for (let i = 0; i < cloudCount; i++) {
      const cloud = new THREE.Group();
      const puffCount = 3 + Math.floor(Math.random() * 3);
      for (let p = 0; p < puffCount; p++) {
        const puff = new THREE.Mesh(
          new THREE.DodecahedronGeometry(8 + Math.random() * 8, 1),
          cloudMat
        );
        puff.position.set((p - 1.5) * 10, Math.random() * 3, Math.random() * 6);
        cloud.add(puff);
      }
      const dist = 140 + Math.random() * 260;
      const ang = Math.random() * Math.PI * 2;
      cloud.position.set(Math.cos(ang) * dist, 120 + Math.random() * 50, Math.sin(ang) * dist);
      this.scene.add(cloud);
    }

    // 5. Majestic Horizon Mountain Ranges (3D Parallax Depth)
    const mountainCount = 36;
    const mountainMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.9,
      metalness: 0.1,
    });
    const snowMat = new THREE.MeshStandardMaterial({
      color: '#94a3b8',
      roughness: 0.7,
    });

    for (let i = 0; i < mountainCount; i++) {
      const angle = (i / mountainCount) * Math.PI * 2;
      const dist = 480 + Math.random() * 60;
      const mX = Math.cos(angle) * dist;
      const mZ = Math.sin(angle) * dist;
      const mHeight = 45 + Math.random() * 55;
      const mRadius = 35 + Math.random() * 30;

      const peak = new THREE.Group();
      const cone = new THREE.Mesh(new THREE.ConeGeometry(mRadius, mHeight, 6), mountainMat);
      cone.position.y = mHeight / 2;
      peak.add(cone);

      // Snow-capped peak tip
      const capHeight = mHeight * 0.28;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(mRadius * 0.32, capHeight, 6), snowMat);
      cap.position.y = mHeight - capHeight / 2;
      peak.add(cap);

      peak.position.set(mX, -2, mZ);
      peak.rotation.y = Math.random() * Math.PI;
      this.scene.add(peak);
    }

    // 6. Trackside Trees
    const treeCount = 70;
    const treeMat = new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.8 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.9 });

    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2;
      const radius = 240 + Math.random() * 180;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 4, 6), trunkMat);
      trunk.position.y = 2;
      tree.add(trunk);

      const crown = new THREE.Mesh(new THREE.ConeGeometry(3.5, 8, 7), treeMat);
      crown.position.y = 7;
      tree.add(crown);

      tree.position.set(x, 0, z);
      this.scene.add(tree);
    }
  }

  public update(delta: number) {
    // Animate boost pickups (rotation & gentle hovering float)
    const time = Date.now() * 0.003;
    this.boostPickups.forEach((pickup) => {
      if (pickup.active) {
        pickup.mesh.visible = true;
        pickup.mesh.rotation.y += delta * 2.5;
        pickup.mesh.position.y = pickup.position.y + Math.sin(time + pickup.id) * 0.15;
      } else {
        pickup.mesh.visible = false;
      }
    });
  }

  // Find closest point on track spline (supports windowed tracking around hintT to avoid jumping segments)
  public getClosestSplineT(position: THREE.Vector3, hintT?: number): number {
    let closestT = 0;
    let minDistanceSq = Infinity;

    if (hintT !== undefined && hintT >= 0) {
      // Local windowed search around current car progress (prevents cross-track segment hopping)
      const windowSamples = 60;
      const windowHalf = 0.055; // +- 5.5% of total track (~80m ahead/behind)
      for (let i = 0; i < windowSamples; i++) {
        const offset = -windowHalf + (i / windowSamples) * (windowHalf * 2);
        const t = (hintT + offset + 1.0) % 1.0;
        const p = this.curve.getPointAt(t);
        const distSq = p.distanceToSquared(position);
        if (distSq < minDistanceSq) {
          minDistanceSq = distSq;
          closestT = t;
        }
      }

      // If we found a reasonable local match within 30m, refine locally and return
      if (minDistanceSq < 900) {
        const step = 0.0005;
        for (let off = -0.005; off <= 0.005; off += step) {
          const t = (closestT + off + 1.0) % 1.0;
          const p = this.curve.getPointAt(t);
          const distSq = p.distanceToSquared(position);
          if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            closestT = t;
          }
        }
        return closestT;
      }
    }

    // Global search fallback (on race start or after reset)
    const samples = 180;
    for (let i = 0; i < samples; i++) {
      const t = i / samples;
      const p = this.curve.getPointAt(t);
      const distSq = p.distanceToSquared(position);
      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        closestT = t;
      }
    }

    // Refine with local search
    const step = 1 / (samples * 8);
    for (let offset = -0.01; offset <= 0.01; offset += step) {
      const t = (closestT + offset + 1.0) % 1.0;
      const p = this.curve.getPointAt(t);
      const distSq = p.distanceToSquared(position);
      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        closestT = t;
      }
    }

    return closestT;
  }

  // Check if position is on the asphalt track surface
  public isOnTrack(position: THREE.Vector3, hintT?: number): boolean {
    const t = this.getClosestSplineT(position, hintT);
    const trackCenter = this.curve.getPointAt(t);
    const dist = trackCenter.distanceTo(position);
    return dist <= this.trackWidth / 2 + 1.2;
  }

  // Get distance from track centerline
  public getDistanceToCenter(position: THREE.Vector3, hintT?: number): number {
    const t = this.getClosestSplineT(position, hintT);
    const trackCenter = this.curve.getPointAt(t);
    return trackCenter.distanceTo(position);
  }
}
