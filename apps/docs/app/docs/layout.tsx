import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/source";
import Image from "next/image";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: (
          <span className="flex items-center gap-2.5">
            <Image
              src="/logo.svg"
              alt="Witylogix"
              width={28}
              height={28}
              className="rounded-md"
            />
            <span className="font-display font-bold text-sand tracking-tight">
              Witylogix
            </span>
          </span>
        ),
      }}
      sidebar={{
        defaultOpenLevel: 0,
      }}
      links={[
        {
          text: "GitHub",
          url: "https://github.com/wityliti/witylogix",
        },
      ]}
    >
      {children}
    </DocsLayout>
  );
}
