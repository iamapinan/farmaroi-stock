
"use client";

import AdminLayout from "@/components/layouts/AdminLayout";
import AdminGuard from "@/components/auth/AdminGuard";
import { useEffect, useState, useCallback } from "react";
import { initializeApp, deleteApp, getApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut as signOutSecondary } from "firebase/auth";
import { setDoc, serverTimestamp, collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db, firebaseConfig } from "@/lib/firebase/config";
import { X, Plus, Save, Trash, AlertCircle } from "lucide-react";

// ... existing imports

interface UserData {
  uid: string;
  email: string;
  role: "admin" | "staff";
  branchId?: string;
}

interface Branch {
  id: string;
  name: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create User State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState(""); // Optional display name if needed, but we use email mostly
  const [newRole, setNewRole] = useState<"staff" | "admin">("staff");
  const [newBranchId, setNewBranchId] = useState("");
  const [creating, setCreating] = useState(false);

  // Fetch Data
  const fetchData = useCallback(async () => {
    try {
      // Get Users
      const usersSnap = await getDocs(collection(db, "users"));
      const usersList: UserData[] = [];
      usersSnap.forEach((d) => usersList.push({ uid: d.id, ...d.data() } as UserData));
      setUsers(usersList);

      // Get Branches
      const branchesSnap = await getDocs(collection(db, "branches"));
      const branchesList: Branch[] = [];
      branchesSnap.forEach((d) => branchesList.push({ id: d.id, ...d.data() } as Branch));
      setBranches(branchesList);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdate = async (user: UserData) => {
    try {
      const ref = doc(db, "users", user.uid);
      await updateDoc(ref, {
        role: user.role,
        branchId: user.branchId || null
      });
      alert("บันทึกข้อมูลเรียบร้อยแล้ว");
    } catch (error) {
      console.error("Error updating user:", error);
      alert("บันทึกข้อมูลไม่สำเร็จ");
    }
  };

  const handleDelete = async (uid: string) => {
    if (!confirm("คุณแน่ใจหรือไม่? การลบนี้จะทำให้ผู้ใช้เข้าใช้งานไม่ได้ (แต่บัญชี Auth ยังอยู่)")) return;
    try {
      await deleteDoc(doc(db, "users", uid));
      fetchData();
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const handleChange = (uid: string, field: keyof UserData, value: string) => {
    setUsers(users.map(u => {
      if (u.uid === uid) {
        return { ...u, [field]: value };
      }
      return u;
    }));
  };
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    let secondaryApp: any = null;
    try {
        // Initialize a secondary app to avoid logging out the current admin
        secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
        const secondaryAuth = getAuth(secondaryApp);

        // Create User
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPassword);
        const newUser = userCredential.user;

        // Save to Firestore (using main app's db connection)
        await setDoc(doc(db, "users", newUser.uid), {
            uid: newUser.uid,
            email: newEmail,
            role: newRole,
            branchId: newBranchId || null,
            createdAt: serverTimestamp()
        });

        // Cleanup
        await signOutSecondary(secondaryAuth);
        
        alert("สร้างผู้ใช้งานเรียบร้อยแล้ว");
        setIsCreateModalOpen(false);
        setNewEmail("");
        setNewPassword("");
        setNewBranchId("");
        
        // Refresh list
        fetchData();

    } catch (error: any) {
        console.error("Error creating user:", error);
        alert("สร้างผู้ใช้งานไม่สำเร็จ: " + error.message);
    } finally {
        if (secondaryApp) {
            deleteApp(secondaryApp).catch(console.error);
        }
        setCreating(false);
    }
  };

  // ... handleUpdate, handleDelete, handleChange ...

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">จัดการผู้ใช้งาน</h1>
            <button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
                <Plus className="w-5 h-5" />
                เพิ่มผู้ใช้งานใหม่
            </button>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg flex items-start text-blue-800 text-sm">
             <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
             <p>คุณสามารถเพิ่มพนักงานใหม่ได้ที่นี่ หรือให้พนักงานสมัครเองแล้วมากำหนดสิทธิ์ภายหลัง</p>
          </div>

          {/* ... Table ... */}
           <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
               {/* ... same table content ... */}
               <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">อีเมล</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สิทธิ์การใช้งาน</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สาขาที่สังกัด</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.uid}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                    
                    {/* Role Select */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <select
                        value={user.role}
                        onChange={(e) => handleChange(user.uid, "role", e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>

                    {/* Branch Select */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <select
                        value={user.branchId || ""}
                        onChange={(e) => handleChange(user.uid, "branchId", e.target.value)}
                        disabled={user.role === 'admin'} 
                        className="border border-gray-300 rounded px-2 py-1 w-full max-w-xs"
                      >
                        <option value="">-- ไม่สังกัด / เห็นทุกสาขา --</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                         onClick={() => handleUpdate(user)}
                         className="text-green-600 hover:text-green-900 mr-4"
                         title="Save Changes"
                      >
                         <Save className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(user.uid)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete Profile"
                      >
                       <Trash className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                 {users.length === 0 && !loading && (
                    <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-gray-500">ไม่พบข้อมูลผู้ใช้งาน</td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create User Modal */}
        {isCreateModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden">
                    <div className="flex justify-between items-center p-4 border-b">
                        <h3 className="font-bold text-lg text-gray-900">เพิ่มผู้ใช้งานใหม่</h3>
                        <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleCreateUser} className="p-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
                            <input 
                                type="email" 
                                required
                                value={newEmail}
                                onChange={e => setNewEmail(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                                placeholder="example@farmaroi.com"
                            />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
                            <input 
                                type="text"
                                required 
                                minLength={6}
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                                placeholder="อย่างน้อย 6 ตัวอักษร"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">สิทธิ์</label>
                                <select 
                                    value={newRole}
                                    onChange={(e: any) => setNewRole(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                                >
                                    <option value="staff">Staff</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">สาขา</label>
                                <select 
                                    value={newBranchId}
                                    onChange={e => setNewBranchId(e.target.value)}
                                    disabled={newRole === 'admin'}
                                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                                >
                                    <option value="">-- เลือกสาขา --</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={creating}
                                className="w-full bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                                {creating ? "กำลังสร้าง..." : "สร้างบัญชีผู้ใช้"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

      </AdminLayout>
    </AdminGuard>
  );
}
