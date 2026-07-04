// @ts-nocheck

/**
 * Inline styles for the checkout extension
 * Uses CSS-in-JS and maps to Shopify design tokens where possible
 */

export const colors = {
  primary: "#f5a623", // Witylogix amber
  primaryDark: "#e09500",
  primaryLight: "#f9b84d",
  success: "#3d9970",
  warning: "#ff6b6b",
  neutral100: "#ffffff",
  neutral200: "#f5f5f5",
  neutral300: "#e8e8e8",
  neutral400: "#cccccc",
  neutral500: "#999999",
  neutral600: "#666666",
  neutral700: "#333333",
  neutral900: "#000000",
  disabled: "#f0f0f0",
};

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "20px",
  xxl: "24px",
};

export const typography = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
  fontSize: {
    xs: "12px",
    sm: "13px",
    base: "14px",
    lg: "16px",
    xl: "18px",
    xxl: "20px",
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export const borderRadius = {
  sm: "4px",
  md: "6px",
  lg: "8px",
};

export const shadows = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
  md: "0 2px 4px rgba(0, 0, 0, 0.1)",
  lg: "0 4px 12px rgba(0, 0, 0, 0.15)",
};

// Component-specific styles
export const componentStyles = {
  container: {
    fontFamily: typography.fontFamily,
    fontSize: typography.fontSize.base,
    color: colors.neutral700,
    lineHeight: typography.lineHeight.normal,
  },

  section: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.neutral100,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.neutral300}`,
  },

  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral900,
    marginBottom: spacing.md,
    lineHeight: typography.lineHeight.tight,
  },

  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral700,
    marginBottom: spacing.sm,
    display: "block",
  },

  button: {
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    borderRadius: borderRadius.md,
    border: "none",
    cursor: "pointer",
    transition: "all 0.2s ease",
    fontFamily: typography.fontFamily,
  },

  buttonPrimary: {
    backgroundColor: colors.primary,
    color: colors.neutral100,
    "&:hover": {
      backgroundColor: colors.primaryDark,
    },
    "&:active": {
      transform: "scale(0.98)",
    },
    "&:disabled": {
      backgroundColor: colors.neutral400,
      cursor: "not-allowed",
    },
  },

  buttonSecondary: {
    backgroundColor: colors.neutral200,
    color: colors.neutral700,
    border: `1px solid ${colors.neutral400}`,
    "&:hover": {
      backgroundColor: colors.neutral300,
    },
  },

  input: {
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.neutral400}`,
    fontFamily: typography.fontFamily,
    transition: "border-color 0.2s ease",
    "&:focus": {
      outline: "none",
      borderColor: colors.primary,
      boxShadow: `0 0 0 3px rgba(245, 166, 35, 0.1)`,
    },
  },

  dateButton: {
    padding: spacing.md,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    minWidth: "100px",
    textAlign: "center",
    borderRadius: borderRadius.md,
    border: `2px solid ${colors.neutral300}`,
    backgroundColor: colors.neutral100,
    cursor: "pointer",
    transition: "all 0.2s ease",
    fontFamily: typography.fontFamily,
    fontSize: typography.fontSize.sm,
    "&:hover": {
      borderColor: colors.primary,
      backgroundColor: colors.neutral200,
    },
    "&.selected": {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      color: colors.neutral100,
      fontWeight: typography.fontWeight.semibold,
    },
    "&:disabled": {
      backgroundColor: colors.disabled,
      borderColor: colors.neutral300,
      color: colors.neutral500,
      cursor: "not-allowed",
    },
  },

  timeSlotRadio: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    border: `2px solid ${colors.neutral300}`,
    backgroundColor: colors.neutral100,
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
    fontFamily: typography.fontFamily,
    "&:hover": {
      borderColor: colors.primary,
      backgroundColor: colors.neutral200,
    },
    "&.selected": {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    "&:disabled": {
      backgroundColor: colors.disabled,
      borderColor: colors.neutral300,
      cursor: "not-allowed",
      opacity: 0.6,
    },
  },

  radioInput: {
    marginRight: spacing.md,
    accentColor: colors.primary,
  },

  badge: {
    display: "inline-block",
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.neutral200,
    color: colors.neutral700,
  },

  badgeSuccess: {
    backgroundColor: colors.success,
    color: colors.neutral100,
  },

  badgeWarning: {
    backgroundColor: colors.warning,
    color: colors.neutral100,
  },

  errorMessage: {
    padding: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: "#fef3f2",
    color: colors.warning,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.warning}`,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.normal,
  },

  loadingSpinner: {
    display: "inline-block",
    width: "16px",
    height: "16px",
    border: `2px solid ${colors.neutral300}`,
    borderTop: `2px solid ${colors.primary}`,
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },

  helpText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral500,
    marginTop: spacing.xs,
    lineHeight: typography.lineHeight.normal,
  },
};
