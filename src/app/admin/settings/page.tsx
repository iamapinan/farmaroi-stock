
"use client";

import AdminLayout from "@/components/layouts/AdminLayout";
import AdminGuard from "@/components/auth/AdminGuard";
import { useState } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useMasterData } from "@/hooks/useMasterData";
import { Trash2, Plus, Settings, Tag, Scale, Store } from "lucide-react";
import clsx from "clsx";

// Reusable Section Component
const Section = ({ title, items, newItem, setNewItem, onAdd, onDelete, type, icon: Icon, color, placeholder }: any) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onAdd(type, newItem, setNewItem);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[500px] animate-fade-in">
      {/* Header Area in Content */}
      <div className="p-6 border-b border-gray-50 bg-gradient-to-r from-gray-50/50 to-white">
        <div className="flex items-center gap-4 mb-2">
            <div className={clsx("p-3 rounded-2xl shadow-sm", color.replace("text-", "bg-").replace("50", "100/50"))}>
                 <Icon className={clsx("w-6 h-6", color)} />
            </div>
            <div>
                <h3 className="font-bold text-gray-900 text-xl">{title}</h3>
                <p className="text-gray-500 text-sm">จัดการข้อมูล {title} ในระบบ</p>
            </div>
            <span className="ml-auto text-xs font-bold bg-gray-900 text-white px-3 py-1 rounded-full shadow-lg shadow-gray-200">
                {items.length} รายการ
            </span>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-6 flex-1 flex flex-col min-h-0">
        {/* Input Area */}
        <div className={clsx("group flex items-center gap-2 border-2 rounded-2xl px-4 py-3 mb-6 transition-all duration-300", isFocused ? "border-gray-900 shadow-md" : "border-gray-100 hover:border-gray-200")}>
            <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={placeholder || `เพิ่ม${title}...`}
                className="flex-1 text-base outline-none text-gray-800 placeholder-gray-400 bg-transparent"
                onKeyDown={handleKeyDown}
            />
            <button
                onClick={() => onAdd(type, newItem, setNewItem)}
                disabled={!newItem.trim()}
                className="bg-gray-900 text-white p-2 rounded-xl hover:bg-black disabled:opacity-20 disabled:hover:bg-gray-900 transition-all duration-300 transform active:scale-95"
            >
                <Plus className="w-5 h-5" />
            </button>
        </div>

        {/* List Area */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
            {items.map((item: string, idx: number) => (
            <div 
                key={item} 
                className="group flex justify-between items-center p-4 bg-gray-50/50 hover:bg-white border border-transparent hover:border-gray-100 rounded-2xl transition-all duration-200 hover:shadow-sm"
                style={{ animationDelay: `${idx * 50}ms` }}
            >
                <span className="text-gray-700 font-medium pl-1">{item}</span>
                <button
                onClick={() => onDelete(type, item)}
                className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                title="ลบรายการ"
                >
                <Trash2 className="w-4 h-4" />
                </button>
            </div>
            ))}
            
            {items.length === 0 && (
                <div className="flex flex-col items-center justify-center h-[200px] text-gray-300 border-2 border-dashed border-gray-100 rounded-3xl">
                    <Icon className="w-12 h-12 opacity-10 mb-3" />
                    <p className="text-sm font-medium">ยังไม่มีข้อมูลในรายการนี้</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default function SettingsPage() {
  const { categories, units, sources } = useMasterData();
  const [activeTab, setActiveTab] = useState<"categories" | "units" | "sources">("categories");
  
  // Local state for inputs
  const [newCat, setNewCat] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newSource, setNewSource] = useState("");

  const handleAdd = async (type: "categories" | "units" | "sources", value: string, setValue: (v: string) => void) => {
    if (!value.trim()) return;
    try {
      const ref = doc(db, "master_data", type);
      await updateDoc(ref, {
        values: arrayUnion(value.trim())
      });
      setValue(""); 
    } catch (error) {
      console.error(`Error adding ${type}:`, error);
      alert("เพิ่มข้อมูลไม่สำเร็จ");
    }
  };

  const handleDelete = async (type: "categories" | "units" | "sources", value: string) => {
    if (!confirm(`ต้องการลบ "${value}" หรือไม่?`)) return;
    try {
      const ref = doc(db, "master_data", type);
      await updateDoc(ref, {
        values: arrayRemove(value)
      });
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      alert("ลบข้อมูลไม่สำเร็จ");
    }
  };

  const tabs = [
    { id: "categories", label: "หมวดหมู่สินค้า", icon: Tag, color: "text-purple-600" },
    { id: "units", label: "หน่วยนับ", icon: Scale, color: "text-blue-300" },
    { id: "sources", label: "แหล่งที่ซื้อ", icon: Store, color: "text-orange-600" },
  ];

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="max-w-4xl mx-auto pb-20">
          
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">ตั้งค่าข้อมูลระบบ</h1>
            <p className="text-gray-500">จัดการข้อมูล Master Data สำหรับใช้งานในระบบ</p>
          </div>

          {/* Styled Tab Navigation */}
          <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 inline-flex mb-8 relative">
              {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={clsx(
                            "flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 font-medium text-sm relative z-10",
                            isActive 
                                ? "bg-gray-900 text-white shadow-md transform scale-105" 
                                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                        )}
                    >
                        <Icon className={clsx("w-4 h-4", isActive ? "text-white" : tab.color)} />
                        {tab.label}
                    </button>
                  );
              })}
          </div>

          {/* Tab Content */}
          <div className="transition-all duration-300 transform origin-top">
            {activeTab === "categories" && (
                <Section 
                    title="หมวดหมู่สินค้า" 
                    items={categories} 
                    newItem={newCat} 
                    setNewItem={setNewCat} 
                    type="categories"
                    icon={Tag}
                    color="text-pink-600"
                    placeholder="เช่น ผัก, เนื้อสัตว์, เครื่องดื่ม..."
                    onAdd={handleAdd}
                    onDelete={handleDelete}
                />
            )}
            {activeTab === "units" && (
                <Section 
                    title="หน่วยนับ" 
                    items={units} 
                    newItem={newUnit} 
                    setNewItem={setNewUnit} 
                    type="units" 
                    icon={Scale}
                    color="text-blue-400"
                    placeholder="เช่น กก., ขีด, แพ็ค..."
                    onAdd={handleAdd}
                    onDelete={handleDelete}
                />
            )}
            {activeTab === "sources" && (
                <Section 
                    title="แหล่งที่ซื้อ" 
                    items={sources} 
                    newItem={newSource} 
                    setNewItem={setNewSource} 
                    type="sources" 
                    icon={Store}
                    color="text-orange-600"
                    placeholder="เช่น แม็คโคร, ตลาดสด..."
                    onAdd={handleAdd}
                    onDelete={handleDelete}
                />
            )}
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
