-- Daily screener flag log (for the track record) and users' saved screens (alerts/digest).
CREATE TABLE "flag_log" (
    "date" DATE NOT NULL,
    "cardId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "basis" TEXT,
    "priceCents" INTEGER NOT NULL,
    "trendPct" DOUBLE PRECISION,

    CONSTRAINT "flag_log_pkey" PRIMARY KEY ("date","cardId","tag")
);

CREATE INDEX "flag_log_date_idx" ON "flag_log"("date");

CREATE TABLE "saved_screens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT false,
    "lastMatchIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastEmailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_screens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "saved_screens_userId_idx" ON "saved_screens"("userId");
