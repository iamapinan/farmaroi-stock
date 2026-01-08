import { format } from "date-fns";
import { th } from "date-fns/locale";

interface TransactionDetailProps {
  transaction: {
    id: string;
    date: any;
    branchId: string;
    user: string;
    items: {
      productId: string;
      productName: string;
      qty: number;
      price: number; // Total price for this item line
      unit: string;
    }[];
    totalCost: number;
    type?: string;
  };
  branchName?: string;
}

export default function TransactionDetail({ transaction, branchName }: TransactionDetailProps) {
  const dateStr = transaction.date 
    ? (transaction.date.toDate ? format(transaction.date.toDate(), "d MMMM yyyy HH:mm", { locale: th }) : format(new Date(transaction.date), "d MMMM yyyy HH:mm", { locale: th }))
    : "-";

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 print:shadow-none print:border-none print:p-0">
      <div className="text-center mb-6 print:mb-4">
        <h2 className="text-2xl font-bold text-gray-900 print:text-black">ใบรับสินค้าเข้า (Stock In)</h2>
        <p className="text-gray-500 print:text-gray-600">วันที่: {dateStr}</p>
        <p className="text-gray-500 print:text-gray-600">ทำรายการโดย: {transaction.user}</p>
        <p className="text-gray-500 print:text-gray-600">สาขา: {branchName || transaction.branchId}</p>
        <p className="text-xs text-gray-300 mt-1 print:hidden">ID: {transaction.id}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200 print:bg-gray-100 print:text-black">
            <tr>
              <th className="py-3 px-4 w-16 text-center print:py-1 print:px-2">ลำดับ</th>
              <th className="py-3 px-4 print:py-1 print:px-2">รายการสินค้า</th>
              <th className="py-3 px-4 text-right print:py-1 print:px-2">จำนวน</th>
              <th className="py-3 px-4 text-right print:py-1 print:px-2">หน่วย</th>
              <th className="py-3 px-4 text-right print:py-1 print:px-2">ราคา (บาท)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 print:divide-gray-300">
            {transaction.items.map((item, index) => (
              <tr key={index}>
                <td className="py-3 px-4 text-center text-gray-500 print:py-1 print:px-2 print:text-black">{index + 1}</td>
                <td className="py-3 px-4 font-medium text-gray-900 print:py-1 print:px-2 print:text-black">{item.productName}</td>
                <td className="py-3 px-4 text-right print:py-1 print:px-2 print:text-black">{item.qty.toLocaleString()}</td>
                <td className="py-3 px-4 text-right text-gray-500 print:py-1 print:px-2 print:text-black">{item.unit}</td>
                <td className="py-3 px-4 text-right print:py-1 print:px-2 print:text-black">{item.price.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-bold text-gray-900 border-t border-gray-200 print:bg-transparent print:border-t-2 print:border-black">
            <tr>
              <td colSpan={4} className="py-3 px-4 text-right print:py-1 print:px-2">ยอดรวมทั้งสิ้น</td>
              <td className="py-3 px-4 text-right text-green-600 print:py-1 print:px-2 print:text-black text-lg">
                ฿{transaction.totalCost.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-8 border-t pt-4 print:block hidden">
          <div className="flex justify-between text-sm text-center mt-8">
              <div className="w-1/3">
                  <p className="mb-8">__________________________</p>
                  <p>ผู้ทำรายการ</p>
              </div>
              <div className="w-1/3">
                  <p className="mb-8">__________________________</p>
                  <p>ผู้ตรวจสอบ</p>
              </div>
          </div>
      </div>
    </div>
  );
}
