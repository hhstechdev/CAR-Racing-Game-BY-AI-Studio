import * as THREE from 'three';
import { CarId, CARS, GearName, TransmissionMode } from '../types/game';
import { Circuit } from './circuit';
import { soundEngine } from './audio';

export interface CarPhysicsState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: number; // yaw angle in radians
  speed: number; // current forward/backward speed in units/s
  kmh: number;
  gear: number; // -1 for R, 0 for N, 1..6 for forward gears
  gearName: GearName;
  transmission: TransmissionMode;
  clutchDisengaged: boolean;
  rpm: number;
  steerAngle: number;
  slipAngle: number;
  boostEnergy: number; // 0 to 100
  isBoosting: boolean;
  isBraking: boolean;
  isOffTrack: boolean;
  offTrackSeconds: number;
  currentLap: number;
  currentCheckpoint: number;
  splineProgress: number; // 0.0 to 1.0 along track
  lapStartTime: number;
  currentLapTime: number;
  bestLapTime: number | null;
  lapTimes: number[];
  isFinished: boolean;
}

interface GearProfile {
  name: GearName;
  maxSpeedUnits: number; // Maximum speed reachable in this gear
  torqueMult: number;    // Acceleration mechanical leverage multiplier
  minKmh: number;
  maxKmh: number;
}

const GEAR_PROFILES: Record<number, GearProfile> = {
  [-1]: { name: 'R', maxSpeedUnits: 16.0, torqueMult: 0.90, minKmh: -70, maxKmh: 0 },
  [0]:  { name: 'N', maxSpeedUnits: 0.0,  torqueMult: 0.00, minKmh: 0,   maxKmh: 0 },
  [1]:  { name: '1', maxSpeedUnits: 15.5, torqueMult: 1.45, minKmh: 0,   maxKmh: 68 },
  [2]:  { name: '2', maxSpeedUnits: 26.5, torqueMult: 1.20, minKmh: 40,  maxKmh: 115 },
  [3]:  { name: '3', maxSpeedUnits: 36.5, torqueMult: 1.00, minKmh: 80,  maxKmh: 160 },
  [4]:  { name: '4', maxSpeedUnits: 44.5, torqueMult: 0.82, minKmh: 125, maxKmh: 195 },
  [5]:  { name: '5', maxSpeedUnits: 51.5, torqueMult: 0.70, minKmh: 160, maxKmh: 228 },
  [6]:  { name: '6', maxSpeedUnits: 58.5, torqueMult: 0.58, minKmh: 195, maxKmh: 265 },
};

export class CarPhysics {
  public state: CarPhysicsState;
  private carId: CarId;
  private circuit: Circuit;
  private passedCheckpoints = new Set<number>();
  private lapCooldown = 0;
  private sector1Completed = false;
  private sector2Completed = false;
  private sector3Completed = false;
  private collisionCooldown = 0;
  private offTrackSeconds = 0;
  private shiftCooldown = 0;
  private revLimiterCooldown = 0;
  private prevGearUpInput = false;
  private prevGearDownInput = false;

  constructor(carId: CarId, circuit: Circuit, initialGridSlot: number = 0, initialTransmission: TransmissionMode = 'automatic') {
    this.carId = carId;
    this.circuit = circuit;

    const slot = circuit.gridSlots[initialGridSlot] || {
      position: new THREE.Vector3(0, 0.06, 0),
      rotation: 0,
    };

    this.state = {
      position: new THREE.Vector3().copy(slot.position),
      velocity: new THREE.Vector3(),
      rotation: slot.rotation,
      speed: 0,
      kmh: 0,
      gear: 1,
      gearName: '1',
      transmission: initialTransmission,
      clutchDisengaged: false,
      rpm: 1000,
      steerAngle: 0,
      slipAngle: 0,
      boostEnergy: 25,
      isBoosting: false,
      isBraking: false,
      isOffTrack: false,
      offTrackSeconds: 0,
      currentLap: 1,
      currentCheckpoint: 0,
      splineProgress: 0,
      lapStartTime: Date.now(),
      currentLapTime: 0,
      bestLapTime: null,
      lapTimes: [],
      isFinished: false,
    };
  }

