import { BlockType } from './types';

// Colors based on requirements
export const BLOCK_COLORS: Record<BlockType, string> = {
  [BlockType.AIR]: 'transparent',
  [BlockType.GRASS]: '#4ade80', // green-400
  [BlockType.DIRT]: '#854d0e', // yellow-800 (brownish)
  [BlockType.STONE]: '#9ca3af', // gray-400
  [BlockType.LEAVES]: '#14532d', // green-900
  [BlockType.WOOD]: '#78350f', // amber-900
};

export const WORLD_SIZE = 30; // Radius of world generation
export const CHUNK_HEIGHT = 16;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_SPEED = 5;
export const JUMP_FORCE = 0.4;
export const GRAVITY = 0.02; // As per requirements
export const REACH_DISTANCE = 5;
