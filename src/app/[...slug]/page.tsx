import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { NavigatorShell } from "@/components/navigator/NavigatorShell";
import { ContentRenderer } from "@/components/navigator/ContentRenderer";
import { CardGrid } from "@/components/navigator/CardGrid";
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
  const parentHref = "/" + slug.slice(0, -1).join("/");

  const hasChildren = (node.children?.length ?? 0) > 0;
  const hasContent = (node.content?.length ?? 0) > 0;

  return (
    <NavigatorShell directionSlug={directionSlug}>
      {hasChildren ? (
        <CardGrid node={node} parentSlugPath={"/" + slug.join("/")} />
      ) : hasContent ? (
        <ContentRenderer
          blocks={node.content!}
          title={node.title}
          icon={node.icon}
        />
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
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center text-sm text-foreground/50">
        Съдържанието за тази секция ще бъде добавено в Фаза 2.
      </div>
    </div>
  );
}
