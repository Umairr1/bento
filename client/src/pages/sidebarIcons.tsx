type IconProps = { size?: number };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function GridSnapIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" />
    </svg>
  );
}

export function ShuffleIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M1 4h2.5c1.5 0 2.3.6 3 1.8L9 9.2c.7 1.2 1.5 1.8 3 1.8H14" />
      <path d="M11.5 2.5 14 4l-2.5 1.5" />
      <path d="M1 12h2.5c1.5 0 2.3-.6 3-1.8" />
      <path d="M11.5 13.5 14 12l-2.5-1.5" />
    </svg>
  );
}

export function TemplatesIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
      <path d="M1.5 6.5h13" />
      <path d="M6 6.5v8" />
    </svg>
  );
}

export function CornersIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M1.5 5.5v-3a1 1 0 0 1 1-1h3" />
      <path d="M14.5 5.5v-3a1 1 0 0 0-1-1h-3" />
      <path d="M1.5 10.5v3a1 1 0 0 0 1 1h3" />
      <path d="M14.5 10.5v3a1 1 0 0 1-1 1h-3" />
    </svg>
  );
}

export function PresentationIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <rect x="1.5" y="2" width="13" height="9" rx="1.2" />
      <path d="M6.5 14.5h3" />
      <path d="M8 11v3.5" />
      <path d="M6.5 4.8 10.5 6.5 6.5 8.2Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function DrawIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M10.5 2.5 13.5 5.5 5 14 1.5 14.5 2 11Z" />
      <path d="M9 4 12 7" />
    </svg>
  );
}

export function CompositionIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
      <circle cx="6" cy="6.5" r="1.6" />
      <path d="M2 12.5 6 8.5l2.5 2.5 2-2 3 3.5" />
    </svg>
  );
}

export function ExportIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M8 1.5v8.5" />
      <path d="M4.5 6.5 8 10l3.5-3.5" />
      <path d="M2 12.5v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1" />
    </svg>
  );
}
