import { createRoot } from "react-dom/client";
import { createElement } from "react";
import { toCanvas } from "html-to-image";
import type { Node } from "@xyflow/react";
import { SlideCard, sortForPresentation, enterAxis } from "../pages/PresentationView";
import type { PresentationSettings } from "./presentationSettings";

export type VideoResolution = "720p" | "1080p" | "1440p" | "2160p";

const RESOLUTIONS: Record<VideoResolution, { width: number; height: number; bitrate: number }> = {
  "720p": { width: 1280, height: 720, bitrate: 8_000_000 },
  "1080p": { width: 1920, height: 1080, bitrate: 16_000_000 },
  "1440p": { width: 2560, height: 1440, bitrate: 32_000_000 },
  "2160p": { width: 3840, height: 2160, bitrate: 45_000_000 },
};

export type VideoExportOptions = {
  resolution: VideoResolution;
  fps: 24 | 30 | 60;
  filename: string;
};

function pickMimeType(): { mimeType: string; extension: string } {
  const candidates = [
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const found = candidates.find((m) => MediaRecorder.isTypeSupported(m));
  const mimeType = found ?? "video/webm";
  return { mimeType, extension: mimeType.startsWith("video/mp4") ? "mp4" : "webm" };
}

async function renderSlideToCanvas(node: Node, width: number, height: number): Promise<HTMLCanvasElement> {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  document.body.appendChild(container);

  const root = createRoot(container);
  await new Promise<void>((resolve) => {
    root.render(createElement("div", { style: { width: "100%", height: "100%" } }, createElement(SlideCard, { node })));
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); })
    )
  );

  const canvas = await toCanvas(container, { width, height, backgroundColor: "#0a0a0c", pixelRatio: 1 });
  root.unmount();
  document.body.removeChild(container);
  return canvas;
}

/** Records a presentation-style walkthrough of the board's notes to a downloadable MP4/WebM file. */
export async function exportBoardVideo(
  nodes: Node[],
  settings: PresentationSettings,
  options: VideoExportOptions,
  onProgress: (fraction: number) => void
): Promise<void> {
  const ordered = sortForPresentation(nodes);
  if (ordered.length === 0) throw new Error("Nothing to export — add a note first");

  const { width, height, bitrate } = RESOLUTIONS[options.resolution];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not supported in this browser");
  const context: CanvasRenderingContext2D = ctx;

  const { mimeType, extension } = pickMimeType();
  const stream = canvas.captureStream(options.fps);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  recorder.start();

  const axis = enterAxis(settings.direction);
  let prevCanvas: HTMLCanvasElement | null = null;

  for (let i = 0; i < ordered.length; i++) {
    const slideCanvas = await renderSlideToCanvas(ordered[i], width, height);
    const transitionMs = settings.slideSpeed * 1000;
    const start = performance.now();

    await new Promise<void>((resolve) => {
      function frame(now: number) {
        const t = Math.min(1, (now - start) / transitionMs);
        context.fillStyle = "#0a0a0c";
        context.fillRect(0, 0, width, height);
        if (prevCanvas) {
          context.globalAlpha = 1;
          context.drawImage(prevCanvas, 0, 0);
        }
        context.globalAlpha = t;
        context.drawImage(slideCanvas, axis.x * (1 - t), axis.y * (1 - t));
        context.globalAlpha = 1;
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });

    prevCanvas = slideCanvas;
    onProgress((i + 1) / ordered.length);
    await new Promise((r) => setTimeout(r, settings.holdPacing * 1000));
  }

  recorder.stop();
  await stopped;

  const blob = new Blob(chunks, { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${options.filename || "board"}.${extension}`;
  link.click();
  URL.revokeObjectURL(url);
}
