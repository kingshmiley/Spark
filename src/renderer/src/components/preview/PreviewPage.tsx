import React, { useMemo } from 'react'
import type { PageLayout, PrintCard, PrintSettings, CardFace } from '../../../../shared/types'
import { mmToCssPx } from '../../utils/units'

interface Props {
  page: PageLayout
  cards: PrintCard[]
  settings: PrintSettings
  scale: number
  paperWidthMm: number
  paperHeightMm: number
  cardSlotWidthMm: number
  cardSlotHeightMm: number
  effectiveMarginLeftMm: number
  effectiveMarginTopMm: number
  highlightCardId?: string | null
}

function resolveImageSrc(
  slot: { printCardId: string | null; face: 'front' | 'back'; isEmpty: boolean },
  cardMap: Map<string, PrintCard>,
  settings: PrintSettings
): string | null {
  if (slot.isEmpty || !slot.printCardId) return null
  const card = cardMap.get(slot.printCardId)
  if (!card) return null

  if (slot.face === 'front') return card.front.dataUrl ?? null

  if (card.back === 'default') return settings.defaultBack.dataUrl ?? null

  return (card.back as CardFace).dataUrl ?? null
}

export function PreviewPage({
  page, cards, settings, scale, paperWidthMm, paperHeightMm, cardSlotWidthMm, cardSlotHeightMm,
  effectiveMarginLeftMm, effectiveMarginTopMm, highlightCardId
}: Props): React.ReactElement {
  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])

  const paperW = mmToCssPx(paperWidthMm) * scale
  const paperH = mmToCssPx(paperHeightMm) * scale
  const slotW  = mmToCssPx(cardSlotWidthMm) * scale
  const slotH  = mmToCssPx(cardSlotHeightMm) * scale
  const gap    = mmToCssPx(settings.cardSpacingMm) * scale
  const marginL = mmToCssPx(effectiveMarginLeftMm) * scale
  const marginT = mmToCssPx(effectiveMarginTopMm) * scale

  const bleedMm = settings.bleed.enabled ? settings.bleed.amountMm : 0
  const bleedPx = mmToCssPx(bleedMm) * scale

  return (
    <div
      style={{
        width: paperW,
        height: paperH,
        backgroundColor: '#1c1c1c',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 16px 64px rgba(0,0,0,0.9), 0 4px 16px rgba(0,0,0,0.6)',
        borderRadius: 3,
        border: '1px solid rgba(255,255,255,0.07)'
      }}
    >
      {page.slots.map((slot, i) => {
        const col = i % page.cols
        const row = Math.floor(i / page.cols)
        const x = marginL + col * (slotW + gap)
        const y = marginT + row * (slotH + gap)

        const imgSrc = resolveImageSrc(slot, cardMap, settings)

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: slotW,
              height: slotH,
              backgroundColor: slot.isEmpty ? 'transparent' : '#000000',
              overflow: 'hidden',
            }}
          >
            {/* Empty slot indicator — dashed outline shows grid structure */}
            {slot.isEmpty && (
              <div style={{
                width: '100%', height: '100%',
                border: '1px dashed rgba(255,255,255,0.07)',
                boxSizing: 'border-box',
                borderRadius: 2
              }} />
            )}

            {/* Card image */}
            {imgSrc && (() => {
              const bleedMethod = settings.bleed.enabled ? (settings.bleed.method ?? 'black') : 'black'
              const isScale = bleedMethod === 'scale' && settings.bleed.enabled
              return (
                <img
                  src={imgSrc}
                  style={{
                    position: 'absolute',
                    left: isScale ? 0 : bleedPx,
                    top: isScale ? 0 : bleedPx,
                    width: isScale ? slotW : slotW - bleedPx * 2,
                    height: isScale ? slotH : slotH - bleedPx * 2,
                    objectFit: 'cover',
                    display: 'block'
                  }}
                  alt=""
                />
              )
            })()}

            {/* Loading placeholder */}
            {!imgSrc && !slot.isEmpty && (
              <div style={{
                position: 'absolute',
                left: bleedPx, top: bleedPx,
                width: slotW - bleedPx * 2, height: slotH - bleedPx * 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#252525', color: 'rgba(255,255,255,0.2)', fontSize: 10
              }}>
                Loading...
              </div>
            )}

            {/* Bleed trim line — marks the cut boundary */}
            {settings.bleed.enabled && settings.showCutLines !== false && !slot.isEmpty && (
              <div style={{
                position: 'absolute',
                left: bleedPx,
                top: bleedPx,
                width: slotW - bleedPx * 2,
                height: slotH - bleedPx * 2,
                border: '1px solid rgba(255,255,255,0.18)',
                pointerEvents: 'none',
                boxSizing: 'border-box'
              }} />
            )}

            {/* Hover highlight */}
            {highlightCardId && slot.printCardId === highlightCardId && !slot.isEmpty && (
              <div style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgb(var(--accent-primary-rgb) / 0.12)',
                border: '2px solid rgb(var(--accent-primary-rgb) / 0.55)',
                boxSizing: 'border-box',
                borderRadius: 1,
                pointerEvents: 'none',
                zIndex: 10
              }} />
            )}
          </div>
        )
      })}

      {/* Cut markers at paper edge */}
      {(settings.cutMarkersV || settings.cutMarkersH) && (() => {
        const tickLen = Math.max(5, 6 * scale)
        const tickW   = Math.max(0.75, scale * 0.75)
        const color   = 'rgba(255,255,255,0.5)'

        const xPos: number[] = []
        const yPos: number[] = []
        for (let c = 0; c < page.cols; c++) {
          xPos.push(marginL + c * (slotW + gap) + bleedPx)
          xPos.push(marginL + c * (slotW + gap) + slotW - bleedPx)
        }
        for (let r = 0; r < page.rows; r++) {
          yPos.push(marginT + r * (slotH + gap) + bleedPx)
          yPos.push(marginT + r * (slotH + gap) + slotH - bleedPx)
        }

        return (
          <>
            {settings.cutMarkersV && xPos.map((x, i) => (
              <React.Fragment key={`cm-x-${i}`}>
                <div style={{ position: 'absolute', left: x - tickW / 2, top: 0, width: tickW, height: tickLen, backgroundColor: color, pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', left: x - tickW / 2, bottom: 0, width: tickW, height: tickLen, backgroundColor: color, pointerEvents: 'none' }} />
              </React.Fragment>
            ))}
            {settings.cutMarkersH && yPos.map((y, i) => (
              <React.Fragment key={`cm-y-${i}`}>
                <div style={{ position: 'absolute', top: y - tickW / 2, left: 0, height: tickW, width: tickLen, backgroundColor: color, pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: y - tickW / 2, right: 0, height: tickW, width: tickLen, backgroundColor: color, pointerEvents: 'none' }} />
              </React.Fragment>
            ))}
          </>
        )
      })()}

      {/* Page label */}
      <div style={{
        position: 'absolute',
        bottom: 4,
        right: 6,
        fontSize: 9,
        color: 'rgba(0,0,0,0.2)',
        fontFamily: 'monospace'
      }}>
        {page.isFrontPage ? 'FRONT' : 'BACK'} · p{page.pageIndex + 1}
      </div>
    </div>
  )
}
