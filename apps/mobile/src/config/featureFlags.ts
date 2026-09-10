// Backlog A-12: "Temporarily hide Turf Discovery" — a business decision,
// not a defect. BFAM is building its own turf and only wants to offer
// booking on that one turf for now, not the open multi-owner Discover
// listing (module 2.3). Flipping this back to true re-enables Discover
// with no rebuild of the underlying feature — nothing about module 2.3
// itself is touched, only these two entry points into it.
export const DISCOVERY_ENABLED = false;
