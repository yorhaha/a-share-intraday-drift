import { describe, expect, it } from "vitest";
import {
  parseKlinePayload,
  parseKlineRows,
  parseQuotePayload,
  parseSmartboxResponse,
} from "./tencent";

describe("parseSmartboxResponse", () => {
  it("keeps only A-share hits", () => {
    const text =
      'v_hint="sh~601318~\\u4e2d\\u56fd\\u5e73\\u5b89~zgpa~GP-A^hk~02318~\\u4e2d\\u56fd\\u5e73\\u5b89~zgpa~GP^sz~000001~\\u5e73\\u5b89\\u94f6\\u884c~payh~GP-A"';
    const hits = parseSmartboxResponse(text);
    expect(hits.map((hit) => hit.symbol)).toEqual(["sh601318", "sz000001"]);
    expect(hits[0].name).toBe("中国平安");
    expect(hits[0].market).toBe("sh");
  });

  it("accepts the decoded global payload from JSONP", () => {
    const hits = parseSmartboxResponse(
      "sh~600036~招商银行~zsyh~GP-A^sz~000001~平安银行~payh~GP-A",
    );
    expect(hits.map((hit) => hit.symbol)).toEqual(["sh600036", "sz000001"]);
    expect(hits[0].name).toBe("招商银行");
  });

  it("returns an empty list for malformed responses", () => {
    expect(parseSmartboxResponse("nope")).toEqual([]);
  });
});

describe("parseKlineRows", () => {
  it("parses date/open/close/high/low/volume order", () => {
    const { bars, dropped } = parseKlineRows([
      ["2024-01-02", "10.0", "10.5", "10.8", "9.9", "12345"],
      ["2024-01-03", "10.5", "10.2", "10.6", "10.0", "23456"],
    ]);
    expect(dropped).toBe(0);
    expect(bars[0]).toEqual({
      date: "2024-01-02",
      open: 10,
      close: 10.5,
      high: 10.8,
      low: 9.9,
      volume: 12345,
    });
  });

  it("drops invalid and zero-volume rows, dedupes dates", () => {
    const { bars, dropped } = parseKlineRows([
      ["2024-01-02", "10", "10.5", "10.8", "9.9", "0"],
      ["2024-01-03", "10", "10.5", "10.8", "9.9", "100"],
      ["2024-01-03", "11", "11.5", "11.8", "10.9", "200"],
      ["bad-date", "1", "1", "1", "1", "1"],
    ]);
    expect(dropped).toBe(2);
    expect(bars).toHaveLength(1);
    expect(bars[0].open).toBe(11);
  });
});

describe("parseKlinePayload", () => {
  it("reads qfqday and day keys", () => {
    const qfq = parseKlinePayload(
      {
        code: 0,
        data: {
          sh601318: {
            qfqday: [
              ["2024-01-02", "10", "10.5", "10.8", "9.9", "100"],
            ],
          },
        },
      },
      "sh601318",
    );
    expect(qfq.bars).toHaveLength(1);
    const raw = parseKlinePayload(
      {
        code: 0,
        data: {
          sh601318: {
            day: [
              ["2024-01-02", "10", "10.5", "10.8", "9.9", "100"],
            ],
          },
        },
      },
      "sh601318",
    );
    expect(raw.bars).toHaveLength(1);
  });

  it("throws on non-zero response codes", () => {
    expect(() =>
      parseKlinePayload({ code: 1, msg: "bad params" }, "sh601318"),
    ).toThrow("bad params");
  });
});

function quotePayload(overrides: Partial<Record<number, string>> = {}): string {
  const parts = new Array<string>(35).fill("");
  parts[1] = "招商银行";
  parts[2] = "600036";
  parts[3] = "36.52";
  parts[4] = "36.10";
  parts[5] = "36.20";
  parts[6] = "123456";
  parts[30] = "20241103143500";
  parts[33] = "36.80";
  parts[34] = "36.05";
  for (const [index, value] of Object.entries(overrides)) {
    parts[Number(index)] = value ?? "";
  }
  return `v_sh600036="${parts.join("~")}";`;
}

describe("parseQuotePayload", () => {
  it("parses the latest price, previous close and quote time", () => {
    const quote = parseQuotePayload(quotePayload(), "sh600036");
    expect(quote).not.toBeNull();
    expect(quote?.date).toBe("2024-11-03");
    expect(quote?.time).toBe("14:35");
    expect(quote?.open).toBeCloseTo(36.2, 10);
    expect(quote?.close).toBeCloseTo(36.52, 10);
    expect(quote?.high).toBeCloseTo(36.8, 10);
    expect(quote?.low).toBeCloseTo(36.05, 10);
    expect(quote?.prevClose).toBeCloseTo(36.1, 10);
    expect(quote?.volume).toBe(123456);
  });

  it("accepts an unwrapped payload string", () => {
    const payload = quotePayload().replace(/^v_sh600036="|";$/g, "");
    expect(parseQuotePayload(payload)?.close).toBeCloseTo(36.52, 10);
  });

  it("rejects a quote for another symbol", () => {
    expect(parseQuotePayload(quotePayload(), "sz000001")).toBeNull();
  });

  it("rejects invalid timestamps and inconsistent prices", () => {
    expect(
      parseQuotePayload(quotePayload({ 30: "2024-11-03 14:35:00" })),
    ).toBeNull();
    expect(parseQuotePayload(quotePayload({ 33: "35.00" }))).toBeNull();
    expect(parseQuotePayload(quotePayload({ 5: "0" }))).toBeNull();
  });
});
