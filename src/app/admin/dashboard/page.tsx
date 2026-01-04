
"use client";

import AdminLayout from "@/components/layouts/AdminLayout";
import AdminGuard from "@/components/auth/AdminGuard";

import { useEffect, useState } from "react";
import { collection, getCountFromServer, query, where, getDocs, orderBy } from "firebase/firestore"; // getCountFromServer is efficient but costs 1 read per 1000 index entries. simple getDocs.length is fine for small apps.
import { db } from "@/lib/firebase/config";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    products: 0,
    branches: 0,
    orders: 0,
    totalSpend: 0
  });

  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [recentProducts, setRecentProducts] = useState<any[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);

  // New State for Filters
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("All");
  const [timeView, setTimeView] = useState<'daily' | 'monthly' | 'yearly'>('daily');

  // Raw Data (to avoid re-fetching)
  const [rawTransactions, setRawTransactions] = useState<any[]>([]);
  const [rawStocks, setRawStocks] = useState<any[]>([]);
  const [rawBranchProducts, setRawBranchProducts] = useState<any[]>([]);

  // 1. Initial Data Fetch
  useEffect(() => {
    const initData = async () => {
        setLoading(true);
        try {
            // Fetch Basics
            const productsSnap = await getDocs(collection(db, "products"));
            const branchesSnap = await getDocs(collection(db, "branches"));
            const ordersSnap = await getDocs(query(collection(db, "daily_checks"), where("status", "==", "pending")));

            // Fetch Raw Data for client-side filtering
            const transSnap = await getDocs(query(collection(db, "stock_transactions"), orderBy("date", "desc")));
            const transList = transSnap.docs.map(d => ({id: d.id, ...d.data()}));

            const stocksSnap = await getDocs(collection(db, "stocks"));
            const stockList = stocksSnap.docs.map(d => ({id: d.id, ...d.data()}));

            const bpSnap = await getDocs(collection(db, "branch_products"));
            const bpList = bpSnap.docs.map(d => d.data());

            // Process Recent Products (Global)
            const productsList = productsSnap.docs.map(d => ({id: d.id, ...d.data()}));
            // @ts-ignore
            const recent = productsList.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 5);
            setRecentProducts(recent);

            // Store Raw & Basic Stats
            setBranches(branchesSnap.docs.map(d => ({id: d.id, ...d.data()})));
            setRawTransactions(transList);
            setRawStocks(stockList);
            setRawBranchProducts(bpList);

            setStats(prev => ({
                ...prev,
                products: productsSnap.size,
                branches: branchesSnap.size,
                orders: ordersSnap.size
            }));

        } catch (e) {
            console.error("Error loading dashboard data:", e);
        } finally {
            setLoading(false);
        }
    };
    initData();
  }, []);

  // 2. Calculation Effect (Runs when Filter or Raw Data changes)
  useEffect(() => {
    if (loading) return;

    // Filter Transactions
    const filteredTrans = selectedBranch === "All" 
        ? rawTransactions 
        : rawTransactions.filter(t => t.branchId === selectedBranch);

    // Calculate Stats
    let totalSpend = 0;
    const productStats: Record<string, {name: string, count: number, total: number}> = {};
    const historyMap: Record<string, number> = {};

    filteredTrans.forEach(t => {
        const cost = t.totalCost || 0;
        totalSpend += cost;

        // Time Aggregation
        let dateKey = 'Unknown';
        const dateObj = t.date?.toDate ? t.date.toDate() : new Date(); // Handle timestamps
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');

        if (timeView === 'daily') {
            dateKey = `${day}/${month}/${year}`;
        } else if (timeView === 'monthly') {
            dateKey = `${month}/${year}`;
        } else if (timeView === 'yearly') {
            dateKey = `${year}`;
        }
        
        historyMap[dateKey] = (historyMap[dateKey] || 0) + cost;

        // Product Frequency
        if (t.items && Array.isArray(t.items)) {
            t.items.forEach((item: any) => {
                    if (!productStats[item.productId]) {
                        productStats[item.productId] = { name: item.productName, count: 0, total: 0 };
                    }
                    productStats[item.productId].count += 1;
                    productStats[item.productId].total += (item.qty * item.price);
            });
        }
    });

    // Update Top Products
    const sortedProducts = Object.values(productStats)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    setTopProducts(sortedProducts);

    // Update History (Sort by date)
    const sortedHistory = Object.entries(historyMap)
        .map(([date, total]) => ({ date, total }))
        .sort((a, b) => {
            // Quick sort by parsing date string depending on format
            // daily: DD/MM/YYYY, monthly: MM/YYYY, yearly: YYYY
            const partsA = a.date.split('/').map(Number);
            const partsB = b.date.split('/').map(Number);
            
            if (timeView === 'daily') {
                // YYYY (2) MM (1) DD (0)
                return new Date(partsB[2], partsB[1]-1, partsB[0]).getTime() - new Date(partsA[2], partsA[1]-1, partsA[0]).getTime();
            } else if (timeView === 'monthly') {
                // YYYY (1) MM (0)
                return new Date(partsB[1], partsB[0]-1).getTime() - new Date(partsA[1], partsA[0]-1).getTime();
            } else {
                 // YYYY
                return partsB[0] - partsA[0];
            }
        })
        .slice(0, 7); // Show last 7 entries (days/months/years)
    setPurchaseHistory(sortedHistory);

    // Update Stats Total Spend
    setStats(prev => ({ ...prev, totalSpend }));

    // Low Stock Calculation
    // Build Min Stock Map
    const minStockMap: Record<string, number> = {};
    rawBranchProducts.forEach(bp => {
        // Filter by branch? Yes if selected.
        if (selectedBranch === "All" || bp.branchId === selectedBranch) {
             // If All, we might have multiple minStocks for same product different branch.
             // Unique key: branchId_productId
             minStockMap[`${bp.branchId}_${bp.productId}`] = bp.minStock;
        }
    });

    const lowStockList: any[] = [];
    rawStocks.forEach(s => {
        if (selectedBranch !== "All" && s.branchId !== selectedBranch) return;

        const min = minStockMap[`${s.branchId}_${s.productId}`] || 0;
        if (min > 0 && s.amount <= min) {
            lowStockList.push({
                ...s,
                minStock: min,
                status: s.amount === 0 ? 'Out of Stock' : 'Low Stock',
                branchName: branches.find(b => b.id === s.branchId)?.name || 'Unknown' // Helper to see branch in All view
            });
        }
    });
    lowStockList.sort((a, b) => a.amount - b.amount);
    setLowStockItems(lowStockList.slice(0, 10)); // Maybe show more? 5->10

  }, [selectedBranch, timeView, loading, rawTransactions, rawStocks, rawBranchProducts, branches]);


  if (loading) {
      return (
        <AdminGuard>
            <AdminLayout>
                <div className="flex h-64 items-center justify-center text-gray-400">
                    กำลังโหลดข้อมูล...
                </div>
            </AdminLayout>
        </AdminGuard>
      );
  }

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="space-y-8 pb-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                 <h1 className="text-2xl font-bold text-gray-900">แดชบอร์ดภาพรวม</h1>
                 <div className="text-sm text-gray-500 mt-1">ข้อมูลล่าสุด: {new Date().toLocaleTimeString('th-TH')}</div>
            </div>
            
            {/* Branch Selector */}
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
                <span className="text-sm font-bold text-gray-700 ml-2">สาขา:</span>
                <select 
                    className="border-none bg-gray-50 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-green-500 cursor-pointer"
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                >
                    <option value="All">ทุกสาขา</option>
                    {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
            </div>
          </div>
          
          {/* Main Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
              <h3 className="text-gray-500 text-sm font-medium">สินค้าทั้งหมด</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.products} <span className="text-sm font-normal text-gray-400">รายการ</span></p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
              <h3 className="text-gray-500 text-sm font-medium">สาขาที่เปิดใช้งาน</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.branches} <span className="text-sm font-normal text-gray-400">แห่ง</span></p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
              <h3 className="text-gray-500 text-sm font-medium">รอสั่งซื้อ (Pending)</h3>
              <p className="text-3xl font-bold text-orange-600 mt-2">{stats.orders} <span className="text-sm font-normal text-gray-400">รายการ</span></p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
              <h3 className="text-gray-500 text-sm font-medium">ยอดซื้อสะสม ({selectedBranch === 'All' ? 'รวม' : 'สาขา'})</h3>
              <p className="text-3xl font-bold text-green-600 mt-2">฿{stats.totalSpend.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Purchase History */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                           ประวัติการสั่งซื้อ
                      </h3>
                      {/* Time View Toggles */}
                      <div className="flex bg-gray-100 rounded-lg p-1">
                          <button 
                            onClick={() => setTimeView('daily')}
                            className={`px-3 py-1 text-xs rounded-md transition-all ${timeView === 'daily' ? 'bg-white shadow text-green-700 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                          >
                              รายวัน
                          </button>
                          <button 
                            onClick={() => setTimeView('monthly')}
                            className={`px-3 py-1 text-xs rounded-md transition-all ${timeView === 'monthly' ? 'bg-white shadow text-green-700 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                          >
                              รายเดือน
                          </button>
                          <button 
                            onClick={() => setTimeView('yearly')}
                            className={`px-3 py-1 text-xs rounded-md transition-all ${timeView === 'yearly' ? 'bg-white shadow text-green-700 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                          >
                              รายปี
                          </button>
                      </div>
                  </div>
                  
                  <div className="space-y-4">
                      {purchaseHistory.length > 0 ? purchaseHistory.map((h, idx) => (
                          <div key={idx} className="flex justify-between items-center border-b border-gray-50 pb-2 last:border-0">
                              <span className="text-gray-600 font-medium">{h.date}</span>
                              <span className="font-bold text-gray-900">฿{h.total.toLocaleString()}</span>
                          </div>
                      )) : <p className="text-gray-400 text-sm py-4 text-center">ยังไม่มีข้อมูลสำหรับช่วงเวลานี้</p>}
                  </div>
              </div>

              {/* Top Products */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-lg text-gray-800 mb-4">สินค้าที่มีมูลค่าการซื้อสูงสุด 5 อันดับ ({selectedBranch === 'All' ? 'รวม' : 'สาขา'})</h3>
                  <div className="space-y-4">
                      {topProducts.length > 0 ? topProducts.map((p, idx) => (
                          <div key={idx} className="flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                      {idx + 1}
                                  </div>
                                  <div>
                                      <p className="font-medium text-gray-900 line-clamp-1">{p.name}</p>
                                      <p className="text-xs text-gray-500">ซื้อ {p.count} ครั้ง</p>
                                  </div>
                              </div>
                              <span className="font-bold text-gray-900">฿{p.total.toLocaleString()}</span>
                          </div>
                      )) : <p className="text-gray-400 text-sm py-4 text-center">ยังไม่มีข้อมูลสินค้า</p>}
                  </div>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {/* Low Stock Alert */}
               <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2 text-red-600">
                      สินค้าใกล้หมด / ต้องเติม
                  </h3>
                   <div className="overflow-x-auto max-h-80 overflow-y-auto custom-scrollbar">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-gray-50 text-gray-500 sticky top-0 z-10">
                              <tr>
                                  <th className="p-2 rounded-l-lg">สินค้า</th>
                                  {selectedBranch === 'All' && <th className="p-2">สาขา</th>}
                                  <th className="p-2 text-center">คงเหลือ</th>
                                  <th className="p-2 text-center">ขั้นต่ำ</th>
                                  <th className="p-2 rounded-r-lg text-right">สถานะ</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                              {lowStockItems.length > 0 ? lowStockItems.map((item, idx) => (
                                  <tr key={idx}>
                                      <td className="p-2 font-medium">
                                          <div className="line-clamp-1">{item.productName}</div>
                                      </td>
                                      {selectedBranch === 'All' && <td className="p-2 text-xs text-gray-500">{item.branchName}</td>}
                                      <td className="p-2 text-center text-gray-900 font-bold">{item.amount}</td>
                                      <td className="p-2 text-center text-gray-500">{item.minStock}</td>
                                      <td className="p-2 text-right">
                                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${item.amount === 0 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                              {item.status}
                                          </span>
                                      </td>
                                  </tr>
                              )) : (
                                  <tr>
                                      <td colSpan={selectedBranch === 'All' ? 5 : 4} className="p-8 text-center text-gray-400">สต๊อกปกติทุกรายการ</td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                   </div>
               </div>

               {/* Recent Products */}
               <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-lg text-gray-800 mb-4">สินค้าเพิ่มเข้ามาใหม่ (ล่าสุด 5 รายการ)</h3>
                  <div className="space-y-3">
                      {recentProducts.length > 0 ? recentProducts.map((p, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg transition-colors border border-gray-100">
                              <div>
                                  <p className="font-medium text-gray-900">{p.name}</p>
                                  <p className="text-xs text-gray-500">{p.category} • {p.unit}</p>
                              </div>
                              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">New</span>
                          </div>
                      )) : <p className="text-gray-400 text-sm py-4 text-center">ไม่มีสินค้าใหม่</p>}
                  </div>
               </div>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
