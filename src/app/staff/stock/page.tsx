"use client";

import StaffLayout from "@/components/layouts/StaffLayout";
import StaffGuard from "@/components/auth/StaffGuard";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/context";
import { Package, Search, Pencil, Check, X } from "lucide-react";

interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  minStock?: number;
}

interface StockLevel {
  productId: string;
  amount: number;
}

export default function StockBalancePage() {
  const { userProfile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<Record<string, number>>({});
  const [minStocks, setMinStocks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    const init = async () => {
        if (!userProfile) return;
        
        let targetBranchId = userProfile.branchId || ""; 
        
        if (!targetBranchId && userProfile.role === 'admin') {
             try {
                const bSnap = await getDocs(collection(db, 'branches'));
                if (!bSnap.empty) {
                    targetBranchId = bSnap.docs[0].id;
                }
             } catch (e) {
                console.error("Admin fallback error", e);
             }
        }

        try {
            // 1. Load Products
            const pSnap = await getDocs(collection(db, "products"));
            const prodList: Product[] = [];
            pSnap.forEach(d => prodList.push({ id: d.id, ...d.data() } as Product));
            setProducts(prodList);

            if (targetBranchId) {
                // 2. Load Stock Levels
                const sSnap = await getDocs(collection(db, "stocks")); 
                const stockMap: Record<string, number> = {};
                sSnap.forEach(d => {
                    const data = d.data();
                    if (data.branchId === targetBranchId) {
                        stockMap[data.productId] = data.amount;
                    }
                });
                setStocks(stockMap);

                // 3. Load Min Stocks
                const cSnap = await getDocs(collection(db, "branch_products"));
                const configMap: Record<string, number> = {};
                cSnap.forEach(d => {
                   const data = d.data();
                   if (data.branchId === targetBranchId) {
                       configMap[data.productId] = data.minStock;
                   }
                });
                setMinStocks(configMap);
            }

        } catch (e) {
            console.error("Error loading stock data", e);
        } finally {
            setLoading(false);
        }
    };
    init();
  }, [userProfile]);

  const handleEdit = (productId: string, currentVal: number) => {
      setEditingId(productId);
      setEditValue(currentVal.toString());
  };

  const handleCancel = () => {
      setEditingId(null);
      setEditValue("");
  };

  const handleSave = async (productId: string) => {
      if (!userProfile?.branchId) return;
      const num = parseFloat(editValue);
      if (isNaN(num)) return alert("กรุณาระบุตัวเลขที่ถูกต้อง");

      try {
          const stockRef = doc(db, "stocks", `${userProfile.branchId}_${productId}`);
          await setDoc(stockRef, {
              branchId: userProfile.branchId,
              productId: productId,
              amount: num,
              updatedAt: Timestamp.now()
          }, { merge: true });

          // Optimistic Update
          setStocks(prev => ({ ...prev, [productId]: num }));
          setEditingId(null);
      } catch (error) {
          console.error("Error saving stock:", error);
          alert("บันทึกไม่สำเร็จ");
      }
  };

  const categories = Array.from(new Set(products.map(p => p.category)));

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === "All" || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
      return (
        <StaffGuard>
            <StaffLayout>
                <div className="flex justify-center items-center h-64">
                    <div className="text-gray-500">กำลังโหลดข้อมูล...</div>
                </div>
            </StaffLayout>
        </StaffGuard>
      );
  }

  return (
    <StaffGuard>
      <StaffLayout>
        <div className="space-y-4 pb-20">
            {/* Header & Filter UI ... */}
             <div className="flex items-center gap-2 mb-4">
                <Package className="w-6 h-6 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">เช็คยอดคงเหลือ (Stock Balance)</h1>
            </div>

             <div className="flex flex-col gap-3 bg-white p-4 rounded-lg shadow-sm">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="ค้นหาสินค้า..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 w-full border border-gray-300 rounded-md py-2 focus:ring-green-500 focus:border-green-500"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                    <button
                        onClick={() => setFilterCategory("All")}
                        className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${filterCategory === "All" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}
                    >
                        ทั้งหมด
                    </button>
                    {categories.map(c => (
                        <button
                            key={c}
                            onClick={() => setFilterCategory(c)}
                            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${filterCategory === c ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stock List */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สินค้า</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '120px' }}>คงเหลือ</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Min</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะ</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredProducts.map(p => {
                            const current = stocks[p.id] || 0;
                            const min = minStocks[p.id] ?? (p.minStock || 0);
                            const isLow = current <= min;
                            const isEditing = editingId === p.id;
                            
                            return (
                                <tr key={p.id}>
                                    <td className="px-4 py-3">
                                        <div className="text-sm font-medium text-gray-900">{p.name}</div>
                                        <div className="text-xs text-gray-500">{p.category}</div>
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm">
                                        {isEditing ? (
                                            <div className="flex items-center justify-end gap-1">
                                                <input 
                                                    type="number" 
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    className="w-16 border rounded px-1 py-0.5 text-right"
                                                    autoFocus
                                                />
                                                <button onClick={() => handleSave(p.id)} className="text-green-600"><Check className="w-4 h-4" /></button>
                                                <button onClick={handleCancel} className="text-red-500"><X className="w-4 h-4" /></button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-end gap-2 group">
                                                <span className="font-bold text-gray-900">{current}</span>
                                                <button onClick={() => handleEdit(p.id, current)} className="text-gray-400 hover:text-blue-500 opacity-50 group-hover:opacity-100">
                                                    <Pencil className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-gray-500">
                                        {min}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {isLow ? (
                                            <span className="inline-flex px-2 text-xs font-semibold leading-5 text-red-800 bg-red-100 rounded-full">
                                                Low
                                            </span>
                                        ) : (
                                            <span className="inline-flex px-2 text-xs font-semibold leading-5 text-green-800 bg-green-100 rounded-full">
                                                OK
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filteredProducts.length === 0 && !loading && (
                    <div className="text-center py-8 text-gray-500">ไม่พบสินค้า</div>
                )}
            </div>
        </div>
      </StaffLayout>
    </StaffGuard>
  );
}
