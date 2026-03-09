import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { GroupChat, UserType } from './models/group-chat.model';
import { GroupMember, MemberRole, MemberType } from './models/group-member.model';
import { Conversation, ConversationType } from './models/conversation.model';
import { Message } from './models/message.model';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { Op } from 'sequelize';

@Injectable()
export class GroupChatService {
  constructor(
    @InjectModel(GroupChat)
    private groupChatModel: typeof GroupChat,
    @InjectModel(GroupMember)
    private groupMemberModel: typeof GroupMember,
    @InjectModel(Conversation)
    private conversationModel: typeof Conversation,
    @InjectModel(Message)
    private messageModel: typeof Message,
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private brandModel: typeof Brand,
    @Inject(forwardRef(() => require('./chat.gateway').ChatGateway))
    private chatGateway: any,
  ) {}

  /**
   * Create a new group chat
   */
  async createGroup(
    creatorId: number,
    creatorType: UserType,
    name: string,
    avatarUrl?: string,
    initialMemberIds?: Array<{ memberId: number; memberType: MemberType }>,
    isBroadcastOnly: boolean = false,
    isJoinable: boolean = true,
  ) {
    // Validate group name
    if (!name || name.trim().length === 0) {
      throw new BadRequestException('Group name is required');
    }

    if (name.length > 100) {
      throw new BadRequestException('Group name must be 100 characters or less');
    }

    // Calculate total members (creator + initial members)
    const totalMembers = 1 + (initialMemberIds?.length || 0);
    if (totalMembers > 100) {
      throw new BadRequestException(
        'Group cannot have more than 100 members including creator',
      );
    }

    // Create the group
    const group = await this.groupChatModel.create({
      name: name.trim(),
      avatarUrl: avatarUrl || null,
      createdById: creatorId,
      createdByType: creatorType,
      maxMembers: 100,
      isActive: true,
      isBroadcastOnly: isBroadcastOnly || false,
      isJoinable: isJoinable ?? true,
    } as any);

    // Create conversation for the group
    const conversation = await this.conversationModel.create({
      conversationType: 'group',
      groupChatId: group.id,
      isActive: true,
      // For group chats, participant fields are not used
      participant1Type: null,
      participant1Id: null,
      participant2Type: null,
      participant2Id: null,
    } as any);

    // Add creator as admin member
    await this.groupMemberModel.create({
      groupChatId: group.id,
      memberId: creatorId,
      memberType: creatorType as unknown as MemberType,
      role: MemberRole.ADMIN,
      joinedAt: new Date(),
    } as any);

    // Add initial members if provided
    if (initialMemberIds && initialMemberIds.length > 0) {
      const memberRecords = initialMemberIds.map((member) => ({
        groupChatId: group.id,
        memberId: member.memberId,
        memberType: member.memberType,
        role: MemberRole.MEMBER,
        joinedAt: new Date(),
      }));

      await this.groupMemberModel.bulkCreate(memberRecords as any);
    }

    // Fetch group with members and conversation
    return this.getGroupDetails(group.id, creatorId, creatorType);
  }

