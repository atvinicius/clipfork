import { describe, it, expect } from "vitest";
import {
  parseTikTokItem,
  parseInstagramItem,
  extractHashtags,
  extractMentions,
} from "../intel/parse";

const TIKTOK_ITEM = {
  id: "7456789012345678901",
  webVideoUrl: "https://www.tiktok.com/@someuser/video/7456789012345678901",
  text: "unreal trick #fyp #dance @friend",
  createTimeISO: "2026-09-28T12:00:00.000Z",
  playCount: 1_234_567,
  diggCount: 89_000,
  shareCount: 4_200,
  commentCount: 1_500,
  collectCount: 300,
  authorMeta: {
    id: "998877",
    name: "someuser",
    nickName: "Some User",
    verified: true,
    fans: 500_000,
    following: 100,
    heart: 9_000_000,
    video: 200,
    avatar: "https://p16.example/avatar.jpg",
  },
  musicMeta: {
    musicId: "7150001",
    musicName: "original sound",
    musicAuthor: "someuser",
    musicOriginal: true,
    duration: 15,
  },
  hashtags: [{ name: "fyp" }, { name: "dance" }],
  covers: { default: "https://p16.example/cover.jpg" },
};

const IG_ITEM = {
  id: "3789921778899",
  shortCode: "DQabc123",
  caption: "reel caption #fitness @gymbro",
  likesCount: 12_000,
  commentsCount: 340,
  videoViewCount: 210_000,
  videoDuration: 12.5,
  timestamp: "2026-09-27T10:00:00.000Z",
  ownerUsername: "fitguru",
  ownerFullName: "Fit Guru",
  isVideo: true,
  type: "Video",
  musicInfo: { songName: "Push It", artistName: "Salt-N-Pepa", audioId: "1812" },
};

describe("parseTikTokItem", () => {
  it("normalizes metrics, creator, sound, hashtags, and timestamp", () => {
    const p = parseTikTokItem(TIKTOK_ITEM);
    expect(p).not.toBeNull();
    expect(p!.platformPostId).toBe("7456789012345678901");
    expect(p!.url).toContain("@someuser/video/7456789012345678901");
    expect(p!.metrics.views).toBe(1234567n);
    expect(p!.metrics.likes).toBe(89000);
    expect(p!.metrics.saves).toBe(300);
    expect(p!.creator?.username).toBe("someuser");
    expect(p!.creator?.followers).toBe(500_000);
    expect(p!.creator?.verified).toBe(true);
    expect(p!.sound?.platformSoundId).toBe("7150001");
    expect(p!.sound?.isOriginalAudio).toBe(true);
    expect(p!.sound?.title).toBe("original sound");
    expect(p!.hashtags).toEqual(["fyp", "dance"]);
    expect(p!.mentions).toContain("friend");
    expect(p!.postedAt?.toISOString()).toBe("2026-09-28T12:00:00.000Z");
    expect(p!.coverUrl).toContain("cover.jpg");
  });

  it("returns null for items without an id", () => {
    expect(parseTikTokItem({ text: "no id" })).toBeNull();
  });

  it("handles epoch-second createTime and missing author/music", () => {
    const p = parseTikTokItem({
      id: "1",
      createTime: 1_759_000_000,
      playCount: "2500",
      diggCount: 10,
    });
    expect(p).not.toBeNull();
    expect(p!.metrics.views).toBe(2500n);
    expect(p!.creator).toBeUndefined();
    expect(p!.sound).toBeUndefined();
    expect(p!.postedAt).toEqual(new Date(1_759_000_000_000));
  });
});

describe("parseInstagramItem", () => {
  it("normalizes a reel with music attribution", () => {
    const p = parseInstagramItem(IG_ITEM);
    expect(p).not.toBeNull();
    expect(p!.platformPostId).toBe("3789921778899");
    expect(p!.metrics.views).toBe(210_000n);
    expect(p!.metrics.likes).toBe(12_000);
    expect(p!.creator?.username).toBe("fitguru");
    expect(p!.sound?.platformSoundId).toBe("1812");
    expect(p!.sound?.title).toBe("Push It");
    expect(p!.sound?.artist).toBe("Salt-N-Pepa");
    expect(p!.sound?.isOriginalAudio).toBe(false);
    expect(p!.hashtags).toEqual(["fitness"]);
    expect(p!.mentions).toContain("gymbro");
    expect(p!.durationSec).toBe(12.5);
  });

  it("falls back to reel URL from shortCode and marks untitled audio as original", () => {
    const p = parseInstagramItem({
      shortCode: "XYZ",
      ownerUsername: "u",
      isVideo: true,
      videoPlayCount: 5,
    });
    expect(p!.url).toBe("https://www.instagram.com/reel/XYZ/");
  });

  it("returns null without id or shortCode", () => {
    expect(parseInstagramItem({ caption: "x" })).toBeNull();
  });
});

describe("text extraction helpers", () => {
  it("dedupes and lowercases hashtags from list + caption", () => {
    const tags = extractHashtags({ hashtags: ["FYP"] }, "hey #fyp #New_Tag");
    expect(tags).toEqual(["fyp", "new_tag"]);
  });

  it("extracts mentions from caption text", () => {
    expect(extractMentions({}, "cc @alice and @bob.smith")).toEqual([
      "alice",
      "bob.smith",
    ]);
  });
});
