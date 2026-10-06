import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

interface Player {
  id: string;
  name: string;
  carId: string;
  isHost: boolean;
  ready: boolean;
  gridSlot: number;
  finished: boolean;
  finishTime?: number;
  bestLap?: number;
  ws: WebSocket;
}

interface Room {
  code: string;
  hostId: string;
  status: 'lobby' | 'countdown' | 'racing' | 'finished';
  laps: number;
  countdownStart?: number;
  raceStart?: number;
  players: Map<string, Player>;
  boostPickups: Set<number>;
  results: Array<{
    id: string;
    name: string;
    carId: string;
    position: number;
    finishTime: number;
    bestLap: number;
  }>;
}

const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function broadcastToRoom(room: Room, message: any, excludeWs?: WebSocket) {
  const payload = JSON.stringify(message);
  room.players.forEach((player) => {
    if (player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(payload);
    }
  });
}

function getRoomSnapshot(room: Room) {
  const playersList = Array.from(room.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    carId: p.carId,
    isHost: p.isHost,
    ready: p.ready,
    gridSlot: p.gridSlot,
    finished: p.finished,
    finishTime: p.finishTime,
    bestLap: p.bestLap,
  }));

  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    laps: room.laps,
    players: playersList,
    results: room.results,
    playerCount: playersList.length,
  };
}

