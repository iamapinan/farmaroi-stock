"use client";

import { useAuth } from "@/lib/firebase/context";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BarChart3, Package, Users, CheckCircle2 } from "lucide-react";

export default function Home() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!loading && user && userProfile) {
      setRedirecting(true);
      if (userProfile.role === 'admin') {
        router.replace('/admin/dashboard');
      } else {
        router.replace('/staff/check');
      }
    }
  }, [user, userProfile, loading, router]);

  if (loading || redirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center animate-pulse">
           <div className="h-12 w-12 bg-green-600 rounded-full mb-4"></div>
           <p className="text-gray-500 font-medium">{loading ? "กำลังโหลด..." : "กำลังเข้าสู่ระบบ..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Navbar */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md fixed top-0 w-full z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <div className="bg-green-600 text-white p-1.5 rounded-lg">
                <Package className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl text-gray-900 tracking-tight">Farm Aroi Stock</span>
           </div>
           <div>
              <Link 
                href="/login" 
                className="text-sm font-semibold text-gray-600 hover:text-green-600 transition-colors"
              >
                สำหรับพนักงาน
              </Link>
           </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col justify-center pt-20 pb-12 lg:pt-32 lg:pb-24">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold uppercase tracking-wide mb-6 border border-green-100">
               System v2.0 Live
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-6">
               ระบบจัดการสต๊อก <br className="hidden md:block" />
               <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-500">
                 สำหรับธุรกิจยุคใหม่
               </span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg md:text-xl text-gray-500 mb-10 leading-relaxed">
               จัดการสินค้า ตรวจสอบยอดคงเหลือ และสั่งซื้อได้อย่างมีประสิทธิภาพสูงสุด 
               รองรับการทำงานหลายสาขา พร้อมข้อมูล Real-time
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
               <Link 
                 href="/login" 
                 className="group bg-green-600 text-white px-8 py-4 rounded-full text-lg font-bold shadow-lg hover:bg-green-700 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2"
               >
                 เข้าสู่ระบบ
                 <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
               </Link>
               {/* <button className="text-gray-500 font-medium hover:text-gray-900 transition-colors px-6">
                  คู่มือการใช้งาน
               </button> */}
            </div>
         </div>
      </section>

      {/* Features Grid */}
      <section className="bg-gray-50 py-16 md:py-24">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-8">
               {/* Feature 1 */}
               <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center text-blue-600 mb-6">
                     <Users className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Multi-Branch Support</h3>
                  <p className="text-gray-500 leading-relaxed">
                     รองรับการจัดการสินค้าแยกตามสาขา พนักงานสามารถเข้าถึงข้อมูลเฉพาะสาขาของตนเองได้อย่างปลอดภัย
                  </p>
               </div>

               {/* Feature 2 */}
               <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="bg-green-50 w-12 h-12 rounded-xl flex items-center justify-center text-green-600 mb-6">
                     <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Easy Stock Check</h3>
                  <p className="text-gray-500 leading-relaxed">
                     ระบบเช็คสต๊อกที่ออกแบบมาเพื่อการใช้งานบนมือถือ สะดวก รวดเร็ว และลดความผิดพลาดในการนับสินค้า
                  </p>
               </div>

               {/* Feature 3 */}
               <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="bg-purple-50 w-12 h-12 rounded-xl flex items-center justify-center text-purple-600 mb-6">
                     <BarChart3 className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Real-time Dashboard</h3>
                  <p className="text-gray-500 leading-relaxed">
                     ผู้บริหารดูภาพรวมยอดสั่งซื้อ สินค้าคงเหลือ และแนวโน้มการใช้วัตถุดิบได้ทันทีผ่าน Dashboard
                  </p>
               </div>
            </div>
         </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-8 border-t border-gray-100">
         <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm">
            <p>© {new Date().getFullYear()} Farm Aroi. All rights reserved.</p>
         </div>
      </footer>
    </div>
  );
}