  public setCar(carId: CarId) {
    this.carId = carId;
  }

  public setTransmission(mode: TransmissionMode) {
    this.state.transmission = mode;
  }

  public shiftUp(): boolean {
    if (this.state.gear < 6 && this.shiftCooldown <= 0) {
      this.shiftCooldown = 0.15;
      this.state.gear += 1;
      this.state.gearName = GEAR_PROFILES[this.state.gear]?.name || '1';
      soundEngine.playGearShift(true);
      return true;
    }
    return false;
  }

  public shiftDown(): boolean {
    if (this.state.gear > -1 && this.shiftCooldown <= 0) {
      this.shiftCooldown = 0.15;
      this.state.gear -= 1;
      this.state.gearName = GEAR_PROFILES[this.state.gear]?.name || '1';
      soundEngine.playGearShift(false);
      return true;
    }
    return false;
  }

  public resetToGrid(slotIndex: number = 0) {
    const slot = this.circuit.gridSlots[slotIndex] || {
      position: new THREE.Vector3(0, 0.06, 0),
      rotation: 0,
    };

    this.state.position.copy(slot.position);
    this.state.velocity.set(0, 0, 0);
    this.state.rotation = slot.rotation;
    this.state.speed = 0;
    this.state.kmh = 0;
    this.state.gear = 1;
    this.state.gearName = '1';
    this.state.rpm = 1000;
    this.state.clutchDisengaged = false;
    this.state.steerAngle = 0;
    this.state.slipAngle = 0;
    this.state.boostEnergy = 25;
    this.state.isBoosting = false;
    this.state.isBraking = false;
    this.state.isOffTrack = false;
    this.state.offTrackSeconds = 0;
    this.offTrackSeconds = 0;
    this.collisionCooldown = 0;
    this.shiftCooldown = 0;
    this.state.currentLap = 1;
    this.state.currentCheckpoint = 0;
    this.state.splineProgress = 0;
    this.state.lapStartTime = Date.now();
    this.state.currentLapTime = 0;
    this.state.isFinished = false;
    this.passedCheckpoints.clear();
    this.sector1Completed = false;
    this.sector2Completed = false;
    this.sector3Completed = false;
    this.lapCooldown = 0;
  }

  public resetToTrack() {
    const t = this.circuit.getClosestSplineT(this.state.position, this.state.splineProgress);
    const point = this.circuit.curve.getPointAt(t);
    const tangent = this.circuit.curve.getTangentAt(t).normalize();

    this.state.position.copy(point);
    this.state.position.y = 0.06;
    this.state.rotation = Math.atan2(tangent.x, tangent.z);
    this.state.velocity.set(0, 0, 0);
    this.state.speed = 0;
    this.state.kmh = 0;
    if (this.state.transmission === 'automatic' || this.state.gear <= 0) {
      this.state.gear = 1;
      this.state.gearName = '1';
    }
    this.state.rpm = 1000;
    this.state.isOffTrack = false;
    this.state.offTrackSeconds = 0;
    this.offTrackSeconds = 0;
    this.collisionCooldown = 0;
    this.shiftCooldown = 0;
  }

  public addBoost(amount: number = 25) {
    this.state.boostEnergy = Math.min(100, this.state.boostEnergy + amount);
    soundEngine.playBoostPickup();
  }

