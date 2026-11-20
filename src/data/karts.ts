import type { KartAttributes, KartDef, KartId } from '../game/core/types';

export const KARTS: readonly KartDef[] = [
  {
    id: 'trilha-raposa',
    name: 'Trilha Raposa',
    archetype: 'Equilibrado Ágil',
    description: 'Chassi versátil de resposta rápida, ideal para dominar todas as pistas.',
    primaryColor: '#f97316',
    secondaryColor: '#1e293b',
    trimColor: '#fbbf24',
    attributes: {
      topSpeed: 7,
      acceleration: 8,
      braking: 7,
      handling: 8,
      grip: 7,
      mass: 5,
      driftEfficiency: 7,
      recovery: 7,
    },
    unlockedByDefault: true,
    unlockRequirementLabel: 'Disponível desde o início',
    modelAssetId: 'kart-trilha-raposa',
  },
  {
    id: 'engrenagem-turbo',
    name: 'Engrenagem Turbo',
    archetype: 'Blindado de Torque',
    description: 'Estrutura robusta com caldeira traseira pressurizada e excelente estabilidade.',
    primaryColor: '#2563eb',
    secondaryColor: '#475569',
    trimColor: '#facc15',
    attributes: {
      topSpeed: 8,
      acceleration: 6,
      braking: 6,
      handling: 6,
      grip: 7,
      mass: 9,
      driftEfficiency: 6,
      recovery: 7,
    },
    unlockedByDefault: true,
    unlockRequirementLabel: 'Disponível desde o início',
    modelAssetId: 'kart-engrenagem-turbo',
  },
  {
    id: 'cometa-estelar',
    name: 'Cometa Estelar',
    archetype: 'Aerodinâmico Drift',
    description: 'Carenagem afilada com asas duplas focada em velocidade final e turbo de curva.',
    primaryColor: '#6d28d9',
    secondaryColor: '#0f172a',
    trimColor: '#38bdf8',
    attributes: {
      topSpeed: 9,
      acceleration: 7,
      braking: 6,
      handling: 6,
      grip: 6,
      mass: 5,
      driftEfficiency: 9,
      recovery: 7,
    },
    unlockedByDefault: true,
    unlockRequirementLabel: 'Disponível desde o início',
    modelAssetId: 'kart-cometa-estelar',
  },
  {
    id: 'raiz-veloz',
    name: 'Raiz Veloz',
    archetype: 'Todo-Terreno',
    description: 'Suspensão elevada e pneus largos para atravessar grama, terra e atalhos.',
    primaryColor: '#059669',
    secondaryColor: '#78350f',
    trimColor: '#a3e635',
    attributes: {
      topSpeed: 6,
      acceleration: 8,
      braking: 8,
      handling: 8,
      grip: 9,
      mass: 6,
      driftEfficiency: 6,
      recovery: 7,
    },
    unlockedByDefault: true,
    unlockRequirementLabel: 'Disponível desde o início',
    modelAssetId: 'kart-raiz-veloz',
  },
  {
    id: 'chave-mestra-gt',
    name: 'Chave-Mestra GT',
    archetype: 'Esportivo de Pista',
    description: 'Bólido clássico de corrida com escape duplo cromado e ótima tração.',
    primaryColor: '#dc2626',
    secondaryColor: '#f8fafc',
    trimColor: '#0f172a',
    attributes: {
      topSpeed: 8,
      acceleration: 7,
      braking: 7,
      handling: 7,
      grip: 7,
      mass: 7,
      driftEfficiency: 7,
      recovery: 6,
    },
    unlockedByDefault: false,
    unlockRequirementLabel: 'Vença uma corrida no modo Corrida Rápida',
    modelAssetId: 'kart-chave-mestra-gt',
  },
  {
    id: 'brisa-corsaria',
    name: 'Brisa Corsária',
    archetype: 'Leve de Precisão',
    description: 'Casco náutico ultraleve com leme traseiro para curvas fechadas consecutivas.',
    primaryColor: '#0891b2',
    secondaryColor: '#fef3c7',
    trimColor: '#fb7185',
    attributes: {
      topSpeed: 7,
      acceleration: 8,
      braking: 7,
      handling: 9,
      grip: 7,
      mass: 4,
      driftEfficiency: 8,
      recovery: 7,
    },
    unlockedByDefault: false,
    unlockRequirementLabel: 'Complete 20 drifts válidos acumulados',
    modelAssetId: 'kart-brisa-corsaria',
  },
  {
    id: 'escorpiao-dourado',
    name: 'Escorpião Dourado',
    archetype: 'Buggy de Dunas',
    description: 'Gaiola tubular reforçada e motor exposto de alta potência para retas longas.',
    primaryColor: '#d97706',
    secondaryColor: '#292524',
    trimColor: '#fde047',
    attributes: {
      topSpeed: 9,
      acceleration: 6,
      braking: 6,
      handling: 5,
      grip: 8,
      mass: 8,
      driftEfficiency: 7,
      recovery: 7,
    },
    unlockedByDefault: false,
    unlockRequirementLabel: 'Conclua a Copa Aurora',
    modelAssetId: 'kart-escorpiao-dourado',
  },
  {
    id: 'lamina-glacial',
    name: 'Lâmina Glacial',
    archetype: 'Fórmula Polar',
    description: 'Esquis dianteiros integrados e difusor traseiro voltado a drifts de Nível 3.',
    primaryColor: '#0284c7',
    secondaryColor: '#e2e8f0',
    trimColor: '#22d3ee',
    attributes: {
      topSpeed: 8,
      acceleration: 7,
      braking: 7,
      handling: 7,
      grip: 6,
      mass: 6,
      driftEfficiency: 9,
      recovery: 6,
    },
    unlockedByDefault: false,
    unlockRequirementLabel: 'Bata um tempo no modo Contrarrelógio',
    modelAssetId: 'kart-lamina-glacial',
  },
] as const;

export const KARTS_BY_ID: Record<KartId, KartDef> = Object.fromEntries(
  KARTS.map((kart) => [kart.id, kart]),
) as Record<KartId, KartDef>;

export function getKartById(id: KartId): KartDef {
  return KARTS_BY_ID[id];
}

export function getKartAttributeTotal(attributes: KartAttributes): number {
  return (
    attributes.topSpeed +
    attributes.acceleration +
    attributes.braking +
    attributes.handling +
    attributes.grip +
    attributes.mass +
    attributes.driftEfficiency +
    attributes.recovery
  );
}
