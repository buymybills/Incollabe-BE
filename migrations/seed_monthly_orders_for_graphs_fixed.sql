-- Seed monthly orders for graph visualization
-- This creates a realistic pattern of orders from April 2025 to March 2026
-- Pattern: steady growth from April to December, slight dip in Jan-Feb, recovery in March

BEGIN;

-- April 2025 - 8 orders, ₹42,500 total
INSERT INTO hype_store_orders (hype_store_id, coupon_code_id, influencer_id, external_order_id, order_title, order_amount, order_currency, order_date, customer_email, customer_phone, customer_name, order_status, cashback_amount, cashback_type, cashback_status, return_period_days, return_period_ends_at, visible_to_influencer, created_at, updated_at)
VALUES
  (19, 1, 7, 'ORD-APR-001', 'Summer T-Shirt', 3200, 'INR', '2025-04-05', 'customer1@example.com', '9876543201', 'Amit Kumar', 'delivered', 800, 'Flat 25%', 'pending', 30, '2025-05-05', true, '2025-04-05 10:30:00', '2025-04-05 10:30:00'),
  (19, 1, 7, 'ORD-APR-002', 'Denim Jeans', 4500, 'INR', '2025-04-08', 'customer2@example.com', '9876543202', 'Priya Singh', 'delivered', 1125, 'Flat 25%', 'pending', 30, '2025-05-08', true, '2025-04-08 14:20:00', '2025-04-08 14:20:00'),
  (19, 1, 7, 'ORD-APR-003', 'Casual Shirt', 2800, 'INR', '2025-04-12', 'customer3@example.com', '9876543203', 'Rahul Verma', 'delivered', 700, 'Flat 25%', 'pending', 30, '2025-05-12', true, '2025-04-12 11:15:00', '2025-04-12 11:15:00'),
  (19, 1, 7, 'ORD-APR-004', 'Sneakers', 5500, 'INR', '2025-04-15', 'customer4@example.com', '9876543204', 'Sneha Patel', 'delivered', 1375, 'Flat 25%', 'pending', 30, '2025-05-15', true, '2025-04-15 16:45:00', '2025-04-15 16:45:00'),
  (19, 1, 7, 'ORD-APR-005', 'Hoodie', 3900, 'INR', '2025-04-18', 'customer5@example.com', '9876543205', 'Vikram Shah', 'delivered', 975, 'Flat 25%', 'pending', 30, '2025-05-18', true, '2025-04-18 09:30:00', '2025-04-18 09:30:00'),
  (19, 1, 7, 'ORD-APR-006', 'Track Pants', 2500, 'INR', '2025-04-22', 'customer6@example.com', '9876543206', 'Anjali Mehta', 'delivered', 625, 'Flat 25%', 'pending', 30, '2025-05-22', true, '2025-04-22 13:10:00', '2025-04-22 13:10:00'),
  (19, 1, 7, 'ORD-APR-007', 'Blazer', 7800, 'INR', '2025-04-25', 'customer7@example.com', '9876543207', 'Karan Desai', 'delivered', 1950, 'Flat 25%', 'pending', 30, '2025-05-25', true, '2025-04-25 15:20:00', '2025-04-25 15:20:00'),
  (19, 1, 7, 'ORD-APR-008', 'Polo T-Shirt', 3200, 'INR', '2025-04-28', 'customer8@example.com', '9876543208', 'Neha Sharma', 'delivered', 800, 'Flat 25%', 'pending', 30, '2025-05-28', true, '2025-04-28 12:00:00', '2025-04-28 12:00:00');

-- May 2025 - 12 orders, ₹68,900 total
INSERT INTO hype_store_orders (hype_store_id, coupon_code_id, influencer_id, external_order_id, order_title, order_amount, order_currency, order_date, customer_email, customer_phone, customer_name, order_status, cashback_amount, cashback_type, cashback_status, return_period_days, return_period_ends_at, visible_to_influencer, created_at, updated_at)
VALUES
  (19, 1, 7, 'ORD-MAY-001', 'Cargo Pants', 4200, 'INR', '2025-05-02', 'customer9@example.com', '9876543209', 'Rohan Gupta', 'delivered', 1050, 'Flat 25%', 'pending', 30, '2025-06-01', true, '2025-05-02 10:00:00', '2025-05-02 10:00:00'),
  (19, 1, 7, 'ORD-MAY-002', 'Leather Jacket', 9800, 'INR', '2025-05-05', 'customer10@example.com', '9876543210', 'Pooja Nair', 'delivered', 2450, 'Flat 25%', 'pending', 30, '2025-06-04', true, '2025-05-05 14:30:00', '2025-05-05 14:30:00'),
  (19, 1, 7, 'ORD-MAY-003', 'Chinos', 3500, 'INR', '2025-05-08', 'customer11@example.com', '9876543211', 'Arjun Reddy', 'delivered', 875, 'Flat 25%', 'pending', 30, '2025-06-07', true, '2025-05-08 11:20:00', '2025-05-08 11:20:00'),
  (19, 1, 7, 'ORD-MAY-004', 'Formal Shirt', 2900, 'INR', '2025-05-11', 'customer12@example.com', '9876543212', 'Simran Kaur', 'delivered', 725, 'Flat 25%', 'pending', 30, '2025-06-10', true, '2025-05-11 09:45:00', '2025-05-11 09:45:00'),
  (19, 1, 7, 'ORD-MAY-005', 'Sports Shoes', 6200, 'INR', '2025-05-14', 'customer13@example.com', '9876543213', 'Dev Kapoor', 'delivered', 1550, 'Flat 25%', 'pending', 30, '2025-06-13', true, '2025-05-14 16:00:00', '2025-05-14 16:00:00'),
  (19, 1, 7, 'ORD-MAY-006', 'Denim Jacket', 5500, 'INR', '2025-05-17', 'customer14@example.com', '9876543214', 'Isha Agarwal', 'delivered', 1375, 'Flat 25%', 'pending', 30, '2025-06-16', true, '2025-05-17 13:30:00', '2025-05-17 13:30:00'),
  (19, 1, 7, 'ORD-MAY-007', 'Joggers', 3100, 'INR', '2025-05-20', 'customer15@example.com', '9876543215', 'Aditya Joshi', 'delivered', 775, 'Flat 25%', 'pending', 30, '2025-06-19', true, '2025-05-20 10:15:00', '2025-05-20 10:15:00'),
  (19, 1, 7, 'ORD-MAY-008', 'Summer Dress', 4500, 'INR', '2025-05-23', 'customer16@example.com', '9876543216', 'Kavya Pillai', 'delivered', 1125, 'Flat 25%', 'pending', 30, '2025-06-22', true, '2025-05-23 15:45:00', '2025-05-23 15:45:00'),
  (19, 1, 7, 'ORD-MAY-009', 'Backpack', 3800, 'INR', '2025-05-26', 'customer17@example.com', '9876543217', 'Siddharth Rao', 'delivered', 950, 'Flat 25%', 'pending', 30, '2025-06-25', true, '2025-05-26 11:00:00', '2025-05-26 11:00:00'),
  (19, 1, 7, 'ORD-MAY-010', 'Sunglasses', 2200, 'INR', '2025-05-28', 'customer18@example.com', '9876543218', 'Riya Bansal', 'delivered', 550, 'Flat 25%', 'pending', 30, '2025-06-27', true, '2025-05-28 14:20:00', '2025-05-28 14:20:00'),
  (19, 1, 7, 'ORD-MAY-011', 'Belt', 1500, 'INR', '2025-05-30', 'customer19@example.com', '9876543219', 'Manish Tiwari', 'delivered', 375, 'Flat 25%', 'pending', 30, '2025-06-29', true, '2025-05-30 12:30:00', '2025-05-30 12:30:00'),
  (19, 1, 7, 'ORD-MAY-012', 'Watch', 8700, 'INR', '2025-05-31', 'customer20@example.com', '9876543220', 'Nisha Gupta', 'delivered', 2175, 'Flat 25%', 'pending', 30, '2025-06-30', true, '2025-05-31 17:00:00', '2025-05-31 17:00:00');

