
"use client";

import AdminLayout from "@/components/layouts/AdminLayout";
import AdminGuard from "@/components/auth/AdminGuard";
import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Plus, Pencil, Trash, X, Search } from "lucide-react";
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

export default function ProductsPage() {
  const { categories, units, sources, loading: masterLoading } = useMasterData();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    unit: "",
    source: "",
    minStock: "",
    disableStockCheck: false,
  });

  // Effect to set defaults once master data loads
  useEffect(() => {
    if (!masterLoading && !formData.category && categories.length > 0) {
        setFormData(prev => ({
            ...prev,
            category: categories[0],
            unit: units[0] || "",
            source: sources[0] || ""
        }));
    }
  }, [masterLoading, categories, units, sources]);

  const fetchProducts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "products"));
      const list: Product[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(list);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        category: product.category,
        unit: product.unit,
        source: product.source,
        minStock: product.minStock?.toString() || "",
        disableStockCheck: product.disableStockCheck || false,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        category: categories[0],
        unit: "",
        source: sources[0],
        minStock: "",
        disableStockCheck: false,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSave = {
        ...formData,
        minStock: formData.minStock ? Number(formData.minStock) : 0,
        disableStockCheck: formData.disableStockCheck
      };

      if (editingProduct) {
        // Update
        await updateDoc(doc(db, "products", editingProduct.id), dataToSave);
      } else {
        // Create
        await addDoc(collection(db, "products"), dataToSave);
      }
      handleCloseModal();
      fetchProducts();
    } catch (error) {
      console.error("Error saving product:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("ยืนยันการลบสินค้า?")) return;
    try {
      await deleteDoc(doc(db, "products", id));
      fetchProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === "All" || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">จัดการสินค้า</h1>
            <button
              onClick={() => handleOpenModal()}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              เพิ่มสินค้า
            </button>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-lg shadow">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อสินค้า..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 w-full border border-gray-300 rounded-md py-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border border-gray-300 rounded-md py-2 px-3"
            >
              <option value="All">ทุกหมวดหมู่</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* List */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ชื่อสินค้า</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">หมวดหมู่</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">หน่วย</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">แหล่งซื้อ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ขั้นต่ำ</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className={product.disableStockCheck ? "bg-gray-50 opacity-60" : ""}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product.name}
                        {product.disableStockCheck && <span className="ml-2 text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">Hidden</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.unit}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.source}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.minStock || "-"}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => handleOpenModal(product)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                       <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(product.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                       <Trash className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && !loading && (
                    <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">ไม่พบสินค้า</td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">{editingProduct ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</h3>
                <button onClick={handleCloseModal}><X className="w-6 h-6 text-gray-500" /></button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">ชื่อสินค้า</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="mt-1 w-full border rounded-md px-3 py-2"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">หมวดหมู่</label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({...formData, category: e.target.value})}
                            className="mt-1 w-full border rounded-md px-3 py-2"
                        >
                            <option value="" disabled>-- เลือก --</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">แหล่งซื้อ</label>
                         <select
                            value={formData.source}
                            onChange={(e) => setFormData({...formData, source: e.target.value})}
                            className="mt-1 w-full border rounded-md px-3 py-2"
                        >
                             <option value="" disabled>-- เลือก --</option>
                             {sources.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">หน่วย (เช่น กก., ขวด)</label>
                  <select
                     value={formData.unit}
                     onChange={(e) => setFormData({...formData, unit: e.target.value})}
                     className="mt-1 w-full border rounded-md px-3 py-2"
                  >
                      <option value="" disabled>-- เลือก --</option>
                      {units.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">แจ้งเตือนขั้นต่ำ (Default Min Stock)</label>
                  <input
                    type="number"
                    value={formData.minStock}
                    onChange={(e) => setFormData({...formData, minStock: e.target.value})}
                    className="mt-1 w-full border rounded-md px-3 py-2"
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">ค่านี้จะถูกใช้เป็นค่าเริ่มต้นสำหรับทุกสาขา</p>
                </div>

                <div className="flex items-center gap-2 pt-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                       <input 
                          type="checkbox"
                          id="disableCheck"
                          checked={formData.disableStockCheck}
                          onChange={(e) => setFormData({...formData, disableStockCheck: e.target.checked})}
                          className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                       />
                       <label htmlFor="disableCheck" className="text-sm font-medium text-gray-900 cursor-pointer">
                          ไม่ต้องนำมาเช็คสต๊อกรายวัน (Disable Stock Check)
                       </label>
                  </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button type="button" onClick={handleCloseModal} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Save</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </AdminLayout>
    </AdminGuard>
  );
}
