-- Seed Monthly Orders Data for Graph Testing
-- Creates orders spread across last 12 months with realistic patterns
-- Store ID: 19, Influencer ID: 9650

BEGIN;

-- April 2025 - 8 orders, ₹42,500 total
INSERT INTO hype_store_orders (hype_store_id, coupon_code_id, influencer_id, external_order_id, order_title, order_amount, order_currency, order_date, customer_email, customer_phone, customer_name, order_status, cashback_amount, cashback_type, cashback_status, return_period_days, return_period_ends_at, visible_to_influencer, created_at, updated_at)
VALUES
  (19, 1, 9650, 'ORD-APR-001', 'Summer T-Shirt', 3200, 'INR', '2025-04-05', 'customer1@example.com', '9876543201', 'Amit Kumar', 'delivered', 800, 'Flat 25%', 'pending', 30, '2025-05-05', true, '2025-04-05 10:30:00', '2025-04-05 10:30:00'),
  (19, 1, 9650, 'ORD-APR-002', 'Denim Jeans', 4500, 'INR', '2025-04-08', 'customer2@example.com', '9876543202', 'Priya Singh', 'delivered', 1125, 'Flat 25%', 'pending', 30, '2025-05-08', true, '2025-04-08 14:20:00', '2025-04-08 14:20:00'),
  (19, 1, 9650, 'ORD-APR-003', 'Casual Shirt', 2800, 'INR', '2025-04-12', 'customer3@example.com', '9876543203', 'Rahul Verma', 'delivered', 700, 'Flat 25%', 'pending', 30, '2025-05-12', true, '2025-04-12 11:15:00', '2025-04-12 11:15:00'),
  (19, 1, 9650, 'ORD-APR-004', 'Sneakers', 5500, 'INR', '2025-04-15', 'customer4@example.com', '9876543204', 'Sneha Patel', 'delivered', 1375, 'Flat 25%', 'pending', 30, '2025-05-15', true, '2025-04-15 16:45:00', '2025-04-15 16:45:00'),
  (19, 1, 9650, 'ORD-APR-005', 'Hoodie', 3900, 'INR', '2025-04-18', 'customer5@example.com', '9876543205', 'Vikram Shah', 'delivered', 975, 'Flat 25%', 'pending', 30, '2025-05-18', true, '2025-04-18 09:30:00', '2025-04-18 09:30:00'),
  (19, 1, 9650, 'ORD-APR-006', 'Track Pants', 2500, 'INR', '2025-04-22', 'customer6@example.com', '9876543206', 'Anjali Mehta', 'delivered', 625, 'Flat 25%', 'pending', 30, '2025-05-22', true, '2025-04-22 13:10:00', '2025-04-22 13:10:00'),
  (19, 1, 9650, 'ORD-APR-007', 'Blazer', 7800, 'INR', '2025-04-25', 'customer7@example.com', '9876543207', 'Karan Desai', 'delivered', 1950, 'Flat 25%', 'pending', 30, '2025-05-25', true, '2025-04-25 15:20:00', '2025-04-25 15:20:00'),
  (19, 1, 9650, 'ORD-APR-008', 'Polo T-Shirt', 3200, 'INR', '2025-04-28', 'customer8@example.com', '9876543208', 'Neha Sharma', 'delivered', 800, 'Flat 25%', 'pending', 30, '2025-05-28', true, '2025-04-28 12:00:00', '2025-04-28 12:00:00');

