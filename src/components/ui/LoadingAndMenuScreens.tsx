import { useGameStore } from '../../app/store';
import type { GameMode } from '../../game/core/types';

export function LoadingScreen({ manifestError }: { manifestError: string | null }) {
  return (
    <section className="kl-screen-center" aria-label="Carregando">
      <div className="kl-panel kl-menu-card">
        <span className="kl-brand-badge">CARREGANDO MOTOR 3D</span>
        <h1 className="kl-title kl-title-hero">KART LEGENDS 3D</h1>
        {manifestError ? (
          <p className="kl-error-banner" role="alert">
            {manifestError}
          </p>
        ) : (
          <>
            <p className="kl-subtitle">
              Validando manifesto local de pistas, personagens, karts e trilhas sonoras...
            </p>
            <div className="kl-loading-bar">
              <div className="kl-loading-fill" />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export function MainMenuScreen({
  onPlaySfx,
}: {
  onPlaySfx: (kind: 'click' | 'confirm') => void;
}) {
  const saveData = useGameStore((s) => s.saveData);
  const saveRecoveredNotice = useGameStore((s) => s.saveRecoveredNotice);
  const dismissNotice = useGameStore((s) => s.dismissSaveRecoveredNotice);
  const setScreen = useGameStore((s) => s.setScreen);
  const setMode = useGameStore((s) => s.setMode);
  const openSettings = useGameStore((s) => s.openSettings);
  const clearChampionship = useGameStore((s) => s.clearChampionship);

  const trophyCount = Object.keys(saveData.cupTrophies).length;

  return (
    <section className="kl-screen-center" aria-label="Menu Principal">
      <div className="kl-panel kl-menu-card">
        <span className="kl-brand-badge">ARCADE 3D ORIGINAL · 8 PISTAS · 2 COPAS</span>
        <h1 className="kl-title kl-title-hero">KART LEGENDS 3D</h1>
        <p className="kl-subtitle">
          Velocidade, drifts de 3 níveis e disputas táticas com física real.
        </p>

        {saveRecoveredNotice && (
          <div className="kl-notice-banner" role="status">
            <span>Dados salvos inválidos foram detectados e restaurados com segurança.</span>
            <button
              type="button"
              className="kl-btn kl-btn-secondary kl-btn-xs"
              onClick={dismissNotice}
            >
              Entendi
            </button>
          </div>
        )}

        <div className="kl-menu-stats-row">
          <span>Pilotos: {saveData.unlockedCharacters.length}/8</span>
          <span>Karts: {saveData.unlockedKarts.length}/8</span>
          <span>Pistas: {saveData.unlockedTracks.length}/8</span>
          <span>Troféus: {trophyCount}/2</span>
        </div>

        <nav className="kl-menu-actions" aria-label="Navegação Principal">
          <button
            type="button"
            className="kl-btn kl-btn-large"
            onClick={() => {
              onPlaySfx('confirm');
              clearChampionship();
              setScreen('mode-select');
            }}
          >
            JOGAR
          </button>

          <button
            type="button"
            className="kl-btn"
            onClick={() => {
              onPlaySfx('click');
              clearChampionship();
              setMode('quick-race');
              setScreen('character-select');
            }}
          >
            Corrida Rápida
          </button>

          <button
            type="button"
            className="kl-btn"
            onClick={() => {
              onPlaySfx('click');
              clearChampionship();
              setMode('championship');
              setScreen('character-select');
            }}
          >
            Campeonato
          </button>

          <div className="kl-menu-row-split">
            <button
              type="button"
              className="kl-btn kl-btn-secondary"
              onClick={() => {
                onPlaySfx('click');
                setScreen('progression');
              }}
            >
              Progressão e Troféus
            </button>
            <button
              type="button"
              className="kl-btn kl-btn-secondary"
              onClick={() => {
                onPlaySfx('click');
                openSettings();
              }}
            >
              Configurações
            </button>
          </div>
        </nav>
      </div>
    </section>
  );
}

const MODE_CARDS: ReadonlyArray<{
  mode: GameMode;
  title: string;
  tag: string;
  description: string;
}> = [
  {
    mode: 'quick-race',
    title: 'Corrida Rápida',
    tag: '8 PILOTOS · 3 VOLTAS',
    description: 'Escolha qualquer pista liberada e enfrente 7 rivais de IA com itens ativos.',
  },
  {
    mode: 'championship',
    title: 'Campeonato',
    tag: 'COPA 4 PISTAS · TROFÉU',
    description: 'Acumule pontos nas 4 pistas da copa e dispute o troféu no Pódio 3D.',
  },
  {
    mode: 'time-trial',
    title: 'Contrarrelógio',
    tag: 'SOLO · SEM ITENS',
    description: 'Corra sozinho em 3 voltas limpas buscando recordes oficiais de pista e volta.',
  },
  {
    mode: 'practice',
    title: 'Treino Livre',
    tag: 'EXPLORAÇÃO · TUDO ABERTO',
    description: 'Teste qualquer piloto, kart e todas as 8 pistas sem adversários ou bloqueios.',
  },
];

export function ModeSelectScreen({
  onPlaySfx,
}: {
  onPlaySfx: (kind: 'click' | 'confirm') => void;
}) {
  const setMode = useGameStore((s) => s.setMode);
  const setScreen = useGameStore((s) => s.setScreen);
  const clearChampionship = useGameStore((s) => s.clearChampionship);

  return (
    <section className="kl-screen-center" aria-label="Seleção de Modo">
      <div className="kl-panel kl-wide-card">
        <span className="kl-brand-badge">ETAPA 1 · MODO DE JOGO</span>
        <h2 className="kl-title">Escolha o Modo</h2>
        <p className="kl-subtitle">Selecione como deseja competir em Kart Legends 3D.</p>

        <div className="kl-mode-grid">
          {MODE_CARDS.map((card) => (
            <button
              key={card.mode}
              type="button"
              className="kl-mode-card"
              data-testid={`mode-option-${card.mode}`}
              onClick={() => {
                onPlaySfx('confirm');
                clearChampionship();
                setMode(card.mode);
                setScreen('character-select');
              }}
            >
              <span className="kl-mode-tag">{card.tag}</span>
              <strong className="kl-mode-title">{card.title}</strong>
              <span className="kl-mode-desc">{card.description}</span>
            </button>
          ))}
        </div>

        <div className="kl-screen-footer">
          <button
            type="button"
            className="kl-btn kl-btn-secondary"
            onClick={() => {
              onPlaySfx('click');
              setScreen('main-menu');
            }}
          >
            Voltar ao Menu
          </button>
        </div>
      </div>
    </section>
  );
}
