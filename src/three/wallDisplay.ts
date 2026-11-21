/**
 * Which walls drop to a low stub so the rooms can be seen into (docs/FLOORPLAN.md). The user picks a
 * mode; the walls button steps through them from the most walls shown to the fewest. The top view
 * lowers every wall and walking keeps them all up, whatever the mode.
 */
export type WallsMode = 'up' | 'near' | 'inner' | 'far' | 'low'

/** Most walls shown first. */
export const WALLS_ORDER: WallsMode[] = ['up', 'near', 'inner', 'far', 'low']

export const WALLS_LABEL: Record<WallsMode, string> = {
  up: '壁：全部',
  near: '壁：手前を低く',
  inner: '壁：外だけ',
  far: '壁：奥だけ',
  low: '壁：低く',
}

export const WALLS_HINT: Record<WallsMode, string> = {
  up: '全部の壁を立てる',
  near: 'カメラ側の外壁だけ低くする（内壁は立てる）',
  inner: '外壁は立てて、内壁だけ低くする',
  far: '奥の外壁だけ立てる（カメラ側の外壁と内壁を低く）',
  low: '全部の壁を低くする',
}

export const nextWallsMode = (m: WallsMode) => WALLS_ORDER[(WALLS_ORDER.indexOf(m) + 1) % WALLS_ORDER.length]

/** Modes that depend on where the camera is (they change as the view turns). */
export const followsCamera = (m: WallsMode) => m === 'near' || m === 'far'

/**
 * Whether a wall is lowered in `mode`. `cameraOutside`: the camera is on the outer side of this
 * (exterior) wall, i.e. the wall stands between the camera and the rooms.
 */
export function wallLowered(mode: WallsMode, exterior: boolean, cameraOutside: boolean): boolean {
  switch (mode) {
    case 'up':
      return false
    case 'low':
      return true
    case 'inner':
      return !exterior
    case 'near':
      return exterior && cameraOutside
    case 'far':
      return !exterior || cameraOutside
  }
}
