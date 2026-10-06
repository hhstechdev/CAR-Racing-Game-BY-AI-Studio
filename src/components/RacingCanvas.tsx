import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CarId, RaceResult, TransmissionMode, GearName } from '../types/game';
import { Circuit } from '../game/circuit';
import { CarPhysics } from '../game/physics';
import { createCarModel } from '../game/carModel';
import { multiplayerClient } from '../game/multiplayerClient';
import { AICompetitorManager } from '../game/aiCompetitors';
import { coinManager } from '../game/coinSystem';
import { soundEngine } from '../game/audio';

interface RacingCanvasProps {
  carId: CarId;
  playerName: string;
  isMultiplayer: boolean;
  totalLaps?: number;
  cameraView?: 'chase' | 'close' | 'hood';
  transmission?: TransmissionMode;
  controls: {
    throttle: boolean;
    brake: boolean;
    steerLeft: boolean;
    steerRight: boolean;
    boost: boolean;
    handbrake?: boolean;
    gearUp?: boolean;
    gearDown?: boolean;
  };
  resetTrigger?: number;
  onHudUpdate: (hud: {
    kmh: number;
    rpm: number;
    gear: number;
    gearName: GearName;
    transmission: TransmissionMode;
    clutchDisengaged: boolean;
    lap: number;
    totalLaps: number;
    lapTime: number;
    bestLapTime: number | null;
    boostPercent: number;
    isBoosting: boolean;
    racePosition: number;
    totalRacers: number;
    countdown: number | null; // 3, 2, 1, 0 (GO) or null
    isFinished: boolean;
    isOffTrack: boolean;
    offTrackSeconds: number;
  }) => void;
  onFinishRace: (finishTime: number, bestLap: number, results?: RaceResult[]) => void;
}

