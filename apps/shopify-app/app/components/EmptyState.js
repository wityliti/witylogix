/**
 * EmptyState — Empty state component for lists and tables.
 *
 * BFS certification requires every list to have an empty state with CTA.
 * This component provides a consistent empty state pattern across the app.
 */
export function EmptyState({ title, description, actionLabel, actionUrl, onAction, }) {
    return (<div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 20px",
            textAlign: "center",
        }}>
      {/* Placeholder illustration */}
      <div style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            backgroundColor: "var(--p-color-bg-surface-hover, #f1f2f3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
        }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 4C12.96 4 4 12.96 4 24s8.96 20 20 20 20-8.96 20-20S35.04 4 24 4zm-2 30v-4h4v4h-4zm0-8V14h4v12h-4z" fill="var(--p-color-icon-subdued, #8c9196)"/>
        </svg>
      </div>

      <h3 style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--p-color-text, #202223)",
            margin: "0 0 8px",
        }}>
        {title}
      </h3>

      {description && (<p style={{
                fontSize: 14,
                color: "var(--p-color-text-subdued, #6d7175)",
                margin: "0 0 20px",
                maxWidth: 400,
            }}>
          {description}
        </p>)}

      {(actionLabel && (actionUrl || onAction)) && (actionUrl ? (<a href={actionUrl} style={actionButtonStyle}>
            {actionLabel}
          </a>) : (<button onClick={onAction} style={actionButtonStyle} type="button">
            {actionLabel}
          </button>))}
    </div>);
}
const actionButtonStyle = {
    display: "inline-block",
    padding: "8px 20px",
    fontSize: 14,
    fontWeight: 500,
    color: "white",
    backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    textDecoration: "none",
};
//# sourceMappingURL=EmptyState.js.map