import test from "node:test";
import assert from "node:assert/strict";
import {
  parseArlenPage,
  parseBahamutThread,
  parsePcGamerArticle,
  parseYarCodesPayload,
  reconcileSourceState,
  reconcileState,
  YAR_URL,
} from "../src/monitor.js";

test("parses active and struck-through codes from the first post", () => {
  const html = `
    <section>
      <a data-floor="1">first floor</a>
      <article>
        <div class="c-article__content">
          <div>ACTIVE2026</div>
          <strike>EXPIRED2026</strike>
          <strike>WWMGLtiktok</strike>
        </div>
      </article>
    </section>
    <section>
      <a data-floor="2">reply</a>
      <article>
        <div class="c-article__content">REPLY2026</div>
      </article>
    </section>
  `;

  assert.deepEqual(parseBahamutThread(html), [
    { code: "ACTIVE2026", status: "active" },
    { code: "EXPIRED2026", status: "expired" },
    { code: "WWMGLTIKTOK", status: "expired" },
  ]);
});

test("parses active and expired codes from Arlen", () => {
  const html = `
    <main>
      <h2>有效兌換碼 2 個</h2>
      <button>MX8MYAYJ4Q 有效 複製</button>
      <button>jxt3ctjhwp 有效 複製</button>
      <h2>失效兌換碼 1 個</h2>
      <button>AMTRC8F3AJ 失效 複製</button>
    </main>
  `;

  assert.deepEqual(parseArlenPage(html), [
    { code: "MX8MYAYJ4Q", status: "active" },
    { code: "JXT3CTJHWP", status: "active" },
    { code: "AMTRC8F3AJ", status: "expired" },
  ]);
});

test("parses active and expired codes from PC Gamer", () => {
  const html = `
    <article>
      <header>
        <span>PC Gamer THE GLOBAL AUTHORITY ON PC GAMES</span>
        <a>Find out about our magazine</a>
      </header>
      <table>
        <tr><th>Code</th><th>Reward</th></tr>
      </table>
      <h2>All active Where Winds Meet Codes</h2>
      <p>Here are all the active codes currently available for Where Winds Meet:</p>
      <table>
        <tr><th>Code</th><th>Reward</th></tr>
        <tr><td>MEETINHM</td><td>150x Echo Jade</td></tr>
        <tr><td>hd4crchptn</td><td>3x Echo Jade</td></tr>
      </table>
      <h3>Expired Where Winds Meet Codes</h3>
      <ul>
        <li>WWMDEVTALK - expired reward</li>
      </ul>
    </article>
  `;

  assert.deepEqual(parsePcGamerArticle(html), [
    { code: "MEETINHM", status: "active" },
    { code: "HD4CRCHPTN", status: "active" },
    { code: "WWMDEVTALK", status: "expired" },
  ]);
});

test("parses Yar active and expired lists without treating used codes as expired", () => {
  assert.deepEqual(
    parseYarCodesPayload({
      active: [
        { code: "TF37WR876K", addedAt: "2026-09-17T00:00:00Z" },
        { code: "yryqhtneda" },
        { code: "TF37WR876K" },
      ],
      expired: [{ code: "AMTRC8F3AJ" }],
    }),
    [
      { code: "TF37WR876K", status: "active" },
      { code: "YRYQHTNEDA", status: "active" },
      { code: "AMTRC8F3AJ", status: "expired" },
    ],
  );
});

test("rejects missing or malformed Yar lists before updating state", () => {
  assert.throws(() => parseYarCodesPayload({ active: [], expired: [] }));
  assert.throws(() => parseYarCodesPayload({ active: [{ code: "GOOD123" }] }));
  assert.throws(() =>
    parseYarCodesPayload({ active: [{ code: "BAD CODE" }], expired: [] }),
  );
});

