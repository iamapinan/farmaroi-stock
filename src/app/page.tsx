
"use client";

import { useAuth } from "@/lib/firebase/context";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
        // Redirect logic could go here, e.g. based on role
        // For now, let's just show a dashboard link
    }
  }, [user, loading, router]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Stock System</h1>
      
      {user ? (
        <div className="flex flex-col gap-4">
          <p>Welcome, {user.email}</p>
          <Link href="/dashboard" className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition">
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Link href="/login" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center justify-center">
            Login
          </Link>
        </div>
      )}
    </main>
  );
}
