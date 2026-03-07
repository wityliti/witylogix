/**
 * Users List — User management with invite and role management.
 *
 * Features:
 *   - Table: Name, Email, Role (with color badges), Status, Created date
 *   - Invite User button → modal with name, email, role select
 *   - Inline role editing via dropdown
 *   - Deactivate button (DELETE action)
 *   - Role colors: SUPER_ADMIN=purple, ADMIN=blue, DISPATCHER=green, VIEWER=gray
 *   - Server-side loader fetches users from /api/v4/users
 *   - Actions: POST create, PATCH update role, DELETE deactivate
 */
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
export declare function loader({ request }: LoaderFunctionArgs): Promise<{
    users: any;
}>;
export declare function action({ request }: ActionFunctionArgs): Promise<Response | {
    error: string;
    success?: undefined;
} | {
    success: boolean;
    error?: undefined;
}>;
export default function UsersList(): import("react").JSX.Element;
//# sourceMappingURL=users._index.d.ts.map