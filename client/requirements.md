## Packages
framer-motion | Smooth page transitions and layout animations
date-fns | Date formatting for tables and lists
lucide-react | Beautiful consistent iconography
clsx | Utility for constructing className strings conditionally
tailwind-merge | Utility to merge tailwind classes safely

## Notes
- Custom JWT Authentication is implemented via `localStorage` and a custom fetch wrapper (`lib/api.ts`) that injects the `Authorization: Bearer <token>` header.
- The global TanStack Query setup in `App.tsx` handles query invalidation and loading states.
- Zod is used for runtime response validation mapping strictly to the `@shared/routes` API contract.
