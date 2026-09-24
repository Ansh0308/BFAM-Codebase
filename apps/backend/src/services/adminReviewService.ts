import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { ReviewNotFoundError } from '../domain/errors';
import { writeAuditLog } from './auditLogService';

// Backlog E-5 — Reviews Management in Admin Web (PRD §9.1). Admin Web has
// no way to see or moderate reviews at all today — the only thing that
// exists is the player-facing submitReview (reviewService.ts). What's
// actually needed here: a full directory (every review, across every turf/
// player, not scoped to one turf the way a public turf-details page would
// be) and the ability to remove one — e.g. abusive review_text or an
// obviously fraudulent 1-star rating. The `reviews` table has no
// deleted_at column (nothing else ever needed to soft-delete a review), so
// removal is a real hard delete, same as any other moderation action that
// permanently strikes content.
export interface AdminReviewRow {
  review_id: string;
  match_id: string | null;
  turf_id: string;
  turf_name: string;
  player_id: string;
  player_name: string | null;
  rating: number;
  review_text: string | null;
  created_at: Date;
}

export async function listAllReviewsForAdmin(): Promise<AdminReviewRow[]> {
  return sequelize.query<AdminReviewRow>(
    `SELECT r.review_id, r.match_id, r.turf_id, t.turf_name, r.player_id,
            p.full_name AS player_name, r.rating, r.review_text, r.created_at
     FROM reviews r
     JOIN turfs t ON t.turf_id = r.turf_id
     JOIN players p ON p.player_id = r.player_id
     ORDER BY r.created_at DESC`,
    { type: QueryTypes.SELECT },
  );
}

// Recomputes turfs.average_rating from what remains, same approach
// reviewService.ts's recomputeTurfAverageRating uses at submission time —
// duplicated rather than imported since that one runs inside
// submitReview's transaction and this one doesn't need one (a single
// DELETE followed by a single recompute, no multi-table write to keep
// atomic with).
async function recomputeTurfAverageRating(turfId: string): Promise<void> {
  const [{ avgRating }] = await sequelize.query<{ avgRating: number | null }>(
    'SELECT AVG(rating) AS avgRating FROM reviews WHERE turf_id = :turfId',
    { type: QueryTypes.SELECT, replacements: { turfId } },
  );
  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'turfs',
      { average_rating: avgRating != null ? Math.round(Number(avgRating) * 100) / 100 : null },
      { turf_id: turfId },
    );
}

export async function deleteReviewAsAdmin(reviewId: string, actorUserId: string): Promise<void> {
  const [review] = await sequelize.query<{ turf_id: string; rating: number; player_id: string }>(
    'SELECT turf_id, rating, player_id FROM reviews WHERE review_id = :reviewId',
    { type: QueryTypes.SELECT, replacements: { reviewId } },
  );
  if (!review) throw new ReviewNotFoundError(reviewId);

  await sequelize.getQueryInterface().bulkDelete('reviews', { review_id: reviewId });
  await recomputeTurfAverageRating(review.turf_id);

  await writeAuditLog({
    actorUserId,
    actorRole: 'ADMIN',
    action: 'REVIEW_DELETED',
    resourceType: 'review',
    resourceId: reviewId,
    beforeData: { turf_id: review.turf_id, rating: review.rating, player_id: review.player_id },
  });
}
