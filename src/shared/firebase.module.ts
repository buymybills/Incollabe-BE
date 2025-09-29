import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseService } from './firebase.service';
import { FirebaseController } from '../firebase/firebase.controller';

@Module({
  imports: [ConfigModule],
  providers: [FirebaseService],
  controllers: [FirebaseController],
  exports: [FirebaseService],
})
export class FirebaseModule {}