  public update(
    delta: number,
    inputs: {
      throttle: boolean;
      brake: boolean;
      steerLeft: boolean;
      steerRight: boolean;
      boost: boolean;
      handbrake?: boolean;
      gearUp?: boolean;
      gearDown?: boolean;
    },
    totalLaps: number = 3
  ) {
    const config = CARS[this.carId] || CARS.starter;
    const phys = config.physics;

    if (this.shiftCooldown > 0) {
      this.shiftCooldown -= delta;
    }
    this.state.clutchDisengaged = this.shiftCooldown > 0;

    if (this.revLimiterCooldown > 0) {
      this.revLimiterCooldown -= delta;
    }

    // --- 1. Manual Gear Shifts ---
    if (this.state.transmission === 'manual') {
      if (inputs.gearUp && !this.prevGearUpInput) {
        this.shiftUp();
      }
      if (inputs.gearDown && !this.prevGearDownInput) {
        this.shiftDown();
      }
    }
    this.prevGearUpInput = !!inputs.gearUp;
    this.prevGearDownInput = !!inputs.gearDown;

    // --- 2. Boost Handling ---
    let isBoostingNow = false;
    if (inputs.boost && this.state.boostEnergy > 0 && Math.abs(this.state.speed) > 5) {
      isBoostingNow = true;
      const boostDrainRate = 18;
      this.state.boostEnergy = Math.max(0, this.state.boostEnergy - boostDrainRate * delta);
    }
    this.state.isBoosting = isBoostingNow;
    soundEngine.setBoostAudio(isBoostingNow);

    // --- 3. Automatic Transmission Logic ---
    if (this.state.transmission === 'automatic') {
      if (inputs.brake && this.state.speed < 0.8 && !inputs.throttle) {
        // Reverse engaged when braking from dead stop
        if (this.state.gear !== -1) {
          this.state.gear = -1;
          this.state.gearName = 'R';
          soundEngine.playGearShift(false);
        }
      } else if (this.state.gear === -1 && inputs.throttle && this.state.speed > -1.0) {
        // Forward 1st gear engaged when accelerating from reverse stop
        this.state.gear = 1;
        this.state.gearName = '1';
        soundEngine.playGearShift(true);
      } else if (this.state.gear <= 0 && inputs.throttle) {
        this.state.gear = 1;
        this.state.gearName = '1';
      } else if (this.state.gear >= 1 && this.shiftCooldown <= 0) {
        const curGear = this.state.gear;
        const curProf = GEAR_PROFILES[curGear];

        // Automatic Upshift around 6800 RPM
        if (curGear < 6 && this.state.speed > curProf.maxSpeedUnits * 0.88) {
          this.shiftCooldown = 0.12;
          this.state.gear += 1;
          this.state.gearName = GEAR_PROFILES[this.state.gear].name;
          soundEngine.playGearShift(true);
        }
        // Automatic Downshift below ~2800 RPM
        else if (curGear > 1) {
          const prevProf = GEAR_PROFILES[curGear - 1];
          if (this.state.speed < prevProf.maxSpeedUnits * 0.72) {
            this.shiftCooldown = 0.12;
            this.state.gear -= 1;
            this.state.gearName = GEAR_PROFILES[this.state.gear].name;
            soundEngine.playGearShift(false);
          }
        }
      }
    }

    // Current gear profile
    const currentGear = this.state.gear;
    const gearProf = GEAR_PROFILES[currentGear] || GEAR_PROFILES[1];
    this.state.gearName = gearProf.name;

    // --- 4. Steering (speed-sensitive) ---
    const steerSpeedFactor = Math.max(0.38, 1.0 - (Math.abs(this.state.speed) / phys.maxSpeed) * 0.45);
    const targetSteer = (inputs.steerLeft ? 1 : 0) - (inputs.steerRight ? 1 : 0);
    this.state.steerAngle += (targetSteer - this.state.steerAngle) * Math.min(1, 10 * delta);

    const isHandbraking = !!inputs.handbrake;

    if (Math.abs(this.state.speed) > 0.8) {
      const turnDir = this.state.speed >= 0 ? 1 : -1;
      const driftMultiplier = isHandbraking ? 1.6 : 1.0;
      this.state.rotation += this.state.steerAngle * phys.turnSpeed * steerSpeedFactor * driftMultiplier * turnDir * delta;
    }

    // Forward direction
    const forwardX = Math.sin(this.state.rotation);
    const forwardZ = Math.cos(this.state.rotation);

    // --- 5. Acceleration, Braking, and Engine Torque Physics ---
    this.state.isBraking = false;

    // Determine max speed for current gear & vehicle
    let gearMaxSpeed = gearProf.maxSpeedUnits;
    if (isBoostingNow && currentGear >= 4) {
      gearMaxSpeed *= phys.nitroBoostMult;
    }
    if (this.state.isOffTrack) {
      gearMaxSpeed *= 0.58;
    }

    // Acceleration logic based on Gear State
    if (isHandbraking) {
      this.state.isBraking = true;
      if (Math.abs(this.state.speed) > 0.4) {
        const decel = phys.brakeRate * 1.3 * delta;
        if (this.state.speed > 0) this.state.speed = Math.max(0, this.state.speed - decel);
        else this.state.speed = Math.min(0, this.state.speed + decel);
      } else {
        this.state.speed = 0;
      }
    } else if (currentGear === 0) {
      // --- NEUTRAL GEAR: Engine revs freely, 0 drive torque to wheels ---
      // Rolling drag only
      const drag = this.state.isOffTrack ? 22 : 6.5;
      if (this.state.speed > 0) {
        this.state.speed = Math.max(0, this.state.speed - drag * delta);
      } else if (this.state.speed < 0) {
        this.state.speed = Math.min(0, this.state.speed + drag * delta);
      }

      if (inputs.brake) {
        this.state.isBraking = true;
        const bDecel = phys.brakeRate * delta;
        if (this.state.speed > 0) this.state.speed = Math.max(0, this.state.speed - bDecel);
        else this.state.speed = Math.min(0, this.state.speed + bDecel);
      }

      // Neutral free revving RPM
      if (inputs.throttle) {
        this.state.rpm = Math.min(8000, this.state.rpm + 14000 * delta);
        if (this.state.rpm >= 7900 && this.revLimiterCooldown <= 0) {
          soundEngine.playRevLimiter();
          this.revLimiterCooldown = 0.08;
        }
      } else {
        this.state.rpm = Math.max(1000, this.state.rpm - 7000 * delta);
      }
    } else if (currentGear === -1) {
      // --- REVERSE GEAR ---
      const maxReverse = phys.reverseMax;
      if (inputs.throttle || (this.state.transmission === 'automatic' && inputs.brake)) {
        // Accelerate backwards
        const revAccel = phys.accelRate * 0.75 * delta;
        if (this.state.speed > -maxReverse) {
          this.state.speed -= revAccel;
        }
      } else if (inputs.brake && this.state.transmission === 'manual') {
        // In manual, brake slows reverse down back to 0
        this.state.isBraking = true;
        if (this.state.speed < -0.2) {
          this.state.speed = Math.min(0, this.state.speed + phys.brakeRate * delta);
        } else {
          this.state.speed = 0;
        }
      } else {
        // Drag in reverse
        if (this.state.speed < 0) {
          this.state.speed = Math.min(0, this.state.speed + 8.0 * delta);
        }
      }

      // Reverse RPM calculation
      const revRatio = Math.min(1.0, Math.abs(this.state.speed) / maxReverse);
      this.state.rpm = Math.round(1100 + revRatio * 5800);
    } else {
      // --- FORWARD GEARS (1 to 6) ---
      if (inputs.brake) {
        this.state.isBraking = true;
        if (this.state.speed > 0.4) {
          this.state.speed = Math.max(0, this.state.speed - phys.brakeRate * delta);
        } else {
          this.state.speed = 0;
        }
      } else if (inputs.throttle) {
        if (!this.state.clutchDisengaged) {
          // Gear torque curve: low gears pull hard from start; high gears bog down if too slow
          const speedInGearRatio = this.state.speed / gearMaxSpeed;
          let luggingFactor = 1.0;
          if (currentGear >= 3 && speedInGearRatio < 0.25) {
            luggingFactor = Math.max(0.35, speedInGearRatio / 0.25); // engine lugging penalty
          }

          const baseAccel = phys.accelRate * gearProf.torqueMult * luggingFactor * (isBoostingNow ? 1.45 : 1.0);

          if (this.state.speed < gearMaxSpeed) {
            this.state.speed += baseAccel * delta;
          } else {
            // Rev limiter hit in current gear!
            if (this.revLimiterCooldown <= 0) {
              soundEngine.playRevLimiter();
              this.revLimiterCooldown = 0.08;
            }
          }
        }
      } else {
        // Natural engine braking & aerodynamic rolling resistance
        const engineBraking = 4.0 + (currentGear <= 2 ? 6.0 : 2.0);
        const drag = (this.state.isOffTrack ? 22 : 6.0) + engineBraking;
        if (this.state.speed > 0) {
          this.state.speed = Math.max(0, this.state.speed - drag * delta);
        } else if (this.state.speed < 0) {
          this.state.speed = Math.min(0, this.state.speed + drag * delta);
        }
      }

      // Calculate forward gear RPM
      if (!this.state.clutchDisengaged) {
        const speedRatioInGear = Math.min(1.0, Math.max(0, this.state.speed / gearMaxSpeed));
        let targetRpm = 1100 + speedRatioInGear * 6700;
        if (inputs.throttle && speedRatioInGear > 0.96) {
          targetRpm = 7800 + Math.sin(Date.now() * 0.08) * 200;
        }
        this.state.rpm = Math.round(targetRpm);
      } else {
        // Shift clutch dip
        this.state.rpm = Math.max(1200, this.state.rpm - 8000 * delta);
      }
    }

    // --- 6. Velocity and Position Step ---
    this.state.velocity.set(forwardX * this.state.speed, 0, forwardZ * this.state.speed);
    this.state.position.addScaledVector(this.state.velocity, delta);

    if (this.collisionCooldown > 0) {
      this.collisionCooldown -= delta;
    }

    // --- 7. Realistic Physical Racing Barrier Collision & Redirection ---
    // Track closest point windowed around current spline progress (prevents jumping to opposite straights!)
    const tClosest = this.circuit.getClosestSplineT(this.state.position, this.state.splineProgress);
    const centerPoint = this.circuit.curve.getPointAt(tClosest);
    const trackTangent = this.circuit.curve.getTangentAt(tClosest).normalize();
    const trackNormal = new THREE.Vector3().crossVectors(trackTangent, new THREE.Vector3(0, 1, 0)).normalize();

    // Vector from track centerline to car
    const toCar = new THREE.Vector3().subVectors(this.state.position, centerPoint);
    toCar.y = 0;

    // Exact signed lateral distance from track centerline along the track normal
    const lateralDist = toCar.dot(trackNormal);
    const distFromCenter = Math.abs(lateralDist);

    // Track asphalt half-width is 8.0m; barrier surface is at 9.6m
    // Car half-width is 1.05m -> barrier surface contact occurs at exactly 8.55m
    const halfWidth = this.circuit.trackWidth / 2;
    this.state.isOffTrack = distFromCenter > halfWidth + 0.8;

    const barrierContactLimit = 8.55;

    if (distFromCenter > barrierContactLimit) {
      const side = lateralDist >= 0 ? 1 : -1;

      // 1. Physically stop and clamp car at barrier surface
      const clampedLateral = side * barrierContactLimit;
      this.state.position.x = centerPoint.x + trackNormal.x * clampedLateral;
      this.state.position.z = centerPoint.z + trackNormal.z * clampedLateral;
      this.state.position.y = centerPoint.y + 0.06;

      // 2. Velocity deflection: cancel outward component and rebound gently inward
      const outwardDir = trackNormal.clone().multiplyScalar(side);
      const velRadial = this.state.velocity.dot(outwardDir);
      if (velRadial > 0) {
        this.state.velocity.addScaledVector(outwardDir, -velRadial * 1.25);
      }

      // 3. Scrub speed and play collision impact
      const impactSpeed = Math.abs(this.state.speed);
      if (impactSpeed > 2.5 && this.collisionCooldown <= 0) {
        soundEngine.playCollision(Math.min(1.0, impactSpeed / 20));
        this.collisionCooldown = 0.22;
      }
      this.state.speed *= 0.84;

      // 4. Smooth yaw redirection parallel to track so car slides along wall rather than clipping
      const trackYaw = Math.atan2(trackTangent.x, trackTangent.z);
      this.state.rotation = this.state.rotation * 0.72 + trackYaw * 0.28;
    }

    // 5. Emergency Auto-Rescue: If glitched or pushed beyond outer perimeter (>10.0m)
    if (distFromCenter > 10.0) {
      this.offTrackSeconds += delta;
      if (this.offTrackSeconds >= 1.2 || distFromCenter > 14.0) {
        this.resetToTrack();
      }
    } else {
      this.offTrackSeconds = 0;
    }
    this.state.offTrackSeconds = this.offTrackSeconds;

    // --- 8. Metric Display & Engine Acoustics ---
    this.state.kmh = Math.round(Math.abs(this.state.speed) * 4.3);

    const speedRatio = Math.min(1.0, this.state.kmh / config.stats.topSpeedKmh);
    soundEngine.updateEngine(speedRatio, inputs.throttle, isBoostingNow);

    // Lateral drift / tire screech
    const isTurningHard = Math.abs(this.state.steerAngle) > 0.58 && this.state.speed > 22;
    const screechIntensity = (isTurningHard ? 0.7 : 0) + (this.state.isBraking && this.state.speed > 18 ? 0.6 : 0);
    soundEngine.updateScreech(screechIntensity);

    if (this.lapCooldown > 0) {
      this.lapCooldown -= delta;
    }

    // --- 9. Checkpoints & Laps ---
    this.updateCheckpointsAndLaps(totalLaps);
  }

