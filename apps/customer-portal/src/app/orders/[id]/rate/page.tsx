'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, Image as ImageIcon, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RatingStars } from '@/components/rating-stars';

type RatingStep = 'rating' | 'categories' | 'feedback' | 'success';

export default function RatePage({ params }: { params: { id: string } }) {
  const [step, setStep] = useState<RatingStep>('rating');
  const [driverRating, setDriverRating] = useState(0);
  const [experienceRating, setExperienceRating] = useState(0);
  const [driverCategoryRating, setDriverCategoryRating] = useState(0);
  const [timelinessCategoryRating, setTimelinessCategoryRating] = useState(0);
  const [conditionCategoryRating, setConditionCategoryRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [wouldOrderAgain, setWouldOrderAgain] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);

  const handleNext = () => {
    if (step === 'rating' && driverRating > 0 && experienceRating > 0) {
      setStep('categories');
    } else if (step === 'categories' && driverCategoryRating > 0 && timelinessCategoryRating > 0 && conditionCategoryRating > 0) {
      setStep('feedback');
    } else if (step === 'feedback') {
      setStep('success');
    }
  };

  const handleAddPhoto = () => {
    // In a real app, this would open a file picker
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

  return (
    <div className={cn(
      'flex flex-col gap-6 px-4 sm:px-6 lg:px-8',
      'py-6 sm:py-8 pb-12'
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center gap-4'
      )}>
        <Link
          href={`/orders/${params.id}`}
          className={cn(
            'p-2 hover:bg-wl-bg-surface rounded-lg',
            'transition-colors duration-fast'
          )}
          aria-label="Back to order"
        >
          <ArrowLeft size={20} className="text-wl-text-primary" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-wl-text-primary">
            Rate Your Delivery
          </h1>
          <p className="text-wl-text-secondary text-sm mt-1">
            Help us improve our service
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-2xl">
        <div className="flex gap-2">
          {(['rating', 'categories', 'feedback', 'success'] as const).map((s, i) => (
            <div
              key={s}
              className={cn(
                'flex-1 h-2 rounded-full transition-colors duration-fast',
                (['rating', 'categories', 'feedback', 'success'].indexOf(step) >= i)
                  ? 'bg-wl-primary-500'
                  : 'bg-wl-neutral-700'
              )}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl">
        {step === 'rating' && (
          <div className={cn(
            'bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6',
            'space-y-8'
          )}>
            {/* Driver Rating */}
            <div>
              <h2 className="text-xl font-bold text-wl-text-primary mb-4">
                How was your driver?
              </h2>
              <p className="text-sm text-wl-text-secondary mb-6">
                Rate your driver's professionalism and courtesy
              </p>
              <div className="flex justify-center mb-4">
                <RatingStars
                  value={driverRating}
                  onChange={setDriverRating}
                  size="lg"
                />
              </div>
              <p className="text-center text-sm text-wl-text-tertiary">
                {driverRating > 0 && (
                  <>
                    {driverRating === 1 && 'Poor'}
                    {driverRating === 2 && 'Fair'}
                    {driverRating === 3 && 'Good'}
                    {driverRating === 4 && 'Very Good'}
                    {driverRating === 5 && 'Excellent'}
                  </>
                )}
              </p>
            </div>

            {/* Experience Rating */}
            <div className={cn(
              'pt-8 border-t border-wl-border-subtle'
            )}>
              <h2 className="text-xl font-bold text-wl-text-primary mb-4">
                How was your delivery experience?
              </h2>
              <p className="text-sm text-wl-text-secondary mb-6">
                Rate the overall delivery experience
              </p>
              <div className="flex justify-center mb-4">
                <RatingStars
                  value={experienceRating}
                  onChange={setExperienceRating}
                  size="lg"
                />
              </div>
              <p className="text-center text-sm text-wl-text-tertiary">
                {experienceRating > 0 && (
                  <>
                    {experienceRating === 1 && 'Poor'}
                    {experienceRating === 2 && 'Fair'}
                    {experienceRating === 3 && 'Good'}
                    {experienceRating === 4 && 'Very Good'}
                    {experienceRating === 5 && 'Excellent'}
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {step === 'categories' && (
          <div className={cn(
            'bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6',
            'space-y-8'
          )}>
            {/* Summary of Initial Ratings */}
            <div className={cn(
              'p-4 rounded-lg bg-wl-bg-elevated'
            )}>
              <p className="text-sm text-wl-text-secondary font-medium mb-3">
                <strong>Your Ratings:</strong>
              </p>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-wl-text-secondary">Driver:</span>
                <RatingStars value={driverRating} readonly size="sm" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-wl-text-secondary">Experience:</span>
                <RatingStars value={experienceRating} readonly size="sm" />
              </div>
            </div>

            {/* Driver Category Rating */}
            <div>
              <h2 className="text-xl font-bold text-wl-text-primary mb-4">
                Rate the Driver
              </h2>
              <p className="text-sm text-wl-text-secondary mb-6">
                How professional and courteous was the driver?
              </p>
              <div className="flex justify-center mb-4">
                <RatingStars
                  value={driverCategoryRating}
                  onChange={setDriverCategoryRating}
                  size="lg"
                />
              </div>
            </div>

            {/* Timeliness Category Rating */}
            <div className={cn(
              'pt-8 border-t border-wl-border-subtle'
            )}>
              <h2 className="text-xl font-bold text-wl-text-primary mb-4">
                Rate Timeliness
              </h2>
              <p className="text-sm text-wl-text-secondary mb-6">
                Was the delivery on time?
              </p>
              <div className="flex justify-center mb-4">
                <RatingStars
                  value={timelinessCategoryRating}
                  onChange={setTimelinessCategoryRating}
                  size="lg"
                />
              </div>
            </div>

            {/* Condition Category Rating */}
            <div className={cn(
              'pt-8 border-t border-wl-border-subtle'
            )}>
              <h2 className="text-xl font-bold text-wl-text-primary mb-4">
                Rate Item Condition
              </h2>
              <p className="text-sm text-wl-text-secondary mb-6">
                Were the items delivered in good condition?
              </p>
              <div className="flex justify-center mb-4">
                <RatingStars
                  value={conditionCategoryRating}
                  onChange={setConditionCategoryRating}
                  size="lg"
                />
              </div>
            </div>
          </div>
        )}

        {step === 'feedback' && (
          <div className={cn(
            'bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6',
            'space-y-6'
          )}>
            {/* Summary of All Ratings */}
            <div className={cn(
              'p-4 rounded-lg bg-wl-bg-elevated'
            )}>
              <p className="text-sm text-wl-text-secondary font-medium mb-3">
                <strong>Your Ratings:</strong>
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-wl-text-secondary">Driver:</span>
                  <RatingStars value={driverRating} readonly size="sm" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-wl-text-secondary">Experience:</span>
                  <RatingStars value={experienceRating} readonly size="sm" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-wl-text-secondary">Professionalism:</span>
                  <RatingStars value={driverCategoryRating} readonly size="sm" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-wl-text-secondary">Timeliness:</span>
                  <RatingStars value={timelinessCategoryRating} readonly size="sm" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-wl-text-secondary">Item Condition:</span>
                  <RatingStars value={conditionCategoryRating} readonly size="sm" />
                </div>
              </div>
            </div>

            {/* Feedback Text */}
            <div>
              <label className="block text-wl-text-primary font-medium mb-2">
                Additional Feedback (Optional)
              </label>
              <p className="text-sm text-wl-text-tertiary mb-3">
                Share any additional comments about your delivery experience
              </p>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Tell us about your experience..."
                className={cn(
                  'w-full p-4 rounded-lg border border-wl-border-subtle',
                  'bg-wl-bg-root text-wl-text-primary',
                  'placeholder-wl-text-tertiary',
                  'focus:outline-none focus:border-wl-primary-500',
                  'resize-none h-32'
                )}
              />
            </div>

            {/* Would You Order Again */}
            <div className={cn(
              'pt-6 border-t border-wl-border-subtle'
            )}>
              <label className="block text-wl-text-primary font-medium mb-4">
                Would you order from us again?
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setWouldOrderAgain(true)}
                  className={cn(
                    'flex-1 px-4 py-3 rounded-lg font-medium transition-colors',
                    wouldOrderAgain
                      ? 'bg-wl-success-500 text-white'
                      : 'bg-wl-bg-elevated border border-wl-border-subtle text-wl-text-secondary hover:border-wl-success-500'
                  )}
                >
                  ✓ Yes
                </button>
                <button
                  onClick={() => setWouldOrderAgain(false)}
                  className={cn(
                    'flex-1 px-4 py-3 rounded-lg font-medium transition-colors',
                    !wouldOrderAgain
                      ? 'bg-wl-danger-500 text-white'
                      : 'bg-wl-bg-elevated border border-wl-border-subtle text-wl-text-secondary hover:border-wl-danger-500'
                  )}
                >
                  ✗ No
                </button>
              </div>
            </div>

            {/* Photo Upload */}
            <div className={cn(
              'pt-6 border-t border-wl-border-subtle'
            )}>
              <label className="block text-wl-text-primary font-medium mb-2">
                Add Photos (Optional)
              </label>
              <p className="text-sm text-wl-text-tertiary mb-3">
                Upload photos if there were any issues (e.g., damage, defects)
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
                  'transition-colors duration-fast',
                  photos.length >= 5
                    ? 'border-wl-neutral-700 text-wl-text-tertiary cursor-not-allowed'
                    : 'border-wl-border-subtle text-wl-text-secondary hover:border-wl-primary-500'
                )}
              >
                <ImageIcon size={18} />
                <span>Add Photo ({photos.length}/5)</span>
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className={cn(
            'bg-wl-success-bg border border-wl-success-500/30 rounded-lg p-8',
            'text-center'
          )}>
            <div className={cn(
              'w-16 h-16 mx-auto mb-4 rounded-full',
              'bg-wl-success-500/20 flex items-center justify-center'
            )}>
              <CheckCircle size={32} className="text-wl-success-500" />
            </div>

            <h2 className="text-2xl font-bold text-wl-text-primary mb-2">
              Thank You!
            </h2>
            <p className="text-wl-text-secondary mb-6">
              Your feedback has been submitted successfully. We appreciate your time and will use your insights to improve our service.
            </p>

            <div className={cn(
              'bg-wl-success-500/10 border border-wl-success-500/30',
              'rounded-lg p-4 mb-8 text-left space-y-3'
            )}>
              <p className="text-sm text-wl-text-secondary font-medium">
                <strong>Your Ratings & Feedback:</strong>
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-wl-text-secondary">Driver:</span>
                  <RatingStars value={driverRating} readonly size="sm" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-wl-text-secondary">Experience:</span>
                  <RatingStars value={experienceRating} readonly size="sm" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-wl-text-secondary">Professionalism:</span>
                  <RatingStars value={driverCategoryRating} readonly size="sm" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-wl-text-secondary">Timeliness:</span>
                  <RatingStars value={timelinessCategoryRating} readonly size="sm" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-wl-text-secondary">Condition:</span>
                  <RatingStars value={conditionCategoryRating} readonly size="sm" />
                </div>
              </div>
              <div className={cn(
                'pt-3 border-t border-wl-success-500/20'
              )}>
                <p className="text-sm text-wl-text-secondary">
                  <strong>Order Again:</strong> {wouldOrderAgain ? '✓ Yes' : '✗ No'}
                </p>
              </div>
              {feedback && (
                <div className={cn(
                  'pt-3 border-t border-wl-success-500/20'
                )}>
                  <p className="text-xs text-wl-text-secondary mb-1">
                    <strong>Feedback:</strong>
                  </p>
                  <p className="text-sm text-wl-text-primary italic">"{feedback}"</p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/orders"
                className={cn(
                  'px-6 py-3 rounded-lg font-medium',
                  'bg-wl-primary-500 text-wl-text-inverse',
                  'hover:bg-wl-primary-600 transition-colors'
                )}
              >
                Back to Orders
              </Link>
              <Link
                href="/"
                className={cn(
                  'px-6 py-3 rounded-lg font-medium',
                  'bg-wl-neutral-700 text-wl-text-primary',
                  'hover:bg-wl-neutral-600 transition-colors'
                )}
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {step !== 'success' && (
        <div className="flex gap-3 max-w-2xl">
          {(step === 'feedback' || step === 'categories') && (
            <button
              onClick={() => setStep(step === 'feedback' ? 'categories' : 'rating')}
              className={cn(
                'px-6 py-3 rounded-lg font-medium',
                'bg-wl-neutral-700 text-wl-text-primary',
                'hover:bg-wl-neutral-600 transition-colors'
              )}
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canProceed}
            className={cn(
              'flex-1 px-6 py-3 rounded-lg font-medium',
              'transition-colors',
              !canProceed
                ? 'bg-wl-neutral-800 text-wl-text-tertiary cursor-not-allowed'
                : 'bg-wl-primary-500 text-wl-text-inverse hover:bg-wl-primary-600'
            )}
          >
            {step === 'feedback' ? 'Submit Rating' : 'Continue'}
          </button>
        </div>
      )}
    </div>
  );
}
