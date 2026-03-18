import Firecrawl from "@mendable/firecrawl-js";
import * as cheerio from "cheerio";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@ugc/db";
import { uploadToR2 } from "../lib/r2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScraperJobData {
  productUrl: string;
  productId: string;
  orgId: string;
}

interface ScrapedProductData {
  title: string;
  description: string;
  images: string[];
  price: string | null;
  reviews: Array<{ text: string; rating?: number; author?: string }>;
  rawHtml?: string;
}

// ---------------------------------------------------------------------------
// Firecrawl-based scraping
// ---------------------------------------------------------------------------

async function scrapeWithFirecrawl(url: string): Promise<ScrapedProductData> {
  const firecrawl = new Firecrawl({
    apiKey: process.env.FIRECRAWL_API_KEY!,
  });

  const result = await firecrawl.scrape(url, {
    formats: ["markdown", "html"],
  });

  const html = (result as unknown as { html?: string }).html ?? "";
  const $ = cheerio.load(html);

  // Extract title
  const title =
    $('meta[property="og:title"]').attr("content") ??
    $("title").text().trim() ??
    $("h1").first().text().trim() ??
    "Untitled Product";

  // Extract description
  const description =
    $('meta[property="og:description"]').attr("content") ??
    $('meta[name="description"]').attr("content") ??
    $("p").first().text().trim() ??
    "";

  // Extract images
  const images: string[] = [];
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage) images.push(ogImage);

  $("img").each((_i, el) => {
    const src = $(el).attr("src");
    if (src && !src.includes("data:image") && !src.includes("svg")) {
      // Resolve relative URLs
      try {
        const absoluteUrl = new URL(src, url).href;
        if (!images.includes(absoluteUrl)) {
          images.push(absoluteUrl);
        }
      } catch {
        // Skip invalid URLs
      }
    }
  });

  // Extract price (common selectors)
  const priceSelectors = [
    '[class*="price"]',
    '[data-price]',
    '[itemprop="price"]',
    ".price",
    "#price",
  ];
  let price: string | null = null;
  for (const selector of priceSelectors) {
    const priceEl = $(selector).first();
    if (priceEl.length) {
      const priceText = priceEl.text().trim();
      const priceMatch = priceText.match(/[\$\u00a3\u20ac]?\s?\d+[.,]\d{2}/);
      if (priceMatch) {
        price = priceMatch[0];
        break;
      }
    }
  }

  // Extract reviews
  const reviews: Array<{ text: string; rating?: number; author?: string }> = [];
  const reviewSelectors = [
    '[class*="review"]',
    '[itemprop="review"]',
    '[data-review]',
  ];
  for (const selector of reviewSelectors) {
    $(selector)
      .slice(0, 5)
      .each((_i, el) => {
        const text = $(el).text().trim();
        if (text.length > 20 && text.length < 1000) {
          reviews.push({ text: text.substring(0, 500) });
        }
      });
    if (reviews.length > 0) break;
  }

  return {
    title,
    description: description.substring(0, 2000),
    images: images.slice(0, 10),
    price,
    reviews: reviews.slice(0, 5),
  };
}

// ---------------------------------------------------------------------------
// Cheerio fallback scraping
// ---------------------------------------------------------------------------

async function scrapeWithCheerio(url: string): Promise<ScrapedProductData> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Failed to fetch ${url}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const title =
    $('meta[property="og:title"]').attr("content") ??
    $("title").text().trim() ??
    "Untitled Product";

  const description =
    $('meta[property="og:description"]').attr("content") ??
    $('meta[name="description"]').attr("content") ??
    "";

  const images: string[] = [];
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage) {
    try {
      images.push(new URL(ogImage, url).href);
    } catch {
      // Skip invalid URL
    }
  }

  $("img")
    .slice(0, 10)
    .each((_i, el) => {
      const src = $(el).attr("src");
      if (src && !src.includes("data:image") && !src.includes("svg")) {
        try {
          const absoluteUrl = new URL(src, url).href;
          if (!images.includes(absoluteUrl)) {
            images.push(absoluteUrl);
          }
        } catch {
          // Skip invalid URLs
        }
      }
    });

  return {
    title,
    description: description.substring(0, 2000),
    images: images.slice(0, 10),
    price: null,
    reviews: [],
  };
}

// ---------------------------------------------------------------------------
// Image upload helper
// ---------------------------------------------------------------------------

async function uploadProductImages(
  imageUrls: string[],
  orgId: string,
  productId: string
): Promise<string[]> {
  const uploadedUrls: string[] = [];

  for (let i = 0; i < imageUrls.length; i++) {
    try {
      const response = await fetch(imageUrls[i]!);
      if (!response.ok) continue;

      const contentType = response.headers.get("content-type") ?? "image/jpeg";
      const buffer = Buffer.from(await response.arrayBuffer());

      const ext = contentType.includes("png") ? "png" : "jpg";
      const key = `orgs/${orgId}/products/${productId}/${uuidv4()}.${ext}`;

      const url = await uploadToR2(key, buffer, contentType);
      uploadedUrls.push(url);
    } catch (err) {
      console.warn(`Failed to upload image ${i}: ${imageUrls[i]}`, err);
    }
  }

  return uploadedUrls;
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processScraperJob(job: { data: ScraperJobData }) {
  const { productUrl, productId, orgId } = job.data;

  console.log(`[scraper] Starting scrape for product ${productId}: ${productUrl || "(no URL)"}`);

  try {
    // If no product URL, skip scraping and use existing product data from DB
    if (!productUrl) {
      console.log(`[scraper] No product URL — skipping scrape, using existing product data`);
      return;
    }

    // Try Firecrawl first, fall back to cheerio
    let scrapedData: ScrapedProductData;

    try {
      scrapedData = await scrapeWithFirecrawl(productUrl);
      console.log(`[scraper] Firecrawl succeeded for ${productUrl}`);
    } catch (firecrawlError) {
      console.warn(
        `[scraper] Firecrawl failed, falling back to cheerio:`,
        firecrawlError
      );
      scrapedData = await scrapeWithCheerio(productUrl);
      console.log(`[scraper] Cheerio fallback succeeded for ${productUrl}`);
    }

    // Upload product images to R2
    let uploadedImages: string[] = [];
    if (scrapedData.images.length > 0) {
      uploadedImages = await uploadProductImages(
        scrapedData.images,
        orgId,
        productId
      );
      console.log(`[scraper] Uploaded ${uploadedImages.length} images to R2`);
    }

    // Update Product record in DB
    await prisma.product.update({
      where: { id: productId },
      data: {
        name: scrapedData.title,
        description: scrapedData.description,
        price: scrapedData.price,
        images: uploadedImages,
        reviews: scrapedData.reviews,
        scrapedData: {
          title: scrapedData.title,
          description: scrapedData.description,
          originalImages: scrapedData.images,
          uploadedImages,
          price: scrapedData.price,
          reviews: scrapedData.reviews,
          scrapedAt: new Date().toISOString(),
          source: productUrl,
        },
      },
    });

    console.log(`[scraper] Product ${productId} updated successfully`);

    return {
      productId,
      title: scrapedData.title,
      description: scrapedData.description,
      images: uploadedImages,
      price: scrapedData.price,
      reviews: scrapedData.reviews,
    };
  } catch (error) {
    console.error(`[scraper] Failed to scrape ${productUrl}:`, error);
    throw error;
  }
}
