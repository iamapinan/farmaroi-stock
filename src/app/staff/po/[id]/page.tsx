"use client";

import { collection, getDocs, doc, setDoc, increment, getDoc, updateDoc, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/context";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Printer, Edit, PackageCheck, CheckCircle, X, Plus, Save } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { useState, useEffect } from "react";
import StaffLayout from "@/components/layouts/StaffLayout";
import StaffGuard from "@/components/auth/StaffGuard";
import { useMasterData } from "@/hooks/useMasterData";

interface DOItem {
  productId: string;
  productName: string;
  toOrder: number;
  unit: string;
  source?: string;
  productSource?: string; 
  price?: number;
}

export default function PODetailPage() {
  const { id } = useParams();
  const { userProfile } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [branchName, setBranchName] = useState("");
  const [processing, setProcessing] = useState(false);
  
  // Modal State
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveItems, setReceiveItems] = useState<any[]>([]);

  // Custom Product & Summary State
  const { categories, units, sources } = useMasterData();
  const [showCustomProductModal, setShowCustomProductModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [customProductForm, setCustomProductForm] = useState({
    name: "",
    category: "",
    unit: "",
    minStock: "",
    currentStock: "",
    source: "Custom"
  });

  const loadData = async (poId: string) => {
    try {
      const docRef = doc(db, "daily_checks", poId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
         setData(snapshot.data());
         // Fetch Branch Name if we have branchId
         const bId = snapshot.data().branchId;
         if (bId) {
             const bRef = doc(db, 'branches', bId);
             const bSnap = await getDoc(bRef);
             if (bSnap.exists()) {
                 setBranchName(bSnap.data().name);
             }
         }
      }
    } catch (error) {
      console.error("Error fetching PO:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadData(id as string);
    }
  }, [id]);


  const handleOpenReceive = async () => {
       if (!data) return;
       setProcessing(true); 
       try {
           const stockSnap = await getDocs(collection(db, "stocks"));
           const stockMap: Record<string, number> = {};
           const targetBranchId = data.branchId; 
           
           stockSnap.forEach(d => {
               const dData = d.data();
               if (dData.branchId === targetBranchId) {
                   stockMap[dData.productId] = dData.amount;
               }
           });

           const itemsToReceive = data.items.map((i: any) => ({
               ...i,
               receiveQty: i.toOrder, 
               currentStock: stockMap[i.productId] || 0,
               costPerUnit: 0 // Default cost
           }));
           setReceiveItems(itemsToReceive);
           setShowReceiveModal(true);
       } catch(e) {
           console.error("Error prep receiving", e);
           alert("เกิดข้อผิดพลาดในการเตรียมข้อมูล");
       } finally {
           setProcessing(false);
       }
  };

  const handleReceiveItemChange = (index: number, field: string, val: string) => {
      const newItems = [...receiveItems];
      newItems[index][field] = val;
      setReceiveItems(newItems);
  };

  const handleSaveCustomProduct = async () => {
    if (!customProductForm.name || !customProductForm.category || !customProductForm.unit) {
        alert("กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
    }
    setProcessing(true);
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
        
        // Add to receiveItems
        const newItem = {
            productId: docRef.id,
            productName: newProdData.name,
            toOrder: 0, // Wasn't ordered
            unit: newProdData.unit,
            productSource: newProdData.source,
            receiveQty: 0,
            currentStock: customProductForm.currentStock ? Number(customProductForm.currentStock) : 0,
            costPerUnit: 0,
            isCustom: true
        };
        
        setReceiveItems(prev => [...prev, newItem]);
        setShowCustomProductModal(false);
        setCustomProductForm({
            name: "", category: "", unit: "", minStock: "", currentStock: "", source: "Custom"
        });
        
    } catch (e) {
        console.error("Error creating custom product:", e);
        alert("เกิดข้อผิดพลาดในการเพิ่มสินค้า");
    } finally {
        setProcessing(false);
    }
  };

  const confirmReceive = async () => {
      if (!data) return;
      const targetBranchId = data.branchId; 
      
      setProcessing(true);
      try {
          const validItems = receiveItems.filter(i => parseFloat(i.receiveQty) > 0);
          
          if (validItems.length === 0) {
              alert("ไม่มีรายการที่รับเข้า");
              setProcessing(false);
              return;
          }

          // 1. Transaction
          const transactionData = {
            branchId: targetBranchId, 
            date: Timestamp.now(),
            user: userProfile?.email || 'Unknown', 
            type: "in",
            refPO: id,
            items: validItems.map((i: any) => ({
              productId: i.productId,
              productName: i.productName,
              qty: parseFloat(i.receiveQty),
              price: parseFloat(i.costPerUnit) || 0,
              unit: i.unit
            })),
            totalCost: validItems.reduce((acc: number, i: any) => acc + (parseFloat(i.receiveQty) * (parseFloat(i.costPerUnit) || 0)), 0)
          };
          await addDoc(collection(db, "stock_transactions"), transactionData);

          // 2. Increment
          const stockUpdates = validItems.map((i: any) => {
             const stockRef = doc(db, "stocks", `${targetBranchId}_${i.productId}`);
             return setDoc(stockRef, {
                 branchId: targetBranchId,
                 productId: i.productId,
                 productName: i.productName,
                 amount: increment(parseFloat(i.receiveQty)),
                 updatedAt: Timestamp.now()
             }, { merge: true });
          });
          await Promise.all(stockUpdates);

          // 3. Status
           if (data.status === 'pending') {
               await updateDoc(doc(db, "daily_checks", id as string), {
                   status: 'completed'
               });
           }

           setShowReceiveModal(false);
           // Prepare summary data
           setSummaryData({
               ...transactionData,
               branchName: branchName || 'Unknown',
               timestamp: new Date()
           });
           setShowSummaryModal(true);
           loadData(id as string);

       } catch (error) {
           console.error("Error receiving stock:", error);
           alert("เกิดข้อผิดพลาดในการรับสินค้า");
       } finally {
           setProcessing(false);
       }
  };

  const handleReceiveStock = () => {
      handleOpenReceive();
  };
  
  const handleEdit = () => {
      window.location.href = `/staff/check?editId=${id}`;
  };
  
  const handlePrint = () => {
      window.print();
  };


  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!data) return <div className="p-8 text-center">Not found</div>;

  const groupedItems = data.items.reduce((acc: any, item: any) => {
        const source = item.source || item.productSource || 'General'; 
        if (!acc[source]) acc[source] = [];
        acc[source].push(item);
        return acc;
  }, {});

  const dateStr = data.date ? format(data.date.toDate ? data.date.toDate() : new Date(data.date), "dd/MM/yyyy HH:mm") : "-";

  return (
    <StaffGuard>
        <div className="print:hidden">
            <StaffLayout>
                <div className="space-y-4 pb-20">
                    <div className="space-y-6">
                        <Link href="/staff/po" className="text-gray-500 hover:text-green-600 flex items-center">
                            <ChevronLeft className="w-4 h-4 mr-1" /> กลับไปหน้าประวัติ
                        </Link>

                        <div className="flex justify-between items-start flex-wrap gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">สรุปรายการสั่งซื้อ</h1>
                                <p className="text-gray-500">วันที่: {dateStr}</p>
                                <p className={`text-sm font-bold mt-1 ${data.status === 'completed' ? 'text-green-600' : 'text-orange-500'}`}>
                                    สถานะ: {data.status === 'completed' ? 'ได้รับของแล้ว' : 'รอรับของ'}
                                </p>
                            </div>
                            
                            <div className="flex gap-2">
                                {data.status === 'pending' && (
                                    <>
                                        <button
                                            onClick={handleEdit}
                                            disabled={processing}
                                            className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-lg flex items-center hover:bg-yellow-200 border border-yellow-300"
                                        >
                                            <Edit className="w-4 h-4 mr-2" />
                                            แก้ไข
                                        </button>
                                        <button
                                            onClick={handleReceiveStock}
                                            disabled={processing}
                                            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center shadow hover:bg-green-700"
                                        >
                                            <CheckCircle className="w-4 h-4 mr-2" />
                                            รับของเข้า
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={handlePrint}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center shadow hover:bg-blue-700"
                                >
                                    <Printer className="w-4 h-4 mr-2" />
                                    พิมพ์
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {Object.entries(groupedItems).map(([source, items]) => (
                            <div key={source as string} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                <h2 className="font-bold text-lg text-green-700 border-b pb-2 mb-3">{source as string}</h2>
                                <ul className="space-y-2">
                                    {(items as any[]).map((item: any, idx: number) => (
                                        <li key={idx} className="flex justify-between items-center text-sm">
                                            <span>{item.productName}</span>
                                            <span className="font-bold">{item.toOrder} <span className="text-gray-500 text-xs font-normal">{item.unit}</span></span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </StaffLayout>
        </div>

        {/* Print Layout */}
        <div className="hidden print:block p-2 text-black bg-white" style={{ maxWidth: '58mm', width: '100%', margin: '0 auto', fontSize: '12px', fontFamily: 'monospace' }}>
            <div className="text-center mb-4 border-b pb-2 border-black">
                <h1 className="font-bold text-lg">Farm Aroi</h1>
                <p className="text-sm">ใบสั่งซื้อของรายวัน</p>
                <p className="text-xs">สาขา: {branchName}</p>
                <p className="text-xs">{format(data.date?.toDate ? data.date.toDate() : new Date(), "dd/MM/yyyy HH:mm")}</p>
                <p className="text-xs">User: {data.user?.split('@')[0]}</p>
            </div>
             <div className="space-y-4">
                {Object.entries(groupedItems).map(([source, items]) => (
                    <div key={source as string}>
                        <h2 className="font-bold border-b border-black mb-1 mt-2 text-sm">{source as string}</h2>
                        <ul className="space-y-1">
                            {(items as any[]).map((item: any, idx: number) => (
                                <li key={idx} className="flex items-start">
                                    <span className="mr-1 -mt-0.5">[ ]</span>
                                    <div className="flex-1 flex justify-between leading-tight">
                                        <span className="mr-1">{item.productName}</span>
                                        <span className="whitespace-nowrap font-bold">{item.toOrder} {item.unit}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>


       {/* Receive Modal */}
       {showReceiveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 print:hidden">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                      <h3 className="font-bold text-lg text-gray-900">ตรวจรับสินค้า (Receive Stock)</h3>
                      <button onClick={() => setShowReceiveModal(false)} className="text-gray-400 hover:text-gray-600">
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <div className="p-4 overflow-y-auto flex-1">
                      <div className="flex justify-between items-center mb-4">
                        <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded border border-blue-100 flex-1 mr-4">
                            ตรวจสอบและใส่ราคาต้นทุนต่อหน่วย
                        </div>
                        <button 
                            onClick={() => {
                                setCustomProductForm({
                                    name: "", category: categories[0] || "", unit: units[0] || "", minStock: "", currentStock: "", source: "Custom"
                                });
                                setShowCustomProductModal(true);
                            }}
                            className="bg-purple-600 text-white px-3 py-1.5 rounded text-sm flex items-center hover:bg-purple-700 whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            สินค้าใหม่
                        </button>
                      </div>
                      
                      <table className="min-w-full divide-y divide-gray-200 border">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">สินค้า</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-20">มีอยู่</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-20">สั่ง</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-blue-600 w-24">รับจริง</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-orange-600 w-24">ทุน/หน่วย</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-green-600 w-24">รวมเงิน</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {receiveItems.map((item, index) => {
                                const current = item.currentStock || 0;
                                const recQty = parseFloat(item.receiveQty) || 0;
                                const cost = parseFloat(item.costPerUnit) || 0;
                                const totalQty = current + recQty;
                                const toOrder = item.toOrder || 0;
                                
                                return (
                                    <tr key={index} className={recQty !== toOrder ? "bg-yellow-50" : ""}>
                                        <td className="px-3 py-2">
                                            <div className="text-sm font-medium">{item.productName}</div>
                                            <div className="text-xs text-gray-500">{item.unit}</div>
                                            {item.isCustom && <span className="text-[10px] bg-purple-100 text-purple-600 px-1 rounded">New</span>}
                                        </td>
                                        <td className="px-3 py-2 text-right text-sm text-gray-500">
                                            {current}
                                        </td>
                                        <td className="px-3 py-2 text-right text-sm text-gray-500">
                                            {toOrder}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <input 
                                                type="number"
                                                className="w-20 text-right border border-gray-300 rounded px-1 py-1 text-sm focus:ring-blue-500 font-bold text-blue-700"
                                                value={item.receiveQty}
                                                onChange={(e) => handleReceiveItemChange(index, 'receiveQty', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <input 
                                                type="number"
                                                className="w-20 text-right border border-gray-300 rounded px-1 py-1 text-sm focus:ring-orange-500 font-medium text-orange-700"
                                                placeholder="0.00"
                                                value={item.costPerUnit}
                                                onChange={(e) => handleReceiveItemChange(index, 'costPerUnit', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-right text-sm font-bold text-green-700">
                                            {(recQty * cost).toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                      </table>
                  </div>

                  <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end gap-3">
                      <button 
                          onClick={() => setShowReceiveModal(false)}
                          className="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50"
                      >
                          ยกเลิก
                      </button>
                      <button 
                          onClick={confirmReceive}
                          disabled={processing}
                          className="px-6 py-2 bg-green-600 text-white rounded-md font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                      >
                          {processing ? "กำลังบันทึก..." : (
                              <>
                                  <CheckCircle className="w-5 h-5" />
                                  ยืนยันรับเข้าสต๊อก
                              </>
                          )}
                      </button>
                  </div>
              </div>
          </div>
       )}

     {/* Custom Product Modal */}
     {showCustomProductModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 print:hidden">
             <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-lg">เพิ่มสินค้าพิเศษ (Custom)</h3>
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
                            <select 
                                className="w-full border rounded px-3 py-2"
                                value={customProductForm.unit}
                                onChange={e => setCustomProductForm({...customProductForm, unit: e.target.value})}
                            >
                                <option value="">--เลือก--</option>
                                {units.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                         </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium">Stock ปัจจุบัน (ก่อนรับ)</label>
                            <input 
                                type="number"
                                className="w-full border rounded px-3 py-2"
                                value={customProductForm.currentStock}
                                onChange={e => setCustomProductForm({...customProductForm, currentStock: e.target.value})}
                                placeholder="0"
                            />
                         </div>
                         <div>
                            <label className="block text-sm font-medium">Min Stock</label>
                             <input 
                                type="number"
                                className="w-full border rounded px-3 py-2"
                                value={customProductForm.minStock}
                                onChange={e => setCustomProductForm({...customProductForm, minStock: e.target.value})}
                                placeholder="0"
                            />
                         </div>
                     </div>
                     <div className="pt-4 flex justify-end gap-2">
                         <button onClick={() => setShowCustomProductModal(false)} className="px-4 py-2 border rounded">ยกเลิก</button>
                         <button onClick={handleSaveCustomProduct} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">บันทึกและเพิ่มลงรายการ</button>
                     </div>
                 </div>
             </div>
         </div>
     )}

     {/* Summary Receipt Modal */}
     {showSummaryModal && summaryData && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4">
             <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center print:hidden">
                    <h3 className="font-bold text-lg text-green-700">บันทึกรับของสำเร็จ</h3>
                    <button onClick={() => {setShowSummaryModal(false); window.location.reload();}}><X /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-8 bg-gray-50 print:p-0 print:bg-white" id="print-area">
                    {/* Printable Receipt Area */}
                    <div className="max-w-[80mm] mx-auto bg-white p-4 shadow-sm print:shadow-none print:max-w-full">
                        <div className="text-center mb-4">
                            <h2 className="font-bold text-xl">Farm Aroi</h2>
                            <p className="text-sm">ใบรับสินค้าเข้า (Stock In)</p>
                            <p className="text-xs text-gray-500">สาขา {summaryData.branchName}</p>
                            <p className="text-xs text-gray-500">{format(new Date(), "dd/MM/yyyy HH:mm")}</p>
                            <p className="text-xs text-gray-500">Ref PO: {id} | User: {userProfile?.email?.split('@')[0]}</p>
                        </div>
                        
                        <div className="border-t border-b border-gray-300 py-2 my-2">
                             <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                                        <th className="text-left pb-1">สินค้า</th>
                                        <th className="text-right pb-1">จำนวน</th>
                                        <th className="text-right pb-1">ราคา</th>
                                        <th className="text-right pb-1">รวม</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {summaryData.items.map((item: any, idx: number) => (
                                        <tr key={idx}>
                                            <td className="py-1 pr-2 align-top">
                                                <div className="font-medium">{item.productName}</div>
                                            </td>
                                            <td className="py-1 text-right text-xs align-top whitespace-nowrap">
                                                {item.qty} {item.unit}
                                            </td>
                                            <td className="py-1 text-right text-xs align-top">
                                                {item.price > 0 ? item.price.toLocaleString() : '-'}
                                            </td>
                                            <td className="py-1 text-right font-medium align-top">
                                                {(item.qty * item.price).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                             </table>
                        </div>
                        
                        <div className="flex justify-between items-center pt-2 font-bold text-lg">
                            <span>ยอดรวมสุทธิ</span>
                            <span>฿{summaryData.totalCost.toLocaleString()}</span>
                        </div>
                         <div className="mt-8 text-center text-xs text-gray-400">
                             <p>......................................................</p>
                             <p>ผู้รับสินค้า</p>
                         </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-white flex justify-end gap-3 print:hidden">
                    <button 
                        onClick={() => {setShowSummaryModal(false); window.location.reload();}}
                        className="px-4 py-2 border rounded hover:bg-gray-50"
                    >
                        ปิด
                    </button>
                    <button 
                        onClick={() => window.print()}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                    >
                        <Printer className="w-4 h-4 mr-2" />
                        พิมพ์ใบรับของ
                    </button>
                </div>
             </div>
         </div>
     )}
    </StaffGuard>
  );
}
