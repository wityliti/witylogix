import { ReactNode } from "react";

interface CollaborationLayoutProps {
  children: ReactNode;
}

export default function CollaborationLayout({ children }: CollaborationLayoutProps) {
  return <>{children}</>;
}
