export const orderStatusLabel: Record<string, string> = {
  awaiting_deposit: "Awaiting e-Transfer",
  deposit_partial: "Deposit partial",
  deposit_received: "Deposit received",
  ready_for_pickup: "Ready for pickup",
  completed: "Picked up",
  cancelled: "Cancelled",
  on_terms: "On terms",
};

export const termsLabel: Record<string, string> = {
  deposit: "Deposit",
  net_15: "Net 15",
  net_30: "Net 30",
};

export const roleLabel: Record<string, string> = {
  popup_customer: "Pop-up collector",
  wholesale_applicant: "Wholesale applicant",
  wholesale_buyer: "Wholesale buyer",
  admin: "Admin",
};
