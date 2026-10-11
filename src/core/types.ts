// Core document model for a room design. Everything here is plain data so it
// can be cloned for undo/redo, serialised to localStorage and exported as JSON.

export type Vec3 = [number, number, number];

export type WallId = 'north' | 'south' | 'east' | 'west';

/** How an item is placed in the room. Drives dragging, snapping and collisions. */
export type PlacementKind =
  | 'floor' // stands on the floor, collides with everything solid
  | 'rug' // lies on the floor, only constrained by the walls
  | 'wall' // mounted on a wall, slides along wall planes
  | 'surface' // small decor, sits on furniture tops/shelves or the floor
  | 'ceiling'; // hangs from the ceiling

export interface ItemInstance {
  id: string;
  type: string;
  /**
   * World position for root items. For items with a parentId this is the
   * position in the parent's local frame.
   */
  position: Vec3;
  /** Rotation around Y in radians (local to parent when parented). */
  rotation: number;
  /** Material slot -> material id. */
  materials: Record<string, string>;
  /** Size variant index (see ItemDef.variants). */
  variant?: number;
  /** For wall items: which wall they hang on. */
  wall?: WallId;
  /** For surface items resting on another item. */
  parentId?: string;
  /** For lamps: 0..1.5 brightness multiplier. */
  dimmer?: number;
  /** Optional per-item flags. */
  locked?: boolean;
}

export interface RoomFinishes {
  floor: string;
  walls: Record<WallId, string>;
  ceiling: string;
  trim: string;
  frames: string;
}

export interface CameraBookmark {
  id: string;
  name: string;
  position: Vec3;
  target: Vec3;
  fov: number;
}

export interface DesignDoc {
  version: 1;
  name: string;
  finishes: RoomFinishes;
  items: ItemInstance[];
  bookmarks: CameraBookmark[];
}

export interface EnvironmentState {
  /** Hours 0..24 */
  time: number;
  /** Rotation of the compass relative to the room in degrees. */
  orientation: number;
  lampMode: 'auto' | 'on' | 'off';
  exposure: number;
}

export type CameraMode = 'orbit' | 'plan' | 'walk' | 'cinematic';

export type SnapMode = 'smart' | 'grid' | 'off';

export type Selection =
  | { kind: 'item'; id: string }
  | { kind: 'wall'; wall: WallId }
  | { kind: 'floor' }
  | { kind: 'ceiling' }
  | null;
