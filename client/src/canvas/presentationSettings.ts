export type SlideDirection = "left" | "right" | "up" | "down";

export type PresentationSettings = {
  direction: SlideDirection;
  slideSpeed: number; // seconds, transition duration
  holdPacing: number; // seconds, how long a slide stays before auto-advancing
  autoPlay: boolean; // start auto-advancing immediately on entering presentation
};

export const DEFAULT_PRESENTATION_SETTINGS: PresentationSettings = {
  direction: "left",
  slideSpeed: 0.65,
  holdPacing: 4,
  autoPlay: false,
};
