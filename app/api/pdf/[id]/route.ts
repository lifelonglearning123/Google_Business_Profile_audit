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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @react-pdf typings require ReactElement<DocumentProps>; cast is the documented workaround.
  const buffer = await renderToBuffer(
    React.createElement(ReportPdf, { audit }) as any
  );
  const safeName = audit.gbp.name.replace(/[^a-z0-9-_ ]/gi, "").slice(0, 40).trim();
  const filename = `GBP-Audit-${safeName || "report"}.pdf`;

  // Buffer extends Uint8Array, but Next 15's NextResponse types expect BodyInit
  // and reject Buffer<ArrayBufferLike>. Wrap as Uint8Array to satisfy the typing.
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-cache",
    },
  });
}
