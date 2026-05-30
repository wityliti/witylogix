'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Image as ImageIcon, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RatingStars } from '@/components/rating-stars';
import { useMutation } from '@/lib/use-api';
import { ROUTES } from '@/lib/portal-api';

type RatingStep = 'rating' | 'categories' | 'feedback' | 'success';

const STEPS: RatingStep[] = ['rating', 'categories', 'feedback', 'success'];

function getRatingLabel(value: number): string {
  switch (value) {
    case 1: return 'Poor';
    case 2: return 'Fair';
    case 3: return 'Good';
    case 4: return 'Very Good';
    case 5: return 'Excellent';
    default: return '';
  }
}

export default function RatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [step, setStep] = useState<RatingStep>('rating');
  const [driverRating, setDriverRating] = useState(0);
  const [experienceRating, setExperienceRating] = useState(0);
  const [driverCategoryRating, setDriverCategoryRating] = useState(0);
  const [timelinessCategoryRating, setTimelinessCategoryRating] = useState(0);
  const [conditionCategoryRating, setConditionCategoryRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [wouldOrderAgain, setWouldOrderAgain] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { mutate: submitRating, loading: submitting } = useMutation(
    `${ROUTES.ORDERS}/${id}/rating`,
    'POST',
  );

  const handleNext = async () => {
    if (step === 'rating' && driverRating > 0 && experienceRating > 0) {
      setStep('categories');
    } else if (
      step === 'categories' &&
      driverCategoryRating > 0 &&
      timelinessCategoryRating > 0 &&
      conditionCategoryRating > 0
    ) {
      setStep('feedback');
    } else if (step === 'feedback') {
      setSubmitError(null);
      try {
        await submitRating({
          driverRating,
          experienceRating,
          categories: {
            driver: driverCategoryRating,
            timeliness: timelinessCategoryRating,
            condition: conditionCategoryRating,
          },
          feedback: feedback.trim() || undefined,
          wouldOrderAgain,
        });
        setStep('success');
      } catch (err: unknown) {
        setSubmitError(err instanceof Error ? err.message : 'Failed to submit rating. Please try again.');
      }
    }
  };

  const handleAddPhoto = () => {
    // Photo uploads require file storage (S3/R2) — not available without third-party keys
    setPhotos([...photos, `photo-${photos.length + 1}`]);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const canProceed = step === 'rating'
    ? driverRating > 0 && experienceRating > 0
    : step === 'categories'
    ? driverCategoryRating > 0 && timelinessCategoryRating > 0 && conditionCategoryRating > 0
    : true;

  const currentStepIndex = STEPS.indexOf(step);

  return (
    <div className="page-container">
      {/* Back + Breadcrumb */}
      <div className="flex items-center gap-3 animate-fade-in">
        <Link
          href={`/orders/${id}`}
          className="btn btn-ghost p-2"
          aria-label="Back to order"
        >
          <ArrowLeft size={18} />
        </Link>
        <span className="text-xs text-wl-text-tertiary">
          <Link href="/orders" className="hover:text-wl-text-secondary transition-colors">
            Orders
          </Link>
          {' / '}
          <Link
            href={`/orders/${id}`}
            className="hover:text-wl-text-secondary transition-colors"
          >
            Details
          </Link>
          {' / '}
          <span className="text-wl-text-secondary">Rate</span>
        </span>
      </div>

      {/* Header */}
      <header className="page-header animate-fade-in stagger-1">
        <h1 className="page-title">Rate Your Delivery</h1>
        <p className="page-subtitle">Help us improve our service</p>
      </header>

      {/* Progress Bar */}
      <div className="w-full max-w-2xl animate-fade-in stagger-1">
        <div className="flex gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                'flex-1 h-1.5 rounded-full transition-colors',
                currentStepIndex >= i
                  ? 'bg-wl-primary-500'
                  : 'bg-wl-neutral-800'
              )}
            />
          ))}
        </div>
        <p className="text-xs text-wl-text-tertiary mt-2">
          Step <span className="mono">{currentStepIndex + 1}</span> of{' '}
          <span className="mono">{STEPS.length}</span>
        </p>
      </div>

      {/* Content */}
      <div className="max-w-2xl">
        {/* Step 1: Rating */}
        {step === 'rating' && (
          <div className="section-card space-y-8 animate-fade-in">
            {/* Driver Rating */}
            <div>
              <h2 className="font-semibold text-wl-text-primary mb-1">
                How was your driver?
              </h2>
              <p className="text-sm text-wl-text-secondary mb-6">
                Rate your driver's professionalism and courtesy
              </p>
              <div className="flex justify-center mb-3">
                <RatingStars
                  value={driverRating}
                  onChange={setDriverRating}
                  size="lg"
                />
              </div>
              <p className="text-center text-sm text-wl-text-tertiary">
                {getRatingLabel(driverRating)}
              </p>
            </div>

            {/* Experience Rating */}
            <div className="pt-8 border-t border-wl-border-subtle">
              <h2 className="font-semibold text-wl-text-primary mb-1">
                How was your delivery experience?
              </h2>
              <p className="text-sm text-wl-text-secondary mb-6">
                Rate the overall delivery experience
              </p>
              <div className="flex justify-center mb-3">
                <RatingStars
                  value={experienceRating}
                  onChange={setExperienceRating}
                  size="lg"
                />
              </div>
              <p className="text-center text-sm text-wl-text-tertiary">
                {getRatingLabel(experienceRating)}
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Categories */}
        {step === 'categories' && (
          <div className="section-card space-y-8 animate-fade-in">
            {/* Summary of Initial Ratings */}
            <div className="p-4 rounded-lg bg-wl-bg-elevated">
              <p className="text-xs text-wl-text-tertiary font-medium uppercase tracking-wide mb-3">
                Your Ratings
              </p>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-wl-text-secondary">Driver</span>
                <RatingStars value={driverRating} readonly size="sm" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-wl-text-secondary">Experience</span>
                <RatingStars value={experienceRating} readonly size="sm" />
              </div>
            </div>

            {/* Driver Category Rating */}
            <div>
              <h2 className="font-semibold text-wl-text-primary mb-1">
                Rate the Driver
              </h2>
              <p className="text-sm text-wl-text-secondary mb-6">
                How professional and courteous was the driver?
              </p>
              <div className="flex justify-center mb-3">
                <RatingStars
                  value={driverCategoryRating}
                  onChange={setDriverCategoryRating}
                  size="lg"
                />
              </div>
            </div>

            {/* Timeliness Category Rating */}
            <div className="pt-8 border-t border-wl-border-subtle">
              <h2 className="font-semibold text-wl-text-primary mb-1">
                Rate Timeliness
              </h2>
              <p className="text-sm text-wl-text-secondary mb-6">
                Was the delivery on time?
              </p>
              <div className="flex justify-center mb-3">
                <RatingStars
                  value={timelinessCategoryRating}
                  onChange={setTimelinessCategoryRating}
                  size="lg"
                />
              </div>
            </div>

            {/* Condition Category Rating */}
            <div className="pt-8 border-t border-wl-border-subtle">
              <h2 className="font-semibold text-wl-text-primary mb-1">
                Rate Item Condition
              </h2>
              <p className="text-sm text-wl-text-secondary mb-6">
                Were the items delivered in good condition?
              </p>
              <div className="flex justify-center mb-3">
                <RatingStars
                  value={conditionCategoryRating}
                  onChange={setConditionCategoryRating}
                  size="lg"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Feedback */}
        {step === 'feedback' && (
          <div className="section-card space-y-6 animate-fade-in">
            {/* Summary of All Ratings */}
            <div className="p-4 rounded-lg bg-wl-bg-elevated">
              <p className="text-xs text-wl-text-tertiary font-medium uppercase tracking-wide mb-3">
                Your Ratings
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-wl-text-secondary">Driver</span>
                  <RatingStars value={driverRating} readonly size="sm" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-wl-text-secondary">Experience</span>
                  <RatingStars value={experienceRating} readonly size="sm" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-wl-text-secondary">Professionalism</span>
                  <RatingStars value={driverCategoryRating} readonly size="sm" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-wl-text-secondary">Timeliness</span>
                  <RatingStars value={timelinessCategoryRating} readonly size="sm" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-wl-text-secondary">Item Condition</span>
                  <RatingStars value={conditionCategoryRating} readonly size="sm" />
                </div>
              </div>
            </div>

            {/* Feedback Text */}
            <div>
              <label className="font-semibold text-wl-text-primary block mb-1">
                Additional Feedback
              </label>
              <p className="text-sm text-wl-text-secondary mb-3">
                Share any additional comments about your delivery experience (optional)
              </p>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Tell us about your experience..."
                className="input resize-none h-32"
              />
            </div>

            {/* Would You Order Again */}
            <div className="pt-6 border-t border-wl-border-subtle">
              <label className="font-semibold text-wl-text-primary block mb-4">
                Would you order from us again?
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setWouldOrderAgain(true)}
                  className={cn(
                    'btn flex-1 py-3',
                    wouldOrderAgain
                      ? 'btn-primary'
                      : 'btn-secondary'
                  )}
                >
                  Yes
                </button>
                <button
                  onClick={() => setWouldOrderAgain(false)}
                  className={cn(
                    'btn flex-1 py-3',
                    !wouldOrderAgain
                      ? 'bg-wl-danger-500 text-white'
                      : 'btn-secondary'
                  )}
                >
                  No
                </button>
              </div>
            </div>

            {/* Photo Upload */}
            <div className="pt-6 border-t border-wl-border-subtle">
              <label className="font-semibold text-wl-text-primary block mb-1">
                Add Photos
              </label>
              <p className="text-sm text-wl-text-secondary mb-3">
                Upload photos if there were any issues (optional)
              </p>

              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {photos.map((photo, index) => (
                    <div
                      key={index}
                      className={cn(
                        'relative w-full aspect-square rounded-lg',
                        'bg-wl-bg-elevated border border-wl-border-subtle',
                        'flex items-center justify-center'
                      )}
                    >
                      <span className="text-2xl">📷</span>
                      <button
                        onClick={() => handleRemovePhoto(index)}
                        className={cn(
                          'absolute top-1 right-1 w-6 h-6',
                          'bg-wl-danger-500 text-white rounded-full',
                          'flex items-center justify-center text-sm',
                          'hover:bg-wl-danger-600 transition-colors'
                        )}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleAddPhoto}
                disabled={photos.length >= 5}
                className={cn(
                  'w-full px-4 py-3 rounded-lg border-2 border-dashed',
                  'flex items-center justify-center gap-2',
                  'transition-colors',
                  photos.length >= 5
                    ? 'border-wl-neutral-800 text-wl-text-tertiary cursor-not-allowed'
                    : 'border-wl-border-subtle text-wl-text-secondary hover:border-wl-primary-500'
                )}
              >
                <ImageIcon size={16} />
                <span className="text-sm">
                  Add Photo (<span className="mono">{photos.length}/5</span>)
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 'success' && (
          <div className={cn(
            'section-card animate-fade-in',
            'border-l-[3px] border-l-wl-success-500'
          )}>
            <div className="text-center py-4">
              <div className={cn(
                'w-14 h-14 mx-auto mb-4 rounded-full',
                'bg-wl-bg-elevated flex items-center justify-center'
              )}>
                <CheckCircle size={28} className="text-wl-success-500" />
              </div>

              <h2 className="text-xl font-semibold text-wl-text-primary mb-1">
                Thank You!
              </h2>
              <p className="text-sm text-wl-text-secondary mb-8 max-w-sm mx-auto">
                Your feedback has been submitted successfully. We appreciate your time
                and will use your insights to improve our service.
              </p>
            </div>

            {/* Ratings Recap */}
            <div className="p-4 rounded-lg bg-wl-bg-elevated mb-8">
              <p className="text-xs text-wl-text-tertiary font-medium uppercase tracking-wide mb-3">
                Your Ratings & Feedback
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-wl-text-secondary">Driver</span>
                  <RatingStars value={driverRating} readonly size="sm" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-wl-text-secondary">Experience</span>
                  <RatingStars value={experienceRating} readonly size="sm" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-wl-text-secondary">Professionalism</span>
                  <RatingStars value={driverCategoryRating} readonly size="sm" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-wl-text-secondary">Timeliness</span>
                  <RatingStars value={timelinessCategoryRating} readonly size="sm" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-wl-text-secondary">Condition</span>
                  <RatingStars value={conditionCategoryRating} readonly size="sm" />
                </div>
              </div>
              <div className="pt-3 mt-3 border-t border-wl-border-subtle">
                <p className="text-sm text-wl-text-secondary">
                  <span className="font-medium">Order Again:</span>{' '}
                  {wouldOrderAgain ? 'Yes' : 'No'}
                </p>
              </div>
              {feedback && (
                <div className="pt-3 mt-3 border-t border-wl-border-subtle">
                  <p className="text-xs text-wl-text-tertiary mb-1 font-medium">
                    Feedback
                  </p>
                  <p className="text-sm text-wl-text-primary italic">
                    &ldquo;{feedback}&rdquo;
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/orders"
                className="btn btn-primary btn-lg flex-1"
              >
                Back to Orders
              </Link>
              <Link
                href="/"
                className="btn btn-secondary btn-lg flex-1"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {step !== 'success' && (
        <div className="flex flex-col gap-3 max-w-2xl animate-fade-in">
          {submitError && (
            <p className="text-sm text-wl-error-500">{submitError}</p>
          )}
          <div className="flex gap-3">
            {(step === 'feedback' || step === 'categories') && (
              <button
                onClick={() => setStep(step === 'feedback' ? 'categories' : 'rating')}
                disabled={submitting}
                className="btn btn-secondary btn-lg"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!canProceed || submitting}
              className={cn(
                'btn btn-primary btn-lg flex-1',
                (!canProceed || submitting) && 'opacity-50 cursor-not-allowed',
              )}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Submitting…
                </>
              ) : step === 'feedback' ? (
                'Submit Rating'
              ) : (
                'Continue'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
