import React, { useState, useEffect } from 'react';
import { Camera, RotateCcw, Zap, Trophy, Flag, Gauge, LogOut, Settings, ChevronUp, ChevronDown } from 'lucide-react';
import { SkillEvent, GearName, TransmissionMode } from '../types/game';
import { coinManager } from '../game/coinSystem';

interface HUDProps {
  kmh: number;
  rpm: number;
  gear: number;
  gearName?: GearName;
  transmission?: TransmissionMode;
  clutchDisengaged?: boolean;
  lap: number;
  totalLaps: number;
  lapTime: number;
  bestLapTime: number | null;
  boostPercent: number;
  isBoosting: boolean;
  racePosition: number;
  totalRacers: number;
  countdown: number | null;
  isOffTrack?: boolean;
  offTrackSeconds?: number;
  cameraView: 'chase' | 'close' | 'hood';
  onToggleCamera: () => void;
  onResetCar: () => void;
  onExitRace: () => void;
  onOpenSettings?: () => void;
  onToggleTransmission?: () => void;
  onShiftUp?: () => void;
  onShiftDown?: () => void;
  onTouchControlChange?: (type: 'throttle' | 'brake' | 'steerLeft' | 'steerRight' | 'boost', active: boolean) => void;
  isMobileControls?: boolean;
}

