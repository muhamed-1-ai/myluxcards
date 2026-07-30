import AffiliateDashboard from "@/app/affiliate/dashboard/AffiliateDashboard";

export const metadata = {
  title: "Partner Dashboard Demo | MyLuxCards",
  description: "Explore a read-only demonstration of the MyLuxCards partner dashboard.",
};

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const clicks = Array.from({ length: 48 }, (_, index) => ({
  id: `demo-click-${index}`,
  campaign_id: index % 3 === 0 ? "campaign-instagram" : index % 3 === 1 ? "campaign-whatsapp" : "campaign-event",
  is_unique: index % 4 !== 0,
  campaign: index % 3 === 0 ? "Instagram Launch" : index % 3 === 1 ? "WhatsApp Clients" : "Exhibition QR",
  source: index % 3 === 0 ? "instagram" : index % 3 === 1 ? "whatsapp" : "event-qr",
  destination_path: index % 2 ? "/" : "/products/premium-nfc-card",
  created_at: daysAgo(index % 28),
}));
const orders = [
  { id:"order-1",order_number:"MLC-DEMO-1048",customer_name:"Aarav M.",customer_email:"a••••@example.com",status:"DELIVERED",payment_status:"SUCCEEDED",currency:"INR",subtotal_minor:199900,total_minor:199900,affiliate_campaign_id:"campaign-instagram",affiliate_source:"instagram",created_at:daysAgo(18),order_items:[{product_name:"Premium NFC Card",quantity:1}] },
  { id:"order-2",order_number:"MLC-DEMO-1059",customer_name:"Nisha R.",customer_email:"n••••@example.com",status:"DELIVERED",payment_status:"SUCCEEDED",currency:"INR",subtotal_minor:259800,total_minor:259800,affiliate_campaign_id:"campaign-whatsapp",affiliate_source:"whatsapp",created_at:daysAgo(11),order_items:[{product_name:"Matte Black PVC Card",quantity:2}] },
  { id:"order-3",order_number:"MLC-DEMO-1071",customer_name:"Kabir S.",customer_email:"k••••@example.com",status:"PROCESSING",payment_status:"SUCCEEDED",currency:"INR",subtotal_minor:149900,total_minor:149900,affiliate_campaign_id:"campaign-event",affiliate_source:"event-qr",created_at:daysAgo(4),order_items:[{product_name:"White PVC Card",quantity:1}] },
  { id:"order-4",order_number:"MLC-DEMO-1075",customer_name:"Meera P.",customer_email:"m••••@example.com",status:"PENDING",payment_status:"PENDING",currency:"INR",subtotal_minor:149900,total_minor:149900,affiliate_campaign_id:"campaign-instagram",affiliate_source:"instagram",created_at:daysAgo(1),order_items:[{product_name:"White PVC Card",quantity:1}] },
];
const commissions = [
  { id:"commission-1",order_id:"order-1",commissionable_minor:199900,commission_minor:19990,currency:"INR",status:"PAID",referral_source:"LINK",created_at:daysAgo(18) },
  { id:"commission-2",order_id:"order-2",commissionable_minor:259800,commission_minor:25980,currency:"INR",status:"APPROVED",referral_source:"COUPON",created_at:daysAgo(11) },
  { id:"commission-3",order_id:"order-3",commissionable_minor:149900,commission_minor:14990,currency:"INR",status:"PENDING",referral_source:"LINK",created_at:daysAgo(4) },
];

const demoData = {
  demo:true,
  commerceReady:true,
  appUrl:"https://myluxcards.vercel.app",
  currency:"INR",
  profile:{ id:"demo-partner",status:"APPROVED",affiliateCode:"DEMO2026",couponCode:"DEMO10",tier:"Gold",partnerType:"CREATOR",rejectionReason:null },
  settings:{ attribution_window_days:30,minimum_payout_minor:250000,holding_period_days:14,payout_schedule:"Twice monthly",program_terms_url:"/partners/terms" },
  stats:{ totalClicks:48,uniqueVisitors:36,referredCustomers:4,totalOrders:4,pendingOrders:1,confirmedOrders:1,deliveredOrders:2,cancelledOrders:0,conversionRate:8.33,referredRevenueMinor:609600,pendingCommissionMinor:14990,approvedCommissionMinor:25980,paidCommissionMinor:19990,reversedCommissionMinor:0,availablePayoutMinor:25980 },
  clicks,orders,commissions,
  campaigns:[
    {id:"campaign-instagram",name:"Instagram Launch",source:"instagram",destination_path:"/products/premium-nfc-card",active:true,clicks:18,uniqueVisitors:14,conversions:2,revenueMinor:349800},
    {id:"campaign-whatsapp",name:"WhatsApp Clients",source:"whatsapp",destination_path:"/",active:true,clicks:16,uniqueVisitors:12,conversions:1,revenueMinor:259800},
    {id:"campaign-event",name:"Exhibition QR",source:"event-qr",destination_path:"/",active:true,clicks:14,uniqueVisitors:10,conversions:1,revenueMinor:0},
  ],
  payouts:[{id:"payout-1",amount_minor:19990,currency:"INR",status:"PAID",payout_method:"UPI",transaction_reference:"DEMO-TXN-8842",requested_at:daysAgo(8),paid_at:daysAgo(7)}],
  products:[{id:"product-1",name:"Premium NFC Card",slug:"premium-nfc-card",product_type:"NFC_CARD",currency:"INR"},{id:"product-2",name:"Matte Black PVC Card",slug:"matte-black-pvc",product_type:"NFC_CARD",currency:"INR"}],
  materials:[{id:"material-1",title:"Instagram launch caption",material_type:"SOCIAL_COPY",description:"A ready-to-edit caption for announcing your MyLuxCards partnership.",promotional_text:"One tap. One professional profile. Discover MyLuxCards with my partner link."},{id:"material-2",title:"Product talking points",material_type:"COPY_GUIDE",description:"Approved benefits to use in videos, posts, and client conversations.",promotional_text:"No app required · QR backup included · Update your profile without reprinting."}],
  credits:[],rewards:[],
};

const views = new Set(["overview","referrals","links","materials","payouts"]);
export default async function DemoPage({searchParams}:{searchParams:Promise<{view?:string}>}){
  const {view}=await searchParams;
  const selected=views.has(view||"")?view as "overview"|"referrals"|"links"|"materials"|"payouts":"overview";
  return <AffiliateDashboard view={selected} demoData={demoData}/>;
}
