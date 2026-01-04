
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/config";
import { collection, getDocs, query, where, updateDoc, doc } from "firebase/firestore";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  try {
    const q = query(collection(db, "users"), where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json({ error: "User not found. Sign up first." }, { status: 404 });
    }

    const userDoc = querySnapshot.docs[0];
    await updateDoc(doc(db, "users", userDoc.id), {
      role: "admin"
    });

    return NextResponse.json({ message: `User ${email} is now an Admin` });
  } catch (error) {
    console.error("Error promoting user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
