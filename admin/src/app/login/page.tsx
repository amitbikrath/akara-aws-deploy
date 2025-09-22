'use client';

export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto py-16">
      <h1 className="text-2xl font-semibold mb-4">Login</h1>
      <p className="text-sm opacity-80">
        This is a placeholder. Wire this to Cognito Hosted UI or your auth flow next.
      </p>
      <div className="mt-6">
        <a
          className="inline-block rounded bg-black px-4 py-2 text-white"
          href="/auth/callback"
        >
          Continue
        </a>
      </div>
    </div>
  );
}