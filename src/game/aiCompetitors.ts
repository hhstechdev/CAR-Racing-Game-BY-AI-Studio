import * as THREE from 'three';
import { CarId, CARS, RaceResult } from '../types/game';
import { createCarModel, CarModelInstance } from './carModel';
import { Circuit } from './circuit';
import { soundEngine } from './audio';

export interface AICompetitorConfig {
  id: string;
  name: string;
  carId: CarId;
  gridSlot: number;
  skill: number; // 0.85 to 1.0 (affects top speed, cornering poise, reaction)
  laneOffset: number; // preferred lateral offset on track (-3.5 to +3.5)
}

export interface AICompetitorInstance {
  id: string;
  name: string;
  carId: CarId;
  gridSlot: number;
  skill: number;
  model: CarModelInstance;
  position: THREE.Vector3;
  rotation: number;
  speed: number;
  targetSpeed: number;
  steerAngle: number;
  isBraking: boolean;
  isBoosting: boolean;
  boostEnergy: number; // 0 to 100% boost reserve
  boostTimer: number;
  boostCooldown: number;
  splineProgress: number; // 0.0 to 1.0
  currentOffset: number; // current lane offset
  targetOffset: number;
  currentLap: number;
  lapStartTime: number;
  lapTimes: number[];
  bestLapTime: number | null;
  finishTime: number | null;
  finished: boolean;
  sector2Completed: boolean;
  sector3Completed: boolean;
  lapCooldown: number;
  launchDelay: number;
  currentPosition: number;
}

export const DEFAULT_AI_GRID: AICompetitorConfig[] = [
  {
    id: 'ai_vance',
    name: 'M. Vance',
    carId: 'ferrari',
    gridSlot: 0, // Pole position
    skill: 0.98,
    laneOffset: -2.0,
  },
  {
    id: 'ai_leclerc',
    name: 'S. Leclerc',
    carId: 'lamborghini',
    gridSlot: 1, // P2
    skill: 0.96,
    laneOffset: 2.0,
  },
  {
    id: 'ai_hamilton',
    name: 'L. Hamilton',
    carId: 'bmw',
    gridSlot: 2, // P3
    skill: 0.97,
    laneOffset: -1.2,
  },
  {
    id: 'ai_sainz',
    name: 'C. Sainz',
    carId: 'lamborghini',
    gridSlot: 3, // P4
    skill: 0.93,
    laneOffset: 1.5,
  },
  {
    id: 'ai_rossi',
    name: 'A. Rossi',
    carId: 'starter',
    gridSlot: 5, // P6 (Player occupies Slot 4 = P5)
    skill: 0.90,
    laneOffset: -2.5,
  },
];

export class AICompetitorManager {
  private circuit: Circuit;
  private scene: THREE.Scene;
  public competitors: AICompetitorInstance[] = [];
  private raceStartTime: number = 0;
  private raceStarted: boolean = false;

  constructor(scene: THREE.Scene, circuit: Circuit, configs: AICompetitorConfig[] = DEFAULT_AI_GRID) {
    this.scene = scene;
    this.circuit = circuit;
    this.initCompetitors(configs);
  }

  private initCompetitors(configs: AICompetitorConfig[]) {
    configs.forEach((cfg, idx) => {
      const slot = this.circuit.gridSlots[cfg.gridSlot % this.circuit.gridSlots.length] || {
        position: new THREE.Vector3(0, 0.06, 0),
        rotation: 0,
      };

      const model = createCarModel(cfg.carId, cfg.name, cfg.gridSlot);
      model.group.position.copy(slot.position);
      model.group.rotation.y = slot.rotation;
      this.scene.add(model.group);

      const t = this.circuit.getClosestSplineT(slot.position);

      const comp: AICompetitorInstance = {
        id: cfg.id,
        name: cfg.name,
        carId: cfg.carId,
        gridSlot: cfg.gridSlot,
        skill: cfg.skill,
        model,
        position: slot.position.clone(),
        rotation: slot.rotation,
        speed: 0,
        targetSpeed: 0,
        steerAngle: 0,
        isBraking: false,
        isBoosting: false,
        boostEnergy: 25, // Start with 25% boost ready
        boostTimer: 0,
        boostCooldown: 4.0 + Math.random() * 6.0,
        splineProgress: t,
        currentOffset: cfg.laneOffset,
        targetOffset: cfg.laneOffset,
        currentLap: 1,
        lapStartTime: Date.now(),
        lapTimes: [],
        bestLapTime: null,
        finishTime: null,
        finished: false,
        sector2Completed: false,
        sector3Completed: false,
        lapCooldown: 0,
        launchDelay: 0.12 + idx * 0.06 + Math.random() * 0.1,
        currentPosition: cfg.gridSlot + 1,
      };

      this.competitors.push(comp);
    });
  }

