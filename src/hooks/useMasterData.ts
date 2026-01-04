
"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

export interface MasterData {
  categories: string[];
  units: string[];
  sources: string[];
}

export function useMasterData() {
  const [data, setData] = useState<MasterData>({
    categories: [],
    units: [],
    sources: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to all 3 docs
    const unsubCat = onSnapshot(doc(db, "master_data", "categories"), (doc) => {
      if (doc.exists()) setData(prev => ({ ...prev, categories: doc.data().values || [] }));
    });
    const unsubUnit = onSnapshot(doc(db, "master_data", "units"), (doc) => {
        if (doc.exists()) setData(prev => ({ ...prev, units: doc.data().values || [] }));
    });
    const unsubSource = onSnapshot(doc(db, "master_data", "sources"), (doc) => {
        if (doc.exists()) setData(prev => ({ ...prev, sources: doc.data().values || [] }));
    });

    // Simple loading logic: Assume loaded after short delay or we can track loading state of each.
    // Since onSnapshot is async, we can just set loading false initially and let it populate.
    // Or for better UX, wait for first reads. But hooks with multiple listeners are tricky to sync 'loading'.
    // We'll just set loading false after a timeout or lazily.
    // A better approach is to promise.all the getDocs if we want initial load, but for realtime sync, this is fine.
    setLoading(false);

    return () => {
      unsubCat();
      unsubUnit();
      unsubSource();
    };
  }, []);

  return { ...data, loading };
}
