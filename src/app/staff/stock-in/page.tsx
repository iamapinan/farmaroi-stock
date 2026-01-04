
"use client";

import StaffLayout from "@/components/layouts/StaffLayout";
import StaffGuard from "@/components/auth/StaffGuard";
import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, Timestamp, doc, setDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/context";
import { useMasterData } from "@/hooks/useMasterData";
import { Search, Save, History, Truck, Plus, X } from "lucide-react";

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

  // Custom Product State
  const [showCustomProductModal, setShowCustomProductModal] = useState(false);
  const [customProductForm, setCustomProductForm] = useState({
    name: "",
    category: "",
    unit: "",
    minStock: "",
    currentStock: "",
    source: "Custom"
  });

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

  const handleSaveCustomProduct = async () => {
    if (!customProductForm.name || !customProductForm.category || !customProductForm.unit) {
        alert("กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
    }
    setSubmitting(true);
    try {
        const newProdData = {
            name: customProductForm.name,
            category: customProductForm.category,
            unit: customProductForm.unit,
            source: customProductForm.source,
            minStock: customProductForm.minStock ? Number(customProductForm.minStock) : 0,
            createdAt: Timestamp.now()
        };
        const docRef = await addDoc(collection(db, "products"), newProdData);
        const newProduct: Product = { id: docRef.id, ...newProdData };
        
        // Add to local product list + Add to items
        setProducts(prev => [...prev, newProduct]);
        handleAddItem(newProduct);
        
        // If current stock was provided, we should probably initialize it?
        // But this is "Stock In" page, so maybe we just let them enter the qty in the main form.
        // We'll reset form and close modal.
        setShowCustomProductModal(false);
        setCustomProductForm({
            name: "", category: "", unit: "", minStock: "", currentStock: "", source: "Custom"
        });
        
    } catch (e) {
        console.error("Error creating custom product:", e);
        alert("เกิดข้อผิดพลาดในการเพิ่มสินค้า");
    } finally {
        setSubmitting(false);
    }
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
          
          <div className="flex justify-end">
                <button 
                    onClick={() => {
                        setCustomProductForm({
                            name: "", category: categories[0] || "", unit: "ขวด", minStock: "", currentStock: "", source: "Custom"
                        });
                        setShowCustomProductModal(true);
                    }}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow hover:bg-purple-700 flex items-center text-sm font-bold"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    เพิ่มสินค้าใหม่ (Custom)
                </button>
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
                                inputMode="decimal"
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
                                inputMode="decimal"
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

      {/* Custom Product Modal */}
      {showCustomProductModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 print:hidden">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg">เพิ่มสินค้าใหม่ (Custom)</h3>
                      <button onClick={() => setShowCustomProductModal(false)}><X className="text-gray-400" /></button>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium">ชื่อสินค้า</label>
                          <input 
                             className="w-full border rounded px-3 py-2"
                             value={customProductForm.name}
                             onChange={e => setCustomProductForm({...customProductForm, name: e.target.value})}
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                             <label className="block text-sm font-medium">หมวดหมู่</label>
                             <select 
                                 className="w-full border rounded px-3 py-2"
                                 value={customProductForm.category}
                                 onChange={e => setCustomProductForm({...customProductForm, category: e.target.value})}
                             >
                                 <option value="">--เลือก--</option>
                                 {categories.map(c => <option key={c} value={c}>{c}</option>)}
                             </select>
                          </div>
                          <div>
                             <label className="block text-sm font-medium">หน่วย</label>
                             <input 
                                 className="w-full border rounded px-3 py-2"
                                 value={customProductForm.unit}
                                 onChange={e => setCustomProductForm({...customProductForm, unit: e.target.value})}
                                 placeholder="e.g. ขวด, แพ็ค"
                             />
                          </div>
                      </div>
                      <div>
                            <label className="block text-sm font-medium">Min Stock (แจ้งเตือนเมื่อต่ำกว่า)</label>
                             <input 
                                type="number"
                                inputMode="decimal"
                                className="w-full border rounded px-3 py-2"
                                value={customProductForm.minStock}
                                onChange={e => setCustomProductForm({...customProductForm, minStock: e.target.value})}
                                placeholder="0"
                            />
                      </div>

                      <div className="pt-4 flex justify-end gap-2">
                          <button onClick={() => setShowCustomProductModal(false)} className="px-4 py-2 border rounded">ยกเลิก</button>
                          <button onClick={handleSaveCustomProduct} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">บันทึกและเพิ่มรายการ</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      </StaffLayout>
    </StaffGuard>
  );
}

