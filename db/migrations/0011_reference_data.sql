insert into website_settings(id) values(true);
insert into affiliate_settings(id) values(true);
insert into affiliate_tiers(name,min_completed_orders,min_approved_revenue_minor,commission_type,commission_value,benefits) values
('STARTER',0,0,'PERCENT_BPS',1000,'Standard affiliate access'),
('SILVER',10,5000000,'PERCENT_BPS',1200,'Higher commission eligibility'),
('GOLD',25,15000000,'PERCENT_BPS',1500,'Priority campaign support'),
('PLATINUM',50,50000000,'PERCENT_BPS',1800,'Strategic partner benefits');
insert into affiliate_reward_definitions(name,required_delivered_orders,description) values
('STANDARD_CARD_REWARD',3,'Free standard NFC card eligibility'),
('PREMIUM_CARD_REWARD',10,'Free premium NFC card eligibility'),
('DEMO_KIT_REWARD',25,'Premium demo kit or metal card eligibility'),
('PLATINUM_REVIEW',50,'Platinum tier review eligibility');
