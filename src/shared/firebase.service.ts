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
      const firebasePrivateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
      const firebaseProjectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      const firebaseClientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');

      if (!firebasePrivateKey || !firebaseProjectId || !firebaseClientEmail) {
        throw new Error('Firebase configuration is missing. Please set FIREBASE_PRIVATE_KEY, FIREBASE_PROJECT_ID, and FIREBASE_CLIENT_EMAIL environment variables.');
      }

      serviceAccount = {
        type: 'service_account',
        projectId: firebaseProjectId,
        privateKeyId: this.configService.get<string>('FIREBASE_PRIVATE_KEY_ID'),
        privateKey: firebasePrivateKey.replace(/\\n/g, '\n'),
        clientEmail: firebaseClientEmail,
        clientId: this.configService.get<string>('FIREBASE_CLIENT_ID'),
        authUri: this.configService.get<string>('FIREBASE_AUTH_URI') || 'https://accounts.google.com/o/oauth2/auth',
        tokenUri: this.configService.get<string>('FIREBASE_TOKEN_URI') || 'https://oauth2.googleapis.com/token',
        authProviderX509CertUrl: this.configService.get<string>('FIREBASE_AUTH_PROVIDER_X509_CERT_URL') || 'https://www.googleapis.com/oauth2/v1/certs',
        clientC509CertUrl: this.configService.get<string>('FIREBASE_CLIENT_CERT_URL'),
        universeDomain: this.configService.get<string>('FIREBASE_UNIVERSE_DOMAIN') || 'googleapis.com',
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
  ): Promise<admin.messaging.BatchResponse | string> {
    const message: admin.messaging.MulticastMessage = {
      notification: {
        title,
        body,
      },
      data: data || {},
      tokens: Array.isArray(tokens) ? tokens : [tokens],
    };

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
