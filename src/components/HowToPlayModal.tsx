import React from 'react';
import { X, Zap, Coins, Flag, Users, Compass, HelpCircle } from 'lucide-react';
import { soundEngine } from '../game/audio';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold font-['Chakra_Petch'] text-white tracking-wide">
              HOW TO PLAY & RACING REGULATIONS
            </h2>
          </div>

          <button
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="w-9 h-9 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6 overflow-y-auto max-h-[75vh]">
          {/* Controls Matrix */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                VEHICLE CONTROLS (DEFAULT MAPPING)
              </h3>
              <span className="text-[11px] text-sky-400 font-semibold">
                Customizable in Settings → Controls
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-neutral-950/50 border border-neutral-800 flex items-center justify-between">
                <span className="text-neutral-300">Accelerate / Throttle</span>
                <span className="font-mono bg-neutral-800 px-2.5 py-1 rounded text-white font-bold">W / ↑</span>
              </div>
              <div className="p-3.5 rounded-xl bg-neutral-950/50 border border-neutral-800 flex items-center justify-between">
                <span className="text-neutral-300">Brake / Reverse</span>
                <span className="font-mono bg-neutral-800 px-2.5 py-1 rounded text-white font-bold">S / ↓</span>
              </div>
              <div className="p-3.5 rounded-xl bg-neutral-950/50 border border-neutral-800 flex items-center justify-between">
                <span className="text-neutral-300">Steer Left & Right</span>
                <span className="font-mono bg-neutral-800 px-2.5 py-1 rounded text-white font-bold">A / D or ← / →</span>
              </div>
              <div className="p-3.5 rounded-xl bg-neutral-950/50 border border-neutral-800 flex items-center justify-between">
                <span className="text-neutral-300">Shift Up (Manual Mode)</span>
                <span className="font-mono bg-amber-950 text-amber-300 border border-amber-800 px-2.5 py-1 rounded font-bold">E / PAGE UP</span>
              </div>
              <div className="p-3.5 rounded-xl bg-neutral-950/50 border border-neutral-800 flex items-center justify-between">
                <span className="text-neutral-300">Shift Down (Manual Mode)</span>
                <span className="font-mono bg-amber-950 text-amber-300 border border-amber-800 px-2.5 py-1 rounded font-bold">Q / PAGE DOWN</span>
              </div>
              <div className="p-3.5 rounded-xl bg-neutral-950/50 border border-neutral-800 flex items-center justify-between">
                <span className="text-neutral-300">Nitro Boost Activation</span>
                <span className="font-mono bg-sky-950 text-sky-300 border border-sky-800 px-2.5 py-1 rounded font-bold">SPACE / SHIFT</span>
              </div>
              <div className="p-3.5 rounded-xl bg-neutral-950/50 border border-neutral-800 flex items-center justify-between">
                <span className="text-neutral-300">Handbrake / Drift</span>
                <span className="font-mono bg-neutral-800 px-2.5 py-1 rounded text-white font-bold">LEFT SHIFT</span>
              </div>
              <div className="p-3.5 rounded-xl bg-neutral-950/50 border border-neutral-800 flex items-center justify-between">
                <span className="text-neutral-300">Toggle Camera View</span>
                <span className="font-mono bg-neutral-800 px-2.5 py-1 rounded text-white font-bold">C</span>
              </div>
              <div className="p-3.5 rounded-xl bg-neutral-950/50 border border-neutral-800 flex items-center justify-between">
                <span className="text-neutral-300">Reset to Track</span>
                <span className="font-mono bg-neutral-800 px-2.5 py-1 rounded text-white font-bold">R</span>
              </div>
            </div>
          </div>

          {/* Nitro Boost System */}
          <div className="p-4 rounded-xl bg-sky-950/30 border border-sky-800/50 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sky-400 font-bold text-sm font-['Chakra_Petch']">
              <Zap className="w-4 h-4" />
              NITRO BOOST SYSTEM
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Drive through the hovering blue canisters on the track to replenish <span className="text-sky-300 font-bold">+25% boost energy</span> (up to 100% maximum). Engaging boost provides substantial acceleration and top speed gains with exhaust flame effects. Pickups respawn after a short duration for continuous tactical competition.
            </p>
          </div>

          {/* Skill-Based Coin Economy */}
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/50 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm font-['Chakra_Petch']">
              <Coins className="w-4 h-4" />
              SKILL-BASED COIN ECONOMY
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              <span className="text-amber-300 font-bold">Finishing a race yields 0 coins.</span> Coins are earned strictly through real driving skill:
            </p>
            <ul className="text-xs text-neutral-300 space-y-1.5 list-disc list-inside pt-1">
              <li><strong className="text-white">Apex Master (+25 Coins):</strong> Hitting inner corner apexes near rumble strips at high speed.</li>
              <li><strong className="text-white">Clean Sector (+15 Coins):</strong> 5 consecutive seconds of high-speed racing without barrier contact.</li>
              <li><strong className="text-white">Power Slide (+20 Coins):</strong> Controlled drifting around turns at speed.</li>
              <li><strong className="text-white">Overtake (+50 Coins):</strong> Passing an opponent to claim a higher race position.</li>
              <li><strong className="text-white">Speed Trap (+35 Coins):</strong> Breaking 180+ KM/H down the main grandstand straight.</li>
              <li><strong className="text-white">Reaction Launch (+30 Coins):</strong> Immediate throttle reaction when starting lights turn green.</li>
            </ul>
          </div>

          {/* Normal Race Mode */}
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/50 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm font-['Chakra_Petch']">
              <Flag className="w-4 h-4" />
              NORMAL RACE MODE (GRID OF 6 COMPETITORS)
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Race against a competitive field of 5 motorsport rivals (piloting Ferraris, Lamborghinis, BMWs, and sports coupés). Battle through the pack from P5, execute clean overtakes, draft down the straights, and aim for the podium across 3 full circuit laps.
            </p>
          </div>

          {/* Real Multiplayer Guidelines */}
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm font-['Chakra_Petch']">
              <Users className="w-4 h-4" />
              MULTIPLAYER GRAND PRIX (REAL PLAYERS ONLY)
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Multiplayer rooms feature strictly real, connected human drivers with synchronized netcode and custom vehicle selections. No AI competitors or bots are ever admitted into multiplayer rooms.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