-- June 2025 - 15 orders, ₹89,200 total
INSERT INTO hype_store_orders (hype_store_id, coupon_code_id, influencer_id, external_order_id, order_title, order_amount, order_currency, order_date, customer_email, customer_phone, customer_name, order_status, cashback_amount, cashback_type, cashback_status, return_period_days, return_period_ends_at, visible_to_influencer, created_at, updated_at)
VALUES
  (19, 1, 7, 'ORD-JUN-001', 'Linen Shirt', 3400, 'INR', '2025-06-02', 'customer21@example.com', '9876543221', 'Varun Malhotra', 'delivered', 850, 'Flat 25%', 'pending', 30, '2025-07-02', true, '2025-06-02 09:30:00', '2025-06-02 09:30:00'),
  (19, 1, 7, 'ORD-JUN-002', 'Shorts', 2100, 'INR', '2025-06-04', 'customer22@example.com', '9876543222', 'Tanvi Shah', 'delivered', 525, 'Flat 25%', 'pending', 30, '2025-07-04', true, '2025-06-04 13:15:00', '2025-06-04 13:15:00'),
  (19, 1, 7, 'ORD-JUN-003', 'Sandals', 1800, 'INR', '2025-06-06', 'customer23@example.com', '9876543223', 'Harsh Saxena', 'delivered', 450, 'Flat 25%', 'pending', 30, '2025-07-06', true, '2025-06-06 11:45:00', '2025-06-06 11:45:00'),
  (19, 1, 7, 'ORD-JUN-004', 'Tank Top', 1600, 'INR', '2025-06-08', 'customer24@example.com', '9876543224', 'Meera Iyer', 'delivered', 400, 'Flat 25%', 'pending', 30, '2025-07-08', true, '2025-06-08 10:20:00', '2025-06-08 10:20:00'),
  (19, 1, 7, 'ORD-JUN-005', 'Swim Shorts', 2400, 'INR', '2025-06-10', 'customer25@example.com', '9876543225', 'Gaurav Bhatia', 'delivered', 600, 'Flat 25%', 'pending', 30, '2025-07-10', true, '2025-06-10 15:00:00', '2025-06-10 15:00:00'),
  (19, 1, 7, 'ORD-JUN-006', 'Cap', 900, 'INR', '2025-06-12', 'customer26@example.com', '9876543226', 'Divya Menon', 'delivered', 225, 'Flat 25%', 'pending', 30, '2025-07-12', true, '2025-06-12 12:30:00', '2025-06-12 12:30:00'),
  (19, 1, 7, 'ORD-JUN-007', 'Sports Bra', 1900, 'INR', '2025-06-14', 'customer27@example.com', '9876543227', 'Ananya Das', 'delivered', 475, 'Flat 25%', 'pending', 30, '2025-07-14', true, '2025-06-14 09:15:00', '2025-06-14 09:15:00'),
  (19, 1, 7, 'ORD-JUN-008', 'Running Shoes', 7200, 'INR', '2025-06-16', 'customer28@example.com', '9876543228', 'Kartik Pandey', 'delivered', 1800, 'Flat 25%', 'pending', 30, '2025-07-16', true, '2025-06-16 16:20:00', '2025-06-16 16:20:00'),
  (19, 1, 7, 'ORD-JUN-009', 'Yoga Pants', 3200, 'INR', '2025-06-18', 'customer29@example.com', '9876543229', 'Shreya Kulkarni', 'delivered', 800, 'Flat 25%', 'pending', 30, '2025-07-18', true, '2025-06-18 14:00:00', '2025-06-18 14:00:00'),
  (19, 1, 7, 'ORD-JUN-010', 'Gym Bag', 2800, 'INR', '2025-06-20', 'customer30@example.com', '9876543230', 'Akash Sinha', 'delivered', 700, 'Flat 25%', 'pending', 30, '2025-07-20', true, '2025-06-20 11:30:00', '2025-06-20 11:30:00'),
  (19, 1, 7, 'ORD-JUN-011', 'Water Bottle', 800, 'INR', '2025-06-22', 'customer31@example.com', '9876543231', 'Pallavi Jain', 'delivered', 200, 'Flat 25%', 'pending', 30, '2025-07-22', true, '2025-06-22 10:45:00', '2025-06-22 10:45:00'),
  (19, 1, 7, 'ORD-JUN-012', 'Fitness Tracker', 12500, 'INR', '2025-06-24', 'customer32@example.com', '9876543232', 'Abhishek Modi', 'delivered', 3125, 'Flat 25%', 'pending', 30, '2025-07-24', true, '2025-06-24 15:30:00', '2025-06-24 15:30:00'),
  (19, 1, 7, 'ORD-JUN-013', 'Earphones', 3500, 'INR', '2025-06-26', 'customer33@example.com', '9876543233', 'Ritika Chopra', 'delivered', 875, 'Flat 25%', 'pending', 30, '2025-07-26', true, '2025-06-26 13:00:00', '2025-06-26 13:00:00'),
  (19, 1, 7, 'ORD-JUN-014', 'Power Bank', 2400, 'INR', '2025-06-28', 'customer34@example.com', '9876543234', 'Yash Thakur', 'delivered', 600, 'Flat 25%', 'pending', 30, '2025-07-28', true, '2025-06-28 12:15:00', '2025-06-28 12:15:00'),
  (19, 1, 7, 'ORD-JUN-015', 'Phone Case', 700, 'INR', '2025-06-30', 'customer35@example.com', '9876543235', 'Sakshi Dubey', 'delivered', 175, 'Flat 25%', 'pending', 30, '2025-07-30', true, '2025-06-30 17:45:00', '2025-06-30 17:45:00');

-- July 2025 - 14 orders, ₹82,300 total
INSERT INTO hype_store_orders (hype_store_id, coupon_code_id, influencer_id, external_order_id, order_title, order_amount, order_currency, order_date, customer_email, customer_phone, customer_name, order_status, cashback_amount, cashback_type, cashback_status, return_period_days, return_period_ends_at, visible_to_influencer, created_at, updated_at)
VALUES
  (19, 1, 7, 'ORD-JUL-001', 'Kurta', 3600, 'INR', '2025-07-03', 'customer36@example.com', '9876543236', 'Vivek Mishra', 'delivered', 900, 'Flat 25%', 'pending', 30, '2025-08-02', true, '2025-07-03 10:00:00', '2025-07-03 10:00:00'),
  (19, 1, 7, 'ORD-JUL-002', 'Palazzo Pants', 2900, 'INR', '2025-07-05', 'customer37@example.com', '9876543237', 'Aditi Bhatt', 'delivered', 725, 'Flat 25%', 'pending', 30, '2025-08-04', true, '2025-07-05 14:30:00', '2025-07-05 14:30:00'),
  (19, 1, 7, 'ORD-JUL-003', 'Ethnic Wear Set', 8900, 'INR', '2025-07-07', 'customer38@example.com', '9876543238', 'Madhav Rana', 'delivered', 2225, 'Flat 25%', 'pending', 30, '2025-08-06', true, '2025-07-07 11:15:00', '2025-07-07 11:15:00'),
  (19, 1, 7, 'ORD-JUL-004', 'Saree', 6700, 'INR', '2025-07-09', 'customer39@example.com', '9876543239', 'Radhika Soni', 'delivered', 1675, 'Flat 25%', 'pending', 30, '2025-08-08', true, '2025-07-09 15:45:00', '2025-07-09 15:45:00'),
  (19, 1, 7, 'ORD-JUL-005', 'Dupatta', 1800, 'INR', '2025-07-11', 'customer40@example.com', '9876543240', 'Nikhil Ghosh', 'delivered', 450, 'Flat 25%', 'pending', 30, '2025-08-10', true, '2025-07-11 09:30:00', '2025-07-11 09:30:00'),
  (19, 1, 7, 'ORD-JUL-006', 'Lehenga', 12500, 'INR', '2025-07-13', 'customer41@example.com', '9876543241', 'Preeti Kohli', 'delivered', 3125, 'Flat 25%', 'pending', 30, '2025-08-12', true, '2025-07-13 16:00:00', '2025-07-13 16:00:00'),
  (19, 1, 7, 'ORD-JUL-007', 'Nehru Jacket', 4200, 'INR', '2025-07-15', 'customer42@example.com', '9876543242', 'Saurabh Dixit', 'delivered', 1050, 'Flat 25%', 'pending', 30, '2025-08-14', true, '2025-07-15 13:20:00', '2025-07-15 13:20:00'),
  (19, 1, 7, 'ORD-JUL-008', 'Mojari', 2100, 'INR', '2025-07-17', 'customer43@example.com', '9876543243', 'Komal Arora', 'delivered', 525, 'Flat 25%', 'pending', 30, '2025-08-16', true, '2025-07-17 10:45:00', '2025-07-17 10:45:00'),
  (19, 1, 7, 'ORD-JUL-009', 'Clutch Bag', 3300, 'INR', '2025-07-19', 'customer44@example.com', '9876543244', 'Tushar Pathak', 'delivered', 825, 'Flat 25%', 'pending', 30, '2025-08-18', true, '2025-07-19 14:00:00', '2025-07-19 14:00:00'),
  (19, 1, 7, 'ORD-JUL-010', 'Bangles Set', 1500, 'INR', '2025-07-21', 'customer45@example.com', '9876543245', 'Jyoti Bajaj', 'delivered', 375, 'Flat 25%', 'pending', 30, '2025-08-20', true, '2025-07-21 11:30:00', '2025-07-21 11:30:00'),
  (19, 1, 7, 'ORD-JUL-011', 'Jhumkas', 2800, 'INR', '2025-07-23', 'customer46@example.com', '9876543246', 'Deepak Bhardwaj', 'delivered', 700, 'Flat 25%', 'pending', 30, '2025-08-22', true, '2025-07-23 15:15:00', '2025-07-23 15:15:00'),
  (19, 1, 7, 'ORD-JUL-012', 'Maang Tikka', 3500, 'INR', '2025-07-25', 'customer47@example.com', '9876543247', 'Swati Pandya', 'delivered', 875, 'Flat 25%', 'pending', 30, '2025-08-24', true, '2025-07-25 12:00:00', '2025-07-25 12:00:00'),
  (19, 1, 7, 'ORD-JUL-013', 'Sherwani', 15800, 'INR', '2025-07-27', 'customer48@example.com', '9876543248', 'Nitin Mahajan', 'delivered', 3950, 'Flat 25%', 'pending', 30, '2025-08-26', true, '2025-07-27 16:30:00', '2025-07-27 16:30:00'),
  (19, 1, 7, 'ORD-JUL-014', 'Stole', 2700, 'INR', '2025-07-30', 'customer49@example.com', '9876543249', 'Anjali Yadav', 'delivered', 675, 'Flat 25%', 'pending', 30, '2025-08-29', true, '2025-07-30 13:45:00', '2025-07-30 13:45:00');