test("first Yar scan baselines old codes; later scans announce only new codes", () => {
  const first = reconcileSourceState(
    {
      initialized: true,
      sourceUrl: "https://www.arlenfuture.com/games/where-winds-meet-codes/",
      codes: [
        {
          code: "KNOWN2026",
          status: "active",
          firstSeenAt: "2026-09-16T00:00:00.000Z",
          lastSeenAt: "2026-09-16T00:00:00.000Z",
        },
        {
          code: "OLD2026",
          status: "active",
          firstSeenAt: "2026-09-16T00:00:00.000Z",
          lastSeenAt: "2026-09-16T00:00:00.000Z",
        },
      ],
    },
    [
      { code: "KNOWN2026", status: "active" },
      { code: "BASELINE2026", status: "active" },
      { code: "OLD2026", status: "expired" },
    ],
    "2026-09-17T00:00:00.000Z",
    YAR_URL,
  );

  assert.equal(first.firstRun, true);
  assert.deepEqual(first.newActive, []);
  assert.equal(first.state.scannedSourceUrl, YAR_URL);
  assert.deepEqual(
    first.state.codes.map((entry) => entry.code),
    ["BASELINE2026", "KNOWN2026"],
  );

  const second = reconcileSourceState(
    first.state,
    [
      { code: "KNOWN2026", status: "active" },
      { code: "BASELINE2026", status: "active" },
      { code: "NEWCODE2026", status: "active" },
    ],
    "2026-09-17T06:00:00.000Z",
    YAR_URL,
  );
  assert.equal(second.firstRun, false);
  assert.deepEqual(second.newActive, [
    { code: "NEWCODE2026", status: "active" },
  ]);
});

test("manual reports before the first Yar scan do not bypass the baseline", () => {
  const result = reconcileSourceState(
    {
      initialized: true,
      sourceUrl: YAR_URL,
      scannedSourceUrl: null,
      codes: [],
    },
    [{ code: "EXISTING2026", status: "active" }],
    "2026-09-17T00:00:00.000Z",
    YAR_URL,
  );

  assert.equal(result.firstRun, true);
  assert.deepEqual(result.newActive, []);
});

test("first run creates a baseline without announcing old active codes", () => {
  const result = reconcileState(
    { initialized: false, codes: [] },
    [
      { code: "ACTIVE2026", status: "active" },
      { code: "EXPIRED2026", status: "expired" },
    ],
    "2026-06-19T00:00:00.000Z",
  );

  assert.equal(result.firstRun, true);
  assert.deepEqual(result.newActive, []);
  assert.deepEqual(result.state.codes, [
    {
      code: "ACTIVE2026",
      status: "active",
      firstSeenAt: "2026-06-19T00:00:00.000Z",
      lastSeenAt: "2026-06-19T00:00:00.000Z",
    },
  ]);
});

test("later runs announce only unseen active codes", () => {
  const result = reconcileState(
    {
      initialized: true,
      codes: [
        {
          code: "KNOWN2026",
          status: "active",
          firstSeenAt: "2026-06-18T00:00:00.000Z",
          lastSeenAt: "2026-06-18T00:00:00.000Z",
        },
      ],
    },
    [
      { code: "KNOWN2026", status: "active" },
      { code: "NEWCODE2026", status: "active" },
      { code: "OLD2026", status: "expired" },
    ],
    "2026-06-19T00:00:00.000Z",
  );

  assert.deepEqual(result.newActive, [
    { code: "NEWCODE2026", status: "active" },
  ]);
});

test("expired source codes are removed from stored state", () => {
  const result = reconcileState(
    {
      initialized: true,
      codes: [
        {
          code: "KNOWN2026",
          status: "active",
          firstSeenAt: "2026-06-18T00:00:00.000Z",
          lastSeenAt: "2026-06-18T00:00:00.000Z",
        },
        {
          code: "OLD2026",
          status: "active",
          firstSeenAt: "2026-06-18T00:00:00.000Z",
          lastSeenAt: "2026-06-18T00:00:00.000Z",
        },
      ],
    },
    [
      { code: "KNOWN2026", status: "active" },
      { code: "OLD2026", status: "expired" },
    ],
    "2026-06-19T00:00:00.000Z",
  );

  assert.deepEqual(
    result.state.codes.map((entry) => entry.code),
    ["KNOWN2026"],
  );
});