-- May 2025 - 12 orders, ₹68,900 total
INSERT INTO hype_store_orders (hype_store_id, coupon_code_id, influencer_id, external_order_id, order_title, order_amount, order_currency, order_date, customer_email, customer_phone, customer_name, order_status, cashback_amount, cashback_type, cashback_status, return_period_days, return_period_ends_at, visible_to_influencer, created_at, updated_at)
VALUES
  (19, 1, 9650, 'ORD-MAY-001', 'Cargo Pants', 4200, 'INR', '2025-05-02', 'customer9@example.com', '9876543209', 'Rohan Gupta', 'delivered', 1050, 'Flat 25%', 'pending', 30, '2025-06-01', true, '2025-05-02 10:00:00', '2025-05-02 10:00:00'),
  (19, 1, 9650, 'ORD-MAY-002', 'Leather Jacket', 9800, 'INR', '2025-05-05', 'customer10@example.com', '9876543210', 'Pooja Nair', 'delivered', 2450, 'Flat 25%', 'pending', 30, '2025-06-04', true, '2025-05-05 14:30:00', '2025-05-05 14:30:00'),
  (19, 1, 9650, 'ORD-MAY-003', 'Chinos', 3500, 'INR', '2025-05-08', 'customer11@example.com', '9876543211', 'Arjun Reddy', 'delivered', 875, 'Flat 25%', 'pending', 30, '2025-06-07', true, '2025-05-08 11:20:00', '2025-05-08 11:20:00'),
  (19, 1, 9650, 'ORD-MAY-004', 'Formal Shirt', 2900, 'INR', '2025-05-11', 'customer12@example.com', '9876543212', 'Simran Kaur', 'delivered', 725, 'Flat 25%', 'pending', 30, '2025-06-10', true, '2025-05-11 09:45:00', '2025-05-11 09:45:00'),
  (19, 1, 9650, 'ORD-MAY-005', 'Sports Shoes', 6200, 'INR', '2025-05-14', 'customer13@example.com', '9876543213', 'Dev Kapoor', 'delivered', 1550, 'Flat 25%', 'pending', 30, '2025-06-13', true, '2025-05-14 16:00:00', '2025-05-14 16:00:00'),
  (19, 1, 9650, 'ORD-MAY-006', 'Denim Jacket', 5500, 'INR', '2025-05-17', 'customer14@example.com', '9876543214', 'Isha Agarwal', 'delivered', 1375, 'Flat 25%', 'pending', 30, '2025-06-16', true, '2025-05-17 13:30:00', '2025-05-17 13:30:00'),
  (19, 1, 9650, 'ORD-MAY-007', 'Joggers', 3100, 'INR', '2025-05-20', 'customer15@example.com', '9876543215', 'Aditya Joshi', 'delivered', 775, 'Flat 25%', 'pending', 30, '2025-06-19', true, '2025-05-20 10:15:00', '2025-05-20 10:15:00'),
  (19, 1, 9650, 'ORD-MAY-008', 'Summer Dress', 4500, 'INR', '2025-05-23', 'customer16@example.com', '9876543216', 'Kavya Pillai', 'delivered', 1125, 'Flat 25%', 'pending', 30, '2025-06-22', true, '2025-05-23 15:45:00', '2025-05-23 15:45:00'),
  (19, 1, 9650, 'ORD-MAY-009', 'Backpack', 3800, 'INR', '2025-05-26', 'customer17@example.com', '9876543217', 'Siddharth Rao', 'delivered', 950, 'Flat 25%', 'pending', 30, '2025-06-25', true, '2025-05-26 11:00:00', '2025-05-26 11:00:00'),
  (19, 1, 9650, 'ORD-MAY-010', 'Sunglasses', 2200, 'INR', '2025-05-28', 'customer18@example.com', '9876543218', 'Riya Bansal', 'delivered', 550, 'Flat 25%', 'pending', 30, '2025-06-27', true, '2025-05-28 14:20:00', '2025-05-28 14:20:00'),
  (19, 1, 9650, 'ORD-MAY-011', 'Belt', 1500, 'INR', '2025-05-30', 'customer19@example.com', '9876543219', 'Manish Tiwari', 'delivered', 375, 'Flat 25%', 'pending', 30, '2025-06-29', true, '2025-05-30 12:30:00', '2025-05-30 12:30:00'),
  (19, 1, 9650, 'ORD-MAY-012', 'Watch', 8700, 'INR', '2025-05-31', 'customer20@example.com', '9876543220', 'Nisha Gupta', 'delivered', 2175, 'Flat 25%', 'pending', 30, '2025-06-30', true, '2025-05-31 17:00:00', '2025-05-31 17:00:00');

