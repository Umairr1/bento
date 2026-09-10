import { useState, type ReactNode } from "react";
import type { BoardSettings } from "../collab/useYjsBoard";
import type { ShuffleSettings } from "../canvas/shuffleLayout";
import { TEMPLATES, templateRectsForCount, type TemplateId } from "../canvas/templates";
import { CORNER_STYLE_OPTIONS } from "../collab/cornerStyles";
import type { PresentationSettings } from "../canvas/presentationSettings";
import type { VideoResolution } from "../canvas/exportVideo";
import type { ImageNoteData } from "../notes/ImageNote";
import { DEFAULT_MEDIA_TRANSFORM, type MediaTransform, type MediaFit } from "../notes/mediaTransform";
import { DRAWING_COLORS } from "../notes/DrawingNote";
import { ASPECT_RATIO_OPTIONS, applyAspectRatio, DENSITY_PRESETS, MAX_GRID_TRACKS, type AspectRatioPreset } from "../canvas/gridBoard";
import { ShortcutsHelp } from "./ShortcutsHelp";
import {
  GridSnapIcon,
  ShuffleIcon,
  TemplatesIcon,
  CornersIcon,
  PresentationIcon,
  DrawIcon,
  CompositionIcon,
  ExportIcon,
} from "./sidebarIcons";
import "../notes/noteCorners.css";
import "./BoardSidebar.css";

const GRID_SIZES = [20, 40, 80, 130, 180];

function ratioLabel(w: number, h: number): string {
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const d = g(Math.round(w), Math.round(h)) || 1;
  return `${Math.round(w / d)}:${Math.round(h / d)}`;
}
const MAX_PREVIEW_CELLS = 24;

function TemplatePreview({ id, count }: { id: TemplateId; count: number }) {
  const previewCount = Math.min(Math.max(count, 1), MAX_PREVIEW_CELLS);
  const rects = templateRectsForCount(id, previewCount);
  return (
    <div className="tpl-preview">
      {rects.map((r, i) => (
        <div
          key={i}
          className="tpl-preview-cell"
          style={{
            left: `${r[0] * 100}%`,
            top: `${r[1] * 100}%`,
            width: `${r[2] * 100}%`,
            height: `${r[3] * 100}%`,
          }}
        />
      ))}
    </div>
  );
}

function Section({
  title,
  icon,
  children,
  isOpen,
  onToggle,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`bsb-section ${isOpen ? "" : "collapsed"}`}>
      <button className="bsb-section-head" onClick={onToggle}>
        <span className="bsb-section-title">
          <span className="bsb-section-icon">{icon}</span>
          <span>{title}</span>
        </span>
        <span className="bsb-chev">▾</span>
      </button>
      {isOpen && <div className="bsb-section-body">{children}</div>}
    </div>
  );
}

