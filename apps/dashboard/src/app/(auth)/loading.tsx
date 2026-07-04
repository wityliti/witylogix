export default function AuthLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated gradient background elements */}
      <div
        className="absolute -top-1/2 -right-1/5 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(245, 166, 35, 0.08) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      <div
        className="absolute -bottom-2/5 -left-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(59, 130, 246, 0.06) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      {/* Loading card container */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo and branding skeleton */}
        <div
          className="flex flex-col items-center mb-8 animate-pulse"
          style={{
            animation: "wl-fade-in 600ms var(--wl-ease-default) both",
            animationDelay: "100ms",
          }}
        >
          <div
            className="flex items-center justify-center w-14 h-14 rounded-lg mb-4 bg-wl-bg-primary"
            style={{
              background:
                "linear-gradient(135deg, var(--wl-primary-500) 0%, var(--wl-primary-600) 100%)",
              boxShadow: "0 8px 24px rgba(245, 166, 35, 0.2)",
            }}
          />
          <div className="h-8 bg-wl-bg-primary rounded w-32 mb-1" />
          <div className="h-4 bg-wl-bg-primary rounded w-40" />
        </div>

        {/* Loading form card */}
        <div
          className="rounded-lg border border-wl-border-subtle p-8 backdrop-blur-lg animate-pulse"
          style={{
            background: "rgba(17, 17, 20, 0.8)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
            animation: "wl-fade-in 600ms var(--wl-ease-default) both",
            animationDelay: "200ms",
          }}
        >
          {/* Form skeleton */}
          <div className="space-y-4">
            {/* Email/username field */}
            <div className="space-y-1">
              <div className="h-4 bg-wl-bg-primary rounded w-24" />
              <div className="h-10 bg-wl-bg-primary rounded" />
            </div>

            {/* Password field */}
            <div className="space-y-1">
              <div className="h-4 bg-wl-bg-primary rounded w-20" />
              <div className="h-10 bg-wl-bg-primary rounded" />
            </div>

            {/* Remember me / forgot password */}
            <div className="flex items-center justify-between">
              <div className="h-4 bg-wl-bg-primary rounded w-32" />
              <div className="h-4 bg-wl-bg-primary rounded w-28" />
            </div>

            {/* Submit button */}
            <div className="h-10 bg-wl-bg-primary rounded mt-6" />

            {/* Divider and social login */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full h-px bg-wl-border-subtle" />
              </div>
            </div>

            {/* Sign up link */}
            <div className="h-4 bg-wl-bg-primary rounded w-full" />
          </div>
        </div>

        {/* Footer skeleton */}
        <div
          className="mt-8 text-center"
          style={{
            animation: "wl-fade-in 600ms var(--wl-ease-default) both",
            animationDelay: "300ms",
          }}
        >
          <div className="h-4 bg-wl-bg-primary rounded w-64 mx-auto animate-pulse" />
        </div>
      </div>
    </div>
  );
}
