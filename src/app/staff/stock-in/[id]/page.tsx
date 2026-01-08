"use client";

import StaffLayout from "@/components/layouts/StaffLayout";
import StaffGuard from "@/components/auth/StaffGuard";
import { useEffect, useState, use } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/context";
import TransactionDetail from "@/components/stock/TransactionDetail";
import { ArrowLeft, Printer, Edit } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function StockInDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { userProfile } = useAuth();
  const [transaction, setTransaction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchTransaction = async () => {
      if (!userProfile?.branchId && userProfile?.role !== 'admin') return;

      try {
        const docRef = doc(db, "stock_transactions", resolvedParams.id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as any;
          // Check permission
          if (userProfile.role !== 'admin' && data.branchId !== userProfile.branchId) {
             alert("คุณไม่มีสิทธิ์เข้าถึงรายการนี้");
             router.replace("/staff/stock-in");
             return;
          }
          setTransaction(data);
        } else {
          alert("ไม่พบรายการ");
          router.replace("/staff/stock-in");
        }
      } catch (error) {
        console.error("Error fetching transaction:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTransaction();
  }, [resolvedParams.id, userProfile, router]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!transaction) return null;

  return (
    <StaffGuard>
        <StaffLayout>
             <div className="pb-10">
                 {/* Header Actions - hidden on print */}
                 <div className="flex justify-between items-center mb-6 print:hidden">
                     <Link href="/staff/stock-in" className="flex items-center text-gray-500 hover:text-gray-900">
                         <ArrowLeft className="w-4 h-4 mr-1" />
                         กลับ
                     </Link>
                     <div className="flex gap-2">
                         <Link
                             href={`/staff/stock-in?editId=${transaction.id}`}
                             className="flex items-center gap-2 bg-yellow-100 text-yellow-700 px-4 py-2 rounded-lg border border-yellow-300 hover:bg-yellow-200 font-bold"
                         >
                             <Edit className="w-4 h-4" />
                             แก้ไข
                         </Link>
                         <button
                             onClick={() => window.print()}
                             className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 font-bold"
                         >
                         <Printer className="w-4 h-4" />
                         พิมพ์ใบเสร็จ
                     </button>
                     </div>
                 </div>

                 <TransactionDetail transaction={transaction} />
                 
             </div>
        </StaffLayout>
    </StaffGuard>
  );
}
