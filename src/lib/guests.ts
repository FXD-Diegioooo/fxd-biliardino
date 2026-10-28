import type { Player } from './domain';

// Two identities allow two guests in the same match without merging their slots.
export const GUEST_IDS = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'] as const;
export const isGuestId = (id: string) => GUEST_IDS.some(guest => guest === id);
export const guestPlayers: Player[] = GUEST_IDS.map(id => ({ id, auth_user_id: null, full_name: 'Ospite', preferred_role: 'both', avatar_path: null, banner_color: 'blue', is_guest: true }));
