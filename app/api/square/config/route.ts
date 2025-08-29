import { NextResponse } from "next/server";
import { getSquareConfig } from "@/lib/square";

export async function GET() {
	try {
		const { applicationId, locationId } = await getSquareConfig();
		return NextResponse.json({ applicationId, locationId });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message ?? "config_error" }, { status: 500 });
	}
}


