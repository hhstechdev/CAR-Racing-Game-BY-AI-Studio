import * as THREE from 'three';
import { CarId, RemoteCarSyncData, RoomPlayerState, RaceResult } from '../types/game';
import { createCarModel, CarModelInstance } from './carModel';
import { Circuit } from './circuit';

export interface RemotePlayerInstance {
  id: string;
  name: string;
  carId: CarId;
  gridSlot: number;
  model: CarModelInstance;
  targetPos: THREE.Vector3;
  targetRot: number;
  currentPos: THREE.Vector3;
  currentRot: number;
  speed: number;
  steerAngle: number;
  isBoosting: boolean;
  isBraking: boolean;
  lap: number;
  checkpoint: number;
  progress: number;
  finished: boolean;
  finishTime?: number;
  bestLap?: number;
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  public isConnected = false;
  public roomCode: string | null = null;
  public playerId: string | null = null;
  public isHost = false;
  public roomPlayers: RoomPlayerState[] = [];
  public raceResults: RaceResult[] = [];
  public roomStatus: 'none' | 'lobby' | 'countdown' | 'racing' | 'finished' = 'none';

  // Remote 3D players in scene
  public remotePlayers = new Map<string, RemotePlayerInstance>();
  private scene: THREE.Scene | THREE.Group | null = null;
  private circuit: Circuit | null = null;

  // Event callbacks
  public onLobbyUpdate?: (players: RoomPlayerState[], isHost: boolean, roomCode: string) => void;
  public onRaceStartCountdown?: (countdownStart: number, raceStart: number) => void;
  public onPlayerFinished?: (result: RaceResult) => void;
  public onRaceFinished?: (results: RaceResult[]) => void;
  public onReturnedToLobby?: () => void;
  public onError?: (message: string) => void;
  public onPlayerLeft?: (playerName: string) => void;
  public onBoostCollected?: (pickupId: number) => void;
  public onBoostRespawned?: (pickupId: number) => void;

  constructor() {
    this.connect();
  }

  public initScene(scene: THREE.Scene | THREE.Group, circuit: Circuit) {
    this.scene = scene;
    this.circuit = circuit;
    this.spawnRemoteCars();
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        // Auto-reconnect after 2 seconds if connection dropped unexpectedly
        setTimeout(() => {
          if (!this.isConnected) {
            this.connect();
          }
        }, 2000);
      };

