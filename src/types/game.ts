export type CarId = 'starter' | 'lamborghini' | 'bmw' | 'ferrari';

export interface CarConfig {
  id: CarId;
  name: string;
  manufacturer: string;
  price: number;
  unlockedByDefault: boolean;
  color: string;
  accentColor: string;
  description: string;
  stats: {
    topSpeedKmh: number; // km/h
    acceleration: number; // 0-100 rating
    handling: number; // cornering agility 0-100
    braking: number; // braking power 0-100
    grip: number; // traction 0-100
  };
  physics: {
    maxSpeed: number; // units/sec
    accelRate: number; // units/sec^2
    brakeRate: number;
    reverseMax: number;
    turnSpeed: number;
    gripFactor: number;
    driftFactor: number;
    nitroBoostMult: number;
  };
}

export const CARS: Record<CarId, CarConfig> = {
  starter: {
    id: 'starter',
    name: 'Apex GT Coupe',
    manufacturer: 'Apex Motorsport',
    price: 0,
    unlockedByDefault: true,
    color: '#eab308', // Amber gold
    accentColor: '#18181b', // Carbon black
    description: 'Balanced sports coupe engineered for agile circuit learning and consistent apex lines.',
    stats: {
      topSpeedKmh: 185,
      acceleration: 75,
      handling: 82,
      braking: 80,
      grip: 84,
    },
    physics: {
      maxSpeed: 42,
      accelRate: 19,
      brakeRate: 28,
      reverseMax: 14,
      turnSpeed: 2.1,
      gripFactor: 0.88,
      driftFactor: 0.22,
      nitroBoostMult: 1.32,
    },
  },
  lamborghini: {
    id: 'lamborghini',
    name: 'Veneno ST',
    manufacturer: 'Lamborghini',
    price: 0,
    unlockedByDefault: true,
    color: '#84cc16', // Lime cyber green
    accentColor: '#09090b', // Deep carbon
    description: 'Aggressive V10 Italian supercar with razor-sharp aerodynamic downforce, razor steering poise, and explosive straight-line sprint. Free flagship supercar.',
    stats: {
      topSpeedKmh: 218,
      acceleration: 88,
      handling: 86,
      braking: 88,
      grip: 88,
    },
    physics: {
      maxSpeed: 48,
      accelRate: 23,
      brakeRate: 32,
      reverseMax: 16,
      turnSpeed: 2.3,
      gripFactor: 0.90,
      driftFactor: 0.25,
      nitroBoostMult: 1.36,
    },
  },
  bmw: {
    id: 'bmw',
    name: 'M-Veloce GT',
    manufacturer: 'BMW Motorsport',
    price: 4000,
    unlockedByDefault: false,
    color: '#f8fafc', // Alpine white
    accentColor: '#2563eb', // M-Blue
    description: 'High-downforce German touring racer renowned for surgical cornering precision, maximum grip, and apex poise.',
    stats: {
      topSpeedKmh: 210,
      acceleration: 85,
      handling: 96,
      braking: 92,
      grip: 96,
    },
    physics: {
      maxSpeed: 46.5,
      accelRate: 22,
      brakeRate: 34,
      reverseMax: 15,
      turnSpeed: 2.5,
      gripFactor: 0.95,
      driftFactor: 0.16,
      nitroBoostMult: 1.34,
    },
  },
  ferrari: {
    id: 'ferrari',
    name: 'Scuderia F70',
    manufacturer: 'Ferrari',
    price: 6000,
    unlockedByDefault: false,
    color: '#dc2626', // Scuderia Corsa Red
    accentColor: '#171717', // Carbon black
    description: 'Purebred Maranello hypercar with unmatched top speed, screaming V12 acoustics, and competition aerodynamics.',
    stats: {
      topSpeedKmh: 235,
      acceleration: 96,
      handling: 92,
      braking: 94,
      grip: 92,
    },
    physics: {
      maxSpeed: 53,
      accelRate: 26,
      brakeRate: 36,
      reverseMax: 18,
      turnSpeed: 2.4,
      gripFactor: 0.92,
      driftFactor: 0.22,
      nitroBoostMult: 1.40,
    },
  },
};

export type GearName = 'R' | 'N' | '1' | '2' | '3' | '4' | '5' | '6';

export type TransmissionMode = 'automatic' | 'manual';

export type InputAction =
  | 'throttle'
  | 'brake'
  | 'steerLeft'
  | 'steerRight'
  | 'gearUp'
  | 'gearDown'
  | 'boost'
  | 'handbrake'
  | 'camera'
  | 'resetCar';

export interface KeyBindings {
  throttle: string;
  brake: string;
  steerLeft: string;
  steerRight: string;
  gearUp: string;
  gearDown: string;
  boost: string;
  handbrake: string;
  camera: string;
  resetCar: string;
}

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  throttle: 'KeyW',
  brake: 'KeyS',
  steerLeft: 'KeyA',
  steerRight: 'KeyD',
  gearUp: 'KeyE',
  gearDown: 'KeyQ',
  boost: 'Space',
  handbrake: 'ShiftLeft',
  camera: 'KeyC',
  resetCar: 'KeyR',
};

export interface PlayerProfile {
  name: string;
  coins: number;
  ownedCars: CarId[];
  selectedCar: CarId;
  soundVolume: number;
  musicVolume: number;
  cameraView: 'chase' | 'close' | 'hood';
  controlsType: 'keyboard' | 'touch';
  transmission: TransmissionMode;
  keyBindings: KeyBindings;
}

export interface SkillEvent {
  id: string;
  title: string;
  coins: number;
  icon?: string;
  timestamp: number;
}

export interface RoomPlayerState {
  id: string;
  name: string;
  carId: CarId;
  isHost: boolean;
  ready: boolean;
  gridSlot: number;
  finished: boolean;
  finishTime?: number;
  bestLap?: number;
}

export interface RemoteCarSyncData {
  pos: [number, number, number];
  rot: number; // yaw angle in radians
  steer: number;
  speed: number;
  boostActive: boolean;
  isBraking?: boolean;
  lap: number;
  checkpoint: number;
  progress: number;
  finished: boolean;
}

export interface RaceResult {
  id: string;
  name: string;
  carId: CarId;
  position: number;
  finishTime: number;
  bestLap: number;
}
