export type CornerStyle = "square" | "rounded" | "soft" | "squircle" | "chamfer" | "notch" | "scooped" | "mixed";

export const CORNER_STYLE_OPTIONS: { id: CornerStyle; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "soft", label: "Soft" },
  { id: "squircle", label: "Squircle" },
  { id: "chamfer", label: "Chamfer" },
  { id: "notch", label: "Notch" },
  { id: "scooped", label: "Scooped" },
  { id: "mixed", label: "Mixed" },
];