wss.on('connection', (ws: WebSocket) => {
  let currentRoomCode: string | null = null;
  let playerId: string | null = null;

  const handleDisconnect = () => {
    if (!currentRoomCode || !playerId) return;

    const room = rooms.get(currentRoomCode);
    if (!room) return;

    const leavingPlayer = room.players.get(playerId);
    room.players.delete(playerId);

    if (room.players.size === 0) {
      rooms.delete(currentRoomCode);
      return;
    }

    // If host left, elect new host
    if (room.hostId === playerId) {
      const nextPlayer = room.players.values().next().value;
      if (nextPlayer) {
        nextPlayer.isHost = true;
        room.hostId = nextPlayer.id;
      }
    }

    // Re-index grid slots
    let slot = 0;
    room.players.forEach((p) => {
      p.gridSlot = slot++;
    });

    // Notify remaining players
    broadcastToRoom(room, {
      type: 'PLAYER_LEFT',
      playerId,
      name: leavingPlayer ? leavingPlayer.name : 'Unknown',
      room: getRoomSnapshot(room),
    });
  };

  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'PING': {
          ws.send(JSON.stringify({ type: 'PONG' }));
          break;
        }

        case 'CREATE_ROOM': {
          const { playerName, carId, laps = 3 } = msg;
          const cleanName = (playerName || 'Racer').trim().slice(0, 16);
          const code = generateRoomCode();
          const pId = 'p_' + Math.random().toString(36).substring(2, 9);

          playerId = pId;
          currentRoomCode = code;

          const hostPlayer: Player = {
            id: pId,
            name: cleanName || 'Racer 1',
            carId: carId || 'starter',
            isHost: true,
            ready: true,
            gridSlot: 0,
            finished: false,
            ws,
          };

          const room: Room = {
            code,
            hostId: pId,
            status: 'lobby',
            laps,
            players: new Map([[pId, hostPlayer]]),
            boostPickups: new Set(),
            results: [],
          };

          rooms.set(code, room);

          ws.send(
            JSON.stringify({
              type: 'ROOM_CREATED',
              roomCode: code,
              playerId: pId,
              room: getRoomSnapshot(room),
            })
          );
          break;
        }

        case 'JOIN_ROOM': {
          const { roomCode, playerName, carId } = msg;
          const targetCode = (roomCode || '').trim().toUpperCase();
          const room = rooms.get(targetCode);

          if (!room) {
            ws.send(
              JSON.stringify({
                type: 'ERROR',
                code: 'ROOM_NOT_FOUND',
                message: `Room "${targetCode}" not found. Check the code and try again.`,
              })
            );
            return;
          }

          if (room.status !== 'lobby') {
            ws.send(
              JSON.stringify({
                type: 'ERROR',
                code: 'RACE_IN_PROGRESS',
                message: 'Race is currently in progress in this room.',
              })
            );
            return;
          }

          if (room.players.size >= 8) {
            ws.send(
              JSON.stringify({
                type: 'ERROR',
                code: 'ROOM_FULL',
                message: 'This racing lobby is already full (maximum 8 players).',
              })
            );
            return;
          }

          const cleanName = (playerName || 'Challenger').trim().slice(0, 16);
          const pId = 'p_' + Math.random().toString(36).substring(2, 9);
          playerId = pId;
          currentRoomCode = targetCode;

          const newPlayer: Player = {
            id: pId,
            name: cleanName || `Racer ${room.players.size + 1}`,
            carId: carId || 'starter',
            isHost: false,
            ready: true,
            gridSlot: room.players.size,
            finished: false,
            ws,
          };

          room.players.set(pId, newPlayer);

          // Reply to joined player
          ws.send(
            JSON.stringify({
              type: 'ROOM_JOINED',
              roomCode: targetCode,
              playerId: pId,
              room: getRoomSnapshot(room),
            })
          );

          // Broadcast to everyone in room
          broadcastToRoom(
            room,
            {
              type: 'PLAYER_JOINED',
              player: {
                id: newPlayer.id,
                name: newPlayer.name,
                carId: newPlayer.carId,
                isHost: newPlayer.isHost,
                ready: newPlayer.ready,
                gridSlot: newPlayer.gridSlot,
              },
              room: getRoomSnapshot(room),
            },
            ws
          );
          break;
        }

        case 'UPDATE_PROFILE': {
          if (!currentRoomCode || !playerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          const player = room.players.get(playerId);
          if (!player) return;

          if (msg.name) {
            player.name = (msg.name || '').trim().slice(0, 16) || player.name;
          }
          if (msg.carId) {
            player.carId = msg.carId;
          }

          broadcastToRoom(room, {
            type: 'ROOM_UPDATED',
            room: getRoomSnapshot(room),
          });
          break;
        }

        case 'START_RACE': {
          if (!currentRoomCode || !playerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          if (room.hostId !== playerId) {
            ws.send(
              JSON.stringify({
                type: 'ERROR',
                message: 'Only the room host can start the race.',
              })
            );
            return;
          }

          if (room.players.size < 2) {
            ws.send(
              JSON.stringify({
                type: 'ERROR',
                message: 'At least 2 real players are required to start a multiplayer race. Share your room code!',
              })
            );
            return;
          }

          room.status = 'countdown';
          room.results = [];
          room.boostPickups.clear();
          const now = Date.now();
          room.countdownStart = now;
          room.raceStart = now + 4000; // 4 seconds countdown (3, 2, 1, GO!)

          // Assign guaranteed unique grid slots & reset finish state
          let slotIdx = 0;
          room.players.forEach((p) => {
            p.gridSlot = slotIdx++;
            p.finished = false;
            p.finishTime = undefined;
            p.bestLap = undefined;
          });

          broadcastToRoom(room, {
            type: 'RACE_STARTING',
            countdownStart: room.countdownStart,
            raceStart: room.raceStart,
            room: getRoomSnapshot(room),
          });
          break;
        }

        case 'PLAYER_SYNC': {
          // Relaying position/rotation/physics telemetry
          if (!currentRoomCode || !playerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          // Broadcast state to all other players in room
          broadcastToRoom(
            room,
            {
              type: 'REMOTE_PLAYER_SYNC',
              playerId,
              data: msg.data,
            },
            ws
          );
          break;
        }

        case 'COLLECT_BOOST': {
          if (!currentRoomCode || !playerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          const { pickupId } = msg;
          if (pickupId !== undefined && !room.boostPickups.has(pickupId)) {
            room.boostPickups.add(pickupId);

            broadcastToRoom(room, {
              type: 'BOOST_COLLECTED',
              pickupId,
              collectedBy: playerId,
            });

            // Respawn boost bottle after 9 seconds
            setTimeout(() => {
              const currentRoom = rooms.get(currentRoomCode!);
              if (currentRoom && currentRoom.boostPickups.has(pickupId)) {
                currentRoom.boostPickups.delete(pickupId);
                broadcastToRoom(currentRoom, {
                  type: 'BOOST_RESPAWNED',
                  pickupId,
                });
              }
            }, 9000);
          }
          break;
        }

        case 'PLAYER_FINISH': {
          if (!currentRoomCode || !playerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          const player = room.players.get(playerId);
          if (!player || player.finished) return;

          const finishTime = msg.finishTime || (Date.now() - (room.raceStart || Date.now()));
          const bestLap = msg.bestLap || 0;
          player.finished = true;
          player.finishTime = finishTime;
          player.bestLap = bestLap;

          const position = room.results.length + 1;
          const resultEntry = {
            id: player.id,
            name: player.name,
            carId: player.carId,
            position,
            finishTime,
            bestLap,
          };
          room.results.push(resultEntry);

          broadcastToRoom(room, {
            type: 'PLAYER_FINISHED',
            result: resultEntry,
            room: getRoomSnapshot(room),
          });

          // NEW RULE: As soon as ANY racing car completes 3 laps, immediately end the race for everyone!
          room.status = 'finished';

          // Classify all remaining players based on race standing when winner finished
          const remainingPlayers = Array.from(room.players.values()).filter((p) => p.id !== player.id && !room.results.some((r) => r.id === p.id));
          remainingPlayers.forEach((rem, idx) => {
            const pos = room.results.length + 1;
            const remTime = Number((finishTime + (idx + 1) * 4.2).toFixed(2));
            room.results.push({
              id: rem.id,
              name: rem.name,
              carId: rem.carId,
              position: pos,
              finishTime: remTime,
              bestLap: rem.bestLap || Number((finishTime / 3.0 + 1.2).toFixed(2)),
            });
          });

          broadcastToRoom(room, {
            type: 'RACE_FINISHED',
            results: room.results,
            room: getRoomSnapshot(room),
          });
          break;
        }

        case 'RETURN_TO_LOBBY': {
          if (!currentRoomCode || !playerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          if (room.hostId !== playerId) return;

          room.status = 'lobby';
          room.results = [];
          room.boostPickups.clear();
          room.players.forEach((p) => {
            p.finished = false;
            p.finishTime = undefined;
            p.bestLap = undefined;
          });

          broadcastToRoom(room, {
            type: 'RETURNED_TO_LOBBY',
            room: getRoomSnapshot(room),
          });
          break;
        }

        case 'LEAVE_ROOM': {
          handleDisconnect();
          currentRoomCode = null;
          playerId = null;
          break;
        }
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('close', () => {
    handleDisconnect();
  });

  ws.on('error', (err) => {
    console.error('WebSocket connection error:', err);
    handleDisconnect();
  });
});

// API Routes
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeRooms: rooms.size,
  });
});

app.get('/api/rooms', (_req, res) => {
  const publicRooms = Array.from(rooms.values())
    .filter((r) => r.status === 'lobby')
    .map((r) => ({
      code: r.code,
      hostName: r.players.get(r.hostId)?.name || 'Host',
      playerCount: r.players.size,
      maxPlayers: 8,
    }));
  res.json({ rooms: publicRooms });
});

// Vite middleware or static serving
async function startServer() {
  const PORT = 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Apex Grand Prix server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