  public onRaceStart() {
    this.raceStarted = true;
    this.raceStartTime = Date.now();
    this.competitors.forEach((c) => {
      c.lapStartTime = this.raceStartTime;
    });
  }

  public update(
    delta: number,
    playerPos: THREE.Vector3,
    playerSpeed: number,
    totalLaps: number = 3
  ) {
    if (!this.raceStarted) {
      // Idle on starting grid boxes
      this.competitors.forEach((c) => {
        c.model.updateVisuals(0, 0, false, false);
      });
      return;
    }

    const now = Date.now();
    const trackWidth = this.circuit.trackWidth;
    const curve = this.circuit.curve;
    const finishLinePos = this.circuit.checkpoints[0].position;

    this.competitors.forEach((c) => {
      if (c.finished) {
        // Slow down smoothly after crossing finish line
        c.speed = Math.max(12, c.speed - 15 * delta);
        c.isBraking = true;
        c.isBoosting = false;
      } else {
        // Handle race start launch delay
        if (c.launchDelay > 0) {
          c.launchDelay -= delta;
          c.model.updateVisuals(0, 0, false, false);
          return;
        }

        // 1. Spline progression & lookahead curvature
        const currentT = this.circuit.getClosestSplineT(c.position);
        c.splineProgress = currentT;

        const lookaheadT = (currentT + 0.038) % 1.0;
        const curTangent = curve.getTangentAt(currentT).normalize();
        const futureTangent = curve.getTangentAt(lookaheadT).normalize();
        const cornerAngle = curTangent.angleTo(futureTangent);

        const carConfig = CARS[c.carId] || CARS.starter;
        const phys = carConfig.physics;

        // 2. Cornering speed calculation based on ahead curvature
        // Straights: 40-52 units/sec (170-225 km/h)
        // Hard corners: 22-28 units/sec (95-120 km/h)
        const isSharpTurn = cornerAngle > 0.28;
        const isMediumTurn = cornerAngle > 0.14;

        let baseMaxSpeed = phys.maxSpeed * (0.88 + c.skill * 0.14);
        if (isSharpTurn) {
          c.targetSpeed = 24 * (0.9 + c.skill * 0.15);
        } else if (isMediumTurn) {
          c.targetSpeed = 33 * (0.9 + c.skill * 0.14);
        } else {
          c.targetSpeed = baseMaxSpeed;
        }

        // 3. Automated Intelligent Nitro Boost & Pickup Collection
        // Automatically collect boost canisters along the track
        this.circuit.boostPickups.forEach((pickup) => {
          if (pickup.active && c.position.distanceTo(pickup.position) < 3.4) {
            pickup.active = false;
            c.boostEnergy = Math.min(100, c.boostEnergy + 25);
            setTimeout(() => {
              pickup.active = true;
            }, 9000);
          }
        });

        c.boostCooldown -= delta;

        // Drain boost energy when active
        if (c.isBoosting) {
          const drainRate = 18; // % per second
          c.boostEnergy = Math.max(0, c.boostEnergy - drainRate * delta);
          c.targetSpeed *= phys.nitroBoostMult;

          // Intelligently cancel boost if tank empty or approaching sharp turns/braking zones
          if (c.boostEnergy <= 0 || isSharpTurn || (isMediumTurn && c.speed > 35)) {
            c.isBoosting = false;
            c.boostCooldown = 4.0 + Math.random() * 5.0;
          }
        } else if (
          c.boostCooldown <= 0 &&
          c.boostEnergy >= 18 &&
          !isSharpTurn &&
          !isMediumTurn &&
          c.speed > 24
        ) {
          // Intelligently activate nitro on straightaways and corner exits
          c.isBoosting = true;
          c.boostCooldown = 5.0 + Math.random() * 4.0;
          c.targetSpeed *= phys.nitroBoostMult;
        }

        // 4. Proximity & Overtake Avoidance
        // Avoid rear-ending player or other AI
        const allObstacles = [
          { pos: playerPos, speed: playerSpeed, isPlayer: true },
          ...this.competitors.filter((o) => o.id !== c.id).map((o) => ({ pos: o.position, speed: o.speed, isPlayer: false })),
        ];

        let laneShiftNeeded = 0;
        for (const obs of allObstacles) {
          const dist = c.position.distanceTo(obs.pos);
          if (dist < 12.0) {
            // Check if obstacle is ahead in direction of travel
            const forward = new THREE.Vector3(Math.sin(c.rotation), 0, Math.cos(c.rotation));
            const toObs = new THREE.Vector3().subVectors(obs.pos, c.position);
            const dot = forward.dot(toObs.normalize());

            if (dot > 0.6) {
              // Obstacle is ahead
              if (obs.speed < c.speed) {
                // If close, brake slightly
                if (dist < 4.5) {
                  c.targetSpeed = Math.min(c.targetSpeed, obs.speed * 0.95);
                }
                // Try lane shift to pass
                const normal = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
                const lateralDist = toObs.dot(normal);
                laneShiftNeeded = lateralDist > 0 ? -2.2 : 2.2;
              }
            }
          }
        }

        c.targetOffset = THREE.MathUtils.clamp(
          (c.targetOffset + laneShiftNeeded * 0.1),
          -3.8,
          3.8
        );
        c.currentOffset += (c.targetOffset - c.currentOffset) * Math.min(1, 3.5 * delta);

        // 5. Acceleration & Braking
        c.isBraking = false;
        if (c.speed < c.targetSpeed) {
          const accel = phys.accelRate * (c.isBoosting ? 1.4 : 1.0) * c.skill;
          c.speed = Math.min(c.targetSpeed, c.speed + accel * delta);
        } else if (c.speed > c.targetSpeed + 1.5) {
          c.isBraking = true;
          c.speed = Math.max(c.targetSpeed, c.speed - phys.brakeRate * 0.9 * delta);
        }

        // 6. Spline Positioning & Steering Alignment
        // Target point ahead on curve with lane offset
        const targetT = (currentT + 0.012) % 1.0;
        const centerPt = curve.getPointAt(targetT);
        const tangent = curve.getTangentAt(targetT).normalize();
        const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

        const desiredPos = centerPt.clone().addScaledVector(normal, c.currentOffset);
        desiredPos.y = 0.06;

        // Steer towards target position
        const toTarget = new THREE.Vector3().subVectors(desiredPos, c.position);
        toTarget.y = 0;
        const desiredAngle = Math.atan2(toTarget.x, toTarget.z);

        // Normalize angle difference
        let angleDiff = desiredAngle - c.rotation;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

        const maxSteerPerSec = phys.turnSpeed * 1.6;
        c.steerAngle = THREE.MathUtils.clamp(angleDiff * 2.0, -0.65, 0.65);
        c.rotation += THREE.MathUtils.clamp(angleDiff, -maxSteerPerSec * delta, maxSteerPerSec * delta);

        // Move vehicle forward
        const forwardX = Math.sin(c.rotation);
        const forwardZ = Math.cos(c.rotation);
        c.position.x += forwardX * c.speed * delta;
        c.position.z += forwardZ * c.speed * delta;
        c.position.y = 0.06;

        // 7. Checkpoint & Lap Progression
        if (currentT >= 0.2 && currentT < 0.5) c.sector2Completed = true;
        if (currentT >= 0.5 && currentT < 0.8) c.sector2Completed = true;
        if (currentT >= 0.8 && currentT < 0.99) c.sector3Completed = true;

        if (c.lapCooldown > 0) {
          c.lapCooldown -= delta;
        }

        const distToFinish = c.position.distanceTo(finishLinePos);
        const isAtFinishLine = distToFinish < (trackWidth + 6.0) || (currentT < 0.04 || currentT > 0.985);

        if (c.lapCooldown <= 0 && isAtFinishLine && c.sector2Completed && c.sector3Completed) {
          c.lapCooldown = 3.5;
          const lapTime = (now - c.lapStartTime) / 1000;
          c.lapTimes.push(lapTime);

          if (!c.bestLapTime || lapTime < c.bestLapTime) {
            c.bestLapTime = lapTime;
          }

          if (c.currentLap >= totalLaps) {
            c.finished = true;
            c.finishTime = (now - this.raceStartTime) / 1000;
          } else {
            c.currentLap += 1;
            c.lapStartTime = now;
            c.sector2Completed = false;
            c.sector3Completed = false;
          }
        }
      }

      // Update 3D visual position, wheels, and lights
      c.model.group.position.copy(c.position);
      c.model.group.rotation.y = c.rotation;
      c.model.updateVisuals(c.speed, c.steerAngle, c.isBraking, c.isBoosting);

      // Player-AI car collision detection
      const distToPlayer = c.position.distanceTo(playerPos);
      if (distToPlayer < 2.8) {
        // Elastic rebound
        const pushDir = new THREE.Vector3().subVectors(playerPos, c.position).normalize();
        pushDir.y = 0;
        playerPos.addScaledVector(pushDir, 0.4);
        c.position.addScaledVector(pushDir, -0.4);
        c.speed *= 0.85;
        soundEngine.playCollision(0.65);
      }
    });
  }

