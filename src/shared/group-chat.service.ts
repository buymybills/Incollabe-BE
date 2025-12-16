// import {
//   Injectable,
//   NotFoundException,
//   BadRequestException,
//   ForbiddenException,
// } from '@nestjs/common';
// import { InjectModel } from '@nestjs/sequelize';
// import { GroupChat, UserType } from './models/group-chat.model';
// import { GroupMember, MemberRole, MemberType } from './models/group-member.model';
// import { Conversation, ConversationType } from './models/conversation.model';
// import { Message } from './models/message.model';
// import { Influencer } from '../auth/model/influencer.model';
// import { Brand } from '../brand/model/brand.model';
// import { Op } from 'sequelize';

// @Injectable()
// export class GroupChatService {
//   constructor(
//     @InjectModel(GroupChat)
//     private groupChatModel: typeof GroupChat,
//     @InjectModel(GroupMember)
//     private groupMemberModel: typeof GroupMember,
//     @InjectModel(Conversation)
//     private conversationModel: typeof Conversation,
//     @InjectModel(Message)
//     private messageModel: typeof Message,
//     @InjectModel(Influencer)
//     private influencerModel: typeof Influencer,
//     @InjectModel(Brand)
//     private brandModel: typeof Brand,
//   ) {}

//   /**
//    * Create a new group chat
//    */
//   async createGroup(
//     creatorId: number,
//     creatorType: UserType,
//     name: string,
//     avatarUrl?: string,
//     initialMemberIds?: Array<{ memberId: number; memberType: MemberType }>,
//   ) {
//     // Validate group name
//     if (!name || name.trim().length === 0) {
//       throw new BadRequestException('Group name is required');
//     }

//     if (name.length > 100) {
//       throw new BadRequestException('Group name must be 100 characters or less');
//     }

//     // Calculate total members (creator + initial members)
//     const totalMembers = 1 + (initialMemberIds?.length || 0);
//     if (totalMembers > 10) {
//       throw new BadRequestException(
//         'Group cannot have more than 10 members including creator',
//       );
//     }

//     // Create the group
//     const group = await this.groupChatModel.create({
//       name: name.trim(),
//       avatarUrl,
//       createdById: creatorId,
//       createdByType: creatorType,
//       maxMembers: 10,
//       isActive: true,
//     });

//     // Create conversation for the group
//     const conversation = await this.conversationModel.create({
//       conversationType: ConversationType.GROUP,
//       groupChatId: group.id,
//       isActive: true,
//       // For group chats, participant fields are not used
//       participant1Type: null,
//       participant1Id: null,
//       participant2Type: null,
//       participant2Id: null,
//     });

//     // Add creator as admin member
//     await this.groupMemberModel.create({
//       groupChatId: group.id,
//       memberId: creatorId,
//       memberType: creatorType as unknown as MemberType,
//       role: MemberRole.ADMIN,
//       joinedAt: new Date(),
//     });

//     // Add initial members if provided
//     if (initialMemberIds && initialMemberIds.length > 0) {
//       const memberRecords = initialMemberIds.map((member) => ({
//         groupChatId: group.id,
//         memberId: member.memberId,
//         memberType: member.memberType,
//         role: MemberRole.MEMBER,
//         joinedAt: new Date(),
//       }));

//       await this.groupMemberModel.bulkCreate(memberRecords);
//     }

//     // Fetch group with members and conversation
//     return this.getGroupDetails(group.id, creatorId, creatorType);
//   }

//   /**
//    * Add members to an existing group
//    */
//   async addMembers(
//     groupId: number,
//     memberIds: number[],
//     memberTypes: string[],
//     requesterId: number,
//     requesterType: string,
//   ) {
//     if (memberIds.length !== memberTypes.length) {
//       throw new BadRequestException(
//         'memberIds and memberTypes arrays must have the same length',
//       );
//     }

//     // Get group
//     const group = await this.groupChatModel.findByPk(groupId);
//     if (!group) {
//       throw new NotFoundException('Group not found');
//     }

//     if (!group.isActive) {
//       throw new BadRequestException('Cannot add members to inactive group');
//     }

//     // Verify requester is admin
//     const requesterMembership = await this.groupMemberModel.findOne({
//       where: {
//         groupChatId: groupId,
//         memberId: requesterId,
//         memberType: requesterType,
//         leftAt: null,
//       },
//     });

