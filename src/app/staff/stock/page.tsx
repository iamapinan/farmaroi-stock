"use client";

import StaffLayout from "@/components/layouts/StaffLayout";
import StaffGuard from "@/components/auth/StaffGuard";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, setDoc, Timestamp, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/context";
import { Package, Search, Pencil, Check, X, TrendingDown, TrendingUp } from "lucide-react";

interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  minStock?: number;
  disableStockCheck?: boolean;
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
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    let unsubscribeStocks: () => void;

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
            // 1. Load Products
            const pSnap = await getDocs(collection(db, "products"));
            const prodList: Product[] = [];
            pSnap.forEach(d => {
                const data = d.data() as Omit<Product, "id">;
                // Filter out disableStockCheck
                if (!data.disableStockCheck) {
                    prodList.push({ id: d.id, ...data });
                }
            });
            setProducts(prodList);

            if (targetBranchId) {
                // 2. Load Stock Levels (Real-time)
                const q = query(collection(db, "stocks"), where("branchId", "==", targetBranchId));
                unsubscribeStocks = onSnapshot(q, (snapshot) => {
                    const stockMap: Record<string, number> = {};
                    snapshot.forEach(d => {
                        const data = d.data();
                        stockMap[data.productId] = data.amount;
                    });
                    setStocks(stockMap);
                });

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
            setLoading(false);
    };

    init();

    return () => {
        if (unsubscribeStocks) unsubscribeStocks();
    };
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

  // Calculate summary stats
  const totalItems = filteredProducts.length;
  const lowStockCount = filteredProducts.filter(p => {
    const current = stocks[p.id] || 0;
    const min = minStocks[p.id] ?? (p.minStock || 0);
    return current < min;
  }).length;

  if (loading) {
      return (
        <StaffGuard>
            <StaffLayout>
                <div className="flex justify-center items-center h-64">
                    <div className="animate-pulse text-gray-500">กำลังโหลดข้อมูล...</div>
                </div>
            </StaffLayout>
        </StaffGuard>
      );
  }

  return (
    <StaffGuard>
      <StaffLayout>
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl shadow-lg">
                  <Package className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900">ยอดคงเหลือ</h1>
                  <p className="text-sm text-gray-500">Stock Balance</p>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium">ทั้งหมด</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{totalItems}</p>
                  </div>
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium">ต่ำกว่า Min</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{lowStockCount}</p>
                  </div>
                  <div className="p-2 bg-red-50 rounded-lg">
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  </div>
                </div>
              </div>
            </div>


            {/* Search & Filter - Sticky with Toggle */}
            <div className="sticky top-[-20px] z-10 bg-gradient-to-br from-gray-50 to-gray-100 -mx-4 px-4 shadow-md">
                {/* Toggle Button */}
                <div className="flex justify-center pt-1 pb-2">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="px-4 py-1 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:bg-white hover:border-green-300 transition-all active:scale-95 shadow-sm"
                  >
                    {showFilters ? "ซ่อนตัวกรอง ▲" : "แสดงตัวกรอง ▼"}
                  </button>
                </div>

                {/* Collapsible Content */}
                <div className={`overflow-hidden transition-all duration-300 ${showFilters ? 'max-h-96 opacity-100 pb-3' : 'max-h-0 opacity-0'}`}>
                  <div className="space-y-3">
                    <div className="relative">
                        <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="ค้นหาสินค้า..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-12 w-full bg-white border-2 border-gray-200 rounded-xl py-3 text-base focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all shadow-sm"
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <button
                            onClick={() => setFilterCategory("All")}
                            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                              filterCategory === "All" 
                                ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md" 
                                : "bg-white text-gray-600 border border-gray-200 hover:border-green-300"
                            }`}
                        >
                            ทั้งหมด ({totalItems})
                        </button>
                        {categories.map(c => {
                            const count = products.filter(p => p.category === c).length;
                            return (
                              <button
                                  key={c}
                                  onClick={() => setFilterCategory(c)}
                                  className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                                    filterCategory === c 
                                      ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md" 
                                      : "bg-white text-gray-600 border border-gray-200 hover:border-green-300"
                                  }`}
                              >
                                  {c} ({count})
                              </button>
                            );
                        })}
                    </div>
                  </div>
                </div>
            </div>

            {/* Products List - Responsive Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-4">
                {filteredProducts.map(p => {
                    const current = stocks[p.id] || 0;
                    const min = minStocks[p.id] ?? (p.minStock || 0);
                    const isLow = current < min;
                    const isEditing = editingId === p.id;
                    
                    return (
                        <div 
                          key={p.id} 
                          className={`bg-white rounded-xl p-3 shadow-sm border-2 transition-all ${
                            isLow 
                              ? "border-red-200 bg-red-50/30" 
                              : "border-gray-100 hover:border-green-200"
                          }`}
                        >
                            {/* Compact Product Header */}
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-gray-900 text-base truncate">{p.name}</h3>
                                    <p className="text-xs text-gray-500">{p.category}</p>
                                </div>
                                <div className={`px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ml-2 ${
                                  isLow 
                                    ? "bg-red-100 text-red-700" 
                                    : "bg-green-100 text-green-700"
                                }`}>
                                    {isLow ? "Low" : "OK"}
                                </div>
                            </div>

                            {/* Compact Stock Info */}
                            <div className="grid grid-cols-3 gap-2">
                                {/* Current Stock */}
                                <div className="col-span-2 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg p-2">
                                    <p className="text-xs text-gray-600 font-medium mb-0.5">คงเหลือ</p>
                                    {isEditing ? (
                                        <div className="flex items-center gap-1">
                                            <input 
                                                type="number" 
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                className="flex-1 text-xl font-bold bg-white border-2 border-blue-300 rounded px-1 py-0.5 text-center focus:ring-2 focus:ring-blue-500"
                                                autoFocus
                                            />
                                            <button 
                                              onClick={() => handleSave(p.id)} 
                                              className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600 active:scale-95 transition-all"
                                            >
                                              <Check className="w-4 h-4" />
                                            </button>
                                            <button 
                                              onClick={handleCancel} 
                                              className="p-1.5 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 active:scale-95 transition-all"
                                            >
                                              <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <span className={`text-2xl font-bold ${isLow ? "text-red-600" : "text-blue-900"}`}>
                                              {current}
                                            </span>
                                            <button 
                                              onClick={() => handleEdit(p.id, current)} 
                                              className="p-1.5 bg-white/60 backdrop-blur-sm text-blue-600 rounded hover:bg-white active:scale-95 transition-all"
                                            >
                                              <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Min Stock */}
                                <div className="bg-gray-100 rounded-lg p-2">
                                    <p className="text-xs text-gray-600 font-medium mb-0.5">Min</p>
                                    <p className="text-xl font-bold text-gray-700">{min}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Empty State */}
            {filteredProducts.length === 0 && !loading && (
                <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">ไม่พบสินค้า</p>
                    <p className="text-sm text-gray-400 mt-1">ลองค้นหาด้วยคำอื่น</p>
                </div>
            )}
        </div>
      </StaffLayout>
    </StaffGuard>
  );
}