export const HUD: React.FC<HUDProps> = ({
  kmh,
  rpm,
  gear,
  gearName = '1',
  transmission = 'automatic',
  clutchDisengaged = false,
  lap,
  totalLaps,
  lapTime,
  bestLapTime,
  boostPercent,
  isBoosting,
  racePosition,
  totalRacers,
  countdown,
  isOffTrack = false,
  offTrackSeconds = 0,
  cameraView,
  onToggleCamera,
  onResetCar,
  onExitRace,
  onOpenSettings,
  onToggleTransmission,
  onShiftUp,
  onShiftDown,
  onTouchControlChange,
  isMobileControls = false,
}) => {
  const [skillPops, setSkillPops] = useState<SkillEvent[]>([]);

  useEffect(() => {
    return coinManager.onSkillReward((event) => {
      setSkillPops((prev) => [...prev.slice(-3), event]);
      setTimeout(() => {
        setSkillPops((prev) => prev.filter((p) => p.id !== event.id));
      }, 2500);
    });
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins.toString().padStart(2, '0')}:${secs.padStart(5, '0')}`;
  };

  // RPM percentage (1000 to 8000)
  const rpmPercent = Math.min(100, Math.max(0, ((rpm - 1000) / 7000) * 100));
  const isRedline = rpm >= 7200;

  // Display gear symbol
  const displayGear = gearName || (gear === -1 ? 'R' : gear === 0 ? 'N' : String(gear));

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10 flex flex-col justify-between p-4 md:p-6 overflow-hidden">
      {/* Top Bar: Lap, Position, Timing, and Controls */}
      <div className="flex items-start justify-between gap-4">
        {/* Left: Position & Lap Indicator */}
        <div className="flex items-center gap-3">
          {/* Position Card */}
          <div className="bg-neutral-900/85 backdrop-blur-md border border-neutral-700/60 rounded-xl px-4 py-2.5 shadow-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Position</div>
              <div className="text-2xl font-black italic font-['Chakra_Petch'] leading-none">
                <span className="text-amber-400">P{racePosition}</span>
                <span className="text-neutral-500 text-sm ml-1 font-normal font-sans">/ {totalRacers}</span>
              </div>
            </div>
          </div>

          {/* Lap Counter */}
          <div className="bg-neutral-900/85 backdrop-blur-md border border-neutral-700/60 rounded-xl px-4 py-2.5 shadow-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Lap</div>
              <div className="text-2xl font-black italic font-['Chakra_Petch'] text-sky-400 leading-none">
                {lap} <span className="text-neutral-500 text-sm ml-0.5 font-normal font-sans">/ {totalLaps}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Lap Time Display */}
        <div className="hidden sm:flex flex-col items-center bg-neutral-900/85 backdrop-blur-md border border-neutral-700/60 rounded-xl px-5 py-2 shadow-xl">
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Lap Time</div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums tracking-wider">
            {formatTime(lapTime)}
          </div>
          {bestLapTime && (
            <div className="text-xs text-emerald-400 font-mono font-medium">
              Best: {formatTime(bestLapTime)}
            </div>
          )}
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Transmission Toggle Badge */}
          {onToggleTransmission && (
            <button
              onClick={onToggleTransmission}
              title={`Transmission: ${transmission.toUpperCase()} (Click to toggle)`}
              className={`h-11 px-3.5 rounded-xl border flex items-center gap-1.5 font-['Chakra_Petch'] font-bold text-xs tracking-wider transition-all shadow-lg active:scale-95 ${
                transmission === 'manual'
                  ? 'bg-amber-950/80 hover:bg-amber-900/90 border-amber-600/80 text-amber-300'
                  : 'bg-neutral-900/85 hover:bg-neutral-800 border-neutral-700/60 text-sky-400'
              }`}
            >
              <Gauge className="w-4 h-4" />
              <span>{transmission === 'manual' ? 'MANUAL' : 'AUTO'}</span>
            </button>
          )}

          <button
            onClick={onToggleCamera}
            title="Change Camera (Key: C)"
            className="w-11 h-11 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/60 flex items-center justify-center text-neutral-300 hover:text-white transition-colors shadow-lg active:scale-95"
          >
            <Camera className="w-5 h-5" />
          </button>
          <button
            onClick={onResetCar}
            title="Reset to Track (Key: R)"
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-lg active:scale-95 ${
              isOffTrack
                ? 'bg-red-600 border-2 border-red-300 text-white animate-pulse shadow-red-500/60'
                : 'bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/60 text-neutral-300 hover:text-white'
            }`}
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              title="Controls & Settings"
              className="w-11 h-11 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/60 flex items-center justify-center text-neutral-300 hover:text-white transition-colors shadow-lg active:scale-95"
            >
              <Settings className="w-5 h-5 text-sky-400" />
            </button>
          )}
          <button
            onClick={onExitRace}
            title="Exit Race (Return to Menu)"
            className="h-11 px-3.5 rounded-xl bg-neutral-900/85 hover:bg-rose-950/90 border border-neutral-700/60 hover:border-rose-700/80 flex items-center gap-2 text-neutral-300 hover:text-rose-300 transition-colors shadow-lg active:scale-95"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-bold font-['Chakra_Petch'] tracking-wide hidden sm:inline">EXIT RACE</span>
          </button>
        </div>
      </div>

      {/* Prominent Off-Track Alert & Instant Rescue */}
      {isOffTrack && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 pointer-events-auto z-40 flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-red-950/95 border-2 border-red-500 text-white px-5 sm:px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 backdrop-blur-md">
            <div className="w-10 h-10 rounded-xl bg-red-600/90 border border-red-400 flex items-center justify-center text-xl shrink-0 animate-pulse">
              ⚠️
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-black font-['Chakra_Petch'] text-sm tracking-wider uppercase text-white">
                  OUT OF RACE ROAD / OFF TRACK
                </span>
                <span className="text-[10px] bg-red-800/90 text-red-100 px-2 py-0.5 rounded font-bold border border-red-500">
                  AUTO-RESCUE
                </span>
              </div>
              <span className="text-xs text-red-200 mt-0.5">
                Returning to track in <strong className="text-white font-mono text-sm">{Math.max(1, Math.ceil(2 - (offTrackSeconds || 0)))}s</strong>...
              </span>
            </div>
            <button
              onClick={onResetCar}
              className="ml-2 px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-red-700 font-black font-['Chakra_Petch'] text-xs tracking-wider shadow-lg flex items-center gap-1.5 transition-transform active:scale-95 shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              <span>RESET NOW (KEY: R)</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Skill Coin Popups */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
        {skillPops.map((pop) => (
          <div
            key={pop.id}
            className="animate-bounce bg-neutral-900/90 border border-amber-500/70 text-amber-300 font-bold px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2.5 backdrop-blur-md"
          >
            <span className="text-lg">{pop.icon || '⚡'}</span>
            <span className="text-sm font-['Chakra_Petch'] tracking-wide">{pop.title}</span>
            <span className="text-xs bg-amber-500 text-neutral-950 font-black px-2 py-0.5 rounded-md">
              +{pop.coins} COINS
            </span>
          </div>
        ))}
      </div>

      {/* Countdown Overlay (3-2-1-GO) */}
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="bg-neutral-950/80 border-2 border-neutral-700 rounded-3xl p-8 backdrop-blur-lg flex flex-col items-center shadow-2xl animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              {[0, 1, 2, 3, 4].map((i) => {
                const isRed = countdown > 0 && i < (4 - countdown + 1);
                const isGreen = countdown === 0;
                return (
                  <div
                    key={i}
                    className={`w-7 h-7 rounded-full border-2 border-neutral-800 transition-all duration-150 ${
                      isGreen
                        ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.9)]'
                        : isRed
                        ? 'bg-rose-600 border-rose-500 shadow-[0_0_16px_rgba(239,68,68,0.9)]'
                        : 'bg-neutral-900 border-neutral-800'
                    }`}
                  />
                );
              })}
            </div>
            <div
              className={`text-6xl md:text-8xl font-black italic font-['Chakra_Petch'] tracking-tighter ${
                countdown === 0 ? 'text-emerald-400' : 'text-rose-500'
              }`}
            >
              {countdown === 0 ? 'GO!' : countdown}
            </div>
            <div className="text-xs uppercase tracking-widest text-neutral-400 mt-2 font-semibold">
              {countdown === 0 ? 'RACE IN PROGRESS' : 'GET READY'}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Area: Speedometer, Gear, Boost Gauge, and Mobile Pedals */}
      <div className="flex flex-col md:flex-row items-end justify-between gap-4">
        {/* Mobile Left Steering Pad */}
        {isMobileControls && onTouchControlChange && (
          <div className="pointer-events-auto flex items-center gap-3 mb-2 md:mb-0">
            <button
              onPointerDown={() => onTouchControlChange('steerLeft', true)}
              onPointerUp={() => onTouchControlChange('steerLeft', false)}
              onPointerLeave={() => onTouchControlChange('steerLeft', false)}
              className="w-16 h-16 rounded-2xl bg-neutral-900/80 active:bg-sky-600 border border-neutral-700 flex items-center justify-center text-white text-2xl font-bold shadow-xl touch-none"
            >
              ◀
            </button>
            <button
              onPointerDown={() => onTouchControlChange('steerRight', true)}
              onPointerUp={() => onTouchControlChange('steerRight', false)}
              onPointerLeave={() => onTouchControlChange('steerRight', false)}
              className="w-16 h-16 rounded-2xl bg-neutral-900/80 active:bg-sky-600 border border-neutral-700 flex items-center justify-center text-white text-2xl font-bold shadow-xl touch-none"
            >
              ▶
            </button>
          </div>
        )}

        {/* Center/Right: Speedometer Cluster & Boost Gauge */}
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 ml-auto">
          {/* Manual Gear Shift Buttons (Visible in Manual mode or on mobile) */}
          {transmission === 'manual' && onShiftUp && onShiftDown && (
            <div className="pointer-events-auto flex flex-col gap-1.5 bg-neutral-900/90 backdrop-blur-md border border-neutral-700/80 rounded-2xl p-2 shadow-xl">
              <button
                onClick={onShiftUp}
                title="Shift Up (Key: E)"
                className="w-12 h-10 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-amber-500 border border-neutral-600 flex items-center justify-center text-white font-bold transition-all"
              >
                <ChevronUp className="w-5 h-5 text-amber-400" />
              </button>
              <button
                onClick={onShiftDown}
                title="Shift Down (Key: Q)"
                className="w-12 h-10 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-amber-500 border border-neutral-600 flex items-center justify-center text-white font-bold transition-all"
              >
                <ChevronDown className="w-5 h-5 text-amber-400" />
              </button>
            </div>
          )}

          {/* Nitro Boost Energy Bar */}
          <div className="bg-neutral-900/85 backdrop-blur-md border border-neutral-700/60 rounded-xl px-4 py-3 shadow-xl flex flex-col gap-1.5 w-48 sm:w-56">
            <div className="flex items-center justify-between text-xs font-bold text-sky-400">
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-sky-400" />
                NITRO BOOST
              </span>
              <span className="font-mono text-white">{boostPercent}%</span>
            </div>
            {/* Boost Bar */}
            <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden border border-neutral-700/80">
              <div
                className={`h-full transition-all duration-75 rounded-full ${
                  isBoosting
                    ? 'bg-gradient-to-r from-sky-400 to-cyan-200 animate-pulse shadow-[0_0_12px_rgba(56,189,248,0.8)]'
                    : 'bg-gradient-to-r from-sky-600 to-sky-400'
                }`}
                style={{ width: `${boostPercent}%` }}
              />
            </div>
            <div className="text-[10px] text-neutral-400 text-right">
              {isBoosting ? 'BURNING NITRO!' : 'Press SHIFT / SPACE'}
            </div>
          </div>

          {/* Motorsport Speedometer Cockpit */}
          <div className="bg-neutral-900/90 backdrop-blur-md border border-neutral-700/80 rounded-2xl p-4 shadow-2xl flex items-center gap-5 min-w-[230px]">
            {/* Gear Indicator */}
            <div className="flex flex-col items-center justify-center border-r border-neutral-700/80 pr-4 min-w-[56px]">
              <div className="flex items-center gap-1">
                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">GEAR</span>
                {transmission === 'manual' && (
                  <span className="text-[9px] font-bold text-amber-400">MAN</span>
                )}
              </div>
              <div className="relative flex items-center justify-center">
                <span
                  className={`text-3xl sm:text-4xl font-black font-['Chakra_Petch'] italic leading-none transition-transform ${
                    displayGear === 'R'
                      ? 'text-rose-400'
                      : displayGear === 'N'
                      ? 'text-sky-300'
                      : isRedline && transmission === 'manual'
                      ? 'text-rose-500 animate-bounce scale-110'
                      : 'text-amber-400'
                  }`}
                >
                  {displayGear}
                </span>
                {clutchDisengaged && (
                  <span className="absolute -bottom-3 text-[9px] font-mono text-neutral-400">CLUTCH</span>
                )}
              </div>
              {isRedline && transmission === 'manual' && displayGear !== '6' && displayGear !== 'R' && (
                <span className="text-[9px] font-black font-['Chakra_Petch'] text-rose-400 animate-pulse mt-1">
                  SHIFT ▲
                </span>
              )}
            </div>

            {/* Speed & RPM Gauge */}
            <div className="flex-1">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl md:text-5xl font-black font-['Chakra_Petch'] italic text-white tabular-nums tracking-tighter">
                  {kmh}
                </span>
                <span className="text-xs uppercase font-bold text-neutral-400">KM/H</span>
              </div>

              {/* RPM Bar */}
              <div className="w-full h-2.5 bg-neutral-800 rounded-full mt-1.5 overflow-hidden border border-neutral-700/60">
                <div
                  className={`h-full transition-all duration-75 ${
                    rpmPercent > 86
                      ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse'
                      : rpmPercent > 68
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${rpmPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] font-mono text-neutral-400 mt-0.5">
                <span>{rpm} RPM</span>
                <span className={rpm > 7200 ? 'text-rose-400 font-bold' : ''}>REDLINE 8K</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Right Gas & Brake & Boost Pedals */}
        {isMobileControls && onTouchControlChange && (
          <div className="pointer-events-auto flex items-center gap-3">
            <button
              onPointerDown={() => onTouchControlChange('brake', true)}
              onPointerUp={() => onTouchControlChange('brake', false)}
              onPointerLeave={() => onTouchControlChange('brake', false)}
              className="w-16 h-20 rounded-2xl bg-rose-950/80 active:bg-rose-600 border border-rose-700 flex flex-col items-center justify-center text-white font-bold shadow-xl touch-none"
            >
              <span className="text-xs text-rose-300 uppercase">BRAKE</span>
            </button>
            <button
              onPointerDown={() => onTouchControlChange('boost', true)}
              onPointerUp={() => onTouchControlChange('boost', false)}
              onPointerLeave={() => onTouchControlChange('boost', false)}
              className="w-14 h-20 rounded-2xl bg-sky-950/80 active:bg-sky-500 border border-sky-600 flex flex-col items-center justify-center text-sky-300 font-bold shadow-xl touch-none"
            >
              <Zap className="w-5 h-5 text-sky-400" />
              <span className="text-[10px] uppercase">BOOST</span>
            </button>
            <button
              onPointerDown={() => onTouchControlChange('throttle', true)}
              onPointerUp={() => onTouchControlChange('throttle', false)}
              onPointerLeave={() => onTouchControlChange('throttle', false)}
              className="w-18 h-24 rounded-2xl bg-emerald-950/80 active:bg-emerald-600 border border-emerald-700 flex flex-col items-center justify-center text-white font-bold shadow-xl touch-none"
            >
              <span className="text-xs text-emerald-300 uppercase">GAS</span>
              <span className="text-lg">▲</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
