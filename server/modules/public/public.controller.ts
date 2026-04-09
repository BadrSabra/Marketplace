import { stores, users } from "@shared/schema";
import { db } from "../../db";
import { desc, eq, and } from "drizzle-orm";

export const publicStoresController = {
  async getStores(req: any, res: any) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 12;
      const offset = (page - 1) * limit;

      const allStores = await db
        .select({
          id: stores.id,
          name: stores.name,
          description: stores.description,
          imageUrl: stores.imageUrl,
          createdAt: stores.createdAt,
        })
        .from(stores)
        .innerJoin(users, eq(stores.ownerId, users.id))
        .where(eq(users.isApproved, true))
        .orderBy(desc(stores.createdAt))
        .limit(limit)
        .offset(offset);

      // BUG-FIX: Was returning `logoUrl` but StoreCard.tsx uses `store.imageUrl`.
      // After bug fix #28 changed StoreCard from `store.logoUrl` to `store.imageUrl`,
      // the API response was never updated to match — so store images were always undefined
      // and the placeholder icon was shown for every store on the home page.
      // Fix: return `imageUrl` (matching the DB column name) so StoreCard renders correctly.
      const formattedStores = allStores.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        imageUrl: s.imageUrl || null,
        logoUrl: s.imageUrl || null,
        isOpen: true,
        createdAt: s.createdAt
      }));

      res.json(formattedStores);
    } catch (error) {
      console.error("Error fetching public stores:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  async getStore(req: any, res: any) {
    try {
      const { id } = req.params;
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_REGEX.test(id)) {
        return res.status(404).json({ message: "Store not found" });
      }
      // BUG-FIX: Was including `ownerId` in the response — this exposes the internal
      // UUID of the store owner to anonymous (unauthenticated) public visitors.
      // Removed `ownerId` from the select so only public-safe fields are returned.
      const [store] = await db
        .select({ id: stores.id, name: stores.name, description: stores.description, imageUrl: stores.imageUrl, createdAt: stores.createdAt })
        .from(stores)
        .innerJoin(users, eq(stores.ownerId, users.id))
        .where(and(eq(stores.id, id), eq(users.isApproved, true)));
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      res.json(store);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  }
};
