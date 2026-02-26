import { z } from "zod";
import { subOrderStatuses } from "./suborder.types";

export const updateSubOrderStatusSchema = z.object({
  status: z.enum(subOrderStatuses),
  reason: z.string().optional(),
});

export type UpdateSubOrderStatusDTO = z.infer<typeof updateSubOrderStatusSchema>;

export interface UpdateSubOrderResponseDTO {
  sub_order_id: string;
  old_status: string;
  new_status: string;
  updated_at: string;
}
