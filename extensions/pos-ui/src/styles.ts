// @ts-nocheck

/**
 * POS-optimized styles using CSS-in-JS
 * Larger touch targets, readable fonts, dark/light theme support
 */

import type { ThemeTokens } from "@witylogix/extension-core";

export function createStyles(tokens: ThemeTokens) {
  const isDark = tokens.colorScheme === "dark";

  return {
    // Container styles
    container: {
      fontFamily: tokens.typography.fontSans,
      fontSize: tokens.typography.sizes.base,
      color: tokens.colors.text.primary,
      backgroundColor: tokens.colors.background.root,
      padding: tokens.spacing[4],
      minHeight: "100vh",
      lineHeight: tokens.typography.weights.normal,
    },

    // Section container
    section: {
      padding: tokens.spacing[6],
      marginBottom: tokens.spacing[6],
      backgroundColor: tokens.colors.background.surface,
      borderRadius: tokens.radii.lg,
      border: `1px solid ${tokens.colors.border.default}`,
    },

    // Section title
    sectionTitle: {
      fontSize: tokens.typography.sizes.lg,
      fontWeight: tokens.typography.weights.semibold,
      color: tokens.colors.text.primary,
      marginBottom: tokens.spacing[4],
      lineHeight: 1.2,
    },

    // Label
    label: {
      fontSize: tokens.typography.sizes.sm,
      fontWeight: tokens.typography.weights.medium,
      color: tokens.colors.text.primary,
      marginBottom: tokens.spacing[2],
      display: "block",
    },

    // Search input - large touch target for POS
    searchInput: {
      width: "100%",
      padding: tokens.spacing[4],
      fontSize: tokens.typography.sizes.base,
      fontFamily: tokens.typography.fontSans,
      borderRadius: tokens.radii.md,
      border: `2px solid ${tokens.colors.border.default}`,
      backgroundColor: tokens.colors.background.elevated,
      color: tokens.colors.text.primary,
      transition: "all 0.2s ease",
      boxSizing: "border-box",
      "&:focus": {
        outline: "none",
        borderColor: tokens.colors.primary[500],
        boxShadow: `0 0 0 4px ${tokens.colors.primary[600]}33`,
      },
      "&::placeholder": {
        color: tokens.colors.text.tertiary,
      },
    },

    // Button - POS-sized (touch friendly)
    button: {
      padding: `${tokens.spacing[4]} ${tokens.spacing[6]}`,
      fontSize: tokens.typography.sizes.base,
      fontWeight: tokens.typography.weights.medium,
      borderRadius: tokens.radii.md,
      border: "none",
      cursor: "pointer",
      transition: "all 0.2s ease",
      fontFamily: tokens.typography.fontSans,
      minHeight: "44px",
      minWidth: "44px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },

    // Primary button
    buttonPrimary: {
      backgroundColor: tokens.colors.primary[500],
      color: tokens.colors.text.inverse,
      "&:hover": {
        backgroundColor: tokens.colors.primary[600],
      },
      "&:active": {
        transform: "scale(0.98)",
      },
      "&:disabled": {
        backgroundColor: tokens.colors.neutral[500],
        cursor: "not-allowed",
        opacity: 0.6,
      },
    },

    // Secondary button
    buttonSecondary: {
      backgroundColor: tokens.colors.background.elevated,
      color: tokens.colors.text.primary,
      border: `2px solid ${tokens.colors.border.default}`,
      "&:hover": {
        backgroundColor: tokens.colors.background.elevated,
        borderColor: tokens.colors.border.strong,
      },
    },

    // Dropdown/Select
    select: {
      width: "100%",
      padding: tokens.spacing[3],
      fontSize: tokens.typography.sizes.base,
      fontFamily: tokens.typography.fontSans,
      borderRadius: tokens.radii.md,
      border: `2px solid ${tokens.colors.border.default}`,
      backgroundColor: tokens.colors.background.elevated,
      color: tokens.colors.text.primary,
      cursor: "pointer",
      transition: "all 0.2s ease",
      boxSizing: "border-box",
      "&:focus": {
        outline: "none",
        borderColor: tokens.colors.primary[500],
      },
    },

    // Results list
    resultsList: {
      maxHeight: "400px",
      overflowY: "auto",
      border: `1px solid ${tokens.colors.border.default}`,
      borderRadius: tokens.radii.md,
      marginTop: tokens.spacing[3],
    },

    // Result item (order)
    resultItem: {
      padding: tokens.spacing[4],
      borderBottom: `1px solid ${tokens.colors.border.subtle}`,
      cursor: "pointer",
      transition: "all 0.2s ease",
      backgroundColor: tokens.colors.background.surface,
      "&:hover": {
        backgroundColor: tokens.colors.background.elevated,
      },
      "&:last-child": {
        borderBottom: "none",
      },
    },

    // Order item header
    resultItemHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: tokens.spacing[2],
    },

    // Order number/title
    orderNumber: {
      fontSize: tokens.typography.sizes.base,
      fontWeight: tokens.typography.weights.semibold,
      color: tokens.colors.text.primary,
    },

    // Status badge
    statusBadge: {
      display: "inline-block",
      padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
      fontSize: tokens.typography.sizes.xs,
      fontWeight: tokens.typography.weights.semibold,
      borderRadius: tokens.radii.full,
      whiteSpace: "nowrap",
    },

    statusBadgePending: {
      backgroundColor: tokens.colors.warning.bg,
      color: tokens.colors.warning[600],
    },

    statusBadgeConfirmed: {
      backgroundColor: tokens.colors.info.bg,
      color: tokens.colors.info[600],
    },

    statusBadgeReady: {
      backgroundColor: tokens.colors.success.bg,
      color: tokens.colors.success[600],
    },

    statusBadgeFulfilled: {
      backgroundColor: tokens.colors.success.bg,
      color: tokens.colors.success[600],
    },

    statusBadgeCancelled: {
      backgroundColor: tokens.colors.danger.bg,
      color: tokens.colors.danger[600],
    },

    // Order details
    orderDetails: {
      fontSize: tokens.typography.sizes.sm,
      color: tokens.colors.text.secondary,
      marginBottom: tokens.spacing[2],
    },

    // Total price
    totalPrice: {
      fontSize: tokens.typography.sizes.base,
      fontWeight: tokens.typography.weights.semibold,
      color: tokens.colors.text.primary,
    },

    // Loading spinner
    spinner: {
      display: "inline-block",
      width: "20px",
      height: "20px",
      border: `3px solid ${tokens.colors.border.default}`,
      borderTop: `3px solid ${tokens.colors.primary[500]}`,
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
    },

    // Error message
    errorMessage: {
      padding: tokens.spacing[4],
      marginBottom: tokens.spacing[4],
      backgroundColor: tokens.colors.danger.bg,
      color: tokens.colors.danger[600],
      borderRadius: tokens.radii.md,
      border: `1px solid ${tokens.colors.danger[400]}`,
      fontSize: tokens.typography.sizes.sm,
      lineHeight: 1.5,
    },

    // Success message
    successMessage: {
      padding: tokens.spacing[4],
      marginBottom: tokens.spacing[4],
      backgroundColor: tokens.colors.success.bg,
      color: tokens.colors.success[600],
      borderRadius: tokens.radii.md,
      border: `1px solid ${tokens.colors.success[400]}`,
      fontSize: tokens.typography.sizes.sm,
      lineHeight: 1.5,
    },

    // Form group
    formGroup: {
      marginBottom: tokens.spacing[6],
    },

    // Help text
    helpText: {
      fontSize: tokens.typography.sizes.xs,
      color: tokens.colors.text.tertiary,
      marginTop: tokens.spacing[1],
      lineHeight: 1.4,
    },

    // Divider
    divider: {
      height: "1px",
      backgroundColor: tokens.colors.border.subtle,
      margin: `${tokens.spacing[4]} 0`,
    },

    // Grid for layout
    grid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: tokens.spacing[4],
    },

    // Order summary card
    orderSummaryCard: {
      padding: tokens.spacing[6],
      backgroundColor: tokens.colors.background.elevated,
      borderRadius: tokens.radii.lg,
      border: `1px solid ${tokens.colors.border.default}`,
      marginBottom: tokens.spacing[6],
    },

    // Address block
    addressBlock: {
      padding: tokens.spacing[4],
      backgroundColor: tokens.colors.background.root,
      borderRadius: tokens.radii.md,
      border: `1px solid ${tokens.colors.border.subtle}`,
      fontSize: tokens.typography.sizes.sm,
      lineHeight: 1.6,
      color: tokens.colors.text.primary,
    },

    // Items list
    itemsList: {
      listStyle: "none",
      padding: 0,
      margin: 0,
    },

    // Item row
    itemRow: {
      display: "flex",
      justifyContent: "space-between",
      padding: tokens.spacing[2],
      borderBottom: `1px solid ${tokens.colors.border.subtle}`,
      fontSize: tokens.typography.sizes.sm,
      "&:last-child": {
        borderBottom: "none",
      },
    },

    // Item name
    itemName: {
      flex: 1,
    },

    // Item price
    itemPrice: {
      textAlign: "right",
      marginLeft: tokens.spacing[4],
      fontWeight: tokens.typography.weights.medium,
    },

    // Empty state
    emptyState: {
      padding: tokens.spacing[8],
      textAlign: "center",
      color: tokens.colors.text.secondary,
      fontSize: tokens.typography.sizes.base,
    },

    // Loading state
    loadingContainer: {
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      justifyContent: "center",
      padding: tokens.spacing[8],
      gap: tokens.spacing[3],
    },
  };
}

/**
 * Global styles for POS extension
 */
export const globalStyles = `
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
  }
`;