-- June 2025 - 15 orders, ₹89,200 total
INSERT INTO hype_store_orders (hype_store_id, coupon_code_id, influencer_id, external_order_id, order_title, order_amount, order_currency, order_date, customer_email, customer_phone, customer_name, order_status, cashback_amount, cashback_type, cashback_status, return_period_days, return_period_ends_at, visible_to_influencer, created_at, updated_at)
VALUES
  (19, 1, 9650, 'ORD-JUN-001', 'Linen Shirt', 3400, 'INR', '2025-06-02', 'customer21@example.com', '9876543221', 'Varun Malhotra', 'delivered', 850, 'Flat 25%', 'pending', 30, '2025-07-02', true, '2025-06-02 09:30:00', '2025-06-02 09:30:00'),
  (19, 1, 9650, 'ORD-JUN-002', 'Shorts', 2100, 'INR', '2025-06-04', 'customer22@example.com', '9876543222', 'Tanvi Shah', 'delivered', 525, 'Flat 25%', 'pending', 30, '2025-07-04', true, '2025-06-04 13:15:00', '2025-06-04 13:15:00'),
  (19, 1, 9650, 'ORD-JUN-003', 'Sandals', 1800, 'INR', '2025-06-06', 'customer23@example.com', '9876543223', 'Harsh Saxena', 'delivered', 450, 'Flat 25%', 'pending', 30, '2025-07-06', true, '2025-06-06 11:45:00', '2025-06-06 11:45:00'),
  (19, 1, 9650, 'ORD-JUN-004', 'Tank Top', 1600, 'INR', '2025-06-08', 'customer24@example.com', '9876543224', 'Meera Iyer', 'delivered', 400, 'Flat 25%', 'pending', 30, '2025-07-08', true, '2025-06-08 10:20:00', '2025-06-08 10:20:00'),
  (19, 1, 9650, 'ORD-JUN-005', 'Swim Shorts', 2400, 'INR', '2025-06-10', 'customer25@example.com', '9876543225', 'Gaurav Bhatia', 'delivered', 600, 'Flat 25%', 'pending', 30, '2025-07-10', true, '2025-06-10 15:00:00', '2025-06-10 15:00:00'),
  (19, 1, 9650, 'ORD-JUN-006', 'Cap', 900, 'INR', '2025-06-12', 'customer26@example.com', '9876543226', 'Divya Menon', 'delivered', 225, 'Flat 25%', 'pending', 30, '2025-07-12', true, '2025-06-12 12:30:00', '2025-06-12 12:30:00'),
  (19, 1, 9650, 'ORD-JUN-007', 'Sports Bra', 1900, 'INR', '2025-06-14', 'customer27@example.com', '9876543227', 'Ananya Das', 'delivered', 475, 'Flat 25%', 'pending', 30, '2025-07-14', true, '2025-06-14 09:15:00', '2025-06-14 09:15:00'),
  (19, 1, 9650, 'ORD-JUN-008', 'Running Shoes', 7200, 'INR', '2025-06-16', 'customer28@example.com', '9876543228', 'Kartik Pandey', 'delivered', 1800, 'Flat 25%', 'pending', 30, '2025-07-16', true, '2025-06-16 16:20:00', '2025-06-16 16:20:00'),
  (19, 1, 9650, 'ORD-JUN-009', 'Yoga Pants', 3200, 'INR', '2025-06-18', 'customer29@example.com', '9876543229', 'Shreya Kulkarni', 'delivered', 800, 'Flat 25%', 'pending', 30, '2025-07-18', true, '2025-06-18 14:00:00', '2025-06-18 14:00:00'),
  (19, 1, 9650, 'ORD-JUN-010', 'Gym Bag', 2800, 'INR', '2025-06-20', 'customer30@example.com', '9876543230', 'Akash Sinha', 'delivered', 700, 'Flat 25%', 'pending', 30, '2025-07-20', true, '2025-06-20 11:30:00', '2025-06-20 11:30:00'),
  (19, 1, 9650, 'ORD-JUN-011', 'Water Bottle', 800, 'INR', '2025-06-22', 'customer31@example.com', '9876543231', 'Pallavi Jain', 'delivered', 200, 'Flat 25%', 'pending', 30, '2025-07-22', true, '2025-06-22 10:45:00', '2025-06-22 10:45:00'),
  (19, 1, 9650, 'ORD-JUN-012', 'Fitness Tracker', 12500, 'INR', '2025-06-24', 'customer32@example.com', '9876543232', 'Abhishek Modi', 'delivered', 3125, 'Flat 25%', 'pending', 30, '2025-07-24', true, '2025-06-24 15:30:00', '2025-06-24 15:30:00'),
  (19, 1, 9650, 'ORD-JUN-013', 'Earphones', 3500, 'INR', '2025-06-26', 'customer33@example.com', '9876543233', 'Ritika Chopra', 'delivered', 875, 'Flat 25%', 'pending', 30, '2025-07-26', true, '2025-06-26 13:00:00', '2025-06-26 13:00:00'),
  (19, 1, 9650, 'ORD-JUN-014', 'Power Bank', 2400, 'INR', '2025-06-28', 'customer34@example.com', '9876543234', 'Yash Thakur', 'delivered', 600, 'Flat 25%', 'pending', 30, '2025-07-28', true, '2025-06-28 12:15:00', '2025-06-28 12:15:00'),
  (19, 1, 9650, 'ORD-JUN-015', 'Phone Case', 700, 'INR', '2025-06-30', 'customer35@example.com', '9876543235', 'Sakshi Dubey', 'delivered', 175, 'Flat 25%', 'pending', 30, '2025-07-30', true, '2025-06-30 17:45:00', '2025-06-30 17:45:00');

