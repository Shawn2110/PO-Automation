import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  if (process.env.SEED_RESET === "true") {
    await prisma.auditLog.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.vendorTemplate.deleteMany();
    await prisma.vendor.deleteMany();
    await prisma.user.deleteMany();
  }

  // Legacy cleanup: drop any 'admin'-role users left from prior seeds. Invoice
  // foreign keys are SetNull, so this is safe — the reassignment below restores
  // uploadedById to a live accountant on every run.
  await prisma.user.deleteMany({ where: { role: "admin" } });

  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  const accountant = await prisma.user.upsert({
    where: { email: "accountant@buildco.in" },
    update: {},
    create: { name: "Arun Accountant", email: "accountant@buildco.in", passwordHash: hash("accountant123"), role: "accountant" },
  });
  await prisma.user.upsert({
    where: { email: "viewer@buildco.in" },
    update: {},
    create: { name: "Vidya Viewer", email: "viewer@buildco.in", passwordHash: hash("viewer123"), role: "viewer" },
  });

  const tata = await prisma.vendor.upsert({
    where: { gstNumber: "27AAACT2727Q1ZW" },
    update: {},
    create: {
      name: "Tata Steel Ltd",
      gstNumber: "27AAACT2727Q1ZW",
      invoiceCount: 3,
      hasTemplate: true,
      lastSeen: new Date("2026-04-22"),
    },
  });
  await prisma.vendorTemplate.upsert({
    where: { vendorId: tata.id },
    update: {},
    create: {
      vendorId: tata.id,
      invoiceDateLabel: "Invoice Date",
      invoiceNumberLabel: "Invoice No.",
      clientNameLabel: "Bill To",
      amountBeforeGstLabel: "Taxable Value",
      amountAfterGstLabel: "Grand Total",
      createdById: accountant.id,
    },
  });

  const ultratech = await prisma.vendor.upsert({
    where: { gstNumber: "29AAACL6442L1ZS" },
    update: {},
    create: {
      name: "UltraTech Cement Ltd",
      gstNumber: "29AAACL6442L1ZS",
      invoiceCount: 2,
      hasTemplate: true,
      lastSeen: new Date("2026-04-18"),
    },
  });
  await prisma.vendorTemplate.upsert({
    where: { vendorId: ultratech.id },
    update: {},
    create: {
      vendorId: ultratech.id,
      invoiceDateLabel: "Date",
      invoiceNumberLabel: "Inv #",
      clientNameLabel: "Customer",
      amountBeforeGstLabel: "Sub Total",
      amountAfterGstLabel: "Total Payable",
      createdById: accountant.id,
    },
  });

  const acmePipes = await prisma.vendor.upsert({
    where: { gstNumber: "33AAFCA1234B1Z5" },
    update: {},
    create: {
      name: "Acme Pipes & Fittings",
      gstNumber: "33AAFCA1234B1Z5",
      invoiceCount: 0,
      hasTemplate: false,
      lastSeen: new Date("2026-05-15"),
    },
  });

  const sampleInvoices: Array<{
    invoiceNumber: string;
    vendorId: string;
    invoiceDate: Date | null;
    clientName: string | null;
    amountBeforeGst: number | null;
    amountAfterGst: number | null;
    gstPct: number | null;
    status: string;
    ocrConfidence: number;
    pdfPath: string;
    uploadedById: string;
  }> = [
    {
      invoiceNumber: "TS-2026-0142",
      vendorId: tata.id,
      invoiceDate: new Date("2026-04-22"),
      clientName: "BuildCo Infra Pvt Ltd",
      amountBeforeGst: 245000,
      amountAfterGst: 289100,
      gstPct: 18,
      status: "processed",
      ocrConfidence: 0.94,
      pdfPath: "/uploads/seed/ts-2026-0142.pdf",
      uploadedById: accountant.id,
    },
    {
      invoiceNumber: "TS-2026-0139",
      vendorId: tata.id,
      invoiceDate: new Date("2026-04-08"),
      clientName: "BuildCo Infra Pvt Ltd",
      amountBeforeGst: 180000,
      amountAfterGst: 212400,
      gstPct: 18,
      status: "processed",
      ocrConfidence: 0.91,
      pdfPath: "/uploads/seed/ts-2026-0139.pdf",
      uploadedById: accountant.id,
    },
    {
      invoiceNumber: "UTC-2412-887",
      vendorId: ultratech.id,
      invoiceDate: new Date("2026-04-18"),
      clientName: "BuildCo Infra Pvt Ltd",
      amountBeforeGst: 94500,
      amountAfterGst: 111510,
      gstPct: 18,
      status: "processed",
      ocrConfidence: 0.88,
      pdfPath: "/uploads/seed/utc-2412-887.pdf",
      uploadedById: accountant.id,
    },
    {
      invoiceNumber: "UTC-2412-901",
      vendorId: ultratech.id,
      invoiceDate: new Date("2026-04-30"),
      clientName: "BuildCo Infra Pvt Ltd",
      amountBeforeGst: 67200,
      amountAfterGst: 79296,
      gstPct: 18,
      status: "needs_review",
      ocrConfidence: 0.62,
      pdfPath: "/uploads/seed/utc-2412-901.pdf",
      uploadedById: accountant.id,
    },
    {
      invoiceNumber: "ACME-2026-051",
      vendorId: acmePipes.id,
      invoiceDate: null,
      clientName: null,
      amountBeforeGst: null,
      amountAfterGst: null,
      gstPct: null,
      status: "needs_mapping",
      ocrConfidence: 0.83,
      pdfPath: "/uploads/seed/acme-2026-051.pdf",
      uploadedById: accountant.id,
    },
  ];

  for (const inv of sampleInvoices) {
    await prisma.invoice.upsert({
      where: { invoiceNumber_vendorId: { invoiceNumber: inv.invoiceNumber, vendorId: inv.vendorId } },
      update: { uploadedById: inv.uploadedById },
      create: inv,
    });
  }

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.vendor.count(),
    prisma.vendorTemplate.count(),
    prisma.invoice.count(),
  ]);

  console.log("Seed complete:", { users: counts[0], vendors: counts[1], templates: counts[2], invoices: counts[3] });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
