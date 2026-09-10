type IconProps = { size?: number };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function UndoIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M4 4.5H10.5a3.5 3.5 0 0 1 0 7H6" />
      <path d="M6.2 2.3 3.8 4.6l2.4 2.3" />
    </svg>
  );
}

export function RedoIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M12 4.5H5.5a3.5 3.5 0 0 0 0 7H10" />
      <path d="M9.8 2.3 12.2 4.6 9.8 6.9" />
    </svg>
  );
}

export function FitViewIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M1.5 5.5v-3a1 1 0 0 1 1-1h3" />
      <path d="M14.5 5.5v-3a1 1 0 0 0-1-1h-3" />
      <path d="M1.5 10.5v3a1 1 0 0 0 1 1h3" />
      <path d="M14.5 10.5v3a1 1 0 0 1-1 1h-3" />
      <rect x="5.5" y="5.5" width="5" height="5" rx="1" />
    </svg>
  );
}

export function SearchIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.3 10.3 14 14" />
    </svg>
  );
}

export function ChevronUpIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M3.5 10 8 5.5 12.5 10" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M3.5 6 8 10.5 12.5 6" />
    </svg>
  );
}

export function CloseIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M3.5 3.5l9 9" />
      <path d="M12.5 3.5l-9 9" />
    </svg>
  );
}

export function LockIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <rect x="3" y="7.5" width="10" height="6.5" rx="1.3" />
      <path d="M5 7.5V5a3 3 0 0 1 6 0v2.5" />
    </svg>
  );
}

export function UnlockIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <rect x="3" y="7.5" width="10" height="6.5" rx="1.3" />
      <path d="M5 7.5V5a3 3 0 0 1 5.6-1.4" />
    </svg>
  );
}

export function DuplicateIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <rect x="5" y="5" width="9" height="9" rx="1.3" />
      <path d="M11 5V3.3A1.3 1.3 0 0 0 9.7 2H3.3A1.3 1.3 0 0 0 2 3.3v6.4A1.3 1.3 0 0 0 3.3 11H5" />
    </svg>
  );
}

export function TrashIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M2.5 4.5h11" />
      <path d="M5.5 4.5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" />
      <path d="M4 4.5 4.7 13a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.7-8.5" />
      <path d="M6.5 7.3v4" />
      <path d="M9.5 7.3v4" />
    </svg>
  );
}

export function PlayIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" stroke="none">
      <path d="M4 2.5v11l9.5-5.5Z" />
    </svg>
  );
}

export function TextGlyphIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M3 3.5h10" />
      <path d="M8 3.5v9" />
      <path d="M5.8 12.5h4.4" />
    </svg>
  );
}

export function ShapeGlyphIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M8 2 14 8 8 14 2 8Z" />
    </svg>
  );
}

export function ImageGlyphIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.3" />
      <circle cx="5.5" cy="6.5" r="1.3" />
      <path d="M2 12.5 6 8.5l2.5 2.5 2-2 3.5 3.5" />
    </svg>
  );
}

export function LinkGlyphIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M6.5 9.5a3 3 0 0 0 4.2.3l1.8-1.8a3 3 0 0 0-4.2-4.2L7.2 5" />
      <path d="M9.5 6.5a3 3 0 0 0-4.2-.3L3.5 8a3 3 0 0 0 4.2 4.2l1-1" />
    </svg>
  );
}

export function ChecklistGlyphIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M2 4 3.2 5.2 5.5 2.6" />
      <path d="M7.5 4h6.5" />
      <path d="M2 9 3.2 10.2 5.5 7.6" />
      <path d="M7.5 9h6.5" />
      <path d="M7.5 13.5h6.5" />
      <path d="M2 13.5h2.5" />
    </svg>
  );
}

export function BoardGlyphIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.3" />
      <rect x="3.3" y="4.3" width="4" height="3" rx="0.6" />
      <path d="M3.3 9.8h4" />
      <path d="M3.3 11.8h2.4" />
      <path d="M9.3 4.8h3.4" />
      <path d="M9.3 7h3.4" />
    </svg>
  );
}

export function AlignLeftIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M2 1.5v13" />
      <rect x="4" y="3" width="9" height="3" rx="0.8" />
      <rect x="4" y="10" width="5.5" height="3" rx="0.8" />
    </svg>
  );
}

export function AlignCenterHIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M8 1.5v13" />
      <rect x="3.5" y="3" width="9" height="3" rx="0.8" />
      <rect x="5.25" y="10" width="5.5" height="3" rx="0.8" />
    </svg>
  );
}

export function AlignRightIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M14 1.5v13" />
      <rect x="3" y="3" width="9" height="3" rx="0.8" />
      <rect x="6.5" y="10" width="5.5" height="3" rx="0.8" />
    </svg>
  );
}

export function AlignTopIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M1.5 2h13" />
      <rect x="3" y="4" width="3" height="9" rx="0.8" />
      <rect x="10" y="4" width="3" height="5.5" rx="0.8" />
    </svg>
  );
}

export function AlignMiddleVIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M1.5 8h13" />
      <rect x="3" y="3.5" width="3" height="9" rx="0.8" />
      <rect x="10" y="5.25" width="3" height="5.5" rx="0.8" />
    </svg>
  );
}

export function AlignBottomIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M1.5 14h13" />
      <rect x="3" y="3" width="3" height="9" rx="0.8" />
      <rect x="10" y="6.5" width="3" height="5.5" rx="0.8" />
    </svg>
  );
}

export function DistributeHIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <rect x="1.2" y="4" width="2.6" height="8" rx="0.6" />
      <rect x="6.7" y="4" width="2.6" height="8" rx="0.6" />
      <rect x="12.2" y="4" width="2.6" height="8" rx="0.6" />
    </svg>
  );
}

export function DistributeVIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <rect x="4" y="1.2" width="8" height="2.6" rx="0.6" />
      <rect x="4" y="6.7" width="8" height="2.6" rx="0.6" />
      <rect x="4" y="12.2" width="8" height="2.6" rx="0.6" />
    </svg>
  );
}

export function BringToFrontIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <rect x="2" y="2" width="8" height="8" rx="1" opacity="0.45" />
      <rect x="6" y="6" width="8" height="8" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SendToBackIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <rect x="2" y="2" width="8" height="8" rx="1" fill="currentColor" stroke="none" />
      <rect x="6" y="6" width="8" height="8" rx="1" opacity="0.45" />
    </svg>
  );
}

export function BringForwardIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <rect x="3" y="3" width="7" height="7" rx="1" opacity="0.45" />
      <rect x="6" y="6" width="7" height="7" rx="1" />
    </svg>
  );
}

export function SendBackwardIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="6" y="6" width="7" height="7" rx="1" opacity="0.45" />
    </svg>
  );
}

export function ColumnsIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <rect x="1.5" y="2" width="13" height="12" rx="1.3" />
      <path d="M6 2v12" />
      <path d="M10 2v12" />
    </svg>
  );
}

export function TagSlashIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M3.5 3.5l9 9" />
      <path d="M12.5 3.5l-9 9" />
    </svg>
  );
}

export function ShareIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <circle cx="12" cy="3.5" r="2" />
      <circle cx="4" cy="8" r="2" />
      <circle cx="12" cy="12.5" r="2" />
      <path d="M5.8 7l4.4-2.4" />
      <path d="M5.8 9l4.4 2.4" />
    </svg>
  );
}

export function BackIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M9.5 3.5L5 8l4.5 4.5" />
    </svg>
  );
}
