"use client";

import AdminLayout from "@/components/layouts/AdminLayout";
import AdminGuard from "@/components/auth/AdminGuard";
import { useState, useEffect } from "react";
import { collection, getDocs, orderBy, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Printer, FileText, History, Filter } from "lucide-react";

interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  source: string;
  minStock?: number;
}

interface StockItem {
  productId: string;
  productName: string;
  category: string;
  toOrder: number;
  amount: number;
  unit: string;
}

interface Transaction {
  id: string;
  date: Timestamp;
  branchId: string;
  items: any[];
  totalCost?: number;
  type?: string;
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'balance' | 'history'>('balance');
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("All");
  
  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
        setLoading(true);
        // Branches
        const bSnap = await getDocs(collection(db, "branches"));
        setBranches(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Products
        const pSnap = await getDocs(collection(db, "products"));
        const prodList = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
        setProducts(prodList);

        // Branch Products (Min Stocks)
        const bpSnap = await getDocs(collection(db, "branch_products"));
        const minStockMap: Record<string, number> = {};
        bpSnap.forEach(d => {
            const data = d.data();
            minStockMap[`${data.branchId}_${data.productId}`] = data.minStock;
        });

        // Stocks (All)
        const sSnap = await getDocs(collection(db, "stocks"));
        const stockList: StockItem[] = [];
        
        // We need to map stocks to products to get details
        sSnap.forEach(doc => {
            const data = doc.data();
            const prod = prodList.find(p => p.id === data.productId);
            if (prod) {
                // Calculate To Order
                const minStock = minStockMap[`${data.branchId}_${data.productId}`] || prod.minStock || 0;
                // If minStock is 0, TO ORDER should ideally be 0 unless specific logic.
                // Assuming toOrder = max(0, minStock - currentStock)
                const toOrder = Math.max(0, minStock - data.amount);

                stockList.push({
                    productId: data.productId,
                    productName: prod.name,
                    category: prod.category,
                    toOrder: toOrder, 
                    amount: data.amount,
                    unit: prod.unit,
                    ...data // includes branchId
                } as any);
            }
        });
        setStocks(stockList);

        // Transactions
        const tSnap = await getDocs(query(collection(db, "stock_transactions"), orderBy("date", "desc")));
        setTransactions(tSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));

    } catch (error) {
        console.error("Error fetching report data", error);
    } finally {
        setLoading(false);
    }
  };

  // Filter Logic
  const filteredStocks = stocks.filter(s => {
      if (selectedBranch !== "All" && (s as any).branchId !== selectedBranch) return false;
      return true;
  });

  const filteredTransactions = transactions.filter(t => {
       if (selectedBranch !== "All" && t.branchId !== selectedBranch) return false;
       return true;
  });


  const handleExportCSV = () => {
    let csvContent = "";
    let filename = "";

    if (activeTab === 'balance') {
        // Headers
        csvContent += "สินค้า,หมวดหมู่,สาขา,จำนวนคงเหลือ,หน่วย\n";
        
        // Rows
        filteredStocks.forEach(item => {
            const branchName = (item as any).branchId ? branches.find(b => b.id === (item as any).branchId)?.name || '-' : '-';
            const row = [
                `"${item.productName.replace(/"/g, '""')}"`,
                `"${item.category.replace(/"/g, '""')}"`,
                `"${branchName.replace(/"/g, '""')}"`,
                item.amount,
                `"${item.unit.replace(/"/g, '""')}"`
            ];
            csvContent += row.join(",") + "\n";
        });
        filename = `stock_balance_${new Date().toISOString().split('T')[0]}.csv`;

    } else {
        // Headers
        csvContent += "วันที่,รายการ,สาขา,ผู้ทำรายการ,ยอดรวม\n";

        // Rows
        filteredTransactions.forEach(t => {
            const dateStr = t.date ? new Date(t.date.seconds * 1000).toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' }) : '-';
            const typeStr = (t.type === 'in' ? 'รับเข้า' : 'ตรวจนับ');
            const itemsStr = t.items?.map(i => i.productName).join(', ') || '';
            const branchName = branches.find(b => b.id === t.branchId)?.name || '-';
            
            const row = [
                `"${dateStr}"`,
                `"${typeStr} - ${itemsStr.replace(/"/g, '""')}"`,
                `"${branchName.replace(/"/g, '""')}"`,
                `"${(t as any).user || 'Unknown'}"`,
                t.totalCost || 0
            ];
            csvContent += row.join(",") + "\n";
        });
        filename = `transaction_history_${new Date().toISOString().split('T')[0]}.csv`;
    }

    // Create BOM for Excel UTF-8 compatibility
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="space-y-6 pb-20 print:pb-0 print:space-y-2">
            
            {/* Header (No Print) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <FileText className="w-6 h-6" />
                    รายงาน & พิมพ์ (Reports)
                </h1>
                
                <div className="flex flex-wrap gap-2">
                     <select 
                        className="border rounded-lg px-3 py-2 bg-white shadow-sm"
                        value={selectedBranch}
                        onChange={e => setSelectedBranch(e.target.value)}
                     >
                         <option value="All">ทุกสาขา (All Branches)</option>
                         {branches.map(b => (
                             <option key={b.id} value={b.id}>{b.name}</option>
                         ))}
                     </select>

                     <button 
                       onClick={handleExportCSV}
                       className="bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 flex items-center gap-2"
                     >
                         <FileText className="w-4 h-4" />
                         Export CSV
                     </button>

                     <button 
                       onClick={handlePrint}
                       className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 flex items-center gap-2"
                     >
                         <Printer className="w-4 h-4" />
                         พิมพ์รายงาน
                     </button>
                </div>
            </div>

            {/* Print Header (Visible only in Print) */}
            <div className="hidden print:block text-center mb-4">
                <h1 className="text-xl font-bold mb-1">รายงานสินค้าคงเหลือ (Stock Balance)</h1>
                <p className="text-sm">สาขา: {selectedBranch === "All" ? "ทั้งหมด" : branches.find(b => b.id === selectedBranch)?.name} | ข้อมูล ณ วันที่: {new Date().toLocaleString('th-TH')}</p>
            </div>

            {/* Tabs (No Print) */}
            <div className="flex gap-2 border-b print:hidden">
                <button
                    onClick={() => setActiveTab('balance')}
                    className={`px-4 py-2 font-medium text-sm transition-colors relative ${activeTab === 'balance' ? "text-green-600" : "text-gray-500 hover:text-gray-700"}`}
                >
                    <span className="flex items-center gap-2"><PackageIcon /> สินค้าคงเหลือ</span>
                    {activeTab === 'balance' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-green-600"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 font-medium text-sm transition-colors relative ${activeTab === 'history' ? "text-green-600" : "text-gray-500 hover:text-gray-700"}`}
                >
                    <span className="flex items-center gap-2"><History className="w-4 h-4"/> ประวัติการซื้อ</span>
                    {activeTab === 'history' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-green-600"></div>}
                </button>
            </div>

            {/* Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[500px] print:border-none print:shadow-none print:min-h-0 print:bg-transparent">
                
                {loading && <div className="p-10 text-center text-gray-500">กำลังโหลดข้อมูล...</div>}

                {!loading && activeTab === 'balance' && (
                    <div className="overflow-x-auto print:overflow-visible">
                        <table className="w-full text-sm text-left print:text-xs">
                            <thead className="bg-gray-50 text-gray-600 font-medium border-b print:bg-transparent print:text-black print:border-black print:border-b-2">
                                <tr>
                                    <th className="py-3 px-4 print:py-1 print:px-2">สินค้า</th>
                                    <th className="py-3 px-4 print:py-1 print:px-2">หมวดหมู่</th>
                                    <th className="py-3 px-4 text-center print:py-1 print:px-2">สาขา</th>
                                    <th className="py-3 px-4 text-right print:py-1 print:px-2">จำนวนคงเหลือ</th>
                                    <th className="py-3 px-4 text-right print:py-1 print:px-2">หน่วย</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 print:divide-gray-300">
                                {filteredStocks.length === 0 ? (
                                    <tr><td colSpan={5} className="py-8 text-center text-gray-400">ไม่พบข้อมูล</td></tr>
                                ) : filteredStocks.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 print:hover:bg-transparent">
                                        <td className="py-3 px-4 font-medium text-gray-900 print:py-1 print:px-2 print:text-black">{item.productName}</td>
                                        <td className="py-3 px-4 text-gray-500 print:py-1 print:px-2 print:text-black">{item.category}</td>
                                        <td className="py-3 px-4 text-center text-gray-500 print:py-1 print:px-2 print:text-black">
                                            {(item as any).branchId ? branches.find(b => b.id === (item as any).branchId)?.name : '-'}
                                        </td>
                                        <td className={`py-3 px-4 text-right font-bold print:py-1 print:px-2 print:text-black ${item.amount > 0 ? 'text-gray-900' : 'text-red-500'}`}>
                                            {item.amount.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-4 text-right text-gray-500 print:py-1 print:px-2 print:text-black">{item.unit}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && activeTab === 'history' && (
                    <div className="overflow-x-auto print:overflow-visible">
                         <table className="w-full text-sm text-left print:text-xs">
                            <thead className="bg-gray-50 text-gray-600 font-medium border-b print:bg-gray-100 print:text-black print:border-black">
                                <tr>
                                    <th className="py-3 px-4 print:py-1">วันที่</th>
                                    <th className="py-3 px-4 print:py-1">รายการ</th>
                                    <th className="py-3 px-4 text-center print:py-1">สาขา</th>
                                    <th className="py-3 px-4 text-center print:py-1">ผู้ทำรายการ</th>
                                    <th className="py-3 px-4 text-right print:py-1">ยอดรวม</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 print:divide-gray-300">
                                {filteredTransactions.length === 0 ? (
                                    <tr><td colSpan={5} className="py-8 text-center text-gray-400">ไม่พบประวัติการทำรายการ</td></tr>
                                ) : filteredTransactions.map((t) => (
                                    <tr key={t.id} className="hover:bg-gray-50 print:hover:bg-transparent break-inside-avoid">
                                        <td className="py-3 px-4 text-gray-500 whitespace-nowrap print:py-1">
                                            {t.date ? new Date(t.date.seconds * 1000).toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' }) : '-'}
                                        </td>
                                        <td className="py-3 px-4 text-gray-900 print:py-1">
                                            <div className="font-medium">{(t.type === 'in' ? 'รับเข้า' : 'ตรวจนับ')} - {t.items?.length || 0} รายการ</div>
                                            <div className="text-xs text-gray-400 truncate max-w-[200px] print:max-w-none print:whitespace-normal">
                                                {t.items?.map(i => i.productName).join(', ')}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-center text-gray-500 print:py-1">
                                            {branches.find(b => b.id === t.branchId)?.name || '-'}
                                        </td>
                                         <td className="py-3 px-4 text-center text-gray-500 text-xs print:py-1">
                                            {(t as any).user || 'Unknown'}
                                        </td>
                                        <td className="py-3 px-4 text-right font-medium text-gray-900 print:py-1">
                                            {t.totalCost ? `฿${t.totalCost.toLocaleString()}` : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}

function PackageIcon(props: any) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m7.5 4.27 9 5.15" />
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22v-10" />
      </svg>
    )
  }
