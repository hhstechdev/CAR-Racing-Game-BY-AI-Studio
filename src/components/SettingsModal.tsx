import React, { useState, useEffect } from 'react';
import { X, Volume2, VolumeX, Camera, Smartphone, Keyboard, Shield, RotateCcw, AlertTriangle, Check, Gauge, Settings } from 'lucide-react';
import { InputAction, KeyBindings, DEFAULT_KEY_BINDINGS, TransmissionMode } from '../types/game';
import { coinManager } from '../game/coinSystem';
import { soundEngine } from '../game/audio';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCameraViewChange: (view: 'chase' | 'close' | 'hood') => void;
  onControlsToggle: (isTouch: boolean) => void;
  currentCameraView: 'chase' | 'close' | 'hood';
  isTouchControls: boolean;
  currentTransmission?: TransmissionMode;
  onTransmissionChange?: (trans: TransmissionMode) => void;
  onKeyBindingsChange?: (bindings: KeyBindings) => void;
}

export function formatKeyCode(code: string): string {
  if (!code) return 'None';
  if (code.startsWith('Key')) return code.slice(3).toUpperCase();
  if (code.startsWith('Digit')) return code.slice(5);
  switch (code) {
    case 'Space':
      return 'Space';
    case 'ShiftLeft':
      return 'Left Shift';
    case 'ShiftRight':
      return 'Right Shift';
    case 'ControlLeft':
      return 'Left Ctrl';
    case 'ControlRight':
      return 'Right Ctrl';
    case 'AltLeft':
      return 'Left Alt';
    case 'AltRight':
      return 'Right Alt';
    case 'ArrowUp':
      return '↑ Up Arrow';
    case 'ArrowDown':
      return '↓ Down Arrow';
    case 'ArrowLeft':
      return '← Left Arrow';
    case 'ArrowRight':
      return '→ Right Arrow';
    case 'Enter':
      return 'Enter';
    case 'Tab':
      return 'Tab';
    case 'Backspace':
      return 'Backspace';
    case 'PageUp':
      return 'Page Up';
    case 'PageDown':
      return 'Page Down';
    default:
      return code;
  }
}

interface ActionMeta {
  action: InputAction;
  title: string;
  description: string;
  defaultKey: string;
}