  private updateCheckpointsAndLaps(totalLaps: number) {
    if (this.state.isFinished) return;

    const t = this.circuit.getClosestSplineT(this.state.position, this.state.splineProgress);
    this.state.splineProgress = t;

    const checkpoints = this.circuit.checkpoints;
    const finishLinePos = checkpoints[0].position;
    const distToFinish = this.state.position.distanceTo(finishLinePos);

    // Intermediate checkpoints (1 to 17)
    for (let i = 1; i < checkpoints.length; i++) {
      const cp = checkpoints[i];
      const dist = this.state.position.distanceTo(cp.position);
      if (dist < (this.circuit.trackWidth + 10.0)) {
        this.passedCheckpoints.add(i);
        this.state.currentCheckpoint = i;
        if (i <= 6) this.sector1Completed = true;
        if (i >= 7 && i <= 12) this.sector2Completed = true;
        if (i >= 13) this.sector3Completed = true;
      }
    }

    if (t >= 0.15 && t < 0.45) this.sector1Completed = true;
    if (t >= 0.45 && t < 0.75) this.sector2Completed = true;
    if (t >= 0.75 && t < 0.99) this.sector3Completed = true;

    // Start/Finish line crossing detection
    const isAtFinishLine = distToFinish < (this.circuit.trackWidth + 8.0) || (t < 0.05 || t > 0.985);
    const hasCompletedCircuit = this.sector2Completed && this.sector3Completed;
    const tangent = this.circuit.curve.getTangentAt(t).normalize();
    const isDrivingForwardOnTrack = this.state.speed > 2.5 && this.state.velocity.dot(tangent) > 0.4;

    if (this.lapCooldown <= 0 && isAtFinishLine && hasCompletedCircuit && isDrivingForwardOnTrack) {
      this.lapCooldown = 3.5;
      const lapTime = (Date.now() - this.state.lapStartTime) / 1000;
      this.state.lapTimes.push(lapTime);

      if (!this.state.bestLapTime || lapTime < this.state.bestLapTime) {
        this.state.bestLapTime = lapTime;
      }

      if (this.state.currentLap >= totalLaps) {
        this.state.isFinished = true;
        this.state.currentCheckpoint = 0;
        soundEngine.playFinishFanfare();
      } else {
        this.state.currentLap += 1;
        this.state.currentCheckpoint = 0;
        this.state.lapStartTime = Date.now();
        this.sector1Completed = false;
        this.sector2Completed = false;
        this.sector3Completed = false;
        this.passedCheckpoints.clear();
      }
    }

    if (!this.state.isFinished) {
      this.state.currentLapTime = (Date.now() - this.state.lapStartTime) / 1000;
    }
  }
}
