import { useMemo } from 'react';
import type { TrackLayoutDef } from '../../game/tracks/trackGeometry';

export interface MinimapRacerMarker {
  id: string;
  x: number;
  z: number;
  yaw: number;
  isPlayer: boolean;
  color: string;
}

export interface MinimapProps {
  layout: TrackLayoutDef;
  racers: readonly MinimapRacerMarker[];
}

export function Minimap({ layout, racers }: MinimapProps) {
  const projection = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const sample of layout.samples) {
      minX = Math.min(minX, sample.point.x);
      maxX = Math.max(maxX, sample.point.x);
      minZ = Math.min(minZ, sample.point.z);
      maxZ = Math.max(maxZ, sample.point.z);
    }

    const pad = 22;
    minX -= pad;
    maxX += pad;
    minZ -= pad;
    maxZ += pad;

    const spanX = Math.max(1, maxX - minX);
    const spanZ = Math.max(1, maxZ - minZ);
    const size = 144;
    const scale = (size - 16) / Math.max(spanX, spanZ);
    const offsetX = (size - spanX * scale) * 0.5;
    const offsetZ = (size - spanZ * scale) * 0.5;

    const mapPoint = (x: number, z: number): [number, number] => [
      offsetX + (x - minX) * scale,
      offsetZ + (z - minZ) * scale,
    ];

    const mainPoints = layout.samples
      .map((s) => mapPoint(s.point.x, s.point.z).map((n) => n.toFixed(1)).join(','))
      .join(' ');

    const shortcutPoints = layout.shortcuts.map((sc) =>
      sc.samples
        .map((s) => mapPoint(s.point.x, s.point.z).map((n) => n.toFixed(1)).join(','))
        .join(' '),
    );

    const cp0 = layout.checkpoints[0];
    const startPt = mapPoint(cp0.position.x, cp0.position.z);

    return { size, mainPoints, shortcutPoints, startPt, mapPoint };
  }, [layout]);

  return (
    <div className="kl-minimap-box" data-testid="minimap">
      <svg
        width={projection.size}
        height={projection.size}
        viewBox={`0 0 ${projection.size} ${projection.size}`}
        aria-label="Minimapa da pista"
      >
        <polygon
          points={projection.mainPoints}
          fill="none"
          stroke="rgba(15, 23, 42, 0.9)"
          strokeWidth="11"
          strokeLinejoin="round"
        />
        <polygon
          points={projection.mainPoints}
          fill="none"
          stroke="rgba(226, 232, 240, 0.85)"
          strokeWidth="5.5"
          strokeLinejoin="round"
        />
        {projection.shortcutPoints.map((pts, idx) => (
          <polyline
            key={idx}
            points={pts}
            fill="none"
            stroke="rgba(245, 158, 11, 0.78)"
            strokeWidth="3"
            strokeDasharray="3 2"
          />
        ))}
        <circle
          cx={projection.startPt[0]}
          cy={projection.startPt[1]}
          r={4.2}
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="1.5"
        />
        {racers
          .filter((r) => !r.isPlayer)
          .map((r) => {
            const [cx, cy] = projection.mapPoint(r.x, r.z);
            return (
              <circle
                key={r.id}
                data-testid="minimap-racer"
                cx={cx}
                cy={cy}
                r={3.8}
                fill={r.color}
                stroke="#0b1020"
                strokeWidth="1.2"
              />
            );
          })}
        {racers
          .filter((r) => r.isPlayer)
          .map((r) => {
            const [cx, cy] = projection.mapPoint(r.x, r.z);
            return (
              <circle
                key={r.id}
                data-testid="minimap-racer"
                cx={cx}
                cy={cy}
                r={5.8}
                fill="#ffb800"
                stroke="#ffffff"
                strokeWidth="2"
              />
            );
          })}
      </svg>
    </div>
  );
}