//     if (!requesterMembership || requesterMembership.role !== MemberRole.ADMIN) {
//       throw new ForbiddenException('Only group admins can add members');
//     }

//     // Count current active members
//     const currentMemberCount = await this.groupMemberModel.count({
//       where: {
//         groupChatId: groupId,
//         leftAt: null,
//       },
//     });

//     // Validate total members after addition
//     if (currentMemberCount + memberIds.length > group.maxMembers) {
//       throw new BadRequestException(
//         `Cannot add ${memberIds.length} members. Group limit is ${group.maxMembers} members`,
//       );
//     }

//     // Create member records
//     const memberRecords = memberIds.map((memberId, index) => ({
//       groupChatId: groupId,
//       memberId,
//       memberType: memberTypes[index] as MemberType,
//       role: MemberRole.MEMBER,
//       joinedAt: new Date(),
//     }));

//     await this.groupMemberModel.bulkCreate(memberRecords, {
//       ignoreDuplicates: true, // Skip if member already exists
//     });

//     // Get conversation ID for WebSocket broadcast
//     const conversation = await this.conversationModel.findOne({
//       where: { groupChatId: groupId },
//     });

//     return {
//       groupId,
//       conversationId: conversation?.id,
//       addedMembers: memberRecords.map((m) => ({
//         memberId: m.memberId,
//         memberType: m.memberType,
//       })),
//     };
//   }

//   /**
//    * Remove a member from the group
//    */
//   async removeMember(
//     groupId: number,
//     memberId: number,
//     memberType: string,
//     requesterId: number,
//     requesterType: string,
//   ) {
//     // Get group
//     const group = await this.groupChatModel.findByPk(groupId);
//     if (!group) {
//       throw new NotFoundException('Group not found');
//     }

//     // Get target member
//     const targetMember = await this.groupMemberModel.findOne({
//       where: {
//         groupChatId: groupId,
//         memberId,
//         memberType,
//         leftAt: null,
//       },
//     });

//     if (!targetMember) {
//       throw new NotFoundException('Member not found in group');
//     }

//     // Check permissions
//     const requesterMembership = await this.groupMemberModel.findOne({
//       where: {
//         groupChatId: groupId,
//         memberId: requesterId,
//         memberType: requesterType,
//         leftAt: null,
//       },
//     });

//     if (!requesterMembership) {
//       throw new ForbiddenException('You are not a member of this group');
//     }

//     // Allow if: requester is admin OR requester is removing themselves
//     const isSelfRemoval =
//       requesterId === memberId && requesterType === memberType;
//     const isAdmin = requesterMembership.role === MemberRole.ADMIN;

//     if (!isSelfRemoval && !isAdmin) {
//       throw new ForbiddenException('Only admins can remove other members');
//     }

//     // Prevent removing the last admin
//     if (targetMember.role === MemberRole.ADMIN) {
//       const adminCount = await this.groupMemberModel.count({
//         where: {
//           groupChatId: groupId,
//           role: MemberRole.ADMIN,
//           leftAt: null,
//         },
//       });

//       if (adminCount === 1) {
//         throw new BadRequestException('Cannot remove the last admin from the group');
//       }
//     }

//     // Soft delete: set leftAt timestamp
//     await targetMember.update({
//       leftAt: new Date(),
//     });

//     return {
//       success: true,
//       groupId,
//       removedMember: {
//         memberId,
//         memberType,
//       },
//     };
//   }

//   /**
//    * Update group details (name, avatar)
//    */
//   async updateGroup(
//     groupId: number,
//     updates: { name?: string; avatarUrl?: string },
//     requesterId: number,
//     requesterType: string,
//   ) {
//     // Get group
//     const group = await this.groupChatModel.findByPk(groupId);
//     if (!group) {
//       throw new NotFoundException('Group not found');
//     }

//     // Verify requester is admin
//     const requesterMembership = await this.groupMemberModel.findOne({
//       where: {
//         groupChatId: groupId,
//         memberId: requesterId,
//         memberType: requesterType,
//         leftAt: null,
//       },
//     });

//     if (!requesterMembership || requesterMembership.role !== MemberRole.ADMIN) {
//       throw new ForbiddenException('Only group admins can update group details');
//     }

//     // Validate and update
//     const updateData: any = {};