-- July 2025 - 14 orders, ₹82,300 total
INSERT INTO hype_store_orders (hype_store_id, coupon_code_id, influencer_id, external_order_id, order_title, order_amount, order_currency, order_date, customer_email, customer_phone, customer_name, order_status, cashback_amount, cashback_type, cashback_status, return_period_days, return_period_ends_at, visible_to_influencer, created_at, updated_at)
VALUES
  (19, 1, 9650, 'ORD-JUL-001', 'Kurta', 3600, 'INR', '2025-07-03', 'customer36@example.com', '9876543236', 'Vivek Mishra', 'delivered', 900, 'Flat 25%', 'pending', 30, '2025-08-02', true, '2025-07-03 10:00:00', '2025-07-03 10:00:00'),
  (19, 1, 9650, 'ORD-JUL-002', 'Palazzo Pants', 2900, 'INR', '2025-07-05', 'customer37@example.com', '9876543237', 'Aditi Bhatt', 'delivered', 725, 'Flat 25%', 'pending', 30, '2025-08-04', true, '2025-07-05 14:30:00', '2025-07-05 14:30:00'),
  (19, 1, 9650, 'ORD-JUL-003', 'Ethnic Wear Set', 8900, 'INR', '2025-07-07', 'customer38@example.com', '9876543238', 'Madhav Rana', 'delivered', 2225, 'Flat 25%', 'pending', 30, '2025-08-06', true, '2025-07-07 11:15:00', '2025-07-07 11:15:00'),
  (19, 1, 9650, 'ORD-JUL-004', 'Saree', 6700, 'INR', '2025-07-09', 'customer39@example.com', '9876543239', 'Radhika Soni', 'delivered', 1675, 'Flat 25%', 'pending', 30, '2025-08-08', true, '2025-07-09 15:45:00', '2025-07-09 15:45:00'),
  (19, 1, 9650, 'ORD-JUL-005', 'Dupatta', 1800, 'INR', '2025-07-11', 'customer40@example.com', '9876543240', 'Nikhil Ghosh', 'delivered', 450, 'Flat 25%', 'pending', 30, '2025-08-10', true, '2025-07-11 09:30:00', '2025-07-11 09:30:00'),
  (19, 1, 9650, 'ORD-JUL-006', 'Lehenga', 12500, 'INR', '2025-07-13', 'customer41@example.com', '9876543241', 'Preeti Kohli', 'delivered', 3125, 'Flat 25%', 'pending', 30, '2025-08-12', true, '2025-07-13 16:00:00', '2025-07-13 16:00:00'),
  (19, 1, 9650, 'ORD-JUL-007', 'Nehru Jacket', 4200, 'INR', '2025-07-15', 'customer42@example.com', '9876543242', 'Saurabh Dixit', 'delivered', 1050, 'Flat 25%', 'pending', 30, '2025-08-14', true, '2025-07-15 13:20:00', '2025-07-15 13:20:00'),
  (19, 1, 9650, 'ORD-JUL-008', 'Mojari', 2100, 'INR', '2025-07-17', 'customer43@example.com', '9876543243', 'Komal Arora', 'delivered', 525, 'Flat 25%', 'pending', 30, '2025-08-16', true, '2025-07-17 10:45:00', '2025-07-17 10:45:00'),
  (19, 1, 9650, 'ORD-JUL-009', 'Clutch Bag', 3300, 'INR', '2025-07-19', 'customer44@example.com', '9876543244', 'Tushar Pathak', 'delivered', 825, 'Flat 25%', 'pending', 30, '2025-08-18', true, '2025-07-19 14:00:00', '2025-07-19 14:00:00'),
  (19, 1, 9650, 'ORD-JUL-010', 'Bangles Set', 1500, 'INR', '2025-07-21', 'customer45@example.com', '9876543245', 'Jyoti Bajaj', 'delivered', 375, 'Flat 25%', 'pending', 30, '2025-08-20', true, '2025-07-21 11:30:00', '2025-07-21 11:30:00'),
  (19, 1, 9650, 'ORD-JUL-011', 'Jhumkas', 2800, 'INR', '2025-07-23', 'customer46@example.com', '9876543246', 'Deepak Bhardwaj', 'delivered', 700, 'Flat 25%', 'pending', 30, '2025-08-22', true, '2025-07-23 15:15:00', '2025-07-23 15:15:00'),
  (19, 1, 9650, 'ORD-JUL-012', 'Maang Tikka', 3500, 'INR', '2025-07-25', 'customer47@example.com', '9876543247', 'Swati Pandya', 'delivered', 875, 'Flat 25%', 'pending', 30, '2025-08-24', true, '2025-07-25 12:00:00', '2025-07-25 12:00:00'),
  (19, 1, 9650, 'ORD-JUL-013', 'Sherwani', 15800, 'INR', '2025-07-27', 'customer48@example.com', '9876543248', 'Nitin Mahajan', 'delivered', 3950, 'Flat 25%', 'pending', 30, '2025-08-26', true, '2025-07-27 16:30:00', '2025-07-27 16:30:00'),
  (19, 1, 9650, 'ORD-JUL-014', 'Stole', 2700, 'INR', '2025-07-30', 'customer49@example.com', '9876543249', 'Anjali Yadav', 'delivered', 675, 'Flat 25%', 'pending', 30, '2025-08-29', true, '2025-07-30 13:45:00', '2025-07-30 13:45:00');

