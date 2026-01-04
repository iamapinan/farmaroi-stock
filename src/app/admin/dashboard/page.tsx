
"use client";

import AdminLayout from "@/components/layouts/AdminLayout";
import AdminGuard from "@/components/auth/AdminGuard";

import { useEffect, useState } from "react";
import { collection, getCountFromServer, query, where, getDocs } from "firebase/firestore"; // getCountFromServer is efficient but costs 1 read per 1000 index entries. simple getDocs.length is fine for small apps.
import { db } from "@/lib/firebase/config";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    products: 0,
    branches: 0,
    orders: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
        try {
            // Count Products
            const productsSnap = await getDocs(collection(db, "products"));
            
            // Count Branches
            const branchesSnap = await getDocs(collection(db, "branches"));

            // Count Pending Orders (Daily Checks with status 'pending' - assuming we use this status)
            // Or count all daily_checks to represent "Orders" today?
            // Let's count "pending" checks for now.
            const ordersSnap = await getDocs(query(collection(db, "daily_checks"), where("status", "==", "pending")));

            setStats({
                products: productsSnap.size,
                branches: branchesSnap.size,
                orders: ordersSnap.size
            });
        } catch (error) {
            console.error("Error fetching stats:", error);
        }
    };
    fetchStats();
  }, []);

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">แดชบอร์ด</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
              <h3 className="text-gray-500 text-sm font-medium">สินค้าทั้งหมด</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.products}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
              <h3 className="text-gray-500 text-sm font-medium">สาขาที่เปิดใช้งาน</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.branches}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-orange-500">
              <h3 className="text-gray-500 text-sm font-medium">รายการรอสั่งซื้อ</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.orders}</p>
            </div>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
