import { describe, expect, it } from "vitest";
import { assertPersistentDataMount, inspectDataMount, PersistentDataRequiredError } from "./data-mount.js";

const overlayOnlyMountInfo = `29 23 0:25 / / rw,relatime - overlay overlay rw`;
const volumeMountInfo = `${overlayOnlyMountInfo}\n30 29 8:1 /var/lib/wago /app/data rw,relatime - ext4 /dev/sda1 rw`;
const parentMountInfo = `${overlayOnlyMountInfo}\n31 29 8:2 /wago /app rw,relatime - xfs /dev/sdb1 rw`;
const tmpfsMountInfo = `${overlayOnlyMountInfo}\n32 29 0:47 / /app/data rw,nosuid,nodev - tmpfs tmpfs rw`;

describe("persistent data mount inspection", () => {
  it("accepts a dedicated /app/data mount", () => {
    expect(inspectDataMount(volumeMountInfo, "/app/data")).toEqual({
      persistent: true,
      mountPoint: "/app/data",
      fsType: "ext4",
    });
  });

  it("accepts a persistent parent mount", () => {
    expect(inspectDataMount(parentMountInfo, "/app/data")).toEqual({
      persistent: true,
      mountPoint: "/app",
      fsType: "xfs",
    });
  });

  it("rejects root overlay storage", () => {
    expect(inspectDataMount(overlayOnlyMountInfo, "/app/data")).toEqual({
      persistent: false,
      mountPoint: "/",
      fsType: "overlay",
    });
  });

  it("rejects tmpfs even when it is mounted directly at /app/data", () => {
    expect(inspectDataMount(tmpfsMountInfo, "/app/data")).toEqual({
      persistent: false,
      mountPoint: "/app/data",
      fsType: "tmpfs",
    });
  });

  it("skips the fatal policy outside production", () => {
    expect(() =>
      assertPersistentDataMount({
        nodeEnv: "test",
        dataDirectory: "/app/data",
        mountInfoPath: "/does/not/exist",
      }),
    ).not.toThrow();
  });

  it("fails closed in production when mount information is unavailable", () => {
    expect(() =>
      assertPersistentDataMount({
        nodeEnv: "production",
        dataDirectory: "/app/data",
        mountInfoPath: "/does/not/exist",
      }),
    ).toThrow(PersistentDataRequiredError);
  });
});