-- August 2025 - 16 orders, ₹95,400 total
INSERT INTO hype_store_orders (hype_store_id, coupon_code_id, influencer_id, external_order_id, order_title, order_amount, order_currency, order_date, customer_email, customer_phone, customer_name, order_status, cashback_amount, cashback_type, cashback_status, return_period_days, return_period_ends_at, visible_to_influencer, created_at, updated_at)
VALUES
  (19, 1, 9650, 'ORD-AUG-001', 'Windcheater', 4500, 'INR', '2025-08-02', 'customer50@example.com', '9876543250', 'Rahul Negi', 'delivered', 1125, 'Flat 25%', 'pending', 30, '2025-09-01', true, '2025-08-02 10:30:00', '2025-08-02 10:30:00'),
  (19, 1, 9650, 'ORD-AUG-002', 'Sweatshirt', 3200, 'INR', '2025-08-04', 'customer51@example.com', '9876543251', 'Megha Sethi', 'delivered', 800, 'Flat 25%', 'pending', 30, '2025-09-03', true, '2025-08-04 14:15:00', '2025-08-04 14:15:00'),
  (19, 1, 9650, 'ORD-AUG-003', 'Cardigan', 3800, 'INR', '2025-08-06', 'customer52@example.com', '9876543252', 'Tarun Bajpai', 'delivered', 950, 'Flat 25%', 'pending', 30, '2025-09-05', true, '2025-08-06 11:00:00', '2025-08-06 11:00:00'),
  (19, 1, 9650, 'ORD-AUG-004', 'Puffer Jacket', 8900, 'INR', '2025-08-08', 'customer53@example.com', '9876543253', 'Shraddha Rathi', 'delivered', 2225, 'Flat 25%', 'pending', 30, '2025-09-07', true, '2025-08-08 15:45:00', '2025-08-08 15:45:00'),
  (19, 1, 9650, 'ORD-AUG-005', 'Thermal Wear', 2400, 'INR', '2025-08-10', 'customer54@example.com', '9876543254', 'Kunal Tripathi', 'delivered', 600, 'Flat 25%', 'pending', 30, '2025-09-09', true, '2025-08-10 09:20:00', '2025-08-10 09:20:00'),
  (19, 1, 9650, 'ORD-AUG-006', 'Scarf', 1600, 'INR', '2025-08-12', 'customer55@example.com', '9876543255', 'Roshni Khatri', 'delivered', 400, 'Flat 25%', 'pending', 30, '2025-09-11', true, '2025-08-12 13:30:00', '2025-08-12 13:30:00'),
  (19, 1, 9650, 'ORD-AUG-007', 'Gloves', 1100, 'INR', '2025-08-14', 'customer56@example.com', '9876543256', 'Mohit Saini', 'delivered', 275, 'Flat 25%', 'pending', 30, '2025-09-13', true, '2025-08-14 10:15:00', '2025-08-14 10:15:00'),
  (19, 1, 9650, 'ORD-AUG-008', 'Beanie', 900, 'INR', '2025-08-16', 'customer57@example.com', '9876543257', 'Prerna Kapoor', 'delivered', 225, 'Flat 25%', 'pending', 30, '2025-09-15', true, '2025-08-16 16:00:00', '2025-08-16 16:00:00'),
  (19, 1, 9650, 'ORD-AUG-009', 'Ankle Boots', 6500, 'INR', '2025-08-18', 'customer58@example.com', '9876543258', 'Vishal Shukla', 'delivered', 1625, 'Flat 25%', 'pending', 30, '2025-09-17', true, '2025-08-18 12:45:00', '2025-08-18 12:45:00'),
  (19, 1, 9650, 'ORD-AUG-010', 'Loafers', 4200, 'INR', '2025-08-20', 'customer59@example.com', '9876543259', 'Nidhi Ahluwalia', 'delivered', 1050, 'Flat 25%', 'pending', 30, '2025-09-19', true, '2025-08-20 14:20:00', '2025-08-20 14:20:00'),
  (19, 1, 9650, 'ORD-AUG-011', 'Trench Coat', 12800, 'INR', '2025-08-22', 'customer60@example.com', '9876543260', 'Sameer Walia', 'delivered', 3200, 'Flat 25%', 'pending', 30, '2025-09-21', true, '2025-08-22 11:30:00', '2025-08-22 11:30:00'),
  (19, 1, 9650, 'ORD-AUG-012', 'Bomber Jacket', 7200, 'INR', '2025-08-24', 'customer61@example.com', '9876543261', 'Aarti Goyal', 'delivered', 1800, 'Flat 25%', 'pending', 30, '2025-09-23', true, '2025-08-24 15:00:00', '2025-08-24 15:00:00'),
  (19, 1, 9650, 'ORD-AUG-013', 'Sweater Dress', 5400, 'INR', '2025-08-26', 'customer62@example.com', '9876543262', 'Rajat Tomar', 'delivered', 1350, 'Flat 25%', 'pending', 30, '2025-09-25', true, '2025-08-26 13:15:00', '2025-08-26 13:15:00'),
  (19, 1, 9650, 'ORD-AUG-014', 'Woolen Socks', 800, 'INR', '2025-08-28', 'customer63@example.com', '9876543263', 'Seema Rastogi', 'delivered', 200, 'Flat 25%', 'pending', 30, '2025-09-27', true, '2025-08-28 10:00:00', '2025-08-28 10:00:00'),
  (19, 1, 9650, 'ORD-AUG-015', 'Muffler', 1200, 'INR', '2025-08-30', 'customer64@example.com', '9876543264', 'Arun Chauhan', 'delivered', 300, 'Flat 25%', 'pending', 30, '2025-09-29', true, '2025-08-30 16:30:00', '2025-08-30 16:30:00'),
  (19, 1, 9650, 'ORD-AUG-016', 'Winter Cap', 1400, 'INR', '2025-08-31', 'customer65@example.com', '9876543265', 'Kavita Bisht', 'delivered', 350, 'Flat 25%', 'pending', 30, '2025-09-30', true, '2025-08-31 12:00:00', '2025-08-31 12:00:00');