-- August 2025 - 16 orders, ₹95,400 total
INSERT INTO hype_store_orders (hype_store_id, coupon_code_id, influencer_id, external_order_id, order_title, order_amount, order_currency, order_date, customer_email, customer_phone, customer_name, order_status, cashback_amount, cashback_type, cashback_status, return_period_days, return_period_ends_at, visible_to_influencer, created_at, updated_at)
VALUES
  (19, 1, 7, 'ORD-AUG-001', 'Windcheater', 4500, 'INR', '2025-08-02', 'customer50@example.com', '9876543250', 'Rahul Negi', 'delivered', 1125, 'Flat 25%', 'pending', 30, '2025-09-01', true, '2025-08-02 10:30:00', '2025-08-02 10:30:00'),
  (19, 1, 7, 'ORD-AUG-002', 'Sweatshirt', 3200, 'INR', '2025-08-04', 'customer51@example.com', '9876543251', 'Megha Sethi', 'delivered', 800, 'Flat 25%', 'pending', 30, '2025-09-03', true, '2025-08-04 14:15:00', '2025-08-04 14:15:00'),
  (19, 1, 7, 'ORD-AUG-003', 'Cardigan', 3800, 'INR', '2025-08-06', 'customer52@example.com', '9876543252', 'Tarun Bajpai', 'delivered', 950, 'Flat 25%', 'pending', 30, '2025-09-05', true, '2025-08-06 11:00:00', '2025-08-06 11:00:00'),
  (19, 1, 7, 'ORD-AUG-004', 'Puffer Jacket', 8900, 'INR', '2025-08-08', 'customer53@example.com', '9876543253', 'Shraddha Rathi', 'delivered', 2225, 'Flat 25%', 'pending', 30, '2025-09-07', true, '2025-08-08 15:45:00', '2025-08-08 15:45:00'),
  (19, 1, 7, 'ORD-AUG-005', 'Thermal Wear', 2400, 'INR', '2025-08-10', 'customer54@example.com', '9876543254', 'Kunal Tripathi', 'delivered', 600, 'Flat 25%', 'pending', 30, '2025-09-09', true, '2025-08-10 09:20:00', '2025-08-10 09:20:00'),
  (19, 1, 7, 'ORD-AUG-006', 'Scarf', 1600, 'INR', '2025-08-12', 'customer55@example.com', '9876543255', 'Roshni Khatri', 'delivered', 400, 'Flat 25%', 'pending', 30, '2025-09-11', true, '2025-08-12 13:30:00', '2025-08-12 13:30:00'),
  (19, 1, 7, 'ORD-AUG-007', 'Gloves', 1100, 'INR', '2025-08-14', 'customer56@example.com', '9876543256', 'Mohit Saini', 'delivered', 275, 'Flat 25%', 'pending', 30, '2025-09-13', true, '2025-08-14 10:15:00', '2025-08-14 10:15:00'),
  (19, 1, 7, 'ORD-AUG-008', 'Beanie', 900, 'INR', '2025-08-16', 'customer57@example.com', '9876543257', 'Prerna Kapoor', 'delivered', 225, 'Flat 25%', 'pending', 30, '2025-09-15', true, '2025-08-16 16:00:00', '2025-08-16 16:00:00'),
  (19, 1, 7, 'ORD-AUG-009', 'Ankle Boots', 6500, 'INR', '2025-08-18', 'customer58@example.com', '9876543258', 'Vishal Shukla', 'delivered', 1625, 'Flat 25%', 'pending', 30, '2025-09-17', true, '2025-08-18 12:45:00', '2025-08-18 12:45:00'),
  (19, 1, 7, 'ORD-AUG-010', 'Loafers', 4200, 'INR', '2025-08-20', 'customer59@example.com', '9876543259', 'Nidhi Ahluwalia', 'delivered', 1050, 'Flat 25%', 'pending', 30, '2025-09-19', true, '2025-08-20 14:20:00', '2025-08-20 14:20:00'),
  (19, 1, 7, 'ORD-AUG-011', 'Trench Coat', 12800, 'INR', '2025-08-22', 'customer60@example.com', '9876543260', 'Sameer Walia', 'delivered', 3200, 'Flat 25%', 'pending', 30, '2025-09-21', true, '2025-08-22 11:30:00', '2025-08-22 11:30:00'),
  (19, 1, 7, 'ORD-AUG-012', 'Bomber Jacket', 7200, 'INR', '2025-08-24', 'customer61@example.com', '9876543261', 'Aarti Goyal', 'delivered', 1800, 'Flat 25%', 'pending', 30, '2025-09-23', true, '2025-08-24 15:00:00', '2025-08-24 15:00:00'),
  (19, 1, 7, 'ORD-AUG-013', 'Sweater Dress', 5400, 'INR', '2025-08-26', 'customer62@example.com', '9876543262', 'Rajat Tomar', 'delivered', 1350, 'Flat 25%', 'pending', 30, '2025-09-25', true, '2025-08-26 13:15:00', '2025-08-26 13:15:00'),
  (19, 1, 7, 'ORD-AUG-014', 'Woolen Socks', 800, 'INR', '2025-08-28', 'customer63@example.com', '9876543263', 'Seema Rastogi', 'delivered', 200, 'Flat 25%', 'pending', 30, '2025-09-27', true, '2025-08-28 10:00:00', '2025-08-28 10:00:00'),
  (19, 1, 7, 'ORD-AUG-015', 'Muffler', 1200, 'INR', '2025-08-30', 'customer64@example.com', '9876543264', 'Arun Chauhan', 'delivered', 300, 'Flat 25%', 'pending', 30, '2025-09-29', true, '2025-08-30 16:30:00', '2025-08-30 16:30:00'),
  (19, 1, 7, 'ORD-AUG-016', 'Winter Cap', 1400, 'INR', '2025-08-31', 'customer65@example.com', '9876543265', 'Kavita Bisht', 'delivered', 350, 'Flat 25%', 'pending', 30, '2025-09-30', true, '2025-08-31 12:00:00', '2025-08-31 12:00:00');

