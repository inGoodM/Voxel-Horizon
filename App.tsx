import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, PointerLockControls, Environment } from '@react-three/drei';
import { BlockType, CameraMode, WorldData, ControlsState } from './types';
import { generateWorld } from './components/VoxelWorld';
import VoxelWorld from './components/VoxelWorld';
import Player from './components/Player';
import Joystick from './components/Joystick';
import { BLOCK_COLORS } from './constants'; // Import colors for hotbar
import * as THREE from 'three';

// Начальная позиция (Start Position)
const INITIAL_POS: [number, number, number] = [0, 10, 0];

export default function App() {
  const [inGame, setInGame] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>(CameraMode.FIRST_PERSON);
  const [worldSeed, setWorldSeed] = useState(1);
  const [worldKey, setWorldKey] = useState(0); 
  
  // Поднимаем состояние выбранного блока в App для связи с UI
  const [activeBlock, setActiveBlock] = useState<BlockType>(BlockType.DIRT);

  // Refs for Game Loop
  const worldData = useRef<WorldData>({ blocks: generateWorld(1, 30) });
  
  const controls = useRef<ControlsState>({
    forward: false, backward: false, left: false, right: false,
    jump: false, place: false, destroy: false
  });

  // --- Обработка ввода (Keyboard) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': controls.current.forward = true; break;
        case 'KeyS': controls.current.backward = true; break;
        case 'KeyA': controls.current.left = true; break;
        case 'KeyD': controls.current.right = true; break;
        case 'Space': controls.current.jump = true; break;
        case 'KeyV': setCameraMode(prev => prev === CameraMode.FIRST_PERSON ? CameraMode.THIRD_PERSON : CameraMode.FIRST_PERSON); break;
        case 'KeyR': setShowMenu(true); document.exitPointerLock(); break;
        // Hotkeys for blocks 1-5
        case 'Digit1': setActiveBlock(BlockType.GRASS); break;
        case 'Digit2': setActiveBlock(BlockType.DIRT); break;
        case 'Digit3': setActiveBlock(BlockType.STONE); break;
        case 'Digit4': setActiveBlock(BlockType.LEAVES); break;
        case 'Digit5': setActiveBlock(BlockType.WOOD); break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': controls.current.forward = false; break;
        case 'KeyS': controls.current.backward = false; break;
        case 'KeyA': controls.current.left = false; break;
        case 'KeyD': controls.current.right = false; break;
        case 'Space': controls.current.jump = false; break;
      }
    };
    const handleMouseDown = (e: MouseEvent) => {
       if(!inGame) return;
       if(e.button === 0) controls.current.destroy = true; // ЛКМ - сломать
       if(e.button === 2) controls.current.place = true;   // ПКМ - поставить
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);

    // Событие обновления мира
    const onWorldUpdate = () => setWorldKey(k => k + 1);
    window.addEventListener('world-update', onWorldUpdate);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('world-update', onWorldUpdate);
    };
  }, [inGame]);

  const handleRespawn = () => {
    setShowMenu(true);
    document.exitPointerLock();
  };

  // "Начать сначала"
  const restartSameSeed = () => {
    // Регенерируем мир из того же зерна, очищая изменения игрока
    worldData.current.blocks = generateWorld(worldSeed, 30);
    setWorldKey(k => k + 1);
    setShowMenu(false);
    setResetCounter(c => c + 1);
  };
  const [resetCounter, setResetCounter] = useState(0);

  // "Новая локация"
  const newLocation = () => {
    const newSeed = Math.random() * 10000;
    setWorldSeed(newSeed);
    worldData.current.blocks = generateWorld(newSeed, 30);
    setWorldKey(k => k + 1);
    setResetCounter(c => c + 1);
    setShowMenu(false);
  };

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Компонент Хотбара (Панель выбора блоков)
  const Hotbar = () => (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-3 p-3 bg-black/40 rounded-2xl backdrop-blur-md border border-white/10 z-50 pointer-events-auto">
      {[BlockType.GRASS, BlockType.DIRT, BlockType.STONE, BlockType.LEAVES, BlockType.WOOD].map((type) => (
        <button
          key={type}
          onClick={() => setActiveBlock(type)}
          onTouchStart={(e) => { e.preventDefault(); setActiveBlock(type); }}
          className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg border-2 transition-all duration-150 ${
            activeBlock === type 
              ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.5)]' 
              : 'border-white/20 opacity-80 hover:opacity-100 hover:scale-105'
          }`}
          style={{ backgroundColor: BLOCK_COLORS[type] }}
        />
      ))}
    </div>
  );

  return (
    <div className="relative w-full h-full bg-slate-900 overflow-hidden font-mono select-none touch-none">
      {/* 3D Сцена */}
      <Canvas shadows camera={{ fov: 75 }}>
        <Suspense fallback={null}>
            <Sky sunPosition={[100, 20, 100]} />
            <ambientLight intensity={0.4} />
            {/* Усиленный направленный свет для теней */}
            <directionalLight 
              position={[10, 20, 10]} 
              intensity={1.5} 
              castShadow 
              shadow-mapSize={[1024, 1024]}
            />
            
            <VoxelWorld key={worldKey} worldData={worldData} />

            {!showMenu && (
                <Player 
                    key={`${worldSeed}-${resetCounter}`} // Force remount on reset
                    position={INITIAL_POS}
                    worldData={worldData}
                    controls={controls}
                    cameraMode={cameraMode}
                    activeBlock={activeBlock}
                    onRespawnNeeded={handleRespawn}
                />
            )}
            
            {!isMobile && <PointerLockControls 
              onLock={() => setInGame(true)} 
              onUnlock={() => setInGame(false)} 
            />}
        </Suspense>
      </Canvas>

      {/* --- UI (Интерфейс) --- */}

      {/* Прицел (Только в игре) */}
      {!showMenu && inGame && (
        <div className="absolute top-1/2 left-1/2 w-4 h-4 -mt-2 -ml-2 pointer-events-none mix-blend-difference z-30">
           <div className="w-full h-0.5 bg-white absolute top-1/2"></div>
           <div className="h-full w-0.5 bg-white absolute left-1/2"></div>
        </div>
      )}

      {/* Хотбар (виден всегда в игре) */}
      {!showMenu && <Hotbar />}

      {/* Экран паузы (Desktop) */}
      {!inGame && !showMenu && !isMobile && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white pointer-events-none z-50">
          <p className="text-2xl bg-black/70 p-4 rounded">Кликните, чтобы играть</p>
        </div>
      )}

      {/* Мобильное управление (Touch Controls) */}
      {isMobile && !showMenu && (
        <div id="mobile-ui" className="fixed inset-0 pointer-events-none z-40 touch-none">
            {/* Меню Кнопка */}
            <div className="absolute top-4 right-4 pointer-events-auto">
                <button 
                  onClick={() => setShowMenu(true)}
                  className="w-10 h-10 flex items-center justify-center bg-black/40 rounded-full text-white backdrop-blur-sm border border-white/20 active:bg-red-500/80"
                >
                    ☰
                </button>
            </div>

            {/* Левая зона: Джойстик */}
            <div className="absolute bottom-8 left-8 pointer-events-auto">
                <Joystick onMove={(x, y) => {
                    controls.current.right = x > 0.2;
                    controls.current.left = x < -0.2;
                    controls.current.backward = y > 0.2;
                    controls.current.forward = y < -0.2;
                }} />
            </div>

            {/* Правая зона: Кнопки действий */}
            <div className="absolute bottom-8 right-8 flex flex-col items-end gap-6 pointer-events-auto">
                
                {/* CAM Button (V) */}
                <button 
                    className="w-12 h-12 bg-black/30 rounded-full text-white backdrop-blur-sm border border-white/20 active:bg-white/40 font-bold text-xs"
                    onTouchStart={(e) => { e.preventDefault(); setCameraMode(prev => prev === CameraMode.FIRST_PERSON ? CameraMode.THIRD_PERSON : CameraMode.FIRST_PERSON); }}
                >
                    CAM
                </button>

                {/* Actions Group */}
                <div className="flex items-end gap-4">
                    {/* Action Buttons (Dig/Place) */}
                    <div className="flex flex-col gap-4">
                         <button 
                            className="w-14 h-14 bg-red-500/40 rounded-full text-white backdrop-blur-sm border border-white/20 active:bg-red-500/80 flex items-center justify-center font-bold text-[10px]"
                            onTouchStart={(e) => { e.preventDefault(); controls.current.destroy = true; }}
                            onTouchEnd={(e) => { e.preventDefault(); controls.current.destroy = false; }}
                        >
                            DIG
                        </button>
                        <button 
                            className="w-14 h-14 bg-green-500/40 rounded-full text-white backdrop-blur-sm border border-white/20 active:bg-green-500/80 flex items-center justify-center font-bold text-[10px]"
                            onTouchStart={(e) => { e.preventDefault(); controls.current.place = true; }}
                            onTouchEnd={(e) => { e.preventDefault(); controls.current.place = false; }}
                        >
                            BUILD
                        </button>
                    </div>

                    {/* JUMP Button (Larger) */}
                    <button 
                        className="w-20 h-20 bg-blue-500/40 rounded-full text-white backdrop-blur-sm border-2 border-white/20 active:bg-blue-500/80 active:scale-95 transition-transform flex items-center justify-center font-bold tracking-wider shadow-lg"
                        onTouchStart={(e) => { e.preventDefault(); controls.current.jump = true; }}
                        onTouchEnd={(e) => { e.preventDefault(); controls.current.jump = false; }}
                    >
                        JUMP
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Меню (Menu) */}
      {showMenu && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
           <div className="bg-slate-800 p-8 rounded-xl border border-slate-600 shadow-2xl max-w-sm w-full text-center">
              <h2 className="text-3xl font-bold text-white mb-6">VOXEL HORIZON</h2>
              <div className="space-y-4">
                  <button 
                    onClick={newLocation}
                    className="w-full py-3 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-bold hover:scale-105 transition transform"
                  >
                    Новая локация
                  </button>
                  <button 
                    onClick={restartSameSeed}
                    className="w-full py-3 px-6 bg-slate-700 text-white rounded-lg font-bold hover:bg-slate-600 transition"
                  >
                    Начать сначала
                  </button>
                  <button 
                    onClick={() => { setShowMenu(false); if(!isMobile) { const cvs = document.querySelector('canvas'); cvs?.requestPointerLock(); }}}
                    className="w-full py-2 px-6 text-slate-400 hover:text-white transition"
                  >
                    Продолжить
                  </button>
              </div>
           </div>
        </div>
      )}
      
      {!isMobile && !showMenu && (
        <div className="absolute bottom-4 left-4 text-white/50 text-xs pointer-events-none">
            WASD: Движение | SPACE: Прыжок | ЛКМ: Ломать | ПКМ: Строить | V: Камера | R: Меню
        </div>
      )}
    </div>
  );
}