export function BoardSidebar({
  settings,
  onUpdateSettings,
  drawMode,
  onToggleDrawMode,
  penMode,
  onTogglePenMode,
  penColor,
  onUpdatePenColor,
  penWidth,
  onUpdatePenWidth,
  shuffleSettings,
  onUpdateShuffleSettings,
  onShuffle,
  shuffleUnlockedOnly,
  onUpdateShuffleUnlockedOnly,
  onApplyTemplate,
  presentationSettings,
  onUpdatePresentationSettings,
  onPresent,
  exportFilename,
  onUpdateExportFilename,
  exportScale,
  onUpdateExportScale,
  exportTransparent,
  onUpdateExportTransparent,
  onExportImage,
  exporting,
  videoResolution,
  onUpdateVideoResolution,
  videoFps,
  onUpdateVideoFps,
  onExportVideo,
  videoExporting,
  videoProgress,
  selectedImage,
  onUpdateImageTransform,
  noteCount,
}: {
  settings: BoardSettings;
  onUpdateSettings: (update: Partial<BoardSettings>) => void;
  drawMode: boolean;
  onToggleDrawMode: () => void;
  penMode: boolean;
  onTogglePenMode: () => void;
  penColor: string;
  onUpdatePenColor: (value: string) => void;
  penWidth: number;
  onUpdatePenWidth: (value: number) => void;
  shuffleSettings: ShuffleSettings;
  onUpdateShuffleSettings: (update: Partial<ShuffleSettings>) => void;
  onShuffle: () => void;
  shuffleUnlockedOnly: boolean;
  onUpdateShuffleUnlockedOnly: (value: boolean) => void;
  onApplyTemplate: (id: TemplateId) => void;
  presentationSettings: PresentationSettings;
  onUpdatePresentationSettings: (update: Partial<PresentationSettings>) => void;
  onPresent: () => void;
  exportFilename: string;
  onUpdateExportFilename: (value: string) => void;
  exportScale: 1 | 2 | 3 | 4;
  onUpdateExportScale: (value: 1 | 2 | 3 | 4) => void;
  exportTransparent: boolean;
  onUpdateExportTransparent: (value: boolean) => void;
  onExportImage: () => void;
  exporting: boolean;
  videoResolution: VideoResolution;
  onUpdateVideoResolution: (value: VideoResolution) => void;
  videoFps: 24 | 30 | 60;
  onUpdateVideoFps: (value: 24 | 30 | 60) => void;
  onExportVideo: () => void;
  videoExporting: boolean;
  videoProgress: number;
  selectedImage: ImageNoteData | null;
  onUpdateImageTransform: (update: Partial<MediaTransform>) => void;
  noteCount: number;
}) {
  const [openSection, setOpenSection] = useState<string | null>("Grid & snap");
  const sectionProps = (title: string) => ({
    isOpen: openSection === title,
    onToggle: () => setOpenSection((prev) => (prev === title ? null : title)),
  });

  return (
    <aside className="board-sidebar">
      <div className="bsb-top-row">
        <span className="bsb-top-label">Board tools</span>
        <ShortcutsHelp />
      </div>

      <Section title="Grid & snap" icon={<GridSnapIcon />} {...sectionProps("Grid & snap")}>
        <label className="bsb-toggle-row">
          <span>Snap to grid</span>
          <input
            type="checkbox"
            checked={settings.snapEnabled}
            onChange={(e) => onUpdateSettings({ snapEnabled: e.target.checked })}
          />
        </label>
        <label className="bsb-field">
          <span className="bsb-field-label">Grid size</span>
          <select
            className="bsb-select"
            value={settings.gridSize}
            onChange={(e) => onUpdateSettings({ gridSize: Number(e.target.value) })}
          >
            {GRID_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}px
              </option>
            ))}
          </select>
        </label>
        <label className="bsb-toggle-row">
          <span>Show grid lines</span>
          <input
            type="checkbox"
            checked={settings.showGrid}
            onChange={(e) => onUpdateSettings({ showGrid: e.target.checked })}
          />
        </label>
        <p className="bsb-hint">Shared with everyone on this board.</p>
      </Section>

      <Section title="Grid canvas" icon={<TemplatesIcon />} {...sectionProps("Grid canvas")}>
        <label className="bsb-toggle-row">
          <span>Grid canvas mode</span>
          <input
            type="checkbox"
            checked={settings.gridMode}
            onChange={(e) => onUpdateSettings({ gridMode: e.target.checked })}
          />
        </label>
        {settings.gridMode ? (
          <>
            <label className="bsb-field">
              <span className="bsb-field-label">
                Aspect ratio <span className="bsb-field-val">{ratioLabel(settings.gridCanvasWidth, settings.gridCanvasHeight)}</span>
              </span>
              <select
                className="bsb-select"
                value={settings.gridAspectRatio}
                onChange={(e) => {
                  const id = e.target.value as AspectRatioPreset;
                  const preset = ASPECT_RATIO_OPTIONS.find((o) => o.id === id);
                  if (preset?.ratio != null) {
                    onUpdateSettings({ gridAspectRatio: id, gridCanvasHeight: applyAspectRatio(settings.gridCanvasWidth, preset.ratio) });
                  } else {
                    onUpdateSettings({ gridAspectRatio: id });
                  }
                }}
              >
                {ASPECT_RATIO_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="bsb-row2">
              <label className="bsb-field">
                <span className="bsb-field-label">Width</span>
                <input
                  type="number"
                  className="bsb-number"
                  min={200}
                  value={settings.gridCanvasWidth}
                  onChange={(e) => onUpdateSettings({ gridCanvasWidth: Math.max(200, Number(e.target.value) || 200) })}
                />
              </label>
              <label className="bsb-field">
                <span className="bsb-field-label">Height</span>
                <input
                  type="number"
                  className="bsb-number"
                  min={200}
                  value={settings.gridCanvasHeight}
                  onChange={(e) => onUpdateSettings({ gridCanvasHeight: Math.max(200, Number(e.target.value) || 200) })}
                />
              </label>
            </div>
            <div className="bsb-row2">
              <label className="bsb-field">
                <span className="bsb-field-label">Columns</span>
                <input
                  type="number"
                  className="bsb-number"
                  min={1}
                  max={MAX_GRID_TRACKS}
                  value={settings.gridCols}
                  onChange={(e) => onUpdateSettings({ gridCols: Math.max(1, Math.min(MAX_GRID_TRACKS, Number(e.target.value) || 1)) })}
                />
              </label>
              <label className="bsb-field">
                <span className="bsb-field-label">Rows</span>
                <input
                  type="number"
                  className="bsb-number"
                  min={1}
                  max={MAX_GRID_TRACKS}
                  value={settings.gridRowCount}
                  onChange={(e) => onUpdateSettings({ gridRowCount: Math.max(1, Math.min(MAX_GRID_TRACKS, Number(e.target.value) || 1)) })}
                />
              </label>
            </div>
            <div className="bsb-row2">
              <label className="bsb-field">
                <span className="bsb-field-label">
                  H gap <span className="bsb-field-val">{settings.gridGapX}px</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={48}
                  value={settings.gridGapX}
                  onChange={(e) => onUpdateSettings({ gridGapX: Number(e.target.value) })}
                />
              </label>
              <label className="bsb-field">
                <span className="bsb-field-label">
                  V gap <span className="bsb-field-val">{settings.gridGapY}px</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={48}
                  value={settings.gridGapY}
                  onChange={(e) => onUpdateSettings({ gridGapY: Number(e.target.value) })}
                />
              </label>
            </div>
            <label className="bsb-field">
              <span className="bsb-field-label">
                Outer padding <span className="bsb-field-val">{settings.gridOuterPadding}px</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={settings.gridOuterPadding}
                onChange={(e) => onUpdateSettings({ gridOuterPadding: Number(e.target.value) })}
              />
            </label>
            <label className="bsb-field">
              <span className="bsb-field-label">Background</span>
              <div className="bsb-toggle-pair">
                {(["solid", "gradient", "transparent"] as const).map((t) => (
                  <button
                    key={t}
                    className={`bsb-toggle-pill ${settings.gridBgType === t ? "active" : ""}`}
                    onClick={() => onUpdateSettings({ gridBgType: t })}
                  >
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </label>
            {settings.gridBgType === "solid" && (
              <label className="bsb-field">
                <span className="bsb-field-label">Color</span>
                <input
                  type="color"
                  value={settings.gridBackground}
                  onChange={(e) => onUpdateSettings({ gridBackground: e.target.value })}
                />
              </label>
            )}
            {settings.gridBgType === "gradient" && (
              <>
                <div className="bsb-row2">
                  <label className="bsb-field">
                    <span className="bsb-field-label">From</span>
                    <input type="color" value={settings.gridBgFrom} onChange={(e) => onUpdateSettings({ gridBgFrom: e.target.value })} />
                  </label>
                  <label className="bsb-field">
                    <span className="bsb-field-label">To</span>
                    <input type="color" value={settings.gridBgTo} onChange={(e) => onUpdateSettings({ gridBgTo: e.target.value })} />
                  </label>
                </div>
                <label className="bsb-field">
                  <span className="bsb-field-label">
                    Angle <span className="bsb-field-val">{settings.gridBgAngle}°</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={settings.gridBgAngle}
                    onChange={(e) => onUpdateSettings({ gridBgAngle: Number(e.target.value) })}
                  />
                </label>
              </>
            )}
            <label className="bsb-toggle-row">
              <span>Grid guides</span>
              <input type="checkbox" checked={settings.gridGuides} onChange={(e) => onUpdateSettings({ gridGuides: e.target.checked })} />
            </label>
            <label className="bsb-toggle-row">
              <span>Box labels</span>
              <input type="checkbox" checked={settings.boxLabels} onChange={(e) => onUpdateSettings({ boxLabels: e.target.checked })} />
            </label>
            <label className="bsb-toggle-row">
              <span>Content-only swap</span>
              <input
                type="checkbox"
                checked={settings.contentOnlySwap}
                onChange={(e) => onUpdateSettings({ contentOnlySwap: e.target.checked })}
              />
            </label>
            <p className="bsb-hint">
              Drag a note's edge to grow/shrink how many cells it spans — blocked if it would overlap
              another note. Drag a note onto another to swap them. Empty cells stay empty; use Shuffle
              to generate a layout.
            </p>
          </>
        ) : (
          <p className="bsb-hint">
            Turns this board into a fixed-size grid, like Bento Studio — every note snaps to a uniform
            cell, and resizing changes how many cells that note spans.
          </p>
        )}
      </Section>

      <Section title="Shuffle" icon={<ShuffleIcon />} {...sectionProps("Shuffle")}>
        {settings.gridMode ? (
          <>
            <label className="bsb-field">
              <span className="bsb-field-label">
                Density <span className="bsb-field-val">{shuffleSettings.density}</span>
              </span>
              <input
                type="range"
                min={0}
                max={DENSITY_PRESETS.length - 1}
                value={Math.max(0, DENSITY_PRESETS.indexOf(shuffleSettings.density))}
                onChange={(e) => onUpdateShuffleSettings({ density: DENSITY_PRESETS[Number(e.target.value)] })}
              />
            </label>
            <label className="bsb-field">
              <span className="bsb-field-label">
                Symmetry <span className="bsb-field-val">{shuffleSettings.symmetry}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={shuffleSettings.symmetry}
                onChange={(e) => onUpdateShuffleSettings({ symmetry: Number(e.target.value) })}
              />
            </label>
            <label className="bsb-field">
              <span className="bsb-field-label">
                Hero size <span className="bsb-field-val">{shuffleSettings.heroSize}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={shuffleSettings.heroSize}
                onChange={(e) => onUpdateShuffleSettings({ heroSize: Number(e.target.value) })}
              />
            </label>
            <div className="bsb-row2">
              <label className="bsb-field">
                <span className="bsb-field-label">Min cols</span>
                <input
                  type="number"
                  className="bsb-number"
                  min={1}
                  max={settings.gridCols}
                  value={shuffleSettings.minCols}
                  onChange={(e) => onUpdateShuffleSettings({ minCols: Math.max(1, Number(e.target.value) || 1) })}
                />
              </label>
              <label className="bsb-field">
                <span className="bsb-field-label">Min rows</span>
                <input
                  type="number"
                  className="bsb-number"
                  min={1}
                  max={settings.gridRowCount}
                  value={shuffleSettings.minRows}
                  onChange={(e) => onUpdateShuffleSettings({ minRows: Math.max(1, Number(e.target.value) || 1) })}
                />
              </label>
            </div>
            <label className="bsb-field">
              <span className="bsb-field-label">Preferred orientation</span>
              <select
                className="bsb-select"
                value={shuffleSettings.orientation}
                onChange={(e) => onUpdateShuffleSettings({ orientation: e.target.value as ShuffleSettings["orientation"] })}
              >
                <option value="balanced">Balanced</option>
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
              </select>
            </label>
            <label className="bsb-field">
              <span className="bsb-field-label">Random seed</span>
              <div className="bsb-seed-row">
                <input
                  type="number"
                  className="bsb-number"
                  value={shuffleSettings.seed}
                  onChange={(e) => onUpdateShuffleSettings({ seed: Number(e.target.value) || 0 })}
                />
                <button
                  className="bsb-seed-reroll"
                  title="Reroll seed"
                  onClick={() => onUpdateShuffleSettings({ seed: Math.floor(Math.random() * 900000) + 100000 })}
                >
                  ↻
                </button>
              </div>
            </label>
            <div className="bsb-toggle-pair">
              <button
                className={`bsb-toggle-pill ${!shuffleUnlockedOnly ? "active" : ""}`}
                onClick={() => onUpdateShuffleUnlockedOnly(false)}
              >
                Whole layout
              </button>
              <button
                className={`bsb-toggle-pill ${shuffleUnlockedOnly ? "active" : ""}`}
                onClick={() => onUpdateShuffleUnlockedOnly(true)}
              >
                Unlocked only
              </button>
            </div>
            <button className="bsb-shuffle-btn" onClick={onShuffle}>
              Shuffle layout
            </button>
            <p className="bsb-hint">
              {noteCount < 1
                ? "Generates a fresh set of balanced boxes from the density setting."
                : `Re-splits the grid into ${noteCount} balanced span${noteCount === 1 ? "" : "s"} and re-assigns your notes. Same seed + settings always reproduces the same layout.`}
            </p>
          </>
        ) : (
          <>
        <label className="bsb-field">
          <span className="bsb-field-label">
            Symmetry <span className="bsb-field-val">{shuffleSettings.symmetry}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={shuffleSettings.symmetry}
            onChange={(e) => onUpdateShuffleSettings({ symmetry: Number(e.target.value) })}
          />
        </label>
        <label className="bsb-field">
          <span className="bsb-field-label">
            Hero size <span className="bsb-field-val">{shuffleSettings.heroSize}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={shuffleSettings.heroSize}
            onChange={(e) => onUpdateShuffleSettings({ heroSize: Number(e.target.value) })}
          />
        </label>
        <label className="bsb-field">
          <span className="bsb-field-label">Orientation</span>
          <select
            className="bsb-select"
            value={shuffleSettings.orientation}
            onChange={(e) => onUpdateShuffleSettings({ orientation: e.target.value as ShuffleSettings["orientation"] })}
          >
            <option value="balanced">Balanced</option>
            <option value="horizontal">Horizontal</option>
            <option value="vertical">Vertical</option>
          </select>
        </label>
        <div className="bsb-row2">
          <label className="bsb-field">
            <span className="bsb-field-label">Min width</span>
            <input
              type="number"
              className="bsb-number"
              min={60}
              value={shuffleSettings.minWidth}
              onChange={(e) => onUpdateShuffleSettings({ minWidth: Number(e.target.value) })}
            />
          </label>
          <label className="bsb-field">
            <span className="bsb-field-label">Min height</span>
            <input
              type="number"
              className="bsb-number"
              min={60}
              value={shuffleSettings.minHeight}
              onChange={(e) => onUpdateShuffleSettings({ minHeight: Number(e.target.value) })}
            />
          </label>
        </div>
        <label className="bsb-field">
          <span className="bsb-field-label">
            Spacing <span className="bsb-field-val">{shuffleSettings.spacing}px</span>
          </span>
          <input
            type="range"
            min={0}
            max={40}
            value={shuffleSettings.spacing}
            onChange={(e) => onUpdateShuffleSettings({ spacing: Number(e.target.value) })}
          />
        </label>
        <div className="bsb-toggle-pair">
          <button
            className={`bsb-toggle-pill ${!shuffleUnlockedOnly ? "active" : ""}`}
            onClick={() => onUpdateShuffleUnlockedOnly(false)}
          >
            Whole layout
          </button>
          <button
            className={`bsb-toggle-pill ${shuffleUnlockedOnly ? "active" : ""}`}
            onClick={() => onUpdateShuffleUnlockedOnly(true)}
          >
            Unlocked only
          </button>
        </div>
        <button className="bsb-shuffle-btn" onClick={onShuffle} disabled={noteCount < 2}>
          Shuffle layout
        </button>
        <p className="bsb-hint">
          {noteCount < 2
            ? "Add at least 2 notes to shuffle."
            : shuffleUnlockedOnly
              ? "Keeps locked notes (right-click a note → Lock) exactly where they are and only re-arranges the rest."
              : `Re-arranges all ${noteCount} notes into a fresh balanced layout. Keeps their content, just moves/resizes them.`}
        </p>
          </>
        )}
      </Section>

      <Section title="Templates" icon={<TemplatesIcon />} {...sectionProps("Templates")}>
        {settings.gridMode ? (
          <p className="bsb-hint">Not available in Grid canvas mode — turn that off above to use freeform Templates.</p>
        ) : (
          <>
        <p className="bsb-count-label">
          {noteCount < 1 ? "No notes yet" : `${noteCount} note${noteCount === 1 ? "" : "s"} on this board`}
        </p>
        <div className="tpl-grid-scroll">
          <div className="tpl-grid">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                className="tpl-btn"
                disabled={noteCount < 1}
                onClick={() => onApplyTemplate(t.id)}
                title={t.name}
              >
                <TemplatePreview id={t.id} count={noteCount} />
                <span className="tpl-name">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="bsb-hint">
          {noteCount < 1
            ? "Add a note first."
            : `Shapes adapt to your ${noteCount} note${noteCount === 1 ? "" : "s"} — patterns tile themselves to cover larger counts instead of leaving notes untouched.`}
        </p>
          </>
        )}
      </Section>

      <Section title="Corners & resize" icon={<CornersIcon />} {...sectionProps("Corners & resize")}>
        <div className="corner-grid">
          {CORNER_STYLE_OPTIONS.map((c) => (
            <button
              key={c.id}
              className={`corner-btn ${settings.cornerStyle === c.id ? "active" : ""}`}
              onClick={() => onUpdateSettings({ cornerStyle: c.id })}
              title={c.label}
            >
              <span className={`corner-swatch note-shape--${c.id}`} />
              <span className="corner-label">{c.label}</span>
            </button>
          ))}
        </div>
        {settings.cornerStyle !== "square" && settings.cornerStyle !== "squircle" && (
          <label className="bsb-field">
            <span className="bsb-field-label">
              Radius <span className="bsb-field-val">{settings.cornerRadius}px</span>
            </span>
            <input
              type="range"
              min={0}
              max={40}
              value={settings.cornerRadius}
              onChange={(e) => onUpdateSettings({ cornerRadius: Number(e.target.value) })}
            />
          </label>
        )}
        <label className="bsb-toggle-row">
          <span>Lock aspect ratio when resizing</span>
          <input
            type="checkbox"
            checked={settings.lockAspectRatio}
            onChange={(e) => onUpdateSettings({ lockAspectRatio: e.target.checked })}
          />
        </label>
        <p className="bsb-hint">
          {settings.lockAspectRatio
            ? "Resizing keeps a note's proportions (perspective) fixed."
            : "Resizing is freeform — width and height move independently."}
        </p>
      </Section>

      <Section title="Composition" icon={<CompositionIcon />} {...sectionProps("Composition")}>
        {!selectedImage ? (
          <p className="bsb-hint">Select an image note on the canvas to adjust it — position, zoom, rotation, flip, opacity.</p>
        ) : (
          (() => {
            const t = selectedImage.transform ?? DEFAULT_MEDIA_TRANSFORM;
            return (
              <>
                <label className="bsb-field">
                  <span className="bsb-field-label">Fit</span>
                  <select
                    className="bsb-select"
                    value={t.fit}
                    onChange={(e) => onUpdateImageTransform({ fit: e.target.value as MediaFit })}
                  >
                    <option value="cover">Cover</option>
                    <option value="contain">Contain</option>
                    <option value="fill">Fill</option>
                  </select>
                </label>
                <label className="bsb-field">
                  <span className="bsb-field-label">
                    Zoom <span className="bsb-field-val">{Math.round(t.scale * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min={50}
                    max={400}
                    value={Math.round(t.scale * 100)}
                    onChange={(e) => onUpdateImageTransform({ scale: Number(e.target.value) / 100 })}
                  />
                </label>
                <label className="bsb-field">
                  <span className="bsb-field-label">
                    X position <span className="bsb-field-val">{t.x}%</span>
                  </span>
                  <input
                    type="range"
                    min={-80}
                    max={80}
                    value={t.x}
                    onChange={(e) => onUpdateImageTransform({ x: Number(e.target.value) })}
                  />
                </label>
                <label className="bsb-field">
                  <span className="bsb-field-label">
                    Y position <span className="bsb-field-val">{t.y}%</span>
                  </span>
                  <input
                    type="range"
                    min={-80}
                    max={80}
                    value={t.y}
                    onChange={(e) => onUpdateImageTransform({ y: Number(e.target.value) })}
                  />
                </label>
                <label className="bsb-field">
                  <span className="bsb-field-label">
                    Rotation <span className="bsb-field-val">{t.rotation}°</span>
                  </span>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={t.rotation}
                    onChange={(e) => onUpdateImageTransform({ rotation: Number(e.target.value) })}
                  />
                </label>
                <div className="bsb-row2">
                  <label className="bsb-toggle-row">
                    <span>Flip H</span>
                    <input
                      type="checkbox"
                      checked={t.flipH}
                      onChange={(e) => onUpdateImageTransform({ flipH: e.target.checked })}
                    />
                  </label>
                  <label className="bsb-toggle-row">
                    <span>Flip V</span>
                    <input
                      type="checkbox"
                      checked={t.flipV}
                      onChange={(e) => onUpdateImageTransform({ flipV: e.target.checked })}
                    />
                  </label>
                </div>
                <label className="bsb-field">
                  <span className="bsb-field-label">
                    Opacity <span className="bsb-field-val">{Math.round(t.opacity * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(t.opacity * 100)}
                    onChange={(e) => onUpdateImageTransform({ opacity: Number(e.target.value) / 100 })}
                  />
                </label>
                <label className="bsb-field">
                  <span className="bsb-field-label">Background (behind "contain")</span>
                  <input
                    type="color"
                    className="bsb-color"
                    value={t.bg}
                    onChange={(e) => onUpdateImageTransform({ bg: e.target.value })}
                  />
                </label>
                <button
                  className="bsb-shuffle-btn"
                  onClick={() => onUpdateImageTransform(DEFAULT_MEDIA_TRANSFORM)}
                >
                  Reset
                </button>
              </>
            );
          })()
        )}
      </Section>

      <Section title="Presentation" icon={<PresentationIcon />} {...sectionProps("Presentation")}>
        <label className="bsb-field">
          <span className="bsb-field-label">Direction</span>
          <select
            className="bsb-select"
            value={presentationSettings.direction}
            onChange={(e) =>
              onUpdatePresentationSettings({ direction: e.target.value as PresentationSettings["direction"] })
            }
          >
            <option value="left">Left</option>
            <option value="right">Right</option>
            <option value="up">Up</option>
            <option value="down">Down</option>
          </select>
        </label>
        <label className="bsb-field">
          <span className="bsb-field-label">
            Slide speed <span className="bsb-field-val">{presentationSettings.slideSpeed.toFixed(2)}s</span>
          </span>
          <input
            type="range"
            min={0.2}
            max={2}
            step={0.05}
            value={presentationSettings.slideSpeed}
            onChange={(e) => onUpdatePresentationSettings({ slideSpeed: Number(e.target.value) })}
          />
        </label>
        <label className="bsb-field">
          <span className="bsb-field-label">
            Hold pacing <span className="bsb-field-val">{presentationSettings.holdPacing.toFixed(1)}s</span>
          </span>
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={presentationSettings.holdPacing}
            onChange={(e) => onUpdatePresentationSettings({ holdPacing: Number(e.target.value) })}
          />
        </label>
        <label className="bsb-toggle-row">
          <span>Auto-play on open</span>
          <input
            type="checkbox"
            checked={presentationSettings.autoPlay}
            onChange={(e) => onUpdatePresentationSettings({ autoPlay: e.target.checked })}
          />
        </label>
        <button className="bsb-shuffle-btn" onClick={onPresent} disabled={noteCount < 1}>
          Present
        </button>
        <p className="bsb-hint">Full-screen, step through your notes — great for showing a board to a client.</p>
      </Section>

      <Section title="Draw" icon={<DrawIcon />} {...sectionProps("Draw")}>
        <label className="bsb-toggle-row">
          <span>Draw to create</span>
          <input type="checkbox" checked={drawMode} onChange={onToggleDrawMode} />
        </label>
        <p className="bsb-hint">
          {drawMode
            ? "Drag anywhere on the canvas, then choose Text or Shape for what you drew. Shapes open their color picker right away."
            : "Turn on, then drag on empty canvas to draw a box instead of clicking + Text."}
        </p>

        <div className="bsb-divider" />

        <label className="bsb-toggle-row">
          <span>Pen tool</span>
          <input type="checkbox" checked={penMode} onChange={onTogglePenMode} />
        </label>
        {penMode && (
          <>
            <div className="drawing-note-colors">
              {DRAWING_COLORS.map((c) => (
                <button
                  key={c}
                  className={`shape-note-color-btn ${penColor === c ? "active" : ""}`}
                  style={{ background: c }}
                  onClick={() => onUpdatePenColor(c)}
                  title={c}
                />
              ))}
              <input
                type="color"
                className="shape-note-color-custom"
                value={penColor}
                onChange={(e) => onUpdatePenColor(e.target.value)}
                title="Custom color"
              />
            </div>
            <label className="bsb-field">
              <span className="bsb-field-label">
                Stroke width <span className="bsb-field-val">{penWidth}px</span>
              </span>
              <input
                type="range"
                min={1}
                max={14}
                value={penWidth}
                onChange={(e) => onUpdatePenWidth(Number(e.target.value))}
              />
            </label>
          </>
        )}
        <p className="bsb-hint">
          {penMode
            ? "Freehand — click and drag on the canvas to draw. Each stroke becomes its own resizable note."
            : "Turn on for freeform freehand drawing instead of boxes/shapes."}
        </p>
      </Section>

      <Section title="Export" icon={<ExportIcon />} {...sectionProps("Export")}>
        <label className="bsb-field">
          <span className="bsb-field-label">Filename</span>
          <input
            type="text"
            className="bsb-number"
            value={exportFilename}
            onChange={(e) => onUpdateExportFilename(e.target.value)}
            placeholder="board"
          />
        </label>
        <label className="bsb-field">
          <span className="bsb-field-label">Scale</span>
          <select
            className="bsb-select"
            value={exportScale}
            onChange={(e) => onUpdateExportScale(Number(e.target.value) as 1 | 2 | 3 | 4)}
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={3}>3x</option>
            <option value={4}>4x</option>
          </select>
        </label>
        <label className="bsb-toggle-row">
          <span>Transparent background</span>
          <input
            type="checkbox"
            checked={exportTransparent}
            onChange={(e) => onUpdateExportTransparent(e.target.checked)}
          />
        </label>
        <button className="bsb-shuffle-btn" onClick={onExportImage} disabled={noteCount < 1 || exporting}>
          {exporting ? "Exporting…" : "Export image (PNG)"}
        </button>
        <p className="bsb-hint">Captures all notes on the board (not just what's on screen) as a PNG.</p>

        <div className="bsb-divider" />

        <label className="bsb-field">
          <span className="bsb-field-label">Video resolution</span>
          <select
            className="bsb-select"
            value={videoResolution}
            onChange={(e) => onUpdateVideoResolution(e.target.value as VideoResolution)}
          >
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
            <option value="1440p">1440p</option>
            <option value="2160p">2160p (4K)</option>
          </select>
        </label>
        <label className="bsb-field">
          <span className="bsb-field-label">FPS</span>
          <select className="bsb-select" value={videoFps} onChange={(e) => onUpdateVideoFps(Number(e.target.value) as 24 | 30 | 60)}>
            <option value={24}>24</option>
            <option value={30}>30</option>
            <option value={60}>60</option>
          </select>
        </label>
        <button className="bsb-shuffle-btn" onClick={onExportVideo} disabled={noteCount < 1 || videoExporting}>
          {videoExporting ? `Recording… ${Math.round(videoProgress * 100)}%` : "Export video (MP4/WebM)"}
        </button>
        <p className="bsb-hint">
          Records a walkthrough of your notes using the Presentation settings above (direction, slide speed, hold
          pacing). Uses MP4 where the browser supports it, WebM otherwise.
        </p>
      </Section>
    </aside>
  );
}
