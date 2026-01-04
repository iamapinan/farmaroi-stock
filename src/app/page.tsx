
"use client";

import { useAuth } from "@/lib/firebase/context";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && userProfile) {
      if (userProfile.role === 'admin') {
        router.replace('/admin/dashboard');
      } else if (userProfile.role === 'staff') {
        router.replace('/staff/check');
      } else {
        // Fallback for unknown roles or if role is missing, maybe to a generic profile or just stay here
        // For now, let's default to staff or just stay
        router.replace('/staff/check');
      }
    }
  }, [user, userProfile, loading, router]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Stock System</h1>
      
      {/* If we are here, it means we are either not logged in, or redirect is happening */}
      {/* We can hide the content if user is logged in to avoid flash, but 'loading' check above handles initial state. 
          However, after loading becomes false, if user is present, we redirect. 
          Are we showing the 'Welcome' screen briefly? 
          The useEffect runs after render. So yes, there might be a flash.
          We can add a check here.
      */}
      
      {!user ? (
        <div className="flex flex-col gap-4">
          <Link href="/login" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center justify-center">
            Login
          </Link>
        </div>
      ) : (
         <div className="text-gray-500">Redirecting...</div>
      )}
    </main>
  );
}
