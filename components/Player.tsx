import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BlockType, CameraMode, WorldData, ControlsState } from '../types';
import { GRAVITY, REACH_DISTANCE, BLOCK_COLORS, JUMP_FORCE } from '../constants';

interface PlayerProps {
  position: [number, number, number];
  worldData: React.MutableRefObject<WorldData>;
  controls: React.MutableRefObject<ControlsState>;
  cameraMode: CameraMode;
  activeBlock: BlockType; // Получаем выбранный блок из App
  onRespawnNeeded: () => void;
}

// Новая цветовая палитра персонажа
const CHAR_COLORS = {
  skin: '#f5d0a9', // Бежевый
  hair: '#2c1a16', // Темно-коричневый (почти черный)
  body: '#2563eb', // Синий свитер (Blue-600)
  legs: '#1e3a8a', // Темно-синие джинсы (Blue-900)
};

const Player: React.FC<PlayerProps> = ({ position: initialPos, worldData, controls, cameraMode, activeBlock, onRespawnNeeded }) => {
  const { camera } = useThree();
  
  // --- Состояние физики (Physics State) ---
  const position = useRef(new THREE.Vector3(...initialPos));
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const playerGroup = useRef<THREE.Group>(null);
  
  // --- Части тела (Body Parts Refs) ---
  const bodyRef = useRef<THREE.Mesh>(null);
  const headGroupRef = useRef<THREE.Group>(null); 
  const legLGroup = useRef<THREE.Group>(null);
  const legRGroup = useRef<THREE.Group>(null);
  const armLGroup = useRef<THREE.Group>(null);
  const armRGroup = useRef<THREE.Group>(null);

  // Размеры персонажа для коллизий
  const PLAYER_RADIUS = 0.3;
  const PLAYER_HEIGHT = 2.0;

  // --- Генерация текстуры лица (Happy Face) ---
  const faceTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64; 
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        // Фон (кожа)
        ctx.fillStyle = CHAR_COLORS.skin;
        ctx.fillRect(0, 0, 64, 64);
        
        // Глаза (черные квадраты)
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(16, 24, 8, 8); // Левый
        ctx.fillRect(40, 24, 8, 8); // Правый

        // Улыбка (U-образная дуга)
        ctx.beginPath();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#1a1a1a';
        ctx.arc(32, 38, 12, 0.2, Math.PI - 0.2); // Счастливая дуга
        ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter; // Пикселизация
    return tex;
  }, []);

  // --- Система Коллизий (Collision System) ---
  const isSolid = (x: number, y: number, z: number) => {
    return worldData.current.blocks.has(`${x},${y},${z}`);
  };

  // Улучшенная проверка столкновений
  const checkCollision = (pos: THREE.Vector3) => {
    const EPSILON = 0.1; // Порог, чтобы не застревать
    
    // Проверяем несколько точек вокруг персонажа
    const points = [
      { x: pos.x + PLAYER_RADIUS - EPSILON, z: pos.z + PLAYER_RADIUS - EPSILON },
      { x: pos.x - PLAYER_RADIUS + EPSILON, z: pos.z + PLAYER_RADIUS - EPSILON },
      { x: pos.x + PLAYER_RADIUS - EPSILON, z: pos.z - PLAYER_RADIUS + EPSILON },
      { x: pos.x - PLAYER_RADIUS + EPSILON, z: pos.z - PLAYER_RADIUS + EPSILON }
    ];

    for (const p of points) {
      const bx = Math.floor(p.x);
      const bz = Math.floor(p.z);
      
      const feetY = Math.floor(pos.y + 0.1); 
      const torsoY = Math.floor(pos.y + 1.0); 
      const headY = Math.floor(pos.y + PLAYER_HEIGHT - 0.1);

      if (isSolid(bx, feetY, bz) || isSolid(bx, torsoY, bz) || isSolid(bx, headY, bz)) {
         return true; 
      }
    }
    return false;
  };

  // --- Рейкастинг (Raycasting) ---
  const performRaycast = () => {
    const start = position.current.clone().add(new THREE.Vector3(0, 1.9, 0));
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    
    let x = Math.floor(start.x);
    let y = Math.floor(start.y);
    let z = Math.floor(start.z);

    const stepX = Math.sign(dir.x);
    const stepY = Math.sign(dir.y);
    const stepZ = Math.sign(dir.z);

    const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;

    let tMaxX = stepX > 0 ? (Math.floor(start.x) + 1 - start.x) * tDeltaX : (start.x - Math.floor(start.x)) * tDeltaX;
    let tMaxY = stepY > 0 ? (Math.floor(start.y) + 1 - start.y) * tDeltaY : (start.y - Math.floor(start.y)) * tDeltaY;
    let tMaxZ = stepZ > 0 ? (Math.floor(start.z) + 1 - start.z) * tDeltaZ : (start.z - Math.floor(start.z)) * tDeltaZ;

    let hit = null;
    let lastAir = { x, y, z };
    const maxDist = REACH_DISTANCE;
    let dist = 0;

    while (dist < maxDist) {
      if (worldData.current.blocks.has(`${x},${y},${z}`)) {
        hit = { x, y, z };
        break;
      }
      lastAir = { x, y, z };

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX; dist = tMaxX; tMaxX += tDeltaX;
        } else {
          z += stepZ; dist = tMaxZ; tMaxZ += tDeltaZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY; dist = tMaxY; tMaxY += tDeltaY;
        } else {
          z += stepZ; dist = tMaxZ; tMaxZ += tDeltaZ;
        }
      }
    }

    if (controls.current.destroy && hit) {
       worldData.current.blocks.delete(`${hit.x},${hit.y},${hit.z}`);
       window.dispatchEvent(new CustomEvent('world-update'));
       controls.current.destroy = false;
    }

    if (controls.current.place && hit) {
       const px = Math.floor(position.current.x);
       const py = Math.floor(position.current.y);
       const pz = Math.floor(position.current.z);
       const isInsidePlayer = (lastAir.x === px && lastAir.z === pz) && (lastAir.y === py || lastAir.y === py + 1);

       if (!isInsidePlayer) {
          worldData.current.blocks.set(`${lastAir.x},${lastAir.y},${lastAir.z}`, activeBlock);
          window.dispatchEvent(new CustomEvent('world-update'));
       }
       controls.current.place = false;
    }
  };

  useFrame((state, delta) => {
    if (!playerGroup.current) return;

    // 1. Гравитация (Gravity)
    velocity.current.y -= GRAVITY;

    // 2. Движение
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, camera.up).normalize();

    const moveDir = new THREE.Vector3(0,0,0);
    if (controls.current.forward) moveDir.add(forward);
    if (controls.current.backward) moveDir.sub(forward);
    if (controls.current.right) moveDir.add(right);
    if (controls.current.left) moveDir.sub(right);
    
    const speed = 5.0 * delta;
    if (moveDir.lengthSq() > 0) {
        moveDir.normalize().multiplyScalar(speed);
    }

    // 3. Коллизии X
    const nextX = position.current.clone().add(new THREE.Vector3(moveDir.x, 0, 0));
    if (checkCollision(nextX)) {
        velocity.current.x = 0;
    } else {
        position.current.x += moveDir.x;
    }
    
    // 3. Коллизии Z
    const nextZ = position.current.clone().add(new THREE.Vector3(0, 0, moveDir.z));
    if (checkCollision(nextZ)) {
        velocity.current.z = 0;
    } else {
        position.current.z += moveDir.z;
    }

    // 4. Вертикальная физика
    position.current.y += velocity.current.y;

    const feetBlockX = Math.floor(position.current.x);
    const feetBlockY = Math.floor(position.current.y);
    const feetBlockZ = Math.floor(position.current.z);
    
    if (velocity.current.y < 0 && isSolid(feetBlockX, feetBlockY, feetBlockZ)) {
        position.current.y = feetBlockY + 1;
        velocity.current.y = 0;
    }

    // 5. Прыжок
    if (controls.current.jump && Math.abs(velocity.current.y) < 0.001) {
        if (isSolid(feetBlockX, feetBlockY - 1, feetBlockZ) || position.current.y % 1 === 0) {
             velocity.current.y = JUMP_FORCE;
             controls.current.jump = false;
        }
    }

    // 6. Обновление
    if (position.current.y < -20) {
        onRespawnNeeded();
        velocity.current.set(0,0,0);
        return;
    }
    playerGroup.current.position.copy(position.current);
    
    if (moveDir.lengthSq() > 0.0001) {
        const targetRot = Math.atan2(moveDir.x, moveDir.z);
        let rotDiff = targetRot - playerGroup.current.rotation.y;
        while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
        while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
        playerGroup.current.rotation.y += rotDiff * 0.2;
    }

    // 7. Действия
    if (controls.current.place || controls.current.destroy) {
        performRaycast();
    }

    // 8. Анимация
    const isMoving = moveDir.lengthSq() > 0.001;
    if (legLGroup.current && legRGroup.current && armLGroup.current && armRGroup.current) {
        if (isMoving) {
            const t = state.clock.getElapsedTime() * 10;
            legLGroup.current.rotation.x = Math.sin(t) * 0.5;
            legRGroup.current.rotation.x = Math.sin(t + Math.PI) * 0.5;
            armLGroup.current.rotation.x = Math.sin(t + Math.PI) * 0.5;
            if (cameraMode === CameraMode.THIRD_PERSON) {
               armRGroup.current.rotation.x = Math.sin(t) * 0.5;
            }
        } else {
            legLGroup.current.rotation.x = THREE.MathUtils.lerp(legLGroup.current.rotation.x, 0, 0.1);
            legRGroup.current.rotation.x = THREE.MathUtils.lerp(legRGroup.current.rotation.x, 0, 0.1);
            armLGroup.current.rotation.x = THREE.MathUtils.lerp(armLGroup.current.rotation.x, 0, 0.1);
            if (cameraMode === CameraMode.THIRD_PERSON) {
                armRGroup.current.rotation.x = THREE.MathUtils.lerp(armRGroup.current.rotation.x, 0, 0.1);
            }
        }
    }

    // 9. Камера
    if (cameraMode === CameraMode.FIRST_PERSON) {
        const eyeOffset = new THREE.Vector3(0, 1.95, 0);
        camera.position.copy(position.current).add(eyeOffset);
    } else {
        const camDist = 5;
        const targetPos = position.current.clone().add(new THREE.Vector3(0, 2, 0)); 
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        camDir.normalize();
        const desiredPos = targetPos.clone().sub(camDir.multiplyScalar(camDist));
        camera.position.lerp(desiredPos, 0.2);
    }
  });

  return (
    <group ref={playerGroup}>
      {/* 3-е лицо (Полная модель персонажа) */}
      <group visible={cameraMode === CameraMode.THIRD_PERSON}>
        
        {/* Левая нога (Темно-синяя) */}
        <group ref={legLGroup} position={[-0.15, 0.8, 0]}>
            <mesh position={[0, -0.4, 0]}>
                <boxGeometry args={[0.2, 0.8, 0.2]} />
                <meshStandardMaterial color={CHAR_COLORS.legs} flatShading />
            </mesh>
        </group>

        {/* Правая нога (Темно-синяя) */}
        <group ref={legRGroup} position={[0.15, 0.8, 0]}>
            <mesh position={[0, -0.4, 0]}>
                <boxGeometry args={[0.2, 0.8, 0.2]} />
                <meshStandardMaterial color={CHAR_COLORS.legs} flatShading />
            </mesh>
        </group>

        {/* Туловище (Синее) */}
        <mesh ref={bodyRef} position={[0, 1.25, 0]}>
            <boxGeometry args={[0.6, 0.9, 0.3]} />
            <meshStandardMaterial color={CHAR_COLORS.body} flatShading />
        </mesh>

        {/* ГОЛОВА: Сложная геометрия (Группа) */}
        <group ref={headGroupRef} position={[0, 1.95, 0]}>
            {/* 1. Основа головы (Куб с лицом) */}
            <mesh>
                <boxGeometry args={[0.5, 0.5, 0.5]} />
                {/* 
                   Мульти-материал для куба:
                   0: Right, 1: Left, 2: Top, 3: Bottom, 4: Front (+Z), 5: Back
                */}
                <meshStandardMaterial attach="material-0" color={CHAR_COLORS.skin} flatShading />
                <meshStandardMaterial attach="material-1" color={CHAR_COLORS.skin} flatShading />
                <meshStandardMaterial attach="material-2" color={CHAR_COLORS.skin} flatShading />
                <meshStandardMaterial attach="material-3" color={CHAR_COLORS.skin} flatShading />
                <meshStandardMaterial attach="material-4" map={faceTexture} flatShading /> 
                <meshStandardMaterial attach="material-5" color={CHAR_COLORS.skin} flatShading />
            </mesh>

            {/* 2. Прическа (База - верхняя шапка волос) */}
            <mesh position={[0, 0.26, 0]}> 
                <boxGeometry args={[0.52, 0.15, 0.52]} /> 
                <meshStandardMaterial color={CHAR_COLORS.hair} flatShading />
            </mesh>

            {/* 3. Прическа (Помпадур/Челка - сдвинута вперед) */}
            <mesh position={[0, 0.35, 0.15]}> 
                <boxGeometry args={[0.3, 0.15, 0.3]} /> 
                <meshStandardMaterial color={CHAR_COLORS.hair} flatShading />
            </mesh>
        </group>

        {/* Левая рука (Синяя) */}
        <group ref={armLGroup} position={[-0.4, 1.6, 0]}>
            <mesh position={[0, -0.4, 0]}>
                <boxGeometry args={[0.2, 0.8, 0.2]} />
                <meshStandardMaterial color={CHAR_COLORS.body} flatShading />
            </mesh>
            {/* Кисть руки (Бежевая) */}
            <mesh position={[0, -0.7, 0]}>
                <boxGeometry args={[0.18, 0.18, 0.18]} />
                <meshStandardMaterial color={CHAR_COLORS.skin} flatShading />
            </mesh>
        </group>
      </group>

      {/* Правая рука (Видна всегда) */}
      <group ref={armRGroup} 
         position={cameraMode === CameraMode.FIRST_PERSON ? [0.5, 1.5, 0.5] : [0.4, 1.6, 0]}
      >
         <group rotation={cameraMode === CameraMode.FIRST_PERSON ? [Math.PI/4, 0, -Math.PI/6] : [0,0,0]}>
            <mesh position={cameraMode === CameraMode.FIRST_PERSON ? [0,0,0] : [0, -0.4, 0]}>
                <boxGeometry args={[0.2, 0.8, 0.2]} />
                <meshStandardMaterial color={CHAR_COLORS.body} flatShading />
            </mesh>
            {/* Кисть правой руки */}
            <mesh position={cameraMode === CameraMode.FIRST_PERSON ? [0, -0.3, 0] : [0, -0.7, 0]}>
                <boxGeometry args={[0.18, 0.18, 0.18]} />
                <meshStandardMaterial color={CHAR_COLORS.skin} flatShading />
            </mesh>

            {/* Блок в руке */}
            <mesh position={cameraMode === CameraMode.FIRST_PERSON ? [0, -0.5, 0.1] : [0, -0.9, 0.1]} scale={[0.25, 0.25, 0.25]}>
                <boxGeometry />
                <meshStandardMaterial color={BLOCK_COLORS[activeBlock]} flatShading />
            </mesh>
         </group>
      </group>
    </group>
  );
};

export default Player;