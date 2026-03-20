export interface ScrapedSlot {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  available: boolean;
  courtLabel?: string;
  totalCourts?: number;
  rawData?: Record<string, unknown>;
}

export interface ScrapeResult {
  slots: ScrapedSlot[];
  adapter: string;
  durationMs: number;
  error?: string;
}

export interface CourtAdapter {
  name: string;
  scrape(courtId: string, bookingUrl: string, metadata?: Record<string, unknown>): Promise<ScrapeResult>;
}
