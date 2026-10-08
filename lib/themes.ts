// One theme per day gives people a reason to come back and post again tomorrow.
const THEMES = [
  "Subway sightings",
  "Dining hall reviews",
  "Bodega cats",
  "Dorm room reality",
  "Weekend in the city",
  "Butler at 2am",
  "NYC weather is unwell",
  "Tourist or local?",
  "Midwest vs. New York",
  "Campus wildlife",
  "Rent is due",
  "Main character moment",
  "Overpriced coffee",
  "Things you only see in NYC",
];

// Days are counted in New York time so the theme flips at local midnight.
export function nyDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(date);
}

export function themeForDate(date = new Date()) {
  const [y, m, d] = nyDateKey(date).split("-").map(Number);
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return THEMES[dayNumber % THEMES.length];
}
