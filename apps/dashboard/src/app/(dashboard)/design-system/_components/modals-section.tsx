'use client';

import { useState } from 'react';
import { Button, Modal, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';

export function ModalsSection() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Modals & Dialogs
        </h2>
        <p className="text-wl-text-secondary mb-8">
          Modal dialog component with configurable sizes. Press Escape to close or
          click the backdrop.
        </p>

        <div className="space-y-4">
          <div>
            <Button
              onClick={() => setModalOpen(true)}
              variant="primary"
            >
              Open Modal
            </Button>
          </div>

          <Modal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Modal Dialog"
            size="md"
            footer={
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setModalOpen(false)}
                >
                  Confirm
                </Button>
              </div>
            }
          >
            <p className="text-wl-text-secondary mb-4">
              This is a modal dialog. You can add any content here, including forms,
              messages, or confirmations.
            </p>
            <Input
              label="Example Input"
              placeholder="Enter something"
            />
          </Modal>

          <Card>
            <CardHeader>
              <CardTitle>Modal Sizes</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-wl-text-secondary space-y-2">
              <p>Available sizes: sm, md, lg, full</p>
              <p>
                Use the size prop to control modal dimensions.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
