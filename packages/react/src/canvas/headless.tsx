import { createElement, RenderCanvas, SyntheticEventManager, PlatformAdapter, BridgeEventBinding } from '@canvas-ui/core'
import { ReactNode, useLayoutEffect, useState, useRef } from 'react'
import { useBinding } from './binding'

export type InjectEventFn = (
  type: 'pointermove' | 'pointerdown' | 'pointerup' | 'pointerover' | 'pointerleave',
  x: number,
  y: number,
  button?: number,
  pointerId?: number
) => void

export type InjectWheelEventFn = (
  x: number,
  y: number,
  deltaX: number,
  deltaY: number,
  deltaMode?: number
) => void

export interface HeadlessCanvasProps {
  canvas: OffscreenCanvas  // Required - user provides
  width: number
  height: number
  dpr?: number
  children: ReactNode
  onReady?: (api: {
    canvas: OffscreenCanvas
    injectEvent: InjectEventFn
    injectWheelEvent: InjectWheelEventFn
    renderCanvas: RenderCanvas
  }) => void
}

/**
 * Headless Canvas UI component that renders to OffscreenCanvas
 *
 * Unlike <Canvas>, this:
 * - Doesn't mount to DOM
 * - Accepts an OffscreenCanvas from the user
 * - Provides event injection API via onReady callback
 * - Designed for WebXR layers, workers, or manual rendering
 *
 * @example
 * ```tsx
 * const canvas = useMemo(() => new OffscreenCanvas(900, 600), [])
 *
 * <HeadlessCanvas
 *   canvas={canvas}
 *   width={900}
 *   height={600}
 *   onReady={({ injectEvent }) => {
 *     // Use injectEvent for XR pointer events
 *   }}
 * >
 *   <YourUI />
 * </HeadlessCanvas>
 * ```
 */
export function HeadlessCanvas({
  canvas,
  width,
  height,
  dpr = 1,
  children,
  onReady
}: HeadlessCanvasProps) {
  const onReadyCalledRef = useRef(false)

  // Initialize RenderCanvas and BridgeEventBinding once using useState
  const [instances] = useState(() => {
    // Create RenderCanvas with the user-provided OffscreenCanvas
    const renderCanvas = createElement('Canvas', canvas)
    renderCanvas.prepareInitialFrame()
    renderCanvas.dpr = dpr
    renderCanvas.size = { width, height }

    // Create BridgeEventBinding for programmatic event injection
    const bridgeBinding = new BridgeEventBinding()

    // Wire to SyntheticEventManager
    const eventManager = SyntheticEventManager.findInstance(renderCanvas as any)
    if (eventManager) {
      eventManager.binding = bridgeBinding

      // Set onEvents callback to schedule frame (same as DOMEventBinding)
      bridgeBinding.onEvents = () => {
        PlatformAdapter.scheduleFrame()
      }
    } else {
      console.error('[HeadlessCanvas] No SyntheticEventManager found!')
    }

    // Create injectEvent helper function
    const injectEvent: InjectEventFn = (type, x, y, button = 0, pointerId = 0) => {
      bridgeBinding.injectPointerEvent(type, x, y, button, pointerId)
    }

    // Create injectWheelEvent helper function
    const injectWheelEvent: InjectWheelEventFn = (x, y, deltaX, deltaY, deltaMode = 0) => {
      bridgeBinding.injectWheelEvent(x, y, deltaX, deltaY, deltaMode)
    }

    return { renderCanvas, injectEvent, injectWheelEvent }
  })

  const { renderCanvas, injectEvent, injectWheelEvent } = instances
  const binding = renderCanvas

  // Update size and dpr if changed
  useLayoutEffect(() => {
    canvas.width = width * dpr
    canvas.height = height * dpr
    binding.dpr = dpr
    binding.size = { width, height }
  }, [binding, canvas, width, height, dpr])

  // Call onReady when ready
  useLayoutEffect(() => {
    if (onReady && !onReadyCalledRef.current) {
      onReady({ canvas, injectEvent, injectWheelEvent, renderCanvas })
      onReadyCalledRef.current = true
    }
  }, [onReady, canvas, injectEvent, injectWheelEvent, renderCanvas])

  // Use Canvas UI's binding hook for React reconciliation
  useBinding({
    binding,
    left: 0,
    top: 0,
    width,
    height,
    children
  })

  // Headless - returns null
  return null
}
