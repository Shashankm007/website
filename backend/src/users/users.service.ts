import { Injectable, NotFoundException } from '@nestjs/common';
import { Address, OrderStatus, Prisma, Role, User, UserStatus } from '@prisma/client';
import { Paginated, paginate } from '../common/interfaces/api-response.interface';
import { sanitizePlain } from '../common/utils/sanitize';
import { PrismaService } from '../prisma/prisma.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

/** Public user shape — never exposes passwordHash. */
export type PublicUser = Omit<User, 'passwordHash'>;

/** Order statuses that count as realized spend. */
const REVENUE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PRINTING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

/** Admin list row: public user + lifetime order stats. */
export type AdminUserListItem = PublicUser & { orderCount: number; totalSpentCents: number };

/** Fields safe to return to clients/admins (everything except the password hash). */
const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  status: true,
  provider: true,
  emailVerified: true,
  avatarUrl: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Profile -------------------------------------------------------------

  /** Current user's public profile plus their addresses. */
  async getProfile(userId: string): Promise<PublicUser & { addresses: Address[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ...PUBLIC_USER_SELECT, addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] } },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Update the current user's name/phone. */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<PublicUser> {
    await this.ensureUserExists(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name !== undefined ? sanitizePlain(dto.name) || null : undefined,
        phone: dto.phone !== undefined ? sanitizePlain(dto.phone) || null : undefined,
      },
      select: PUBLIC_USER_SELECT,
    });
  }

  // --- Addresses -----------------------------------------------------------

  /** List the current user's addresses (default first). */
  listAddresses(userId: string): Promise<Address[]> {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /** Create an address; the first address (or one flagged default) becomes the default. */
  async addAddress(userId: string, dto: CreateAddressDto): Promise<Address> {
    await this.ensureUserExists(userId);
    const existingCount = await this.prisma.address.count({ where: { userId } });
    const makeDefault = dto.isDefault === true || existingCount === 0;

    return this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.address.create({
        data: {
          userId,
          type: dto.type,
          fullName: sanitizePlain(dto.fullName),
          line1: sanitizePlain(dto.line1),
          line2: dto.line2 !== undefined ? sanitizePlain(dto.line2) || null : undefined,
          city: sanitizePlain(dto.city),
          state: dto.state !== undefined ? sanitizePlain(dto.state) || null : undefined,
          postalCode: sanitizePlain(dto.postalCode),
          country: dto.country ? sanitizePlain(dto.country) : undefined,
          phone: dto.phone !== undefined ? sanitizePlain(dto.phone) || null : undefined,
          isDefault: makeDefault,
        },
      });
    });
  }

  /** Update an address the current user owns. */
  async updateAddress(userId: string, id: string, dto: UpdateAddressDto): Promise<Address> {
    await this.getAddressForUser(userId, id);
    const setDefault = dto.isDefault === true;

    return this.prisma.$transaction(async (tx) => {
      if (setDefault) {
        await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.address.update({
        where: { id },
        data: {
          type: dto.type,
          fullName: dto.fullName !== undefined ? sanitizePlain(dto.fullName) : undefined,
          line1: dto.line1 !== undefined ? sanitizePlain(dto.line1) : undefined,
          line2: dto.line2 !== undefined ? sanitizePlain(dto.line2) || null : undefined,
          city: dto.city !== undefined ? sanitizePlain(dto.city) : undefined,
          state: dto.state !== undefined ? sanitizePlain(dto.state) || null : undefined,
          postalCode: dto.postalCode !== undefined ? sanitizePlain(dto.postalCode) : undefined,
          country: dto.country !== undefined ? sanitizePlain(dto.country) : undefined,
          phone: dto.phone !== undefined ? sanitizePlain(dto.phone) || null : undefined,
          isDefault: setDefault ? true : undefined,
        },
      });
    });
  }

  /** Delete an address the current user owns; promotes another to default if needed. */
  async deleteAddress(userId: string, id: string): Promise<void> {
    const address = await this.getAddressForUser(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.address.delete({ where: { id } });
      if (address.isDefault) {
        const next = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
        if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
  }

  /** Mark an address as the user's default, unsetting any other default (atomic). */
  async setDefaultAddress(userId: string, id: string): Promise<Address> {
    await this.getAddressForUser(userId, id);
    const [, updated] = await this.prisma.$transaction([
      this.prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
      this.prisma.address.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return updated;
  }

  /** Fetch an address scoped to a user; throws if missing or not owned (used by OrdersService). */
  async getAddressForUser(userId: string, id: string): Promise<Address> {
    const address = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  // --- Admin ---------------------------------------------------------------

  /** Paginated user listing with optional search/role/status filters + order stats. */
  async adminList(query: AdminUserQueryDto): Promise<Paginated<AdminUserListItem>> {
    const { page, limit, skip } = query;
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: PUBLIC_USER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    // Lifetime order count + realized spend for the listed users.
    const ids = items.map((u) => u.id);
    const [orderCounts, spend] = await Promise.all([
      this.prisma.order.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _count: { _all: true } }),
      this.prisma.order.groupBy({
        by: ['userId'],
        where: { userId: { in: ids }, status: { in: REVENUE_STATUSES } },
        _sum: { totalCents: true },
      }),
    ]);
    const countMap = new Map(orderCounts.map((o) => [o.userId, o._count._all]));
    const spendMap = new Map(spend.map((s) => [s.userId, s._sum.totalCents ?? 0]));

    const enriched: AdminUserListItem[] = items.map((u) => ({
      ...u,
      orderCount: countMap.get(u.id) ?? 0,
      totalSpentCents: spendMap.get(u.id) ?? 0,
    }));

    return paginate(enriched, total, page, limit);
  }

  /** Admin: full user record (no passwordHash) with addresses, recent orders, and stats. */
  async adminFindById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...PUBLIC_USER_SELECT,
        addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, orderNumber: true, status: true, totalCents: true, currency: true, createdAt: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const [orderCount, spendAgg] = await Promise.all([
      this.prisma.order.count({ where: { userId: id } }),
      this.prisma.order.aggregate({ where: { userId: id, status: { in: REVENUE_STATUSES } }, _sum: { totalCents: true } }),
    ]);

    return { ...user, orderCount, totalSpentCents: spendAgg._sum.totalCents ?? 0 };
  }

  /** Admin: set a user's status (ACTIVE/BLOCKED). */
  async adminSetStatus(id: string, status: UserStatus): Promise<PublicUser> {
    await this.ensureUserExists(id);
    return this.prisma.user.update({ where: { id }, data: { status }, select: PUBLIC_USER_SELECT });
  }

  /** Admin: set a user's role (CUSTOMER/ADMIN). */
  async adminSetRole(id: string, role: Role): Promise<PublicUser> {
    await this.ensureUserExists(id);
    return this.prisma.user.update({ where: { id }, data: { role }, select: PUBLIC_USER_SELECT });
  }

  // --- Helpers -------------------------------------------------------------

  private async ensureUserExists(id: string): Promise<void> {
    const exists = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('User not found');
  }
}
