
"use client";

import StaffLayout from "@/components/layouts/StaffLayout";
import StaffGuard from "@/components/auth/StaffGuard";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, setDoc, getDoc, query, where, Timestamp, addDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/context";
import { useRouter, useSearchParams } from "next/navigation";
import { Save, ArrowRight } from "lucide-react";

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

import { useMasterData } from "@/hooks/useMasterData";

export default function StockCheckPage() {
  const { userProfile } = useAuth();
  const { categories } = useMasterData();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('editId');
  
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filterCategory, setFilterCategory] = useState("All");
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
        const currentStockStr = currentQty !== undefined ? currentQty.toString() : "";
        
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
    const num = parseFloat(val) || 0;
    setItems(items.map(i => i.productId === productId ? { ...i, minStock: num } : i));
  };

  const handleCurrentChange = (productId: string, val: string) => {
    setItems(items.map(i => {
      if (i.productId === productId) {
        const current = parseFloat(val) || 0;
        const toOrder = Math.max(0, i.minStock - current);
        return { ...i, currentStock: val, toOrder };
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

  const filteredItems = filterCategory === "All" 
    ? items 
    : items.filter(i => i.product.category === filterCategory);

  return (
    <StaffGuard>
        <StaffLayout>
            <div className="space-y-4 pb-20">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">Daily Stock Check</h2>
                    {/* Removed the old Review Order button */}
                </div>

                {/* Filter */}
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    <button
                        onClick={() => setFilterCategory("All")}
                        className={`px-4 py-1 rounded-full whitespace-nowrap text-sm ${filterCategory === "All" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"}`}
                    >
                        ทั้งหมด
                    </button>
                    {categories.map(c => (
                        <button
                            key={c}
                            onClick={() => setFilterCategory(c)}
                            className={`px-4 py-1 rounded-full whitespace-nowrap text-sm ${filterCategory === c ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"}`}
                        >
                            {c}
                        </button>
                    ))}
                </div>
                <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold text-gray-900">เช็คสต๊อกวันนี้</h1>
            <div className="text-sm text-gray-500">
                {new Date().toLocaleDateString('th-TH')}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/3">สินค้า</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase w-20">ขั้นต่ำ</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase w-20">คงเหลือ</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16">ต้องสั่ง</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.map((item) => (
                  <tr key={item.productId} className={item.toOrder > 0 ? "bg-red-50" : ""}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.product.name}</div>
                      <div className="text-xs text-gray-500">{item.product.unit} ({item.product.source})</div>
                    </td>
                    <td className="px-2 py-3 text-center">
                        <input 
                            type="number" 
                            className="w-16 border rounded text-center py-1 text-sm bg-gray-50 border-dashed border-gray-300 focus:bg-white focus:border-green-500 transition-colors"
                            placeholder="-"
                            value={item.minStock || ""}
                            min={0.1}
                            onChange={(e) => handleMinStockChange(item.productId, e.target.value)}
                            onBlur={() => saveMinStock(item)}
                        />
                    </td>
                    <td className="px-2 py-3 text-center">
                        <input 
                            type="number" 
                            className="w-16 border rounded text-center py-1 text-sm border-gray-300 focus:ring-2 focus:ring-green-500"
                            placeholder="0"
                            value={item.currentStock}
                            onChange={(e) => handleCurrentChange(item.productId, e.target.value)}
                        />
                    </td>
                    <td className="px-2 py-3 text-center">
                        {item.toOrder > 0 ? (
                            <span className="font-bold text-red-600">{Math.ceil(item.toOrder)}</span>
                        ) : (
                            <span className="text-gray-300">-</span>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {items.length === 0 && !loading && (
                <div className="p-8 text-center text-gray-400">
                    <p>ไม่พบรายการสินค้า</p>
                    <p className="text-sm mt-2">กรุณาตรวจสอบว่ามีสินค้าในระบบและกำหนดสาขาแล้ว</p>
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
        </StaffLayout>
    </StaffGuard>
  );
}

// Need to import addDoc at the top. I'll fix this in the file write.
