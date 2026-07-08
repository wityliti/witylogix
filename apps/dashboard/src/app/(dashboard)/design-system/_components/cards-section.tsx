"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Button,
} from "@/components/ui";
import { PreviewSection } from "./preview-section";

export function CardsSection() {
  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Cards</h2>
        <p className="text-gray-300 mb-8">
          Card component with optional header, content, and footer sections.
          Supports hover and glow effects.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <PreviewSection
            title="Basic Card"
            description="Standard card styling"
            preview={
              <Card className="w-full">
                <CardContent>
                  <p>This is a basic card with content.</p>
                </CardContent>
              </Card>
            }
            code={`<Card>
  <CardContent>
    <p>This is a basic card with content.</p>
  </CardContent>
</Card>`}
          />

          <PreviewSection
            title="Card with Header"
            description="Card with title and description"
            preview={
              <Card className="w-full">
                <CardHeader>
                  <CardTitle>Card Title</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    This card has a header with title and description.
                  </CardDescription>
                </CardContent>
              </Card>
            }
            code={`<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    <CardDescription>Content here</CardDescription>
  </CardContent>
</Card>`}
          />

          <PreviewSection
            title="Card with Footer"
            description="Card with action buttons"
            preview={
              <Card className="w-full">
                <CardHeader>
                  <CardTitle>Confirm Action</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>Are you sure you want to proceed?</p>
                </CardContent>
                <CardFooter>
                  <Button variant="secondary" size="sm">
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm">
                    Confirm
                  </Button>
                </CardFooter>
              </Card>
            }
            code={`<Card>
  <CardHeader>
    <CardTitle>Confirm Action</CardTitle>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>
    <Button>Confirm</Button>
  </CardFooter>
</Card>`}
          />

          <PreviewSection
            title="Hoverable Card"
            description="Card with hover effect"
            preview={
              <Card hover className="w-full">
                <CardContent>
                  <p>Hover over this card to see the effect.</p>
                </CardContent>
              </Card>
            }
            code={`<Card hover>
  <CardContent>
    <p>Hover over this card</p>
  </CardContent>
</Card>`}
          />
        </div>
      </div>
    </div>
  );
}