export const RacingCanvas: React.FC<RacingCanvasProps> = ({
  carId,
  playerName,
  isMultiplayer,
  totalLaps = 3,
  cameraView = 'chase',
  transmission = 'automatic',
  controls,
  resetTrigger = 0,
  onHudUpdate,
  onFinishRace,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // References to keep active in render loop
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

  const cameraViewRef = useRef(cameraView);
  cameraViewRef.current = cameraView;

  const totalLapsRef = useRef(totalLaps);
  totalLapsRef.current = totalLaps;

  const transmissionRef = useRef(transmission);
  transmissionRef.current = transmission;

  const resetTriggerRef = useRef(resetTrigger || 0);
  resetTriggerRef.current = resetTrigger || 0;
  const lastResetRef = useRef(resetTrigger || 0);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // --- Three.js Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0c1322');
    scene.fog = new THREE.FogExp2('#0c1322', 0.0028);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.2, 800);
    camera.position.set(0, 10, -20);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // --- Lighting ---
    const hemiLight = new THREE.HemisphereLight('#93c5fd', '#1e293b', 0.65);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#fffbeb', 1.8);
    sunLight.position.set(120, 180, 80);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 400;
    const d = 80;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // --- Circuit & Environment ---
    const circuit = new Circuit();
    scene.add(circuit.scene);

    // Grid slot determination
    let localGridSlot = 0;
    if (isMultiplayer && multiplayerClient.playerId) {
      const myInfo = multiplayerClient.roomPlayers.find((p) => p.id === multiplayerClient.playerId);
      if (myInfo) localGridSlot = myInfo.gridSlot;
    } else if (!isMultiplayer) {
      // In Normal Race, player starts in Grid Slot 4 (P5) with competitors ahead and behind
      localGridSlot = 4;
    }

    // --- Local Car Physics & 3D Model ---
    const physics = new CarPhysics(carId, circuit, localGridSlot, transmissionRef.current);
    const localCarModel = createCarModel(carId, playerName, localGridSlot);
    scene.add(localCarModel.group);

    // Start engine sound
    soundEngine.startEngine(carId);

    // Connect multiplayer scene if in multiplayer mode
    if (isMultiplayer) {
      multiplayerClient.initScene(scene, circuit);
      multiplayerClient.spawnRemoteCars();
    }

    // Normal Race AI Competitors (strictly offline mode; never added in multiplayer)
    let aiManager: AICompetitorManager | null = null;
    if (!isMultiplayer) {
      aiManager = new AICompetitorManager(scene, circuit);
    }

    // --- Race Start Countdown State ---
    let countdownValue: number | null = 3;
    let raceStarted = false;
    let countdownTimer = 3.5;
    let greenLightTimer = 1.2;
    let reactionLaunchChecked = false;

    // Listen for server countdown if in multiplayer
    multiplayerClient.onRaceStartCountdown = (startMs, goMs) => {
      const diff = goMs - Date.now();
      countdownTimer = Math.max(0.5, diff / 1000);
      raceStarted = false;
    };

    multiplayerClient.onBoostCollected = (pickupId: number) => {
      const pickup = circuit.boostPickups.find((p) => p.id === pickupId);
      if (pickup) pickup.active = false;
    };

    multiplayerClient.onBoostRespawned = (pickupId: number) => {
      const pickup = circuit.boostPickups.find((p) => p.id === pickupId);
      if (pickup) pickup.active = true;
    };

    // --- Camera Chase Target ---
    const cameraTarget = new THREE.Vector3();
    const cameraLookAt = new THREE.Vector3();
    let currentFov = 60;

    // Network Sync Throttle (~25 Hz)
    let lastNetworkSync = 0;
    let prevClock = performance.now();
    let finishedTriggered = false;

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // --- Main Game Animation Loop ---
    const animate = (currentTime: number) => {
      animFrameRef.current = requestAnimationFrame(animate);

      const delta = Math.min(0.06, (currentTime - prevClock) / 1000);
      prevClock = currentTime;

      // Keep transmission mode updated from settings
      physics.setTransmission(transmissionRef.current);

      // 1. Countdown Logic
      if (!raceStarted) {
        countdownTimer -= delta;

        if (countdownTimer > 2.0) {
          if (countdownValue !== 3) {
            countdownValue = 3;
            circuit.updateStartLights(1, false);
            soundEngine.playCountdownBeep(false);
          }
        } else if (countdownTimer > 1.0) {
          if (countdownValue !== 2) {
            countdownValue = 2;
            circuit.updateStartLights(3, false);
            soundEngine.playCountdownBeep(false);
          }
        } else if (countdownTimer > 0.0) {
          if (countdownValue !== 1) {
            countdownValue = 1;
            circuit.updateStartLights(5, false);
            soundEngine.playCountdownBeep(false);
          }
        } else {
          // GO!
          if (countdownValue !== 0) {
            countdownValue = 0;
            circuit.updateStartLights(5, true);
            soundEngine.playCountdownBeep(true);
            raceStarted = true;
            if (aiManager) {
              aiManager.onRaceStart();
            }
          }
        }
      } else if (greenLightTimer > 0) {
        greenLightTimer -= delta;
        if (greenLightTimer <= 0) {
          countdownValue = null;
          circuit.updateStartLights(0, false);
        }
      }

      // Check reaction launch skill
      if (raceStarted && !reactionLaunchChecked && countdownValue === 0) {
        if (controlsRef.current.throttle) {
          reactionLaunchChecked = true;
          coinManager.awardReactionLaunch();
        }
      }

      // Check reset car trigger
      if (resetTriggerRef.current !== lastResetRef.current) {
        lastResetRef.current = resetTriggerRef.current;
        physics.resetToTrack();
      }

      // 2. Physics & Driving
      const activeControls = raceStarted
        ? controlsRef.current
        : {
            throttle: false,
            brake: true,
            steerLeft: false,
            steerRight: false,
            boost: false,
            handbrake: false,
            gearUp: false,
            gearDown: false,
          };

      physics.update(delta, activeControls, totalLapsRef.current);

      // 3. Update Local Car Mesh
      localCarModel.group.position.copy(physics.state.position);
      localCarModel.group.rotation.y = physics.state.rotation;
      localCarModel.updateVisuals(
        physics.state.speed,
        physics.state.steerAngle,
        physics.state.isBraking,
        physics.state.isBoosting
      );

      // 4. Boost Pickup Collection
      circuit.boostPickups.forEach((pickup) => {
        if (pickup.active) {
          const dist = physics.state.position.distanceTo(pickup.position);
          if (dist < 3.2) {
            pickup.active = false;
            physics.addBoost(25);
            if (isMultiplayer) {
              multiplayerClient.collectBoost(pickup.id);
            } else {
              // Local solo respawn after 9s
              setTimeout(() => {
                pickup.active = true;
              }, 9000);
            }
          }
        }
      });

      // 5. Opponent Car Collisions & Remote Updates
      if (isMultiplayer) {
        multiplayerClient.updateRemoteCars(delta);

        // Simple car-to-car elastic push
        multiplayerClient.remotePlayers.forEach((rp) => {
          const dist = physics.state.position.distanceTo(rp.currentPos);
          if (dist < 2.4 && dist > 0.01) {
            const pushDir = new THREE.Vector3()
              .subVectors(physics.state.position, rp.currentPos)
              .normalize();
            physics.state.position.addScaledVector(pushDir, 0.4);
            physics.state.speed *= 0.85;
            soundEngine.playCollision(0.7);
          }
        });

        // Broadcast local state to other players at ~25 Hz
        if (currentTime - lastNetworkSync > 40) {
          lastNetworkSync = currentTime;
          multiplayerClient.sendState({
            pos: [
              Number(physics.state.position.x.toFixed(2)),
              Number(physics.state.position.y.toFixed(2)),
              Number(physics.state.position.z.toFixed(2)),
            ],
            rot: Number(physics.state.rotation.toFixed(3)),
            steer: Number(physics.state.steerAngle.toFixed(2)),
            speed: Number(physics.state.speed.toFixed(1)),
            boostActive: physics.state.isBoosting,
            isBraking: physics.state.isBraking,
            lap: physics.state.currentLap,
            checkpoint: physics.state.currentCheckpoint,
            progress: Number(physics.state.splineProgress.toFixed(3)),
            finished: physics.state.isFinished,
          });
        }
      } else if (aiManager) {
        // Update AI competitors in Normal Race mode
        aiManager.update(delta, physics.state.position, physics.state.speed, totalLapsRef.current);
      }

      // 6. Calculate Live Race Position
      let calculatedPosition = 1;
      let totalRacerCount = 1;

      if (isMultiplayer) {
        const myScore = physics.state.currentLap * 1000 + physics.state.splineProgress * 100;
        totalRacerCount = multiplayerClient.roomPlayers.length;
        multiplayerClient.remotePlayers.forEach((rp) => {
          const remoteScore = rp.lap * 1000 + rp.progress * 100;
          if (remoteScore > myScore) {
            calculatedPosition++;
          }
        });
      } else if (aiManager) {
        const standings = aiManager.evaluateStandings(
          physics.state.currentLap,
          physics.state.splineProgress,
          physics.state.isFinished,
          physics.state.isFinished ? physics.state.lapTimes.reduce((a, b) => a + b, 0) : null
        );
        calculatedPosition = standings.playerPosition;
        totalRacerCount = standings.totalRacers;
      }

      localCarModel.setName(playerName, calculatedPosition);

      // 7. Evaluate Skill Coins with Reverse Driving Protection
      const distToCenter = circuit.getDistanceToCenter(physics.state.position, physics.state.splineProgress);
      const tClosest = circuit.getClosestSplineT(physics.state.position, physics.state.splineProgress);
      const trackTangent = circuit.curve.getTangentAt(tClosest).normalize();
      const carHeading = new THREE.Vector3(
        Math.sin(physics.state.rotation),
        0,
        Math.cos(physics.state.rotation)
      ).normalize();

      const isHeadingCorrect = carHeading.dot(trackTangent) > 0.25;
      const isMovingForwardOnTrack = physics.state.velocity.dot(trackTangent) > 0.8;
      const isReversing = physics.state.speed < 0;

      const isLegitimateForwardRacing =
        !isReversing &&
        isHeadingCorrect &&
        isMovingForwardOnTrack &&
        physics.state.speed > 3.0 &&
        !physics.state.isOffTrack;

      coinManager.evaluateDrivingSkill(delta, {
        kmh: physics.state.kmh,
        isOffTrack: physics.state.isOffTrack,
        steerAngle: physics.state.steerAngle,
        distanceToCenter: distToCenter,
        splineProgress: physics.state.splineProgress,
        racePosition: calculatedPosition,
        isRacing: raceStarted && !physics.state.isFinished,
        isLegitimateForwardRacing,
      });

      // 8. Dynamic Camera Tracking
      const forwardX = Math.sin(physics.state.rotation);
      const forwardZ = Math.cos(physics.state.rotation);

      if (cameraViewRef.current === 'close') {
        cameraTarget.set(
          physics.state.position.x - forwardX * 5.2,
          physics.state.position.y + 2.2,
          physics.state.position.z - forwardZ * 5.2
        );
        cameraLookAt.set(
          physics.state.position.x + forwardX * 12,
          physics.state.position.y + 1.2,
          physics.state.position.z + forwardZ * 12
        );
      } else if (cameraViewRef.current === 'hood') {
        cameraTarget.set(
          physics.state.position.x + forwardX * 1.8,
          physics.state.position.y + 0.9,
          physics.state.position.z + forwardZ * 1.8
        );
        cameraLookAt.set(
          physics.state.position.x + forwardX * 20,
          physics.state.position.y + 0.9,
          physics.state.position.z + forwardZ * 20
        );
      } else {
        const speedLag = Math.min(2.5, (physics.state.speed / 45) * 2.5);
        const distBehind = 7.5 + speedLag;
        const heightAbove = 3.2;

        cameraTarget.set(
          physics.state.position.x - forwardX * distBehind,
          physics.state.position.y + heightAbove,
          physics.state.position.z - forwardZ * distBehind
        );

        cameraLookAt.set(
          physics.state.position.x + forwardX * 6,
          physics.state.position.y + 1.4,
          physics.state.position.z + forwardZ * 6
        );
      }

      // Smooth camera interpolation
      camera.position.lerp(cameraTarget, Math.min(1, 12 * delta));
      camera.lookAt(cameraLookAt);

      // Dynamic FOV on boost
      const targetFov = physics.state.isBoosting ? 74 : 60;
      currentFov += (targetFov - currentFov) * Math.min(1, 8 * delta);
      camera.fov = currentFov;
      camera.updateProjectionMatrix();

      // 9. Update Circuit (pickups animations)
      circuit.update(delta);

      // 10. Check Finished State: End race immediately when ANY car completes Lap 3!
      const anyAiFinished = aiManager ? aiManager.hasAnyCompetitorFinished() : false;
      const anyRemoteFinished = isMultiplayer
        ? Array.from(multiplayerClient.remotePlayers.values()).some((rp) => rp.finished || rp.lap > totalLapsRef.current)
        : false;
      const isRaceEndedByAnyone = physics.state.isFinished || anyAiFinished || anyRemoteFinished;

      if (isRaceEndedByAnyone && !finishedTriggered) {
        finishedTriggered = true;
        const totalTime = physics.state.lapTimes.reduce((a, b) => a + b, 0) || physics.state.currentLapTime;
        const bestLap = physics.state.bestLapTime || totalTime;

        let classifiedResults: RaceResult[] | undefined = undefined;
        if (isMultiplayer) {
          multiplayerClient.notifyFinished(totalTime, bestLap);
        } else if (aiManager) {
          classifiedResults = aiManager.getClassifiedResults(
            playerName,
            carId,
            physics.state.currentLap,
            physics.state.splineProgress,
            physics.state.isFinished,
            totalTime,
            bestLap
          );
        }
        onFinishRace(totalTime, bestLap, classifiedResults);
      }

      // 11. Dispatch HUD Update with Gear System metrics
      onHudUpdate({
        kmh: physics.state.kmh,
        rpm: physics.state.rpm,
        gear: physics.state.gear,
        gearName: physics.state.gearName,
        transmission: physics.state.transmission,
        clutchDisengaged: physics.state.clutchDisengaged,
        lap: physics.state.currentLap,
        totalLaps: totalLapsRef.current,
        lapTime: physics.state.currentLapTime,
        bestLapTime: physics.state.bestLapTime,
        boostPercent: Math.round(physics.state.boostEnergy),
        isBoosting: physics.state.isBoosting,
        racePosition: calculatedPosition,
        totalRacers: totalRacerCount,
        countdown: countdownValue,
        isFinished: physics.state.isFinished,
        isOffTrack: physics.state.isOffTrack,
        offTrackSeconds: physics.state.offTrackSeconds,
      });

      // Render Scene
      renderer.render(scene, camera);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      soundEngine.stopEngine();
      soundEngine.setBoostAudio(false);
      soundEngine.updateScreech(0);
      if (isMultiplayer) {
        multiplayerClient.clearAllRemoteCars();
      } else if (aiManager) {
        aiManager.cleanup();
      }
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [carId, playerName, isMultiplayer]);

  return <div ref={mountRef} className="w-full h-full absolute inset-0 overflow-hidden" />;
};