  /**
   * Evaluates dynamic live race standings for all drivers (Player + AI Competitors).
   * Returns player's real-time position and the total racer count.
   */
  public evaluateStandings(
    playerLap: number,
    playerProgress: number,
    playerFinished: boolean,
    playerFinishTime: number | null
  ): {
    playerPosition: number;
    totalRacers: number;
  } {
    interface RacerScore {
      id: string;
      isPlayer: boolean;
      score: number;
      finished: boolean;
      finishTime: number;
    }

    const playerScoreVal = playerFinished
      ? 1000000 - (playerFinishTime || 9999)
      : playerLap * 10000 + playerProgress * 100;

    const racers: RacerScore[] = [
      {
        id: 'local_player',
        isPlayer: true,
        score: playerScoreVal,
        finished: playerFinished,
        finishTime: playerFinishTime || 9999,
      },
    ];

    this.competitors.forEach((c) => {
      const compScore = c.finished
        ? 1000000 - (c.finishTime || 9999)
        : c.currentLap * 10000 + c.splineProgress * 100;

      racers.push({
        id: c.id,
        isPlayer: false,
        score: compScore,
        finished: c.finished,
        finishTime: c.finishTime || 9999,
      });
    });

    // Sort descending by score
    racers.sort((a, b) => b.score - a.score);

    let playerPos = 1;
    racers.forEach((r, rank) => {
      const pNum = rank + 1;
      if (r.isPlayer) {
        playerPos = pNum;
      } else {
        const comp = this.competitors.find((c) => c.id === r.id);
        if (comp) {
          comp.currentPosition = pNum;
          comp.model.setName(comp.name, pNum);
        }
      }
    });

    return {
      playerPosition: playerPos,
      totalRacers: racers.length,
    };
  }

