import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Users, Warehouse, Settings, HelpCircle, Coins, Trophy, ChevronRight, Edit3, Check } from 'lucide-react';
import { CarId, CARS, RaceResult, InputAction, KeyBindings } from './types/game';
import { RacingCanvas } from './components/RacingCanvas';
import { HUD } from './components/HUD';
import { GarageModal } from './components/GarageModal';
import { MultiplayerLobbyModal } from './components/MultiplayerLobbyModal';
import { RaceResultsModal } from './components/RaceResultsModal';
import { SettingsModal } from './components/SettingsModal';
import { HowToPlayModal } from './components/HowToPlayModal';
import { coinManager } from './game/coinSystem';
import { multiplayerClient } from './game/multiplayerClient';
import { soundEngine } from './game/audio';

const DEFAULT_FALLBACKS: Record<InputAction, string[]> = {
  throttle: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  steerLeft: ['KeyA', 'ArrowLeft'],
  steerRight: ['KeyD', 'ArrowRight'],
  gearUp: ['KeyE', 'PageUp'],
  gearDown: ['KeyQ', 'PageDown'],
  boost: ['Space', 'ShiftRight'],
  handbrake: ['ShiftLeft'],
  camera: ['KeyC'],
  resetCar: ['KeyR'],
};

function resolveAction(code: string, bindings: KeyBindings): InputAction | null {
  // 1. Check direct match in custom bindings first
  for (const [action, boundKey] of Object.entries(bindings)) {
    if (boundKey === code) {
      return action as InputAction;
    }
  }

  // 2. Fall back to default keys if the key was not reassigned to another action
  for (const [action, defaultKeys] of Object.entries(DEFAULT_FALLBACKS)) {
    if (defaultKeys.includes(code)) {
      const boundToOther = Object.entries(bindings).some(
        ([act, boundKey]) => act !== action && boundKey === code
      );
      if (!boundToOther) {
        return action as InputAction;
      }
    }
  }

  return null;
}

