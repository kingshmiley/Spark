import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
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
  const { setPreviewPage, setHoveredCardId, focusedCardId, setFocusedCardId } = useUiStore()

  const [collapsedPages, setCollapsedPages] = useState<Set<number>>(new Set())
  const [confirmingClear, setConfirmingClear] = useState(false)

  // ── Search state ──
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatchIndex, setSearchMatchIndex] = useState(0)
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const itemRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())

  const setItemRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) itemRefsMap.current.set(id, el)
    else itemRefsMap.current.delete(id)
  }, [])

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return cards.filter((c) => c.displayName.toLowerCase().includes(q)).map((c) => c.id)
  }, [cards, searchQuery])

  const activeMatchId = searchMatches[searchMatchIndex] ?? null

  // Reset match index when query changes
  useEffect(() => { setSearchMatchIndex(0) }, [searchQuery])

  // Ctrl+F handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const openSearch = () => {
    setSearchOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }

  const closeSearch = () => {
    setSearchOpen(false)
    setSearchQuery('')
  }

  const goToNextMatch = useCallback(() => {
    if (searchMatches.length === 0) return
    setSearchMatchIndex((i) => (i + 1) % searchMatches.length)
  }, [searchMatches.length])

  const goToPrevMatch = useCallback(() => {
    if (searchMatches.length === 0) return
    setSearchMatchIndex((i) => (i - 1 + searchMatches.length) % searchMatches.length)
  }, [searchMatches.length])

  // Expand group for a card id and schedule scroll
  const focusCard = useCallback((cardId: string, groupList: typeof groups) => {
    const group = groupList.find((g) => g.cards.some((c) => c.id === cardId))
    if (group && collapsedPages.has(group.pageIndex)) {
      setCollapsedPages((prev) => {
        const next = new Set(prev)
        next.delete(group.pageIndex)
        return next
      })
    }
    setPendingScrollId(cardId)
  }, [collapsedPages])

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

  // Scroll to active search match when it changes, and jump preview to that page
  useEffect(() => {
    if (!activeMatchId) return
    focusCard(activeMatchId, groups)
    const jumps = cardPageJumps.get(activeMatchId)
    if (jumps && jumps.length > 0) setPreviewPage(jumps[0].pageIndex)
  }, [activeMatchId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to card focused from preview click
  useEffect(() => {
    if (!focusedCardId) return
    focusCard(focusedCardId, groups)
  }, [focusedCardId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Execute pending scroll after group expansion renders
  useEffect(() => {
    if (!pendingScrollId) return
    const el = itemRefsMap.current.get(pendingScrollId)
    if (!el) return
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    setPendingScrollId(null)
    // Clear focused highlight after a moment
    if (focusedCardId === pendingScrollId) {
      setTimeout(() => setFocusedCardId(null), 1400)
    }
  }, [pendingScrollId, collapsedPages]) // eslint-disable-line react-hooks/exhaustive-deps

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
        <div className="flex items-center gap-1.5">
          <button
            onClick={openSearch}
            title="Search cards (Ctrl+F)"
            className={`w-5 h-5 flex items-center justify-center rounded text-sm transition-colors ${
              searchOpen ? 'text-accent/70' : 'text-ink/20 hover:text-ink/55 hover:bg-surface-elevated'
            }`}
          >⌕</button>
          {confirmingClear ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => { clearAll(); setConfirmingClear(false) }}
                className="text-xs text-red-400 hover:text-red-300 border border-red-700/40 rounded px-1.5 py-0.5 transition-colors"
              >Clear all</button>
              <button
                onClick={() => setConfirmingClear(false)}
                className="text-xs text-ink/30 hover:text-ink/60 transition-colors"
              >✕</button>
            </div>
          ) : (
            <button
              onClick={() => confirmClearAll ? setConfirmingClear(true) : clearAll()}
              className="text-ink/20 hover:text-red-400 text-xs transition-colors px-1 py-0.5 rounded hover:bg-red-400/8"
            >Clear all</button>
          )}
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-surface-border flex-shrink-0 bg-surface">
          <span className="text-ink/25 text-xs pl-0.5 flex-shrink-0">⌕</span>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.shiftKey ? goToPrevMatch() : goToNextMatch() }
              if (e.key === 'Escape') { closeSearch() }
              if (e.key === 'ArrowDown') { e.preventDefault(); goToNextMatch() }
              if (e.key === 'ArrowUp') { e.preventDefault(); goToPrevMatch() }
            }}
            placeholder="Search cards..."
            className="flex-1 bg-transparent text-ink text-xs focus:outline-none placeholder-ink/20 min-w-0"
          />
          {searchQuery.trim() && (
            <span className="text-ink/25 text-xs flex-shrink-0 tabular-nums">
              {searchMatches.length === 0 ? 'No matches' : `${searchMatchIndex + 1} / ${searchMatches.length}`}
            </span>
          )}
          <button
            onClick={goToPrevMatch}
            disabled={searchMatches.length <= 1}
            title="Previous match (Shift+Enter)"
            className="text-ink/30 hover:text-ink disabled:opacity-20 w-5 h-5 flex items-center justify-center rounded hover:bg-surface-elevated transition-colors text-xs"
          >↑</button>
          <button
            onClick={goToNextMatch}
            disabled={searchMatches.length <= 1}
            title="Next match (Enter)"
            className="text-ink/30 hover:text-ink disabled:opacity-20 w-5 h-5 flex items-center justify-center rounded hover:bg-surface-elevated transition-colors text-xs"
          >↓</button>
          <button
            onClick={closeSearch}
            title="Close (Escape)"
            className="text-ink/25 hover:text-ink/60 w-5 h-5 flex items-center justify-center rounded hover:bg-surface-elevated transition-colors text-xs"
          >✕</button>
        </div>
      )}

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
                          containerRef={setItemRef(card.id)}
                          highlight={
                            card.id === activeMatchId ? 'activeMatch'
                            : card.id === focusedCardId ? 'focused'
                            : searchMatches.includes(card.id) ? 'match'
                            : null
                          }
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
                  containerRef={setItemRef(card.id)}
                  highlight={
                    card.id === activeMatchId ? 'activeMatch'
                    : card.id === focusedCardId ? 'focused'
                    : searchMatches.includes(card.id) ? 'match'
                    : null
                  }
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
