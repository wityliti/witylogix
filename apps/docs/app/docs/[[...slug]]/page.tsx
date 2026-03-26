import { source } from '@/lib/source';
import { notFound } from 'next/navigation';
import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
} from 'fumadocs-ui/page';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Card, Cards } from 'fumadocs-ui/components/card';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage
      toc={page.data.toc}
      tableOfContent={{
        style: 'clerk',
      }}
    >
      <div className="animate-fade-up">
        <DocsTitle className="font-display !text-sand !tracking-tight">
          {page.data.title}
        </DocsTitle>
        {page.data.description && (
          <DocsDescription className="!text-sand-muted !text-base !leading-relaxed">
            {page.data.description}
          </DocsDescription>
        )}
      </div>
      <DocsBody className="prose prose-invert max-w-none [&_h2]:font-display [&_h2]:text-sand [&_h2]:border-b [&_h2]:border-forge-border [&_h2]:pb-3 [&_h2]:mb-6 [&_h3]:font-display [&_h3]:text-sand [&_h4]:font-display [&_h4]:text-sand [&_a]:text-ember [&_a]:no-underline hover:[&_a]:text-ember-light [&_a]:font-medium [&_strong]:text-sand [&_code]:text-ember-light [&_code]:bg-forge-elevated [&_code]:border [&_code]:border-forge-border [&_code]:rounded-md [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.8125rem] [&_pre]:!bg-forge-surface [&_pre]:border [&_pre]:border-forge-border [&_pre]:rounded-xl [&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_blockquote]:border-l-ember [&_blockquote]:bg-ember/5 [&_blockquote]:rounded-r-lg [&_table_th]:bg-forge-elevated [&_table_td]:border-forge-border [&_table_th]:border-forge-border [&_hr]:border-forge-border [&_li]:marker:text-ember">
        <MDX components={{ ...defaultMdxComponents, Card, Cards }} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) return {};

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
