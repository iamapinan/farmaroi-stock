
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/config";
import { collection, doc, writeBatch, getDoc } from "firebase/firestore";

export async function GET() {
  try {
    const batch = writeBatch(db);

    // 1. Create Branches
    const branches = [
      { id: "branch-a", name: "ฟาร์มอร่อย กะเพรา กาแฟ คาเฟ่" }
    ];
    
    branches.forEach((branch) => {
      batch.set(doc(db, "branches", branch.id), branch);
    });

    // 2. Master Data (Categories, Units, Sources)
    // We check if they exist first to avoid overwriting user changes? 
    // For seed script, we might want to ONLY set if missing, or force reset. 
    // Let's force reset for this endpoint as it is a "Seed" tool.
    const masterData = {
        categories: { values: ["ผัก", "เนื้อสัตว์", "เครื่องปรุง", "อุปกรณ์", "เครื่องดื่ม", "คาเฟ่"] },
        units: { values: ["กก.", "กรัม", "ขีด", "ขวด", "แพ็ค", "กระป๋อง", "ถุง", "ซอง", "กล่อง"] },
        sources: { values: ["ตลาด", "แม็คโคร", "ร้านส่ง", "โรงคั่ว", "อื่นๆ"] }
    };

    batch.set(doc(db, "master_data", "categories"), masterData.categories);
    batch.set(doc(db, "master_data", "units"), masterData.units);
    batch.set(doc(db, "master_data", "sources"), masterData.sources);


    // 3. Create Sample Products
    const products = [
      { id: "p1", name: "กะหล่ำปลี", category: "ผัก", unit: "กก.", source: "ตลาด" },
      { id: "p2", name: "หมูสามชั้น", category: "เนื้อสัตว์", unit: "กก.", source: "แม็คโคร" },
      { id: "p3", name: "ซีอิ๊วขาว", category: "เครื่องปรุง", unit: "ขวด", source: "แม็คโคร" },
      { id: "p4", name: "ถุงพลาติก", category: "อุปกรณ์", unit: "แพ็ค", source: "แม็คโคร" },
      { id: "p5", name: "โค้ก", category: "เครื่องดื่ม", unit: "กระป๋อง", source: "ร้านส่ง" },
      { id: "p6", name: "เมล็ดกาแฟ", category: "คาเฟ่", unit: "ถุง", source: "โรงคั่ว" },
    ];

    products.forEach((prod) => {
      batch.set(doc(db, "products", prod.id), prod);
    });

    // 4. Sample Min Stocks
    const branchProducts = [
        { branchId: "branch-a", productId: "p1", minStock: 10 },
        { branchId: "branch-a", productId: "p5", minStock: 24 },
    ];

    branchProducts.forEach((bp) => {
        const id = `${bp.branchId}_${bp.productId}`;
        batch.set(doc(db, "branch_products", id), bp);
    });

    await batch.commit();

    return NextResponse.json({ 
        message: "Database seeded: Master Data, Branches, Products created.",
    });
  } catch (error) {
    console.error("Seeding error:", error);
    return NextResponse.json({ error: "Failed to seed" }, { status: 500 });
  }
}