  /**
   * Add members to an existing group
   */
  async addMembers(
    groupId: number,
    memberIds: number[],
    memberTypes: string[],
    requesterId: number,
    requesterType: string,
  ) {
    if (memberIds.length !== memberTypes.length) {
      throw new BadRequestException(
        'memberIds and memberTypes arrays must have the same length',
      );
    }

    // Get group
    const group = await this.groupChatModel.findByPk(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (!group.isActive) {
      throw new BadRequestException('Cannot add members to inactive group');
    }

    // Verify requester is admin
    const requesterMembership = await this.groupMemberModel.findOne({
      where: {
        groupChatId: groupId,
        memberId: requesterId,
        memberType: requesterType,
        leftAt: { [Op.is]: null },
      } as any,
    });

    if (!requesterMembership || requesterMembership.role !== MemberRole.ADMIN) {
      throw new ForbiddenException('Only group admins can add members');
    }

    // Count current active members
    const currentMemberCount = await this.groupMemberModel.count({
      where: {
        groupChatId: groupId,
        leftAt: { [Op.is]: null },
      } as any,
    });

    // Validate total members after addition
    if (currentMemberCount + memberIds.length > group.maxMembers) {
      throw new BadRequestException(
        `Cannot add ${memberIds.length} members. Group limit is ${group.maxMembers} members`,
      );
    }

    // Create member records
    const memberRecords = memberIds.map((memberId, index) => ({
      groupChatId: groupId,
      memberId,
      memberType: memberTypes[index] as MemberType,
      role: MemberRole.MEMBER,
      joinedAt: new Date(),
    }));

    await this.groupMemberModel.bulkCreate(memberRecords as any, {
      ignoreDuplicates: true, // Skip if member already exists
    });

    // Get conversation ID for WebSocket broadcast
    const conversation = await this.conversationModel.findOne({
      where: { groupChatId: groupId },
    });

    // Emit WebSocket events for each added member
    if (conversation && this.chatGateway) {
      for (const memberRecord of memberRecords) {
        await this.chatGateway.emitGroupMemberAdded(
          groupId,
          conversation.id,
          memberRecord.memberId,
          memberRecord.memberType,
          requesterId,
          requesterType,
        );
      }
    }

    return {
      groupId,
      conversationId: conversation?.id,
      addedMembers: memberRecords.map((m) => ({
        memberId: m.memberId,
        memberType: m.memberType,
      })),
    };
  }

  /**
   * Update member role (promote to admin or demote to member)
   */
  async updateMemberRole(
    groupId: number,
    targetMemberId: number,
    targetMemberType: string,
    newRole: 'admin' | 'member',
    requesterId: number,
    requesterType: string,
  ) {
    // Get group
    const group = await this.groupChatModel.findByPk(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Get target member
    const targetMember = await this.groupMemberModel.findOne({
      where: {
        groupChatId: groupId,
        memberId: targetMemberId,
        memberType: targetMemberType,
        leftAt: { [Op.is]: null },
      } as any,
    });

    if (!targetMember) {
      throw new NotFoundException('Member not found in group');
    }

    // Check if requester is admin
    const requesterMembership = await this.groupMemberModel.findOne({
      where: {
        groupChatId: groupId,
        memberId: requesterId,
        memberType: requesterType,
        leftAt: { [Op.is]: null },
      } as any,
    });

    if (!requesterMembership || requesterMembership.role !== MemberRole.ADMIN) {
      throw new ForbiddenException('Only group admins can change member roles');
    }

    // Prevent demoting yourself if you're the last admin
    if (newRole === 'member' && targetMember.role === MemberRole.ADMIN) {
      const adminCount = await this.groupMemberModel.count({
        where: {
          groupChatId: groupId,
          role: MemberRole.ADMIN,
          leftAt: { [Op.is]: null },
        } as any,
      });

      if (adminCount === 1) {
        throw new BadRequestException(
          'Cannot demote the last admin. Promote another member to admin first.',
        );
      }
    }

    // Update the role
    await targetMember.update({
      role: newRole === 'admin' ? MemberRole.ADMIN : MemberRole.MEMBER,
    });

    return {
      success: true,
      groupId,
      memberId: targetMemberId,
      memberType: targetMemberType,
      newRole,
      message: `Member ${newRole === 'admin' ? 'promoted to admin' : 'demoted to member'} successfully`,
    };
  }

  /**
   * Remove a member from the group
   */
  async removeMember(
    groupId: number,
    memberId: number,
    memberType: string,
    requesterId: number,
    requesterType: string,
  ) {
    // Get group
    const group = await this.groupChatModel.findByPk(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Get target member
    const targetMember = await this.groupMemberModel.findOne({
      where: {
        groupChatId: groupId,
        memberId,
        memberType,
        leftAt: { [Op.is]: null },
      } as any,
    });

    if (!targetMember) {
      throw new NotFoundException('Member not found in group');
    }

    // Check permissions
    const requesterMembership = await this.groupMemberModel.findOne({
      where: {
        groupChatId: groupId,
        memberId: requesterId,
        memberType: requesterType,
        leftAt: { [Op.is]: null },
      } as any,
    });

    if (!requesterMembership) {
      throw new ForbiddenException('You are not a member of this group');
    }

    // Allow if: requester is admin OR requester is removing themselves
    const isSelfRemoval =
      requesterId === memberId && requesterType === memberType;
    const isAdmin = requesterMembership.role === MemberRole.ADMIN;

    if (!isSelfRemoval && !isAdmin) {
      throw new ForbiddenException('Only admins can remove other members');
    }

    // Prevent removing the last admin
    if (targetMember.role === MemberRole.ADMIN) {
      const adminCount = await this.groupMemberModel.count({
        where: {
          groupChatId: groupId,
          role: MemberRole.ADMIN,
          leftAt: { [Op.is]: null },
        } as any,
      });

      if (adminCount === 1) {
        throw new BadRequestException('Cannot remove the last admin from the group');
      }
    }

    // Soft delete: set leftAt timestamp
    await targetMember.update({
      leftAt: new Date(),
    });

    return {
      success: true,
      groupId,
      removedMember: {
        memberId,
        memberType,
      },
    };
  }

  /**
   * Update group details (name, avatar)
   */
  async updateGroup(
    groupId: number,
    updates: { name?: string; avatarUrl?: string },
    requesterId: number,
    requesterType: string,
  ) {
    // Get group
    const group = await this.groupChatModel.findByPk(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Verify requester is admin
    const requesterMembership = await this.groupMemberModel.findOne({
      where: {
        groupChatId: groupId,
        memberId: requesterId,
        memberType: requesterType,
        leftAt: { [Op.is]: null },
      } as any,
    });

    if (!requesterMembership || requesterMembership.role !== MemberRole.ADMIN) {
      throw new ForbiddenException('Only group admins can update group details');
    }

    // Validate and update
    const updateData: any = {};

    if (updates.name !== undefined) {
      if (!updates.name || updates.name.trim().length === 0) {
        throw new BadRequestException('Group name cannot be empty');
      }
      if (updates.name.length > 100) {
        throw new BadRequestException('Group name must be 100 characters or less');
      }
      updateData.name = updates.name.trim();
    }

    if (updates.avatarUrl !== undefined) {
      updateData.avatarUrl = updates.avatarUrl;
    }

    await group.update(updateData);

    // Return updated group details
    return this.getGroupDetails(groupId, requesterId, requesterType);
  }

  /**
   * Get group details with members (with optional search)
   */
  async getGroupDetails(
    groupId: number,
    requesterId: number,
    requesterType: string,
    search?: string,
  ) {
    // Get group
    const group = await this.groupChatModel.findByPk(groupId, {
      include: [
        {
          model: this.groupMemberModel,
          as: 'members',
          where: { leftAt: null },
          required: false,
        },
        {
          model: this.conversationModel,
          as: 'conversation',
        },
      ],
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Verify requester is a member
    const isMember = await this.groupMemberModel.findOne({
      where: {
        groupChatId: groupId,
        memberId: requesterId,
        memberType: requesterType,
        leftAt: { [Op.is]: null },
      } as any,
    });

    if (!isMember) {
      throw new ForbiddenException('You are not a member of this group');
    }

    // Enrich member details with user info (including public keys for E2EE)
    const enrichedMembers = await Promise.all(
      (group.members || []).map(async (member: GroupMember) => {
        let userDetails: any = null;

        if (member.memberType === MemberType.INFLUENCER) {
          const influencer = await this.influencerModel.findByPk(member.memberId, {
            attributes: [
              'id',
              'username',
              'name',
              'profileImage',
              'publicKey',
              'publicKeyCreatedAt',
              'publicKeyUpdatedAt',
            ],
          });
          userDetails = influencer ? influencer.toJSON() : null;
        } else if (member.memberType === MemberType.BRAND) {
          const brand = await this.brandModel.findByPk(member.memberId, {
            attributes: [
              'id',
              'username',
              'brandName',
              'profileImage',
              'publicKey',
              'publicKeyCreatedAt',
              'publicKeyUpdatedAt',
            ],
          });
          userDetails = brand ? brand.toJSON() : null;
        }

        return {
          memberId: member.memberId,
          memberType: member.memberType,
          role: member.role,
          joinedAt: member.joinedAt,
          userDetails,
        };
      }),
    );

    // Filter members based on search query if provided
    let filteredMembers = enrichedMembers;
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filteredMembers = enrichedMembers.filter((member) => {
        if (!member.userDetails) return false;

        // Search in name (for influencers) or brandName (for brands)
        const name = member.userDetails.name || member.userDetails.brandName || '';
        const username = member.userDetails.username || '';

        return (
          name.toLowerCase().includes(searchLower) ||
          username.toLowerCase().includes(searchLower)
        );
      });
    }

    return {
      id: group.id,
      name: group.name,
      avatarUrl: group.avatarUrl,
      createdById: group.createdById,
      createdByType: group.createdByType,
      maxMembers: group.maxMembers,
      isActive: group.isActive,
      isBroadcastOnly: group.isBroadcastOnly,
      isJoinable: group.isJoinable,
      memberCount: enrichedMembers.length, // Total count (before filtering)
      filteredMemberCount: filteredMembers.length, // Filtered count (after search)
      members: filteredMembers, // Return filtered members
      conversation: group.conversation,
      isMember: !!isMember, // Boolean flag: true if user is a member
      currentUserRole: isMember.role, // 'admin' or 'member'
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }

  /**
   * Unified method to get groups with filter
   */
  async getGroups(
    userId: number,
    userType: string,
    filter: 'my' | 'all' = 'my',
    page: number = 1,
    limit: number = 20,
  ) {
    if (filter === 'all') {
      return this.getAvailableGroups(userId, userType, page, limit);
    } else {
      return this.getUserGroups(userId, userType, page, limit);
    }
  }

  /**
   * Get all groups for a user
   */
  async getUserGroups(
    userId: number,
    userType: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const offset = (page - 1) * limit;

    // Find all group memberships for user
    const memberships = await this.groupMemberModel.findAll({
      where: {
        memberId: userId,
        memberType: userType,
        leftAt: { [Op.is]: null },
      } as any,
      include: [
        {
          model: this.groupChatModel,
          as: 'groupChat',
          where: { isActive: true },
          include: [
            {
              model: this.conversationModel,
              as: 'conversation',
            },
          ],
        },
      ],
      limit,
      offset,
      order: [['joinedAt', 'DESC']],
    });

    // Get unread counts for each group
    const groupsWithUnread = await Promise.all(
      memberships.map(async (membership) => {
        const unreadCount = await this.getGroupUnreadCount(
          membership.groupChatId,
          userId,
          userType,
        );

        // Get member count
        const memberCount = await this.groupMemberModel.count({
          where: {
            groupChatId: membership.groupChatId,
            leftAt: { [Op.is]: null },
          } as any,
        });

        const group = membership.groupChat;

        return {
          id: group.id,
          name: group.name,
          avatarUrl: group.avatarUrl,
          isBroadcastOnly: group.isBroadcastOnly,
          isJoinable: group.isJoinable,
          memberCount,
          unreadCount,
          conversation: group.conversation,
          isMember: true, // Always true for this endpoint (user's groups)
          lastJoinedAt: membership.joinedAt,
          currentUserRole: membership.role, // 'admin' or 'member'
        };
      }),
    );

    // Get total count
    const total = await this.groupMemberModel.count({
      where: {
        memberId: userId,
        memberType: userType,
        leftAt: { [Op.is]: null },
      } as any,
      include: [
        {
          model: this.groupChatModel,
          as: 'groupChat',
          where: { isActive: true },
        },
      ],
    });

    return {
      groups: groupsWithUnread,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Join a group (self-join for influencers)
   */
  async joinGroup(groupId: number, userId: number, userType: string) {
    // Get group
    const group = await this.groupChatModel.findByPk(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (!group.isActive) {
      throw new BadRequestException('Cannot join inactive group');
    }

    if (!group.isJoinable) {
      throw new BadRequestException('This group does not allow self-joining. You must be invited by an admin.');
    }

    // Check if user is already a member
    const existingMember = await this.groupMemberModel.findOne({
      where: {
        groupChatId: groupId,
        memberId: userId,
        memberType: userType,
        leftAt: { [Op.is]: null },
      } as any,
    });

    if (existingMember) {
      throw new BadRequestException('You are already a member of this group');
    }

    // Check if user previously left and is rejoining
    const previousMember = await this.groupMemberModel.findOne({
      where: {
        groupChatId: groupId,
        memberId: userId,
        memberType: userType,
        leftAt: { [Op.not]: null },
      } as any,
      order: [['leftAt', 'DESC']],
    });

    // Count current active members
    const currentMemberCount = await this.groupMemberModel.count({
      where: {
        groupChatId: groupId,
        leftAt: { [Op.is]: null },
      } as any,
    });

    // Validate member limit
    if (currentMemberCount >= group.maxMembers) {
      throw new BadRequestException(
        `Cannot join group. Maximum member limit (${group.maxMembers}) reached.`,
      );
    }

    // If user previously was a member, reactivate their membership
    if (previousMember) {
      await previousMember.update({
        leftAt: null as any,
        joinedAt: new Date(),
      });
    } else {
      // Create new membership
      await this.groupMemberModel.create({
        groupChatId: groupId,
        memberId: userId,
        memberType: userType as MemberType,
        role: MemberRole.MEMBER,
        joinedAt: new Date(),
      } as any);
    }

    // Get conversation ID for WebSocket broadcast
    const conversation = await this.conversationModel.findOne({
      where: { groupChatId: groupId },
    });

    // Emit WebSocket event
    if (conversation && this.chatGateway) {
      await this.chatGateway.emitGroupMemberAdded(
        groupId,
        conversation.id,
        userId,
        userType,
        userId, // Self-joined
        userType,
      );
    }

    return {
      success: true,
      message: 'Successfully joined the group',
      groupId,
      conversationId: conversation?.id,
    };
  }

  /**
   * Get available/joinable groups (shows all community groups to users)
   */
  async getAvailableGroups(
    userId: number,
    userType: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const offset = (page - 1) * limit;

    // Find all active, joinable groups (community groups)
    const { rows: groups, count: totalCount } = await this.groupChatModel.findAndCountAll({
      where: {
        isActive: true,
        isJoinable: true,
      },
      include: [
        {
          model: this.conversationModel,
          as: 'conversation',
        },
      ],
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    // Enrich with member status for each group
    const groupsWithMemberStatus = await Promise.all(
      groups.map(async (group) => {
        const isMember = await this.groupMemberModel.findOne({
          where: {
            groupChatId: group.id,
            memberId: userId,
            memberType: userType,
            leftAt: { [Op.is]: null },
          } as any,
        });

        // Get member count
        const memberCount = await this.groupMemberModel.count({
          where: {
            groupChatId: group.id,
            leftAt: { [Op.is]: null },
          } as any,
        });

        return {
          id: group.id,
          name: group.name,
          avatarUrl: group.avatarUrl,
          isBroadcastOnly: group.isBroadcastOnly,
          memberCount,
          maxMembers: group.maxMembers,
          isMember: !!isMember, // Flag to show "Join" or "Joined" in UI
          isFull: memberCount >= group.maxMembers,
          conversation: group.conversation,
          createdAt: group.createdAt,
        };
      }),
    );

    // Return ALL groups (including ones user is already in)
    // The UI can use isMember flag to show different states
    return {
      groups: groupsWithMemberStatus,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  /**
   * Leave a group
   */
  async leaveGroup(groupId: number, userId: number, userType: string) {
    // Get group
    const group = await this.groupChatModel.findByPk(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Get member
    const member = await this.groupMemberModel.findOne({
      where: {
        groupChatId: groupId,
        memberId: userId,
        memberType: userType,
        leftAt: { [Op.is]: null },
      } as any,
    });

    if (!member) {
      throw new NotFoundException('You are not a member of this group');
    }

    // Check if user is the last admin
    if (member.role === MemberRole.ADMIN) {
      const adminCount = await this.groupMemberModel.count({
        where: {
          groupChatId: groupId,
          role: MemberRole.ADMIN,
          leftAt: { [Op.is]: null },
        } as any,
      });

      if (adminCount === 1) {
        // Check if there are other members
        const totalMembers = await this.groupMemberModel.count({
          where: {
            groupChatId: groupId,
            leftAt: { [Op.is]: null },
          } as any,
        });

        if (totalMembers > 1) {
          throw new BadRequestException(
            'Cannot leave: you are the last admin. Please promote another member to admin first.',
          );
        }
      }
    }

    // Soft delete: set leftAt timestamp
    await member.update({
      leftAt: new Date(),
    });

    // Check if this was the last member
    const remainingMembers = await this.groupMemberModel.count({
      where: {
        groupChatId: groupId,
        leftAt: { [Op.is]: null },
      } as any,
    });

    // If no members left, mark group as inactive
    if (remainingMembers === 0) {
      await group.update({ isActive: false });
    }

    // Get conversation ID for WebSocket
    const conversation = await this.conversationModel.findOne({
      where: { groupChatId: groupId },
    });

    return {
      success: true,
      groupId,
      conversationId: conversation?.id,
    };
  }

  /**
   * Get unread message count for a user in a group
   */
  async getGroupUnreadCount(
    groupId: number,
    userId: number,
    userType: string,
  ): Promise<number> {
    // Get member's last read message ID
    const member = await this.groupMemberModel.findOne({
      where: {
        groupChatId: groupId,
        memberId: userId,
        memberType: userType,
        leftAt: { [Op.is]: null },
      } as any,
    });

    if (!member) {
      return 0;
    }

    // Get conversation
    const conversation = await this.conversationModel.findOne({
      where: { groupChatId: groupId },
    });

    if (!conversation) {
      return 0;
    }

    // Count messages after last read that are not from this user
    const whereClause: any = {
      conversationId: conversation.id,
    };

    if (member.lastReadMessageId) {
      whereClause.id = { [Op.gt]: member.lastReadMessageId };
    }

    // Exclude messages sent by this user
    whereClause[Op.not] = {
      senderId: userId,
      senderType: userType,
    };

    const unreadCount = await this.messageModel.count({
      where: whereClause,
    });

    return unreadCount;
  }

  /**
   * Check if user is a member of a group
   */
  async isMember(
    groupId: number,
    userId: number,
    userType: string,
  ): Promise<boolean> {
    const member = await this.groupMemberModel.findOne({
      where: {
        groupChatId: groupId,
        memberId: userId,
        memberType: userType,
        leftAt: { [Op.is]: null },
      } as any,
    });

    return !!member;
  }

  /**
   * Check if user is admin of a group
   */
  async isAdmin(
    groupId: number,
    userId: number,
    userType: string,
  ): Promise<boolean> {
    const member = await this.groupMemberModel.findOne({
      where: {
        groupChatId: groupId,
        memberId: userId,
        memberType: userType,
        role: MemberRole.ADMIN,
        leftAt: { [Op.is]: null },
      } as any,
    });

    return !!member;
  }
}