//     if (updates.name !== undefined) {
//       if (!updates.name || updates.name.trim().length === 0) {
//         throw new BadRequestException('Group name cannot be empty');
//       }
//       if (updates.name.length > 100) {
//         throw new BadRequestException('Group name must be 100 characters or less');
//       }
//       updateData.name = updates.name.trim();
//     }

//     if (updates.avatarUrl !== undefined) {
//       updateData.avatarUrl = updates.avatarUrl;
//     }

//     await group.update(updateData);

//     // Return updated group details
//     return this.getGroupDetails(groupId, requesterId, requesterType);
//   }

//   /**
//    * Get group details with members
//    */
//   async getGroupDetails(groupId: number, requesterId: number, requesterType: string) {
//     // Get group
//     const group = await this.groupChatModel.findByPk(groupId, {
//       include: [
//         {
//           model: this.groupMemberModel,
//           as: 'members',
//           where: { leftAt: null },
//           required: false,
//         },
//         {
//           model: this.conversationModel,
//           as: 'conversation',
//         },
//       ],
//     });

//     if (!group) {
//       throw new NotFoundException('Group not found');
//     }

//     // Verify requester is a member
//     const isMember = await this.groupMemberModel.findOne({
//       where: {
//         groupChatId: groupId,
//         memberId: requesterId,
//         memberType: requesterType,
//         leftAt: null,
//       },
//     });

//     if (!isMember) {
//       throw new ForbiddenException('You are not a member of this group');
//     }

//     // Enrich member details with user info
//     const enrichedMembers = await Promise.all(
//       (group.members || []).map(async (member: GroupMember) => {
//         let userDetails = null;

//         if (member.memberType === MemberType.INFLUENCER) {
//           const influencer = await this.influencerModel.findByPk(member.memberId, {
//             attributes: ['id', 'username', 'name', 'profileImage'],
//           });
//           userDetails = influencer?.toJSON();
//         } else if (member.memberType === MemberType.BRAND) {
//           const brand = await this.brandModel.findByPk(member.memberId, {
//             attributes: ['id', 'username', 'brandName', 'profileImage'],
//           });
//           userDetails = brand?.toJSON();
//         }

//         return {
//           memberId: member.memberId,
//           memberType: member.memberType,
//           role: member.role,
//           joinedAt: member.joinedAt,
//           userDetails,
//         };
//       }),
//     );

//     return {
//       id: group.id,
//       name: group.name,
//       avatarUrl: group.avatarUrl,
//       createdById: group.createdById,
//       createdByType: group.createdByType,
//       maxMembers: group.maxMembers,
//       isActive: group.isActive,
//       memberCount: enrichedMembers.length,
//       members: enrichedMembers,
//       conversation: group.conversation,
//       createdAt: group.createdAt,
//       updatedAt: group.updatedAt,
//     };
//   }

//   /**
//    * Get all groups for a user
//    */
//   async getUserGroups(
//     userId: number,
//     userType: string,
//     page: number = 1,
//     limit: number = 20,
//   ) {
//     const offset = (page - 1) * limit;

//     // Find all group memberships for user
//     const memberships = await this.groupMemberModel.findAll({
//       where: {
//         memberId: userId,
//         memberType: userType,
//         leftAt: null,
//       },
//       include: [
//         {
//           model: this.groupChatModel,
//           as: 'groupChat',
//           where: { isActive: true },
//           include: [
//             {
//               model: this.conversationModel,
//               as: 'conversation',
//             },
//           ],
//         },
//       ],
//       limit,
//       offset,
//       order: [['joinedAt', 'DESC']],
//     });

//     // Get unread counts for each group
//     const groupsWithUnread = await Promise.all(
//       memberships.map(async (membership) => {
//         const unreadCount = await this.getGroupUnreadCount(
//           membership.groupChatId,
//           userId,
//           userType,
//         );

//         // Get member count
//         const memberCount = await this.groupMemberModel.count({
//           where: {
//             groupChatId: membership.groupChatId,
//             leftAt: null,
//           },
//         });

//         const group = membership.groupChat;

//         return {
//           id: group.id,
//           name: group.name,
//           avatarUrl: group.avatarUrl,
//           memberCount,
//           unreadCount,
//           conversation: group.conversation,
//           lastJoinedAt: membership.joinedAt,
//           role: membership.role,
//         };
//       }),
//     );

