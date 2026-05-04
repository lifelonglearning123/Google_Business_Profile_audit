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
    scoreWebsite(gbp),
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
  // Hard signals (binary present / not present). The "Website linked"
  // sub-check used to live here but moved to the dedicated Website pillar.
  const checks: Array<[boolean, string, number]> = [
    [!!gbp.name, "Business name present", 10],
    [!!gbp.address, "Address listed", 15],
    [!!gbp.phone, "Phone number listed", 15],
    [!!gbp.hours, "Opening hours set", 15],
    [(gbp.categories?.length ?? 0) > 0, "Primary category set", 15],
  ];

  let earned = 0;
  let total = 0;
  for (const [ok, label, weight] of checks) {
    total += weight;
    if (ok) earned += weight;
    else findings.push(`Missing: ${label}`);
  }

  // ── Description sub-score ──
  // Public data sources (SerpAPI, Apify, Google Places) only expose Google's
  // editorial tagline — not the owner-written "About" blurb. To avoid
  // falsely accusing every owner of having no description, we score on a
  // tri-state that combines the GBP description (when present) with the
  // website's own meta/hero copy (a more reliable proxy for "does this
  // business communicate clearly?").
  const gbpDesc = gbp.description?.trim() ?? "";
  const webDesc = gbp.websiteDescription?.trim() ?? "";
  const descWeight = 10;
  total += descWeight;

  if (gbpDesc.length >= 100) {
    earned += descWeight;
    findings.push(`Description present on the profile (${gbpDesc.length} chars).`);
  } else if (gbpDesc.length > 0) {
    earned += Math.round(descWeight * 0.6);
    findings.push(
      `Short description on the profile (${gbpDesc.length} chars) — aim for 250+.`
    );
  } else if (webDesc.length >= 80) {
    // Website-derived signal — not as good as a real GBP description but
    // shows the business does communicate clearly somewhere.
    earned += Math.round(descWeight * 0.5);
    findings.push(
      "No description visible on the profile, but the website explains the business clearly."
    );
  } else {
    // Only zero credit when BOTH are missing.
    findings.push(
      "No description detected on the profile or website — add a 250+ word \"About\" blurb in your GBP dashboard."
    );
  }

  if (
    findings.filter((f) => f.startsWith("Missing:") || f.startsWith("No description")).length === 0
  ) {
    findings.unshift("Profile basics are fully filled in.");
  }

  return {
    key: "completeness",
    label: "Profile Completeness",
    score: Math.round((earned / total) * 100),
    weight: 20,
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

  // 4 thresholds summing to 75 internal weight, scaled to 100. Category-page
  // coverage used to add another 25 here but moved to the Website pillar.
  let earned = 0;
  if (cats >= 1) earned += 30;
  if (cats >= 3) earned += 15;
  if (svcs >= 3) earned += 15;
  if (svcs >= 8) earned += 15;
  const total = 75;

  if (cats === 0) findings.push("No categories set — critical for local ranking.");
  else if (cats === 1) findings.push("Only a primary category — add 1-2 secondary categories.");
  else findings.push(`${cats} categories in use.`);

  if (svcs === 0) findings.push("No services listed — services drive keyword relevance.");
  else findings.push(`${svcs} services listed.`);

  return {
    key: "categories",
    label: "Categories & Services",
    score: Math.round((earned / total) * 100),
    weight: 10,
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
  // Posts and Q&A aren't sourced today (SerpAPI's place_results doesn't
  // expose them). When both are undefined, return a neutral 50 so this
  // pillar doesn't unfairly drag the overall score. When data is present
  // (future), the normal bucketed scoring kicks in.
  const measured = gbp.posts !== undefined || gbp.questions !== undefined;
  if (!measured) {
    return {
      key: "engagement",
      label: "Posts & Q&A",
      score: 50,
      weight: 5,
      findings: ["Posts and Q&A activity aren't measured in this report."],
    };
  }

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
    weight: 5,
    findings,
  };
}

function scoreWebsite(gbp: GbpData): SubScore {
  const findings: string[] = [];

  // Short-circuit: no website on the GBP at all → pillar = 0. Owner needs
  // to add a website URL in their dashboard before any other sub-check
  // becomes meaningful.
  if (!gbp.website) {
    return {
      key: "website",
      label: "Website",
      score: 0,
      weight: 15,
      findings: [
        "No website linked on the profile — add one in your GBP dashboard. Websites are a top local-SEO signal.",
      ],
    };
  }

  // Build the score on a dynamic total so the owner isn't punished for our
  // own fetch failures or for not having categories set yet.
  let earned = 30; // "Website linked" passes
  let total = 30;
  findings.push("Website is linked on the profile.");

  const sigs = gbp.websiteSignals;
  if (sigs) {
    total += 15;
    if (sigs.reachable) {
      earned += 15;
    } else {
      findings.push(
        "Website didn't respond to a fetch — check the URL is alive and not parked or blocking bots."
      );
    }

    total += 10;
    if (sigs.https) {
      // Site itself is secure. Full credit even when the GBP-listed URL
      // is http://, since the redirect upgrades visitors automatically —
      // updating the listing is a one-click dashboard fix, not a points
      // hit. Still emit a low-severity finding so the owner sees it.
      earned += 10;
      if (sigs.listedAsHttp) {
        findings.push(
          "Your GBP lists the website as http:// but it redirects to https:// — update the URL field in your GBP dashboard so customers skip the redirect and don't see a brief 'Not Secure' flash."
        );
      }
    } else {
      findings.push(
        "Website doesn't use HTTPS — switch to a secure (https://) URL; Google ranks secure sites higher."
      );
    }
  }

  const cov = gbp.categoryPageMatches;
  if (cov && cov.total > 0) {
    total += 45;
    const ratio = cov.matched.length / cov.total;
    let coverageEarned = 0;
    if (ratio >= 0.8) coverageEarned = 45;
    else if (ratio >= 0.5) coverageEarned = 27;
    else if (ratio > 0) coverageEarned = 9;
    earned += coverageEarned;

    findings.push(
      `Website page coverage: ${cov.matched.length} of ${cov.total} GBP categories have a matching page.`
    );
    if (cov.unmatched.length > 0) {
      findings.push(
        `Missing pages for: ${cov.unmatched.join(", ")} — each one is a long-tail keyword you don't show up for.`
      );
    }
  }

  return {
    key: "website",
    label: "Website",
    score: Math.round((earned / total) * 100),
    weight: 15,
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
