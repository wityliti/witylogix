/**
 * KPICard — Key Performance Indicator card component.
 *
 * Displays a metric with title, value, trend delta, and optional
 * description. Used on the Dashboard home page in a 4-column grid.
 *
 * Follows Polaris design patterns — uses Polaris color tokens
 * and typography scale for consistency within the Shopify Admin.
 */
interface KPICardProps {
    title: string;
    value: string | number;
    /** Change vs previous period. Positive = green, negative = red. */
    delta?: number;
    /** Unit for the delta (e.g., "%", "orders"). */
    deltaUnit?: string;
    /** Period comparison label (e.g., "vs yesterday"). */
    deltaPeriod?: string;
    /** Optional secondary text below the value. */
    description?: string;
    /** Loading skeleton state. */
    loading?: boolean;
}
export declare function KPICard({ title, value, delta, deltaUnit, deltaPeriod, description, loading, }: KPICardProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=KPICard.d.ts.map