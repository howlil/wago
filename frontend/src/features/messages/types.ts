export type LastMessage = {
  id: string;
  status: "pending" | "accepted" | "delivered" | "read" | "rejected";
};
