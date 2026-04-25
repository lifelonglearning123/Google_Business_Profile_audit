import type { GbpData, ScoreCard, SubScore } from "./types";

/**
 * Rule-based scoring for a Google Business Profile. Each sub-score is 0-100.
 * Weights sum to 100 for the overall weighted average.
 *
 * Thresholds are based on commonly-cited local SEO benchmarks — tune to taste.
 */
export function scoreGbp(gbp: GbpData): ScoreCard {
  const subScores: SubScore[] = [
    scoreCompleteness(gbp),
    scoreReviews(gbp),
    scoreResponseRate(gbp),
    scoreCategoriesAndServices(gbp),
    scorePhotos(gbp),
    scoreEngagement(gbp),
  ];

  const totalWeight = subScores.reduce((s, x) => s + x.weight, 0);
  const overall = Math.round(
    subScores.reduce((s, x) => s + x.score * x.weight, 0) / totalWeight
  );

  return {
    overall,
    grade: grade(overall),
    subScores,
  };
}

function grade(n: number): ScoreCard["grade"] {
  if (n >= 90) return "A";
  if (n >= 75) return "B";
  if (n >= 60) return "C";
  if (n >= 45) return "D";
  return "F";
}

function scoreCompleteness(gbp: GbpData): SubScore {
  const findings: string[] = [];
  const checks: Array<[boolean, string, number]> = [
    [!!gbp.name, "Business name present", 10],
    [!!gbp.address, "Address listed", 15],
    [!!gbp.phone, "Phone number listed", 15],
    [!!gbp.website, "Website linked", 15],
    [!!gbp.hours, "Opening hours set", 15],
    [!!gbp.description && gbp.description.length > 100, "Has a meaningful description (100+ chars)", 15],
    [(gbp.categories?.length ?? 0) > 0, "Primary category set", 15],
  ];

  let earned = 0;
  let total = 0;
  for (const [ok, label, weight] of checks) {
    total += weight;
    if (ok) earned += weight;
    else findings.push(`Missing: ${label}`);
  }

  if (findings.length === 0) findings.push("Profile basics are fully filled in.");

  return {
    key: "completeness",
    label: "Profile Completeness",
    score: Math.round((earned / total) * 100),
    weight: 25,
    findings,
  };
}

function scoreReviews(gbp: GbpData): SubScore {
  const findings: string[] = [];
  const count = gbp.reviewCount ?? 0;
  const rating = gbp.rating ?? 0;

  let volumeScore = 0;
  if (count >= 200) volumeScore = 100;
  else if (count >= 100) volumeScore = 85;
  else if (count >= 50) volumeScore = 70;
  else if (count >= 25) volumeScore = 55;
  else if (count >= 10) volumeScore = 40;
  else if (count >= 1) volumeScore = 20;
  else volumeScore = 0;

  let ratingScore = 0;
  if (rating >= 4.8) ratingScore = 100;
  else if (rating >= 4.6) ratingScore = 90;
  else if (rating >= 4.3) ratingScore = 75;
  else if (rating >= 4.0) ratingScore = 60;
  else if (rating >= 3.5) ratingScore = 40;
  else if (rating > 0) ratingScore = 20;

  const score = Math.round(volumeScore * 0.5 + ratingScore * 0.5);

  if (count < 25) findings.push(`Only ${count} reviews — target 25+ to build trust.`);
  else findings.push(`${count} total reviews.`);

  if (rating === 0) findings.push("No star rating visible.");
  else if (rating < 4.3) findings.push(`Average rating ${rating.toFixed(1)} — aim for 4.5+.`);
  else findings.push(`Strong average rating: ${rating.toFixed(1)}.`);

  // Recency
  const recent = countRecentReviews(gbp, 90);
  if (recent === 0 && count > 0) {
    findings.push("No reviews in the last 90 days — review velocity has stalled.");
  } else if (recent > 0) {
    findings.push(`${recent} reviews in the last 90 days.`);
  }

  return { key: "reviews", label: "Reviews (Volume & Rating)", score, weight: 25, findings };
}

