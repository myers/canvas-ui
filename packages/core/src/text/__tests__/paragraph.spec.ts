import { ParagraphStyle } from '..'

describe('ParagraphStyle', () => {

  describe('computedStyle', () => {
    it('defaults', () => {
      const style = new ParagraphStyle()
      expect(style.computedStyle).toEqual({
        font: 'normal normal normal 16px Helvetica Neue,Arial,PingFang SC,Microsoft Yahei,Hiragino Sans GB,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji',
        lineHeight: 19.2,  // 16 * 1.2
        color: '#000',
        maxLines: 0,
        textOverflow: '…',
        textAlign: 'left',
      })
    })

    it('font', () => {
      const style = new ParagraphStyle()
      style.font = 'italic 300 12px "FB Armada"'
      const computed = style.computedStyle
      expect(computed.font).toBe('italic normal 300 12px "FB Armada"')
      expect(computed.lineHeight).toBeCloseTo(14.4)  // 12 * 1.2
      expect(computed.color).toBe('#000')
      expect(computed.maxLines).toBe(0)
      expect(computed.textOverflow).toBe('…')
      expect(computed.textAlign).toBe('left')
    })

    it('fontSize', () => {
      const style = new ParagraphStyle()
      style.fontSize = 14
      expect(style.computedStyle).toEqual({
        font: 'normal normal normal 14px Helvetica Neue,Arial,PingFang SC,Microsoft Yahei,Hiragino Sans GB,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji',
        lineHeight: 16.8,  // 14 * 1.2
        color: '#000',
        maxLines: 0,
        textOverflow: '…',
        textAlign: 'left',
      })
    })

    it('fontFamily', () => {
      const style = new ParagraphStyle()
      style.fontFamily = 'Arial'
      expect(style.computedStyle).toEqual({
        font: 'normal normal normal 16px Arial',
        lineHeight: 19.2,  // 16 * 1.2
        color: '#000',
        maxLines: 0,
        textOverflow: '…',
        textAlign: 'left',
      })
    })

    it('unitless line-height acts as multiplier', () => {
      const style = new ParagraphStyle()
      style.font = '16px/1.5 Arial'
      const computed = style.computedStyle
      expect(computed.lineHeight).toBe(24)  // 16 * 1.5 = 24
    })

    it('unit-based line-height is absolute', () => {
      const style = new ParagraphStyle()
      style.font = '16px/30px Arial'
      const computed = style.computedStyle
      expect(computed.lineHeight).toBe(30)
    })

    it('explicit lineHeight property', () => {
      const style = new ParagraphStyle()
      style.fontSize = 16
      style.lineHeight = 32
      const computed = style.computedStyle
      expect(computed.lineHeight).toBe(32)
    })
  })
})

describe('Paragraph', () => {
  describe('layout', () => {
    //
  })
})
