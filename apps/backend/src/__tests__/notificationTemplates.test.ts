// Guards module 2.11's requirement 4: every event PRD §12.45 lists must
// have a corresponding notification template/handler registered. Iterates
// PRD_NOTIFICATION_EVENTS (transcribed from the PRD's own bullet list) so a
// future PRD event added without a matching template fails CI instead of
// silently shipping unnotified.

import { NOTIFICATION_TEMPLATES, PRD_NOTIFICATION_EVENTS } from '../domain/notificationTemplates';
import { NOTIFICATION_TYPES, NOTIFICATION_PREFERENCE_CATEGORIES } from '../domain/constants';

describe('PRD §12.45 notification event coverage', () => {
  it.each(PRD_NOTIFICATION_EVENTS)('%s has a registered template', (event) => {
    const template = NOTIFICATION_TEMPLATES[event];
    expect(template).toBeDefined();
    expect(typeof template.title).toBe('function');
    expect(typeof template.body).toBe('function');
  });

  it('every PRD event is a valid notifications.notification_type value', () => {
    for (const event of PRD_NOTIFICATION_EVENTS) {
      expect(NOTIFICATION_TYPES).toContain(event);
    }
  });

  it('every registered template maps to one of the four Notification Settings categories', () => {
    for (const event of Object.keys(
      NOTIFICATION_TEMPLATES,
    ) as (keyof typeof NOTIFICATION_TEMPLATES)[]) {
      expect(NOTIFICATION_PREFERENCE_CATEGORIES).toContain(NOTIFICATION_TEMPLATES[event].category);
    }
  });

  it('PRD_NOTIFICATION_EVENTS has no duplicates', () => {
    expect(new Set(PRD_NOTIFICATION_EVENTS).size).toBe(PRD_NOTIFICATION_EVENTS.length);
  });

  it('has exactly the 13 events PRD §12.45 lists', () => {
    expect(PRD_NOTIFICATION_EVENTS).toHaveLength(13);
  });
});

describe('template rendering', () => {
  it('MATCH_RESULT renders both the match name and the result summary into the body', () => {
    const body = NOTIFICATION_TEMPLATES.MATCH_RESULT.body({
      matchName: 'Sunday Bash',
      resultSummary: 'Team A won by 20 runs',
    });
    expect(body).toContain('Sunday Bash');
    expect(body).toContain('Team A won by 20 runs');
  });

  it('RATING_UPDATE renders the new rating into the body', () => {
    const body = NOTIFICATION_TEMPLATES.RATING_UPDATE.body({ newRating: '540' });
    expect(body).toContain('540');
  });
});
