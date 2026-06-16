export type LayoutKind =
  | "text"        // Heading + goal + bullet list (standard content screen)
  | "cards"       // Grid of clickable cards (e.g. Client Types, Scenarios)
  | "steps"       // Numbered steps with sub-items
  | "checklist"   // Checklist items
  | "accordion"   // One-open-at-a-time accordion (e.g. Подготовка contact types)
  | "stages"      // Vertical stage list + horizontal tab navigator on detail pages
  | "placeholder"; // Not yet filled

// ─── Leaf content blocks (no nesting) ──────────────────────────────────────

interface GoalBlock       { type: "goal";       text: string }
interface HeadingBlock    { type: "heading";     text: string }
interface SubheadingBlock { type: "subheading";  text: string }
interface ParagraphBlock  { type: "paragraph";   text: string }
interface NoteBlock       { type: "note";        text: string }
interface BulletsBlock    { type: "bullets";     items: string[] }
interface ChecklistBlock  { type: "checklist";   items: string[] }
interface TechniquesBlock { type: "techniques";  text?: string; items: string[] }

/** Key-value pairs — for persona metadata (Тип контакт, Персонаж, Цел…) */
export interface FieldsBlock {
  type: "fields";
  rows: { label: string; value: string }[];
}

/** Dialogue lines — for example openings / example replies */
export interface DialogueBlock {
  type: "dialogue";
  /** Optional label above the block (e.g. "Примерно отваряне") */
  label?: string;
  lines: string[];
}

/** Action buttons — Тренирай (disabled) + Видео (optional url) */
export interface ActionsBlock {
  type: "actions";
  /** Show disabled "Тренирай" button when true */
  trainDisabled?: boolean;
  /** When present shows "Видео" button; null = placeholder, string = real URL */
  videoUrl?: string | null;
}

// ─── Container blocks (nesting) ────────────────────────────────────────────

/** Collapsible accordion section — e.g. "Примерен разговор" */
export interface CollapsibleBlock {
  type: "collapsible";
  label: string;
  blocks: ContentBlock[];
}

/** Tabs — desktop Tabs / mobile accordion — e.g. Теми/Въпроси/Нужди */
export interface TabsBlock {
  type: "tabs";
  tabs: { label: string; blocks: ContentBlock[] }[];
}

// ─── Union ──────────────────────────────────────────────────────────────────

export type ContentBlock =
  | GoalBlock
  | HeadingBlock
  | SubheadingBlock
  | ParagraphBlock
  | NoteBlock
  | BulletsBlock
  | ChecklistBlock
  | TechniquesBlock
  | FieldsBlock
  | DialogueBlock
  | ActionsBlock
  | CollapsibleBlock
  | TabsBlock;

export interface NavNode {
  id: string;
  slug: string;          // URL-safe English slug (e.g. "call", "preparation")
  title: string;         // Bulgarian display title
  icon?: string;         // Lucide icon name (PascalCase) — grey subject of the duotone icon
  iconAccent?: string;   // Lucide icon name for the red accent (defaults per base in DuotoneIcon)
  iconImage?: string;    // Deprecated 3D PNG path — no longer rendered (flat duotone icons used instead)
  layout: LayoutKind;
  content?: ContentBlock[];
  children?: NavNode[];
  /** For card-layout nodes: each child shows as a clickable card */
  cardDescription?: string;
  /** For children of an accordion node: "button" renders as a footer link-button rather than an inline accordion panel */
  renderAs?: "accordion" | "button";
}

export interface NavigatorTheme {
  id: string;
  name: string;
  logoRed: string;
  logoWhite: string;
  /** Partner/credit logo shown in the home footer (e.g. Immersica) */
  partnerLogo?: string;
  partnerName?: string;
  /** CSS var overrides (optional, for future use) */
  colors?: Record<string, string>;
}

export interface NavigatorConfig {
  id: string;
  title: string;
  subtitle?: string;
  theme: NavigatorTheme;
  /** Top-level direction nodes (e.g. Call, Meeting) */
  directions: NavNode[];
}
