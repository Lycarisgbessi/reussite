// Types boutique (côté back-office)
export interface AdminIssue {
  id: string; slug: string; title: string; issueNumber: number; description: string;
  coverUrl: string; coverLocked: boolean; previewImages: string[]; priceCfa: number; priceEur: number;
  pdfUrl: string; previewPages: number; featured: boolean; published: boolean; paidOrders: number;
  pricePrintCfa: number; pricePrintEur: number;
  releaseDate: string;
}
export interface AdminPlan {
  id: string; name: string; description: string; durationMonths: number; issuesCount: number;
  priceCfa: number; priceEur: number; perks: string[]; active: boolean;
}
export interface AdminOrder {
  id: string; orderNumber: string; type: string; item: string;
  buyerName: string; buyerEmail: string; buyerPhone: string;
  amountCfa: number; amountEur: number; currency: string;
  paymentMethod: string; paymentRef: string; status: string; createdAt: string;
  variant: string; deliveryAddress: string; deliveryCity: string; deliveryNote: string;
}
