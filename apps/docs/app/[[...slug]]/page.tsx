'use client';

import { DocsPage, DocsBody, DocsBreadcrumb, DocsDescription, DocsTitle } from 'fumadocs-ui/page';
import { NotFound } from 'fumadocs-ui/components/not-found';
import { Toc } from 'fumadocs-ui/components/toc';
import { getPage, getPages } from '@/source.config';
import type { Metadata } from 'next';
import { Heading } from 'fumadocs-ui/components/heading';
import { SearchDialog } from '@/app/components/search-dialog';

interface PageProps {
  params: {
    slug?: string[];
  };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const page = getPage(params.slug);

  if (!page) {
    return {
      title: 'Page Not Found',
    };
  }

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      title: page.data.title,
      description: page.data.description,
      type: 'article',
      url: `https://docs.witylogix.com/docs/${params.slug?.join('/')}`,
    },
  };
}

export async function generateStaticParams() {
  return getPages().map((page) => ({
    slug: page.slugs,
  }));
}

export default function Page({ params }: PageProps) {
  const page = getPage(params.slug);

  if (!page) {
    return <NotFound />;
  }

  const pages = getPages();
  const allHeadings = page.data.exports.toc ?? [];

  return (
    <DocsPage>
      <div className="flex gap-12">
        <div className="flex-1 min-w-0">
          <DocsBreadcrumb
            items={getBreadcrumbs(params.slug)}
            className="mb-4"
          />
          <DocsTitle>{page.data.title}</DocsTitle>
          {page.data.description && (
            <DocsDescription>{page.data.description}</DocsDescription>
          )}
          <DocsBody>
            {page.data.body}
          </DocsBody>
        </div>
        <div className="hidden xl:block w-64 flex-shrink-0">
          <div className="sticky top-20 space-y-6">
            <SearchDialog />
            {allHeadings.length > 0 && (
              <div>
                <Heading level={4} className="mb-4 text-sm font-semibold">
                  On this page
                </Heading>
                <Toc items={allHeadings} />
              </div>
            )}
          </div>
        </div>
      </div>
    </DocsPage>
  );
}

function getBreadcrumbs(slug?: string[]) {
  if (!slug) {
    return [{ text: 'Home', url: '/' }];
  }

  const items = [{ text: 'Home', url: '/' }];

  slug.forEach((segment, index) => {
    const url = `/docs/${slug.slice(0, index + 1).join('/')}`;
    const text = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
    items.push({ text, url });
  });

  return items;
}
