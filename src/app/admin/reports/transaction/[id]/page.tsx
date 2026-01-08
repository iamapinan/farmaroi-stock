"use client";

import AdminLayout from "@/components/layouts/AdminLayout";
import AdminGuard from "@/components/auth/AdminGuard";
import { useEffect, useState, use } from "react";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import TransactionDetail from "@/components/stock/TransactionDetail";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminTransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [transaction, setTransaction] = useState<any>(null);
  const [branchName, setBranchName] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchTransaction = async () => {
      try {
        const docRef = doc(db, "stock_transactions", resolvedParams.id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as any;
          setTransaction(data);

          // Fetch branch name
          if (data.branchId) {
             const bSnap = await getDoc(doc(db, 'branches', data.branchId));
             if (bSnap.exists()) setBranchName(bSnap.data().name);
          }

        } else {
          alert("ไม่พบรายการ");
          router.replace("/admin/reports");
        }
      } catch (error) {
        console.error("Error fetching transaction:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTransaction();
  }, [resolvedParams.id, router]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!transaction) return null;

  return (
    <AdminGuard>
        <AdminLayout>
             <div className="pb-10">
                 {/* Header Actions - hidden on print */}
                 <div className="flex justify-between items-center mb-6 print:hidden">
                     <Link href="/admin/reports" className="flex items-center text-gray-500 hover:text-gray-900">
                         <ArrowLeft className="w-4 h-4 mr-1" />
                         กลับไปหน้ารายงาน
                     </Link>
                     <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 font-bold"
                     >
                         <Printer className="w-4 h-4" />
                         พิมพ์ใบเสร็จ
                     </button>
                 </div>

                 <TransactionDetail transaction={transaction} branchName={branchName} />
                 
             </div>
        </AdminLayout>
    </AdminGuard>
  );
}