-- September 2025 - 18 orders, ₹105,700 total
INSERT INTO hype_store_orders (hype_store_id, coupon_code_id, influencer_id, external_order_id, order_title, order_amount, order_currency, order_date, customer_email, customer_phone, customer_name, order_status, cashback_amount, cashback_type, cashback_status, return_period_days, return_period_ends_at, visible_to_influencer, created_at, updated_at)
VALUES
  (19, 1, 7, 'ORD-SEP-001', 'Overcoat', 9800, 'INR', '2025-09-02', 'customer66@example.com', '9876543266', 'Lalit Srivastava', 'delivered', 2450, 'Flat 25%', 'pending', 30, '2025-10-02', true, '2025-09-02 10:45:00', '2025-09-02 10:45:00'),
  (19, 1, 7, 'ORD-SEP-002', 'Peacoat', 8500, 'INR', '2025-09-04', 'customer67@example.com', '9876543267', 'Rashmi Khanna', 'delivered', 2125, 'Flat 25%', 'pending', 30, '2025-10-04', true, '2025-09-04 14:00:00', '2025-09-04 14:00:00'),
  (19, 1, 7, 'ORD-SEP-003', 'Parka', 11200, 'INR', '2025-09-06', 'customer68@example.com', '9876543268', 'Chetan Bhandari', 'delivered', 2800, 'Flat 25%', 'pending', 30, '2025-10-06', true, '2025-09-06 11:20:00', '2025-09-06 11:20:00'),
  (19, 1, 7, 'ORD-SEP-004', 'Pullover', 3700, 'INR', '2025-09-08', 'customer69@example.com', '9876543269', 'Payal Dhawan', 'delivered', 925, 'Flat 25%', 'pending', 30, '2025-10-08', true, '2025-09-08 15:30:00', '2025-09-08 15:30:00'),
  (19, 1, 7, 'ORD-SEP-005', 'Turtleneck', 3100, 'INR', '2025-09-10', 'customer70@example.com', '9876543270', 'Sumit Rawat', 'delivered', 775, 'Flat 25%', 'pending', 30, '2025-10-10', true, '2025-09-10 09:15:00', '2025-09-10 09:15:00'),
  (19, 1, 7, 'ORD-SEP-006', 'Fleece Jacket', 5600, 'INR', '2025-09-12', 'customer71@example.com', '9876543271', 'Geeta Nambiar', 'delivered', 1400, 'Flat 25%', 'pending', 30, '2025-10-12', true, '2025-09-12 13:45:00', '2025-09-12 13:45:00'),
  (19, 1, 7, 'ORD-SEP-007', 'Down Jacket', 13500, 'INR', '2025-09-14', 'customer72@example.com', '9876543272', 'Hemant Vyas', 'delivered', 3375, 'Flat 25%', 'pending', 30, '2025-10-14', true, '2025-09-14 16:00:00', '2025-09-14 16:00:00'),
  (19, 1, 7, 'ORD-SEP-008', 'Leather Gloves', 2800, 'INR', '2025-09-16', 'customer73@example.com', '9876543273', 'Ira Joshi', 'delivered', 700, 'Flat 25%', 'pending', 30, '2025-10-16', true, '2025-09-16 10:30:00', '2025-09-16 10:30:00'),
  (19, 1, 7, 'ORD-SEP-009', 'Cashmere Scarf', 6400, 'INR', '2025-09-18', 'customer74@example.com', '9876543274', 'Jay Sawant', 'delivered', 1600, 'Flat 25%', 'pending', 30, '2025-10-18', true, '2025-09-18 14:15:00', '2025-09-18 14:15:00'),
  (19, 1, 7, 'ORD-SEP-010', 'Chelsea Boots', 7200, 'INR', '2025-09-20', 'customer75@example.com', '9876543275', 'Kanika Puri', 'delivered', 1800, 'Flat 25%', 'pending', 30, '2025-10-20', true, '2025-09-20 11:00:00', '2025-09-20 11:00:00'),
  (19, 1, 7, 'ORD-SEP-011', 'Duffel Coat', 9200, 'INR', '2025-09-22', 'customer76@example.com', '9876543276', 'Lalit Kumar', 'delivered', 2300, 'Flat 25%', 'pending', 30, '2025-10-22', true, '2025-09-22 15:45:00', '2025-09-22 15:45:00'),
  (19, 1, 7, 'ORD-SEP-012', 'Quilted Jacket', 5900, 'INR', '2025-09-24', 'customer77@example.com', '9876543277', 'Mona Talwar', 'delivered', 1475, 'Flat 25%', 'pending', 30, '2025-10-24', true, '2025-09-24 12:30:00', '2025-09-24 12:30:00'),
  (19, 1, 7, 'ORD-SEP-013', 'Wool Coat', 10500, 'INR', '2025-09-26', 'customer78@example.com', '9876543278', 'Naveen Saxena', 'delivered', 2625, 'Flat 25%', 'pending', 30, '2025-10-26', true, '2025-09-26 13:00:00', '2025-09-26 13:00:00'),
  (19, 1, 7, 'ORD-SEP-014', 'Raincoat', 3400, 'INR', '2025-09-27', 'customer79@example.com', '9876543279', 'Omkar Deshmukh', 'delivered', 850, 'Flat 25%', 'pending', 30, '2025-10-27', true, '2025-09-27 09:45:00', '2025-09-27 09:45:00'),
  (19, 1, 7, 'ORD-SEP-015', 'Umbrella', 1200, 'INR', '2025-09-28', 'customer80@example.com', '9876543280', 'Poornima Reddy', 'delivered', 300, 'Flat 25%', 'pending', 30, '2025-10-28', true, '2025-09-28 16:20:00', '2025-09-28 16:20:00'),
  (19, 1, 7, 'ORD-SEP-016', 'Poncho', 2700, 'INR', '2025-09-29', 'customer81@example.com', '9876543281', 'Qamar Ali', 'delivered', 675, 'Flat 25%', 'pending', 30, '2025-10-29', true, '2025-09-29 10:00:00', '2025-09-29 10:00:00'),
  (19, 1, 7, 'ORD-SEP-017', 'Rain Boots', 3800, 'INR', '2025-09-30', 'customer82@example.com', '9876543282', 'Rita Banerjee', 'delivered', 950, 'Flat 25%', 'pending', 30, '2025-10-30', true, '2025-09-30 14:30:00', '2025-09-30 14:30:00'),
  (19, 1, 7, 'ORD-SEP-018', 'Windproof Jacket', 4900, 'INR', '2025-09-30', 'customer83@example.com', '9876543283', 'Sanjay Bhatt', 'delivered', 1225, 'Flat 25%', 'pending', 30, '2025-10-30', true, '2025-09-30 17:00:00', '2025-09-30 17:00:00');

-- October 2025 - 17 orders, ₹98,300 total
INSERT INTO hype_store_orders (hype_store_id, coupon_code_id, influencer_id, external_order_id, order_title, order_amount, order_currency, order_date, customer_email, customer_phone, customer_name, order_status, cashback_amount, cashback_type, cashback_status, return_period_days, return_period_ends_at, visible_to_influencer, created_at, updated_at)
VALUES
  (19, 1, 7, 'ORD-OCT-001', 'Dress Shirt', 3900, 'INR', '2025-10-02', 'customer84@example.com', '9876543284', 'Tarun Mehra', 'delivered', 975, 'Flat 25%', 'pending', 30, '2025-11-01', true, '2025-10-02 11:00:00', '2025-10-02 11:00:00'),
  (19, 1, 7, 'ORD-OCT-002', 'Trousers', 4200, 'INR', '2025-10-04', 'customer85@example.com', '9876543285', 'Uma Sharma', 'delivered', 1050, 'Flat 25%', 'pending', 30, '2025-11-03', true, '2025-10-04 14:30:00', '2025-10-04 14:30:00'),
  (19, 1, 7, 'ORD-OCT-003', 'Vest', 2800, 'INR', '2025-10-06', 'customer86@example.com', '9876543286', 'Vijay Rao', 'delivered', 700, 'Flat 25%', 'pending', 30, '2025-11-05', true, '2025-10-06 10:15:00', '2025-10-06 10:15:00'),
  (19, 1, 7, 'ORD-OCT-004', 'Oxford Shoes', 6700, 'INR', '2025-10-08', 'customer87@example.com', '9876543287', 'Warda Khan', 'delivered', 1675, 'Flat 25%', 'pending', 30, '2025-11-07', true, '2025-10-08 15:45:00', '2025-10-08 15:45:00'),
  (19, 1, 7, 'ORD-OCT-005', 'Tie Set', 1900, 'INR', '2025-10-10', 'customer88@example.com', '9876543288', 'Xavier D\'Souza', 'delivered', 475, 'Flat 25%', 'pending', 30, '2025-11-09', true, '2025-10-10 09:30:00', '2025-10-10 09:30:00'),
  (19, 1, 7, 'ORD-OCT-006', 'Cufflinks', 2400, 'INR', '2025-10-12', 'customer89@example.com', '9876543289', 'Yamini Patel', 'delivered', 600, 'Flat 25%', 'pending', 30, '2025-11-11', true, '2025-10-12 13:20:00', '2025-10-12 13:20:00'),
  (19, 1, 7, 'ORD-OCT-007', 'Briefcase', 8900, 'INR', '2025-10-14', 'customer90@example.com', '9876543290', 'Zahir Ahmed', 'delivered', 2225, 'Flat 25%', 'pending', 30, '2025-11-13', true, '2025-10-14 16:00:00', '2025-10-14 16:00:00'),
  (19, 1, 7, 'ORD-OCT-008', 'Laptop Bag', 5600, 'INR', '2025-10-16', 'customer91@example.com', '9876543291', 'Aarav Malik', 'delivered', 1400, 'Flat 25%', 'pending', 30, '2025-11-15', true, '2025-10-16 11:45:00', '2025-10-16 11:45:00'),
  (19, 1, 7, 'ORD-OCT-009', 'Wallet', 3200, 'INR', '2025-10-18', 'customer92@example.com', '9876543292', 'Bhavna Singh', 'delivered', 800, 'Flat 25%', 'pending', 30, '2025-11-17', true, '2025-10-18 14:00:00', '2025-10-18 14:00:00'),
  (19, 1, 7, 'ORD-OCT-010', 'Card Holder', 1800, 'INR', '2025-10-20', 'customer93@example.com', '9876543293', 'Chirag Jain', 'delivered', 450, 'Flat 25%', 'pending', 30, '2025-11-19', true, '2025-10-20 10:30:00', '2025-10-20 10:30:00'),
  (19, 1, 7, 'ORD-OCT-011', 'Key Chain', 900, 'INR', '2025-10-22', 'customer94@example.com', '9876543294', 'Diya Reddy', 'delivered', 225, 'Flat 25%', 'pending', 30, '2025-11-21', true, '2025-10-22 15:15:00', '2025-10-22 15:15:00'),
  (19, 1, 7, 'ORD-OCT-012', 'Pen Set', 4500, 'INR', '2025-10-24', 'customer95@example.com', '9876543295', 'Esha Kapoor', 'delivered', 1125, 'Flat 25%', 'pending', 30, '2025-11-23', true, '2025-10-24 12:45:00', '2025-10-24 12:45:00'),
  (19, 1, 7, 'ORD-OCT-013', 'Diary', 1200, 'INR', '2025-10-26', 'customer96@example.com', '9876543296', 'Farhan Ali', 'delivered', 300, 'Flat 25%', 'pending', 30, '2025-11-25', true, '2025-10-26 09:00:00', '2025-10-26 09:00:00'),
  (19, 1, 7, 'ORD-OCT-014', 'Desktop Organizer', 2700, 'INR', '2025-10-27', 'customer97@example.com', '9876543297', 'Garima Verma', 'delivered', 675, 'Flat 25%', 'pending', 30, '2025-11-26', true, '2025-10-27 16:30:00', '2025-10-27 16:30:00'),
  (19, 1, 7, 'ORD-OCT-015', 'Mouse Pad', 800, 'INR', '2025-10-28', 'customer98@example.com', '9876543298', 'Harsh Bansal', 'delivered', 200, 'Flat 25%', 'pending', 30, '2025-11-27', true, '2025-10-28 13:00:00', '2025-10-28 13:00:00'),
  (19, 1, 7, 'ORD-OCT-016', 'Phone Stand', 1100, 'INR', '2025-10-30', 'customer99@example.com', '9876543299', 'Isha Nair', 'delivered', 275, 'Flat 25%', 'pending', 30, '2025-11-29', true, '2025-10-30 11:20:00', '2025-10-30 11:20:00'),
  (19, 1, 7, 'ORD-OCT-017', 'Desk Lamp', 5600, 'INR', '2025-10-31', 'customer100@example.com', '9876543300', 'Jai Kumar', 'delivered', 1400, 'Flat 25%', 'pending', 30, '2025-11-30', true, '2025-10-31 17:00:00', '2025-10-31 17:00:00');