  public hasAnyCompetitorFinished(): boolean {
    return this.competitors.some((c) => c.finished);
  }

  public getFirstFinisher(): AICompetitorInstance | undefined {
    return this.competitors.find((c) => c.finished);
  }

  /**
   * Constructs the full official classification scoreboard for race results.
   * Accurately ranks drivers whether player or an AI finished first.
   */
  public getClassifiedResults(
    playerName: string,
    playerCarId: CarId,
    playerLap: number,
    playerProgress: number,
    playerFinished: boolean,
    playerElapsedTime: number,
    playerBestLap: number
  ): RaceResult[] {
    interface ScoreEntry {
      id: string;
      name: string;
      carId: CarId;
      finished: boolean;
      finishTime: number;
      bestLap: number;
      lap: number;
      progress: number;
      rankingScore: number;
    }

    const entries: ScoreEntry[] = [];

    // Local player entry
    entries.push({
      id: 'local_player',
      name: playerName,
      carId: playerCarId,
      finished: playerFinished,
      finishTime: playerElapsedTime,
      bestLap: playerBestLap,
      lap: playerLap,
      progress: playerProgress,
      // If finished: higher score for lower time (e.g. 1000000 - time)
      // If not finished: score based on lap and progress
      rankingScore: playerFinished
        ? 1000000 - playerElapsedTime
        : playerLap * 10000 + playerProgress * 100,
    });

    // AI competitors entries
    this.competitors.forEach((c) => {
      const bestLap = c.bestLapTime || Number((playerElapsedTime / 3.0).toFixed(2));
      let finalTime = c.finishTime;

      if (!finalTime) {
        // Estimate final projected time based on distance behind leader
        const remainingLaps = Math.max(0, 3 - c.currentLap);
        const lapEstimate = c.bestLapTime || 48.5;
        const fractionalLapRemaining = (1.0 - c.splineProgress) * lapEstimate;
        finalTime = Number((playerElapsedTime + remainingLaps * lapEstimate + fractionalLapRemaining).toFixed(2));
      }

      entries.push({
        id: c.id,
        name: c.name,
        carId: c.carId,
        finished: c.finished,
        finishTime: finalTime,
        bestLap,
        lap: c.currentLap,
        progress: c.splineProgress,
        rankingScore: c.finished
          ? 1000000 - finalTime
          : c.currentLap * 10000 + c.splineProgress * 100,
      });
    });

    // Sort descending by ranking score (finishers with lowest time first, then by progress)
    entries.sort((a, b) => b.rankingScore - a.rankingScore);

    // Build final classified results list
    const results: RaceResult[] = entries.map((entry, idx) => ({
      id: entry.id,
      name: entry.name,
      carId: entry.carId,
      position: idx + 1,
      finishTime: entry.finishTime,
      bestLap: entry.bestLap,
    }));

    return results;
  }

  public cleanup() {
    this.competitors.forEach((c) => {
      this.scene.remove(c.model.group);
    });
    this.competitors = [];
  }
}
