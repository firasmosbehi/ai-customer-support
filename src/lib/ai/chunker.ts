import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { load } from "cheerio";
import robotsParser from "robots-parser";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { withRetry } from "@/lib/ai/retry";

export type IngestSourceType = "pdf" | "docx" | "csv" | "url" | "text" | "faq";

export interface ChunkedDocument {
  content: string;
  tokenCount: number;
  metadata: Record<string, unknown>;
}

export interface CrawlResult {
  content: string;
  pagesCrawled: number;
  pagesWithContent: number;
  visitedUrls: string[];
  skipped: {
    disallowedByRobots: number;
    invalidOrDuplicate: number;
    nonHtml: number;
    fetchFailed: number;
    lowValue: number;
    oversized: number;
    pathRule: number;
  };
  crawlDelayMs: number;
  truncated: boolean;
  totalCharacters: number;
}

export interface CrawlOptions {
  allowedPathPrefixes?: string[];
  disallowedPathPrefixes?: string[];
  shouldStop?: () => Promise<boolean>;
}

const DEFAULT_CHUNK_SIZE = 4000;
const DEFAULT_CHUNK_OVERLAP = 800;
const MAX_HTML_BYTES = 1_500_000;
const MAX_TOTAL_CRAWLED_CHARS = 300_000;
const MIN_MEANINGFUL_CHARS = 200;
const MAX_LINKS_PER_PAGE = 100;
const MAX_QUEUE_SIZE = 300;

const TRACKING_QUERY_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "msclkid",
] as const;

const BINARY_ASSET_PATTERN = /\.(?:jpg|jpeg|png|gif|webp|svg|ico|pdf|zip|rar|mp3|mp4|avi|mov|woff2?|ttf|eot)$/i;

/**
 * Normalizes whitespace and strips zero-width characters from extracted text.
 */
export const cleanText = (value: string): string => {
  return value
    .replace(/\u200B/g, "")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[\t ]{2,}/g, " ")
    .trim();
};

/**
 * Provides a coarse token estimate for storage and analytics.
 */
export const estimateTokenCount = (value: string): number => {
  return Math.max(1, Math.ceil(value.length / 4));
};

/**
 * Splits content into overlapping chunks for embedding and retrieval.
 */
export const chunkDocumentContent = async (
  content: string,
  sourceType: IngestSourceType,
  metadata: Record<string, unknown> = {}
): Promise<ChunkedDocument[]> => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: DEFAULT_CHUNK_SIZE,
    chunkOverlap: DEFAULT_CHUNK_OVERLAP,
    separators: ["\n\n", "\n", ". ", " ", ""],
  });

  const normalized = cleanText(content);
  const pieces = await splitter.splitText(normalized);

  return pieces
    .map((piece, index) => {
      const text = cleanText(piece);

      return {
        content: text,
        tokenCount: estimateTokenCount(text),
        metadata: {
          ...metadata,
          sourceType,
          chunkIndex: index,
        },
      } satisfies ChunkedDocument;
    })
    .filter((chunk) => chunk.content.length > 0);
};

/**
 * Extracts text from supported document uploads (PDF, DOCX, CSV, TXT).
 */
export const extractTextFromUploadedFile = async (file: File): Promise<string> => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "kb-upload-"));
  const filePath = path.join(tempDirectory, file.name);

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, fileBuffer);

    const extension = path.extname(file.name).toLowerCase();

    if (extension === ".pdf") {
      const { PDFLoader } = await import("@langchain/community/document_loaders/fs/pdf");
      const loader = new PDFLoader(filePath, {
        parsedItemSeparator: " ",
      });
      const documents = await loader.load();
      return cleanText(documents.map((doc) => doc.pageContent).join("\n\n"));
    }

    if (extension === ".docx") {
      const { DocxLoader } = await import("@langchain/community/document_loaders/fs/docx");
      const loader = new DocxLoader(filePath);
      const documents = await loader.load();
      return cleanText(documents.map((doc) => doc.pageContent).join("\n\n"));
    }

    if (extension === ".csv") {
      const { CSVLoader } = await import("@langchain/community/document_loaders/fs/csv");
      const loader = new CSVLoader(filePath);
      const documents = await loader.load();
      return cleanText(documents.map((doc) => doc.pageContent).join("\n\n"));
    }

    if (extension === ".txt") {
      const text = await readFile(filePath, "utf8");
      return cleanText(text);
    }

    throw new Error(`Unsupported file extension: ${extension}`);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
};