-- November 2025 - 19 orders, ₹112,400 total
INSERT INTO hype_store_orders (hype_store_id, coupon_code_id, influencer_id, external_order_id, order_title, order_amount, order_currency, order_date, customer_email, customer_phone, customer_name, order_status, cashback_amount, cashback_type, cashback_status, return_period_days, return_period_ends_at, visible_to_influencer, created_at, updated_at)
VALUES
  (19, 1, 7, 'ORD-NOV-001', 'Bluetooth Speaker', 4800, 'INR', '2025-11-02', 'customer101@example.com', '9876543301', 'Kabir Singh', 'delivered', 1200, 'Flat 25%', 'pending', 30, '2025-12-02', true, '2025-11-02 10:00:00', '2025-11-02 10:00:00'),
  (19, 1, 7, 'ORD-NOV-002', 'Headphones', 6900, 'INR', '2025-11-04', 'customer102@example.com', '9876543302', 'Lakshmi Iyer', 'delivered', 1725, 'Flat 25%', 'pending', 30, '2025-12-04', true, '2025-11-04 14:15:00', '2025-11-04 14:15:00'),
  (19, 1, 7, 'ORD-NOV-003', 'Webcam', 5400, 'INR', '2025-11-06', 'customer103@example.com', '9876543303', 'Mohan Pillai', 'delivered', 1350, 'Flat 25%', 'pending', 30, '2025-12-06', true, '2025-11-06 11:30:00', '2025-11-06 11:30:00'),
  (19, 1, 7, 'ORD-NOV-004', 'Microphone', 7200, 'INR', '2025-11-08', 'customer104@example.com', '9876543304', 'Navya Desai', 'delivered', 1800, 'Flat 25%', 'pending', 30, '2025-12-08', true, '2025-11-08 15:45:00', '2025-11-08 15:45:00'),
  (19, 1, 7, 'ORD-NOV-005', 'USB Hub', 2100, 'INR', '2025-11-10', 'customer105@example.com', '9876543305', 'Om Prakash', 'delivered', 525, 'Flat 25%', 'pending', 30, '2025-12-10', true, '2025-11-10 09:20:00', '2025-11-10 09:20:00'),
  (19, 1, 7, 'ORD-NOV-006', 'External HDD', 8900, 'INR', '2025-11-12', 'customer106@example.com', '9876543306', 'Prachi Ghosh', 'delivered', 2225, 'Flat 25%', 'pending', 30, '2025-12-12', true, '2025-11-12 13:00:00', '2025-11-12 13:00:00'),
  (19, 1, 7, 'ORD-NOV-007', 'Keyboard', 4500, 'INR', '2025-11-14', 'customer107@example.com', '9876543307', 'Qadir Sheikh', 'delivered', 1125, 'Flat 25%', 'pending', 30, '2025-12-14', true, '2025-11-14 16:15:00', '2025-11-14 16:15:00'),
  (19, 1, 7, 'ORD-NOV-008', 'Mouse', 2800, 'INR', '2025-11-16', 'customer108@example.com', '9876543308', 'Reena Joshi', 'delivered', 700, 'Flat 25%', 'pending', 30, '2025-12-16', true, '2025-11-16 10:45:00', '2025-11-16 10:45:00'),
  (19, 1, 7, 'ORD-NOV-009', 'Monitor Stand', 3600, 'INR', '2025-11-18', 'customer109@example.com', '9876543309', 'Sahil Yadav', 'delivered', 900, 'Flat 25%', 'pending', 30, '2025-12-18', true, '2025-11-18 14:20:00', '2025-11-18 14:20:00'),
  (19, 1, 7, 'ORD-NOV-010', 'Cable Organizer', 1400, 'INR', '2025-11-20', 'customer110@example.com', '9876543310', 'Tara Malhotra', 'delivered', 350, 'Flat 25%', 'pending', 30, '2025-12-20', true, '2025-11-20 11:00:00', '2025-11-20 11:00:00'),
  (19, 1, 7, 'ORD-NOV-011', 'Laptop Stand', 3900, 'INR', '2025-11-22', 'customer111@example.com', '9876543311', 'Uday Bhat', 'delivered', 975, 'Flat 25%', 'pending', 30, '2025-12-22', true, '2025-11-22 15:30:00', '2025-11-22 15:30:00'),
  (19, 1, 7, 'ORD-NOV-012', 'Ring Light', 5700, 'INR', '2025-11-24', 'customer112@example.com', '9876543312', 'Vandana Roy', 'delivered', 1425, 'Flat 25%', 'pending', 30, '2025-12-24', true, '2025-11-24 12:15:00', '2025-11-24 12:15:00'),
  (19, 1, 7, 'ORD-NOV-013', 'Tripod', 4200, 'INR', '2025-11-25', 'customer113@example.com', '9876543313', 'Wasim Khan', 'delivered', 1050, 'Flat 25%', 'pending', 30, '2025-12-25', true, '2025-11-25 09:45:00', '2025-11-25 09:45:00'),
  (19, 1, 7, 'ORD-NOV-014', 'Green Screen', 6300, 'INR', '2025-11-26', 'customer114@example.com', '9876543314', 'Xena Rao', 'delivered', 1575, 'Flat 25%', 'pending', 30, '2025-12-26', true, '2025-11-26 16:00:00', '2025-11-26 16:00:00'),
  (19, 1, 7, 'ORD-NOV-015', 'Camera Bag', 3800, 'INR', '2025-11-27', 'customer115@example.com', '9876543315', 'Yash Patil', 'delivered', 950, 'Flat 25%', 'pending', 30, '2025-12-27', true, '2025-11-27 13:30:00', '2025-11-27 13:30:00'),
  (19, 1, 7, 'ORD-NOV-016', 'Memory Card', 2900, 'INR', '2025-11-28', 'customer116@example.com', '9876543316', 'Zara Malik', 'delivered', 725, 'Flat 25%', 'pending', 30, '2025-12-28', true, '2025-11-28 10:20:00', '2025-11-28 10:20:00'),
  (19, 1, 7, 'ORD-NOV-017', 'SD Card Reader', 1600, 'INR', '2025-11-29', 'customer117@example.com', '9876543317', 'Aman Gupta', 'delivered', 400, 'Flat 25%', 'pending', 30, '2025-12-29', true, '2025-11-29 14:50:00', '2025-11-29 14:50:00'),
  (19, 1, 7, 'ORD-NOV-018', 'Lens Cleaning Kit', 1200, 'INR', '2025-11-30', 'customer118@example.com', '9876543318', 'Bipasha Sen', 'delivered', 300, 'Flat 25%', 'pending', 30, '2025-12-30', true, '2025-11-30 11:40:00', '2025-11-30 11:40:00'),
  (19, 1, 7, 'ORD-NOV-019', 'Camera Strap', 1500, 'INR', '2025-11-30', 'customer119@example.com', '9876543319', 'Chintu Shah', 'delivered', 375, 'Flat 25%', 'pending', 30, '2025-12-30', true, '2025-11-30 17:10:00', '2025-11-30 17:10:00');

