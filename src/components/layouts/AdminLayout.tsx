
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, Users, Store, LogOut, Settings, Menu, X, FileText } from "lucide-react";
import { useAuth } from "@/lib/firebase/context";
import { auth } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { useState, useEffect } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { userProfile } = useAuth();
  const router = useRouter();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    // Close sidebar when route changes on mobile
    setIsSidebarOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const menuItems = [
    { href: "/admin/dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
    { href: "/admin/products", label: "จัดการสินค้า", icon: Package },
    { href: "/admin/users", label: "ผู้ใช้งาน", icon: Users },
    { href: "/admin/reports", label: "รายงาน", icon: FileText },
    { href: "/admin/branches", label: "จัดการสาขา", icon: Store },
    { href: "/admin/settings", label: "ตั้งค่า", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full bg-white shadow-sm z-20 px-4 py-3 flex justify-between items-center print:hidden">
        <h1 className="font-bold text-green-700">Farm Aroi Admin</h1>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-600">
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
            className="md:hidden fixed inset-0 bg-black/50 z-30 print:hidden"
            onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        "bg-white shadow-md flex flex-col fixed md:static inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ease-in-out print:hidden",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 border-b max-md:mt-12">
          <h1 className="text-xl font-bold text-green-700 max-md:hidden">Farm Aroi Admin</h1>
          <p className="text-xs text-gray-500 mt-1">{userProfile?.email}</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                  isActive
                    ? "bg-green-50 text-green-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t space-y-2">
          <Link
            href="/staff/check"
            className="flex items-center w-full px-4 py-3 text-sm font-medium text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Store className="w-5 h-5 mr-3" />
            สลับโหมดพนักงาน
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8 pt-16 md:pt-8 w-full print:p-0 print:overflow-visible">
        {children}
      </main>
    </div>
  );
}