const extractContentFromHtml = (html: string): string => {
  const $ = load(html);

  $("script,style,noscript,nav,footer,header,aside,form,svg").remove();

  const rootText = $("main").text() || $("article").text() || $("body").text();
  return cleanText(rootText);
};

const isMeaningfulContent = (content: string): boolean => {
  if (content.length < MIN_MEANINGFUL_CHARS) {
    return false;
  }

  const words = content.split(/\s+/).filter(Boolean);
  return words.length >= 40;
};

const normalizePathPrefix = (value: string): string => {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return "/";
  }

  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
};

const isPathAllowed = (
  pathname: string,
  allowedPathPrefixes: string[],
  disallowedPathPrefixes: string[]
): boolean => {
  if (disallowedPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return false;
  }

  if (allowedPathPrefixes.length === 0) {
    return true;
  }

  return allowedPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
};

const normalizeCrawlUrl = (input: string, currentUrl?: string): string | null => {
  try {
    const url = new URL(input, currentUrl);

    if (!/^https?:$/.test(url.protocol)) {
      return null;
    }

    if (BINARY_ASSET_PATTERN.test(url.pathname)) {
      return null;
    }

    TRACKING_QUERY_KEYS.forEach((key) => {
      url.searchParams.delete(key);
    });

    url.hash = "";

    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    return url.toString();
  } catch {
    return null;
  }
};

const findSameOriginLinks = (
  html: string,
  currentUrl: string,
  origin: string,
  allowedPathPrefixes: string[],
  disallowedPathPrefixes: string[]
): string[] => {
  const $ = load(html);
  const links = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");

    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
      return;
    }

    const normalized = normalizeCrawlUrl(href, currentUrl);

    if (!normalized) {
      return;
    }

    const parsed = new URL(normalized);

    if (parsed.origin === origin && isPathAllowed(parsed.pathname, allowedPathPrefixes, disallowedPathPrefixes)) {
      links.add(normalized);
    }
  });

  return Array.from(links).slice(0, MAX_LINKS_PER_PAGE);
};

const getRobotsCrawlDelayMs = (robots: ReturnType<typeof robotsParser>, userAgent: string): number => {
  const parser = robots as ReturnType<typeof robotsParser> & {
    getCrawlDelay?: (agent: string) => number | undefined;
  };

  const delaySeconds = parser.getCrawlDelay?.(userAgent);

  if (typeof delaySeconds !== "number" || !Number.isFinite(delaySeconds) || delaySeconds <= 0) {
    return 0;
  }

  return Math.min(3000, Math.floor(delaySeconds * 1000));
};

/**
 * Crawls up to maxPages URLs on one domain and returns concatenated content.
 */
