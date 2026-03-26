import { LocaleKey, localeMetadata, isRTL } from './config';
import { cn } from '@/lib/utils';

/**
 * Get text direction for a locale
 */
export function getDirection(locale: LocaleKey): 'ltr' | 'rtl' {
  return localeMetadata[locale].direction;
}

/**
 * Check if locale is RTL
 */
export function isLocaleRTL(locale: LocaleKey): boolean {
  return isRTL(locale);
}

/**
 * RTL-aware spacing utility
 * Maps logical properties that work in both LTR and RTL contexts
 */
export function rtlSpacing(
  locale: LocaleKey,
  config: {
    ms?: string; // margin-start (left in LTR, right in RTL)
    me?: string; // margin-end (right in LTR, left in RTL)
    ps?: string; // padding-start
    pe?: string; // padding-end
  }
): Record<string, string> {
  const isRtl = isLocaleRTL(locale);

  return {
    ...(config.ms && { [isRtl ? 'marginRight' : 'marginLeft']: config.ms }),
    ...(config.me && { [isRtl ? 'marginLeft' : 'marginRight']: config.me }),
    ...(config.ps && { [isRtl ? 'paddingRight' : 'paddingLeft']: config.ps }),
    ...(config.pe && { [isRtl ? 'paddingLeft' : 'paddingRight']: config.pe }),
  };
}

/**
 * RTL-aware Tailwind classes
 * Uses CSS logical properties where available
 */
export function rtlClasses(
  locale: LocaleKey,
  {
    ms,
    me,
    ps,
    pe,
  }: {
    ms?: string; // margin-start classes
    me?: string; // margin-end classes
    ps?: string; // padding-start classes
    pe?: string; // padding-end classes
  }
): string {
  const isRtl = isLocaleRTL(locale);

  const classes = [
    isRtl ? `mr-[${me}]` : `ml-[${ms}]`,
    isRtl ? `ml-[${ms}]` : `mr-[${me}]`,
    isRtl ? `pr-[${pe}]` : `pl-[${ps}]`,
    isRtl ? `pl-[${ps}]` : `pr-[${pe}]`,
  ].filter(Boolean);

  return cn(classes);
}

/**
 * Get transform for RTL text alignment
 */
export function rtlAlign(
  locale: LocaleKey,
  alignment: 'start' | 'end'
): 'left' | 'right' {
  const isRtl = isLocaleRTL(locale);

  if (alignment === 'start') {
    return isRtl ? 'right' : 'left';
  }
  return isRtl ? 'left' : 'right';
}

/**
 * RTL-aware transform for positioning
 */
export function rtlTransform(
  locale: LocaleKey,
  distance: string
): string {
  const isRtl = isLocaleRTL(locale);
  return isRtl ? `translateX(${distance})` : `translateX(-${distance})`;
}

/**
 * Create CSS logical properties for RTL support
 * Returns a style object that works in both LTR and RTL
 */
export function getLogicalProperties(locale: LocaleKey) {
  const isRtl = isLocaleRTL(locale);

  return {
    /**
     * Margin start (left in LTR, right in RTL)
     */
    marginStart: (value: string | number) => ({
      [isRtl ? 'marginRight' : 'marginLeft']: value,
    }),

    /**
     * Margin end (right in LTR, left in RTL)
     */
    marginEnd: (value: string | number) => ({
      [isRtl ? 'marginLeft' : 'marginRight']: value,
    }),

    /**
     * Padding start
     */
    paddingStart: (value: string | number) => ({
      [isRtl ? 'paddingRight' : 'paddingLeft']: value,
    }),

    /**
     * Padding end
     */
    paddingEnd: (value: string | number) => ({
      [isRtl ? 'paddingLeft' : 'paddingRight']: value,
    }),

    /**
     * Text alignment start
     */
    textStart: (value: string = 'auto') => ({
      textAlign: isRtl ? 'right' : 'left',
    }),

    /**
     * Text alignment end
     */
    textEnd: (value: string = 'auto') => ({
      textAlign: isRtl ? 'left' : 'right',
    }),

    /**
     * Flex alignment for row direction
     */
    flexStartAlign: () => ({
      justifyContent: isRtl ? 'flex-end' : 'flex-start',
    }),

    /**
     * Flex alignment for column direction
     */
    flexEndAlign: () => ({
      justifyContent: isRtl ? 'flex-start' : 'flex-end',
    }),
  };
}
