import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalogPageSize, paginate, parsePage } from "./pagination";

describe("pagination", () => {
  it("reads only positive integer page numbers and defaults to the first page", () => {
    assert.equal(parsePage(undefined), 1);
    assert.equal(parsePage("3"), 3);
    for (const invalid of ["0", "-2", "1.5", "abc", "", "99999"]) assert.equal(parsePage(invalid), 1, invalid);
  });

  it("slices items and keeps the requested page inside the available range", () => {
    const items = Array.from({ length: 30 }, (_, index) => index);
    const second = paginate(items, 2);
    assert.equal(second.items[0], catalogPageSize);
    assert.equal(second.pageCount, 3);
    assert.equal(second.total, 30);
    assert.equal(paginate(items, 99).page, 3);
    assert.equal(paginate(items, 99).items.length, 6);
    assert.deepEqual(paginate([], 4), { items: [], page: 1, pageCount: 1, total: 0 });
  });
});