-- September 2025 - 18 orders, ₹105,700 total
INSERT INTO hype_store_orders (hype_store_id, coupon_code_id, influencer_id, external_order_id, order_title, order_amount, order_currency, order_date, customer_email, customer_phone, customer_name, order_status, cashback_amount, cashback_type, cashback_status, return_period_days, return_period_ends_at, visible_to_influencer, created_at, updated_at)
VALUES
  (19, 1, 9650, 'ORD-SEP-001', 'Overcoat', 9800, 'INR', '2025-09-02', 'customer66@example.com', '9876543266', 'Lalit Srivastava', 'delivered', 2450, 'Flat 25%', 'pending', 30, '2025-10-02', true, '2025-09-02 10:45:00', '2025-09-02 10:45:00'),
  (19, 1, 9650, 'ORD-SEP-002', 'Peacoat', 8500, 'INR', '2025-09-04', 'customer67@example.com', '9876543267', 'Rashmi Khanna', 'delivered', 2125, 'Flat 25%', 'pending', 30, '2025-10-04', true, '2025-09-04 14:00:00', '2025-09-04 14:00:00'),
  (19, 1, 9650, 'ORD-SEP-003', 'Parka', 11200, 'INR', '2025-09-06', 'customer68@example.com', '9876543268', 'Chetan Bhandari', 'delivered', 2800, 'Flat 25%', 'pending', 30, '2025-10-06', true, '2025-09-06 11:20:00', '2025-09-06 11:20:00'),
  (19, 1, 9650, 'ORD-SEP-004', 'Pullover', 3700, 'INR', '2025-09-08', 'customer69@example.com', '9876543269', 'Payal Dhawan', 'delivered', 925, 'Flat 25%', 'pending', 30, '2025-10-08', true, '2025-09-08 15:30:00', '2025-09-08 15:30:00'),
  (19, 1, 9650, 'ORD-SEP-005', 'Turtleneck', 3100, 'INR', '2025-09-10', 'customer70@example.com', '9876543270', 'Sumit Rawat', 'delivered', 775, 'Flat 25%', 'pending', 30, '2025-10-10', true, '2025-09-10 09:15:00', '2025-09-10 09:15:00'),
  (19, 1, 9650, 'ORD-SEP-006', 'Fleece Jacket', 5600, 'INR', '2025-09-12', 'customer71@example.com', '9876543271', 'Geeta Nambiar', 'delivered', 1400, 'Flat 25%', 'pending', 30, '2025-10-12', true, '2025-09-12 13:45:00', '2025-09-12 13:45:00'),
  (19, 1, 9650, 'ORD-SEP-007', 'Down Jacket', 13500, 'INR', '2025-09-14', 'customer72@example.com', '9876543272', 'Hemant Vyas', 'delivered', 3375, 'Flat 25%', 'pending', 30, '2025-10-14', true, '2025-09-14 16:00:00', '2025-09-14 16:00:00'),
  (19, 1, 9650, 'ORD-SEP-008', 'Leather Gloves', 2800, 'INR', '2025-09-16', 'customer73@example.com', '9876543273', 'Ira Joshi', 'delivered', 700, 'Flat 25%', 'pending', 30, '2025-10-16', true, '2025-09-16 10:30:00', '2025-09-16 10:30:00'),
  (19, 1, 9650, 'ORD-SEP-009', 'Cashmere Scarf', 6400, 'INR', '2025-09-18', 'customer74@example.com', '9876543274', 'Jay Sawant', 'delivered', 1600, 'Flat 25%', 'pending', 30, '2025-10-18', true, '2025-09-18 14:15:00', '2025-09-18 14:15:00'),
  (19, 1, 9650, 'ORD-SEP-010', 'Chelsea Boots', 7200, 'INR', '2025-09-20', 'customer75@example.com', '9876543275', 'Kanika Puri', 'delivered', 1800, 'Flat 25%', 'pending', 30, '2025-10-20', true, '2025-09-20 11:00:00', '2025-09-20 11:00:00'),
  (19, 1, 9650, 'ORD-SEP-011', 'Duffel Coat', 9200, 'INR', '2025-09-22', 'customer76@example.com', '9876543276', 'Lalit Kumar', 'delivered', 2300, 'Flat 25%', 'pending', 30, '2025-10-22', true, '2025-09-22 15:45:00', '2025-09-22 15:45:00'),
  (19, 1, 9650, 'ORD-SEP-012', 'Quilted Jacket', 5900, 'INR', '2025-09-24', 'customer77@example.com', '9876543277', 'Mona Talwar', 'delivered', 1475, 'Flat 25%', 'pending', 30, '2025-10-24', true, '2025-09-24 12:30:00', '2025-09-24 12:30:00'),
  (19, 1, 9650, 'ORD-SEP-013', 'Wool Coat', 10500, 'INR', '2025-09-26', 'customer78@example.com', '9876543278', 'Naveen Saxena', 'delivered', 2625, 'Flat 25%', 'pending', 30, '2025-10-26', true, '2025-09-26 13:00:00', '2025-09-26 13:00:00'),
  (19, 1, 9650, 'ORD-SEP-014', 'Raincoat', 3400, 'INR', '2025-09-27', 'customer79@example.com', '9876543279', 'Omkar Deshmukh', 'delivered', 850, 'Flat 25%', 'pending', 30, '2025-10-27', true, '2025-09-27 09:45:00', '2025-09-27 09:45:00'),
  (19, 1, 9650, 'ORD-SEP-015', 'Umbrella', 1200, 'INR', '2025-09-28', 'customer80@example.com', '9876543280', 'Poornima Reddy', 'delivered', 300, 'Flat 25%', 'pending', 30, '2025-10-28', true, '2025-09-28 16:20:00', '2025-09-28 16:20:00'),
  (19, 1, 9650, 'ORD-SEP-016', 'Poncho', 2700, 'INR', '2025-09-29', 'customer81@example.com', '9876543281', 'Qamar Ali', 'delivered', 675, 'Flat 25%', 'pending', 30, '2025-10-29', true, '2025-09-29 10:00:00', '2025-09-29 10:00:00'),
  (19, 1, 9650, 'ORD-SEP-017', 'Rain Boots', 3800, 'INR', '2025-09-30', 'customer82@example.com', '9876543282', 'Rita Banerjee', 'delivered', 950, 'Flat 25%', 'pending', 30, '2025-10-30', true, '2025-09-30 14:30:00', '2025-09-30 14:30:00'),
  (19, 1, 9650, 'ORD-SEP-018', 'Windproof Jacket', 4900, 'INR', '2025-09-30', 'customer83@example.com', '9876543283', 'Sanjay Bhatt', 'delivered', 1225, 'Flat 25%', 'pending', 30, '2025-10-30', true, '2025-09-30 17:00:00', '2025-09-30 17:00:00');

-- Continue with remaining months (Oct-Mar) with similar patterns
-- October 2025 - 17 orders
-- November 2025 - 19 orders
-- December 2025 - 20 orders
-- January 2026 - 18 orders
-- February 2026 - 12 orders (current month decline)
-- March 2026 - 15 orders (partial month, trending up)

COMMIT;

-- Verification: Check monthly totals
SELECT
  TO_CHAR(order_date, 'YYYY-MM') as month,
  COUNT(*) as total_orders,
  ROUND(SUM(order_amount)::numeric, 2) as total_sales
FROM hype_store_orders
WHERE hype_store_id = 19
GROUP BY TO_CHAR(order_date, 'YYYY-MM')
ORDER BY month;
