import React, { useState, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { useDeckStore } from '../../store/deckStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useUiStore } from '../../store/uiStore'
import { useAppPrefsStore } from '../../store/appPrefsStore'
import { useLayoutEngine } from '../../hooks/useLayoutEngine'
import { CardListItem } from './CardListItem'

export function CardList(): React.ReactElement {
  const cards = useDeckStore((s) => s.cards)
  const clearAll = useDeckStore((s) => s.clearAll)
  const reorderCards = useDeckStore((s) => s.reorderCards)
  const { settings } = useSettingsStore()
  const { confirmClearAll } = useAppPrefsStore()
  const { setPreviewPage, setHoveredCardId } = useUiStore()

  const [collapsedPages, setCollapsedPages] = useState<Set<number>>(new Set())
  const [confirmingClear, setConfirmingClear] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const layout = useLayoutEngine(cards, settings)
  const { pages } = layout

  const isDuplex = settings.duplex !== 'none'
  const sheetLabel = isDuplex ? 'Sheet' : 'Page'

  // Memoize all layout-derived maps so CardListItem children only re-render
  // when pages/cards actually change, not on every parent render.
  const { cardPageJumps, groups } = useMemo(() => {
    const jumps = new Map<string, { label: string; pageIndex: number }[]>()
    const seenCardSheets = new Map<string, Set<number>>()

    pages.forEach((page) => {
      const sheetNum = isDuplex ? Math.floor(page.pageIndex / 2) + 1 : page.pageIndex + 1
      const frontPageIndex = isDuplex ? (sheetNum - 1) * 2 : page.pageIndex
      page.slots.forEach((slot) => {
        if (!slot.printCardId || slot.isEmpty) return
        const id = slot.printCardId
        if (!seenCardSheets.has(id)) seenCardSheets.set(id, new Set())
        if (seenCardSheets.get(id)!.has(sheetNum)) return
        seenCardSheets.get(id)!.add(sheetNum)
        if (!jumps.has(id)) jumps.set(id, [])
        jumps.get(id)!.push({ label: `${sheetLabel} ${sheetNum}`, pageIndex: frontPageIndex })
      })
    })

    const cardFirstFrontPage = new Map<string, number>()
    pages.forEach((page) => {
      if (!page.isFrontPage) return
      page.slots.forEach((slot) => {
        if (!slot.printCardId || slot.isEmpty) return
        if (!cardFirstFrontPage.has(slot.printCardId)) {
          cardFirstFrontPage.set(slot.printCardId, page.pageIndex)
        }
      })
    })

    const frontPages = pages.filter((p) => p.isFrontPage)
    const grps: { pageIndex: number; sheetNum: number; cards: typeof cards }[] = []
    const seenPages = new Set<number>()

    cards.forEach((card) => {
      const firstPage = cardFirstFrontPage.get(card.id)
      if (firstPage === undefined) return
      if (!seenPages.has(firstPage)) {
        seenPages.add(firstPage)
        const sheetNum = frontPages.findIndex((p) => p.pageIndex === firstPage) + 1
        grps.push({ pageIndex: firstPage, sheetNum, cards: [] })
      }
      grps.find((g) => g.pageIndex === firstPage)!.cards.push(card)
    })

    return { cardPageJumps: jumps, groups: grps }
  }, [pages, cards, isDuplex, sheetLabel])

  const toggleCollapse = (pageIndex: number) => {
    setCollapsedPages((prev) => {
      const next = new Set(prev)
      if (next.has(pageIndex)) next.delete(pageIndex)
      else next.add(pageIndex)
      return next
    })
  }

  const total = cards.reduce((sum, c) => sum + c.quantity, 0)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {cards.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center">
          <span className="text-ink/8 text-4xl select-none">⊟</span>
          <p className="text-ink/20 text-xs leading-relaxed max-w-[180px]">
            Search for cards or add local images to build your print list.
          </p>
        </div>
      ) : (
      <>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-surface-border flex-shrink-0 bg-surface-card">
        <div className="flex items-center gap-2">
          <span className="text-ink/35 text-xs font-medium">{cards.length} card{cards.length !== 1 ? 's' : ''}</span>
          <span className="w-px h-3 bg-surface-border" />
          <span className="text-ink/20 text-xs">{total} slots</span>
        </div>
        {confirmingClear ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { clearAll(); setConfirmingClear(false) }}
              className="text-xs text-red-400 hover:text-red-300 border border-red-700/40 rounded px-1.5 py-0.5 transition-colors"
            >
              Clear all
            </button>
            <button
              onClick={() => setConfirmingClear(false)}
              className="text-xs text-ink/30 hover:text-ink/60 transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => confirmClearAll ? setConfirmingClear(true) : clearAll()}
            className="text-ink/20 hover:text-red-400 text-xs transition-colors px-1 py-0.5 rounded hover:bg-red-400/8"
          >
            Clear all
          </button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {groups.length > 0 ? groups.map((group) => {
              const isCollapsed = collapsedPages.has(group.pageIndex)
              const slotCount = group.cards.reduce((sum, c) => sum + c.quantity, 0)
              return (
                <div key={group.pageIndex}>
                  {/* Sheet group header */}
                  <div className="flex items-center gap-1 mb-1 mt-0.5 px-1">
                    <button
                      onClick={() => toggleCollapse(group.pageIndex)}
                      className="flex items-center gap-1.5 flex-1 text-left"
                    >
                      <span className="text-ink/20 text-xs leading-none">{isCollapsed ? '▸' : '▾'}</span>
                      <span className="text-ink/35 text-xs font-medium">{sheetLabel} {group.sheetNum}</span>
                      <span className="text-ink/15 text-xs">{slotCount} slot{slotCount !== 1 ? 's' : ''}</span>
                    </button>
                    <button
                      onClick={() => setPreviewPage(group.pageIndex)}
                      title={`Jump to ${sheetLabel.toLowerCase()} ${group.sheetNum}`}
                      className="text-ink/15 hover:text-accent/60 text-xs px-1 py-0.5 rounded hover:bg-surface-elevated transition-colors"
                    >→</button>
                  </div>

                  {/* Cards in this group */}
                  {!isCollapsed && (
                    <div className="space-y-1.5">
                      {group.cards.map((card) => (
                        <CardListItem
                          key={card.id}
                          card={card}
                          pageJumps={cardPageJumps.get(card.id) ?? []}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            }) : (
              // Flat list fallback if layout hasn't computed groups yet
              cards.map((card) => (
                <CardListItem
                  key={card.id}
                  card={card}
                  pageJumps={cardPageJumps.get(card.id) ?? []}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>
      </>
      )}
    </div>
  )

  function handleDragStart(_event: DragStartEvent) {
    setHoveredCardId(null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = cards.findIndex((c) => c.id === active.id)
    const newIndex = cards.findIndex((c) => c.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) reorderCards(oldIndex, newIndex)
  }
}
