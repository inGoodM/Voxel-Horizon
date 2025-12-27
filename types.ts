export enum CameraMode {
  FIRST_PERSON = 'FIRST_PERSON',
  THIRD_PERSON = 'THIRD_PERSON'
}

export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  LEAVES = 4,
  WOOD = 5
}

export interface WorldData {
  // Map key is "x,y,z", value is BlockType
  blocks: Map<string, BlockType>;
}

export interface ControlsState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  place: boolean;
  destroy: boolean;
}