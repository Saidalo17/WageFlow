import { FileDown } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Ways into the printable report: the last 12 months, or one year. Opens in a new tab and offers "Save as PDF". */
export async function SalaryReportLinks({ years }: { years: number[] }) {
  const t = await getTranslations("salary");
  const link = cn(buttonVariants({ variant: "secondary", size: "sm" }), "gap-1.5");

  return (
    <Card title={t("report.cardTitle")} index={5}>
      <p className="mb-4 text-sm text-muted-foreground">{t("report.cardHint")}</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/salary/report?print=1" target="_blank" className={link}>
          <FileDown className="size-4" />
          {t("report.last12")}
        </Link>
        {years.map((y) => (
          <Link key={y} href={`/salary/report?period=${y}&print=1`} target="_blank" className={link}>
            <FileDown className="size-4" />
            {y}
          </Link>
        ))}
      </div>
    </Card>
  );
}
