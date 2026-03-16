import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, any>;

vi.mock("@/lib/supabase", () => {
  const makeId = (() => {
    let id = 1000;
    return () => ++id;
  })();

  const state: Record<string, Row[]> = {
    apartments: [],
    building_settings: [{ id: 1, setting_key: "monthlyDuesAmount", setting_value: 750 }],
    monthly_dues: [],
    monthly_payments: [],
    extra_fees: [],
    ledger_entries: [],
    dues_columns: [],
    logs: [],
  };

  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

  const applyFilters = (rows: Row[], filters: Array<{ type: "eq" | "in"; col: string; val: any }>) => {
    return rows.filter((row) =>
      filters.every((f) => {
        if (f.type === "eq") return row[f.col] === f.val;
        if (f.type === "in") return Array.isArray(f.val) && f.val.includes(row[f.col]);
        return true;
      })
    );
  };

  const query = (table: string) => {
    const ctx: {
      op: "select" | "insert" | "update" | "delete" | "upsert";
      payload?: any;
      filters: Array<{ type: "eq" | "in"; col: string; val: any }>;
      limit?: number;
      order?: { col: string; asc: boolean };
    } = {
      op: "select",
      filters: [],
    };

    const run = () => {
      const rows = state[table] || [];

      if (ctx.op === "select") {
        let data = applyFilters(rows, ctx.filters);
        if (ctx.order) {
          const { col, asc } = ctx.order;
          data = [...data].sort((a, b) => {
            if (a[col] === b[col]) return 0;
            return asc ? (a[col] > b[col] ? 1 : -1) : (a[col] < b[col] ? 1 : -1);
          });
        }
        if (typeof ctx.limit === "number") {
          data = data.slice(0, ctx.limit);
        }

        // Simulate relational select used by api.ts
        if (table === "monthly_dues") {
          data = data.map((d) => ({
            ...d,
            monthly_payments: (state.monthly_payments || []).filter((p) => p.monthly_dues_id === d.id),
            extra_fees: (state.extra_fees || []).filter((f) => f.monthly_dues_id === d.id),
          }));
        }

        return { data: clone(data), error: null };
      }

      if (ctx.op === "insert") {
        const input = Array.isArray(ctx.payload) ? ctx.payload : [ctx.payload];
        const inserted = input.map((r) => {
          const row = { id: r.id ?? makeId(), ...r };
          rows.push(row);
          return row;
        });
        return { data: clone(inserted), error: null };
      }

      if (ctx.op === "update") {
        const matched = applyFilters(rows, ctx.filters);
        matched.forEach((r) => Object.assign(r, ctx.payload));
        return { data: clone(matched), error: null };
      }

      if (ctx.op === "delete") {
        const keep = rows.filter(
          (r) => !ctx.filters.every((f) => (f.type === "eq" ? r[f.col] === f.val : Array.isArray(f.val) && f.val.includes(r[f.col])))
        );
        state[table] = keep;
        return { data: [], error: null };
      }

      // Minimal upsert support used in api.ts
      if (ctx.op === "upsert") {
        const payload = Array.isArray(ctx.payload) ? ctx.payload[0] : ctx.payload;
        if (table === "monthly_dues") {
          const existing = rows.find((r) => r.apartment_id === payload.apartment_id && r.year === payload.year);
          if (existing) {
            Object.assign(existing, payload);
            return { data: clone([existing]), error: null };
          }
        }
        if (table === "monthly_payments") {
          const existing = rows.find((r) => r.monthly_dues_id === payload.monthly_dues_id && r.month === payload.month);
          if (existing) {
            Object.assign(existing, payload);
            return { data: clone([existing]), error: null };
          }
        }
        const row = { id: payload.id ?? makeId(), ...payload };
        rows.push(row);
        return { data: clone([row]), error: null };
      }

      return { data: null, error: null };
    };

    const builder: any = {
      select: () => {
        ctx.op = "select";
        return builder;
      },
      insert: (payload: any) => {
        ctx.op = "insert";
        ctx.payload = payload;
        return builder;
      },
      update: (payload: any) => {
        ctx.op = "update";
        ctx.payload = payload;
        return builder;
      },
      delete: () => {
        ctx.op = "delete";
        return builder;
      },
      upsert: (payload: any) => {
        ctx.op = "upsert";
        ctx.payload = payload;
        return builder;
      },
      eq: (col: string, val: any) => {
        ctx.filters.push({ type: "eq", col, val });
        return builder;
      },
      in: (col: string, val: any[]) => {
        ctx.filters.push({ type: "in", col, val });
        return builder;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        ctx.order = { col, asc: opts?.ascending !== false };
        return builder;
      },
      limit: (n: number) => {
        ctx.limit = n;
        return builder;
      },
      single: async () => {
        const res = run();
        const first = Array.isArray(res.data) ? res.data[0] : res.data;
        if (!first) return { data: null, error: { code: "PGRST116", message: "No rows" } };
        return { data: first, error: null };
      },
      maybeSingle: async () => {
        const res = run();
        const first = Array.isArray(res.data) ? res.data[0] : res.data;
        return { data: first || null, error: null };
      },
      then: (resolve: (v: any) => any, reject?: (e: any) => any) => Promise.resolve(run()).then(resolve, reject),
    };

    return builder;
  };

  const supabase = {
    from: (table: string) => query(table),
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "admin-1" } } }, error: null }),
    },
  };

  return {
    supabase,
    __mockDb: {
      reset(data: Partial<Record<string, Row[]>>) {
        Object.keys(state).forEach((k) => {
          state[k] = clone(data[k] || []);
        });
        if (!state.building_settings.length) {
          state.building_settings = [{ id: 1, setting_key: "monthlyDuesAmount", setting_value: 750 }];
        }
      },
      read(table: string) {
        return clone(state[table] || []);
      },
    },
  };
});