-- December 2025 - 20 orders, ₹125,800 total (peak season)
INSERT INTO hype_store_orders (hype_store_id, coupon_code_id, influencer_id, external_order_id, order_title, order_amount, order_currency, order_date, customer_email, customer_phone, customer_name, order_status, cashback_amount, cashback_type, cashback_status, return_period_days, return_period_ends_at, visible_to_influencer, created_at, updated_at)
VALUES
  (19, 1, 7, 'ORD-DEC-001', 'Smart Watch', 12500, 'INR', '2025-12-02', 'customer120@example.com', '9876543320', 'Deepika Kumar', 'delivered', 3125, 'Flat 25%', 'pending', 30, '2026-01-01', true, '2025-12-02 10:30:00', '2025-12-02 10:30:00'),
  (19, 1, 7, 'ORD-DEC-002', 'Wireless Earbuds', 5900, 'INR', '2025-12-04', 'customer121@example.com', '9876543321', 'Eshan Mehra', 'delivered', 1475, 'Flat 25%', 'pending', 30, '2026-01-03', true, '2025-12-04 14:00:00', '2025-12-04 14:00:00'),
  (19, 1, 7, 'ORD-DEC-003', 'Smart Band', 3400, 'INR', '2025-12-06', 'customer122@example.com', '9876543322', 'Farah Khan', 'delivered', 850, 'Flat 25%', 'pending', 30, '2026-01-05', true, '2025-12-06 11:15:00', '2025-12-06 11:15:00'),
  (19, 1, 7, 'ORD-DEC-004', 'Portable SSD', 9800, 'INR', '2025-12-08', 'customer123@example.com', '9876543323', 'Gopal Nair', 'delivered', 2450, 'Flat 25%', 'pending', 30, '2026-01-07', true, '2025-12-08 15:45:00', '2025-12-08 15:45:00'),
  (19, 1, 7, 'ORD-DEC-005', 'Tablet', 18900, 'INR', '2025-12-10', 'customer124@example.com', '9876543324', 'Hina Patel', 'delivered', 4725, 'Flat 25%', 'pending', 30, '2026-01-09', true, '2025-12-10 09:30:00', '2025-12-10 09:30:00'),
  (19, 1, 7, 'ORD-DEC-006', 'E-Reader', 8200, 'INR', '2025-12-12', 'customer125@example.com', '9876543325', 'Imran Ahmed', 'delivered', 2050, 'Flat 25%', 'pending', 30, '2026-01-11', true, '2025-12-12 13:20:00', '2025-12-12 13:20:00'),
  (19, 1, 7, 'ORD-DEC-007', 'Tablet Case', 2100, 'INR', '2025-12-14', 'customer126@example.com', '9876543326', 'Jaya Sharma', 'delivered', 525, 'Flat 25%', 'pending', 30, '2026-01-13', true, '2025-12-14 16:00:00', '2025-12-14 16:00:00'),
  (19, 1, 7, 'ORD-DEC-008', 'Screen Protector', 800, 'INR', '2025-12-16', 'customer127@example.com', '9876543327', 'Kiran Rao', 'delivered', 200, 'Flat 25%', 'pending', 30, '2026-01-15', true, '2025-12-16 11:45:00', '2025-12-16 11:45:00'),
  (19, 1, 7, 'ORD-DEC-009', 'Stylus Pen', 3700, 'INR', '2025-12-18', 'customer128@example.com', '9876543328', 'Laila Singh', 'delivered', 925, 'Flat 25%', 'pending', 30, '2026-01-17', true, '2025-12-18 14:30:00', '2025-12-18 14:30:00'),
  (19, 1, 7, 'ORD-DEC-010', 'Charging Dock', 2900, 'INR', '2025-12-19', 'customer129@example.com', '9876543329', 'Manav Joshi', 'delivered', 725, 'Flat 25%', 'pending', 30, '2026-01-18', true, '2025-12-19 10:00:00', '2025-12-19 10:00:00'),
  (19, 1, 7, 'ORD-DEC-011', 'Wireless Charger', 4500, 'INR', '2025-12-20', 'customer130@example.com', '9876543330', 'Naina Kapoor', 'delivered', 1125, 'Flat 25%', 'pending', 30, '2026-01-19', true, '2025-12-20 15:15:00', '2025-12-20 15:15:00'),
  (19, 1, 7, 'ORD-DEC-012', 'Car Charger', 1600, 'INR', '2025-12-21', 'customer131@example.com', '9876543331', 'Ojas Reddy', 'delivered', 400, 'Flat 25%', 'pending', 30, '2026-01-20', true, '2025-12-21 12:30:00', '2025-12-21 12:30:00'),
  (19, 1, 7, 'ORD-DEC-013', 'Phone Holder', 1200, 'INR', '2025-12-22', 'customer132@example.com', '9876543332', 'Pankaj Verma', 'delivered', 300, 'Flat 25%', 'pending', 30, '2026-01-21', true, '2025-12-22 09:45:00', '2025-12-22 09:45:00'),
  (19, 1, 7, 'ORD-DEC-014', 'Car Mount', 1800, 'INR', '2025-12-23', 'customer133@example.com', '9876543333', 'Qureshi Ali', 'delivered', 450, 'Flat 25%', 'pending', 30, '2026-01-22', true, '2025-12-23 16:20:00', '2025-12-23 16:20:00'),
  (19, 1, 7, 'ORD-DEC-015', 'USB Cable Set', 2400, 'INR', '2025-12-24', 'customer134@example.com', '9876543334', 'Ravi Kumar', 'delivered', 600, 'Flat 25%', 'pending', 30, '2026-01-23', true, '2025-12-24 13:00:00', '2025-12-24 13:00:00'),
  (19, 1, 7, 'ORD-DEC-016', 'Adapter Set', 1900, 'INR', '2025-12-26', 'customer135@example.com', '9876543335', 'Sana Sheikh', 'delivered', 475, 'Flat 25%', 'pending', 30, '2026-01-25', true, '2025-12-26 10:15:00', '2025-12-26 10:15:00'),
  (19, 1, 7, 'ORD-DEC-017', 'Extension Cord', 2700, 'INR', '2025-12-27', 'customer136@example.com', '9876543336', 'Tanmay Desai', 'delivered', 675, 'Flat 25%', 'pending', 30, '2026-01-26', true, '2025-12-27 14:45:00', '2025-12-27 14:45:00'),
  (19, 1, 7, 'ORD-DEC-018', 'Surge Protector', 3500, 'INR', '2025-12-28', 'customer137@example.com', '9876543337', 'Uma Pillai', 'delivered', 875, 'Flat 25%', 'pending', 30, '2026-01-27', true, '2025-12-28 11:30:00', '2025-12-28 11:30:00'),
  (19, 1, 7, 'ORD-DEC-019', 'Smart Plug', 2900, 'INR', '2025-12-29', 'customer138@example.com', '9876543338', 'Vikas Jain', 'delivered', 725, 'Flat 25%', 'pending', 30, '2026-01-28', true, '2025-12-29 15:50:00', '2025-12-29 15:50:00'),
  (19, 1, 7, 'ORD-DEC-020', 'LED Strip', 4200, 'INR', '2025-12-31', 'customer139@example.com', '9876543339', 'Wahida Khan', 'delivered', 1050, 'Flat 25%', 'pending', 30, '2026-01-30', true, '2025-12-31 17:00:00', '2025-12-31 17:00:00');

