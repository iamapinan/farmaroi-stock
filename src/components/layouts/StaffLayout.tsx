
"use client";

import { useAuth } from "@/lib/firebase/context";
import { auth, db } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, FileText, CheckSquare, ClipboardList, Truck, Package } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const { userProfile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [branchName, setBranchName] = useState<string>("");

  useEffect(() => {
    const fetchBranch = async () => {
      if (userProfile && userProfile.branchId) {
        try {
          const docRef = doc(db, "branches", userProfile.branchId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setBranchName(docSnap.data().name);
          } else {
             setBranchName("สาขาไม่พบ");
          }
        } catch (error) {
          console.error("Error fetching branch:", error);
          setBranchName("Error");
        }
      } 
    };
    
    if (userProfile?.branchId) {
        fetchBranch();
    }
  }, [userProfile]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const navItems = [
    { href: "/staff/stock", label: "ยอดคงเหลือ", icon: Package },
    { href: "/staff/check", label: "เช็คสต๊อก", icon: CheckSquare },
    { href: "/staff/stock-in", label: "รับของเข้า", icon: Truck },
    { href: "/staff/po", label: "รายการสั่งซื้อ", icon: ClipboardList },
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50 max-w-full">
      {/* Mobile Header */}
      <header className="bg-white shadow-sm px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-green-700">Stock</h1>
          <p className="text-md text-gray-500">สาขา: {branchName || userProfile?.branchId || "กำลังโหลด..."}</p>
        </div>
        <div className="flex items-center gap-2">
          {userProfile?.role === 'admin' && (
             <Link href="/admin/dashboard" className="p-2 text-blue-600 hover:text-blue-800 text-sm font-medium">
                กลับ Admin
             </Link>
          )}
          <button
            onClick={handleLogout}
            className="p-2 text-gray-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 pb-20">
        {children}
      </main>

      {/* Bottom Nav for Mobile */}
      <nav className="fixed bottom-0 w-full bg-white border-t flex justify-around p-2 pb-safe">
        {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
                 <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex flex-col items-center p-2 rounded-lg w-full",
                      isActive ? "text-green-600" : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    <Icon className="w-6 h-6 mb-1" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </Link>
            )
        })}
      </nav>
    </div>
  );
}
