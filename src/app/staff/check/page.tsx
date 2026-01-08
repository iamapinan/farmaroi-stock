
"use client";

import { Suspense } from "react";
import StaffLayout from "@/components/layouts/StaffLayout";
import StaffGuard from "@/components/auth/StaffGuard";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, setDoc, getDoc, query, where, Timestamp, addDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/context";
import { useRouter, useSearchParams } from "next/navigation";
import { Save, ArrowRight, Plus, Minus, Search, RefreshCw } from "lucide-react";
import { useMasterData } from "@/hooks/useMasterData";

interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  source: string;
  minStock?: number;
  disableStockCheck?: boolean;
}

interface StockItem {
  productId: string;
  product: Product;
  minStock: number;
  currentStock: string; // string for input, parse to number
  toOrder: number;
  isModified?: boolean;
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
  const [showFilters, setShowFilters] = useState(true);

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

             // Check for existing daily check
             if (!editId) {
                 const today = new Date();
                 today.setHours(0,0,0,0);
                 const queryDate = Timestamp.fromDate(today);
                 
                 const q = query(
                     collection(db, "daily_checks"),
                     where("branchId", "==", targetBranch),
                     where("date", ">=", queryDate)
                 );
                 
                 const snap = await getDocs(q);
                 if (!snap.empty) {
                     // Found existing check for today
                     const existingId = snap.docs[0].id;
                     if (confirm("วันนี้มีการเช็คสต๊อกไปแล้ว ต้องการแก้ไขรายการเดิมหรือไม่?")) {
                         router.push(`/staff/check?editId=${existingId}`);
                         return;
                     } else {
                         router.push('/staff'); 
                         return;
                     }
                 }
             }

             await loadData(targetBranch);

