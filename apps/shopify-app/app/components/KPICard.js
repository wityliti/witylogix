/**
 * KPICard — Key Performance Indicator card component.
 *
 * Displays a metric with title, value, trend delta, and optional
 * description. Used on the Dashboard home page in a 4-column grid.
 *
 * Follows Polaris design patterns — uses Polaris color tokens
 * and typography scale for consistency within the Shopify Admin.
 */
export function KPICard({ title, value, delta, deltaUnit = "", deltaPeriod = "vs yesterday", description, loading = false, }) {
    if (loading) {
        return (<div style={cardStyle}>
        <div style={skeletonLine(80, 12)}/>
        <div style={{ ...skeletonLine(120, 32), marginTop: 8 }}/>
        <div style={{ ...skeletonLine(100, 12), marginTop: 8 }}/>
      </div>);
    }
    const deltaColor = delta === undefined || delta === 0
        ? "var(--p-color-text-subdued, #6d7175)"
        : delta > 0
            ? "var(--p-color-text-success, #008060)"
            : "var(--p-color-text-critical, #d72c0d)";
    const deltaPrefix = delta !== undefined && delta > 0 ? "+" : "";
    return (<div style={cardStyle}>
      <div style={titleStyle}>{title}</div>
      <div style={valueStyle}>{value}</div>
      {delta !== undefined && (<div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
          <span style={{ color: deltaColor, fontSize: 13, fontWeight: 500 }}>
            {deltaPrefix}
            {delta}
            {deltaUnit}
          </span>
          <span style={subtextStyle}>{deltaPeriod}</span>
        </div>)}
      {description && <div style={{ ...subtextStyle, marginTop: 4 }}>{description}</div>}
    </div>);
}
// ─── Styles ────────────────────────────────────────────────
const cardStyle = {
    padding: 20,
    backgroundColor: "var(--p-color-bg-surface, white)",
    borderRadius: 12,
    border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
    boxShadow: "var(--p-shadow-sm, 0 1px 0 rgba(0,0,0,.05))",
};
const titleStyle = {
    fontSize: 13,
    fontWeight: 500,
    color: "var(--p-color-text-subdued, #6d7175)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
};
const valueStyle = {
    fontSize: 28,
    fontWeight: 700,
    color: "var(--p-color-text, #202223)",
    marginTop: 4,
    lineHeight: 1.2,
};
const subtextStyle = {
    fontSize: 12,
    color: "var(--p-color-text-subdued, #6d7175)",
};
function skeletonLine(width, height) {
    return {
        width,
        height,
        backgroundColor: "var(--p-color-bg-surface-hover, #f1f2f3)",
        borderRadius: 4,
        animation: "pulse 1.5s ease-in-out infinite",
    };
}
//# sourceMappingURL=KPICard.js.map