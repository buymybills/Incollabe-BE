import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';
import * as path from 'path';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private app: admin.app.App;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    try {
      // Check if app is already initialized
      this.app = admin.app();
    } catch (error) {
      // App doesn't exist, initialize it
      let serviceAccount: ServiceAccount;

      // Load from environment variables
      const firebasePrivateKey = this.configService.get<string>(
        'FIREBASE_PRIVATE_KEY',
      );
      const firebaseProjectId = this.configService.get<string>(
        'FIREBASE_PROJECT_ID',
      );
      const firebaseClientEmail = this.configService.get<string>(
        'FIREBASE_CLIENT_EMAIL',
      );

      if (!firebasePrivateKey || !firebaseProjectId || !firebaseClientEmail) {
        throw new Error(
          'Firebase configuration is missing. Please set FIREBASE_PRIVATE_KEY, FIREBASE_PROJECT_ID, and FIREBASE_CLIENT_EMAIL environment variables.',
        );
      }

      serviceAccount = {
        type: 'service_account',
        projectId: firebaseProjectId,
        privateKeyId: this.configService.get<string>('FIREBASE_PRIVATE_KEY_ID'),
        privateKey: firebasePrivateKey.replace(/\\n/g, '\n'),
        clientEmail: firebaseClientEmail,
        clientId: this.configService.get<string>('FIREBASE_CLIENT_ID'),
        authUri:
          this.configService.get<string>('FIREBASE_AUTH_URI') ||
          'https://accounts.google.com/o/oauth2/auth',
        tokenUri:
          this.configService.get<string>('FIREBASE_TOKEN_URI') ||
          'https://oauth2.googleapis.com/token',
        authProviderX509CertUrl:
          this.configService.get<string>(
            'FIREBASE_AUTH_PROVIDER_X509_CERT_URL',
          ) || 'https://www.googleapis.com/oauth2/v1/certs',
        clientC509CertUrl: this.configService.get<string>(
          'FIREBASE_CLIENT_CERT_URL',
        ),
        universeDomain:
          this.configService.get<string>('FIREBASE_UNIVERSE_DOMAIN') ||
          'googleapis.com',
      } as ServiceAccount;

      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.projectId || 'collabkaroo',
      });
    }
  }

  getApp(): admin.app.App {
    return this.app;
  }

  getAuth(): admin.auth.Auth {
    return this.app.auth();
  }

  getFirestore(): admin.firestore.Firestore {
    return this.app.firestore();
  }

  getMessaging(): admin.messaging.Messaging {
    return this.app.messaging();
  }

  getStorage(): admin.storage.Storage {
    return this.app.storage();
  }

  async healthCheck(): Promise<{
    status: string;
    projectId: string;
    services: string[];
  }> {
    try {
      const projectId = this.app.options.projectId;
      const services = ['auth', 'messaging', 'firestore', 'storage'];

      return {
        status: 'healthy',
        projectId: projectId || 'unknown',
        services,
      };
    } catch (error) {
      throw new Error(`Firebase health check failed: ${error.message}`);
    }
  }

  async createCustomToken(
    uid: string,
    additionalClaims?: object,
  ): Promise<string> {
    return this.getAuth().createCustomToken(uid, additionalClaims);
  }

  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    return this.getAuth().verifyIdToken(idToken);
  }

  async getUserByEmail(email: string): Promise<admin.auth.UserRecord> {
    return this.getAuth().getUserByEmail(email);
  }

  async getUserByUid(uid: string): Promise<admin.auth.UserRecord> {
    return this.getAuth().getUser(uid);
  }

  async createUser(
    userProperties: admin.auth.CreateRequest,
  ): Promise<admin.auth.UserRecord> {
    return this.getAuth().createUser(userProperties);
  }

  async updateUser(
    uid: string,
    properties: admin.auth.UpdateRequest,
  ): Promise<admin.auth.UserRecord> {
    return this.getAuth().updateUser(uid, properties);
  }

  async deleteUser(uid: string): Promise<void> {
    return this.getAuth().deleteUser(uid);
  }

  async setCustomUserClaims(
    uid: string,
    customUserClaims: object | null,
  ): Promise<void> {
    return this.getAuth().setCustomUserClaims(uid, customUserClaims);
  }

  async sendNotification(
    tokens: string | string[],
    title: string,
    body: string,
    data?: { [key: string]: string },
    options?: {
      imageUrl?: string;
      actionUrl?: string;
      androidChannelId?: string;
      sound?: string;
      priority?: string;
      expirationHours?: number;
      // iOS-specific options
      badge?: number;
      threadId?: string;
      interruptionLevel?: 'passive' | 'active' | 'timeSensitive' | 'critical';
    },
  ): Promise<admin.messaging.BatchResponse | string> {
    const notification: admin.messaging.Notification = {
      title,
      body,
    };

    // Add image URL for rich notifications
    if (options?.imageUrl) {
      notification.imageUrl = options.imageUrl;
    }

    // Firebase requires all data values to be strings
    const stringifiedData: { [key: string]: string } = {};
    const allData = {
      ...(data || {}),
      // Add deep link URL as data
      ...(options?.actionUrl ? { actionUrl: options.actionUrl } : {}),
      // Add image URL as data (for easier mobile app access)
      ...(options?.imageUrl ? { imageUrl: options.imageUrl } : {}),
    };

    // Convert all values to strings
    for (const [key, value] of Object.entries(allData)) {
      if (value !== null && value !== undefined) {
        stringifiedData[key] = typeof value === 'string' ? value : JSON.stringify(value);
      }
    }

    const message: admin.messaging.MulticastMessage = {
      notification,
      data: stringifiedData,
      tokens: Array.isArray(tokens) ? tokens : [tokens],
    };

    // Debug: Log the complete message structure
    console.log('🚀 Sending FCM Message:');
    console.log('📝 notification.title:', notification.title);
    console.log('📝 notification.body:', notification.body);
    console.log('🖼️ notification.imageUrl:', notification.imageUrl);
    console.log('📊 data:', stringifiedData);
    console.log('🤖 android.notification.imageUrl:', message.android?.notification?.imageUrl);
    console.log('🍎 apns.fcmOptions.imageUrl:', message.apns?.fcmOptions?.imageUrl);

    // Android-specific configuration
    if (options) {
      message.android = {
        priority: options.priority === 'high' ? 'high' : 'normal',
        ttl: options.expirationHours
          ? options.expirationHours * 60 * 60 * 1000
          : undefined,
        notification: {
          channelId: options.androidChannelId || 'default',
          sound: options.sound || 'default',
          ...(options.imageUrl ? { imageUrl: options.imageUrl } : {}),
          clickAction: options.actionUrl,
        },
      };
    }

    // iOS-specific configuration
    if (options) {
      const apsPayload: any = {
        sound: options.sound || 'default',
      };

      // Badge count (red number on app icon)
      if (options.badge !== undefined) {
        apsPayload.badge = options.badge;
      }

      // Thread identifier for grouping related notifications
      if (options.threadId) {
        apsPayload['thread-id'] = options.threadId;
      }

      // Interruption level (iOS 15+)
      // passive = silent, active = default, timeSensitive = bypasses Focus, critical = always plays sound
      if (options.interruptionLevel) {
        apsPayload['interruption-level'] = options.interruptionLevel;
      }

      // Category for deep linking
      if (options.actionUrl) {
        apsPayload.category = options.actionUrl;
      }

      message.apns = {
        payload: {
          aps: apsPayload,
        },
        fcmOptions: {
          imageUrl: options.imageUrl,
        },
      };
    }

    if (Array.isArray(tokens)) {
      return this.getMessaging().sendEachForMulticast(message);
    } else {
      const singleMessage: admin.messaging.Message = {
        ...message,
        token: tokens,
      };
      delete (singleMessage as any).tokens;
      return this.getMessaging().send(singleMessage);
    }
  }

  async sendNotificationToTopic(
    topic: string,
    title: string,
    body: string,
    data?: { [key: string]: string },
  ): Promise<string> {
    const message: admin.messaging.Message = {
      notification: {
        title,
        body,
      },
      data: data || {},
      topic,
    };

    return this.getMessaging().send(message);
  }

  async subscribeToTopic(
    tokens: string | string[],
    topic: string,
  ): Promise<admin.messaging.MessagingTopicManagementResponse> {
    return this.getMessaging().subscribeToTopic(
      Array.isArray(tokens) ? tokens : [tokens],
      topic,
    );
  }

  async unsubscribeFromTopic(
    tokens: string | string[],
    topic: string,
  ): Promise<admin.messaging.MessagingTopicManagementResponse> {
    return this.getMessaging().unsubscribeFromTopic(
      Array.isArray(tokens) ? tokens : [tokens],
      topic,
    );
  }
}