export default function App() {
  const [gameState, setGameState] = useState<'menu' | 'racing'>('menu');
  const [isMultiplayer, setIsMultiplayer] = useState<boolean>(false);

  // Modals state
  const [garageOpen, setGarageOpen] = useState(false);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);

  // Player Profile & Economy
  const [profile, setProfile] = useState(coinManager.getProfile());
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name);

  // Key Bindings state
  const [keyBindings, setKeyBindings] = useState<KeyBindings>(() => coinManager.getKeyBindings());
  const [resetCarTrigger, setResetCarTrigger] = useState(0);

  // Controls state
  const [controls, setControls] = useState({
    throttle: false,
    brake: false,
    steerLeft: false,
    steerRight: false,
    boost: false,
    handbrake: false,
    gearUp: false,
    gearDown: false,
  });
  const [cameraView, setCameraView] = useState<'chase' | 'close' | 'hood'>(profile.cameraView || 'chase');
  const [isTouchControls, setIsTouchControls] = useState(false);

  // References for live input processing
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const touchControlsRef = useRef({
    throttle: false,
    brake: false,
    steerLeft: false,
    steerRight: false,
    boost: false,
  });
  const keyBindingsRef = useRef(keyBindings);
  keyBindingsRef.current = keyBindings;

  // Re-synchronize driving controls from keyboard + touch
  const syncControls = useCallback(() => {
    const bindings = keyBindingsRef.current;
    const pressed = pressedKeysRef.current;

    const isActionTriggered = (action: InputAction): boolean => {
      for (const code of pressed) {
        if (resolveAction(code, bindings) === action) {
          return true;
        }
      }
      return false;
    };

    setControls({
      throttle: isActionTriggered('throttle') || touchControlsRef.current.throttle,
      brake: isActionTriggered('brake') || touchControlsRef.current.brake,
      steerLeft: isActionTriggered('steerLeft') || touchControlsRef.current.steerLeft,
      steerRight: isActionTriggered('steerRight') || touchControlsRef.current.steerRight,
      boost: isActionTriggered('boost') || touchControlsRef.current.boost,
      handbrake: isActionTriggered('handbrake'),
      gearUp: isActionTriggered('gearUp'),
      gearDown: isActionTriggered('gearDown'),
    });
  }, []);

  // In-Race HUD metrics
  const [hudData, setHudData] = useState({
    kmh: 0,
    rpm: 1000,
    gear: 1,
    gearName: '1' as import('./types/game').GearName,
    transmission: 'automatic' as import('./types/game').TransmissionMode,
    clutchDisengaged: false,
    lap: 1,
    totalLaps: 3,
    lapTime: 0,
    bestLapTime: null as number | null,
    boostPercent: 25,
    isBoosting: false,
    racePosition: 1,
    totalRacers: 1,
    countdown: null as number | null,
    isFinished: false,
    isOffTrack: false,
    offTrackSeconds: 0,
  });

  // Race results
  const [raceResults, setRaceResults] = useState<RaceResult[]>([]);

  // Update profile subscription
  useEffect(() => {
    const refreshProfile = () => {
      setProfile(coinManager.getProfile());
    };
    const unsub = coinManager.onSkillReward(() => {
      refreshProfile();
    });
    return unsub;
  }, []);

  // Keyboard Event Listeners for Dynamic Custom Controls
  useEffect(() => {
    if (gameState !== 'racing' || settingsOpen) {
      pressedKeysRef.current.clear();
      setControls({
        throttle: false,
        brake: false,
        steerLeft: false,
        steerRight: false,
        boost: false,
        handbrake: false,
        gearUp: false,
        gearDown: false,
      });
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent scrolling / default for game controls
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
        e.preventDefault();
      }

      const action = resolveAction(e.code, keyBindingsRef.current);
      if (action) {
        if (['Space', 'Tab'].includes(e.code)) {
          e.preventDefault();
        }

        // Discrete single-fire actions
        if (!e.repeat) {
          if (action === 'camera') {
            soundEngine.playClick();
            setCameraView((prev) => (prev === 'chase' ? 'close' : prev === 'close' ? 'hood' : 'chase'));
          } else if (action === 'resetCar') {
            soundEngine.playClick();
            setResetCarTrigger((prev) => prev + 1);
          }
        }
      }

      pressedKeysRef.current.add(e.code);
      syncControls();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeysRef.current.delete(e.code);
      syncControls();
    };

    const handleBlur = () => {
      pressedKeysRef.current.clear();
      syncControls();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [gameState, settingsOpen, syncControls]);

  // Touch control helper
  const handleTouchControl = useCallback(
    (type: 'throttle' | 'brake' | 'steerLeft' | 'steerRight' | 'boost', active: boolean) => {
      touchControlsRef.current[type] = active;
      syncControls();
    },
    [syncControls]
  );

  const handleStartSoloRace = () => {
    soundEngine.playClick();
    setIsMultiplayer(false);
    setResultsOpen(false);
    setGameState('racing');
  };

  const handleStartMultiplayerRace = () => {
    soundEngine.playClick();
    setLobbyOpen(false);
    setIsMultiplayer(true);
    setResultsOpen(false);
    setGameState('racing');
  };

  const handleFinishRace = (finishTime: number, bestLap: number, competitorsResults?: RaceResult[]) => {
    if (!isMultiplayer) {
      if (competitorsResults && competitorsResults.length > 0) {
        setRaceResults(competitorsResults);
      } else {
        setRaceResults([
          {
            id: 'solo_player',
            name: profile.name,
            carId: profile.selectedCar,
            position: 1,
            finishTime,
            bestLap,
          },
        ]);
      }
      setResultsOpen(true);
    }
  };

  // Multiplayer results listener
  useEffect(() => {
    multiplayerClient.onRaceFinished = (results) => {
      setRaceResults(results);
      setResultsOpen(true);
    };

    multiplayerClient.onReturnedToLobby = () => {
      setResultsOpen(false);
      setGameState('menu');
      setLobbyOpen(true);
    };
  }, []);

  const handleSaveName = () => {
    soundEngine.playClick();
    if (nameInput.trim()) {
      coinManager.setPlayerName(nameInput.trim());
      setProfile(coinManager.getProfile());
    }
    setIsEditingName(false);
  };

  const equippedCar = CARS[profile.selectedCar] || CARS.lamborghini;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-neutral-950 font-['Plus_Jakarta_Sans'] select-none">
      {/* State 1: Racing Experience */}
      {gameState === 'racing' && (
        <div className="relative w-full h-full">
          <RacingCanvas
            carId={profile.selectedCar}
            playerName={profile.name}
            isMultiplayer={isMultiplayer}
            totalLaps={3}
            cameraView={cameraView}
            transmission={profile.transmission || 'automatic'}
            controls={controls}
            resetTrigger={resetCarTrigger}
            onHudUpdate={setHudData}
            onFinishRace={handleFinishRace}
          />

          <HUD
            kmh={hudData.kmh}
            rpm={hudData.rpm}
            gear={hudData.gear}
            gearName={hudData.gearName}
            transmission={profile.transmission || 'automatic'}
            clutchDisengaged={hudData.clutchDisengaged}
            lap={hudData.lap}
            totalLaps={hudData.totalLaps}
            lapTime={hudData.lapTime}
            bestLapTime={hudData.bestLapTime}
            boostPercent={hudData.boostPercent}
            isBoosting={hudData.isBoosting}
            racePosition={hudData.racePosition}
            totalRacers={hudData.totalRacers}
            countdown={hudData.countdown}
            isOffTrack={hudData.isOffTrack}
            offTrackSeconds={hudData.offTrackSeconds}
            cameraView={cameraView}
            onToggleTransmission={() => {
              const next = coinManager.toggleTransmission();
              setProfile(coinManager.getProfile());
            }}
            onShiftUp={() => {
              setControls((c) => ({ ...c, gearUp: true }));
              setTimeout(() => setControls((c) => ({ ...c, gearUp: false })), 80);
            }}
            onShiftDown={() => {
              setControls((c) => ({ ...c, gearDown: true }));
              setTimeout(() => setControls((c) => ({ ...c, gearDown: false })), 80);
            }}
            onToggleCamera={() => {
              soundEngine.playClick();
              setCameraView((prev) => (prev === 'chase' ? 'close' : prev === 'close' ? 'hood' : 'chase'));
            }}
            onResetCar={() => {
              soundEngine.playClick();
              setResetCarTrigger((prev) => prev + 1);
            }}
            onOpenSettings={() => {
              soundEngine.playClick();
              setSettingsOpen(true);
            }}
            onExitRace={() => {
              soundEngine.playClick();
              if (isMultiplayer) {
                multiplayerClient.leaveRoom();
              }
              setGameState('menu');
            }}
            onTouchControlChange={handleTouchControl}
            isMobileControls={isTouchControls}
          />
        </div>
      )}

      {/* State 2: Main Menu Experience */}
      {gameState === 'menu' && (
        <div className="relative w-full h-full flex flex-col justify-between p-6 md:p-10 z-10">
          {/* High-fidelity Cinematic Background */}
          <div
            className="absolute inset-0 bg-cover bg-center -z-10"
            style={{
              backgroundImage: `url('/src/assets/images/hero_racing_circuit_1791222236487.jpg')`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/75 to-neutral-950/40" />
            <div className="absolute inset-0 bg-radial from-transparent to-neutral-950/90" />
          </div>

          {/* Top Bar: Wordmark, Player Profile, Coin Balance */}
          <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-widest font-extrabold text-amber-400">
                PRO MOTORSPORT SIMCADE
              </div>
              <h1 className="text-2xl sm:text-3xl font-black italic font-['Chakra_Petch'] tracking-wide text-white flex items-center gap-2">
                APEX GRAND PRIX 3D
              </h1>
            </div>

            {/* Profile Info & Coins */}
            <div className="flex items-center gap-4 bg-neutral-900/80 backdrop-blur-md border border-neutral-700/70 p-2.5 rounded-2xl shadow-xl">
              {/* Editable Name */}
              <div className="flex items-center gap-2 px-2">
                {isEditingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value.slice(0, 16))}
                      className="bg-neutral-800 border border-sky-500 rounded px-2 py-1 text-xs text-white outline-none w-28"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveName}
                      className="w-6 h-6 rounded bg-sky-500 hover:bg-sky-400 text-neutral-950 flex items-center justify-center text-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setIsEditingName(true)}>
                    <span className="text-sm font-bold text-white tracking-wide">{profile.name}</span>
                    <Edit3 className="w-3.5 h-3.5 text-neutral-400 hover:text-sky-400 transition-colors" />
                  </div>
                )}
              </div>

              <div className="h-4 w-px bg-neutral-700" />

              {/* Coins Counter */}
              <div className="flex items-center gap-1.5 px-2 bg-amber-500/15 border border-amber-500/30 rounded-xl py-1 text-amber-400">
                <Coins className="w-4 h-4" />
                <span className="font-['Chakra_Petch'] font-bold text-sm">
                  {profile.coins.toLocaleString()}
                </span>
                <span className="text-[10px] text-amber-300 font-semibold">COINS</span>
              </div>
            </div>
          </header>

          {/* Main Center Menu */}
          <main className="max-w-xl flex flex-col gap-4 my-auto py-8">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs uppercase font-extrabold tracking-widest text-sky-400">
                OFFICIAL CIRCUIT SERIES
              </span>
              <h2 className="text-4xl sm:text-5xl font-black italic font-['Chakra_Petch'] text-white leading-none tracking-tight">
                RACE THE PROS. EARN WITH SKILL.
              </h2>
              <p className="text-xs sm:text-sm text-neutral-300 mt-2 leading-relaxed">
                Experience high-octane 3D circuit motorsport with real-time multiplayer, nitro boosts, and an authentic skill-based economy where clean apexes, high-speed drifts, and overtakes reward every driver.
              </p>
            </div>

            {/* Main Menu Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-3">
              {/* Multiplayer Grand Prix Button */}
              <button
                onClick={() => {
                  soundEngine.playClick();
                  setLobbyOpen(true);
                }}
                className="flex-1 py-4 px-6 rounded-2xl bg-sky-500 hover:bg-sky-400 text-neutral-950 font-black font-['Chakra_Petch'] text-base tracking-wider flex items-center justify-between shadow-xl shadow-sky-500/25 transition-all group active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5" />
                  <span>MULTIPLAYER GRAND PRIX</span>
                </div>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Normal Race Button */}
              <button
                onClick={handleStartSoloRace}
                className="py-4 px-6 rounded-2xl bg-neutral-900/90 hover:bg-neutral-850 text-white border border-neutral-700/80 font-black font-['Chakra_Petch'] text-base tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-xl active:scale-[0.98]"
              >
                <Play className="w-5 h-5 fill-current text-amber-400" />
                <span>NORMAL RACE (GRID OF 6)</span>
              </button>
            </div>

            {/* Secondary Navigation Row */}
            <div className="grid grid-cols-3 gap-2.5 pt-2">
              <button
                onClick={() => {
                  soundEngine.playClick();
                  setGarageOpen(true);
                }}
                className="p-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/60 text-white font-bold text-xs flex flex-col items-center gap-1.5 transition-all shadow-lg active:scale-95"
              >
                <Warehouse className="w-4 h-4 text-amber-400" />
                <span>GARAGE ({profile.ownedCars.length}/4)</span>
              </button>

              <button
                onClick={() => {
                  soundEngine.playClick();
                  setSettingsOpen(true);
                }}
                className="p-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/60 text-white font-bold text-xs flex flex-col items-center gap-1.5 transition-all shadow-lg active:scale-95"
              >
                <Settings className="w-4 h-4 text-sky-400" />
                <span>SETTINGS</span>
              </button>

              <button
                onClick={() => {
                  soundEngine.playClick();
                  setHowToPlayOpen(true);
                }}
                className="p-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/60 text-white font-bold text-xs flex flex-col items-center gap-1.5 transition-all shadow-lg active:scale-95"
              >
                <HelpCircle className="w-4 h-4 text-emerald-400" />
                <span>HOW TO PLAY</span>
              </button>
            </div>
          </main>

          {/* Bottom Bar: Active Vehicle Badge & Footer Guidelines */}
          <footer className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-neutral-800/80 text-xs text-neutral-400">
            <div className="flex items-center gap-3">
              <span className="uppercase text-[10px] font-bold tracking-wider text-neutral-500">ACTIVE VEHICLE:</span>
              <div
                className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors"
                onClick={() => setGarageOpen(true)}
              >
                <div
                  className="w-3 h-3 rounded-full border border-white/20"
                  style={{ backgroundColor: equippedCar.color }}
                />
                <span className="font-bold text-white font-['Chakra_Petch']">{equippedCar.name}</span>
                <span className="text-[10px] text-sky-400 underline">Change in Garage</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-neutral-500 text-[11px]">
              <span>Real Multiplayer Synchronization</span>
              <span>·</span>
              <span>Zero-Coin Finish Policy (Skill Only)</span>
              <span>·</span>
              <span>Keyboard & Mobile Touch</span>
            </div>
          </footer>
        </div>
      )}

      {/* Modals */}
      <GarageModal
        isOpen={garageOpen}
        onClose={() => setGarageOpen(false)}
        onSelectCar={(id) => {
          setProfile(coinManager.getProfile());
        }}
      />

      <MultiplayerLobbyModal
        isOpen={lobbyOpen}
        onClose={() => setLobbyOpen(false)}
        onRaceStart={handleStartMultiplayerRace}
      />

      <RaceResultsModal
        isOpen={resultsOpen}
        results={raceResults}
        isMultiplayer={isMultiplayer}
        onReturnToLobby={() => {
          setResultsOpen(false);
          setGameState('menu');
          setLobbyOpen(true);
        }}
        onReturnToMainMenu={() => {
          setResultsOpen(false);
          setGameState('menu');
          if (isMultiplayer) multiplayerClient.leaveRoom();
        }}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentCameraView={cameraView}
        isTouchControls={isTouchControls}
        currentTransmission={profile.transmission || 'automatic'}
        onTransmissionChange={(trans) => {
          coinManager.setTransmission(trans);
          setProfile(coinManager.getProfile());
        }}
        onCameraViewChange={(cam) => setCameraView(cam)}
        onControlsToggle={(isTouch) => setIsTouchControls(isTouch)}
        onKeyBindingsChange={(newBindings) => setKeyBindings(newBindings)}
      />

      <HowToPlayModal
        isOpen={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
      />
    </div>
  );
}
