import type { MDXComponents } from "mdx/types";
import { Heading } from "fumadocs-ui/components/heading";
import Image from "next/image";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <Heading as="h1" className="text-4xl md:text-5xl font-bold mt-8 mb-4">
        {children}
      </Heading>
    ),
    h2: ({ children }) => (
      <Heading as="h2" className="text-3xl md:text-4xl font-bold mt-8 mb-4">
        {children}
      </Heading>
    ),
    h3: ({ children }) => (
      <Heading as="h3" className="text-2xl md:text-3xl font-bold mt-6 mb-3">
        {children}
      </Heading>
    ),
    h4: ({ children }) => (
      <Heading as="h4" className="text-xl md:text-2xl font-bold mt-6 mb-3">
        {children}
      </Heading>
    ),
    h5: ({ children }) => (
      <Heading as="h5" className="text-lg md:text-xl font-bold mt-4 mb-2">
        {children}
      </Heading>
    ),
    h6: ({ children }) => (
      <Heading as="h6" className="text-base md:text-lg font-bold mt-4 mb-2">
        {children}
      </Heading>
    ),
    p: ({ children }) => (
      <p className="text-wl-text leading-7 mb-4">{children}</p>
    ),
    a: ({ href, children, ...props }) => (
      <a
        href={href}
        className="text-wl-accent hover:text-wl-accent-light underline transition-colors"
        {...props}
      >
        {children}
      </a>
    ),
    ul: ({ children }) => (
      <ul className="list-disc list-inside space-y-2 mb-4 text-wl-text">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside space-y-2 mb-4 text-wl-text">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="ml-2">{children}</li>,
    code: ({ children, ...props }) => (
      <code
        className="bg-wl-bg-secondary px-2 py-1 rounded text-sm font-mono text-wl-accent"
        {...props}
      >
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="bg-wl-bg-secondary border border-wl-border rounded-lg p-4 overflow-x-auto mb-4">
        {children}
      </pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-wl-accent bg-wl-bg-secondary/50 pl-4 py-1 italic text-wl-text-secondary my-4">
        {children}
      </blockquote>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-wl-bg-secondary border-b border-wl-border">
        {children}
      </thead>
    ),
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => (
      <tr className="border-b border-wl-border hover:bg-wl-bg-secondary/50 transition-colors">
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2 text-left font-semibold text-wl-text">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 text-wl-text">{children}</td>
    ),
    hr: () => <hr className="my-8 border-wl-border" />,
    img: ({ src, alt, ...props }) => (
      <img
        src={src}
        alt={alt}
        className="rounded-lg max-w-full h-auto my-4 border border-wl-border"
        {...props}
      />
    ),
    ...components,
  };
}