function scoreResponseRate(gbp: GbpData): SubScore {
  const findings: string[] = [];
  const sample = gbp.reviews ?? [];

  if (sample.length === 0) {
    return {
      key: "responses",
      label: "Owner Responses",
      score: 0,
      weight: 10,
      findings: ["No reviews available to measure response rate."],
    };
  }

  const responded = sample.filter((r) => !!r.ownerResponse).length;
  const pct = Math.round((responded / sample.length) * 100);

  let score = 0;
  if (pct >= 90) score = 100;
  else if (pct >= 70) score = 85;
  else if (pct >= 50) score = 65;
  else if (pct >= 25) score = 45;
  else if (pct >= 10) score = 25;
  else score = 10;

  findings.push(`Owner responded to ${pct}% of the last ${sample.length} reviews.`);
  const negativeUnanswered = sample.filter(
    (r) => r.rating && r.rating <= 3 && !r.ownerResponse
  ).length;
  if (negativeUnanswered > 0) {
    findings.push(
      `${negativeUnanswered} negative review(s) have no owner response — highest priority to address.`
    );
  }

  return { key: "responses", label: "Owner Responses", score, weight: 15, findings };
}

function scoreCategoriesAndServices(gbp: GbpData): SubScore {
  const findings: string[] = [];
  const cats = gbp.categories?.length ?? 0;
  const svcs = gbp.services?.length ?? 0;

  let score = 0;
  if (cats >= 1) score += 40;
  if (cats >= 3) score += 20;
  if (svcs >= 3) score += 20;
  if (svcs >= 8) score += 20;

  if (cats === 0) findings.push("No categories set — critical for local ranking.");
  else if (cats === 1) findings.push("Only a primary category — add 1-2 secondary categories.");
  else findings.push(`${cats} categories in use.`);

  if (svcs === 0) findings.push("No services listed — services drive keyword relevance.");
  else findings.push(`${svcs} services listed.`);

  return {
    key: "categories",
    label: "Categories & Services",
    score: Math.min(100, score),
    weight: 15,
    findings,
  };
}

function scorePhotos(gbp: GbpData): SubScore {
  const findings: string[] = [];
  const photos = gbp.photoCount ?? 0;

  let score = 0;
  if (photos >= 100) score = 100;
  else if (photos >= 50) score = 85;
  else if (photos >= 25) score = 70;
  else if (photos >= 10) score = 50;
  else if (photos >= 1) score = 25;

  if (photos === 0) {
    findings.push("No photos detected — profiles with photos get more calls.");
  } else {
    findings.push(`${photos} photos on the profile.`);
    if (photos < 25) findings.push("Aim for 25+ photos covering exterior, interior, team, and work.");
  }

  return { key: "photos", label: "Photos", score, weight: 10, findings };
}

function scoreEngagement(gbp: GbpData): SubScore {
  const findings: string[] = [];
  const posts = gbp.posts?.length ?? 0;
  const qa = gbp.questions?.length ?? 0;

  let score = 0;
  if (posts >= 4) score += 50;
  else if (posts >= 1) score += 25;
  if (qa >= 5) score += 50;
  else if (qa >= 1) score += 25;

  if (posts === 0) findings.push("No recent Google Posts — weekly posts signal an active business.");
  else findings.push(`${posts} recent posts detected.`);

  if (qa === 0) findings.push("No Q&A activity — seed your own FAQs to improve relevance.");

  return {
    key: "engagement",
    label: "Posts & Q&A",
    score: Math.min(100, score),
    weight: 10,
    findings,
  };
}

function countRecentReviews(gbp: GbpData, days: number): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  let n = 0;
  for (const r of gbp.reviews ?? []) {
    if (!r.date) continue;
    // SerpAPI returns relative strings like "2 weeks ago" — best-effort parse.
    const ts = parseRelativeDate(r.date);
    if (ts && ts >= cutoff) n++;
  }
  return n;
}

function parseRelativeDate(s: string): number | null {
  const now = Date.now();
  const m = s.toLowerCase().match(/(\d+)\s+(hour|day|week|month|year)s?\s+ago/);
  if (!m) {
    if (/^a\s+(day|week|month|year)\s+ago/.test(s)) return now - 1 * unit(RegExp.$1);
    return null;
  }
  const n = parseInt(m[1], 10);
  return now - n * unit(m[2]);
}

function unit(u: string): number {
  const d = 24 * 60 * 60 * 1000;
  switch (u) {
    case "hour": return 60 * 60 * 1000;
    case "day": return d;
    case "week": return 7 * d;
    case "month": return 30 * d;
    case "year": return 365 * d;
  }
  return d;
}
