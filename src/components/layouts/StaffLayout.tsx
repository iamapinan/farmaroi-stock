
"use client";

import { useAuth } from "@/lib/firebase/context";
import { auth, db } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, CheckSquare, ClipboardList, Truck, Package } from "lucide-react";
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
    { href: "/staff/check", label: "เช็คสต๊อก", icon: CheckSquare },
    { href: "/staff/stock", label: "ยอดคงเหลือ", icon: Package },
    { href: "/staff/stock-in", label: "รับของเข้า", icon: Truck },
    { href: "/staff/po", label: "รายการสั่งซื้อ", icon: ClipboardList },
  ];

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-gray-100 max-w-full">
      {/* Enhanced Header with Gradient */}
      <header className="bg-gradient-to-r from-emerald-500 to-green-600 shadow-lg px-6 py-4 sticky top-0 z-20">
        <div className="flex justify-between items-center">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">Farm Aroi Stock</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 bg-green-200 rounded-full animate-pulse"></div>
              <p className="text-sm text-green-50 font-medium">
                {branchName || userProfile?.branchId || "กำลังโหลด..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {userProfile?.role === 'admin' && (
               <Link 
                 href="/admin/dashboard" 
                 className="px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white text-sm font-medium rounded-lg hover:bg-white/30 transition-all active:scale-95"
               >
                  กลับ Admin
               </Link>
            )}
            <button
              onClick={handleLogout}
              className="p-2.5 bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 transition-all active:scale-95"
              aria-label="ออกจากระบบ"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 pb-24">
        {children}
      </main>

      {/* Enhanced Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-20">
        <div className="flex justify-around items-center px-2 py-2 pb-safe">
          {navItems.map((item) => {
              const Icon = item.icon;
              
              let isActive = false;
              if (item.href === '/staff/stock') {
                   isActive = pathname === '/staff/stock';
              } else {
                   isActive = pathname.startsWith(item.href);
              }

              return (
                   <Link
                      key={item.href}
                      href={item.href}
                      className={clsx(
                        "flex flex-col items-center justify-center px-4 py-2 rounded-xl min-w-[70px] transition-all duration-200 active:scale-95",
                        isActive 
                          ? "text-green-600 bg-green-50 shadow-sm" 
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <Icon className={clsx(
                        "w-6 h-6 mb-1 transition-transform",
                        isActive && "scale-110"
                      )} />
                      <span className={clsx(
                        "text-xs font-medium",
                        isActive && "font-semibold"
                      )}>
                        {item.label}
                      </span>
                   </Link>
              )
          })}
        </div>
      </nav>
    </div>
  );
}
