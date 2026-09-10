export type TextAlign = "left" | "center" | "right";

export type TextStyle = {
  fontFamily: string;
  fontSize: number;
  align: TextAlign;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontSize: 13.5,
  align: "left",
  bold: false,
  italic: false,
  underline: false,
};

export const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "Sans (Inter)", value: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { label: "Serif (Georgia)", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
  { label: "Rounded", value: "'Comic Sans MS', 'Comic Sans', cursive" },
  { label: "Classic", value: "'Times New Roman', Times, serif" },
];
