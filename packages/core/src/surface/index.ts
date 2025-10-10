import { NonConstructiable } from '../foundation'
import { CanvasSurface, CanvasSurfaceOptions } from './canvas-surface'
import { OffscreenCanvasSurface, OffscreenCanvasSurfaceOptions } from './offscreen-canvas-surface'
import { Surface as ISurface } from './surface'

export type { OffscreenCanvasSurfaceOptions }
export type { SurfaceFactory } from './surface-factory'

export interface Surface extends ISurface {

}

export class Surface extends NonConstructiable {
  static makeCanvasSurface(options?: CanvasSurfaceOptions): Surface {
    return new CanvasSurface(options)
  }

  static makeOffscreenCanvasSurface(options?: OffscreenCanvasSurfaceOptions): OffscreenCanvasSurface {
    return new OffscreenCanvasSurface(options)
  }
}
