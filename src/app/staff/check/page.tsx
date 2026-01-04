
"use client";

import { Suspense } from "react";
import StaffLayout from "@/components/layouts/StaffLayout";
import StaffGuard from "@/components/auth/StaffGuard";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, setDoc, getDoc, query, where, Timestamp, addDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/context";
import { useRouter, useSearchParams } from "next/navigation";
import { Save, ArrowRight, Plus, Minus, Search } from "lucide-react";
import { useMasterData } from "@/hooks/useMasterData";

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
  product: Product;
  minStock: number;
  currentStock: string; // string for input, parse to number
  toOrder: number;
}

function CheckContent() {
  const { userProfile } = useAuth();
  const { categories } = useMasterData();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('editId');
  
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filterCategory, setFilterCategory] = useState("All");
  const [search, setSearch] = useState(""); // Add search state
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
        if (!userProfile) return;

        let targetBranch = userProfile.branchId;
        
        if (!targetBranch && userProfile.role === 'admin') {
            // Admin switching to staff mode: use first available branch
            try {
                const bSnap = await getDocs(collection(db, 'branches'));
                if (!bSnap.empty) {
                    targetBranch = bSnap.docs[0].id;
                }
            } catch (e) {
                console.error("Error fetching branches for admin fallback", e);
            }
        }
        
        if (targetBranch) {
             setActiveBranchId(targetBranch);
             await loadData(targetBranch);

             if (editId) {
                loadEditData(editId);
            }
        }
    };
    init();
  }, [userProfile, editId]);

  const loadEditData = async (id: string) => {
      try {
          const docRef = doc(db, "daily_checks", id);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
              const data = snap.data();
              const savedItemsMap: Record<string, number> = {};
              if (data.items && Array.isArray(data.items)) {
                  data.items.forEach((item: any) => {
                      savedItemsMap[item.productId] = item.toOrder;
                  });
              }
              
              setItems(prevItems => prevItems.map(item => {
                  const savedOrder = savedItemsMap[item.productId];
                  if (savedOrder !== undefined) {
                      const derivedCurrent = Math.max(0, item.minStock - savedOrder);
                      return {
                          ...item,
                          toOrder: savedOrder,
                          currentStock: derivedCurrent.toString()
                      };
                  }
                  return item;
              }));
          }
      } catch (e) {
          console.error("Error loading PO for edit", e);
      }
  };

  const loadData = async (branchId: string) => {
    try {
      // 1. Get All Products
      const prodSnap = await getDocs(collection(db, "products"));
      const products: Product[] = [];
      prodSnap.forEach((d) => products.push({ id: d.id, ...d.data() } as Product));

      // 2. Get Branch Config (Min Stocks)
      const configSnap = await getDocs(query(collection(db, "branch_products"), where("branchId", "==", branchId)));
      const configMap: Record<string, number> = {};
      configSnap.forEach(d => {
        configMap[d.data().productId] = d.data().minStock;
      });

      // 3. Get Current Stock Levels
      const stockSnap = await getDocs(collection(db, "stocks"));
      const stockMap: Record<string, number> = {};
      stockSnap.forEach(d => {
          const data = d.data();
          if (data.branchId === branchId) {
              stockMap[data.productId] = data.amount;
          }
      });

      // 4. Build Items State
      const initialItems: StockItem[] = products.map(p => {
        const currentQty = stockMap[p.id];
        // If we have a record, show it. If undefined, leave empty to prompt check?
        // User asked to "show latest", so we show what we have.
        const currentStockStr = currentQty !== undefined ? currentQty.toString() : "0";
        
        // Calculate initial toOrder based on this pre-filled stock?
        // If we pre-fill, we should probably calc toOrder too if it's < minStock.
        const minStock = configMap[p.id] ?? (p.minStock || 0);
        let toOrder = 0;
        if (currentQty !== undefined) {
             toOrder = Math.max(0, minStock - currentQty);
        }

        return {
            productId: p.id,
            product: p,
            minStock: minStock, 
            currentStock: currentStockStr,
            toOrder: toOrder
        };
      });
      setItems(initialItems);

    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMinStockChange = (productId: string, val: string) => {
    // If val is empty, we set to 0 to comply with "show 0". 
    // However, to allow typing, maybe we need to treat it carefully.
    // But since user asked specifically for "if none, show 0", defaulting to 0 is main goal.
    const num = val === "" ? 0 : parseFloat(val);
    setItems(items.map(i => i.productId === productId ? { ...i, minStock: isNaN(num) ? 0 : num } : i));
  };

  const handleCurrentChange = (productId: string, val: string) => {
    setItems(items.map(i => {
      if (i.productId === productId) {
        // Allow empty string for backspace
        if (val === "") return { ...i, currentStock: "", toOrder: i.minStock };

        const current = parseFloat(val);
        const toOrder = Math.max(0, i.minStock - (isNaN(current) ? 0 : current));
        return { ...i, currentStock: val, toOrder };
      }
      return i;
    }));
  };

  const adjustStock = (productId: string, delta: number) => {
     setItems(items.map(i => {
         if (i.productId === productId) {
             const currentVal = parseFloat(i.currentStock) || 0;
             const newVal = Math.max(0, currentVal + delta);
             const toOrder = Math.max(0, i.minStock - newVal);
             return { ...i, currentStock: newVal.toString(), toOrder };
         }
         return i;
     }));
  };

  const saveMinStock = async (item: StockItem) => {
    if (!activeBranchId) return;
    try {
      const id = `${activeBranchId}_${item.productId}`;
      await setDoc(doc(db, "branch_products", id), {
        branchId: activeBranchId,
        productId: item.productId,
        minStock: item.minStock
      });
      console.log(`Saved Min Stock for ${item.product.name} to branch ${activeBranchId}`);
    } catch (error) {
      console.error("Error saving min stock:", error);
    }
  };


  const handleSubmit = async () => {
     setSubmitting(true);
     if (!activeBranchId) {
        setSubmitting(false);
        return;
     }
     
     const orderItems = items.filter(i => i.toOrder > 0).map(i => ({
        productId: i.productId,
        productName: i.product.name,
        source: i.product.source,
        unit: i.product.unit,
        toOrder: i.toOrder
     }));

     const toOrderCount = orderItems.length;

     const checkData = {
        branchId: activeBranchId,
        date: Timestamp.now(), // Update timestamp on edit? Or keep original? Usually update to show latest activity.
        user: userProfile?.email || 'Unknown',
        items: orderItems,
        status: 'pending' 
     };

     try {
        // 1. Save Stock Counts (Inventory Take)
        const stockUpdates = items.map(item => {
            const current = parseFloat(item.currentStock);
            if (!isNaN(current)) {
                // If user entered a number, we update the master stock record
                const stockRef = doc(db, "stocks", `${activeBranchId}_${item.productId}`);
                return setDoc(stockRef, {
                    branchId: activeBranchId,
                    productId: item.productId,
                    productName: item.product.name, // helpful for debugging
                    amount: current,
                    updatedAt: Timestamp.now()
                }, { merge: true });
            }
            return Promise.resolve();
        });
        
        await Promise.all(stockUpdates);

        // 2. Save/Update PO
        if (editId) {
            // Update existing
            await updateDoc(doc(db, "daily_checks", editId), checkData);
            router.push(`/staff/po/${editId}`);
            alert("โปรดอัพเดทรายการสั่งซื้อเรียบร้อย");
        } else {
            // Create New
            const docRef = await addDoc(collection(db, "daily_checks"), checkData);
            router.push(`/staff/po/${docRef.id}`);
            if (toOrderCount > 0) {
                alert(`บันทึกเรียบร้อย! มี ${toOrderCount} รายการที่ต้องสั่งซื้อ`);
            } else {
                alert("บันทึกสต๊อกเรียบร้อย (ไม่มีรายการที่ต้องสั่ง)");
            }
        }
    } catch (error) {
      console.error("Error saving check:", error);
      alert("บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesCategory = filterCategory === "All" || item.product.category === filterCategory;
    const matchesSearch = item.product.name.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-4 pb-20 relative">
        <div className="sticky top-[-20px] bg-gray-50 pt-2 pb-4 z-20 space-y-4 -mx-4 px-4 border-b border-gray-200 shadow-sm">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Daily Stock Check</h2>
            </div>


            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="ค้นหาสินค้า..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 w-full border border-gray-300 rounded-lg py-2 focus:ring-green-500 focus:border-green-500 shadow-sm"
                />
            </div>

            {/* Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                <button
                    onClick={() => setFilterCategory("All")}
                    className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${filterCategory === "All" ? "bg-green-600 text-white shadow-md" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                >
                    ทั้งหมด
                </button>
                {categories.map(c => (
                    <button
                        key={c}
                        onClick={() => setFilterCategory(c)}
                        className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${filterCategory === c ? "bg-green-600 text-white shadow-md" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                    >
                        {c}
                    </button>
                ))}
            </div>
        </div>
        <div className="flex justify-between items-center mb-4">
    <h1 className="text-xl font-bold text-gray-900">เช็คสต๊อกวันนี้</h1>
    <div className="text-sm text-gray-500">
        {new Date().toLocaleDateString('th-TH')}
    </div>
  </div>

  <div className="space-y-4">
    {filteredItems.map((item) => (
      <div 
          key={item.productId} 
          className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3 focus-within:ring-2 focus-within:ring-green-500 focus-within:bg-green-50 transition-all duration-200"
      >
          {/* Header Row */}
          <div className="flex justify-between items-start">
               <div>
                   <h3 className="font-bold text-gray-900 text-lg leading-snug">{item.product.name}</h3>
                   <div className="flex items-center gap-2 mt-1">
                       <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {item.product.category}
                       </span>
                       <span className="text-xs text-gray-400">
                          {item.product.source}
                       </span>
                   </div>
               </div>
               
               {/* Min Stock (Secondary Info) */}
               <div className="flex flex-col items-end">
                   <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">ขั้นต่ำ (Min)</span>
                   <div className="flex items-center bg-gray-50 rounded-lg p-1 border border-gray-100">
                      <input 
                          type="number"
                          inputMode="decimal"
                          className="w-12 text-center text-sm font-bold bg-transparent outline-none text-gray-600"
                          value={item.minStock}
                          onChange={(e) => handleMinStockChange(item.productId, e.target.value)}
                          onBlur={() => saveMinStock(item)}
                      />
                   </div>
               </div>
          </div>


          {/* Main Controls Row (Full Width) */}
          <div className="pt-2 border-t border-gray-100/50 space-y-4">
              
              {/* Row 1: Current Stock (Primary Action) */}
              <div>
                  <label className="text-xs font-bold text-gray-500 mb-2 block uppercase tracking-wide text-center">
                    ของที่มีอยู่ (Current)
                  </label>
                  <div className="flex items-center gap-3">
                       <button 
                         onClick={() => adjustStock(item.productId, -1)}
                         className="h-14 w-1/6 rounded-2xl border border-orange-200 bg-white shadow-sm flex items-center justify-center text-gray-600 active:bg-gray-100 active:scale-95 transition-all touch-manipulation"
                       >
                           <Minus className="w-6 h-6" />
                       </button>
                       <input 
                           type="number"
                           inputMode="decimal"
                           className="w-4/6 h-14 text-center text-3xl font-bold border border-blue-300 rounded-2xl focus:ring-4 focus:ring-green-100 focus:border-green-500 shadow-inner bg-white text-gray-800"
                           value={item.currentStock}
                           onChange={(e) => handleCurrentChange(item.productId, e.target.value)}
                           onFocus={(e) => e.target.select()} 
                           placeholder="0"
                       />
                       <button 
                         onClick={() => adjustStock(item.productId, 1)}
                         className="h-14 w-1/6 rounded-2xl border border-green-200 bg-green-50 shadow-sm flex items-center justify-center text-green-700 active:bg-green-100 active:scale-95 transition-all touch-manipulation"
                       >
                           <Plus className="w-6 h-6" />
                       </button>
                  </div>
              </div>

              {/* Row 2: To Order (Secondary Action) */}
              <div className={`p-4 rounded-xl border-2 transition-all ${item.toOrder > 0 ? "bg-orange-50 border-orange-600" : "bg-gray-80 border-gray-100 border-dashed"}`}>
                  <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                          <label className={`text-sm font-bold flex items-center gap-2 ${item.toOrder > 0 ? "text-gray-700" : "text-gray-400"}`}>
                             <div className={`w-2 h-2 rounded-full ${item.toOrder > 0 ? "bg-gray-800 animate-pulse" : "bg-gray-300"}`}></div>
                             ต้องสั่งเพิ่ม (To Order)
                          </label>
                          <span className="text-md text-gray-600 font-medium">{item.product.unit}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                           <button 
                             onClick={() => {
                                 const newVal = Math.max(0, (item.toOrder || 0) - 1);
                                 setItems(prev => prev.map(i => i.productId === item.productId ? { ...i, toOrder: newVal } : i));
                             }}
                             className={`h-10 w-1/6 rounded-lg border flex items-center justify-center transition-all active:scale-95 ${item.toOrder > 0 ? "border-red-200 bg-white text-red-600" : "border-gray-200 bg-white text-gray-400"}`}
                           >
                               <Minus className="w-6 h-6" />
                           </button>

                           <input
                               type="number"
                               inputMode="decimal"
                               className={`flex-1 h-10 w-4/6 text-center font-bold rounded-lg border-2 focus:ring-2 focus:ring-red-100 focus:border-red-400 ${item.toOrder > 0 ? "text-red-600 border-red-200 bg-white text-xl" : "text-gray-400 border-gray-200 bg-gray-50/50"}`}
                               value={item.toOrder === 0 ? '' : item.toOrder}
                               onChange={(e) => {
                                   const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                   setItems(prev => prev.map(i => i.productId === item.productId ? { ...i, toOrder: val } : i));
                               }}
                               placeholder="0"
                           />

                           <button 
                             onClick={() => {
                                 const newVal = (item.toOrder || 0) + 1;
                                 setItems(prev => prev.map(i => i.productId === item.productId ? { ...i, toOrder: newVal } : i));
                             }}
                             className={`h-10 w-1/6 rounded-lg border flex items-center justify-center transition-all active:scale-95 ${item.toOrder > 0 ? "border-red-200 bg-red-100 text-red-700" : "border-gray-200 bg-gray-100 text-gray-500 hover:bg-white"}`}
                           >
                               <Plus className="w-6 h-6" />
                           </button>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    ))}

    {filteredItems.length === 0 && !loading && (
        <div className="p-10 text-center text-gray-400">
            <Search className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p>ไม่พบรายการสินค้าในหมวดนี้</p>
        </div>
    )}
  </div>

  <div className="h-20"></div> {/* Spacer */}

  <div className="fixed bottom-16 left-0 w-full bg-white border-t p-4 flex justify-between items-center shadow-lg">
      <div className="text-sm">
          <span className="font-bold text-red-600">{items.filter(i => i.toOrder > 0).length}</span> รายการที่ต้องสั่ง
      </div>
      <button 
        onClick={handleSubmit}
        disabled={submitting}
        className="bg-green-600 text-white font-bold py-2 px-6 rounded-full shadow-md hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
      >
         {submitting ? "กำลังบันทึก..." : "สรุปรายการสั่งซื้อ"}
      </button>
  </div>
    </div>
  );
}

export default function StockCheckPage() {
  return (
    <StaffGuard>
        <StaffLayout>
           <Suspense fallback={<div className="p-4 text-center">กำลังโหลด...</div>}>
              <CheckContent />
           </Suspense>
        </StaffLayout>
    </StaffGuard>
  );
}

// Need to import addDoc at the top. I'll fix this in the file write.
