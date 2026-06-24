'use client';

import { useRouter } from 'next/navigation';
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

export default function CrmConnectPage() {
  const router = useRouter();
  const { handleStartOAuth } = useOAuthHandler();

  const {
    activeStep,
    selectedPlatform,
    syncConfig,
    testResults,
    isEnabled,
    syncSchedule,
    activating,
    activateError,
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

  const steps = useWizardSteps({ activeStep, completedSteps, selectedPlatform });

  const handleCancelPlatform = () => router.push('/crm');
  const handleOAuthClick = () => handleStartOAuth(selectedPlatform);
  const handleNextStep = () => handleNext(steps);
  const handlePreviousStep = () => handlePrevious(steps);

  return (
    <Wizard activeStep={activeStep} onStepChange={(step) => handleStepChange(step, steps)}>
      <WizardNav
        steps={steps}
        activeStep={activeStep}
        onStepClick={(step) => handleStepChange(step, steps)}
      />

      <WizardContent>
        {activeStep === 1 && (
          <StepSelectPlatform
            platforms={CRM_PLATFORMS}
            selectedPlatform={selectedPlatform}
            onSelectPlatform={handleSelectPlatform}
            onNext={handleNextStep}
            onCancel={handleCancelPlatform}
          />
        )}

        {activeStep === 2 && selectedPlatform && (
          <StepOAuth
            platforms={CRM_PLATFORMS}
            selectedPlatform={selectedPlatform}
            onStartOAuth={handleOAuthClick}
            onBack={handlePreviousStep}
          />
        )}

        {activeStep === 3 && selectedPlatform && (
          <StepConfigureSync
            syncConfig={syncConfig}
            onUpdateSyncConfig={handleUpdateSyncConfig}
            onNext={handleNextStep}
            onBack={handlePreviousStep}
          />
        )}

        {activeStep === 4 && selectedPlatform && (
          <StepTestConnection
            testResults={testResults}
            onTestConnection={handleTestConnection}
            onNext={handleNextStep}
            onBack={handlePreviousStep}
          />
        )}

        {activeStep === 5 && selectedPlatform && (
          <StepReviewActivate
            platforms={CRM_PLATFORMS}
            selectedPlatform={selectedPlatform}
            syncConfig={syncConfig}
            isEnabled={isEnabled}
            syncSchedule={syncSchedule}
            activating={activating}
            activateError={activateError}
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
