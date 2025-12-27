import React, { useLayoutEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { BlockType, WorldData } from '../types';
import { BLOCK_COLORS } from '../constants';

interface VoxelWorldProps {
  worldData: React.MutableRefObject<WorldData>;
}

// Простая реализация шума для генерации ландшафта (замена simplex-noise)
const pseudoRandom = (x: number, z: number) => {
  const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

const noise = (x: number, z: number) => {
  const floorX = Math.floor(x);
  const floorZ = Math.floor(z);
  
  const s = pseudoRandom(floorX, floorZ);
  const t = pseudoRandom(floorX + 1, floorZ);
  const u = pseudoRandom(floorX, floorZ + 1);
  const v = pseudoRandom(floorX + 1, floorZ + 1);
  
  const fX = x - floorX;
  const fZ = z - floorZ;
  
  const i1 = s + (t - s) * fX;
  const i2 = u + (v - u) * fX;
  return i1 + (i2 - i1) * fZ;
};

export const generateWorld = (seed: number, radius: number): Map<string, BlockType> => {
  const blocks = new Map<string, BlockType>();
  
  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      const n = noise(x * 0.1 + seed, z * 0.1 + seed);
      const height = Math.floor(n * 10) + 2; 

      for (let y = -5; y <= height; y++) {
        let type = BlockType.STONE;
        if (y === height) type = BlockType.GRASS;
        else if (y > height - 3) type = BlockType.DIRT;
        
        blocks.set(`${x},${y},${z}`, type);
      }
    }
  }
  
  for(let x=-1; x<=1; x++) {
    for(let z=-1; z<=1; z++) {
       blocks.set(`${x},10,${z}`, BlockType.GRASS);
    }
  }

  return blocks;
};

const VoxelWorld: React.FC<VoxelWorldProps> = ({ worldData }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  const instances = useMemo(() => {
    const data: { pos: [number, number, number], type: BlockType }[] = [];
    worldData.current.blocks.forEach((type, key) => {
      const [x, y, z] = key.split(',').map(Number);
      data.push({ pos: [x, y, z], type });
    });
    return data;
  }, [worldData.current]);

  // Генерация текстуры с обводкой (Grid/Edges)
  const borderTexture = useMemo(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          // Заливка белым (цвет блока будет умножаться на это)
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 64, 64);
          
          // Обводка (темная рамка)
          ctx.lineWidth = 4;
          ctx.strokeStyle = 'rgba(0,0,0,0.3)'; // Полупрозрачная черная обводка
          ctx.strokeRect(0, 0, 64, 64);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.magFilter = THREE.NearestFilter; // Пиксельный стиль
      tex.minFilter = THREE.NearestFilter;
      return tex;
  }, []);

  // Геометрия с Vertex Colors для AO (Градиент)
  const geometry = useMemo(() => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const count = geo.attributes.position.count;
      const colors = new Float32Array(count * 3);
      const pos = geo.attributes.position;
      
      for(let i = 0; i < count; i++) {
          const y = pos.getY(i);
          // Вершины снизу (-0.5) делаем темнее (0.6), сверху (0.5) - светлее (1.0)
          // Это создает градиент "снизу вверх"
          const intensity = y > 0 ? 1.0 : 0.65; 
          colors[i*3] = intensity;     // R
          colors[i*3+1] = intensity;   // G
          colors[i*3+2] = intensity;   // B
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return geo;
  }, []);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    
    const dummy = new THREE.Object3D();
    let index = 0;

    instances.forEach(({ pos, type }) => {
      dummy.position.set(pos[0], pos[1], pos[2]);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(index, dummy.matrix);
      // Цвет блока
      meshRef.current!.setColorAt(index, new THREE.Color(BLOCK_COLORS[type]));
      index++;
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [instances]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, instances.length]}
      castShadow
      receiveShadow
    >
      {/* 
        vertexColors: true включает использование атрибута 'color' из геометрии для затенения (AO).
        map: borderTexture добавляет рамку (обводку) каждому блоку.
      */}
      <meshStandardMaterial 
        vertexColors={true} 
        map={borderTexture}
        flatShading={true} 
        roughness={0.8}
      />
    </instancedMesh>
  );
};

export default VoxelWorld;