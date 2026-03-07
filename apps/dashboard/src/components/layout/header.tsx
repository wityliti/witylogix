"use client";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--wl-space-5) var(--wl-space-6)",
        borderBottom: "1px solid var(--wl-border-subtle)",
        background: "var(--wl-bg-surface)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <div>
        <h1
          style={{
            fontSize: "var(--wl-text-xl)",
            fontWeight: 700,
            color: "var(--wl-text-primary)",
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: "var(--wl-text-sm)",
              color: "var(--wl-text-tertiary)",
              margin: "2px 0 0 0",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-3)" }}>
          {actions}
        </div>
      )}
    </header>
  );
}
