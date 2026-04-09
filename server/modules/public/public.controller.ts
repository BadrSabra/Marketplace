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

      const formattedStores = allStores.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
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
      const [store] = await db
        .select({ id: stores.id, name: stores.name, description: stores.description, imageUrl: stores.imageUrl, createdAt: stores.createdAt, ownerId: stores.ownerId })
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