-- January 2026 - 18 orders, ₹102,900 total (post-holiday dip)
INSERT INTO hype_store_orders (hype_store_id, coupon_code_id, influencer_id, external_order_id, order_title, order_amount, order_currency, order_date, customer_email, customer_phone, customer_name, order_status, cashback_amount, cashback_type, cashback_status, return_period_days, return_period_ends_at, visible_to_influencer, created_at, updated_at)
VALUES
  (19, 1, 7, 'ORD-JAN-001', 'Desk Chair', 8900, 'INR', '2026-01-03', 'customer140@example.com', '9876543340', 'Xander Rao', 'delivered', 2225, 'Flat 25%', 'pending', 30, '2026-02-02', true, '2026-01-03 10:00:00', '2026-01-03 10:00:00'),
  (19, 1, 7, 'ORD-JAN-002', 'Office Table', 12500, 'INR', '2026-01-05', 'customer141@example.com', '9876543341', 'Yasmin Patel', 'delivered', 3125, 'Flat 25%', 'pending', 30, '2026-02-04', true, '2026-01-05 14:30:00', '2026-01-05 14:30:00'),
  (19, 1, 7, 'ORD-JAN-003', 'Bookshelf', 6700, 'INR', '2026-01-07', 'customer142@example.com', '9876543342', 'Zaheer Ahmed', 'delivered', 1675, 'Flat 25%', 'pending', 30, '2026-02-06', true, '2026-01-07 11:20:00', '2026-01-07 11:20:00'),
  (19, 1, 7, 'ORD-JAN-004', 'Filing Cabinet', 5400, 'INR', '2026-01-09', 'customer143@example.com', '9876543343', 'Arya Singh', 'delivered', 1350, 'Flat 25%', 'pending', 30, '2026-02-08', true, '2026-01-09 15:45:00', '2026-01-09 15:45:00'),
  (19, 1, 7, 'ORD-JAN-005', 'Drawer Unit', 4200, 'INR', '2026-01-11', 'customer144@example.com', '9876543344', 'Bhanu Sharma', 'delivered', 1050, 'Flat 25%', 'pending', 30, '2026-02-10', true, '2026-01-11 09:30:00', '2026-01-11 09:30:00'),
  (19, 1, 7, 'ORD-JAN-006', 'Whiteboard', 3800, 'INR', '2026-01-13', 'customer145@example.com', '9876543345', 'Charu Reddy', 'delivered', 950, 'Flat 25%', 'pending', 30, '2026-02-12', true, '2026-01-13 13:15:00', '2026-01-13 13:15:00'),
  (19, 1, 7, 'ORD-JAN-007', 'Cork Board', 2100, 'INR', '2026-01-15', 'customer146@example.com', '9876543346', 'Dinesh Malhotra', 'delivered', 525, 'Flat 25%', 'pending', 30, '2026-02-14', true, '2026-01-15 16:00:00', '2026-01-15 16:00:00'),
  (19, 1, 7, 'ORD-JAN-008', 'Paper Shredder', 5900, 'INR', '2026-01-17', 'customer147@example.com', '9876543347', 'Ekta Gupta', 'delivered', 1475, 'Flat 25%', 'pending', 30, '2026-02-16', true, '2026-01-17 11:45:00', '2026-01-17 11:45:00'),
  (19, 1, 7, 'ORD-JAN-009', 'Laminator', 4500, 'INR', '2026-01-19', 'customer148@example.com', '9876543348', 'Firoz Khan', 'delivered', 1125, 'Flat 25%', 'pending', 30, '2026-02-18', true, '2026-01-19 14:20:00', '2026-01-19 14:20:00'),
  (19, 1, 7, 'ORD-JAN-010', 'Stapler Set', 1800, 'INR', '2026-01-21', 'customer149@example.com', '9876543349', 'Gayatri Nair', 'delivered', 450, 'Flat 25%', 'pending', 30, '2026-02-20', true, '2026-01-21 10:30:00', '2026-01-21 10:30:00'),
  (19, 1, 7, 'ORD-JAN-011', 'Punch Machine', 2400, 'INR', '2026-01-23', 'customer150@example.com', '9876543350', 'Hari Desai', 'delivered', 600, 'Flat 25%', 'pending', 30, '2026-02-22', true, '2026-01-23 15:10:00', '2026-01-23 15:10:00'),
  (19, 1, 7, 'ORD-JAN-012', 'Paper Clips Box', 900, 'INR', '2026-01-25', 'customer151@example.com', '9876543351', 'Indira Roy', 'delivered', 225, 'Flat 25%', 'pending', 30, '2026-02-24', true, '2026-01-25 12:00:00', '2026-01-25 12:00:00'),
  (19, 1, 7, 'ORD-JAN-013', 'Binder Set', 3200, 'INR', '2026-01-26', 'customer152@example.com', '9876543352', 'Jatin Mehra', 'delivered', 800, 'Flat 25%', 'pending', 30, '2026-02-25', true, '2026-01-26 09:45:00', '2026-01-26 09:45:00'),
  (19, 1, 7, 'ORD-JAN-014', 'Folder Set', 2700, 'INR', '2026-01-27', 'customer153@example.com', '9876543353', 'Kamini Joshi', 'delivered', 675, 'Flat 25%', 'pending', 30, '2026-02-26', true, '2026-01-27 16:30:00', '2026-01-27 16:30:00'),
  (19, 1, 7, 'ORD-JAN-015', 'Envelope Pack', 1500, 'INR', '2026-01-28', 'customer154@example.com', '9876543354', 'Lalit Verma', 'delivered', 375, 'Flat 25%', 'pending', 30, '2026-02-27', true, '2026-01-28 13:20:00', '2026-01-28 13:20:00'),
  (19, 1, 7, 'ORD-JAN-016', 'Stamp Pad', 800, 'INR', '2026-01-29', 'customer155@example.com', '9876543355', 'Meena Patel', 'delivered', 200, 'Flat 25%', 'pending', 30, '2026-02-28', true, '2026-01-29 10:50:00', '2026-01-29 10:50:00'),
  (19, 1, 7, 'ORD-JAN-017', 'Paper Weight', 1200, 'INR', '2026-01-30', 'customer156@example.com', '9876543356', 'Nitin Kumar', 'delivered', 300, 'Flat 25%', 'pending', 30, '2026-03-01', true, '2026-01-30 14:40:00', '2026-01-30 14:40:00'),
  (19, 1, 7, 'ORD-JAN-018', 'Letter Tray', 2800, 'INR', '2026-01-31', 'customer157@example.com', '9876543357', 'Ojaswi Singh', 'delivered', 700, 'Flat 25%', 'pending', 30, '2026-03-02', true, '2026-01-31 17:15:00', '2026-01-31 17:15:00');

