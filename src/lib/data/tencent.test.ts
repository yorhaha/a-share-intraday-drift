import { describe, expect, it } from "vitest";
import {
  parseKlinePayload,
  parseKlineRows,
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
