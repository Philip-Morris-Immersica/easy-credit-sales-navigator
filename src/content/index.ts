import type { NavNode, NavigatorConfig } from "@/components/navigator/types";
import { salesNavigatorTheme } from "./sales-navigator/theme";
import { callDirection, meetingDirection } from "./sales-navigator/tree";

export const salesNavigatorConfig: NavigatorConfig = {
  id: "sales-navigator",
  title: "Навигатор за продажбени умения",
  theme: salesNavigatorTheme,
  directions: [callDirection, meetingDirection],
};

/** Active config (swap this to clone for a different navigator) */
export const activeConfig = salesNavigatorConfig;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Find a node in the tree by its full slug array, e.g. ["call", "preparation", "contact-types"] */
export function findNodeBySlugPath(
  slugPath: string[],
  nodes: NavNode[] = activeConfig.directions
): NavNode | null {
  if (slugPath.length === 0) return null;
  const [head, ...rest] = slugPath;
  const match = nodes.find((n) => n.slug === head);
  if (!match) return null;
  if (rest.length === 0) return match;
  if (!match.children) return null;
  return findNodeBySlugPath(rest, match.children);
}

/** Collect every possible slug path (for generateStaticParams) */
export function getAllSlugPaths(
  nodes: NavNode[] = activeConfig.directions,
  prefix: string[] = []
): string[][] {
  const paths: string[][] = [];
  for (const node of nodes) {
    const current = [...prefix, node.slug];
    paths.push(current);
    if (node.children?.length) {
      paths.push(...getAllSlugPaths(node.children, current));
    }
  }
  return paths;
}

/** Get breadcrumb trail for a slug path */
export function getBreadcrumbs(
  slugPath: string[],
  nodes: NavNode[] = activeConfig.directions,
  trail: NavNode[] = []
): NavNode[] {
  if (slugPath.length === 0) return trail;
  const [head, ...rest] = slugPath;
  const match = nodes.find((n) => n.slug === head);
  if (!match) return trail;
  const newTrail = [...trail, match];
  if (rest.length === 0) return newTrail;
  if (!match.children) return newTrail;
  return getBreadcrumbs(rest, match.children, newTrail);
}
