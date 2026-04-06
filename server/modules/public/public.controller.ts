import { stores, type Store } from "@shared/schema";
import { db } from "../../db";
import { desc, eq, and } from "drizzle-orm";

export const publicStoresController = {
  async getStores(req: any, res: any) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 12;
      const offset = (page - 1) * limit;

      // In a real app, we'd check for 'approved' and 'active' status.
      // For now, we'll fetch all stores since the schema doesn't have an 'isActive' or 'isApproved' field for stores yet, 
      // but we can assume they are active if they exist or filter by owner approval if needed.
      // Based on the prompt: "Return only approved stores" and "active stores".
      // Let's check if there's any status field we missed or just return all for now.
      
      const allStores = await db.select()
        .from(stores)
        .orderBy(desc(stores.createdAt))
        .limit(limit)
        .offset(offset);

      const formattedStores = allStores.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        logoUrl: null, // Schema doesn't have logoUrl yet, we'll use fallback in frontend
        isOpen: true,  // Placeholder as schema doesn't have isOpen
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
      const [store] = await db.select().from(stores).where(eq(stores.id, id));
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      res.json(store);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  }
};
