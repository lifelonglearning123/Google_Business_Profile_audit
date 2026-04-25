import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { getAudit } from "@/lib/store";
import ReportPdf from "@/components/pdf/ReportPdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const audit = getAudit(id);
  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  const buffer = await renderToBuffer(React.createElement(ReportPdf, { audit }));
  const safeName = audit.gbp.name.replace(/[^a-z0-9-_ ]/gi, "").slice(0, 40).trim();
  const filename = `GBP-Audit-${safeName || "report"}.pdf`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-cache",
    },
  });
}