-- February 2026 - 12 orders, ₹68,400 total (lower month)
INSERT INTO hype_store_orders (hype_store_id, coupon_code_id, influencer_id, external_order_id, order_title, order_amount, order_currency, order_date, customer_email, customer_phone, customer_name, order_status, cashback_amount, cashback_type, cashback_status, return_period_days, return_period_ends_at, visible_to_influencer, created_at, updated_at)
VALUES
  (19, 1, 7, 'ORD-FEB-001', 'Notebook Pack', 1800, 'INR', '2026-02-02', 'customer158@example.com', '9876543358', 'Pradeep Sharma', 'delivered', 450, 'Flat 25%', 'pending', 30, '2026-03-04', true, '2026-02-02 10:20:00', '2026-02-02 10:20:00'),
  (19, 1, 7, 'ORD-FEB-002', 'Pen Stand', 900, 'INR', '2026-02-04', 'customer159@example.com', '9876543359', 'Qamar Ali', 'delivered', 225, 'Flat 25%', 'pending', 30, '2026-03-06', true, '2026-02-04 14:00:00', '2026-02-04 14:00:00'),
  (19, 1, 7, 'ORD-FEB-003', 'Pencil Box', 1200, 'INR', '2026-02-06', 'customer160@example.com', '9876543360', 'Ruchi Reddy', 'delivered', 300, 'Flat 25%', 'pending', 30, '2026-03-08', true, '2026-02-06 11:30:00', '2026-02-06 11:30:00'),
  (19, 1, 7, 'ORD-FEB-004', 'Highlighter Set', 800, 'INR', '2026-02-08', 'customer161@example.com', '9876543361', 'Sameer Nair', 'delivered', 200, 'Flat 25%', 'pending', 30, '2026-03-10', true, '2026-02-08 15:45:00', '2026-02-08 15:45:00'),
  (19, 1, 7, 'ORD-FEB-005', 'Marker Set', 1500, 'INR', '2026-02-10', 'customer162@example.com', '9876543362', 'Tanuja Desai', 'delivered', 375, 'Flat 25%', 'pending', 30, '2026-03-12', true, '2026-02-10 09:15:00', '2026-02-10 09:15:00'),
  (19, 1, 7, 'ORD-FEB-006', 'Correction Tape', 600, 'INR', '2026-02-12', 'customer163@example.com', '9876543363', 'Usha Malhotra', 'delivered', 150, 'Flat 25%', 'pending', 30, '2026-03-14', true, '2026-02-12 13:00:00', '2026-02-12 13:00:00'),
  (19, 1, 7, 'ORD-FEB-007', 'Glue Stick', 400, 'INR', '2026-02-14', 'customer164@example.com', '9876543364', 'Vijay Kumar', 'delivered', 100, 'Flat 25%', 'pending', 30, '2026-03-16', true, '2026-02-14 16:20:00', '2026-02-14 16:20:00'),
  (19, 1, 7, 'ORD-FEB-008', 'Scissors', 700, 'INR', '2026-02-16', 'customer165@example.com', '9876543365', 'Wajida Khan', 'delivered', 175, 'Flat 25%', 'pending', 30, '2026-03-18', true, '2026-02-16 11:40:00', '2026-02-16 11:40:00'),
  (19, 1, 7, 'ORD-FEB-009', 'Ruler Set', 500, 'INR', '2026-02-18', 'customer166@example.com', '9876543366', 'Yadav Singh', 'delivered', 125, 'Flat 25%', 'pending', 30, '2026-03-20', true, '2026-02-18 14:10:00', '2026-02-18 14:10:00'),
  (19, 1, 7, 'ORD-FEB-010', 'Calculator', 2900, 'INR', '2026-02-20', 'customer167@example.com', '9876543367', 'Zainab Ahmed', 'delivered', 725, 'Flat 25%', 'pending', 30, '2026-03-22', true, '2026-02-20 10:30:00', '2026-02-20 10:30:00'),
  (19, 1, 7, 'ORD-FEB-011', 'Geometry Box', 1100, 'INR', '2026-02-22', 'customer168@example.com', '9876543368', 'Arjun Patel', 'delivered', 275, 'Flat 25%', 'pending', 30, '2026-03-24', true, '2026-02-22 15:00:00', '2026-02-22 15:00:00'),
  (19, 1, 7, 'ORD-FEB-012', 'Art Supplies', 6800, 'INR', '2026-02-24', 'customer169@example.com', '9876543369', 'Bhavna Roy', 'delivered', 1700, 'Flat 25%', 'pending', 30, '2026-03-26', true, '2026-02-24 12:45:00', '2026-02-24 12:45:00');

-- March 2026 - 15 orders so far, ₹85,200 total (recovery trend)
INSERT INTO hype_store_orders (hype_store_id, coupon_code_id, influencer_id, external_order_id, order_title, order_amount, order_currency, order_date, customer_email, customer_phone, customer_name, order_status, cashback_amount, cashback_type, cashback_status, return_period_days, return_period_ends_at, visible_to_influencer, created_at, updated_at)
VALUES
  (19, 1, 7, 'ORD-MAR-001', 'Water Painting Set', 3400, 'INR', '2026-03-02', 'customer170@example.com', '9876543370', 'Chandan Joshi', 'delivered', 850, 'Flat 25%', 'pending', 30, '2026-04-01', true, '2026-03-02 10:00:00', '2026-03-02 10:00:00'),
  (19, 1, 7, 'ORD-MAR-002', 'Acrylic Colors', 5900, 'INR', '2026-03-04', 'customer171@example.com', '9876543371', 'Divya Mehra', 'delivered', 1475, 'Flat 25%', 'pending', 30, '2026-04-03', true, '2026-03-04 14:15:00', '2026-03-04 14:15:00'),
  (19, 1, 7, 'ORD-MAR-003', 'Brush Set', 2800, 'INR', '2026-03-06', 'customer172@example.com', '9876543372', 'Esha Verma', 'delivered', 700, 'Flat 25%', 'pending', 30, '2026-04-05', true, '2026-03-06 11:30:00', '2026-03-06 11:30:00'),
  (19, 1, 7, 'ORD-MAR-004', 'Canvas Pack', 4200, 'INR', '2026-03-08', 'customer173@example.com', '9876543373', 'Faisal Khan', 'delivered', 1050, 'Flat 25%', 'pending', 30, '2026-04-07', true, '2026-03-08 15:45:00', '2026-03-08 15:45:00'),
  (19, 1, 7, 'ORD-MAR-005', 'Easel Stand', 7200, 'INR', '2026-03-10', 'customer174@example.com', '9876543374', 'Gauri Nair', 'delivered', 1800, 'Flat 25%', 'pending', 30, '2026-04-09', true, '2026-03-10 09:20:00', '2026-03-10 09:20:00'),
  (19, 1, 7, 'ORD-MAR-006', 'Palette', 1900, 'INR', '2026-03-12', 'customer175@example.com', '9876543375', 'Harsh Desai', 'delivered', 475, 'Flat 25%', 'pending', 30, '2026-04-11', true, '2026-03-12 13:00:00', '2026-03-12 13:00:00'),
  (19, 1, 7, 'ORD-MAR-007', 'Sketch Pencils', 2100, 'INR', '2026-03-13', 'customer176@example.com', '9876543376', 'Inder Singh', 'delivered', 525, 'Flat 25%', 'pending', 30, '2026-04-12', true, '2026-03-13 16:15:00', '2026-03-13 16:15:00'),
  (19, 1, 7, 'ORD-MAR-008', 'Charcoal Set', 1800, 'INR', '2026-03-14', 'customer177@example.com', '9876543377', 'Jaya Patel', 'delivered', 450, 'Flat 25%', 'pending', 30, '2026-04-13', true, '2026-03-14 10:45:00', '2026-03-14 10:45:00'),
  (19, 1, 7, 'ORD-MAR-009', 'Pastel Colors', 3600, 'INR', '2026-03-15', 'customer178@example.com', '9876543378', 'Kunal Sharma', 'delivered', 900, 'Flat 25%', 'pending', 30, '2026-04-14', true, '2026-03-15 14:20:00', '2026-03-15 14:20:00'),
  (19, 1, 7, 'ORD-MAR-010', 'Oil Colors', 8900, 'INR', '2026-03-16', 'customer179@example.com', '9876543379', 'Lata Reddy', 'delivered', 2225, 'Flat 25%', 'pending', 30, '2026-04-15', true, '2026-03-16 11:00:00', '2026-03-16 11:00:00'),
  (19, 1, 7, 'ORD-MAR-011', 'Palette Knife', 1500, 'INR', '2026-03-17', 'customer180@example.com', '9876543380', 'Mohit Gupta', 'delivered', 375, 'Flat 25%', 'pending', 30, '2026-04-16', true, '2026-03-17 15:30:00', '2026-03-17 15:30:00'),
  (19, 1, 7, 'ORD-MAR-012', 'Art Paper', 2400, 'INR', '2026-03-17', 'customer181@example.com', '9876543381', 'Neeta Roy', 'delivered', 600, 'Flat 25%', 'pending', 30, '2026-04-16', true, '2026-03-17 12:15:00', '2026-03-17 12:15:00'),
  (19, 1, 7, 'ORD-MAR-013', 'Ink Pen Set', 3200, 'INR', '2026-03-17', 'customer182@example.com', '9876543382', 'Om Joshi', 'delivered', 800, 'Flat 25%', 'pending', 30, '2026-04-16', true, '2026-03-17 09:40:00', '2026-03-17 09:40:00'),
  (19, 1, 7, 'ORD-MAR-014', 'Sketchbook', 2100, 'INR', '2026-03-17', 'customer183@example.com', '9876543383', 'Priya Malhotra', 'delivered', 525, 'Flat 25%', 'pending', 30, '2026-04-16', true, '2026-03-17 16:50:00', '2026-03-17 16:50:00'),
  (19, 1, 7, 'ORD-MAR-015', 'Crayons Pack', 1200, 'INR', '2026-03-17', 'customer184@example.com', '9876543384', 'Qasim Ahmed', 'delivered', 300, 'Flat 25%', 'pending', 30, '2026-04-16', true, '2026-03-17 13:25:00', '2026-03-17 13:25:00');

COMMIT;

-- Verification: Check monthly totals
SELECT
  TO_CHAR(order_date, 'YYYY-MM') as month,
  COUNT(*) as total_orders,
  ROUND(SUM(order_amount)::numeric, 2) as total_sales,
  ROUND(SUM(cashback_amount)::numeric, 2) as total_cashback
FROM hype_store_orders
WHERE hype_store_id = 19
  AND influencer_id = 7
GROUP BY TO_CHAR(order_date, 'YYYY-MM')
ORDER BY month;
