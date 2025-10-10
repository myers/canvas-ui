import type { Size } from '../math'
import type { Surface } from './surface'
import type { CrossPlatformCanvasElement, CrossPlatformOffscreenCanvas } from '../platform'

/**
 * Factory interface for creating Surface instances.
 * Allows different rendering contexts (DOM, OffscreenCanvas, WebXR)
 * to control how surfaces are created and managed.
 */
export interface SurfaceFactory {
  /**
   * Create a Surface instance for the given size
   */
  createSurface(size: Size, dpr: number): Surface

  /**
   * Get the underlying canvas element if one exists
   */
  getCanvas?(): CrossPlatformCanvasElement | CrossPlatformOffscreenCanvas | null

  /**
   * Update the size of the surface if supported
   */
  updateSize?(size: Size, dpr: number): void

  /**
   * Clean up any resources
   */
  dispose?(): void
}
