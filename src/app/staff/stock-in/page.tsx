
"use client";

import StaffLayout from "@/components/layouts/StaffLayout";
import StaffGuard from "@/components/auth/StaffGuard";
import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, Timestamp, doc, setDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/context";
import { useMasterData } from "@/hooks/useMasterData";
import { Search, Save, History, Truck } from "lucide-react";

interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
}

interface StockInItem {
  productId: string;
  product: Product;
  qty: string;
  price: string;
}

export default function StockInPage() {
  const { userProfile } = useAuth();
  const { categories } = useMasterData();
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<StockInItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  const [currentStocks, setCurrentStocks] = useState<Record<string, number>>({});
  
  useEffect(() => {
    const init = async () => {
      if (!userProfile?.branchId && userProfile?.role !== 'admin') return;

      let targetBranch = userProfile.branchId || "";
      if (!targetBranch && userProfile.role === 'admin') {
         try {
            const bSnap = await getDocs(collection(db, 'branches'));
            if (!bSnap.empty) targetBranch = bSnap.docs[0].id;
         } catch(e) {}
      }

      try {
        const snapshot = await getDocs(collection(db, "products"));
        const list: Product[] = [];
        snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as Product));
        setProducts(list);

        if (targetBranch) {
             const sSnap = await getDocs(collection(db, "stocks"));
             const sMap: Record<string, number> = {};
             sSnap.forEach(d => {
                 const data = d.data();
                 if (data.branchId === targetBranch) {
                     sMap[data.productId] = data.amount;
                 }
             });
             setCurrentStocks(sMap);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [userProfile]);

  const handleAddItem = (product: Product) => {
    if (items.find(i => i.productId === product.id)) return;
    setItems([...items, { productId: product.id, product, qty: "", price: "" }]);
    setSearch(""); 
  };

  const handleRemoveItem = (productId: string) => {
    setItems(items.filter(i => i.productId !== productId));
  };

  const handleUpdateItem = (productId: string, field: 'qty' | 'price', value: string) => {
    setItems(items.map(i => i.productId === productId ? { ...i, [field]: value } : i));
  };



// ... 

  const handleSubmit = async () => {
    if (!userProfile?.branchId) return;
    if (items.length === 0) return alert("กรุณาเลือกสินค้าอย่างน้อย 1 รายการ");

    // Validate inputs
    const validItems = items.filter(i => parseFloat(i.qty) > 0);
    if (validItems.length === 0) return alert("กรุณาระบุจำนวนสินค้า");

    setSubmitting(true);
    try {
      const transactionData = {
        branchId: userProfile.branchId,
        date: Timestamp.now(),
        user: userProfile.email,
        type: "in",
        items: validItems.map(i => ({
          productId: i.productId,
          productName: i.product.name,
          qty: parseFloat(i.qty),
          price: parseFloat(i.price) || 0, // Price is optional but good to have
          unit: i.product.unit
        })),
        totalCost: validItems.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0)
      };

      await addDoc(collection(db, "stock_transactions"), transactionData);
      
      // Update Stock Balances
      const stockUpdates = validItems.map(i => {
          const stockRef = doc(db, "stocks", `${userProfile.branchId}_${i.productId}`);
          return setDoc(stockRef, {
              branchId: userProfile.branchId,
              productId: i.productId,
              productName: i.product.name,
              amount: increment(parseFloat(i.qty)),
              updatedAt: Timestamp.now()
          }, { merge: true });
      });
      await Promise.all(stockUpdates);

      alert("บันทึกรับเข้าสต๊อกเรียบร้อย");
      setItems([]); // Clear form
    } catch (error) {
      console.error("Error saving stock in:", error);
      alert("บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === "All" || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  }).slice(0, 10); // Limit suggestion list

  return (
    <StaffGuard>
      <StaffLayout>
        <div className="space-y-4 pb-20">
          <div className="flex items-center gap-2 mb-4">
            <Truck className="w-6 h-6 text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">รับสินค้าเข้า (Stock In)</h1>
          </div>

          {/* Search Section */}
          <div className="bg-white p-4 rounded-lg shadow space-y-3">
             <div className="relative">
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหาเพื่อเพิ่มรายการ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 w-full border border-gray-300 rounded-md py-2 focus:ring-green-500 focus:border-green-500"
                />
             </div>
             
             {/* Suggestions */}
             {search && (
                 <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                     {filteredProducts.map(p => (
                         <button
                            key={p.id}
                            onClick={() => handleAddItem(p)}
                            disabled={!!items.find(i => i.productId === p.id)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 flex justify-between items-center disabled:opacity-50"
                         >
                             <span>{p.name}</span>
                             <span className="text-xs text-gray-500">{p.unit}</span>
                         </button>
                     ))}
                 </div>
             )}
          </div>

          {/* List of items to add */}
          <div className="space-y-3">
            {items.map((item, index) => (
                <div key={item.productId} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 relative">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="font-bold text-gray-900">{item.product.name}</h3>
                            <p className="text-xs text-gray-500">{item.product.category} - {item.product.unit}</p>
                        </div>
                        <button 
                            onClick={() => handleRemoveItem(item.productId)}
                            className="text-red-500 text-xs px-2 py-1 bg-red-50 rounded"
                        >
                            ลบ
                        </button>
                    </div>
                    
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-xs text-gray-500 block mb-1">จำนวนที่รับ</label>
                            <input
                                type="number"
                                value={item.qty}
                                onChange={(e) => handleUpdateItem(item.productId, 'qty', e.target.value)}
                                className="w-full border rounded px-2 py-1.5 focus:ring-1 focus:ring-green-500"
                                placeholder="0"
                            />
                        </div>
                        <div className="flex-1">
                             <label className="text-xs text-gray-500 block mb-1">ราคารวม (บาท)</label>
                            <input
                                type="number"
                                value={item.price}
                                onChange={(e) => handleUpdateItem(item.productId, 'price', e.target.value)}
                                className="w-full border rounded px-2 py-1.5 focus:ring-1 focus:ring-green-500"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                </div>
            ))}
            
            {items.length === 0 && !search && (
                <div className="text-center py-10 text-gray-400">
                    <p>ยังไม่มีรายการ</p>
                    <p className="text-sm">ค้นหาสินค้าด้านบนเพื่อเริ่มบันทึกการรับของ</p>
                </div>
            )}
          </div>

          {/* Bottom Bar */}
          <div className="fixed bottom-16 left-0 w-full bg-white border-t p-4 shadow-lg z-10">
              <button
                onClick={handleSubmit}
                disabled={submitting || items.length === 0}
                className="w-full bg-green-600 text-white font-bold py-3 rounded-lg shadow-md hover:bg-green-700 disabled:opacity-50 flex justify-center items-center gap-2"
              >
                  <Save className="w-5 h-5" />
                  {submitting ? "กำลังบันทึก..." : "บันทึกรับเข้าสต๊อก"}
              </button>
          </div>

        </div>
      </StaffLayout>
    </StaffGuard>
  );
}
