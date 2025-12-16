-- Seed deep links data
-- Clear existing data (optional - remove if you want to preserve existing data)
-- TRUNCATE TABLE deep_links RESTART IDENTITY CASCADE;

-- Insert deep links
INSERT INTO deep_links (url, description, "userType", category, "isActive") VALUES
-- Influencer Routes
('app://influencers', 'Redirecting the influencer to the influencer home page', 'influencer', 'Home', true),
('app://influencers/me', 'Redirecting the influencer to the influencer profile section', 'influencer', 'Profile', true),
('app://influencers/[influencerId]', 'Redirecting the influencer to any specific influencer''s profile page', 'influencer', 'Profile', true),
('app://influencers/add-post', 'Redirecting the influencer to the add post page where they can add the post', 'influencer', 'Posts', true),
('app://influencers/edit-post', 'Redirecting the influencer to the edit post page where user can edit the post', 'influencer', 'Posts', true),
('app://influencers/campaigns', 'Redirecting the influencer to the campaigns page where they will be able to see the listed campaigns', 'influencer', 'Campaigns', true),
('app://influencers/campaigns/my-campaigns', 'Redirecting the influencer to the my campaigns page where they will be able to see the campaigns they have applied', 'influencer', 'Campaigns', true),
('app://influencers/search', 'Redirecting the influencer to search page where users can search for the influencers or brands', 'influencer', 'Search', true),
('app://maxx', 'Redirecting the user to the maxx plan where influencer can buy the maxx plan', 'influencer', 'Subscription', true),
('app://refer', 'Redirecting the influencer to the refer page where they can refer more users', 'influencer', 'Referral', true),

-- Brand Routes
('app://brands', 'Redirecting the brand owners to the brand home page', 'brand', 'Home', true),
('app://brands/me', 'Redirecting the brand owners to their profile page', 'brand', 'Profile', true),
('app://brands/[brandId]', 'Redirecting to the specific brand page', 'brand', 'Profile', true),
('app://brands/add-post', 'Redirecting the brand owner to the add post page where user can add the post', 'brand', 'Posts', true),
('app://brands/campaign/list', 'Redirecting the brand owners to the listing page of the campaigns where all campaigns will be listed', 'brand', 'Campaigns', true),
('app://brands/campaign/create', 'Redirecting the brand owners to the campaign create page where they will be able to create and upload a campaign', 'brand', 'Campaigns', true),
('app://brands/campaign/edit', 'Redirecting the brand owners to the campaign edit page where user will be able to edit the campaign', 'brand', 'Campaigns', true),
('app://brands/campaign/my-campaign', 'Redirecting the brand owners to the my-campaign listing page where user will be able to see the campaigns they have created', 'brand', 'Campaigns', true),
('app://brands/campaign/my-campaign/[campaignId]', 'Redirecting the brand owners to the campaign detail page where user will be able to see the detail of the campaigns they have uploaded', 'brand', 'Campaigns', true),
('app://brands/campaign/my-campaign/[campaignId]/influencer/[influencerId]', 'Redirecting the brand owner to the page where they will be able to see the detail of the influencer who have applied to their campaign', 'brand', 'Campaigns', true),
('app://brands/search', 'Redirecting the brand owner to the page where they will be able to search for the users like influencer or brand', 'brand', 'Search', true),

-- Common Routes (Both)
('app://terms', 'Redirecting the user to the terms page', 'both', 'Legal', true),
('app://privacy-policy', 'Redirecting the user to the privacy policy page', 'both', 'Legal', true)

ON CONFLICT (url) DO NOTHING;

-- Display inserted count
SELECT COUNT(*) as "Total Deep Links Seeded" FROM deep_links;
