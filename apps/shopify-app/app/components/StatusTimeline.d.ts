/**
 * StatusTimeline — Vertical timeline of status change events.
 *
 * Shows chronological events with timestamps, actors, and descriptions.
 * Used on order detail pages, activity feeds, and driver history.
 */
interface TimelineEvent {
    id: string;
    status: string;
    message: string;
    actor?: string;
    timestamp: string;
}
interface StatusTimelineProps {
    events: TimelineEvent[];
    loading?: boolean;
}
export declare function StatusTimeline({ events, loading }: StatusTimelineProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=StatusTimeline.d.ts.map