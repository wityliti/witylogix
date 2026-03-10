import { notFound } from 'next/navigation';
import { docs } from '@/source.config';
import { getPage, getPages } from 'fumadocs-core/source';
import type { Metadata } from 'next';

interface PageParams {
  slug: string[];
}

interface PageProps {
  params: Promise<PageParams>;
}

export async function generateStaticParams(): Promise<PageParams[]> {
  return getPages(docs).map((page) => ({
    slug: page.file.split('/').slice(1),
  }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getPage(docs, slug);

  if (!page) {
    return {};
  }

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      title: page.data.title,
      description: page.data.description,
      type: 'article',
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const page = getPage(docs, slug);

  if (!page) {
    notFound();
  }

  const MDX = page.data.body;

  return (
    <article className="max-w-4xl mx-auto px-4 py-8 prose prose-invert">
      <h1 className="text-wl-text">{page.data.title}</h1>
      {page.data.description && (
        <p className="text-wl-text-secondary">{page.data.description}</p>
      )}
      <div className="text-wl-text">
        <MDX />
      </div>
    </article>
  );
}
