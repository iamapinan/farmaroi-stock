"use client";

import StaffLayout from "@/components/layouts/StaffLayout";
import StaffGuard from "@/components/auth/StaffGuard";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/context";
import Link from "next/link";
import { Calendar as CalendarIcon, ChevronRight, List, ChevronLeft } from "lucide-react";
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  format, 
  addMonths, 
  subMonths,
  startOfWeek,
  endOfWeek
} from "date-fns";
import { th } from "date-fns/locale";

interface DailyCheck {
  id: string;
  date: any; // Timestamp
  status: string;
  items: any[];
  branchId?: string;
}

export default function POListPage() {
  const { userProfile } = useAuth();
  const [checks, setChecks] = useState<DailyCheck[]>([]);
  const [loading, setLoading] = useState(true);
  
  // View State
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    const init = async () => {
        if (!userProfile) return;

        if (userProfile.branchId) {
            loadChecks(userProfile.branchId);
        } else if (userProfile.role === 'admin') {
            try {
                const bSnap = await getDocs(collection(db, 'branches'));
                if (!bSnap.empty) {
                    loadChecks(bSnap.docs[0].id);
                } else {
                    setLoading(false);
                }
            } catch (e) {
                console.error("Error fetching branches for admin fallback", e);
                setLoading(false);
            }
        } else {
            setLoading(false);
        }
    };
    init();
  }, [userProfile]);

  const loadChecks = async (branchId: string) => {
    try {
      const q = query(
        collection(db, "daily_checks"),
        where("branchId", "==", branchId),
        orderBy("date", "desc")
      );
      const snap = await getDocs(q);
      const list: DailyCheck[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as DailyCheck));
      setChecks(list);
    } catch (error) {
      console.error("Error loading checks:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "d MMM yyyy HH:mm", { locale: th });
  };

  // Calendar Helpers
  const getDaysInMonth = () => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  };

  const getChecksForDay = (date: Date) => {
    return checks.filter(check => {
      const checkDate = check.date.toDate ? check.date.toDate() : new Date(check.date);
      return isSameDay(checkDate, date);
    });
  };

  const displayedChecks = viewMode === 'list' 
    ? checks 
    : selectedDate 
        ? getChecksForDay(selectedDate)
        : checks.filter(c => isSameMonth(c.date.toDate ? c.date.toDate() : new Date(c.date), currentMonth));

  return (
    <StaffGuard>
        <StaffLayout>
            <div className="space-y-4 pb-20">
                <div className="flex justify-between items-center">
                    <h1 className="text-xl font-bold text-gray-800">ประวัติการสั่งซื้อ</h1>
                    
                    {/* Toggle */}
                    <div className="flex bg-gray-200 rounded-lg p-1">
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}
                        >
                            <List className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={() => setViewMode('calendar')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'calendar' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}
                        >
                            <CalendarIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                
                {loading ? (
                    <div className="text-center py-8 text-gray-500">กำลังโหลด...</div>
                ) : (
                    <>
                        {/* Calendar View */}
                        {viewMode === 'calendar' && (
                            <div className="bg-white rounded-lg shadow p-4 mb-4">
                                <div className="flex justify-between items-center mb-4">
                                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 rounded-full">
                                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                                    </button>
                                    <h2 className="font-bold text-lg text-gray-800">
                                        {format(currentMonth, "MMMM yyyy", { locale: th })}
                                    </h2>
                                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 rounded-full">
                                        <ChevronRight className="w-5 h-5 text-gray-600" />
                                    </button>
                                </div>
                                
                                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                                    {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
                                        <div key={day} className="text-xs font-bold text-gray-400 py-1">{day}</div>
                                    ))}
                                </div>
                                
                                <div className="grid grid-cols-7 gap-1">
                                    {getDaysInMonth().map((date, idx) => {
                                        const dayChecks = getChecksForDay(date);
                                        const isCurrentMonth = isSameMonth(date, currentMonth);
                                        const isSelected = selectedDate && isSameDay(date, selectedDate);
                                        const hasCheck = dayChecks.length > 0;
                                        
                                        return (
                                            <button 
                                                key={idx}
                                                onClick={() => setSelectedDate(date)}
                                                className={`
                                                    h-10 rounded-lg flex flex-col items-center justify-center relative transition-colors
                                                    ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-800'}
                                                    ${isSelected ? 'bg-green-100 border-2 border-green-500' : 'hover:bg-gray-50'}
                                                    ${isSameDay(date, new Date()) ? 'bg-blue-50 font-bold' : ''}
                                                `}
                                            >
                                                <span className="text-sm">{format(date, 'd')}</span>
                                                {hasCheck && (
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-0.5"></div>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                                {selectedDate && (
                                    <div className="mt-2 text-center text-sm text-green-600">
                                        เลือกวันที่: {format(selectedDate, "d MMM yyyy", { locale: th })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Order List */}
                        {displayedChecks.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
                                <p className="text-gray-500">ไม่พบประวัติการสั่งซื้อ{viewMode === 'calendar' && selectedDate ? 'ในวันที่เลือก' : ''}</p>
                                {viewMode === 'list' && (
                                    <Link href="/staff/check" className="text-green-600 font-medium mt-2 inline-block">
                                        เริ่มเช็คสต๊อกใหม่
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {displayedChecks.map(check => (
                                    <Link 
                                        key={check.id} 
                                        href={`/staff/po/${check.id}`}
                                        className="block bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:border-green-200 transition-colors"
                                    >
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-green-100 p-2 rounded-lg text-green-700">
                                                    <CalendarIcon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900">{formatDate(check.date)}</p>
                                                    <p className="text-xs text-gray-500">{check.items.length} รายการที่สั่งซื้อ</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="text-gray-400 w-5 h-5" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </StaffLayout>
    </StaffGuard>
  );
}
