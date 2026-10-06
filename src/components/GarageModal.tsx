import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { X, Check, Lock, Coins, ShieldCheck, Zap, Gauge, Compass } from 'lucide-react';
import { CarId, CARS, CarConfig } from '../types/game';
import { createCarModel } from '../game/carModel';
import { coinManager } from '../game/coinSystem';
import { soundEngine } from '../game/audio';

interface GarageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCar: (carId: CarId) => void;
}

export const GarageModal: React.FC<GarageModalProps> = ({ isOpen, onClose, onSelectCar }) => {
  const [profile, setProfile] = useState(coinManager.getProfile());
  const [selectedPreviewCar, setSelectedPreviewCar] = useState<CarId>(profile.selectedCar);
  const [feedback, setFeedback] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const carGroupRef = useRef<THREE.Group | null>(null);
  const animRef = useRef<number | null>(null);

  // Sync profile when opened
  useEffect(() => {
    if (isOpen) {
      const p = coinManager.getProfile();
      setProfile(p);
      setSelectedPreviewCar(p.selectedCar);
      setFeedback(null);
    }
  }, [isOpen]);

  // 3D Showroom Canvas
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const container = canvasRef.current;
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 320;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#090d16');

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(4.5, 2.5, 5.5);
    camera.lookAt(0, 0.6, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Studio lighting
    const keyLight = new THREE.DirectionalLight('#ffffff', 2.0);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight('#38bdf8', 1.0);
    fillLight.position.set(-5, 4, -4);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight('#fbbf24', 0.8);
    rimLight.position.set(0, 5, -6);
    scene.add(rimLight);

    const hemi = new THREE.HemisphereLight('#ffffff', '#1e293b', 0.8);
    scene.add(hemi);

    // Showroom turntable pedestal
    const pedestalGeom = new THREE.CylinderGeometry(3.2, 3.4, 0.3, 36);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      metalness: 0.8,
      roughness: 0.2,
    });
    const pedestal = new THREE.Mesh(pedestalGeom, pedestalMat);
    pedestal.position.y = -0.15;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    // Floor glow ring
    const ringGeom = new THREE.RingGeometry(3.1, 3.25, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#38bdf8', side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);

    // Initial car model
    const carModel = createCarModel(selectedPreviewCar, 'SHOWROOM', 0);
    carGroupRef.current = carModel.group;
    scene.add(carModel.group);

    // Render & rotation loop
    let lastTime = performance.now();
    const animate = (time: number) => {
      animRef.current = requestAnimationFrame(animate);
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      if (carGroupRef.current) {
        carGroupRef.current.rotation.y += delta * 0.45; // Gentle 360 showcase rotation
      }

      renderer.render(scene, camera);
    };
    animRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isOpen]);

  // Update 3D car model when selected car changes
  useEffect(() => {
    if (!sceneRef.current) return;

    if (carGroupRef.current) {
      sceneRef.current.remove(carGroupRef.current);
    }

    const newCar = createCarModel(selectedPreviewCar, 'SHOWROOM', 0);
    carGroupRef.current = newCar.group;
    sceneRef.current.add(newCar.group);
  }, [selectedPreviewCar]);

  if (!isOpen) return null;

  const currentCarConfig: CarConfig = CARS[selectedPreviewCar];
  const isOwned = profile.ownedCars.includes(selectedPreviewCar);
  const isSelected = profile.selectedCar === selectedPreviewCar;
  const canAfford = profile.coins >= currentCarConfig.price;

  const handleSelectCar = (id: CarId) => {
    soundEngine.playClick();
    setSelectedPreviewCar(id);
    setFeedback(null);
  };

  const handleEquipCar = () => {
    if (isOwned) {
      coinManager.selectCar(selectedPreviewCar);
      setProfile(coinManager.getProfile());
      onSelectCar(selectedPreviewCar);
      soundEngine.playClick();
      setFeedback(`Equipped ${currentCarConfig.name}!`);
    }
  };

  const handleBuyCar = () => {
    const res = coinManager.buyCar(selectedPreviewCar);
    setFeedback(res.message);
    if (res.success) {
      setProfile(coinManager.getProfile());
      onSelectCar(selectedPreviewCar);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold font-['Chakra_Petch'] tracking-wide text-white">
              MOTORSPORT GARAGE & SHOWROOM
            </span>
          </div>

          <div className="flex items-center gap-5">
            {/* Coins Display */}
            <div className="flex items-center gap-2 bg-amber-500/15 border border-amber-500/40 px-3.5 py-1.5 rounded-xl">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="font-['Chakra_Petch'] font-bold text-amber-400 text-sm tracking-wide">
                {profile.coins.toLocaleString()}
              </span>
              <span className="text-xs text-amber-300/80 font-medium">COINS</span>
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
        </div>

        {/* Content Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto">
          {/* Left: 3D Viewport & Vehicle Specifications */}
          <div className="lg:col-span-7 p-6 flex flex-col gap-5 border-b lg:border-b-0 lg:border-r border-neutral-800">
            {/* 3D Viewer Container */}
            <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-neutral-800 bg-gradient-to-b from-neutral-950 to-neutral-900">
              <div ref={canvasRef} className="w-full h-full" />
              <div className="absolute top-3 left-3 bg-neutral-950/70 border border-neutral-700/60 px-3 py-1 rounded-lg text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-sky-400 animate-spin" style={{ animationDuration: '6s' }} />
                <span>360° Showroom Inspection</span>
              </div>
            </div>

            {/* Vehicle Details */}
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase font-bold text-neutral-400 tracking-wider">
                    {currentCarConfig.manufacturer}
                  </div>
                  <h3 className="text-2xl font-black italic font-['Chakra_Petch'] text-white">
                    {currentCarConfig.name}
                  </h3>
                </div>

                <div className="text-right">
                  <div className="text-xs text-neutral-400 uppercase font-semibold">Classification</div>
                  <div className="text-sm font-bold text-sky-400">
                    {currentCarConfig.id === 'lamborghini'
                      ? 'Flagship Supercar (Free)'
                      : currentCarConfig.price === 0
                      ? 'Circuit Sports Coupe (Free)'
                      : 'Pro Circuit Tier'}
                  </div>
                </div>
              </div>

              <p className="text-xs text-neutral-300 leading-relaxed">
                {currentCarConfig.description}
              </p>

              {/* Performance Stats Bars */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-semibold text-neutral-300">
                    <span className="flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5 text-amber-400" /> Top Speed
                    </span>
                    <span className="font-mono text-white">{currentCarConfig.stats.topSpeedKmh} KM/H</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${(currentCarConfig.stats.topSpeedKmh / 240) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-semibold text-neutral-300">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-sky-400" /> Acceleration
                    </span>
                    <span className="font-mono text-white">{currentCarConfig.stats.acceleration}%</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-400 rounded-full"
                      style={{ width: `${currentCarConfig.stats.acceleration}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-semibold text-neutral-300">
                    <span>Cornering Agility</span>
                    <span className="font-mono text-white">{currentCarConfig.stats.handling}%</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full"
                      style={{ width: `${currentCarConfig.stats.handling}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-semibold text-neutral-300">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> Track Grip
                    </span>
                    <span className="font-mono text-white">{currentCarConfig.stats.grip}%</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full"
                      style={{ width: `${currentCarConfig.stats.grip}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Car Fleet Selector & Purchase Actions */}
          <div className="lg:col-span-5 p-6 flex flex-col justify-between gap-6 bg-neutral-950/40">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                SELECT VEHICLE FLEET
              </span>

              <div className="flex flex-col gap-2.5">
                {(Object.keys(CARS) as CarId[]).map((cid) => {
                  const car = CARS[cid];
                  const owned = profile.ownedCars.includes(cid);
                  const isCurrent = profile.selectedCar === cid;
                  const isBrowsing = selectedPreviewCar === cid;

                  return (
                    <button
                      key={cid}
                      onClick={() => handleSelectCar(cid)}
                      className={`text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                        isBrowsing
                          ? 'border-sky-500 bg-sky-500/10 shadow-lg'
                          : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full border border-white/20"
                          style={{ backgroundColor: car.color }}
                        />
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-2">
                            {car.name}
                            {isCurrent && (
                              <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded font-semibold border border-sky-500/30">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-neutral-400">{car.manufacturer}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        {owned ? (
                          <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> {car.price === 0 ? 'FREE / OWNED' : 'OWNED'}
                          </span>
                        ) : car.price === 0 ? (
                          <span className="text-xs font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30">
                            FREE
                          </span>
                        ) : (
                          <div className="flex items-center gap-1 text-xs font-bold text-amber-400">
                            <Lock className="w-3.5 h-3.5" />
                            <span>{car.price.toLocaleString()}</span>
                            <span className="text-[10px] text-amber-300">COINS</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions / Purchase Bar */}
            <div className="flex flex-col gap-3 pt-4 border-t border-neutral-800">
              {feedback && (
                <div className="text-xs font-medium text-center p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sky-300">
                  {feedback}
                </div>
              )}

              {isOwned ? (
                <button
                  onClick={handleEquipCar}
                  disabled={isSelected}
                  className={`w-full py-3.5 rounded-xl font-bold font-['Chakra_Petch'] text-sm tracking-wider flex items-center justify-center gap-2 transition-all ${
                    isSelected
                      ? 'bg-neutral-800 text-neutral-400 cursor-not-allowed border border-neutral-700'
                      : 'bg-sky-500 hover:bg-sky-400 text-neutral-950 shadow-lg shadow-sky-500/20 active:scale-[0.99]'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  {isSelected ? 'CURRENTLY EQUIPPED' : 'DRIVE THIS CAR'}
                </button>
              ) : currentCarConfig.price === 0 ? (
                <button
                  onClick={handleBuyCar}
                  className="w-full py-3.5 rounded-xl font-bold font-['Chakra_Petch'] text-sm tracking-wider flex items-center justify-center gap-2 transition-all bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-lg shadow-emerald-500/20 active:scale-[0.99]"
                >
                  <Check className="w-4 h-4" />
                  CLAIM & EQUIP FOR FREE
                </button>
              ) : (
                <button
                  onClick={handleBuyCar}
                  disabled={!canAfford}
                  className={`w-full py-3.5 rounded-xl font-bold font-['Chakra_Petch'] text-sm tracking-wider flex items-center justify-center gap-2 transition-all ${
                    canAfford
                      ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-lg shadow-amber-500/20 active:scale-[0.99]'
                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                  }`}
                >
                  <Coins className="w-4 h-4" />
                  {canAfford
                    ? `UNLOCK FOR ${currentCarConfig.price.toLocaleString()} COINS`
                    : `NEED ${(currentCarConfig.price - profile.coins).toLocaleString()} MORE COINS`}
                </button>
              )}

              <p className="text-[11px] text-neutral-500 text-center">
                Coins are earned exclusively through driving skill (apex mastery, drifts, overtakes, clean sectors).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
