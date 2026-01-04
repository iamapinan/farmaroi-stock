
"use client";

import { useAuth } from "@/lib/firebase/context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (userProfile && userProfile.role !== "admin") {
        router.push("/login?error=unauthorized"); // Or a 403 page
      }
    }
  }, [user, userProfile, loading, router]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!user || (userProfile && userProfile.role !== "admin")) {
    return null; // Will redirect
  }

  return <>{children}</>;
}