             if (editId) {
                loadEditData(editId);
            } else {
                subscribeToDraft(targetBranch);
            }
        }
    };
    init();
  }, [userProfile, editId, router]);

  // Real-time Sync Logic
  const subscribeToDraft = (branchId: string) => {
      const today = new Date().toISOString().split('T')[0];
      const draftId = `draft_${branchId}_${today}`;
      const draftRef = doc(db, "check_drafts", draftId);

      const unsubscribe = onSnapshot(draftRef, (docSnap) => {
          if (docSnap.exists()) {
              const data = docSnap.data();
              const draftItems = data.items || {};
              
              setItems(prevItems => {
                  // Merge draft data into current items logic
                  // Only update if value is different to avoid cursor jumping if we were typing?
                  // Actually, if *remote* changed, we must update.
                  // If *local* matches, no change.
                  return prevItems.map(item => {
                      const draft = draftItems[item.productId];
                      if (draft) {
                          // Check if we have pending local changes? 
                          // unique-last-write wins is simplest.
                          // We might need to track "lastUpdated" to avoid overwriting our own immediate typing?
                          // But onSnapshot fires on local writes too (latency compensation).
                          // React state update might conflict if we are mid-typing.
                          // However, standard intuitive "google docs" style works by just accepting the stream usually.
                          // Let's try merging.

                          // If the draft value is different from current, update
                          if (draft.currentStock !== item.currentStock || draft.toOrder !== item.toOrder) {
                              return {
                                  ...item,
                                  currentStock: draft.currentStock !== undefined ? draft.currentStock : item.currentStock,
                                  toOrder: draft.toOrder !== undefined ? draft.toOrder : item.toOrder
                              };
                          }
                      }
                      return item;
                  });
              });
          }
      });

      return () => unsubscribe();
  };

  const saveDraftItem = async (branchId: string, productId: string, data: { currentStock?: string, toOrder?: number }) => {
      if (!branchId) return;
      const today = new Date().toISOString().split('T')[0];
      const draftId = `draft_${branchId}_${today}`;
      const draftRef = doc(db, "check_drafts", draftId);
      
      const payload = {
          ...data,
          updatedAt: Timestamp.now(),
          updatedBy: userProfile?.email
      };

      try {
          // Try update first (most common case during checking)
          await updateDoc(draftRef, {
              [`items.${productId}`]: payload
          });
      } catch (e: any) {
          // If document doesn't exist, create it
          if (e.code === 'not-found') {
              try {
                  await setDoc(draftRef, {
                      branchId,
                      date: today,
                      items: {
                          [productId]: payload
                      }
                  });
              } catch (createErr) {
                   console.error("Error creating draft", createErr);
              }
          } else {
               console.error("Error updating draft", e);
          }
      }
  };

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
                  // If saved check has the current stock recorded, use it (future proofing)
                  // Current data structure in DB might not have it yet, so we check.
                  const savedItem = data.items.find((i: any) => i.productId === item.productId);
                  
                  if (savedOrder !== undefined) {
                      let loadedCurrent = item.currentStock;
                      
                      if (savedItem && savedItem.savedCurrentStock !== undefined) {
                          // Use explicitly saved stock from the check record
                          loadedCurrent = savedItem.savedCurrentStock.toString();
                      } else {
                          // Legacy support: derive or keep live? 
                          // User request: "Load current stock to show".
                          // If we don't have a saved snapshot, 'live' stock (already in item.currentStock) is the best proxy for "current".
                          // Deriving strictly from minStock - savedOrder is risky if formula wasn't followed.
                          // However, previously the code did derive. 
                          // Let's trust the live stock loaded in loadData, UNLESS we derived it to be negative or something?
                          // Actually, leave it as live stock (from loadData) is safest for "Existing Stock".
                          // AND set toOrder from the saved record.
                      }

                      return {
                          ...item,
                          toOrder: savedOrder,
                          currentStock: loadedCurrent,
                          isModified: false // Reset modified on load
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
      const initialItems: StockItem[] = products
        .filter(p => !p.disableStockCheck) // Filter out disabled items
        .map(p => {
        const currentQty = stockMap[p.id];
        const currentStockStr = currentQty !== undefined ? currentQty.toString() : "0";
        const minStock = configMap[p.id] ?? (p.minStock || 0);
        
        // Auto toOrder set to 0 as requested by user
        const toOrder = 0;

        return {
            productId: p.id,
            product: p,
            minStock: minStock, 
            currentStock: currentStockStr,
            toOrder: toOrder
        };
      });

      // Sort: Low Stock First (Strictly Less Than Min), then Alphabetical
      initialItems.sort((a, b) => {
          const aCurrent = parseFloat(a.currentStock) || 0;
          const bCurrent = parseFloat(b.currentStock) || 0;
          // Updated Logic: Only treat as low stock if strictly LESS than minStock
          const aLow = aCurrent < a.minStock;
          const bLow = bCurrent < b.minStock;

          if (aLow && !bLow) return -1;
          if (!aLow && bLow) return 1;
          
          return a.product.name.localeCompare(b.product.name);
      });

      setItems(initialItems);

    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMinStockChange = (productId: string, val: string) => {
    const num = val === "" ? 0 : parseFloat(val);
    setItems(items.map(i => i.productId === productId ? { ...i, minStock: isNaN(num) ? 0 : num } : i));
  };

  const handleCurrentChange = (productId: string, val: string) => {
    setItems(items.map(i => {
      if (i.productId === productId) {
        // Allow empty string for backspace
        if (val === "") {
             if (activeBranchId && !editId) saveDraftItem(activeBranchId, productId, { currentStock: "", toOrder: i.toOrder }); // Sync empty
             return { ...i, currentStock: "", isModified: true };
        }

        const current = parseFloat(val);
        // Do not auto-calculate toOrder. Keep existing value.
        // const currentVal = isNaN(current) ? 0 : current;
        // let toOrder = 0;
        // ... logic removed
        
        // Sync
        if (activeBranchId && !editId) {
            saveDraftItem(activeBranchId, productId, { currentStock: val, toOrder: i.toOrder });
        }

        return { ...i, currentStock: val, toOrder: i.toOrder, isModified: true };
      }
      return i;
    }));
  };

  const adjustStock = (productId: string, delta: number) => {
     setItems(items.map(i => {
         if (i.productId === productId) {
             const currentVal = parseFloat(i.currentStock) || 0;
             const newVal = Math.max(0, currentVal + delta);
             
             // Do not auto-calculate toOrder. Keep existing value.

             // Sync
             if (activeBranchId && !editId) {
                saveDraftItem(activeBranchId, productId, { currentStock: newVal.toString(), toOrder: i.toOrder });
             }

             return { ...i, currentStock: newVal.toString(), toOrder: i.toOrder, isModified: true };
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
        toOrder: i.toOrder,
        savedCurrentStock: parseFloat(i.currentStock) || 0 // Save the stock count for restoring edit
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
        const stockUpdates = items.map(async (item) => {
            // If Editing: Only update items that were modified by the user
            if (editId && !item.isModified) {
                return;
            }

            const current = parseFloat(item.currentStock);
            if (!isNaN(current)) {
                // If user entered a number, we update the master stock record
                const stockRef = doc(db, "stocks", `${activeBranchId}_${item.productId}`);
                await setDoc(stockRef, {
                    branchId: activeBranchId,
                    productId: item.productId,
                    productName: item.product.name, // helpful for debugging
                    amount: current, // No rounding, saves exact float
                    updatedAt: Timestamp.now()
                }, { merge: true });
            }
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
            
            // CLEANUP: Delete the draft
            try {
                const today = new Date().toISOString().split('T')[0];
                const draftId = `draft_${activeBranchId}_${today}`;
                const { deleteDoc } = await import("firebase/firestore"); // Import deleteDoc dynamically or add to top imports
                await deleteDoc(doc(db, "check_drafts", draftId));
            } catch (e) {
                console.error("Failed to delete draft", e);
            }

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
    <div className="space-y-4 pb-24 relative">
        {/* Enhanced Sticky Header with Toggle */}
        <div className="sticky top-[-20px] bg-gradient-to-br from-gray-50 to-gray-100 z-20 -mx-4 px-4 border-b-2 border-gray-200 shadow-md">
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
            <div className={`overflow-hidden transition-all duration-300 ${showFilters ? 'max-h-96 opacity-100 pb-4' : 'max-h-0 opacity-0'}`}>
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">เช็คสต๊อกวันนี้</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{new Date().toLocaleDateString('th-TH', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</p>
                </div>

                {/* Search Input */}
                <div className="relative">
                    <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="ค้นหาสินค้า..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-12 w-full bg-white border-2 border-gray-200 rounded-xl py-3 text-base focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm transition-all"
                    />
                </div>

                {/* Filter Pills */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <button
                        onClick={() => setFilterCategory("All")}
                        className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-medium transition-all ${
                          filterCategory === "All" 
                            ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md" 
                            : "bg-white border-2 border-gray-200 text-gray-600 hover:border-green-300"
                        }`}
                    >
                        ทั้งหมด
                    </button>
                    {categories.map(c => (
                        <button
                            key={c}
                            onClick={() => setFilterCategory(c)}
                            className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-medium transition-all ${
                              filterCategory === c 
                                ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md" 
                                : "bg-white border-2 border-gray-200 text-gray-600 hover:border-green-300"
                            }`}
                        >
                            {c}
                        </button>
                    ))}
                </div>
              </div>
            </div>
        </div>


  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    {filteredItems.map((item) => {
      const current = parseFloat(item.currentStock) || 0;
      const isLow = current < item.minStock;
      const hasOrder = item.toOrder > 0;
      
      return (
        <div 
            key={item.productId} 
            className={`bg-white rounded-xl shadow-sm border-2 transition-all ${
              isLow 
                ? "border-amber-300 bg-amber-50/30" 
                : hasOrder
                  ? "border-green-300 bg-green-50/30"
                  : "border-gray-200"
            }`}
        >
            {/* Compact Header */}
            <div className="p-3 border-b border-gray-100">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 text-base leading-tight truncate">{item.product.name}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                               {item.product.category}
                            </span>
                            {isLow && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">
                                ⚠️ ต่ำ
                              </span>
                            )}
                        </div>
                    </div>
                    
                    {/* Min Stock Badge */}
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] text-gray-400 uppercase font-bold">Min</span>
                        <span className="text-lg font-bold text-gray-700">{item.minStock}</span>
                    </div>
                </div>
            </div>

            {/* Main Content - Compact Grid */}
            <div className="p-3 space-y-2">
                
                {/* Current Stock Entry */}
                <div>
                    <label className="text-xs font-bold text-blue-600 mb-1.5 block text-center uppercase">
                      ของที่มีอยู่ <span className="text-xs text-gray-500 font-medium">({item.product.unit})</span>
                    </label>
                    <div className="flex items-center gap-2">
                        <button 
                          onClick={() => adjustStock(item.productId, -1)}
                          className="h-12 w-12 rounded-lg bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 flex items-center justify-center text-red-600 active:scale-95 transition-all shadow-sm"
                        >
                            <Minus className="w-5 h-5" />
                        </button>
                        <input 
                            type="number"
                            inputMode="decimal"
                            className={`flex-1 h-12 text-center text-2xl font-bold border-2 rounded-lg focus:ring-2 focus:ring-blue-300 shadow-sm ${
                              current < item.minStock 
                                ? "border-amber-300 bg-amber-50 text-amber-900" 
                                : "border-blue-300 bg-blue-50 text-blue-900"
                            }`}
                            value={item.currentStock}
                            onChange={(e) => handleCurrentChange(item.productId, e.target.value)}
                            onFocus={(e) => e.target.select()} 
                            placeholder="0"
                        />
                        <button 
                          onClick={() => adjustStock(item.productId, 1)}
                          className="h-12 w-12 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 flex items-center justify-center text-green-700 active:scale-95 transition-all shadow-sm"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* To Order Entry */}
                <div className={`p-2.5 rounded-lg border-2 transition-all ${
                  hasOrder 
                    ? "bg-green-50 border-green-300" 
                    : "bg-gray-50 border-gray-200 border-dashed"
                }`}>
                    <div className="flex justify-between items-center mb-1.5">
                        <label className={`text-xs font-bold uppercase ${
                          hasOrder ? "text-green-700" : "text-gray-500"
                        }`}>
                           ต้องสั่ง
                        </label>
                        <span className="text-xs text-gray-500 font-medium">{item.product.unit}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                              const newVal = Math.max(0, (item.toOrder || 0) - 1);
                              if (activeBranchId && !editId) saveDraftItem(activeBranchId, item.productId, { toOrder: newVal });
                              setItems(prev => prev.map(i => i.productId === item.productId ? { ...i, toOrder: newVal, isModified: true } : i));
                          }}
                          className={`h-10 w-10 rounded-lg border-2 flex items-center justify-center transition-all active:scale-95 ${
                            hasOrder 
                              ? "border-red-300 bg-white text-red-600" 
                              : "border-gray-200 bg-white text-gray-400"
                          }`}
                        >
                            <Minus className="w-4 h-4" />
                        </button>

                        <input
                            type="number"
                            inputMode="decimal"
                            className={`flex-1 h-10 text-center font-bold rounded-lg border-2 focus:ring-2 transition-all ${
                              hasOrder 
                                ? "text-green-700 border-green-300 bg-white text-lg focus:ring-green-200" 
                                : "text-gray-400 border-gray-200 bg-gray-50/50 focus:ring-gray-200"
                            }`}
                            value={item.toOrder === 0 ? '' : item.toOrder}
                            onChange={(e) => {
                                const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                if (activeBranchId && !editId) saveDraftItem(activeBranchId, item.productId, { toOrder: val });
                                setItems(prev => prev.map(i => i.productId === item.productId ? { ...i, toOrder: val, isModified: true } : i));
                            }}
                            placeholder="0"
                        />

                        <button 
                          onClick={() => {
                              const newVal = (item.toOrder || 0) + 1;
                              if (activeBranchId && !editId) saveDraftItem(activeBranchId, item.productId, { toOrder: newVal });
                              setItems(prev => prev.map(i => i.productId === item.productId ? { ...i, toOrder: newVal, isModified: true } : i));
                          }}
                          className={`h-10 w-10 rounded-lg border-2 flex items-center justify-center transition-all active:scale-95 ${
                            hasOrder 
                              ? "border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 text-green-700" 
                              : "border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 text-gray-600"
                          }`}
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
      );
    })}
  </div>

  <div>
    {filteredItems.length === 0 && !loading && (
        <div className="p-10 text-center text-gray-400">
            <Search className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p>ไม่พบรายการสินค้าในหมวดนี้</p>
        </div>
    )}
  </div>

  <div className="h-20"></div> {/* Spacer */}

  <div className="fixed bottom-16 left-0 w-full bg-white border-t border-gray-200 shadow-xl shadow-top p-4 mb-2 flex justify-between items-center shadow-lg">
      <div className="text-md">
          <span className="font-bold text-red-600">
            {items.filter(i => {
                const current = parseFloat(i.currentStock) || 0;
                return current < i.minStock;
            }).length}
          </span> รายการต่ำกว่าขั้นต่ำ
      </div>
      <button 
        onClick={handleSubmit}
        disabled={submitting}
        className="bg-green-600 text-white font-bold py-2 px-6 w-1/2 rounded-full shadow-md hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
      >
         {submitting ? "กำลังบันทึก..." : "สรุปรายการ"}
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
