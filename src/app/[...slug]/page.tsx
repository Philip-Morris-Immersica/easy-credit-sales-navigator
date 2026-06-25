import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { NavigatorShell } from "@/components/navigator/NavigatorShell";
import { ContentRenderer } from "@/components/navigator/ContentRenderer";
import { CardGrid } from "@/components/navigator/CardGrid";
import { PreparationAccordion } from "@/components/navigator/PreparationAccordion";
import { StageList } from "@/components/navigator/StageList";
import { StageNav } from "@/components/navigator/StageNav";
import { ScreenHeader } from "@/components/navigator/ScreenHeader";
import {
  activeConfig,
  findNodeBySlugPath,
  getAllSlugPaths,
} from "@/content";

export async function generateStaticParams() {
  return getAllSlugPaths().map((slugPath) => ({ slug: slugPath }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const node = findNodeBySlugPath(slug);
  if (!node) return {};
  return {
    title: `${node.title} — ${activeConfig.title}`,
  };
}

export default async function NavigatorPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const node = findNodeBySlugPath(slug);

  if (!node) notFound();

  const directionSlug = slug[0];
  const parentSlugPath = "/" + slug.join("/");
  const parentHref = "/" + slug.slice(0, -1).join("/");

  const hasChildren = (node.children?.length ?? 0) > 0;
  const hasContent = (node.content?.length ?? 0) > 0;

  // Resolve parent node to know its layout
  const parentNode =
    slug.length > 1 ? findNodeBySlugPath(slug.slice(0, -1)) : null;
  const parentLayout = parentNode?.layout ?? null;

  return (
    <NavigatorShell directionSlug={directionSlug}>
      {hasChildren ? (
        node.layout === "accordion" ? (
          <PreparationAccordion node={node} parentSlugPath={parentSlugPath} />
        ) : node.layout === "stages" ? (
          <StageList node={node} parentSlugPath={parentSlugPath} />
        ) : (
          <CardGrid node={node} parentSlugPath={parentSlugPath} />
        )
      ) : hasContent ? (
        parentLayout === "accordion" && node.renderAs !== "button" ? (
          /* Accordion child opened directly — show the parent accordion with this item expanded */
          <PreparationAccordion
            node={parentNode!}
            parentSlugPath={parentHref}
            initialOpenSlug={node.slug}
          />
        ) : parentLayout === "stages" ? (
          /* Stage detail page: horizontal tab nav + content */
          <>
            <StageNav
              stages={parentNode!.children!}
              parentHref={parentHref}
            />
            <ContentRenderer
              blocks={node.content!}
              title={node.title}
              icon={node.icon}
              iconAccent={node.iconAccent}
              iconImage={node.iconImage}
            />
          </>
        ) : (
          /* Regular detail page: X/back header + content */
          <>
            <ScreenHeader
              title={node.title}
              icon={node.icon}
              iconAccent={node.iconAccent}
              iconImage={node.iconImage}
              backHref={parentHref}
            />
            <ContentRenderer
              blocks={node.content!}
              title={node.title}
              icon={node.icon}
              iconAccent={node.iconAccent}
              iconImage={node.iconImage}
              hideTitle
            />
          </>
        )
      ) : (
        <PlaceholderScreen title={node.title} parentHref={parentHref} />
      )}
    </NavigatorShell>
  );
}

function PlaceholderScreen({
  title,
  parentHref,
}: {
  title: string;
  parentHref: string;
}) {
  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <ScreenHeader title={title} backHref={parentHref} />
      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center text-sm text-foreground/50">
        Съдържанието за тази секция ще бъде добавено скоро.
      </div>
    </div>
  );
}
