'use client';

import { useRouter } from 'next/navigation';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import { Wizard, WizardNav, WizardContent } from './_components/wizard';
import { StepSelectPlatform } from './_components/step-select-platform';
import { StepOAuth } from './_components/step-oauth';
import { StepConfigureSync } from './_components/step-configure-sync';
import { StepTestConnection } from './_components/step-test-connection';
import { StepReviewActivate } from './_components/step-review-activate';
import { useWizardState } from './_components/use-wizard-state';
import { useWizardSteps } from './_components/use-wizard-steps';
import { useOAuthHandler } from './_components/use-oauth-handler';
import { CRM_PLATFORMS } from './_components/constants';
import type { CRMConnection } from '@/types/api';

export default function CrmConnectPage() {
  const { items, loading, error, refetch } = useApiList<CRMConnection>(
    '/api/v4/crm/connect'
  );

  if (loading) return <TableSkeleton rows={10} columns={6} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const router = useRouter();
  const { handleStartOAuth } = useOAuthHandler();

  const {
    activeStep,
    selectedPlatform,
    syncConfig,
    testResults,
    isEnabled,
    syncSchedule,
    handleStepChange,
    handleNext,
    handlePrevious,
    handleSelectPlatform,
    handleUpdateSyncConfig,
    handleTestConnection,
    handleActivate,
    completedSteps,
    setIsEnabled,
    setSyncSchedule,
  } = useWizardState();

  const steps = useWizardSteps({
    activeStep,
    completedSteps,
    selectedPlatform,
  });

  const handleCancelPlatform = () => {
    router.push('/dashboard/crm');
  };

  const handleOAuthClick = () => {
    handleStartOAuth(selectedPlatform);
  };

  const handleNextStep = () => {
    handleNext(steps);
  };

  const handlePreviousStep = () => {
    handlePrevious(steps);
  };

  return (
    <Wizard activeStep={activeStep} onStepChange={(step) => handleStepChange(step, steps)}>
      <WizardNav
        steps={steps}
        activeStep={activeStep}
        onStepClick={(step) => handleStepChange(step, steps)}
      />

      <WizardContent>
        {/* Step 1: Platform Selection */}
        {activeStep === 1 && (
          <StepSelectPlatform
            platforms={CRM_PLATFORMS}
            selectedPlatform={selectedPlatform}
            onSelectPlatform={handleSelectPlatform}
            onNext={handleNextStep}
            onCancel={handleCancelPlatform}
          />
        )}

        {/* Step 2: OAuth Authorization */}
        {activeStep === 2 && selectedPlatform && (
          <StepOAuth
            platforms={CRM_PLATFORMS}
            selectedPlatform={selectedPlatform}
            onStartOAuth={handleOAuthClick}
            onBack={handlePreviousStep}
          />
        )}

        {/* Step 3: Configure Sync */}
        {activeStep === 3 && selectedPlatform && (
          <StepConfigureSync
            syncConfig={syncConfig}
            onUpdateSyncConfig={handleUpdateSyncConfig}
            onNext={handleNextStep}
            onBack={handlePreviousStep}
          />
        )}

        {/* Step 4: Test Connection */}
        {activeStep === 4 && selectedPlatform && (
          <StepTestConnection
            testResults={testResults}
            onTestConnection={handleTestConnection}
            onNext={handleNextStep}
            onBack={handlePreviousStep}
          />
        )}

        {/* Step 5: Review & Activate */}
        {activeStep === 5 && selectedPlatform && (
          <StepReviewActivate
            platforms={CRM_PLATFORMS}
            selectedPlatform={selectedPlatform}
            syncConfig={syncConfig}
            isEnabled={isEnabled}
            syncSchedule={syncSchedule}
            onSetIsEnabled={setIsEnabled}
            onSetSyncSchedule={setSyncSchedule}
            onActivate={handleActivate}
            onBack={handlePreviousStep}
          />
        )}
      </WizardContent>
    </Wizard>
  );
}
