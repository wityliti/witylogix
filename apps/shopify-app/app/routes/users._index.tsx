/**
 * Users List — User management with invite and role management.
 *
 * Features:
 *   - Table: Name, Email, Role (with color badges), Status, Created date
 *   - Invite User button -> modal with name, email, role select
 *   - Inline role editing via dropdown
 *   - Deactivate button (DELETE action)
 *   - Role colors: SUPER_ADMIN=purple, ADMIN=blue, DISPATCHER=green, VIEWER=gray
 *   - Server-side loader fetches users from /api/v4/users
 *   - Actions: POST create, PATCH update role, DELETE deactivate
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, redirect, useActionData } from "react-router";
import { useState, useCallback } from "react";
import {
  Page,
  Card,
  IndexTable,
  Badge,
  Button,
  Text,
  BlockStack,
  InlineStack,
  EmptyState,
  Modal,
  FormLayout,
  TextField,
  Select,
  Banner,
} from "@shopify/polaris";
import {
  createApiClientFromRequest,
  type SingleResponse,
} from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface User {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "DISPATCHER" | "VIEWER";
  isActive: boolean;
  createdAt: string;
}

interface UsersPageData {
  users: User[];
}

const ROLES = ["SUPER_ADMIN", "ADMIN", "DISPATCHER", "VIEWER"] as const;

const ROLE_BADGE_TONE: Record<
  string,
  "magic" | "info" | "success" | undefined
> = {
  SUPER_ADMIN: "magic",
  ADMIN: "info",
  DISPATCHER: "success",
  VIEWER: undefined,
};

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClientFromRequest(request, session);

  const response = await api.get<SingleResponse<User[]>>("/api/v4/users");

  return { users: response.data };
}

// ─── Action ────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClientFromRequest(request, session);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const user = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      role: formData.get("role") as string,
    };

    try {
      await api.post("/api/v4/users", user);
      return redirect("/users");
    } catch (error) {
      return { error: "Failed to create user" };
    }
  }

  if (intent === "update-role") {
    const userId = formData.get("userId") as string;
    const newRole = formData.get("role") as string;

    try {
      await api.patch(`/api/v4/users/${userId}`, { role: newRole });
      return { success: true };
    } catch (error) {
      return { error: "Failed to update user role" };
    }
  }

  if (intent === "deactivate") {
    const userId = formData.get("userId") as string;

    try {
      await api.delete(`/api/v4/users/${userId}`);
      return { success: true };
    } catch (error) {
      return { error: "Failed to deactivate user" };
    }
  }

  return { error: "Unknown action" };
}

// ─── Component ─────────────────────────────────────────────

export default function UsersList() {
  const { users } = useLoaderData<UsersPageData>();
  const actionData = useActionData();
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Record<string, string>>({});

  const handleModalOpen = useCallback(() => setShowModal(true), []);
  const handleModalClose = useCallback(() => setShowModal(false), []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const roleOptions = [
    { label: "Select a role", value: "" },
    ...ROLES.map((role) => ({
      label: role.replace(/_/g, " "),
      value: role,
    })),
  ];

  const resourceName = {
    singular: "user",
    plural: "users",
  };

  const rowMarkup = users.map((user, index) => (
    <IndexTable.Row id={user.id} key={user.id} position={index}>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" fontWeight="semibold">
          {user.name}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm">
          {user.email}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {editingRole[user.id] ? (
          <Form method="post">
            <input type="hidden" name="intent" value="update-role" />
            <input type="hidden" name="userId" value={user.id} />
            <Select
              label="Role"
              labelHidden
              options={ROLES.map((role) => ({
                label: role.replace(/_/g, " "),
                value: role,
              }))}
              value={user.role}
              onChange={(value) => {
                const form = document
                  .querySelector(
                    `form input[name="userId"][value="${user.id}"]`,
                  )
                  ?.closest("form") as HTMLFormElement | null;
                if (form) {
                  const roleInput = document.createElement("input");
                  roleInput.type = "hidden";
                  roleInput.name = "role";
                  roleInput.value = value;
                  form.appendChild(roleInput);
                  form.submit();
                  setEditingRole((prev) => ({
                    ...prev,
                    [user.id]: "",
                  }));
                }
              }}
            />
          </Form>
        ) : (
          <div
            style={{ cursor: "pointer" }}
            onClick={() =>
              setEditingRole((prev) => ({
                ...prev,
                [user.id]: user.role,
              }))
            }
          >
            <Badge tone={ROLE_BADGE_TONE[user.role]}>
              {user.role.replace(/_/g, " ")}
            </Badge>
          </div>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={user.isActive ? "success" : "critical"}>
          {user.isActive ? "Active" : "Deactivated"}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">
          {formatDate(user.createdAt)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Form method="post">
          <input type="hidden" name="intent" value="deactivate" />
          <input type="hidden" name="userId" value={user.id} />
          <Button submit tone="critical" disabled={!user.isActive} size="slim">
            Deactivate
          </Button>
        </Form>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Users"
      subtitle={`${users.length} total users`}
      primaryAction={{
        content: "Invite User",
        onAction: handleModalOpen,
      }}
    >
      <BlockStack gap="400">
        {actionData?.error && (
          <Banner tone="critical">{actionData.error}</Banner>
        )}

        {/* Invite User Modal */}
        <Modal
          open={showModal}
          onClose={handleModalClose}
          title="Invite User"
          primaryAction={{
            content: "Invite",
            submit: true,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: handleModalClose,
            },
          ]}
        >
          <Modal.Section>
            <Form method="post">
              <input type="hidden" name="intent" value="create" />
              <FormLayout>
                <TextField
                  label="Name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="John Doe"
                  requiredIndicator
                />
                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="john@example.com"
                  requiredIndicator
                />
                <Select
                  label="Role"
                  name="role"
                  options={roleOptions}
                  requiredIndicator
                />
                <Button submit variant="primary">
                  Invite
                </Button>
              </FormLayout>
            </Form>
          </Modal.Section>
        </Modal>

        {/* Users Table */}
        {users.length > 0 ? (
          <Card padding="0">
            <IndexTable
              resourceName={resourceName}
              itemCount={users.length}
              headings={[
                { title: "Name" },
                { title: "Email" },
                { title: "Role" },
                { title: "Status" },
                { title: "Created" },
                { title: "Actions" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        ) : (
          <Card>
            <EmptyState
              heading="No users yet"
              action={{
                content: "Invite User",
                onAction: handleModalOpen,
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Click "Invite User" to add team members</p>
            </EmptyState>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
