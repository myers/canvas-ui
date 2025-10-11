import { assert } from '@canvas-ui/assert'
import { LayerTree, Rasterizer, TransformLayer } from '../compositing'
import {
  DOMEventBinding,
  HitTestRoot,
  SyntheticEvent,
  SyntheticEventManager,
  SyntheticPointerEvent
} from '../events'
import { Matrix, MutableMatrix, Point, Size } from '../math'
import type { CrossPlatformCanvasElement, IPlatformAdapter } from '../platform'
import { PlatformAdapter } from '../platform'
import { Surface } from '../surface'
import { HitTestEntry, HitTestResult } from './hit-test'
import { PaintingContext } from './painting-context'
import { RenderObject } from './render-object'
import { RenderPipeline } from './render-pipeline'
import { RenderSingleChild } from './render-single-child'

/**
 * 渲染树的根节点，负责各类初始化和渲染管线工作
 * 
 * RenderCanvas 持有唯一子节点 RenderObject
 */
export class RenderCanvas
  extends RenderSingleChild<RenderObject>
  implements HitTestRoot {

  private pipeline: RenderPipeline

  private readonly eventManager: SyntheticEventManager

  private clearOnFrame: () => void

  private nativeEventBinding: DOMEventBinding

  private platformAdapter: IPlatformAdapter

  private handleRequestVisualUpdate = () => {
    this.frameDirty = true
    this.platformAdapter.scheduleFrame()
  }

  private frameDirty = false
  private _offscreenCanvas?: OffscreenCanvas

  constructor(canvas?: HTMLCanvasElement | OffscreenCanvas, platformAdapter?: IPlatformAdapter) {
    super()

    // Store platform adapter (use provided or default to global)
    this.platformAdapter = platformAdapter ?? PlatformAdapter

    // Store the canvas based on its type
    if (canvas) {
      if (canvas instanceof OffscreenCanvas) {
        // OffscreenCanvas
        this._offscreenCanvas = canvas
      } else {
        // Assume HTMLCanvasElement (default)
        this._el = canvas as HTMLCanvasElement
      }
    }
    // If no canvas provided, el will be set later via the el setter (DOM flow)
    this.pipeline = new RenderPipeline(this.handleRequestVisualUpdate)
    this.pipeline.rootNode = this
    const clearHandleEvents = this.platformAdapter.onFrame(this.handleNativeEvents)
    const clearDrawFrame = this.platformAdapter.onFrame(this.drawFrame)
    this.clearOnFrame = () => {
      clearHandleEvents()
      clearDrawFrame()
    }
    this.nativeEventBinding = new DOMEventBinding()
    this.nativeEventBinding.onEvents = () => {
      this.platformAdapter.scheduleFrame()
    }
    this.eventManager = new SyntheticEventManager()
    this.eventManager.rootNode = this
    this.eventManager.binding = this.nativeEventBinding

    this.addEventListener('pointerover', this.handlePointerOver)
  }

  private handlePointerOver = (event: SyntheticPointerEvent<RenderObject>) => {
    assert(event.target)
    if (!this._el) {
      return
    }
    for (let i = 0; i < event.path.length; i++) {
      const cursor = event.path[i].style.cursor
      if (cursor) {
        this._el.style.cursor = cursor
        return
      }
    }
    this._el.style.cursor = ''
  }

  get dpr() {
    return this._dpr
  }
  set dpr(value) {
    if (value === this._dpr) {
      return
    }
    this._dpr = value
    this.replaceRootLayer(this.updateMatricesAndCreateNewRootLayer())
  }
  private _dpr = 1

  private get rasterizer() {
    if (!this.surface) {
      return undefined
    }
    return this._rasterizer ??= new Rasterizer({
      surface: this.surface,
    })
  }
  private _rasterizer?: Rasterizer

  private get surface() {
    if (this._surface) {
      return this._surface
    }

    // OffscreenCanvas path
    if (this._offscreenCanvas) {
      return this._surface = Surface.makeOffscreenCanvasSurface({
        canvas: this._offscreenCanvas
      })
    }

    // DOM canvas path (default behavior)
    if (!this.el) {
      return undefined
    }
    return this._surface = Surface.makeCanvasSurface({ el: this.el })
  }
  private _surface?: Surface

  get el() {
    return this._el
  }
  set el(value) {
    if (value === this._el) {
      return
    }

    // el 变更时，要清理相关成员
    this._el = value
    this.nativeEventBinding.el = value
    this._surface = undefined
    this._rasterizer = undefined

    // 然后标记
    this.markLayoutDirty()
    this.markPaintDirty()
  }
  private _el?: CrossPlatformCanvasElement

  drawFrame = () => {
    // enterFrame 不受 frameDirty 控制
    this.pipeline.flushEnterFrame()

    if (!this.frameDirty) {
      return
    }

    // Clear the dirty flag BEFORE running the pipeline
    // This is the standard dirty flag pattern - if anything marks dirty during
    // the pipeline (e.g. React component updates), it will stay dirty for the next frame
    this.frameDirty = false

    this.pipeline.flushLayout()
    this.pipeline.flushNeedsCompositing()
    this.pipeline.flushPaint()

    this.composeFrame()
    this.dispatchFrameEnd()
  }

  private composeFrame() {
    const {
      rasterizer,
      _layer: rootLayer
    } = this

    // 没有 rasterizer 则跳过合成阶段
    if (!rasterizer) {
      return
    }
    assert(rootLayer)
    const layerTree = new LayerTree({
      rootLayer
    })

    rasterizer.draw(layerTree, Size.scale(this._size, this._dpr))
  }

  _rootTransform?: Matrix

  private updateMatricesAndCreateNewRootLayer() {
    this._rootTransform = Matrix.fromScale(this.dpr)
    const rootLayer = new TransformLayer(this._rootTransform)
    rootLayer.attach(this)
    assert(this._rootTransform)
    return rootLayer
  }

  prepareInitialFrame() {
    assert(this._owner)
    assert(!this._rootTransform)
    this.scheduleInitialLayout()
    this.scheduleInitialPaint(this.updateMatricesAndCreateNewRootLayer())
    assert(this._rootTransform)
    this._owner.requestVisualUpdate()
  }

  dispose() {
    this.pipeline.rootNode = undefined
    this.clearOnFrame()
    this.el = undefined
  }

  override get repaintBoundary() {
    return true
  }
  override _repaintBoundaryLocked = true

  override applyPaintTransform(child: RenderObject, transform: MutableMatrix) {
    assert(this._rootTransform)
    transform.mul(this._rootTransform)
    super.applyPaintTransform(child, transform)
  }

  override hitTest(result: HitTestResult, position: Point): boolean {
    this.hitTestChildren(result, position)
    result.add(new HitTestEntry(this, position))
    return true
  }

  private handleNativeEvents = () => {
    this.eventManager.flushNativeEvents()
  }

  hitTestFromRoot(position: Point): HitTestResult {
    const result = new HitTestResult()
    this.hitTest(result, position)
    return result
  }

  override paint(context: PaintingContext, offset: Point) {
    super.paint(context, offset)
    context.setWillChange()
  }

  private dispatchFrameEnd() {
    if (!this._dispatcher) {
      return
    }
    const event = new SyntheticEvent('frameEnd', {
      bubbles: false,
      cancelable: false,
    })
    this.dispatchEvent(event)
  }

}
