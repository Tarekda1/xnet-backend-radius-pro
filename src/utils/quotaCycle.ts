/** Monthly billing cycle helpers — aligned with FreeRADIUS sql mod monthly window logic. */

export function safeIntDayOfMonth(input: unknown): number {
    const n = typeof input === "number" ? input : parseInt(String(input ?? ""), 10);
    if (!Number.isFinite(n)) return 1;
    return Math.min(31, Math.max(1, Math.floor(n)));
}

/** SQL expression: start date of the user's current monthly quota window. */
export function sqlMonthlyCycleStart(userAlias = "up"): string {
    const a = userAlias;
    return `(
        CASE
            WHEN ${a}.quota_cycle_start_date IS NOT NULL THEN ${a}.quota_cycle_start_date
            WHEN DAY(CURDATE()) >= ${a}.quota_reset_day THEN
                STR_TO_DATE(CONCAT(DATE_FORMAT(CURDATE(), '%Y-%m-'), LPAD(${a}.quota_reset_day, 2, '0')), '%Y-%m-%d')
            ELSE
                STR_TO_DATE(
                    CONCAT(DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-'), LPAD(${a}.quota_reset_day, 2, '0')),
                    '%Y-%m-%d'
                )
        END
    )`;
}

/** SQL expression: when the current monthly quota window ends (next reset). */
export function sqlMonthlyCycleResetAt(userAlias = "up"): string {
    const start = sqlMonthlyCycleStart(userAlias);
    return `DATE_ADD(${start}, INTERVAL 1 MONTH)`;
}

export type QuotaCycleDates = {
    cycleStart: string;
    cycleResetAt: string;
};

/** JS mirror of sqlMonthlyCycleStart for tests / offline use. */
export function computeMonthlyCycleDates(
    resetDay: number | null | undefined,
    manualStartDate: string | Date | null | undefined,
    now = new Date()
): QuotaCycleDates {
    if (manualStartDate) {
        const start = normalizeDateOnly(manualStartDate);
        const reset = addMonthsClamped(start, 1);
        return { cycleStart: start, cycleResetAt: reset };
    }

    const day = safeIntDayOfMonth(resetDay ?? 1);
    const yyyy = now.getFullYear();
    const mm = now.getMonth() + 1;
    const todayDay = now.getDate();

    let startYear = yyyy;
    let startMonth = mm;
    if (todayDay < day) {
        startMonth -= 1;
        if (startMonth < 1) {
            startMonth = 12;
            startYear -= 1;
        }
    }

    const cycleStart = formatYyyyMmDd(startYear, startMonth, day);
    const reset = addMonthsClamped(cycleStart, 1);
    return { cycleStart, cycleResetAt: reset };
}

function normalizeDateOnly(value: string | Date): string {
    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
    return d.toISOString().slice(0, 10);
}

function formatYyyyMmDd(year: number, month: number, day: number): string {
    const lastDay = daysInMonth(year, month);
    const d = Math.min(day, lastDay);
    return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
}

function addMonthsClamped(yyyyMmDd: string, months: number): string {
    const [y, m, d] = yyyyMmDd.split("-").map((x) => parseInt(x, 10));
    let month = m - 1 + months;
    let year = y + Math.floor(month / 12);
    month = ((month % 12) + 12) % 12;
    const day = Math.min(d, daysInMonth(year, month + 1));
    return formatYyyyMmDd(year, month + 1, day);
}

export function parseDateOnlyField(value: unknown): Date | null {
    if (value === null || value === undefined || value === "") return null;
    const normalized = normalizeDateOnly(String(value));
    const d = new Date(`${normalized}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
    return d;
}