const ACTION_METAS: ActionMeta[] = [
  { action: 'throttle', title: 'Accelerate', description: 'Drive vehicle forward', defaultKey: 'KeyW' },
  { action: 'brake', title: 'Brake / Reverse', description: 'Decelerate or back up', defaultKey: 'KeyS' },
  { action: 'steerLeft', title: 'Steer Left', description: 'Turn vehicle left', defaultKey: 'KeyA' },
  { action: 'steerRight', title: 'Steer Right', description: 'Turn vehicle right', defaultKey: 'KeyD' },
  { action: 'gearUp', title: 'Gear Up (Shift Up)', description: 'Shift to higher gear (Manual transmission)', defaultKey: 'KeyE' },
  { action: 'gearDown', title: 'Gear Down (Shift Down)', description: 'Shift to lower gear / Reverse (Manual transmission)', defaultKey: 'KeyQ' },
  { action: 'boost', title: 'Nitro Boost', description: 'Activate speed surge & exhaust burst', defaultKey: 'Space' },
  { action: 'handbrake', title: 'Handbrake / Drift', description: 'Lock rear wheels for controlled slides', defaultKey: 'ShiftLeft' },
  { action: 'camera', title: 'Change Camera', description: 'Switch between chase, close, and bumper views', defaultKey: 'KeyC' },
  { action: 'resetCar', title: 'Reset to Track', description: 'Reposition car onto asphalt centerline', defaultKey: 'KeyR' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onCameraViewChange,
  onControlsToggle,
  currentCameraView,
  isTouchControls,
  currentTransmission = 'automatic',
  onTransmissionChange,
  onKeyBindingsChange,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'controls'>('controls');
  const profile = coinManager.getProfile();
  const [volume, setVolume] = useState(profile.soundVolume);
  const [isMuted, setIsMuted] = useState(false);
  const [transmission, setTransmission] = useState<TransmissionMode>(profile.transmission || currentTransmission);
  const [bindings, setBindings] = useState<KeyBindings>(coinManager.getKeyBindings());
  const [rebindingAction, setRebindingAction] = useState<InputAction | null>(null);
  const [conflictAction, setConflictAction] = useState<InputAction | null>(null);
  const [conflictKey, setConflictKey] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const p = coinManager.getProfile();
      setVolume(p.soundVolume);
      setTransmission(p.transmission || currentTransmission);
      setBindings(coinManager.getKeyBindings());
      setRebindingAction(null);
      setConflictAction(null);
      setConflictKey(null);
      setNotification(null);
    }
  }, [isOpen, currentTransmission]);

  // Key Listener for Rebinding with Strict Conflict Prevention
  useEffect(() => {
    if (!rebindingAction) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Escape cancels rebinding
      if (e.code === 'Escape') {
        setRebindingAction(null);
        setConflictAction(null);
        setConflictKey(null);
        setNotification({
          type: 'info',
          message: 'Rebind cancelled.',
        });
        soundEngine.playClick();
        return;
      }

      const newKey = e.code;
      const targetAction = rebindingAction;

      // 1. If pressing the same key already assigned to this action
      if (bindings[targetAction] === newKey) {
        setRebindingAction(null);
        setConflictAction(null);
        setConflictKey(null);
        setNotification({
          type: 'info',
          message: `[${formatKeyCode(newKey)}] kept as ${ACTION_METAS.find((m) => m.action === targetAction)?.title}.`,
        });
        soundEngine.playClick();
        return;
      }

      // 2. Strict Conflict Check: Check if newKey is already assigned to ANY other action
      let duplicateAct: InputAction | null = null;
      for (const [act, code] of Object.entries(bindings)) {
        if (code === newKey && act !== targetAction) {
          duplicateAct = act as InputAction;
          break;
        }
      }

      if (duplicateAct) {
        // CONFLICT: Block the assignment immediately!
        const dupTitle = ACTION_METAS.find((m) => m.action === duplicateAct)?.title || duplicateAct;
        const keyLabel = formatKeyCode(newKey);
        const errorMsg = `${keyLabel} is already assigned to ${dupTitle}. Please assign a different key first.`;

        setConflictAction(duplicateAct);
        setConflictKey(newKey);
        setNotification({
          type: 'error',
          message: errorMsg,
        });
        soundEngine.playCollision(0.4);
        return;
      }

      // 3. No conflict: apply and persist the new assignment
      const updatedBindings = {
        ...bindings,
        [targetAction]: newKey,
      };

      const result = coinManager.setKeyBinding(targetAction, newKey);
      if (result.success) {
        setBindings(updatedBindings);
        setRebindingAction(null);
        setConflictAction(null);
        setConflictKey(null);
        onKeyBindingsChange?.(updatedBindings);

        const actionTitle = ACTION_METAS.find((m) => m.action === targetAction)?.title || targetAction;
        setNotification({
          type: 'success',
          message: `${actionTitle} successfully reassigned to [${formatKeyCode(newKey)}].`,
        });
        soundEngine.playClick();
      } else {
        setNotification({
          type: 'error',
          message: result.message || 'Unable to update key binding.',
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [rebindingAction, bindings, onKeyBindingsChange]);

  const handleResetDefaults = () => {
    soundEngine.playClick();
    const defaults = coinManager.resetKeyBindings();
    setBindings(defaults);
    setRebindingAction(null);
    setConflictAction(null);
    setConflictKey(null);
    onKeyBindingsChange?.(defaults);
    setNotification({
      type: 'success',
      message: 'All controls reset to default factory mappings.',
    });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    soundEngine.setVolume(val);
    coinManager.setSoundVolume(val);
  };

  const handleMuteToggle = () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    soundEngine.setMuted(newMute);
  };

  const handleTransmissionToggle = (mode: TransmissionMode) => {
    soundEngine.playClick();
    setTransmission(mode);
    coinManager.setTransmission(mode);
    onTransmissionChange?.(mode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col font-['Plus_Jakarta_Sans']">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black italic font-['Chakra_Petch'] text-white">SETTINGS & CONTROLS</h2>
              <p className="text-xs text-neutral-400">Customize keys, transmission, camera, and racing audio</p>
            </div>
          </div>
          <button
            onClick={() => {
              soundEngine.playClick();
              setRebindingAction(null);
              onClose();
            }}
            className="w-9 h-9 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/40 px-6 gap-2 pt-2">
          <button
            onClick={() => {
              soundEngine.playClick();
              setActiveTab('controls');
            }}
            className={`px-4 py-2.5 text-xs font-bold font-['Chakra_Petch'] tracking-wider rounded-t-xl border-t border-x transition-colors flex items-center gap-2 ${
              activeTab === 'controls'
                ? 'bg-neutral-900 text-sky-400 border-neutral-700'
                : 'text-neutral-400 border-transparent hover:text-white'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            CUSTOM CONTROLS & BINDINGS
          </button>

          <button
            onClick={() => {
              soundEngine.playClick();
              setActiveTab('general');
            }}
            className={`px-4 py-2.5 text-xs font-bold font-['Chakra_Petch'] tracking-wider rounded-t-xl border-t border-x transition-colors flex items-center gap-2 ${
              activeTab === 'general'
                ? 'bg-neutral-900 text-sky-400 border-neutral-700'
                : 'text-neutral-400 border-transparent hover:text-white'
            }`}
          >
            <Gauge className="w-4 h-4" />
            TRANSMISSION & AUDIO
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[72vh]">
          {activeTab === 'controls' ? (
            <div className="flex flex-col gap-4">
              {/* Transmission Quick Selector */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-neutral-950/60 p-4 rounded-xl border border-neutral-800">
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-amber-400" />
                    TRANSMISSION MODE
                  </div>
                  <div className="text-xs text-neutral-400 mt-0.5">
                    Choose between Automatic or Manual gear shifting.
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-neutral-900 p-1 rounded-xl border border-neutral-700/80">
                  <button
                    onClick={() => handleTransmissionToggle('automatic')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      transmission === 'automatic'
                        ? 'bg-sky-500 text-white shadow-md'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Automatic
                  </button>
                  <button
                    onClick={() => handleTransmissionToggle('manual')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      transmission === 'manual'
                        ? 'bg-amber-500 text-neutral-950 shadow-md'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Manual (Q/E)
                  </button>
                </div>
              </div>

              {/* Controls Header & Reset to Defaults */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-neutral-950/60 p-4 rounded-xl border border-neutral-800">
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <Keyboard className="w-4 h-4 text-sky-400" />
                    KEYBOARD CONTROLS MAPPING
                  </div>
                  <div className="text-xs text-neutral-400 mt-0.5">
                    Click "Change" on any action, then press your desired keyboard key.
                  </div>
                </div>

                <button
                  onClick={handleResetDefaults}
                  className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs font-semibold text-neutral-300 hover:text-white flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  Reset to Defaults
                </button>
              </div>

              {/* Notification Banner */}
              {notification && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in ${
                    notification.type === 'error'
                      ? 'bg-rose-950/90 border-rose-500 text-rose-200 shadow-lg shadow-rose-950/50'
                      : notification.type === 'success'
                      ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
                      : 'bg-neutral-950 border-neutral-700 text-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {notification.type === 'error' ? (
                      <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                    ) : notification.type === 'success' ? (
                      <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <Shield className="w-5 h-5 text-sky-400 shrink-0" />
                    )}
                    <span>{notification.message}</span>
                  </div>
                  <button
                    onClick={() => {
                      setNotification(null);
                      setConflictAction(null);
                      setConflictKey(null);
                    }}
                    className="text-neutral-400 hover:text-white text-xs px-2 py-1 rounded bg-neutral-900/60 hover:bg-neutral-800 transition-colors shrink-0"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Rebinding overlay prompt */}
              {rebindingAction && (
                <div className="p-4 rounded-xl bg-sky-950/90 border border-sky-500 text-white flex items-center justify-between animate-pulse">
                  <div>
                    <div className="text-sm font-bold text-sky-300">
                      Press ANY KEY to assign to: <span className="text-white font-black uppercase">
                        {ACTION_METAS.find((m) => m.action === rebindingAction)?.title}
                      </span>
                    </div>
                    <div className="text-xs text-sky-200/80 mt-0.5">
                      Press <strong className="text-white">Escape</strong> to cancel. Duplicate keys will be blocked.
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setRebindingAction(null);
                      setConflictAction(null);
                      setConflictKey(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-sky-800 hover:bg-sky-700 text-xs font-bold text-white transition-colors"
                  >
                    Cancel (Esc)
                  </button>
                </div>
              )}

              {/* Action Key Bindings Table */}
              <div className="flex flex-col gap-2">
                {ACTION_METAS.map((item) => {
                  const currentCode = bindings[item.action] || item.defaultKey;
                  const isRebinding = rebindingAction === item.action;
                  const isConflicting = conflictAction === item.action;

                  return (
                    <div
                      key={item.action}
                      className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                        isRebinding
                          ? 'bg-sky-950/40 border-sky-400 shadow-md shadow-sky-950/50'
                          : isConflicting
                          ? 'bg-rose-950/40 border-rose-500'
                          : 'bg-neutral-950/40 border-neutral-800/80 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white flex items-center gap-2">
                          {item.title}
                          {item.action === 'gearUp' || item.action === 'gearDown' ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-semibold">
                              MANUAL
                            </span>
                          ) : null}
                        </span>
                        <span className="text-xs text-neutral-400">{item.description}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div
                          className={`min-w-[80px] text-center px-3 py-1.5 rounded-lg text-xs font-mono font-black border transition-all ${
                            isRebinding
                              ? 'bg-sky-500 text-neutral-950 border-sky-300 animate-pulse'
                              : isConflicting
                              ? 'bg-rose-900 text-rose-200 border-rose-500 animate-bounce'
                              : 'bg-neutral-800 text-amber-300 border-neutral-700'
                          }`}
                        >
                          {isRebinding ? 'PRESS KEY...' : formatKeyCode(currentCode)}
                        </div>

                        <button
                          onClick={() => {
                            soundEngine.playClick();
                            if (isRebinding) {
                              setRebindingAction(null);
                            } else {
                              setRebindingAction(item.action);
                              setConflictAction(null);
                              setConflictKey(null);
                              setNotification(null);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                            isRebinding
                              ? 'bg-rose-900/80 hover:bg-rose-800 text-rose-200 border border-rose-700'
                              : isConflicting
                              ? 'bg-rose-800 hover:bg-rose-700 text-white border border-rose-600 shadow-md'
                              : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700'
                          }`}
                        >
                          {isRebinding ? 'Cancel' : isConflicting ? 'Reassign' : 'Change'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Duplicate Handling Info */}
              <div className="p-3.5 rounded-xl bg-neutral-950/40 border border-neutral-800 text-[11px] text-neutral-400 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-neutral-300">Duplicate Key Prevention:</span> If a key is already assigned to an action (for example, <strong className="text-white">W = Accelerate</strong>), the game will block assigning that key to any other action. Change the existing assignment first to free up the key. Press <strong className="text-white">Escape</strong> anytime to cancel rebinding.
                </div>
              </div>
            </div>
          ) : (
            /* General Settings (Audio & Camera & Transmission) */
            <div className="flex flex-col gap-6">
              {/* Transmission Setting */}
              <div className="flex flex-col gap-3 bg-neutral-950/40 p-4 rounded-xl border border-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-amber-400" /> Transmission System
                  </span>
                  <span className="text-xs font-bold text-sky-400 font-mono uppercase">
                    {transmission}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <button
                    onClick={() => handleTransmissionToggle('automatic')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      transmission === 'automatic'
                        ? 'border-sky-500 bg-sky-500/15 text-white shadow-md'
                        : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-sky-300">Automatic Shifting</div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      Vehicle handles gears, upshifts, downshifts, and reverse automatically.
                    </div>
                  </button>

                  <button
                    onClick={() => handleTransmissionToggle('manual')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      transmission === 'manual'
                        ? 'border-amber-500 bg-amber-500/15 text-white shadow-md'
                        : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-amber-400">Manual Shifting</div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      Driver shifts manually (E = Up, Q = Down) with Neutral, Reverse & 6 gears.
                    </div>
                  </button>
                </div>
              </div>

              {/* Audio Volume */}
              <div className="flex flex-col gap-3 bg-neutral-950/40 p-4 rounded-xl border border-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-sky-400" /> Master Audio
                  </span>
                  <button
                    onClick={handleMuteToggle}
                    className="text-xs font-semibold text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                    {isMuted ? 'Muted' : `${Math.round(volume * 100)}%`}
                  </button>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={handleVolumeChange}
                  disabled={isMuted}
                  className="w-full accent-sky-500 h-2 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Camera View Preference */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-amber-400" /> Default Camera Perspective
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'chase', label: 'Dynamic Chase' },
                    { id: 'close', label: 'Close Action' },
                    { id: 'hood', label: 'Bumper Cam' },
                  ].map((cam) => (
                    <button
                      key={cam.id}
                      onClick={() => {
                        soundEngine.playClick();
                        onCameraViewChange(cam.id as any);
                      }}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                        currentCameraView === cam.id
                          ? 'border-sky-500 bg-sky-500/15 text-white shadow-md'
                          : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      {cam.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile Touch Overlay Toggle */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" /> On-Screen Touch Controls
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      soundEngine.playClick();
                      onControlsToggle(false);
                    }}
                    className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 text-center transition-all ${
                      !isTouchControls
                        ? 'border-sky-500 bg-sky-500/15 text-white shadow-md'
                        : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <Keyboard className="w-5 h-5 text-sky-400" />
                    <div className="text-xs font-bold">Standard Keyboard</div>
                    <div className="text-[10px] text-neutral-500">Desktop / Laptop</div>
                  </button>

                  <button
                    onClick={() => {
                      soundEngine.playClick();
                      onControlsToggle(true);
                    }}
                    className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 text-center transition-all ${
                      isTouchControls
                        ? 'border-sky-500 bg-sky-500/15 text-white shadow-md'
                        : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <Smartphone className="w-5 h-5 text-amber-400" />
                    <div className="text-xs font-bold">Mobile Touch Overlay</div>
                    <div className="text-[10px] text-neutral-500">Virtual Pedals & Steering</div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
