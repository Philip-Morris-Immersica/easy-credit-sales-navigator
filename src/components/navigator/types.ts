export type LayoutKind =
  | "text"       // Heading + goal + bullet list (standard content screen)
  | "cards"      // Grid of clickable cards (e.g. Client Types, Scenarios)
  | "steps"      // Numbered steps with sub-items
  | "checklist"  // Checklist items
  | "placeholder"; // Not yet filled

export interface ContentBlock {
  type: "goal" | "heading" | "subheading" | "bullets" | "checklist" | "paragraph" | "note" | "techniques";
  text?: string;
  items?: string[];
}

export interface NavNode {
  id: string;
  slug: string;          // URL-safe English slug (e.g. "call", "preparation")
  title: string;         // Bulgarian display title
  icon?: string;         // Lucide icon name (PascalCase)
  layout: LayoutKind;
  content?: ContentBlock[];
  children?: NavNode[];
  /** For card-layout nodes: each child shows as a clickable card */
  cardDescription?: string;
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
