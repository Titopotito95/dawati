import { beforeAll, describe, expect, it } from "vitest";
import { getDb, __resetDbForTests } from "@/lib/db";
import { putObject, getObject, deleteObject, newMediaKey } from "@/lib/services/storage";

beforeAll(async () => {
  __resetDbForTests();
  await getDb();
});

describe("media storage (db driver, the default)", () => {
  it("stores, serves and deletes bytes exactly", async () => {
    const key = newMediaKey("webp");
    const body = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 1, 2, 3, 254, 255]);
    await putObject(key, body, "image/webp");
    const got = await getObject(key);
    expect(got?.mime).toBe("image/webp");
    expect(Buffer.compare(got!.body, body)).toBe(0);
    await deleteObject(key);
    expect(await getObject(key)).toBeNull();
    expect(await getObject("../etc/passwd")).toBeNull();
  });
});
