import { ReactNode } from 'react';

interface MDXContentProps {
  children: ReactNode;
}

export function MDXContent({ children }: MDXContentProps) {
  return (
    <div className="prose prose-invert max-w-4xl mx-auto">
      {children}
    </div>
  );
}
