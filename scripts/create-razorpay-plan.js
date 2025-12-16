/**
 * Script to create Razorpay subscription plan for Pro Influencer
 *
 * Run this once to create the plan and get the RAZORPAY_PLAN_ID
 *
 * Usage:
 *   node scripts/create-razorpay-plan.js
 *
 * Make sure you have RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file
 */

require('dotenv').config();
const Razorpay = require('razorpay');

async function createProInfluencerPlan() {
  console.log('🚀 Creating Pro Influencer subscription plan...\n');

  // Initialize Razorpay
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  try {
    // Create the plan
    const plan = await razorpay.plans.create({
      period: 'monthly',
      interval: 1,
      item: {
        name: 'Pro Influencer Monthly Subscription',
        description: 'Monthly subscription for Pro Influencer features - Auto-renewable',
        amount: 19900, // Rs 199 in paise
        currency: 'INR',
      },
      notes: {
        description: 'Pro account subscription with auto-renewal',
        features: 'Unlimited campaigns, Priority support, Verified badge',
        billing_cycle: 'monthly',
      },
    });

    console.log('✅ Plan created successfully!\n');
    console.log('📋 Plan Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Plan ID:          ${plan.id}`);
    console.log(`Plan Name:        ${plan.item.name}`);
    console.log(`Amount:           ₹${plan.item.amount / 100}`);
    console.log(`Billing Cycle:    ${plan.interval} ${plan.period}`);
    console.log(`Currency:         ${plan.item.currency}`);
    console.log(`Status:           ${plan.item.active ? 'Active' : 'Inactive'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🔑 Add this to your .env file:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`RAZORPAY_PRO_PLAN_ID=${plan.id}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📝 Full Plan Response:');
    console.log(JSON.stringify(plan, null, 2));

    console.log('\n✅ Done! Copy the RAZORPAY_PRO_PLAN_ID to your .env file');
  } catch (error) {
    console.error('❌ Error creating plan:', error);
    console.error('\nError details:', error.error || error);

    if (error.statusCode === 401) {
      console.error('\n⚠️  Authentication failed. Please check:');
      console.error('   1. RAZORPAY_KEY_ID is correct in .env');
      console.error('   2. RAZORPAY_KEY_SECRET is correct in .env');
      console.error('   3. You are using the correct environment (test/live)');
    }

    process.exit(1);
  }
}

// Run the script
createProInfluencerPlan();