export const crawlWebsiteForContent = async (
  startUrl: string,
  maxPages = 50,
  userAgent = "SupportPilotBot/1.0",
  options: CrawlOptions = {}
): Promise<CrawlResult> => {
  const normalizedStart = normalizeCrawlUrl(startUrl);

  if (!normalizedStart) {
    throw new Error("Invalid start URL for crawling");
  }

  const parsedStart = new URL(normalizedStart);
  const origin = parsedStart.origin;
  const allowedPathPrefixes = (options.allowedPathPrefixes ?? [])
    .map(normalizePathPrefix)
    .filter((value) => value.length > 0);
  const disallowedPathPrefixes = (options.disallowedPathPrefixes ?? [])
    .map(normalizePathPrefix)
    .filter((value) => value.length > 0);

  if (!isPathAllowed(parsedStart.pathname, allowedPathPrefixes, disallowedPathPrefixes)) {
    throw new Error("Start URL path is not allowed by the configured crawl rules");
  }

  let robots = robotsParser(`${origin}/robots.txt`, "");

  try {
    const robotsResponse = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(10000),
    });

    if (robotsResponse.ok) {
      const robotsText = await robotsResponse.text();
      robots = robotsParser(`${origin}/robots.txt`, robotsText);
    }
  } catch {
    // Proceed when robots.txt is unavailable.
  }

  const crawlDelayMs = getRobotsCrawlDelayMs(robots, userAgent);

  const queue: string[] = [normalizedStart];
  const enqueued = new Set<string>([normalizedStart]);
  const visited = new Set<string>();
  const collected: string[] = [];

  const skipped = {
    disallowedByRobots: 0,
    invalidOrDuplicate: 0,
    nonHtml: 0,
    fetchFailed: 0,
    lowValue: 0,
    oversized: 0,
    pathRule: 0,
  };

  let pagesWithContent = 0;
  let totalCharacters = 0;
  let truncated = false;

  while (queue.length > 0 && visited.size < maxPages && !truncated) {
    if (options.shouldStop && (await options.shouldStop())) {
      throw new Error("Ingestion cancelled by user");
    }

    const current = queue.shift();

    if (!current || visited.has(current)) {
      skipped.invalidOrDuplicate += 1;
      continue;
    }

    const currentUrl = new URL(current);

    if (!isPathAllowed(currentUrl.pathname, allowedPathPrefixes, disallowedPathPrefixes)) {
      skipped.pathRule += 1;
      continue;
    }

    if (!robots.isAllowed(current, userAgent)) {
      skipped.disallowedByRobots += 1;
      continue;
    }

    visited.add(current);

    if (crawlDelayMs > 0 && visited.size > 1) {
      await new Promise((resolve) => setTimeout(resolve, crawlDelayMs));
    }

    try {
      const response = await withRetry(
        async () => {
          const result = await fetch(current, {
            headers: { "User-Agent": userAgent },
            signal: AbortSignal.timeout(12000),
          });

          if (!result.ok) {
            throw new Error(`Crawl fetch failed with status ${result.status}`);
          }

          return result;
        },
        {
          retries: 2,
          shouldRetry: (error) => {
            if (!(error instanceof Error)) {
              return true;
            }

            return !error.message.includes("status 4");
          },
        }
      );

      const finalUrl = normalizeCrawlUrl(response.url);

      if (!finalUrl || new URL(finalUrl).origin !== origin) {
        skipped.nonHtml += 1;
        continue;
      }

      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.includes("text/html")) {
        skipped.nonHtml += 1;
        continue;
      }

      const contentLengthHeader = response.headers.get("content-length");
      const contentLength = contentLengthHeader ? Number(contentLengthHeader) : 0;

      if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
        skipped.oversized += 1;
        continue;
      }

      const html = await response.text();

      if (html.length > MAX_HTML_BYTES) {
        skipped.oversized += 1;
        continue;
      }

      const content = extractContentFromHtml(html);

      if (!isMeaningfulContent(content)) {
        skipped.lowValue += 1;
      } else {
        const segment = `URL: ${current}\n${content}`;

        if (totalCharacters + segment.length > MAX_TOTAL_CRAWLED_CHARS) {
          const remaining = Math.max(0, MAX_TOTAL_CRAWLED_CHARS - totalCharacters);

          if (remaining > 0) {
            collected.push(segment.slice(0, remaining));
            totalCharacters += remaining;
          }

          truncated = true;
        } else {
          collected.push(segment);
          totalCharacters += segment.length;
        }

        pagesWithContent += 1;
      }

      const links = findSameOriginLinks(html, current, origin, allowedPathPrefixes, disallowedPathPrefixes);

      links.forEach((link) => {
        if (visited.has(link) || enqueued.has(link) || queue.length >= MAX_QUEUE_SIZE) {
          return;
        }

        enqueued.add(link);
        queue.push(link);
      });
    } catch {
      skipped.fetchFailed += 1;
    }
  }

  return {
    content: cleanText(collected.join("\n\n")),
    pagesCrawled: visited.size,
    pagesWithContent,
    visitedUrls: Array.from(visited),
    skipped,
    crawlDelayMs,
    truncated,
    totalCharacters,
  };
};
