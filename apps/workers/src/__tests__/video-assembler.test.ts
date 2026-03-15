import { describe, it, expect } from "vitest";
import { buildConcatFileContent, buildDrawtextFilter } from "../processors/video-assembler";

describe("buildConcatFileContent", () => {
  it("generates concat demuxer input for scene files", () => {
    const files = ["/tmp/scene-0.mp4", "/tmp/scene-1.mp4", "/tmp/scene-2.mp4"];
    const result = buildConcatFileContent(files);
    expect(result).toBe(
      "file '/tmp/scene-0.mp4'\nfile '/tmp/scene-1.mp4'\nfile '/tmp/scene-2.mp4'"
    );
  });

  it("handles single file", () => {
    const result = buildConcatFileContent(["/tmp/only.mp4"]);
    expect(result).toBe("file '/tmp/only.mp4'");
  });
});

describe("buildDrawtextFilter", () => {
  it("builds drawtext filter for captions", () => {
    const captions = [
      { text: "Hello world", startTime: 0, endTime: 3 },
      { text: "Buy now", startTime: 3, endTime: 5 },
    ];
    const filter = buildDrawtextFilter(captions);
    expect(filter).toContain("drawtext=");
    expect(filter).toContain("Hello world");
    expect(filter).toContain("Buy now");
    expect(filter).toContain("enable='between(t,0,3)'");
    expect(filter).toContain("enable='between(t,3,5)'");
  });

  it("returns empty string for no captions", () => {
    expect(buildDrawtextFilter([])).toBe("");
  });
});
