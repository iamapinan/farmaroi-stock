
"use client";

import AdminLayout from "@/components/layouts/AdminLayout";
import AdminGuard from "@/components/auth/AdminGuard";
import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Plus, Pencil, Trash } from "lucide-react";

interface Branch {
  id: string;
  name: string;
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBranchName, setNewBranchName] = useState("");
  const [isEditing, setIsEditing] = useState<string | null>(null);

  const fetchBranches = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "branches"));
      const list: Branch[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Branch);
      });
      setBranches(list);
    } catch (error) {
      console.error("Error fetching branches:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    try {
      await addDoc(collection(db, "branches"), { name: newBranchName });
      setNewBranchName("");
      fetchBranches();
    } catch (error) {
      console.error("Error adding branch:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("ยืนยันการลบสาขานี้?")) return;
    try {
      await deleteDoc(doc(db, "branches", id));
      fetchBranches();
    } catch (error) {
      console.error("Error deleting branch:", error);
    }
  };

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">จัดการสาขา</h1>
          </div>

          {/* Add Branch Form */}
          <div className="bg-white p-4 rounded-lg shadow space-y-4">
            <h3 className="font-semibold text-gray-700">เพิ่มสาขาใหม่</h3>
            <form onSubmit={handleCreate} className="flex gap-2">
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="ชื่อสาขา (เช่น สาขาหลัก, สาขาห้าง)"
                className="flex-1 border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                เพิ่ม
              </button>
            </form>
          </div>

          {/* List */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ชื่อสาขา</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {branches.map((branch) => (
                  <tr key={branch.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{branch.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => handleDelete(branch.id)}
                        className="text-red-600 hover:text-red-900 ml-4"
                      >
                       <Trash className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
            
                {branches.length === 0 && !loading && (
                    <tr>
                        <td colSpan={2} className="px-6 py-4 text-center text-gray-500">ไม่พบข้อมูลสาขา</td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
