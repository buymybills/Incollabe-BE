-- Seed payment_pending nudge message templates
-- Adds 1-hour and 6-hour payment reminder templates

INSERT INTO nudge_message_templates
  (title, body, message_type, rotation_order, priority, internal_notes)
VALUES
  -- 1-hour payment reminder (urgent)
  ('You''re just one step away! 🎯',
   'Complete your MAX subscription and unlock unlimited campaign applications for just ₹199/month',
   'payment_pending_1h', NULL, 100, 'Sent 1 hour after payment is pending - urgent call to action'),

  -- 6-hour payment reminder (follow-up)
  ('Still thinking? 🤔',
   'Your exclusive MAX offer is waiting! Unlock unlimited applications + premium features',
   'payment_pending_6h', NULL, 100, 'Sent 6 hours after payment is pending - follow-up with benefits');
