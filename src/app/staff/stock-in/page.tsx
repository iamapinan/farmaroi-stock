"use client";

import StaffLayout from "@/components/layouts/StaffLayout";
import StaffGuard from "@/components/auth/StaffGuard";
import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, Timestamp, doc, setDoc, increment, query, where, orderBy, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/context";
import { useMasterData } from "@/hooks/useMasterData";
import { Search, Save, Truck, Plus, X } from "lucide-react";
import Link from "next/link"; // For history links

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

  // Tabs
  const [activeTab, setActiveTab] = useState<'add' | 'history'>('add');
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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
             
             // Load initial history
             loadHistory(targetBranch);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [userProfile]);

  const loadHistory = async (branchId: string) => {
      setLoadingHistory(true);
      try {
          const q = query(
              collection(db, "stock_transactions"),
              where("branchId", "==", branchId),
              where("type", "==", "in")
          );
          const snap = await getDocs(q);
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          // Client-side sort to avoid index issues
          list.sort((a: any, b: any) => {
              const dateA = a.date?.seconds || 0;
              const dateB = b.date?.seconds || 0;
              return dateB - dateA;
          });
          setHistory(list);
      } catch (e) {
          console.error("Error loading history", e);
      } finally {
          setLoadingHistory(false);
      }
  };

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

  /* Edit Mode State */
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const editId = searchParams?.get('editId');
  const router = typeof window !== 'undefined' ? require("next/navigation").useRouter() : null;

  useEffect(() => {
     if (editId) {
         loadEditData(editId);
         setActiveTab('add');
     }
  }, [editId]);

  const loadEditData = async (id: string) => {
      setLoading(true);
      try {
          const docRef = doc(db, "stock_transactions", id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
              const data = docSnap.data();
              // Map items to StockInItem
              // We need product details. If not in 'products' state yet (likely is), we can try to find it or mock it.
              // Note: 'products' logic below runs in parallel in another effect, so we might need to wait or just use data from transaction.
              
              const loadedItems = data.items.map((i: any) => ({
                  productId: i.productId,
                  product: {
                      id: i.productId,
                      name: i.productName,
                      category: 'Unknown', // Not stored in transaction usually, but ok for display
                      unit: i.unit
                  },
                  qty: i.qty.toString(),
                  price: i.price.toString()
              }));
              setItems(loadedItems);
          } else {
              alert("ไม่พบข้อมูลรายการที่ต้องการแก้ไข");
          }
      } catch (e) {
          console.error("Error loading edit data", e);
      } finally {
          setLoading(false);
      }
  };

  const handleUpdate = async () => {
    if (!editId || !userProfile?.branchId) return;
    if (items.length === 0) return alert("กรุณาเลือกสินค้าอย่างน้อย 1 รายการ");

    const validItems = items.filter(i => parseFloat(i.qty) > 0);
    if (validItems.length === 0) return alert("กรุณาระบุจำนวนสินค้า");

    setSubmitting(true);
    try {
        // 1. Fetch Original Transaction to Revert
        const docRef = doc(db, "stock_transactions", editId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) throw new Error("Reference transaction not found");
        const oldData = docSnap.data();

        // 2. Revert Old Stock (Decrease)
        const revertUpdates = oldData.items.map((i: any) => {
             const stockRef = doc(db, "stocks", `${oldData.branchId}_${i.productId}`);
             return setDoc(stockRef, {
                 amount: increment(-i.qty),
                 updatedAt: Timestamp.now()
             }, { merge: true });
        });
        await Promise.all(revertUpdates);

        // 3. Apply New Stock (Increase)
        const newUpdates = validItems.map(i => {
           const stockRef = doc(db, "stocks", `${userProfile.branchId}_${i.productId}`);
           return setDoc(stockRef, {
               branchId: userProfile.branchId, // Ensure branch ID is set
               productId: i.productId,
               productName: i.product.name,
               amount: increment(parseFloat(i.qty)),
               updatedAt: Timestamp.now()
           }, { merge: true });
        });
        await Promise.all(newUpdates);

        // 4. Update Transaction Record
        const transactionData = {
            items: validItems.map(i => ({
              productId: i.productId,
              productName: i.product.name,
              qty: parseFloat(i.qty),
              price: parseFloat(i.price) || 0,
              unit: i.product.unit
            })),
            totalCost: validItems.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0),
            editedAt: Timestamp.now(),
            editedBy: userProfile.email
        };
        await updateDoc(docRef, transactionData);

        alert("แก้ไขรายการเรียบร้อย");
        setItems([]);
        if (router) router.push('/staff/stock-in'); // Clear query param
        loadHistory(userProfile.branchId);
        setActiveTab('history');

    } catch (error) {
        console.error("Error updating stock:", error);
        alert("แก้ไขไม่สำเร็จ");
    } finally {
        setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (editId) {
        await handleUpdate();
        return;
    }

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
      loadHistory(userProfile.branchId); // Reload history
      setActiveTab('history'); // Switch to history tab
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
            <h1 className="text-2xl font-bold text-gray-900">{editId ? 'แก้ไขรายการรับเข้า' : 'รับสินค้าเข้า (Stock In)'}</h1>
          </div>

          {/* Tabs */}
          <div className="flex space-x-2 border-b mb-4 bg-white/50 backdrop-blur sticky top-16 z-10 ">
              <button
                  onClick={() => setActiveTab('add')}
                  className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${activeTab === 'add' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                  {editId ? 'แก้ไข (Edit Stock)' : 'บันทึกรับเข้า (Add Stock)'}
              </button>
              <button
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${activeTab === 'history' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                  ประวัติการซื้อ (History)
              </button>
          </div>
          
          {activeTab === 'add' && (
              <div className="pt-4 space-y-4">
                <div className="flex justify-end gap-2">
                        {editId && <button 
                            onClick={() => {
                                setItems([]);
                                if(router) router.push('/staff/stock-in');
                                setActiveTab('history');
                            }}
                             className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg shadow hover:bg-gray-300 flex items-center text-sm font-bold"
                        >
                             ยกเลิกการแก้ไข
                        </button>}
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

                {/* List of items to add (Table Format) */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-medium border-b">
                            <tr>
                                <th className="py-3 px-4 w-12 text-center">ลำดับ</th>
                                <th className="py-3 px-4">รายการสินค้า</th>
                                <th className="py-3 px-4 w-24 text-right">จำนวน</th>
                                <th className="py-3 px-4 w-32 text-right">ราคา</th>
                                <th className="py-3 px-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-gray-400">
                                        ยังไม่มีรายการ
                                    </td>
                                </tr>
                            ) : items.map((item, index) => (
                                <tr key={item.productId} className="hover:bg-gray-50">
                                    <td className="py-3 px-4 text-center text-gray-500">{index + 1}</td>
                                    <td className="py-3 px-4">
                                        <div className="font-medium text-gray-900">{item.product.name}</div>
                                        <div className="text-xs text-gray-500">{item.product.category} - {item.product.unit}</div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            value={item.qty}
                                            onChange={(e) => handleUpdateItem(item.productId, 'qty', e.target.value)}
                                            className="w-full border rounded px-2 py-1 text-right focus:ring-1 focus:ring-green-500"
                                            placeholder="0"
                                        />
                                    </td>
                                    <td className="py-3 px-4">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            value={item.price}
                                            onChange={(e) => handleUpdateItem(item.productId, 'price', e.target.value)}
                                            className="w-full border rounded px-2 py-1 text-right focus:ring-1 focus:ring-green-500"
                                            placeholder="0.00"
                                        />
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <button 
                                            onClick={() => handleRemoveItem(item.productId)}
                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {items.length > 0 && (
                             <tfoot className="bg-gray-50 font-bold text-gray-900">
                                <tr>
                                    <td colSpan={3} className="py-3 px-4 text-right">รวมทั้งสิ้น</td>
                                    <td className="py-3 px-4 text-right text-green-600">
                                        ฿{items.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0).toLocaleString()}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                {/* Bottom Bar - Fixed above Navbar (bottom-16 approx 64px) */}
                <div className="fixed bottom-16 left-0 w-full bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20 md:pl-4">
                    <div className="max-w-screen-xl mx-auto mb-4">
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || items.length === 0}
                            className="w-full bg-green-600 text-white font-bold py-3 rounded-lg shadow-md hover:bg-green-700 disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            <Save className="w-5 h-5" />
                            {submitting ? "กำลังบันทึก..." : (editId ? "บันทึกการแก้ไข" : "บันทึกรับเข้าสต๊อก")}
                        </button>
                    </div>
                </div>
              </div>
          )}

          {activeTab === 'history' && (
              <div className="space-y-4 pt-4">
                  {loadingHistory && <p className="text-center py-4 text-gray-500">กำลังโหลด...</p>}
                  {!loadingHistory && history.length === 0 && (
                      <div className="text-center py-10 bg-white rounded-lg border border-dashed text-gray-400">
                          ไม่พบประวัติการรับสินค้า
                      </div>
                  )}
                  {history.map((h) => (
                      <Link href={`/staff/stock-in/${h.id}`} key={h.id} className="block bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:border-green-200 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                              <div>
                                  <p className="font-bold text-gray-900">
                                      {h.date ? new Date(h.date.seconds * 1000).toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' }) : '-'}
                                  </p>
                                  <div className="flex items-center gap-2">
                                     <p className="text-xs text-gray-500">โดย: {h.user}</p>
                                     <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">Stock In</span>
                                  </div>
                              </div>
                              <span className="text-green-600 font-bold">฿{h.totalCost?.toLocaleString() || 0}</span>
                          </div>
                          <div className="text-sm text-gray-600 truncate mt-2">
                              <span className="font-medium text-gray-800">{h.items?.length || 0} รายการ:</span> {h.items?.map((i:any) => i.productName).join(', ')}
                          </div>
                      </Link>
                  ))}
              </div>
          )}

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
                             <label className="block text-sm font-medium">หน่วย (ระบุให้ชัดเจน)</label>
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
