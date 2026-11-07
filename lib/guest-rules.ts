// Guest-mode rules shown in the UI too, so this file must not import server-only code.

/** How many presentations a guest (no email yet) can have at once. */
export const GUEST_PRESENTATION_LIMIT = 3;
/** Guest presentations, guest codes and guest accounts last this long; a daily job then deletes them for good. */
export const GUEST_DAYS = 7;
