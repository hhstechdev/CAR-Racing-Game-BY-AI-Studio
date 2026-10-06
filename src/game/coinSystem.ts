import { CarId, CARS, PlayerProfile, SkillEvent, KeyBindings, DEFAULT_KEY_BINDINGS, InputAction } from '../types/game';
import { soundEngine } from './audio';

const STORAGE_KEY = 'apex_grand_prix_profile_v1';

export class CoinManager {
  private profile: PlayerProfile;
  private onSkillRewardCallbacks: ((event: SkillEvent) => void)[] = [];

  // Driving metrics for skill detection
  private cleanDrivingTimer = 0;
  private driftTimer = 0;
  private apexHitCooldown = 0;
  private speedTrapCooldown = 0;
  private previousPosition = 1;

  constructor() {
    this.profile = this.loadProfile();
  }

  private loadProfile(): PlayerProfile {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const rawOwned: string[] = Array.isArray(parsed.ownedCars) ? parsed.ownedCars : ['starter'];
        const ownedCars: CarId[] = Array.from(new Set([...rawOwned, 'lamborghini', 'starter'] as CarId[]));
        // Use Lamborghini as the active car (or keep custom choice if player chose bmw or ferrari)
        const selectedCar: CarId =
          parsed.selectedCar && parsed.selectedCar !== 'starter' && ownedCars.includes(parsed.selectedCar)
            ? parsed.selectedCar
            : 'lamborghini';

        return {
          name: parsed.name || 'Racer ' + Math.floor(100 + Math.random() * 900),
          coins: typeof parsed.coins === 'number' ? parsed.coins : 350, // Starting bonus for immediate exploration
          ownedCars,
          selectedCar,
          soundVolume: typeof parsed.soundVolume === 'number' ? parsed.soundVolume : 0.8,
          musicVolume: typeof parsed.musicVolume === 'number' ? parsed.musicVolume : 0.6,
          cameraView: parsed.cameraView || 'chase',
          controlsType: parsed.controlsType || 'keyboard',
          transmission: parsed.transmission === 'manual' ? 'manual' : 'automatic',
          keyBindings: {
            ...DEFAULT_KEY_BINDINGS,
            ...(parsed.keyBindings || {}),
          },
        };
      }
    } catch {
      // LocalStorage fallback
    }

    return {
      name: 'Racer ' + Math.floor(100 + Math.random() * 900),
      coins: 350,
      ownedCars: ['lamborghini', 'starter'],
      selectedCar: 'lamborghini',
      soundVolume: 0.8,
      musicVolume: 0.6,
      cameraView: 'chase',
      controlsType: 'keyboard',
      transmission: 'automatic',
      keyBindings: { ...DEFAULT_KEY_BINDINGS },
    };
  }

  public saveProfile() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
    } catch {
      // ignore
    }
  }

  public getProfile(): PlayerProfile {
    return { ...this.profile };
  }

  public setTransmission(transmission: 'automatic' | 'manual') {
    this.profile.transmission = transmission;
    this.saveProfile();
  }

  public toggleTransmission(): 'automatic' | 'manual' {
    this.profile.transmission = this.profile.transmission === 'automatic' ? 'manual' : 'automatic';
    this.saveProfile();
    return this.profile.transmission;
  }

  public getKeyBindings(): KeyBindings {
    return { ...this.profile.keyBindings };
  }

  public setKeyBindings(bindings: KeyBindings): boolean {
    const codes = Object.values(bindings);
    const uniqueCodes = new Set(codes);
    if (uniqueCodes.size !== codes.length) {
      // Duplicate key detected - block saving
      return false;
    }
    this.profile.keyBindings = { ...bindings };
    this.saveProfile();
    return true;
  }

  public setKeyBinding(
    action: InputAction,
    keyCode: string
  ): { success: boolean; duplicateAction?: InputAction; message?: string } {
    // Check for duplicate key assignment
    for (const [act, code] of Object.entries(this.profile.keyBindings)) {
      if (code === keyCode && act !== action) {
        return {
          success: false,
          duplicateAction: act as InputAction,
          message: `${keyCode} is already assigned to ${act}. Please assign a different key first.`,
        };
      }
    }

    this.profile.keyBindings = {
      ...this.profile.keyBindings,
      [action]: keyCode,
    };
    this.saveProfile();

    return { success: true };
  }

  public resetKeyBindings(): KeyBindings {
    this.profile.keyBindings = { ...DEFAULT_KEY_BINDINGS };
    this.saveProfile();
    return { ...this.profile.keyBindings };
  }

  public setPlayerName(name: string) {
    const clean = name.trim().slice(0, 16);
    if (clean) {
      this.profile.name = clean;
      this.saveProfile();
    }
  }

  public setSoundVolume(volume: number) {
    this.profile.soundVolume = Math.max(0, Math.min(1, volume));
    this.saveProfile();
  }

  public setCameraView(view: 'chase' | 'close' | 'hood') {
    this.profile.cameraView = view;
    this.saveProfile();
  }

  public selectCar(carId: CarId): boolean {
    if (this.profile.ownedCars.includes(carId)) {
      this.profile.selectedCar = carId;
      this.saveProfile();
      return true;
    }
    return false;
  }

  public buyCar(carId: CarId): { success: boolean; message: string } {
    if (this.profile.ownedCars.includes(carId)) {
      return { success: false, message: 'You already own this vehicle.' };
    }

    const config = CARS[carId];
    if (!config) {
      return { success: false, message: 'Invalid vehicle.' };
    }

    if (config.price <= 0) {
      this.profile.ownedCars.push(carId);
      this.profile.selectedCar = carId;
      this.saveProfile();
      soundEngine.playCoinReward();
      return {
        success: true,
        message: `Claimed and equipped ${config.name} for FREE!`,
      };
    }

    if (this.profile.coins < config.price) {
      const needed = config.price - this.profile.coins;
      return {
        success: false,
        message: `Insufficient coins. Earn ${needed} more coins through skillful driving!`,
      };
    }

    this.profile.coins -= config.price;
    this.profile.ownedCars.push(carId);
    this.profile.selectedCar = carId;
    this.saveProfile();
    soundEngine.playCoinReward();

    return {
      success: true,
      message: `Unlocked ${config.name} for ${config.price} coins!`,
    };
  }

  public awardSkillCoins(title: string, amount: number, icon: string = '⚡') {
    if (amount <= 0) return;

    this.profile.coins += amount;
    this.saveProfile();
    soundEngine.playCoinReward();

    const event: SkillEvent = {
      id: Math.random().toString(36).substring(2, 9),
      title,
      coins: amount,
      icon,
      timestamp: Date.now(),
    };

    this.onSkillRewardCallbacks.forEach((cb) => cb(event));
  }

  public onSkillReward(cb: (event: SkillEvent) => void) {
    this.onSkillRewardCallbacks.push(cb);
    return () => {
      this.onSkillRewardCallbacks = this.onSkillRewardCallbacks.filter((c) => c !== cb);
    };
  }

  // Called in racing loop to detect real-time skill triggers
  public evaluateDrivingSkill(
    delta: number,
    state: {
      kmh: number;
      isOffTrack: boolean;
      steerAngle: number;
      distanceToCenter: number;
      splineProgress: number;
      racePosition: number;
      isRacing: boolean;
      isLegitimateForwardRacing?: boolean;
    }
  ) {
    if (!state.isRacing) return;

    // 1. Clean Sector Driving Streak (High speed on asphalt without collision)
    if (!state.isOffTrack && state.kmh > 85 && state.isLegitimateForwardRacing !== false) {
      this.cleanDrivingTimer += delta;
      if (this.cleanDrivingTimer >= 5.0) {
        this.cleanDrivingTimer = 0;
        this.awardSkillCoins('Clean Driving Sector', 15, '✨');
      }
    } else {
      this.cleanDrivingTimer = 0;
    }

    // 2. Apex Master (Clipping inner curb near track edge at speed without leaving track)
    if (this.apexHitCooldown > 0) {
      this.apexHitCooldown -= delta;
    } else if (state.kmh > 90 && state.distanceToCenter > 6.2 && !state.isOffTrack && state.isLegitimateForwardRacing !== false) {
      this.apexHitCooldown = 6.0; // cooldown between apex rewards
      this.awardSkillCoins('Apex Master', 25, '🎯');
    }

    // 3. Controlled Drift / Power Slide (Steering hard at high speed)
    if (Math.abs(state.steerAngle) > 0.65 && state.kmh > 75 && !state.isOffTrack) {
      this.driftTimer += delta;
      if (this.driftTimer >= 1.2) {
        this.driftTimer = 0;
        this.awardSkillCoins('Power Slide Bonus', 20, '💨');
      }
    } else {
      this.driftTimer = 0;
    }

    // 4. Overtake in Race - STRICTLY BLOCKS REVERSING & WRONG-WAY SCORING
    // Only award when racing forward legitimately in the correct direction on track
    if (state.racePosition < this.previousPosition && this.previousPosition > 1) {
      const isLegitOvertake = state.isLegitimateForwardRacing === true && !state.isOffTrack && state.kmh > 15;
      if (isLegitOvertake) {
        this.awardSkillCoins('Overtake!', 50, '🏁');
      }
    }
    // Always keep previousPosition synced so crossing positions while reversing never queues false overtakes
    this.previousPosition = state.racePosition;

    // 5. Speed Trap Record on Main Straight
    if (this.speedTrapCooldown > 0) {
      this.speedTrapCooldown -= delta;
    } else if (state.splineProgress > 0.05 && state.splineProgress < 0.15 && state.kmh >= 180) {
      this.speedTrapCooldown = 15.0;
      this.awardSkillCoins('Speed Trap: 180+ KM/H', 35, '⚡');
    }
  }

  public awardReactionLaunch() {
    this.awardSkillCoins('Rapid Reaction Launch', 30, '🚀');
  }
}

export const coinManager = new CoinManager();
