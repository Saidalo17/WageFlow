import { describe, expect, it } from "vitest";
import { calculateSalary, type SalaryInput } from "@/lib/salary";

const base: SalaryInput = {
  mode: "monthly",
  rate: 300000, // 3000.00
  quantity: 0,
  monthHours: 16000,
  dayHours: 800,
  overtimeHours: 0,
  overtimeMultiplier: 150,
  bonuses: [],
  deductions: [],
};

describe("calculateSalary", () => {
  it("monthly salary with no extras: gross = net", () => {
    const r = calculateSalary(base);
    expect(r.gross).toBe(300000);
    expect(r.net).toBe(300000);
    expect(r.hourlyRate).toBe(1875); // 3000 / 160 = 18.75
    expect(r.dailyRate).toBe(15000); // 18.75 * 8
  });

  it("hourly: rate x hours", () => {
    const r = calculateSalary({ ...base, mode: "hourly", rate: 2000, quantity: 17250 }); // 20.00 x 172.5 h
    expect(r.basePay).toBe(345000);
    expect(r.hourlyRate).toBe(2000);
    expect(r.dailyRate).toBe(16000);
  });

  it("daily: rate x days, hourly derived from the day length", () => {
    const r = calculateSalary({ ...base, mode: "daily", rate: 16000, quantity: 2100 }); // 160.00 x 21 days
    expect(r.basePay).toBe(336000);
    expect(r.hourlyRate).toBe(2000);
  });

  it("overtime is paid at the hourly rate times the multiplier", () => {
    const r = calculateSalary({ ...base, overtimeHours: 1000, overtimeMultiplier: 150 }); // 10 h at 1.5x
    expect(r.overtimePay).toBe(28125); // 18.75 * 10 * 1.5 = 281.25
    expect(r.gross).toBe(328125);
  });

  it("bonuses add to the gross pay", () => {
    const r = calculateSalary({ ...base, bonuses: [50000, 25000] });
    expect(r.bonusTotal).toBe(75000);
    expect(r.gross).toBe(375000);
  });

  it("percentage and fixed deductions are taken from the gross pay", () => {
    const r = calculateSalary({
      ...base,
      bonuses: [100000],
      deductions: [
        { label: "Tax", kind: "percent", value: 1300 }, // 13% of 4000.00
        { label: "Insurance", kind: "fixed", value: 5000 },
      ],
    });
    expect(r.gross).toBe(400000);
    expect(r.deductions.map((d) => d.amount)).toEqual([52000, 5000]);
    expect(r.deductionTotal).toBe(57000);
    expect(r.net).toBe(343000);
  });

  it("net goes negative when deductions exceed the pay (the server rejects that)", () => {
    const r = calculateSalary({ ...base, deductions: [{ label: "x", kind: "fixed", value: 400000 }] });
    expect(r.net).toBe(-100000);
  });

  it("falls back to the default hours when they are missing", () => {
    expect(calculateSalary({ ...base, monthHours: 0 }).hourlyRate).toBe(1875);
  });
});