      this.ws.onerror = (err) => {
        console.error('Multiplayer WebSocket error:', err);
      };
    } catch (err) {
      console.error('Failed to initialize WebSocket:', err);
    }
  }

  private handleMessage(msg: any) {
    switch (msg.type) {
      case 'ROOM_CREATED':
      case 'ROOM_JOINED': {
        this.roomCode = msg.roomCode;
        this.playerId = msg.playerId;
        this.roomStatus = 'lobby';
        const room = msg.room;
        this.roomPlayers = room.players;
        this.isHost = room.hostId === this.playerId;
        this.onLobbyUpdate?.(this.roomPlayers, this.isHost, this.roomCode!);
        break;
      }

      case 'PLAYER_JOINED':
      case 'ROOM_UPDATED': {
        const room = msg.room;
        this.roomPlayers = room.players;
        this.isHost = room.hostId === this.playerId;
        this.onLobbyUpdate?.(this.roomPlayers, this.isHost, this.roomCode!);
        break;
      }

      case 'PLAYER_LEFT': {
        const { playerId, name, room } = msg;
        this.roomPlayers = room.players;
        this.isHost = room.hostId === this.playerId;

        // Clean up remote car from 3D scene if present
        this.removeRemoteCar(playerId);

        this.onPlayerLeft?.(name);
        this.onLobbyUpdate?.(this.roomPlayers, this.isHost, this.roomCode || '');
        break;
      }

      case 'RACE_STARTING': {
        this.roomStatus = 'countdown';
        const room = msg.room;
        this.roomPlayers = room.players;

        // Initialize 3D cars for all other players in the room
        this.spawnRemoteCars();

        this.onRaceStartCountdown?.(msg.countdownStart, msg.raceStart);
        break;
      }

      case 'REMOTE_PLAYER_SYNC': {
        const { playerId, data } = msg;
        if (playerId === this.playerId) return;

        let remote = this.remotePlayers.get(playerId);
        if (!remote && this.scene && this.circuit) {
          this.spawnSingleRemoteCar(playerId);
          remote = this.remotePlayers.get(playerId);
        }

        if (remote && data) {
          if (Array.isArray(data.pos) && !isNaN(data.pos[0]) && !isNaN(data.pos[1]) && !isNaN(data.pos[2])) {
            remote.targetPos.set(data.pos[0], data.pos[1], data.pos[2]);
          }
          if (typeof data.rot === 'number' && !isNaN(data.rot)) {
            remote.targetRot = data.rot;
          }
          if (typeof data.speed === 'number' && !isNaN(data.speed)) {
            remote.speed = data.speed;
          }
          if (typeof data.steer === 'number' && !isNaN(data.steer)) {
            remote.steerAngle = data.steer;
          }
          remote.isBoosting = !!data.boostActive;
          remote.isBraking = !!data.isBraking;
          if (typeof data.lap === 'number') remote.lap = data.lap;
          if (typeof data.checkpoint === 'number') remote.checkpoint = data.checkpoint;
          if (typeof data.progress === 'number') remote.progress = data.progress;
          remote.finished = !!data.finished;
        }
        break;
      }

      case 'BOOST_COLLECTED': {
        this.onBoostCollected?.(msg.pickupId);
        break;
      }

      case 'BOOST_RESPAWNED': {
        this.onBoostRespawned?.(msg.pickupId);
        break;
      }

      case 'PLAYER_FINISHED': {
        this.onPlayerFinished?.(msg.result);
        break;
      }

      case 'RACE_FINISHED': {
        this.roomStatus = 'finished';
        this.raceResults = msg.results;
        this.onRaceFinished?.(msg.results);
        break;
      }

      case 'RETURNED_TO_LOBBY': {
        this.roomStatus = 'lobby';
        this.clearAllRemoteCars();
        this.roomPlayers = msg.room.players;
        this.isHost = msg.room.hostId === this.playerId;
        this.onReturnedToLobby?.();
        this.onLobbyUpdate?.(this.roomPlayers, this.isHost, this.roomCode || '');
        break;
      }

      case 'ERROR': {
        this.onError?.(msg.message || 'Multiplayer error');
        break;
      }
    }
  }

  // --- Actions ---
  public createRoom(playerName: string, carId: CarId) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    }
    this.send({
      type: 'CREATE_ROOM',
      playerName,
      carId,
    });
  }

  public joinRoom(roomCode: string, playerName: string, carId: CarId) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    }
    this.send({
      type: 'JOIN_ROOM',
      roomCode: roomCode.toUpperCase(),
      playerName,
      carId,
    });
  }

  public updateProfile(name: string, carId: CarId) {
    this.send({
      type: 'UPDATE_PROFILE',
      name,
      carId,
    });
  }

  public startRace() {
    this.send({
      type: 'START_RACE',
    });
  }

  public sendState(data: RemoteCarSyncData) {
    this.send({
      type: 'PLAYER_SYNC',
      data,
    });
  }

  public collectBoost(pickupId: number) {
    this.send({
      type: 'COLLECT_BOOST',
      pickupId,
    });
  }

  public notifyFinished(finishTime: number, bestLap: number) {
    this.send({
      type: 'PLAYER_FINISH',
      finishTime,
      bestLap,
    });
  }

  public returnToLobby() {
    this.send({
      type: 'RETURN_TO_LOBBY',
    });
  }

  public leaveRoom() {
    this.send({
      type: 'LEAVE_ROOM',
    });
    this.clearAllRemoteCars();
    this.roomCode = null;
    this.playerId = null;
    this.roomPlayers = [];
    this.roomStatus = 'none';
  }

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  // --- 3D Remote Car Mesh Management ---
  public spawnSingleRemoteCar(playerId: string, playerInfo?: RoomPlayerState) {
    if (!this.scene || !this.circuit || playerId === this.playerId) return;
    if (this.remotePlayers.has(playerId)) return;

    const info = playerInfo || this.roomPlayers.find((p) => p.id === playerId);
    const pName = info?.name || 'Racer';
    const pCarId = info?.carId || 'starter';
    const pGridSlot = info?.gridSlot !== undefined ? info.gridSlot : this.remotePlayers.size + 1;

    const slot = this.circuit.gridSlots[pGridSlot % this.circuit.gridSlots.length] || {
      position: new THREE.Vector3(0, 0.06, 0),
      rotation: 0,
    };

    const carModel = createCarModel(pCarId, pName, pGridSlot);
    carModel.group.position.copy(slot.position);
    carModel.group.rotation.y = slot.rotation;

    this.scene.add(carModel.group);

    const remotePlayer: RemotePlayerInstance = {
      id: playerId,
      name: pName,
      carId: pCarId,
      gridSlot: pGridSlot,
      model: carModel,
      targetPos: new THREE.Vector3().copy(slot.position),
      targetRot: slot.rotation,
      currentPos: new THREE.Vector3().copy(slot.position),
      currentRot: slot.rotation,
      speed: 0,
      steerAngle: 0,
      isBoosting: false,
      isBraking: false,
      lap: 1,
      checkpoint: 0,
      progress: 0,
      finished: false,
    };

    this.remotePlayers.set(playerId, remotePlayer);
  }

  public spawnRemoteCars() {
    if (!this.scene || !this.circuit) return;

    this.clearAllRemoteCars();

    this.roomPlayers.forEach((p) => {
      if (p.id !== this.playerId) {
        this.spawnSingleRemoteCar(p.id, p);
      }
    });
  }

  public updateRemoteCars(delta: number) {
    this.remotePlayers.forEach((rp) => {
      // Direct snap if distance is excessive
      if (rp.currentPos.distanceTo(rp.targetPos) > 45) {
        rp.currentPos.copy(rp.targetPos);
      } else {
        rp.currentPos.lerp(rp.targetPos, Math.min(1, 14 * delta));
      }
      rp.model.group.position.copy(rp.currentPos);

      // Smooth interpolation for rotation (handling angle wrap & NaN safety)
      if (typeof rp.targetRot === 'number' && !isNaN(rp.targetRot) && !isNaN(rp.currentRot)) {
        let diff = rp.targetRot - rp.currentRot;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        if (!isNaN(diff)) {
          rp.currentRot += diff * Math.min(1, 14 * delta);
          rp.model.group.rotation.y = rp.currentRot;
        }
      }

      // Update wheels, lights, boost flames, and overhead name tag
      rp.model.updateVisuals(rp.speed, rp.steerAngle, rp.isBraking, rp.isBoosting);
    });
  }

  public removeRemoteCar(playerId: string) {
    const remote = this.remotePlayers.get(playerId);
    if (remote && this.scene) {
      this.scene.remove(remote.model.group);
      this.remotePlayers.delete(playerId);
    }
  }

  public clearAllRemoteCars() {
    if (this.scene) {
      this.remotePlayers.forEach((rp) => {
        this.scene!.remove(rp.model.group);
      });
    }
    this.remotePlayers.clear();
  }
}

export const multiplayerClient = new MultiplayerClient();
