-- CreateTable
CREATE TABLE "courts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "booking_system" TEXT NOT NULL,
    "booking_url" TEXT NOT NULL,
    "venue_id" TEXT,
    "location" TEXT,
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_snapshots" (
    "id" TEXT NOT NULL,
    "court_id" TEXT NOT NULL,
    "scraped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "court_label" TEXT,
    "total_courts" INTEGER,
    "raw_data" JSONB,

    CONSTRAINT "slot_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "court_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "days_of_week" INTEGER[],
    "time_from" TEXT,
    "time_to" TEXT,
    "date_from" TEXT,
    "date_to" TEXT,
    "check_interval_min" INTEGER NOT NULL DEFAULT 30,
    "last_checked_at" TIMESTAMP(3),
    "notify_channel" TEXT NOT NULL DEFAULT 'telegram',
    "notify_target" TEXT,
    "cooldown_min" INTEGER NOT NULL DEFAULT 60,
    "last_notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "monitor_id" TEXT NOT NULL,
    "slot_date" TEXT NOT NULL,
    "slot_time" TEXT NOT NULL,
    "court_label" TEXT,
    "message" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL DEFAULT 'telegram',
    "delivered" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrape_logs" (
    "id" TEXT NOT NULL,
    "court_id" TEXT,
    "adapter" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "slots_found" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scrape_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courts_slug_key" ON "courts"("slug");

-- CreateIndex
CREATE INDEX "slot_snapshots_court_id_date_idx" ON "slot_snapshots"("court_id", "date");

-- CreateIndex
CREATE INDEX "slot_snapshots_scraped_at_idx" ON "slot_snapshots"("scraped_at");

-- CreateIndex
CREATE INDEX "alerts_monitor_id_idx" ON "alerts"("monitor_id");

-- CreateIndex
CREATE INDEX "alerts_sent_at_idx" ON "alerts"("sent_at");

-- CreateIndex
CREATE INDEX "scrape_logs_created_at_idx" ON "scrape_logs"("created_at");

-- AddForeignKey
ALTER TABLE "slot_snapshots" ADD CONSTRAINT "slot_snapshots_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrape_logs" ADD CONSTRAINT "scrape_logs_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