describe("Extra fee persistence (Su) and refresh behavior", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { __mockDb }: any = await import("@/lib/supabase");
    __mockDb.reset({
      apartments: [
        { id: 11, apartment_number: 1, resident_name: "Ali", block: "A", building_id: "b1" },
      ],
      monthly_dues: [
        { id: 21, apartment_id: 11, year: 2026, carried_debt: 0, elevator_payment: 0, total_paid: 0, balance: 0 },
      ],
      monthly_payments: [],
      extra_fees: [],
      ledger_entries: [],
      dues_columns: [],
      logs: [],
    });
  });

  it("saves Su payment to DB and fetchDues returns it after refresh", async () => {
    const api = await import("@/lib/api");

    await api.updateExtraFee(1, "Su", 350, 2026, "A", "b1");

    const dues = await api.fetchDues(2026, "b1");
    const row = dues.find((d) => d.daireNo === 1 && d.blok === "A");

    expect(row).toBeTruthy();
    expect(row?.extraFees?.Su).toBe(350);
  });

  it("removes Su payment when amount becomes 0", async () => {
    const api = await import("@/lib/api");
    const { __mockDb }: any = await import("@/lib/supabase");

    await api.updateExtraFee(1, "Su", 500, 2026, "A", "b1");
    await api.updateExtraFee(1, "Su", 0, 2026, "A", "b1");

    const fees = __mockDb.read("extra_fees");
    expect(fees.filter((f: any) => f.fee_name === "Su")).toHaveLength(0);
  });

  it("aggregates duplicate Su rows correctly on refresh", async () => {
    const { __mockDb }: any = await import("@/lib/supabase");
    const api = await import("@/lib/api");

    __mockDb.reset({
      apartments: [
        { id: 11, apartment_number: 1, resident_name: "Ali", block: "A", building_id: "b1" },
      ],
      monthly_dues: [
        { id: 21, apartment_id: 11, year: 2026, carried_debt: 0, elevator_payment: 0, total_paid: 0, balance: 0 },
      ],
      monthly_payments: [],
      extra_fees: [
        { id: 901, monthly_dues_id: 21, fee_name: "Su", amount: 120 },
        { id: 902, monthly_dues_id: 21, fee_name: "Su", amount: 80 },
      ],
      ledger_entries: [],
      dues_columns: [],
      logs: [],
    });

    const dues = await api.fetchDues(2026, "b1");
    const row = dues.find((d) => d.daireNo === 1 && d.blok === "A");

    expect(row?.extraFees?.Su).toBe(200);
  });
});