//     // Get total count
//     const total = await this.groupMemberModel.count({
//       where: {
//         memberId: userId,
//         memberType: userType,
//         leftAt: null,
//       },
//       include: [
//         {
//           model: this.groupChatModel,
//           as: 'groupChat',
//           where: { isActive: true },
//         },
//       ],
//     });

//     return {
//       groups: groupsWithUnread,
//       total,
//       page,
//       limit,
//       totalPages: Math.ceil(total / limit),
//     };
//   }

//   /**
//    * Leave a group
//    */
//   async leaveGroup(groupId: number, userId: number, userType: string) {
//     // Get group
//     const group = await this.groupChatModel.findByPk(groupId);
//     if (!group) {
//       throw new NotFoundException('Group not found');
//     }

//     // Get member
//     const member = await this.groupMemberModel.findOne({
//       where: {
//         groupChatId: groupId,
//         memberId: userId,
//         memberType: userType,
//         leftAt: null,
//       },
//     });

//     if (!member) {
//       throw new NotFoundException('You are not a member of this group');
//     }

//     // Check if user is the last admin
//     if (member.role === MemberRole.ADMIN) {
//       const adminCount = await this.groupMemberModel.count({
//         where: {
//           groupChatId: groupId,
//           role: MemberRole.ADMIN,
//           leftAt: null,
//         },
//       });

//       if (adminCount === 1) {
//         // Check if there are other members
//         const totalMembers = await this.groupMemberModel.count({
//           where: {
//             groupChatId: groupId,
//             leftAt: null,
//           },
//         });

//         if (totalMembers > 1) {
//           throw new BadRequestException(
//             'Cannot leave: you are the last admin. Please promote another member to admin first.',
//           );
//         }
//       }
//     }

//     // Soft delete: set leftAt timestamp
//     await member.update({
//       leftAt: new Date(),
//     });

//     // Check if this was the last member
//     const remainingMembers = await this.groupMemberModel.count({
//       where: {
//         groupChatId: groupId,
//         leftAt: null,
//       },
//     });

//     // If no members left, mark group as inactive
//     if (remainingMembers === 0) {
//       await group.update({ isActive: false });
//     }

//     // Get conversation ID for WebSocket
//     const conversation = await this.conversationModel.findOne({
//       where: { groupChatId: groupId },
//     });

//     return {
//       success: true,
//       groupId,
//       conversationId: conversation?.id,
//     };
//   }

//   /**
//    * Get unread message count for a user in a group
//    */
//   async getGroupUnreadCount(
//     groupId: number,
//     userId: number,
//     userType: string,
//   ): Promise<number> {
//     // Get member's last read message ID
//     const member = await this.groupMemberModel.findOne({
//       where: {
//         groupChatId: groupId,
//         memberId: userId,
//         memberType: userType,
//         leftAt: null,
//       },
//     });

//     if (!member) {
//       return 0;
//     }

//     // Get conversation
//     const conversation = await this.conversationModel.findOne({
//       where: { groupChatId: groupId },
//     });

//     if (!conversation) {
//       return 0;
//     }

//     // Count messages after last read that are not from this user
//     const whereClause: any = {
//       conversationId: conversation.id,
//     };

//     if (member.lastReadMessageId) {
//       whereClause.id = { [Op.gt]: member.lastReadMessageId };
//     }

//     // Exclude messages sent by this user
//     whereClause[Op.not] = {
//       senderId: userId,
//       senderType: userType,
//     };

//     const unreadCount = await this.messageModel.count({
//       where: whereClause,
//     });

//     return unreadCount;
//   }

//   /**
//    * Check if user is a member of a group
//    */
//   async isMember(
//     groupId: number,
//     userId: number,
//     userType: string,
//   ): Promise<boolean> {
//     const member = await this.groupMemberModel.findOne({
//       where: {
//         groupChatId: groupId,
//         memberId: userId,
//         memberType: userType,
//         leftAt: null,
//       },
//     });

//     return !!member;
//   }

//   /**
//    * Check if user is admin of a group
//    */
//   async isAdmin(
//     groupId: number,
//     userId: number,
//     userType: string,
//   ): Promise<boolean> {
//     const member = await this.groupMemberModel.findOne({
//       // where: {
//       //   groupChatId: groupId,
//       //   memberId: userId,
//       //   memberType: userType,
//       //   role: MemberRole.ADMIN,
//       //   leftAt: null,
//       // },
//     });

//     return !!member;
//   }
// }
