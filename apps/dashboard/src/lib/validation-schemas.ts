/**
 * Common validation schemas using Zod
 * Provides reusable validation patterns for forms across the application
 */

/**
 * Email validation schema
 * Validates standard email format with length limits
 */
export const emailSchema = (maxLength = 254) => ({
  validation: (email: string) => {
    if (!email) return "Email is required";
    if (email.length > maxLength) return `Email cannot exceed ${maxLength} characters`;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Invalid email format";
    return null;
  },
});

/**
 * Password validation schema
 * Enforces minimum length, uppercase, lowercase, number, and special character
 */
export const passwordSchema = (minLength = 12) => ({
  validation: (password: string) => {
    if (!password) return "Password is required";
    if (password.length < minLength) return `Password must be at least ${minLength} characters`;
    if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter";
    if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter";
    if (!/\d/.test(password)) return "Password must contain a number";
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
      return "Password must contain a special character";
    return null;
  },
});

/**
 * Phone number validation schema
 * Validates E.164 format phone numbers
 */
export const phoneSchema = () => ({
  validation: (phone: string) => {
    if (!phone) return "Phone number is required";
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone.replace(/[\s\-().]/g, ""))) {
      return "Invalid phone number format";
    }
    return null;
  },
});

/**
 * URL validation schema
 * Validates http/https URLs
 */
export const urlSchema = () => ({
  validation: (url: string) => {
    if (!url) return "URL is required";
    try {
      new URL(url);
      return null;
    } catch {
      return "Invalid URL format";
    }
  },
});

/**
 * Slug validation schema
 * Validates URL-friendly slugs (lowercase, hyphens, alphanumeric)
 */
export const slugSchema = () => ({
  validation: (slug: string) => {
    if (!slug) return "Slug is required";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return "Slug can only contain lowercase letters, numbers, and hyphens";
    }
    return null;
  },
});

/**
 * Date range validation schema
 * Validates that endDate is after startDate
 */
export const dateRangeSchema = () => ({
  validation: (startDate: string, endDate: string) => {
    if (!startDate) return "Start date is required";
    if (!endDate) return "End date is required";
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime())) return "Invalid start date";
    if (isNaN(end.getTime())) return "Invalid end date";
    if (end <= start) return "End date must be after start date";
    return null;
  },
});

/**
 * Numeric range validation schema
 * Validates that value is within min and max bounds
 */
export const numericRangeSchema = (min: number, max: number) => ({
  validation: (value: number) => {
    if (value === null || value === undefined) return "Value is required";
    if (value < min) return `Value must be at least ${min}`;
    if (value > max) return `Value cannot exceed ${max}`;
    return null;
  },
});

/**
 * File validation schema
 * Validates file type and size
 */
export const fileSchema = (allowedTypes: string[], maxSizeBytes: number) => ({
  validation: (file: File | null) => {
    if (!file) return "File is required";
    if (!allowedTypes.includes(file.type)) {
      return `File type must be one of: ${allowedTypes.join(", ")}`;
    }
    if (file.size > maxSizeBytes) {
      const maxSizeMB = (maxSizeBytes / 1024 / 1024).toFixed(2);
      return `File size cannot exceed ${maxSizeMB}MB`;
    }
    return null;
  },
});

/**
 * Address validation schema
 * Validates street, city, state, zip, and country
 */
export const addressSchema = () => ({
  validation: (address: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  }) => {
    const errors: Record<string, string> = {};

    if (!address.street?.trim()) errors.street = "Street is required";
    if (!address.city?.trim()) errors.city = "City is required";
    if (!address.state?.trim()) errors.state = "State is required";
    if (!address.zip?.trim()) errors.zip = "Zip code is required";
    if (!address.country?.trim()) errors.country = "Country is required";

    if (address.zip && !/^[\d\w-]{3,10}$/.test(address.zip)) {
      errors.zip = "Invalid zip code format";
    }

    return Object.keys(errors).length > 0 ? errors : null;
  },
});

/**
 * Company information validation schema
 * Validates company name, registration number, and tax ID
 */
export const companyInfoSchema = () => ({
  validation: (company: {
    name?: string;
    registrationNumber?: string;
    taxId?: string;
  }) => {
    const errors: Record<string, string> = {};

    if (!company.name?.trim()) errors.name = "Company name is required";
    if (!company.registrationNumber?.trim()) {
      errors.registrationNumber = "Registration number is required";
    }
    if (!company.taxId?.trim()) errors.taxId = "Tax ID is required";

    return Object.keys(errors).length > 0 ? errors : null;
  },
});

/**
 * Generic required field validator
 * Simple check for non-empty, non-whitespace strings
 */
export const requiredSchema = (fieldName: string) => ({
  validation: (value: unknown) => {
    if (typeof value === "string" && !value.trim()) {
      return `${fieldName} is required`;
    }
    if (value === null || value === undefined) {
      return `${fieldName} is required`;
    }
    return null;
  },
});

/**
 * Minimum length validation schema
 */
export const minLengthSchema = (fieldName: string, minLength: number) => ({
  validation: (value: string) => {
    if (!value) return `${fieldName} is required`;
    if (value.length < minLength) {
      return `${fieldName} must be at least ${minLength} characters`;
    }
    return null;
  },
});

/**
 * Maximum length validation schema
 */
export const maxLengthSchema = (fieldName: string, maxLength: number) => ({
  validation: (value: string) => {
    if (value && value.length > maxLength) {
      return `${fieldName} cannot exceed ${maxLength} characters`;
    }
    return null;
  },
});

/**
 * Match field validation schema
 * Validates that two fields have matching values (e.g., password confirmation)
 */
export const matchFieldSchema = (fieldName: string, otherFieldName: string) => ({
  validation: (value: string, otherValue: string) => {
    if (value !== otherValue) {
      return `${fieldName} and ${otherFieldName} must match`;
    }
    return null;
  },
});
