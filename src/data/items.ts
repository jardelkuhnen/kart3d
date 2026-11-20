import type { ItemDef, ItemId } from '../game/core/types';

export const ITEMS: readonly ItemDef[] = [
  {
    id: 'pulso-solar',
    name: 'Pulso Solar',
    description: 'Dispara um surto de aceleração temporária para recuperar posições e cruzar atalhos.',
    category: 'boost',
    durationSeconds: 1.8,
    cooldownSeconds: 0.4,
    positionWeights: [5, 12, 20, 28, 34, 38, 42, 46],
    accentColor: '#f59e0b',
    iconAssetId: 'ui-item-pulso-solar',
    modelAssetId: 'item-pulso-solar',
  },
  {
    id: 'bolha-guardia',
    name: 'Bolha Guardiã',
    description: 'Envolve o kart em um campo protetor que absorve impactos de projéteis e colisões.',
    category: 'defense',
    durationSeconds: 7.0,
    cooldownSeconds: 0.5,
    positionWeights: [36, 30, 22, 16, 12, 8, 5, 4],
    accentColor: '#38bdf8',
    iconAssetId: 'ui-item-bolha-guardia',
    modelAssetId: 'item-bolha-guardia',
  },
  {
    id: 'nevoa-prisma',
    name: 'Névoa Prisma',
    description: 'Deixa uma nuvem prismática na pista que reduz visibilidade e velocidade de quem atravessa.',
    category: 'trap',
    durationSeconds: 10.0,
    cooldownSeconds: 0.4,
    positionWeights: [32, 26, 18, 12, 8, 5, 3, 2],
    accentColor: '#ec4899',
    iconAssetId: 'ui-item-nevoa-prisma',
    modelAssetId: 'item-nevoa-prisma',
  },
  {
    id: 'faisca-rastreadora',
    name: 'Faísca Rastreadora',
    description: 'Projétil guiado que persegue o rival à frente; pode ser interceptado por defesas.',
    category: 'projectile',
    durationSeconds: 5.5,
    cooldownSeconds: 0.5,
    positionWeights: [6, 14, 22, 24, 24, 22, 18, 14],
    accentColor: '#ef4444',
    iconAssetId: 'ui-item-faisca-rastreadora',
    modelAssetId: 'item-faisca-rastreadora',
  },
  {
    id: 'onda-de-vento',
    name: 'Onda de Vento',
    description: 'Libera um pulso radial que empurra adversários próximos para fora da trajetória.',
    category: 'disrupt',
    durationSeconds: 0.9,
    cooldownSeconds: 0.6,
    positionWeights: [11, 10, 10, 11, 12, 14, 16, 16],
    accentColor: '#2dd4bf',
    iconAssetId: 'ui-item-onda-de-vento',
    modelAssetId: 'item-onda-de-vento',
  },
  {
    id: 'cristal-de-salto',
    name: 'Cristal de Salto',
    description: 'Impulsiona o kart em um salto estratégico para desviar de armadilhas e alcançar atalhos.',
    category: 'utility',
    durationSeconds: 0.8,
    cooldownSeconds: 0.5,
    positionWeights: [10, 8, 8, 9, 10, 13, 16, 18],
    accentColor: '#a855f7',
    iconAssetId: 'ui-item-cristal-de-salto',
    modelAssetId: 'item-cristal-de-salto',
  },
] as const;

export const ITEMS_BY_ID: Record<ItemId, ItemDef> = Object.fromEntries(
  ITEMS.map((item) => [item.id, item]),
) as Record<ItemId, ItemDef>;

export function getItemById(id: ItemId): ItemDef {
  return ITEMS_BY_ID[id];
}
