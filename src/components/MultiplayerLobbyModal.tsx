import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Users, Play, Crown, AlertCircle, LogOut } from 'lucide-react';
import { CarId, CARS, RoomPlayerState } from '../types/game';
import { multiplayerClient } from '../game/multiplayerClient';
import { coinManager } from '../game/coinSystem';
import { soundEngine } from '../game/audio';

interface MultiplayerLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRaceStart: () => void;
}

export const MultiplayerLobbyModal: React.FC<MultiplayerLobbyModalProps> = ({
  isOpen,
  onClose,
  onRaceStart,
}) => {
  const profile = coinManager.getProfile();
  const [playerName, setPlayerName] = useState(profile.name);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [selectedCar, setSelectedCar] = useState<CarId>(profile.selectedCar);

  const [inRoom, setInRoom] = useState(false);
  const [currentCode, setCurrentCode] = useState<string>('');
  const [players, setPlayers] = useState<RoomPlayerState[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    multiplayerClient.onLobbyUpdate = (updatedPlayers, hostStatus, code) => {
      setInRoom(true);
      setCurrentCode(code);
      setPlayers(updatedPlayers);
      setIsHost(hostStatus);
      setErrorMessage(null);
    };

    multiplayerClient.onError = (msg) => {
      setErrorMessage(msg);
    };

    multiplayerClient.onRaceStartCountdown = () => {
      onRaceStart();
    };

    return () => {
      // Keep listeners connected
    };
  }, [onRaceStart]);

  if (!isOpen) return null;

  const sanitizeName = (raw: string) => {
    return raw.replace(/[^\w\s\-_.]/gi, '').slice(0, 16);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = sanitizeName(e.target.value);
    setPlayerName(val);
    if (val.trim()) {
      coinManager.setPlayerName(val.trim());
      if (inRoom) {
        multiplayerClient.updateProfile(val.trim(), selectedCar);
      }
    }
  };

  const handleCreateRoom = () => {
    soundEngine.playClick();
    const clean = sanitizeName(playerName).trim();
    if (!clean) {
      setErrorMessage('Player Name is required before creating or joining a room.');
      return;
    }
    setErrorMessage(null);
    coinManager.setPlayerName(clean);
    multiplayerClient.createRoom(clean, selectedCar);
  };

  const handleJoinRoom = () => {
    soundEngine.playClick();
    const clean = sanitizeName(playerName).trim();
    if (!clean) {
      setErrorMessage('Player Name is required before creating or joining a room.');
      return;
    }
    if (!roomCodeInput.trim()) {
      setErrorMessage('Please enter a 5-character room code.');
      return;
    }
    setErrorMessage(null);
    coinManager.setPlayerName(clean);
    multiplayerClient.joinRoom(roomCodeInput.trim(), clean, selectedCar);
  };

  const handleSelectCarInLobby = (carId: CarId) => {
    setSelectedCar(carId);
    coinManager.selectCar(carId);
    if (inRoom) {
      multiplayerClient.updateProfile(playerName, carId);
    }
  };

  const handleCopyCode = () => {
    if (currentCode) {
      navigator.clipboard.writeText(currentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartRace = () => {
    soundEngine.playClick();
    if (players.length < 2) {
      setErrorMessage('At least 2 real players must be in the room to start a multiplayer race.');
      return;
    }
    multiplayerClient.startRace();
  };

  const handleLeaveRoom = () => {
    soundEngine.playClick();
    multiplayerClient.leaveRoom();
    setInRoom(false);
    setCurrentCode('');
    setPlayers([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-sky-400" />
            <h2 className="text-xl font-bold font-['Chakra_Petch'] text-white tracking-wide">
              {inRoom ? `CIRCUIT LOBBY: ${currentCode}` : 'MULTIPLAYER GRAND PRIX'}
            </h2>
          </div>

          <button
            onClick={() => {
              soundEngine.playClick();
              if (inRoom) handleLeaveRoom();
              onClose();
            }}
            className="w-9 h-9 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-6 overflow-y-auto max-h-[80vh]">
          {/* Player Name Input (Always changeable & required) */}
          <div className="flex flex-col gap-2.5 bg-neutral-950/60 p-4 rounded-xl border border-neutral-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-sky-400">
                Player Name (Required)
              </label>
              <span className="text-[11px] text-neutral-400 font-mono">
                {playerName.length}/16
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-400">Player Name:</span>
              <input
                type="text"
                value={playerName}
                onChange={handleNameChange}
                placeholder="e.g. HHS Racer"
                maxLength={16}
                className="flex-1 bg-neutral-900 border border-neutral-700 focus:border-sky-500 rounded-lg px-3 py-2 text-white font-bold outline-none transition-colors"
              />
            </div>
            <span className="text-[11px] text-neutral-400">
              Your display name is saved locally and shown in the lobby, above your car in the race, and on the podium results.
            </span>
          </div>

          {/* Vehicle Selector */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Select Your Racing Vehicle
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(Object.keys(CARS) as CarId[]).map((cid) => {
                const car = CARS[cid];
                const isOwned = profile.ownedCars.includes(cid);
                const isChosen = selectedCar === cid;

                return (
                  <button
                    key={cid}
                    disabled={!isOwned}
                    onClick={() => handleSelectCarInLobby(cid)}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center relative ${
                      isChosen
                        ? 'border-sky-500 bg-sky-500/15 shadow-md'
                        : isOwned
                        ? 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
                        : 'border-neutral-900 bg-neutral-950/40 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div
                      className="w-3.5 h-3.5 rounded-full border border-white/20"
                      style={{ backgroundColor: car.color }}
                    />
                    <div className="text-xs font-bold text-white leading-tight">{car.name}</div>
                    <div className="text-[10px] text-neutral-400">
                      {isOwned ? (isChosen ? 'EQUIPPED' : 'OWNED') : 'LOCKED'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-medium p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!inRoom ? (
            /* Create or Join Options */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Create Room Box */}
              <div className="p-5 rounded-2xl bg-neutral-950/50 border border-neutral-800 flex flex-col justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white font-['Chakra_Petch']">HOST NEW ROOM</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Create a private multiplayer lobby and share your room code with friends.
                  </p>
                </div>
                <button
                  onClick={handleCreateRoom}
                  className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-neutral-950 font-bold font-['Chakra_Petch'] tracking-wider text-sm transition-all shadow-lg shadow-sky-500/20 active:scale-95"
                >
                  CREATE RACE ROOM
                </button>
              </div>

              {/* Join Room Box */}
              <div className="p-5 rounded-2xl bg-neutral-950/50 border border-neutral-800 flex flex-col justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white font-['Chakra_Petch']">JOIN EXISTING ROOM</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Enter the 5-character code shared by your room host.
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="CODE (e.g. 8K2M)"
                    maxLength={6}
                    className="flex-1 bg-neutral-900 border border-neutral-700 focus:border-sky-500 rounded-xl px-3 py-2 text-white font-mono font-bold text-center tracking-widest outline-none uppercase"
                  />
                  <button
                    onClick={handleJoinRoom}
                    className="px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white font-bold text-xs transition-all active:scale-95"
                  >
                    JOIN
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Active Lobby Screen */
            <div className="flex flex-col gap-5">
              {/* Room Code Display */}
              <div className="flex items-center justify-between bg-neutral-950/70 p-4 rounded-xl border border-neutral-800">
                <div>
                  <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">ROOM CODE</div>
                  <div className="text-2xl font-black font-mono text-sky-400 tracking-widest">{currentCode}</div>
                </div>

                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold border border-neutral-700 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'COPIED!' : 'COPY CODE'}</span>
                </button>
              </div>

              {/* Connected Real Players List */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-neutral-400">
                  <span>PLAYERS ({players.length})</span>
                  <span>GRID POSITION</span>
                </div>

                <div className="flex flex-col gap-2">
                  {players.map((p) => {
                    const carInfo = CARS[p.carId] || CARS.starter;
                    const isMe = p.id === multiplayerClient.playerId;

                    return (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between p-3.5 rounded-xl border ${
                          isMe
                            ? 'border-sky-500/60 bg-sky-500/10'
                            : 'border-neutral-800 bg-neutral-950/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                            style={{ backgroundColor: carInfo.color }}
                          />
                          <div>
                            <div className="text-sm font-bold text-white flex items-center gap-2">
                              <span>
                                {p.name} <span className="text-neutral-400 font-normal">—</span> <span className="text-sky-300 font-semibold">{carInfo.name}</span>
                              </span>
                              {p.isHost && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                  HOST
                                </span>
                              )}
                              {isMe && <span className="text-[10px] text-neutral-400 font-semibold">(You)</span>}
                            </div>
                            <div className="text-xs text-neutral-400 mt-0.5">
                              {p.isHost ? 'Room Administrator' : 'Connected & Ready'}
                            </div>
                          </div>
                        </div>

                        <div className="text-right font-['Chakra_Petch'] font-bold text-sm text-amber-400">
                          P{p.gridSlot + 1}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Host Start Race Warning & Action */}
              <div className="flex flex-col gap-3 pt-2">
                {isHost ? (
                  <>
                    <button
                      onClick={handleStartRace}
                      disabled={players.length < 2}
                      className={`w-full py-4 rounded-xl font-black font-['Chakra_Petch'] text-base tracking-wider flex items-center justify-center gap-2 transition-all ${
                        players.length >= 2
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-lg shadow-emerald-500/25 active:scale-[0.99]'
                          : 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed'
                      }`}
                    >
                      <Play className="w-5 h-5 fill-current" />
                      {players.length >= 2 ? 'START GRAND PRIX' : 'WAITING FOR 2ND PLAYER TO JOIN...'}
                    </button>
                    {players.length < 2 && (
                      <p className="text-[11px] text-amber-400/90 text-center font-medium">
                        Multiplayer requires at least 2 real players. Share code <span className="font-mono font-bold text-white">{currentCode}</span> with a friend!
                      </p>
                    )}
                  </>
                ) : (
                  <div className="text-center p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 text-xs text-neutral-400 flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                    Waiting for the room host to start the race...
                  </div>
                )}

                <button
                  onClick={handleLeaveRoom}
                  className="w-full py-2.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 text-neutral-400 hover:text-rose-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-neutral-700/60"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Leave Room
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
