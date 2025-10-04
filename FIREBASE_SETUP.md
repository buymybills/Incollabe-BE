# Firebase Setup Documentation

## Overview

This document provides complete instructions for using Firebase services in the Collabkaroo backend application. The Firebase integration includes authentication, push notifications, and cloud storage capabilities.

## Components Created

### 1. Core Services
- `src/shared/firebase.service.ts` - Main Firebase service
- `src/shared/notification.service.ts` - High-level notification utilities
- `src/shared/firebase.module.ts` - Firebase module configuration

### 2. Authentication Components
- `src/auth/guards/firebase-auth.guard.ts` - Firebase authentication guard
- `src/auth/decorators/firebase-user.decorator.ts` - Current user decorator

### 3. API Controller
- `src/firebase/firebase.controller.ts` - REST API endpoints for Firebase operations
- `src/firebase/dto/firebase.dto.ts` - Data transfer objects

## Setup Instructions

### 1. Service Account Configuration

The Firebase service account key is already configured:
- Location: `collabkaroo-firebase-adminsdk.json` (root directory)
- Added to `.gitignore` for security

### 2. Environment Configuration

No additional environment variables needed - the service reads directly from the service account file.

### 3. Module Integration

Firebase is integrated into the application through:
```typescript
// Already added to app.module.ts
imports: [
  // ...
  FirebaseModule,
  // ...
]
```

## Usage Examples

### 1. Using FirebaseService in Controllers

```typescript
import { FirebaseService } from '../shared/firebase.service';

@Injectable()
export class YourService {
  constructor(private firebaseService: FirebaseService) {}

  async createUser(email: string, password: string) {
    return await this.firebaseService.createUser({
      email,
      password,
      emailVerified: false
    });
  }

  async verifyToken(token: string) {
    return await this.firebaseService.verifyIdToken(token);
  }
}
```

### 2. Using Firebase Authentication Guard

```typescript
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { FirebaseUser } from '../auth/decorators/firebase-user.decorator';

@Controller('protected')
@UseGuards(FirebaseAuthGuard)
export class ProtectedController {
  @Get('profile')
  getProfile(@FirebaseUser() user: DecodedIdToken) {
    return { uid: user.uid, email: user.email };
  }

  @Get('public')
  @Public() // Bypass authentication for this endpoint
  getPublicData() {
    return { message: 'This is public' };
  }
}
```

### 3. Sending Push Notifications

```typescript
import { NotificationService } from '../shared/notification.service';

@Injectable()
export class CampaignService {
  constructor(private notificationService: NotificationService) {}

  async inviteInfluencers(fcmTokens: string[], campaignName: string, brandName: string) {
    return await this.notificationService.sendCampaignInviteNotification(
      fcmTokens,
      campaignName,
      brandName
    );
  }
}
```

## API Endpoints

The Firebase controller provides these REST endpoints:

### Authentication
- `POST /firebase/users` - Create Firebase user
- `GET /firebase/users/me` - Get current user
- `GET /firebase/users/:uid` - Get user by UID
- `POST /firebase/users/:uid` - Update user
- `POST /firebase/users/:uid/claims` - Set custom claims
- `POST /firebase/users/:uid/custom-token` - Create custom token

### Push Notifications
- `POST /firebase/notifications/send` - Send to specific tokens
- `POST /firebase/notifications/topic` - Send to topic
- `POST /firebase/topics/subscribe` - Subscribe to topic
- `POST /firebase/topics/unsubscribe` - Unsubscribe from topic

## Firebase Configuration

The service is configured with:
- Project ID: `collabkaroo`
- Service Account: `firebase-adminsdk-fbsvc@collabkaroo.iam.gserviceaccount.com`
- Enabled services: Authentication, Cloud Messaging, Firestore, Storage

## Security Considerations

1. **Service Account Key**: Stored locally, added to `.gitignore`
2. **Authentication**: Uses Firebase ID tokens for verification
3. **Authorization**: Custom claims can be set for role-based access
4. **API Protection**: Most endpoints require Firebase authentication

## Client-Side Integration

For client applications, use the Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyADERgvs_2t21fDHTSpwXzwxFdUZCJabic",
  authDomain: "collabkaroo.firebaseapp.com",
  projectId: "collabkaroo",
  storageBucket: "collabkaroo.firebasestorage.app",
  messagingSenderId: "653234338070",
  appId: "1:653234338070:web:79580c4c45d021d426f837",
  measurementId: "G-W1S5SZR4YG"
};
```

## Common Use Cases

### 1. User Registration Flow
```typescript
// 1. Create Firebase user
const firebaseUser = await this.firebaseService.createUser({
  email: 'user@example.com',
  password: 'securepassword'
});

// 2. Set custom claims for role
await this.firebaseService.setCustomUserClaims(firebaseUser.uid, {
  role: 'influencer',
  verified: false
});

// 3. Subscribe to relevant topics
await this.notificationService.subscribeUserToTopics(
  fcmToken,
  'influencer'
);
```

### 2. Campaign Notifications
```typescript
// Notify all influencers about new campaign
await this.firebaseService.sendNotificationToTopic(
  'influencer_updates',
  'New Campaign Available',
  'Check out the latest campaign opportunity!'
);

// Notify specific influencer about application status
await this.notificationService.sendCampaignStatusUpdate(
  fcmToken,
  'Summer Fashion Campaign',
  'approved'
);
```

## Testing

You can test the Firebase integration using the provided endpoints:

1. Create a test user via `POST /firebase/users`
2. Get a Firebase ID token from your client app
3. Use the token to authenticate other endpoints
4. Test push notifications with valid FCM tokens

## Troubleshooting

### Common Issues

1. **Service Account Error**: Ensure the JSON file exists and has correct permissions
2. **Token Verification Failed**: Check that the ID token is valid and not expired
3. **Push Notification Failed**: Verify FCM tokens are valid and app is properly configured
4. **Import Errors**: Ensure all Firebase modules are properly imported

### Logs

The application logs Firebase operations. Check the console output for detailed error messages.