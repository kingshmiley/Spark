import { v4 as uuidv4 } from 'uuid'
import type { ScryfallCard, PrintCard } from '../../../shared/types'
import { bridge } from '../api/bridge'

export function getCardImageUri(card: ScryfallCard, size: 'normal' | 'large' = 'normal'): string | null {
  if (card.image_uris) return card.image_uris[size] ?? card.image_uris.normal ?? null
  if (card.card_faces?.[0]?.image_uris) return card.card_faces[0].image_uris[size] ?? null
  return null
}

export function getCardBackUri(card: ScryfallCard): string | null {
  if (card.card_faces?.[1]?.image_uris) return card.card_faces[1].image_uris.normal ?? null
  return null
}

// Fetches images and builds a PrintCard ready to add to the deck.
// Returns null if the front image URI cannot be resolved.
export async function buildPrintCard(card: ScryfallCard): Promise<PrintCard | null> {
  const frontUri = getCardImageUri(card, 'large')
  if (!frontUri) return null

  const frontResult = await bridge.scryfallFetchImage(frontUri, card.id + '-front', 'large')
  const frontCachedPath = frontResult.ok ? frontResult.data : undefined
  const frontDataUrl = frontCachedPath
    ? (await bridge.readFileAsDataUrl(frontCachedPath)).data
    : undefined

  const backUri = getCardBackUri(card)
  let backFace: PrintCard['back'] = 'default'
  if (backUri) {
    const backResult = await bridge.scryfallFetchImage(backUri, card.id + '-back', 'large')
    const backCachedPath = backResult.ok ? backResult.data : undefined
    const backDataUrl = backCachedPath
      ? (await bridge.readFileAsDataUrl(backCachedPath)).data
      : undefined
    backFace = {
      imageSource: {
        kind: 'scryfall',
        scryfallId: card.id + '-back',
        imageUri: backUri,
        name: card.card_faces?.[1]?.name ?? card.name + ' (back)'
      },
      cachedPath: backCachedPath,
      dataUrl: backDataUrl
    }
  }

  return {
    id: uuidv4(),
    quantity: 1,
    displayName: card.name,
    scryfallData: card,
    front: {
      imageSource: { kind: 'scryfall', scryfallId: card.id, imageUri: frontUri, name: card.name },
      cachedPath: frontCachedPath,
      dataUrl: frontDataUrl
    },
    back: backFace
  }
}
