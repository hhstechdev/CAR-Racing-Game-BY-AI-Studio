import React from 'react';
import { Trophy, Medal, RotateCcw, Home, Zap, Flag, Coins } from 'lucide-react';
import { CARS, RaceResult } from '../types/game';
import { soundEngine } from '../game/audio';

interface RaceResultsModalProps {
  isOpen: boolean;
  results: RaceResult[];
  isMultiplayer: boolean;
  onReturnToLobby: () => void;
  onReturnToMainMenu: () => void;
}

export const RaceResultsModal: React.FC<RaceResultsModalProps> = ({
  isOpen,
  results,
  isMultiplayer,
  onReturnToLobby,
  onReturnToMainMenu,
}) => {
  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    if (!seconds) return '--:--.--';
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins.toString().padStart(2, '0')}:${secs.padStart(5, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl w-full max-w-3xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Banner */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 p-6 flex items-center justify-between text-neutral-950">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 fill-current" />
            <div>
              <div className="text-xs uppercase font-extrabold tracking-widest text-neutral-950/70">
                OFFICIAL CLASSIFICATION
              </div>
              <h2 className="text-2xl font-black italic font-['Chakra_Petch'] leading-tight">
                GRAND PRIX RACE RESULTS
              </h2>
            </div>
          </div>
          <Flag className="w-10 h-10 opacity-30 stroke-current" />
        </div>

        {/* Results Standings Table */}
        <div className="p-6 flex flex-col gap-6 overflow-y-auto max-h-[60vh]">
          <div className="flex flex-col gap-2.5">
            {results.map((r, idx) => {
              const carInfo = CARS[r.carId] || CARS.starter;
              const isWinner = r.position === 1;

              return (
                <div
                  key={r.id}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    isWinner
                      ? 'border-amber-500/80 bg-amber-500/10 shadow-lg'
                      : 'border-neutral-800 bg-neutral-950/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Position Badge */}
                    <div
                      className={`w-10 h-10 rounded-xl font-['Chakra_Petch'] font-black italic flex items-center justify-center text-lg ${
                        r.position === 1
                          ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/30'
                          : r.position === 2
                          ? 'bg-slate-300 text-neutral-950'
                          : r.position === 3
                          ? 'bg-amber-800 text-amber-100'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      P{r.position}
                    </div>

                    <div>
                      <div className="text-base font-bold text-white flex items-center gap-2">
                        {r.name}
                        {isWinner && <Medal className="w-4 h-4 text-amber-400" />}
                      </div>
                      <div className="text-xs text-neutral-400">{carInfo.name}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs uppercase font-bold text-neutral-400 tracking-wider">
                      TOTAL TIME
                    </div>
                    <div className="text-sm font-mono font-bold text-white tabular-nums">
                      {formatTime(r.finishTime)}
                    </div>
                    {r.bestLap > 0 && (
                      <div className="text-[11px] font-mono text-emerald-400">
                        Best: {formatTime(r.bestLap)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Coin Economy Summary Note */}
          <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-3">
            <Coins className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-neutral-300 leading-relaxed">
              <span className="font-bold text-white">Skill-Based Coin Economy:</span> Race completion awards 0 base coins. All coins are awarded during the race for clean driving, apex cornering, overtakes, speed traps, and drifts.
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-end gap-3">
          {isMultiplayer && (
            <button
              onClick={() => {
                soundEngine.playClick();
                onReturnToLobby();
              }}
              className="px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-neutral-950 font-bold font-['Chakra_Petch'] text-sm tracking-wider flex items-center gap-2 transition-all shadow-lg active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              RETURN TO LOBBY
            </button>
          )}

          <button
            onClick={() => {
              soundEngine.playClick();
              onReturnToMainMenu();
            }}
            className="px-5 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold font-['Chakra_Petch'] text-sm tracking-wider flex items-center gap-2 transition-all border border-neutral-700 active:scale-95"
          >
            <Home className="w-4 h-4" />
            MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
};
